"""
Simulated telemetry source.

Generates realistic environmental telemetry readings that mimic
OpenThread sensor node data from Nordic nRF52840 devices. Each simulated
node maintains its own baseline values with natural drift to
produce believable time-series data.

Future OpenThread Integration:
    This entire module is replaced by a BleTelemetrySource that
    uses the CoAP library to scan for and read data from real
    OpenThread peripherals. The TelemetrySource interface ensures that
    downstream forwarding logic requires zero changes.
"""

import random
from datetime import datetime, timezone
from typing import Dict, List

from logging_ import setup_logger
from telemetry.model import TelemetryReading
from telemetry.source import TelemetrySource

logger = setup_logger(__name__)


class _NodeState:
    """Internal state tracker for a single simulated sensor node."""

    def __init__(self, node_id: str):
        self.node_id = node_id
        self.base_temperature = random.uniform(18.0, 26.0)
        self.base_humidity = random.uniform(30.0, 60.0)
        self.base_co2 = random.uniform(400.0, 800.0)
        self.base_tvoc = random.uniform(0.0, 100.0)
        self.base_pm2_5 = random.uniform(0.0, 10.0)
        self.base_light = random.uniform(100.0, 800.0)

        # Trend simulation state
        self.trend_mode = False
        self.trend_ticks_remaining = 0
        self.co2_trend_slope = 0.0
        self.pm25_trend_slope = 0.0

    def generate_reading(self) -> TelemetryReading:
        """Generate a telemetry reading with realistic drift from baseline."""
        
        # Drift baselines (very slow, smooth changes in normal state)
        self.base_temperature += random.uniform(-0.01, 0.01)
        self.base_humidity += random.uniform(-0.05, 0.05)
        self.base_tvoc += random.uniform(-0.2, 0.2)
        self.base_light += random.uniform(-0.5, 0.5)

        # Randomly start a trend if not in one
        if not self.trend_mode and random.random() < 0.01:  # 1% chance per tick to start a trend
            self.trend_mode = True
            self.trend_ticks_remaining = random.randint(30, 90)  # Last for 30-90 ticks
            if random.random() < 0.5:
                # Strong CO2 trend (simulate room filling up)
                self.co2_trend_slope = random.uniform(5.0, 20.0)
                self.pm25_trend_slope = random.uniform(0.0, 0.1)
            else:
                # Strong PM2.5 trend (simulate smoke/dust)
                self.co2_trend_slope = random.uniform(-1.0, 1.0)
                self.pm25_trend_slope = random.uniform(0.2, 1.0)

        if self.trend_mode:
            self.base_co2 += self.co2_trend_slope
            self.base_pm2_5 += self.pm25_trend_slope
            self.trend_ticks_remaining -= 1
            if self.trend_ticks_remaining <= 0:
                self.trend_mode = False
        else:
            # Normal random walk (tightly clustered)
            self.base_co2 += random.uniform(-0.5, 0.5)
            self.base_pm2_5 += random.uniform(-0.02, 0.02)

        # Clamp baselines
        self.base_temperature = max(10.0, min(35.0, self.base_temperature))
        self.base_humidity = max(20.0, min(80.0, self.base_humidity))
        self.base_co2 = max(400.0, min(2000.0, self.base_co2))
        self.base_tvoc = max(0.0, min(1000.0, self.base_tvoc))
        self.base_pm2_5 = max(0.0, min(100.0, self.base_pm2_5))
        self.base_light = max(0.0, min(2000.0, self.base_light))

        # Generate readings with very small sensor noise
        temperature = self.base_temperature + random.uniform(-0.05, 0.05)
        humidity = self.base_humidity + random.uniform(-0.2, 0.2)
        co2 = self.base_co2 + random.uniform(-1.0, 1.0)
        tvoc = self.base_tvoc + random.uniform(-0.5, 0.5)
        
        # Derived eCO2 follows TVOC loosely
        eco2 = max(400.0, 400.0 + (tvoc * 0.5) + random.uniform(-10.0, 10.0))
        
        # PM values generally correlate
        pm2_5 = self.base_pm2_5 + random.uniform(-0.1, 0.1)
        pm1_0 = max(0.0, pm2_5 * 0.4 + random.uniform(-0.05, 0.05))
        pm4_0 = pm2_5 * 1.2 + random.uniform(-0.05, 0.05)
        pm10 = pm2_5 * 1.5 + random.uniform(-0.1, 0.1)
        
        light = max(0.0, self.base_light + random.uniform(-2.0, 2.0))

        return TelemetryReading(
            node_id=self.node_id,
            temperature=temperature,
            humidity=humidity,
            co2=co2,
            tvoc=tvoc,
            eco2=eco2,
            pm1_0=pm1_0,
            pm2_5=pm2_5,
            pm4_0=pm4_0,
            pm10=pm10,
            light_intensity=light,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )


class SimulatedTelemetrySource(TelemetrySource):
    """
    Telemetry source backed by simulated sensor nodes.

    Implements the TelemetrySource interface so that the gateway's
    forwarding pipeline treats simulated data identically to real
    OpenThread telemetry.
    """

    def __init__(self, node_ids: List[str]):
        """
        Initialise the simulator with a list of virtual node IDs.

        Args:
            node_ids: List of sensor node identifiers to simulate.
        """
        self._nodes: Dict[str, _NodeState] = {
            nid: _NodeState(nid) for nid in node_ids
        }
        logger.info(
            "Simulated telemetry source initialised with %d node(s): %s",
            len(node_ids),
            ", ".join(node_ids),
        )

    def read_telemetry(self) -> List[TelemetryReading]:
        """
        Generate one reading per simulated node.

        Returns:
            List[TelemetryReading]: One reading from each active node.
        """
        readings = []
        for node_id, state in self._nodes.items():
            reading = state.generate_reading()
            readings.append(reading)
            logger.debug("Generated: %s", reading)
        return readings
