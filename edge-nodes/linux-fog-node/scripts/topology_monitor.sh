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
      # Fallback to direct Kernel SysFS read because Docker udev is broken
      SYSFS_PORT=$(basename "$DEVICE_PATH")
      SYSFS_SERIAL=$(cat /sys/class/tty/$SYSFS_PORT/device/../serial 2>/dev/null | tr -d '\n' | tr -d '\r')
      
      if [ -n "$SYSFS_SERIAL" ]; then
        HARDWARE_ID="nrf52-$SYSFS_SERIAL"
        if [ "$HARDWARE_ID" != "$PREV_HARDWARE_ID" ]; then
          echo "Hardware ID: $HARDWARE_ID (from $DEVICE_PATH via SysFS)"
          PREV_HARDWARE_ID="$HARDWARE_ID"
        fi
      else
        echo "WARNING: Could not query USB serial from $DEVICE_PATH"
        HARDWARE_ID="legacy-$EXTADDR"
      fi
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
      linkQualityOut: 100,
      age: 0,
      timeout: 0
    }]'
  )

  # 2. Parse Router Table
  # Example line: | 11 | 0x2c00 | 63 | 1 | 3 | 3 | 0 | aa11bb22cc33dd44 | 1 |
  ROUTER_TABLE=$(ot-ctl router table 2>/dev/null)
  
  echo "---"
  echo "ROLE: $STATE"
  echo "ROUTER TABLE:"
  echo "$ROUTER_TABLE"
  
  # Get the Leader RLOC16 so we can properly identify the leader
  LEADER_ID=$(ot-ctl leaderdata 2>/dev/null | grep 'Leader Router ID' | awk '{print $4}' | tr -d '\r')
  if [ -n "$LEADER_ID" ]; then
    LEADER_RLOC16=$(printf "0x%04x" $(( LEADER_ID * 1024 )))
  else
    LEADER_RLOC16=""
  fi

  # Store gateway RLOC16 and EXTADDR for comparison
  GW_RLOC16="$RLOC16"
  GW_EXTADDR="$EXTADDR"

  while read -r line; do
    if [[ "$line" == *"|"* ]] && [[ "$line" != *"ID"* ]]; then
      # Extract using awk (fields separated by | and spaces)
      R_RLOC16=$(echo "$line" | awk -F'|' '{print $3}' | tr -d ' ' | tr -d '\r')
      R_NEXT_HOP=$(echo "$line" | awk -F'|' '{print $4}' | tr -d ' ' | tr -d '\r')
      R_PATH_COST=$(echo "$line" | awk -F'|' '{print $5}' | tr -d ' ' | tr -d '\r')
      R_LQIN=$(echo "$line" | awk -F'|' '{print $6}' | tr -d ' ' | tr -d '\r')
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

      # Map Link Quality (0-3) to a rough percentage (0=0%, 1=33%, 2=66%, 3=100%)
      LQ_PCT=$(( R_LQIN * 33 ))
      if [ "$LQ_PCT" -gt 100 ]; then LQ_PCT=100; fi
      
      # Default timeout for routers isn't explicitly in the table, set to 0
      R_TIMEOUT=0

      PAYLOAD=$(echo "$PAYLOAD" | jq \
        --arg extAddr "$R_EXTMAC" \
        --arg rloc16 "$R_RLOC16" \
        --argjson lqin "$LQ_PCT" \
        --arg role "$R_ROLE" \
        --arg parentRloc "$R_PARENT_RLOC16" \
        --arg linkType "$R_LINK_TYPE" \
        --argjson age "${R_AGE:-0}" \
        --argjson timeout "$R_TIMEOUT" \
        --argjson routeCost "${R_PATH_COST:-0}" \
        '.nodes += [{
          extAddr: $extAddr,
          rloc16: $rloc16,
          role: $role,
          parentRloc16: $parentRloc,
          linkType: $linkType,
          linkQualityIn: $lqin,
          linkQualityOut: $lqin,
          age: $age,
          timeout: $timeout,
          routeCost: $routeCost
        }]'
      )
    fi
  done <<< "$ROUTER_TABLE"

  # 3. Parse Child Table
  # Example line: | 1 | 0x2c01 | 240 | 0 | 3 | 11 |1|0|0| ee11ff22aa33bb44 |
  CHILD_TABLE=$(ot-ctl child table 2>/dev/null)
  
  echo "CHILD TABLE:"
  echo "$CHILD_TABLE"
  echo "---"
  
  while read -r line; do
    if [[ "$line" == *"|"* ]] && [[ "$line" != *"ID"* ]]; then
      C_RLOC16=$(echo "$line" | awk -F'|' '{print $3}' | tr -d ' ' | tr -d '\r')
      C_TIMEOUT=$(echo "$line" | awk -F'|' '{print $4}' | tr -d ' ' | tr -d '\r')
      C_AGE=$(echo "$line" | awk -F'|' '{print $5}' | tr -d ' ' | tr -d '\r')
      C_LQIN=$(echo "$line" | awk -F'|' '{print $6}' | tr -d ' ' | tr -d '\r')
      C_EXTMAC=$(echo "$line" | awk -F'|' '{print $(NF-1)}' | tr -d ' ' | tr -d '\r')

      # We assume children of the BR have the BR as parent. 
      # Map Link Quality (0-3) to a rough percentage (0=0%, 1=33%, 2=66%, 3=100%)
      C_LQ_PCT=$(( C_LQIN * 33 ))
      if [ "$C_LQ_PCT" -gt 100 ]; then C_LQ_PCT=100; fi
      
      C_LINK_TYPE="Child"

      PAYLOAD=$(echo "$PAYLOAD" | jq \
        --arg extAddr "$C_EXTMAC" \
        --arg rloc16 "0x$C_RLOC16" \
        --arg parentRloc "0x$GW_RLOC16" \
        --arg linkType "$C_LINK_TYPE" \
        --argjson lqin "$C_LQ_PCT" \
        --argjson age "${C_AGE:-0}" \
        --argjson timeout "${C_TIMEOUT:-0}" \
        --argjson routeCost 0 \
        '.nodes += [{
          extAddr: $extAddr,
          rloc16: $rloc16,
          role: "child",
          parentRloc16: $parentRloc,
          linkType: $linkType,
          linkQualityIn: $lqin,
          linkQualityOut: $lqin,
          age: $age,
          timeout: $timeout,
          routeCost: $routeCost
        }]'
      )
    fi
  done <<< "$CHILD_TABLE"

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
