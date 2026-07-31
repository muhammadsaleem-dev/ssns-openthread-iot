import os
import sys
import math
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.ml.ml_engine import AnomalyDetector
from app.ml.forecaster import LightweightForecaster

def calculate_features(row, prev_row):
    if prev_row is None:
        rates = [0.0]*5
    else:
        dt = (row['timestamp'] - prev_row['timestamp']).total_seconds()
        dt_min = dt / 60.0 if dt > 0 else 1.0
        rates = [
            (row['temperature'] - prev_row['temperature']) / dt_min,
            (row['humidity'] - prev_row['humidity']) / dt_min,
            (row['co2'] - prev_row['co2']) / dt_min,
            (row['tvoc'] - prev_row['tvoc']) / dt_min,
            (row['pm2_5'] - prev_row['pm2_5']) / dt_min,
        ]
        
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
    df = pd.read_csv('/Users/saleem/Projects/ssns-project/platform/ml-service/data/saleems_room_node_e9b1.csv')
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp')
    
    # Filter out hardware fault rows
    df = df[df['temperature'] > -900]
    
    start_time = df['timestamp'].iloc[0]
    train_df = df[df['timestamp'] <= start_time + timedelta(hours=24)].copy()
    test_df = df[df['timestamp'] > start_time + timedelta(hours=24)].copy()

    print(f"Train samples: {len(train_df)}, Test samples: {len(test_df)}")
    
    # Inject anomalies
    co2_ramp_start = test_df['timestamp'].iloc[len(test_df)//4]
    tvoc_burst_start = test_df['timestamp'].iloc[3*len(test_df)//4]
    
    test_df['co2'] = test_df['co2'].astype(float)
    test_df['tvoc'] = test_df['tvoc'].astype(float)
    test_df['is_anomaly'] = False
    test_df['original_co2'] = test_df['co2']
    
    for i, row in test_df.iterrows():
        ts = row['timestamp']
        if co2_ramp_start <= ts <= co2_ramp_start + timedelta(minutes=15):
            elapsed_min = (ts - co2_ramp_start).total_seconds() / 60.0
            test_df.at[i, 'co2'] += 18.0 * elapsed_min
            test_df.at[i, 'is_anomaly'] = True
        elif ts > co2_ramp_start + timedelta(minutes=15) and ts <= co2_ramp_start + timedelta(hours=1):
            test_df.at[i, 'co2'] += 18.0 * 15
            test_df.at[i, 'is_anomaly'] = True
            
        if tvoc_burst_start <= ts <= tvoc_burst_start + timedelta(minutes=5):
            test_df.at[i, 'tvoc'] += 250.0
            test_df.at[i, 'is_anomaly'] = True

    # Setup models
    detector = AnomalyDetector(baseline_window_size=len(train_df), sensitivity=5, node_id="test_node")
    forecaster = LightweightForecaster()
    
    print("Training model...")
    prev_row = None
    for _, row in train_df.iterrows():
        features = calculate_features(row, prev_row)
        detector.process_telemetry(features)
        prev_row = row
        
    print("Evaluating Test Set...")
    prev_row = None
    
    tp = 0
    fp = 0
    tn = 0
    fn = 0
    
    ttd_co2 = None
    ttd_tvoc = None
    
    forecast_errors = []
    
    for _, row in test_df.iterrows():
        features = calculate_features(row, prev_row)
        is_anomaly, _, _ = detector.process_telemetry(features)
        
        actual_anomaly = row['is_anomaly']
        ts = row['timestamp']
        
        if actual_anomaly:
            if is_anomaly:
                tp += 1
                if co2_ramp_start <= ts <= co2_ramp_start + timedelta(minutes=15) and ttd_co2 is None:
                    ttd_co2 = (ts - co2_ramp_start).total_seconds()
                if tvoc_burst_start <= ts <= tvoc_burst_start + timedelta(minutes=5) and ttd_tvoc is None:
                    ttd_tvoc = (ts - tvoc_burst_start).total_seconds()
            else:
                fn += 1
        else:
            if is_anomaly:
                fp += 1
            else:
                tn += 1
                
        # Forecasting
        ts_sec = ts.timestamp()
        forecaster.add_reading(ts_sec, float(row['co2']), float(row['pm2_5']))
        proj_co2, proj_pm25, _, _ = forecaster.forecast(horizon_sec=1800) # 30 min
        
        # We can evaluate MAE on CO2 accumulation
        if proj_co2 is not None and row['is_anomaly']:
            # The true value in 30 mins (approx)
            # Assuming it reached max
            true_co2_future = row['original_co2'] + (18.0 * 15)
            error = abs(proj_co2 - true_co2_future)
            forecast_errors.append(error)
            
        prev_row = row

    tpr = tp / (tp + fn) if (tp + fn) > 0 else 0
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
    fnr = 1 - tpr
    
    mae = np.mean(forecast_errors) if forecast_errors else 0
    rmse = np.sqrt(np.mean([e**2 for e in forecast_errors])) if forecast_errors else 0
    
    print("\n=== FINAL EVALUATION RESULTS ===")
    print(f"True Positive Rate (TPR): {tpr*100:.2f}%")
    print(f"False Positive Rate (FPR): {fpr*100:.2f}%")
    print(f"False Negative Rate (FNR): {fnr*100:.2f}%")
    if ttd_co2 is not None: print(f"Time-to-Detection (CO2 Ramp): {ttd_co2} seconds")
    if ttd_tvoc is not None: print(f"Time-to-Detection (TVOC Burst): {ttd_tvoc} seconds")
    print(f"Forecasting MAE (CO2): {mae:.1f} ppm")
    print(f"Forecasting RMSE (CO2): {rmse:.1f} ppm")
    
if __name__ == "__main__":
    evaluate()
