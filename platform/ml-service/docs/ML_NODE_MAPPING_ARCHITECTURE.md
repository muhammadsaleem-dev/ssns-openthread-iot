# ML Service Architecture: Node-to-Model Mapping

This document provides a detailed architectural breakdown of how the Thread Smart Monitoring ML Service dynamically creates, manages, and attaches Machine Learning models to individual hardware sensor nodes.

## The "One-to-One" Model Mapping Philosophy

A core challenge in indoor environmental monitoring is that no two rooms are the same. A standard CO2 level in a packed lecture hall (e.g., 1200 ppm) is perfectly normal, but that same level in an empty storage closet indicates a severe ventilation failure.

Because of this, **global thresholds and shared ML models do not work.**

To solve this, the ML Service implements a strict **One-to-One Dynamic Mapping Strategy**. Every single hardware node on the Thread mesh network gets its own completely isolated `IsolationForest` baseline and its own `LightweightForecaster` memory window.

---

## How Models Are Created and Attached

The lifecycle of a node's ML model is managed through **Lazy Loading** and **Automated Persistence**. Here is the step-by-step flow of how a model is attached to a node:

### 1. Dynamic Instantiation (Lazy Loading)
When the ML Poller fetches the latest telemetry from the Spring Boot backend, it looks at the `nodeId` (e.g., `saleems_room_node_e9b1`). 
It passes this `nodeId` to the central `NodeDetectorManager`.

```python
if node_id not in self.detectors:
    self.detectors[node_id] = AnomalyDetector(window_size, sensitivity, node_id=node_id)
```
If the manager has never seen this `nodeId` before (e.g., you just added a new Thread sensor to the network), it dynamically creates a new `AnomalyDetector` class instance in memory specifically for that node.

### 2. Isolated Calibration (Warm-up Phase)
The new `AnomalyDetector` instance starts with an empty `baseline_data` array. As telemetry streams in, the array fills up.
The model will **not** raise any alerts during this period. It quietly listens to the environment to figure out the node's specific "normal" (e.g., it learns that the room naturally cycles between 400 and 800 ppm of CO2 every day).

### 3. Model Fitting & Mathematical Scaling
Once the `baselineWindowSize` is reached (e.g., 14 days of data), the engine automatically trains the node's specific `IsolationForest`. 
Crucially, it also calculates the **Median** and **Interquartile Range (IQR)** for that exact room, ensuring the model scales itself mathematically to the physical boundaries of that specific environment.

### 4. Persistence (Serialization)
To ensure that a server crash or a container restart doesn't wipe out 14 days of learning, the fitted model is serialized to disk immediately after training.
The service uses Python's `joblib` library to write a binary `.pkl` (pickle) file to the `/tmp/thread_ml_models/` directory.

```python
# The model is saved exactly as:
/tmp/thread_ml_models/isolation_forest_{node_id}.pkl
```
This payload contains the `IsolationForest` decision trees, the node's specific Medians, and its IQR scalers.

### 5. Restoration (Re-attaching on Boot)
If the ML Python container restarts, the models drop from memory. 
When the poller asks the `NodeDetectorManager` for `node_id`'s model, the manager creates a new `AnomalyDetector`. However, during initialization, the detector checks the `/tmp/thread_ml_models/` directory.
If it finds `isolation_forest_{node_id}.pkl`, it immediately loads the mathematical weights from the disk. The node's memory is instantly restored, and anomaly detection resumes immediately without requiring another 14-day calibration.

---

## Autonomous Self-Healing and Model Deletion

Environments change permanently. If a building switches from Summer Air Conditioning to Winter Heating, the fundamental baseline of temperature and humidity shifts.

The ML service uses a **Kolmogorov-Smirnov ($D_{KS}$) Drift Detector** to monitor this.
If the engine detects that the recent data has permanently drifted from the original trained model (and it is not an emergency anomaly), it will **Autonomously Self-Heal**:
1. It flushes the old baseline from memory.
2. It deletes the `isolation_forest_{node_id}.pkl` file from the disk.
3. It retrains a fresh model using the new, drifted baseline. 

This ensures that the attached models never go "stale", and system administrators never have to manually log in to recalibrate nodes.
