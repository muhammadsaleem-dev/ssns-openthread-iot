package de.iot.smartmonitoring.service;

import de.iot.smartmonitoring.model.NetworkTopology;
import de.iot.smartmonitoring.repository.NetworkTopologyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class NetworkTopologyService {

    private final NetworkTopologyRepository topologyRepository;

    /**
     * Gets all active network topology snapshots (updated in the last 2 minutes).
     * This self-healing filter ensures that "Ghost" Border Routers (unplugged or stale)
     * automatically disappear from the dashboard to maintain a live hardware view.
     */
    public List<NetworkTopology> getAllTopologies() {
        Instant cutoff = Instant.now().minus(Duration.ofMinutes(2));
        
        return topologyRepository.findAll().stream()
                .filter(t -> t.getGatewayId() != null)
                .filter(t -> t.getLastUpdatedAt() != null && t.getLastUpdatedAt().isAfter(cutoff))
                .collect(Collectors.toList());
    }

    /**
     * Saves or updates the network topology state for a specific gateway.
     * Uses an UPSERT strategy based on gatewayId to support multiple Border Routers
     * without data collisions or flickering.
     */
    public NetworkTopology saveTopology(NetworkTopology topology) {
        if (topology.getGatewayId() == null) {
            log.warn("Attempted to save topology without gatewayId. Falling back to default.");
            topology.setGatewayId("default-br");
        }

        // Upsert logic: Find existing by gatewayId or create new
        Optional<NetworkTopology> existing = topologyRepository.findByGatewayId(topology.getGatewayId());
        
        if (existing.isPresent()) {
            topology.setId(existing.get().getId());
        }

        topology.setLastUpdatedAt(Instant.now());
        NetworkTopology saved = topologyRepository.save(topology);
        
        log.info("Updated network topology for gateway {}: {} nodes", 
                 saved.getGatewayId(), 
                 saved.getNodes() != null ? saved.getNodes().size() : 0);
        
        return saved;
    }
}
