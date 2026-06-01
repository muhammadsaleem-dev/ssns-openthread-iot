# SSNS Sensor Node (Zephyr/nRF52840)

This repository contains the firmware for the **Sensor Node** built using the Zephyr RTOS and the nRF Connect SDK (NCS v2.9.2). The sensor node joins a local Thread mesh network and securely transmits environmental telemetry to the Border Router via CoAP UDP packets.

## System Capabilities & Features

* **Hardware Target:** Nordic nRF52840 DK (or custom nRF52840 boards).
* **Thread Networking:** Fully utilizes the OpenThread stack. Connects to a Border Router using a secure, pre-shared Network Key and PAN ID.
* **Robust ALOC Routing:** Instead of hardcoding a Border Router's dynamically generated Mesh-Local IPv6 address, this firmware routes CoAP data to the **Thread Leader Anycast Locator (ALOC)** (`fc00`). This guarantees data delivery even if the Border Router hardware is physically swapped (e.g., from Dongle to DK).
* **CoAP Telemetry:** Packages sensor data into a compressed JSON payload and transmits it to the Gateway via `PUT` requests over CoAP port `5683`.
* **Sensor Abstraction:** Features a clean abstraction layer in `main.c`. Currently runs a sophisticated telemetry simulator (with baseline drifts and randomized anomaly spikes for CO2/PM2.5) to mimic real environmental changes. Can be easily swapped for real I2C/SPI sensor drivers without touching the networking logic.
* **Hardware MAC Node IDs:** Automatically generates a permanent `Node ID` (e.g., `node-598c`) derived from the factory-burned EUI-64 MAC address in the nRF52840 silicon, ensuring absolute uniqueness across the network.

## Build Instructions

To compile the firmware, make sure your NCS v2.9.2 toolchain is active, then run:

```bash
export PATH="/opt/nordic/ncs/toolchains/b8efef2ad5/bin:$PATH"
export ZEPHYR_BASE=/opt/nordic/ncs/v2.9.2/zephyr
west build -p always -b nrf52840dk/nrf52840
```

## Flashing the Firmware

Plug your nRF52840 DK board into your machine via USB.

If you have multiple boards plugged in at the same time, you must specify the target board's Serial Number (SNR) using the `--snr` flag.

```bash
nrfjprog --snr <YOUR_BOARD_SNR> --program build/merged.hex --chiperase --verify -f NRF52 -r
```

*(Note: The `--chiperase` flag is recommended to ensure no stale networking credentials interfere with the new boot.)*

## Network Credentials

The node is hardcoded to look for a specific Thread Network to ensure it doesn't accidentally join neighboring meshes.

* **Network Name:** `WSN01`
* **PAN ID:** `0x1235` (Decimal: 4661)
* **Channel:** `15`
* **Network Key:** `112233445566778899aabbccddeeff00`

Ensure your OpenThread Border Router is configured with these exact matching credentials, or the sensor node will ignore it.
