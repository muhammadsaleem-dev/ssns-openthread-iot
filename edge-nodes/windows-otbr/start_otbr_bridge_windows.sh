#!/bin/bash

# ============================================================
# Thread Serial Bridge — Windows / WSL2
#
# Bypasses the vhci_hcd (USB/IP) crash issue in WSL2 by 
# bridging the nRF52840 USB serial port to a TCP socket 
# natively on the WSL host.
# ============================================================

set -euo pipefail

TCP_PORT=2000

PORT=$(ls /dev/ttyACM* 2>/dev/null | head -n 1 || true)

if [ -z "$PORT" ]; then
    echo "No device found on /dev/ttyACM*. Attempting to auto-attach via usbipd..."
    
    # Find the BUSID of the nRF52840 or OpenThread device
    BUSID=$(usbipd.exe list 2>/dev/null | grep -iE 'nrf52840|openthread' | awk '{print $1}' | head -n 1 || true)
    
    if [ -n "$BUSID" ]; then
        echo "Found device on Windows BUSID: $BUSID. Attaching to WSL..."
        usbipd.exe attach --wsl --busid "$BUSID" 2>/dev/null || true
        sleep 2
        PORT=$(ls /dev/ttyACM* 2>/dev/null | head -n 1 || true)
    fi
fi

if [ -z "$PORT" ]; then
    echo "ERROR: Failed to attach nRF52840 Dongle."
    echo "Please ensure it is plugged in and you have run 'usbipd bind' from PowerShell as Administrator at least once."
    exit 1
fi

# The Dongle uses Native USB CDC-ACM, which does not require flow control or baud rates
SOCAT_OPTS="file:$PORT,nonblock,raw,echo=0"


echo "============================================================"
echo "  Thread Serial Bridge — Windows/WSL2"
echo "============================================================"
echo "  USB port   : $PORT"
echo "  TCP port   : $TCP_PORT"
echo "============================================================"
echo ""

while true; do
    echo "[$(date '+%H:%M:%S')] Waiting for Docker OTBR container to connect..."
    socat tcp-listen:$TCP_PORT,reuseaddr $SOCAT_OPTS
    echo "[$(date '+%H:%M:%S')] Connection closed. Restarting in 1s..."
    sleep 1
done
