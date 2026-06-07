.PHONY: start stop logs logs-radio bridge start-bridge stop-bridge load-image clean

# Start the complete Fog Node (OTBR + Gateway + Redis)
start: bridge
	docker compose -f docker-compose.fog.yml up -d --build --remove-orphans
	@echo "✓ Fog Node services are booting..."

# Stop the Fog Node
stop: stop-bridge
	docker compose -f docker-compose.fog.yml down --remove-orphans

# View logs for the Gateway (The telemetry processor)
logs:
	docker logs -f ssns-gateway-mac-fog

# View logs for the Radio (The OTBR driver)
logs-radio:
	docker logs -f ssns-otbr

# Start the Socket-to-Serial bridge (Required for Mac physical USB)
bridge: start-bridge

start-bridge:
	@echo "🌁 Starting Mac Serial Bridge in the background..."
	@chmod +x start_otbr_bridge.sh
	@./start_otbr_bridge.sh > bridge.log 2>&1 &
	@echo "✓ Bridge started. See bridge.log for details."

# Stop the Mac Serial Bridge
stop-bridge:
	@echo "🛑 Stopping Mac Serial Bridge..."
	@pkill -f start_otbr_bridge.sh || true
	@pkill -f "socat tcp-listen:2000" || true
	@rm -f bridge.log
	@echo "✓ Bridge stopped."

# Load the pre-built Custom OTBR image (Required for guest machines)
load-image:
	@echo "🐳 Loading custom OTBR image into Docker..."
	@docker load -i ./otbr-custom.tar
	@echo "✓ Image loaded."

# Clean up Docker resources for this node
clean:
	docker compose -f docker-compose.fog.yml down -v --remove-orphans
