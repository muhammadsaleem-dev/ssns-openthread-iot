package de.iot.smartmonitoring.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents a single node's routing information within the OpenThread mesh network.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ThreadRouteNode {
    private String extAddr;
    private String rloc16;
    private String role; // "leader", "router", "child", "detached"
    private String parentRloc16;
    private Integer linkQualityIn;
    private Integer linkQualityOut;
    private Integer routeCost;
    private Integer age;
    private Integer timeout;
    private String linkType;
}
