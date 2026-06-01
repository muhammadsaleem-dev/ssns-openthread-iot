"""
Configuration package for the OpenThread Gateway Simulator.

Centralises all configuration loading and validation.
"""

from config.settings import GatewayConfig, load_config

__all__ = ["GatewayConfig", "load_config"]
