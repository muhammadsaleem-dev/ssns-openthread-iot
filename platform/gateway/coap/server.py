"""
Async CoAP server resource handler.

Receives CoAP PUT requests containing JSON telemetry from Thread sensor nodes,
deserializes them, and forwards them to the Spring Boot backend.
"""

import asyncio
import json
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
            payload_str = request.payload.decode("utf-8")
            payload = json.loads(payload_str)
            
            node_id = payload.get("nodeId") or payload.get("id")
            boot_id = payload.get("bootId")
            seq_num = payload.get("sequenceNumber")
            
            if not node_id or not boot_id or seq_num is None:
                logger.error("Malformed payload: Missing required identity fields (nodeId, bootId, or sequenceNumber)")
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
            
        except json.JSONDecodeError:
            logger.error("Invalid JSON payload received via CoAP")
            return aiocoap.Message(code=aiocoap.BAD_REQUEST)
        except Exception as e:
            logger.error("CoAP processing error: %s", e)
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
