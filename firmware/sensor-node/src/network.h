#ifndef NETWORK_H
#define NETWORK_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/*
 * network.h depends on sensor_interface.h for the sensor_readings struct.
 * Both simulation and hardware backends produce the same struct, so the
 * network layer is completely independent of the sensor implementation.
 */
#include "sensors/sensor_interface.h"

/**
 * @brief Initialise the OpenThread networking subsystem.
 * Injects the hardcoded dataset (year-2033 timestamp), resolves node/boot IDs,
 * and opens the UDP socket bound to the gateway IPv6 address.
 * @return 0 on success, negative error code on failure.
 */
int network_init(void);

/**
 * @brief Encode @p r into a CBOR array payload and send it via CoAP/UDP.
 * Waits up to 5 seconds for a CoAP ACK from the gateway.
 * On success, the encoded payload is stored internally for NVS save-on-failure.
 * @param r  Sensor readings (from either simulation or hardware backend).
 * @return 0 on ACK received, -ETIMEDOUT if no ACK, negative errno on send error.
 */
int network_send_coap(const struct sensor_readings *r);

/**
 * @brief Encode a batch of sensor readings into a CBOR payload and send via CoAP/UDP.
 * Phase 2: Batch transmission - sends multiple samples in a single packet.
 * Waits up to 5 seconds for a CoAP ACK from the gateway.
 * @param samples     Array of sensor readings.
 * @param timestamps  Array of actual timestamps (ms) for each sample.
 * @param count       Number of samples in the batch (1-5).
 * @return 0 on ACK received, -ETIMEDOUT if no ACK, negative errno on send error.
 */
int network_send_coap_batch(const struct sensor_readings *samples, const uint32_t *timestamps, uint8_t count);

/**
 * @brief Re-send a raw binary CBOR payload from the NVS offline queue.
 * Used to drain buffered packets when network connectivity is restored.
 * @param payload  Binary CBOR array bytes.
 * @param len      Payload size.
 * @return 0 on ACK received, negative errno on failure.
 */
int network_send_raw_payload(const uint8_t *payload, size_t len);

/**
 * @brief Force-restart the Thread radio stack to trigger a new Parent Search.
 * Called after 3 consecutive transmission failures.
 */
void network_reset_stack(void);

/**
 * @brief Get the last CBOR payload that was encoded by network_send_coap().
 * Used by main.c to save the payload to the NVS queue on ACK timeout.
 * @return Pointer to internal static payload buffer.
 */
const uint8_t *network_get_last_payload(void);

/**
 * @brief Get the byte length of the last encoded CBOR payload.
 * @return Size in bytes.
 */
size_t network_get_last_payload_len(void);

#endif /* NETWORK_H */
