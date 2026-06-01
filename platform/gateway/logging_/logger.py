"""
Structured logging configuration for the OpenThread Gateway Simulator.

Provides a consistent log format across all modules with
configurable log levels via the gateway configuration.
"""

import logging
import sys

_CONFIGURED = False


def setup_logger(name: str, level: str = "INFO") -> logging.Logger:
    """
    Create and return a configured logger instance.

    Args:
        name:  Logger name (typically __name__ of the calling module).
        level: Log level string (DEBUG, INFO, WARNING, ERROR, CRITICAL).

    Returns:
        logging.Logger: Configured logger instance.
    """
    global _CONFIGURED

    logger = logging.getLogger(name)

    # Configure the root logger once
    if not _CONFIGURED:
        root = logging.getLogger()
        root.setLevel(getattr(logging, level.upper(), logging.INFO))

        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(getattr(logging, level.upper(), logging.INFO))

        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)-8s] %(name)-30s — %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)

        # Avoid duplicate handlers on repeated calls
        if not root.handlers:
            root.addHandler(handler)

        _CONFIGURED = True

    return logger
