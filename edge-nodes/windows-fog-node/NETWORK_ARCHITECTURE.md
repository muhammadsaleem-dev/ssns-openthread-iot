# Network Architecture & IP Settings (Presentation Reference)

*Architecture overview of IPv6 and IPv4 interactions within the sensor network and edge node infrastructure.*

## 1. The Thread Mesh Network (Pure IPv6)
OpenThread uses pure IPv6 for all communication between the sensor nodes and the Border Router (OTBR).
*   **Mesh-Local Prefix:** The network uses the IPv6 prefix `fd5e:a726:ec55:ee12::/64`. This acts as the private subnet for the wireless sensor nodes.
*   **Sensor Node IPs:** Every sensor node automatically generates its own unique IPv6 address within that prefix using SLAAC (Stateless Address Autoconfiguration). They do not need a DHCP server.
*   **OTBR IP:** The OpenThread Border Router (the `wpan0` interface) assigns itself the primary gateway address of **`fd5e:a726:ec55:ee12::1`**.

## 2. How Sensors Send Data (CoAP over UDP)
*   The sensor nodes send their data via **CoAP (Constrained Application Protocol)**.
*   Instead of broadcasting blindly, they send UDP packets directly to the OTBR's specific IPv6 address on port 5683: `[fd5e:a726:ec55:ee12::1]:5683`.

## 3. The Protocol Translation Bridge (IPv6 → IPv4)
*Bridging mechanism between IPv4 and IPv6 components:*
*   Inside the OTBR Docker container, there is a **`socat` bridge** running.
*   It listens on the Thread IPv6 address (`[fd5e:a726:ec55:ee12::1]:5683`) for incoming CoAP packets.
*   When a packet arrives from a sensor, `socat` instantly forwards it to the local Gateway on IPv4 (`127.0.0.1:5683`). This bridges the gap between the pure IPv6 Thread network and the local IPv4 Docker host network without requiring complex NAT64 kernel modules.

## 4. The Gateway to Backend (HTTP over IPv4/Tailscale)
*   The Python Gateway receives the bridged CoAP payload locally on `127.0.0.1`.
*   It extracts the sensor data (temperature, humidity, etc.), packages it into a JSON format, and sends it out over standard IPv4 HTTP.
*   The data is sent securely to the Central Cloud/Backend over the Tailscale VPN IP (`100.98.119.40:8080`).

## 5. Design Decision: Why Bridge to IPv4?
*The architectural decision to bridge to IPv4 rather than using native IPv6 routing to the cloud is based on the following factors:*
*   **Docker & WSL2 Limitations:** Native IPv6 networking inside Docker (especially on Windows/WSL2) is notoriously difficult to configure and often fails to route external packets correctly. Bridging to IPv4 locally bypasses these complex Docker IPv6 routing headaches.
*   **Cloud Infrastructure & VPNs:** Most university networks, public Wi-Fi, and standard cloud APIs are still heavily reliant on IPv4. Tailscale handles IPv4 routing flawlessly out-of-the-box.
*   **Simplicity & Reliability:** By translating Thread's pure IPv6 to standard local IPv4 *as early as possible* (using `socat`), the rest of the software stack (Python, HTTP requests, Docker networking) can use standard, battle-tested IPv4 configurations.

## 6. Where is this configured in the code?
*The IP and prefix settings are defined in the following files:*

**1. Sensor Node Firmware (C Code)**
The sensor nodes are hardcoded to send their CoAP packets to the Gateway's specific IPv6 address.
*   **File:** `firmware/sensor-node/src/network.c`
*   **Code:** `#define GATEWAY_IPV6_ADDR "fd5e:a726:ec55:ee12::1"`

**2. Windows Fog Node (Docker Setup)**
The Windows Border Router is forced to build the mesh using this prefix so that it matches the sensors.
*   **File:** `edge-nodes/windows-fog-node/docker-compose.fog.yml`
*   **Code:** `ot-ctl dataset meshlocalprefix fd5e:a726:ec55:ee12::`

**3. Mac Fog Node (Docker Setup)**
The Mac node uses the exact same prefix so it can seamlessly take over the network if the Windows node goes down.
*   **File:** `edge-nodes/mac-fog-node/docker-compose.fog.yml`
*   **Code:** `ot-ctl dataset meshlocalprefix fd5e:a726:ec55:ee12::`
