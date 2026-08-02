# SSNS Sensor Node (Zephyr/nRF52840)

This repository contains the firmware for the **Sensor Node** built using the Zephyr RTOS and the nRF Connect SDK (NCS v2.9.2). The node joins a local Thread mesh network, reads data from multiple physical I2C environmental sensors, and transmits telemetry to the Gateway via CoAP UDP packets.

## System Architecture

The firmware is designed with a highly robust architecture to ensure data reliability and modularity:

* **Hardware Target:** Nordic nRF52840 DK (or custom nRF52840 boards).
* **Multi-Threaded Sensor Polling:** In hardware mode, each physical sensor runs on its own independent background thread. This allows sensors with vastly different read latencies (e.g., I2C bus waits, warm-ups, or 1Hz polling requirements) to operate without blocking the main application loop or the networking stack.
* **Aggregator Cache:** The background sensor threads constantly update a central `sensor_readings` cache. The main loop simply reads from this cache at a fixed interval (e.g., 60 seconds) to build the payload, achieving non-blocking concurrency.
* **Offline NVS Queue:** If the Thread network drops, or the Gateway goes offline, the node caches unsent CoAP payloads to Non-Volatile Storage (Flash memory). Once the network reconnects, it automatically flushes the queue to ensure 0% data loss.
* **CBOR Serialization:** To minimize radio air-time and power consumption, sensor data is serialized into a highly compressed CBOR array (reducing payload size from ~200 bytes of JSON to just ~88 bytes).
* **Robust ALOC Routing:** The node routes CoAP data to the **Thread Leader Anycast Locator (ALOC)** (`fc00`), guaranteeing data delivery even if the Border Router hardware changes.

## Supported Sensors

The firmware implements robust drivers for three I2C environmental sensors. 
By default, the system requires an initial **60-second system warm-up** to ensure the wireless mesh routing is stable before sending data.

1. **Sensirion SCD41 (CO₂, Temperature, Humidity)**
   - Operates in periodic measurement mode.
   - Self-calibrating photoacoustic NDIR sensor.
2. **Sensirion SPS30 (Particulate Matter)**
   - Measures PM1.0, PM2.5, PM4.0, and PM10.
   - Continuously runs its internal fan to sample the air flow.
3. **AMS CCS811 (eCO₂, TVOC)**
   - Requires a strict **20-minute physical warm-up** every time the board powers on to reach thermal equilibrium on its MOX heater. The firmware explicitly enforces this wait time; it will output a `FAULT` state to the dashboard during these 20 minutes.
   - The driver automatically intercepts and filters the infamous `65021` (`0xFDFD`) hardware error code common during its 48-hour factory burn-in period.

*(Note: If a sensor is disconnected or damaged, the node gracefully skips it and continues broadcasting data from the remaining active sensors).*

## Execution Modes

The firmware can be compiled in two different modes to facilitate rapid UI/Backend development without needing physical hardware.

### 1. Hardware Mode (Default)
Reads from the physical I2C sensors attached to the board.

**Build Command:**
```bash
west build -p always -b nrf52840dk/nrf52840 -- -DCONFIG_SENSOR_MODE_HARDWARE=y -DEXTRA_CONF_FILE=prj_hw.conf
```

### 2. Simulation Mode
Completely disconnects the I2C bus and injects realistic, mathematically simulated environmental data (including baseline drifts and random noise spikes). Perfect for backend and frontend load-testing.

**Build Command:**
```bash
west build -p always -b nrf52840dk/nrf52840
```

## Flashing the Firmware

Plug your nRF52840 DK board into your machine via USB, and run:
```bash
west flash
```
Or, if you have multiple boards plugged in:
```bash
nrfjprog --snr <YOUR_BOARD_SNR> --program build/merged.hex --chiperase --verify -f NRF52 -r
```

## Network Credentials

The node is hardcoded to look for a specific Thread Network to ensure it doesn't accidentally join neighboring meshes.

* **Network Name:** `WSN01`
* **PAN ID:** `0x1235` (Decimal: 4661)
* **Channel:** `15`
* **Network Key:** `112233445566778899aabbccddeeff00`
