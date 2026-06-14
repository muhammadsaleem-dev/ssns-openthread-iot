cmake_minimum_required(VERSION 3.20.0)

# ---------------------------------------------------------------------------
# Devicetree Overlay
# ---------------------------------------------------------------------------
# Explicitly tell Zephyr to use our overlay file so it doesn't get lost
# when building with namespaced board targets like nrf52840dk/nrf52840
set(DTC_OVERLAY_FILE ${CMAKE_CURRENT_SOURCE_DIR}/app.overlay)

find_package(Zephyr REQUIRED HINTS $ENV{ZEPHYR_BASE})
project(ssns_sensor_node)

# ---------------------------------------------------------------------------
# Core sources — always compiled regardless of sensor mode
# ---------------------------------------------------------------------------
target_sources(app PRIVATE
    src/main.c
    src/network.c
    src/storage.c
)

# NOTE: src/sensors.c (old monolithic simulation) is intentionally NOT listed
# here. It is kept on disk for reference only. The new sensor_sim.c replaces
# it. If both were compiled, there would be duplicate symbol linker errors.

# ---------------------------------------------------------------------------
# Sensor backend — only one mode is compiled at a time
# ---------------------------------------------------------------------------
target_sources_ifdef(CONFIG_SENSOR_MODE_SIMULATION app PRIVATE
    src/sensors/sensor_sim.c
)

target_sources_ifdef(CONFIG_SENSOR_MODE_HARDWARE app PRIVATE
    src/sensors/sensor_hw.c
    src/sensors/sensor_aggregator.c
)

# ---------------------------------------------------------------------------
# Hardware drivers — only compiled when their sensor is enabled
# ---------------------------------------------------------------------------
target_sources_ifdef(CONFIG_SENSOR_SCD41  app PRIVATE
    src/sensors/drivers/scd41_driver.c
)

target_sources_ifdef(CONFIG_SENSOR_CCS811 app PRIVATE
    src/sensors/drivers/ccs811_driver.c
)

target_sources_ifdef(CONFIG_SENSOR_SPS30  app PRIVATE
    src/sensors/drivers/sps30_driver.c
)

# ---------------------------------------------------------------------------
# Include paths
# ---------------------------------------------------------------------------
# src/            — for network.h, storage.h (they include sensors/sensor_interface.h)
# src/sensors/    — for sensor_interface.h, sensor_aggregator.h
# (drivers use #include "sensor_interface.h" via src/sensors/ path)
target_include_directories(app PRIVATE
    src
    src/sensors
    src/sensors/drivers
)
