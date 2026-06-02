package de.iot.smartmonitoring.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Outbound DTO for sensor telemetry responses.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Sensor telemetry response")
public class SensorDataResponse {

    @Schema(description = "Record ID", example = "664f1e2a3b1c4d5e6f7a8b9c")
    private String id;

    @Schema(description = "Sensor node identifier", example = "node-01")
    private String nodeId;

    @Schema(description = "Temperature in °C", example = "24.5")
    private Double temperature;

    @Schema(description = "Relative humidity in %", example = "45.2")
    private Double humidity;

    @Schema(description = "Carbon dioxide concentration (ppm)", example = "450.0")
    private Double co2;

    @Schema(description = "Total VOC (ppb)", example = "120.0")
    private Double tvoc;

    @Schema(description = "Estimated CO2 Equivalent (ppm)", example = "460.0")
    private Double eco2;

    @Schema(description = "PM 1.0 (µg/m³)", example = "5.2")
    private Double pm1_0;

    @Schema(description = "PM 2.5 (µg/m³)", example = "12.4")
    private Double pm2_5;

    @Schema(description = "PM 4.0 (µg/m³)", example = "15.1")
    private Double pm4_0;

    @Schema(description = "PM 10.0 (µg/m³)", example = "18.3")
    private Double pm10;

    @Schema(description = "Light intensity in lux", example = "320")
    private Double lightIntensity;

    @Schema(description = "Bitmask representing physical sensor health (1=OK, 0=FAULT)", example = "255")
    private Integer healthStatus;

    @Schema(description = "Timestamp of the reading", example = "2026-05-10T14:22:00Z")
    private Instant timestamp;
}
