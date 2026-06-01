#!/bin/bash
# Helper script to flash Sensor Node firmware

# Get the absolute path to the directory containing this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Navigate to the sensor-node firmware directory relative to the script
cd "$SCRIPT_DIR/../firmware/sensor-node"

# Ensure environment is set up
export PATH="/opt/nordic/ncs/toolchains/b8efef2ad5/bin:$PATH"
export ZEPHYR_BASE=/opt/nordic/ncs/v2.9.2/zephyr

echo "==========================================="
echo "   Flashing Sensor Node Firmware"
echo "==========================================="

# west flash handles auto-detecting the board. 
# We pipe stderr to stdout and use grep to filter out the annoying J-Link DLL USB errors
# while keeping --line-buffered so the interactive menu still works!
west flash 2>&1 | grep --line-buffered -v "\[error\] \[SeggerBackend\]"

if [ ${PIPESTATUS[0]} -eq 0 ]; then
  echo "==========================================="
  echo " ✓ Successfully flashed!"
  echo "   The board is restarting and joining Thread."
  echo "==========================================="
else
  echo "==========================================="
  echo " ✗ Flash failed."
  echo "   Make sure your DK board is plugged into your Mac via USB."
  echo "==========================================="
fi
