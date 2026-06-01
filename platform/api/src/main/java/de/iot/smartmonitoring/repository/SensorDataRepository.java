package de.iot.smartmonitoring.repository;

import de.iot.smartmonitoring.model.SensorData;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * MongoDB repository for sensor telemetry data.
 */
@Repository
public interface SensorDataRepository extends MongoRepository<SensorData, String> {

    List<SensorData> findByNodeId(String nodeId);

    List<SensorData> findTop400ByNodeIdOrderByTimestampDesc(String nodeId);

    List<SensorData> findTop400ByOrderByTimestampDesc();

    Page<SensorData> findAllByOrderByTimestampDesc(Pageable pageable);

    Page<SensorData> findByNodeIdOrderByTimestampDesc(String nodeId, Pageable pageable);

    List<SensorData> findByTimestampBetween(Instant start, Instant end);

    List<SensorData> findByNodeIdAndTimestampBetween(String nodeId, Instant start, Instant end);

    List<SensorData> findTop10ByNodeIdOrderByTimestampDesc(String nodeId);
}
