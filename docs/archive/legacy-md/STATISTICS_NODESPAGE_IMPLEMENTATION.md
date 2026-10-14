# Statistics Implementation - NodesPage Enhancement

## Implementation Plan: Option 2 - Enhance NodesPage

### Overview
Add a "Statistics" tab to each node card on NodesPage.jsx to display the 27 statistical fields in a clean, organized manner.

---

## Visual Design

### Before (Current):
```
┌─────────────────────────────────────────┐
│ 🟢 node-598c                            │
│                                         │
│ Location:   Conference Room             │
│ Last Seen:  2 minutes ago               │
│ Registered: 2024-01-15                  │
└─────────────────────────────────────────┘
```

### After (Enhanced):
```
┌─────────────────────────────────────────┐
│ 🟢 node-598c                            │
│ ┌─────────┬──────────┬──────────────┐  │
│ │ Status  │ Location │ Statistics ✨ │  │ ← New tab
│ └─────────┴──────────┴──────────────┘  │
│                                         │
│ 📊 Sensor Stability (30 samples)       │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Temperature      🟢 Stable          │ │
│ │ Current: 22.5°C                     │ │
│ │ Mean: 22.3°C | σ: 0.4°C | Max: 23.1│ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ CO2              🟢 Stable          │ │
│ │ Current: 850 ppm                    │ │
│ │ Mean: 820 | σ: 45 | Max: 920       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ PM2.5            🟢 Stable          │ │
│ │ Current: 12.5 µg/m³                 │ │
│ │ Mean: 12.1 | σ: 2.1 | Max: 15.8    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Humidity         🟢 Stable          │ │
│ │ Current: 45%                        │ │
│ │ Mean: 45.2% | σ: 1.8% | Max: 48.0% │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ... (6 more sensors)                   │
└─────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create StatisticsTab Component (30 min)

**File:** `platform/dashboard/src/components/StatisticsTab.jsx`

```jsx
import { Box, Typography, Chip, Divider } from '@mui/material';

const STABILITY_THRESHOLDS = {
  temperature: { stable: 0.5, moderate: 1.5 },
  humidity: { stable: 2.0, moderate: 5.0 },
  co2: { stable: 50, moderate: 150 },
  tvoc: { stable: 20, moderate: 50 },
  eco2: { stable: 50, moderate: 150 },
  pm1_0: { stable: 2.0, moderate: 5.0 },
  pm2_5: { stable: 2.0, moderate: 5.0 },
  pm4_0: { stable: 2.5, moderate: 6.0 },
  pm10: { stable: 3.0, moderate: 8.0 }
};

const SENSOR_CONFIG = [
  { key: 'temperature', label: 'Temperature', unit: '°C', precision: 1 },
  { key: 'humidity', label: 'Humidity', unit: '%', precision: 1 },
  { key: 'co2', label: 'CO2', unit: 'ppm', precision: 0 },
  { key: 'tvoc', label: 'TVOC', unit: 'ppb', precision: 0 },
  { key: 'eco2', label: 'eCO2', unit: 'ppm', precision: 0 },
  { key: 'pm1_0', label: 'PM1.0', unit: 'µg/m³', precision: 1 },
  { key: 'pm2_5', label: 'PM2.5', unit: 'µg/m³', precision: 1 },
  { key: 'pm4_0', label: 'PM4.0', unit: 'µg/m³', precision: 1 },
  { key: 'pm10', label: 'PM10', unit: 'µg/m³', precision: 1 }
];

function getStabilityStatus(std, thresholds) {
  if (!std || std < 0) return { label: 'Unknown', color: 'default' };
  if (std < thresholds.stable) return { label: 'Stable', color: 'success' };
  if (std < thresholds.moderate) return { label: 'Moderate', color: 'warning' };
  return { label: 'Unstable', color: 'error' };
}

function formatValue(value, precision) {
  if (value == null) return '--';
  if (value <= -998.5) return 'FAULT';
  if (value <= -997.5) return 'WARMUP';
  return value.toFixed(precision);
}

export default function StatisticsTab({ data }) {
  if (!data) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No telemetry data available
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
        📊 Sensor Stability (30-sample window)
      </Typography>

      {SENSOR_CONFIG.map((sensor, index) => {
        const current = data[sensor.key];
        const mean = data[`${sensor.key}Mean`];
        const std = data[`${sensor.key}Std`];
        const max = data[`${sensor.key}Max`];
        
        const stability = getStabilityStatus(std, STABILITY_THRESHOLDS[sensor.key]);

        return (
          <Box key={sensor.key}>
            <Box
              sx={{
                p: 1.5,
                bgcolor: 'background.default',
                borderRadius: 1,
                mb: 1.5
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {sensor.label}
                </Typography>
                <Chip 
                  label={stability.label} 
                  color={stability.color} 
                  size="small"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              </Box>

              <Typography variant="h6" sx={{ mb: 1, fontSize: '1.25rem' }}>
                {formatValue(current, sensor.precision)} {sensor.unit}
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <StatItem 
                  label="Mean" 
                  value={formatValue(mean, sensor.precision)} 
                  unit={sensor.unit} 
                />
                <StatItem 
                  label="Std Dev" 
                  value={formatValue(std, sensor.precision + 1)} 
                  unit={sensor.unit} 
                />
                <StatItem 
                  label="Peak" 
                  value={formatValue(max, sensor.precision)} 
                  unit={sensor.unit} 
                />
              </Box>
            </Box>
            {index < SENSOR_CONFIG.length - 1 && <Divider sx={{ my: 1 }} />}
          </Box>
        );
      })}
    </Box>
  );
}

function StatItem({ label, value, unit }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {value} {unit}
      </Typography>
    </Box>
  );
}
```

---

### Step 2: Update NodesPage.jsx (45 min)

**File:** `platform/dashboard/src/pages/NodesPage.jsx`

**Changes:**

1. **Add imports:**
```jsx
import { useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import StatisticsTab from '../components/StatisticsTab';
import { fetchSensorData } from '../services/api';
```

2. **Add state for active tab per node:**
```jsx
export default function NodesPage() {
  const { data: nodes, loading, error } = usePolling(fetchNodes, API.POLL_INTERVAL);
  const [activeTab, setActiveTab] = useState({}); // { nodeId: tabIndex }
  const [sensorData, setSensorData] = useState({}); // { nodeId: latestData }

  // Fetch latest sensor data for each node
  useEffect(() => {
    if (!nodes) return;
    
    nodes.forEach(async (node) => {
      try {
        const data = await fetchSensorData(node.nodeId, 1); // Last 1 hour
        if (data && data.length > 0) {
          setSensorData(prev => ({
            ...prev,
            [node.nodeId]: data[0] // Latest reading
          }));
        }
      } catch (err) {
        console.error(`Failed to fetch data for ${node.nodeId}:`, err);
      }
    });
  }, [nodes]);

  const handleTabChange = (nodeId, newValue) => {
    setActiveTab(prev => ({ ...prev, [nodeId]: newValue }));
  };

  // ... rest of component
}
```

3. **Update node card rendering:**
```jsx
<Card
  sx={{
    borderLeft: '3px solid',
    borderLeftColor: node.status === 'ONLINE' ? 'secondary.main' : 'error.main',
  }}
>
  <CardContent sx={{ p: 0 }}>
    {/* Header */}
    <Box sx={{ p: 2.5, pb: 0 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SensorsIcon sx={{ color: node.status === 'ONLINE' ? 'secondary.main' : 'text.secondary', fontSize: 20 }} />
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700 }}>
            {node.nodeId}
          </Typography>
        </Box>
        <StatusChip status={node.status} />
      </Box>
    </Box>

    {/* Tabs */}
    <Tabs 
      value={activeTab[node.nodeId] || 0} 
      onChange={(e, newValue) => handleTabChange(node.nodeId, newValue)}
      sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
    >
      <Tab label="Status" sx={{ minWidth: 80, fontSize: '0.8rem' }} />
      <Tab label="Location" sx={{ minWidth: 80, fontSize: '0.8rem' }} />
      <Tab label="Statistics" sx={{ minWidth: 80, fontSize: '0.8rem' }} />
    </Tabs>

    {/* Tab Content */}
    <Box sx={{ minHeight: 200 }}>
      {/* Status Tab */}
      {(activeTab[node.nodeId] || 0) === 0 && (
        <Box sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <InfoRow label="Status" value={node.status} />
            <InfoRow label="Last Seen" value={formatTimestamp(node.lastSeenAt)} />
            <InfoRow label="Registered" value={formatTimestamp(node.registeredAt)} />
          </Box>
        </Box>
      )}

      {/* Location Tab */}
      {(activeTab[node.nodeId] || 0) === 1 && (
        <Box sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <InfoRow label="Location" value={node.location || node.nodeId} />
            <InfoRow label="Node ID" value={node.nodeId} />
            <InfoRow label="Mesh ID" value={sensorData[node.nodeId]?.meshId || '--'} />
            <InfoRow label="IPv6" value={sensorData[node.nodeId]?.ipv6Address || '--'} />
          </Box>
        </Box>
      )}

      {/* Statistics Tab */}
      {(activeTab[node.nodeId] || 0) === 2 && (
        <StatisticsTab data={sensorData[node.nodeId]} />
      )}
    </Box>
  </CardContent>
</Card>
```

---

### Step 3: Add Loading State (15 min)

**Handle loading state for statistics tab:**

```jsx
{(activeTab[node.nodeId] || 0) === 2 && (
  <>
    {!sensorData[node.nodeId] ? (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress size={24} />
        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
          Loading statistics...
        </Typography>
      </Box>
    ) : (
      <StatisticsTab data={sensorData[node.nodeId]} />
    )}
  </>
)}
```

---

## File Structure

```
platform/dashboard/src/
├── components/
│   ├── StatisticsTab.jsx          ← NEW
│   └── ... (existing components)
├── pages/
│   ├── NodesPage.jsx              ← MODIFIED
│   └── ... (existing pages)
└── utils/
    └── sensorStability.js         ← NEW (optional)
```

---

## Implementation Checklist

### Phase 1: Component Creation (30 min)
- [ ] Create `StatisticsTab.jsx` component
- [ ] Add stability threshold constants
- [ ] Add sensor configuration array
- [ ] Implement stability status logic
- [ ] Add value formatting function
- [ ] Create StatItem sub-component

### Phase 2: NodesPage Integration (45 min)
- [ ] Add imports (useState, Tabs, Tab, StatisticsTab)
- [ ] Add state for active tabs
- [ ] Add state for sensor data
- [ ] Fetch latest sensor data for each node
- [ ] Add Tabs component to node cards
- [ ] Implement tab content switching
- [ ] Add loading state for statistics

### Phase 3: Testing (30 min)
- [ ] Test tab switching
- [ ] Verify data fetching
- [ ] Test with multiple nodes
- [ ] Test with missing data
- [ ] Test stability badges
- [ ] Test responsive layout
- [ ] Test with FAULT/WARMUP values

### Phase 4: Polish (15 min)
- [ ] Add transitions
- [ ] Optimize data fetching (debounce)
- [ ] Add error handling
- [ ] Add empty state messages
- [ ] Test accessibility (keyboard navigation)

---

## Benefits of This Approach

### ✅ Advantages:
1. **Dedicated Space**: Statistics have their own tab, not cluttering other views
2. **Node-Specific**: Each node shows its own statistics
3. **Progressive Disclosure**: Users opt-in to see statistics
4. **Scalable**: Easy to add more tabs later (e.g., "History", "Alerts")
5. **Clean UI**: Maintains simple overview in Status tab

### ⚠️ Considerations:
1. **Navigation Required**: Users must click to NodesPage
2. **Additional API Calls**: Fetches latest data for each node
3. **Tab Switching**: Requires one more click to see statistics

---

## Estimated Effort

| Task | Time | Complexity |
|------|------|------------|
| Create StatisticsTab component | 30 min | Low |
| Update NodesPage.jsx | 45 min | Medium |
| Add loading states | 15 min | Low |
| Testing & polish | 30 min | Low |
| **Total** | **2 hours** | **Low-Medium** |

---

## Next Steps

1. **Create StatisticsTab.jsx** - Reusable component for displaying statistics
2. **Update NodesPage.jsx** - Add tabs and integrate StatisticsTab
3. **Test with real data** - Verify stability badges and formatting
4. **Polish UI** - Add transitions and loading states

---

## Alternative: Expandable Cards (Simpler)

If tabs feel too complex, we could use expandable cards instead:

```jsx
<Card>
  <CardContent>
    {/* Always visible */}
    <NodeHeader />
    
    {/* Expandable section */}
    <Accordion>
      <AccordionSummary>
        📊 View Statistics
      </AccordionSummary>
      <AccordionDetails>
        <StatisticsTab data={data} />
      </AccordionDetails>
    </Accordion>
  </CardContent>
</Card>
```

**Pros:** Simpler, no tab state management
**Cons:** Less organized, harder to scan multiple nodes

---

**Ready to implement? Let me know if you want to proceed with the tab-based approach or prefer the expandable accordion style!**