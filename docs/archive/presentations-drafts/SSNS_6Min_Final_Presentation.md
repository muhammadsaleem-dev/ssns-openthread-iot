# 🎙️ SSNS 6-Minute Presentation Script

---

## Slide 1: Project Updates Overview

### 🖥️ Slide Content / Bullets (To put on your slide):
* **Architecture:** Upgraded from basic 1-to-1 Client-Server ➔ **Scalable Distributed Fog Nodes**.
* **Sensor Node:** Upgraded from raw telemetry transmission ➔ **Intelligent Edge Node (On-Device Statistics)**.
* **Data Payload:** Upgraded from large JSON (`4,000 bytes`) ➔ **Compressed Binary CBOR (`800 bytes`)**.
* **Reliability:** Upgraded from zero backup ➔ **Automatic Mesh Failover + 25m RAM Buffer**.

---

### 🎙️ Speaker Script:
> "Hello everyone, my name is Saleem. Today I am going to walk you through the recent updates we made to our project. 
>
> Earlier, we had a basic client-server setup transmitting bulky JSON data. But now, we upgraded our microcontroller into an intelligent edge node with built-in memory buffering capabilities and built a scalable distributed fog network."

---

## Slide 2: On-Device Statistical Edge Processing

### 🎙️ Speaker Script:
> "Earlier, we were just transmitting raw telemetry, but now our microcontroller is an intelligent edge node. I am calling it intelligent because now it is actively analyzing, filtering, and compressing statistical features along with the raw values before transmitting lightweight binary payloads."

---

## Slide 3: Data Genesis & CBOR Compression

### 🎙️ Speaker Script:
> "When we were using JSON payloads, the size of the payload was 4,000 bytes, which is not good for low-power wireless networks. So we converted our payload into binary CBOR—that is how we reduced 80 percent of the payload size."

---

## Slide 4: The Mesh & The Safety Net

### 🎙️ Speaker Script:
> "Finally, to protect our data when the network drops, we built a safety net on the microcontroller. Whenever our sensor sends a reading, it waits for a delivery confirmation. If that confirmation fails three times in a row, the sensor automatically saves the reading into local memory. This buffers up to 25 minutes of offline data, which automatically uploads as soon as the connection recovers."

---

## Slide 5: Scalable Distributed Fog Architecture

### 🎙️ Speaker Script:
> "Earlier, we were using a client-server architecture in which one nRF board was the client and the other was the server. But now we successfully built a distributed fog layer where each fog node has its own gateway CoAP server, Redis cache, and plugged-in nRF dongle. So now we can scale our fog nodes horizontally, and if one fog node goes down, the sensor nodes will automatically transmit packets using the next available fog node."

---

## Slide 6: Shared Service Addressing

### 🎙️ Speaker Script:
> "To make this failover completely seamless, we configured our border routers to use Shared Service Addressing. By sharing the exact same logical IPv6 service address, whenever one fog node goes offline, the sensor node automatically initiates a parent search and connects to another available fog node in about 30 seconds—without ever needing to reprogram the destination address. Thank you everyone!"

---

### Q: "What exactly does 'Fog Node' mean?"

> *"A Fog Node is a local gateway device—like a Raspberry Pi—that sits near the physical sensors to translate low-power radio signals into internet data before sending it to the central server."*

### Q: "What is Shared Service Addressing?"

> *" all Fog Nodes share the exact same service address. If one Fog Node crashes or gets unplugged, the sensor automatically routes its data to the next available Fog Node without needing to be reprogrammed."*

### Q: "Why do we suppress Duplicate Address Detection (DAD)?"

> *"We suppress DAD so multiple Fog Nodes can share the exact same IP address, allowing sensors to connect instantly without needing complex DNS lookup services."*
