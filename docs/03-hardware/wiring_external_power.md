# SSNS Sensor Node: External Power Wiring Guide

This is the definitive, easiest-to-follow guide for wiring all three sensors (SCD41, CCS811, SPS30) to your **nRF52840 DK** using an external breadboard power supply. 

This method protects your microcontroller from power spikes and provides the sensors with clean, dedicated energy.

---

## 🔌 Phase 1: Preparing the Power
First, we will set up the breadboard and the power supply module. 



1. **Plug in the Module**: Attach your MB102 Power Module to the end of the breadboard so the pins align with the outer `+` and `-` rails.
2. **Set the Jumpers**: 
   - Move the little yellow plastic jumper on the **LEFT** side so it covers the **3.3V** pins.
   - Move the little yellow plastic jumper on the **RIGHT** side so it covers the **5V** pins.
   


> [!IMPORTANT]
> Do **NOT** plug the power module into the wall yet. We will do this at the very end.

---

## 🧠 Phase 2: Connecting the nRF52840 DK
Because the power module is supplying the electricity, we only need jumper wires to connect the "brain" (the nRF52840 DK) to the breadboard I2C bus rows.

| Wire Color | Connect to nRF52840 DK | Connect to Breadboard | Why we do this |
| :--- | :--- | :--- | :--- |
| ⚫ **Black** *(Optional)* | **GND** | **LEFT `-` rail** | **Reference:** Shares ground. *(Note: If both nRF DK and MB102 are powered via USB from the same Mac, ground is shared via USB).* |
| 🟢 **Green / Blue** | **P0.26 (SDA)** | **Row 12** | Sends I2C Data |
| ⚪ **White / Gray** | **P0.27 (SCL)** | **Row 24** | Sends I2C Clock |

> [!TIP]
> **Why Row 12 and Row 24?** Spacing the data bus (Row 12) and clock bus (Row 24) far apart gives you plenty of room to plug in multiple sensor jumper wires without crowding.

---

## 📡 Phase 3: Wiring the Sensors
Now we will attach the sensors to the rails and bus rows we just created.



### Sensor 1: SCD41 (CO₂ / Temp / Hum)
*Uses your 1x JST-to-Male wire harness.*
- [ ] 🔴 **Red (VDD)** ➔ Plug into **LEFT `+` rail** (3.3V)
- [ ] ⚫ **Black (GND)** ➔ Plug into **LEFT `-` rail** (GND)
- [ ] 🟢 **Green (SDA)** ➔ Plug into **Row 12** (Data)
- [ ] 🟡 **Yellow (SCL)** ➔ Plug into **Row 24** (Clock)

### Sensor 2: CCS811 (eCO₂ / TVOC)
*Uses 5x Female-to-Male wires.*
- [ ] 🔴 **Red (VIN)** ➔ Plug into **LEFT `+` rail** (3.3V)
- [ ] ⚫ **Black (GND)** ➔ Plug into **LEFT `-` rail** (GND)
- [ ] 🔵 **Blue (WAKE)** ➔ Plug into **LEFT `-` rail** (GND) *(Mandatory to wake microchip)*
- [ ] 🟢 **Green (SDA)** ➔ Plug into **Row 12** (Data)
- [ ] 🟤 **Brown (SCL)** ➔ Plug into **Row 24** (Clock)

### Sensor 3: SPS30 (Particulate Matter)
*Uses 5x Female-to-Male Dupont wires.*

> [!WARNING]
> **THE AFTERMARKET RIBBON CABLE TRAP:** Third-party Dupont ribbon cables do not follow standard electronics color codes. Do **NOT** guess based on wire color alone. Always wire strictly by the physical pin position (Pins 1 to 5) on the sensor connector.

| Wire Color (Pin #) | Sensor Pin Name | Connect to Breadboard | Why we do this |
| :--- | :---: | :--- | :--- |
| 🔴 **Red** *(Pin 1)* | **VDD (+5V)** | ⚠️ **RIGHT `+` rail** | Powers internal laser/fan *(Requires 5V)* |
| ⚪ **White** *(Pin 2)* | **SDA (Data)** | **Row 12** | I2C Data Bus |
| 🟣 **Purple** *(Pin 3)* | **SCL (Clock)** | **Row 24** | I2C Clock Bus |
| 🟢 **Green** *(Pin 4)* | **SEL (Mode)** | **RIGHT `-` rail** *(GND)* | **Mandatory:** Pull to GND to select I2C mode |
| ⚫ **Black** *(Pin 5)* | **GND (Ground)**| **RIGHT `-` rail** *(GND)* | True Ground |

*(Example: If your university lab Dupont ribbon cable has colors `Red, White, Purple, Green, Black` from Pin 1 to Pin 5, then Red=+5V, White=Row 12, Purple=Row 24, Green=GND, Black=GND).*

---

## 🚀 Phase 4: Power Up Sequence
To prevent voltage spikes from crashing the board, follow this exact sequence:

1. [ ] Make sure the nRF52840 DK is **unplugged** from your computer.
2. [ ] Plug the external power module into power (USB or wall adapter).
3. [ ] Press the white button on the power module. The green LED will turn on.
4. [ ] Finally, plug the nRF52840 DK into your computer via USB.

**You're done!** The sensors are safely powered, and the Zephyr firmware will automatically detect and poll all three of them.
