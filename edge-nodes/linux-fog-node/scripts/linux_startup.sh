#!/bin/bash
# ============================================================
# SSNS OTBR — Self-Healing Supervisor for Native Linux
# Survives dongle unplug/replug without container restart.
# ============================================================

# ── One-time system initialization ──────────────────────
rm -f /var/run/dbus/pid
service dbus start
service rsyslog start
(sleep 2 && tail -f /var/log/syslog | ccze -A) &
# (socat bridge is started after mesh IPv6 address is ready — see identity subshell below)

CYCLE=0

# ── Supervisor loop ─────────────────────────────────────
while true; do
  CYCLE=$((CYCLE + 1))
  echo ""
  echo "══════════════════════════════════════════════════════"
  echo "  SUPERVISOR: Cycle #${CYCLE} — Scanning for hardware"
  echo "══════════════════════════════════════════════════════"

  # 1. Wait for dongle to appear
  until [ -e /dev/ttyACM0 ]; do
    echo "STATION: Waiting for nRF52840 on /dev/ttyACM0... (Plug in the dongle)"
    sleep 2
  done

  echo "STATION: Hardware detected. Preparing radio..."
  chmod 666 /dev/ttyACM0
  sleep 1

  # 2. Clean up stale state from previous cycle
  if [ $CYCLE -gt 1 ]; then
    echo "CLEANUP: Tearing down stale wpan0 from previous session..."
    ip link set wpan0 down 2>/dev/null || true
    ip link delete wpan0 2>/dev/null || true
    sleep 2
  fi

  # 3. Launch Thread Identity Manager in background
  (
    sleep 5
    until ot-ctl state 2>/dev/null; do echo "SYNC: Waiting for Agent..."; sleep 2; done
    if ot-ctl state 2>/dev/null | grep -q disabled; then
      echo "SYNC: Initializing WSN01 Mesh Identity..."
      ot-ctl dataset init new >/dev/null && echo "  [OK] Initialized new dataset"
      ot-ctl dataset activetimestamp ${OT_ACTIVE_TIMESTAMP} >/dev/null && echo "  [OK] Set Active Timestamp (${OT_ACTIVE_TIMESTAMP})"
      ot-ctl dataset networkname ${OT_NETWORK_NAME} >/dev/null && echo "  [OK] Set Network Name (${OT_NETWORK_NAME})"
      ot-ctl dataset panid ${OT_PANID} >/dev/null && echo "  [OK] Set PAN ID (${OT_PANID})"
      ot-ctl dataset extpanid ${OT_EXTPANID} >/dev/null && echo "  [OK] Set Extended PAN ID"
      ot-ctl dataset networkkey ${OT_NETWORK_KEY} >/dev/null && echo "  [OK] Set Network Key"
      ot-ctl dataset channel ${OT_CHANNEL} >/dev/null && echo "  [OK] Set Channel (${OT_CHANNEL})"
      ot-ctl dataset meshlocalprefix ${OT_MESH_LOCAL_PREFIX} >/dev/null && echo "  [OK] Set Mesh Local Prefix"
      ot-ctl dataset commit active >/dev/null && echo "  [OK] Committed dataset"
      ot-ctl ifconfig up >/dev/null && echo "  [OK] Interface wpan0 UP"
      ot-ctl thread start >/dev/null && echo "  [OK] Thread protocol STARTED"
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
  /usr/sbin/otbr-agent -I wpan0 -B "$BACKBONE_IFACE" -d7 "spinel+hdlc+uart:///dev/ttyACM0" || true

  # 5. Agent exited — dongle was unplugged or fatal error
  echo ""
  echo "⚠ SUPERVISOR: Agent exited (dongle removed?). Cleaning up..."
  kill $IDENTITY_PID 2>/dev/null || true
  wait $IDENTITY_PID 2>/dev/null || true

  # Brief cooldown before next cycle
  echo "SUPERVISOR: Cooldown 3s before next cycle..."
  sleep 3
done

# Made with Bob
