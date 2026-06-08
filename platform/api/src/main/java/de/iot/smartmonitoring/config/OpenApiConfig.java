package de.iot.smartmonitoring.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * OpenAPI / Swagger documentation configuration.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("SSNS Smart Monitoring API")
                        .description("REST API for the Thread-Based Smart Indoor Environmental Monitoring System. "
                                + "Provides telemetry ingestion, node monitoring, and alert management endpoints.")
                        .version("0.1.0")
                        .contact(new Contact()
                                .name("Saleem")
                                .email("saleem@2ality.de"))
                        .license(new License()
                                .name("MIT")
                                .url("https://opensource.org/licenses/MIT")))
                .servers(List.of(
                        new Server().url("http://localhost:8080").description("Local development"),
                        new Server().url("http://backend:8080").description("Docker Compose internal")
                ));
    }
}
