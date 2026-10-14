# SSNS: Sensor Datasheet Error Handling Reference Guide

This document provides a comprehensive technical reference for all error types, fault flags, status registers, and protocol validation rules specified in the official manufacturers' datasheets for the three core environmental sensors in the Smart Sensor Network System (SSNS):
1. **Sensirion SCD41** (NDIR CO₂ / Humidity / Temperature) — I²C Address `0x62`
2. **AMS / Adafruit CCS811** (MOX Gas Sensor for TVOC / eCO₂) — I²C Address `0x5A`
3. **Sensirion SPS30** (Laser Scattering Particulate Matter PM1.0–PM10) — I²C Address `0x69`

---

## Table of Contents
- [Executive Summary](#executive-summary)
1. [Error Classification Overview](#1-error-classification-overview)
2. [Category 1: Communication & Data Integrity Errors (Bus-Level)](#2-category-1-communication--data-integrity-errors-bus-level)
3. [Category 2: Timing, State & Sampling Errors (Operational)](#3-category-2-timing-state--sampling-errors-operational)
4. [Category 3: Hardware Malfunction & Physical Degradation Errors](#4-category-3-hardware-malfunction--physical-degradation-errors)
5. [Category 4: Maintenance Interruptions & Environmental Drift](#5-category-4-maintenance-interruptions--environmental-drift)
6. [Summary Reference Table: Datasheet Error Types & Handling](#6-summary-reference-table-datasheet-error-types--handling)
7. [Mapping to SSNS Firmware Implementation](#7-mapping-to-ssns-firmware-implementation)

---

## Executive Summary

This reference guide synthesizes the error handling protocols, fault flags, and operational constraints specified in the official manufacturers' datasheets for the **Sensirion SCD41**, **AMS CCS811**, and **Sensirion SPS30** environmental sensors. 

In embedded IoT architectures, raw sensor data is inherently vulnerable to physical bus noise, chemical warm-up drift, optical contamination, and electromechanical degradation. Unhandled sensor exceptions can corrupt time-series databases and trigger false positive alarms in cloud-hosted machine learning models. This document categorizes all manufacturer-specified sensor errors into four operational domains—**Communication Integrity**, **Timing & State**, **Hardware Malfunction**, and **Maintenance Windows**—and outlines the exact firmware handling rules mandated by each sensor's datasheet. Finally, it evaluates the **Smart Sensor Network System (SSNS)** firmware architecture, detailing how multi-threaded polling, health bitmasks, and warm-up suppression effectively mitigate critical datasheet errors while balancing microcontroller CPU and power constraints.

---

## 1. Error Classification Overview

Across all three manufacturers' datasheets, sensor errors and operational exceptions fall into **four distinct categories**:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      SENSOR DATASHEET ERROR TYPES                        │
├──────────────────┬──────────────────┬─────────────────┬──────────────────┤
│  1. BUS & DATA   │    2. TIMING     │  3. HARDWARE    │ 4. MAINTENANCE   │
│    INTEGRITY     │    & STATE       │  MALFUNCTION    │  & ENVIRONMENT   │
├──────────────────┼──────────────────┼─────────────────┼──────────────────┤
│ • CRC-8 Mismatch │ • Premature Read │ • Laser/Fan Err │ • Auto Fan-Clean │
│ • I²C NACK       │ • Warm-up Drift  │ • Heater Fault  │ • Pressure Drift │
│ • Register Error │ • Burn-in Period │ • MOX Degradation│ • Self-Heating   │
└──────────────────┴──────────────────┴─────────────────┴──────────────────┘
```

---

## 2. Category 1: Communication & Data Integrity Errors (Bus-Level)

These errors occur during I²C transmission due to electromagnetic interference, voltage transients, or bus collisions.

### A. Sensirion SCD41 & SPS30 — CRC Checksum Mismatch
* **Datasheet Specification:** Both Sensirion sensors transmit data in 16-bit words (2 bytes). To ensure data integrity over the physical bus, every 2-byte word is immediately followed by an 8-bit Cyclic Redundancy Check (CRC-8 checksum using polynomial $x^8 + x^5 + x^4 + 1$, initialized to `0xFF`).
* **Datasheet Mandated Handling:**
  * The host microcontroller must compute the CRC-8 on every received 16-bit word and compare it against the accompanying CRC byte.
  * **Immediate Discard Rule:** If a CRC mismatch occurs on any word within the frame, **the entire measurement frame must be discarded immediately.** Partially received or corrupted data words must never be used in calculations or stored in database archives.
  * **Write Protection:** If the sensor receives an invalid CRC from the host during a configuration or start command, it will issue an I²C NACK and ignore the command completely.

### B. AMS CCS811 — I²C Protocol & Register Addressing Errors (`ERROR_ID` Register `0xE0`)
* **Datasheet Specification:** When an illegal I²C operation occurs, bit 0 (`ERROR`) of the `STATUS` register (`0x00`) asserts high (`1`). The host must then query register `0xE0` (`ERROR_ID`) to determine the exact protocol violation:
  * **Bit 0 (`WRITE_REG_INVALID`):** The host attempted to write to an invalid, non-existent, or read-only register address.
  * **Bit 1 (`READ_REG_INVALID`):** The host attempted to read from an invalid address or read during an illegal operating state.
  * **Bit 2 (`MEASMODE_INVALID`):** The host attempted to write an unsupported measurement interval or drive mode into register `0x01` (`MEAS_MODE`).
* **Datasheet Mandated Handling:**
  * **Auto-Clearing Mechanism:** Reading register `0xE0` (`ERROR_ID`) automatically clears the error flags inside the sensor hardware.
  * The host software must log the protocol violation, correct its register addressing or drive mode configuration, and re-transmit the command.

---

## 3. Category 2: Timing, State & Sampling Errors (Operational)

These errors occur when the microcontroller attempts to read data before the sensor's physical or chemical sensing cycle is complete.

### A. Sensirion SCD41 — Premature Read (Reading Before Data is Ready)
* **Datasheet Specification:** The NDIR optical CO₂ measurement cycle requires **5,000 ms (5 seconds)** to complete. If the master issues a `read_measurement` command (`0xEC05`) before the optical acquisition finishes, the sensor cannot provide valid data.
* **Datasheet Mandated Handling:**
  1. **Polling Status Register (`0xE4B8`):** The host must query the 16-bit `get_data_ready_status` register. If the lower 11 bits are all `0` (`0x000`), the measurement is still in progress; the host must wait and poll again. Only when the status word is non-zero should the read command be issued.
  2. **I²C NACK Abort:** If the host issues a read command prematurely without checking the status register, the SCD41 will respond with an I²C NACK (Not Acknowledged) or return stale data. The host must abort the read sequence and retry later.

### B. AMS CCS811 — Warm-up & Burn-in Chemical Instability
* **Datasheet Specification:**
  * **48-Hour Burn-in:** The Metal Oxide (MOX) film requires 48 hours of continuous operation upon initial deployment to stabilize its baseline electrical resistance.
  * **20-Minute Warm-up (`1,200 s`):** On every power-on cycle, the MOX heater block requires 20 minutes to reach thermal equilibrium and chemical stability.
* **Datasheet Mandated Handling:**
  * During the 20-minute warm-up period, outputs are unstable and will exhibit extreme drift.
  * **Suppression Rule:** Host software must check bit 3 (`DATA_READY`) of the `STATUS` register (`0x00`) and **actively ignore/discard all eCO₂ and TVOC readings for the first 20 minutes after power-on** until thermal equilibrium is reached.
* **Note (not a datasheet spec):** During this instability, the sensor is empirically known to sometimes output the constant `65021` (`0xFDFD`) instead of a plausible reading. This value does **not** appear anywhere in the official ams/ScioSense CCS811 datasheet — it is a community-documented hardware quirk, not a manufacturer-specified error code. The firmware (`ccs811_driver.c`) filters it out defensively regardless of source.

---

## 4. Category 3: Hardware Malfunction & Physical Degradation Errors

These errors indicate severe mechanical, optoelectronic, or electrical failures inside the sensor hardware.

### A. Sensirion SPS30 — Electromechanical & Laser Malfunctions (`0xD206`)
* **Datasheet Specification:** The SPS30 relies on an infrared laser diode and a miniature high-speed fan to draw air through the optical scattering chamber. Its 32-bit Device Status Register (`read_device_status` command `0xD206`) flags three distinct electromechanical faults:
  * **Bit 21 (`SPEED_ERR`, Warning):** Fan speed warning/error. The fan RPM is either too high or too low (caused by airflow blockage, severe dust buildup on the impeller, or voltage sag).
  * **Bit 5 (`LASER_ERR`, Error):** Laser diode failure. The laser current or optical output is out of bounds (diode degradation or electrical short).
  * **Bit 4 (`FAN_ERR`, Error):** Fan failure. The fan motor has stalled or completely jammed mechanically.
* **Datasheet Mandated Handling:**
  * For `SPEED_ERR` (dust accumulation), the host should trigger a **manual fan-cleaning command (`0x5607`)**, which accelerates the fan to maximum RPM for 10 seconds to dislodge dust particles.
  * If `FAN_ERR` or `LASER_ERR` persist after a power cycle or system reset, the datasheet classifies this as a fatal hardware failure; the host must permanently flag the sensor as damaged and exclude its measurements.

### B. AMS CCS811 — Sensor Film & Heater Electrical Faults (`ERROR_ID` Bits 3, 4, 5)
* **Datasheet Specification:**
  * **Bit 3 (`MAX_RESISTANCE`):** The internal resistance of the MOX sensing element has exceeded maximum measurable limits. This indicates the MOX film is physically damaged, contaminated by silicones/corrosive chemicals, or open-circuited.
  * **Bit 4 (`HEATER_FAULT`):** The internal heater current is out of bounds (heater element degraded or shorted).
  * **Bit 5 (`HEATER_SUPPLY`):** The voltage supplied to the heater is incorrect (power supply brownout or instability).
* **Datasheet Mandated Handling:** When these bits assert in register `0xE0`, the host must check the system power supply voltage. If the power supply is stable at 3.3V and `MAX_RESISTANCE` or `HEATER_FAULT` remains asserted, the sensing element is permanently damaged and the sensor must be replaced.

### C. Sensirion SCD41 — On-Chip Optical / Electrical Malfunction
* **Datasheet Specification:** Failure of the infrared emitter (bulb), photo-detector, or internal signal conditioning circuitry within the NDIR optical cavity.
* **Datasheet Mandated Handling:** The datasheet provides an on-chip **Self-Test command (`0x3639`)**. The host sends this command and waits **10,000 ms (10 seconds)** while the sensor performs an internal diagnostic:
  * `0x0000`: No malfunction detected (sensor healthy).
  * `Any non-zero word`: Internal optical or electrical malfunction detected. The datasheet instructs triggering a **Soft Reset (`0x3646`)** or **ReInit (`0x3646`)**; if the non-zero code persists, the sensor must be replaced.

---

## 5. Category 4: Maintenance Interruptions & Environmental Drift

These are special operational states or physical phenomena that cause temporary measurement interruptions or systematic drift if unhandled.

### A. Sensirion SPS30 — Auto Fan-Cleaning Maintenance Window (`0x5607`)
* **Datasheet Specification:** To prevent long-term optical drift from dust settling on the laser lens, the SPS30 automatically triggers an internal fan-cleaning cycle every 168 hours (1 week) by default, accelerating the fan to maximum RPM for 10 seconds.
* **Datasheet Mandated Handling:** During this 10-second cleaning window, optical particulate scattering measurements cannot be performed. The datasheet specifies that **while fan cleaning is in progress, the sensor will hold and return the last valid measurement** or indicate via status that cleaning is active. The host software must not treat this 10-second freeze as a sensor failure or data anomaly.

### B. Sensirion SCD41 — Altitude / Pressure & Self-Heating Drift
* **Datasheet Specification:** NDIR CO₂ absorption is directly proportional to atmospheric pressure (ideal gas law). Operating at high altitudes or during low-pressure weather systems without compensation introduces systematic error.
* **Datasheet Mandated Handling:** The datasheet instructs the host to send ambient pressure compensation commands (`0xE000`) containing the current atmospheric pressure in hPa to dynamically correct the NDIR calculation.

---

## 6. Summary Reference Table: Datasheet Error Types & Handling

| Error Category | Sensor | Specific Error / Flag | Cause | Datasheet Mandated Handling Procedure |
| :--- | :--- | :--- | :--- | :--- |
| **Communication** | **SCD41 / SPS30** | CRC-8 Mismatch | Bus noise or bit flip during I²C read/write | **Discard entire measurement frame immediately.** Do not use partial words. Retry read on next cycle. |
| **Communication** | **CCS811** | `ERROR_ID` Bits 0, 1, 2 | Invalid register read/write or invalid drive mode | Read register `0xE0` to identify fault and **automatically clear error flags**. Correct host addressing/mode. |
| **Timing & State** | **SCD41** | Premature Read / NACK | Reading before 5-second NDIR cycle completes | Poll Data Ready register (`0xE4B8`) until non-zero, or abort on I²C NACK and retry later. |
| **Timing & State** | **CCS811** | Warm-up Instability | MOX heater stabilizing (first 20 mins after boot) | **Ignore/suppress all eCO₂ and TVOC readings for 20 minutes** after power-on until thermal equilibrium is reached. |
| **Hardware Fault** | **SPS30** | `SPEED_ERR` (Bit 21)<br>`FAN_ERR` (Bit 4)<br>`LASER_ERR` (Bit 5) | Dust buildup on fan, motor stall, or laser diode failure | For `SPEED_ERR`, trigger manual fan-clean (`0x5607`). If `FAN_ERR` or `LASER_ERR` persist after reset, replace sensor. |
| **Hardware Fault** | **CCS811** | `MAX_RESISTANCE`<br>`HEATER_FAULT` | MOX film damaged, open circuit, or heater shorted | Verify 3.3V power supply stability. If voltage is normal and flags persist, sensor element is damaged; replace sensor. |
| **Hardware Fault** | **SCD41** | Self-Test Failure (`0x3639`) | Internal NDIR optical or electrical malfunction | Run 10-second self-test (`0x3639`). If return word $\neq 0x0000$, execute Soft Reset (`0x3646`); if fault persists, replace sensor. |
| **Maintenance** | **SPS30** | Auto Fan-Cleaning | 10-second weekly optical maintenance cycle | **Hold last known good measurement.** Do not treat the 10-second measurement freeze as a sensor or network failure. |

---

## 7. Mapping to SSNS Firmware Implementation

To provide a transparent, academic evaluation of the **Smart Sensor Network System (SSNS)** firmware, this section categorizes how the codebase maps to manufacturer datasheet rules into three distinct tiers: **Active Mitigations**, **Indirect Architectural Mitigations**, and **Omitted / Unhandled Checks**.

### A. What Your System Handles Exceptionally Well (Active Mitigations)
Your codebase implements state-of-the-art handling for the most dangerous operational errors that would otherwise break cloud analytics or machine learning models:
1. **De-coupled Polling Threads (`sensor_aggregator.c`):** To accommodate the SCD41's 5-second NDIR cycle without triggering I²C NACKs or blocking the OpenThread radio mesh, each sensor runs in a dedicated background thread (`scd41_poll`, `ccs811_poll`, `sps30_poll`).
2. **I²C Bus Fault & Health Mask Propagation (`scd41_driver.c` / `sps30_driver.c`):** On bus NACK or I/O failure (`rc < 0`), the driver discards the frame, clears the corresponding health bit in `cache.health_mask` (`0x1` Temp/Hum, `0x2` CO₂, `0x4` PM, `0x8` TVOC), and injects `-999.0` so downstream services drop the invalid data.
3. **Warm-up & Error Code Interception (`ccs811_driver.c`):** The driver tracks system uptime and enforces the 20-minute warm-up window (`CONFIG_SENSOR_CCS811_WARMUP_SECONDS`). It also explicitly intercepts the internal hardware error constant `65021.0f` (`0xFDFD`), marking the data as invalid without throwing false error alarms.
4. **Fan-Cleaning Preservation (`sensor_aggregator.c`):** During the SPS30's 10-second automatic fan-cleaning cycle (`d.fan_cleaning`), the aggregator preserves the previous health bit state as-is and holds the last known good particulate concentrations, preventing maintenance cycles from triggering false anomaly alerts in the ML Isolation Forest.

### B. What Your System Handles Indirectly (Architectural Design)
* **SCD41 Premature Reads:** Instead of querying the Data Ready status register (`0xE4B8`) over I²C before every read, the system puts the SCD41 in a dedicated polling thread (`scd41_poll`) that sleeps for **5.5 seconds** between cycles. Because the optical NDIR cycle takes 5.0 seconds, sleeping for 5.5 seconds guarantees by design that data is ready without needing register polling.

### C. What is Currently Omitted / Not Handled (Thesis & Defense Reference)
In embedded IoT systems, implementing every diagnostic register and byte-level CRC calculation on a microcontroller consumes valuable CPU time and code space. Because all sensors are wired across short, clean PCB traces on an nRF52840 DK, SSNS prioritizes **system-level resilience** (health masks, thread isolation, ML sanity filtering) over low-level register polling. 

The following table documents the specific datasheet checks that are purposely **omitted** in the current firmware release:

| Sensor | Omitted Datasheet Feature | Code Location | Actual Code Behavior vs. Datasheet Requirement |
| :--- | :--- | :--- | :--- |
| **SCD41 & SPS30** | **CRC-8 Checksum Verification on Reads** | `scd41_driver.c`<br>`sps30_driver.c` | The drivers skip over the CRC bytes (`buf[2]`, `buf[5]`, `buf[8]`, etc.) to extract the data payload, but **do not actually compute or verify the CRC-8 polynomial** on incoming measurement bytes. *(Note: SPS30 does calculate CRC-8 when sending start commands, just not when reading data).* |
| **CCS811** | **`ERROR_ID` Register Polling (`0xE0`)** | `ccs811_driver.c` | When an I²C read fails, the driver returns `-EIO`, but it **does not query register `0xE0` (`ERROR_ID`)** to differentiate between a `HEATER_FAULT`, `HEATER_SUPPLY` brownout, or `MAX_RESISTANCE` (damaged film). |
| **SPS30** | **Device Status Register (`0xD206`) & Manual Clean** | `sps30_driver.c` | The driver never queries register `0xD206` to check for `LASER_ERR`, `FAN_ERR`, or `SPEED_ERR`, nor does it implement the manual fan-clean command (`0x5607`). |
| **SCD41** | **On-Chip Self-Test (`0x3639`) & Pressure Comp** | `scd41_driver.c` | The driver does not execute the 10-second optical self-test on boot, nor does it send ambient pressure compensation commands (`0xE000`) for high-altitude adjustment. |
