#!/bin/bash
# ==============================================================================
# SSNS Thread Topology Monitor
# Polls the local OTBR and posts network topology to the Central Dashboard.
# ==============================================================================

POLL_INTERVAL=${POLL_INTERVAL_SECONDS:-15}

if [ -z "$GATEWAY_BACKEND_URL" ]; then
  echo "ERROR: GATEWAY_BACKEND_URL is not set. Topology monitor cannot start."
  exit 1
fi

BASE_URL=${GATEWAY_BACKEND_URL%/api/sensor-data}
API_ENDPOINT="$BASE_URL/api/network/topology"

echo "Topology Monitor starting. Backend: $API_ENDPOINT"
echo "Polling every $POLL_INTERVAL seconds."
echo "---"

while true; do
  # Wait for mesh to be initialized by the supervisor
  STATE=$(ot-ctl state 2>/dev/null | grep -v 'Done')
  if [ -z "$STATE" ] || [ "$STATE" == "disabled" ]; then
    sleep 5
    continue
  fi

  # 1. Gateway Health
  # We use 'tr -d \r' to sanitize output from ot-ctl. 
  # This is critical because hidden carriage returns break JSON string comparisons in the dashboard.
  PANID=$(ot-ctl panid | grep -v 'Done' | tr -d '\r')
  EXTPANID=$(ot-ctl extpanid | grep -v 'Done' | tr -d '\r')
  CHANNEL=$(ot-ctl channel | grep -v 'Done' | tr -d '\r')
  NETNAME=$(ot-ctl networkname | grep -v 'Done' | tr -d '\r')
  RLOC16=$(ot-ctl rloc16 | grep -v 'Done' | tr -d '\r')
  EXTADDR=$(ot-ctl extaddr | grep -v 'Done' | tr -d '\r')
  
  # Query stable hardware ID from USB serial number
  # Extract device path from OT_RCP_DEVICE environment variable
  DEVICE_PATH=$(echo "${OT_RCP_DEVICE:-spinel+hdlc+uart:///dev/ttyACM0}" | sed 's|.*://||')
  
  if command -v udevadm >/dev/null 2>&1; then
    HARDWARE_ID=$(udevadm info --name="$DEVICE_PATH" 2>/dev/null | \
                  grep -E '^E: ID_SERIAL_SHORT=' | \
                  cut -d= -f2)
    
    if [ -n "$HARDWARE_ID" ]; then
      HARDWARE_ID="nrf52-$HARDWARE_ID"
      # Only log hardware ID on first detection or if it changes
      if [ "$HARDWARE_ID" != "$PREV_HARDWARE_ID" ]; then
        echo "Hardware ID: $HARDWARE_ID (from $DEVICE_PATH)"
        PREV_HARDWARE_ID="$HARDWARE_ID"
      fi
    else
      echo "WARNING: Could not query USB serial from $DEVICE_PATH"
      HARDWARE_ID="legacy-$EXTADDR"
    fi
  else
    if [ -z "$UDEVADM_WARNING_SHOWN" ]; then
      echo "WARNING: udevadm not available, using legacy fallback"
      UDEVADM_WARNING_SHOWN=1
    fi
    HARDWARE_ID="legacy-$EXTADDR"
  fi
  
  # Calculate simple uptime of this container process for the dashboard health card
  UPTIME_SEC=$(awk '{print int($1)}' /proc/uptime)
  UPTIME_HOURS=$((UPTIME_SEC / 3600))
  UPTIME_MINS=$(((UPTIME_SEC % 3600) / 60))
  UPTIME_STR="${UPTIME_HOURS}h ${UPTIME_MINS}m"

  # Initialize JSON payload
  # hardwareId is the stable anchor (USB serial) that prevents data collisions in the multi-BR cloud database.
  # gatewayId (EXTADDR) is kept for network debugging but is volatile.
  PAYLOAD=$(jq -n \
    --arg hardwareId "$HARDWARE_ID" \
    --arg gatewayId "$EXTADDR" \
    --arg panId "$PANID" \
    --arg extPanId "$EXTPANID" \
    --arg channel "$CHANNEL" \
    --arg networkName "$NETNAME" \
    --arg status "active" \
    --arg uptime "$UPTIME_STR" \
    '{
      hardwareId: $hardwareId,
      gatewayId: $gatewayId,
      gatewayHealth: {
        panId: $panId,
        extPanId: $extPanId,
        channel: ($channel | tonumber),
        networkName: $networkName,
        status: $status,
        uptime: $uptime
      },
      nodes: []
    }'
  )

  # Add Border Router itself as a node in the mesh list.
  # We sanitize the $STATE to ensure the 'leader' or 'router' string is clean for UI logic.
  PAYLOAD=$(echo "$PAYLOAD" | jq \
    --arg extAddr "$EXTADDR" \
    --arg rloc16 "0x$RLOC16" \
    --arg role "$(echo "$STATE" | tr -d '\r')" \
    '.nodes += [{
      extAddr: $extAddr,
      rloc16: $rloc16,
      role: $role,
      parentRloc16: "0xffff",
      linkQualityIn: 100,
      linkQualityOut: 100
    }]'
  )

  # 2. Parse Router Table
  # Example line: | 11 | 0x2c00 | 63 | 1 | 3 | 3 | 0 | aa11bb22cc33dd44 | 1 |
  while read -r line; do
    if [[ "$line" == *"|"* ]] && [[ "$line" != *"ID"* ]]; then
      # Extract using awk (fields separated by | and spaces)
      R_RLOC16=$(echo "$line" | awk -F'|' '{print $3}' | tr -d ' ' | tr -d '\r')
      R_LQIN=$(echo "$line" | awk -F'|' '{print $6}' | tr -d ' ' | tr -d '\r')
      R_EXTMAC=$(echo "$line" | awk -F'|' '{print $9}' | tr -d ' ' | tr -d '\r')

      # Map Link Quality (0-3) to a rough percentage (0=0%, 1=33%, 2=66%, 3=100%)
      LQ_PCT=$(( R_LQIN * 33 ))
      if [ "$LQ_PCT" -gt 100 ]; then LQ_PCT=100; fi

      PAYLOAD=$(echo "$PAYLOAD" | jq \
        --arg extAddr "$R_EXTMAC" \
        --arg rloc16 "$R_RLOC16" \
        --argjson lqin "$LQ_PCT" \
        --arg gwRloc "0x$RLOC16" \
        '.nodes += [{
          extAddr: $extAddr,
          rloc16: $rloc16,
          role: "router",
          parentRloc16: $gwRloc,
          linkQualityIn: $lqin,
          linkQualityOut: $lqin
        }]'
      )
    fi
  done <<< "$(ot-ctl router table 2>/dev/null)"

  # 3. Parse Child Table
  # Example line: | 1 | 0x2c01 | 240 | 0 | 3 | 11 |1|0|0| ee11ff22aa33bb44 |
  while read -r line; do
    if [[ "$line" == *"|"* ]] && [[ "$line" != *"ID"* ]]; then
      C_RLOC16=$(echo "$line" | awk -F'|' '{print $3}' | tr -d ' ' | tr -d '\r')
      C_LQIN=$(echo "$line" | awk -F'|' '{print $6}' | tr -d ' ' | tr -d '\r')
      C_EXTMAC=$(echo "$line" | awk -F'|' '{print $11}' | tr -d ' ' | tr -d '\r')

      LQ_PCT=$(( C_LQIN * 33 ))
      if [ "$LQ_PCT" -gt 100 ]; then LQ_PCT=100; fi

      # We assume children of the BR have the BR as parent. 
      # (If it's a child of another router, we'd need more complex parsing, but for simple topology this works)
      PAYLOAD=$(echo "$PAYLOAD" | jq \
        --arg extAddr "$C_EXTMAC" \
        --arg rloc16 "$C_RLOC16" \
        --argjson lqin "$LQ_PCT" \
        --arg gwRloc "0x$RLOC16" \
        '.nodes += [{
          extAddr: $extAddr,
          rloc16: $rloc16,
          role: "child",
          parentRloc16: $gwRloc,
          linkQualityIn: $lqin,
          linkQualityOut: $lqin
        }]'
      )
    fi
  done <<< "$(ot-ctl child table 2>/dev/null)"

  # 4. POST to Backend
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
