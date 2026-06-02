#ifndef SENSORS_H
#define SENSORS_H

#include <stdbool.h>

struct sensor_state {
    /* Baselines (drift slowly over time) */
    float base_temp;
    float base_hum;
    float base_co2;
    float base_tvoc;
    float base_pm25;
    float base_light;
    /* Trend simulation */
    bool  trend_active;
    int   trend_ticks;
    float co2_slope;
    float pm25_slope;

    /* High Integrity Health Status (Bitmask)
     * Bit 0: Temp/Hum (MCP9808)
     * Bit 1: CO2 (SCD41)
     * Bit 2: PM (SPS30)
     * Bit 3: TVOC (CCS811)
     * 1 = OK, 0 = FAULT
     */
    unsigned char health_mask;
};

/**
 * @brief Initialize sensor baselines with realistic starting values.
 */
void sensor_service_init(struct sensor_state *s);

/**
 * @brief Read simulated sensor values.
 */
void sensor_service_read(struct sensor_state *s,
                         float *temp, float *hum,
                         float *co2,  float *tvoc, float *eco2,
                         float *pm1,  float *pm25, float *pm4, float *pm10,
                         float *light);

#endif /* SENSORS_H */
