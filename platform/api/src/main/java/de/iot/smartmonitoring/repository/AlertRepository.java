package de.iot.smartmonitoring.repository;

import de.iot.smartmonitoring.model.Alert;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

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

    Page<Alert> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<Alert> findByResolvedFalseOrderByCreatedAtDesc(Pageable pageable);

    Page<Alert> findByTypeInOrderByCreatedAtDesc(List<Alert.AlertType> types, Pageable pageable);

    Page<Alert> findByTypeInAndResolvedFalseOrderByCreatedAtDesc(List<Alert.AlertType> types, Pageable pageable);
}
