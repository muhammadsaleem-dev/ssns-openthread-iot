import sqlite3
import json
import asyncio
import time
from datetime import datetime, timezone, timedelta
from telemetry.model import TelemetryReading
from forwarding.http_forwarder import HttpForwarder
from logging_ import setup_logger

logger = setup_logger(__name__)

class SQLiteQueueManager:
    """
    Persistent SQLite queue for telemetry packets.
    Survives Gateway, Backend, and MongoDB outages.
    """

    def __init__(self, db_path: str = "queue.db"):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """Initialise the SQLite database with WAL mode for concurrency."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS telemetry_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    node_id TEXT NOT NULL,
                    sequence_number INTEGER NOT NULL,
                    payload TEXT NOT NULL,
                    retry_count INTEGER DEFAULT 0,
                    last_attempt TIMESTAMP,
                    next_retry TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            # Index for fast polling
            conn.execute("CREATE INDEX IF NOT EXISTS idx_next_retry ON telemetry_queue(next_retry);")
            conn.commit()

    def enqueue(self, node_id: str, seq_num: int, payload_json: str):
        """
        Insert a new packet into the queue.
        The packet is stamped with its exact arrival time (gateway_timestamp)
        before being serialized into the queue payload.
        """
        # Inject gateway timestamp here to preserve exact arrival time
        data = json.loads(payload_json)
        data['timestamp'] = datetime.now(timezone.utc).isoformat()
        final_payload = json.dumps(data)

        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO telemetry_queue 
                (node_id, sequence_number, payload, next_retry) 
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (node_id, seq_num, final_payload)
            )
            conn.commit()
        logger.debug("Enqueued packet for %s (seq=%d)", node_id, seq_num)

    async def worker_loop(self, forwarder: HttpForwarder):
        """
        Background worker that polls the SQLite database and forwards
        packets to the Spring Boot backend with exponential backoff.
        """
        logger.info("SQLite Queue worker started.")
        while True:
            try:
                await self._process_batch(forwarder)
            except Exception as e:
                logger.error("Queue worker error: %s", e)
            
            # Polling interval
            await asyncio.sleep(1.0)

    async def _process_batch(self, forwarder: HttpForwarder):
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Fetch ready rows (max 50 per batch)
            cursor.execute(
                """
                SELECT id, payload, retry_count 
                FROM telemetry_queue 
                WHERE next_retry <= CURRENT_TIMESTAMP OR next_retry IS NULL 
                ORDER BY created_at ASC 
                LIMIT 50
                """
            )
            rows = cursor.fetchall()

        if not rows:
            return

        for row in rows:
            row_id = row["id"]
            payload_str = row["payload"]
            retry_count = row["retry_count"]

            try:
                # Deserialize and build model
                payload_data = json.loads(payload_str)
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
                    timestamp=payload_data.get("timestamp")
                )

                # HTTP Forwarding
                # Run blocking POST in thread pool
                loop = asyncio.get_event_loop()
                success = await loop.run_in_executor(None, forwarder._send, reading)

                if success:
                    with sqlite3.connect(self.db_path) as conn:
                        conn.execute("DELETE FROM telemetry_queue WHERE id = ?", (row_id,))
                        conn.commit()
                    logger.debug("Successfully forwarded and deleted row %d", row_id)
                else:
                    self._handle_failure(row_id, retry_count)

            except Exception as e:
                logger.error("Error processing row %d: %s", row_id, e)
                self._handle_failure(row_id, retry_count)

    def _handle_failure(self, row_id: int, current_retry: int):
        """
        Increment retry count and schedule next attempt using exponential backoff.
        Note: `current_retry` is the count BEFORE this failure. Delay is calculated
        using the unincremented count, and capped at 3600 seconds (1 hour).
        """
        delay_seconds = min(3600, 2 ** current_retry)
        next_retry_time = datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                UPDATE telemetry_queue 
                SET retry_count = retry_count + 1, 
                    last_attempt = CURRENT_TIMESTAMP, 
                    next_retry = ? 
                WHERE id = ?
                """,
                (next_retry_time.isoformat(), row_id)
            )
            conn.commit()
        logger.warning("Scheduled row %d for retry %d at %s", row_id, current_retry + 1, next_retry_time)
