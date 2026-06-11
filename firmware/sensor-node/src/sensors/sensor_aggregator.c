/*
 * sensor_aggregator.c — Background sensor polling threads.
 *
 * Architecture:
 *
 *  ┌────────────────┐  ┌─────────────────┐  ┌────────────────┐
 *  │  scd41_poll    │  │  ccs811_poll    │  │  sps30_poll    │
 *  │  (5.5 s sleep) │  │  (1.0 s sleep)  │  │  (1.5 s sleep) │
 *  │  Priority: 7   │  │  Priority: 7    │  │  Priority: 7   │
 *  └───────┬────────┘  └────────┬────────┘  └───────┬────────┘
 *          │                    │                    │
 *          └────────────────────┼────────────────────┘
 *                               │
 *                    ┌──────────┴──────────┐
 *                    │   cache + mutex      │  ← k_mutex
 *                    └──────────┬──────────┘
 *                               │
 *                    sensor_aggregator_get()   ← non-blocking copy
 *                               │
 *                    sensor_backend_read()   (sensor_hw.c)
 *
 * Health mask logic:
 *   - Threads set health bits to 1 on successful reads.
 *   - Threads clear health bits on confirmed faults.
 *   - warm_up / fan_cleaning states preserve the LAST health bit value
 *     (neither fault nor success) — see CCS811 and SPS30 below.
 */

#include "sensor_aggregator.h"
#include "sensor_interface.h"
#include "drivers/scd41_driver.h"
#include "drivers/ccs811_driver.h"
#include "drivers/sps30_driver.h"
#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include <string.h>

LOG_MODULE_REGISTER(sensor_agg, LOG_LEVEL_INF);

/* ---------------------------------------------------------------------------
 * Thread stacks (sizes come from Kconfig)
 * ---------------------------------------------------------------------------*/
#ifdef CONFIG_SENSOR_SCD41
K_THREAD_STACK_DEFINE(scd41_stack, CONFIG_SENSOR_AGGREGATOR_SCD41_STACK);
static struct k_thread scd41_thread_data;
#endif

#ifdef CONFIG_SENSOR_CCS811
K_THREAD_STACK_DEFINE(ccs811_stack, CONFIG_SENSOR_AGGREGATOR_CCS811_STACK);
static struct k_thread ccs811_thread_data;
#endif

#ifdef CONFIG_SENSOR_SPS30
K_THREAD_STACK_DEFINE(sps30_stack, CONFIG_SENSOR_AGGREGATOR_SPS30_STACK);
static struct k_thread sps30_thread_data;
#endif

/* ---------------------------------------------------------------------------
 * Shared cache
 * ---------------------------------------------------------------------------*/
static struct sensor_readings cache;
static struct k_mutex          cache_mutex;

/* ---------------------------------------------------------------------------
 * SCD41 polling thread — runs every 5.5 s
 * ---------------------------------------------------------------------------*/
#ifdef CONFIG_SENSOR_SCD41
static void scd41_thread_fn(void *p1, void *p2, void *p3)
{
    ARG_UNUSED(p1); ARG_UNUSED(p2); ARG_UNUSED(p3);

    while (1) {
        struct scd41_data d;
        int rc = scd41_driver_read(&d);

        k_mutex_lock(&cache_mutex, K_FOREVER);

        if (rc == 0 && d.valid) {
            cache.temperature  = d.temperature;
            cache.humidity     = d.humidity;
            cache.co2          = d.co2;
            /* Both Temp/Hum and CO2 come from SCD41 */
            cache.health_mask |= (SENSOR_HEALTH_TEMP_HUM | SENSOR_HEALTH_CO2);
        } else {
            cache.temperature  = SENSOR_FAULT_VALUE;
            cache.humidity     = SENSOR_FAULT_VALUE;
            cache.co2          = SENSOR_FAULT_VALUE;
            cache.health_mask &= ~(SENSOR_HEALTH_TEMP_HUM | SENSOR_HEALTH_CO2);
            LOG_ERR("SCD41 read failed (rc=%d) — health bits cleared", rc);
        }

        k_mutex_unlock(&cache_mutex);

        /* SCD41 measurement period = 5 s. Sleep 5.5 s to guarantee a new
         * measurement is ready on the next fetch. */
        k_sleep(K_MSEC(5500));
    }
}
#endif /* CONFIG_SENSOR_SCD41 */

/* ---------------------------------------------------------------------------
 * CCS811 polling thread — runs every 1 s
 * ---------------------------------------------------------------------------*/
#ifdef CONFIG_SENSOR_CCS811
static void ccs811_thread_fn(void *p1, void *p2, void *p3)
{
    ARG_UNUSED(p1); ARG_UNUSED(p2); ARG_UNUSED(p3);

    while (1) {
        struct ccs811_data d;
        int rc = ccs811_driver_read(&d);

        k_mutex_lock(&cache_mutex, K_FOREVER);

        if (rc == 0 && d.valid && !d.warming_up) {
            /* Good reading */
            cache.eco2        = d.eco2;
            cache.tvoc        = d.tvoc;
            cache.health_mask |= SENSOR_HEALTH_TVOC;

        } else if (d.warming_up) {
            /* Warm-up period: suppress readings, clear health bit.
             * This is EXPECTED behaviour, not a fault — but we still
             * clear the health bit to signal "data not ready" downstream. */
            cache.eco2        = SENSOR_FAULT_VALUE;
            cache.tvoc        = SENSOR_FAULT_VALUE;
            cache.health_mask &= ~SENSOR_HEALTH_TVOC;
            /* No error log — the driver already logs "N min remaining" */

        } else {
            /* Real I2C fault */
            cache.eco2        = SENSOR_FAULT_VALUE;
            cache.tvoc        = SENSOR_FAULT_VALUE;
            cache.health_mask &= ~SENSOR_HEALTH_TVOC;
            LOG_ERR("CCS811 read failed (rc=%d)", rc);
        }

        k_mutex_unlock(&cache_mutex);

        k_sleep(K_SECONDS(1));
    }
}
#endif /* CONFIG_SENSOR_CCS811 */

/* ---------------------------------------------------------------------------
 * SPS30 polling thread — runs every 1.5 s
 * ---------------------------------------------------------------------------*/
#ifdef CONFIG_SENSOR_SPS30
static void sps30_thread_fn(void *p1, void *p2, void *p3)
{
    ARG_UNUSED(p1); ARG_UNUSED(p2); ARG_UNUSED(p3);

    while (1) {
        struct sps30_data d;
        int rc = sps30_driver_read(&d);

        k_mutex_lock(&cache_mutex, K_FOREVER);

        if (rc == 0 && d.valid) {
            /* Good reading OR fan-clean (driver holds last-good values) */
            cache.pm1  = d.pm1;
            cache.pm25 = d.pm25;
            cache.pm4  = d.pm4;
            cache.pm10 = d.pm10;

            if (d.fan_cleaning) {
                /* During fan-clean, keep health bit AS-IS (neither set nor clear).
                 * Values are stale but trustworthy — no false alarm on dashboard. */
                LOG_DBG("SPS30: fan-clean in progress, health bit preserved");
            } else {
                cache.health_mask |= SENSOR_HEALTH_PM;
            }

        } else {
            /* Persistent I2C fault (confirmed by driver) */
            cache.pm1  = SENSOR_FAULT_VALUE;
            cache.pm25 = SENSOR_FAULT_VALUE;
            cache.pm4  = SENSOR_FAULT_VALUE;
            cache.pm10 = SENSOR_FAULT_VALUE;
            cache.health_mask &= ~SENSOR_HEALTH_PM;
            LOG_ERR("SPS30 read failed (rc=%d) — health bit cleared", rc);
        }

        k_mutex_unlock(&cache_mutex);

        /* SPS30 measurements are ready every 1 s. Sleep 1.5 s for margin. */
        k_sleep(K_MSEC(1500));
    }
}
#endif /* CONFIG_SENSOR_SPS30 */

/* ---------------------------------------------------------------------------
 * Public API
 * ---------------------------------------------------------------------------*/

int sensor_aggregator_start(void)
{
    int any_init_ok = 0;

    k_mutex_init(&cache_mutex);

    /* Pre-fill cache with fault values — threads will overwrite as they run */
    k_mutex_lock(&cache_mutex, K_FOREVER);
    cache.temperature = SENSOR_FAULT_VALUE;
    cache.humidity    = SENSOR_FAULT_VALUE;
    cache.co2         = SENSOR_FAULT_VALUE;
    cache.tvoc        = SENSOR_FAULT_VALUE;
    cache.eco2        = SENSOR_FAULT_VALUE;
    cache.pm1         = SENSOR_FAULT_VALUE;
    cache.pm25        = SENSOR_FAULT_VALUE;
    cache.pm4         = SENSOR_FAULT_VALUE;
    cache.pm10        = SENSOR_FAULT_VALUE;
    cache.light       = 500.0f;   /* Constant indoor fallback (no light sensor) */
    cache.health_mask = 0x00;     /* All faults until threads report OK */
    k_mutex_unlock(&cache_mutex);

#ifdef CONFIG_SENSOR_SCD41
    {
        int rc = scd41_driver_init();
        if (rc < 0) {
            LOG_ERR("SCD41 init failed (rc=%d) — continuing without it", rc);
        } else {
            any_init_ok = 1;
            k_thread_create(&scd41_thread_data, scd41_stack,
                            K_THREAD_STACK_SIZEOF(scd41_stack),
                            scd41_thread_fn, NULL, NULL, NULL,
                            7, 0, K_NO_WAIT);
            k_thread_name_set(&scd41_thread_data, "scd41_poll");
            LOG_INF("SCD41 polling thread started");
        }
    }
#endif

#ifdef CONFIG_SENSOR_CCS811
    {
        int rc = ccs811_driver_init();
        if (rc < 0) {
            LOG_ERR("CCS811 init failed (rc=%d) — continuing without it", rc);
        } else {
            any_init_ok = 1;
            k_thread_create(&ccs811_thread_data, ccs811_stack,
                            K_THREAD_STACK_SIZEOF(ccs811_stack),
                            ccs811_thread_fn, NULL, NULL, NULL,
                            7, 0, K_NO_WAIT);
            k_thread_name_set(&ccs811_thread_data, "ccs811_poll");
            LOG_INF("CCS811 polling thread started");
        }
    }
#endif

#ifdef CONFIG_SENSOR_SPS30
    {
        int rc = sps30_driver_init();
        if (rc < 0) {
            LOG_ERR("SPS30 init failed (rc=%d) — continuing without it", rc);
        } else {
            any_init_ok = 1;
            k_thread_create(&sps30_thread_data, sps30_stack,
                            K_THREAD_STACK_SIZEOF(sps30_stack),
                            sps30_thread_fn, NULL, NULL, NULL,
                            7, 0, K_NO_WAIT);
            k_thread_name_set(&sps30_thread_data, "sps30_poll");
            LOG_INF("SPS30 polling thread started");
        }
    }
#endif

    if (!any_init_ok) {
        LOG_ERR("All sensor inits failed — no data will be collected");
    }

    LOG_INF("Sensor aggregator started — cache will populate within ~6 s");
    return 0;
}

void sensor_aggregator_get(struct sensor_readings *out)
{
    k_mutex_lock(&cache_mutex, K_FOREVER);
    *out = cache;
    k_mutex_unlock(&cache_mutex);
}

void sensor_aggregator_stop(void)
{
#ifdef CONFIG_SENSOR_SCD41
    k_thread_abort(&scd41_thread_data);
    scd41_driver_stop();
#endif

#ifdef CONFIG_SENSOR_CCS811
    k_thread_abort(&ccs811_thread_data);
    ccs811_driver_stop();
#endif

#ifdef CONFIG_SENSOR_SPS30
    k_thread_abort(&sps30_thread_data);
    sps30_driver_stop();
#endif

    LOG_INF("Sensor aggregator stopped");
}
