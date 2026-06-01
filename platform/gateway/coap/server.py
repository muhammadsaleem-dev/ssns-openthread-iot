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
from cachetools import TTLCache

from telemetry.model import TelemetryReading
from forwarding.queue_manager import SQLiteQueueManager
from logging_ import setup_logger

logger = setup_logger(__name__)

class StoreDataResource(resource.Resource):
    """CoAP resource that receives sensor telemetry PUT requests."""
    
    def __init__(self, queue_manager: SQLiteQueueManager):
        super().__init__()
        self._queue_manager = queue_manager
        # Deduplication cache: holds 10000 recent keys, expires after 5 minutes
        self._cache = TTLCache(maxsize=10000, ttl=300)
    
    async def render_put(self, request):
        try:
            # Decode CBOR Array from binary payload
            cbor_data = cbor2.loads(request.payload)
            if not isinstance(cbor_data, list) or len(cbor_data) < 14:
                logger.error("Malformed CBOR array received")
                return aiocoap.Message(code=aiocoap.BAD_REQUEST)
            
            node_id = cbor_data[0]
            boot_id = cbor_data[1]
            seq_num = cbor_data[2]
            
            # Reconstruct the original JSON dictionary for the downstream pipeline
            payload = {
                "id": node_id,
                "t": cbor_data[4],
                "h": cbor_data[5],
                "c": cbor_data[6],
                "tv": cbor_data[7],
                "ec": cbor_data[8],
                "p1": cbor_data[9],
                "p25": cbor_data[10],
                "p4": cbor_data[11],
                "p10": cbor_data[12],
                "li": cbor_data[13],
                "nodeId": node_id,
                "bootId": boot_id,
                "sequenceNumber": seq_num,
                "uptimeMs": cbor_data[3]
            }
            payload_str = json.dumps(payload)
            
            if not node_id or not boot_id or seq_num is None:
                logger.error("Malformed payload: Missing required identity fields")
                return aiocoap.Message(code=aiocoap.BAD_REQUEST)
            
            # Deduplication Check
            dedup_key = f"{node_id}:{boot_id}:{seq_num}"
            if dedup_key in self._cache:
                logger.info("Duplicate packet dropped: %s", dedup_key)
                return aiocoap.Message(code=aiocoap.CHANGED)
            
            # Not a duplicate, add to cache and queue it for asynchronous processing
            self._cache[dedup_key] = True
            
            # Enqueue the raw payload string (queue_manager will append gateway_timestamp)
            self._queue_manager.enqueue(node_id, seq_num, payload_str)
            
            logger.info("CoAP PUT queued: %s", dedup_key)
            return aiocoap.Message(code=aiocoap.CHANGED)
            
        except (cbor2.CBORDecodeError, Exception) as e:
            logger.error("CBOR processing error: %s", e)
            return aiocoap.Message(code=aiocoap.BAD_REQUEST)


async def start_coap_server(queue_manager: SQLiteQueueManager, port: int = 5683):
    """Start the aiocoap server context."""
    root = resource.Site()
    root.add_resource(["storedata"], StoreDataResource(queue_manager))
    bind = ("0.0.0.0", port)
    await aiocoap.Context.create_server_context(root, bind=bind)
    logger.info("CoAP server listening on 0.0.0.0:%d/storedata", port)
    
    # Run forever
    await asyncio.get_event_loop().create_future()
