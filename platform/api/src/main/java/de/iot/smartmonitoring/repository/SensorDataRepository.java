package de.iot.smartmonitoring.repository;

import de.iot.smartmonitoring.model.SensorData;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

/**
 * MongoDB repository for sensor telemetry data.
 */
@Repository
public interface SensorDataRepository extends MongoRepository<SensorData, String> {

    List<SensorData> findByNodeId(String nodeId);

    List<SensorData> findTop2000ByNodeIdOrderByTimestampDesc(String nodeId);

    List<SensorData> findTop2000ByOrderByTimestampDesc();

    List<SensorData> findByTimestampBetween(Instant start, Instant end);

    List<SensorData> findByNodeIdAndTimestampBetween(String nodeId, Instant start, Instant end);

    List<SensorData> findTop10ByNodeIdOrderByTimestampDesc(String nodeId);
}
