package de.iot.smartmonitoring.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents the health and configuration of the OpenThread Border Router (Gateway).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GatewayHealth {
    private String panId;
    private String extPanId;
    private Integer channel;
    private String networkName;
    private String status; // e.g. "offline", "active", "disabled"
    private String uptime;
}
