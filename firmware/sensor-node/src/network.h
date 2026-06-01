#ifndef NETWORK_H
#define NETWORK_H

#include <stdbool.h>
#include "sensors.h"

/**
 * @brief Initialize the OpenThread network interface and UDP socket.
 */
int network_init(void);

/**
 * @brief Build and send a CoAP packet containing telemetry.
 *
 * @param sensors The current sensor state.
 * @return 0 on success, or a negative errno code on failure (e.g., -ENOMEM).
 */
int network_send_coap(struct sensor_state *sensors);

/**
 * @brief Get the last generated JSON payload (useful for falling back to NVS).
 */
const char* network_get_last_payload(void);

/**
 * @brief Send a pre-formatted JSON payload over CoAP.
 * @param payload The JSON string.
 * @return 0 on success, or a negative errno code.
 */
int network_send_raw_payload(const char *payload);

#endif /* NETWORK_H */
