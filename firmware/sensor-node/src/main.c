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

    while (1) {
        int rc;
        
        /* 1. Send live telemetry */
        rc = network_send_coap(&sensors);
        if (rc < 0) {
            LOG_WRN("Network transmission failed. Saving to NVS queue...");
            storage_save_packet(network_get_last_payload());
        } else if (rc == 0) {
            /* 2. Network is online! Try to drain the NVS queue */
            char buf[384];
            uint16_t oldest_id;
            
            /* Attempt to send up to 5 backlog packets per tick to avoid flooding */
            for (int i = 0; i < 5; i++) {
                if (storage_read_oldest_packet(buf, sizeof(buf), &oldest_id) == 0) {
                    LOG_INF("Draining backlog packet ID %d...", oldest_id);
                    if (network_send_raw_payload(buf) == 0) {
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

        LOG_INF("NVS Free Space: %d bytes", storage_get_free_space());
        k_sleep(K_SECONDS(10));
    }

    return 0;
}
