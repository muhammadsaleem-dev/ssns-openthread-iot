package de.iot.smartmonitoring;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SmartMonitoringApplication {

    public static void main(String[] args) {
        SpringApplication.run(SmartMonitoringApplication.class, args);
    }
}
