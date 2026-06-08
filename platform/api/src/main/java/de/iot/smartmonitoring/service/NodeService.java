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

    /**
     * Update the ML configuration of a specific node.
     * Optionally triggers a reset/recalibration in the ML Service.
     */
    public NodeResponse updateMlConfig(String nodeId, de.iot.smartmonitoring.dto.UpdateMlConfigRequest request, boolean forceReset) {
        SensorNode node = sensorNodeRepository.findByNodeId(nodeId)
                .orElseThrow(() -> new ResourceNotFoundException("SensorNode", "nodeId", nodeId));
        
        node.setMlEnabled(request.getMlEnabled());
        node.setBaselineWindowSize(request.getBaselineWindowSize());
        node.setSensitivity(request.getSensitivity());
        
        if (request.getForecastHorizonMin() != null) {
            node.setForecastHorizonMin(request.getForecastHorizonMin());
        }
        
        node = sensorNodeRepository.save(node);

        log.info("Updated ML config for node {}: enabled={}, window={}, sensitivity={}, forecast={}", 
                nodeId, request.getMlEnabled(), request.getBaselineWindowSize(), request.getSensitivity(), request.getForecastHorizonMin());
        
        if (forceReset && request.getMlEnabled()) {
            try {
                org.springframework.web.client.RestTemplate restTemplate = new org.springframework.web.client.RestTemplate();
                String mlServiceUrl = "http://ml-service:8000/reset/" + nodeId + 
                        "?window_size=" + request.getBaselineWindowSize() + 
                        "&sensitivity=" + request.getSensitivity();
                restTemplate.postForEntity(mlServiceUrl, null, String.class);
                log.info("Successfully triggered ML recalibration for node {} at {}", nodeId, mlServiceUrl);
            } catch (Exception e) {
                log.error("Failed to trigger ML recalibration for node {}: {}", nodeId, e.getMessage());
            }
        }
        
        return toResponse(node);
    }

    // ---- Internal helpers ----

    private NodeResponse toResponse(SensorNode node) {
        return NodeResponse.builder()
                .id(node.getId())
                .nodeId(node.getNodeId())
                .meshId(node.getMeshId())
                .location(node.getLocation())
                .status(node.getStatus())
                .lastSeenAt(node.getLastSeenAt())
                .registeredAt(node.getRegisteredAt())
                .mlEnabled(node.getMlEnabled())
                .baselineWindowSize(node.getBaselineWindowSize())
                .forecastHorizonMin(node.getForecastHorizonMin())
                .sensitivity(node.getSensitivity())
                .build();
    }
}
