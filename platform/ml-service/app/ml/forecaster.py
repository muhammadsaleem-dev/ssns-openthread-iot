import logging
from collections import deque
import numpy as np

logger = logging.getLogger(__name__)

class LightweightForecaster:
    """
    Maintains a rolling window of telemetry to compute a linear regression
    slope and project future values.
    """
    def __init__(self, history_size: int = 60):
        # Store tuples of (timestamp_sec, co2, pm2_5)
        self.history = deque(maxlen=history_size)
    
    def add_reading(self, timestamp: float, co2: float, pm2_5: float):
        self.history.append((timestamp, co2, pm2_5))
        
    def forecast(self, horizon_sec: float) -> tuple[float | None, float | None, str | None, str | None]:
        """
        Returns projected (co2, pm2_5, context_str, recommended_action) at `latest_time + horizon_sec`.
        If not enough data (e.g., < 40 readings = 10 minutes), returns (None, None, None, None).
        """
        if len(self.history) < 40:
            return None, None, None, None
            
        # Apply Exponential Moving Average (EMA) smoothing to filter out momentary transient breath spikes
        def _ema(arr, alpha=0.25):
            res = np.empty_like(arr)
            res[0] = arr[0]
            for i in range(1, len(arr)):
                res[i] = alpha * arr[i] + (1 - alpha) * res[i-1]
            return res

        times = np.array([x[0] for x in self.history])
        co2_vals = _ema(np.array([x[1] for x in self.history]))
        pm25_vals = _ema(np.array([x[2] for x in self.history]))
        
        # Simple linear regression: y = mx + c
        t_mean = np.mean(times)
        t_diff = times - t_mean
        t_diff_sq_sum = np.sum(t_diff**2)
        
        if t_diff_sq_sum == 0:
            return None, None, None, None
            
        # CO2 projection
        co2_slope = np.sum(t_diff * (co2_vals - np.mean(co2_vals))) / t_diff_sq_sum
        co2_intercept = np.mean(co2_vals) - co2_slope * t_mean
        
        # PM2.5 projection
        pm25_slope = np.sum(t_diff * (pm25_vals - np.mean(pm25_vals))) / t_diff_sq_sum
        pm25_intercept = np.mean(pm25_vals) - pm25_slope * t_mean
        
        target_time = times[-1] + horizon_sec
        
        proj_co2 = co2_slope * target_time + co2_intercept
        proj_pm25 = pm25_slope * target_time + pm25_intercept
        
        co2_slope_min = co2_slope * 60
        pm25_slope_min = pm25_slope * 60
        horizon_min = int(horizon_sec / 60)
        
        context_str = (
            f"Projection in {horizon_min}m | "
            f"CO2: {proj_co2:.0f} ppm ({co2_slope_min:+.1f}/min) | "
            f"PM2.5: {proj_pm25:.1f} µg/m³ ({pm25_slope_min:+.2f}/min) | "
            f"Based on {len(self.history)} readings"
        )
        
        recommended_action = None
        if proj_co2 > 1500 and proj_pm25 > 35:
            recommended_action = "Proactively increase ventilation and check air filters to prevent dual breach."
        elif proj_co2 > 1500:
            recommended_action = "Proactively increase fresh air intake to prevent CO2 breach."
        elif proj_pm25 > 35:
            recommended_action = "Proactively check air filters to prevent particulate breach."
        
        return proj_co2, proj_pm25, context_str, recommended_action

class NodeForecasterManager:
    def __init__(self, history_size: int = 60):
        self.forecasters: dict[str, LightweightForecaster] = {}
        self.history_size = history_size
        
    def process(self, node_id: str, timestamp: float, co2: float, pm2_5: float, horizon_sec: float = 1800.0) -> tuple[float | None, float | None, str | None, str | None]:
        if node_id not in self.forecasters:
            self.forecasters[node_id] = LightweightForecaster(self.history_size)
            
        forecaster = self.forecasters[node_id]
        forecaster.add_reading(timestamp, co2, pm2_5)
        return forecaster.forecast(horizon_sec)

forecaster_manager = NodeForecasterManager(history_size=60)
