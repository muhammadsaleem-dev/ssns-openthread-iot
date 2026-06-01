package de.iot.smartmonitoring.monitoring;

import de.iot.smartmonitoring.dto.CreateAlertRequest;
import de.iot.smartmonitoring.model.Alert;
import de.iot.smartmonitoring.model.SensorNode;
import de.iot.smartmonitoring.repository.SensorNodeRepository;
import de.iot.smartmonitoring.service.AlertService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Periodically checks node health by comparing last-seen timestamps
 * against a configurable timeout threshold.
 * <p>
 * Nodes that haven't reported telemetry within the timeout window
 * are marked OFFLINE and a {@code NODE_OFFLINE} alert is persisted so
 * the transition is visible in the dashboard alert feed.
 */
@Slf4j
@Component
@EnableScheduling
@RequiredArgsConstructor
@Profile("!test")
public class NodeHealthMonitor {

    private final SensorNodeRepository sensorNodeRepository;
    private final AlertService alertService;

    @Value("${app.monitoring.node-timeout-seconds:120}")
    private long nodeTimeoutSeconds;

    @Scheduled(fixedDelayString = "${app.monitoring.check-interval-ms:30000}")
    public void checkNodeHealth() {
        Instant threshold = Instant.now().minus(Duration.ofSeconds(nodeTimeoutSeconds));

        // Only examine nodes currently marked ONLINE — avoids re-alerting already-offline nodes.
        List<SensorNode> onlineNodes = sensorNodeRepository.findByStatus(SensorNode.NodeStatus.ONLINE);

        int offlineCount = 0;
        for (SensorNode node : onlineNodes) {
            if (node.getLastSeenAt() != null && node.getLastSeenAt().isBefore(threshold)) {
                node.setStatus(SensorNode.NodeStatus.OFFLINE);
                sensorNodeRepository.save(node);
                offlineCount++;
                log.warn("Node {} marked OFFLINE — last seen at {}", node.getNodeId(), node.getLastSeenAt());

                // Persist an alert so the ONLINE→OFFLINE transition appears in the alert feed.
                alertService.createExternalAlert(CreateAlertRequest.builder()
                        .nodeId(node.getNodeId())
                        .type(Alert.AlertType.NODE_OFFLINE)
                        .severity(Alert.AlertSeverity.WARNING)
                        .message(String.format(
                                "Node %s has gone offline — last telemetry received at %s",
                                node.getNodeId(), node.getLastSeenAt()))
                        .build());
            }
        }

        if (offlineCount > 0) {
            log.info("Health check complete: {} node(s) marked OFFLINE", offlineCount);
        } else {
            log.debug("Health check complete: all nodes healthy");
        }
    }
}
