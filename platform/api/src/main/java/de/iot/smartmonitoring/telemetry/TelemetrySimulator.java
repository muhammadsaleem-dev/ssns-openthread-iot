package de.iot.smartmonitoring.telemetry;

import de.iot.smartmonitoring.dto.SensorDataRequest;
import de.iot.smartmonitoring.service.SensorDataService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Simulated telemetry generator that mimics OpenThread sensor node data.
 * <p>
 * Active only under the {@code simulator} Spring profile.
 * When real OpenThread gateway integration is ready, simply remove this profile
 * from the active profiles — no other code changes required.
 */
@Slf4j
@Component
@Profile("simulator")
@EnableScheduling
@RequiredArgsConstructor
public class TelemetrySimulator {

    private final SensorDataService sensorDataService;

    private static final List<String> NODE_IDS = List.of(
            "node-01"
    );

    @Value("${app.simulator.interval-ms:10000}")
    private long intervalMs;

    @PostConstruct
    public void init() {
        log.info("=== Telemetry Simulator ACTIVE — generating data every {}ms for nodes: {} ===",
                intervalMs, NODE_IDS);
    }

    /**
     * Generate and ingest simulated telemetry data at a fixed interval.
     */
    @Scheduled(fixedDelayString = "${app.simulator.interval-ms:10000}")
    public void generateTelemetry() {
        ThreadLocalRandom rng = ThreadLocalRandom.current();
        String nodeId = NODE_IDS.get(rng.nextInt(NODE_IDS.size()));

        double tvoc = roundTo1dp(rng.nextDouble(100.0));
        double eco2 = roundTo1dp(400.0 + tvoc * 0.5);
        double pm25 = roundTo1dp(rng.nextDouble(15.0));

        SensorDataRequest request = SensorDataRequest.builder()
                .nodeId(nodeId)
                .temperature(roundTo1dp(18.0 + rng.nextDouble(15.0)))
                .humidity(roundTo1dp(30.0 + rng.nextDouble(30.0)))
                .co2(roundTo1dp(400.0 + rng.nextDouble(400.0)))
                .tvoc(tvoc)
                .eco2(eco2)
                .pm1_0(roundTo1dp(pm25 * 0.4))
                .pm2_5(pm25)
                .pm4_0(roundTo1dp(pm25 * 1.2))
                .pm10(roundTo1dp(pm25 * 1.5))
                .lightIntensity(roundTo1dp(50.0 + rng.nextDouble(950.0)))
                .timestamp(Instant.now())
                .build();

        sensorDataService.ingest(request);
        log.debug("Simulated telemetry: {} → temp={}, hum={}, co2={}, tvoc={}, pm2.5={}, light={}",
                nodeId, request.getTemperature(), request.getHumidity(),
                request.getCo2(), request.getTvoc(), request.getPm2_5(), request.getLightIntensity());
    }

    private double roundTo1dp(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}
