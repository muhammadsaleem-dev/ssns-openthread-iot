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
 * Represents a historical snapshot of the OpenThread mesh network state.
 * Stored persistently to allow for time-travel topology playback.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "network_topology_history")
public class NetworkTopologyHistory {

    @Id
    private String id;

    @Indexed
    private String hardwareId;  // Secondary index, not unique since we will have many snapshots

    private String gatewayId;
    
    private GatewayHealth gatewayHealth;
    
    private List<ThreadRouteNode> nodes;
    
    @Indexed(expireAfterSeconds = 86400) // 24-hour TTL (MongoDB will automatically delete documents older than this)
    @Builder.Default
    private Instant recordedAt = Instant.now();
}
