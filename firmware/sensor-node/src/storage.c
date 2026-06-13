#include "storage.h"
#include "network.h"  /* Phase 3: For network_send_raw_payload */
#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include <zephyr/fs/nvs.h>
#include <zephyr/storage/flash_map.h>
#include <stdio.h>
#include <string.h>

LOG_MODULE_REGISTER(storage, LOG_LEVEL_DBG);

// Phase 3.1: Simplified - use RAM queue only (no Flash persistence)
// This avoids Settings/NVS conflicts with OpenThread
// 50 packets × 1024 bytes = 50 KB RAM (acceptable for nRF52840 with 256 KB RAM)
#define QUEUE_MAX_ITEMS 50
#define PACKET_SLOT_SIZE 1024  /* Large enough for 5-sample batches (~821 bytes) */

static uint8_t packet_queue[QUEUE_MAX_ITEMS][PACKET_SLOT_SIZE];
static uint16_t packet_sizes[QUEUE_MAX_ITEMS];
static uint16_t queue_head = 0;  /* Next write position */
static uint16_t queue_tail = 0;  /* Next read position */
static uint16_t queue_count = 0; /* Number of packets in queue */

int storage_init(void)
{
    /* Phase 3.1: Simple RAM-based queue (no Flash conflicts) */
    queue_head = 0;
    queue_tail = 0;
    queue_count = 0;
    
    LOG_INF("RAM-based packet queue initialized: %d slots × %d bytes = %d KB",
            QUEUE_MAX_ITEMS, PACKET_SLOT_SIZE, (QUEUE_MAX_ITEMS * PACKET_SLOT_SIZE) / 1024);
    LOG_INF("Capacity: %d packets = %.1f hours offline coverage",
            QUEUE_MAX_ITEMS, (QUEUE_MAX_ITEMS * 30.0) / 3600.0);

    return 0;
}

int storage_save_packet(const uint8_t *payload, size_t len)
{
    if (len > PACKET_SLOT_SIZE) {
        LOG_ERR("Packet too large: %zu bytes (max %d)", len, PACKET_SLOT_SIZE);
        return -EINVAL;
    }

    /* Circular buffer - overwrite oldest when full */
    if (queue_count >= QUEUE_MAX_ITEMS) {
        LOG_WRN("Queue full (%d packets), overwriting oldest", QUEUE_MAX_ITEMS);
        queue_tail = (queue_tail + 1) % QUEUE_MAX_ITEMS;
        queue_count--;
    }

    /* Save packet to RAM */
    memcpy(packet_queue[queue_head], payload, len);
    packet_sizes[queue_head] = len;
    queue_head = (queue_head + 1) % QUEUE_MAX_ITEMS;
    queue_count++;

    LOG_INF("Saved packet to RAM queue (slot %d, %d/%d packets)",
            (queue_head - 1 + QUEUE_MAX_ITEMS) % QUEUE_MAX_ITEMS,
            queue_count, QUEUE_MAX_ITEMS);
    
    return 0;
}

int storage_read_oldest_packet(uint8_t *buf, size_t max_len, size_t *out_len, uint16_t *out_id)
{
    if (queue_count == 0) {
        return -ENOENT; /* Queue empty */
    }

    size_t len = packet_sizes[queue_tail];
    if (len > max_len) {
        len = max_len;
    }

    memcpy(buf, packet_queue[queue_tail], len);
    *out_len = len;
    *out_id = queue_tail;  /* Use slot index as ID */
    
    return 0;
}

int storage_delete_packet(uint16_t id)
{
    if (queue_count == 0) {
        return -ENOENT;
    }

    /* Remove from tail (oldest) */
    queue_tail = (queue_tail + 1) % QUEUE_MAX_ITEMS;
    queue_count--;
    
    LOG_DBG("Deleted packet from slot %d (%d packets remaining)", id, queue_count);
    return 0;
}

int storage_get_queue_usage(void)
{
    return queue_count;
}

int storage_get_queue_capacity(void)
{
    return QUEUE_MAX_ITEMS;
}

/* Phase 3: Forward all stored packets to gateway */
int storage_forward_all_packets(void)
{
    int forwarded = 0;
    int failed = 0;
    uint8_t packet_buf[1024];
    size_t packet_len;
    uint16_t packet_id;
    
    int queue_size = storage_get_queue_usage();
    if (queue_size == 0) {
        LOG_DBG("No packets to forward");
        return 0;
    }
    
    LOG_INF("Starting to forward %d stored packets...", queue_size);
    
    while (storage_get_queue_usage() > 0) {
        /* Read oldest packet */
        int rc = storage_read_oldest_packet(packet_buf, sizeof(packet_buf), 
                                           &packet_len, &packet_id);
        if (rc != 0) {
            LOG_ERR("Failed to read packet: %d", rc);
            failed++;
            break;
        }
        
        /* Send packet via network */
        rc = network_send_raw_payload(packet_buf, packet_len);
        if (rc != 0) {
            LOG_WRN("Failed to forward packet ID %d, stopping (rc=%d)", 
                    packet_id, rc);
            failed++;
            break;
        }
        
        /* Delete successfully forwarded packet */
        storage_delete_packet(packet_id);
        forwarded++;
        
        /* Small delay to avoid overwhelming the network */
        k_sleep(K_MSEC(100));
        
        /* Log progress every 100 packets */
        if (forwarded % 100 == 0) {
            LOG_INF("Forwarded %d/%d packets...", forwarded, queue_size);
        }
    }
    
    if (forwarded > 0) {
        LOG_INF("Forwarding complete: %d sent, %d failed, %d remaining",
                forwarded, failed, storage_get_queue_usage());
    }
    
    return forwarded;
}
