#!/bin/bash
# ==============================================================================
# Usage: 
# Open your terminal in this directory and run:
#   bash reset-db.sh
#
# Optional: To make it double-clickable or runnable as ./reset-db.sh, first run:
#   chmod +x reset-db.sh
# ==============================================================================

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Warning: This will delete ALL sensor data and alerts from the local MongoDB instance.${NC}"
read -p "Are you sure you want to proceed? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo -e "${RED}Aborted.${NC}"
    exit 1
fi

echo "Connecting to local MongoDB and wiping data..."

# Drop the database entirely to ensure all collections are cleared.
# The backend will automatically recreate them upon the next startup/ingestion.
mongosh openthread_monitoring --eval "db.dropDatabase()"

# Optional: also clear the ML model cache so the anomaly detector starts fresh
echo "Clearing ML Service persisted models..."
rm -f /tmp/openthread_ml_models/*.pkl

echo -e "${GREEN}Data successfully cleared!${NC}"
echo "Note: The Python ML Service and Java Backend will automatically start fresh."
