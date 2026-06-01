"""
Simulator package for the OpenThread Gateway.

Provides a simulated telemetry source that generates realistic
environmental sensor data. This module is the primary component
to be replaced when transitioning to real OpenThread hardware.
"""

from simulator.simulated_source import SimulatedTelemetrySource

__all__ = ["SimulatedTelemetrySource"]
