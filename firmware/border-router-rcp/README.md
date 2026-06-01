# OpenThread Border Router (RCP)

This repository contains the Radio Co-Processor (RCP) firmware used to turn an nRF52840 device into a Thread Border Router interface. 

The RCP firmware handles the low-level 802.15.4 radio operations, while the actual OpenThread Border Router (OTBR) stack runs inside a Docker container on the host machine.

## System Capabilities & Features

* **Hardware Agnostic:** Can be flashed to either an **nRF52840 DK** board or an **nRF52840 USB Dongle**. The firmware behaves identically on both.
* **macOS Docker Support:** Includes the `start_otbr_bridge.sh` script to bypass Docker Desktop's inability to natively pass-through USB devices on macOS.
* **Auto-Detecting Bridge:** The host bridging script utilizes `socat` to automatically detect the mounted `/dev/cu.usbmodemXXXX` interface of the plugged-in nRF device, and pipes its UART data via a TCP socket directly into the Docker container.
* **OpenThread Web GUI:** Exposes a web dashboard at `http://localhost:8081` for visual Thread network formation and monitoring.
* **High-Speed UART:** Communicates over UART at 1,000,000 baud with Hardware Flow Control enabled for extreme reliability and low latency.

## Hardware Support

Both boards are fully supported:
1. **nRF52840 DK** (Requires standard micro-USB cable).
2. **nRF52840 USB Dongle** (Plugs directly into USB port. Must be flashed using a Tag Connect cable or J-Link).

## Flashing the Firmware

Plug your chosen board into the Mac. If multiple boards are connected, you must specify the target board's Serial Number (SNR) using the `--snr` flag.

```bash
nrfjprog --snr <YOUR_BOARD_SNR> --program build/merged.hex --chiperase --verify -f NRF52 -r
```

## Bridging to Docker (macOS)

Because Docker on macOS cannot see USB devices, you must run the auto-detect bridge script **before** starting your Docker containers.

1. Open a terminal on your Mac.
2. Run: `./start_otbr_bridge.sh`
3. The script will auto-detect your board and wait for a connection.
4. Run `docker compose up -d` (or `docker compose restart otbr` if already running).
5. The `ssns-otbr` Docker container will connect to the bridge over TCP port 2000 and initialize the radio.

## Network Formation

> [!TIP]  
> **Fully Automated Network Formation:** The `docker-compose.yml` file is configured with an automated initialization script. If you wipe a board (e.g., using `--chiperase`) or plug in a brand new dongle, you do **not** need to manually use the Web GUI. 

Every time you run `docker compose up -d`, the OTBR container waits 10 seconds and automatically provisions the physical board with the exact `WSN01` credentials, PAN ID, and Mesh Local Prefix required by the Sensor Nodes. 

It is entirely hardware-agnostic and plug-and-play. You can hot-swap Border Routers at any time; simply restart the Docker container, and it will re-form the exact same network instantly.
