package de.iot.smartmonitoring.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Represents a single telemetry reading from a Thread sensor node.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "sensor_data")
@org.springframework.data.mongodb.core.index.CompoundIndex(name = "dedup_idx", def = "{'nodeId': 1, 'bootId': 1, 'sequenceNumber': 1}", unique = true)
public class SensorData {

    @Id
    private String id;

    @Indexed
    private String nodeId;

    private String bootId;

    private Long sequenceNumber;

    private Double temperature;

    private Double humidity;

    private Double co2;

    private Double tvoc;

    private Double eco2;

    private Double pm1_0;

    private Double pm2_5;

    private Double pm4_0;

    private Double pm10;

    private Double lightIntensity;

    private Integer healthStatus;

    // Statistical aggregation fields (mean, std, max for each sensor)
    // Temperature statistics
    private Double temperatureMean;
    private Double temperatureStd;
    private Double temperatureMax;

    // Humidity statistics
    private Double humidityMean;
    private Double humidityStd;
    private Double humidityMax;

    // CO2 statistics
    private Double co2Mean;
    private Double co2Std;
    private Double co2Max;

    // TVOC statistics
    private Double tvocMean;
    private Double tvocStd;
    private Double tvocMax;

    // eCO2 statistics
    private Double eco2Mean;
    private Double eco2Std;
    private Double eco2Max;

    // PM1.0 statistics
    private Double pm1_0Mean;
    private Double pm1_0Std;
    private Double pm1_0Max;

    // PM2.5 statistics
    private Double pm2_5Mean;
    private Double pm2_5Std;
    private Double pm2_5Max;

    // PM4.0 statistics
    private Double pm4_0Mean;
    private Double pm4_0Std;
    private Double pm4_0Max;

    // PM10 statistics
    private Double pm10Mean;
    private Double pm10Std;
    private Double pm10Max;

    @Indexed
    @Builder.Default
    private Instant timestamp = Instant.now();
}
