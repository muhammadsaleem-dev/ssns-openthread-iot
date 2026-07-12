#!/usr/bin/env python3
"""
=============================================================================
Export Saleem's Room Telemetry Data (node-e9b1) from VPS / Local API to CSV
=============================================================================
Usage:
    python3 scripts/export_room_csv.py --host <vps-ip-or-domain>

Examples:
    python3 scripts/export_room_csv.py --host 192.168.1.100
    python3 scripts/export_room_csv.py --host localhost --node node-e9b1 --hours 300
"""

import argparse
import csv
import sys
import requests

DEFAULT_NODE_ID = "node-e9b1"  # Saleem's Room (from Dashboard screenshot)
DEFAULT_HOURS = 300            # Looks back ~12.5 days to capture June 29 - July 02 telemetry

CSV_FIELDS = [
    "timestamp", "nodeId", "sequenceNumber", "temperature", "humidity",
    "co2", "tvoc", "eco2", "pm1_0", "pm2_5", "pm4_0", "pm10",
    "lightIntensity", "healthStatus",
    "temperatureMean", "temperatureStd", "temperatureMax",
    "humidityMean", "humidityStd", "humidityMax",
    "co2Mean", "co2Std", "co2Max",
    "tvocMean", "tvocStd", "tvocMax",
    "eco2Mean", "eco2Std", "eco2Max",
    "pm1_0Mean", "pm1_0Std", "pm1_0Max",
    "pm2_5Mean", "pm2_5Std", "pm2_5Max",
    "pm4_0Mean", "pm4_0Std", "pm4_0Max",
    "pm10Mean", "pm10Std", "pm10Max"
]

def export_data(host: str, port: int, node_id: str, hours: int, output_file: str):
    url = f"http://{host}:{port}/api/sensor-data"
    params = {
        "nodeId": node_id,
        "hours": hours
    }
    
    print(f"📡 Connecting to {url} (nodeId={node_id}, looking back {hours} hours)...")
    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        records = response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Error connecting to API: {e}", file=sys.stderr)
        print("\n💡 Tip: If API is blocked by firewall, run this via SSH tunnel on your laptop:")
        print(f"   ssh -L 8080:localhost:8080 user@{host}")
        print(f"   python3 scripts/export_room_csv.py --host localhost")
        sys.exit(1)

    if not records:
        print(f"⚠️ No records returned for {node_id} within the last {hours} hours.")
        print(f"   If your sensor was active earlier than {hours} hours ago, try --hours 600")
        sys.exit(0)

    print(f"✅ Downloaded {len(records)} telemetry records. Writing to {output_file}...")
    
    with open(output_file, mode="w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        for row in records:
            # Flatten or clean any fields if needed before writing
            writer.writerow(row)

    print(f"🎉 Successfully saved: {output_file} ({len(records)} rows)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export OpenThread monitoring sensor data to CSV")
    parser.add_argument("--host", default="localhost", help="VPS IP address or domain (default: localhost)")
    parser.add_argument("--port", type=int, default=8080, help="Backend API port (default: 8080)")
    parser.add_argument("--node", default=DEFAULT_NODE_ID, help=f"Sensor Node ID (default: {DEFAULT_NODE_ID} - Saleem's Room)")
    parser.add_argument("--hours", type=int, default=DEFAULT_HOURS, help=f"Hours of history to fetch (default: {DEFAULT_HOURS})")
    parser.add_argument("--out", default=f"saleems_room_{DEFAULT_NODE_ID}.csv", help="Output CSV filename")
    
    args = parser.parse_args()
    export_data(args.host, args.port, args.node, args.hours, args.out)
