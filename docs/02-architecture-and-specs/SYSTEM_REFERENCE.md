# SSNS System Reference Document

**Project**: Smart Sensor Node System (SSNS)  
**Document Version**: 2.0  
**Date**: 2026-06-18  
**Scope**: Edge Node Firmware · Fog Nodes · CoAP Server · Thread Protocol · Mesh Networking

---

## Executive Summary

The **Smart Sensor Node System (SSNS)** is a production IoT monitoring platform that collects environmental data (CO₂, temperature, humidity, particulate matter, and TVOC) from wireless sensor nodes and streams it through a multi-hop mesh network to a cloud backend.

### What the System Does

Environmental sensor nodes built on the **Nordic nRF52840** microcontroller run **Zephyr RTOS** firmware. They read from three I²C sensors (Sensirion SCD41, AMS CCS811, Sensirion SPS30), batch the readings every 30 seconds, encode them into compact **CBOR** (binary JSON), and transmit them over a **Thread mesh network** using the **CoAP** protocol. The data arrives at a **fog node** — a standard laptop or server running Docker — which hosts an **OpenThread Border Router (OTBR)**, a **Python CoAP server**, and a **Redis queue**. From there, readings are forwarded as JSON to a **Spring Boot REST API** backed by a cloud database.

### Key Design Decisions at a Glance

| Decision | What was chosen | Why |
|----------|----------------|-----|
| Radio protocol | IEEE 802.15.4 via OpenThread | Self-healing mesh, native IPv6, no hub needed |
| Application protocol | CoAP over UDP | 4-byte header, designed for constrained devices |
| Payload encoding | CBOR (zcbor) | ~56% smaller than JSON, no string parsing overhead |
| Batching strategy | 5 samples per CoAP packet | Reduces radio duty cycle and ACK overhead by 5× |
| Offline resilience | 50-slot RAM queue on device | Survives fog node outages without data loss |
| High availability | Shared anycast IP + DAD bypass | Multiple fog nodes are plug-and-play, no firmware change needed |
| Node identity | EUI-64 MAC → node-id + random boot-id | Stable ID across reboots, deduplication via Redis SETNX |
| IPv6–IPv4 bridge | socat (Mac) / native host routing (Linux) | Works around Docker Desktop IPv6 limitations |
| Topology visibility | Topology monitor → `/api/network/topology` | Real-time network health visible in dashboard |

### How It Fits Together (One-Paragraph Flow)

A sensor node powers on, injects its Thread dataset programmatically, waits 60 seconds for sensors to warm up, then enters a loop: every 6 seconds it samples all sensors, and every 30 seconds it CBOR-encodes a batch of 5 readings and sends a single **CoAP Confirmable PUT** to the gateway address `fd5e:a726:ec55:ee12::1:5683` over the Thread mesh. The fog node's OTBR receives the radio frame, passes it to the Python CoAP server (directly on Linux, or via a socat bridge on Mac), which decodes the CBOR, deduplicates using Redis, and enqueues a JSON object. A worker thread pops from the queue and HTTP-POSTs to the Spring Boot API. If no ACK arrives within 5 seconds, the firmware saves the packet to a 50-slot RAM queue and retries. After 3 consecutive failures, the Thread stack is reset to force re-attachment to a backup fog node.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Thread Mesh Network](#2-thread-mesh-network)
3. [Thread Concepts: What Is Used and Why](#3-thread-concepts-what-is-used-and-why)
4. [Sensor Node Firmware](#4-sensor-node-firmware)
5. [CoAP Protocol & Server](#5-coap-protocol--server)
6. [Fog Nodes](#6-fog-nodes)
7. [End-to-End Data Flow](#7-end-to-end-data-flow)
8. [High Availability & Failover](#8-high-availability--failover)
9. [Configuration Reference](#9-configuration-reference)

---

## 1. System Overview

SSNS is a wireless environmental monitoring system built on the **IEEE 802.15.4 / OpenThread** stack. Sensor nodes measure air quality, particulate matter, CO₂, temperature, and humidity, then transmit that data over a Thread mesh to a fog node running on a local machine (Mac or Linux). The fog node parses the payload and forwards it to a cloud backend for persistence and visualization.

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         SSNS System Architecture                            │
│                                                                              │
│  ┌──────────────┐   Thread (IEEE 802.15.4)    ┌───────────────────────────┐ │
│  │  nRF52840    │ ──────── CoAP/UDP ─────────▶│  Fog Node (Mac / Linux)   │ │
│  │ Sensor Node  │       IPv6 Mesh             │  ┌─────────────────────┐  │ │
│  │              │                             │  │  OTBR (OpenThread   │  │ │
│  │ • SCD41      │                             │  │  Border Router)     │  │ │
│  │ • CCS811     │                             │  ├─────────────────────┤  │ │
│  │ • SPS30      │                             │  │  Python CoAP Server │  │ │
│  │ • Zephyr     │                             │  ├─────────────────────┤  │ │
│  │   RTOS       │                             │  │  Redis Queue Buffer │  │ │
│  └──────────────┘                             │  └─────────────────────┘  │ │
│                                               └────────────┬──────────────┘ │
│                                                            │ HTTP/JSON       │
│                                                            ▼                 │
│                                               ┌───────────────────────────┐ │
│                                               │  Spring Boot Backend API  │ │
│                                               │  (Cloud / VPS / Tailscale)│ │
│                                               └───────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

### Key Technology Choices

| Layer | Technology | Reason |
|-------|-----------|--------|
| Radio | IEEE 802.15.4 (nRF52840 radio) | Low-power, mesh-capable |
| Network | OpenThread (IPv6) | Self-healing mesh, no router needed |
| Transport | UDP | Low-overhead, CoAP native |
| Application | CoAP | Designed for constrained IoT devices |
| Encoding | CBOR (via zcbor) | ~56% smaller than JSON |
| OS | Zephyr RTOS | Hardware-portable, Kconfig build system |
| Fog Gateway | Python / aiocoap | Async, event-driven CoAP handling |
| Buffer | Redis | Durable in-flight deduplication queue |
| Backend | Spring Boot | REST API for data persistence |

---

## 2. Thread Mesh Network

### 2.1 What is Thread?

Thread is an IPv6-based mesh networking protocol designed for low-power IoT devices. It runs on top of the IEEE 802.15.4 radio standard and provides:

- **Self-healing mesh** — packets route around failed nodes automatically
- **No single point of failure** — any Router-capable node can forward traffic
- **Native IPv6** — every device gets a unique global-scope or mesh-local address
- **No hub required** — the Border Router is optional for internal traffic

### 2.2 Network Dataset (Identity Configuration)

Every Thread device must share an identical **Operational Dataset** to join the same network. This is analogous to a Wi-Fi SSID + password, but with more parameters.

The SSNS network dataset is **hardcoded** in the firmware and set identically in every fog node's `.env` file:

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `OT_NETWORK_NAME` | `WSN01` | Human-readable network name |
| `OT_CHANNEL` | `26` | IEEE 802.15.4 radio channel (2480 MHz) |
| `OT_PANID` | `0x1235` | 16-bit Personal Area Network ID |
| `OT_EXTPANID` | `1111111122222222` | 64-bit extended PAN identifier |
| `OT_NETWORK_KEY` | `112233445566778899aabbccddeeff00` | 128-bit AES network encryption key |
| `OT_MESH_LOCAL_PREFIX` | `fd5e:a726:ec55:ee12::/64` | ULA prefix for all mesh-local addresses |
| `OT_ACTIVE_TIMESTAMP` | `2000000000` | Forces this dataset to win over any stale flash data |

> **Why the high Active Timestamp?** If a sensor node was previously on a different network, its flash memory may contain an older dataset. OpenThread always prefers the dataset with the higher timestamp. Setting `mActiveTimestamp.mSeconds = 2000000000` (approximately year 2033) ensures our injected dataset always wins, regardless of what is stored in flash.

### 2.3 Dataset Injection in Firmware

Rather than relying on Kconfig static values (which can be overridden by NVS/Settings), the firmware uses a **programmatic dataset injection** approach via the OpenThread API:

```c
// network.c — force_thread_dataset()
otOperationalDataset dataset;
memset(&dataset, 0, sizeof(otOperationalDataset));

// Bump timestamp to year 2033 to force OpenThread to accept this
// dataset over any old flash data
dataset.mActiveTimestamp.mSeconds       = 2000000000;
dataset.mActiveTimestamp.mAuthoritative = true;

dataset.mChannel = 26;
dataset.mPanId   = 0x1235;

uint8_t mlp[8] = {0xfd,0x5e,0xa7,0x26,0xec,0x55,0xee,0x12};
memcpy(dataset.mMeshLocalPrefix.m8, mlp, 8);

otDatasetSetActive(instance, &dataset);
otIp6SetEnabled(instance, true);
otThreadSetEnabled(instance, true);

// Shorten child timeout to 60 seconds for faster failover detection
otThreadSetChildTimeout(instance, 60);
```

The `otThreadSetChildTimeout(instance, 60)` call is critical — it controls how quickly the Border Router declares a child (sensor node) as disconnected. Reducing it from the default 240 seconds to 60 seconds enables fast failover to a backup fog node.

### 2.4 Device Roles

In a Thread network, nodes operate in different roles:

| Role | Description | In SSNS |
|------|-------------|---------|
| **Leader** | Manages the network topology database | Elected automatically among routers |
| **Router** | Forwards traffic between nodes | OTBR becomes a full Router |
| **End Device (Child)** | Sends/receives data, does not route | nRF52840 sensor nodes |
| **Border Router** | Connects Thread to external IP networks | OpenThread Border Router (OTBR) in Docker |

### 2.5 IPv6 Address Types

Each sensor node generates multiple IPv6 addresses:

| Type | Example | Usage |
|------|---------|-------|
| Mesh-Local EID | `fd5e:a726:ec55:ee12::xxxx:xxxx` | Used for internal mesh communication |
| Link-Local | `fe80::xxxx:xxxx:xxxx:xxxx` | Neighbor discovery only |
| RLOC | `fd5e:a726:ec55:ee12:0:ff:fexx:xx00` | Routing Locator (changes on re-attachment) |

The OTBR's `wpan0` interface takes the **anycast gateway address** `fd5e:a726:ec55:ee12::1`, which is the hardcoded target for all sensor CoAP transmissions.

### 2.6 Node Identity (MAC-Derived)

Each sensor node derives a stable identity from its IEEE EUI-64 factory-programmed MAC address:

```c
// network.c — resolve_node_id()
otLinkGetFactoryAssignedIeeeEui64(instance, &ext);
snprintf(node_id, sizeof(node_id), "node-%02x%02x", ext.m8[6], ext.m8[7]);
// Example: "node-598c"
```

A **boot ID** (random 8-character hex) is also generated at startup:

```c
// network.c — resolve_boot_id()
uint32_t r = sys_rand32_get();
snprintf(boot_id, sizeof(boot_id), "%08x", r);
// Example: "a3f2b1c0"
```

The `(node_id, boot_id, seq_num)` triple is used for **distributed deduplication** in the gateway's Redis store.

---

## 3. Thread Concepts: What Is Used and Why

This section explains every major Thread / mesh networking concept — what it is, whether SSNS uses it, and why that decision was made.

---

### 3.1 Commissioning

**What it is:**  
Commissioning is the secure on-boarding process by which a new device joins a Thread network for the first time. Thread defines two commissioning models:

- **External Commissioner**: A separate device (phone, PC) communicates with a Commissioner running inside the mesh to approve a new Joiner device. The Joiner presents a device-specific PSKd (Pre-Shared Key for the Device). The Commissioner signs a certificate and delivers the network credentials to the Joiner.
- **On-Mesh Commissioner**: The Border Router itself acts as the commissioner.

The Commissioner uses the **DTLS** (Datagram TLS) handshake over a temporary joining port (UDP/1000). Once authenticated, the Joiner receives the Network Key and joins the Thread partition.

**What SSNS uses:**  
⛔ **Commissioning is not used in SSNS.**

**Why:**  
SSNS uses **pre-shared dataset provisioning** instead. The Network Key, channel, PAN ID, and mesh prefix are hardcoded into the sensor firmware (`force_thread_dataset()` in `network.c`) and identically configured in every fog node's `.env` file. This is intentional for a closed, controlled deployment where all nodes belong to the same operator. Commissioning is designed for consumer products where devices arrive from a factory and are on-boarded one by one by an end user. In SSNS, all devices are owned and flashed by the same developer, making commissioning unnecessary overhead.

> **Trade-off**: Skipping commissioning means any device that knows the hardcoded Network Key can join. This is acceptable for a research/lab deployment but would need revisiting in a commercial product.

---

### 3.2 Network Key (formerly Master Key)

**What it is:**  
A 128-bit AES key shared by all devices on the Thread network. It is used to encrypt and authenticate all Thread MLE (Mesh Link Establishment) and MAC-layer traffic. Without this key, a device cannot decode any mesh packet.

**What SSNS uses:**  
✅ **Used.** The Network Key is `112233445566778899aabbccddeeff00`.

**Where it is configured:**
- **Firmware** (`network.c`): Injected via `otDatasetSetActive()` with the key hardcoded as a `uint8_t` array.
- **Fog nodes** (`.env`): `OT_NETWORK_KEY=112233445566778899aabbccddeeff00` — set via `ot-ctl dataset networkkey` in the startup scripts.

All nodes must share this exact key or they cannot join the mesh.

---

### 3.3 PSKc (Pre-Shared Key for the Commissioner)

**What it is:**  
PSKc is a 128-bit key derived from the network passphrase. It authenticates the Commissioner to the Thread network — specifically used during the DTLS Commissioner Session. It is different from the Network Key.

**What SSNS uses:**  
⚠️ **Present in `.env` but not actively used.**

```bash
OT_PSKC=11223344556677881122334455667788
```

The PSKc is set in the dataset during OTBR startup via `ot-ctl dataset pskc`. It is included to form a complete and valid Operational Dataset, but since SSNS does not run an external Commissioner, this value is never used for authentication. It acts as a placeholder to prevent the OTBR from generating a random PSKc on each start, which would make the dataset inconsistent.

---

### 3.4 PANID and Extended PANID

**What it is:**  
- **PANID** (16-bit): A short identifier for the network used in IEEE 802.15.4 MAC-layer frame filtering. Devices only receive frames with matching PAN IDs.
- **Extended PANID** (64-bit): A globally unique identifier for the Thread partition. Prevents two networks with the same short PANID from accidentally merging.

**What SSNS uses:**  
✅ **Both used.**
- `OT_PANID=0x1235`
- `OT_EXTPANID=1111111122222222`

Devices will only communicate within this PAN. Neighboring 802.15.4 devices (Zigbee networks, other Thread deployments) with different PANIDs are automatically ignored at the radio layer.

---

### 3.5 Channel

**What it is:**  
IEEE 802.15.4 defines 16 channels in the 2.4 GHz band (channels 11–26). Each channel is 5 MHz wide. Devices must be on the same channel to communicate.

**What SSNS uses:**  
✅ **Channel 26 is used.**

```bash
OT_CHANNEL=26   # 2480 MHz
```

Channel 26 was chosen because it has the least overlap with 2.4 GHz Wi-Fi (channels 1, 6, and 11 are the most commonly used Wi-Fi channels, concentrated between 2401–2472 MHz). Channel 26 at 2480 MHz sits above Wi-Fi channel 13 and experiences minimal interference in most environments.

> **Note**: `prj.conf` specifies `CONFIG_OPENTHREAD_CHANNEL=15` as a Kconfig default, but `force_thread_dataset()` in `network.c` always overrides this to channel 26 at runtime.

---

### 3.6 Mesh-Local Prefix (ULA)

**What it is:**  
A `/64` IPv6 prefix used by Thread to assign mesh-local addresses to all devices. These addresses are only routable within the Thread partition — they cannot be routed over the public internet.

Thread requires this prefix to start with `fd` (Unique Local Address, RFC 4193) to signal it is a private, non-routable prefix.

**What SSNS uses:**  
✅ **`fd5e:a726:ec55:ee12::/64` is used.**

- Sensor nodes auto-generate their mesh-local EID within this prefix using SLAAC (Stateless Address Autoconfiguration) from their IEEE EUI-64.
- The OTBR `wpan0` interface is assigned `fd5e:a726:ec55:ee12::1` — the hardcoded gateway target.
- The firmware uses `#define GATEWAY_IPV6_ADDR "fd5e:a726:ec55:ee12::1"` in `network.c`.

---

### 3.7 SLAAC (Stateless Address Autoconfiguration)

**What it is:**  
SLAAC is an IPv6 mechanism (RFC 4862) that allows a device to generate its own IPv6 address from a network prefix without needing a DHCP server. The device takes the `/64` prefix from the network and appends a 64-bit Interface Identifier (usually derived from its MAC EUI-64).

**What SSNS uses:**  
✅ **Used implicitly.** Thread's OpenThread stack performs SLAAC automatically when the mesh-local prefix is configured. Every sensor node generates a unique `fd5e:a726:ec55:ee12::xxxx:xxxx:xxxx:xxxx` address without any manual configuration.

This is why SSNS does not need a DHCP server — every node's address is deterministically derived from its hardware MAC address.

---

### 3.8 Routing Locator (RLOC) and RLOC16

**What it is:**  
The RLOC is a short, topology-derived IPv6 address used internally by OpenThread for routing. It encodes the Router ID and Child ID into a 16-bit value called RLOC16:

```
RLOC16 = (Router ID << 10) | Child ID
```

RLOCs change every time a node re-attaches to the network (e.g., after failover). They are purely internal routing addresses.

**What SSNS uses:**  
✅ **Used internally.** The RLOC16 is read by the topology monitor (`ot-ctl rloc16`) and reported to the backend dashboard:

```bash
# topology_monitor.sh
RLOC16=$(ot-ctl rloc16 | grep -v 'Done' | tr -d '\r')
```

This is used to display the Border Router's current position in the mesh topology on the dashboard. The sensor firmware does **not** use RLOC16 directly; it only uses the stable mesh-local EID for data transmission.

---

### 3.9 Network Data and `netdata register`

**What it is:**  
Thread **Network Data** is a distributed database replicated to all nodes in the mesh. It contains information like:
- On-mesh prefixes (which prefixes are reachable inside the mesh)
- External routes (which prefixes are reachable via the Border Router)
- Service data (DNS-SD service discovery records)

The **Leader** distributes Network Data to all devices after a Border Router registers its information.

**What SSNS uses:**  
✅ **`ot-ctl netdata register` is called in both startup scripts.**

```bash
# Both mac_startup.sh and linux_startup.sh
ot-ctl netdata register
```

This tells the Thread Leader that this OTBR is a Border Router that can relay traffic between the Thread mesh and the external network (the cloud backend). Without this, the mesh nodes would not know this device can route external traffic, though for pure mesh-local CoAP this is optional. It is called to ensure the network data is consistent and the OTBR is fully visible to the mesh.

---

### 3.10 Unicast Addressing

**What it is:**  
In networking, **unicast** means sending a packet to exactly one specific destination address. This is the normal mode for point-to-point communication.

**What SSNS uses:**  
✅ **All sensor data transmissions use unicast.** Every CoAP PUT from a sensor node targets the specific IPv6 address `fd5e:a726:ec55:ee12::1` — a single destination. The Thread mesh routes the unicast packet hop-by-hop to the nearest Border Router holding that address.

---

### 3.11 Multicast

**What it is:**  
Multicast sends a single packet that is delivered to a **group** of devices subscribed to a multicast group address. In Thread, several well-known multicast groups exist:

| Address | Group | Purpose |
|---------|-------|---------|
| `ff02::1` | All nodes (link-local) | Neighbor discovery |
| `ff02::2` | All routers (link-local) | Router solicitation |
| `ff03::1` | All nodes (realm-local) | Thread mesh-local broadcasts |
| `ff03::fc` | All MPL forwarders | Multicast Propagation Layer |

**What SSNS uses:**  
⛔ **Multicast is not used for application-level data in SSNS.**

**Why:**  
SSNS sensor nodes send data to one specific gateway (`::1`), not to a group. Multicast would be appropriate if:
- A coordinator node needed to broadcast commands to all sensors simultaneously.
- Service discovery (mDNS/DNS-SD) was needed to find gateways dynamically.

SSNS deliberately avoids multicast for data because it is unreliable (no ACK mechanism), and the system needs confirmation that data reached the gateway (hence CoAP Confirmable with ACK). The Thread stack does use multicast internally for neighbor discovery and network management, but this is transparent to the application.

---

### 3.12 Anycast (SSNS Custom Implementation)

**What it is:**  
In standard networking, **anycast** assigns the same IP address to multiple nodes, and the routing infrastructure automatically delivers packets to the **nearest** one. True anycast requires routing protocol support (BGP in the internet, or Thread-specific extensions).

**What SSNS uses:**  
✅ **A custom "anycast via DAD override" strategy is implemented.**

Every fog node (Mac, Linux, and any future node) is given the same IPv6 address `fd5e:a726:ec55:ee12::1` by force:

```bash
# Both startup scripts
sysctl -w net.ipv6.conf.wpan0.accept_dad=0    # Disable DAD safety check
sysctl -w net.ipv6.conf.wpan0.dad_transmits=0 # Send no DAD probes
ip -6 addr add fd5e:a726:ec55:ee12::1/64 dev wpan0 nodad
```

**Why not standard anycast?**  
OpenThread does not support BGP or any equivalent routing-level anycast mechanism. However, since the Thread mesh itself uses link-quality-based routing between multiple Routers (one per fog node), OpenThread's internal path selection naturally routes packets to the closest/best-connected fog node. The DAD override makes multiple Border Routers hold the same `::1` address, so the Thread mesh's own path-finding becomes the anycast routing mechanism.

**Result**: Up to 32 fog nodes can share the same gateway IP. The sensor firmware never needs updating when a new fog node is added.

---

### 3.13 DAD (Duplicate Address Detection)

**What it is:**  
DAD is an IPv6 mechanism (RFC 4862) that checks whether a newly configured address is already in use on the network before activating it. The node sends a Neighbor Solicitation multicast to `ff02::1:ffxx:xxxx` (the solicited-node multicast for that address). If another node responds, the address is considered a duplicate and the interface is disabled.

**What SSNS uses:**  
✅ **DAD is intentionally suppressed on the OTBR `wpan0` interface** to enable the shared anycast address:

```bash
sysctl -w net.ipv6.conf.wpan0.accept_dad=0    # Don't disable if duplicate detected
sysctl -w net.ipv6.conf.wpan0.dad_transmits=0 # Don't send DAD probes at all
ip -6 addr add fd5e:a726:ec55:ee12::1/64 dev wpan0 nodad
```

The `nodad` flag on the `ip` command and the sysctl settings together ensure that:
1. No DAD probe is sent (so the other fog nodes don't know about the collision).
2. Even if a DAD probe from another node is received, the interface is not disabled.

This is a deliberate violation of RFC 4862 for the specific goal of enabling multiple Border Routers to hold the same address. It is safe in this controlled deployment because all fog nodes are managed by the same operator.

---

### 3.14 Child Timeout (`otThreadSetChildTimeout`)

**What it is:**  
In Thread, End Devices (Children) periodically send a "Child Update Request" to their parent Router to signal they are still alive. The **Child Timeout** is how long the parent waits without receiving this keepalive before declaring the child as disconnected and removing it from its routing table.

**What SSNS uses:**  
✅ **Set to 60 seconds** (down from the default 240 seconds):

```c
// network.c
otThreadSetChildTimeout(instance, 60);
```

**Why 60 seconds?**  
This is the key parameter that controls failover speed. When a fog node goes offline:
1. The sensor's CoAP transmissions start failing immediately (ACK timeout = 5s).
2. After 3 failures (~15 seconds), the firmware calls `network_reset_stack()` which restarts the Thread stack and begins a new Parent Search.
3. When the Thread stack reconnects to the backup fog node, the old fog node eventually times out the sensor as a child after 60 seconds (the thread child timeout).
4. The new fog node takes over as the active Border Router for this sensor.

Reducing from 240s to 60s means the old router releases the child entry 4× faster, allowing cleaner failover. Without this, the old (offline) fog node's routing entry would persist for 4 minutes, potentially causing mesh routing confusion.

---

### 3.15 Parent Search and Re-attachment

**What it is:**  
When an End Device (Child) loses its parent (the Router it was attached to), it performs a **Parent Search** — it broadcasts MLE Parent Request frames and selects the best responding Router based on link quality and router cost metrics.

**What SSNS uses:**  
✅ **Used as the core failover mechanism.** When `network_reset_stack()` is called:

```c
// network.c
void network_reset_stack(void)
{
    openthread_api_mutex_lock(openthread_get_default_context());
    otThreadSetEnabled(instance, false);
    otThreadSetEnabled(instance, true);  // Triggers new Parent Search
    openthread_api_mutex_unlock(openthread_get_default_context());
}
```

Disabling and re-enabling the Thread stack causes the sensor node to re-run the attachment process from scratch. If the primary fog node is offline, the sensor attaches to the backup fog node (which also holds the same `::1` address).

---

### 3.16 Link Quality Indicators (LQI / RSSI)

**What it is:**  
Thread (and IEEE 802.15.4 in general) measures radio signal quality using:
- **RSSI** (Received Signal Strength Indicator): Power level of received signal in dBm.
- **LQI** (Link Quality Indicator): 0–255 quality score reported by the radio hardware.
- **Link Quality** (Thread abstraction): 0–3 scale (3 = excellent, 0 = poor).

Thread uses these to make routing decisions and to score potential parents during attachment.

**What SSNS uses:**  
✅ **Used implicitly for routing.** The topology monitor reads link quality from the OTBR's neighbor tables and reports them to the backend:

```bash
# topology_monitor.sh
# Link Quality (0–3) → percentage (0%, 33%, 66%, 100%)
LQ_PCT=$(( R_LQIN * 33 ))

# Read from ot-ctl router table and ot-ctl child table
ot-ctl router table
ot-ctl child table
```

This feeds the network topology dashboard, showing which sensor nodes have strong vs weak connections to their Border Router. The firmware itself does not read LQI directly — OpenThread's internal routing uses it automatically.

---

### 3.17 Router Table and Child Table

**What it is:**  
- **Router Table**: Lists all Thread Routers in the partition with their RLOC16, extended MAC, and link quality.
- **Child Table**: Lists all End Devices (Children) attached to the current Router, with their RLOC16 and timeout.

**What SSNS uses:**  
✅ **Both are polled every 15 seconds by the topology monitor:**

```bash
# topology_monitor.sh — runs inside OTBR container
ot-ctl router table   # Retrieves all routers visible in the mesh
ot-ctl child table    # Retrieves all children attached to this BR
```

This data is aggregated into a JSON payload and sent to `/api/network/topology` on the Spring Boot backend. The frontend dashboard uses it to visualize:
- Which fog nodes are active and in what role (leader / router)
- Which sensor nodes are attached and their link quality
- The full mesh topology graph

---

### 3.18 Spinel Protocol (HDLC+UART)

**What it is:**  
Spinel is a serial communication protocol that splits the Thread stack between a **Host** (full network stack, running on the fog node CPU) and an **RCP** (Radio Co-Processor, running on the nRF52840 USB dongle). The host sends high-level commands; the RCP handles raw radio frame transmission and reception.

The transport is:
```
Host (otbr-agent) ←→ Spinel/HDLC/UART ←→ nRF52840 RCP (USB serial /dev/ttyACM0)
```

**What SSNS uses:**  
✅ **Used for the fog node's radio interface.** The fog node OTBR Docker container connects to the nRF52840 dongle via:

```
OT_RCP_DEVICE: "spinel+hdlc+uart:///dev/ttyACM0"
```

The RCP firmware (`firmware/border-router-rcp/rcp_nrf52840dk.hex`) implements the radio side of Spinel. The `otbr-agent` process in the Docker container runs the full Thread network stack and talks to the RCP via this serial link.

---

### 3.19 Topology Monitor

**What it is:**  
An SSNS-specific component (not a Thread standard). A shell script runs inside each OTBR container and periodically queries the Thread network state using `ot-ctl` commands, then POSTs the result to the backend API.

**What SSNS uses:**  
✅ **Used in both Mac and Linux fog nodes.** The script polls every 15 seconds (configurable via `POLL_INTERVAL_SECONDS`):

```bash
# topology_monitor.sh (both Linux and Mac versions)
while true; do
  STATE=$(ot-ctl state)         # leader / router / child / detached
  RLOC16=$(ot-ctl rloc16)      # This fog node's routing address
  CHANNEL=$(ot-ctl channel)    # Verify channel is correct
  PANID=$(ot-ctl panid)        # Verify PAN ID matches dataset
  
  # Parse ot-ctl router table → array of router nodes
  # Parse ot-ctl child table  → array of child (sensor) nodes
  
  # POST JSON to /api/network/topology
  curl -X POST ... "$API_ENDPOINT"
  sleep 15
done
```

The `hardwareId` field uses the USB dongle's serial number (via `udevadm`) as a stable identifier that persists across Docker restarts. On Mac where `udevadm` is unavailable, it falls back to the extended MAC address.

---

### 3.20 FTD vs MTD (Full Thread Device vs Minimal Thread Device)

**What it is:**  
Thread defines two device capability levels that determine whether a node is eligible to become a Router:

| Device Type | Kconfig Flag | Can Become Router? | Radio Sleep | Description |
|-------------|-------------|:-----------------:|:-----------:|-------------|
| **FTD** (Full Thread Device) | `CONFIG_OPENTHREAD_FTD=y` (default) | ✅ Yes | Limited — must stay awake as router | Has full Thread stack, routing table, can forward traffic |
| **MTD** (Minimal Thread Device) | `CONFIG_OPENTHREAD_MTD=y` | ❌ Never | Deep sleep allowed | Only sends/receives its own data, never routes for others |

**Why does the Thread Leader promote nodes to Router?**  
The Thread Leader constantly monitors the number of active Routers in the mesh. OpenThread's algorithm targets between 16 and 23 routers for optimal mesh coverage. If the router count falls below the minimum, the Leader automatically **promotes** any eligible FTD End Device to Router role by assigning it a Router ID. This happens transparently — the device doesn't ask to become a router.

**What SSNS uses:**  
⚠️ **FTD is used by default — and this is the cause of sensor nodes appearing as Routers in the dashboard.**

The `prj.conf` does **not** set `CONFIG_OPENTHREAD_MTD=y`, so the firmware compiles as FTD. This means every nRF52840 sensor node is Router-eligible. When you have 3 sensor nodes and 1 OTBR, the Leader may promote 1 or more sensor nodes to Router role to improve mesh topology.

**Is this good or bad for SSNS?**

> ⚠️ **This is suboptimal for SSNS, but not harmful.**

| Aspect | Impact of Sensor Node Being Router |
|--------|------------------------------------|
| **Battery / Power** | Routers cannot deep-sleep — radio stays more active. Acceptable on a USB-powered dev kit, bad for battery-powered deployment. |
| **RAM usage** | Router role requires maintaining a routing table (~1 KB extra). Fine on nRF52840 (256 KB RAM). |
| **Mesh resilience** | Actually *improves* mesh coverage — a sensor node can relay traffic for other sensors. |
| **Failover** | Slightly more complex — if a promoted sensor node loses power, other nodes may need to re-route. |
| **Data correctness** | No impact — sensor data transmission is unaffected regardless of role. |
| **Dashboard display** | Sensor nodes show up under the Router table instead of Child table, which looks confusing. |

**How to fix it (if desired):**  
Add `CONFIG_OPENTHREAD_MTD=y` to `prj.conf`. This forces every sensor node to remain a permanent End Device (Child) that never routes for others:

```ini
# prj.conf — add this to lock sensor nodes as End Devices forever
CONFIG_OPENTHREAD_MTD=y
```

With MTD, the dashboard will correctly show sensor nodes in the **child table** (as children of the OTBR), and the OTBR will be the only Router (plus Leader if it's the sole router). This is the architecturally correct configuration for SSNS sensor nodes.

**What you currently see in the dashboard (with FTD):**
```
Network Topology
├── [LEADER]  OTBR-A (your fog node)          ← Always a router/leader
├── [ROUTER]  node-598c (sensor node 1)        ← Promoted by Leader! ← should be child
├── [ROUTER]  node-a2f1 (sensor node 2)        ← Promoted by Leader! ← should be child
└── [CHILD]   node-7b3e (sensor node 3)        ← Stayed as child (lucky)
```

**What you'd see after adding `CONFIG_OPENTHREAD_MTD=y`:**
```
Network Topology
├── [LEADER]  OTBR-A (your fog node)
├── [CHILD]   node-598c (sensor node 1)        ← Correct — just a sensor
├── [CHILD]   node-a2f1 (sensor node 2)        ← Correct — just a sensor
└── [CHILD]   node-7b3e (sensor node 3)        ← Correct — just a sensor
```

---

### 3.21 Summary Table: Thread Concepts in SSNS

| Concept | Used in SSNS? | Where | Why / Why Not |
|---------|:---:|-------|----------------|
| Commissioning | ❌ No | — | Pre-shared keys used instead; no end-user on-boarding needed |
| Network Key | ✅ Yes | `network.c`, `.env` | Required — AES encryption of all mesh traffic |
| PSKc | ⚠️ Present | `.env` | In dataset for completeness; Commissioner not used |
| PANID / ExtPANID | ✅ Yes | `network.c`, `.env`, startup scripts | Radio-layer network isolation |
| Channel 26 | ✅ Yes | `network.c`, `.env` | Minimal Wi-Fi 2.4 GHz interference |
| Mesh-Local Prefix | ✅ Yes | `network.c`, `.env` | All sensor→gateway traffic uses this prefix |
| SLAAC | ✅ Yes (implicit) | OpenThread stack | Auto-assign unique IPv6 to each sensor — no DHCP needed |
| RLOC / RLOC16 | ✅ Yes (monitoring) | `topology_monitor.sh` | Dashboard topology visualization |
| Network Data / `netdata register` | ✅ Yes | Startup scripts | Registers OTBR as external router in mesh |
| Unicast | ✅ Yes | `network.c` | All CoAP data packets target `::1` directly |
| Multicast | ❌ Not for app data | Thread stack (internal) | No ACK, no guarantee of delivery — unsuitable for telemetry |
| Anycast (custom) | ✅ Yes | Startup scripts, HA design | Multiple fog nodes share `::1`; Thread routing picks nearest |
| DAD (suppressed) | ✅ Yes (disabled) | Startup scripts | Required to allow anycast shared IP without interface shutdown |
| Child Timeout (60s) | ✅ Yes | `network.c` | Fast 60-second failover to backup fog node |
| Parent Search | ✅ Yes | `network.c` (`network_reset_stack`) | Triggered after 3 consecutive CoAP failures |
| Link Quality / RSSI | ✅ Yes (monitoring) | `topology_monitor.sh` | Mesh health visualization in dashboard |
| Router/Child Tables | ✅ Yes | `topology_monitor.sh` | Topology API endpoint |
| Spinel/HDLC/UART | ✅ Yes | OTBR Docker config | Host↔RCP radio interface |
| Topology Monitor | ✅ Yes (custom) | `topology_monitor.sh` | Dashboard network visualization |
| FTD (sensor as Router) | ⚠️ Yes (unintended) | `prj.conf` (no MTD flag) | Sensor nodes promoted to Router by Leader — suboptimal, fix with `CONFIG_OPENTHREAD_MTD=y` |

---

## 4. Sensor Node Firmware

### 4.1 Hardware Platform

- **MCU**: Nordic Semiconductor nRF52840
- **Board**: nRF52840 Development Kit (`nrf52840dk/nrf52840`)
- **RTOS**: Zephyr RTOS
- **Radio**: Built-in IEEE 802.15.4 transceiver (also supports BLE, but unused here)
- **Flash**: 1 MB (used for program + NVS offline queue)
- **RAM**: 256 KB

### 4.2 Dual-Mode Architecture

The firmware supports two compile-time modes, selected via Kconfig:

```
┌─────────────────────────────────────────────────────────┐
│              MODE SELECTION (Kconfig)                    │
├──────────────────────────┬──────────────────────────────┤
│ CONFIG_SENSOR_MODE_SIMULATION  │ CONFIG_SENSOR_MODE_HARDWARE │
│ (default — no hardware)        │ (requires I2C sensors)      │
└──────────────────────────┴──────────────────────────────┘
           │                              │
           ▼                              ▼
  sensor_sim.c                    sensor_hw.c
  • Random walk model             • Non-blocking cache reads
  • Trend events                  • sensor_aggregator.c
  • Failure injection             • 3 parallel polling threads
  • Blocking latencies (~12s)     • mutex-protected shared cache
```

**Build commands:**
```bash
# Simulation mode (default)
west build -p always -b nrf52840dk/nrf52840

# Hardware mode
west build -p always -b nrf52840dk/nrf52840 -- \
  -DCONFIG_SENSOR_MODE_HARDWARE=y \
  -DEXTRA_CONF_FILE=prj_hw.conf
```

### 4.3 Source File Map

```
firmware/sensor-node/src/
├── main.c                     # Main control loop (sample + transmit)
├── network.c / network.h      # CoAP encoder, Thread dataset injection
├── storage.c / storage.h      # RAM offline queue (50 slots × 1024 B)
├── sensors.c / sensors.h      # Simulation sensor state machine
└── sensors/
    ├── sensor_interface.h     # Common API (both modes)
    ├── sensor_sim.c           # Simulation backend
    ├── sensor_hw.c            # Hardware backend (delegates to aggregator)
    ├── sensor_aggregator.c/h  # 3-thread cache aggregator
    └── drivers/
        ├── scd41_driver.c/h   # CO₂, Temp, Hum (I2C 0x62)
        ├── ccs811_driver.c/h  # eCO₂, TVOC (I2C 0x5A)
        └── sps30_driver.c/h   # PM1.0/2.5/4.0/10 (I2C 0x69)
```

### 4.4 Sensor Data Structure

```c
struct sensor_readings {
    // Current instantaneous values
    float    temperature;           // °C       (SCD41)
    float    humidity;              // %RH       (SCD41)
    float    co2;                   // ppm       (SCD41)
    float    tvoc;                  // ppb       (CCS811)
    float    eco2;                  // ppm       (CCS811)
    float    pm1;                   // µg/m³     (SPS30)
    float    pm25;                  // µg/m³     (SPS30)
    float    pm4;                   // µg/m³     (SPS30)
    float    pm10;                  // µg/m³     (SPS30)
    float    light;                 // lux       (simulated)

    // Per-sensor statistical accumulators (mean/std/max over window)
    struct sensor_stats temperature_stats;
    struct sensor_stats humidity_stats;
    struct sensor_stats co2_stats;
    struct sensor_stats tvoc_stats;
    struct sensor_stats eco2_stats;
    struct sensor_stats pm1_stats;
    struct sensor_stats pm25_stats;
    struct sensor_stats pm4_stats;
    struct sensor_stats pm10_stats;

    // Health bitmask
    uint8_t  health_mask;           // 4-bit sensor health flags
};
```

**Health Mask Bits:**

| Bit | Sensor Group | OK Value |
|-----|-------------|----------|
| 0 | SCD41 Temp/Hum | 1 = OK, 0 = FAULT |
| 1 | SCD41 CO₂ | 1 = OK, 0 = FAULT |
| 2 | SPS30 Particulate Matter | 1 = OK, 0 = FAULT |
| 3 | CCS811 TVOC | 1 = OK, 0 = FAULT |

`0x0F` = all sensors healthy. `0x00` = total sensor failure.

A faulty sensor reports `-999.0` (SENSOR_FAULT_VALUE). The CCS811 warmup period reports `-998.0` (SENSOR_WARMUP_VALUE).

### 4.5 Hardware Sensors (I2C Bus)

All three sensors share I2C bus 0 on the nRF52840 DK:
- **SDA**: P0.26
- **SCL**: P0.27
- **Speed**: 100 kHz (I2C_BITRATE_STANDARD — reliable for all three)

| Sensor | I2C Address | Measures | Update Rate | Notes |
|--------|-------------|----------|-------------|-------|
| **Sensirion SCD41** | `0x62` | CO₂ (400–5000 ppm), Temp (−10–60°C), Humidity (0–100% RH) | Every 5.5 s | ±40 ppm CO₂, ±0.8°C |
| **AMS CCS811** | `0x5A` | eCO₂ (400–8192 ppm), TVOC (0–1187 ppb) | Every 1.0 s | Requires 20-min warm-up per power cycle |
| **Sensirion SPS30** | `0x69` | PM1.0, PM2.5, PM4.0, PM10 (0–1000 µg/m³) | Every 1.5 s | Self-cleans fan every 168 hours (10 s hold) |

### 4.6 Main Control Loop (main.c)

The main loop implements a **two-phase batching** strategy:

```
Phase A: Sample every 6 seconds
Phase B: Transmit batch every 30 seconds (or when buffer is full at 5 samples)
```

```
Power-on
  │
  ├─ storage_init()    — Initialize 50-slot RAM queue
  ├─ network_init()    — Inject Thread dataset, create UDP socket
  ├─ sensor_backend_init() — Start simulation or hardware threads
  │
  └─ 60-second warm-up period (hardware sensors need time to stabilize)
       │
       ▼
  Main Loop (forever):
  ├─ Every 6 seconds:
  │    sensor_backend_read() → append to sample_buffer[5]
  │
  └─ Every 30 seconds (or when sample_buffer is full):
       ├─ network_encode_coap_batch()   — CBOR-encode the batch
       ├─ network_send_coap_batch()     — Send over Thread + wait for ACK
       │
       ├─ On SUCCESS (rc == 0):
       │    consecutive_failures = 0
       │    storage_forward_all_packets()  — Drain offline queue
       │
       └─ On FAILURE (rc < 0):
            consecutive_failures++
            storage_save_packet()         — Save to RAM queue
            if consecutive_failures >= 3:
                network_reset_stack()     — Force Thread re-attachment
```

### 4.7 Offline Storage (storage.c)

The storage layer provides a **RAM-based circular FIFO queue** for packets that cannot be transmitted due to a gateway outage:

| Parameter | Value |
|-----------|-------|
| Queue capacity | 50 packets |
| Slot size | 1024 bytes (fits 5-sample CBOR batch ~821 bytes) |
| Total RAM usage | ~50 KB |
| Offline coverage | ~25 minutes at 30s/batch |
| Eviction policy | Oldest-first (circular overwrite when full) |

> **Why RAM, not Flash (NVS)?** OpenThread internally uses the same NVS partition to store its own network state. Writing large telemetry packets to NVS simultaneously with OpenThread caused partition corruption and data loss. RAM-only avoids this conflict at the cost of losing queued data across power cycles.

When the gateway comes back online, `storage_forward_all_packets()` drains the queue one packet at a time with 100 ms spacing to avoid overwhelming the network.

### 4.8 Hardware Mode: Multi-Threaded Aggregator

In hardware mode, blocking on slow sensors in the main thread would miss transmission windows. Instead, three **independent polling threads** continuously read sensors and write results to a shared, mutex-protected cache:

```
Thread 1: scd41_poll  (Priority 7)   — reads every 5.5 s
Thread 2: ccs811_poll (Priority 7)   — reads every 1.0 s
Thread 3: sps30_poll  (Priority 7)   — reads every 1.5 s
                │
                ▼
        ┌─────────────────────────────┐
        │   Shared Cache (mutex)      │
        │   struct sensor_readings    │
        └─────────────────────────────┘
                │
                ▼ (< 1 ms)
        main() → sensor_aggregator_get()
             → mutex_lock()
             → memcpy(cache)
             → mutex_unlock()
```

The main thread's `sensor_backend_read()` returns in under 1 ms, compared to 12 seconds in simulation mode.

---

## 5. CoAP Protocol & Server

### 5.1 What is CoAP?

CoAP (Constrained Application Protocol, RFC 7252) is a lightweight application-layer protocol designed for constrained IoT devices. It mirrors HTTP's request/response semantics but runs over **UDP** (not TCP) and is specifically optimized for low-power, lossy networks.

| Feature | HTTP | CoAP |
|---------|------|------|
| Transport | TCP | UDP |
| Header size | 26+ bytes | 4 bytes |
| Reliability | TCP guaranteed | Optional ACK mechanism |
| Methods | GET/POST/PUT/DELETE | Same (binary encoded) |
| URI format | Text | Compact text |
| Content type | MIME | Content-Format option |

### 5.2 CoAP Packet Format (Raw)

The firmware constructs CoAP packets manually (no CoAP library on the embedded side) to minimize memory usage:

```
Byte 0:  0x40 = Version(1) | Type(CON=0) | TKL(0 tokens)
         (1 << 6) | (0 << 4) | 0 = 0x40  [Confirmable, no token]
Byte 1:  0x03 = Method code (PUT)
Byte 2-3: Message ID (big-endian, auto-incremented from 0x1000)

Options:
  Byte 4: (11 << 4) | len = Uri-Path option with length
  Bytes 5+: "storedata" (the resource path)

Payload Marker:
  0xFF (mandatory before payload)

Payload:
  CBOR-encoded sensor data
```

**Confirmable (CON) vs Non-confirmable (NON):**  
All SSNS packets use **CON** (Confirmable). The gateway MUST send back an ACK (Type=2) with the matching Message ID within 5 seconds. If no ACK is received, the transmission is counted as a failure.

```c
// network.c — wait_for_coap_ack()
// Polls the UDP socket in 500ms intervals for up to 5 seconds.
// Returns 0 on ACK received, -ETIMEDOUT on timeout.
```

### 5.3 CBOR Payload Encoding (zcbor)

JSON would be ~200 bytes per reading. CBOR compresses this to **~88 bytes** (single sample) or **~821 bytes** (5-sample batch). The firmware uses Nordic's **zcbor** library for encoding.

#### Single Sample Format (Phase 1, backward compatible)
```
CBOR Array [43 elements]:
  [0]  node_id       (text)     e.g., "node-598c"
  [1]  boot_id       (text)     e.g., "a3f2b1c0"
  [2]  seq_num       (uint32)   monotonically increasing
  [3]  uptime_ms     (uint32)   milliseconds since boot
  [4]  temperature   (float32)  °C
  [5]  humidity      (float32)  %RH
  [6]  co2           (float32)  ppm
  [7]  tvoc          (float32)  ppb
  [8]  eco2          (float32)  ppm
  [9]  pm1           (float32)  µg/m³
  [10] pm2.5         (float32)  µg/m³
  [11] pm4           (float32)  µg/m³
  [12] pm10          (float32)  µg/m³
  [13] light         (float32)  lux
  [14] health_mask   (uint32)   4-bit bitmask
  [15] mesh_id       (text)     same as node_id
  [16-42] Statistics (float32 × 27): mean/std/max for each of 9 channels
```

#### Batch Format (Phase 2, current default)
```
CBOR Root Array [2 elements]:
  [0] samples_array: Array of N sample arrays (N ≤ 5)
        Each sample: Array [16 fields]
          [0]  node_id     (text)
          [1]  boot_id     (text)
          [2]  seq_num     (uint32)
          [3]  uptime_ms   (uint32)   actual timestamp for this sample
          [4]  temperature (float32)
          ...
          [13] light       (float32)
          [14] health_mask (uint32)
          [15] mesh_id     (text)

  [1] statistics_map: CBOR Map {27 key-value pairs}
        {"temp_mean": f, "temp_std": f, "temp_max": f,
         "hum_mean":  f, "hum_std":  f, "hum_max":  f,
         "co2_mean":  f, "co2_std":  f, "co2_max":  f,
         "tvoc_mean": f, "tvoc_std": f, "tvoc_max": f,
         "eco2_mean": f, "eco2_std": f, "eco2_max": f,
         "pm1_mean":  f, "pm1_std":  f, "pm1_max":  f,
         "pm25_mean": f, "pm25_std": f, "pm25_max": f,
         "pm4_mean":  f, "pm4_std":  f, "pm4_max":  f,
         "pm10_mean": f, "pm10_std": f, "pm10_max": f}
        (Statistics are taken from the *last* sample in the batch)
```

The batch format reduces overhead by sharing statistics (27 float fields) across all 5 samples instead of repeating them per-sample. At 5 samples, this saves ~540 bytes of radio payload.

### 5.4 Python CoAP Server (aiocoap)

The Python gateway runs an **asyncio** CoAP server using the `aiocoap` library, listening on `0.0.0.0:5683`.

**File**: `platform/gateway/coap/server.py`

```
CoAP PUT /storedata
  │
  ├─ Decode CBOR payload (cbor2.loads)
  │
  ├─ Detect format:
  │    len == 2  → Batch format   → _handle_batch()
  │    len >= 43 → Single format  → _handle_single_sample()
  │    else      → BAD_REQUEST
  │
  ├─ Extract fields (node_id, boot_id, seq_num, sensor values...)
  │
  ├─ Deduplication check (Redis SETNX):
  │    Key: "dedup:{node_id}:{boot_id}:{seq_num}"
  │    TTL: 300 seconds (5 minutes)
  │    If key exists → duplicate, return CHANGED (silently drop)
  │    If key new    → proceed
  │
  ├─ Build JSON payload dict (camelCase fields for Spring Boot API)
  │
  ├─ queue_manager.enqueue(node_id, seq_num, payload_str)
  │     → Pushes to Redis list "sensor_data_queue"
  │
  └─ Return: aiocoap.Message(code=CHANGED)  [HTTP 204 equivalent]
```

### 5.5 Redis Queue & Worker Loop

Between the CoAP server and the HTTP forwarder sits a **Redis-backed queue**:

```
CoAP Server (producer)
    │ LPUSH "sensor_data_queue"
    ▼
Redis List
    │ BRPOP (blocking pop, 1s timeout)
    ▼
Worker Loop (consumer)
    │ HttpForwarder.forward(payload)
    ▼
Spring Boot Backend (POST /api/sensor-data)
```

This decouples reception speed from forwarding speed. If the backend is temporarily slow, packets accumulate in Redis rather than being dropped at the CoAP layer. The deduplication keys (TTL=300s) also prevent the same packet from being forwarded twice if the sensor retransmits due to a lost ACK.

### 5.6 Gateway Connectivity Tracking

The firmware maintains a connectivity state machine to distinguish between:
- **Gateway online**: ACK received within 5 seconds
- **Gateway offline**: 3+ consecutive failures (60-second timeout)

```c
// network.c
#define GATEWAY_TIMEOUT_MS 60000         // 60 seconds of silence = offline
#define MAX_CONSECUTIVE_FAILURES 3       // 3 failures = switch to offline mode

static bool gateway_online = true;
static int64_t last_successful_send = 0;
static int consecutive_failures = 0;
```

When the gateway comes back online (first successful ACK after failures), the firmware immediately initiates queue draining via `storage_forward_all_packets()`.

**Network isolation guard**: Before every transmission, the firmware checks the Thread network state. If the node is `DETACHED` or `DISABLED`, or has zero neighbors, it suppresses the transmission to prevent broadcast storms on a partitioned network:

```c
otDeviceRole role = otThreadGetDeviceRole(instance);
if (role == OT_DEVICE_ROLE_DETACHED || role == OT_DEVICE_ROLE_DISABLED) {
    LOG_WRN("Thread network disconnected! Suppressing transmission.");
    return -1;
}
```

---

## 6. Fog Nodes

A **Fog Node** is a compute node (Mac laptop or Linux machine) that sits at the network edge between the Thread mesh and the cloud. Each fog node runs three Docker containers:

| Container | Image / Build | Role |
|-----------|--------------|------|
| `ssns-otbr` | `openthread/otbr:custom` | OpenThread Border Router — bridges Thread ↔ IP |
| `ssns-gateway` | `./platform/gateway` (Python) | CoAP server + Redis worker + HTTP forwarder |
| `ssns-redis` | `redis:alpine` | Deduplication store + in-flight queue |

### 6.1 Mac Fog Node

**Files**: `edge-nodes/mac-fog-node/`

The Mac fog node uses Docker Desktop's `bridge` networking mode. Because Docker on Mac cannot expose the host's actual network interfaces to containers, a `socat` bridge is used to forward CoAP packets:

```
Thread mesh (IPv6)
    │
    ▼
OTBR container (wpan0 interface: fd5e:a726:ec55:ee12::1)
    │ socat UDP6-RECVFROM:[fd5e:a726:ec55:ee12::1]:5683
    │       UDP-SENDTO:127.0.0.1:5683
    ▼
Gateway container (127.0.0.1:5683) — Python aiocoap server
    │
    ▼
Redis (ssns-fog-network bridge) ← dedup + queue
    │
    ▼
HTTP POST → ${GATEWAY_BACKEND_URL}
             (host.docker.internal:8080 for local Mac backend,
              or 13.140.144.215:8080 for cloud VPS)
```

**Key networking decisions for Mac:**
- `ssns-fog-network` Docker bridge network connects all three containers
- OTBR binds to port `8081:8080` (avoiding conflict with backend on 8080)
- socat runs inside the OTBR container to bridge IPv6→IPv4 without NAT64

### 6.2 Linux Fog Node

**Files**: `edge-nodes/linux-fog-node/`

The Linux fog node uses Docker's `host` networking mode, meaning all containers share the host's network namespace. This allows the OTBR to directly access `/dev/ttyACM0` (the nRF52840 USB dongle running RCP firmware) and have its `wpan0` Thread interface visible on the host.

```
Thread mesh (IPv6)
    │
    ▼
OTBR container (host network, wpan0: fd5e:a726:ec55:ee12::1)
    │ No socat needed — gateway sees wpan0 directly
    ▼
Gateway container (host network, 0.0.0.0:5683) — Python aiocoap
    │ Can read true IPv6 source address of sensor nodes
    ▼
Redis (host network, localhost:6379)
    │
    ▼
HTTP POST → ${GATEWAY_BACKEND_URL}
             (Tailscale IP: 100.98.119.40:8080 or cloud VPS)
```

**Advantages of host mode on Linux:**
- True IPv6 source address of sensor node visible in CoAP request (`request.remote.sockaddr`)
- No socat bridge needed — pure kernel IPv6 routing
- Better performance — no Docker NAT overhead
- Full `/dev` passthrough for RCP USB device

### 6.3 OTBR: OpenThread Border Router

The OTBR is the radio-to-IP bridge. It runs two key processes:

1. **`otbr-agent`**: Communicates with the nRF52840 RCP dongle over USB-serial (spinel+HDLC+UART protocol at `/dev/ttyACM0`). Manages the Thread radio stack.

2. **`otbr-web`**: Provides a web management UI (accessible on port 8081 on Mac).

The RCP (Radio Co-Processor) firmware is the Border Router's radio half:
- **File**: `firmware/border-router-rcp/rcp_nrf52840dk.hex`
- **Role**: Handles raw IEEE 802.15.4 radio operations, delegates all network logic to the host CPU via spinel protocol

**OTBR startup sequence** (from `mac_startup.sh` / `linux_startup.sh`):
1. Install socat / iproute2 dependencies (Mac) or detect USB device (Linux)
2. Start `otbr-agent` connecting to `/dev/ttyACM0`
3. Set Thread operational dataset from environment variables
4. Enable Thread and IPv6 interfaces (`ot-ctl thread start`)
5. Register network data (`ot-ctl netdata register`)
6. Inject DAD-override sysctl + assign shared `::1` address
7. Start `socat` bridge (Mac only; Linux uses native wpan0)
8. Launch topology monitor in background

### 6.4 Protocol Bridge: IPv6 → IPv4 (Mac Only)

```
┌─────────────────────────────────────────────────────────────┐
│ WHY IPv6 → IPv4 bridging?                                    │
│                                                              │
│ Thread uses pure IPv6. The Python gateway (aiocoap) can     │
│ also bind IPv6. However, on Docker Desktop for Mac:          │
│ • Docker's bridge network doesn't propagate IPv6 packets    │
│   from the Thread wpan0 interface to other containers.      │
│ • NAT64 requires kernel modules unavailable in Docker Mac.  │
│                                                              │
│ Solution: socat inside the OTBR container listens on the    │
│ Thread IPv6 address and forwards payload bytes to IPv4       │
│ localhost, where the gateway container is listening.         │
│                                                              │
│ This is transparent to the sensor firmware — it still       │
│ targets fd5e:a726:ec55:ee12::1:5683 as always.             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. End-to-End Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    End-to-End Data Path                                        │
│                                                                                │
│  1. SAMPLE (every 6s)                                                         │
│     nRF52840 → sensor_backend_read() → sample_buffer[0..4]                   │
│                                                                                │
│  2. ENCODE (every 30s when buffer full)                                       │
│     sample_buffer → zcbor → CBOR batch payload (~821 bytes)                  │
│                                                                                │
│  3. TRANSMIT (CoAP CON PUT over Thread)                                       │
│     UDP sendto [fd5e:a726:ec55:ee12::1]:5683                                 │
│     ↓ IEEE 802.15.4 radio frames (multi-hop mesh if needed)                  │
│     ↓ OTBR receives on wpan0                                                  │
│     ↓ socat bridge (Mac) or direct (Linux)                                    │
│                                                                                │
│  4. RECEIVE (Python aiocoap, port 5683)                                       │
│     render_put() ← CoAP PUT /storedata                                        │
│     cbor2.loads(request.payload)                                              │
│                                                                                │
│  5. PARSE & FLATTEN                                                            │
│     Detect format (batch vs single)                                           │
│     Extract 5 samples + shared statistics                                     │
│     Build JSON dict per sample (camelCase API contract)                       │
│                                                                                │
│  6. DEDUPLICATE (Redis SETNX)                                                 │
│     Key: "dedup:{node_id}:{boot_id}:{seq_num}"                               │
│     TTL: 300 seconds                                                           │
│     Duplicate? → return CHANGED (silent drop)                                 │
│     New?       → enqueue to Redis list                                         │
│                                                                                │
│  7. FORWARD (worker_loop)                                                      │
│     BRPOP from Redis list                                                      │
│     HTTP POST → /api/sensor-data (JSON body)                                  │
│     Backend: Spring Boot → PostgreSQL / TimescaleDB                           │
│                                                                                │
│  8. ACK (CoAP response back to sensor)                                        │
│     aiocoap.Message(code=CHANGED) [2.04]                                      │
│     ↓ socat bridges response back to Thread mesh                              │
│     ↓ Sensor receives ACK → consecutive_failures = 0                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Timing Profile (Normal Operation)

| Event | Period | Notes |
|-------|--------|-------|
| Sensor sample | Every 6 s | Phase A |
| Batch transmit | Every 30 s | 5 samples per batch |
| CoAP ACK timeout | 5 s | Per transmission attempt |
| Gateway timeout | 60 s | After 3+ consecutive failures |
| Thread child timeout | 60 s | Controls fog node failover speed |

---

## 8. High Availability & Failover

### 8.1 Anycast Gateway Address

Every fog node (Mac, Linux, or any future node) is configured with the **same IPv6 gateway address**: `fd5e:a726:ec55:ee12::1`.

This is not standard anycast (which requires routing protocol support). Instead, the system uses a **"Anycast via DAD Override"** strategy:

1. Every OTBR container claims the IP `fd5e:a726:ec55:ee12::1` on its `wpan0` interface.
2. Linux's Duplicate Address Detection (DAD) would normally disable the interface if it detects a collision. This is bypassed by:
   ```bash
   sysctl -w net.ipv6.conf.wpan0.accept_dad=0
   sysctl -w net.ipv6.conf.wpan0.dad_transmits=0
   ip -6 addr add fd5e:a726:ec55:ee12::1/64 dev wpan0 nodad
   ```
3. The Thread mesh has multiple active routers, each with the same IP.
4. OpenThread's internal routing algorithm selects the **nearest router** based on link quality metrics.

**Result**: The sensor firmware is never changed. Adding more fog nodes is plug-and-play.

### 8.2 Failover Sequence

```
Normal state:
  Sensor → [fog-node-A is router] → Cloud backend
                                 ↑ CoAP ACK within 5s

Fog Node A fails (unplugged):
  T+0s:   Sensor sends CoAP PUT → no ACK
  T+5s:   ACK timeout → failure #1 → save to RAM queue
  T+11s:  Next batch attempt → failure #2 → save to RAM queue
  T+17s:  Next batch attempt → failure #3 → network_reset_stack()
  T+17s:  consecutive_failures = 3 → Thread stack reset
          otThreadSetEnabled(false); otThreadSetEnabled(true);
  T+60s:  otThreadSetChildTimeout = 60s → OTBR-A declares sensor detached
          Thread mesh recalculates routes → Fog Node B becomes router
  T+60s:  Sensor re-attaches via Fog Node B
  T+65s:  Sensor sends batch → ACK from Fog Node B → SUCCESS
          storage_forward_all_packets() → drain RAM queue
          All buffered data forwarded, zero loss
```

### 8.3 Scaling

| Metric | Limit | Notes |
|--------|-------|-------|
| Fog nodes | Up to 32 | OpenThread Active Router limit |
| Sensor nodes per fog node | ~50–100 | Depends on traffic rate |
| Offline queue depth | 50 packets | ~25 min offline coverage |
| Deduplication window | 5 minutes | Redis TTL per packet |

---

## 9. Configuration Reference

### 9.1 Thread Network Parameters (both `.env` files are identical)

```bash
# edge-nodes/mac-fog-node/.env
# edge-nodes/linux-fog-node/.env

OT_NETWORK_NAME=WSN01
OT_CHANNEL=26
OT_PANID=0x1235
OT_EXTPANID=1111111122222222
OT_NETWORK_KEY=112233445566778899aabbccddeeff00
OT_MESH_LOCAL_PREFIX=fd5e:a726:ec55:ee12::
OT_ACTIVE_TIMESTAMP=2000000000
OT_PSKC=11223344556677881122334455667788
```

### 9.2 Gateway Routing (per deployment)

| Scenario | `GATEWAY_BACKEND_URL` |
|----------|----------------------|
| Mac local (no internet) | `http://host.docker.internal:8080/api/sensor-data` |
| Linux via Tailscale VPN | `http://100.98.119.40:8080/api/sensor-data` |
| Cloud VPS (Contabo) | `http://13.140.144.215:8080/api/sensor-data` |

### 9.3 Firmware Build Parameters

| Kconfig Key | Default | Purpose |
|-------------|---------|---------|
| `CONFIG_SENSOR_MODE_SIMULATION` | `y` | Build without hardware sensors |
| `CONFIG_SENSOR_MODE_HARDWARE` | — | Enables I2C drivers, requires `prj_hw.conf` |
| `CONFIG_OPENTHREAD_CHANNEL` | `15` (overridden to `26` at runtime) | Thread radio channel |
| `CONFIG_OPENTHREAD_PANID` | `4661` (overridden at runtime) | PAN identifier |
| `CONFIG_MAIN_STACK_SIZE` | `6144` | Main thread stack in bytes |
| `CONFIG_HEAP_MEM_POOL_SIZE` | `2048` | Dynamic heap |
| `CONFIG_ZCBOR` | `y` | CBOR encoding library |
| `CONFIG_NET_SOCKETS_POSIX_NAMES` | `y` | POSIX-style socket API |

> **Note**: The Kconfig channel/panid/network-key settings serve as defaults. The `force_thread_dataset()` function in `network.c` **always overrides** these at runtime with the hardcoded dataset, ensuring every build uses the same network regardless of `prj.conf` values.

### 9.4 CoAP Parameters

| Parameter | Value | Configured In |
|-----------|-------|--------------|
| Gateway IPv6 address | `fd5e:a726:ec55:ee12::1` | `network.c` |
| CoAP port | `5683` | `network.c`, `coap/server.py` |
| CoAP resource path | `/storedata` | Both |
| ACK timeout | 5 seconds | `network.c` — `wait_for_coap_ack()` |
| Max consecutive failures | 3 | `network.c` |
| Thread child timeout | 60 seconds | `network.c` — `otThreadSetChildTimeout` |
| Dedup TTL | 300 seconds | `coap/server.py` |

### 9.5 I2C Pin Assignment (nRF52840 DK)

```
P0.26 → SDA (all three sensors share the bus)
P0.27 → SCL (all three sensors share the bus)
Mode  → I2C_BITRATE_STANDARD (100 kHz)
```

Defined in `firmware/sensor-node/app.overlay`.

---

## Appendix A: Key Files Quick Reference

| File | Purpose |
|------|---------|
| `firmware/sensor-node/src/main.c` | Main sampling + transmission loop |
| `firmware/sensor-node/src/network.c` | Thread dataset injection, CoAP encoding, ACK handling |
| `firmware/sensor-node/src/storage.c` | RAM circular queue for offline packets |
| `firmware/sensor-node/src/sensors.c` | Simulation sensor state machine |
| `firmware/sensor-node/app.overlay` | I2C pins + sensor devicetree nodes |
| `firmware/sensor-node/prj.conf` | Zephyr Kconfig (OpenThread, CoAP, CBOR, NVS) |
| `platform/gateway/coap/server.py` | Python aiocoap server, CBOR parser, Redis enqueue |
| `platform/gateway/main.py` | Gateway orchestrator (CoAP mode vs simulator mode) |
| `edge-nodes/mac-fog-node/.env` | Mac fog node Thread + backend config |
| `edge-nodes/linux-fog-node/.env` | Linux fog node Thread + backend config |
| `edge-nodes/mac-fog-node/docker-compose.fog.yml` | Mac: OTBR + Gateway + Redis (bridge network) |
| `edge-nodes/linux-fog-node/docker-compose.fog.yml` | Linux: OTBR + Gateway + Redis (host network) |
| `edge-nodes/mac-fog-node/scripts/mac_startup.sh` | Mac OTBR init, socat bridge, DAD bypass |
| `edge-nodes/linux-fog-node/scripts/linux_startup.sh` | Linux self-healing supervisor, DAD bypass |
| `edge-nodes/linux-fog-node/scripts/topology_monitor.sh` | Network topology polling → backend API |

---

*End of SSNS System Reference Document — Version 2.0*
