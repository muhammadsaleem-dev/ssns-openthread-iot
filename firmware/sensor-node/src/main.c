/**
 * SSNS Sensor Node Firmware
 *
 * Reads environmental telemetry (simulated for now) and sends it
 * to the Thread Serial Gateway via CoAP over the Thread mesh.
 *
 * Architecture note – sensor abstraction:
 *   All sensor data flows through the `sensor_state` struct and the
 *   read_sensors() function.  When real I2C/SPI sensors are connected,
 *   ONLY read_sensors() needs to change.  Everything else (CoAP framing,
 *   Thread networking, JSON encoding) stays untouched.
 */

#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include <zephyr/net/socket.h>
#include <zephyr/net/openthread.h>
#include <openthread/dataset.h>
#include <openthread/thread.h>
#include <openthread/ip6.h>
#include <openthread/link.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <zephyr/random/random.h>

LOG_MODULE_REGISTER(sensor_node, LOG_LEVEL_DBG);

#define COAP_PORT 5683
/* 
 * We use a dedicated Mesh-Local IP address (fd5e:a726:ec55:ee12::1) that the 
 * Border Router explicitly binds to the Linux host wpan0 interface.
 */
#define GATEWAY_IPV6_ADDR "fd5e:a726:ec55:ee12::1"

/* ================================================================
 * Sensor Abstraction Layer
 * ================================================================
 * When real sensors are wired up, replace the body of read_sensors()
 * with actual I2C/SPI reads.  The struct and the rest of main.c
 * remain unchanged.
 * ================================================================ */

struct sensor_state {
    /* Baselines (drift slowly over time) */
    float base_temp;
    float base_hum;
    float base_co2;
    float base_tvoc;
    float base_pm25;
    float base_light;
    /* Trend simulation */
    bool  trend_active;
    int   trend_ticks;
    float co2_slope;
    float pm25_slope;
};

/**
 * Return a pseudo-random float in [lo, hi].
 * Uses Zephyr's sys_rand32_get() seeded from the hardware RNG.
 */
static float rand_float(float lo, float hi)
{
    uint32_t r = sys_rand32_get();
    float normalised = (float)r / (float)UINT32_MAX;   /* 0.0 – 1.0 */
    return lo + normalised * (hi - lo);
}

static float clampf(float v, float lo, float hi)
{
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
}

/**
 * Initialise sensor baselines with realistic starting values.
 * Mirrors the Python SimulatedTelemetrySource._NodeState.__init__.
 */
static void sensor_init(struct sensor_state *s)
{
    s->base_temp  = rand_float(18.0f, 26.0f);
    s->base_hum   = rand_float(30.0f, 60.0f);
    s->base_co2   = rand_float(400.0f, 800.0f);
    s->base_tvoc  = rand_float(0.0f, 100.0f);
    s->base_pm25  = rand_float(0.0f, 10.0f);
    s->base_light = rand_float(100.0f, 800.0f);
    s->trend_active = false;
    s->trend_ticks  = 0;
    s->co2_slope    = 0.0f;
    s->pm25_slope   = 0.0f;
}

/**
 * Read (simulated) sensors.
 *
 * When real hardware is connected, replace the body with:
 *   *temp = bme280_read_temperature();
 *   *hum  = bme280_read_humidity();
 *   etc.
 */
static void read_sensors(struct sensor_state *s,
                         float *temp, float *hum,
                         float *co2,  float *tvoc, float *eco2,
                         float *pm1,  float *pm25, float *pm4, float *pm10,
                         float *light)
{
    /* --- slow baseline drift (identical to the Python simulator) --- */
    s->base_temp  += rand_float(-0.01f, 0.01f);
    s->base_hum   += rand_float(-0.05f, 0.05f);
    s->base_tvoc  += rand_float(-0.2f,  0.2f);
    s->base_light += rand_float(-0.5f,  0.5f);

    /* --- trend events (1 % chance to start per tick) --- */
    if (!s->trend_active && rand_float(0.0f, 1.0f) < 0.01f) {
        s->trend_active = true;
        s->trend_ticks  = (int)rand_float(30.0f, 90.0f);
        if (rand_float(0.0f, 1.0f) < 0.5f) {
            /* CO2 spike (room filling up) */
            s->co2_slope  = rand_float(5.0f, 20.0f);
            s->pm25_slope = rand_float(0.0f, 0.1f);
        } else {
            /* PM2.5 spike (dust / smoke) */
            s->co2_slope  = rand_float(-1.0f, 1.0f);
            s->pm25_slope = rand_float(0.2f, 1.0f);
        }
    }

    if (s->trend_active) {
        s->base_co2  += s->co2_slope;
        s->base_pm25 += s->pm25_slope;
        s->trend_ticks--;
        if (s->trend_ticks <= 0) {
            s->trend_active = false;
        }
    } else {
        s->base_co2  += rand_float(-0.5f, 0.5f);
        s->base_pm25 += rand_float(-0.02f, 0.02f);
    }

    /* --- clamp baselines to physical limits --- */
    s->base_temp  = clampf(s->base_temp,  10.0f, 35.0f);
    s->base_hum   = clampf(s->base_hum,   20.0f, 80.0f);
    s->base_co2   = clampf(s->base_co2,  400.0f, 2000.0f);
    s->base_tvoc  = clampf(s->base_tvoc,   0.0f, 1000.0f);
    s->base_pm25  = clampf(s->base_pm25,   0.0f, 100.0f);
    s->base_light = clampf(s->base_light,  0.0f, 2000.0f);

    /* --- final readings with small sensor noise --- */
    *temp  = s->base_temp  + rand_float(-0.05f, 0.05f);
    *hum   = s->base_hum   + rand_float(-0.2f,  0.2f);
    *co2   = s->base_co2   + rand_float(-1.0f,  1.0f);
    *tvoc  = s->base_tvoc  + rand_float(-0.5f,  0.5f);
    *eco2  = clampf(400.0f + (*tvoc * 0.5f) + rand_float(-10.0f, 10.0f), 400.0f, 5000.0f);
    *pm25  = s->base_pm25  + rand_float(-0.1f,  0.1f);
    *pm1   = clampf(*pm25 * 0.4f + rand_float(-0.05f, 0.05f), 0.0f, 100.0f);
    *pm4   = *pm25 * 1.2f + rand_float(-0.05f, 0.05f);
    *pm10  = *pm25 * 1.5f + rand_float(-0.1f,  0.1f);
    *light = clampf(s->base_light + rand_float(-2.0f, 2.0f), 0.0f, 2000.0f);
}

/* ================================================================
 * CoAP + Networking
 * ================================================================ */

static char node_id[16];   /* filled once at boot from HW MAC */
static char boot_id[9];    /* filled once at boot from HW RNG */

static void resolve_boot_id(void)
{
    uint32_t r = sys_rand32_get();
    snprintf(boot_id, sizeof(boot_id), "%08x", r);
}

static void resolve_node_id(void)
{
    otInstance *instance = openthread_get_default_instance();
    otExtAddress ext;
    if (instance) {
        otLinkGetFactoryAssignedIeeeEui64(instance, &ext);
    } else {
        memset(&ext, 0, sizeof(ext));
    }
    snprintf(node_id, sizeof(node_id), "node-%02x%02x",
             ext.m8[6], ext.m8[7]);
}

static int send_coap_telemetry(int sock, struct sockaddr *gw,
                               struct sensor_state *sensors)
{
    /* --- read sensors --- */
    float t, h, co2, tvoc, eco2, p1, p25, p4, p10, li;
    read_sensors(sensors, &t, &h, &co2, &tvoc, &eco2,
                 &p1, &p25, &p4, &p10, &li);

    /*
     * Zephyr's minimal libc does NOT support %f in snprintf.
     * We use integer math: multiply by 10, then format as "X.Y".
     */
    int it   = (int)(t   * 10);
    int ih   = (int)(h   * 10);
    int ico2 = (int)(co2 * 10);
    int itv  = (int)(tvoc* 10);
    int iec  = (int)(eco2* 10);
    int ip1  = (int)(p1  * 10);
    int ip25 = (int)(p25 * 10);
    int ip4  = (int)(p4  * 10);
    int ip10 = (int)(p10 * 10);
    int ili  = (int)(li  * 10);

    /* --- build JSON (abbreviated keys match the CoAP server parser) --- */
    static uint32_t seq_num = 0;
    uint32_t uptime_ms = k_uptime_get_32();

    char payload[384];
    int len = snprintf(payload, sizeof(payload),
             "{\"id\":\"%s\","
             "\"t\":%d.%d,\"h\":%d.%d,\"c\":%d.%d,"
             "\"tv\":%d.%d,\"ec\":%d.%d,"
             "\"p1\":%d.%d,\"p25\":%d.%d,\"p4\":%d.%d,\"p10\":%d.%d,"
             "\"li\":%d.%d,"
             "\"nodeId\":\"%s\",\"bootId\":\"%s\",\"sequenceNumber\":%u,\"uptimeMs\":%u}",
             node_id,
             it/10, abs(it)%10,   ih/10, abs(ih)%10,   ico2/10, abs(ico2)%10,
             itv/10, abs(itv)%10, iec/10, abs(iec)%10,
             ip1/10, abs(ip1)%10, ip25/10, abs(ip25)%10,
             ip4/10, abs(ip4)%10, ip10/10, abs(ip10)%10,
             ili/10, abs(ili)%10,
             node_id, boot_id, seq_num++, uptime_ms);

    if (len >= sizeof(payload)) {
        LOG_WRN("JSON payload truncated! Length: %d, Buffer: %zu", len, sizeof(payload));
    }

    LOG_INF("Sending payload: %s", payload);

    /* --- build raw CoAP packet --- */
    uint8_t packet[512];
    size_t off = 0;

    /* 4-byte header */
    static uint16_t msg_id = 0x1000;
    packet[off++] = (1 << 6) | (0 << 4) | 0;   /* Ver 1, CON, TKL 0 */
    packet[off++] = 3;                           /* Code 0.03 = PUT   */
    packet[off++] = (uint8_t)(msg_id >> 8);
    packet[off++] = (uint8_t)(msg_id & 0xFF);
    msg_id++;

    /* Option 11: Uri-Path "storedata" */
    const char *uri = "storedata";
    size_t ulen = strlen(uri);
    packet[off++] = (11 << 4) | ulen;
    memcpy(&packet[off], uri, ulen);
    off += ulen;

    /* Payload marker + payload */
    packet[off++] = 0xFF;
    size_t plen = strlen(payload);
    memcpy(&packet[off], payload, plen);
    off += plen;

    int r = sendto(sock, packet, off, 0, gw, sizeof(struct sockaddr_in6));
    if (r < 0) {
        if (errno == ENOMEM) {
            LOG_ERR("CRITICAL: Zephyr Network RAM Buffer is FULL! Packet dropped.");
            /* Option 1 Monitoring: You could turn on a physical RED LED here */
        } else {
            LOG_ERR("Failed to send CoAP request (%d)", errno);
        }
    } else {
        LOG_INF("CoAP request sent successfully");
    }
    return r < 0 ? r : 0;
}

/* ================================================================
 * Thread Dataset (hardcoded – bypasses Zephyr Kconfig bugs)
 * ================================================================ */

static void force_thread_dataset(void)
{
    otInstance *instance = openthread_get_default_instance();
    if (!instance) return;

    LOG_INF("Overriding Zephyr Kconfig and injecting hardcoded dataset...");

    openthread_api_mutex_lock(openthread_get_default_context());

    otThreadSetEnabled(instance, false);
    otIp6SetEnabled(instance, false);

    otOperationalDataset dataset;
    memset(&dataset, 0, sizeof(otOperationalDataset));

    dataset.mActiveTimestamp.mSeconds       = 1;
    dataset.mActiveTimestamp.mTicks         = 0;
    dataset.mActiveTimestamp.mAuthoritative = true;
    dataset.mComponents.mIsActiveTimestampPresent = true;

    dataset.mChannel = 15;
    dataset.mComponents.mIsChannelPresent = true;

    dataset.mPanId = 0x1235;
    dataset.mComponents.mIsPanIdPresent = true;

    uint8_t extPanId[8] = {0x11,0x11,0x11,0x11,0x22,0x22,0x22,0x22};
    memcpy(dataset.mExtendedPanId.m8, extPanId, 8);
    dataset.mComponents.mIsExtendedPanIdPresent = true;

    const char *name = "WSN01";
    memset(dataset.mNetworkName.m8, 0, sizeof(dataset.mNetworkName.m8));
    memcpy(dataset.mNetworkName.m8, name, strlen(name));
    dataset.mComponents.mIsNetworkNamePresent = true;

    uint8_t key[16] = {0x11,0x22,0x33,0x44,0x55,0x66,0x77,0x88,
                       0x99,0xaa,0xbb,0xcc,0xdd,0xee,0xff,0x00};
    memcpy(dataset.mNetworkKey.m8, key, 16);
    dataset.mComponents.mIsNetworkKeyPresent = true;

    uint8_t mlp[8] = {0xfd,0x5e,0xa7,0x26,0xec,0x55,0xee,0x12};
    memcpy(dataset.mMeshLocalPrefix.m8, mlp, 8);
    dataset.mComponents.mIsMeshLocalPrefixPresent = true;

    otError err = otDatasetSetActive(instance, &dataset);
    if (err == OT_ERROR_NONE) {
        LOG_INF("Hardcoded dataset successfully injected!");
    } else {
        LOG_ERR("Failed to set dataset: %d", err);
    }

    otIp6SetEnabled(instance, true);
    otThreadSetEnabled(instance, true);

    openthread_api_mutex_unlock(openthread_get_default_context());
}

/* ================================================================
 * main
 * ================================================================ */

int main(void)
{
    LOG_INF("Starting SSNS Sensor Node - Thread + CoAP");

    force_thread_dataset();
    resolve_node_id();
    resolve_boot_id();

    /* Initialise simulated sensor baselines */
    struct sensor_state sensors;
    sensor_init(&sensors);

    LOG_INF("Node ID: %s  (simulated sensors active)", node_id);

    k_sleep(K_SECONDS(5));

    int sock = socket(AF_INET6, SOCK_DGRAM, IPPROTO_UDP);
    if (sock < 0) {
        LOG_ERR("Failed to create UDP socket (%d)", errno);
        return 0;
    }

    struct sockaddr_in6 gateway_addr = {
        .sin6_family = AF_INET6,
        .sin6_port   = htons(COAP_PORT)
    };
    inet_pton(AF_INET6, GATEWAY_IPV6_ADDR, &gateway_addr.sin6_addr);

    while (1) {
        otInstance *instance = openthread_get_default_instance();
        if (instance) {
            otDeviceRole role = otThreadGetDeviceRole(instance);
            const char *role_str = "unknown";
            switch (role) {
                case OT_DEVICE_ROLE_DISABLED: role_str = "disabled"; break;
                case OT_DEVICE_ROLE_DETACHED: role_str = "detached"; break;
                case OT_DEVICE_ROLE_CHILD:    role_str = "child"; break;
                case OT_DEVICE_ROLE_ROUTER:   role_str = "router"; break;
                case OT_DEVICE_ROLE_LEADER:   role_str = "leader"; break;
            }

            uint16_t rloc16 = otThreadGetRloc16(instance);

            LOG_INF("[DIAG] Role: %s  RLOC16: 0x%04x", role_str, rloc16);
        }

        send_coap_telemetry(sock, (struct sockaddr *)&gateway_addr, &sensors);
        k_sleep(K_SECONDS(10));
    }

    return 0;
}
