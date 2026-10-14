# Statistics UI Placement Guide - Phase A Implementation

## UI/UX Analysis: Where to Display 27 Statistical Fields

After analyzing the current dashboard structure, here are the **recommended placements** for statistical data visualization.

---

## Current Dashboard Structure

### 1. **DashboardPage.jsx** (Main Overview)
- **Purpose**: Building-wide or room-specific monitoring
- **Current Content**: 
  - KPI cards (temp, CO2, PM2.5, AQI, nodes, alerts)
  - 3 telemetry charts (temp, CO2, PM2.5)
  - Recent telemetry table (10 sensor columns)
  - Recent alerts panel
- **User Flow**: Primary landing page, high-level overview

### 2. **NodesPage.jsx** (Node Management)
- **Purpose**: List all registered sensor nodes
- **Current Content**:
  - Node cards with status, location, last seen
  - Simple grid layout
- **User Flow**: Node discovery and status monitoring

### 3. **AlertsPage.jsx** (Alert Management)
- **Purpose**: View and manage environmental alerts
- **User Flow**: Alert triage and resolution

### 4. **NetworkTopologyPage.jsx** (Network Visualization)
- **Purpose**: Thread mesh network topology
- **User Flow**: Network diagnostics

---

## Recommended Placement Strategy

### ✅ **Option 1: Expand DashboardPage (RECOMMENDED)**

**Why This Works:**
- Users are already viewing sensor data here
- Natural extension of existing telemetry display
- No navigation required
- Contextual - statistics relate to current readings

**Implementation Approach:**

#### A. Add Statistics Section Below Charts
```
┌─────────────────────────────────────────────┐
│ KPI Cards (6 cards)                         │
├─────────────────────────────────────────────┤
│ Telemetry Charts (3 charts)                 │
├─────────────────────────────────────────────┤
│ ✨ NEW: Sensor Stability Overview (4 cards) │  ← ADD HERE
├─────────────────────────────────────────────┤
│ Recent Telemetry Table                      │
├─────────────────────────────────────────────┤
│ Recent Alerts Panel                         │
└─────────────────────────────────────────────┘
```

**What to Show:**
- 4 key metrics: Temperature, CO2, PM2.5, Humidity
- Each card shows: Current value, Mean, Std, Max, Stability badge
- Color-coded stability indicators (Green/Yellow/Red)
- Compact, scannable layout

**Benefits:**
- ✅ Minimal UI disruption
- ✅ Contextual placement (near related charts)
- ✅ Progressive disclosure (fold/unfold section)
- ✅ Works for both "All Rooms" and single room view

---

#### B. Add Statistics Column to Telemetry Table
```
Current Table:
┌──────┬──────┬─────┬─────┬──────┬──────┬──────┬───────┬──────┬──────┬───────┬──────┐
│ Node │ Temp │ Hum │ CO2 │ TVOC │ eCO2 │ PM1.0│ PM2.5 │ PM4.0│ PM10 │ Light │ Time │
└──────┴──────┴─────┴─────┴──────┴──────┴──────┴───────┴──────┴──────┴───────┴──────┘

Enhanced Table:
┌──────┬──────┬─────┬─────┬──────┬──────┬──────┬───────┬──────┬──────┬───────┬──────┬──────────┐
│ Node │ Temp │ Hum │ CO2 │ TVOC │ eCO2 │ PM1.0│ PM2.5 │ PM4.0│ PM10 │ Light │ Time │ Stability│
│      │      │     │     │      │      │      │       │      │      │       │      │ 🟢 Stable│
└──────┴──────┴─────┴─────┴──────┴──────┴──────┴───────┴──────┴──────┴───────┴──────┴──────────┘
```

**What to Show:**
- Single "Stability" column with badge
- Click badge → Modal with full statistics breakdown
- Tooltip on hover shows key stats (mean, std)

**Benefits:**
- ✅ Minimal space usage
- ✅ Progressive disclosure (modal for details)
- ✅ Scannable at a glance
- ✅ No layout changes

---

#### C. Add Expandable Statistics Row in Table
```
┌──────────────────────────────────────────────────────────────────────────┐
│ Node: Conference Room | Temp: 22.5°C | CO2: 850 ppm | ... | Time: 2m ago │
│ ▼ Show Statistics                                                         │  ← Click to expand
├──────────────────────────────────────────────────────────────────────────┤
│ 📊 30-Sample Statistics:                                                  │
│ Temperature: Mean 22.3°C | σ 0.4°C | Max 23.1°C | 🟢 Stable             │
│ CO2: Mean 820 ppm | σ 45 ppm | Max 920 ppm | 🟢 Stable                  │
│ PM2.5: Mean 12.5 µg/m³ | σ 2.1 µg/m³ | Max 15.8 µg/m³ | 🟢 Stable       │
│ Humidity: Mean 45.2% | σ 1.8% | Max 48.0% | 🟢 Stable                    │
└──────────────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ On-demand visibility
- ✅ Detailed view without cluttering
- ✅ Per-row context
- ✅ Easy to implement

---

### ✅ **Option 2: Enhance NodesPage (ALTERNATIVE)**

**Why This Could Work:**
- NodesPage is currently very simple (just status cards)
- Natural place for detailed node information
- Users go here to check node health

**Implementation Approach:**

#### Expand Node Cards with Statistics Tab
```
┌─────────────────────────────────────────┐
│ 🟢 node-598c                            │
│ ┌─────────┬──────────┬──────────────┐  │
│ │ Status  │ Location │ Statistics ✨ │  │ ← Add new tab
│ └─────────┴──────────┴──────────────┘  │
│                                         │
│ 📊 Sensor Stability (30 samples):      │
│                                         │
│ Temperature:  22.5°C  🟢 Stable         │
│   Mean: 22.3°C | σ: 0.4°C | Max: 23.1°C│
│                                         │
│ CO2:  850 ppm  🟢 Stable                │
│   Mean: 820 ppm | σ: 45 ppm | Max: 920 │
│                                         │
│ PM2.5:  12.5 µg/m³  🟢 Stable           │
│   Mean: 12.1 | σ: 2.1 | Max: 15.8      │
│                                         │
│ Humidity:  45%  🟢 Stable               │
│   Mean: 45.2% | σ: 1.8% | Max: 48.0%   │
└─────────────────────────────────────────┘
```

**Benefits:**
- ✅ Dedicated space for node details
- ✅ Doesn't clutter main dashboard
- ✅ Natural fit for node-specific data
- ❌ Requires navigation (not on main page)

---

### ❌ **Option 3: Create New "Statistics" Page (NOT RECOMMENDED)**

**Why This Doesn't Work:**
- Adds navigation complexity
- Statistics are contextual - should be near sensor data
- Users won't discover it
- Breaks user flow

---

## Final Recommendation: **Hybrid Approach**

### **Phase A.1: Quick Win (1-2 hours)**
**Location:** DashboardPage.jsx - Add statistics section below charts

```jsx
{/* ─── NEW: Sensor Stability Overview ─── */}
<Box sx={{ mb: 3 }}>
  <SectionHeader 
    title="Sensor Stability (30-sample window)" 
    subtitle="Real-time statistical analysis" 
  />
  <Grid container spacing={2.5}>
    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
      <StatisticsCard
        title="Temperature"
        current={latestData.temperature}
        mean={latestData.temperatureMean}
        std={latestData.temperatureStd}
        max={latestData.temperatureMax}
        unit="°C"
        thresholds={{ stable: 0.5, moderate: 1.5 }}
      />
    </Grid>
    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
      <StatisticsCard
        title="CO2"
        current={latestData.co2}
        mean={latestData.co2Mean}
        std={latestData.co2Std}
        max={latestData.co2Max}
        unit="ppm"
        thresholds={{ stable: 50, moderate: 150 }}
      />
    </Grid>
    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
      <StatisticsCard
        title="PM2.5"
        current={latestData.pm2_5}
        mean={latestData.pm2_5Mean}
        std={latestData.pm2_5Std}
        max={latestData.pm2_5Max}
        unit="µg/m³"
        thresholds={{ stable: 2.0, moderate: 5.0 }}
      />
    </Grid>
    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
      <StatisticsCard
        title="Humidity"
        current={latestData.humidity}
        mean={latestData.humidityMean}
        std={latestData.humidityStd}
        max={latestData.humidityMax}
        unit="%"
        thresholds={{ stable: 2.0, moderate: 5.0 }}
      />
    </Grid>
  </Grid>
</Box>
```

**Visual Design:**
```
┌─────────────────────────────────────────┐
│ Temperature                             │
│ ┌─────────────────────────────────────┐ │
│ │ Current: 22.5°C    🟢 Stable        │ │
│ │                                     │ │
│ │ Mean:    22.3°C                     │ │
│ │ Std Dev: 0.4°C                      │ │
│ │ Peak:    23.1°C                     │ │
│ │                                     │ │
│ │ ▂▃▅▄▃▂▃▄▅▃▂▃▄▃▂ (sparkline)        │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

### **Phase A.2: Enhanced Detail (2-3 hours)**
**Location:** DashboardPage.jsx - Add expandable rows in telemetry table

Add a "Details" button/icon in each table row that expands to show:
- All 27 statistical fields
- Stability indicators
- Mini sparklines for trends

---

### **Phase A.3: Node-Specific View (Optional)**
**Location:** NodesPage.jsx - Enhance node cards

Add a "Statistics" tab to each node card showing detailed breakdown of all sensors.

---

## Implementation Priority

### 🚀 **Immediate (Phase A.1)** - 1-2 hours
**File:** `platform/dashboard/src/pages/DashboardPage.jsx`
**Action:** Add 4-card statistics section below charts
**Impact:** High visibility, minimal disruption
**Effort:** Low (reuse existing StatCard component)

### 📊 **Short-term (Phase A.2)** - 2-3 hours
**File:** `platform/dashboard/src/pages/DashboardPage.jsx`
**Action:** Add expandable statistics rows in table
**Impact:** Detailed view on demand
**Effort:** Medium (new expandable row component)

### 🔧 **Optional (Phase A.3)** - 2-3 hours
**File:** `platform/dashboard/src/pages/NodesPage.jsx`
**Action:** Enhance node cards with statistics tab
**Impact:** Node-specific detailed view
**Effort:** Medium (tab component + layout)

---

## Component Design: StatisticsCard

```jsx
// src/components/StatisticsCard.jsx
import { Card, CardContent, Typography, Box, Chip } from '@mui/material';

export default function StatisticsCard({ 
  title, 
  current, 
  mean, 
  std, 
  max, 
  unit, 
  thresholds 
}) {
  const getStabilityStatus = () => {
    if (std < thresholds.stable) return { label: 'Stable', color: 'success' };
    if (std < thresholds.moderate) return { label: 'Moderate', color: 'warning' };
    return { label: 'Unstable', color: 'error' };
  };

  const stability = getStabilityStatus();

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
            {title}
          </Typography>
          <Chip 
            label={stability.label} 
            color={stability.color} 
            size="small" 
          />
        </Box>

        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
          {current?.toFixed(1) || '--'} {unit}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <StatRow label="Mean" value={mean} unit={unit} />
          <StatRow label="Std Dev" value={std} unit={unit} />
          <StatRow label="Peak" value={max} unit={unit} />
        </Box>
      </CardContent>
    </Card>
  );
}

function StatRow({ label, value, unit }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ fontWeight: 600 }}>
        {value?.toFixed(2) || '--'} {unit}
      </Typography>
    </Box>
  );
}
```

---

## Data Flow

### 1. Fetch Latest Data
```javascript
// Already available in DashboardPage.jsx
const latestTelemetryByNode = useMemo(() => {
  // ... existing code ...
  // Returns: { 'node-598c': { temperature, temperatureMean, temperatureStd, ... } }
}, [sensorData]);
```

### 2. Extract Statistics for Selected Node
```javascript
const selectedNodeData = selectedNodeId 
  ? latestTelemetryByNode[selectedNodeId] 
  : null;

// If no node selected, show aggregated max across all nodes
const aggregatedStats = useMemo(() => {
  if (selectedNodeId) return null;
  
  // Find node with highest std for each metric (most unstable)
  const nodes = Object.values(latestTelemetryByNode);
  return {
    temperature: nodes.reduce((max, n) => 
      n.temperatureStd > max.temperatureStd ? n : max
    ),
    co2: nodes.reduce((max, n) => 
      n.co2Std > max.co2Std ? n : max
    ),
    // ... etc
  };
}, [latestTelemetryByNode, selectedNodeId]);
```

### 3. Render Statistics Cards
```jsx
<StatisticsCard
  title="Temperature"
  current={selectedNodeData?.temperature || aggregatedStats?.temperature?.temperature}
  mean={selectedNodeData?.temperatureMean || aggregatedStats?.temperature?.temperatureMean}
  std={selectedNodeData?.temperatureStd || aggregatedStats?.temperature?.temperatureStd}
  max={selectedNodeData?.temperatureMax || aggregatedStats?.temperature?.temperatureMax}
  unit="°C"
  thresholds={{ stable: 0.5, moderate: 1.5 }}
/>
```

---

## Summary

### ✅ **Recommended Approach: DashboardPage Enhancement**

**Why:**
- Users already viewing sensor data here
- Contextual placement near charts
- No navigation required
- Progressive disclosure (can expand for details)

**What to Build:**
1. **StatisticsCard component** (reusable)
2. **4-card grid section** below charts (temp, CO2, PM2.5, humidity)
3. **Stability thresholds** utility function
4. **Color-coded badges** (green/yellow/red)

**Effort:** 1-2 hours for Phase A.1

**Impact:** High - immediate value, minimal disruption

---

**Next Step:** Implement Phase A.1 in DashboardPage.jsx