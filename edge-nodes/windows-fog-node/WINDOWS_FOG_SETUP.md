# SSNS Windows Fog Node — Setup & Operation Guide

This guide explains how to set up your Windows machine as an autonomous **Fog Node** within the SSNS distributed architecture. 

In this configuration, the Windows machine handles the physical radio link (OTBR), local data processing (Gateway), and local buffering (Redis), before pushing telemetry to the Central Core (Mac) via Tailscale.

---

## 1. Prerequisites

### Software Requirements
*   **Windows 10/11** with WSL2 enabled.
*   **Ubuntu (WSL2):** Installed from the Microsoft Store.
*   **Docker Engine (Native):** Installed directly inside your WSL Ubuntu terminal (do *not* use Docker Desktop for Windows as it restricts raw hardware access).
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

### ⚡ Self-Healing USB (Highly Recommended)
To prevent the OTBR from crashing if the dongle is bumped or power-flickers, keep this command running in a dedicated **PowerShell** window:

```powershell
# Automatically re-attaches the dongle whenever it is detected
# Replace '1-2' with your actual BUSID if it changes
usbipd attach --wsl --busid 1-2 --auto-attach
```
Using `--auto-attach` ensures that your Fog Node is self-healing at the physical hardware layer. Once running, you can unplug and replug the dongle, and Windows will instantly hand it back to WSL.

---

## 3. Folder Structure (WSL Ubuntu)

For the Docker build to work, the Windows machine must mirror the project structure of the Mac. The easiest way is to clone the full repository into your WSL home directory.

**Target Structure:**
```text
~/ssns-project/
├── platform/
│   └── gateway/             # (Source code for the Gateway)
└── edge-nodes/
    └── windows-fog-node/    # (Where you are now)
```

---

## 4. Launching the Fog Node

Follow these steps in your **WSL Ubuntu Terminal**:

### Step 1: Start the Fog Stack
Because we have integrated a self-healing hardware supervisor directly into the Docker Compose file, starting the node is incredibly simple. You no longer need to run any external serial bridge scripts!

```bash
cd ~/ssns-project/edge-nodes/windows-fog-node
make restart
```
This single command spins up the OTBR Radio, the persistent Redis cache, and the CoAP Gateway.

---

## 5. Verification & Testing

### 1. Verify Radio Connectivity
Check the OTBR logs to ensure the mesh is active and the USB dongle was detected:
```bash
make logs-radio
```
Look for: `STATION: Hardware detected. Preparing radio...` and `SYNC: Mesh online. Ready for sensors.`

### 2. Verify Local Processing
Check the Gateway logs to see packets being received and pushed to the cloud:
```bash
make logs
```
Look for beautifully colorized logs like:
`✓ Forwarded [node-xxxx] temp=24.5°C ... → 201 (X total OK)`

*If you unplug the dongle, the system will automatically pause. Once you plug it back in, it will instantly self-heal and reconnect without needing a restart!*

---

## 6. Troubleshooting & Stable Reset

Because the architecture now uses direct `/dev/ttyACM0` hardware passthrough and a built-in supervisor loop, manual restarts are rarely needed.

If the radio completely hangs or you need to wipe the Docker state, follow this sequence:

1.  **Stop Docker Containers & Wipe Ephemeral State:**
    ```bash
    make stop
    ```
2.  **Physical Reset:** Unplug the USB dongle and plug it back in (ensure `usbipd` re-attaches).
3.  **Restart Docker:** 
    ```bash
    make restart
    ```
*Note: Any unsent packets stored in the persistent Redis cache will instantly be forwarded when the Gateway boots back up.*

---

## 7. Architecture Benefits (The "Why")
*   **Autonomous Edge:** If your internet/VPN goes down, the Windows node will safely store sensor data in its local Redis queue and flush it automatically once the connection returns.
*   **Distributed Range:** By using Windows as a Fog Node, you extend the physical radio coverage of your sensor network beyond the range of a single machine.
*   **Platform Independent:** Proves the SSNS Gateway tier can run on any OS that supports Docker and WSL2.
