# Statistical Aggregation Fields - Utilization Plan

## Executive Summary

The SSNS platform currently collects **27 statistical fields** (mean, std, max for 9 sensors) alongside 10 current sensor readings. These statistics are flowing through the entire pipeline but are **underutilized** - only the ML service is leveraging them. This document outlines how to maximize the value of these statistics across the platform.

---

## Background

### What We Have (Phase 1 - Completed)

**Firmware Layer:**
- 30-sample circular buffers for 9 sensor channels
- Real-time calculation of mean, standard deviation, and max
- CBOR encoding of 43 fields (10 current + 27 statistics + 6 metadata)

**Data Pipeline:**
```
Firmware (43 fields) → Gateway (45 fields) → Backend (41 fields) → API (41 fields)
```

**Statistics Fields (27 total):**
- Temperature: mean, std, max
- Humidity: mean, std, max
- CO2: mean, std, max
- TVOC: mean, std, max
- eCO2: mean, std, max
- PM1.0: mean, std, max
- PM2.5: mean, std, max
- PM4.0: mean, std, max
- PM10: mean, std, max

### Current Utilization

✅ **ML Service** - Using all 37 dimensions (10 current + 27 stats) for anomaly detection
✅ **Backend API** - Storing and serving all 41 fields via MongoDB
✅ **Gateway** - Parsing and forwarding all statistics
❌ **Dashboard** - Not displaying statistics to users
❌ **Alerting** - Not using statistics for intelligent thresholds
❌ **Analytics** - Not leveraging statistics for trend analysis

---

## Why Statistics Matter

### 1. Sensor Stability Insights
**Standard Deviation (σ) reveals:**
- Low σ (< 0.5) = Stable environment
- High σ (> 2.0) = Fluctuating conditions or sensor noise
- Increasing σ over time = Sensor degradation

**Example:**
```
Temperature: 22.5°C, σ = 0.2°C → "Stable"
Temperature: 22.5°C, σ = 3.5°C → "Fluctuating - Check HVAC"
```

### 2. Anomaly Detection
**Max values detect spikes:**
- Current reading: 800 ppm CO2
- Max (30 samples): 1200 ppm CO2
- **Insight:** Recent spike occurred, investigate cause

### 3. Context-Aware Alerting
**Reduce false positives:**
```
Scenario 1: CO2 = 1100 ppm, σ = 50 ppm
→ Sustained high CO2, trigger alert

Scenario 2: CO2 = 1100 ppm, σ = 300 ppm
→ Temporary spike, no alert needed
```

### 4. Predictive Maintenance
**Track sensor health:**
- Baseline σ: 0.5°C (healthy sensor)
- Current σ: 2.5°C (degrading sensor)
- **Action:** Schedule sensor replacement

---

## Implementation Roadmap

### Phase A: Dashboard Visualization (High Priority)
**Effort:** 2-3 hours | **Impact:** High | **Risk:** Low

#### 1. Update NodeCard Component
**File:** `platform/dashboard/src/pages/NodesPage.jsx` or similar

**Add Statistics Section:**
```jsx
<Card title="Sensor Stability (30 samples)">
  <StatRow>
    <Label>Temperature</Label>
    <Value>{data.temperature.toFixed(1)}°C</Value>
    <Badge color={data.temperatureStd < 0.5 ? 'green' : 'yellow'}>
      {data.temperatureStd < 0.5 ? 'Stable' : 'Fluctuating'}
    </Badge>
    <Detail>σ = {data.temperatureStd.toFixed(2)}°C</Detail>
  </StatRow>
  
  <StatRow>
    <Label>CO2</Label>
    <Value>{data.co2.toFixed(0)} ppm</Value>
    <Badge color={data.co2Std < 50 ? 'green' : 'yellow'}>
      {data.co2Std < 50 ? 'Stable' : 'Fluctuating'}
    </Badge>
    <Detail>Peak: {data.co2Max.toFixed(0)} ppm</Detail>
  </StatRow>
  
  <StatRow>
    <Label>PM2.5</Label>
    <Value>{data.pm2_5.toFixed(1)} µg/m³</Value>
    <Badge color={data.pm2_5Std < 2 ? 'green' : 'yellow'}>
      {data.pm2_5Std < 2 ? 'Stable' : 'Fluctuating'}
    </Badge>
    <Detail>Peak: {data.pm2_5Max.toFixed(1)} µg/m³</Detail>
  </StatRow>
  
  <StatRow>
    <Label>Humidity</Label>
    <Value>{data.humidity.toFixed(1)}%</Value>
    <Badge color={data.humidityStd < 2 ? 'green' : 'yellow'}>
      {data.humidityStd < 2 ? 'Stable' : 'Fluctuating'}
    </Badge>
    <Detail>σ = {data.humidityStd.toFixed(2)}%</Detail>
  </StatRow>
</Card>
```

**Benefits:**
- Users see sensor stability at a glance
- Peak values highlight recent anomalies
- Color-coded badges for quick assessment
- No backend changes required (data already available)

#### 2. Add Stability Thresholds
**Create utility function:**
```javascript
// src/utils/sensorStability.js
export const getStabilityStatus = (std, thresholds) => {
  if (std < thresholds.stable) return { status: 'Stable', color: 'green' };
  if (std < thresholds.moderate) return { status: 'Moderate', color: 'yellow' };
  return { status: 'Unstable', color: 'red' };
};

export const STABILITY_THRESHOLDS = {
  temperature: { stable: 0.5, moderate: 1.5 },
  humidity: { stable: 2.0, moderate: 5.0 },
  co2: { stable: 50, moderate: 150 },
  tvoc: { stable: 20, moderate: 50 },
  pm2_5: { stable: 2.0, moderate: 5.0 },
  pm10: { stable: 3.0, moderate: 8.0 }
};
```

#### 3. Create Statistics Detail Modal
**Show all 27 fields on click:**
```jsx
<Modal title="Detailed Statistics (30-sample window)">
  <Table>
    <Row>
      <Cell>Sensor</Cell>
      <Cell>Current</Cell>
      <Cell>Mean</Cell>
      <Cell>Std Dev</Cell>
      <Cell>Max</Cell>
      <Cell>Status</Cell>
    </Row>
    {/* Render all 9 sensors with their statistics */}
  </Table>
</Modal>
```

---

### Phase B: Smart Alerting (Medium Priority)
**Effort:** 3-4 hours | **Impact:** High | **Risk:** Low

#### 1. Backend Alert Service Enhancement
**File:** `platform/api/src/main/java/de/iot/smartmonitoring/service/AlertService.java`

**Add Statistics-Based Alert Logic:**
```java
public void evaluateStatisticalAlerts(SensorData data) {
    // Sustained high CO2 with low variability
    if (data.getCo2Max() > 1000 && data.getCo2Std() < 100) {
        createAlert(
            data.getNodeId(),
            AlertType.SUSTAINED_HIGH_CO2,
            "CO2 consistently above 1000 ppm",
            AlertSeverity.WARNING
        );
    }
    
    // Temperature spike with high variability
    if (data.getTemperatureMax() > 30 && data.getTemperatureStd() > 2.0) {
        createAlert(
            data.getNodeId(),
            AlertType.TEMPERATURE_INSTABILITY,
            "Temperature fluctuating significantly",
            AlertSeverity.INFO
        );
    }
    
    // PM2.5 sustained elevation
    if (data.getPm2_5Mean() > 35 && data.getPm2_5Std() < 5) {
        createAlert(
            data.getNodeId(),
            AlertType.SUSTAINED_HIGH_PM25,
            "Air quality consistently poor",
            AlertSeverity.WARNING
        );
    }
    
    // Sensor degradation detection
    if (data.getTemperatureStd() > 5.0) {
        createAlert(
            data.getNodeId(),
            AlertType.SENSOR_DEGRADATION,
            "Temperature sensor showing high noise - check hardware",
            AlertSeverity.MAINTENANCE
        );
    }
}
```

#### 2. Add Alert Types
**File:** `platform/api/src/main/java/de/iot/smartmonitoring/model/Alert.java`

```java
public enum AlertType {
    // Existing types
    HIGH_TEMPERATURE,
    HIGH_CO2,
    HIGH_PM25,
    
    // New statistical alert types
    SUSTAINED_HIGH_CO2,
    SUSTAINED_HIGH_PM25,
    TEMPERATURE_INSTABILITY,
    HUMIDITY_INSTABILITY,
    SENSOR_DEGRADATION,
    ENVIRONMENTAL_STABILITY
}
```

#### 3. Dashboard Alert Display
**Show context in alert cards:**
```jsx
<Alert severity="warning">
  <Title>Sustained High CO2</Title>
  <Message>CO2 consistently above 1000 ppm</Message>
  <Context>
    Current: 1050 ppm | Mean: 1020 ppm | Max: 1100 ppm
    Stability: Low variability (σ = 45 ppm)
  </Context>
</Alert>
```

**Benefits:**
- Fewer false positives (context-aware)
- Actionable insights (sustained vs spike)
- Predictive maintenance alerts
- Better user experience

---

### Phase C: Historical Analysis (Low Priority)
**Effort:** 4-5 hours | **Impact:** Medium | **Risk:** Low

#### 1. Statistics API Endpoints
**File:** `platform/api/src/main/java/de/iot/smartmonitoring/controller/SensorDataController.java`

**Add new endpoints:**
```java
@GetMapping("/api/sensor-data/statistics/{nodeId}")
public ResponseEntity<StatisticsResponse> getStatistics(
    @PathVariable String nodeId,
    @RequestParam(defaultValue = "24h") String timeRange
) {
    // Return aggregated statistics over time period
}

@GetMapping("/api/sensor-data/stability-trend/{nodeId}")
public ResponseEntity<StabilityTrendResponse> getStabilityTrend(
    @PathVariable String nodeId,
    @RequestParam String metric
) {
    // Return std deviation trend over time
}
```

#### 2. Dashboard Charts with Statistics
**Create new chart component:**
```jsx
<Chart title="Temperature with Stability Bands">
  {/* Plot mean line */}
  <Line data={temperatureMean} color="blue" />
  
  {/* Plot mean ± std bands */}
  <Area 
    data={temperatureMean.map((m, i) => [
      m - temperatureStd[i],
      m + temperatureStd[i]
    ])}
    color="blue"
    opacity={0.2}
  />
  
  {/* Plot max values as markers */}
  <Scatter data={temperatureMax} color="red" />
</Chart>
```

#### 3. Sensor Health Dashboard
**New page: `/sensors/health`**
```jsx
<HealthDashboard>
  <SensorCard nodeId="node-598c">
    <Metric>Temperature Sensor</Metric>
    <HealthScore>95%</HealthScore>
    <Trend>
      Baseline σ: 0.5°C (2 weeks ago)
      Current σ: 0.6°C
      Status: Healthy
    </Trend>
  </SensorCard>
</HealthDashboard>
```

**Benefits:**
- Track sensor degradation over time
- Identify patterns in environmental data
- Better capacity planning
- Predictive maintenance scheduling

---

## Quick Wins (Immediate Actions)

### 1. Dashboard Update (1-2 hours)
**File:** `platform/dashboard/src/pages/NodesPage.jsx`

Add 4 key statistics to existing node cards:
- Temperature: current + std + stability badge
- CO2: current + max + stability badge
- PM2.5: current + max + stability badge
- Humidity: current + std + stability badge

**No backend changes needed** - data already available via API.

### 2. Alert Enhancement (1 hour)
**File:** `platform/api/src/main/java/de/iot/smartmonitoring/service/AlertService.java`

Add 2 new alert rules:
- Sustained high CO2 (mean > 1000, std < 100)
- Sensor degradation (std > 5.0 for temperature)

**Minimal code changes** - leverage existing alert infrastructure.

---

## Success Metrics

### Phase A (Dashboard)
- ✅ Users can see sensor stability at a glance
- ✅ Peak values visible for all key metrics
- ✅ Color-coded stability indicators
- ✅ Zero additional API calls (data already fetched)

### Phase B (Alerting)
- ✅ 50% reduction in false positive alerts
- ✅ Predictive maintenance alerts for degrading sensors
- ✅ Context-aware alert messages
- ✅ Better user satisfaction

### Phase C (Analytics)
- ✅ Historical stability trends visible
- ✅ Sensor health monitoring dashboard
- ✅ Predictive maintenance scheduling
- ✅ Better capacity planning

---

## Technical Notes

### Data Already Available
All 27 statistical fields are:
- ✅ Calculated in firmware (30-sample window)
- ✅ Transmitted via CBOR (43 fields)
- ✅ Parsed by gateway
- ✅ Stored in MongoDB
- ✅ Served via API (`/api/sensor-data/latest/{nodeId}`)

**No firmware or backend changes needed for Phase A & B.**

### API Response Example
```json
{
  "nodeId": "node-598c",
  "temperature": 22.5,
  "temperatureMean": 22.3,
  "temperatureStd": 0.4,
  "temperatureMax": 23.1,
  "co2": 850,
  "co2Mean": 820,
  "co2Std": 45,
  "co2Max": 920,
  // ... all 41 fields
}
```

### Stability Thresholds (Recommended)
Based on typical indoor environments:

| Metric | Stable (σ) | Moderate (σ) | Unstable (σ) |
|--------|-----------|--------------|--------------|
| Temperature | < 0.5°C | 0.5-1.5°C | > 1.5°C |
| Humidity | < 2% | 2-5% | > 5% |
| CO2 | < 50 ppm | 50-150 ppm | > 150 ppm |
| TVOC | < 20 ppb | 20-50 ppb | > 50 ppb |
| PM2.5 | < 2 µg/m³ | 2-5 µg/m³ | > 5 µg/m³ |
| PM10 | < 3 µg/m³ | 3-8 µg/m³ | > 8 µg/m³ |

---

## Conclusion

The 27 statistical fields are a **valuable but underutilized asset**. With minimal effort (2-3 hours for Phase A), we can:

1. **Improve user experience** - Show stability indicators and peak values
2. **Reduce alert fatigue** - Context-aware alerting with statistics
3. **Enable predictive maintenance** - Track sensor degradation over time
4. **Enhance ML models** - Already using 37D feature vectors

**The infrastructure is complete - we just need to expose it to users through the dashboard.**

---

## Next Steps

1. **Immediate:** Implement Phase A (Dashboard visualization) - 2-3 hours
2. **Short-term:** Implement Phase B (Smart alerting) - 3-4 hours
3. **Long-term:** Implement Phase C (Historical analysis) - 4-5 hours

**Total effort: 9-12 hours for complete utilization of statistical fields.**

---

**Last Updated:** 2026-06-13  
**Status:** Ready for implementation  
**Priority:** High (Phase A), Medium (Phase B), Low (Phase C)