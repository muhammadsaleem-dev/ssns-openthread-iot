import logging
import os
import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

logger = logging.getLogger(__name__)

# Directory for persisted model files.
MODEL_DIR = os.environ.get("ML_MODEL_DIR", "/tmp/ble_ml_models")
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

        # Sensitivity 1-100 translates to contamination 0.01-1.0
        contamination_val = max(0.01, min(1.0, sensitivity / 100.0))

        # Attempt to restore a previously persisted model.
        saved_path = _model_path(node_id)
        if node_id and os.path.exists(saved_path):
            try:
                self.model = joblib.load(saved_path)
                self.is_fitted = True
                logger.info(f"Restored persisted IsolationForest model for node {node_id} from {saved_path}")
            except Exception as exc:
                logger.warning(f"Could not load saved model for {node_id}: {exc}. Starting fresh.")
                self.model = IsolationForest(contamination=contamination_val, random_state=42)
        else:
            self.model = IsolationForest(contamination=contamination_val, random_state=42)

    def process_telemetry(self, feature_vector: list) -> tuple[bool, str | None, str | None]:
        """
        Process a new telemetry feature vector.
        Returns a tuple: (is_anomalous, context_string, recommended_action)
        """
        if not self.is_fitted:
            self.baseline_data.append(feature_vector)
            if len(self.baseline_data) >= self.baseline_window_size:
                logger.info(
                    f"Collected {self.baseline_window_size} vectors for node {self.node_id}. "
                    f"Auto-fitting Isolation Forest baseline..."
                )
                X = np.array(self.baseline_data)
                self.model.fit(X)
                self.is_fitted = True
                logger.info("Baseline fit complete. Anomaly detection is now active.")

                # Persist the fitted model so restarts don't require a new warm-up.
                if self.node_id:
                    try:
                        joblib.dump(self.model, _model_path(self.node_id))
                        logger.info(f"Persisted fitted model for node {self.node_id}")
                    except Exception as exc:
                        logger.warning(f"Could not persist model for {self.node_id}: {exc}")

            return False, None, None

        # Predict anomaly
        X_test = np.array([feature_vector])
        prediction = self.model.predict(X_test)
        is_anomaly = (prediction[0] == -1)

        context_str = None
        recommended_action = None
        if is_anomaly:
            score = self.model.decision_function(X_test)[0]
            logger.warning(f"ML Anomaly Detected on {self.node_id}! Score: {score:.3f}")
            
            feature_names = ["Temp", "Humidity", "CO2", "TVOC", "eCO2", "PM1.0", "PM2.5", "PM4.0", "PM10", "Light"]
            if len(self.baseline_data) > 1:
                baseline_np = np.array(self.baseline_data)
                means = np.mean(baseline_np, axis=0)
                stds = np.std(baseline_np, axis=0)
                stds[stds == 0] = 1e-9 # avoid division by zero
                
                z_scores = np.abs((np.array(feature_vector) - means) / stds)
                top_2_idx = np.argsort(z_scores)[-2:][::-1]
                
                deviations = []
                for idx in top_2_idx:
                    name = feature_names[idx]
                    val = feature_vector[idx]
                    mean_val = means[idx]
                    if mean_val != 0:
                        pct = ((val - mean_val) / abs(mean_val)) * 100
                        sign = "+" if pct >= 0 else ""
                        deviations.append(f"{name} ({sign}{pct:.0f}% vs baseline)")
                    else:
                        deviations.append(f"{name} (val: {val:.1f})")
                
                context_str = f"Anomaly score: {score:.2f} | Key drivers: {', '.join(deviations)}"
                
                # Generate recommended action based on top driver
                top_driver_name = feature_names[top_2_idx[0]]
                if top_driver_name == "Temp":
                    recommended_action = "Inspect HVAC unit."
                elif top_driver_name == "CO2":
                    recommended_action = "Increase ventilation or open windows."
                elif "PM" in top_driver_name:
                    recommended_action = "Check building air filters; keep external windows closed."
                elif "VOC" in top_driver_name:
                    recommended_action = "Investigate for chemical spills or off-gassing."
                else:
                    recommended_action = "Perform general environmental inspection."
            else:
                context_str = f"Anomaly score: {score:.2f} | Multi-variable deviation detected"
                recommended_action = "Perform general environmental inspection."

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
            
        # Optional: check if the parameters changed significantly and force reset? 
        # But the Java API will hit /reset when the user clicks 'Apply & Recalibrate', 
        # so we don't need to auto-reset here.

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

