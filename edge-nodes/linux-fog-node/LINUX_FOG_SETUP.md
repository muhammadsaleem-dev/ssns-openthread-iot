# SSNS Native Linux Fog Node — Setup & Operation Guide

This guide explains how to set up your Deepin/Ubuntu Linux machine as an autonomous **Fog Node** within the SSNS distributed architecture. 

In this native configuration, the Linux machine handles the physical radio link (OTBR) directly via USB, local data processing (Gateway), and local buffering (Redis), before pushing telemetry to the Central Core via Tailscale.

---

## 1. Prerequisites

### Software Requirements
*   **Deepin or Ubuntu Linux** (Native Bare Metal)
*   **Docker Engine:** Installed natively via `apt-get install docker.io docker-compose-v2`
*   **Tailscale:** Installed natively via `curl -fsSL https://tailscale.com/install.sh | sh`
*   *(No usbipd or virtual machines required!)*

---

## 2. Hardware Setup

Because we are running on native Linux, the kernel has direct raw access to the USB serial ports. No binding or attaching is necessary!

1.  Plug your **nRF52840 Dongle** into the laptop's USB port.
2.  The kernel will automatically assign it to `/dev/ttyACM0`.

---

## 3. Folder Structure

Clone the full repository into your Linux home directory.

**Target Structure:**
```text
~/Projects/ssns-project/
├── platform/
│   └── gateway/             # (Source code for the Gateway)
└── edge-nodes/
    └── linux-fog-node/      # (Where you are now)
```

---

## 4. Launching the Fog Node

Follow these steps in your Linux Terminal:

### Step 1: Start the Fog Stack
Because we have integrated a self-healing hardware supervisor directly into the Docker Compose file, starting the node is incredibly simple. 

```bash
cd ~/Projects/ssns-project/edge-nodes/linux-fog-node
sudo make start-linux-fog
```
This single command spins up the OTBR Radio, the persistent Redis cache, and the CoAP Gateway.

---

## 5. Verification & Testing

### 1. Verify Radio Connectivity
Check the OTBR logs to ensure the mesh is active and the USB dongle was detected:
```bash
sudo make logs-linux-fog
```
Look for: `STATION: Hardware detected. Preparing radio...` and `SYNC: Mesh online. Ready for sensors.`

### 2. Verify Local Processing
Check the Gateway logs to see packets being received and pushed to the cloud:
```bash
sudo docker logs -f ssns-gateway-linux
```
Look for beautifully colorized logs like:
`✓ Forwarded [node-xxxx] temp=24.5°C ... → 201 (X total OK)`

*If you unplug the dongle, the system will automatically pause. Once you plug it back in, it will instantly self-heal and reconnect without needing a restart!*

---

## 6. Troubleshooting & Stable Reset

Because the architecture uses direct `/dev/ttyACM0` hardware passthrough and a built-in supervisor loop, manual restarts are rarely needed.

If the radio completely hangs or you need to wipe the Docker state, follow this sequence:

1.  **Stop Docker Containers:**
    ```bash
    sudo make stop-linux-fog
    ```
2.  **Physical Reset:** Unplug the USB dongle and plug it back in.
3.  **Restart Docker:** 
    ```bash
    sudo make start-linux-fog
    ```
*Note: Any unsent packets stored in the persistent Redis cache will instantly be forwarded when the Gateway boots back up.*

---

## 7. Architecture Benefits (The "Why")
*   **Autonomous Edge:** If your internet/VPN goes down, the Linux node will safely store sensor data in its local Redis queue and flush it automatically once the connection returns.
*   **Bare-Metal Performance:** By running directly on Linux, we bypass the immense complexity and fragility of Windows WSL2 USB-over-IP networking.
*   **Platform Independent:** Proves the SSNS Gateway tier can run on any OS that supports Docker.
