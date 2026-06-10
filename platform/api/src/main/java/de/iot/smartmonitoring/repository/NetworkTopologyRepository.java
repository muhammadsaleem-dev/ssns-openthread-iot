package de.iot.smartmonitoring.repository;

import de.iot.smartmonitoring.model.NetworkTopology;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

@Repository
public interface NetworkTopologyRepository extends MongoRepository<NetworkTopology, String> {
    Optional<NetworkTopology> findFirstByOrderByLastUpdatedAtDesc();
    Optional<NetworkTopology> findByGatewayId(String gatewayId);
    void deleteByLastUpdatedAtBefore(Instant cutoff);
}
