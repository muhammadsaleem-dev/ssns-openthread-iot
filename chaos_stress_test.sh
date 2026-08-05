#!/bin/bash

# ==============================================================================
# Master's Level Advanced Reliability Test (Chaos & Stress)
# 
# This script proves the High Availability (HA) of the SSNS Smart Monitoring System.
# It blasts the Load Balancer with hundreds of telemetry packets per second,
# and violently kills one of the backend nodes mid-stream to prove that
# the system fails over seamlessly without dropping a single sensor reading.
# ==============================================================================

echo "=================================================="
echo "🧪 Starting Chaos Engineering & Stress Test"
echo "=================================================="

# Ensure clean state before starting
echo "🧹 Cleaning up any existing containers..."
cd platform && docker compose -f docker-compose.ha.yml down > /dev/null 2>&1
cd ../edge-nodes/mac-fog-node && docker-compose -f docker-compose.fog.yml down > /dev/null 2>&1
cd ../..
sleep 2

# Start the system, forcing a local rebuild of just the dashboard so Nginx gets our updated HA config
echo "⏳ Booting up Docker containers (Offline fast-boot)..."
cd platform && docker compose -f docker-compose.ha.yml up -d --build
cd ../edge-nodes/mac-fog-node && docker-compose -f docker-compose.fog.yml up -d
cd ../..

TIMEOUT_SEC=60
echo "📡 Waiting for API Load Balancer to respond (Timeout: ${TIMEOUT_SEC}s)..."
READY=false
for (( t=1; t<=$TIMEOUT_SEC; t++ )); do
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/nodes || echo "000")
    if [ "$HTTP_STATUS" == "200" ]; then
        READY=true
        break
    fi
    sleep 1
done

if [ "$READY" = false ]; then
    echo "❌ Failure! System failed to become ready within $TIMEOUT_SEC seconds."
    echo "🛑 Tearing down..."
    cd platform && docker compose -f docker-compose.ha.yml down
    cd ../..
    exit 1
fi

echo "✅ System fully operational! (Boot took $t seconds)"
echo "☕ Giving the Java Virtual Machine 20 seconds to warm up and allocate connection pools..."
sleep 20
echo ""
echo "=================================================="
echo "🔥 STAGE 1: INITIATING HIGH-CONCURRENCY LOAD TEST"
echo "=================================================="
echo "   Executing: node stress_worker.js"

# Run the Node.js stress worker in the background
node stress_worker.js &
WORKER_PID=$!

# Wait 5 seconds while data is flowing smoothly
echo "   [Waiting 5 seconds to establish baseline load...]"
sleep 5

echo ""
echo "=================================================="
echo "💀 STAGE 2: INJECTING CATASTROPHIC CHAOS"
echo "=================================================="
echo "   Executing: docker kill api-1"
echo "   (Simulating a violent crash of the primary backend server)"
docker kill api-1

echo ""
echo "=================================================="
echo "🛡️ STAGE 3: FAILOVER VERIFICATION"
echo "=================================================="
echo "   Nginx Load Balancer should instantly failover to api-2."
echo "   Waiting for stress test to complete (10 more seconds)..."

# Wait for the Node.js worker to finish and capture its exit code
wait $WORKER_PID
WORKER_EXIT_CODE=$?

echo ""
echo "=================================================="
echo "📊 CHAOS TEST RESULTS"
echo "=================================================="
if [ $WORKER_EXIT_CODE -eq 0 ]; then
    echo "✅ PERFECT RELIABILITY ACHIEVED!"
    echo "   Primary API node (api-1) was terminated mid-stream,"
    echo "   and the Nginx Load Balancer seamlessly re-routed all"
    echo "   traffic to api-2. Zero telemetry packets were dropped."
    echo "   (High Availability & Fault Tolerance: VALIDATED)"
else
    echo "❌ RELIABILITY FAILURE!"
    echo "   Some packets were dropped when api-1 died."
    echo "   Check Nginx logs and api-2 logs."
fi

echo "=================================================="

# Teardown
echo "🛑 Tearing down containers..."
cd platform && docker compose -f docker-compose.ha.yml down > /dev/null 2>&1
cd ../edge-nodes/mac-fog-node && docker-compose -f docker-compose.fog.yml down > /dev/null 2>&1
cd ../..
echo "✅ Test completed safely."
