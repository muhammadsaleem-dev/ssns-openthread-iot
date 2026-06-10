#!/bin/bash
set -e

# Install dependencies required for bridging and monitoring
apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends socat iproute2 curl jq

# Start DBUS, required by otbr-agent
service dbus start || true

# Bridge the physical serial port to a TCP socket for Docker
(while true; do socat pty,link=/dev/ttyACM0,raw,echo=0 tcp:host.docker.internal:2000,nodelay 2>/dev/null; sleep 1; done) &

# Bridge CoAP UDP traffic from Thread IPv6 to Gateway's IPv4
socat UDP6-LISTEN:5683,fork,reuseaddr UDP4:gateway:5683 &

# Wait for OTBR to be ready, then configure it
(
  until ot-ctl state 2>/dev/null; do sleep 1; done
  
  if ot-ctl state | grep -q disabled; then
    echo "  [CONFIG] Initializing new Thread dataset..."
    ot-ctl dataset init new >/dev/null
    ot-ctl dataset activetimestamp $OT_ACTIVE_TIMESTAMP >/dev/null
    ot-ctl dataset networkname $OT_NETWORK_NAME >/dev/null
    ot-ctl dataset panid $OT_PANID >/dev/null
    ot-ctl dataset extpanid $OT_EXTPANID >/dev/null
    ot-ctl dataset networkkey $OT_NETWORK_KEY >/dev/null
    ot-ctl dataset channel $OT_CHANNEL >/dev/null
    ot-ctl dataset meshlocalprefix $OT_MESH_LOCAL_PREFIX >/dev/null
    ot-ctl dataset commit active >/dev/null
    ot-ctl ifconfig up >/dev/null
    ot-ctl thread start >/dev/null
    echo "  [CONFIG] Thread protocol started."
  fi
  
  sleep 5
  ot-ctl netdata register >/dev/null
  sysctl -w net.ipv6.conf.wpan0.accept_dad=0 2>/dev/null || true
  sysctl -w net.ipv6.conf.wpan0.dad_transmits=0 2>/dev/null || true
  ip -6 addr add fd5e:a726:ec55:ee12::1/64 dev wpan0 nodad
) &

# Launch the topology monitor in the background, passing the URL as an argument
(
  echo "Waiting 15s for mesh to form before starting topology monitor..."
  sleep 15
  # Add an extra sleep for Docker for Mac to ensure volume is mounted
  sleep 2 
  echo "Executing topology monitor..."
  /usr/local/bin/topology_monitor.sh "$GATEWAY_BACKEND_URL"
) &

# Wait for the serial bridge to be created before starting the main process
until [ -e /dev/ttyACM0 ]; do 
  echo 'Waiting for serial bridge device /dev/ttyACM0...'
  sleep 1
done
sleep 2

# Execute the main OTBR entrypoint
echo "Starting main OTBR /init process..."
exec /init
