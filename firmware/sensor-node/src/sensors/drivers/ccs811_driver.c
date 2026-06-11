/*
 * ccs811_driver.c — CCS811 eCO2/TVOC RAW I2C driver
 */

#include "ccs811_driver.h"
#include "sensor_interface.h"
#include <zephyr/kernel.h>
#include <zephyr/device.h>
#include <zephyr/drivers/i2c.h>
#include <zephyr/logging/log.h>

LOG_MODULE_REGISTER(ccs811_drv, LOG_LEVEL_INF);

#define CCS811_I2C_ADDR 0x5A

/* ---------- CCS811 registers ---------- */
#define CCS811_MEAS_MODE  0x01
#define CCS811_ALG_RESULT 0x02
#define CCS811_HW_ID      0x20
#define CCS811_APP_START  0xF4

static const struct device *i2c_dev = DEVICE_DT_GET(DT_NODELABEL(i2c0));

/* Timestamp recorded at init — used to enforce warm-up period */
static int64_t boot_uptime_ms;

static int ccs811_read_reg(uint8_t reg, uint8_t *buf, uint32_t len)
{
    return i2c_write_read(i2c_dev, CCS811_I2C_ADDR, &reg, 1, buf, len);
}

static int ccs811_write_reg(uint8_t reg, const uint8_t *buf, uint32_t len)
{
    uint8_t tx[8];
    if (len > sizeof(tx) - 1) {
        return -EINVAL;
    }
    tx[0] = reg;
    memcpy(&tx[1], buf, len);
    return i2c_write(i2c_dev, tx, len + 1, CCS811_I2C_ADDR);
}

int ccs811_driver_init(void)
{
    if (!device_is_ready(i2c_dev)) {
        LOG_ERR("CCS811: I2C device not ready");
        return -ENODEV;
    }

    uint8_t id = 0;
    if (ccs811_read_reg(CCS811_HW_ID, &id, 1) != 0) {
        LOG_ERR("CCS811: Failed to read HW_ID");
        return -EIO;
    }
    if (id != 0x81) {
        LOG_ERR("CCS811: unexpected HW_ID 0x%02x (want 0x81)", id);
        return -ENODEV;
    }

    uint8_t app_start = CCS811_APP_START;
    if (i2c_write(i2c_dev, &app_start, 1, CCS811_I2C_ADDR) != 0) {
        LOG_ERR("CCS811: Failed to send APP_START");
        return -EIO;
    }
    k_msleep(100);

    uint8_t mode = 0x10;   /* drive mode 1: 1 measurement/second */
    if (ccs811_write_reg(CCS811_MEAS_MODE, &mode, 1) != 0) {
        LOG_ERR("CCS811: Failed to set MEAS_MODE");
        return -EIO;
    }

    boot_uptime_ms = k_uptime_get();

    int warmup_min = CONFIG_SENSOR_CCS811_WARMUP_SECONDS / 60;
    LOG_INF("CCS811: initialised OK — warm-up period: %d minutes", warmup_min);
    LOG_WRN("CCS811: readings suppressed for %d min after boot", warmup_min);
    return 0;
}

int ccs811_driver_read(struct ccs811_data *out)
{
    int64_t elapsed_ms  = k_uptime_get() - boot_uptime_ms;
    int64_t warmup_ms   = (int64_t)CONFIG_SENSOR_CCS811_WARMUP_SECONDS * 1000LL;

    /* --- Warm-up guard -------------------------------------------------- */
    if (elapsed_ms < warmup_ms) {
        out->eco2       = SENSOR_FAULT_VALUE;
        out->tvoc       = SENSOR_FAULT_VALUE;
        out->valid      = false;
        out->warming_up = true;
        return 0;  /* Not an error — caller distinguishes via warming_up flag */
    }

    /* --- Normal read ---------------------------------------------------- */
    uint8_t rx[8];
    if (ccs811_read_reg(CCS811_ALG_RESULT, rx, sizeof(rx)) != 0) {
        out->valid      = false;
        out->warming_up = false;
        return -EIO;
    }

    out->eco2 = (float)(((uint16_t)rx[0] << 8) | rx[1]);
    out->tvoc = (float)(((uint16_t)rx[2] << 8) | rx[3]);

    /* Filter out 65021 (0xFDFD) which is a common CCS811 internal hardware error code,
     * often thrown during the 48-hour burn-in period even after the 20m warmup. */
    if (out->eco2 == 65021.0f || out->tvoc == 65021.0f) {
        out->eco2       = SENSOR_FAULT_VALUE;
        out->tvoc       = SENSOR_FAULT_VALUE;
        out->valid      = false;
        out->warming_up = true;
        return 0;
    }

    out->valid      = true;
    out->warming_up = false;

    LOG_DBG("CCS811: %.0f ppm eCO2   %.0f ppb TVOC",
            (double)out->eco2, (double)out->tvoc);
    return 0;
}

void ccs811_driver_stop(void)
{
    LOG_INF("CCS811: stopped");
}
