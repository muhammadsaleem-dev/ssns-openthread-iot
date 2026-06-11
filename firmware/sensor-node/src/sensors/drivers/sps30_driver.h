/**
 * @file sps30_driver.h
 * @brief SPS30 Particulate Matter driver wrapper.
 *
 * Wraps Zephyr's upstream 'sensirion,sps30' sensor driver.
 *
 * Fan-cleaning behaviour:
 *   The SPS30 automatically runs a 10-second fan-cleaning cycle every 168 h.
 *   During this window, no new PM data is produced. This driver detects the
 *   blackout via consecutive fetch failures and holds the last-good reading
 *   (fan_cleaning=true) rather than declaring a fault.
 *   A fault is only declared after FAULT_THRESHOLD_FAILS consecutive failures
 *   that persist beyond the 12-second blackout window.
 */

#ifndef SPS30_DRIVER_H
#define SPS30_DRIVER_H

#include <stdbool.h>

/**
 * Raw output from a single SPS30 read cycle.
 */
struct sps30_data {
    float pm1;          /**< µg/m³  PM1.0  */
    float pm25;         /**< µg/m³  PM2.5  */
    float pm4;          /**< µg/m³  PM4.0  */
    float pm10;         /**< µg/m³  PM10   */
    bool  valid;        /**< false on persistent I2C fault */
    bool  fan_cleaning; /**< true during 10 s fan-clean blackout (data is stale but not faulty) */
};

/**
 * @brief Initialise the SPS30 sensor device.
 * @return 0 on success, -ENODEV if device not ready.
 */
int sps30_driver_init(void);

/**
 * @brief Read PM values from the SPS30.
 * Handles fan-cleaning blackout: during the 10-second window, returns the
 * last good reading with fan_cleaning=true and valid=true.
 * @param out  Filled with PM values (or last cached values during fan-clean).
 * @return 0 on success or fan-clean, negative errno on real fault.
 */
int sps30_driver_read(struct sps30_data *out);

/**
 * @brief Stop SPS30 measurements on deinit.
 */
void sps30_driver_stop(void);

#endif /* SPS30_DRIVER_H */
