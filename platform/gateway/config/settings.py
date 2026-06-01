"""
Gateway configuration management.

Loads settings from environment variables (with .env file support)
and provides validated, typed configuration to all gateway components.
"""

import os
from dataclasses import dataclass, field
from typing import List

from dotenv import load_dotenv


@dataclass(frozen=True)
class GatewayConfig:
    """Immutable gateway configuration container."""

    # Backend API endpoint for telemetry forwarding
    backend_url: str = "http://localhost:8080/api/sensor-data"

    # Telemetry transmission interval in seconds
    telemetry_interval: int = 10

    # Number of simulated sensor nodes
    node_count: int = 4

    # Log level
    log_level: str = "INFO"

    # Gateway operating mode: "simulator" or "coap"
    gateway_mode: str = "simulator"

    # Telemetry source to use: "simulator" or "openthread" (legacy)
    telemetry_source: str = "simulator"

    # Generated node IDs (derived from node_count)
    node_ids: List[str] = field(default_factory=list)

    def __post_init__(self):
        # Generate node IDs based on node_count if not explicitly set
        if not self.node_ids:
            ids = [f"node-{str(i).zfill(2)}" for i in range(1, self.node_count + 1)]
            # Workaround for frozen dataclass
            object.__setattr__(self, "node_ids", ids)


def load_config() -> GatewayConfig:
    """
    Load configuration from environment variables.

    Reads from a .env file if present, then falls back to
    OS environment variables, then to defaults.

    Returns:
        GatewayConfig: Validated configuration instance.
    """
    load_dotenv()

    return GatewayConfig(
        backend_url=os.getenv("BACKEND_URL", "http://localhost:8080/api/sensor-data"),
        telemetry_interval=int(os.getenv("TELEMETRY_INTERVAL", "10")),
        node_count=int(os.getenv("NODE_COUNT", "4")),
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
        gateway_mode=os.getenv("GATEWAY_MODE", "simulator").lower(),
        telemetry_source=os.getenv("TELEMETRY_SOURCE", "simulator").lower(),
    )
