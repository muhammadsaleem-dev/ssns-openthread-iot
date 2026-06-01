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
 * @brief Save a JSON payload to Flash memory.
 * @param payload Null-terminated JSON string.
 * @return 0 on success, or negative error code.
 */
int storage_save_packet(const char *payload);

/**
 * @brief Read the oldest pending packet from Flash memory.
 * @param buf Buffer to store the read payload.
 * @param max_len Size of the buffer.
 * @param out_id The NVS ID of the packet (useful for deleting).
 * @return 0 on success, -ENOENT if no packets are pending, or negative error code.
 */
int storage_read_oldest_packet(char *buf, size_t max_len, uint16_t *out_id);

/**
 * @brief Delete a packet from Flash memory.
 * @param id The NVS ID of the packet.
 * @return 0 on success.
 */
int storage_delete_packet(uint16_t id);

/**
 * @brief Get the number of free bytes remaining in the Flash storage partition.
 */
ssize_t storage_get_free_space(void);

#endif /* STORAGE_H */
