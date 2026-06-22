#!/bin/bash
# ============================================================
# SSNS OTBR — Self-Healing Supervisor for Native Linux
# Survives dongle unplug/replug without container restart.
# ============================================================

# ── One-time system initialization ──────────────────────
rm -f /var/run/dbus/pid
service dbus start
service rsyslog start
# Syslog tail disabled for cleaner logs - uncomment for debugging
# (sleep 2 && tail -f /var/log/syslog | grep -E "ERROR|CRIT" | ccze -A) &

CYCLE=0

# ── Supervisor loop ─────────────────────────────────────
while true; do
  CYCLE=$((CYCLE + 1))
  echo ""
  echo "══════════════════════════════════════════════════════"
  echo "  SUPERVISOR: Cycle #${CYCLE} — Scanning for hardware"
  echo "══════════════════════════════════════════════════════"

  # 1. Wait for dongle to appear (dynamic detection, checking for OpenThread to avoid J-Link/other devices)
  until DEVICE=$(for d in /dev/ttyACM*; do if [ -e "$d" ] && udevadm info --name="$d" 2>/dev/null | grep -q "OpenThread"; then echo "$d"; break; fi; done) && [ -n "$DEVICE" ]; do
    echo "STATION: Waiting for nRF52840 OpenThread device... (Plug in the dongle)"
    sleep 2
  done

  echo "STATION: Hardware detected on $DEVICE. Preparing radio..."
  export OT_RCP_DEVICE="spinel+hdlc+uart://$DEVICE"
  chmod 666 "$DEVICE"
  echo "STATION: Waiting for USB subsystem to stabilize..."
  udevadm settle --timeout=5 || sleep 3
  echo "STATION: Device ready!"

  # 2. Clean up stale state (always, idempotent)
  ip link set wpan0 down 2>/dev/null || true
  ip link delete wpan0 2>/dev/null || true

  # 3. Launch Thread Identity Manager in background
  (
    # Wait for wpan0 to be created by the agent
    until ip link show wpan0 >/dev/null 2>&1; do
      sleep 1
    done

    # Bring it up so the kernel generates the IPv6 link-local address
    ip link set wpan0 up 2>/dev/null || true

    # Wait for wpan0 to get a link-local address to avoid IPV6_JOIN_GROUP ENODEV crash
    echo "SYNC: Waiting for wpan0 interface to be ready..."
    until ip -6 addr show dev wpan0 2>/dev/null | grep -q 'fe80::'; do
      sleep 1
    done

    # Wait for agent to start (no fixed delay)
    until STATE=$(ot-ctl state 2>/dev/null) && [ -n "$STATE" ]; do 
      echo "SYNC: Waiting for Agent..."
      sleep 2
    done
    
    # Initialize Thread network if needed
    if echo "$STATE" | grep -q disabled; then
      echo "SYNC: Configuring Thread network..."
      ot-ctl dataset init new >/dev/null
      ot-ctl dataset activetimestamp ${OT_ACTIVE_TIMESTAMP} >/dev/null
      ot-ctl dataset networkname ${OT_NETWORK_NAME} >/dev/null
      ot-ctl dataset panid ${OT_PANID} >/dev/null
      ot-ctl dataset extpanid ${OT_EXTPANID} >/dev/null
      ot-ctl dataset networkkey ${OT_NETWORK_KEY} >/dev/null
      ot-ctl dataset channel ${OT_CHANNEL} >/dev/null
      ot-ctl dataset meshlocalprefix ${OT_MESH_LOCAL_PREFIX} >/dev/null
      ot-ctl dataset commit active >/dev/null
      ot-ctl ifconfig up >/dev/null
      ot-ctl thread start >/dev/null
      echo "  [OK] Thread network started"
    fi
    
    ot-ctl netdata register >/dev/null
    
    # Disable Duplicate Address Detection (DAD) so both routers can safely share the Anycast IP
    sysctl -w net.ipv6.conf.wpan0.accept_dad=0 2>/dev/null || true
    sysctl -w net.ipv6.conf.wpan0.dad_transmits=0 2>/dev/null || true
    ip -6 addr add fd5e:a726:ec55:ee12::1/64 dev wpan0 nodad 2>/dev/null || true
    
    echo "SYNC: Mesh online. State: $(ot-ctl state 2>/dev/null). Ready for sensors."
    
    # ── Thread→Gateway IPv6 bridge ──────────────────────────
    # aiocoap binds to 0.0.0.0 (IPv4 only). Thread sensors send
    # CoAP to fd5e:a726:ec55:ee12::1:5683 (pure IPv6 on wpan0).
    # socat bridges the two: listens on the specific Thread IPv6
    # address (ipv6only=1, no conflict with aiocoap's 0.0.0.0)
    # and forwards each packet to aiocoap at 127.0.0.1:5683.
    socat UDP6-LISTEN:5683,bind=[fd5e:a726:ec55:ee12::1],ipv6only=1,reuseaddr,fork UDP4:127.0.0.1:5683 &
    echo "BRIDGE: CoAP IPv6→IPv4 bridge started (PID $!)."

    # ── Topology Monitor ────────────────────────────────────
    echo "MONITOR: Starting Thread Topology Monitor script..."
    /usr/local/bin/topology_monitor.sh &
  ) &
  IDENTITY_PID=$!

  # 4. Detect Backbone Interface dynamically
  BACKBONE_IFACE=$(ip route | grep default | awk '{print $5}' | head -n1)
  if [ -z "$BACKBONE_IFACE" ]; then
    BACKBONE_IFACE=$(ip link show | grep -E "state UP|state UNKNOWN" | awk -F': ' '{print $2}' | grep -v -E "lo|docker0|wpan0" | head -n1)
  fi
  if [ -z "$BACKBONE_IFACE" ]; then
    BACKBONE_IFACE="wlo1"
  fi
  echo "STATION: Backbone interface detected as: $BACKBONE_IFACE"

  # 5. Launch otbr-agent (blocks here until it exits/crashes)
  echo "STATION: Launching OTBR Agent (Cycle #${CYCLE})..."
  # Reduced log level from -d7 to -d1 (errors + warnings only)
  # Filter out repetitive noise
  if ! /usr/sbin/otbr-agent -I wpan0 -B "$BACKBONE_IFACE" -d1 "spinel+hdlc+uart://$DEVICE" 2>&1 | \
      grep -v "ipset v6.34" | \
      grep -v "The set with the given name does not exist" | \
      grep -v "Daemon read: Connection reset by peer" | \
      grep -v "Failed to write CLI output: Broken pipe" | \
      grep -v "Firewall - failed to update ipsets"; then
    echo "⚠ SUPERVISOR: Agent exited with code $?"
  fi

  # 6. Agent exited — dongle was unplugged or fatal error
  echo ""
  echo "⚠ SUPERVISOR: Agent exited (dongle removed?). Cleaning up..."
  kill -- -$IDENTITY_PID 2>/dev/null || true
  wait $IDENTITY_PID 2>/dev/null || true

  # Brief cooldown before next cycle
  echo "SUPERVISOR: Cooldown 1s before next cycle..."
  sleep 1
done

# Made with Bob
