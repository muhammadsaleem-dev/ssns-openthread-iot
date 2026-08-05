#!/bin/bash
# =========================================================================
# SSNS Alert Engine Test Script
# Automatically injects mock payloads into the backend to test the 5 Static Engines.
# =========================================================================

# Change this if your backend is running locally
BACKEND_URL="http://13.140.144.215:8080/api/sensor-data"

# Standard normal baseline readings
BASE_JSON_TEMPLATE='{
  "nodeId": "software-test-node",
  "bootId": "1",
  "sequenceNumber": __SEQ__,
  "uptimeMs": 10000,
  "meshId": 1,
  "healthStatus": 0,
  "temperature": 22.0,
  "humidity": 40.0,
  "co2": 400.0,
  "tvoc": 100.0,
  "eco2": 400.0,
  "pm1_0": 5.0,
  "pm2_5": 5.0,
  "pm4_0": 5.0,
  "pm10": 5.0,
  "lightIntensity": 100.0,
  "co2Mean": 400.0,
  "co2Std": 10.0,
  "co2Max": 450.0,
  "tvocMean": 100.0,
  "tvocStd": 5.0,
  "tvocMax": 120.0,
  "temperatureMean": 22.0,
  "temperatureStd": 0.5,
  "temperatureMax": 23.0,
  "humidityMean": 40.0,
  "humidityStd": 2.0,
  "humidityMax": 45.0,
  "pm2_5Mean": 5.0,
  "pm2_5Std": 1.0,
  "pm2_5Max": 6.0
}'

send_payload() {
  local payload=$1
  local alert_name=$2
  
  echo "--------------------------------------------------------"
  echo "🚀 Firing Test: $alert_name"
  curl -s -X POST "$BACKEND_URL" \
       -H "Content-Type: application/json" \
       -d "$payload" > /dev/null
  echo "✅ Payload sent! Check your dashboard."
  echo "Sleeping 2s..."
  sleep 2
}

echo "SSNS Static Engine Automated Tester"
echo "Targeting: $BACKEND_URL"
echo ""

# 1. High CO2 Alert (> 1500)
# We set mean > 1500 and std >= 60 to simulate a sustained hazard (bypasses transient heuristic AND occupancy event)
BASE_JSON=$(echo "$BASE_JSON_TEMPLATE" | sed "s/__SEQ__/$RANDOM/")
CO2_PAYLOAD=$(echo "$BASE_JSON" | sed 's/"co2": 400.0/"co2": 2000.0/' | sed 's/"co2Mean": 400.0/"co2Mean": 1900.0/' | sed 's/"co2Std": 10.0/"co2Std": 60.0/')
send_payload "$CO2_PAYLOAD" "High CO2 Alert (2000 ppm)"

# 2. High PM2.5 Alert (> 35)
BASE_JSON=$(echo "$BASE_JSON_TEMPLATE" | sed "s/__SEQ__/$RANDOM/")
PM25_PAYLOAD=$(echo "$BASE_JSON" | sed 's/"pm2_5": 5.0/"pm2_5": 60.0/' | sed 's/"pm2_5Mean": 5.0/"pm2_5Mean": 55.0/')
send_payload "$PM25_PAYLOAD" "High PM2.5 Alert (60 ug/m3)"

# 3. High TVOC Alert (> 1000)
BASE_JSON=$(echo "$BASE_JSON_TEMPLATE" | sed "s/__SEQ__/$RANDOM/")
TVOC_PAYLOAD=$(echo "$BASE_JSON" | sed 's/"tvoc": 100.0/"tvoc": 1500.0/' | sed 's/"tvocMean": 100.0/"tvocMean": 1400.0/')
send_payload "$TVOC_PAYLOAD" "High TVOC Alert (1500 ppb)"

# 4. Temperature Alert (<10 or >35)
BASE_JSON=$(echo "$BASE_JSON_TEMPLATE" | sed "s/__SEQ__/$RANDOM/")
TEMP_PAYLOAD=$(echo "$BASE_JSON" | sed 's/"temperature": 22.0/"temperature": 40.0/' | sed 's/"temperatureMean": 22.0/"temperatureMean": 39.0/')
send_payload "$TEMP_PAYLOAD" "Thermal Safety Alert (40 C)"

# 5. Humidity Alert (<20 or >60)
BASE_JSON=$(echo "$BASE_JSON_TEMPLATE" | sed "s/__SEQ__/$RANDOM/")
HUM_PAYLOAD=$(echo "$BASE_JSON" | sed 's/"humidity": 40.0/"humidity": 80.0/' | sed 's/"humidityMean": 40.0/"humidityMean": 79.0/')
send_payload "$HUM_PAYLOAD" "Humidity Safety Alert (80 %RH)"

echo "--------------------------------------------------------"
echo "🎉 All tests fired! You should see 5 distinct static alerts on the dashboard."
