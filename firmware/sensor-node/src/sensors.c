#include "sensors.h"
#include <zephyr/kernel.h>
#include <zephyr/random/random.h>
#include <stdint.h>

/**
 * Return a pseudo-random float in [lo, hi].
 * Uses Zephyr's sys_rand32_get() seeded from the hardware RNG.
 */
static float rand_float(float lo, float hi)
{
    uint32_t r = sys_rand32_get();
    float normalised = (float)r / (float)UINT32_MAX;   /* 0.0 – 1.0 */
    return lo + normalised * (hi - lo);
}

static float clampf(float v, float lo, float hi)
{
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
}

void sensor_service_init(struct sensor_state *s)
{
    s->base_temp  = rand_float(18.0f, 26.0f);
    s->base_hum   = rand_float(30.0f, 60.0f);
    s->base_co2   = rand_float(400.0f, 800.0f);
    s->base_tvoc  = rand_float(0.0f, 100.0f);
    s->base_pm25  = rand_float(0.0f, 10.0f);
    s->base_light = rand_float(100.0f, 800.0f);
    s->trend_active = false;
    s->trend_ticks  = 0;
    s->co2_slope    = 0.0f;
    s->pm25_slope   = 0.0f;
}

void sensor_service_read(struct sensor_state *s,
                         float *temp, float *hum,
                         float *co2,  float *tvoc, float *eco2,
                         float *pm1,  float *pm25, float *pm4, float *pm10,
                         float *light)
{
    /* --- slow baseline drift --- */
    s->base_temp  += rand_float(-0.01f, 0.01f);
    s->base_hum   += rand_float(-0.05f, 0.05f);
    s->base_tvoc  += rand_float(-0.2f,  0.2f);
    s->base_light += rand_float(-0.5f,  0.5f);

    /* --- trend events (1 % chance to start per tick) --- */
    if (!s->trend_active && rand_float(0.0f, 1.0f) < 0.01f) {
        s->trend_active = true;
        s->trend_ticks  = (int)rand_float(30.0f, 90.0f);
        if (rand_float(0.0f, 1.0f) < 0.5f) {
            /* CO2 spike */
            s->co2_slope  = rand_float(5.0f, 20.0f);
            s->pm25_slope = rand_float(0.0f, 0.1f);
        } else {
            /* PM2.5 spike */
            s->co2_slope  = rand_float(-1.0f, 1.0f);
            s->pm25_slope = rand_float(0.2f, 1.0f);
        }
    }

    if (s->trend_active) {
        s->base_co2  += s->co2_slope;
        s->base_pm25 += s->pm25_slope;
        s->trend_ticks--;
        if (s->trend_ticks <= 0) {
            s->trend_active = false;
        }
    } else {
        s->base_co2  += rand_float(-0.5f, 0.5f);
        s->base_pm25 += rand_float(-0.02f, 0.02f);
    }

    /* --- clamp baselines --- */
    s->base_temp  = clampf(s->base_temp,  10.0f, 35.0f);
    s->base_hum   = clampf(s->base_hum,   20.0f, 80.0f);
    s->base_co2   = clampf(s->base_co2,  400.0f, 2000.0f);
    s->base_tvoc  = clampf(s->base_tvoc,   0.0f, 1000.0f);
    s->base_pm25  = clampf(s->base_pm25,   0.0f, 100.0f);
    s->base_light = clampf(s->base_light,  0.0f, 2000.0f);

    /* --- final readings with small sensor noise --- */
    *temp  = s->base_temp  + rand_float(-0.05f, 0.05f);
    *hum   = s->base_hum   + rand_float(-0.2f,  0.2f);
    *co2   = s->base_co2   + rand_float(-1.0f,  1.0f);
    *tvoc  = s->base_tvoc  + rand_float(-0.5f,  0.5f);
    *eco2  = clampf(400.0f + (*tvoc * 0.5f) + rand_float(-10.0f, 10.0f), 400.0f, 5000.0f);
    *pm25  = s->base_pm25  + rand_float(-0.1f,  0.1f);
    *pm1   = clampf(*pm25 * 0.4f + rand_float(-0.05f, 0.05f), 0.0f, 100.0f);
    *pm4   = *pm25 * 1.2f + rand_float(-0.05f, 0.05f);
    *pm10  = *pm25 * 1.5f + rand_float(-0.1f,  0.1f);
    *light = clampf(s->base_light + rand_float(-2.0f, 2.0f), 0.0f, 2000.0f);
}
