# SSNS Windows Fog Node — Industrial Native Guide

This guide explains how to set up your Windows machine as a **Native Fog Node** using standalone Docker Engine inside WSL2. This configuration provides the highest possible stability for Thread hardware.

---

## 1. Prerequisites

### Standalone Docker (No Docker Desktop)
To ensure stable hardware access, you **must disable WSL Integration** in Docker Desktop settings for this distro and install the native Docker engine:

```bash
# Run inside your WSL Ubuntu terminal
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo usermod -aG docker $USER
sudo service docker start
```

---

## 2. Hardware Passthrough (Windows Host)

WSL2 cannot see the nRF Dongle directly. You must "attach" it from the Windows side.

1.  **Open PowerShell as Administrator.**
2.  **Bind and Attach:**
    ```powershell
    usbipd list
    # Find the BUSID for "nRF52840" (e.g., 2-1)
    usbipd attach --wsl --busid <BUSID> --auto-attach
    ```
    *Note: Keep this window open. The `--auto-attach` flag ensures the dongle is handed back to Linux instantly if it is unplugged and replugged.*

---

## 3. Launching the Fog Node

### Step 1: Start the Stack
In your **WSL Ubuntu Terminal**:
```bash
cd ~/ssns-project/edge-nodes/windows-fog-node
make start
```

### Step 2: Verification
Check that the container can see the physical radio and is cycling through the supervisor loop:
```bash
make logs-radio
```
You should see: `SUPERVISOR: Cycle #1 — Scanning for hardware` followed by `STATION: Hardware detected. Preparing radio...`

---

## 4. Why this is superior:
*   **Zero Virtual Networking:** Uses `network_mode: host` for native CoAP speed and easier service discovery.
*   **Hotplug Resilience:** Uses `/dev:/dev` volume mapping and a custom Supervisor loop. If the dongle is unplugged, the container stays alive and simply waits for `usbipd` to re-attach it.
*   **Integrated CoAP Bridge:** Includes an automated `socat` bridge that translates Thread IPv6 packets to local IPv4 for the Python Gateway, ensuring 100% compatibility.
*   **Self-Healing Identity:** Automatically reinjects the `WSN01` Thread dataset if the radio loses its configuration.

---
## 5. Troubleshooting

**"Permission Denied" on /dev/ttyACM0:**
If the logs show a permission error, run this inside WSL:
```bash
sudo chmod 666 /dev/ttyACM0
```
