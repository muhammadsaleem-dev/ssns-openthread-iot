package de.iot.smartmonitoring.service;

import de.iot.smartmonitoring.dto.AlertResponse;
import de.iot.smartmonitoring.model.Alert;
import de.iot.smartmonitoring.model.SensorData;
import de.iot.smartmonitoring.repository.AlertRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

/**
 * Service responsible for evaluating telemetry against configured thresholds
 * and persisting alerts when values are out of range.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AlertService {

    private final AlertRepository alertRepository;

    @Value("${app.alerts.temperature-max:35.0}")
    private double temperatureMax;

    @Value("${app.alerts.temperature-min:10.0}")
    private double temperatureMin;

    @Value("${app.alerts.co2-max:1500.0}")
    private double co2Max;

    @Value("${app.alerts.pm25-max:35.0}")
    private double pm25Max;

    @Value("${app.alerts.tvoc-max:1000.0}")
    private double tvocMax;

    /**
     * Evaluate a telemetry reading against all configured alert thresholds.
     */
    public void evaluate(SensorData data) {
        // First check for physical hardware faults
        triggerHardwareFault(data.getNodeId(), data.getHealthStatus());

        if (data.getTemperature() != null && data.getTemperature() > -900.0) {
            if (data.getTemperature() > temperatureMax) {
                createAlert(data.getNodeId(), Alert.AlertType.TEMPERATURE_HIGH,
                        Alert.AlertSeverity.WARNING,
                        String.format("Temperature %.1f°C exceeds maximum threshold %.1f°C",
                                data.getTemperature(), temperatureMax),
                        "Inspect AC unit; ensure area is shaded.",
                        data.getTemperature(), temperatureMax);
            }
            if (data.getTemperature() < temperatureMin) {
                createAlert(data.getNodeId(), Alert.AlertType.TEMPERATURE_LOW,
                        Alert.AlertSeverity.WARNING,
                        String.format("Temperature %.1f°C below minimum threshold %.1f°C",
                                data.getTemperature(), temperatureMin),
                        "Check heating systems; close external windows.",
                        data.getTemperature(), temperatureMin);
            }
        }

        if (data.getCo2() != null && data.getCo2() > co2Max) {
            createAlert(data.getNodeId(), Alert.AlertType.HIGH_CO2,
                    Alert.AlertSeverity.WARNING,
                    String.format("CO2 %.1f ppm exceeds threshold %.1f ppm",
                            data.getCo2(), co2Max),
                    "Increase fresh air intake or open windows.",
                    data.getCo2(), co2Max);
        }

        if (data.getPm2_5() != null && data.getPm2_5() > pm25Max) {
            createAlert(data.getNodeId(), Alert.AlertType.HIGH_PARTICULATES,
                    Alert.AlertSeverity.WARNING,
                    String.format("PM2.5 %.1f µg/m³ exceeds threshold %.1f µg/m³",
                            data.getPm2_5(), pm25Max),
                    "Check building air filters; keep external windows closed if smoggy.",
                    data.getPm2_5(), pm25Max);
        }

        if (data.getTvoc() != null && data.getTvoc() > tvocMax) {
            createAlert(data.getNodeId(), Alert.AlertType.HIGH_VOC,
                    Alert.AlertSeverity.WARNING,
                    String.format("TVOC %.1f ppb exceeds threshold %.1f ppb",
                            data.getTvoc(), tvocMax),
                    "Investigate for chemical spills or off-gassing materials; increase ventilation.",
                    data.getTvoc(), tvocMax);
        }
    }

    /**
     * Return all alerts ordered by creation time (newest first).
     */
    public List<AlertResponse> findAll() {
        return alertRepository.findAllByOrderByCreatedAtDesc()
                .stream().map(this::toResponse).toList();
    }

    /**
     * Return only unresolved alerts.
     */
    public List<AlertResponse> findUnresolved() {
        return alertRepository.findByResolvedFalse()
                .stream().map(this::toResponse).toList();
    }

    /**
     * Mark all currently unresolved alerts as resolved, optionally filtered by category.
     * @return the number of alerts resolved.
     */
    public int resolveAllUnresolved(String category) {
        List<Alert> unresolved;
        List<Alert.AlertType> types = getTypesForCategory(category);
        if (types == null || types.isEmpty()) {
            unresolved = alertRepository.findByResolvedFalse();
        } else {
            unresolved = alertRepository.findByTypeInAndResolvedFalse(types);
        }
        if (unresolved.isEmpty()) {
            return 0;
        }
        unresolved.forEach(a -> a.setResolved(true));
        alertRepository.saveAll(unresolved);
        log.info("Bulk resolved {} alerts.", unresolved.size());
        return unresolved.size();
    }

    /**
     * Mark a single alert as resolved.
     */
    public boolean resolveAlert(String id) {
        return alertRepository.findById(id).map(alert -> {
            alert.setResolved(true);
            alertRepository.save(alert);
            log.info("Resolved alert {}", id);
            return true;
        }).orElse(false);
    }

    private static final List<Alert.AlertType> OPERATIONAL_TYPES = List.of(
            Alert.AlertType.TEMPERATURE_HIGH, Alert.AlertType.TEMPERATURE_LOW,
            Alert.AlertType.HIGH_CO2, Alert.AlertType.HIGH_PARTICULATES, Alert.AlertType.HIGH_VOC,
            Alert.AlertType.AIR_QUALITY_POOR, Alert.AlertType.LIGHT_INTENSITY_HIGH,
            Alert.AlertType.HARDWARE_FAULT
    );
    private static final List<Alert.AlertType> AI_TYPES = List.of(
            Alert.AlertType.ML_ANOMALY, Alert.AlertType.FORECAST_WARNING
    );
    private static final List<Alert.AlertType> INFRA_TYPES = List.of(
            Alert.AlertType.NODE_OFFLINE
    );

    private List<Alert.AlertType> getTypesForCategory(String category) {
        if (category == null) return null;
        return switch (category.toLowerCase()) {
            case "operational" -> OPERATIONAL_TYPES;
            case "ai" -> AI_TYPES;
            case "infra" -> INFRA_TYPES;
            default -> null;
        };
    }

    /**
     * Return paginated alerts, optionally filtered by unresolved status, category, and nodeId.
     */
    public Page<AlertResponse> getPaginatedAlerts(boolean unresolvedOnly, String category, String nodeId, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size);
        Page<Alert> alertPage;

        List<Alert.AlertType> typeFilter = getTypesForCategory(category);

        if (typeFilter != null) {
            if (unresolvedOnly) {
                alertPage = alertRepository.findByTypeInAndResolvedFalseOrderByCreatedAtDesc(typeFilter, pageRequest);
            } else {
                alertPage = alertRepository.findByTypeInOrderByCreatedAtDesc(typeFilter, pageRequest);
            }
        } else if (nodeId != null && !nodeId.isBlank()) {
            if (unresolvedOnly) {
                alertPage = alertRepository.findByNodeIdAndResolvedFalseOrderByCreatedAtDesc(nodeId, pageRequest);
            } else {
                alertPage = alertRepository.findByNodeIdOrderByCreatedAtDesc(nodeId, pageRequest);
            }
        } else {
            if (unresolvedOnly) {
                alertPage = alertRepository.findByResolvedFalseOrderByCreatedAtDesc(pageRequest);
            } else {
                alertPage = alertRepository.findAllByOrderByCreatedAtDesc(pageRequest);
            }
        }

        return alertPage.map(this::toResponse);
    }

    /**
     * Return unresolved alert counts for each category.
     */
    public java.util.Map<String, Long> getAlertCounts(String nodeId) {
        long allCount;
        long operationalCount;
        long aiCount;
        long infraCount;

        if (nodeId != null && !nodeId.isBlank()) {
            List<Alert> nodeAlerts = alertRepository.findByNodeIdAndResolvedFalse(nodeId);
            allCount = nodeAlerts.size();
            operationalCount = nodeAlerts.stream().filter(a -> OPERATIONAL_TYPES.contains(a.getType())).count();
            aiCount = nodeAlerts.stream().filter(a -> AI_TYPES.contains(a.getType())).count();
            infraCount = nodeAlerts.stream().filter(a -> INFRA_TYPES.contains(a.getType())).count();
        } else {
            allCount = alertRepository.countByResolvedFalse();
            operationalCount = alertRepository.countByTypeInAndResolvedFalse(OPERATIONAL_TYPES);
            aiCount = alertRepository.countByTypeInAndResolvedFalse(AI_TYPES);
            infraCount = alertRepository.countByTypeInAndResolvedFalse(INFRA_TYPES);
        }

        return java.util.Map.of(
                "all", allCount,
                "operational", operationalCount,
                "ai", aiCount,
                "infra", infraCount
        );
    }

    /**
     * Create an alert when physical sensor hardware is reporting faults (-999.0).
     * Uses the healthStatus bitmask to identify the specific faulty sensor.
     */
    public void triggerHardwareFault(String nodeId, Integer healthStatus) {
        if (healthStatus == null || healthStatus == 255) {
            return; // No fault or unknown status
        }

        StringBuilder message = new StringBuilder("Physical sensor failure detected: ");
        StringBuilder action = new StringBuilder("Action required: ");
        
        // Bit 0: Temp/Hum (SCD41)
        if ((healthStatus & 0x01) == 0) {
            message.append("SCD41 (Temp/Hum) ");
            action.append("Check Temperature sensor wiring. ");
        }
        // Bit 1: CO2 (SCD41)
        if ((healthStatus & 0x02) == 0) {
            message.append("SCD41 (CO2) ");
            action.append("Verify CO2 sensor I2C connection. ");
        }
        // Bit 2: PM (SPS30)
        if ((healthStatus & 0x04) == 0) {
            message.append("SPS30 (Particulates) ");
            action.append("Inspect PM sensor 5V power supply. ");
        }
        // Bit 3: TVOC (CCS811)
        if ((healthStatus & 0x08) == 0) {
            message.append("CCS811 (VOC) ");
            action.append("Check VOC sensor heater pins. ");
        }

        createAlert(nodeId, Alert.AlertType.HARDWARE_FAULT,
                Alert.AlertSeverity.CRITICAL,
                message.toString().trim(),
                action.toString().trim(),
                -999.0, null);
    }

    // ---- Internal helpers ----

    private void createAlert(String nodeId, Alert.AlertType type,
                             Alert.AlertSeverity severity, String message,
                             String recommendedAction,
                             Double triggerValue, Double thresholdValue) {
        
        // Deduplication: Prevent database spam if the sensor continuously reports the same error.
        java.util.Optional<Alert> existing = alertRepository.findFirstByNodeIdAndTypeAndResolvedFalse(nodeId, type);
        if (existing.isPresent()) {
            return; // An unresolved alert of this exact type is already active.
        }

        Alert alert = Alert.builder()
                .nodeId(nodeId)
                .type(type)
                .severity(severity)
                .message(message)
                .recommendedAction(recommendedAction)
                .triggerValue(triggerValue)
                .thresholdValue(thresholdValue)
                .resolved(false)
                .build();
        alertRepository.save(alert);
        log.warn("ALERT [{}] {} on {}: {}", severity, type, nodeId, message);
    }

    /**
     * Create an alert from an external service (like ML anomaly detector).
     */
    public AlertResponse createExternalAlert(de.iot.smartmonitoring.dto.CreateAlertRequest request) {
        // Deduplication: prevent spamming the same active external alert
        java.util.Optional<Alert> existingOpt = alertRepository.findFirstByNodeIdAndTypeAndResolvedFalse(
                request.getNodeId(), request.getType()
        );
        if (existingOpt.isPresent()) {
            Alert existing = existingOpt.get();
            log.debug("Active external alert of type {} already exists for node {}, skipping.", request.getType(), request.getNodeId());
            return toResponse(existing);
        }

        Alert alert = Alert.builder()
                .nodeId(request.getNodeId())
                .type(request.getType())
                .severity(request.getSeverity())
                .message(request.getMessage())
                .context(request.getContext())
                .recommendedAction(request.getRecommendedAction())
                .triggerValue(request.getTriggerValue())
                .thresholdValue(request.getThresholdValue())
                .resolved(false)
                .build();
        alert = alertRepository.save(alert);
        log.warn("EXTERNAL ALERT [{}] {} on {}: {}", alert.getSeverity(), alert.getType(), alert.getNodeId(), alert.getMessage());
        return toResponse(alert);
    }

    private AlertResponse toResponse(Alert alert) {
        return AlertResponse.builder()
                .id(alert.getId())
                .nodeId(alert.getNodeId())
                .type(alert.getType())
                .severity(alert.getSeverity())
                .message(alert.getMessage())
                .context(alert.getContext())
                .recommendedAction(alert.getRecommendedAction())
                .triggerValue(alert.getTriggerValue())
                .thresholdValue(alert.getThresholdValue())
                .resolved(alert.isResolved())
                .createdAt(alert.getCreatedAt())
                .build();
    }
}
