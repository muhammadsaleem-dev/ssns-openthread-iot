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
    def __init__(self, baseline_window_size: int, sensitivity: int = 5, node_id: str = ""):
        self.baseline_window_size = baseline_window_size
        self.sensitivity = sensitivity
        self.node_id = node_id
        self.baseline_data = []
        self.is_fitted = False

        self.medians: np.ndarray | None = None
        self.iqr: np.ndarray | None = None
        self.last_valid_vector: list[float] | None = None
        self.missing_ticks: dict[int, int] = {}

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

    def _fit_model(self, data_list: list[list[float]]) -> None:
        """Compute robust medians & IQR, scale data, and fit IsolationForest."""
        X = np.array(data_list, dtype=float)
        self.medians = np.median(X, axis=0)
        iqr = np.percentile(X, 75, axis=0) - np.percentile(X, 25, axis=0)
        iqr[iqr == 0] = 1e-9  # Stabilize flatline sensors against zero-division
        self.iqr = iqr

        X_scaled = self._scale_features(X)
        self.model.fit(X_scaled)
        self.is_fitted = True

        if self.node_id:
            try:
                payload = {
                    'model': self.model,
                    'medians': self.medians,
                    'iqr': self.iqr
                }
                joblib.dump(payload, _model_path(self.node_id))
                logger.info(f"Persisted fitted model and scalers for node {self.node_id}")
            except Exception as exc:
                logger.warning(f"Could not persist model for {self.node_id}: {exc}")

    def _check_and_apply_drift_retraining(self, recent_window: np.ndarray) -> None:
        if len(self.baseline_data) < self.baseline_window_size:
            return

        baseline_np = np.array(self.baseline_data[:self.baseline_window_size])

        # Simple K-S test max difference across key channels (e.g. CO2 = index 2)
        if recent_window.shape[1] > 2:
            base_sorted = np.sort(baseline_np[:, 2])
            recent_sorted = np.sort(recent_window[:, 2])

            if len(base_sorted) > 0 and len(recent_sorted) > 0:
                base_interp = np.interp(np.linspace(0, 1, len(recent_sorted)), np.linspace(0, 1, len(base_sorted)), base_sorted)
                d_ks = np.max(np.abs(base_interp - recent_sorted)) / (np.max(base_sorted) - np.min(base_sorted) + 1e-9)

                # Condition: significant shift but stable variance, no emergency
                if d_ks >= 0.25:
                    recent_scaled = self._scale_features(recent_window)
                    scores = self.model.decision_function(recent_scaled)
                    score_var = np.var(scores)
                    max_co2 = np.max(recent_window[:, 2])

                    if score_var < 0.05 and max_co2 <= 1500:
                        logger.info(f"Drift detected (D_KS={d_ks:.2f}). Auto-retraining node {self.node_id}.")
                        self.baseline_data = recent_window.tolist()
                        self._fit_model(self.baseline_data)


    def process_telemetry(self, feature_vector: list) -> tuple[bool, str | None, str | None]:
        """
        Process a new telemetry feature vector.
        Returns a tuple: (is_anomalous, context_string, recommended_action)
        """
        clean_vector = self._impute_missing_values(feature_vector)

        if not self.is_fitted:
            self.baseline_data.append(clean_vector)
            if len(self.baseline_data) >= self.baseline_window_size:
                logger.info(
                    f"Collected {self.baseline_window_size} vectors for node {self.node_id}. "
                    f"Auto-fitting Isolation Forest baseline..."
                )
                self._fit_model(self.baseline_data)
                logger.info("Baseline fit complete. Anomaly detection is now active.")
            return False, None, None

        # Manage rolling window for drift retraining
        self.baseline_data.append(clean_vector)
        if len(self.baseline_data) > self.baseline_window_size * 2:
            self.baseline_data.pop(0)

        recent_window = np.array(self.baseline_data[-self.baseline_window_size:])
        if len(recent_window) == self.baseline_window_size:
            self._check_and_apply_drift_retraining(recent_window)

        # Predict anomaly
        X_test = np.array([clean_vector], dtype=float)
        X_test_scaled = self._scale_features(X_test)

        score = float(self.model.decision_function(X_test_scaled)[0])
        threshold_offset = (self.sensitivity - 5) * 0.005
        is_anomaly = (score < threshold_offset)

        context_str = None
        recommended_action = None
        if is_anomaly:
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

        return is_anomaly, context_str, recommended_action


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
