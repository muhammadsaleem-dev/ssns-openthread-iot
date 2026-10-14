# Frontend Layer: Real-Time Air Quality Index (AQI) Calculation

This document details the architectural rationale, mathematical formulation, and client-side implementation of the Air Quality Index (AQI) engine inside the React frontend dashboard (`platform/dashboard`).

---

## Executive Summary

To provide clear environmental indicators without relying on external web services, the **SSNS Smart Monitoring Platform** performs real-time **Air Quality Index (AQI)** computations directly within the React frontend application.

Rather than displaying only raw particulate concentrations ($\mu\text{g/m}^3$) or requiring calls to external weather APIs, our frontend evaluates incoming $\text{PM}_{2.5}$ and $\text{PM}_{10}$ telemetry locally using the standard **United States Environmental Protection Agency (EPA)** piecewise linear formula. By calculating individual sub-indices for fine and coarse particulate matter and determining the overall composite score ($\text{AQI} = \max(\text{AQI}_{\text{PM}_{2.5}}, \text{AQI}_{\text{PM}_{10}})$), the application provides users with standardized air quality metrics that remain functional even when deployed in self-contained local network setups.

---

## 💡 Viva & Defense Quick Reference (30-Second Summary)

When explaining this feature during your oral defense or presentation, use this concise summary:

> *"Instead of relying on external cloud weather APIs, our React frontend calculates real-time Air Quality Index (AQI) directly inside the browser using the **official US EPA piecewise linear formula**.*
> 
> *Whenever new sensor telemetry arrives, the frontend computes individual sub-indices for $\text{PM}_{2.5}$ and $\text{PM}_{10}$ across 6 pollution tiers.*
> 
> *It then takes the **maximum** of the two sub-indices ($\max(\text{PM}_{2.5}, \text{PM}_{10})$) to display the overall composite AQI on our dashboard, ensuring standardized health reporting even on local self-contained networks."*

### Key Viva Q&A
* **Q: Why calculate AQI on the frontend instead of calling a cloud API?**
  * **A:** To make the UI completely self-contained and autonomous without needing external paid API keys or internet dependencies.
* **Q: Why take the maximum between PM2.5 and PM10?**
  * **A:** Because US EPA standards dictate that the overall environmental AQI of a space is determined by whichever particulate pollutant poses the highest health risk at that moment.

---

## 1. Client-Side Air Quality Index (AQI) Calculation

To provide users with an intuitive, standardized assessment of environmental particulate pollution without relying on external cloud APIs, the frontend dynamically calculates real-time Air Quality Index (AQI) values locally within the user's browser.

### 1.1 Standardized EPA Piecewise Linear Formula
The calculation adheres strictly to the official **United States Environmental Protection Agency (EPA)** piecewise linear interpolation formula for particulate matter ($\text{PM}_{2.5}$ and $\text{PM}_{10}$).

For a measured pollutant concentration $C$, the sub-index $I$ is calculated as:

$$I = \text{round}\left( \frac{I_{\text{high}} - I_{\text{low}}}{C_{\text{high}} - C_{\text{low}}} (C - C_{\text{low}}) + I_{\text{low}} \right)$$

Where:
* $C$ = Observed concentration of the particulate pollutant ($\mu\text{g/m}^3$)
* $C_{\text{low}}$ = Concentration breakpoint lower bound $(\le C)$
* $C_{\text{high}}$ = Concentration breakpoint upper bound $(\ge C)$
* $I_{\text{low}}$ = AQI index breakpoint corresponding to $C_{\text{low}}$
* $I_{\text{high}}$ = AQI index breakpoint corresponding to $C_{\text{high}}$

### 1.2 Concentration Breakpoint Tiers ($\mu\text{g/m}^3$)

The frontend utilizes the following EPA standardized breakpoint tables:

| AQI Category | AQI Range ($I_{\text{low}} - I_{\text{high}}$) | $\text{PM}_{2.5}$ Range ($C_{\text{low}} - C_{\text{high}}$) | $\text{PM}_{10}$ Range ($C_{\text{low}} - C_{\text{high}}$) |
| :--- | :---: | :---: | :---: |
| **Good** | $0 - 50$ | $0.0 - 12.0$ | $0 - 54$ |
| **Moderate** | $51 - 100$ | $12.1 - 35.4$ | $55 - 154$ |
| **Unhealthy for Sensitive Groups** | $101 - 150$ | $35.5 - 55.4$ | $155 - 254$ |
| **Unhealthy** | $151 - 200$ | $55.5 - 150.4$ | $255 - 354$ |
| **Very Unhealthy** | $201 - 300$ | $150.5 - 250.4$ | $355 - 424$ |
| **Hazardous** | $301 - 500$ | $250.5 - 500.4$ | $425 - 604$ |

### 1.3 Composite AQI Determination
Once the individual sub-indices for $\text{PM}_{2.5}$ ($\text{AQI}_{\text{PM}_{2.5}}$) and $\text{PM}_{10}$ ($\text{AQI}_{\text{PM}_{10}}$) are computed, the overall environmental AQI for the monitored space is determined by taking the **maximum** of the two sub-indices:

$$\text{AQI}_{\text{composite}} = \max\left(\text{AQI}_{\text{PM}_{2.5}}, \text{AQI}_{\text{PM}_{10}}\right)$$

### 1.4 Code Implementation Reference
The implementation resides in [`platform/dashboard/src/utils/format.js`](file:///Users/saleem/Projects/ssns-project/platform/dashboard/src/utils/format.js):

```javascript
export function computeAqi(pm25, pm10) {
  const calcSubIndex = (conc, breakpoints) => {
    for (let i = 0; i < breakpoints.length; i++) {
      const bp = breakpoints[i];
      if (conc >= bp.cLow && conc <= bp.cHigh) {
        return Math.round(
          ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (conc - bp.cLow) + bp.iLow
        );
      }
    }
    const last = breakpoints[breakpoints.length - 1];
    return Math.round(
      ((last.iHigh - last.iLow) / (last.cHigh - last.cLow)) * (conc - last.cLow) + last.iLow
    );
  };

  const pm25Bps = [
    { cLow: 0.0, cHigh: 12.0, iLow: 0, iHigh: 50 },
    { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
    { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
    { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
    { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
    { cLow: 250.5, cHigh: 500.4, iLow: 301, iHigh: 500 },
  ];

  const pm10Bps = [
    { cLow: 0, cHigh: 54, iLow: 0, iHigh: 50 },
    { cLow: 55, cHigh: 154, iLow: 51, iHigh: 100 },
    { cLow: 155, cHigh: 254, iLow: 101, iHigh: 150 },
    { cLow: 255, cHigh: 354, iLow: 151, iHigh: 200 },
    { cLow: 355, cHigh: 424, iLow: 201, iHigh: 300 },
    { cLow: 425, cHigh: 604, iLow: 301, iHigh: 500 },
  ];

  const aqi25 = pm25 !== undefined && pm25 !== null ? calcSubIndex(pm25, pm25Bps) : 0;
  const aqi10 = pm10 !== undefined && pm10 !== null ? calcSubIndex(pm10, pm10Bps) : 0;

  return Math.max(aqi25, aqi10);
}
```
