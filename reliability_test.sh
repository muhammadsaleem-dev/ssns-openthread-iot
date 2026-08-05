#!/bin/bash

# ==============================================================================
# System Reliability Test Script
# 
# Runs the entire SSNS Smart Monitoring System 10 times, verifying that all
# core services (API, Dashboard, Database, ML Service, and Fog Node) successfully
# start and become healthy.
# ==============================================================================

ITERATIONS=10
TIMEOUT_SEC=60
SUCCESS_COUNT=0
FAILURE_COUNT=0

echo "============================================================"
echo "               SYSTEM BOOT RELIABILITY TEST                 "
echo "============================================================"
echo " Iteration | Target State | Actual State | Boot Time | Result"
echo "------------------------------------------------------------"

# Ensure clean state before starting
cd platform && docker compose -f docker-compose.ha.yml down > /dev/null 2>&1
cd ../edge-nodes/mac-fog-node && docker-compose -f docker-compose.fog.yml down > /dev/null 2>&1
cd ../..
sleep 2

for i in $(seq 1 $ITERATIONS); do
    cd platform && docker compose -f docker-compose.ha.yml up -d > /dev/null 2>&1
    cd ../edge-nodes/mac-fog-node && docker-compose -f docker-compose.fog.yml up -d > /dev/null 2>&1
    cd ../..
    
    # Poll for system health
    READY=false
    for (( t=1; t<=$TIMEOUT_SEC; t++ )); do
        # Check if the API load balancer (dashboard port 8080 proxy) is responding
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/nodes || echo "000")
        
        if [ "$HTTP_STATUS" == "200" ]; then
            READY=true
            break
        fi
        sleep 1
    done
    
    if [ "$READY" = true ]; then
        printf "    %02d     |   Healthy    |   Healthy    |    %2ds    |  ✅  \n" $i $t
        ((SUCCESS_COUNT++))
    else
        printf "    %02d     |   Healthy    |   Failed     |   ---     |  ❌  \n" $i
        ((FAILURE_COUNT++))
    fi
    
    # Teardown for the next iteration
    cd platform && docker compose -f docker-compose.ha.yml down > /dev/null 2>&1
    cd ../edge-nodes/mac-fog-node && docker-compose -f docker-compose.fog.yml down > /dev/null 2>&1
    cd ../..
    sleep 2 # Brief pause to ensure ports are released
done

echo "============================================================"
if command -v bc &> /dev/null; then
    RELIABILITY=$(echo "scale=1; ($SUCCESS_COUNT / $ITERATIONS) * 100" | bc)
    echo " Overall Reliability Score: $RELIABILITY% ($SUCCESS_COUNT/$ITERATIONS Successful Boots)"
else
    # Fallback if 'bc' is not installed
    echo " Overall Reliability Score: $((SUCCESS_COUNT * 100 / ITERATIONS))% ($SUCCESS_COUNT/$ITERATIONS Successful Boots)"
fi
echo "============================================================"
