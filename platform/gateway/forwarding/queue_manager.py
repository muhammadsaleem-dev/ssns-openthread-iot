import json
import asyncio
import time
from datetime import datetime, timezone, timedelta
import redis

from telemetry.model import TelemetryReading
from forwarding.http_forwarder import HttpForwarder
from logging_ import setup_logger

logger = setup_logger(__name__)

class RedisQueueManager:
    """
    Distributed Redis queue for telemetry packets.
    Enables High Availability (HA) across multiple Gateway replicas.
    """

    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        self.redis_url = redis_url
        self.r = redis.from_url(self.redis_url, decode_responses=True)
        self.queue_key = "telemetry:queue"
        self.retry_key = "telemetry:retry"

        # Ping to verify connection
        try:
            self.r.ping()
            logger.info("Successfully connected to Redis at %s", self.redis_url)
        except redis.ConnectionError as e:
            logger.error("Failed to connect to Redis: %s", e)

    def enqueue(self, node_id: str, seq_num: int, payload_json: str):
        """
        Insert a new packet into the Redis List.
        If the packet is from the past (backlog), we reconstruct its original 
        timestamp based on the uptimeMs offset.
        """
        data = json.loads(payload_json)
        now = datetime.now(timezone.utc)
        
        # --- Task 3.2: Time Reconstruction ---
        # We calculate the absolute boot time of the node to anchor all timestamps.
        sync_key = f"time_sync:{node_id}"
        
        raw_uptime = data.get('uptimeMs')
        if raw_uptime is None:
            raw_uptime = 0
        current_uptime = int(raw_uptime)
        
        sync_data_str = self.r.get(sync_key)
        
        if sync_data_str:
            sync_data = json.loads(sync_data_str)
            known_boot_time = sync_data.get("boot_time", now.timestamp())
            max_uptime = sync_data.get("max_uptime", 0)
            
            # Reboot Detection: If uptime drops by more than 1 min, it's a fresh boot
            if max_uptime > 60000 and current_uptime < (max_uptime - 60000):
                logger.info("Sensor reboot detected for %s. Resetting time sync.", node_id)
                known_boot_time = now.timestamp() - (current_uptime / 1000.0)
                max_uptime = current_uptime
            else:
                if current_uptime > max_uptime:
                    max_uptime = current_uptime
                    
                # The "implied" boot time by this packet
                implied_boot_time = now.timestamp() - (current_uptime / 1000.0)
                
                # If the packet took 1 hr to arrive, implied_boot_time will be 1 hr in the future.
                # If implied_boot_time is SMALLER than known, this packet arrived faster (less network delay),
                # which means it's a more accurate estimate of the true boot time.
                if implied_boot_time < known_boot_time:
                    known_boot_time = implied_boot_time
                    
            self.r.set(sync_key, json.dumps({"boot_time": known_boot_time, "max_uptime": max_uptime}))
            
            # Apply absolute timestamp
            packet_timestamp = known_boot_time + (current_uptime / 1000.0)
            data['timestamp'] = datetime.fromtimestamp(packet_timestamp, tz=timezone.utc).isoformat()
            
            # Log for debugging if it's significantly older than 'now'
            delay_ms = (now.timestamp() - packet_timestamp) * 1000
            if delay_ms > 10000:
                logger.info("Reconstructed queued timestamp for %s: delayed by %dms", node_id, int(delay_ms))
        else:
            # First time seeing this node
            boot_time = now.timestamp() - (current_uptime / 1000.0)
            self.r.set(sync_key, json.dumps({"boot_time": boot_time, "max_uptime": current_uptime}))
            data['timestamp'] = now.isoformat()

        # We store the payload and retry_count together in a dictionary
        queue_item = {
            "payload": data,
            "retry_count": 0
        }
        
        # Push to the left of the list
        self.r.lpush(self.queue_key, json.dumps(queue_item))
        logger.debug("Enqueued packet for %s (seq=%d) to Redis", node_id, seq_num)

    async def worker_loop(self, forwarder: HttpForwarder):
        """
        Background worker that polls Redis and forwards
        packets to the Spring Boot backend with exponential backoff.
        """
        logger.info("Redis Queue worker started.")
        while True:
            try:
                # First, process any retries that are due
                await self._process_retries(forwarder)
                
                # Then process the main queue
                # Use non-blocking lpop so we don't freeze the asyncio event loop!
                item_json = self.r.lpop(self.queue_key)
                if item_json:
                    await self._forward_item(item_json, forwarder)
                else:
                    # If queue is empty, yield to the event loop
                    await asyncio.sleep(1.0)
            except Exception as e:
                logger.error("Queue worker error: %s", e)
                await asyncio.sleep(1.0)

    async def _process_retries(self, forwarder: HttpForwarder):
        """Check the sorted set for scheduled retries that are due."""
        now_ts = time.time()
        
        # Get all items with a score (timestamp) <= now
        due_items = self.r.zrangebyscore(self.retry_key, min="-inf", max=now_ts)
        
        if due_items:
            # Remove them from the sorted set before processing to prevent duplicate processing
            self.r.zremrangebyscore(self.retry_key, min="-inf", max=now_ts)
            
            for queue_item_json in due_items:
                # Process each item
                await self._forward_item(queue_item_json, forwarder)

    async def _forward_item(self, queue_item_json: str, forwarder: HttpForwarder):
        """Attempt to forward a single item."""
        try:
            queue_item = json.loads(queue_item_json)
            payload_data = queue_item["payload"]
            retry_count = queue_item["retry_count"]

            reading = TelemetryReading(
                node_id=payload_data.get("nodeId", payload_data.get("id")),
                boot_id=payload_data.get("bootId", "unknown"),
                sequence_number=payload_data.get("sequenceNumber", -1),
                temperature=payload_data.get("temperature", payload_data.get("t", 0.0)),
                humidity=payload_data.get("humidity", payload_data.get("h", 0.0)),
                co2=payload_data.get("co2", payload_data.get("c", 0.0)),
                tvoc=payload_data.get("tvoc", payload_data.get("tv", 0.0)),
                eco2=payload_data.get("eco2", payload_data.get("ec", 0.0)),
                pm1_0=payload_data.get("pm1_0", payload_data.get("p1", 0.0)),
                pm2_5=payload_data.get("pm2_5", payload_data.get("p25", 0.0)),
                pm4_0=payload_data.get("pm4_0", payload_data.get("p4", 0.0)),
                pm10=payload_data.get("pm10", payload_data.get("p10", 0.0)),
                light_intensity=payload_data.get("lightIntensity", payload_data.get("li", 0.0)),
                health_status=payload_data.get("healthStatus", 255),
                mesh_id=payload_data.get("meshId"),
                ipv6_address=payload_data.get("ipv6Address"),
                timestamp=payload_data.get("timestamp"),
                
                # Temperature stats
                temperature_mean=payload_data.get("temperatureMean", 0.0),
                temperature_std=payload_data.get("temperatureStd", 0.0),
                temperature_max=payload_data.get("temperatureMax", 0.0),
                
                # Humidity stats
                humidity_mean=payload_data.get("humidityMean", 0.0),
                humidity_std=payload_data.get("humidityStd", 0.0),
                humidity_max=payload_data.get("humidityMax", 0.0),
                
                # CO2 stats
                co2_mean=payload_data.get("co2Mean", 0.0),
                co2_std=payload_data.get("co2Std", 0.0),
                co2_max=payload_data.get("co2Max", 0.0),
                
                # TVOC stats
                tvoc_mean=payload_data.get("tvocMean", 0.0),
                tvoc_std=payload_data.get("tvocStd", 0.0),
                tvoc_max=payload_data.get("tvocMax", 0.0),
                
                # eCO2 stats
                eco2_mean=payload_data.get("eco2Mean", 0.0),
                eco2_std=payload_data.get("eco2Std", 0.0),
                eco2_max=payload_data.get("eco2Max", 0.0),
                
                # PM1.0 stats
                pm1_0_mean=payload_data.get("pm1_0Mean", 0.0),
                pm1_0_std=payload_data.get("pm1_0Std", 0.0),
                pm1_0_max=payload_data.get("pm1_0Max", 0.0),
                
                # PM2.5 stats
                pm2_5_mean=payload_data.get("pm2_5Mean", 0.0),
                pm2_5_std=payload_data.get("pm2_5Std", 0.0),
                pm2_5_max=payload_data.get("pm2_5Max", 0.0),
                
                # PM4.0 stats
                pm4_0_mean=payload_data.get("pm4_0Mean", 0.0),
                pm4_0_std=payload_data.get("pm4_0Std", 0.0),
                pm4_0_max=payload_data.get("pm4_0Max", 0.0),
                
                # PM10 stats
                pm10_mean=payload_data.get("pm10Mean", 0.0),
                pm10_std=payload_data.get("pm10Std", 0.0),
                pm10_max=payload_data.get("pm10Max", 0.0)
            )

            # HTTP Forwarding
            loop = asyncio.get_event_loop()
            success = await loop.run_in_executor(None, forwarder._send, reading)

            if success:
                logger.debug("Successfully forwarded item to backend")
            else:
                self._handle_failure(queue_item, retry_count)

        except Exception as e:
            logger.error("Error processing item: %s", e)
            # Re-wrap and handle failure if we managed to decode it
            try:
                if 'queue_item' in locals():
                    self._handle_failure(queue_item, queue_item.get("retry_count", 0))
            except Exception as inner_e:
                logger.error("Critical failure handling retry: %s", inner_e)

    def _handle_failure(self, queue_item: dict, current_retry: int):
        """
        Increment retry count and schedule next attempt using exponential backoff in a ZSET.
        Delay is capped at 3600 seconds (1 hour).
        """
        delay_seconds = min(3600, 2 ** current_retry)
        next_retry_time = time.time() + delay_seconds
        
        queue_item["retry_count"] = current_retry + 1
        
        # Add to sorted set with the score being the timestamp of the next retry
        self.r.zadd(self.retry_key, {json.dumps(queue_item): next_retry_time})
        logger.warning("Scheduled item for retry %d at %s", current_retry + 1, datetime.fromtimestamp(next_retry_time, tz=timezone.utc))
