# Statistical Aggregation - 1-Day Implementation Plan

**Branch:** `feature/statistical-aggregation`  
**Total Time:** 8-10 hours (1 full working day)  
**Strategy:** Implement all layers sequentially, test as we go

---

## 🎯 Goal

Add mean, std, and max statistics to sensor data packets while maintaining backward compatibility.

---

## 📦 What We're Building

### **Current Packet (10 values):**
```
{
  "co2": 450,
  "temperature": 22.5,
  "humidity": 45,
  "tvoc": 125,
  "eco2": 480,
  "pm1_0": 5,
  "pm2_5": 8,
  "pm4_0": 10,
  "pm10": 12,
  "node_id": "abc123"
}
```

### **New Packet (30 values):**
```
{
  "co2": 450, "co2_mean": 448, "co2_std": 12, "co2_max": 465,
  "temperature": 22.5, "temp_mean": 22.4, "temp_std": 0.3, "temp_max": 22.8,
  "humidity": 45, "hum_mean": 44.8, "hum_std": 1.2, "hum_max": 46,
  "tvoc": 125, "tvoc_mean": 120, "tvoc_std": 15, "tvoc_max": 180,
  "eco2": 480, "eco2_mean": 475, "eco2_std": 20, "eco2_max": 510,
  "pm1_0": 5, "pm1_0_mean": 4.8, "pm1_0_std": 0.5, "pm1_0_max": 6,
  "pm2_5": 8, "pm2_5_mean": 7.9, "pm2_5_std": 0.8, "pm2_5_max": 9,
  "pm4_0": 10, "pm4_0_mean": 9.8, "pm4_0_std": 1.0, "pm4_0_max": 11,
  "pm10": 12, "pm10_mean": 11.7, "pm10_std": 1.2, "pm10_max": 13,
  "node_id": "abc123"
}
```

---

## ⏱️ Hour-by-Hour Schedule

### **Hour 1-3: Phase 1 - Firmware** (2-3 hours)

#### **Files to Modify:**
1. `firmware/sensor-node/src/sensors/sensor_aggregator.h`
2. `firmware/sensor-node/src/sensors/sensor_aggregator.c`

#### **What to Do:**

**Step 1.1: Add circular buffer structure (15 min)**

```c
// In sensor_aggregator.h

#define BUFFER_SIZE 30  // 30 samples for statistics

typedef struct {
    float buffer[BUFFER_SIZE];
    uint8_t index;
    uint8_t count;
    float mean;
    float std;
    float max;
} sensor_stats_t;

typedef struct {
    // Existing fields
    float co2;
    float temperature;
    float humidity;
    // ... other sensors
    
    // NEW: Statistics
    sensor_stats_t co2_stats;
    sensor_stats_t temp_stats;
    sensor_stats_t hum_stats;
    sensor_stats_t tvoc_stats;
    sensor_stats_t eco2_stats;
    sensor_stats_t pm1_0_stats;
    sensor_stats_t pm2_5_stats;
    sensor_stats_t pm4_0_stats;
    sensor_stats_t pm10_stats;
} sensor_data_t;
```

**Step 1.2: Add statistics calculation functions (30 min)**

```c
// In sensor_aggregator.c

static void add_sample(sensor_stats_t *stats, float value) {
    // Add to circular buffer
    stats->buffer[stats->index] = value;
    stats->index = (stats->index + 1) % BUFFER_SIZE;
    if (stats->count < BUFFER_SIZE) {
        stats->count++;
    }
}

static void calculate_stats(sensor_stats_t *stats) {
    if (stats->count == 0) return;
    
    // Calculate mean
    float sum = 0;
    for (int i = 0; i < stats->count; i++) {
        sum += stats->buffer[i];
    }
    stats->mean = sum / stats->count;
    
    // Calculate std
    float variance = 0;
    for (int i = 0; i < stats->count; i++) {
        float diff = stats->buffer[i] - stats->mean;
        variance += diff * diff;
    }
    stats->std = sqrtf(variance / stats->count);
    
    // Calculate max
    stats->max = stats->buffer[0];
    for (int i = 1; i < stats->count; i++) {
        if (stats->buffer[i] > stats->max) {
            stats->max = stats->buffer[i];
        }
    }
}
```

**Step 1.3: Update sensor threads to use buffers (45 min)**

```c
// In scd41_thread (example)
static void scd41_thread(void *arg1, void *arg2, void *arg3) {
    while (1) {
        // Read sensor
        float co2 = read_scd41_co2();
        float temp = read_scd41_temp();
        float hum = read_scd41_humidity();
        
        k_mutex_lock(&sensor_data_mutex, K_FOREVER);
        
        // Update current values
        sensor_data.co2 = co2;
        sensor_data.temperature = temp;
        sensor_data.humidity = hum;
        
        // NEW: Add to buffers
        add_sample(&sensor_data.co2_stats, co2);
        add_sample(&sensor_data.temp_stats, temp);
        add_sample(&sensor_data.hum_stats, hum);
        
        // NEW: Calculate statistics
        calculate_stats(&sensor_data.co2_stats);
        calculate_stats(&sensor_data.temp_stats);
        calculate_stats(&sensor_data.hum_stats);
        
        k_mutex_unlock(&sensor_data_mutex);
        
        k_sleep(K_SECONDS(5));
    }
}
```

**Step 1.4: Update CBOR encoding (30 min)**

```c
// In network.c - update encode_sensor_data()

static int encode_sensor_data(uint8_t *buffer, size_t buffer_size) {
    zcbor_state_t states[4];
    zcbor_new_state(states, sizeof(states) / sizeof(states[0]), buffer, buffer_size, 1);
    
    bool success = zcbor_map_start_encode(states, 30) &&  // 30 fields now
        // Current values
        zcbor_tstr_put_lit(states, "co2") &&
        zcbor_float32_put(states, sensor_data.co2) &&
        
        // NEW: Statistics
        zcbor_tstr_put_lit(states, "co2_mean") &&
        zcbor_float32_put(states, sensor_data.co2_stats.mean) &&
        zcbor_tstr_put_lit(states, "co2_std") &&
        zcbor_float32_put(states, sensor_data.co2_stats.std) &&
        zcbor_tstr_put_lit(states, "co2_max") &&
        zcbor_float32_put(states, sensor_data.co2_stats.max) &&
        
        // ... repeat for all sensors
        
        zcbor_map_end_encode(states, 30);
    
    return success ? (buffer_size - states[0].payload_end) : -1;
}
```

**Step 1.5: Build and flash firmware (30 min)**

```bash
cd firmware/sensor-node
west build -b nrf52840dk_nrf52840 -p
west flash
```

**✅ Phase 1 Complete:** Firmware now sends packets with statistics

---

### **Hour 4-5: Phase 2 - Gateway** (1-2 hours)

#### **Files to Modify:**
1. `platform/gateway/telemetry/model.py`
2. `platform/gateway/coap/server.py`

#### **What to Do:**

**Step 2.1: Update TelemetryData model (15 min)**

```python
# In telemetry/model.py

from pydantic import BaseModel
from typing import Optional

class TelemetryData(BaseModel):
    # Current values
    co2: float
    temperature: float
    humidity: float
    tvoc: float
    eco2: float
    pm1_0: float
    pm2_5: float
    pm4_0: float
    pm10: float
    node_id: str
    
    # NEW: Statistics (optional for backward compatibility)
    co2_mean: Optional[float] = None
    co2_std: Optional[float] = None
    co2_max: Optional[float] = None
    
    temp_mean: Optional[float] = None
    temp_std: Optional[float] = None
    temp_max: Optional[float] = None
    
    hum_mean: Optional[float] = None
    hum_std: Optional[float] = None
    hum_max: Optional[float] = None
    
    tvoc_mean: Optional[float] = None
    tvoc_std: Optional[float] = None
    tvoc_max: Optional[float] = None
    
    eco2_mean: Optional[float] = None
    eco2_std: Optional[float] = None
    eco2_max: Optional[float] = None
    
    pm1_0_mean: Optional[float] = None
    pm1_0_std: Optional[float] = None
    pm1_0_max: Optional[float] = None
    
    pm2_5_mean: Optional[float] = None
    pm2_5_std: Optional[float] = None
    pm2_5_max: Optional[float] = None
    
    pm4_0_mean: Optional[float] = None
    pm4_0_std: Optional[float] = None
    pm4_0_max: Optional[float] = None
    
    pm10_mean: Optional[float] = None
    pm10_std: Optional[float] = None
    pm10_max: Optional[float] = None
```

**Step 2.2: Update CBOR parsing (30 min)**

```python
# In coap/server.py

def parse_cbor_payload(payload: bytes) -> TelemetryData:
    try:
        data = cbor2.loads(payload)
        
        # Parse with backward compatibility
        telemetry = TelemetryData(
            co2=data.get('co2'),
            temperature=data.get('temperature'),
            humidity=data.get('humidity'),
            tvoc=data.get('tvoc'),
            eco2=data.get('eco2'),
            pm1_0=data.get('pm1_0'),
            pm2_5=data.get('pm2_5'),
            pm4_0=data.get('pm4_0'),
            pm10=data.get('pm10'),
            node_id=data.get('node_id'),
            
            # NEW: Statistics (optional)
            co2_mean=data.get('co2_mean'),
            co2_std=data.get('co2_std'),
            co2_max=data.get('co2_max'),
            # ... all other stats
        )
        
        return telemetry
    except Exception as e:
        logger.error(f"Failed to parse CBOR: {e}")
        raise
```

**Step 2.3: Test gateway (15 min)**

```bash
cd platform/gateway
docker-compose up --build
# Watch logs for successful parsing
```

**✅ Phase 2 Complete:** Gateway now parses and forwards statistics

---

### **Hour 6-7: Phase 3 - Backend** (1-2 hours)

#### **Files to Modify:**
1. `platform/api/src/main/java/de/iot/smartmonitoring/model/SensorData.java`
2. `platform/api/src/main/resources/application.yml` (database schema)

#### **What to Do:**

**Step 3.1: Update SensorData model (20 min)**

```java
// In model/SensorData.java

@Entity
@Table(name = "sensor_data")
public class SensorData {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    // Existing fields
    private Double co2;
    private Double temperature;
    private Double humidity;
    // ... other sensors
    
    // NEW: Statistics
    private Double co2Mean;
    private Double co2Std;
    private Double co2Max;
    
    private Double tempMean;
    private Double tempStd;
    private Double tempMax;
    
    private Double humMean;
    private Double humStd;
    private Double humMax;
    
    private Double tvocMean;
    private Double tvocStd;
    private Double tvocMax;
    
    private Double eco2Mean;
    private Double eco2Std;
    private Double eco2Max;
    
    private Double pm1_0Mean;
    private Double pm1_0Std;
    private Double pm1_0Max;
    
    private Double pm2_5Mean;
    private Double pm2_5Std;
    private Double pm2_5Max;
    
    private Double pm4_0Mean;
    private Double pm4_0Std;
    private Double pm4_0Max;
    
    private Double pm10Mean;
    private Double pm10Std;
    private Double pm10Max;
    
    // Getters and setters...
}
```

**Step 3.2: Update database schema (20 min)**

```sql
-- Migration script (auto-generated by Spring)
ALTER TABLE sensor_data ADD COLUMN co2_mean DOUBLE;
ALTER TABLE sensor_data ADD COLUMN co2_std DOUBLE;
ALTER TABLE sensor_data ADD COLUMN co2_max DOUBLE;
-- ... repeat for all statistics
```

**Step 3.3: Update REST endpoint (20 min)**

```java
// In controller/SensorDataController.java

@GetMapping("/{nodeId}/latest")
public ResponseEntity<SensorData> getLatestData(@PathVariable String nodeId) {
    SensorData data = sensorDataService.getLatestByNodeId(nodeId);
    // Statistics are automatically included in response
    return ResponseEntity.ok(data);
}
```

**Step 3.4: Build and test (20 min)**

```bash
cd platform/api
mvn clean package
docker-compose up --build
```

**✅ Phase 3 Complete:** Backend now stores and serves statistics

---

### **Hour 8: Phase 4 - ML Service** (1 hour)

#### **Files to Modify:**
1. `platform/ml-service/app/ml/ml_engine.py`

#### **What to Do:**

**Step 4.1: Update feature vector (30 min)**

```python
# In ml/ml_engine.py

def extract_features(self, data: dict) -> np.ndarray:
    """Extract features from sensor data"""
    
    # Start with current values (10 features)
    features = [
        data.get('co2', 0),
        data.get('temperature', 0),
        data.get('humidity', 0),
        data.get('tvoc', 0),
        data.get('eco2', 0),
        data.get('pm1_0', 0),
        data.get('pm2_5', 0),
        data.get('pm4_0', 0),
        data.get('pm10', 0),
        data.get('timestamp', 0)
    ]
    
    # NEW: Add statistics if available (20 more features)
    if data.get('co2_std') is not None:
        features.extend([
            data.get('co2_std', 0),
            data.get('co2_max', 0),
            data.get('temp_std', 0),
            data.get('temp_max', 0),
            data.get('hum_std', 0),
            data.get('hum_max', 0),
            data.get('tvoc_std', 0),
            data.get('tvoc_max', 0),
            data.get('eco2_std', 0),
            data.get('eco2_max', 0),
            data.get('pm1_0_std', 0),
            data.get('pm1_0_max', 0),
            data.get('pm2_5_std', 0),
            data.get('pm2_5_max', 0),
            data.get('pm4_0_std', 0),
            data.get('pm4_0_max', 0),
            data.get('pm10_std', 0),
            data.get('pm10_max', 0),
        ])
    
    return np.array(features)
```

**Step 4.2: Update model configuration (15 min)**

```python
# In ml/ml_engine.py

def __init__(self):
    self.model = IsolationForest(
        contamination=0.1,
        n_estimators=100,
        max_samples='auto',
        random_state=42
    )
    self.baseline_samples = []
    self.min_samples = 20  # Still 20 samples for baseline
    self.feature_dim = 30  # Now 30 features instead of 10
```

**Step 4.3: Test ML service (15 min)**

```bash
cd platform/ml-service
docker-compose up --build
```

**✅ Phase 4 Complete:** ML model now uses 30-dimensional features

---

### **Hour 9: Phase 5 - Dashboard** (1 hour)

#### **Files to Modify:**
1. `platform/dashboard/src/components/NodeCard.jsx`
2. `platform/dashboard/src/pages/DashboardPage.jsx`

#### **What to Do:**

**Step 5.1: Display statistics in NodeCard (30 min)**

```jsx
// In components/NodeCard.jsx

export default function NodeCard({ node }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6">{node.nodeId}</Typography>
        
        {/* Current values */}
        <Typography>CO₂: {node.co2} ppm</Typography>
        
        {/* NEW: Statistics */}
        {node.co2_std && (
          <Box sx={{ ml: 2, color: 'text.secondary' }}>
            <Typography variant="caption">
              Mean: {node.co2_mean?.toFixed(1)} ppm
            </Typography>
            <Typography variant="caption">
              Std: {node.co2_std?.toFixed(1)} ppm
            </Typography>
            <Typography variant="caption">
              Max: {node.co2_max?.toFixed(1)} ppm
            </Typography>
          </Box>
        )}
        
        {/* Repeat for other sensors */}
      </CardContent>
    </Card>
  );
}
```

**Step 5.2: Add statistics chart (30 min)**

```jsx
// In charts/TelemetryChart.jsx

export default function TelemetryChart({ data }) {
  const chartData = data.map(d => ({
    timestamp: d.timestamp,
    value: d.co2,
    mean: d.co2_mean,
    std_upper: d.co2_mean + d.co2_std,
    std_lower: d.co2_mean - d.co2_std,
    max: d.co2_max
  }));
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <Line type="monotone" dataKey="value" stroke="#8884d8" />
        <Line type="monotone" dataKey="mean" stroke="#82ca9d" strokeDasharray="5 5" />
        <Line type="monotone" dataKey="max" stroke="#ff7300" strokeDasharray="3 3" />
        <Area dataKey="std_upper" fill="#8884d8" fillOpacity={0.1} />
        <Area dataKey="std_lower" fill="#8884d8" fillOpacity={0.1} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

**✅ Phase 5 Complete:** Dashboard now displays statistics

---

### **Hour 10-11: Testing & Bug Fixes** (2-3 hours)

#### **What to Test:**

**Test 1: End-to-end data flow (30 min)**
```bash
# 1. Check firmware is sending statistics
# 2. Check gateway logs for parsed statistics
# 3. Check backend database for stored statistics
# 4. Check dashboard displays statistics
```

**Test 2: Backward compatibility (30 min)**
```bash
# 1. Flash old firmware (without statistics)
# 2. Verify system still works
# 3. Flash new firmware
# 4. Verify statistics appear
```

**Test 3: ML detection (30 min)**
```bash
# 1. Let system collect 20+ samples
# 2. Inject anomaly (high CO₂)
# 3. Verify alert is generated
# 4. Check if statistics improve detection
```

**Test 4: Performance (30 min)**
```bash
# 1. Monitor memory usage on firmware
# 2. Check gateway throughput
# 3. Verify backend response times
# 4. Test dashboard rendering
```

**Bug Fixes (30-60 min)**
- Fix any parsing errors
- Fix any database issues
- Fix any UI rendering issues
- Optimize performance if needed

**✅ Testing Complete:** System working end-to-end with statistics

---

## 📝 Commit Strategy

### **Commit 1: Firmware**
```bash
git add firmware/
git commit -m "feat: Add circular buffers and statistics calculation to firmware

- Add sensor_stats_t structure with 30-sample circular buffer
- Implement calculate_stats() for mean, std, max
- Update all sensor threads to use buffers
- Update CBOR encoding to include statistics
- Maintain backward compatibility"
```

### **Commit 2: Gateway**
```bash
git add platform/gateway/
git commit -m "feat: Update gateway to parse and forward statistics

- Add optional statistics fields to TelemetryData model
- Update CBOR parsing with backward compatibility
- Forward statistics to backend API"
```

### **Commit 3: Backend**
```bash
git add platform/api/
git commit -m "feat: Add statistics storage and API endpoints

- Add statistics fields to SensorData model
- Update database schema with migration
- Expose statistics in REST API responses"
```

### **Commit 4: ML Service**
```bash
git add platform/ml-service/
git commit -m "feat: Expand ML feature vector to include statistics

- Update feature extraction to use 30 dimensions
- Add statistics (std, max) to feature vector
- Maintain backward compatibility with 10-feature data"
```

### **Commit 5: Dashboard**
```bash
git add platform/dashboard/
git commit -m "feat: Display statistics in dashboard

- Add statistics display to NodeCard component
- Add statistics visualization to charts
- Show mean, std, max for all sensors"
```

### **Commit 6: Documentation**
```bash
git add docs/
git commit -m "docs: Add implementation plan and update documentation

- Add ONE_DAY_IMPLEMENTATION_PLAN.md
- Update PROJECT_ROADMAP.md
- Document new packet structure"
```

---

## 🚨 Common Issues & Solutions

### **Issue 1: Firmware memory overflow**
**Solution:** Reduce BUFFER_SIZE from 30 to 20 samples

### **Issue 2: Gateway parsing fails**
**Solution:** Check CBOR field names match exactly

### **Issue 3: Backend database migration fails**
**Solution:** Drop and recreate database (dev only!)

### **Issue 4: ML model accuracy drops**
**Solution:** Retrain with new 30-dimensional data

### **Issue 5: Dashboard doesn't show statistics**
**Solution:** Check API response includes statistics fields

---

## ✅ Success Criteria

- [ ] Firmware compiles and flashes successfully
- [ ] Gateway parses packets with statistics
- [ ] Backend stores statistics in database
- [ ] ML service uses 30-dimensional features
- [ ] Dashboard displays statistics
- [ ] End-to-end test passes
- [ ] Backward compatibility maintained
- [ ] All commits pushed to branch

---

## 🎯 Next Steps After Implementation

1. **Merge to main** after testing
2. **Deploy to production** environment
3. **Monitor performance** for 24 hours
4. **Collect metrics** on detection improvement
5. **Document results** in project report

---

**Remember:** We'll work through this together, step by step. Start with Phase 1 (firmware) and I'll help you with each file modification!