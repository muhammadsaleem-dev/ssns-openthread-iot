#include "network.h"
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

LOG_MODULE_REGISTER(network, LOG_LEVEL_DBG);

#define COAP_PORT 5683
#define GATEWAY_IPV6_ADDR "fd5e:a726:ec55:ee12::1"

static char node_id[16];
static char boot_id[9];
static int udp_sock = -1;
static struct sockaddr_in6 gateway_addr;
static char last_payload[384];

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

const char* network_get_last_payload(void)
{
    return last_payload;
}

static int wait_for_coap_ack(uint16_t expected_msg_id)
{
    struct pollfd pfd;
    pfd.fd = udp_sock;
    pfd.events = POLLIN;

    int elapsed_ms = 0;
    while (elapsed_ms < 2000) {
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

int network_send_coap(struct sensor_state *sensors)
{
    if (udp_sock < 0) {
        return -1;
    }

    /* --- read sensors --- */
    float t, h, co2, tvoc, eco2, p1, p25, p4, p10, li;
    sensor_service_read(sensors, &t, &h, &co2, &tvoc, &eco2,
                 &p1, &p25, &p4, &p10, &li);

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

    static uint32_t seq_num = 0;
    uint32_t uptime_ms = k_uptime_get_32();

    int len = snprintf(last_payload, sizeof(last_payload),
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

    if (len >= sizeof(last_payload)) {
        LOG_WRN("JSON payload truncated! Length: %d, Buffer: %zu", len, sizeof(last_payload));
    }

    LOG_INF("Sending payload: %s", last_payload);

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
    size_t plen = strlen(last_payload);
    memcpy(&packet[off], last_payload, plen);
    off += plen;

    int r = sendto(udp_sock, packet, off, 0, (struct sockaddr *)&gateway_addr, sizeof(struct sockaddr_in6));
    if (r < 0) {
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

int network_send_raw_payload(const char *payload)
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
    size_t plen = strlen(payload);
    memcpy(&packet[off], payload, plen);
    off += plen;

    int r = sendto(udp_sock, packet, off, 0, (struct sockaddr *)&gateway_addr, sizeof(struct sockaddr_in6));
    if (r < 0) {
        LOG_ERR("Failed to send raw CoAP payload (%d)", errno);
        return -errno;
    }
    
    /* Wait for ACK */
    return wait_for_coap_ack(msg_id - 1);
}
