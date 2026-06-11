/**
 * @file sensor_aggregator.h
 * @brief Background polling threads for hardware sensor data.
 *
 * Runs one k_thread per sensor. Each thread polls its sensor independently
 * at the sensor's native measurement interval and writes results into a
 * mutex-protected cache. sensor_aggregator_get() copies the cache instantly
 * (non-blocking) — used by sensor_hw.c to implement sensor_backend_read().
 *
 * Thread priorities (all preemptive, lower priority than main):
 *   scd41_poll  — priority 7, polls every 5.5 s
 *   ccs811_poll — priority 7, polls every 1.0 s
 *   sps30_poll  — priority 7, polls every 1.5 s
 *
 * Cache is initialised to SENSOR_FAULT_VALUE with health_mask=0x00.
 * Threads will populate it within their first polling interval.
 * The main thread's 60-second warm-up window ensures the cache is valid
 * before the first transmission.
 */

#ifndef SENSOR_AGGREGATOR_H
#define SENSOR_AGGREGATOR_H

#include "sensor_interface.h"

/**
 * @brief Start all background sensor polling threads.
 * Initialises drivers, cache, and mutex. Starts one thread per enabled sensor.
 * @return 0 on success. Returns 0 even if individual sensor inits fail
 *         (partial data is better than no data — health bits reflect status).
 */
int sensor_aggregator_start(void);

/**
 * @brief Copy the latest sensor cache into @p out.
 * Non-blocking. Always returns immediately with the most recent values.
 * @param out  Destination for the cached readings.
 */
void sensor_aggregator_get(struct sensor_readings *out);

/**
 * @brief Stop all polling threads and release sensor resources.
 */
void sensor_aggregator_stop(void);

#endif /* SENSOR_AGGREGATOR_H */
