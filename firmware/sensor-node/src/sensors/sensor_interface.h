/**
 * @file sensor_interface.h
 * @brief Common sensor API for SSNS Sensor Node.
 *
 * This header is the ONLY sensor-related dependency for main.c and network.c.
 * Both the simulation and hardware backends implement the three functions below,
 * selected at compile time via Kconfig (SENSOR_MODE_SIMULATION / _HARDWARE).
 *
 * Data flow:
 *   sensor_backend_init()
 *       ↓
 *   [loop] sensor_backend_read() → struct sensor_readings → network_send_coap()
 *       ↓
 *   sensor_backend_deinit()
 *
 * Simulation mode:  sensor_backend_read() blocks ~12 s (realistic latencies).
 * Hardware mode:    sensor_backend_read() returns immediately (cached values
 *                   from background polling threads — non-blocking).
 */

#ifndef SENSOR_INTERFACE_H
#define SENSOR_INTERFACE_H

#include <stdint.h>
#include <stdbool.h>

/* ---------------------------------------------------------------------------
 * Health mask bits  (1 = sensor OK,  0 = sensor FAULT)
 * ---------------------------------------------------------------------------
 * These bits map directly to the `health_mask` field in sensor_readings and
 * are encoded verbatim in the CBOR telemetry payload sent over CoAP.
 */
#define SENSOR_HEALTH_TEMP_HUM   (1u << 0)  /**< SCD41  — Temperature + Humidity */
#define SENSOR_HEALTH_CO2        (1u << 1)  /**< SCD41  — CO2                    */
#define SENSOR_HEALTH_PM         (1u << 2)  /**< SPS30  — Particulate Matter      */
#define SENSOR_HEALTH_TVOC       (1u << 3)  /**< CCS811 — eCO2 + TVOC            */
#define SENSOR_HEALTH_ALL        (0x0Fu)    /**< All four sensors reporting OK    */

/** Sentinel value returned for any channel that failed. */
#define SENSOR_FAULT_VALUE       (-999.0f)

/** Sentinel value returned for any channel that is intentionally warming up (e.g. CCS811 heater). */
#define SENSOR_WARMUP_VALUE      (-998.0f)

/* ---------------------------------------------------------------------------
 * Unified sensor readings structure
 * ---------------------------------------------------------------------------
 * Produced by BOTH backends. Passed directly to network_send_coap().
 * Field order and unit conventions must not change — the CBOR schema and
 * Spring Boot backend depend on the exact CBOR array position.
 */
struct sensor_readings {
    float    temperature;  /**< °C          — SCD41 (or simulated)  */
    float    humidity;     /**< %RH         — SCD41 (or simulated)  */
    float    co2;          /**< ppm CO₂     — SCD41 (or simulated)  */
    float    tvoc;         /**< ppb TVOC    — CCS811 (or simulated) */
    float    eco2;         /**< ppm eCO₂   — CCS811 (or simulated) */
    float    pm1;          /**< µg/m³ PM1   — SPS30 (or simulated)  */
    float    pm25;         /**< µg/m³ PM2.5 — SPS30 (or simulated)  */
    float    pm4;          /**< µg/m³ PM4   — SPS30 (or simulated)  */
    float    pm10;         /**< µg/m³ PM10  — SPS30 (or simulated)  */
    float    light;        /**< lux         — simulated / 500 lux fallback */
    uint8_t  health_mask;  /**< Bitmask: see SENSOR_HEALTH_* above  */
};

/* ---------------------------------------------------------------------------
 * Opaque sensor context
 * ---------------------------------------------------------------------------
 * Defined (as a complete struct) inside each backend implementation file.
 * Allocated statically — NO dynamic memory (malloc) used.
 * Callers only ever hold a pointer to it.
 */
struct sensor_context;

/**
 * @brief Initialise the active sensor backend.
 *
 * Simulation: Seeds random baselines, no I2C access.
 * Hardware:   Initialises I2C devices and starts background polling threads.
 *
 * @param[out] ctx  Receives a pointer to the static internal context.
 * @return 0 on success, negative errno on failure.
 */
int sensor_backend_init(struct sensor_context **ctx);

/**
 * @brief Read the latest sensor values.
 *
 * Simulation: Blocks ~12 s per call (realistic latency injection).
 * Hardware:   Non-blocking — copies from aggregator cache immediately.
 *
 * On any channel failure the corresponding field is set to SENSOR_FAULT_VALUE
 * and the matching SENSOR_HEALTH_* bit in health_mask is cleared to 0.
 *
 * @param ctx  Context from sensor_backend_init().
 * @param out  Filled with the latest readings.
 * @return 0 on success, negative errno on failure.
 */
int sensor_backend_read(struct sensor_context *ctx, struct sensor_readings *out);

/**
 * @brief Clean up sensor resources.
 *
 * Hardware mode: Stops background polling threads and halts measurements.
 * Simulation:    No-op (no resources to free).
 *
 * @param ctx  Context from sensor_backend_init().
 */
void sensor_backend_deinit(struct sensor_context *ctx);

#endif /* SENSOR_INTERFACE_H */
