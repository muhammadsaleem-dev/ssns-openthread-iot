"""
Async CoAP server resource handler.

Receives CoAP PUT requests containing JSON telemetry from Thread sensor nodes,
deserializes them, and forwards them to the Spring Boot backend.
"""

import asyncio
import json
import cbor2
import aiocoap
import aiocoap.resource as resource

from telemetry.model import TelemetryReading
from forwarding.queue_manager import RedisQueueManager
from logging_ import setup_logger

logger = setup_logger(__name__)

class StoreDataResource(resource.Resource):
    """CoAP resource that receives sensor telemetry PUT requests."""
    
    def __init__(self, queue_manager: RedisQueueManager):
        super().__init__()
        self._queue_manager = queue_manager
    
    async def render_put(self, request):
        try:
            # Decode CBOR from binary payload
            cbor_data = cbor2.loads(request.payload)
            
            # Phase 2: Detect batch format vs single sample format
            # Batch format: [samples_array, statistics_map] (2 elements)
            # Single format: [43 fields] (43 elements)
            
            if isinstance(cbor_data, list) and len(cbor_data) == 2:
                # Phase 2: Batch format
                return await self._handle_batch(request, cbor_data)
            elif isinstance(cbor_data, list) and len(cbor_data) >= 43:
                # Phase 1: Single sample format (backward compatible)
                return await self._handle_single_sample(request, cbor_data)
            else:
                logger.error("Malformed CBOR received (unexpected structure)")
                return aiocoap.Message(code=aiocoap.BAD_REQUEST)
                
        except (cbor2.CBORDecodeError, Exception) as e:
            logger.error("CBOR processing error: %s", e)
            return aiocoap.Message(code=aiocoap.BAD_REQUEST)
    
    async def _handle_single_sample(self, request, cbor_data):
        """Handle Phase 1 single sample format (backward compatible)."""
        try:
            if len(cbor_data) < 43:
                logger.error("Malformed CBOR array received (expected 43 items, got %d)", len(cbor_data))
                return aiocoap.Message(code=aiocoap.BAD_REQUEST)

            # Metadata (indices 0-3)
            node_id = cbor_data[0]
            boot_id = cbor_data[1]
            seq_num = cbor_data[2]
            uptime_ms = cbor_data[3]

            # Current values (indices 4-13)
            temperature = cbor_data[4]
            humidity = cbor_data[5]
            co2 = cbor_data[6]
            tvoc = cbor_data[7]
            eco2 = cbor_data[8]
            pm1_0 = cbor_data[9]
            pm2_5 = cbor_data[10]
            pm4_0 = cbor_data[11]
            pm10 = cbor_data[12]
            light = cbor_data[13]
            
            # Health mask and mesh ID (indices 14-15)
            health_status = cbor_data[14]
            mesh_id = cbor_data[15]
            
            # Statistics (indices 16-42)
            # Temperature stats (16-18)
            temp_mean = cbor_data[16]
            temp_std = cbor_data[17]
            temp_max = cbor_data[18]
            
            # Humidity stats (19-21)
            hum_mean = cbor_data[19]
            hum_std = cbor_data[20]
            hum_max = cbor_data[21]
            
            # CO2 stats (22-24)
            co2_mean = cbor_data[22]
            co2_std = cbor_data[23]
            co2_max = cbor_data[24]
            
            # TVOC stats (25-27)
            tvoc_mean = cbor_data[25]
            tvoc_std = cbor_data[26]
            tvoc_max = cbor_data[27]
            
            # eCO2 stats (28-30)
            eco2_mean = cbor_data[28]
            eco2_std = cbor_data[29]
            eco2_max = cbor_data[30]
            
            # PM1.0 stats (31-33)
            pm1_0_mean = cbor_data[31]
            pm1_0_std = cbor_data[32]
            pm1_0_max = cbor_data[33]
            
            # PM2.5 stats (34-36)
            pm2_5_mean = cbor_data[34]
            pm2_5_std = cbor_data[35]
            pm2_5_max = cbor_data[36]
            
            # PM4.0 stats (37-39)
            pm4_0_mean = cbor_data[37]
            pm4_0_std = cbor_data[38]
            pm4_0_max = cbor_data[39]
            
            # PM10 stats (40-42)
            pm10_mean = cbor_data[40]
            pm10_std = cbor_data[41]
            pm10_max = cbor_data[42]
            
            # Extract true IPv6 address if available (Native Linux Fog Node)
            # If using socat bridge (Mac Fog Node), this will just show 127.0.0.1
            ipv6_addr = None
            if hasattr(request.remote, 'sockaddr') and request.remote.sockaddr:
                addr = request.remote.sockaddr[0]
                if addr != '127.0.0.1' and addr != '::1':
                    ipv6_addr = addr

            # Reconstruct the JSON dictionary with all statistics for the downstream pipeline
            payload = {
                # Metadata
                "id": node_id,
                "nodeId": node_id,
                "bootId": boot_id,
                "sequenceNumber": seq_num,
                "uptimeMs": uptime_ms,
                "meshId": mesh_id,
                "ipv6Address": ipv6_addr,
                "healthStatus": health_status,
                
                # Current values
                "t": temperature,
                "h": humidity,
                "c": co2,
                "tv": tvoc,
                "ec": eco2,
                "p1": pm1_0,
                "p25": pm2_5,
                "p4": pm4_0,
                "p10": pm10,
                "li": light,
                
                # Temperature statistics
                "temperatureMean": temp_mean,
                "temperatureStd": temp_std,
                "temperatureMax": temp_max,
                
                # Humidity statistics
                "humidityMean": hum_mean,
                "humidityStd": hum_std,
                "humidityMax": hum_max,
                
                # CO2 statistics
                "co2Mean": co2_mean,
                "co2Std": co2_std,
                "co2Max": co2_max,
                
                # TVOC statistics
                "tvocMean": tvoc_mean,
                "tvocStd": tvoc_std,
                "tvocMax": tvoc_max,
                
                # eCO2 statistics
                "eco2Mean": eco2_mean,
                "eco2Std": eco2_std,
                "eco2Max": eco2_max,
                
                # PM1.0 statistics
                "pm1_0Mean": pm1_0_mean,
                "pm1_0Std": pm1_0_std,
                "pm1_0Max": pm1_0_max,
                
                # PM2.5 statistics
                "pm2_5Mean": pm2_5_mean,
                "pm2_5Std": pm2_5_std,
                "pm2_5Max": pm2_5_max,
                
                # PM4.0 statistics
                "pm4_0Mean": pm4_0_mean,
                "pm4_0Std": pm4_0_std,
                "pm4_0Max": pm4_0_max,
                
                # PM10 statistics
                "pm10Mean": pm10_mean,
                "pm10Std": pm10_std,
                "pm10Max": pm10_max,
            }

            payload_str = json.dumps(payload)
            
            if not node_id or not boot_id or seq_num is None:
                logger.error("Malformed payload: Missing required identity fields")
                return aiocoap.Message(code=aiocoap.BAD_REQUEST)
            
            # Distributed Deduplication Check via Redis SETNX
            dedup_key = f"dedup:{node_id}:{boot_id}:{seq_num}"
            
            # SETNX returns 1 if key was set (meaning it's new), 0 if key already exists
            is_new = self._queue_manager.r.setnx(dedup_key, "1")
            
            if not is_new:
                logger.info("Duplicate packet dropped: %s", dedup_key)
                return aiocoap.Message(code=aiocoap.CHANGED)
            
            # Key is new, set TTL to 5 minutes (300 seconds)
            self._queue_manager.r.expire(dedup_key, 300)
            
            # Enqueue the raw payload string (queue_manager will append gateway_timestamp)
            self._queue_manager.enqueue(node_id, seq_num, payload_str)
            
            logger.info("CoAP PUT queued: %s", dedup_key)
            return aiocoap.Message(code=aiocoap.CHANGED)
            
        except (cbor2.CBORDecodeError, Exception) as e:
            logger.error("CBOR processing error: %s", e)
            return aiocoap.Message(code=aiocoap.BAD_REQUEST)
    
    async def _handle_batch(self, request, cbor_data):
        """Handle Phase 2 batch format: [[sample1, sample2, ...], {statistics}]."""
        try:
            samples_array = cbor_data[0]
            statistics_map = cbor_data[1]
            
            if not isinstance(samples_array, list) or not isinstance(statistics_map, dict):
                logger.error("Invalid batch structure")
                return aiocoap.Message(code=aiocoap.BAD_REQUEST)
            
            logger.info("Received batch with %d samples", len(samples_array))
            
            # Extract IPv6 address
            ipv6_addr = None
            if hasattr(request.remote, 'sockaddr') and request.remote.sockaddr:
                addr = request.remote.sockaddr[0]
                if addr != '127.0.0.1' and addr != '::1':
                    ipv6_addr = addr
            
            # Phase 2 Fix: Find maximum uptime in batch first to prevent time reconstruction issues
            max_uptime_in_batch = 0
            for sample in samples_array:
                if isinstance(sample, list) and len(sample) >= 4:
                    uptime_ms = sample[3]
                    if uptime_ms > max_uptime_in_batch:
                        max_uptime_in_batch = uptime_ms
            
            # Pre-update the max known uptime for this node to prevent backlog detection
            if max_uptime_in_batch > 0 and len(samples_array) > 0:
                first_sample = samples_array[0]
                if isinstance(first_sample, list) and len(first_sample) >= 2:
                    node_id_temp = first_sample[0]
                    latest_uptime_key = f"uptime:{node_id_temp}"
                    self._queue_manager.r.set(latest_uptime_key, max_uptime_in_batch)
                    logger.debug("Pre-set max uptime for %s: %dms", node_id_temp, max_uptime_in_batch)
            
            # Process each sample in the batch
            for idx, sample in enumerate(samples_array):
                if not isinstance(sample, list) or len(sample) < 16:
                    logger.warning("Skipping malformed sample %d in batch", idx)
                    continue
                
                # Parse sample (16 fields: metadata(4) + current(10) + health(1) + mesh_id(1))
                node_id = sample[0]
                boot_id = sample[1]
                seq_num = sample[2]
                uptime_ms = sample[3]
                
                temperature = sample[4]
                humidity = sample[5]
                co2 = sample[6]
                tvoc = sample[7]
                eco2 = sample[8]
                pm1_0 = sample[9]
                pm2_5 = sample[10]
                pm4_0 = sample[11]
                pm10 = sample[12]
                light = sample[13]
                
                health_status = sample[14]
                mesh_id = sample[15]
                
                # Build payload with current values + shared statistics
                payload = {
                    # Metadata
                    "id": node_id,
                    "nodeId": node_id,
                    "bootId": boot_id,
                    "sequenceNumber": seq_num,
                    "uptimeMs": uptime_ms,
                    "meshId": mesh_id,
                    "ipv6Address": ipv6_addr,
                    "healthStatus": health_status,
                    
                    # Current values
                    "t": temperature,
                    "h": humidity,
                    "c": co2,
                    "tv": tvoc,
                    "ec": eco2,
                    "p1": pm1_0,
                    "p25": pm2_5,
                    "p4": pm4_0,
                    "p10": pm10,
                    "li": light,
                    
                    # Statistics from shared map
                    "temperatureMean": statistics_map.get("temp_mean", 0.0),
                    "temperatureStd": statistics_map.get("temp_std", 0.0),
                    "temperatureMax": statistics_map.get("temp_max", 0.0),
                    
                    "humidityMean": statistics_map.get("hum_mean", 0.0),
                    "humidityStd": statistics_map.get("hum_std", 0.0),
                    "humidityMax": statistics_map.get("hum_max", 0.0),
                    
                    "co2Mean": statistics_map.get("co2_mean", 0.0),
                    "co2Std": statistics_map.get("co2_std", 0.0),
                    "co2Max": statistics_map.get("co2_max", 0.0),
                    
                    "tvocMean": statistics_map.get("tvoc_mean", 0.0),
                    "tvocStd": statistics_map.get("tvoc_std", 0.0),
                    "tvocMax": statistics_map.get("tvoc_max", 0.0),
                    
                    "eco2Mean": statistics_map.get("eco2_mean", 0.0),
                    "eco2Std": statistics_map.get("eco2_std", 0.0),
                    "eco2Max": statistics_map.get("eco2_max", 0.0),
                    
                    "pm1_0Mean": statistics_map.get("pm1_mean", 0.0),
                    "pm1_0Std": statistics_map.get("pm1_std", 0.0),
                    "pm1_0Max": statistics_map.get("pm1_max", 0.0),
                    
                    "pm2_5Mean": statistics_map.get("pm25_mean", 0.0),
                    "pm2_5Std": statistics_map.get("pm25_std", 0.0),
                    "pm2_5Max": statistics_map.get("pm25_max", 0.0),
                    
                    "pm4_0Mean": statistics_map.get("pm4_mean", 0.0),
                    "pm4_0Std": statistics_map.get("pm4_std", 0.0),
                    "pm4_0Max": statistics_map.get("pm4_max", 0.0),
                    
                    "pm10Mean": statistics_map.get("pm10_mean", 0.0),
                    "pm10Std": statistics_map.get("pm10_std", 0.0),
                    "pm10Max": statistics_map.get("pm10_max", 0.0),
                }
                
                payload_str = json.dumps(payload)
                
                # Deduplication check
                dedup_key = f"dedup:{node_id}:{boot_id}:{seq_num}"
                is_new = self._queue_manager.r.setnx(dedup_key, "1")
                
                if not is_new:
                    logger.debug("Duplicate sample in batch dropped: %s", dedup_key)
                    continue
                
                self._queue_manager.r.expire(dedup_key, 300)
                self._queue_manager.enqueue(node_id, seq_num, payload_str)
                logger.debug("Batch sample %d/%d queued: %s", idx + 1, len(samples_array), dedup_key)
            
            logger.info("Batch processed: %d samples queued", len(samples_array))
            return aiocoap.Message(code=aiocoap.CHANGED)
            
        except Exception as e:
            logger.error("Batch processing error: %s", e)
            return aiocoap.Message(code=aiocoap.BAD_REQUEST)


async def start_coap_server(queue_manager: RedisQueueManager, port: int = 5683):
    """Start the aiocoap server context."""
    root = resource.Site()
    root.add_resource(["storedata"], StoreDataResource(queue_manager))
    bind = ("0.0.0.0", port)
    await aiocoap.Context.create_server_context(root, bind=bind)
    logger.info("CoAP server listening on 0.0.0.0:%d/storedata", port)
    
    # Run forever
    await asyncio.get_event_loop().create_future()
