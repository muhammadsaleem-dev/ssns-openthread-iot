# What the Report Says, and Which Reference Backs It

For each reference, this shows the exact sentence(s) in the report that use it, in plain text (cleaned up from the LaTeX formatting). Numbers match the report's own reference list, which is ordered by first appearance in the text (per IEEE citation style) — not by theme.

## [1] ANSI/ASHRAE Standard 55-2023

> Temperature alert threshold: below 10°C or above 35°C — "Project-specific life-safety bounds beyond the ASHRAE 55 comfort zone (typically 20–26°C)."

> "...Temperature breaches the 10°C to 35°C life-safety bounds (ASHRAE 55)..."

Note: this reference used to also be cited for the Humidity threshold (20–70% RH). That was corrected — see [3] below. ASHRAE 55 doesn't actually set a lower humidity limit at all, and its real comfort range is 30–60% RH, not 20–70%, so it was the wrong source for that number.

## [2] ASHRAE Position Document on Indoor Carbon Dioxide (2025)

> CO2 alert threshold: above 1500 ppm — "Upper end of the ~1000–1500 ppm ISIAQ-compiled international CO2 guideline range; elevated CO2 reduces cognitive performance and indoor air quality."

> "...Carbon Dioxide exceeds 1500 ppm (ASHRAE Position Document on Indoor CO2)..."

> "Synthetic hazard events were injected into the test stream at 30% above the ASHRAE-documented indoor CO2 guideline range..."

This replaced ANSI/ASHRAE Standard 62.1 as the CO2 citation. ASHRAE 62.1 is a ventilation-*rate* standard (how much outdoor air per person) — it does **not** set a CO2 concentration limit at all. This is explicitly stated in ASHRAE's own official position document, Board-approved February 2025: *"Despite many statements to the contrary, ANSI/ASHRAE Standard 62.1 does not provide a limit value for indoor CO2. Misunderstanding of information in previous editions of the standard continue to lead many to incorrectly attribute a 1000 ppmv limit to ASHRAE."* That same document names the real source: an international database of national indoor CO2 guideline values, compiled by ISIAQ (International Society for Indoor Air Quality and Climate), that "tend to be on the order of 1000 ppmv but range as high as about 1500 ppmv" — the report's 1500 ppm sits at the top of that real, documented range. ANSI/ASHRAE Standard 62.1 is no longer cited anywhere in the report as a result (it was removed from the bibliography since nothing else used it).

**Note:** the table wording deliberately says "ISIAQ-compiled international guideline range," not "informed by ASHRAE guidance" — ASHRAE's own position document explicitly states *"ASHRAE does not recommend a specific CO2 concentration as a metric."* Attributing the number to "ASHRAE guidance" would reintroduce the same kind of misattribution this fix was meant to correct; ASHRAE only reports on the ISIAQ database, it doesn't set the number itself.

## [3] OSHA Technical Manual, Section III: Chapter 2

> Humidity alert threshold: below 20% or above 60% RH — "OSHA Technical Manual indoor humidity control range (20–60% RH), consistent with EPA mould-prevention guidance (below 60%)."

> "...Humidity breaches the 20% to 60% RH bounds (OSHA)."

This replaced ASHRAE 55 as the humidity citation. It's a real, directly-verified match: OSHA's manual states "humidity control in the range of 20%-60%" word for word, and the original threshold numbers in the code (20% floor, was 70% ceiling) were changed to 60% on the ceiling to match this real source, rather than keeping 70% and looking for a source to justify it after the fact.

## [4] WHO Global Air Quality Guidelines (2021)

> "...architectural decisions informed by ASHRAE, OSHA, WHO, EPA, and WELL guidelines." (abstract — general background citation, not tied to a specific number)

This used to also be jointly cited (as "WHO/EPA") for the PM2.5 alert threshold of 35 µg/m³. That was corrected — see the note under [5] below. WHO's real 2021 guideline for PM2.5 is far stricter (5 µg/m³ annual, 15 µg/m³ 24-hour — confirmed directly from WHO's published guideline), so attributing the 35 µg/m³ number to WHO was wrong. WHO remains a legitimate general reference for the project's motivation (why PM2.5 matters for health), just not for this specific threshold.

**Talking point if asked "why 35 µg/m³ and not WHO's stricter 15?":** the report uses EPA's regulatory NAAQS limit (35 µg/m³) as the alerting baseline rather than WHO's aspirational health target (15 µg/m³), because a stricter WHO-aligned threshold would trigger far more frequently in ordinary urban air, causing alert fatigue. EPA's number is a practical, widely-adopted regulatory limit; WHO's is a long-term public-health goal, not a common enforcement threshold.

## [5] U.S. EPA — NAAQS

> PM2.5 alert threshold: above 35 µg/m³ — "EPA NAAQS 24-hour primary standard for fine inhalable particulates."

> "...Particulate Matter (PM2.5) exceeds 35 µg/m³ (U.S. EPA)..."

Verified directly from epa.gov's NAAQS table: the 24-hour PM2.5 standard is exactly 35 µg/m³, classified "primary and secondary." Exact match — this citation is accurate as-is.

## [6] WELL Building Standard v2

> TVOC alert threshold: above 1000 ppb — "Conservative ppb-scale threshold, set above WELL v2's continuous-monitoring concern level (500 µg/m³)."

> "...TVOC exceeds 1000 ppb (WELL v2)..."

> "...and the project's WELL v2-informed TVOC threshold..." (same evaluation-injection sentence as reference [2])

The 500 µg/m³ figure itself is verified directly from WELL's own standard document ("total VOC levels of 500 µg/m³ or lower"). What changed: the report used to imply a direct numeric comparison between the project's 1000 **ppb** threshold and WELL's 500 **µg/m³** threshold ("margin above"), as if they were on the same scale. They aren't — ppb-to-µg/m³ for a VOC mixture depends on a molecular-weight conversion factor that WELL v2 never states (it only publishes in µg/m³), and different bodies use different factors (2.3–4.9 µg/m³ per ppb depending on the assumed reference compound) that disagree with each other. The CCS811 sensor's own datasheet doesn't state its conversion basis either, so no factor here is independently verifiable. Reworded to keep WELL v2 as legitimate context without claiming a precise cross-unit relationship that can't actually be checked.

## [7] IEEE 802.15.4-2020

> "...the system utilizes an IPv6-based OpenThread mesh network operating on the IEEE 802.15.4 standard. The mesh enables autonomous routing and self-healing connectivity."

## [8] Ortega, Su, Chattopadhyay, and Chakrabarty — Discretized-Isolation Forest (2025)

> Related Work: "Ortega et al. show Isolation Forest can be made 79x/166x more efficient without accuracy loss, reinforcing its choice as a lightweight, unsupervised algorithm for this project's decoupled ML service."

This is one of 4 academic papers added to close a tracked gap: the original project proposal had a full literature review with these papers, but none of it carried into the final report. Verified real via IEEE Xplore (document 10700727) before adding: *IEEE Internet of Things Journal*, vol. 12, no. 2, pp. 1699–1717, 2025. The paper's own reported figures are real (79.38x training-time reduction, 166.66x memory reduction vs. standard Isolation Forest).

**Correction (caught by the user right after this was added):** the first draft of this sentence said the paper's edge-hardware efficiency numbers support "this platform's algorithm" — implying this project's Isolation Forest model runs on the same kind of resource-constrained edge hardware (the nRF52840 sensor node) that Ortega et al. actually target. It doesn't. Checked `platform/docker-compose.ha.yml`: `ml-service` runs in the same container stack as the Java API, MongoDB, and dashboard — the backend/platform tier, not the edge sensor node. Reworded to cite the paper for what it actually supports: general validation that Isolation Forest is a lightweight, efficient algorithm family, without implying this project deploys it on comparable edge hardware.

## [9] Wu, Dai, and Tang — GNNs for Anomaly Detection in IIoT (2022)

> Related Work: "Wu et al. survey GNN-based IIoT anomaly detection, an approach avoided here given its overhead for a single-room deployment."

Verified real via multiple independent sources (ResearchGate, SciRP references) before adding: *IEEE Internet of Things Journal*, vol. 9, no. 12, pp. 9214–9231. Cited as a contrasting approach — graph neural networks are powerful for multi-node industrial networks with rich inter-sensor topology, but add training/labeling overhead that isn't justified for this project's single-room deployment, which is why Isolation Forest (simpler, unsupervised) was chosen instead.

## [10] Guha and Datta — GDRNet Dynamic Sliding Window (2025)

> Related Work: "Guha and Datta show that a fixed sliding window is suboptimal for IIoT drift-adaptation, reinforcing this project's own move away from a static window toward the statistically-triggered recalibration evaluated in Section 6.6."

This now cross-references Section 6.6 (Empirical Evaluation Results) directly, so a reader — or the professor — doesn't just have to take the "move away from a static window" claim on faith. Section 6.6 has the actual data: a sensitivity check that forced a large, static-like recalibration window and measured it performing far worse (TPR 5.86%, FPR 2.44%) than the real event-triggered design (TPR 77.31%, FPR 0.45%). The Related Work sentence and the evaluation section now back each other up instead of sitting disconnected.

Verified real via search results describing the paper directly before adding: *IEEE Access*, vol. 13, pp. 200382–200393, 2025. GDRNet uses a trained regression model to predict the optimal sliding-window size online.

**Correction (caught by the user right after this was added, same pattern as the Ortega fix):** the first draft said Guha and Datta's paper "propose a learned dynamic sliding-window predictor, motivating this project's move to event-triggered recalibration" — implying this project adopted a learned/trained window-size predictor like GDRNet's. It didn't. Per divergence #4 (already resolved), this project's actual mechanism is a KS-test-triggered recalibration using a **fixed** window size (40 readings) once triggered — a different solution to a related problem, not a learned predictor at all. Reworded to cite the paper for the general problem it establishes (static windows are suboptimal for drift-adaptation), without claiming this project adopted its specific learned-prediction technique.

## [11] Khattak, Nasralla, Farman, and Choudhury — IEEE 802.15.4 Thread Network Evaluation (2023)

> Related Work: "Khattak et al. validate IEEE 802.15.4-based Thread mesh networking, supporting the OpenThread architecture used here."

Verified real directly from MDPI's own site before adding: *Applied Sciences (MDPI)*, vol. 13, no. 13, article 7745, 2023 (DOI: 10.3390/app13137745). The paper empirically evaluates a Raspberry Pi + nRF52840 + OpenThread 1.2 mesh network — directly supporting the choice of an IEEE 802.15.4-based OpenThread mesh for this project's own sensor layer.

## [12] Zephyr RTOS API Reference

> "...executing the Zephyr Real-Time Operating System (RTOS) while adhering to strict low-power constraints."

## [13] RFC 7252 (CoAP)

> "The constrained edge nodes transmit telemetry utilizing the Constrained Application Protocol (CoAP) over UDP/IPv6."

> "The Constrained Application Protocol (CoAP) is executed over UDP. Edge nodes send PUT requests to the URI `storedata` and block for up to 5,000 ms awaiting an explicit CoAP ACK."

## [14] RFC 8949 (CBOR)

> "Payloads are aggressively compressed using Concise Binary Object Representation (CBOR)."

> "Payloads are serialized using the `zcbor` library to produce CBOR arrays. A single batch contains raw sample arrays and a 27-element statistics map..."

## [15] Sensirion SCD4x datasheet

> "For the SCD41, the floors are taken directly from the Sensirion datasheet's typical accuracy specification: ±0.8°C (15–35°C range) and ±(50 ppm + 3% of reading)."

> Appendix: "SCD41 (Temperature): ±0.8°C, per Sensirion SCD4x datasheet typical accuracy, 15–35°C"

> Appendix: "SCD41 (CO2): ±(50 ppm + 3% of reading), per Sensirion SCD4x datasheet typical accuracy, 1001–2000 ppm"

## [16] Sensirion SPS30 datasheet

> "For the SPS30, the floor matches the datasheet's stated 0–100 µg/m³ mass-concentration precision: ±5 µg/m³."

> Appendix: "SPS30 (PM2.5): ±5 µg/m³, per Sensirion SPS30 datasheet mass-concentration precision, 0–100 µg/m³"

## [17] CCS811 datasheet

> "The CCS811 TVOC floor (±25 ppb) is a project-selected conservative margin, since the CCS811 datasheet does not publish a TVOC accuracy specification."

> Appendix: "CCS811 (TVOC): ±25 ppb, project-selected margin (no TVOC accuracy spec published)"

This is the one reference in the whole report that's explicitly labeled as *not* backed by the source it's next to — the datasheet is cited to show that no such number exists there, not to support the ±25 ppb value itself.

## [18] Scikit-Learn IsolationForest documentation

> "The core inference engine utilizes Scikit-Learn's Isolation Forest algorithm. The contamination parameter is configured to `auto`, applying a fixed decision threshold derived from the original Isolation Forest paper rather than requiring a manually specified outlier fraction."

This wording used to say `auto` lets the model "dynamically scale to the natural variance of the environment" — checked directly against scikit-learn's own docs, and that's wrong. `contamination='auto'` sets a **fixed** offset of **-0.5** (from the original Isolation Forest paper), not something that adapts to a room's actual variance. Confirmed the code genuinely uses `contamination="auto"` (`platform/ml-service/app/ml/ml_engine.py:93`), so the citation and setting are real — only the description of what "auto" does was inaccurate. Corrected to describe the real, fixed-threshold behavior.

---

To check any of these yourself, see `how-to-check-references-yourself.md` in this same folder — it has the exact search term and what should come up for each of the 18 references above.
