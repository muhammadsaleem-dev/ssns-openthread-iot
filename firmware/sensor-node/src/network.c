#include "network.h"
/* sensor_interface.h is transitively included via network.h */
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
#include <zephyr/posix/poll.h>
#include <zcbor_encode.h>

LOG_MODULE_REGISTER(network, LOG_LEVEL_DBG);

#define COAP_PORT 5683
#define GATEWAY_IPV6_ADDR "fd5e:a726:ec55:ee12::1"

static char node_id[16];
static char boot_id[9];
static int udp_sock = -1;
static struct sockaddr_in6 gateway_addr;
static uint8_t last_payload[384];
static size_t last_payload_len = 0;

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

    /* Bump timestamp to year 2033 to force OpenThread to accept this dataset over any old flash data */
    dataset.mActiveTimestamp.mSeconds       = 2000000000;
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

    /* Task 2.2: Shorten child timeout to 60s for faster failover detection */
    otThreadSetChildTimeout(instance, 60);

    openthread_api_mutex_unlock(openthread_get_default_context());
}

int network_init(void)
{
    force_thread_dataset();
    resolve_node_id();
    resolve_boot_id();
    LOG_INF("Node ID: %s", node_id);

    udp_sock = socket(AF_INET6, SOCK_DGRAM, IPPROTO_UDP);
    if (udp_sock < 0) {
        LOG_ERR("Failed to create UDP socket (%d)", errno);
        return -1;
    }

    gateway_addr.sin6_family = AF_INET6;
    gateway_addr.sin6_port   = htons(COAP_PORT);
    inet_pton(AF_INET6, GATEWAY_IPV6_ADDR, &gateway_addr.sin6_addr);

    return 0;
}

const uint8_t* network_get_last_payload(void)
{
    return last_payload;
}

size_t network_get_last_payload_len(void)
{
    return last_payload_len;
}

void network_reset_stack(void)
{
    otInstance *instance = openthread_get_default_instance();
    if (!instance) return;

    LOG_WRN("Forcing Thread stack reset for re-attachment...");
    openthread_api_mutex_lock(openthread_get_default_context());
    otThreadSetEnabled(instance, false);
    otThreadSetEnabled(instance, true);
    openthread_api_mutex_unlock(openthread_get_default_context());
}

static int wait_for_coap_ack(uint16_t expected_msg_id)
{
    struct pollfd pfd;
    pfd.fd = udp_sock;
    pfd.events = POLLIN;

    int elapsed_ms = 0;
    while (elapsed_ms < 5000) {
        /* poll in 500ms intervals */
        int ret = poll(&pfd, 1, 500); 
        if (ret < 0) {
            LOG_ERR("poll() failed (%d)", errno);
            return -errno;
        } else if (ret == 0) {
            elapsed_ms += 500;
            continue;
        }

        /* We received a packet, read it */
        uint8_t reply[128];
        struct sockaddr_in6 src_addr;
        socklen_t src_addr_len = sizeof(src_addr);
        ret = recvfrom(udp_sock, reply, sizeof(reply), 0, (struct sockaddr *)&src_addr, &src_addr_len);
        
        if (ret >= 4) {
            uint8_t type = (reply[0] >> 4) & 0x03;
            uint16_t reply_msg_id = (reply[2] << 8) | reply[3];
            
            /* Check if it is an ACK (Type 2) and the Message ID matches */
            if (type == 2 && reply_msg_id == expected_msg_id) {
                LOG_INF("CoAP ACK received successfully from Gateway!");
                return 0;
            } else {
                LOG_DBG("Ignored unrelated packet (Type %d, ID %d)", type, reply_msg_id);
            }
        }
    }
    
    LOG_WRN("CoAP ACK timeout! Gateway is offline.");
    return -ETIMEDOUT;
}

int network_send_coap(const struct sensor_readings *r)
{
    if (udp_sock < 0) {
        return -1;
    }

    static uint32_t seq_num = 0;
    uint32_t uptime_ms = k_uptime_get_32();

    /* Extract current Mesh ID */
    char mesh_id[16];
    otInstance *instance = openthread_get_default_instance();
    if (instance) {
        const otExtAddress *ext = otLinkGetExtendedAddress(instance);
        snprintf(mesh_id, sizeof(mesh_id), "node-%02x%02x", ext->m8[6], ext->m8[7]);
    } else {
        snprintf(mesh_id, sizeof(mesh_id), "node-0000");
    }

    ZCBOR_STATE_E(zse, 2, last_payload, sizeof(last_payload), 43);
    bool ok = zcbor_list_start_encode(zse, 43) &&
              /* Metadata (4 fields) */
              zcbor_tstr_put_term(zse, node_id, sizeof(node_id)) &&
              zcbor_tstr_put_term(zse, boot_id, sizeof(boot_id)) &&
              zcbor_uint32_put(zse, seq_num++) &&
              zcbor_uint32_put(zse, uptime_ms) &&
              
              /* Current values (10 fields) */
              zcbor_float32_put(zse, r->temperature) &&
              zcbor_float32_put(zse, r->humidity) &&
              zcbor_float32_put(zse, r->co2) &&
              zcbor_float32_put(zse, r->tvoc) &&
              zcbor_float32_put(zse, r->eco2) &&
              zcbor_float32_put(zse, r->pm1) &&
              zcbor_float32_put(zse, r->pm25) &&
              zcbor_float32_put(zse, r->pm4) &&
              zcbor_float32_put(zse, r->pm10) &&
              zcbor_float32_put(zse, r->light) &&
              
              /* Health mask and mesh ID (2 fields) */
              zcbor_uint32_put(zse, (uint32_t)r->health_mask) &&
              zcbor_tstr_put_term(zse, mesh_id, sizeof(mesh_id)) &&
              
              /* Temperature statistics (3 fields) */
              zcbor_float32_put(zse, r->temperature_stats.mean) &&
              zcbor_float32_put(zse, r->temperature_stats.std) &&
              zcbor_float32_put(zse, r->temperature_stats.max) &&
              
              /* Humidity statistics (3 fields) */
              zcbor_float32_put(zse, r->humidity_stats.mean) &&
              zcbor_float32_put(zse, r->humidity_stats.std) &&
              zcbor_float32_put(zse, r->humidity_stats.max) &&
              
              /* CO2 statistics (3 fields) */
              zcbor_float32_put(zse, r->co2_stats.mean) &&
              zcbor_float32_put(zse, r->co2_stats.std) &&
              zcbor_float32_put(zse, r->co2_stats.max) &&
              
              /* TVOC statistics (3 fields) */
              zcbor_float32_put(zse, r->tvoc_stats.mean) &&
              zcbor_float32_put(zse, r->tvoc_stats.std) &&
              zcbor_float32_put(zse, r->tvoc_stats.max) &&
              
              /* eCO2 statistics (3 fields) */
              zcbor_float32_put(zse, r->eco2_stats.mean) &&
              zcbor_float32_put(zse, r->eco2_stats.std) &&
              zcbor_float32_put(zse, r->eco2_stats.max) &&
              
              /* PM1 statistics (3 fields) */
              zcbor_float32_put(zse, r->pm1_stats.mean) &&
              zcbor_float32_put(zse, r->pm1_stats.std) &&
              zcbor_float32_put(zse, r->pm1_stats.max) &&
              
              /* PM2.5 statistics (3 fields) */
              zcbor_float32_put(zse, r->pm25_stats.mean) &&
              zcbor_float32_put(zse, r->pm25_stats.std) &&
              zcbor_float32_put(zse, r->pm25_stats.max) &&
              
              /* PM4 statistics (3 fields) */
              zcbor_float32_put(zse, r->pm4_stats.mean) &&
              zcbor_float32_put(zse, r->pm4_stats.std) &&
              zcbor_float32_put(zse, r->pm4_stats.max) &&
              
              /* PM10 statistics (3 fields) */
              zcbor_float32_put(zse, r->pm10_stats.mean) &&
              zcbor_float32_put(zse, r->pm10_stats.std) &&
              zcbor_float32_put(zse, r->pm10_stats.max) &&
              
              zcbor_list_end_encode(zse, 43);

    if (!ok) {
        LOG_ERR("CBOR encode failed!");
        return -1;
    }

    last_payload_len = (size_t)(zse->payload_mut - last_payload);
    LOG_INF("Generated CBOR Array payload: %zu bytes (was ~200 bytes as JSON)", last_payload_len);

    /* --- build raw CoAP packet --- */
    uint8_t packet[512];
    size_t off = 0;

    static uint16_t msg_id = 0x1000;
    packet[off++] = (1 << 6) | (0 << 4) | 0;
    packet[off++] = 3;
    packet[off++] = (uint8_t)(msg_id >> 8);
    packet[off++] = (uint8_t)(msg_id & 0xFF);
    msg_id++;

    const char *uri = "storedata";
    size_t ulen = strlen(uri);
    packet[off++] = (11 << 4) | ulen;
    memcpy(&packet[off], uri, ulen);
    off += ulen;

    packet[off++] = 0xFF;
    memcpy(&packet[off], last_payload, last_payload_len);
    off += last_payload_len;

    int ret = sendto(udp_sock, packet, off, 0, (struct sockaddr *)&gateway_addr, sizeof(struct sockaddr_in6));
    if (ret < 0) {
        if (errno == ENOMEM) {
            LOG_ERR("CRITICAL: Zephyr Network RAM Buffer is FULL! Packet dropped.");
        } else {
            LOG_ERR("Failed to send CoAP request (%d)", errno);
        }
        return -errno;
    } 

    /* Now we actually wait for the Gateway to ACK */
    return wait_for_coap_ack(msg_id - 1);
}

int network_send_raw_payload(const uint8_t *payload, size_t len)
{
    if (udp_sock < 0) return -1;

    uint8_t packet[512];
    size_t off = 0;

    static uint16_t msg_id = 0x2000;
    packet[off++] = (1 << 6) | (0 << 4) | 0;
    packet[off++] = 3;
    packet[off++] = (uint8_t)(msg_id >> 8);
    packet[off++] = (uint8_t)(msg_id & 0xFF);
    msg_id++;

    const char *uri = "storedata";
    size_t ulen = strlen(uri);
    packet[off++] = (11 << 4) | ulen;
    memcpy(&packet[off], uri, ulen);
    off += ulen;

    packet[off++] = 0xFF;
    memcpy(&packet[off], payload, len);
    off += len;

    int r = sendto(udp_sock, packet, off, 0, (struct sockaddr *)&gateway_addr, sizeof(struct sockaddr_in6));
    if (r < 0) {
        LOG_ERR("Failed to send raw CoAP payload (%d)", errno);
        return -errno;
    }
    
    /* Wait for ACK */
    return wait_for_coap_ack(msg_id - 1);
}
