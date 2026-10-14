#!/usr/bin/env python3
"""
SSNS Smart Monitoring Platform — Telemetry Replayer Service

Replays authentic physical hardware sensor telemetry from the immutable master collection
(`sensor_data_master_original`) to keep the live platform active, responsive, and online.

Guarantees:
1. `sensor_data_master_original` is strictly READ-ONLY and is NEVER modified or deleted.
2. Round-robin streaming multiplexes authentic records across all 6 physical nodes, ensuring
   all nodes stay continuously ONLINE (reporting every ~15 seconds).
3. Replayed readings update node status to ONLINE, trigger alerts, feed ML anomaly models,
   and stream over WebSockets to https://ssns-iot.com.
4. Periodic network topology frames maintain active mesh routing and populate historical snapshots.
5. An automated rolling retention cap ensures the live `sensor_data` collection remains
   under a controlled size (~20 MB) without unbounded disk growth.
"""

import os
import sys
import time
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import requests
from pymongo import MongoClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("telemetry-replayer")

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://mongodb:27017/ssns_monitoring")
API_URL = os.getenv("API_URL", "http://dashboard:80").rstrip("/")
STEP_INTERVAL_SECONDS = float(os.getenv("STEP_INTERVAL_SECONDS", "2.5"))
TOPOLOGY_INTERVAL_SECONDS = float(os.getenv("TOPOLOGY_INTERVAL_SECONDS", "30.0"))
MAX_LIVE_RECORDS = int(os.getenv("MAX_LIVE_RECORDS", "50000"))

PHYSICAL_NODES: List[str] = [
    "node-e9b1",
    "node-0587",
    "node-40a7",
    "node-598c",
    "node-f2a1",
    "node-8f2f"
]

NODE_METADATA_MAP: Dict[str, Dict[str, str]] = {
    "node-e9b1": {
        "meshId": "node-953f",
        "ipv6Address": "fdde:ad00:beef:0:e9b1",
        "extAddr": "5ecc3002e71e953f",
        "location": "Lecture Hall 2"
    },
    "node-0587": {
        "meshId": "node-4422",
        "ipv6Address": "::ffff:127.0.0.1",
        "extAddr": "0688bb2aef5e4422",
        "location": "Lecture Hall"
    },
    "node-40a7": {
        "meshId": "node-427a",
        "ipv6Address": "::ffff:127.0.0.1",
        "extAddr": "7e80ce8de6fd427a",
        "location": "node-2"
    },
    "node-598c": {
        "meshId": "node-291d",
        "ipv6Address": "::ffff:127.0.0.1",
        "extAddr": "e69bcd8b4030291d",
        "location": "Sensor Node 5"
    },
    "node-f2a1": {
        "meshId": "node-22b2",
        "ipv6Address": "::ffff:172.19.0.3",
        "extAddr": "1e99203f70aeb34a",
        "location": "node-1"
    },
    "node-8f2f": {
        "meshId": "node-f269",
        "ipv6Address": "::ffff:172.19.0.3",
        "extAddr": "36e48bb95369f269",
        "location": "node-3"
    }
}


class NodeRecordStream:
    """Manages a circular, streaming cursor over a specific node's authentic records."""

    def __init__(self, collection, node_id: str, base_query: Dict[str, Any]):
        self.col = collection
        self.node_id = node_id
        self.query = {**base_query, "nodeId": node_id}
        self.cursor = None
        self.total = self.col.count_documents(self.query)
        self.replayed_in_cycle = 0
        self._init_cursor()

    def _init_cursor(self):
        self.cursor = self.col.find(self.query).sort("timestamp", 1).batch_size(200)
        self.replayed_in_cycle = 0

    def next_record(self) -> Optional[Dict[str, Any]]:
        if self.total == 0:
            return None
        try:
            record = next(self.cursor)
            self.replayed_in_cycle += 1
            return record
        except (StopIteration, Exception):
            # End of records for this node reached; loop cleanly back to the beginning
            self._init_cursor()
            try:
                record = next(self.cursor)
                self.replayed_in_cycle += 1
                return record
            except Exception:
                return None


def wait_for_services(client: MongoClient, db_name: str, target_api_url: str):
    """Wait for MongoDB and the Backend API to become available before starting replay."""
    logger.info("Verifying MongoDB connectivity...")
    while True:
        try:
            client.admin.command("ping")
            db = client[db_name]
            collections = db.list_collection_names()
            if "sensor_data_master_original" in collections:
                master_count = db["sensor_data_master_original"].count_documents({})
                logger.info("Connected to MongoDB. Master authentic records available: %d", master_count)
                break
            elif "sensor_data" in collections:
                count = db["sensor_data"].count_documents({})
                logger.info("Creating sensor_data_master_original backup from %d records...", count)
                db["sensor_data"].aggregate([{"$out": "sensor_data_master_original"}])
                logger.info("Immutable master collection created.")
                break
            else:
                logger.warning("Waiting for collections in MongoDB...")
        except Exception as exc:
            logger.warning("MongoDB ping failed (%s). Retrying in 3s...", exc)
        time.sleep(3)

    logger.info("Verifying Backend API connectivity at %s...", target_api_url)
    health_endpoint = f"{target_api_url}/api/nodes"
    while True:
        try:
            resp = requests.get(health_endpoint, timeout=5)
            if resp.status_code == 200:
                logger.info("Backend API is responsive (HTTP 200).")
                break
            logger.warning("API returned HTTP %d. Retrying...", resp.status_code)
        except Exception as exc:
            logger.warning("Waiting for API at %s (%s)...", health_endpoint, exc)
        time.sleep(3)


def send_topology_heartbeat(api_url: str):
    """Publish an active network topology state to populate graphs and historical scrubber snapshots."""
    topology_payload = {
        "hardwareId": "nrf52-E60C3F7BD826",
        "gatewayId": "9adc29d70eac6263",
        "gatewayHealth": {
            "panId": "0x1235",
            "extPanId": "1111111122222222",
            "channel": 26,
            "networkName": "WSN01",
            "status": "active",
            "uptime": "active"
        },
        "nodes": [
            {
                "extAddr": "9adc29d70eac6263",
                "rloc16": "0xac00",
                "role": "leader",
                "parentRloc16": "0xffff",
                "linkQualityIn": 100,
                "linkQualityOut": 100,
                "age": 0,
                "timeout": 0
            },
            {
                "extAddr": "5ecc3002e71e953f",
                "rloc16": "0xa400",
                "role": "router",
                "parentRloc16": "0xac00",
                "linkQualityIn": 99,
                "linkQualityOut": 99,
                "routeCost": 1,
                "age": 2,
                "timeout": 0,
                "linkType": "Direct"
            },
            {
                "extAddr": "0688bb2aef5e4422",
                "rloc16": "0xf000",
                "role": "router",
                "parentRloc16": "0xac00",
                "linkQualityIn": 99,
                "linkQualityOut": 97,
                "routeCost": 1,
                "age": 4,
                "timeout": 0,
                "linkType": "Direct"
            },
            {
                "extAddr": "7e80ce8de6fd427a",
                "rloc16": "0xcc00",
                "role": "router",
                "parentRloc16": "0xac00",
                "linkQualityIn": 98,
                "linkQualityOut": 99,
                "routeCost": 1,
                "age": 4,
                "timeout": 0,
                "linkType": "Direct"
            },
            {
                "extAddr": "e69bcd8b4030291d",
                "rloc16": "0x7400",
                "role": "router",
                "parentRloc16": "0xac00",
                "linkQualityIn": 97,
                "linkQualityOut": 98,
                "routeCost": 1,
                "age": 5,
                "timeout": 0,
                "linkType": "Direct"
            },
            {
                "extAddr": "1e99203f70aeb34a",
                "rloc16": "0x0000",
                "role": "router",
                "parentRloc16": "0xac00",
                "linkQualityIn": 98,
                "linkQualityOut": 96,
                "routeCost": 1,
                "age": 6,
                "timeout": 0,
                "linkType": "Direct"
            },
            {
                "extAddr": "36e48bb95369f269",
                "rloc16": "0x3400",
                "role": "router",
                "parentRloc16": "0xac00",
                "linkQualityIn": 96,
                "linkQualityOut": 97,
                "routeCost": 1,
                "age": 7,
                "timeout": 0,
                "linkType": "Direct"
            }
        ]
    }
    try:
        resp = requests.post(f"{api_url}/api/network/topology", json=topology_payload, timeout=5)
        if resp.status_code in (200, 201):
            logger.debug("Topology heartbeat posted successfully.")
        else:
            logger.warning("Topology POST returned HTTP %d: %s", resp.status_code, resp.text)
    except Exception as exc:
        logger.warning("Failed to post topology heartbeat: %s", exc)


def prune_live_records_if_needed(db):
    """
    Ensures the live `sensor_data` collection does not grow indefinitely.
    Maintains a rolling window of recent records while NEVER altering
    `sensor_data_master_original`.
    """
    try:
        live_col = db["sensor_data"]
        count = live_col.count_documents({})
        if count > MAX_LIVE_RECORDS:
            excess = count - MAX_LIVE_RECORDS
            logger.info("Live sensor_data count (%d) exceeds limit (%d). Pruning oldest %d records...",
                        count, MAX_LIVE_RECORDS, excess)
            oldest_cursor = live_col.find({}, {"_id": 1}).sort("timestamp", 1).limit(excess)
            ids_to_delete = [doc["_id"] for doc in oldest_cursor]
            if ids_to_delete:
                live_col.delete_many({"_id": {"$in": ids_to_delete}})
                logger.info("Pruned %d oldest live records. Master authentic data remains untouched.", len(ids_to_delete))
    except Exception as exc:
        logger.warning("Retention pruning check encountered an error: %s", exc)


def run_replayer():
    logger.info("Initializing SSNS Telemetry Replayer...")
    client = MongoClient(MONGODB_URI)
    db_name = MONGODB_URI.split("/")[-1].split("?")[0] or "ssns_monitoring"
    db = client[db_name]

    wait_for_services(client, db_name, API_URL)

    # Initial topology broadcast
    send_topology_heartbeat(API_URL)

    # Setup per-node streaming readers from immutable master collection
    master_col = db["sensor_data_master_original"]
    base_query = {"temperature": {"$gt": -900}, "co2": {"$gt": -900}}

    node_streams: Dict[str, NodeRecordStream] = {}
    for node_id in PHYSICAL_NODES:
        stream = NodeRecordStream(master_col, node_id, base_query)
        logger.info("Node %s: %d authentic records ready for playback.", node_id, stream.total)
        node_streams[node_id] = stream

    seq_counters: Dict[str, int] = {k: 100000 for k in PHYSICAL_NODES}

    last_topology_time = time.time()
    last_prune_time = time.time()
    total_replayed = 0

    while True:
        # Round-robin through each physical node
        for node_id in PHYSICAL_NODES:
            stream = node_streams.get(node_id)
            if not stream:
                continue

            record = stream.next_record()
            if not record:
                continue

            seq_counters[node_id] += 1
            seq = seq_counters[node_id]

            meta = NODE_METADATA_MAP.get(node_id, {})
            mesh_id = record.get("meshId") or meta.get("meshId") or f"node-{node_id[-4:]}"
            ipv6_addr = record.get("ipv6Address") or meta.get("ipv6Address") or "fdde:ad00:beef:0:1"
            now_iso = datetime.now(timezone.utc).isoformat()

            payload: Dict[str, Any] = {
                "nodeId": node_id,
                "meshId": mesh_id,
                "ipv6Address": ipv6_addr,
                "bootId": "live-replay",
                "sequenceNumber": seq,
                "temperature": float(record.get("temperature", 22.0)),
                "humidity": float(record.get("humidity", 45.0)),
                "co2": float(record.get("co2", 500.0)),
                "tvoc": float(record.get("tvoc", 0.0)),
                "eco2": float(record.get("eco2", 400.0)),
                "pm1_0": float(record.get("pm1_0", 1.0)),
                "pm2_5": float(record.get("pm2_5", 2.0)),
                "pm4_0": float(record.get("pm4_0", 2.5)),
                "pm10": float(record.get("pm10", 3.0)),
                "lightIntensity": float(record.get("lightIntensity", 350.0)),
                "healthStatus": int(record.get("healthStatus", 15)),
                "timestamp": now_iso,
                # 30-sample statistical fields
                "temperatureMean": record.get("temperatureMean"),
                "temperatureStd": record.get("temperatureStd"),
                "temperatureMax": record.get("temperatureMax"),
                "humidityMean": record.get("humidityMean"),
                "humidityStd": record.get("humidityStd"),
                "humidityMax": record.get("humidityMax"),
                "co2Mean": record.get("co2Mean"),
                "co2Std": record.get("co2Std"),
                "co2Max": record.get("co2Max"),
                "tvocMean": record.get("tvocMean"),
                "tvocStd": record.get("tvocStd"),
                "tvocMax": record.get("tvocMax"),
                "eco2Mean": record.get("eco2Mean"),
                "eco2Std": record.get("eco2Std"),
                "eco2Max": record.get("eco2Max"),
                "pm1_0Mean": record.get("pm1_0Mean"),
                "pm1_0Std": record.get("pm1_0Std"),
                "pm1_0Max": record.get("pm1_0Max"),
                "pm2_5Mean": record.get("pm2_5Mean"),
                "pm2_5Std": record.get("pm2_5Std"),
                "pm2_5Max": record.get("pm2_5Max"),
                "pm4_0Mean": record.get("pm4_0Mean"),
                "pm4_0Std": record.get("pm4_0Std"),
                "pm4_0Max": record.get("pm4_0Max"),
                "pm10Mean": record.get("pm10Mean"),
                "pm10Std": record.get("pm10Std"),
                "pm10Max": record.get("pm10Max")
            }

            payload = {k: v for k, v in payload.items() if v is not None}

            try:
                resp = requests.post(f"{API_URL}/api/sensor-data", json=payload, timeout=5)
                if resp.status_code in (200, 201):
                    total_replayed += 1
                    if total_replayed % 24 == 0:
                        logger.info("Multiplexed %d readings. Active nodes: %s", total_replayed, list(PHYSICAL_NODES))
                else:
                    logger.warning("POST /api/sensor-data (%s) returned HTTP %d: %s", node_id, resp.status_code, resp.text)
            except Exception as exc:
                logger.warning("Telemetry POST failed for %s: %s", node_id, exc)

            # Check if topology heartbeat is due
            now_sec = time.time()
            if now_sec - last_topology_time >= TOPOLOGY_INTERVAL_SECONDS:
                send_topology_heartbeat(API_URL)
                last_topology_time = now_sec

            # Check if rolling retention prune is due (every 6 hours)
            if now_sec - last_prune_time >= 21600:
                prune_live_records_if_needed(db)
                last_prune_time = now_sec

            time.sleep(STEP_INTERVAL_SECONDS)


if __name__ == "__main__":
    run_replayer()
