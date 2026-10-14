# SSNS Project Roadmap - Simple Sequential Plan

**Last Updated:** 2026-06-12  
**Purpose:** Clear, step-by-step plan for completing the SSNS project

---

## 🎯 Current Status

**What's Working:**
- ✅ Firmware with simulated sensors (SCD41, CCS811, SPS30)
- ✅ Thread mesh networking (nRF52840 nodes)
- ✅ CoAP gateway receiving sensor data
- ✅ Spring Boot backend with REST API
- ✅ ML service with IsolationForest anomaly detection
- ✅ React dashboard displaying data and alerts
- ✅ Multi-threaded sensor aggregator (different sampling rates per sensor)

**What Needs Decision:**
- ❓ Should we implement statistical aggregation (mean/std/max)?
- ❓ Or continue with current single-value system?

---

## 📋 Sequential Action Plan

### **STEP 1: Assess Current System** (1 day)

**Goal:** Understand what's working and what needs improvement

**Actions:**
1. Test current system end-to-end
2. Check if anomaly detection is working
3. Identify any bugs or issues
4. Document current limitations

**Deliverable:** List of working features + list of issues

---

### **STEP 2: Make Key Decision** (1 day)

**Question:** Should we implement statistical aggregation?

**Option A: YES - Implement Statistical Aggregation**
- **Pros:** Better transient event detection, more research value
- **Cons:** 2-3 weeks additional work, more complexity
- **Time:** ~12-15 days total
- **Go to:** STEP 3A

**Option B: NO - Continue with Current System**
- **Pros:** Faster completion, less risk
- **Cons:** May miss transient events
- **Time:** ~5-7 days total
- **Go to:** STEP 3B

**Deliverable:** Clear decision documented

---

### **STEP 3A: Implement Statistical Aggregation** (if YES)

#### **Phase 1: Firmware Changes** (2-3 days)

**Files to modify:**
- `firmware/sensor-node/src/sensors/sensor_aggregator.c`
- `firmware/sensor-node/src/sensors/sensor_aggregator.h`

**What to do:**
1. Add circular buffer structs (30 samples per sensor)
2. Modify each sensor thread to store samples in buffer
3. Add functions to calculate mean, std, max
4. Update packet structure to include statistics
5. Test on hardware

**Deliverable:** Firmware sending packets with statistics

---

#### **Phase 2: Gateway Changes** (3-4 days)

**Files to modify:**
- `platform/gateway/telemetry/model.py`
- `platform/gateway/coap/server.py`
- `platform/gateway/forwarding/http_forwarder.py`

**What to do:**
1. Update TelemetryData model to include statistics
2. Parse new packet format (backward compatible)
3. Forward statistics to backend
4. Test with both old and new firmware

**Deliverable:** Gateway handling both packet formats

---

#### **Phase 3: Backend Changes** (2-3 days)

**Files to modify:**
- `platform/api/src/main/java/de/iot/smartmonitoring/model/SensorData.java`
- `platform/api/src/main/java/de/iot/smartmonitoring/service/AlertService.java`

**What to do:**
1. Add statistics fields to SensorData model
2. Update database schema
3. Add variance-based detection rules
4. Test new alert types

**Deliverable:** Backend detecting variance-based anomalies

---

#### **Phase 4: ML Service Changes** (4-5 days)

**Files to modify:**
- `platform/ml-service/app/ml/ml_engine.py`
- `platform/ml-service/app/services/poller.py`

**What to do:**
1. Start with 10 features (current values only)
2. Test baseline performance
3. Gradually add statistics (mean, then std, then max)
4. Compare detection accuracy at each step
5. Document optimal feature set

**Deliverable:** ML model with optimal feature configuration

---

### **STEP 3B: Polish Current System** (if NO)

#### **Phase 1: Bug Fixes** (2-3 days)

**What to do:**
1. Fix any identified bugs from STEP 1
2. Improve error handling
3. Add logging where needed
4. Test thoroughly

**Deliverable:** Stable, bug-free system

---

#### **Phase 2: Documentation** (2-3 days)

**What to do:**
1. Update README files
2. Document API endpoints
3. Create user guide for dashboard
4. Document deployment process

**Deliverable:** Complete project documentation

---

#### **Phase 3: Testing** (1-2 days)

**What to do:**
1. End-to-end testing
2. Load testing
3. Edge case testing
4. Document test results

**Deliverable:** Test report

---

### **STEP 4: Final Testing** (2-3 days)

**Applies to both paths**

**What to do:**
1. Deploy complete system
2. Test with real sensor nodes (if available)
3. Run for 24-48 hours continuously
4. Monitor for issues
5. Fix any critical bugs

**Deliverable:** Stable, tested system

---

### **STEP 5: Documentation & Presentation** (3-4 days)

**What to do:**
1. Write final project report
2. Create architecture diagrams
3. Document design decisions
4. Prepare demonstration
5. Create presentation slides

**Deliverable:** Complete project documentation + presentation

---

## ⏱️ Time Estimates

### **Path A: With Statistical Aggregation**
- Step 1: 1 day
- Step 2: 1 day
- Step 3A: 12-15 days (4 phases)
- Step 4: 2-3 days
- Step 5: 3-4 days
- **Total: ~19-24 days (3-4 weeks)**

### **Path B: Without Statistical Aggregation**
- Step 1: 1 day
- Step 2: 1 day
- Step 3B: 5-7 days (3 phases)
- Step 4: 2-3 days
- Step 5: 3-4 days
- **Total: ~12-16 days (2-3 weeks)**

---

## 🚦 Decision Framework

**Choose Path A (Statistical Aggregation) if:**
- ✅ You have 3-4 weeks available
- ✅ You want stronger research contribution
- ✅ You're comfortable with more complexity
- ✅ Transient event detection is important

**Choose Path B (Current System) if:**
- ✅ You have 2-3 weeks available
- ✅ You want to minimize risk
- ✅ Current detection is "good enough"
- ✅ You prefer simpler, stable system

---

## 📊 What Each Path Delivers

### **Path A Delivers:**
- Multi-dimensional sensor data (value + mean + std + max)
- Variance-based anomaly detection (no ML retraining needed)
- Enhanced ML model with more features
- Better transient event detection
- More research value for project report

### **Path B Delivers:**
- Stable, working system
- Current anomaly detection (IsolationForest)
- Faster completion
- Lower risk of bugs
- Simpler to maintain

---

## 🎯 Recommended Next Steps

1. **Read this roadmap completely**
2. **Do STEP 1** (assess current system) - takes 1 day
3. **Make decision** (STEP 2) - Path A or Path B?
4. **Follow chosen path** sequentially
5. **Don't skip steps** - each builds on previous

---

## 📝 Notes

- **All time estimates include testing**
- **Phases can overlap slightly** but don't skip ahead
- **Document as you go** - don't leave it for the end
- **Test frequently** - catch bugs early
- **Ask for help** when stuck on a step

---

## ❓ Questions to Answer Before Starting

1. **How much time do you have?** (2 weeks? 3 weeks? 4 weeks?)
2. **What's your deadline?** (specific date)
3. **Do you have real sensor hardware?** (or only simulation?)
4. **What's the minimum viable system?** (what MUST work for project to pass?)

**Answer these questions, then choose your path!**

---

## 🎓 Success Criteria

**Minimum (both paths):**
- ✅ System runs end-to-end without crashes
- ✅ Sensor data flows from nodes to dashboard
- ✅ Anomaly detection produces alerts
- ✅ Dashboard displays data correctly
- ✅ Documentation explains the system

**Excellent (Path A):**
- ✅ All minimum criteria
- ✅ Statistical aggregation working
- ✅ Variance-based detection working
- ✅ Comparison of detection methods
- ✅ Research-quality documentation

---

**Remember:** The goal is to **complete the project successfully**, not to implement every possible feature. Choose the path that fits your timeline and goals.