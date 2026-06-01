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
}
