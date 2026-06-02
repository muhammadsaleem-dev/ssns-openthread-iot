"""
OpenThread Gateway Simulator — Main Entry Point

Orchestrates the gateway lifecycle:
1. Load configuration
2. Initialise the telemetry source (simulator or future OpenThread)
3. Initialise the HTTP forwarder
4. Run the telemetry acquisition → forwarding loop

Usage:
    python main.py
    With custom environment:
    BACKEND_URL=http://backend:8080/api/sensor-data python main.py
"""

import asyncio
import signal
import sys
import os
import time

from config import load_config
from forwarding import HttpForwarder
from logging_ import setup_logger
from simulator import SimulatedTelemetrySource
from utils import format_duration

# Will be set after config loads
logger = None


def main():
    """Main gateway entry point."""
    global logger

    # ---- 1. Load configuration ----
    config = load_config()
    logger = setup_logger("gateway", config.log_level)

    logger.info("=" * 60)
    logger.info("  Thread Serial Gateway Simulator — Starting")
    logger.info("=" * 60)
    logger.info("Backend URL     : %s", config.backend_url)
    logger.info("Gateway Mode    : %s", config.gateway_mode)
    if config.gateway_mode == "simulator":
        logger.info("Telemetry interval : %ds", config.telemetry_interval)
        logger.info("Simulated nodes : %s", ", ".join(config.node_ids))
    logger.info("Log level       : %s", config.log_level)
    logger.info("=" * 60)

    # ---- 2. Initialise HTTP forwarder ----
    forwarder = HttpForwarder(config.backend_url)

    # ---- 3. Graceful shutdown handler ----
    start_time = time.time()
    running = True

    def shutdown_handler(signum, frame):
        nonlocal running
        running = False
        uptime = format_duration(time.time() - start_time)
        stats = forwarder.stats
        logger.info("")
        logger.info("=" * 60)
        logger.info("  Gateway shutting down")
        logger.info("  Uptime: %s", uptime)
        logger.info("  Forwarded: %d OK / %d failed / %d total",
                     stats["success"], stats["failure"], stats["total"])
        logger.info("=" * 60)
        if config.gateway_mode == "coap":
            # Best effort to stop asyncio loops when handling signals
            try:
                loop = asyncio.get_running_loop()
                loop.stop()
            except RuntimeError:
                pass

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    # ---- 4. Start Gateway Mode ----
    if config.gateway_mode == "coap":
        logger.info("Gateway running in CoAP server mode — press Ctrl+C to stop")
        from coap.server import start_coap_server
        from forwarding.queue_manager import RedisQueueManager
        
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        queue_manager = RedisQueueManager(redis_url=redis_url)
        
        async def run_services():
            # Run both services in parallel
            await asyncio.gather(
                queue_manager.worker_loop(forwarder),
                start_coap_server(queue_manager)
            )
            
        try:
            asyncio.run(run_services())
        except KeyboardInterrupt:
            pass
    else:
        # Default to simulator mode
        source = SimulatedTelemetrySource(config.node_ids)
        logger.info("Using simulated telemetry source for Phase 1 Migration")
        logger.info("Gateway running in Simulator mode — press Ctrl+C to stop")
        cycle = 0

        while running:
            cycle += 1
            logger.debug("--- Cycle %d ---", cycle)

            try:
                # Acquire telemetry from source
                readings = source.read_telemetry()

                # Forward to backend
                forwarder.forward(readings)

            except Exception as e:
                logger.error("Unexpected error in cycle %d: %s", cycle, str(e))

            # Wait for next interval
            try:
                time.sleep(config.telemetry_interval)
            except (KeyboardInterrupt, SystemExit):
                running = False

    logger.info("Gateway stopped.")
    sys.exit(0)


if __name__ == "__main__":
    main()
