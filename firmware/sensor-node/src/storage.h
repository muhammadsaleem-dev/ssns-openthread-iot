#ifndef STORAGE_H
#define STORAGE_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>
#include <sys/types.h>

/**
 * @brief Initialize the NVS file system on the storage partition.
 * @return 0 on success, or a negative error code.
 */
int storage_init(void);

/**
 * @brief Save a CBOR payload to Flash memory.
 * @param payload Binary array.
 * @param len Size of the payload.
 * @return 0 on success, or negative error code.
 */
int storage_save_packet(const uint8_t *payload, size_t len);

/**
 * @brief Read the oldest pending packet from Flash memory.
 * @param buf Buffer to store the read payload.
 * @param max_len Size of the buffer.
 * @param out_len Length of the data read.
 * @param out_id The NVS ID of the packet (useful for deleting).
 * @return 0 on success, -ENOENT if no packets are pending, or negative error code.
 */
int storage_read_oldest_packet(uint8_t *buf, size_t max_len, size_t *out_len, uint16_t *out_id);

/**
 * @brief Delete a packet from Flash memory.
 * @param id The NVS ID of the packet.
 * @return 0 on success.
 */
int storage_delete_packet(uint16_t id);

/**
 * @brief Get the current number of packets stored in the offline queue.
 */
int storage_get_queue_usage(void);

/**
 * @brief Get the maximum number of packets the queue can hold.
 */
int storage_get_queue_capacity(void);

#endif /* STORAGE_H */
