"""
Extends the existing evaluate.py methodology (same model, same dataset, same
injection magnitude/logic) to inject MULTIPLE separate CO2 hazard events
spread across the test set instead of just one, to get a real detection-latency
distribution (mean/std/CI) rather than a single aggregate number.

Each event: ramp CO2 to 1.3x the ASHRAE 62.1 limit (1950 ppm) over 15 minutes,
identical magnitude/logic to the original evaluate.py's single CO2 ramp event.
Events are spaced with a cooldown gap so each is independently measurable.
"""
import os
import sys
import math
import numpy as np
import pandas as pd
from datetime import timedelta

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.ml.ml_engine import AnomalyDetector
from app.core.config import settings


def calculate_features(row, prev_row):
    fields = ['temperature', 'humidity', 'co2', 'tvoc', 'pm2_5']
    if prev_row is None:
        rates = [0.0] * 5
    else:
        dt = (row['timestamp'] - prev_row['timestamp']).total_seconds()
        dt_min = dt / 60.0 if dt > 0 else 1.0
        rates = []
        for f in fields:
            if row[f] <= -900.0 or prev_row[f] <= -900.0:
                rates.append(0.0)
            else:
                rates.append((row[f] - prev_row[f]) / dt_min)

    hour_decimal = row['timestamp'].hour + (row['timestamp'].minute / 60.0)
    sin_hour = math.sin(2 * math.pi * hour_decimal / 24.0)
    cos_hour = math.cos(2 * math.pi * hour_decimal / 24.0)

    return [
        float(row['temperature']), float(row['humidity']), float(row['co2']),
        float(row['tvoc']), float(row['pm2_5']),
        float(rates[0]), float(rates[1]), float(rates[2]), float(rates[3]), float(rates[4]),
        float(sin_hour), float(cos_hour)
    ]


def evaluate():
    print("Loading dataset...")
    df = pd.read_csv(os.path.join(os.path.dirname(__file__), '..', 'data', 'saleems_room_node_e9b1.csv'))
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp')
    df = df[df['temperature'] > -900]

    start_time = df['timestamp'].iloc[0]
    train_df = df[df['timestamp'] <= start_time + timedelta(hours=24)].copy()
    test_df = df[df['timestamp'] > start_time + timedelta(hours=24)].copy()
    test_df = test_df.reset_index(drop=True)
    print(f"Train samples: {len(train_df)}, Test samples: {len(test_df)}")

    # Same magnitude/logic as evaluate.py: 1.3x ASHRAE 62.1 limit
    co2_far_out = 1500.0 * 1.3
    test_df['co2'] = test_df['co2'].astype(float)

    # Spread N events evenly across the test set, each isolated by a cooldown
    # gap so recovery from one doesn't bleed into detection of the next.
    n_events = 6
    ramp_minutes = 15
    sustain_hours = 1
    cooldown_hours = 3  # gap after each event's sustain period ends, before the next starts

    total_span = test_df['timestamp'].iloc[-1] - test_df['timestamp'].iloc[0]
    event_spacing = total_span / (n_events + 1)

    events = []
    for i in range(1, n_events + 1):
        ramp_start = test_df['timestamp'].iloc[0] + event_spacing * i
        events.append(ramp_start)

    test_df['is_anomaly'] = False
    test_df['event_id'] = -1

    for idx, ramp_start in enumerate(events):
        rows_at_start = test_df[test_df['timestamp'] >= ramp_start]
        if rows_at_start.empty:
            continue
        co2_at_ramp_start = rows_at_start['co2'].iloc[0]
        co2_boost_total = max(0.0, co2_far_out - co2_at_ramp_start)

        mask_ramp = (test_df['timestamp'] >= ramp_start) & (test_df['timestamp'] <= ramp_start + timedelta(minutes=ramp_minutes))
        mask_sustain = (test_df['timestamp'] > ramp_start + timedelta(minutes=ramp_minutes)) & (test_df['timestamp'] <= ramp_start + timedelta(hours=sustain_hours))

        for i in test_df[mask_ramp].index:
            elapsed_min = (test_df.at[i, 'timestamp'] - ramp_start).total_seconds() / 60.0
            test_df.at[i, 'co2'] += co2_boost_total * (elapsed_min / ramp_minutes)
            test_df.at[i, 'is_anomaly'] = True
            test_df.at[i, 'event_id'] = idx

        for i in test_df[mask_sustain].index:
            test_df.at[i, 'co2'] += co2_boost_total
            test_df.at[i, 'is_anomaly'] = True
            test_df.at[i, 'event_id'] = idx

        print(f"Event {idx}: ramp_start={ramp_start}, {co2_at_ramp_start:.0f} -> {co2_at_ramp_start + co2_boost_total:.0f} ppm")

    # Train
    detector = AnomalyDetector(baseline_window_size=len(train_df), sensitivity=5, node_id="test_node")
    print("Training model...")
    prev_row = None
    for _, row in train_df.iterrows():
        features = calculate_features(row, prev_row)
        detector.process_telemetry(features)
        prev_row = row

    detector.baseline_window_size = settings.baseline_window_size
    detector.baseline_data = detector.baseline_data[-settings.baseline_window_size:]
    detector.anomaly_flags = detector.anomaly_flags[-settings.baseline_window_size:]

    print("Evaluating test set across all events...")
    prev_row = None
    detection_latencies = {}  # event_id -> seconds to first correct detection
    detected_at_all = set()

    for _, row in test_df.iterrows():
        features = calculate_features(row, prev_row)
        is_anomaly, _, _ = detector.process_telemetry(features)

        ts = row['timestamp']
        ev = row['event_id']

        if row['is_anomaly'] and is_anomaly and ev not in detection_latencies and ev != -1:
            ramp_start = events[int(ev)]
            detection_latencies[ev] = (ts - ramp_start).total_seconds()

        prev_row = row

    print("\n=== Per-event detection latency (seconds) ===")
    for ev in sorted(detection_latencies.keys()):
        print(f"Event {ev}: {detection_latencies[ev]:.0f} s")

    missed = [i for i in range(n_events) if i not in detection_latencies]
    if missed:
        print(f"Events never detected: {missed}")

    latencies = list(detection_latencies.values())
    if len(latencies) >= 2:
        arr = np.array(latencies)
        mean = arr.mean()
        std = arr.std(ddof=1)
        sem = std / np.sqrt(len(arr))
        from scipy import stats as spstats
        ci = spstats.t.interval(0.95, df=len(arr) - 1, loc=mean, scale=sem) if sem > 0 else (mean, mean)
        print(f"\n=== Detection latency statistics (n={len(arr)} events) ===")
        print(f"Mean: {mean:.1f} s")
        print(f"Std Dev: {std:.1f} s")
        print(f"95% CI: [{ci[0]:.1f}, {ci[1]:.1f}] s")
    else:
        print("Not enough detected events for statistics.")


if __name__ == "__main__":
    evaluate()
