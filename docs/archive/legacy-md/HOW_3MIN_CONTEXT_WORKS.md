# How Backend Gets 3-Minute Context from ONE Packet

## The Confusion

**Question:** "If backend reads only ONE packet, how does it have 3 minutes of context?"

**Answer:** The 3-minute context is **PRE-CALCULATED by the firmware** and **included IN the packet**!

---

## The Magic: Firmware Does the Work

### What Happens in Firmware:

```
Firmware maintains a 30-sample circular buffer:

Time:     10:00:00  10:00:06  10:00:12  10:00:18  10:00:24  10:00:30  ...
Sample:      45       48        52        50        47        45      ...
             ↓        ↓         ↓         ↓         ↓         ↓
          [Buffer keeps last 30 samples = 3 minutes of history]
```

**At 10:03:00 (after 30 samples collected):**

```c
// Firmware has 30 samples in buffer:
float buffer[30] = {45, 48, 52, 50, 47, 45, 43, 46, 49, ...}
                    ↑                                    ↑
                 3 min ago                            now

// Firmware calculates statistics RIGHT NOW:
float mean = calculate_mean(buffer, 30);      // = 46.5 ppb
float std = calculate_std_dev(buffer, 30);    // = 2.8 ppb  
float max = find_max(buffer, 30);             // = 52 ppb

// Firmware reads current sensor:
float current = read_sensor();                // = 45 ppb

// Firmware packs EVERYTHING into ONE packet:
packet = {
    tvoc: 45,           // Current reading
    tvocMean: 46.5,     // Average of last 3 minutes
    tvocStd: 2.8,       // Variation over last 3 minutes
    tvocMax: 52         // Peak in last 3 minutes
}

// Firmware sends this ONE packet
send_packet(packet);
```

---

## What Backend Receives

### Backend gets ONE packet with:

```json
{
  "nodeId": "node-598c",
  "timestamp": "2024-01-15T10:03:00Z",
  "tvoc": 45,           ← Current value (right now)
  "tvocMean": 46.5,     ← Already calculated from 3 minutes of data!
  "tvocStd": 2.8,       ← Already calculated from 3 minutes of data!
  "tvocMax": 52,        ← Already calculated from 3 minutes of data!
  ... (40 more fields)
}
```

**The backend doesn't need to look at 30 packets!**
**The firmware already did the math and put the result in THIS packet!**

---

## Example: Perfume Spray Scenario

### Timeline:

```
09:57:00 - Firmware buffer has 30 samples, all normal (~45 ppb)
           Statistics: mean=45, std=3, max=48

09:57:30 - Batch transmission
           Packet contains: {tvoc: 45, tvocMean: 45, tvocStd: 3, tvocMax: 48}
           Backend: All normal ✅

10:00:06 - Someone sprays perfume! TVOC spikes to 320 ppb
           Firmware adds 320 to buffer (now has samples: 45,45,45,...,320)
           Firmware recalculates: mean=54, std=62, max=320

10:00:12 - TVOC recovering to 180 ppb
           Firmware adds 180 to buffer
           Firmware recalculates: mean=58, std=85, max=320

10:00:18 - TVOC at 65 ppb
           Firmware adds 65 to buffer
           Firmware recalculates: mean=62, std=88, max=320

10:00:24 - TVOC at 50 ppb
           Firmware adds 50 to buffer
           Firmware recalculates: mean=58, std=82, max=320

10:00:30 - Batch transmission (5 samples)
           Sample 1: {tvoc: 45, tvocMean: 45, tvocStd: 3, tvocMax: 48}
           Sample 2: {tvoc: 320, tvocMean: 54, tvocStd: 62, tvocMax: 320} ← Spike!
           Sample 3: {tvoc: 180, tvocMean: 58, tvocStd: 85, tvocMax: 320}
           Sample 4: {tvoc: 65, tvocMean: 62, tvocStd: 88, tvocMax: 320}
           Sample 5: {tvoc: 50, tvocMean: 58, tvocStd: 82, tvocMax: 320}

Backend receives this ONE batch packet and processes Sample 2:
  - current = 320 (high!)
  - mean = 54 (still low - because 29 other samples were normal)
  - std = 62 (high - because of the spike)
  - max = 320 (captured the spike)
  
Backend decision:
  "High current but low mean and high std = Transient spike"
  → No alert, just log
```

---

## The Key Insight

### Backend doesn't need to query 30 packets because:

1. **Firmware maintains the buffer** (30 samples, 3 minutes)
2. **Firmware calculates statistics** from that buffer
3. **Firmware includes statistics IN EVERY packet**
4. **Backend reads ONE packet** and gets 3 minutes of context

---

## Visual Explanation

### What Backend DOESN'T Do (Old Way):

```
Backend receives packet with tvoc=320

Backend thinks: "I need context! Let me query database..."

SELECT * FROM sensor_data 
WHERE nodeId='node-598c' 
  AND timestamp > NOW() - INTERVAL 3 MINUTES
ORDER BY timestamp DESC
LIMIT 30;

Backend calculates:
  mean = average(30 packets)
  std = std_dev(30 packets)
  max = max(30 packets)

Backend makes decision
```

**Problem:** Slow! Requires database query and calculation.

---

### What Backend DOES Do (New Way):

```
Backend receives packet with:
  tvoc=320
  tvocMean=54      ← Already calculated!
  tvocStd=62       ← Already calculated!
  tvocMax=320      ← Already calculated!

Backend makes decision immediately:
  if (tvoc > 200 && tvocMean < 100 && tvocStd > 50):
      return "Transient spike, no alert"
```

**Advantage:** Fast! No database query needed. Context is in the packet!

---

## Why This is Brilliant

### Firmware Perspective:
- Firmware already has the buffer in memory (for sensor aggregation)
- Calculating statistics is cheap (just math on 30 numbers)
- Sending 4 numbers (current, mean, std, max) vs 1 number (current) is negligible

### Backend Perspective:
- Gets 3 minutes of context in every packet
- No database queries needed
- No additional computation needed
- Fast alert decisions

### Network Perspective:
- Packet size: 43 fields vs 10 fields = 4.3x larger
- But still tiny (few hundred bytes)
- Sent every 30 seconds (not every 6 seconds)
- Negligible network impact

---

## Analogy

### Old System (Without Statistics):
```
You: "Is it hot outside?"
Thermometer: "It's 35°C right now"
You: "But is that unusual? Let me check the last 30 readings..."
[You go look at historical data]
You: "Hmm, average was 22°C, so yes, it's unusually hot!"
```

### New System (With Statistics):
```
You: "Is it hot outside?"
Thermometer: "It's 35°C right now. 
              Average over last 3 minutes: 22°C
              Variation: 8°C
              Peak: 35°C"
You: "Ah! It just spiked. Probably temporary."
```

**The thermometer did the analysis for you!**

---

## Summary

### Question: "How does backend get 3-minute context from ONE packet?"

### Answer:

**The firmware maintains a 30-sample buffer (3 minutes) and calculates statistics from it. These statistics are included IN EVERY PACKET. So when the backend reads ONE packet, it receives:**

1. **Current value** - what's happening right now
2. **Mean** - average of last 3 minutes (pre-calculated by firmware)
3. **Std Dev** - variation over last 3 minutes (pre-calculated by firmware)
4. **Max** - peak in last 3 minutes (pre-calculated by firmware)

**The backend doesn't need to look at 30 packets or query the database. The firmware already did the work and put the 3-minute summary in THIS packet!**

---

## Code Flow

### Firmware (Every 6 Seconds):
```c
1. Read sensor → tvoc = 45 ppb
2. Add to buffer → buffer[index] = 45
3. Calculate stats → mean, std, max from buffer[30]
4. Store in sample → sample.tvoc = 45, sample.tvocMean = 46.5, ...
```

### Firmware (Every 30 Seconds):
```c
5. Pack 5 samples into CBOR
6. Send ONE batch packet
```

### Backend (Receives Batch):
```c
7. Parse packet → extract all 43 fields per sample
8. For each sample:
   - current = sample.tvoc          // 45 ppb
   - mean = sample.tvocMean         // 46.5 ppb (3-min average!)
   - std = sample.tvocStd           // 2.8 ppb (3-min variation!)
   - max = sample.tvocMax           // 52 ppb (3-min peak!)
9. Make decision using these 4 values
10. Generate alert (or not)
```

**No database queries. No historical lookups. Context is in the packet!**

---

**This is why statistics-based alerting is so powerful - the context travels WITH the data!** 🎯