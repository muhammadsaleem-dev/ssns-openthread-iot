"""
Telemetry source abstraction.

Defines the interface that all telemetry sources must implement.
This abstraction enables the gateway to switch between simulated
and real OpenThread telemetry sources without modifying downstream logic.

Future OpenThread Integration:
    Create a new class (e.g., BleTelemetrySource) that implements
    the same interface using the CoAP library to receive real
    OpenThread advertisement/GATT data from Nordic nRF52840 nodes.
"""

from abc import ABC, abstractmethod
from typing import List

from telemetry.model import TelemetryReading


class TelemetrySource(ABC):
    """
    Abstract base class for telemetry data sources.

    Implementations provide telemetry readings — either generated
    (simulator) or received from real OpenThread hardware.
    """

    @abstractmethod
    def read_telemetry(self) -> List[TelemetryReading]:
        """
        Produce one batch of telemetry readings.

        Returns:
            List[TelemetryReading]: One or more readings from sensor nodes.
        """
        ...
