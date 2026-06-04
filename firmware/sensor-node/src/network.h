#ifndef NETWORK_H
#define NETWORK_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include "sensors.h"

/**
 * @brief Initialize the OpenThread networking subsystem.
 * @return 0 on success, or a negative error code.
 */
int network_init(void);

/**
 * @brief Build a CoAP packet with a CBOR Array payload and send it over Thread.
 * @param sensors Live sensor values to encode.
 * @return 0 on success, or negative error code.
 */
int network_send_coap(struct sensor_state *sensors);

/**
 * @brief Send a raw binary CBOR payload from the NVS queue over CoAP.
 * @param payload Binary CBOR array.
 * @param len Size of payload.
 * @return 0 on success, or negative error code.
 */
int network_send_raw_payload(const uint8_t *payload, size_t len);

/**
 * @brief Force-reboot the Thread radio stack to trigger a new Parent Search.
 */
void network_reset_stack(void);

/**
 * @brief Get the last generated CBOR payload (used for NVS saving).
 * @return Pointer to the payload binary.
 */
const uint8_t* network_get_last_payload(void);

/**
 * @brief Get the size of the last generated CBOR payload.
 * @return Size of the payload.
 */
size_t network_get_last_payload_len(void);

#endif /* NETWORK_H */
