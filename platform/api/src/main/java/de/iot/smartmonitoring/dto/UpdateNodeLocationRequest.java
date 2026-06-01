package de.iot.smartmonitoring.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for updating a node's physical location.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateNodeLocationRequest {
    
    @NotBlank(message = "Location cannot be empty")
    private String location;
}
