/*
 * sensor_sim.c — Simulation sensor backend for SSNS Sensor Node.
 *
 * Implements the sensor_interface.h API using a realistic random-walk model:
 *   - Slow baseline drift for all channels
 *   - Trend events: CO2 spike or PM2.5 spike (1% probability per read cycle)
 *   - 15% per-sensor random failure injection with health mask updates
 *   - Blocking latencies that mirror real sensor read times:
 *       100 ms  — SCD41 temperature/humidity
 *       10000 ms — SCD41 CO2 (deliberate "slow sensor" simulation)
 *       1000 ms  — SPS30 particulate matter
 *       1000 ms  — CCS811 TVOC/eCO2
 *
 * Selected when CONFIG_SENSOR_MODE_SIMULATION=y (the build default).
 * No hardware required. The old sensors.c/sensors.h files remain on disk
 * for reference but are excluded from compilation.
 *
 * SWITCHING TO HARDWARE:
 *   west build -p always -b nrf52840dk/nrf52840 \
 *     -- -DCONFIG_SENSOR_MODE_HARDWARE=y -DEXTRA_CONF_FILE=prj_hw.conf
 */

#include "sensor_interface.h"
#include <zephyr/kernel.h>
#include <zephyr/random/random.h>
#include <zephyr/logging/log.h>
#include <stdint.h>
#include <stdbool.h>

LOG_MODULE_REGISTER(sensor_sim, LOG_LEVEL_INF);

/* ---------------------------------------------------------------------------
 * Internal simulation state (the "context")
 * ---------------------------------------------------------------------------
 * Allocated statically — no dynamic memory.
 * The opaque pointer in sensor_interface.h resolves to this type here only.
 */
struct sensor_context {
    /* Slowly-drifting baselines */
    float base_temp;
    float base_hum;
    float base_co2;
    float base_tvoc;
    float base_pm25;
    float base_light;

    /* Trend-event state */
    bool  trend_active;
    int   trend_ticks;
    float co2_slope;
    float pm25_slope;
};

static struct sensor_context sim_ctx;

/* ---------------------------------------------------------------------------
 * Private helpers
 * ---------------------------------------------------------------------------*/

static float rand_float(float lo, float hi)
{
    uint32_t r = sys_rand32_get();
    float n = (float)r / (float)UINT32_MAX;  /* normalised [0, 1] */
    return lo + n * (hi - lo);
}

static float clampf(float v, float lo, float hi)
{
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
}

/* ---------------------------------------------------------------------------
 * sensor_interface.h implementation
 * ---------------------------------------------------------------------------*/

int sensor_backend_init(struct sensor_context **ctx)
{
    sim_ctx.base_temp  = rand_float(18.0f, 26.0f);
    sim_ctx.base_hum   = rand_float(30.0f, 60.0f);
    sim_ctx.base_co2   = rand_float(400.0f, 800.0f);
    sim_ctx.base_tvoc  = rand_float(0.0f,  100.0f);
    sim_ctx.base_pm25  = rand_float(0.0f,   10.0f);
    sim_ctx.base_light = rand_float(100.0f, 800.0f);
    sim_ctx.trend_active = false;
    sim_ctx.trend_ticks  = 0;
    sim_ctx.co2_slope    = 0.0f;
    sim_ctx.pm25_slope   = 0.0f;

    *ctx = &sim_ctx;
    LOG_INF("[SIM] Sensor simulation backend initialised");
    LOG_INF("[SIM] Baselines: temp=%.1f°C  hum=%.1f%%  co2=%.0fppm",
            (double)sim_ctx.base_temp,
            (double)sim_ctx.base_hum,
            (double)sim_ctx.base_co2);
    return 0;
}

int sensor_backend_read(struct sensor_context *ctx, struct sensor_readings *out)
{
    struct sensor_context *s = ctx;

    /* --- Slow baseline drift -------------------------------------------- */
    s->base_temp  += rand_float(-0.01f,  0.01f);
    s->base_hum   += rand_float(-0.05f,  0.05f);
    s->base_tvoc  += rand_float(-0.2f,   0.2f);
    s->base_light += rand_float(-0.5f,   0.5f);

    /* --- Trend events (1% chance to start per tick) --------------------- */
    if (!s->trend_active && rand_float(0.0f, 1.0f) < 0.01f) {
        s->trend_active = true;
        s->trend_ticks  = (int)rand_float(30.0f, 90.0f);
        if (rand_float(0.0f, 1.0f) < 0.5f) {
            /* CO2 spike event */
            s->co2_slope  = rand_float(5.0f,  20.0f);
            s->pm25_slope = rand_float(0.0f,   0.1f);
            LOG_INF("[SIM] CO2 spike trend started (%d ticks)", s->trend_ticks);
        } else {
            /* PM2.5 spike event */
            s->co2_slope  = rand_float(-1.0f, 1.0f);
            s->pm25_slope = rand_float(0.2f,  1.0f);
            LOG_INF("[SIM] PM2.5 spike trend started (%d ticks)", s->trend_ticks);
        }
    }

    if (s->trend_active) {
        s->base_co2  += s->co2_slope;
        s->base_pm25 += s->pm25_slope;
        s->trend_ticks--;
        if (s->trend_ticks <= 0) {
            s->trend_active = false;
            LOG_INF("[SIM] Trend event ended");
        }
    } else {
        s->base_co2  += rand_float(-0.5f, 0.5f);
        s->base_pm25 += rand_float(-0.02f, 0.02f);
    }

    /* --- Clamp baselines to realistic physical limits ------------------- */
    s->base_temp  = clampf(s->base_temp,    10.0f,   35.0f);
    s->base_hum   = clampf(s->base_hum,     20.0f,   80.0f);
    s->base_co2   = clampf(s->base_co2,    400.0f, 2000.0f);
    s->base_tvoc  = clampf(s->base_tvoc,    0.0f,  1000.0f);
    s->base_pm25  = clampf(s->base_pm25,    0.0f,   100.0f);
    s->base_light = clampf(s->base_light,   0.0f,  2000.0f);

    /* --- Final readings with realistic per-measurement noise ------------ */
    out->temperature = s->base_temp  + rand_float(-0.05f, 0.05f);
    out->humidity    = s->base_hum   + rand_float(-0.2f,  0.2f);
    out->co2         = s->base_co2   + rand_float(-1.0f,  1.0f);
    out->tvoc        = s->base_tvoc  + rand_float(-0.5f,  0.5f);
    out->eco2        = clampf(400.0f + (out->tvoc * 0.5f)
                              + rand_float(-10.0f, 10.0f), 400.0f, 5000.0f);
    out->pm25        = s->base_pm25  + rand_float(-0.1f,  0.1f);
    out->pm1         = clampf(out->pm25 * 0.4f + rand_float(-0.05f, 0.05f),
                              0.0f, 100.0f);
    out->pm4         = out->pm25 * 1.2f + rand_float(-0.05f, 0.05f);
    out->pm10        = out->pm25 * 1.5f + rand_float(-0.1f,  0.1f);
    out->light       = clampf(s->base_light + rand_float(-2.0f, 2.0f),
                              0.0f, 2000.0f);

    /* --- High-Integrity Chaos Mode: realistic latency + random faults --- */
    out->health_mask = SENSOR_HEALTH_ALL;

    /* 1. SCD41 Temp/Humidity — 100 ms read latency */
    k_msleep(100);
    if (rand_float(0.0f, 100.0f) < 15.0f) {
        out->health_mask  &= ~SENSOR_HEALTH_TEMP_HUM;
        out->temperature   = SENSOR_FAULT_VALUE;
        out->humidity      = SENSOR_FAULT_VALUE;
        LOG_DBG("[SIM] Temp/Hum fault injected (health=0x%02x)", out->health_mask);
    }

    /* 2. SCD41 CO2 — 10,000 ms (the deliberately slow sensor) */
    k_msleep(10000);
    if (rand_float(0.0f, 100.0f) < 15.0f) {
        out->health_mask &= ~SENSOR_HEALTH_CO2;
        out->co2          = SENSOR_FAULT_VALUE;
        out->eco2         = SENSOR_FAULT_VALUE;
        LOG_DBG("[SIM] CO2 fault injected (health=0x%02x)", out->health_mask);
    }

    /* 3. SPS30 Particulate Matter — 1,000 ms */
    k_msleep(1000);
    if (rand_float(0.0f, 100.0f) < 15.0f) {
        out->health_mask &= ~SENSOR_HEALTH_PM;
        out->pm1          = SENSOR_FAULT_VALUE;
        out->pm25         = SENSOR_FAULT_VALUE;
        out->pm4          = SENSOR_FAULT_VALUE;
        out->pm10         = SENSOR_FAULT_VALUE;
        LOG_DBG("[SIM] PM fault injected (health=0x%02x)", out->health_mask);
    }

    /* 4. CCS811 TVOC/eCO2 — 1,000 ms */
    k_msleep(1000);
    if (rand_float(0.0f, 100.0f) < 15.0f) {
        out->health_mask &= ~SENSOR_HEALTH_TVOC;
        out->tvoc         = SENSOR_FAULT_VALUE;
        out->eco2         = SENSOR_FAULT_VALUE;
        LOG_DBG("[SIM] TVOC fault injected (health=0x%02x)", out->health_mask);
    }

    return 0;
}

void sensor_backend_deinit(struct sensor_context *ctx)
{
    ARG_UNUSED(ctx);
    LOG_INF("[SIM] Sensor simulation backend deinitialised");
}
