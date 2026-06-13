#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include "sensors/sensor_interface.h"
#include "network.h"
#include "storage.h"

LOG_MODULE_REGISTER(main, LOG_LEVEL_INF);

/* Phase 2: Batch transmission configuration */
#define SAMPLE_INTERVAL_MS  6000   /* 6 seconds - respects SCD41 5.5s minimum */
#define TRANSMIT_INTERVAL_MS 30000 /* 30 seconds - batch of 5 samples */
#define BATCH_SIZE 5

/* Sample buffer for batch transmission */
static struct sensor_readings sample_buffer[BATCH_SIZE];
static uint32_t sample_timestamps[BATCH_SIZE];  /* Store actual timestamp for each sample */
static uint8_t sample_count = 0;
static int64_t last_sample_time = 0;
static int64_t last_transmit_time = 0;

int main(void)
{
    LOG_INF("Starting SSNS Sensor Node");

#ifdef CONFIG_SENSOR_MODE_SIMULATION
    LOG_INF("Sensor mode: SIMULATION (no hardware required)");
    LOG_INF("To switch to real sensors:");
    LOG_INF("  west build -p always -b nrf52840dk/nrf52840");
    LOG_INF("    -- -DCONFIG_SENSOR_MODE_HARDWARE=y");
    LOG_INF("       -DEXTRA_CONF_FILE=prj_hw.conf");
#else
    LOG_INF("Sensor mode: HARDWARE (SCD41 + CCS811 + SPS30)");
#endif

    storage_init();
    network_init();

    /* Initialise the sensor backend (simulation or hardware). */
    struct sensor_context *sensor_ctx = NULL;
    int rc = sensor_backend_init(&sensor_ctx);

    if (rc < 0) {
        LOG_ERR("FATAL: Sensor backend init failed (rc=%d). Halting.", rc);
        return -1;
    }

    /* Allow OpenThread to attach and sensors to warm up. */
    k_sleep(K_SECONDS(5));

    int consecutive_failures = 0;

    while (1) {
        /* ----------------------------------------------------------------
         * High Integrity: Silent Start (60 s warm-up)
         * In hardware mode the sensor aggregator threads start filling the
         * cache immediately, so this window guarantees fresh data before
         * the first CoAP transmission.
         * ---------------------------------------------------------------- */
        uint32_t uptime_ms = k_uptime_get_32();
        if (uptime_ms < 60000) {
            LOG_INF("System warming up... (%u/60s)", uptime_ms / 1000);
            k_sleep(K_SECONDS(10));
            continue;
        }

        int64_t current_time = k_uptime_get();

        /* ----------------------------------------------------------------
         * Phase 2: Sample every 6 seconds
         * ---------------------------------------------------------------- */
        if ((current_time - last_sample_time) >= SAMPLE_INTERVAL_MS) {
            /* 1. Read sensors */
            struct sensor_readings readings;
            sensor_backend_read(sensor_ctx, &readings);

            /* 2. Store sample in buffer with actual timestamp */
            if (sample_count < BATCH_SIZE) {
                sample_buffer[sample_count] = readings;
                sample_timestamps[sample_count] = k_uptime_get_32();  /* Capture actual timestamp */
                sample_count++;
                LOG_DBG("Sample %d/%d collected | Health: 0x%02x",
                        sample_count, BATCH_SIZE, readings.health_mask);
            }

            last_sample_time = current_time;
        }

        /* ----------------------------------------------------------------
         * Phase 2: Transmit batch every 30 seconds (or when buffer full)
         * ---------------------------------------------------------------- */
        bool should_transmit = (sample_count >= BATCH_SIZE) ||
                               ((current_time - last_transmit_time) >= TRANSMIT_INTERVAL_MS && sample_count > 0);

        if (should_transmit) {
            /* Phase 3: Always encode batch first (needed for both send and store) */
            rc = network_encode_coap_batch(sample_buffer, sample_timestamps, sample_count);
            if (rc != 0) {
                LOG_ERR("Failed to encode batch, skipping transmission");
                sample_count = 0;
                last_transmit_time = current_time;
                k_sleep(K_SECONDS(1));
                continue;
            }
            
            /* Phase 3: Always attempt transmission to detect gateway recovery */
            LOG_INF("Transmitting batch of %d samples...", sample_count);
            rc = network_send_coap_batch(sample_buffer, sample_timestamps, sample_count);

            if (rc < 0) {
                consecutive_failures++;
                LOG_WRN("Batch transmission failed (%d/3). Saving to RAM queue...",
                        consecutive_failures);
                storage_save_packet(network_get_last_payload(),
                                    network_get_last_payload_len());

                if (consecutive_failures >= 3) {
                    network_reset_stack();
                    consecutive_failures = 0;
                }

            } else if (rc == 0) {
                consecutive_failures = 0;
                LOG_INF("Batch sent successfully!");

                /* Phase 3: Forward all stored packets when gateway is back online */
                int queue_size = storage_get_queue_usage();
                if (queue_size > 0) {
                    LOG_INF("Gateway online, forwarding %d stored packets...", queue_size);
                    int forwarded = storage_forward_all_packets();
                    LOG_INF("Forwarded %d packets from storage", forwarded);
                }
            }

            LOG_INF("Offline Queue: %d / %d packets | Batch sent: %d samples",
                    storage_get_queue_usage(),
                    storage_get_queue_capacity(),
                    sample_count);

            /* Reset batch buffer */
            sample_count = 0;
            last_transmit_time = current_time;
        }

        /* Sleep for 1 second to check timing conditions frequently */
        k_sleep(K_SECONDS(1));
    }

    return 0;
}
