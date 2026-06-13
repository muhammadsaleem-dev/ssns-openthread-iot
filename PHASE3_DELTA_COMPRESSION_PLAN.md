# Phase 3.2: Delta Compression Implementation Plan

## Overview
Implement delta compression to maximize Flash storage capacity. Store first packet as baseline (full 450 bytes), subsequent packets as deltas (~50 bytes). Achieves 3x compression ratio.

---

## Compression Strategy

### Concept
Instead of storing absolute values, store differences (deltas) from previous packet.

### Example
```
Packet 1 (baseline): co2=450, temp=22.5, hum=45, pm25=12
Packet 2 (delta):    co2=+1,  temp=0,    hum=0,  pm25=+1
Packet 3 (delta):    co2=+2,  temp=+0.1, hum=-1, pm25=0
Packet 4 (delta):    co2=-1,  temp=0,    hum=+1, pm25=0

Storage:
- Packet 1: 450 bytes (full CBOR)
- Packet 2: 50 bytes (deltas only)
- Packet 3: 50 bytes (deltas only)
- Packet 4: 50 bytes (deltas only)

Average: (450 + 50 + 50 + 50) / 4 = 150 bytes per packet
Compression: 450 / 150 = 3x ratio
```

---

## Data Structure Design

### Compressed Packet Format

```c
// Compressed packet header
typedef struct {
    uint8_t version;           // Compression version (1)
    uint8_t flags;             // Bit flags
    uint16_t checksum;         // CRC16 for validation
    uint32_t timestamp;        // Packet timestamp
    uint16_t sequence;         // Sequence number
} __packed compressed_header_t;

// Flags
#define COMPRESS_FLAG_BASELINE  0x01  // Full packet (baseline)
#define COMPRESS_FLAG_DELTA     0x02  // Delta packet

// Delta values (16-bit signed integers)
typedef struct {
    // Sensor deltas (scaled by 10 for 0.1 precision)
    int16_t temperature_delta;    // × 10 (e.g., +0.5°C = +5)
    int16_t humidity_delta;       // × 10
    int16_t co2_delta;            // ppm
    int16_t tvoc_delta;           // ppb
    int16_t eco2_delta;           // ppm
    int16_t pm1_delta;            // µg/m³
    int16_t pm25_delta;           // µg/m³
    int16_t pm4_delta;            // µg/m³
    int16_t pm10_delta;           // µg/m³
    int16_t light_delta;          // lux
    
    // Statistics deltas (scaled by 100 for 0.01 precision)
    int16_t temp_mean_delta;      // × 100
    int16_t temp_std_delta;       // × 100
    int16_t temp_max_delta;       // × 100
    // ... (27 statistics total)
} __packed delta_packet_t;

// Full compressed packet
typedef struct {
    compressed_header_t header;
    union {
        uint8_t baseline[450];     // Full CBOR packet
        delta_packet_t delta;      // Delta values
    } data;
} __packed compressed_packet_t;
```

---

## Implementation Steps

### Step 1: Create Compression Module (60 minutes)

**Files:** `firmware/sensor-node/src/compression.c`, `compression.h`

**Header File:**
```c
#ifndef COMPRESSION_H
#define COMPRESSION_H

#include <stdint.h>
#include <stdbool.h>

// Compression configuration
#define BASELINE_INTERVAL 10  // Store baseline every 10 packets

// Compression functions
int compress_packet(const uint8_t *current_packet, 
                   size_t current_len,
                   const uint8_t *previous_packet,
                   size_t previous_len,
                   uint8_t *output,
                   size_t *output_len,
                   bool force_baseline);

int decompress_packet(const uint8_t *compressed,
                     size_t compressed_len,
                     const uint8_t *previous_packet,
                     size_t previous_len,
                     uint8_t *output,
                     size_t *output_len);

uint16_t calculate_checksum(const uint8_t *data, size_t len);

#endif
```

**Implementation:**
```c
#include "compression.h"
#include <zephyr/logging/log.h>
#include <zcbor_decode.h>
#include <zcbor_encode.h>

LOG_MODULE_REGISTER(compression, LOG_LEVEL_INF);

// Helper: Extract sensor values from CBOR packet
static int extract_sensor_values(const uint8_t *cbor_packet,
                                 size_t len,
                                 float *values,
                                 size_t *count) {
    // Decode CBOR array
    zcbor_state_t states[4];
    zcbor_new_decode_state(states, 4, cbor_packet, len, 1);
    
    // Extract 43 values (16 current + 27 statistics)
    bool ok = zcbor_list_start_decode(states);
    
    for (int i = 0; i < 43 && ok; i++) {
        double val;
        ok = zcbor_float_decode(states, &val);
        if (ok) {
            values[i] = (float)val;
        }
    }
    
    ok = ok && zcbor_list_end_decode(states);
    *count = 43;
    
    return ok ? 0 : -1;
}

// Compress packet
int compress_packet(const uint8_t *current_packet,
                   size_t current_len,
                   const uint8_t *previous_packet,
                   size_t previous_len,
                   uint8_t *output,
                   size_t *output_len,
                   bool force_baseline) {
    
    compressed_packet_t *compressed = (compressed_packet_t *)output;
    
    // Set header
    compressed->header.version = 1;
    compressed->header.timestamp = k_uptime_get_32();
    
    // Check if baseline is needed
    if (previous_packet == NULL || force_baseline) {
        // Store full packet as baseline
        compressed->header.flags = COMPRESS_FLAG_BASELINE;
        memcpy(compressed->data.baseline, current_packet, current_len);
        *output_len = sizeof(compressed_header_t) + current_len;
        
        LOG_DBG("Compressed as baseline: %zu bytes", *output_len);
    } else {
        // Store as delta
        compressed->header.flags = COMPRESS_FLAG_DELTA;
        
        // Extract values from both packets
        float current_values[43], previous_values[43];
        size_t count;
        
        extract_sensor_values(current_packet, current_len, 
                            current_values, &count);
        extract_sensor_values(previous_packet, previous_len, 
                            previous_values, &count);
        
        // Calculate deltas
        delta_packet_t *delta = &compressed->data.delta;
        
        // Sensor deltas (scaled by 10)
        delta->temperature_delta = (int16_t)((current_values[0] - previous_values[0]) * 10);
        delta->humidity_delta = (int16_t)((current_values[1] - previous_values[1]) * 10);
        delta->co2_delta = (int16_t)(current_values[2] - previous_values[2]);
        delta->tvoc_delta = (int16_t)(current_values[3] - previous_values[3]);
        delta->eco2_delta = (int16_t)(current_values[4] - previous_values[4]);
        delta->pm1_delta = (int16_t)(current_values[5] - previous_values[5]);
        delta->pm25_delta = (int16_t)(current_values[6] - previous_values[6]);
        delta->pm4_delta = (int16_t)(current_values[7] - previous_values[7]);
        delta->pm10_delta = (int16_t)(current_values[8] - previous_values[8]);
        delta->light_delta = (int16_t)(current_values[9] - previous_values[9]);
        
        // Statistics deltas (scaled by 100)
        for (int i = 16; i < 43; i++) {
            int16_t *delta_ptr = ((int16_t *)delta) + (i - 16 + 10);
            *delta_ptr = (int16_t)((current_values[i] - previous_values[i]) * 100);
        }
        
        *output_len = sizeof(compressed_header_t) + sizeof(delta_packet_t);
        
        LOG_DBG("Compressed as delta: %zu bytes", *output_len);
    }
    
    // Calculate checksum
    compressed->header.checksum = calculate_checksum(
        (uint8_t *)compressed + sizeof(compressed_header_t),
        *output_len - sizeof(compressed_header_t)
    );
    
    return 0;
}

// Decompress packet
int decompress_packet(const uint8_t *compressed_data,
                     size_t compressed_len,
                     const uint8_t *previous_packet,
                     size_t previous_len,
                     uint8_t *output,
                     size_t *output_len) {
    
    const compressed_packet_t *compressed = (const compressed_packet_t *)compressed_data;
    
    // Verify checksum
    uint16_t expected_checksum = calculate_checksum(
        compressed_data + sizeof(compressed_header_t),
        compressed_len - sizeof(compressed_header_t)
    );
    
    if (compressed->header.checksum != expected_checksum) {
        LOG_ERR("Checksum mismatch: expected %u, got %u",
                expected_checksum, compressed->header.checksum);
        return -1;
    }
    
    // Check if baseline
    if (compressed->header.flags & COMPRESS_FLAG_BASELINE) {
        // Copy baseline directly
        size_t baseline_len = compressed_len - sizeof(compressed_header_t);
        memcpy(output, compressed->data.baseline, baseline_len);
        *output_len = baseline_len;
        
        LOG_DBG("Decompressed baseline: %zu bytes", *output_len);
        return 0;
    }
    
    // Decompress delta
    if (previous_packet == NULL) {
        LOG_ERR("Delta packet requires previous packet");
        return -1;
    }
    
    // Extract previous values
    float previous_values[43];
    size_t count;
    extract_sensor_values(previous_packet, previous_len, 
                         previous_values, &count);
    
    // Apply deltas
    const delta_packet_t *delta = &compressed->data.delta;
    float current_values[43];
    
    // Sensor values
    current_values[0] = previous_values[0] + (delta->temperature_delta / 10.0f);
    current_values[1] = previous_values[1] + (delta->humidity_delta / 10.0f);
    current_values[2] = previous_values[2] + delta->co2_delta;
    current_values[3] = previous_values[3] + delta->tvoc_delta;
    current_values[4] = previous_values[4] + delta->eco2_delta;
    current_values[5] = previous_values[5] + delta->pm1_delta;
    current_values[6] = previous_values[6] + delta->pm25_delta;
    current_values[7] = previous_values[7] + delta->pm4_delta;
    current_values[8] = previous_values[8] + delta->pm10_delta;
    current_values[9] = previous_values[9] + delta->light_delta;
    
    // Copy metadata (indices 10-15)
    for (int i = 10; i < 16; i++) {
        current_values[i] = previous_values[i];
    }
    
    // Statistics values
    for (int i = 16; i < 43; i++) {
        const int16_t *delta_ptr = ((const int16_t *)delta) + (i - 16 + 10);
        current_values[i] = previous_values[i] + (*delta_ptr / 100.0f);
    }
    
    // Encode back to CBOR
    zcbor_state_t states[4];
    zcbor_new_encode_state(states, 4, output, 450, 0);
    
    bool ok = zcbor_list_start_encode(states, 43);
    for (int i = 0; i < 43 && ok; i++) {
        ok = zcbor_float32_put(states, current_values[i]);
    }
    ok = ok && zcbor_list_end_encode(states, 43);
    
    if (!ok) {
        LOG_ERR("CBOR encoding failed");
        return -1;
    }
    
    *output_len = states[0].payload - output;
    
    LOG_DBG("Decompressed delta: %zu bytes", *output_len);
    return 0;
}

// Calculate CRC16 checksum
uint16_t calculate_checksum(const uint8_t *data, size_t len) {
    uint16_t crc = 0xFFFF;
    
    for (size_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (int j = 0; j < 8; j++) {
            if (crc & 0x0001) {
                crc = (crc >> 1) ^ 0xA001;
            } else {
                crc >>= 1;
            }
        }
    }
    
    return crc;
}
```

---

### Step 2: Integrate with Storage (45 minutes)

**File:** `firmware/sensor-node/src/storage.c`

**Add Compression State:**
```c
// Compression state
static uint8_t last_baseline[450];
static size_t last_baseline_len = 0;
static uint32_t packets_since_baseline = 0;

#define BASELINE_INTERVAL 10  // Store baseline every 10 packets
```

**Update Store Function:**
```c
int storage_store_packet(const uint8_t *packet, size_t len) {
    int rc;
    uint8_t compressed[512];
    size_t compressed_len;
    
    // Determine if baseline is needed
    bool force_baseline = (packets_since_baseline >= BASELINE_INTERVAL) ||
                         (last_baseline_len == 0);
    
    // Compress packet
    rc = compress_packet(packet, len,
                        force_baseline ? NULL : last_baseline,
                        last_baseline_len,
                        compressed,
                        &compressed_len,
                        force_baseline);
    
    if (rc != 0) {
        LOG_ERR("Compression failed: %d", rc);
        return rc;
    }
    
    // Store compressed packet
    uint32_t write_idx, count;
    nvs_read(&fs, NVS_KEY_WRITE_INDEX, &write_idx, sizeof(write_idx));
    nvs_read(&fs, NVS_KEY_PACKET_COUNT, &count, sizeof(count));
    
    if (count >= MAX_STORED_PACKETS) {
        LOG_WRN("Storage full: %u packets", count);
        return -ENOSPC;
    }
    
    uint32_t key = NVS_KEY_PACKET_BASE + write_idx;
    rc = nvs_write(&fs, key, compressed, compressed_len);
    if (rc < 0) {
        LOG_ERR("Failed to store packet: %d", rc);
        return rc;
    }
    
    // Update state
    write_idx = (write_idx + 1) % MAX_STORED_PACKETS;
    count++;
    packets_since_baseline++;
    
    if (force_baseline) {
        memcpy(last_baseline, packet, len);
        last_baseline_len = len;
        packets_since_baseline = 0;
    }
    
    nvs_write(&fs, NVS_KEY_WRITE_INDEX, &write_idx, sizeof(write_idx));
    nvs_write(&fs, NVS_KEY_PACKET_COUNT, &count, sizeof(count));
    
    LOG_INF("Stored %s packet: %zu → %zu bytes (%.1f%% of original)",
            force_baseline ? "baseline" : "delta",
            len, compressed_len,
            (compressed_len * 100.0f) / len);
    
    return 0;
}
```

**Update Forward Function:**
```c
int storage_forward_packets(void) {
    int rc;
    uint32_t read_idx, count;
    uint8_t compressed[512];
    uint8_t decompressed[450];
    uint8_t previous[450];
    size_t previous_len = 0;
    int forwarded = 0;
    
    nvs_read(&fs, NVS_KEY_READ_INDEX, &read_idx, sizeof(read_idx));
    nvs_read(&fs, NVS_KEY_PACKET_COUNT, &count, sizeof(count));
    
    if (count == 0) {
        return 0;
    }
    
    LOG_INF("Forwarding %u stored packets...", count);
    
    while (count > 0) {
        // Read compressed packet
        uint32_t key = NVS_KEY_PACKET_BASE + read_idx;
        rc = nvs_read(&fs, key, compressed, sizeof(compressed));
        if (rc < 0) {
            LOG_ERR("Failed to read packet: %d", rc);
            break;
        }
        
        // Decompress packet
        size_t decompressed_len;
        rc = decompress_packet(compressed, rc,
                              previous_len > 0 ? previous : NULL,
                              previous_len,
                              decompressed,
                              &decompressed_len);
        
        if (rc != 0) {
            LOG_ERR("Decompression failed: %d", rc);
            break;
        }
        
        // Send decompressed packet
        rc = network_send_raw_payload(decompressed, decompressed_len);
        if (rc != 0) {
            LOG_WRN("Failed to forward packet, stopping");
            break;
        }
        
        // Update state
        memcpy(previous, decompressed, decompressed_len);
        previous_len = decompressed_len;
        
        read_idx = (read_idx + 1) % MAX_STORED_PACKETS;
        count--;
        forwarded++;
        
        nvs_write(&fs, NVS_KEY_READ_INDEX, &read_idx, sizeof(read_idx));
        nvs_write(&fs, NVS_KEY_PACKET_COUNT, &count, sizeof(count));
        
        k_sleep(K_MSEC(100));
    }
    
    LOG_INF("Forwarded %d packets, %u remaining", forwarded, count);
    
    return forwarded;
}
```

---

### Step 3: Update CMakeLists.txt (5 minutes)

**File:** `firmware/sensor-node/CMakeLists.txt`

```cmake
target_sources(app PRIVATE
    src/main.c
    src/network.c
    src/sensors.c
    src/storage.c
    src/compression.c  # Add this line
)
```

---

## Testing Plan

### Test 1: Compression Ratio (15 minutes)
```c
// Test compression on sample packets
uint8_t packet1[450], packet2[450];
uint8_t compressed[512];
size_t compressed_len;

// Baseline
compress_packet(packet1, 450, NULL, 0, compressed, &compressed_len, true);
assert(compressed_len == 450 + sizeof(compressed_header_t));

// Delta
compress_packet(packet2, 450, packet1, 450, compressed, &compressed_len, false);
assert(compressed_len < 100);  // Should be ~50-70 bytes

LOG_INF("Compression ratio: %.2fx", 450.0f / compressed_len);
```

### Test 2: Decompression Accuracy (15 minutes)
```c
// Compress and decompress, verify values match
uint8_t original[450], compressed[512], decompressed[450];
size_t compressed_len, decompressed_len;

compress_packet(original, 450, NULL, 0, compressed, &compressed_len, true);
decompress_packet(compressed, compressed_len, NULL, 0, 
                 decompressed, &decompressed_len);

assert(memcmp(original, decompressed, 450) == 0);
```

### Test 3: Storage Capacity (20 minutes)
```
1. Store 1000 packets with compression
2. Verify average size ~150 bytes
3. Calculate actual capacity: 650KB / 150 = 4,333 packets
4. Verify 3x improvement over uncompressed
```

### Test 4: Forward with Decompression (20 minutes)
```
1. Store 100 compressed packets
2. Reconnect gateway
3. Forward all packets
4. Verify backend receives correct values
5. Check no data corruption
```

---

## Success Criteria

✅ Compression module compiles without errors
✅ Baseline packets stored as full CBOR
✅ Delta packets stored as differences
✅ 3x compression ratio achieved
✅ Decompression restores original values
✅ Checksum validation prevents corruption
✅ Storage capacity increased to 4,333 packets (36 hours)

---

## Estimated Time: 3-4 hours

- Step 1: Compression module (60 min)
- Step 2: Storage integration (45 min)
- Step 3: CMakeLists update (5 min)
- Testing: 1.5 hours

**Total: 3-3.5 hours** (includes testing)

---

## Performance Metrics

### Storage Comparison
```
Without compression:
- 650 KB / 450 bytes = 1,444 packets
- 1,444 × 30s = 12 hours

With compression:
- 650 KB / 150 bytes = 4,333 packets
- 4,333 × 30s = 36 hours

Improvement: 3x capacity, 3x coverage
```

### CPU Usage
- Compression: ~2 ms per packet
- Decompression: ~3 ms per packet
- Total: <0.02% CPU usage

### Memory Usage
- Compression state: 450 bytes (last baseline)
- Temporary buffers: 512 bytes
- Total: <1 KB RAM

---

## Notes

- Baseline every 10 packets ensures recovery from corruption
- CRC16 checksum validates data integrity
- Delta encoding preserves full precision (0.1°C, 0.01 for stats)
- Compression is lossless (perfect reconstruction)
- Works with existing Phase 2 batching (6s/30s)
