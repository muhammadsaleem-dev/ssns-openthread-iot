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

    // ========== 30-Sample Statistical Aggregations ==========
    
    // Temperature statistics
    @Schema(description = "Mean temperature over 30 samples (°C)", example = "24.3")
    private Double temperatureMean;
    
    @Schema(description = "Standard deviation of temperature over 30 samples (°C)", example = "0.8")
    private Double temperatureStd;
    
    @Schema(description = "Maximum temperature over 30 samples (°C)", example = "25.1")
    private Double temperatureMax;
    
    // Humidity statistics
    @Schema(description = "Mean humidity over 30 samples (%)", example = "45.0")
    private Double humidityMean;
    
    @Schema(description = "Standard deviation of humidity over 30 samples (%)", example = "2.1")
    private Double humidityStd;
    
    @Schema(description = "Maximum humidity over 30 samples (%)", example = "47.5")
    private Double humidityMax;
    
    // CO2 statistics
    @Schema(description = "Mean CO2 over 30 samples (ppm)", example = "448.0")
    private Double co2Mean;
    
    @Schema(description = "Standard deviation of CO2 over 30 samples (ppm)", example = "12.3")
    private Double co2Std;
    
    @Schema(description = "Maximum CO2 over 30 samples (ppm)", example = "465.0")
    private Double co2Max;
    
    // TVOC statistics
    @Schema(description = "Mean TVOC over 30 samples (ppb)", example = "118.0")
    private Double tvocMean;
    
    @Schema(description = "Standard deviation of TVOC over 30 samples (ppb)", example = "5.2")
    private Double tvocStd;
    
    @Schema(description = "Maximum TVOC over 30 samples (ppb)", example = "125.0")
    private Double tvocMax;
    
    // eCO2 statistics
    @Schema(description = "Mean eCO2 over 30 samples (ppm)", example = "458.0")
    private Double eco2Mean;
    
    @Schema(description = "Standard deviation of eCO2 over 30 samples (ppm)", example = "8.1")
    private Double eco2Std;
    
    @Schema(description = "Maximum eCO2 over 30 samples (ppm)", example = "470.0")
    private Double eco2Max;
    
    // PM1.0 statistics
    @Schema(description = "Mean PM1.0 over 30 samples (µg/m³)", example = "5.1")
    private Double pm1_0Mean;
    
    @Schema(description = "Standard deviation of PM1.0 over 30 samples (µg/m³)", example = "0.3")
    private Double pm1_0Std;
    
    @Schema(description = "Maximum PM1.0 over 30 samples (µg/m³)", example = "5.5")
    private Double pm1_0Max;
    
    // PM2.5 statistics
    @Schema(description = "Mean PM2.5 over 30 samples (µg/m³)", example = "12.2")
    private Double pm2_5Mean;
    
    @Schema(description = "Standard deviation of PM2.5 over 30 samples (µg/m³)", example = "0.8")
    private Double pm2_5Std;
    
    @Schema(description = "Maximum PM2.5 over 30 samples (µg/m³)", example = "13.1")
    private Double pm2_5Max;
    
    // PM4.0 statistics
    @Schema(description = "Mean PM4.0 over 30 samples (µg/m³)", example = "14.9")
    private Double pm4_0Mean;
    
    @Schema(description = "Standard deviation of PM4.0 over 30 samples (µg/m³)", example = "1.2")
    private Double pm4_0Std;
    
    @Schema(description = "Maximum PM4.0 over 30 samples (µg/m³)", example = "16.2")
    private Double pm4_0Max;
    
    // PM10 statistics
    @Schema(description = "Mean PM10 over 30 samples (µg/m³)", example = "18.1")
    private Double pm10Mean;
    
    @Schema(description = "Standard deviation of PM10 over 30 samples (µg/m³)", example = "1.5")
    private Double pm10Std;
    
    @Schema(description = "Maximum PM10 over 30 samples (µg/m³)", example = "19.8")
    private Double pm10Max;
}
