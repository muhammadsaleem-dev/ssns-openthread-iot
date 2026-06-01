"""
Telemetry package for the OpenThread Gateway Simulator.

Contains the telemetry data model and the source abstraction
that can be backed by either a simulator or a real OpenThread receiver.
"""

from telemetry.model import TelemetryReading
from telemetry.source import TelemetrySource

__all__ = ["TelemetryReading", "TelemetrySource"]
