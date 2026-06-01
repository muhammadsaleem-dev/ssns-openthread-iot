package de.iot.smartmonitoring.service;

import de.iot.smartmonitoring.dto.NodeResponse;
import de.iot.smartmonitoring.exception.ResourceNotFoundException;
import de.iot.smartmonitoring.model.SensorNode;
import de.iot.smartmonitoring.repository.SensorNodeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Service for querying and managing sensor node registrations.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NodeService {

    private final SensorNodeRepository sensorNodeRepository;

    /**
     * Return all registered sensor nodes.
     */
    public List<NodeResponse> findAll() {
        return sensorNodeRepository.findAll()
                .stream().map(this::toResponse).toList();
    }

    /**
     * Find a specific node by its nodeId.
     */
    public NodeResponse findByNodeId(String nodeId) {
        SensorNode node = sensorNodeRepository.findByNodeId(nodeId)
                .orElseThrow(() -> new ResourceNotFoundException("SensorNode", "nodeId", nodeId));
        return toResponse(node);
    }

    /**
     * Update the human-readable location of a specific node.
     */
    public NodeResponse updateLocation(String nodeId, String location) {
        SensorNode node = sensorNodeRepository.findByNodeId(nodeId)
                .orElseThrow(() -> new ResourceNotFoundException("SensorNode", "nodeId", nodeId));
        
        node.setLocation(location);
        SensorNode savedNode = sensorNodeRepository.save(node);
        log.info("Updated location for node {} to '{}'", nodeId, location);
        
        return toResponse(savedNode);
    }

    // ---- Internal helpers ----

    private NodeResponse toResponse(SensorNode node) {
        return NodeResponse.builder()
                .id(node.getId())
                .nodeId(node.getNodeId())
                .location(node.getLocation())
                .status(node.getStatus())
                .lastSeenAt(node.getLastSeenAt())
                .registeredAt(node.getRegisteredAt())
                .build();
    }
}
