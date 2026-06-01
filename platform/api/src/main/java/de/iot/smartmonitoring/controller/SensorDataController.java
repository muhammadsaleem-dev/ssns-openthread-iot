package de.iot.smartmonitoring.controller;

import de.iot.smartmonitoring.dto.SensorDataRequest;
import de.iot.smartmonitoring.dto.SensorDataResponse;
import de.iot.smartmonitoring.service.SensorDataService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import org.springframework.data.domain.Page;

/**
 * REST controller for sensor telemetry ingestion and retrieval.
 */
@Slf4j
@RestController
@RequestMapping("/api/sensor-data")
@RequiredArgsConstructor
@Tag(name = "Sensor Data", description = "Telemetry ingestion and query endpoints")
public class SensorDataController {

    private final SensorDataService sensorDataService;

    @PostMapping
    @Operation(
            summary = "Ingest sensor telemetry",
            description = "Accepts a telemetry reading from an OpenThread gateway or simulator and persists it. "
                    + "Also updates node status and evaluates alert thresholds."
    )
    @ApiResponse(responseCode = "201", description = "Telemetry record created successfully")
    @ApiResponse(responseCode = "400", description = "Invalid request payload")
    public ResponseEntity<?> ingest(@Valid @RequestBody SensorDataRequest request) {
        log.info("POST /api/sensor-data — nodeId={}", request.getNodeId());
        SensorDataResponse response = sensorDataService.ingest(request);
        
        if (response == null) {
            // Duplicate rejected cleanly; return HTTP 200 OK so the Gateway deletes it from its queue.
            return ResponseEntity.ok().build();
        }
        
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    @Operation(
            summary = "Retrieve sensor data",
            description = "Returns all telemetry records. Optionally filter by nodeId."
    )
    @ApiResponse(responseCode = "200", description = "List of telemetry records")
    public ResponseEntity<List<SensorDataResponse>> getAll(
            @Parameter(description = "Filter by sensor node ID", example = "node-01")
            @RequestParam(required = false) String nodeId) {
        log.info("GET /api/sensor-data — nodeId={}", nodeId);
        return ResponseEntity.ok(sensorDataService.findAll(nodeId));
    }

    @GetMapping("/page")
    @Operation(
            summary = "Retrieve sensor data (Paginated)",
            description = "Returns paginated telemetry records. Optionally filter by nodeId."
    )
    @ApiResponse(responseCode = "200", description = "Page of telemetry records")
    public ResponseEntity<Page<SensorDataResponse>> getPaginated(
            @Parameter(description = "Filter by sensor node ID", example = "node-01")
            @RequestParam(required = false) String nodeId,
            @Parameter(description = "Page number (0-based)", example = "0")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size", example = "10")
            @RequestParam(defaultValue = "10") int size) {
        log.info("GET /api/sensor-data/page — nodeId={}, page={}, size={}", nodeId, page, size);
        return ResponseEntity.ok(sensorDataService.getPaginatedData(nodeId, page, size));
    }

    @GetMapping("/latest/{nodeId}")
    @Operation(
            summary = "Get latest readings for a node",
            description = "Returns the 10 most recent telemetry readings for the specified node."
    )
    @ApiResponse(responseCode = "200", description = "Latest telemetry records for the node")
    public ResponseEntity<List<SensorDataResponse>> getLatest(
            @Parameter(description = "Sensor node ID", example = "node-01")
            @PathVariable String nodeId) {
        log.info("GET /api/sensor-data/latest/{}", nodeId);
        return ResponseEntity.ok(sensorDataService.findLatest(nodeId));
    }
}
