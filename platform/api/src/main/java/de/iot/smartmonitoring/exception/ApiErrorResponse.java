package de.iot.smartmonitoring.exception;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Standardised error response body returned by all API error handlers.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Standard API error response")
public class ApiErrorResponse {

    @Schema(description = "HTTP status code", example = "404")
    private int status;

    @Schema(description = "Error category", example = "Not Found")
    private String error;

    @Schema(description = "Human-readable error message")
    private String message;

    @Schema(description = "Request path that caused the error")
    private String path;

    @Schema(description = "Timestamp of the error")
    @Builder.Default
    private Instant timestamp = Instant.now();

    @Schema(description = "Validation errors (if applicable)")
    private List<String> details;
}
