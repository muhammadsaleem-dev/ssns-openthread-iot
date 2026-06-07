.PHONY: start stop start-platform stop-platform start-fog stop-fog logs logs-fog bridge start-bridge logs-bridge stop-bridge

# Start everything on the Mac (Platform + Fog Node)
start: start-platform start-mac-fog
	@echo "=================================================="
	@echo "✅ All services and Fog Node are now running in the background!"
	@echo "=================================================="

# Stop everything on the Mac
stop: stop-mac-fog stop-platform
	@echo "=================================================="
	@echo "🛑 All services and Fog Node have been stopped."
	@echo "=================================================="

# Start just the platform core (API, Dashboard, Mongo, ML)
start-platform:
	cd platform && docker-compose -f docker-compose.ha.yml up -d --build --remove-orphans

# Stop just the platform core
stop-platform:
	cd platform && docker-compose -f docker-compose.ha.yml down --remove-orphans

# Start just the local Mac Fog Node (OTBR, Gateway, Redis)
start-mac-fog: bridge
	cd edge-nodes/mac-fog-node && docker-compose -f docker-compose.fog.yml up -d --build --remove-orphans

# Stop just the local Mac Fog Node
stop-mac-fog:
	cd edge-nodes/mac-fog-node && docker-compose -f docker-compose.fog.yml down --remove-orphans

# Start just the local Native Linux Fog Node (OTBR, Gateway, Redis)
start-linux-fog:
	cd edge-nodes/linux-fog-node && docker-compose -f docker-compose.fog.yml up -d --build --remove-orphans

# Stop just the local Native Linux Fog Node
stop-linux-fog:
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
logs-mac-fog:
	docker logs -f ssns-otbr-mac

# View logs for the Linux OTBR (Radio Driver)
logs-linux-fog:
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
