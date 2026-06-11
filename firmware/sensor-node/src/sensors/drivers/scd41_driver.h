/**
 * @file scd41_driver.h
 * @brief SCD41 CO2 / Temperature / Humidity driver wrapper.
 *
 * Wraps Zephyr's upstream 'sensirion,scd4x' sensor driver.
 * Device must be declared in the boards/ board_name .overlay file.
 */

#ifndef SCD41_DRIVER_H
#define SCD41_DRIVER_H

#include <stdbool.h>

/**
 * Raw output from a single SCD41 read cycle.
 * Consumed by sensor_aggregator.c to update the shared cache.
 */
struct scd41_data {
    float temperature;  /**< °C   — range: -10 to +60 */
    float humidity;     /**< %RH  — range: 0 to 100   */
    float co2;          /**< ppm  — range: 400 to 5000 */
    bool  valid;        /**< false if the I2C read failed */
};

/**
 * @brief Initialise the SCD41 sensor device.
 * Verifies device_is_ready() via DEVICE_DT_GET (compile-time safe).
 * @return 0 on success, -ENODEV if the sensor is not responding.
 */
int scd41_driver_init(void);

/**
 * @brief Fetch and decode a measurement from the SCD41.
 * Calls sensor_sample_fetch() then sensor_channel_get() for all channels.
 * Blocks for the duration of the I2C transaction (~5 ms at 100 kHz).
 * Note: the SCD41 background measurement runs at 5 s intervals; calling this
 * more frequently than 5 s will return the same cached measurement.
 * @param out  Filled with the latest values. valid=false on I2C error.
 * @return 0 on success, negative errno on I2C or driver failure.
 */
int scd41_driver_read(struct scd41_data *out);

/**
 * @brief Stop SCD41 periodic measurement (called on deinit).
 */
void scd41_driver_stop(void);

#endif /* SCD41_DRIVER_H */
