# SSNS Windows Fog Node — Setup & Operation Guide

This guide explains how to set up your Windows machine as an autonomous **Fog Node** within the SSNS distributed architecture. 

In this configuration, the Windows machine handles the physical radio link (OTBR), local data processing (Gateway), and local buffering (Redis), before pushing telemetry to the Central Core (Mac) via Tailscale.

---

## 1. Prerequisites

### Software Requirements
*   **Windows 10/11** with WSL2 enabled.
*   **Ubuntu (WSL2):** Installed from the Microsoft Store.
*   **Docker Desktop:** Configured to use the WSL2 backend.
*   **Tailscale:** Installed and logged in on both the Windows and Mac machines.
*   **USBIPD-WIN:** Required for USB passthrough to WSL2. [Download here](https://github.com/dorssel/usbipd-win/releases).

---

## 2. Hardware Setup (Windows Host)

Before WSL can see the nRF52840 Dongle, you must "bind" and "attach" it using PowerShell.

1.  **Open PowerShell as Administrator.**
2.  **Bind the device (First time only):**
    ```powershell
    usbipd list
    # Find the BUSID for "nRF52840" or "USB Serial Device" (e.g., 2-1)
    usbipd bind --busid <BUSID>
    ```
3.  **Attach to WSL:**
    ```powershell
    usbipd attach --wsl --busid <BUSID>
    ```
    *Note: You must keep the PowerShell window open or re-attach if you unplug the dongle.*

---

## 3. Folder Structure (WSL Ubuntu)

For the Docker build to work, the Windows machine must mirror the project structure of the Mac. The easiest way is to clone the full repository into your WSL home directory.

**Target Structure:**
```text
~/ssns-project/
├── platform/
│   └── gateway/             # (Source code for the Gateway)
└── edge-nodes/
    └── windows-otbr/        # (Where you are now)
```

---

## 4. Launching the Fog Node

Follow these steps in your **WSL Ubuntu Terminal**:

### Step 1: Fix Line Endings
If you copied files from Windows, fix the shell script line endings:
```bash
cd ~/ssns-project/edge-nodes/windows-otbr
sed -i 's/\r$//' start_otbr_bridge_windows.sh
chmod +x start_otbr_bridge_windows.sh
```

### Step 2: Start the Serial Bridge (Terminal 1)
This script bridges the USB port to a network socket that Docker can use.
```bash
./start_otbr_bridge_windows.sh
```
*Leave this running. It will say "Waiting for Docker OTBR container to connect..."*

### Step 3: Start the Fog Stack (Terminal 2)
```bash
cd ~/ssns-project/edge-nodes/windows-otbr
docker compose -f docker-compose.otbr-windows.yml up -d --build
```

---

## 5. Verification & Testing

### 1. Verify Radio Connectivity
Check the OTBR logs to ensure the mesh is active:
```bash
docker logs -f ssns-otbr-windows
```
Look for: `ot-ctl state` -> `leader` or `child`.

### 2. Verify Local Processing
Check the Gateway logs to see packets being received and queued in the local Windows Redis:
```bash
docker logs -f ssns-gateway-windows
```
Look for: `CoAP PUT queued` and `Successfully connected to Redis`.

### 3. Verify Cloud Uplink
In the same gateway logs, look for successful delivery to the Mac:
```bash
✓ Forwarded node-xxxx → 200 (OK)
```
*If you see "Connection Error", verify that the `BACKEND_URL` in the `.yml` file matches your Mac's **Tailscale IP**.*

---

## 6. Architecture Benefits (The "Why")
*   **Autonomous Edge:** If your internet/VPN goes down, the Windows node will safely store sensor data in its local Redis queue and flush it automatically once the connection returns.
*   **Distributed Range:** By using Windows as a Fog Node, you extend the physical radio coverage of your sensor network beyond the range of a single machine.
*   **Platform Independent:** Proves the SSNS Gateway tier can run on any OS that supports Docker and WSL2.
