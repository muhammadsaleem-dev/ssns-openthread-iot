# SSNS Statistics - Operator Guide

## What Are Statistics?

The SSNS dashboard shows **statistics** for each sensor. These are simple numbers that help you understand what's happening in your building without needing technical knowledge.

---

## Understanding the Statistics Display

When you click on the **Statistics** tab for any sensor node, you'll see information like this:

```
Temperature                    🟢 Stable
22.5 °C

Mean: 22.3°C    Std Dev: 0.4°C    Peak: 23.1°C
```

### What Each Number Means:

| Term | What It Means | Example |
|------|---------------|---------|
| **Current Value** | Right now reading | 22.5°C |
| **Mean** | Average over last 5 minutes | 22.3°C |
| **Std Dev** | How much it varies | 0.4°C (small = stable) |
| **Peak** | Highest value in last 5 minutes | 23.1°C |

### Stability Indicators:

- 🟢 **Stable** = Everything is normal, no action needed
- 🟠 **Moderate** = Some fluctuation, monitor the situation
- 🔴 **Unstable** = High variation, investigate the cause

---

## Real-World Examples

### Example 1: Normal Office Morning

**What You See:**
```
CO₂                           🟢 Stable
450 ppm

Mean: 440 ppm    Std Dev: 15 ppm    Peak: 470 ppm
```

**What It Means:**
- CO₂ is low and stable
- Office is empty or has few people
- Ventilation is working well

**Action:** None needed ✅

---

### Example 2: Meeting Room During Meeting

**What You See:**
```
CO₂                           🟢 Stable
1050 ppm

Mean: 1020 ppm    Std Dev: 45 ppm    Peak: 1100 ppm
```

**What It Means:**
- CO₂ is elevated but stable
- Room is occupied (normal for meetings)
- People are present, causing CO₂ increase

**Action:** Normal occupancy pattern ✅

---

### Example 3: Someone Sprayed Perfume

**What You See:**
```
TVOC                          🔴 Unstable
250 ppb

Mean: 85 ppb    Std Dev: 95 ppb    Peak: 380 ppb
```

**What It Means:**
- Current reading is high (250 ppb)
- Average is much lower (85 ppb) = temporary spike
- High variation (95 ppb) = unstable
- Peak was very high (380 ppb) = something happened recently

**Action:** Temporary VOC source (perfume, cleaning product). Monitor - should return to normal soon. ⚠️

---

### Example 4: Ventilation Problem

**What You See:**
```
CO₂                           🟢 Stable
1450 ppm

Mean: 1420 ppm    Std Dev: 35 ppm    Peak: 1480 ppm
```

**What It Means:**
- CO₂ is very high (>1400 ppm)
- Average is also high (1420 ppm) = sustained problem
- Low variation (35 ppm) = stable but bad
- This is NOT a temporary spike

**Action:** Investigate ventilation system. CO₂ should not stay this high. 🚨

---

### Example 5: Sensor Malfunction

**What You See:**
```
Temperature                   🔴 Unstable
FAULT

Mean: 0.0°C    Std Dev: 0.00°C    Peak: 0.0°C
```

**What It Means:**
- Sensor is not working properly
- All statistics show zero or fault
- Hardware or connection issue

**Action:** Check sensor hardware and connections. 🔧

---

## Quick Decision Guide

### When to Take Action:

| Situation | Indicator | Action |
|-----------|-----------|--------|
| **High Mean + Low Std Dev** | 🟢 Stable but elevated | Investigate cause (ventilation, occupancy) |
| **High Peak + Low Mean** | 🔴 Unstable | Temporary spike, monitor for recovery |
| **High Mean + High Std Dev** | 🔴 Unstable | Ongoing problem with fluctuations |
| **FAULT or zeros** | 🔴 Unstable | Check sensor hardware |
| **Low values, stable** | 🟢 Stable | Everything normal |

---

## Understanding "30-Sample Statistics"

### What Does "30 Samples" Mean?

The system collects a sensor reading every **6 seconds**. The statistics you see are calculated from the last **30 readings**, which equals **3 minutes** of data (30 × 6 seconds = 180 seconds).

### Why 3 Minutes?

- **Too short** (e.g., 30 seconds): You'd see every tiny fluctuation, making it hard to spot real problems
- **Too long** (e.g., 1 hour): You'd miss important events that need quick action
- **3 minutes** (30 samples × 6 seconds): Good balance - filters out noise but catches real issues quickly

### Example Timeline:

```
Time:     10:00:00  10:00:06  10:00:12  10:00:18  10:00:24  10:00:30
Reading:      450      455      460      458      452      450  (CO₂ in ppm)
                                                            ↑
                                                   Statistics calculated
                                                   from last 30 readings
                                                   (3 minutes of data)
```

---

## Common Scenarios Explained

### Scenario 1: "Why is the current value different from the mean?"

**Example:**
```
Current: 850 ppm
Mean: 720 ppm
```

**Explanation:**
- Current = right now
- Mean = average of last 5 minutes
- If current is higher than mean, CO₂ is rising
- If current is lower than mean, CO₂ is falling

---

### Scenario 2: "What does 'WARMUP' mean?"

**Example:**
```
TVOC                          ⚪ Unknown
8 ppb

Mean: WARMUP    Std Dev: WARMUP    Peak: WARMUP
```

**Explanation:**
- Sensor just started or was reset
- Need 30 readings (5 minutes) to calculate statistics
- Current value is accurate, but statistics aren't ready yet
- Wait 5 minutes for full statistics

---

### Scenario 3: "When should I be worried?"

**Be Concerned If:**

1. **CO₂ stays above 1200 ppm** with stable indicator
   - Means: Poor ventilation for extended period
   - Action: Check HVAC system

2. **PM2.5 stays above 35 µg/m³** with stable indicator
   - Means: Poor air quality persisting
   - Action: Check air filters, look for source

3. **Temperature varies wildly** (high Std Dev)
   - Means: HVAC cycling problems
   - Action: Check thermostat and HVAC

4. **Any sensor shows FAULT**
   - Means: Hardware problem
   - Action: Check sensor connections

---

## Tips for Operators

### Daily Monitoring:

1. **Check stability indicators** - Look for 🟢 (good) vs 🔴 (investigate)
2. **Compare current vs mean** - Is the value rising or falling?
3. **Look at peak values** - Did something unusual happen recently?
4. **Watch for patterns** - Same issues at same times? (e.g., CO₂ high every afternoon)

### When to Call Maintenance:

- ❌ **Don't call** for temporary spikes (high peak, low mean)
- ✅ **Do call** for sustained problems (high mean, stable)
- ✅ **Do call** for sensor faults
- ✅ **Do call** if same issue repeats daily

---

## Glossary for Operators

| Term | Simple Explanation |
|------|-------------------|
| **Mean** | Average value over 5 minutes |
| **Std Dev** | How much the value jumps around (low = stable, high = unstable) |
| **Peak** | Highest value in last 5 minutes |
| **Stable** | Values are consistent, not jumping around |
| **Unstable** | Values are changing a lot |
| **WARMUP** | System is collecting data, wait 5 minutes |
| **FAULT** | Sensor is broken or disconnected |
| **ppm** | Parts per million (for gases like CO₂) |
| **ppb** | Parts per billion (for VOCs) |
| **µg/m³** | Micrograms per cubic meter (for particles) |

---

## Quick Reference Card

### Normal Values (Indoor Office):

| Sensor | Good Range | Concern Level |
|--------|-----------|---------------|
| **Temperature** | 20-24°C | >26°C or <18°C |
| **Humidity** | 30-60% | >70% or <20% |
| **CO₂** | 400-800 ppm | >1200 ppm |
| **TVOC** | 0-50 ppb | >200 ppb |
| **PM2.5** | 0-12 µg/m³ | >35 µg/m³ |

### Action Priority:

1. 🚨 **Immediate** - FAULT, CO₂ >1500 ppm, PM2.5 >50 µg/m³
2. ⚠️ **Today** - Sustained high values (high mean + stable)
3. 👀 **Monitor** - Temporary spikes (high peak, low mean)
4. ✅ **Normal** - All stable, values in good range

---

**Remember:** The statistics help you see patterns and catch problems early. You don't need to understand the math - just look at the indicators and follow this guide!