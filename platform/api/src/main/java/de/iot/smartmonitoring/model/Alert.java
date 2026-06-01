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
 * Represents an alert triggered when telemetry values exceed configured thresholds.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "alerts")
public class Alert {

    @Id
    private String id;

    @Indexed
    private String nodeId;

    private AlertType type;

    private AlertSeverity severity;

    private String message;

    private String context;

    private String recommendedAction;

    private Double triggerValue;

    private Double thresholdValue;

    private boolean resolved;

    @Builder.Default
    private Instant createdAt = Instant.now();

    /**
     * Types of alerts the system can generate.
     */
    public enum AlertType {
        TEMPERATURE_HIGH,
        TEMPERATURE_LOW,
        HIGH_CO2,
        HIGH_PARTICULATES,
        HIGH_VOC,
        NODE_OFFLINE,
        FORECAST_WARNING,
        ML_ANOMALY,
        
        // Legacy types kept for backward compatibility with existing DB records
        @Deprecated AIR_QUALITY_POOR,
        @Deprecated LIGHT_INTENSITY_HIGH
    }

    /**
     * Severity levels for alerts.
     */
    public enum AlertSeverity {
        INFO,
        WARNING,
        CRITICAL
    }
}
