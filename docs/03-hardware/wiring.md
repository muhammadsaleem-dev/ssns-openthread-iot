# SSNS Sensor Node: Hardware Wiring Guide
i2c scan i2c@40003000 a
i2c scan i2c@40003000

ot factoryreset

This document serves as the official wiring reference for connecting the physical sensors to the **nRF52840 DK** (Development Kit). 

## ⚠️ Important Safety Warnings
* **NO HOT-SWAPPING:** Never connect or disconnect wires while the nRF52840 DK is powered on (via USB or battery). The sudden inductive spikes and ground loops can permanently destroy the sensor ICs and the DK's GPIO pins. Always unplug the USB before changing wires!
* **VOLTAGE:** Ensure you use the **VDD / 3V3** pins for power. Do not use the 5V pin, as the nRF52840 logic level is 3.3V. Sending 5V logic to the DK will fry the pins.

---

## I2C Bus Architecture
All three sensors in this project communicate over the same I2C bus (`i2c0`). I2C is designed to be daisy-chained, meaning multiple sensors can share the exact same Data (SDA) and Clock (SCL) pins as long as each sensor has a unique I2C address.

**Primary I2C Pins on nRF52840 DK:**
* **SDA (Data):** P0.26
* **SCL (Clock):** P0.27

### Where to physically find these pins on the board:
The nRF52840 DK uses the standard Arduino-style black plastic headers. If you orient the board so the USB port is at the top left:
* **Power & Ground:** Look at the bottom-left block of headers (labeled `P4`). You will find **VDD** and **GND** right next to each other here.
* **SDA & SCL:** Look at the top-left block of headers (labeled `P24` / `Arduino I2C`). The top two pins are clearly labeled **SCL** (which routes to P0.27) and **SDA** (which routes to P0.26).

---

## 1. Sensirion SCD41 (CO₂ / Temp / Humidity)
**Wire Type:** Original 4-pin JST-to-Male Wiring Harness

| Wire # | Sensor Pin (Wire Color) | Connect to nRF52840 DK |
| :--- | :--- | :--- |
| 1 | 🔴 **Red Wire (VDD)** | Plug into **VDD / 3V3** |
| 2 | ⚫ **Black Wire (GND)** | Plug into **GND** |
| 3 | 🟡 **Yellow Wire (SCL)** | Plug into **P0.27** (or the header labeled SCL) |
| 4 | 🟢 **Green Wire (SDA)** | Plug into **P0.26** (or the header labeled SDA) |

---

## 2. CCS811 (eCO₂ / TVOC)
*The CCS811 connects to the same I2C bus as the SCD41.*

**Wire Type:** 5x Female-to-Male Dupont Jumper Wires

| Wire # | Sensor Pin (Wire Color) | Connect to nRF52840 DK |
| :--- | :--- | :--- |
| 1 | 🔴 **Red Wire (VIN)** | Plug into **VDD / 3V3** |
| 2 | ~~🔴 **Red Wire (3V3)**~~ | ~~**LEAVE UNCONNECTED** *(VIN is already providing power)*~~ |
| 3 | ⚫ **Black Wire (GND)** | Plug into **GND** |
| 4 | 🟢 **Green Wire (SDA)** | Plug into **P0.26** |
| 5 | 🟤 **Brown Wire (SCL)** | Plug into **P0.27** |
| 6 | 🔵 **Blue Wire (WAKE)** | Plug into **GND** *(Required to keep sensor awake)* |
| 7 | ~~⚪ **White Wire (RST)**~~ | ~~**LEAVE UNCONNECTED** *(It has an internal pull-up resistor)*~~ |
| 8 | ~~⚪ **White Wire (INT)**~~ | ~~**LEAVE UNCONNECTED** *(We use software polling, not hardware interrupts)*~~ |

> [!NOTE]
> **CCS811 Warm-up & Burn-in Requirements**
> According to the [AMS CCS811 Datasheet](https://cdn.sparkfun.com/assets/learn_tutorials/1/4/3/CCS811_Datasheet-DS000459.pdf), the Metal-Oxide (MOX) sensor has specific physical heating requirements:
> - **48-Hour Burn-in:** Brand new sensors need 48 hours of continuous operation before the internal chemistry fully cures. During this time, they may output a hardware error code.
> - **20-Minute Warm-up:** Every time the sensor loses power (or the DK resets), the microscopic heater must run for exactly 20 minutes to reach thermal equilibrium before it will output valid CO₂ and TVOC data. The firmware will report `FAULT` during this period.

---

## 3. Sensirion SPS30 (Particulate Matter)
*The SPS30 connects to the same I2C bus.*

**Wire Type:** 5x Female-to-Male Dupont Jumper Wires

> [!WARNING]
> **Ribbon Cable Color Warning:** Third-party Dupont ribbon cable assemblies do not follow standard electronics color codes. Do **NOT** guess based on wire color alone. Always verify physical pin positions (Pins 1 to 5) on the sensor connector against your specific cable harness.

| Wire # | Sensor Pin Name (Example Color) | Connect to nRF52840 DK |
| :---: | :--- | :--- |
| **Pin 1** | 🔴 **VDD (+5V)** *(e.g. Red)* | Plug into **VDD / 5V** *(Requires 5V for internal laser)* |
| **Pin 2** | ⚪ **SDA (Data)** *(e.g. White)* | Plug into **P0.26** |
| **Pin 3** | 🟣 **SCL (Clock)** *(e.g. Purple)* | Plug into **P0.27** |
| **Pin 4** | 🟢 **SEL (Mode)** *(e.g. Green)* | Plug into **GND** *(Pulls down to select I2C mode)* |
| **Pin 5** | ⚫ **GND (Ground)** *(e.g. Black)* | Plug into **GND** |

---


