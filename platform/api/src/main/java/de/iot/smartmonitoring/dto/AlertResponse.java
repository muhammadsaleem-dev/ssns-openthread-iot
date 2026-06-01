package de.iot.smartmonitoring.dto;

import de.iot.smartmonitoring.model.Alert;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Outbound DTO for alert responses.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Alert response payload")
public class AlertResponse {

    @Schema(description = "Alert ID")
    private String id;

    @Schema(description = "Node that triggered the alert", example = "node-01")
    private String nodeId;

    @Schema(description = "Alert type", example = "TEMPERATURE_HIGH")
    private Alert.AlertType type;

    @Schema(description = "Alert severity", example = "WARNING")
    private Alert.AlertSeverity severity;

    @Schema(description = "Human-readable alert description")
    private String message;

    @Schema(description = "Optional context string providing causal attribution")
    private String context;

    @Schema(description = "Actionable advice for the operator")
    private String recommendedAction;

    @Schema(description = "Value that triggered the alert", example = "38.2")
    private Double triggerValue;

    @Schema(description = "Configured threshold value", example = "35.0")
    private Double thresholdValue;

    @Schema(description = "Whether the alert has been resolved")
    private boolean resolved;

    @Schema(description = "Timestamp when the alert was created")
    private Instant createdAt;
}
