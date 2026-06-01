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
        if (data.getTemperature() != null) {
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
     * Mark all currently unresolved alerts as resolved, optionally filtered by types.
     * @return the number of alerts resolved.
     */
    public int resolveAllUnresolved(List<Alert.AlertType> types) {
        List<Alert> unresolved;
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

    /**
     * Return paginated alerts, optionally filtered by unresolved status and category types.
     */
    public Page<AlertResponse> getPaginatedAlerts(boolean unresolvedOnly, List<Alert.AlertType> types, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size);

        if (types != null && !types.isEmpty()) {
            if (unresolvedOnly) {
                return alertRepository.findByTypeInAndResolvedFalseOrderByCreatedAtDesc(types, pageRequest)
                        .map(this::toResponse);
            } else {
                return alertRepository.findByTypeInOrderByCreatedAtDesc(types, pageRequest)
                        .map(this::toResponse);
            }
        } else {
            if (unresolvedOnly) {
                return alertRepository.findByResolvedFalseOrderByCreatedAtDesc(pageRequest)
                        .map(this::toResponse);
            } else {
                return alertRepository.findAllByOrderByCreatedAtDesc(pageRequest)
                        .map(this::toResponse);
            }
        }
    }

    // ---- Internal helpers ----

    private void createAlert(String nodeId, Alert.AlertType type,
                             Alert.AlertSeverity severity, String message,
                             String recommendedAction,
                             Double triggerValue, Double thresholdValue) {
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
