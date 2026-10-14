# Quick-Reference Cheat Sheet: Health & Medical Impact of Sensor Thresholds
**Project Name:** Thread-Based Intelligent Indoor Environmental Monitoring System  
**Purpose:** 2-Minute Oral Viva & Presentation Defense Guide  

---

## 🎙️ The 30-Second Elevator Pitch (Memorize This!)
> *"Professor, our safety thresholds (`AlertService.java`) are not arbitrary comfort numbers—they are informed by established public health guidelines and published research on indoor air quality. Above $1{,}500\text{ ppm}$ $\text{CO}_2$, peer-reviewed studies (Satish et al., 2012; Allen et al., 2016) associate elevated concentrations with measurable declines in cognitive performance. Above $35\ \mu\text{g/m}^3$ $\text{PM}_{2.5}$ (the U.S. EPA 24-hour NAAQS), fine particulate matter penetrates deep into the respiratory system, with well-documented cardiovascular effects. And above $500\ \mu\text{g/m}^3$ TVOC (WELL v2 Feature A01), volatile organic compound exposure is linked to Sick Building Syndrome symptoms. Our backend catches these conditions before chronic harm occurs!"*

---

## 🏥 Master Summary Table: Sensor Values vs. Health Impact

| Parameter | Hardware Sensor | Static Safety Limit (`AlertService.java`) | Standard / Source | Biological Pathway & Mechanism | Key Clinical Symptoms & Medical Impact |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **$\text{CO}_2$** *(Carbon Dioxide)* | **Sensirion SCD41** | **$> 1{,}500\text{ ppm}$** | **ASHRAE 62.1** *(used as a ventilation adequacy proxy, not a health limit)* | Elevated indoor $\text{CO}_2$ reduces alveolar gas exchange efficiency $\rightarrow$ Hypercapnia $\rightarrow$ Cerebral respiratory acidosis. | Conservative ventilation threshold; elevated CO$_2$ concentrations are associated with reduced cognitive performance and decreased indoor air quality. (Satish et al., *Environ. Health Perspect.*, 2012; Allen et al., *Environ. Health Perspect.*, 2016). |
| **$\text{PM}_{2.5}$** *(Fine Particulates)* | **Sensirion SPS30** | **$> 35.0\ \mu\text{g/m}^3$** | **U.S. EPA NAAQS** *(24-hour primary standard, 98th percentile)*. **WHO 2021 AQG** recommends a stricter 15 µg/m³ 24-hour guideline. | Bypasses nasal/ciliary filters $\rightarrow$ Penetrates alveoli $\rightarrow$ Crosses the alveolar-capillary membrane ($\sim 0.2$–$1\ \mu\text{m}$ thick) into systemic circulation. | Acute asthma exacerbation, bronchospasm, systemic vascular inflammation. Long-term exposure associated with elevated cardiovascular event risk (WHO, *Global Air Quality Guidelines*, 2021). |
| **TVOC** *(Volatile Compounds)* | **Adafruit CCS811** | **$> 1{,}000\text{ ppb}$** | **WELL v2** Feature A01 specifies **$500\ \mu\text{g/m}^3$** for continuous monitoring. The 1,000 ppb threshold used here is a **project-specific engineering margin** above which sensor readings are considered elevated. | Lipid-soluble vapor absorption $\rightarrow$ Mucosal irritation $\rightarrow$ Can cross the blood-brain barrier at sustained high concentrations. | Burning eyes/throat, visual fatigue, dizziness, **Sick Building Syndrome (SBS)** symptoms. (Molhave, *Indoor Air*, 1991; EPA, *Introduction to Indoor Air Quality*). |
| **High Temp** | **Sensirion SCD41** | **$> 35.0^\circ\text{C}$** | **ASHRAE 55** defines a *comfort zone* (typically 20–26°C); $35^\circ\text{C}$ is a **project-specific life-safety bound** well beyond the comfort range. | Core body temperature rises $\rightarrow$ Thermoregulatory stress $\rightarrow$ Excessive sweating and fluid loss. | Dehydration, syncope (fainting), tachycardia, and risk of heat stroke at sustained exposure (CDC, *NIOSH Criteria for a Recommended Standard: Occupational Exposure to Heat and Hot Environments*, 2016). |
| **Low Temp** | **Sensirion SCD41** | **$< 10.0^\circ\text{C}$** | **ASHRAE 55** comfort zone does not extend this low; $10^\circ\text{C}$ is a **project-specific life-safety bound**. | Peripheral vasoconstriction $\rightarrow$ Increased blood pressure $\rightarrow$ Reduced mucociliary clearance in airways. | Shivering fatigue, cardiovascular strain, increased susceptibility to respiratory infections (WHO, *Housing and Health Guidelines*, 2018: recommends indoor temperatures ≥ 18°C). |
| **Humidity** | **Sensirion SCD41** | **$< 20\%$ or $> 70\%$ RH** | **ASHRAE 55** | **$<30\%$:** Dries mucous membranes and impairs mucociliary defense. **$>65\%$:** Increases water activity ($a_w > 0.65$), promoting microbial growth. | Project-specific limits selected to reduce mould growth, condensation, respiratory irritation, and electrostatic discomfort. |

---

## ⚡ The 3 Clinical Pearls to Ace Your Viva Questions

### 1. Why does $\text{PM}_{2.5}$ cause cardiovascular effects, not just coughing?
* **The Clinical Reason:** Coarse dust ($\text{PM}_{10}$) is trapped by throat mucus and coughed out. But fine particles ($<2.5\ \mu\text{m}$) are small enough to penetrate deep into lung alveoli. Because the alveolar-capillary membrane is extremely thin ($\sim 0.2$–$1\ \mu\text{m}$), $\text{PM}_{2.5}$ can translocate into systemic circulation, triggering vascular inflammation and prothrombotic responses. This mechanism is well-documented in epidemiological studies linking PM2.5 exposure to increased cardiovascular event risk (Pope et al., *Circulation*, 2004; WHO, 2021).

### 2. Why does $\text{CO}_2$ above $1{,}500\text{ ppm}$ affect cognitive performance?
* **The Clinical Reason:** When $\text{CO}_2$ builds up in a closed space, the partial pressure gradient for $\text{CO}_2$ exhalation decreases, leading to mild hypercapnia. Elevated arterial $\text{CO}_2$ crosses into cerebrospinal fluid and is converted to carbonic acid ($\text{H}_2\text{CO}_3$), lowering extracellular pH. This respiratory acidosis is associated with reduced cognitive function in controlled chamber studies (Satish et al., *Environ. Health Perspect.*, 2012), particularly affecting complex decision-making tasks.

### 3. What is "Sick Building Syndrome" from TVOCs?
* **The Clinical Reason:** TVOCs (formaldehyde, benzene, cleaning solvent vapors) evaporate at room temperature and many are lipid-soluble. They can be absorbed through the respiratory mucosa and skin, causing eye irritation, headaches, and chronic lethargy that improves when the person leaves the building. The phenomenon was formally recognized by WHO in 1986 and is extensively documented in occupational health literature (Redlich et al., *Lancet*, 1997).
