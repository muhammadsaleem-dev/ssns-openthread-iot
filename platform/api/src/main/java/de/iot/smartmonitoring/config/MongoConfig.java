package de.iot.smartmonitoring.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.config.EnableMongoAuditing;

/**
 * MongoDB configuration — enables auditing and any custom Mongo settings.
 */
@Configuration
@EnableMongoAuditing
public class MongoConfig {
    // MongoDB auto-configuration handles connection setup via application.yml.
    // This class enables auditing and can be extended for custom converters,
    // index management, or migration logic as needed.
}
