package de.iot.smartmonitoring.service;

import de.iot.smartmonitoring.dto.SensorDataRequest;
import de.iot.smartmonitoring.dto.SensorDataResponse;
import de.iot.smartmonitoring.model.SensorData;
import de.iot.smartmonitoring.model.SensorNode;
import de.iot.smartmonitoring.repository.SensorDataRepository;
import de.iot.smartmonitoring.repository.SensorNodeRepository;
import de.iot.smartmonitoring.websocket.TelemetryWebSocketHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
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
    private final TelemetryWebSocketHandler telemetryWebSocketHandler;

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
                // 30-sample statistics
                .temperatureMean(request.getTemperatureMean())
                .temperatureStd(request.getTemperatureStd())
                .temperatureMax(request.getTemperatureMax())
                .humidityMean(request.getHumidityMean())
                .humidityStd(request.getHumidityStd())
                .humidityMax(request.getHumidityMax())
                .co2Mean(request.getCo2Mean())
                .co2Std(request.getCo2Std())
                .co2Max(request.getCo2Max())
                .tvocMean(request.getTvocMean())
                .tvocStd(request.getTvocStd())
                .tvocMax(request.getTvocMax())
                .eco2Mean(request.getEco2Mean())
                .eco2Std(request.getEco2Std())
                .eco2Max(request.getEco2Max())
                .pm1_0Mean(request.getPm1_0Mean())
                .pm1_0Std(request.getPm1_0Std())
                .pm1_0Max(request.getPm1_0Max())
                .pm2_5Mean(request.getPm2_5Mean())
                .pm2_5Std(request.getPm2_5Std())
                .pm2_5Max(request.getPm2_5Max())
                .pm4_0Mean(request.getPm4_0Mean())
                .pm4_0Std(request.getPm4_0Std())
                .pm4_0Max(request.getPm4_0Max())
                .pm10Mean(request.getPm10Mean())
                .pm10Std(request.getPm10Std())
                .pm10Max(request.getPm10Max())
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

        // Register or update the sensor node, passing the meshId and IPv6 Address if available
        // Note: The request DTO needs to be updated to support getMeshId()
        updateNodeStatus(request.getNodeId(), request.getMeshId(), request.getIpv6Address());

        // Evaluate alert thresholds
        alertService.evaluate(saved);

        SensorDataResponse response = toResponse(saved);
        
        // Broadcast over WebSockets
        telemetryWebSocketHandler.broadcast(response);

        return response;
    }

    private static class CachedData {
        List<SensorDataResponse> data;
        Instant expiresAt;
    }
    private final Map<String, CachedData> queryCache = new java.util.concurrent.ConcurrentHashMap<>();

    /**
     * Return limited telemetry records (max 400) for real-time charts, or downsampled data for historical trends.
     */
    public List<SensorDataResponse> findAll(String nodeId, int hours) {
        String cacheKey = (nodeId == null ? "GLOBAL" : nodeId) + "_HOURS_" + hours;
        CachedData cached = queryCache.get(cacheKey);
        if (cached != null && Instant.now().isBefore(cached.expiresAt)) {
            log.debug("Returning CACHED telemetry for key: {}", cacheKey);
            return cached.data;
        }

        Instant end = Instant.now();
        Instant start = end.minus(Duration.ofHours(hours));

        List<SensorData> rawData;
        if (nodeId != null && !nodeId.isBlank()) {
            rawData = sensorDataRepository.findByNodeIdAndTimestampBetween(nodeId, start, end);
        } else {
            rawData = sensorDataRepository.findByTimestampBetween(start, end);
        }

        // Downsampling
        if (hours > 1 && !rawData.isEmpty()) {
            long bucketMinutes = (hours >= 24) ? 15 : (hours >= 6 ? 5 : 2);
            rawData = downsample(rawData, bucketMinutes);
        }

        // Limit the total records sent to the UI if raw query exceeds 400 without downsampling
        if (hours <= 1 && rawData.size() > 400) {
            // Sort descending first so we keep the newest 400, not the oldest 400
            rawData.sort((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()));
            rawData = rawData.subList(0, 400);
        } else if (hours <= 1 && !rawData.isEmpty()) {
            // Even if we don't truncate, we must return the data sorted descending
            rawData.sort((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()));
        }

        List<SensorDataResponse> response = rawData.stream().map(this::toResponse).toList();

        // Smart Cache Duration: Tie the cache lifespan directly to the downsampling bucket size!
        // If we are averaging data into 15-minute buckets, there is no need to query the database more than once every 15 minutes.
        long cacheTtlSeconds = 5; // Default 5 seconds for real-time (1H)
        if (hours >= 24) cacheTtlSeconds = 15 * 60; // 15 minutes cache
        else if (hours >= 6) cacheTtlSeconds = 5 * 60; // 5 minutes cache
        else if (hours > 1) cacheTtlSeconds = 2 * 60; // 2 minutes cache

        CachedData newCache = new CachedData();
        newCache.data = response;
        newCache.expiresAt = Instant.now().plusSeconds(cacheTtlSeconds);
        queryCache.put(cacheKey, newCache);

        return response;
    }

    private List<SensorData> downsample(List<SensorData> data, long bucketMinutes) {
        long bucketMillis = bucketMinutes * 60 * 1000;
        
        // Group raw telemetry data into time-based buckets per node (e.g., 15-minute intervals)
        Map<String, List<SensorData>> grouped = data.stream().collect(Collectors.groupingBy(d -> {
            long bucketTime = (d.getTimestamp().toEpochMilli() / bucketMillis) * bucketMillis;
            return d.getNodeId() + "_" + bucketTime;
        }));

        List<SensorData> downsampled = new ArrayList<>();
        for (Map.Entry<String, List<SensorData>> entry : grouped.entrySet()) {
            List<SensorData> bucket = entry.getValue();
            if (bucket.isEmpty()) continue;
            
            SensorData first = bucket.get(0);
            SensorData aggregated = SensorData.builder()
                .id(first.getId())
                .nodeId(first.getNodeId())
                .timestamp(Instant.ofEpochMilli((first.getTimestamp().toEpochMilli() / bucketMillis) * bucketMillis))
                // Preserve statistics from the representative reading in the bucket
                .temperatureMean(first.getTemperatureMean())
                .temperatureStd(first.getTemperatureStd())
                .temperatureMax(first.getTemperatureMax())
                .humidityMean(first.getHumidityMean())
                .humidityStd(first.getHumidityStd())
                .humidityMax(first.getHumidityMax())
                .co2Mean(first.getCo2Mean())
                .co2Std(first.getCo2Std())
                .co2Max(first.getCo2Max())
                .tvocMean(first.getTvocMean())
                .tvocStd(first.getTvocStd())
                .tvocMax(first.getTvocMax())
                .eco2Mean(first.getEco2Mean())
                .eco2Std(first.getEco2Std())
                .eco2Max(first.getEco2Max())
                .pm1_0Mean(first.getPm1_0Mean())
                .pm1_0Std(first.getPm1_0Std())
                .pm1_0Max(first.getPm1_0Max())
                .pm2_5Mean(first.getPm2_5Mean())
                .pm2_5Std(first.getPm2_5Std())
                .pm2_5Max(first.getPm2_5Max())
                .pm4_0Mean(first.getPm4_0Mean())
                .pm4_0Std(first.getPm4_0Std())
                .pm4_0Max(first.getPm4_0Max())
                .pm10Mean(first.getPm10Mean())
                .pm10Std(first.getPm10Std())
                .pm10Max(first.getPm10Max())
                .build();
            
            double tempSum = 0, humSum = 0, co2Sum = 0, pm25Sum = 0, tvocSum = 0;
            int tempCount = 0, humCount = 0, co2Count = 0, pm25Count = 0, tvocCount = 0;
            
            // Calculate the average for this time bucket
            // IMPORTANT: Exclude hardware fault placeholders (<= -900.0) sent by the simulator.
            // If we don't exclude them, they will skew the bucket's average into massive negative values.
            for (SensorData d : bucket) {
                if (d.getTemperature() != null && d.getTemperature() > -900) { tempSum += d.getTemperature(); tempCount++; }
                if (d.getHumidity() != null && d.getHumidity() > -900) { humSum += d.getHumidity(); humCount++; }
                if (d.getCo2() != null && d.getCo2() > -900) { co2Sum += d.getCo2(); co2Count++; }
                if (d.getPm2_5() != null && d.getPm2_5() > -900) { pm25Sum += d.getPm2_5(); pm25Count++; }
                if (d.getTvoc() != null && d.getTvoc() > -900) { tvocSum += d.getTvoc(); tvocCount++; }
            }
            
            // Only set the average if we had at least one valid, non-fault reading
            if (tempCount > 0) aggregated.setTemperature(tempSum / tempCount);
            if (humCount > 0) aggregated.setHumidity(humSum / humCount);
            if (co2Count > 0) aggregated.setCo2(co2Sum / co2Count);
            if (pm25Count > 0) aggregated.setPm2_5(pm25Sum / pm25Count);
            if (tvocCount > 0) aggregated.setTvoc(tvocSum / tvocCount);
            
            downsampled.add(aggregated);
        }
        
        downsampled.sort((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()));
        return downsampled;
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

    private void updateNodeStatus(String nodeId, String meshId, String ipv6Address) {
        SensorNode node = sensorNodeRepository.findByNodeId(nodeId)
                .orElse(SensorNode.builder()
                        .nodeId(nodeId)
                        .status(SensorNode.NodeStatus.ONLINE)
                        .build());
        node.setLastSeenAt(Instant.now());
        node.setStatus(SensorNode.NodeStatus.ONLINE);
        
        // Identity Link: Update the meshId if it was provided by the Gateway
        if (meshId != null && !meshId.isBlank()) {
            node.setMeshId(meshId);
        }

        // Network Layer: Update the IPv6 origin address if provided
        if (ipv6Address != null && !ipv6Address.isBlank()) {
            node.setIpv6Address(ipv6Address);
        }
        
        sensorNodeRepository.save(node);
        log.debug("Updated node status: {} (Mesh: {}, IP: {}) → ONLINE", nodeId, meshId, ipv6Address);
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
                // 30-sample statistics
                .temperatureMean(entity.getTemperatureMean())
                .temperatureStd(entity.getTemperatureStd())
                .temperatureMax(entity.getTemperatureMax())
                .humidityMean(entity.getHumidityMean())
                .humidityStd(entity.getHumidityStd())
                .humidityMax(entity.getHumidityMax())
                .co2Mean(entity.getCo2Mean())
                .co2Std(entity.getCo2Std())
                .co2Max(entity.getCo2Max())
                .tvocMean(entity.getTvocMean())
                .tvocStd(entity.getTvocStd())
                .tvocMax(entity.getTvocMax())
                .eco2Mean(entity.getEco2Mean())
                .eco2Std(entity.getEco2Std())
                .eco2Max(entity.getEco2Max())
                .pm1_0Mean(entity.getPm1_0Mean())
                .pm1_0Std(entity.getPm1_0Std())
                .pm1_0Max(entity.getPm1_0Max())
                .pm2_5Mean(entity.getPm2_5Mean())
                .pm2_5Std(entity.getPm2_5Std())
                .pm2_5Max(entity.getPm2_5Max())
                .pm4_0Mean(entity.getPm4_0Mean())
                .pm4_0Std(entity.getPm4_0Std())
                .pm4_0Max(entity.getPm4_0Max())
                .pm10Mean(entity.getPm10Mean())
                .pm10Std(entity.getPm10Std())
                .pm10Max(entity.getPm10Max())
                .build();
    }
}
