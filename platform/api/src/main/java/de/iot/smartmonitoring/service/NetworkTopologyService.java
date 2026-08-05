package de.iot.smartmonitoring.service;

import de.iot.smartmonitoring.model.NetworkTopology;
import de.iot.smartmonitoring.model.NetworkTopologyHistory;
import de.iot.smartmonitoring.model.SensorNode;
import de.iot.smartmonitoring.repository.NetworkTopologyRepository;
import de.iot.smartmonitoring.repository.NetworkTopologyHistoryRepository;
import de.iot.smartmonitoring.repository.SensorNodeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.Comparator;

@Slf4j
@Service
@RequiredArgsConstructor
public class NetworkTopologyService {

    private final NetworkTopologyRepository topologyRepository;
    private final NetworkTopologyHistoryRepository historyRepository;
    private final SensorNodeRepository nodeRepository;

    // Prune job: runs every hour, deletes snapshots older than 24 hours
    @Scheduled(fixedRate = 3600000)
    public void cleanupOldHistory() {
        Instant cutoff = Instant.now().minus(Duration.ofHours(24));
        log.info("Running scheduled cleanup of NetworkTopologyHistory older than {}", cutoff);
        historyRepository.deleteByRecordedAtBefore(cutoff);
    }
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

    /**
     * Extracts the historical link quality for a specific node across all available snapshots.
     * Returns a time-series list of link quality metrics.
     */
    public List<Map<String, Object>> getNodeLinkQualityHistory(String identifier) {
        // Fetch all history, but in a real app we'd limit to the last 24h or last 100
        List<NetworkTopologyHistory> allHistory = historyRepository.findAll();
        
        // Resolve the identifier (which might be a nodeId like node-0587) to a meshId (like node-4422)
        String resolvedExtAddr = identifier;
        Optional<SensorNode> nodeOpt = nodeRepository.findByNodeId(identifier);
        if (nodeOpt.isPresent() && nodeOpt.get().getMeshId() != null) {
            resolvedExtAddr = nodeOpt.get().getMeshId();
        }
        final String searchExtAddr = resolvedExtAddr != null ? resolvedExtAddr.replace(":", "").toLowerCase() : null;
        
        return allHistory.stream()
                .sorted(Comparator.comparing(NetworkTopologyHistory::getRecordedAt))
                .map(history -> {
                    if (history.getNodes() == null) return null;
                    return history.getNodes().stream()
                            .filter(n -> {
                                if (n.getExtAddr() == null) return false;
                                String cleanNodeAddr = n.getExtAddr().replace(":", "").toLowerCase();
                                if (cleanNodeAddr.equals(searchExtAddr)) return true;
                                if (history.getHardwareId() != null && history.getHardwareId().toLowerCase().equals(searchExtAddr)) {
                                    return cleanNodeAddr.equals(history.getGatewayId() != null ? history.getGatewayId().replace(":", "").toLowerCase() : null);
                                }
                                String last4 = cleanNodeAddr.length() >= 4 ? cleanNodeAddr.substring(cleanNodeAddr.length() - 4) : cleanNodeAddr;
                                return ("node-" + last4).equals(searchExtAddr);
                            })
                            .findFirst()
                            .map(n -> {
                                Map<String, Object> point = new HashMap<>();
                                point.put("timestamp", history.getRecordedAt());
                                point.put("linkQualityIn", n.getLinkQualityIn() != null ? n.getLinkQualityIn() : 0);
                                point.put("linkQualityOut", n.getLinkQualityOut() != null ? n.getLinkQualityOut() : 0);
                                point.put("routeCost", n.getRouteCost() != null ? n.getRouteCost() : 0);
                                return point;
                            })
                            .orElse(null);
                })
                .filter(p -> p != null)
                .collect(Collectors.toList());
    }
}
