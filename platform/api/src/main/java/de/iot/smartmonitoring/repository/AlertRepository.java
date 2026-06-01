package de.iot.smartmonitoring.repository;

import de.iot.smartmonitoring.model.Alert;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * MongoDB repository for alerts.
 */
@Repository
public interface AlertRepository extends MongoRepository<Alert, String> {

    List<Alert> findByNodeId(String nodeId);

    List<Alert> findByResolvedFalse();

    List<Alert> findByNodeIdAndResolvedFalse(String nodeId);

    List<Alert> findByType(Alert.AlertType type);

    List<Alert> findBySeverity(Alert.AlertSeverity severity);

    List<Alert> findAllByOrderByCreatedAtDesc();
}
