import asyncio
import logging
import time
import httpx
from app.core.config import settings
from app.ml.ml_engine import detector_manager
from app.ml.forecaster import forecaster_manager

logger = logging.getLogger(__name__)

# Minimum seconds between ML_ANOMALY alerts for the same node.
# Prevents alert floods when the model oscillates near the decision boundary
# or when the poller restarts while a reading is still being scored.
ALERT_COOLDOWN_SECONDS = 60


async def start_polling_loop():
    logger.info(
        f"Starting async polling loop every {settings.poll_interval_seconds}s "
        f"targeting {settings.backend_url} "
        f"(alert cooldown: {ALERT_COOLDOWN_SECONDS}s per node)"
    )

    # Dedup guard 1: skip if we've already processed this exact reading timestamp.
    last_processed_timestamps: dict[str, str] = {}

    # Dedup guard 2: cooldown — don't re-alert within ALERT_COOLDOWN_SECONDS.
    last_alert_time: dict[str, float] = {}
    
    # Dedup guard 3: cooldown for forecasts
    last_forecast_alert_time: dict[str, float] = {}

    async with httpx.AsyncClient(base_url=settings.backend_url, timeout=10.0) as client:
        while True:
            try:
                await asyncio.sleep(settings.poll_interval_seconds)

                # 1. Discover active nodes
                nodes_resp = await client.get("/api/nodes")
                if nodes_resp.status_code != 200:
                    logger.error(f"Failed to fetch nodes: {nodes_resp.status_code}")
                    continue

                nodes = nodes_resp.json()

                for node in nodes:
                    node_id = node.get("nodeId")
                    if not node_id:
                        continue
                        
                    # Skip if ML is disabled for this node
                    if node.get("mlEnabled") is False:
                        continue

                    # 2. Fetch latest telemetry for each node
                    telemetry_resp = await client.get(f"/api/sensor-data/latest/{node_id}")
                    if telemetry_resp.status_code != 200:
                        continue

                    data_list = telemetry_resp.json()
                    if not data_list:
                        continue

                    # Take the most recent reading (index 0 = latest)
                    latest_reading = data_list[0]
                    timestamp = latest_reading.get("timestamp")

                    # Guard 1: skip already-processed readings
                    if last_processed_timestamps.get(node_id) == timestamp:
                        continue
                    last_processed_timestamps[node_id] = timestamp

                    # Current sensor readings (10 features)
                    current_fields = [
                        "temperature", "humidity", "co2", "tvoc", "eco2",
                        "pm1_0", "pm2_5", "pm4_0", "pm10", "lightIntensity"
                    ]
                    
                    # Statistical aggregation fields (27 features: 9 sensors × 3 stats)
                    stats_fields = [
                        "temperatureMean", "temperatureStd", "temperatureMax",
                        "humidityMean", "humidityStd", "humidityMax",
                        "co2Mean", "co2Std", "co2Max",
                        "tvocMean", "tvocStd", "tvocMax",
                        "eco2Mean", "eco2Std", "eco2Max",
                        "pm1_0Mean", "pm1_0Std", "pm1_0Max",
                        "pm2_5Mean", "pm2_5Std", "pm2_5Max",
                        "pm4_0Mean", "pm4_0Std", "pm4_0Max",
                        "pm10Mean", "pm10Std", "pm10Max",
                    ]
                    
                    required_fields = current_fields + stats_fields
                    if not all(k in latest_reading and latest_reading[k] is not None for k in required_fields):
                        logger.debug(f"Missing required fields for node {node_id}")
                        continue

                    # Build 37-dimensional feature vector (10 current + 27 statistics)
                    features = [
                        # Current readings (10)
                        latest_reading["temperature"],
                        latest_reading["humidity"],
                        latest_reading["co2"],
                        latest_reading["tvoc"],
                        latest_reading["eco2"],
                        latest_reading["pm1_0"],
                        latest_reading["pm2_5"],
                        latest_reading["pm4_0"],
                        latest_reading["pm10"],
                        latest_reading["lightIntensity"],
                        # Temperature statistics (3)
                        latest_reading["temperatureMean"],
                        latest_reading["temperatureStd"],
                        latest_reading["temperatureMax"],
                        # Humidity statistics (3)
                        latest_reading["humidityMean"],
                        latest_reading["humidityStd"],
                        latest_reading["humidityMax"],
                        # CO2 statistics (3)
                        latest_reading["co2Mean"],
                        latest_reading["co2Std"],
                        latest_reading["co2Max"],
                        # TVOC statistics (3)
                        latest_reading["tvocMean"],
                        latest_reading["tvocStd"],
                        latest_reading["tvocMax"],
                        # eCO2 statistics (3)
                        latest_reading["eco2Mean"],
                        latest_reading["eco2Std"],
                        latest_reading["eco2Max"],
                        # PM1.0 statistics (3)
                        latest_reading["pm1_0Mean"],
                        latest_reading["pm1_0Std"],
                        latest_reading["pm1_0Max"],
                        # PM2.5 statistics (3)
                        latest_reading["pm2_5Mean"],
                        latest_reading["pm2_5Std"],
                        latest_reading["pm2_5Max"],
                        # PM4.0 statistics (3)
                        latest_reading["pm4_0Mean"],
                        latest_reading["pm4_0Std"],
                        latest_reading["pm4_0Max"],
                        # PM10 statistics (3)
                        latest_reading["pm10Mean"],
                        latest_reading["pm10Std"],
                        latest_reading["pm10Max"],
                    ]

                    # Sanity Filter: Skip inference if any hardware fault placeholders (-999.0) are present
                    if any(v <= -900.0 for v in features):
                        logger.warning(f"Hardware fault detected for node {node_id}; skipping ML inference.")
                        continue

                    window_size = node.get("baselineWindowSize", 20)
                    sensitivity = node.get("sensitivity", 5)

                    # 3. Run ML inference (Anomaly Detection)
                    is_anomaly, anomaly_context, anomaly_action = detector_manager.process(
                        node_id, features, window_size=window_size, sensitivity=sensitivity
                    )

                    if is_anomaly:
                        # Guard 2: cooldown — suppress repeated anomaly alerts
                        now = time.monotonic()
                        if now - last_alert_time.get(node_id, 0.0) >= ALERT_COOLDOWN_SECONDS:
                            last_alert_time[node_id] = now
                            alert_payload = {
                                "nodeId": node_id,
                                "type": "ML_ANOMALY",
                                "severity": "WARNING",
                                "message": (
                                    f"IsolationForest detected unusual multi-variable "
                                    f"behavior pattern on {node_id}"
                                ),
                                "context": anomaly_context,
                                "recommendedAction": anomaly_action,
                            }
                            alert_resp = await client.post("/api/alerts", json=alert_payload)
                            if alert_resp.status_code in (200, 201):
                                logger.info(f"Dispatched ML_ANOMALY alert for {node_id}")
                            else:
                                logger.error(f"Failed to dispatch anomaly alert for {node_id}: {alert_resp.text}")

                    # 4. Run Forecasting
                    try:
                        from datetime import datetime, timezone
                        # Handle trailing 'Z' which fromisoformat (<3.11) might struggle with in some cases
                        ts_str = timestamp.replace("Z", "+00:00")
                        ts_sec = datetime.fromisoformat(ts_str).timestamp()
                        
                        # Extract forecast horizon from Java backend
                        horizon_min = node.get("forecastHorizonMin", 30)
                        
                        proj_co2, proj_pm25, forecast_context, forecast_action = forecaster_manager.process(
                            node_id=node_id,
                            timestamp=ts_sec,
                            co2=latest_reading["co2"],
                            pm2_5=latest_reading["pm2_5"],
                            horizon_sec=horizon_min * 60.0
                        )
                        
                        if proj_co2 is not None and proj_pm25 is not None:
                            forecast_alerts = []
                            if proj_co2 > 1500:
                                forecast_alerts.append(f"CO2 projected to reach {proj_co2:.0f}ppm")
                            if proj_pm25 > 35:
                                forecast_alerts.append(f"PM2.5 projected to reach {proj_pm25:.1f}µg/m³")
                                
                            if forecast_alerts:
                                # Guard 3: cooldown for forecast alerts
                                now_f = time.monotonic()
                                if now_f - last_forecast_alert_time.get(node_id, 0.0) >= ALERT_COOLDOWN_SECONDS:
                                    last_forecast_alert_time[node_id] = now_f
                                    forecast_msg = " and ".join(forecast_alerts) + " within 30 minutes."
                                    f_payload = {
                                        "nodeId": node_id,
                                        "type": "FORECAST_WARNING",
                                        "severity": "WARNING",
                                        "message": forecast_msg,
                                        "context": forecast_context,
                                        "recommendedAction": forecast_action,
                                    }
                                    f_resp = await client.post("/api/alerts", json=f_payload)
                                    if f_resp.status_code in (200, 201):
                                        logger.info(f"Dispatched FORECAST_WARNING for {node_id}")
                                    else:
                                        logger.error(f"Failed to dispatch forecast alert for {node_id}: {f_resp.text}")
                                
                    except Exception as e:
                        logger.error(f"Error computing forecast for {node_id}: {str(e)}")

            except asyncio.CancelledError:
                logger.info("Polling loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in polling loop: {str(e)}")
