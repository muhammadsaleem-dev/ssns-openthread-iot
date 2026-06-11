/*
 * sps30_driver.c — SPS30 Particulate Matter RAW I2C driver
 */

#include "sps30_driver.h"
#include "sensor_interface.h"
#include <zephyr/kernel.h>
#include <zephyr/device.h>
#include <zephyr/drivers/i2c.h>
#include <zephyr/logging/log.h>

LOG_MODULE_REGISTER(sps30_drv, LOG_LEVEL_INF);

#define SPS30_I2C_ADDR 0x69

static const struct device *i2c_dev = DEVICE_DT_GET(DT_NODELABEL(i2c0));

static uint8_t sps30_calc_crc(uint8_t data[2]) {
    uint8_t crc = 0xFF;
    for (int i = 0; i < 2; i++) {
        crc ^= data[i];
        for (uint8_t bit = 8; bit > 0; --bit) {
            if (crc & 0x80) {
                crc = (crc << 1) ^ 0x31u;
            } else {
                crc = (crc << 1);
            }
        }
    }
    return crc;
}

int sps30_driver_init(void)
{
    if (!device_is_ready(i2c_dev)) {
        LOG_ERR("SPS30: I2C device not ready");
        return -ENODEV;
    }

    /* Start Measurement: 0x0010 + 0x0300 + CRC */
    uint8_t arg[2] = {0x03, 0x00};
    uint8_t crc = sps30_calc_crc(arg);
    uint8_t cmd[5] = {0x00, 0x10, arg[0], arg[1], crc};

    int rc = i2c_write(i2c_dev, cmd, 5, SPS30_I2C_ADDR);
    if (rc < 0) {
        LOG_ERR("SPS30: Failed to start measurement");
        return rc;
    }

    LOG_INF("SPS30: initialised OK — running periodic measurement");
    return 0;
}

int sps30_driver_read(struct sps30_data *out)
{
    uint8_t cmd[2] = {0x03, 0x00};
    uint8_t buf[60];

    int rc = i2c_write(i2c_dev, cmd, 2, SPS30_I2C_ADDR);
    if (rc < 0) {
        out->valid = false;
        return rc;
    }

    rc = i2c_read(i2c_dev, buf, 60, SPS30_I2C_ADDR);
    if (rc < 0) {
        out->valid = false;
        return rc;
    }

    /* We need to parse the first 4 floats (PM1.0, PM2.5, PM4.0, PM10) 
     * Each float is 6 bytes: b0, b1, CRC, b2, b3, CRC */
    float pm_vals[4];
    for (int i = 0; i < 4; i++) {
        int offset = i * 6;
        uint32_t val = (buf[offset] << 24) | (buf[offset+1] << 16) | (buf[offset+3] << 8) | buf[offset+4];
        memcpy(&pm_vals[i], &val, sizeof(float));
    }

    out->pm1  = pm_vals[0];
    out->pm25 = pm_vals[1];
    out->pm4  = pm_vals[2];
    out->pm10 = pm_vals[3];
    out->valid  = true;

    LOG_DBG("SPS30: PM2.5=%.1f", (double)out->pm25);
    return 0;
}

void sps30_driver_stop(void)
{
    uint8_t cmd[2] = {0x01, 0x04};
    i2c_write(i2c_dev, cmd, 2, SPS30_I2C_ADDR);
    LOG_INF("SPS30: stopped");
}
