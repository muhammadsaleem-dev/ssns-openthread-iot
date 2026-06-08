package de.iot.smartmonitoring.dto;

import de.iot.smartmonitoring.model.SensorNode;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Outbound DTO for sensor node responses.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Sensor node information")
public class NodeResponse {

    @Schema(description = "Node document ID")
    private String id;

    @Schema(description = "Sensor node identifier", example = "node-01")
    private String nodeId;

    @Schema(description = "Active Mesh Extended Address", example = "node-abcd")
    private String meshId;

    @Schema(description = "Physical location of the node", example = "Room 204")
    private String location;

    @Schema(description = "Current operational status", example = "ONLINE")
    private SensorNode.NodeStatus status;

    @Schema(description = "Timestamp of last telemetry received")
    private Instant lastSeenAt;

    @Schema(description = "Timestamp when node was first registered")
    private Instant registeredAt;

    @Schema(description = "Whether Machine Learning monitoring is enabled")
    private Boolean mlEnabled;

    @Schema(description = "Size of the ML baseline window (samples)")
    private Integer baselineWindowSize;
    private Integer forecastHorizonMin;

    @Schema(description = "Sensitivity parameter for ML anomaly detection")
    private Integer sensitivity;
}
