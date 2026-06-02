"""
Telemetry data model.

Defines the canonical telemetry reading structure used throughout
the gateway — regardless of whether data comes from a simulator
or a real OpenThread sensor node.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class TelemetryReading:
    """A single environmental telemetry reading from a sensor node."""

    node_id: str
    boot_id: str
    sequence_number: int
    temperature: float
    humidity: float
    co2: float
    tvoc: float
    eco2: float
    pm1_0: float
    pm2_5: float
    pm4_0: float
    pm10: float
    light_intensity: float
    health_status: int = 255
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        """
        Convert to a JSON-serialisable dictionary matching the
        backend API contract.

        Returns:
            dict: Payload ready for HTTP forwarding.
        """
        return {
            "nodeId": self.node_id,
            "bootId": self.boot_id,
            "sequenceNumber": self.sequence_number,
            "temperature": round(self.temperature, 1),
            "humidity": round(self.humidity, 1),
            "co2": round(self.co2, 1),
            "tvoc": round(self.tvoc, 1),
            "eco2": round(self.eco2, 1),
            "pm1_0": round(self.pm1_0, 1),
            "pm2_5": round(self.pm2_5, 1),
            "pm4_0": round(self.pm4_0, 1),
            "pm10": round(self.pm10, 1),
            "lightIntensity": round(self.light_intensity, 1),
            "healthStatus": self.health_status,
            "timestamp": self.timestamp,
        }

    def __str__(self) -> str:
        health_str = f"health={self.health_status:08b}"
        if self.health_status != 255:
            health_str = f"⚠️  {health_str} (FAULT)"
            
        return (
            f"[{self.node_id}] "
            f"temp={self.temperature:.1f}°C, "
            f"hum={self.humidity:.1f}%, "
            f"co2={self.co2:.0f}ppm, "
            f"tvoc={self.tvoc:.0f}ppb, "
            f"pm2.5={self.pm2_5:.1f}µg/m³, "
            f"light={self.light_intensity:.0f}lux, "
            f"{health_str}"
        )
