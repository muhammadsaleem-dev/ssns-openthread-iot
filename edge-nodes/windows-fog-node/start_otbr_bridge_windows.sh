#!/bin/bash
set -euo pipefail
TCP_PORT=2000

echo "============================================================"
echo "  Thread Serial Bridge — STABLE MODE"
echo "============================================================"

while true; do
    PORT=$(ls /dev/ttyACM* 2>/dev/null | head -n 1 || true)
    
    if [ -z "$PORT" ]; then
        echo "[$(date '+%H:%M:%S')] Searching for device on /dev/ttyACM*..."
        sleep 2
        continue
    fi

    echo "[$(date '+%H:%M:%S')] Bridge Active: $PORT <-> TCP:$TCP_PORT"
    
    # Stable, simple bridge. Blocks until container connects.
    socat tcp-listen:$TCP_PORT,reuseaddr file:$PORT,nonblock,raw,echo=0
    
    echo "[$(date '+%H:%M:%S')] Connection closed. Re-scanning in 1s..."
    sleep 1
done
