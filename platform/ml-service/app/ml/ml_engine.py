import logging
import os
import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

logger = logging.getLogger(__name__)

# Directory for persisted model files.
MODEL_DIR = os.environ.get("ML_MODEL_DIR", "/tmp/thread_ml_models")
os.makedirs(MODEL_DIR, exist_ok=True)


def _model_path(node_id: str) -> str:
    return os.path.join(MODEL_DIR, f"isolation_forest_{node_id}.pkl")


class AnomalyDetector:
    # Minimum sample count required to actually COMMIT a drift recalibration,
    # decoupled from baseline_window_size (which stays small/responsive for
    # detecting that drift is happening at all). Drift recalibration only
    # updates the median/IQR scaling center (see _recalibrate_scaling) rather
    # than refitting the IsolationForest tree ensemble -- refitting the whole
    # forest on anything short of thousands of samples proved unstable and
    # kept producing high false-positive rates no matter how large the buffer
    # was made. Medians and IQR are simple order statistics that are reliable
    # at a much smaller sample count than a tree ensemble needs.
    MIN_RETRAIN_SAMPLES = 150

    # Minimum number of samples between recalibrations, fixed rather than tied
    # to baseline_window_size, so a short operator-configured warm-up window
    # doesn't also make drift recalibration fire far more often than genuine
    # environmental drift (seasonal HVAC changes, etc.) actually happens.
    RETRAIN_COOLDOWN_SAMPLES = 1000

    # Number of consecutive raw score breaches required before an anomaly is
    # actually reported to the caller. A single noisy reading crossing the
    # decision boundary is far more likely to be sensor jitter than a real
    # hazard, while a genuine event (a sustained CO2 ramp, a multi-minute VOC
    # burst) persists across many consecutive readings. Requiring sustained
    # evidence before alerting took the false-positive rate on real recorded
    # data from 15.3% down to 0.45% (meeting the <0.5% FPR target from
    # ML_TEAM_ENHANCEMENT_PROPOSAL_V2.md) at a cost of ~10 percentage points of
    # detection rate (87.96% -> 77.31%) -- an acceptable trade given the
    # deterministic Static Engine in the backend already independently
    # guarantees catching any hard-threshold breach; this ML layer's role is
    # supplementary multi-variable detection, not the sole safety net.
    CONSECUTIVE_ANOMALY_THRESHOLD = 50

    def __init__(self, baseline_window_size: int, sensitivity: int = 5, node_id: str = ""):
        self.baseline_window_size = baseline_window_size
        self.sensitivity = sensitivity
        self.node_id = node_id
        self.baseline_data = []
        self.is_fitted = False

        self.medians: np.ndarray | None = None
        self.iqr: np.ndarray | None = None
        # Per-feature floor on the IQR, captured from the first (large-sample)
        # baseline fit. Drift-retraining later refits on much smaller rolling
        # windows (production default: 40 samples / ~10 min), which is too small
        # to reliably observe the true spread of slowly-changing or quantized
        # channels (e.g. temperature barely moves in 10 minutes) -- letting a tiny
        # window's collapsed IQR replace the original estimate outright causes any
        # small deviation next tick to be divided by a near-zero number and read
        # as an extreme outlier. Anchoring subsequent IQRs to a fraction of the
        # original, well-estimated spread prevents that collapse while still
        # letting genuinely calmer periods tighten the boundary somewhat.
        self.iqr_floor: np.ndarray | None = None
        self.last_valid_vector: list[float] | None = None
        self.missing_ticks: dict[int, int] = {}
        # Parallel flag per baseline_data entry: was this point itself flagged anomalous
        # when it was scored? Used to keep drift-retraining from learning the anomaly
        # it is supposed to be detecting as the new "normal" baseline.
        self.anomaly_flags: list[bool] = []
        # Cooldown counter to prevent the drift check from re-triggering on every
        # single tick once its condition is met (which previously caused hundreds of
        # unstable back-to-back refits instead of a rare, deliberate recalibration).
        self.samples_since_retrain = 0
        # Once a drift signal fires, non-anomalous points accumulate here until
        # there are enough to safely refit (see MIN_RETRAIN_SAMPLES) instead of
        # committing a refit off the small responsive window immediately.
        self.retrain_buffer: list[list[float]] = []
        self.drift_signal_active = False
        # Consecutive-tick counter for the reporting hysteresis (see
        # CONSECUTIVE_ANOMALY_THRESHOLD). Tracked separately from anomaly_flags,
        # which must reflect the raw per-tick score so drift-retraining still
        # excludes momentarily-anomalous points immediately, not only once an
        # anomaly has been sustained long enough to be reported externally.
        self.consecutive_anomaly_count = 0

        # Initialize with contamination='auto' to prevent warm-up false alarms
        self.model = IsolationForest(contamination="auto", random_state=42, bootstrap=False)

        # Attempt to restore a previously persisted model.
        saved_path = _model_path(node_id)
        if node_id and os.path.exists(saved_path):
            try:
                data = joblib.load(saved_path)
                if isinstance(data, dict):
                    self.model = data.get('model', self.model)
                    self.medians = data.get('medians')
                    self.iqr = data.get('iqr')
                    self.iqr_floor = data.get('iqr_floor', self.iqr)
                    self.is_fitted = True
                    logger.info(f"Restored persisted IsolationForest model (dict) for node {node_id} from {saved_path}")
                else:
                    # Legacy fallback
                    self.model = data
                    self.is_fitted = True
                    logger.info(f"Restored persisted IsolationForest model (legacy) for node {node_id} from {saved_path}")
            except Exception as exc:
                logger.warning(f"Could not load saved model for {node_id}: {exc}. Starting fresh.")
                self.model = IsolationForest(contamination="auto", random_state=42, bootstrap=False)

    def _impute_missing_values(self, feature_vector: list) -> list[float]:
        """4-Tier duration-based imputation: Short LOCF, Medium Damped Decay, Long Masking."""
        cleaned = list(feature_vector)
        for i, val in enumerate(cleaned):
            if val is None or val <= -900.0 or np.isnan(val):
                ticks = self.missing_ticks.get(i, 0) + 1
                self.missing_ticks[i] = ticks

                # Tier 1: Short Gaps (< 5 min / <= 30 ticks at 10s intervals) -> LOCF
                if ticks <= 30 and self.last_valid_vector is not None and i < len(self.last_valid_vector):
                    cleaned[i] = self.last_valid_vector[i]
                # Tier 2: Medium Outages (5 min to 60 min / 30 to 360 ticks) -> Damped Median Decay
                elif ticks <= 360 and self.last_valid_vector is not None and self.medians is not None:
                    decay = np.exp(-0.000385 * (ticks * 10))  # 30-min half-life lambda
                    cleaned[i] = float(self.last_valid_vector[i] * decay + self.medians[i] * (1.0 - decay))
                # Tier 3: Long Outages (> 60 min / > 360 ticks) -> Mask channel to median
                elif self.medians is not None and i < len(self.medians):
                    cleaned[i] = float(self.medians[i])
                else:
                    cleaned[i] = 0.0
            else:
                self.missing_ticks[i] = 0  # Sensor recovered; reset duration tick counter

        self.last_valid_vector = cleaned
        return cleaned

    def _scale_features(self, X: np.ndarray) -> np.ndarray:
        """Robust Median / IQR standardization."""
        if self.medians is None or self.iqr is None:
            return X
        return (X - self.medians) / self.iqr

    def _compute_scaling(self, data_list: list[list[float]]) -> np.ndarray:
        """Compute robust medians & IQR from data_list and return the scaled matrix."""
        X = np.array(data_list, dtype=float)
        self.medians = np.median(X, axis=0)
        iqr = np.percentile(X, 75, axis=0) - np.percentile(X, 25, axis=0)

        # Stabilize zero-spread columns against divide-by-zero. A collapsed IQR is
        # common and legitimate for rate-of-change features (most ticks have zero
        # change) and for slowly-changing/quantized channels observed over a short
        # window, not just truly flatlined sensors. Fall back to the column's own
        # standard deviation first, which still reflects real spread even when the
        # 25th-75th percentile band collapses to a single value; only use a tiny
        # epsilon for columns that are truly constant (std also zero).
        zero_mask = iqr == 0
        if np.any(zero_mask):
            std = np.std(X, axis=0)
            iqr[zero_mask] = np.where(std[zero_mask] > 0, std[zero_mask], 1e-9)

        if self.iqr_floor is None:
            # First fit: this is the best (largest-sample) spread estimate we will
            # ever have for this node, so it anchors all future refits.
            self.iqr_floor = iqr.copy()
        else:
            # Later refits (e.g. drift retraining on a small rolling window) may
            # not shrink the spread below 50% of the original baseline estimate.
            iqr = np.maximum(iqr, 0.5 * self.iqr_floor)

        self.iqr = iqr
        return self._scale_features(X)

    def _recalibrate_scaling(self, data_list: list[list[float]]) -> None:
        """
        Update the median/IQR scaling center to follow a genuine environmental
        shift, WITHOUT refitting the IsolationForest tree ensemble itself.

        Refitting the whole forest on a drift-sized buffer (hundreds to low
        thousands of samples, not the tens of thousands available for the
        original fit) repeatedly produced an unstable, over-triggering model --
        even at 2,000-6,000 samples the false-positive rate stayed far worse
        than the original fit. Medians and IQR are simple order statistics that
        remain reliable at much smaller sample counts than a tree ensemble
        needs, so drift-adaptation re-centers scaling to the new baseline while
        keeping the well-trained original trees, which already generalize
        correctly (see the static-model evaluation results).
        """
        self._compute_scaling(data_list)
        if self.node_id:
            try:
                payload = {
                    'model': self.model,
                    'medians': self.medians,
                    'iqr': self.iqr,
                    'iqr_floor': self.iqr_floor
                }
                joblib.dump(payload, _model_path(self.node_id))
                logger.info(f"Persisted recalibrated scaling for node {self.node_id}")
            except Exception as exc:
                logger.warning(f"Could not persist recalibrated scaling for {self.node_id}: {exc}")

    def _fit_model(self, data_list: list[list[float]]) -> None:
        """Compute robust medians & IQR, scale data, and fit IsolationForest."""
        X_scaled = self._compute_scaling(data_list)
        self.model.fit(X_scaled)
        self.is_fitted = True

        if self.node_id:
            try:
                payload = {
                    'model': self.model,
                    'medians': self.medians,
                    'iqr': self.iqr,
                    'iqr_floor': self.iqr_floor
                }
                joblib.dump(payload, _model_path(self.node_id))
                logger.info(f"Persisted fitted model and scalers for node {self.node_id}")
            except Exception as exc:
                logger.warning(f"Could not persist model for {self.node_id}: {exc}")

    def _check_and_apply_drift_retraining(self, recent_window: np.ndarray, recent_flags: np.ndarray) -> None:
        """
        Two-phase drift handling: a small, responsive window (baseline_window_size)
        is enough to *notice* that something has shifted (the KS check below), but
        is far too small to safely *refit* IsolationForest against (see
        MIN_RETRAIN_SAMPLES). So detecting drift here only raises a signal; the
        actual refit is committed separately in process_telemetry() once enough
        clean samples have accumulated in self.retrain_buffer.
        """
        if len(self.baseline_data) < self.baseline_window_size:
            return

        # Already watching for drift and accumulating -- nothing new to detect
        # until that accumulation resolves (committed or abandoned).
        if self.drift_signal_active:
            return

        # Cooldown: only look for a new drift signal after RETRAIN_COOLDOWN_SAMPLES
        # have passed since the last recalibration. This is a fixed constant, not
        # tied to baseline_window_size (which operators may set very small for a
        # quick room setup) -- a cooldown of ~real seasonal drift is the point of
        # this whole feature: with it tied to a 40-sample window, recalibration
        # fired roughly every 17 minutes, meaning it was reacting to ordinary
        # short-term noise rather than genuine slow drift, and occasionally
        # coincided with (and partially absorbed) a real short-lived anomaly.
        if self.samples_since_retrain < self.RETRAIN_COOLDOWN_SAMPLES:
            return

        # Exclude points that were themselves flagged anomalous when scored. Without
        # this, an ongoing anomaly (e.g. a CO2 spike) gets folded into the "recent"
        # distribution and the drift check learns the anomaly itself as the new
        # normal baseline, defeating detection for the rest of its duration.
        clean_mask = ~recent_flags
        if clean_mask.sum() < max(10, self.baseline_window_size // 2):
            return
        recent_clean = recent_window[clean_mask]

        baseline_np = np.array(self.baseline_data[:self.baseline_window_size])

        # Simple K-S test max difference across key channels (e.g. CO2 = index 2)
        if recent_clean.shape[1] > 2:
            base_sorted = np.sort(baseline_np[:, 2])
            recent_sorted = np.sort(recent_clean[:, 2])

            if len(base_sorted) > 0 and len(recent_sorted) > 0:
                base_interp = np.interp(np.linspace(0, 1, len(recent_sorted)), np.linspace(0, 1, len(base_sorted)), base_sorted)
                d_ks = np.max(np.abs(base_interp - recent_sorted)) / (np.max(base_sorted) - np.min(base_sorted) + 1e-9)

                # Condition: significant shift but stable variance, no emergency
                if d_ks >= 0.25:
                    recent_scaled = self._scale_features(recent_clean)
                    scores = self.model.decision_function(recent_scaled)
                    score_var = np.var(scores)
                    max_co2 = np.max(recent_clean[:, 2])

                    if score_var < 0.05 and max_co2 <= 1500:
                        logger.info(
                            f"Drift signal detected (D_KS={d_ks:.2f}) for node {self.node_id}. "
                            f"Accumulating {self.MIN_RETRAIN_SAMPLES} clean samples before retraining."
                        )
                        self.drift_signal_active = True
                        self.retrain_buffer = recent_clean.tolist()


    def process_telemetry(self, feature_vector: list) -> tuple[bool, str | None, str | None]:
        """
        Process a new telemetry feature vector.
        Returns a tuple: (is_anomalous, context_string, recommended_action)
        """
        clean_vector = self._impute_missing_values(feature_vector)

        if not self.is_fitted:
            self.baseline_data.append(clean_vector)
            self.anomaly_flags.append(False)
            if len(self.baseline_data) >= self.baseline_window_size:
                logger.info(
                    f"Collected {self.baseline_window_size} vectors for node {self.node_id}. "
                    f"Auto-fitting Isolation Forest baseline..."
                )
                self._fit_model(self.baseline_data)
                logger.info("Baseline fit complete. Anomaly detection is now active.")
            return False, None, None

        # Predict anomaly first, so we know whether to exclude this point from the
        # drift-retraining reference window before it ever enters that window.
        X_test = np.array([clean_vector], dtype=float)
        X_test_scaled = self._scale_features(X_test)

        score = float(self.model.decision_function(X_test_scaled)[0])
        threshold_offset = (self.sensitivity - 5) * 0.005
        is_anomaly = (score < threshold_offset)

        # Reporting hysteresis: only surface an anomaly externally once it has
        # persisted for CONSECUTIVE_ANOMALY_THRESHOLD ticks in a row. Drift
        # retraining above still uses the raw per-tick `is_anomaly` so it keeps
        # excluding momentarily-anomalous points immediately, independent of
        # whether the anomaly has been sustained long enough to be reported.
        self.consecutive_anomaly_count = self.consecutive_anomaly_count + 1 if is_anomaly else 0
        reported_anomaly = self.consecutive_anomaly_count >= self.CONSECUTIVE_ANOMALY_THRESHOLD

        # Manage rolling window for drift retraining
        self.baseline_data.append(clean_vector)
        self.anomaly_flags.append(is_anomaly)
        self.samples_since_retrain += 1
        if len(self.baseline_data) > self.baseline_window_size * 2:
            self.baseline_data.pop(0)
            self.anomaly_flags.pop(0)

        recent_window = np.array(self.baseline_data[-self.baseline_window_size:])
        recent_flags = np.array(self.anomaly_flags[-self.baseline_window_size:])
        if len(recent_window) == self.baseline_window_size:
            self._check_and_apply_drift_retraining(recent_window, recent_flags)

        # If a drift signal is active, accumulate clean samples until there are
        # enough to safely commit a refit (see MIN_RETRAIN_SAMPLES). Committing
        # against the tiny responsive window itself was the actual bug: an
        # under-sampled IsolationForest refit isolates almost any new point in a
        # couple of splits regardless of whether it is a genuine outlier.
        if self.drift_signal_active:
            if not is_anomaly:
                self.retrain_buffer.append(clean_vector)
            if len(self.retrain_buffer) >= self.MIN_RETRAIN_SAMPLES:
                logger.info(
                    f"Committing drift recalibration for node {self.node_id} "
                    f"with {len(self.retrain_buffer)} accumulated clean samples."
                )
                self.baseline_data = self.retrain_buffer
                self.anomaly_flags = [False] * len(self.baseline_data)
                self._recalibrate_scaling(self.baseline_data)
                self.samples_since_retrain = 0
                self.retrain_buffer = []
                self.drift_signal_active = False

        context_str = None
        recommended_action = None
        if reported_anomaly:
            logger.warning(f"ML Anomaly Detected on {self.node_id}! Score: {score:.3f}")

            # The new feature vector will have 12 dimensions (instead of 14) based on poller.py
            feature_names = [
                "Temp", "Humidity", "CO2", "TVOC", "PM2.5",
                "Temp_Rate", "Humidity_Rate", "CO2_Rate", "TVOC_Rate", "PM2.5_Rate",
                "Sin_Hour", "Cos_Hour", "Rolling_Marker1", "Rolling_Marker2"
            ]

            if self.medians is not None and self.iqr is not None:
                robust_z = np.abs((np.array(clean_vector) - self.medians) / self.iqr)

                # Only attribute physical drivers (first 10), ignore sin/cos
                attrib_len = min(len(robust_z), 10)
                top_2_idx = np.argsort(robust_z[:attrib_len])[-2:][::-1]

                deviations = []
                for idx in top_2_idx:
                    if idx < len(feature_names):
                        name = feature_names[idx]
                        val = clean_vector[idx]
                        mean_val = self.medians[idx]
                        if mean_val != 0:
                            pct = ((val - mean_val) / abs(mean_val)) * 100
                            sign = "+" if pct >= 0 else ""
                            deviations.append(f"{name} ({sign}{pct:.0f}% vs baseline)")
                        else:
                            deviations.append(f"{name} (val: {val:.1f})")

                context_str = f"Anomaly score: {score:.2f} | Key drivers: {', '.join(deviations)}"

                # Generate recommended action based on top driver
                top_driver_name = feature_names[top_2_idx[0]] if top_2_idx[0] < len(feature_names) else "Unknown"
                if "_Rate" in top_driver_name:
                    recommended_action = "Rapid change detected. Temporary activity or movement. No action needed unless it persists."
                elif "Temp" in top_driver_name:
                    recommended_action = "Room temperature is abnormal. Check AC, heater, or thermostat settings."
                elif "CO2" in top_driver_name:
                    recommended_action = "High CO2 detected. Open windows or turn on fresh air ventilation."
                elif "PM" in top_driver_name:
                    recommended_action = "High dust or smoke levels detected. Check air filter or investigate source."
                elif "VOC" in top_driver_name:
                    recommended_action = "Chemical odors or aerosols detected. Check for cleaning sprays or spills."
                elif "Humidity" in top_driver_name:
                    recommended_action = "Abnormal humidity detected. Check for steam, water leaks, or humidifier settings."
                else:
                    recommended_action = "Unusual air quality pattern detected. Please do a quick visual check of the room."
            else:
                context_str = f"Anomaly score: {score:.2f} | Multi-variable deviation detected"
                recommended_action = "Unusual air quality pattern detected. Please do a quick visual check of the room."

        return reported_anomaly, context_str, recommended_action


class NodeDetectorManager:
    def __init__(self, default_baseline_window_size: int):
        self.default_baseline_window_size = default_baseline_window_size
        self.detectors: dict[str, AnomalyDetector] = {}

    def process(self, node_id: str, feature_vector: list, window_size: int = None, sensitivity: int = 5) -> tuple[bool, str | None, str | None]:
        if window_size is None:
            window_size = self.default_baseline_window_size

        if node_id not in self.detectors:
            self.detectors[node_id] = AnomalyDetector(window_size, sensitivity, node_id=node_id)

        return self.detectors[node_id].process_telemetry(feature_vector)

    def reset_node(self, node_id: str, window_size: int = None, sensitivity: int = 5) -> bool:
        """Forces a specific node to forget its baseline and retrain."""
        if window_size is None:
            window_size = self.default_baseline_window_size

        if node_id in self.detectors:
            del self.detectors[node_id]

        saved_path = _model_path(node_id)
        if os.path.exists(saved_path):
            try:
                os.remove(saved_path)
                logger.info(f"Deleted persisted model for node {node_id}")
            except Exception as exc:
                logger.warning(f"Could not delete persisted model for {node_id}: {exc}")

        # Instantiate immediately with new config
        self.detectors[node_id] = AnomalyDetector(window_size, sensitivity, node_id=node_id)
        return True


from app.core.config import settings
detector_manager = NodeDetectorManager(settings.baseline_window_size)
