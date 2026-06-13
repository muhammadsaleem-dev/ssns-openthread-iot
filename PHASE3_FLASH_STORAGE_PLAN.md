# Phase 3.1: Flash Storage (NVS) Implementation Plan

## Overview
Implement Non-Volatile Storage (NVS) using Zephyr RTOS to store sensor packets during gateway outages. Provides foundation for 36-hour offline coverage.

---

## Current System Analysis

### Existing NVS Implementation
**File:** `firmware/sensor-node/src/storage.c`

**Current Features:**
- Queue-based storage (50 packets max)
- FIFO behavior (oldest packets dropped when full)
- 25 minutes coverage (50 × 30s)
- Uses `nvs_write()` and `nvs_read()`

**Current Limitations:**
- Small capacity (50 packets = ~22.5 KB)
- No compression
- Simple queue, not optimized for Flash

---

## Phase 3.1 Goals

### Expand Storage Capacity
- **Current:** 50 packets (25 minutes)
- **Target:** 1,444 packets (12 hours without compression)
- **Flash Usage:** 650 KB (450 bytes × 1,444)

### Add Gateway Connectivity Check
- Detect when gateway is unreachable
- Automatically switch to offline mode
- Resume transmission when gateway returns

### Implement Store-and-Forward
- Store packets in Flash during outages
- Forward stored packets in batches when online
- Maintain packet ordering and timestamps

---

## Implementation Steps

### Step 1: Expand NVS Configuration (30 minutes)

**File:** `firmware/sensor-node/src/storage.c`

**Current Configuration:**
```c
#define QUEUE_MAX_ITEMS 50
#define NVS_PARTITION_LABEL storage_partition
```

**New Configuration:**
```c
// Expand storage capacity
#define FLASH_STORAGE_SIZE (650 * 1024)  // 650 KB
#define PACKET_SIZE 450                   // bytes per packet
#define MAX_STORED_PACKETS (FLASH_STORAGE_SIZE / PACKET_SIZE)  // 1,444 packets

// NVS configuration
#define NVS_SECTOR_SIZE 4096              // 4 KB sectors
#define NVS_SECTOR_COUNT (FLASH_STORAGE_SIZE / NVS_SECTOR_SIZE)  // 160 sectors

// Storage keys
#define NVS_KEY_PACKET_BASE 1000          // Base key for packets
#define NVS_KEY_WRITE_INDEX 1             // Current write position
#define NVS_KEY_READ_INDEX 2              // Current read position
#define NVS_KEY_PACKET_COUNT 3            // Number of stored packets
```

**Update NVS Initialization:**
```c
static struct nvs_fs fs;

int storage_init(void) {
    int rc;
    
    // Configure NVS filesystem
    fs.flash_device = NVS_FLASH_DEVICE;
    fs.offset = FLASH_AREA_OFFSET(storage);  // From devicetree
    fs.sector_size = NVS_SECTOR_SIZE;
    fs.sector_count = NVS_SECTOR_COUNT;
    
    rc = nvs_mount(&fs);
    if (rc) {
        LOG_ERR("NVS mount failed: %d", rc);
        return rc;
    }
    
    LOG_INF("NVS mounted: %d KB, %d sectors", 
            FLASH_STORAGE_SIZE / 1024, NVS_SECTOR_COUNT);
    
    // Initialize indices if first boot
    uint32_t write_idx = 0, read_idx = 0, count = 0;
    nvs_read(&fs, NVS_KEY_WRITE_INDEX, &write_idx, sizeof(write_idx));
    nvs_read(&fs, NVS_KEY_READ_INDEX, &read_idx, sizeof(read_idx));
    nvs_read(&fs, NVS_KEY_PACKET_COUNT, &count, sizeof(count));
    
    LOG_INF("Storage state: write=%u, read=%u, count=%u", 
            write_idx, read_idx, count);
    
    return 0;
}
```

---

### Step 2: Add Gateway Connectivity Check (45 minutes)

**File:** `firmware/sensor-node/src/network.c`

**Add Connectivity State:**
```c
// Gateway connectivity state
static bool gateway_online = true;
static int64_t last_successful_send = 0;
static int consecutive_failures = 0;

#define GATEWAY_TIMEOUT_MS 60000          // 60 seconds
#define MAX_CONSECUTIVE_FAILURES 3        // 3 failures = offline
```

**Implement Connectivity Check:**
```c
bool network_is_gateway_reachable(void) {
    int64_t now = k_uptime_get();
    
    // Check if we've had recent successful transmission
    if ((now - last_successful_send) < GATEWAY_TIMEOUT_MS) {
        gateway_online = true;
        consecutive_failures = 0;
        return true;
    }
    
    // Check consecutive failures
    if (consecutive_failures >= MAX_CONSECUTIVE_FAILURES) {
        gateway_online = false;
        LOG_WRN("Gateway offline: %d consecutive failures", 
                consecutive_failures);
        return false;
    }
    
    return gateway_online;
}

// Update existing send function
int network_send_coap_batch(...) {
    // ... existing code ...
    
    if (rc == 0) {
        // Success
        last_successful_send = k_uptime_get();
        consecutive_failures = 0;
        gateway_online = true;
    } else {
        // Failure
        consecutive_failures++;
        LOG_WRN("Send failed: %d consecutive failures", 
                consecutive_failures);
    }
    
    return rc;
}
```

---

### Step 3: Implement Store Function (45 minutes)

**File:** `firmware/sensor-node/src/storage.c`

**Add Store Function:**
```c
int storage_store_packet(const uint8_t *packet, size_t len) {
    int rc;
    uint32_t write_idx, count;
    
    // Check if storage is full
    nvs_read(&fs, NVS_KEY_PACKET_COUNT, &count, sizeof(count));
    if (count >= MAX_STORED_PACKETS) {
        LOG_WRN("Storage full: %u packets", count);
        return -ENOSPC;
    }
    
    // Get current write index
    nvs_read(&fs, NVS_KEY_WRITE_INDEX, &write_idx, sizeof(write_idx));
    
    // Store packet
    uint32_t key = NVS_KEY_PACKET_BASE + write_idx;
    rc = nvs_write(&fs, key, packet, len);
    if (rc < 0) {
        LOG_ERR("Failed to store packet: %d", rc);
        return rc;
    }
    
    // Update indices
    write_idx = (write_idx + 1) % MAX_STORED_PACKETS;
    count++;
    
    nvs_write(&fs, NVS_KEY_WRITE_INDEX, &write_idx, sizeof(write_idx));
    nvs_write(&fs, NVS_KEY_PACKET_COUNT, &count, sizeof(count));
    
    LOG_DBG("Stored packet %u, total: %u", write_idx, count);
    
    return 0;
}
```

---

### Step 4: Implement Forward Function (45 minutes)

**File:** `firmware/sensor-node/src/storage.c`

**Add Forward Function:**
```c
int storage_forward_packets(void) {
    int rc;
    uint32_t read_idx, count;
    uint8_t packet[PACKET_SIZE];
    int forwarded = 0;
    
    // Get current state
    nvs_read(&fs, NVS_KEY_READ_INDEX, &read_idx, sizeof(read_idx));
    nvs_read(&fs, NVS_KEY_PACKET_COUNT, &count, sizeof(count));
    
    if (count == 0) {
        LOG_DBG("No packets to forward");
        return 0;
    }
    
    LOG_INF("Forwarding %u stored packets...", count);
    
    // Forward packets in batches
    while (count > 0) {
        // Read packet
        uint32_t key = NVS_KEY_PACKET_BASE + read_idx;
        rc = nvs_read(&fs, key, packet, PACKET_SIZE);
        if (rc < 0) {
            LOG_ERR("Failed to read packet: %d", rc);
            break;
        }
        
        // Send packet
        rc = network_send_raw_payload(packet, rc);
        if (rc != 0) {
            LOG_WRN("Failed to forward packet, stopping");
            break;
        }
        
        // Update indices
        read_idx = (read_idx + 1) % MAX_STORED_PACKETS;
        count--;
        forwarded++;
        
        nvs_write(&fs, NVS_KEY_READ_INDEX, &read_idx, sizeof(read_idx));
        nvs_write(&fs, NVS_KEY_PACKET_COUNT, &count, sizeof(count));
        
        // Small delay between packets
        k_sleep(K_MSEC(100));
    }
    
    LOG_INF("Forwarded %d packets, %u remaining", forwarded, count);
    
    return forwarded;
}
```

---

### Step 5: Integrate with Main Loop (30 minutes)

**File:** `firmware/sensor-node/src/main.c`

**Update Main Loop:**
```c
void main(void) {
    // ... existing initialization ...
    
    // Initialize storage
    int rc = storage_init();
    if (rc != 0) {
        LOG_ERR("Storage init failed: %d", rc);
        return;
    }
    
    while (1) {
        // ... existing sensor reading and batching ...
        
        // Check if it's time to transmit
        if (sample_count >= BATCH_SIZE) {
            // Check gateway connectivity
            if (network_is_gateway_reachable()) {
                // Gateway online - send batch
                rc = network_send_coap_batch(sample_buffer, 
                                            sample_timestamps, 
                                            sample_count);
                
                if (rc == 0) {
                    LOG_INF("Batch sent successfully");
                    
                    // Check for stored packets to forward
                    uint32_t stored_count;
                    nvs_read(&fs, NVS_KEY_PACKET_COUNT, 
                            &stored_count, sizeof(stored_count));
                    
                    if (stored_count > 0) {
                        LOG_INF("Forwarding %u stored packets...", 
                                stored_count);
                        storage_forward_packets();
                    }
                } else {
                    LOG_WRN("Send failed, storing batch");
                    // Store batch to Flash
                    storage_store_packet(last_payload, payload_len);
                }
            } else {
                // Gateway offline - store batch
                LOG_INF("Gateway offline, storing batch");
                storage_store_packet(last_payload, payload_len);
            }
            
            // Reset batch
            sample_count = 0;
        }
        
        // Sleep until next sample
        k_sleep(K_SECONDS(SAMPLE_INTERVAL));
    }
}
```

---

## Testing Plan

### Test 1: Storage Capacity (15 minutes)
```c
// Test storing maximum packets
for (int i = 0; i < MAX_STORED_PACKETS; i++) {
    rc = storage_store_packet(test_packet, PACKET_SIZE);
    assert(rc == 0);
}

// Verify full
rc = storage_store_packet(test_packet, PACKET_SIZE);
assert(rc == -ENOSPC);
```

### Test 2: Gateway Disconnect (15 minutes)
```
1. Start sensor node with gateway online
2. Disconnect gateway (unplug/power off)
3. Wait 60 seconds
4. Verify packets are being stored to Flash
5. Check serial logs for "Gateway offline" messages
```

### Test 3: Gateway Reconnect (15 minutes)
```
1. Start with stored packets in Flash
2. Reconnect gateway
3. Verify packets are forwarded automatically
4. Check backend receives all stored packets
5. Verify packet ordering is maintained
```

### Test 4: Long-term Storage (30 minutes)
```
1. Disconnect gateway
2. Let sensor run for 2 hours
3. Verify ~240 packets stored (2h × 120 packets/h)
4. Reconnect gateway
5. Verify all packets forwarded successfully
```

---

## Success Criteria

✅ NVS initialized with 650 KB capacity
✅ Gateway connectivity detection working
✅ Packets stored during offline periods
✅ Packets forwarded when gateway returns
✅ Packet ordering maintained
✅ No data loss during outages
✅ Storage survives power cycles

---

## Estimated Time: 2-3 hours

- Step 1: Expand NVS (30 min)
- Step 2: Connectivity check (45 min)
- Step 3: Store function (45 min)
- Step 4: Forward function (45 min)
- Step 5: Integration (30 min)
- Testing: 1.5 hours

**Total: 4-4.5 hours** (includes testing)

---

## Next Steps

After Flash Storage is complete:
1. **Phase 3.2:** Delta Compression (3-4 hours)
2. **Phase 3.3:** Integration & Testing (2-3 hours)

---

## Notes

- Current `storage.c` already has NVS basics - we're expanding it
- Keep existing queue-based storage as fallback
- Flash writes only happen during gateway outages (minimal wear)
- NVS handles Flash wear leveling automatically
