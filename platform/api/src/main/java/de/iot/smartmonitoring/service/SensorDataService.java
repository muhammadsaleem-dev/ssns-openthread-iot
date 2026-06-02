package de.iot.smartmonitoring.service;

import de.iot.smartmonitoring.dto.SensorDataRequest;
import de.iot.smartmonitoring.dto.SensorDataResponse;
import de.iot.smartmonitoring.model.SensorData;
import de.iot.smartmonitoring.model.SensorNode;
import de.iot.smartmonitoring.repository.SensorDataRepository;
import de.iot.smartmonitoring.repository.SensorNodeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

/**
 * Core service for ingesting and querying sensor telemetry data.
 * Also maintains node registration and last-seen tracking.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SensorDataService {

    private final SensorDataRepository sensorDataRepository;
    private final SensorNodeRepository sensorNodeRepository;
    private final AlertService alertService;

    /**
     * Ingest a telemetry reading: persist it, update node status, and evaluate alert rules.
     */
    public SensorDataResponse ingest(SensorDataRequest request) {
        log.info("Ingesting telemetry from node: {}", request.getNodeId());

        SensorData entity = SensorData.builder()
                .nodeId(request.getNodeId())
                .bootId(request.getBootId())
                .sequenceNumber(request.getSequenceNumber())
                .temperature(request.getTemperature())
                .humidity(request.getHumidity())
                .co2(request.getCo2())
                .tvoc(request.getTvoc())
                .eco2(request.getEco2())
                .pm1_0(request.getPm1_0())
                .pm2_5(request.getPm2_5())
                .pm4_0(request.getPm4_0())
                .pm10(request.getPm10())
                .lightIntensity(request.getLightIntensity())
                .healthStatus(request.getHealthStatus())
                .timestamp(request.getTimestamp() != null ? request.getTimestamp() : Instant.now())
                .build();

        // Check for hardware faults (-999.0 placeholder)
        boolean hasHardwareFault = (request.getTemperature() != null && request.getTemperature() <= -900.0) ||
                                   (request.getHumidity() != null && request.getHumidity() <= -900.0) ||
                                   (request.getCo2() != null && request.getCo2() <= -900.0) ||
                                   (request.getTvoc() != null && request.getTvoc() <= -900.0) ||
                                   (request.getPm2_5() != null && request.getPm2_5() <= -900.0);

        if (hasHardwareFault) {
            log.warn("Hardware fault detected in telemetry from node: {}", request.getNodeId());
            alertService.triggerHardwareFault(request.getNodeId(), request.getHealthStatus());
        }

        SensorData saved;
        try {
            saved = sensorDataRepository.save(entity);
            log.debug("Persisted telemetry record: {}", saved.getId());
        } catch (org.springframework.dao.DuplicateKeyException e) {
            log.info("Duplicate telemetry discarded by MongoDB: {}:{}:{}",
                     entity.getNodeId(), entity.getBootId(), entity.getSequenceNumber());
            return null; // Signals duplicate to the controller
        }

        // Register or update the sensor node
        updateNodeStatus(request.getNodeId());

        // Evaluate alert thresholds
        alertService.evaluate(saved);

        return toResponse(saved);
    }

    /**
     * Return limited telemetry records (max 400) for real-time charts.
     */
    public List<SensorDataResponse> findAll(String nodeId) {
        List<SensorData> data;
        if (nodeId != null && !nodeId.isBlank()) {
            log.debug("Querying chart telemetry for node: {}", nodeId);
            data = sensorDataRepository.findTop400ByNodeIdOrderByTimestampDesc(nodeId);
        } else {
            data = sensorDataRepository.findTop400ByOrderByTimestampDesc();
        }
        return data.stream().map(this::toResponse).toList();
    }

    /**
     * Return paginated telemetry records for historical table view.
     */
    public Page<SensorDataResponse> getPaginatedData(String nodeId, int page, int size) {
        if (nodeId != null && !nodeId.isBlank()) {
            return sensorDataRepository.findByNodeIdOrderByTimestampDesc(nodeId, PageRequest.of(page, size))
                    .map(this::toResponse);
        } else {
            return sensorDataRepository.findAllByOrderByTimestampDesc(PageRequest.of(page, size))
                    .map(this::toResponse);
        }
    }

    /**
     * Return the latest telemetry readings for a specific node.
     */
    public List<SensorDataResponse> findLatest(String nodeId) {
        return sensorDataRepository.findTop10ByNodeIdOrderByTimestampDesc(nodeId)
                .stream().map(this::toResponse).toList();
    }

    // ---- Internal helpers ----

    private void updateNodeStatus(String nodeId) {
        SensorNode node = sensorNodeRepository.findByNodeId(nodeId)
                .orElse(SensorNode.builder()
                        .nodeId(nodeId)
                        .status(SensorNode.NodeStatus.ONLINE)
                        .build());
        node.setLastSeenAt(Instant.now());
        node.setStatus(SensorNode.NodeStatus.ONLINE);
        sensorNodeRepository.save(node);
        log.debug("Updated node status: {} → ONLINE", nodeId);
    }

    private SensorDataResponse toResponse(SensorData entity) {
        return SensorDataResponse.builder()
                .id(entity.getId())
                .nodeId(entity.getNodeId())
                .temperature(entity.getTemperature())
                .humidity(entity.getHumidity())
                .co2(entity.getCo2())
                .tvoc(entity.getTvoc())
                .eco2(entity.getEco2())
                .pm1_0(entity.getPm1_0())
                .pm2_5(entity.getPm2_5())
                .pm4_0(entity.getPm4_0())
                .pm10(entity.getPm10())
                .lightIntensity(entity.getLightIntensity())
                .healthStatus(entity.getHealthStatus())
                .timestamp(entity.getTimestamp())
                .build();
    }
}
