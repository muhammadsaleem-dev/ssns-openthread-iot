#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include "sensors/sensor_interface.h"
#include "network.h"
#include "storage.h"

LOG_MODULE_REGISTER(main, LOG_LEVEL_INF);

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

        /* ----------------------------------------------------------------
         * 1. Read sensors
         *    Simulation: blocks ~12 s (injected latency)
         *    Hardware:   returns immediately (copy from aggregator cache)
         * ---------------------------------------------------------------- */
        struct sensor_readings readings;
        sensor_backend_read(sensor_ctx, &readings);

        /* ----------------------------------------------------------------
         * 2. Transmit live telemetry over CoAP
         * ---------------------------------------------------------------- */
        rc = network_send_coap(&readings);

        if (rc < 0) {
            consecutive_failures++;
            LOG_WRN("Network transmission failed (%d/3). Saving to NVS queue...",
                    consecutive_failures);
            storage_save_packet(network_get_last_payload(),
                                network_get_last_payload_len());

            if (consecutive_failures >= 3) {
                network_reset_stack();
                consecutive_failures = 0;
            }

        } else if (rc == 0) {
            consecutive_failures = 0;

            /* 3. Network is online — drain up to 5 queued backlog packets */
            uint8_t buf[384];
            size_t  out_len;
            uint16_t oldest_id;

            for (int i = 0; i < 5; i++) {
                if (storage_read_oldest_packet(buf, sizeof(buf),
                                               &out_len, &oldest_id) == 0) {
                    LOG_INF("Draining backlog packet ID %d...", oldest_id);
                    if (network_send_raw_payload(buf, out_len) == 0) {
                        storage_delete_packet(oldest_id);
                        k_sleep(K_MSEC(500));
                    } else {
                        break;  /* Network failed again — stop draining */
                    }
                } else {
                    break;  /* Queue empty */
                }
            }
        }

        LOG_INF("Offline Queue: %d / %d packets | Health: 0x%02x",
                storage_get_queue_usage(),
                storage_get_queue_capacity(),
                readings.health_mask);

        k_sleep(K_SECONDS(30));
    }

    return 0;
}
