/*
 * sensor_hw.c — Hardware sensor backend.
 *
 * Implements the sensor_interface.h API for real I2C sensors by delegating
 * to the sensor_aggregator, which runs background threads for each sensor.
 *
 * Key property: sensor_backend_read() is NON-BLOCKING.
 * It simply copies the aggregator's mutex-protected cache — no I2C access,
 * no sleeps. This is the fundamental difference from simulation mode, where
 * sensor_backend_read() blocks ~12 seconds to simulate realistic latencies.
 *
 * The 60-second warm-up window in main.c ensures that all three sensor
 * threads have had time to populate the cache before the first transmission.
 *
 * Selected when CONFIG_SENSOR_MODE_HARDWARE=y.
 */

#include "sensor_interface.h"
#include "sensor_aggregator.h"
#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>

LOG_MODULE_REGISTER(sensor_hw, LOG_LEVEL_INF);

/*
 * The full struct definition lives here (not in the header) so that the
 * opaque pointer in sensor_interface.h is truly opaque to callers.
 * Allocated statically — no heap usage.
 */
struct sensor_context {
    bool running;
};

static struct sensor_context hw_ctx;

int sensor_backend_init(struct sensor_context **ctx)
{
    int rc = sensor_aggregator_start();

    if (rc < 0) {
        LOG_ERR("Hardware sensor backend: aggregator start failed (rc=%d)", rc);
        return rc;
    }

    hw_ctx.running = true;
    *ctx = &hw_ctx;

    LOG_INF("[HW] Hardware sensor backend initialised");
    LOG_INF("[HW] SCD41 + CCS811 + SPS30 background threads running");
    LOG_INF("[HW] Cache will be valid within ~6 s — main thread warm-up covers this");
    return 0;
}

int sensor_backend_read(struct sensor_context *ctx, struct sensor_readings *out)
{
    ARG_UNUSED(ctx);

    /* Non-blocking: copy the latest aggregator cache */
    sensor_aggregator_get(out);
    return 0;
}

void sensor_backend_deinit(struct sensor_context *ctx)
{
    ARG_UNUSED(ctx);

    sensor_aggregator_stop();
    hw_ctx.running = false;

    LOG_INF("[HW] Hardware sensor backend deinitialised");
}
