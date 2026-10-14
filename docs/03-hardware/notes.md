

# real sensor hardware mode
west build -p always -b nrf52840dk/nrf52840 -- -DCONFIG_SENSOR_MODE_HARDWARE=y -DEXTRA_CONF_FILE=prj_hw.conf


# simmulator mode

west build -p always -b nrf52840dk/nrf52840




Sensirion SEK-SCD41 Development Board with its original wiring harness. 


* 🔴 **Red Wire (VDD):** Plug into **VDD / 3V3**
* ⚫ **Black Wire (GND):** Plug into **GND**
* 🟡 **Yellow Wire (SCL):** Plug into **P0.27** (or the header labeled SCL)
* 🟢 **Green Wire (SDA):** Plug into **P0.26** (or the header labeled SDA)

