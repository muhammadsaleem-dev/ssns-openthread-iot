.PHONY: start stop logs logs-radio bridge clean

# Start the complete Fog Node (OTBR + Gateway + Redis)
start:
	docker compose -f docker-compose.fog.yml up -d --build --remove-orphans
	@echo "✓ Windows Fog Node services are booting..."

# Stop the Fog Node
stop:
	docker compose -f docker-compose.fog.yml down --remove-orphans

# View logs for the Gateway (The telemetry processor)
logs:
	docker logs -f ssns-gateway-windows

# View logs for the Radio (The OTBR driver)
logs-radio:
	docker logs -f ssns-otbr-windows

# Start the Socket-to-Serial bridge (Required for Windows physical USB)
# Note: On Windows, run this in a dedicated Terminal window.
bridge:
	@echo "🌁 Starting Windows Serial Bridge..."
	@chmod +x start_otbr_bridge_windows.sh
	./start_otbr_bridge_windows.sh

# Clean up Docker resources for this node
clean:
	docker compose -f docker-compose.fog.yml down -v --remove-orphans
