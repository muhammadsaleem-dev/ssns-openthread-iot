#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include "sensors.h"
#include "network.h"
#include "storage.h"

LOG_MODULE_REGISTER(main, LOG_LEVEL_INF);

int main(void)
{
    LOG_INF("Starting SSNS Sensor Node - Monolithic C Refactor");

    storage_init();
    network_init();

    struct sensor_state sensors;
    sensor_service_init(&sensors);

    k_sleep(K_SECONDS(5));

    int consecutive_failures = 0;

    while (1) {
        int rc;
        
        /* High Integrity: Silent Start (60s Warm-up) */
        uint32_t uptime_ms = k_uptime_get_32();
        if (uptime_ms < 60000) {
            LOG_INF("System warming up... (%d/60s)", uptime_ms / 1000);
            k_sleep(K_SECONDS(10));
            continue;
        }

        /* 1. Send live telemetry */
        rc = network_send_coap(&sensors);
        if (rc < 0) {
            consecutive_failures++;
            LOG_WRN("Network transmission failed (%d/3). Saving to NVS queue...", consecutive_failures);
            storage_save_packet(network_get_last_payload(), network_get_last_payload_len());

            if (consecutive_failures >= 3) {
                network_reset_stack();
                consecutive_failures = 0;
            }
        } else if (rc == 0) {
            consecutive_failures = 0;
            /* 2. Network is online! Try to drain the NVS queue */
            uint8_t buf[384];
            size_t out_len;
            uint16_t oldest_id;
            
            /* Attempt to send up to 5 backlog packets per tick to avoid flooding */
            for (int i = 0; i < 5; i++) {
                if (storage_read_oldest_packet(buf, sizeof(buf), &out_len, &oldest_id) == 0) {
                    LOG_INF("Draining backlog packet ID %d...", oldest_id);
                    if (network_send_raw_payload(buf, out_len) == 0) {
                        storage_delete_packet(oldest_id);
                        k_sleep(K_MSEC(500));
                    } else {
                        /* Network failed again, stop draining */
                        break;
                    }
                } else {
                    /* Queue is empty */
                    break;
                }
            }
        }
        
        LOG_INF("Offline Queue Usage: %d / %d packets", 
                storage_get_queue_usage(), storage_get_queue_capacity());
        
        k_sleep(K_SECONDS(30));
    }

    return 0;
}
