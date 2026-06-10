package de.iot.smartmonitoring.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

/**
 * Root document representing the latest known state of the OpenThread mesh network.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "network_topology")
public class NetworkTopology {

    @Id
    private String id;

    @Indexed(unique = true)
    private String hardwareId;  // Primary stable identifier (FICR-based USB serial)
    
    private String gatewayId;   // Network identifier (OpenThread Extended Address, volatile)
    
    private GatewayHealth gatewayHealth;
    
    private List<ThreadRouteNode> nodes;
    
    @Builder.Default
    private Instant lastUpdatedAt = Instant.now();
}
