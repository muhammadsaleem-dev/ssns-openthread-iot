package de.iot.smartmonitoring.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "Request to update ML configuration for a node")
public class UpdateMlConfigRequest {

    @NotNull
    @Schema(description = "Whether Machine Learning monitoring is enabled", example = "true")
    private Boolean mlEnabled;

    @NotNull
    @Min(5)
    @Max(2880)
    @Schema(description = "Size of the ML baseline window (samples)", example = "20")
    private Integer baselineWindowSize;
    private Integer forecastHorizonMin;

    @NotNull
    @Min(1)
    @Max(100)
    @Schema(description = "Sensitivity parameter for ML anomaly detection (1-100)", example = "5")
    private Integer sensitivity;
}
