#!/usr/bin/env python3
"""
SSNS Scalability Load Tester
Simulates hundreds of virtual OpenThread nodes transmitting CoAP packets
concurrently to stress-test the Edge Gateway, Backend API, and ML Service.

Usage:
    # First, ensure you are in the project root directory
    source platform/gateway/venv/bin/activate
    python platform/gateway/load_test.py --nodes 250 --duration 60
"""

import asyncio
import cbor2
import logging
import random
import argparse
import time
from aiocoap import *

# Suppress overly verbose aiocoap logs
logging.getLogger("coap-server").setLevel(logging.WARNING)

async def virtual_node_worker(node_id: int, duration_sec: int, context: Context, stats: dict):
    """Simulates a single virtual sensor node sending periodic CoAP packets."""
    node_name = f"virtual-node-{node_id:03d}"
    end_time = time.time() + duration_sec
    
    while time.time() < end_time:
        # Generate realistic, slightly randomized telemetry encoded as a CBOR array
        # Format: [node_id, boot_id, seq_num, uptimeMs, temp, humidity, co2, tvoc, eco2, pm1, pm25, pm4, pm10, light]
        cbor_data = [
            node_name,                   # node_id
            "boot-001",                  # boot_id
            stats.get('attempted', 0),   # seq_num
            int(time.time() * 1000),     # uptimeMs
            round(random.uniform(22.0, 26.0), 1), # temp
            round(random.uniform(40.0, 50.0), 1), # humidity
            round(random.uniform(400.0, 600.0), 1), # co2
            round(random.uniform(50.0, 150.0), 1), # tvoc
            round(random.uniform(400.0, 500.0), 1), # eco2
            round(random.uniform(2.0, 10.0), 1), # pm1
            round(random.uniform(5.0, 25.0), 1), # pm25
            round(random.uniform(8.0, 30.0), 1), # pm4
            round(random.uniform(10.0, 35.0), 1), # pm10
            round(random.uniform(200.0, 400.0), 1) # light
        ]
        
        payload_bytes = cbor2.dumps(cbor_data)
        request = Message(code=PUT, payload=payload_bytes, uri="coap://127.0.0.1:5683/storedata")
        
        try:
            stats['attempted'] += 1
            response = await context.request(request).response
            if response.code.is_successful():
                stats['success'] += 1
            else:
                stats['failed'] += 1
        except Exception:
            stats['failed'] += 1
            
        # Wait before sending the next packet (simulating realistic node intervals but faster for testing)
        # Random sleep between 2 to 5 seconds
        await asyncio.sleep(random.uniform(2.0, 5.0))

async def main():
    parser = argparse.ArgumentParser(description="SSNS CoAP Load Simulator")
    parser.add_argument("--nodes", type=int, default=100, help="Number of concurrent virtual nodes")
    parser.add_argument("--duration", type=int, default=60, help="Duration of the load test in seconds")
    args = parser.parse_args()

    print("=" * 60)
    print(f"🚀 SSNS Scalability Load Tester")
    print(f"Targeting   : coap://127.0.0.1:5683/storedata")
    print(f"Nodes       : {args.nodes} virtual nodes")
    print(f"Duration    : {args.duration} seconds")
    print("=" * 60)
    print("Initializing CoAP context... (this may take a few seconds)")

    context = await Context.create_client_context()
    
    stats = {'attempted': 0, 'success': 0, 'failed': 0}
    
    print(f"Starting {args.nodes} asynchronous worker tasks...")
    start_time = time.time()
    
    # Spawn a worker for each virtual node
    tasks = []
    for i in range(args.nodes):
        tasks.append(asyncio.create_task(virtual_node_worker(i + 1, args.duration, context, stats)))
        
    # Wait for all tasks to complete
    await asyncio.gather(*tasks)
    
    elapsed = time.time() - start_time
    
    print("\n" + "=" * 60)
    print("✅ Load Test Complete!")
    print(f"Total Time  : {elapsed:.2f} seconds")
    print(f"Attempted   : {stats['attempted']} packets")
    print(f"Successful  : {stats['success']} packets (ACK received)")
    print(f"Failed      : {stats['failed']} packets")
    print(f"Throughput  : {stats['success'] / elapsed:.2f} packets / second")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
