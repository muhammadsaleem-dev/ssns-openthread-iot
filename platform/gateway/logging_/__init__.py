"""
Logging package for the OpenThread Gateway Simulator.

Provides a pre-configured logger factory for consistent
structured logging across all gateway components.
"""

from logging_.logger import setup_logger

__all__ = ["setup_logger"]
