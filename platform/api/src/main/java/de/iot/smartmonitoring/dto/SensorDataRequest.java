package de.iot.smartmonitoring.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Inbound DTO for sensor telemetry ingestion.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Sensor telemetry payload sent by OpenThread gateway or simulator")
public class SensorDataRequest {

    @NotBlank(message = "nodeId is required")
    @Schema(description = "Unique identifier of the sensor node", example = "node-01")
    private String nodeId;

    @Schema(description = "Active Mesh Extended Address assigned by OpenThread", example = "node-abcd")
    private String meshId;

    @NotBlank(message = "bootId is required")
    @Schema(description = "Hardware boot identifier for reboot sequencing", example = "7f32ab91")
    private String bootId;

    @NotNull(message = "sequenceNumber is required")
    @Schema(description = "Monotonically increasing sequence number", example = "1234")
    private Long sequenceNumber;

    @NotNull(message = "temperature is required")
    @Schema(description = "Temperature reading in °C", example = "24.5")
    private Double temperature;

    @NotNull(message = "humidity is required")
    @Schema(description = "Relative humidity in %", example = "45.2")
    private Double humidity;

    @NotNull(message = "co2 is required")
    @Schema(description = "Carbon dioxide concentration (ppm)", example = "450.0")
    private Double co2;

    @NotNull(message = "tvoc is required")
    @Schema(description = "Total VOC (ppb)", example = "120.0")
    private Double tvoc;

    @NotNull(message = "eco2 is required")
    @Schema(description = "Estimated CO2 Equivalent (ppm)", example = "460.0")
    private Double eco2;

    @NotNull(message = "pm1_0 is required")
    @Schema(description = "PM 1.0 (µg/m³)", example = "5.2")
    private Double pm1_0;

    @NotNull(message = "pm2_5 is required")
    @Schema(description = "PM 2.5 (µg/m³)", example = "12.4")
    private Double pm2_5;

    @NotNull(message = "pm4_0 is required")
    @Schema(description = "PM 4.0 (µg/m³)", example = "15.1")
    private Double pm4_0;

    @NotNull(message = "pm10 is required")
    @Schema(description = "PM 10.0 (µg/m³)", example = "18.3")
    private Double pm10;

    @NotNull(message = "lightIntensity is required")
    @Schema(description = "Light intensity in lux", example = "320")
    private Double lightIntensity;

    @Schema(description = "Bitmask representing physical sensor health (1=OK, 0=FAULT)", example = "255")
    private Integer healthStatus;

    @Schema(description = "Timestamp of the reading (ISO-8601). Defaults to server time if omitted.",
            example = "2026-05-10T14:22:00Z")
    private Instant timestamp;
}
