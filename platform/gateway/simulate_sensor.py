#!/usr/bin/env python3
"""
Simulated Sensor Node (CoAP Client)
Fires a CoAP PUT request directly at the Gateway's IPv4/IPv6 address
to simulate a physical nRF52840 Thread sensor.
"""

import asyncio
import json
import logging
from aiocoap import *

logging.basicConfig(level=logging.INFO)

async def main():
    context = await Context.create_client_context()

    # The mock telemetry payload
    payload = {
        "nodeId": "thread-node-01",
        "temperature": 24.5,
        "humidity": 45.2,
        "co2": 850.0,
        "tvoc": 120.0,
        "eco2": 450.0,
        "pm1_0": 5.0,
        "pm2_5": 12.5,
        "pm4_0": 15.0,
        "pm10": 18.0,
        "lightIntensity": 320.0
    }
    
    payload_bytes = json.dumps(payload).encode("utf-8")
    
    # We send to the gateway container on localhost:5683 since the port is exposed
    # Using IPv4 localhost because Docker Desktop forwards it
    request = Message(code=PUT, payload=payload_bytes, uri="coap://127.0.0.1:5683/storedata")

    print(f"Sending CoAP PUT to {request.get_request_uri()} ...")
    try:
        response = await context.request(request).response
        print('Result: %s\n%r' % (response.code, response.payload))
    except Exception as e:
        print('Failed to fetch resource:')
        print(e)

if __name__ == "__main__":
    asyncio.run(main())
