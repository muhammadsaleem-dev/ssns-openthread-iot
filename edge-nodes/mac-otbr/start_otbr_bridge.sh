#!/bin/bash

# ============================================================
# Thread Serial Bridge — macOS → Docker
#
# Bridges the nRF52840 USB serial port to a TCP socket (port 2000)
# so the OTBR Docker container can access the RCP radio.
#
# Automatically detects whether the connected device is:
#   - nRF52840 USB Dongle  (CDC-ACM — no baud/flow control needed)
#   - nRF52840 DK board    (J-Link UART — needs 115200 + crtscts)
#
# Uses a reconnect loop (not fork) to ensure only ONE process
# ever holds the serial port open at a time. When the Docker
# container disconnects, the old socat exits cleanly, and the
# loop restarts it for the next connection.
# ============================================================

set -euo pipefail

TCP_PORT=2000

echo "============================================================"
echo "  Thread Serial Bridge — macOS"
echo "  Listening on TCP Port: $TCP_PORT"
echo "============================================================"
echo ""

# --- Reconnect loop ---------------------------------------------
while true; do
    # 1. Try to find the Dongle (the suffix after 'usbmodem' contains letters A-F)
    PORT=$(ls /dev/cu.usbmodem* 2>/dev/null | grep -E 'usbmodem.*[a-fA-F]' | head -n 1 || true)

    # 2. Fallback to the DK if no Dongle is found
    if [ -z "$PORT" ]; then
        PORT=$(ls /dev/cu.usbmodem* 2>/dev/null | head -n 1 || true)
    fi

    # 3. If no device is found, wait and try again
    if [ -z "$PORT" ]; then
        echo "[$(date '+%H:%M:%S')] Waiting for nRF52840 device to be plugged in..."
        sleep 2
        continue
    fi

    # 4. Configure socat based on board type
    if echo "$PORT" | grep -qE 'usbmodem.*[a-fA-F]'; then
        BOARD_TYPE="Dongle (USB CDC-ACM)"
        SOCAT_OPTS="file:$PORT,nonblock,raw,echo=0"
    else
        BOARD_TYPE="DK (J-Link UART)"
        SOCAT_OPTS="file:$PORT,nonblock,raw,echo=0,ispeed=115200,ospeed=115200"
    fi

    echo "[$(date '+%H:%M:%S')] Found $BOARD_TYPE on $PORT. Waiting for Docker OTBR..."
    
    # 5. Start socat. If it fails (e.g. device unplugged), it exits and the loop repeats
    socat tcp-listen:$TCP_PORT,reuseaddr $SOCAT_OPTS || true
    
    echo "[$(date '+%H:%M:%S')] Connection closed (device unplugged or Docker exited). Restarting..."
    sleep 1
done
