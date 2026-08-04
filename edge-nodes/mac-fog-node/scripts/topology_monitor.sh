#!/bin/bash
# ==============================================================================
# SSNS Thread Topology Monitor
# Polls the local OTBR and posts network topology to the Central Dashboard.
#
# This script is written in pure bash with no jq dependency to ensure
# maximum portability across different Docker base images and hosts.
# ==============================================================================

# Allow URL to be passed as an argument for environments where subshells don't inherit env vars
GATEWAY_BACKEND_URL_ARG=$1
POLL_INTERVAL=${POLL_INTERVAL_SECONDS:-15}

# Use argument if present, otherwise fall back to environment variable
if [ -n "$GATEWAY_BACKEND_URL_ARG" ]; then
  GATEWAY_BACKEND_URL="$GATEWAY_BACKEND_URL_ARG"
fi

if [ -z "$GATEWAY_BACKEND_URL" ]; then
  echo "ERROR: GATEWAY_BACKEND_URL is not set. Topology monitor cannot start."
  exit 1
fi

BASE_URL=${GATEWAY_BACKEND_URL%/api/sensor-data}
API_ENDPOINT="$BASE_URL/api/network/topology"

echo "Topology Monitor starting. Backend: $API_ENDPOINT"
echo "Polling every $POLL_INTERVAL seconds."

# --- Main Loop ---
while true; do
  # Wait for mesh to be initialized by the supervisor
  STATE=$(ot-ctl state 2>/dev/null | grep -v 'Done' | tr -d '\r\n')
  if [ -z "$STATE" ] || [ "$STATE" == "disabled" ]; then
    sleep 5
    continue
  fi

  # --- 1. Gather All Data as Shell Variables ---
  
  # Gateway Health
  GW_PANID=$(ot-ctl panid 2>/dev/null | grep -v 'Done' | tr -d '\r\n')
  GW_EXTPANID=$(ot-ctl extpanid 2>/dev/null | grep -v 'Done' | tr -d '\r\n')
  GW_CHANNEL=$(ot-ctl channel 2>/dev/null | grep -v 'Done' | tr -d '\r\n')
  GW_NETNAME=$(ot-ctl networkname 2>/dev/null | grep -v 'Done' | tr -d '\r\n')
  GW_RLOC16=$(ot-ctl rloc16 2>/dev/null | grep -v 'Done' | tr -d '\r\n')
  GW_EXTADDR=$(ot-ctl extaddr 2>/dev/null | grep -v 'Done' | tr -d '\r\n')
  
  # Read hardware ID from file (written by host bridge script)
  if [ -f "/hardware_id" ]; then
    HARDWARE_ID=$(cat /hardware_id 2>/dev/null | tr -d '\r\n')
  else
    HARDWARE_ID=""
  fi
  
  if [ -z "$HARDWARE_ID" ] || [ "$HARDWARE_ID" = "unknown" ]; then
    echo "WARNING: Hardware ID not available from host, using legacy fallback"
    HARDWARE_ID="legacy-$GW_EXTADDR"
  else
    echo "Hardware ID: $HARDWARE_ID"
  fi
  
  UPTIME_SEC=$(awk '{print int($1)}' /proc/uptime)
  UPTIME_HOURS=$((UPTIME_SEC / 3600))
  UPTIME_MINS=$(((UPTIME_SEC % 3600) / 60))
  GW_UPTIME_STR="${UPTIME_HOURS}h ${UPTIME_MINS}m"

  # --- 2. Construct JSON Payload using printf ---

  # Start building the payload
  PAYLOAD=""
  PAYLOAD+=$(printf '{"hardwareId":"%s",' "$HARDWARE_ID")
  PAYLOAD+=$(printf '"gatewayId":"%s",' "$GW_EXTADDR")
  PAYLOAD+=$(printf '"gatewayHealth":{"panId":"%s","extPanId":"%s","channel":%s,"networkName":"%s","status":"active","uptime":"%s"},' "$GW_PANID" "$GW_EXTPANID" "$GW_CHANNEL" "$GW_NETNAME" "$GW_UPTIME_STR")
  PAYLOAD+=$(printf '"nodes":[')

  # Add self (Border Router) as the first node
  PAYLOAD+=$(printf '{"extAddr":"%s","rloc16":"0x%s","role":"%s","parentRloc16":"0xffff","linkQualityIn":100,"linkQualityOut":100,"age":0,"timeout":0}' "$GW_EXTADDR" "$GW_RLOC16" "$STATE")
  
  ROUTER_TABLE=$(ot-ctl router table 2>/dev/null)
  echo "---"
  echo "ROLE: $STATE"
  echo "ROUTER TABLE:"
  echo "$ROUTER_TABLE"
  
  # Get the Leader RLOC16 so we can properly identify the leader
  LEADER_ID=$(ot-ctl leaderdata 2>/dev/null | grep 'Leader Router ID' | awk '{print $4}' | tr -d '[:space:]')
  if [ -n "$LEADER_ID" ]; then
    LEADER_RLOC16=$(printf "0x%04x" $(( LEADER_ID * 1024 )))
  else
    LEADER_RLOC16=""
  fi

  # Add Routers
  while read -r line; do
    if [[ "$line" == *"|"* ]] && [[ "$line" != *"ID"* ]]; then
      R_RLOC16=$(echo "$line" | awk -F'|' '{print $3}' | tr -d '[:space:]')
      R_NEXT_HOP=$(echo "$line" | awk -F'|' '{print $4}' | tr -d '[:space:]')
      R_LQIN=$(echo "$line" | awk -F'|' '{print $6}' | tr -d '[:space:]')
      R_AGE=$(echo "$line" | awk -F'|' '{print $8}' | tr -d '[:space:]')
      R_EXTMAC=$(echo "$line" | awk -F'|' '{print $(NF-2)}' | tr -d '[:space:]')
      R_LINK=$(echo "$line" | awk -F'|' '{print $(NF-1)}' | tr -d '[:space:]')
      
      # Skip the Border Router itself, as we already added it at the top of the payload
      if [ "$R_EXTMAC" = "$GW_EXTADDR" ] || [ "$R_RLOC16" = "0x$GW_RLOC16" ]; then
        continue
      fi

      # Determine proper role
      R_ROLE="router"
      if [ "$R_RLOC16" = "$LEADER_RLOC16" ]; then
        R_ROLE="leader"
      fi

      # Determine Next Hop RLOC16 for the topology graph
      # If Link == 1, they are direct physical radio neighbors of the Border Router!
      if [ "$R_LINK" = "1" ]; then
        R_PARENT_RLOC16="0x$GW_RLOC16"
        R_LINK_TYPE="Direct"
      elif [[ "$R_NEXT_HOP" =~ ^[0-9]+$ ]]; then
        R_PARENT_RLOC16=$(printf "0x%04x" $(( R_NEXT_HOP * 1024 )))
        R_LINK_TYPE="Multi-hop"
      else
        R_PARENT_RLOC16="0x$GW_RLOC16"
        R_LINK_TYPE="Direct"
      fi

      LQ_PCT=$(( R_LQIN * 33 ))
      if [ "$LQ_PCT" -gt 100 ]; then LQ_PCT=100; fi
      
      R_TIMEOUT=0
      
      PAYLOAD+=$(printf ',{"extAddr":"%s","rloc16":"%s","role":"%s","parentRloc16":"%s","linkType":"%s","linkQualityIn":%d,"linkQualityOut":%d,"age":%d,"timeout":%d,"routeCost":%d}' "$R_EXTMAC" "$R_RLOC16" "$R_ROLE" "$R_PARENT_RLOC16" "$R_LINK_TYPE" "$LQ_PCT" "$LQ_PCT" "${R_AGE:-0}" "$R_TIMEOUT" "${R_PATH_COST:-0}")
    fi
  done <<< "$ROUTER_TABLE"

  CHILD_TABLE=$(ot-ctl child table 2>/dev/null)
  echo "CHILD TABLE:"
  echo "$CHILD_TABLE"
  echo "---"
  
  # Add Children
  while read -r line; do
    if [[ "$line" == *"|"* ]] && [[ "$line" != *"ID"* ]]; then
      C_RLOC16=$(echo "$line" | awk -F'|' '{print $3}' | tr -d '[:space:]')
      C_TIMEOUT=$(echo "$line" | awk -F'|' '{print $4}' | tr -d '[:space:]')
      C_AGE=$(echo "$line" | awk -F'|' '{print $5}' | tr -d '[:space:]')
      C_LQIN=$(echo "$line" | awk -F'|' '{print $6}' | tr -d '[:space:]')
      C_EXTMAC=$(echo "$line" | awk -F'|' '{print $(NF-1)}' | tr -d '[:space:]')
      C_LQ_PCT=$(( C_LQIN * 33 ))
      if [ "$C_LQ_PCT" -gt 100 ]; then C_LQ_PCT=100; fi
      
      C_LINK_TYPE="Child"
      
      PAYLOAD+=$(printf ',{"extAddr":"%s","rloc16":"0x%s","role":"child","parentRloc16":"0x%s","linkType":"%s","linkQualityIn":%d,"linkQualityOut":%d,"age":%d,"timeout":%d,"routeCost":0}' "$C_EXTMAC" "$C_RLOC16" "$GW_RLOC16" "$C_LINK_TYPE" "$C_LQ_PCT" "$C_LQ_PCT" "${C_AGE:-0}" "${C_TIMEOUT:-0}")
    fi
  done <<< "$CHILD_TABLE"

  # Close the JSON
  PAYLOAD+=$(printf ']}')

  # --- 3. POST to Backend ---
  HTTP_CODE=$(curl -s -w "%{http_code}" -o /dev/null -X POST -H "Content-Type: application/json" -d "$PAYLOAD" "$API_ENDPOINT")
  
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    # Only log success on first poll or after failures
    if [ "$LAST_STATUS" != "success" ]; then
      echo "✓ Topology data forwarded successfully (HTTP $HTTP_CODE)"
      LAST_STATUS="success"
    fi
  else
    echo "✗ Failed to forward topology data (HTTP $HTTP_CODE)"
    LAST_STATUS="failed"
  fi

  sleep "$POLL_INTERVAL"
done
