"""
HTTP telemetry forwarder.

Sends telemetry readings to the Spring Boot backend via HTTP POST.
Handles connection failures, timeouts, and retries gracefully.

This module is agnostic to the telemetry data source — it works
identically with simulated or real OpenThread telemetry readings.
"""

import requests
from typing import List

from logging_ import setup_logger
from telemetry.model import TelemetryReading

logger = setup_logger(__name__)

# HTTP timeout in seconds (connect, read)
_TIMEOUT = (5, 10)


class HttpForwarder:
    """
    Forwards telemetry readings to the backend REST API.

    Provides resilient HTTP posting with structured logging
    for successful and failed transmissions.
    """

    def __init__(self, backend_url: str):
        """
        Initialise the forwarder with the target backend URL.

        Args:
            backend_url: Full URL of the backend ingestion endpoint
                         (e.g. http://localhost:8080/api/sensor-data).
        """
        self._url = backend_url
        self._session = requests.Session()
        self._session.headers.update({"Content-Type": "application/json"})
        self._success_count = 0
        self._failure_count = 0
        logger.info("HTTP forwarder initialised → %s", self._url)

    def forward(self, readings: List[TelemetryReading]) -> None:
        """
        Forward a batch of telemetry readings to the backend.

        Each reading is sent as an individual POST request.
        Failures are logged but do not interrupt the batch.

        Args:
            readings: List of TelemetryReading objects to forward.
        """
        for reading in readings:
            self._send(reading)

    def _send(self, reading: TelemetryReading) -> bool:
        """
        Send a single telemetry reading to the backend.

        Args:
            reading: The telemetry reading to send.

        Returns:
            bool: True if the request was successful, False otherwise.
        """
        payload = reading.to_dict()

        try:
            response = self._session.post(
                self._url,
                json=payload,
                timeout=_TIMEOUT,
            )

            if response.status_code in (200, 201):
                self._success_count += 1
                logger.info(
                    "✓ Forwarded %s → %d (%d total OK)",
                    reading,
                    response.status_code,
                    self._success_count,
                )
                return True
            else:
                self._failure_count += 1
                logger.warning(
                    "✗ Backend rejected %s → %d: %s",
                    reading.node_id,
                    response.status_code,
                    response.text[:200],
                )
                return False

        except requests.ConnectionError:
            self._failure_count += 1
            logger.error(
                "✗ Connection failed for %s — backend unreachable at %s",
                reading.node_id,
                self._url,
            )
            return False

        except requests.Timeout:
            self._failure_count += 1
            logger.error(
                "✗ Timeout sending %s — backend did not respond",
                reading.node_id,
            )
            return False

        except requests.RequestException as e:
            self._failure_count += 1
            logger.error(
                "✗ Unexpected error forwarding %s: %s",
                reading.node_id,
                str(e),
            )
            return False

    @property
    def stats(self) -> dict:
        """Return forwarding success/failure statistics."""
        return {
            "success": self._success_count,
            "failure": self._failure_count,
            "total": self._success_count + self._failure_count,
        }
