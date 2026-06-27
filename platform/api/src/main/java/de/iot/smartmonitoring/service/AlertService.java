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
        // 1. Check for physical hardware faults vs live telemetry
        boolean hasAnyFault = (data.getTemperature() != null && data.getTemperature() <= -900.0) ||
                              (data.getHumidity() != null && data.getHumidity() <= -900.0) ||
                              (data.getCo2() != null && data.getCo2() <= -900.0) ||
                              (data.getTvoc() != null && data.getTvoc() <= -900.0) ||
                              (data.getPm2_5() != null && data.getPm2_5() <= -900.0);

        if (!hasAnyFault) {
            // All sensor data streams are valid numbers. Self-heal and resolve any latched hardware fault!
            alertRepository.findFirstByNodeIdAndTypeAndResolvedFalse(data.getNodeId(), Alert.AlertType.HARDWARE_FAULT)
                    .ifPresent(alert -> {
                        alert.setResolved(true);
                        alertRepository.save(alert);
                        log.info("Self-Healing: Auto-resolved latched HARDWARE_FAULT on node {}", data.getNodeId());
                    });
        } else {
            triggerHardwareFault(data.getNodeId(), data.getHealthStatus());
        }

        // 2. Sensor Fault (Statistical)
        if (data.getTvocStd() != null && data.getTvocStd() == 0.0 && data.getTvocMean() != null && data.getTvocMean() > 0) {
            createAlert(data.getNodeId(), Alert.AlertType.HARDWARE_FAULT,
                    Alert.AlertSeverity.CRITICAL,
                    "TVOC standard deviation is perfectly zero. Sensor may be frozen.",
                    "Power cycle the sensor node.",
                    data.getTvoc(), 0.0);
        }

        // 3. Transient VOC Event (Perfume / Breath)
        if (data.getTvocMax() != null && data.getTvocMean() != null && data.getTvocStd() != null && data.getTvoc() != null) {
            // A human breath is a "fat" spike, which dramatically increases the standard deviation. 
            // We use a relaxed threshold (1.5*std) but ENFORCE a minimum absolute jump of 25 ppb to ignore baseline noise.
            boolean isSpike = data.getTvocMax() > data.getTvocMean() + Math.max(1.5 * data.getTvocStd(), 25.0);
            
            if (isSpike && data.getTvoc() < data.getTvocMean() + Math.max(data.getTvocStd(), 10.0)) {
                createAlert(data.getNodeId(), Alert.AlertType.TRANSIENT_VOC_EVENT,
                        Alert.AlertSeverity.INFO,
                        "Transient VOC spike detected and recovered.",
                        "No action required.",
                        data.getTvocMax(), data.getTvocMean());
            } 
            // 8. Sustained Environmental Change (Ventilation Failure)
            else if (data.getTvoc() > tvocMax && data.getTvocMean() > tvocMax * 0.8 && data.getTvocStd() < 100) {
                createAlert(data.getNodeId(), Alert.AlertType.SUSTAINED_ENVIRONMENTAL_CHANGE,
                        Alert.AlertSeverity.WARNING,
                        "Persistent high TVOC detected.",
                        "Check ventilation system immediately.",
                        data.getTvoc(), tvocMax);
            }
        }

        // 4. Particulate Event
        if (data.getPm2_5Max() != null && data.getPm2_5Mean() != null && data.getPm2_5Std() != null && data.getPm2_5() != null) {
            // Apply a noise floor of 5.0 ug/m3 (based on SPS30 hardware accuracy)
            if (data.getPm2_5Max() > data.getPm2_5Mean() + Math.max(3 * data.getPm2_5Std(), 5.0) &&
                data.getPm2_5() < data.getPm2_5Mean() + data.getPm2_5Std()) {
                createAlert(data.getNodeId(), Alert.AlertType.PARTICULATE_EVENT,
                        Alert.AlertSeverity.INFO,
                        "Transient particulate disturbance detected.",
                        "No action required.",
                        data.getPm2_5Max(), data.getPm2_5Mean());
            }
        }

        // 5. Occupancy Event & Transient CO2
        boolean isCo2Valid = data.getCo2() != null && data.getCo2() > -900.0;
        if (isCo2Valid && data.getCo2Mean() != null && data.getCo2Std() != null) {
            // Transient CO2 Event (Direct Breath)
            boolean isCo2Spike = data.getCo2Max() != null && 
                                 data.getCo2Max() > data.getCo2Mean() + Math.max(2.0 * data.getCo2Std(), 100.0);
            
            if (isCo2Spike && data.getCo2() < data.getCo2Mean() + Math.max(data.getCo2Std(), 30.0)) {
                createAlert(data.getNodeId(), Alert.AlertType.TRANSIENT_CO2_EVENT,
                        Alert.AlertSeverity.INFO,
                        "Transient CO2 spike detected and recovered.",
                        "No action required.",
                        data.getCo2Max(), data.getCo2Mean());
            } 
            // Sustained Occupancy
            else if (data.getCo2Mean() > 800 && data.getCo2Std() < 50) {
                createAlert(data.getNodeId(), Alert.AlertType.OCCUPANCY_EVENT,
                        Alert.AlertSeverity.INFO,
                        "Occupancy detected (elevated, stable CO2).",
                        "No action required.",
                        data.getCo2Mean(), 800.0);
            } else if (data.getCo2() > co2Max && data.getCo2Mean() > co2Max * 0.8 && data.getCo2Std() < 150) {
                createAlert(data.getNodeId(), Alert.AlertType.HIGH_CO2,
                        Alert.AlertSeverity.WARNING,
                        String.format("CO2 %.1f ppm exceeds threshold %.1f ppm", data.getCo2(), co2Max),
                        "Increase fresh air intake.",
                        data.getCo2(), co2Max);
            }
        }


        // 6. Rapid Ventilation
        boolean isTempValid = data.getTemperature() != null && data.getTemperature() > -900.0;
        if (isTempValid && isCo2Valid && data.getTemperatureMean() != null && data.getTemperatureStd() != null &&
            data.getCo2Mean() != null && data.getCo2Std() != null) {
            // Apply hardware noise floors: SCD41 Temp accuracy +/- 0.4C, CO2 accuracy +/- 40ppm
            if (data.getTemperature() < data.getTemperatureMean() - Math.max(2 * data.getTemperatureStd(), 0.2) &&
                data.getCo2() < data.getCo2Mean() - Math.max(2 * data.getCo2Std(), 30.0)) {
                createAlert(data.getNodeId(), Alert.AlertType.VENTILATION_EVENT,
                        Alert.AlertSeverity.INFO,
                        "Rapid ventilation detected (Temp & CO2 dropping).",
                        "No action required.",
                        data.getTemperature(), data.getTemperatureMean());
            }
        }

        // 7. Active Cleaning
        if (data.getTvocMax() != null && data.getTvocMean() != null && data.getTvocStd() != null &&
            data.getPm2_5Max() != null && data.getPm2_5Mean() != null && data.getPm2_5Std() != null) {
            // Apply hardware noise floors: 25 ppb for TVOC, 5.0 ug/m3 for PM2.5
            if (data.getTvocMax() > data.getTvocMean() + Math.max(3 * data.getTvocStd(), 25.0) &&
                data.getPm2_5Max() > data.getPm2_5Mean() + Math.max(3 * data.getPm2_5Std(), 5.0)) {
                createAlert(data.getNodeId(), Alert.AlertType.CLEANING_EVENT,
                        Alert.AlertSeverity.INFO,
                        "Active cleaning detected (VOC + PM spike).",
                        "No action required.",
                        data.getTvocMax(), data.getTvocMean());
            }
        }

        // 8. Moisture Event
        if (data.getHumidity() != null && data.getHumidityMean() != null && data.getHumidityStd() != null &&
            data.getCo2Std() != null) {
            // Apply hardware noise floor: SCD41 Humidity accuracy +/- 3% RH
            if (data.getHumidity() > data.getHumidityMean() + Math.max(3 * data.getHumidityStd(), 5.0) &&
                data.getCo2Std() < 10) {
                createAlert(data.getNodeId(), Alert.AlertType.MOISTURE_EVENT,
                        Alert.AlertSeverity.INFO,
                        "Localized moisture spike detected.",
                        "No action required.",
                        data.getHumidity(), data.getHumidityMean());
            }
        }

        // 9. Combustion Warning
        if (data.getPm2_5() != null && data.getTvoc() != null && data.getTemperature() != null &&
            data.getTemperatureMean() != null && data.getTemperatureStd() != null) {
            if (data.getPm2_5() > pm25Max && data.getTvoc() > tvocMax &&
                data.getTemperature() > data.getTemperatureMean() + (2 * data.getTemperatureStd())) {
                createAlert(data.getNodeId(), Alert.AlertType.COMBUSTION_WARNING,
                        Alert.AlertSeverity.CRITICAL,
                        "Combustion warning: High PM, VOC, and Temperature.",
                        "Evacuate and investigate immediately.",
                        data.getTemperature(), data.getTemperatureMean());
            }
        }
        
        // Legacy Checks (Temperature High/Low)
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
        if (healthStatus == null) {
            return;
        }
        if (healthStatus == 255) {
            // Self-Healing: Auto-resolve latched HARDWARE_FAULT alerts once sensor hardware recovers
            alertRepository.findFirstByNodeIdAndTypeAndResolvedFalse(nodeId, Alert.AlertType.HARDWARE_FAULT)
                    .ifPresent(alert -> {
                        alert.setResolved(true);
                        alertRepository.save(alert);
                        log.info("Self-Healing: Auto-resolved latched HARDWARE_FAULT on node {} after hardware recovery.", nodeId);
                    });
            return;
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

    /**
     * Resets the debounce timers for all INFO alerts, allowing immediate triggering.
     * In an HA setup, we simply delete the recent INFO events from the shared database.
     */
    public void resetDebounceTimers() {
        alertRepository.deleteBySeverity(Alert.AlertSeverity.INFO);
        log.info("Deleted all INFO events to reset the distributed debounce timers.");
    }

    private void createAlert(String nodeId, Alert.AlertType type,
                             Alert.AlertSeverity severity, String message,
                             String recommendedAction,
                             Double triggerValue, Double thresholdValue) {
        
        boolean isInfo = (severity == Alert.AlertSeverity.INFO);

        if (isInfo) {
            // Distributed Anti-Spam: Query the shared DB to see if this node recently fired this INFO alert
            java.util.Optional<Alert> recent = alertRepository.findFirstByNodeIdAndTypeOrderByCreatedAtDesc(nodeId, type);
            if (recent.isPresent() && recent.get().getCreatedAt().isAfter(java.time.Instant.now().minusSeconds(300))) {
                return; // Suppress spam for 5 minutes
            }
        } else {
            // Deduplication: Prevent database spam if the sensor continuously reports the same error.
            java.util.Optional<Alert> existing = alertRepository.findFirstByNodeIdAndTypeAndResolvedFalse(nodeId, type);
            if (existing.isPresent()) {
                return; // An unresolved alert of this exact type is already active.
            }
        }

        Alert alert = Alert.builder()
                .nodeId(nodeId)
                .type(type)
                .severity(severity)
                .message(message)
                .recommendedAction(recommendedAction)
                .triggerValue(triggerValue)
                .thresholdValue(thresholdValue)
                .resolved(isInfo) // Auto-resolve INFO events
                .build();
        alertRepository.save(alert);
        
        if (isInfo) {
            log.info("ACTIVITY FEED [{}] {} on {}: {}", severity, type, nodeId, message);
        } else {
            log.warn("ALERT [{}] {} on {}: {}", severity, type, nodeId, message);
        }
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
