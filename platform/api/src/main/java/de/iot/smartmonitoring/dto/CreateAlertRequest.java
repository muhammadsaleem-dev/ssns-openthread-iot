package de.iot.smartmonitoring.dto;

import de.iot.smartmonitoring.model.Alert;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Request payload for creating an external alert")
public class CreateAlertRequest {

    @NotBlank
    @Schema(description = "ID of the node the alert is for", example = "node-01")
    private String nodeId;

    @NotNull
    @Schema(description = "Type of the alert", example = "ML_ANOMALY")
    private Alert.AlertType type;

    @NotNull
    @Schema(description = "Severity of the alert", example = "WARNING")
    private Alert.AlertSeverity severity;

    @NotBlank
    @Schema(description = "Human-readable alert message", example = "ML detected unusual behavior")
    private String message;

    @Schema(description = "Optional context string providing causal attribution", example = "Anomaly score: -0.38 | Elevated: CO2")
    private String context;

    @Schema(description = "Actionable advice for the operator", example = "Check HVAC system")
    private String recommendedAction;

    @Schema(description = "Value that triggered the alert", example = "0.75")
    private Double triggerValue;

    @Schema(description = "Threshold that was breached", example = "0.5")
    private Double thresholdValue;
}
