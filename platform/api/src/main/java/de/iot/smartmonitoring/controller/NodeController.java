package de.iot.smartmonitoring.controller;

import de.iot.smartmonitoring.dto.NodeResponse;
import de.iot.smartmonitoring.service.NodeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import de.iot.smartmonitoring.dto.UpdateNodeLocationRequest;

import java.util.List;

/**
 * REST controller for querying registered sensor nodes.
 */
@Slf4j
@RestController
@RequestMapping("/api/nodes")
@RequiredArgsConstructor
@Tag(name = "Nodes", description = "Sensor node monitoring endpoints")
public class NodeController {

    private final NodeService nodeService;

    @GetMapping
    @Operation(
            summary = "Get all nodes",
            description = "Returns all registered sensor nodes and their current status."
    )
    @ApiResponse(responseCode = "200", description = "List of registered nodes")
    public ResponseEntity<List<NodeResponse>> getAll() {
        log.info("GET /api/nodes");
        return ResponseEntity.ok(nodeService.findAll());
    }

    @GetMapping("/{nodeId}")
    @Operation(
            summary = "Get a specific node",
            description = "Returns details of a specific sensor node by its nodeId."
    )
    @ApiResponse(responseCode = "200", description = "Node details")
    @ApiResponse(responseCode = "404", description = "Node not found")
    public ResponseEntity<NodeResponse> getByNodeId(
            @Parameter(description = "Sensor node ID", example = "node-01")
            @PathVariable String nodeId) {
        log.info("GET /api/nodes/{}", nodeId);
        return ResponseEntity.ok(nodeService.findByNodeId(nodeId));
    }

    @PutMapping("/{nodeId}/location")
    @Operation(
            summary = "Update node location",
            description = "Updates the human-readable location of a specific sensor node."
    )
    @ApiResponse(responseCode = "200", description = "Location updated successfully")
    @ApiResponse(responseCode = "404", description = "Node not found")
    public ResponseEntity<NodeResponse> updateLocation(
            @Parameter(description = "Sensor node ID", example = "node-01") @PathVariable String nodeId,
            @Valid @RequestBody UpdateNodeLocationRequest request) {
        log.info("PUT /api/nodes/{}/location", nodeId);
        return ResponseEntity.ok(nodeService.updateLocation(nodeId, request.getLocation()));
    }

    @PutMapping("/{nodeId}/ml/config")
    @Operation(
            summary = "Update ML configuration",
            description = "Updates the ML parameters (sensitivity, baseline window) and optionally triggers a recalibration."
    )
    @ApiResponse(responseCode = "200", description = "ML config updated successfully")
    @ApiResponse(responseCode = "404", description = "Node not found")
    public ResponseEntity<NodeResponse> updateMlConfig(
            @Parameter(description = "Sensor node ID", example = "node-01") @PathVariable String nodeId,
            @Parameter(description = "Force reset/recalibration in ML service") @RequestParam(defaultValue = "false") boolean forceReset,
            @Valid @RequestBody de.iot.smartmonitoring.dto.UpdateMlConfigRequest request) {
        log.info("PUT /api/nodes/{}/ml/config?forceReset={}", nodeId, forceReset);
        return ResponseEntity.ok(nodeService.updateMlConfig(nodeId, request, forceReset));
    }

    @GetMapping("/ml/status")
    @Operation(
            summary = "Get ML engine status",
            description = "Proxies the status of the Python ML Service to get current baseline collection progress."
    )
    @ApiResponse(responseCode = "200", description = "ML Service status")
    public ResponseEntity<String> getMlStatus() {
        try {
            org.springframework.web.client.RestTemplate restTemplate = new org.springframework.web.client.RestTemplate();
            String response = restTemplate.getForObject("http://ml-service:8000/status", String.class);
            return ResponseEntity.ok()
                    .header("Content-Type", "application/json")
                    .body(response);
        } catch (Exception e) {
            log.error("Failed to fetch ML status: {}", e.getMessage());
            return ResponseEntity.status(503).body("{\"error\": \"ML Service unavailable\"}");
        }
    }
}
