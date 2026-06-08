-include .env.deploy

.PHONY: start stop start-platform stop-platform start-fog stop-fog logs logs-fog bridge start-bridge logs-bridge stop-bridge# Start everything on the Mac (Platform + Fog Node)
start: start-platform start-fog-mac
	@echo "=================================================="
	@echo "✅ All services and Fog Node are now running in the background!"
	@echo "=================================================="

# Stop everything on the Mac
stop: stop-fog-mac stop-platform
	@echo "=================================================="
	@echo "🛑 All services and Fog Node have been stopped."
	@echo "=================================================="

# Build and start all services (Platform)
start-platform:
	@echo "🚀 Starting Full Platform Orchestration..."
	@cd platform && docker compose -f docker-compose.ha.yml build --no-cache && docker compose -f docker-compose.ha.yml up -d --remove-orphans

# Stop all services
stop-platform:
	@echo "🛑 Stopping Full Platform..."
	@cd platform && docker compose -f docker-compose.ha.yml down --remove-orphans

# Restart only the Dashboard (useful when UI code changes)
restart-dashboard:
	@echo "🔄 Rebuilding and restarting React Dashboard..."
	@cd platform && docker compose -f docker-compose.ha.yml build --no-cache dashboard && docker compose -f docker-compose.ha.yml up -d --no-deps dashboard

# Restart only the Java Backend APIs (useful when Java code changes)
restart-api:
	@echo "🔄 Rebuilding and restarting Java Backend APIs..."
	@cd platform && docker compose -f docker-compose.ha.yml build --no-cache api-1 api-2 && docker compose -f docker-compose.ha.yml up -d --no-deps api-1 api-2

# Restart only the ML Service (useful when Python code changes)
restart-ml:
	@echo "🔄 Rebuilding and restarting ML Service..."
	@cd platform && docker compose -f docker-compose.ha.yml build --no-cache ml-service && docker compose -f docker-compose.ha.yml up -d --no-deps ml-service

# Start just the local Mac Fog Node (OTBR, Gateway, Redis)
start-fog-mac: bridge
	cd edge-nodes/mac-fog-node && docker-compose -f docker-compose.fog.yml build --no-cache && docker-compose -f docker-compose.fog.yml up -d --remove-orphans

# Stop just the local Mac Fog Node
stop-fog-mac:
	cd edge-nodes/mac-fog-node && docker-compose -f docker-compose.fog.yml down --remove-orphans

# Start just the local Native Linux Fog Node (OTBR, Gateway, Redis)
start-fog-linux:
	cd edge-nodes/linux-fog-node && docker-compose -f docker-compose.fog.yml build --no-cache && docker-compose -f docker-compose.fog.yml up -d --remove-orphans

# Stop just the local Native Linux Fog Node
stop-fog-linux:
	cd edge-nodes/linux-fog-node && docker-compose -f docker-compose.fog.yml down --remove-orphans


# View logs for the Mac Fog Gateway
logs:
	docker logs -f ssns-gateway-mac-fog

# Start the Mac Serial Bridge (Required for local nRF52840 radio)
bridge: start-bridge

start-bridge:
	@echo "🌁 Opening Mac Serial Bridge in a new terminal window..."
	@chmod +x edge-nodes/mac-fog-node/start_otbr_bridge.sh
	@osascript -e 'tell app "Terminal" to do script "cd $(CURDIR) && ./edge-nodes/mac-fog-node/start_otbr_bridge.sh"'
	@echo "✓ Bridge terminal opened."

# View logs for the Mac Serial Bridge
logs-bridge:
	@tail -f bridge.log

# Stop the Mac Serial Bridge
stop-bridge:
	@echo "🛑 Stopping Mac Serial Bridge..."
	@pkill -f start_otbr_bridge.sh || true
	@pkill -f "socat tcp-listen:2000" || true
	@rm -f bridge.log
	@echo "✓ Bridge stopped."

# View logs for the Mac OTBR (Radio Driver)
logs-fog-mac:
	docker logs -f ssns-otbr-mac

# View logs for the Linux OTBR (Radio Driver)
logs-fog-linux:
	docker logs -f ssns-otbr-linux

# Build the Sensor Node firmware (Requires nRF Connect SDK v2.9.2)
build-sensor:
	@echo "🔨 Building Sensor Node firmware..."
	@export PATH="/opt/nordic/ncs/toolchains/b8efef2ad5/bin:$$PATH" && \
	 export ZEPHYR_BASE=/opt/nordic/ncs/v2.9.2/zephyr && \
	 cd firmware/sensor-node && \
	 west build -p always -b nrf52840dk/nrf52840

# Flash the Sensor Node firmware to the physical board
flash-sensor:
	@echo "⚡ Flashing Sensor Node to board..."
	@./scripts/flash_sensor.sh

# Deploy the platform code to the Cloud VPS and restart it
deploy-cloud:
	@if [ -z "$(VPS_IP)" ]; then echo "❌ ERROR: VPS_IP is not set. Create a .env.deploy file with VPS_IP=your_ip"; exit 1; fi
	@echo "🚀 Pushing platform code to Cloud VPS ($(VPS_IP))..."
	@rsync -avz --delete --exclude 'node_modules' --exclude '.git' --exclude 'target' --exclude 'archive' platform/ root@$(VPS_IP):/root/ssns-project/platform/
	@echo "☁️ Building and restarting updated Cloud containers..."
	@ssh root@$(VPS_IP) "cd /root/ssns-project/platform && docker compose -f docker-compose.ha.yml -f docker-compose.prod.yml up -d --build"
	@echo "✅ Cloud deployment complete!"

# Deploy to Cloud VPS from scratch (ignores Docker cache)
deploy-cloud-clean:
	@if [ -z "$(VPS_IP)" ]; then echo "❌ ERROR: VPS_IP is not set. Create a .env.deploy file with VPS_IP=your_ip"; exit 1; fi
	@echo "🚀 Pushing platform code to Cloud VPS ($(VPS_IP))..."
	@rsync -avz --delete --exclude 'node_modules' --exclude '.git' --exclude 'target' --exclude 'archive' platform/ root@$(VPS_IP):/root/ssns-project/platform/
	@echo "☁️ Rebuilding Cloud containers from scratch (NO CACHE)..."
	@ssh root@$(VPS_IP) "cd /root/ssns-project/platform && docker compose -f docker-compose.ha.yml -f docker-compose.prod.yml build --no-cache && docker compose -f docker-compose.ha.yml -f docker-compose.prod.yml up -d"
	@echo "✅ Clean Cloud deployment complete!"

# Reset the LOCAL MongoDB database ONLY (wipes local telemetry and alerts)
reset-db-local:
	@echo "=================================================="
	@echo "🏠🗑️  Wiping the LOCAL MongoDB database to start fresh..."
	@echo "=================================================="
	env -u DOCKER_HOST docker --context default exec ssns-monitoring-mongo mongosh ssns_monitoring --eval "db.dropDatabase()"
	@echo "✅ LOCAL Database completely cleared!"

# Reset the CLOUD VPS MongoDB database ONLY (wipes cloud telemetry and alerts)
reset-db-cloud:
	@if [ -z "$(VPS_IP)" ]; then echo "❌ ERROR: VPS_IP is not set. Create a .env.deploy file with VPS_IP=your_ip"; exit 1; fi
	@echo "=================================================="
	@echo "☁️🗑️  Wiping the CLOUD VPS MongoDB database..."
	@echo "=================================================="
	ssh root@$(VPS_IP) "docker exec ssns-monitoring-mongo mongosh ssns_monitoring --eval 'db.dropDatabase()'"
	@echo "✅ CLOUD Database completely cleared!"
