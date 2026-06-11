/**
 * @file ccs811_driver.h
 * @brief CCS811 eCO2 / TVOC driver wrapper.
 *
 * Wraps Zephyr's upstream 'ams,ccs811' sensor driver.
 *
 * ⚠ HARDWARE NOTES — READ BEFORE WIRING:
 *
 * 1. nWAKE pin:
 *    The CCS811 requires its nWAKE pin to be pulled LOW before I2C
 *    communication. Many breakout boards permanently tie nWAKE to GND
 *    (SparkFun, Adafruit), in which case you need no GPIO wiring.
 *    If your bare-chip or custom board exposes nWAKE:
 *      - Wire a GPIO to nWAKE
 *      - Set CONFIG_SENSOR_CCS811_WAKE_GPIO=y
 *      - Uncomment the wake-gpios line in the .overlay
 *    The Zephyr CCS811 driver handles the GPIO toggling automatically
 *    when wake-gpios is present in the devicetree.
 *
 * 2. Warm-up requirement:
 *    The CCS811 metal-oxide sensor needs 20 MINUTES after power-on
 *    before readings are stable and reliable. Brand-new sensors need
 *    a 48-hour burn-in on first use.
 *    During warm-up, eco2 and tvoc are reported as SENSOR_FAULT_VALUE
 *    (-999.0) and the SENSOR_HEALTH_TVOC bit is cleared.
 */

#ifndef CCS811_DRIVER_H
#define CCS811_DRIVER_H

#include <stdbool.h>

/**
 * Raw output from a single CCS811 read cycle.
 */
struct ccs811_data {
    float eco2;         /**< ppm eCO2  — range: 400 to 8192          */
    float tvoc;         /**< ppb TVOC  — range: 0 to 1187            */
    bool  valid;        /**< false on I2C error                      */
    bool  warming_up;   /**< true during the 20-minute warm-up period */
};

/**
 * @brief Initialise the CCS811 sensor device.
 * Records boot timestamp for warm-up tracking.
 * @return 0 on success, -ENODEV if not ready.
 */
int ccs811_driver_init(void);

/**
 * @brief Read eCO2 and TVOC from the CCS811.
 * Returns valid=false and warming_up=true during the warm-up period.
 * @param out  Filled with the latest values.
 * @return 0 always (warm-up is not an error), negative errno on I2C failure.
 */
int ccs811_driver_read(struct ccs811_data *out);

/**
 * @brief Release CCS811 resources on deinit.
 */
void ccs811_driver_stop(void);

#endif /* CCS811_DRIVER_H */
