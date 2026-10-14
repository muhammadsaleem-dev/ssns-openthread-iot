# ML Viva Notes

---

## 1. System overview

**Q: What is the purpose of the ML service?**
A: It augments raw environmental telemetry with advanced anomaly detection, short-term forecasting, explainability (XAI), and autonomous self-healing for missing data.

**Q: What is the relationship between Spring Boot and FastAPI?**
A: Spring Boot handles high-throughput ingestion and persistence. FastAPI operates entirely independently, pulling data from Spring Boot to perform heavy matrix mathematics, then pushing alerts back to Spring Boot.

**Q: How does the polling architecture work?**
A: The ML service executes a background asynchronous loop (`poller.py`) that periodically issues HTTP GET requests to the Java backend to fetch the latest telemetry, controlling its own ingestion rate.

**Q: What is the complete inference pipeline?**
A: Telemetry -> Feature Extraction (Rates/Time) -> Imputation -> Robust Scaling (Median/IQR) -> Inference (Isolation Forest) -> Forecasting (Linear Regression) -> Explanation (Z-score ranking) -> Alert Generation.

**Q: Why was the ML service separated from the backend?**
A: Python provides superior, native ML libraries (Scikit-Learn, Numpy). Decoupling prevents heavy matrix calculations from blocking the Java HTTP ingestion threads.

---

## 2. Architecture questions

**Q: Why was FastAPI selected?**
A: It provides high-performance, asynchronous endpoints natively in Python, seamlessly handling background polling loops (`asyncio`) alongside API routes.

**Q: Why was polling selected?**
A: It acts as a natural rate limiter. The ML service pulls data at its own pace, preventing it from crashing during a massive telemetry flood on the backend.

**Q: Why were per-node models selected?**
A: Every physical room is thermodynamically unique (size, occupancy, ventilation). A global model would generate massive false positives.

**Q: Why was joblib selected?**
A: It is native to Scikit-Learn and highly optimized for serializing large Numpy arrays and fitted decision trees to disk.

**Q: Why was the ML service isolated from the backend?**
A: To isolate failure domains, scale independently, and utilize Python's dominant ML ecosystem without stalling Java I/O threads.

**Q: How is inference executed without blocking?**
A: The polling loop is fully asynchronous, evaluating nodes sequentially without locking the FastAPI HTTP listener threads.

**Q: Where are the trained models stored?**
A: Locally on disk within the `/tmp/thread_ml_models/` directory, using `joblib` persistence.

**Q: Why is persistence necessary?**
A: To ensure the algorithms retain their historical baseline and boundary conditions across container or service restarts.

**Q: Does the ML service communicate with MongoDB?**
A: No. It communicates exclusively via REST HTTP calls to the Spring Boot backend, which manages the database.

**Q: How are AI alerts cleared?**
A: If air quality normalizes and the model sees no anomaly or forecast warning, the poller sends a REST call (`PUT /api/alerts/resolve-all?category=ai`) to auto-resolve warnings.

---

## 3. Feature engineering questions

**Q: Why use base features?**
A: They represent the core life-safety indicators (Temp, Hum, CO2, TVOC, PM2.5).

**Q: Why introduce derivative features?**
A: Rates of change (delta per minute) detect sudden, abrupt hazard events (e.g., aerosol sprays) regardless of the room's current absolute baseline.

**Q: Why use cyclical encoding?**
A: Linear time jumps from 23:59 to 00:00. Mapping time to Sine/Cosine on a unit circle ensures midnight is mathematically continuous.

**Q: Why is temporal information required?**
A: Environmental data is highly diurnal. The model must learn daily routines (e.g., empty office at night) to avoid flagging expected drops as anomalies.

**Q: Why use fixed-size vectors?**
A: Scikit-Learn structures strictly require fixed-dimensional tensors for inference.

**Complete feature vector:**
1. `temperature`
2. `humidity`
3. `co2`
4. `tvoc`
5. `pm2_5`
6. `temperature_rate`
7. `humidity_rate`
8. `co2_rate`
9. `tvoc_rate`
10. `pm2_5_rate`
11. `sin_hour`
12. `cos_hour`

---

## 4. Isolation Forest questions

**Q: What is the contamination factor?**
A: It is set to `"auto"`. It allows the algorithm to dynamically adapt to the data's natural variance rather than assuming a hardcoded percentage of outliers.

**Q: What is the random seed?**
A: Fixed at `42` to enforce deterministic tree generation for reproducibility.

**Q: What is the warm-up phase?**
A: The system collects data silently without evaluating anomalies until it hits the `baseline_window_size` (20-40 samples), preventing cold-start false alarms.

**Q: How is the anomaly score calculated?**
A: It uses the `decision_function` of the Isolation Forest, which calculates the mean path length to isolate a sample. 

**Q: How is threshold shifting handled?**
A: The decision boundary is shifted by: `Score < (Sensitivity - 5) * 0.005`.

**Q: How does retraining work?**
A: It is triggered automatically if the Kolmogorov-Smirnov test detects significant baseline drift, entirely replacing the old baseline array with the new one.

---

## 5. Drift detection questions

**Q: What are K-S statistics?**
A: The Kolmogorov-Smirnov test robustly compares the cumulative distributions of two arrays without assuming they are normally distributed.

**Q: Why use variance gating?**
A: If the current anomaly score variance is high, the room is in the middle of a chaotic hazard event. The algorithm rejects retraining to avoid accepting the hazard as the "new normal".

**Q: Why use CO2 gating?**
A: Retraining is actively rejected if CO2 > 1500 ppm, preventing the baseline from adopting a life-safety breach as safe.

**Q: What is the retraining logic?**
A: Trigger if `D_KS >= 0.25` AND `Score Variance < 0.05` AND `Max(CO2) <= 1500`. 

**Formulas:**
`D_KS = Max(|Interpolated Baseline - Recent Data|) / (Max(Baseline) - Min(Baseline))`

---

## 6. Forecasting questions

**Q: What is EMA?**
A: Exponential Moving Average. It filters out high-frequency transients (like momentary breath spikes) before running linear regression.

**Q: How does linear regression work here?**
A: It calculates the least-squares slope and intercept across a fixed time window (`history_size` = 60).

**Q: Why use R-Squared calculations?**
A: To determine if the data actually fits a linear trend. If the air is chaotic (`R-Squared < 0.65`), forecasting is suppressed to prevent panic alerts.

**Q: What are saturation limits?**
A: Projections are mathematically clamped (e.g., CO2 to 4000 ppm) to prevent infinite geometric projection into physically impossible bounds.

**Q: What is the forecast horizon?**
A: Projections extrapolate 30 minutes into the future to provide actionable early-warning time.

**Formulas:**
`EMA = (0.25 * Current Value) + (0.75 * Previous EMA)`
`Slope = Sum((Time - Time_Mean) * (Value - Value_Mean)) / Sum((Time - Time_Mean)^2)`
`Forecast = (Slope * Future Time) + Intercept`

---

## 7. Explainability questions

**Q: What are z-scores?**
A: They represent the absolute distance of a feature from the median, scaled by the Interquartile Range (IQR).

**Q: How does feature ranking work?**
A: The system sorts the robust z-scores and isolates the top two physical drivers responsible for the anomaly.

**Q: How is context generated?**
A: By converting the mathematical deviation into a percentage (e.g., "CO2 (+50% vs baseline)").

**Q: How are recommendations generated?**
A: The top feature is mapped to a pre-defined text string (e.g., if CO2 is highest, it recommends opening windows).

**Q: Why exclude temporal features?**
A: A user cannot "fix" the time of day. Explanations must strictly focus on actionable physical drivers.

**Q: Why was SHAP rejected?**
A: SHapley Additive exPlanations are extremely computationally expensive for real-time, high-frequency edge IoT telemetry.

---

## 8. Self-healing questions

**Q: What is LOCF?**
A: Last Observation Carried Forward. Used for micro-outages (< 5 mins), assuming the physical mass of air hasn't changed.

**Q: What is median decay?**
A: For medium outages (5-60 mins), certainty decreases exponentially, so the value mathematically decays back toward the safe historical median.

**Q: What is masking?**
A: For long outages (> 60 mins), the channel is overwritten entirely with the median, making the dead sensor "invisible" to the anomaly detector so other channels can function.

**Q: What is automatic alert resolution?**
A: The poller dispatches `resolve-all` commands if conditions stabilize, clearing stale dashboard warnings.

**Formulas:**
`Decay Factor = exp(-0.000385 * Duration_Seconds)` (Half-life = 30 min)
`Imputed = (Last Valid * Decay Factor) + (Median * (1 - Decay Factor))`

---

## 9. Mathematical formulas

* **Median:** `Median(X)`
* **IQR:** `75th Percentile(X) - 25th Percentile(X)` (clamped to `1e-9`)
* **Robust scaling:** `X_scaled = (X - Median) / Max(IQR, 1e-9)`
* **EMA:** `Current EMA = (0.25 * Current Value) + (0.75 * Previous EMA)`
* **Slope:** `Sum((Time - Time_Mean) * (Value - Value_Mean)) / Sum((Time - Time_Mean)^2)`
* **Intercept:** `Value Mean - (Slope * Time Mean)`
* **R-Squared:** `1.0 - (Sum of Squared Residuals / Total Sum of Squares)`
* **Z-score:** `Absolute Value of ((Vector - Median) / IQR)`

---

## 10. Failure scenarios

**Q: Sensor failure:**
A: Prevented from crashing inference via 3-tier duration-based median imputation.

**Q: Communication loss:**
A: The ML poller skips offline nodes without crashing, waiting for telemetry to resume.

**Q: Missing telemetry:**
A: Entire frame failure (all -999.0 values) causes the inference cycle to abort safely.

**Q: Drift:**
A: Handled securely by the K-S test, automatically retraining the baseline during safe periods.

**Q: Restart:**
A: Mitigated by `joblib` file persistence restoring the trained state back into memory.

**Q: False positives:**
A: Mitigated by robust scaling (IQR), cyclical time encoding, and R-Squared variance gating.

---

## 11. Limitations

**Q: Polling latency:**
A: Inference operates slightly behind real-time compared to a direct WebSockets push.

**Q: Linear assumptions:**
A: The forecaster cannot project exponential thermodynamic phenomena (e.g., thermal runaway).

**Q: Missing distributed learning:**
A: Models train entirely in local memory; they cannot share learnings with similar environments.

**Q: Missing GPU support:**
A: Scikit-Learn and Numpy execute strictly on CPU vectors, capping vertical scalability.

**Q: Absence of streaming architecture:**
A: Lacks a Kafka broker to safely buffer loads during massive telemetry floods.

**Q: Legacy /analyze endpoint:**
A: The sync endpoint takes a 10-feature vector, fundamentally conflicting with the poller's 12-feature vector, causing shape-mismatch crashes.

---

## 12. Difficult viva questions

**1. Why was Isolation Forest chosen instead of an autoencoder?**
A: Autoencoders require massive data to train, risk overfitting on a small 12-dimensional vector, and are highly opaque. Isolation Forests are computationally trivial, fast, and naturally adapt to multimodal distributions.

**2. Why was IQR chosen instead of standard deviation?**
A: Standard deviation is highly sensitive to extreme tails. A transient breath spike inflates standard deviation, permanently desensitizing the scaler. IQR ignores tails completely.

**3. Why was the K-S test selected?**
A: The Kolmogorov-Smirnov test robustly compares cumulative distributions without assuming the environmental data is Gaussian (normally distributed).

**4. Why were temporal features excluded from XAI?**
A: Explainability must be actionable. A user cannot change the time of day, so explanations are restricted to the top two actionable physical gas/particulate drivers.

**5. Why were per-node models selected?**
A: Every room has distinct thermodynamics, HVAC cycles, and occupancy densities. A generalized global model would trigger constant false alarms.

**6. Why was complete retraining selected instead of incremental learning?**
A: Updating trees incrementally is complex and risks absorbing drift incorrectly. If a severe drift occurs (e.g., sensor moved), flushing the baseline and starting fresh is mathematically safer.

**7. Why does the ML service pull instead of being pushed to?**
A: Polling shifts backpressure control to the ML service. If the Java backend experiences a traffic spike, the ML service won't crash; it simply pulls the latest snapshot when ready.

**8. Why use Sine/Cosine for time instead of a linear integer?**
A: Linear integers (23 -> 0) create a massive mathematical discontinuity at midnight. Sine/Cosine projects time onto a circle, ensuring midnight is mathematically continuous.

**9. Why mask dead sensors with the exact median after 60 minutes?**
A: Subtracting the median from the median equals zero. This renders the dead channel mathematically "invisible" to the anomaly score, allowing the other channels to continue protecting the room.

**10. Why is R-Squared gating necessary for forecasting?**
A: If the air is chaotic, a linear trend does not exist (R-Squared is low). Broadcasting a projection based on random noise causes panic; gating ensures projections are only dispatched when a strong mathematical trend exists.

**11. Why clamp the IQR to a minimum of 1e-9?**
A: In a perfectly sealed room over a weekend, all readings might be identical, causing the IQR to hit exactly zero. This prevents fatal divide-by-zero errors during scaling.

**12. Why exclude meta-features (like sequence numbers) from the feature vector?**
A: They provide no insight into the physical air quality and would inject mathematical noise, confusing the anomaly detector.

**13. What is the fundamental flaw of the legacy `/analyze` endpoint?**
A: It constructs a raw 10-dimensional vector without temporal rates of change. Passing this into an Isolation Forest trained by the 12-dimensional poller causes a fatal shape mismatch crash.

**14. Why apply EMA before linear regression?**
A: A momentary transient spike (e.g., someone coughing) heavily skews the least-squares calculation. EMA acts as a low-pass filter to reveal the true underlying slope.

**15. Why does the contamination factor use "auto"?**
A: Hardcoding a percentage (e.g., 5%) forces the model to label 5% of data as anomalous, even in a perfectly safe room. "Auto" allows the decision boundary to map to the natural variance.

**16. Why are both CO2 and Score Variance gated before retraining?**
A: If the room is in a high-variance state or CO2 > 1500, it is experiencing an active hazard. Retraining is disabled to prevent the model from accepting the hazard as the "new normal".

**17. Why is the forecast horizon clamped to 30 minutes?**
A: Linear regression assumes constant accumulation. Extending beyond 30 minutes exponentially increases geometric projection errors due to physical room saturation ceilings.

**18. Why use Last Observation Carried Forward (LOCF) for short outages?**
A: Air mass changes slowly. If a sensor drops offline for 2 minutes, mathematically assuming the air hasn't changed is the most highly probable physical state.

**19. Why does the ML service automatically resolve alerts?**
A: To prevent dashboard clutter. If the ML algorithm mathematically verifies the air has normalized, it actively self-heals the dashboard state to provide a true real-time view.

**20. Why doesn't the system use a Kafka stream broker?**
A: It was deemed overly complex for the MVP phase. The polling architecture provides adequate decoupling and rate-limiting for 1Hz telemetry, although Kafka is targeted for future enterprise scalability.
