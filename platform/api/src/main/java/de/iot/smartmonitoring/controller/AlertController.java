package de.iot.smartmonitoring.controller;

import de.iot.smartmonitoring.dto.AlertResponse;
import de.iot.smartmonitoring.service.AlertService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.RequestParam;
import de.iot.smartmonitoring.model.Alert.AlertType;

/**
 * REST controller for querying alerts.
 */
@Slf4j
@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
@Tag(name = "Alerts", description = "Alert management and query endpoints")
public class AlertController {

    private final AlertService alertService;

    @GetMapping
    @Operation(
            summary = "Get all alerts",
            description = "Returns all alerts ordered by creation time (newest first)."
    )
    @ApiResponse(responseCode = "200", description = "List of alerts")
    public ResponseEntity<List<AlertResponse>> getAll() {
        log.info("GET /api/alerts");
        return ResponseEntity.ok(alertService.findAll());
    }

    @GetMapping("/unresolved")
    @Operation(
            summary = "Get unresolved alerts",
            description = "Returns only alerts that have not been resolved yet."
    )
    @ApiResponse(responseCode = "200", description = "List of unresolved alerts")
    public ResponseEntity<List<AlertResponse>> getUnresolved() {
        log.info("GET /api/alerts/unresolved");
        return ResponseEntity.ok(alertService.findUnresolved());
    }

    @GetMapping("/summary")
    @Operation(
            summary = "Get alert counts",
            description = "Returns unresolved alert counts categorized by all, operational, ai, and infra."
    )
    @ApiResponse(responseCode = "200", description = "Map of category to count")
    public ResponseEntity<java.util.Map<String, Long>> getSummary(
            @RequestParam(required = false) String nodeId) {
        log.info("GET /api/alerts/summary - nodeId={}", nodeId);
        return ResponseEntity.ok(alertService.getAlertCounts(nodeId));
    }

    @GetMapping("/page")
    @Operation(
            summary = "Retrieve alerts (Paginated)",
            description = "Returns paginated alerts. Optionally filter by unresolved status and category."
    )
    @ApiResponse(responseCode = "200", description = "Page of alerts")
    public ResponseEntity<Page<AlertResponse>> getPaginated(
            @RequestParam(defaultValue = "false") boolean unresolvedOnly,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String nodeId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        log.info("GET /api/alerts/page — unresolvedOnly={}, category={}, nodeId={}, page={}, size={}", unresolvedOnly, category, nodeId, page, size);
        return ResponseEntity.ok(alertService.getPaginatedAlerts(unresolvedOnly, category, nodeId, page, size));
    }

    @org.springframework.web.bind.annotation.PostMapping
    @Operation(
            summary = "Create an alert externally",
            description = "Allows external services like the ML Analytics layer to dispatch alerts."
    )
    @ApiResponse(responseCode = "201", description = "Alert created successfully")
    public ResponseEntity<AlertResponse> createAlert(
            @jakarta.validation.Valid @org.springframework.web.bind.annotation.RequestBody de.iot.smartmonitoring.dto.CreateAlertRequest request) {
        log.info("POST /api/alerts");
        AlertResponse response = alertService.createExternalAlert(request);
        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED).body(response);
    }
    @org.springframework.web.bind.annotation.PostMapping("/reset-timers")
    @Operation(
            summary = "Reset anti-spam debounce timers",
            description = "Clears the internal cache of recent INFO alerts so new events can trigger immediately."
    )
    @ApiResponse(responseCode = "200", description = "Timers reset")
    public ResponseEntity<Void> resetTimers() {
        log.info("POST /api/alerts/reset-timers");
        alertService.resetDebounceTimers();
        return ResponseEntity.ok().build();
    }

    @org.springframework.web.bind.annotation.PutMapping("/resolve-all")
    @Operation(
            summary = "Resolve all unresolved alerts",
            description = "Marks all currently unresolved alerts as resolved, optionally filtered by type."
    )
    @ApiResponse(responseCode = "200", description = "Number of alerts resolved")
    public ResponseEntity<Integer> resolveAll(
            @org.springframework.web.bind.annotation.RequestParam(required = false) String category) {
        log.info("PUT /api/alerts/resolve-all - category={}", category);
        return ResponseEntity.ok(alertService.resolveAllUnresolved(category));
    }

    @org.springframework.web.bind.annotation.PutMapping("/{id}/resolve")
    @Operation(
            summary = "Resolve a single alert",
            description = "Marks a specific alert as resolved by its ID."
    )
    @ApiResponse(responseCode = "200", description = "Alert resolved successfully")
    @ApiResponse(responseCode = "404", description = "Alert not found")
    public ResponseEntity<Void> resolveAlert(@org.springframework.web.bind.annotation.PathVariable String id) {
        log.info("PUT /api/alerts/{}/resolve", id);
        if (alertService.resolveAlert(id)) {
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }
}
