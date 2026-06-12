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
    """A single environmental telemetry reading from a sensor node with statistics."""

    # Metadata
    node_id: str
    boot_id: str
    sequence_number: int
    
    # Current sensor values
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
    mesh_id: str = None
    ipv6_address: str = None
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    # Statistics (mean, std, max for each sensor)
    temperature_mean: float = 0.0
    temperature_std: float = 0.0
    temperature_max: float = 0.0
    
    humidity_mean: float = 0.0
    humidity_std: float = 0.0
    humidity_max: float = 0.0
    
    co2_mean: float = 0.0
    co2_std: float = 0.0
    co2_max: float = 0.0
    
    tvoc_mean: float = 0.0
    tvoc_std: float = 0.0
    tvoc_max: float = 0.0
    
    eco2_mean: float = 0.0
    eco2_std: float = 0.0
    eco2_max: float = 0.0
    
    pm1_0_mean: float = 0.0
    pm1_0_std: float = 0.0
    pm1_0_max: float = 0.0
    
    pm2_5_mean: float = 0.0
    pm2_5_std: float = 0.0
    pm2_5_max: float = 0.0
    
    pm4_0_mean: float = 0.0
    pm4_0_std: float = 0.0
    pm4_0_max: float = 0.0
    
    pm10_mean: float = 0.0
    pm10_std: float = 0.0
    pm10_max: float = 0.0

    def to_dict(self) -> dict:
        """
        Convert to a JSON-serialisable dictionary matching the
        backend API contract.

        Returns:
            dict: Payload ready for HTTP forwarding.
        """
        return {
            # Metadata
            "nodeId": self.node_id,
            "bootId": self.boot_id,
            "sequenceNumber": self.sequence_number,
            
            # Current values
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
            "meshId": self.mesh_id,
            "ipv6Address": self.ipv6_address,
            "timestamp": self.timestamp,
            
            # Temperature statistics
            "temperatureMean": round(self.temperature_mean, 1),
            "temperatureStd": round(self.temperature_std, 2),
            "temperatureMax": round(self.temperature_max, 1),
            
            # Humidity statistics
            "humidityMean": round(self.humidity_mean, 1),
            "humidityStd": round(self.humidity_std, 2),
            "humidityMax": round(self.humidity_max, 1),
            
            # CO2 statistics
            "co2Mean": round(self.co2_mean, 1),
            "co2Std": round(self.co2_std, 2),
            "co2Max": round(self.co2_max, 1),
            
            # TVOC statistics
            "tvocMean": round(self.tvoc_mean, 1),
            "tvocStd": round(self.tvoc_std, 2),
            "tvocMax": round(self.tvoc_max, 1),
            
            # eCO2 statistics
            "eco2Mean": round(self.eco2_mean, 1),
            "eco2Std": round(self.eco2_std, 2),
            "eco2Max": round(self.eco2_max, 1),
            
            # PM1.0 statistics
            "pm1_0Mean": round(self.pm1_0_mean, 1),
            "pm1_0Std": round(self.pm1_0_std, 2),
            "pm1_0Max": round(self.pm1_0_max, 1),
            
            # PM2.5 statistics
            "pm2_5Mean": round(self.pm2_5_mean, 1),
            "pm2_5Std": round(self.pm2_5_std, 2),
            "pm2_5Max": round(self.pm2_5_max, 1),
            
            # PM4.0 statistics
            "pm4_0Mean": round(self.pm4_0_mean, 1),
            "pm4_0Std": round(self.pm4_0_std, 2),
            "pm4_0Max": round(self.pm4_0_max, 1),
            
            # PM10 statistics
            "pm10Mean": round(self.pm10_mean, 1),
            "pm10Std": round(self.pm10_std, 2),
            "pm10Max": round(self.pm10_max, 1),
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
