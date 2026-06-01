#include "storage.h"
#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include <zephyr/settings/settings.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

LOG_MODULE_REGISTER(storage, LOG_LEVEL_DBG);

#define QUEUE_MAX_ITEMS 50

static uint16_t next_write_id = 1;
static uint16_t next_read_id = 1;

/* Callback used to find the oldest packet */
struct find_ctx {
    uint8_t *buf;
    size_t max_len;
    size_t found_len;
    uint16_t found_id;
    bool found;
};

static int settings_load_cb(const char *name, size_t len, settings_read_cb read_cb, void *cb_arg, void *param)
{
    struct find_ctx *ctx = (struct find_ctx *)param;
    /* name will be the ID, e.g., "1", "2" */
    int id = atoi(name);
    
    if (id > 0 && id == next_read_id && !ctx->found) {
        if (len > ctx->max_len) {
            len = ctx->max_len;
        }
        read_cb(cb_arg, ctx->buf, len);
        ctx->found_len = len;
        ctx->found_id = id;
        ctx->found = true;
    }
    
    return 0;
}

static int settings_meta_cb(const char *name, size_t len, settings_read_cb read_cb, void *cb_arg, void *param)
{
    if (strcmp(name, "w") == 0) {
        read_cb(cb_arg, &next_write_id, sizeof(next_write_id));
    } else if (strcmp(name, "r") == 0) {
        read_cb(cb_arg, &next_read_id, sizeof(next_read_id));
    }
    return 0;
}

int storage_init(void)
{
    /* OpenThread automatically calls settings_subsys_init() for us, 
       so the NVS partition is already mounted safely without crashing! */
       
    LOG_INF("Using Settings subsystem for NVS Queue!");

    /* Load our metadata (read and write heads) */
    settings_load_subtree_direct("qmeta", settings_meta_cb, NULL);
    LOG_INF("Queue loaded: read_id=%d, write_id=%d", next_read_id, next_write_id);

    return 0;
}

int storage_save_packet(const uint8_t *payload, size_t len)
{
    char key[32];
    snprintf(key, sizeof(key), "q/%d", next_write_id);

    /* Enforce a maximum queue limit to avoid completely filling the flash */
    if ((next_write_id - next_read_id) > QUEUE_MAX_ITEMS) {
        LOG_ERR("NVS Queue reached MAX_ITEMS (%d). Dropping packet.", QUEUE_MAX_ITEMS);
        return -ENOMEM;
    }

    int rc = settings_save_one(key, payload, len);
    if (rc == 0) {
        LOG_INF("Saved packet to NVS ID %d", next_write_id);
        next_write_id++;
        
        /* Save metadata */
        settings_save_one("qmeta/w", &next_write_id, sizeof(next_write_id));
    } else {
        LOG_ERR("Failed to save to NVS (%d)", rc);
    }
    
    return rc;
}

int storage_read_oldest_packet(uint8_t *buf, size_t max_len, size_t *out_len, uint16_t *out_id)
{
    if (next_read_id == next_write_id) {
        return -ENOENT; /* Queue empty */
    }

    struct find_ctx ctx;
    ctx.buf = buf;
    ctx.max_len = max_len;
    ctx.found = false;

    settings_load_subtree_direct("q", settings_load_cb, &ctx);

    if (ctx.found) {
        *out_len = ctx.found_len;
        *out_id = ctx.found_id;
        return 0;
    }

    /* If we expected a packet but couldn't find it, advance the read head to recover */
    LOG_WRN("Missing packet %d, advancing read head.", next_read_id);
    next_read_id++;
    settings_save_one("qmeta/r", &next_read_id, sizeof(next_read_id));
    
    return -ENOENT;
}

int storage_delete_packet(uint16_t id)
{
    char key[32];
    snprintf(key, sizeof(key), "q/%d", id);
    
    /* settings_delete is implemented as settings_save_one with NULL value */
    int rc = settings_save_one(key, NULL, 0);
    if (rc == 0) {
        LOG_INF("Deleted NVS packet ID %d", id);
        if (id == next_read_id) {
            next_read_id++;
            settings_save_one("qmeta/r", &next_read_id, sizeof(next_read_id));
        }
    }
    return rc;
}

int storage_get_queue_usage(void)
{
    if (next_write_id >= next_read_id) {
        return (int)(next_write_id - next_read_id);
    }
    return 0;
}

int storage_get_queue_capacity(void)
{
    return QUEUE_MAX_ITEMS;
}
