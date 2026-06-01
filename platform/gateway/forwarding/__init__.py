"""
Forwarding package for the OpenThread Gateway Simulator.

Handles HTTP-based telemetry forwarding to the Spring Boot backend.
This module remains unchanged when transitioning from simulated to
real OpenThread telemetry — it only consumes TelemetryReading objects.
"""

from forwarding.http_forwarder import HttpForwarder

__all__ = ["HttpForwarder"]
