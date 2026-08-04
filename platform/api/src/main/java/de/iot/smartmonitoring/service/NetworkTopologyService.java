package de.iot.smartmonitoring.service;

import de.iot.smartmonitoring.model.NetworkTopology;
import de.iot.smartmonitoring.model.NetworkTopologyHistory;
import de.iot.smartmonitoring.repository.NetworkTopologyRepository;
import de.iot.smartmonitoring.repository.NetworkTopologyHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
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
    private final NetworkTopologyHistoryRepository historyRepository;

    // The @Scheduled prune job has been removed. 
    // We now keep historical routers in the database permanently and just flag them as OFFLINE.

    /**
     * Gets all known network topology snapshots.
     * If a snapshot hasn't been updated in the last 2 minutes, its status is forced to "offline".
     */
    public List<NetworkTopology> getAllTopologies() {
        Instant cutoff = Instant.now().minus(Duration.ofMinutes(1));
        
        return topologyRepository.findAll().stream()
                .filter(t -> t.getHardwareId() != null)
                .map(t -> {
                    // If the gateway hasn't reported recently, mark it as offline
                    if (t.getLastUpdatedAt() == null || t.getLastUpdatedAt().isBefore(cutoff)) {
                        if (t.getGatewayHealth() != null) {
                            t.getGatewayHealth().setStatus("offline");
                        }
                    }
                    return t;
                })
                .collect(Collectors.toList());
    }

    /**
     * Saves or updates the network topology state for a specific Border Router.
     * Uses an UPSERT strategy based on hardwareId (stable USB serial number)
     * to support multiple Border Routers without data collisions.
     */
    public NetworkTopology saveTopology(NetworkTopology topology) {
        // Validate hardwareId is present
        if (topology.getHardwareId() == null || topology.getHardwareId().isEmpty()) {
            log.error("Topology missing hardwareId. Rejecting request.");
            throw new IllegalArgumentException("hardwareId is required");
        }

        // UPSERT: Find existing by hardwareId
        Optional<NetworkTopology> existing =
            topologyRepository.findByHardwareId(topology.getHardwareId());
        
        if (existing.isPresent()) {
            // Update existing record (same physical device)
            topology.setId(existing.get().getId());
            log.debug("Updating Border Router: {}", topology.getHardwareId());
        } else {
            // Create new record (new physical device)
            log.info("Registering new Border Router: {}", topology.getHardwareId());
        }

        topology.setLastUpdatedAt(Instant.now());
        NetworkTopology saved = topologyRepository.save(topology);
        
        log.info("Updated topology for BR {} (network: {}): {} nodes",
                 saved.getHardwareId(),
                 saved.getGatewayId(),
                 saved.getNodes() != null ? saved.getNodes().size() : 0);
        
        // Save historical snapshot for time-travel scrubber
        NetworkTopologyHistory history = NetworkTopologyHistory.builder()
                .hardwareId(saved.getHardwareId())
                .gatewayId(saved.getGatewayId())
                .gatewayHealth(saved.getGatewayHealth())
                .nodes(saved.getNodes())
                .recordedAt(Instant.now())
                .build();
        historyRepository.save(history);
        
        return saved;
    }

    /**
     * Gets the timeline of topology snapshots for a specific Border Router hardwareId.
     */
    public List<NetworkTopologyHistory> getTopologyHistory(String hardwareId) {
        return historyRepository.findByHardwareIdOrderByRecordedAtAsc(hardwareId);
    }
}
