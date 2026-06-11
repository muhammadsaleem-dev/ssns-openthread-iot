/*
 * scd41_driver.c — SCD41 CO2/Temperature/Humidity RAW I2C driver
 */

#include "scd41_driver.h"
#include "sensor_interface.h"
#include <zephyr/kernel.h>
#include <zephyr/device.h>
#include <zephyr/drivers/i2c.h>
#include <zephyr/logging/log.h>

LOG_MODULE_REGISTER(scd41_drv, LOG_LEVEL_INF);

#define SCD41_I2C_ADDR 0x62

static const struct device *i2c_dev = DEVICE_DT_GET(DT_NODELABEL(i2c0));

int scd41_driver_init(void)
{
    if (!device_is_ready(i2c_dev)) {
        LOG_ERR("SCD41: I2C device not ready");
        return -ENODEV;
    }

    /* Stop periodic measurement first just in case */
    uint8_t stop_cmd[2] = {0x3f, 0x86};
    i2c_write(i2c_dev, stop_cmd, 2, SCD41_I2C_ADDR);
    k_sleep(K_MSEC(500));

    /* Start periodic measurement */
    uint8_t start_cmd[2] = {0x21, 0xb1};
    int rc = i2c_write(i2c_dev, start_cmd, 2, SCD41_I2C_ADDR);
    if (rc < 0) {
        LOG_ERR("SCD41: Failed to start measurement");
        return rc;
    }

    LOG_INF("SCD41: initialised OK — running periodic measurement at 5s intervals");
    return 0;
}

int scd41_driver_read(struct scd41_data *out)
{
    uint8_t read_cmd[2] = {0xec, 0x05};
    uint8_t buf[9];

    int rc = i2c_write(i2c_dev, read_cmd, 2, SCD41_I2C_ADDR);
    if (rc < 0) {
        out->valid = false;
        return rc;
    }
    
    k_sleep(K_MSEC(2)); /* Execution time for read_measurement is 1ms */

    rc = i2c_read(i2c_dev, buf, 9, SCD41_I2C_ADDR);
    if (rc < 0) {
        out->valid = false;
        return rc;
    }

    /* CO2 is in bytes 0 and 1 */
    uint16_t co2_raw = (buf[0] << 8) | buf[1];
    out->co2 = (float)co2_raw;

    /* Temp is in bytes 3 and 4 */
    uint16_t temp_raw = (buf[3] << 8) | buf[4];
    out->temperature = -45.0f + 175.0f * ((float)temp_raw / 65535.0f);

    /* Hum is in bytes 6 and 7 */
    uint16_t hum_raw = (buf[6] << 8) | buf[7];
    out->humidity = 100.0f * ((float)hum_raw / 65535.0f);

    out->valid = true;

    LOG_DBG("SCD41: %.1f°C  %.1f%%RH  %.0f ppm CO2",
            (double)out->temperature, (double)out->humidity, (double)out->co2);
    return 0;
}

void scd41_driver_stop(void)
{
    uint8_t stop_cmd[2] = {0x3f, 0x86};
    i2c_write(i2c_dev, stop_cmd, 2, SCD41_I2C_ADDR);
    LOG_INF("SCD41: stopped");
}
