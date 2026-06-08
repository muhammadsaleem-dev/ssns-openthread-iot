package de.iot.smartmonitoring.controller;

import de.iot.smartmonitoring.model.NetworkTopology;
import de.iot.smartmonitoring.service.NetworkTopologyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/network/topology")
@RequiredArgsConstructor
@Tag(name = "Network Topology", description = "Endpoints for OpenThread mesh network topology")
public class NetworkTopologyController {

    private final NetworkTopologyService topologyService;

    @GetMapping
    @Operation(summary = "Get all active network topology snapshots")
    public ResponseEntity<List<NetworkTopology>> getTopology() {
        return ResponseEntity.ok(topologyService.getAllTopologies());
    }

    @PostMapping
    @Operation(summary = "Update network topology", description = "Used by the Fog Node to push latest OTBR routing data")
    public ResponseEntity<NetworkTopology> updateTopology(@RequestBody NetworkTopology topology) {
        log.info("POST /api/network/topology received update");
        return ResponseEntity.ok(topologyService.saveTopology(topology));
    }
}
