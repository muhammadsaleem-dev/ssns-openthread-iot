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
 * Represents a single telemetry reading from a BLE sensor node.
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

    @Indexed
    @Builder.Default
    private Instant timestamp = Instant.now();
}
