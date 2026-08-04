package de.iot.smartmonitoring.repository;

import de.iot.smartmonitoring.model.NetworkTopologyHistory;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NetworkTopologyHistoryRepository extends MongoRepository<NetworkTopologyHistory, String> {
    List<NetworkTopologyHistory> findByHardwareIdOrderByRecordedAtAsc(String hardwareId);
}
