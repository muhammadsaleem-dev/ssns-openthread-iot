package de.iot.smartmonitoring.repository;

import de.iot.smartmonitoring.model.SensorNode;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * MongoDB repository for sensor node registration and monitoring.
 */
@Repository
public interface SensorNodeRepository extends MongoRepository<SensorNode, String> {

    Optional<SensorNode> findByNodeId(String nodeId);

    List<SensorNode> findByStatus(SensorNode.NodeStatus status);

    boolean existsByNodeId(String nodeId);
}
