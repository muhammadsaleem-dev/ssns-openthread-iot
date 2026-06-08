package de.iot.smartmonitoring.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

/**
 * Represents a registered OpenThread sensor node and its current monitoring status.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "nodes")
public class SensorNode {

    @Id
    private String id;

    @Indexed(unique = true)
    private String nodeId;

    private String meshId;

    private String ipv6Address;

    private String location;

    @Builder.Default
    private NodeStatus status = NodeStatus.UNKNOWN;

    private Instant lastSeenAt;

    @Builder.Default
    private Instant registeredAt = Instant.now();

    @Builder.Default
    private Boolean mlEnabled = true;

    @Builder.Default
    private Integer baselineWindowSize = 20;

    @Builder.Default
    @Field("forecast_horizon_min")
    private Integer forecastHorizonMin = 30;

    @Builder.Default
    private Integer sensitivity = 5;

    /**
     * Current operational status of a sensor node.
     */
    public enum NodeStatus {
        ONLINE,
        OFFLINE,
        UNKNOWN
    }
}
