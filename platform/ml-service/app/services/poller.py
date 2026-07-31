import asyncio
import logging
import time
import httpx
import math
from datetime import datetime
from app.core.config import settings
from app.ml.ml_engine import detector_manager
from app.ml.forecaster import forecaster_manager

logger = logging.getLogger(__name__)

ALERT_COOLDOWN_SECONDS = 60

async def start_polling_loop():
    logger.info(
        f"Starting async polling loop every {settings.poll_interval_seconds}s "
        f"targeting {settings.backend_url} "
        f"(alert cooldown: {ALERT_COOLDOWN_SECONDS}s per node)"
    )

    last_processed_timestamps: dict[str, str] = {}
    last_alert_time: dict[str, float] = {}
    last_forecast_alert_time: dict[str, float] = {}
    
    # Store previous readings to calculate temporal rates of change
    last_readings: dict[str, dict] = {}

    async with httpx.AsyncClient(base_url=settings.backend_url, timeout=10.0) as client:
        while True:
            try:
                await asyncio.sleep(settings.poll_interval_seconds)

                nodes_resp = await client.get("/api/nodes")
                if nodes_resp.status_code != 200:
                    logger.error(f"Failed to fetch nodes: {nodes_resp.status_code}")
                    continue

                nodes = nodes_resp.json()

                for node in nodes:
                    node_id = node.get("nodeId")
                    if not node_id:
                        continue
                        
                    if node.get("mlEnabled") is False:
                        continue

                    telemetry_resp = await client.get(f"/api/sensor-data/latest/{node_id}")
                    if telemetry_resp.status_code != 200:
                        continue

                    data_list = telemetry_resp.json()
                    if not data_list:
                        continue

                    latest_reading = data_list[0]
                    timestamp_str = latest_reading.get("timestamp")

                    if last_processed_timestamps.get(node_id) == timestamp_str:
                        continue
                    last_processed_timestamps[node_id] = timestamp_str

                    # 12-Dimensional Core Vector (5 Base + 5 Rates + 2 Diurnal)
                    current_fields = [
                        "temperature", "humidity", "co2", "tvoc", "pm2_5"
                    ]
                    
                    if not all(k in latest_reading and latest_reading[k] is not None for k in current_fields):
                        logger.debug(f"Missing core fields for node {node_id}")
                        continue
                        
                    # Calculate temporal rates of change (Delta X / min)
                    ts_str = timestamp_str.replace("Z", "+00:00")
                    ts_sec = datetime.fromisoformat(ts_str).timestamp()
                    
                    rates = [0.0] * 5
                    prev = last_readings.get(node_id)
                    if prev is not None:
                        dt = ts_sec - prev["timestamp"]
                        if dt > 0:
                            # Convert to per-minute rate
                            dt_min = dt / 60.0
                            rates[0] = (latest_reading["temperature"] - prev["temperature"]) / dt_min
                            rates[1] = (latest_reading["humidity"] - prev["humidity"]) / dt_min
                            rates[2] = (latest_reading["co2"] - prev["co2"]) / dt_min
                            rates[3] = (latest_reading["tvoc"] - prev["tvoc"]) / dt_min
                            rates[4] = (latest_reading["pm2_5"] - prev["pm2_5"]) / dt_min
                    
                    last_readings[node_id] = {
                        "timestamp": ts_sec,
                        "temperature": latest_reading["temperature"],
                        "humidity": latest_reading["humidity"],
                        "co2": latest_reading["co2"],
                        "tvoc": latest_reading["tvoc"],
                        "pm2_5": latest_reading["pm2_5"]
                    }
                    
                    # Diurnal Time Encoding (Sine / Cosine Hour)
                    dt_obj = datetime.fromisoformat(ts_str)
                    hour_decimal = dt_obj.hour + (dt_obj.minute / 60.0)
                    sin_hour = math.sin(2 * math.pi * hour_decimal / 24.0)
                    cos_hour = math.cos(2 * math.pi * hour_decimal / 24.0)

                    features = [
                        latest_reading["temperature"],
                        latest_reading["humidity"],
                        latest_reading["co2"],
                        latest_reading["tvoc"],
                        latest_reading["pm2_5"],
                        rates[0],
                        rates[1],
                        rates[2],
                        rates[3],
                        rates[4],
                        sin_hour,
                        cos_hour
                    ]

                    # Complete Frame Fault Rejection (Reject ONLY if all core are -999.0)
                    if all(v <= -900.0 for v in features[:5]):
                        logger.warning(f"Complete subsystem failure detected for node {node_id}; skipping ML inference.")
                        continue

                    window_size = node.get("baselineWindowSize", 20)
                    sensitivity = node.get("sensitivity", 5)

                    is_anomaly, anomaly_context, anomaly_action = detector_manager.process(
                        node_id, features, window_size=window_size, sensitivity=sensitivity
                    )

                    if is_anomaly:
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

                    try:
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
                            else:
                                if not is_anomaly:
                                    try:
                                        res_resp = await client.put("/api/alerts/resolve-all?category=ai")
                                        if res_resp.status_code == 200 and int(res_resp.text or 0) > 0:
                                            logger.info(f"Self-Healing: Autonomous AI resolved {res_resp.text} outdated AI alerts.")
                                    except Exception as e_res:
                                        logger.debug(f"Could not auto-resolve AI alerts: {e_res}")
                                
                    except Exception as e:
                        logger.error(f"Error computing forecast for {node_id}: {str(e)}")

            except asyncio.CancelledError:
                logger.info("Polling loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in polling loop: {str(e)}")
