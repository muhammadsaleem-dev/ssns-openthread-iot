.PHONY: start-fog-linux stop-fog-linux restart-fog-linux logs-fog-linux logs-radio-fog-linux status-fog-linux shell-fog-linux clean-fog-linux

# Start the complete Linux Fog Node (OTBR + Gateway + Redis)
start-fog-linux:
	@chmod +x scripts/linux_startup.sh scripts/topology_monitor.sh
	sudo docker compose -f docker-compose.fog.yml up -d --build --remove-orphans
	@echo "✓ Linux Fog Node services are booting..."

# Stop the Fog Node
stop-fog-linux:
	sudo docker compose -f docker-compose.fog.yml down --remove-orphans

# Restart with a full rebuild
restart-fog-linux:
	sudo docker compose -f docker-compose.fog.yml down --remove-orphans
	@chmod +x scripts/linux_startup.sh scripts/topology_monitor.sh
	sudo docker compose -f docker-compose.fog.yml up -d --build --remove-orphans
	@echo "✓ Restarted. Use 'make logs-radio-fog-linux' to watch supervisor cycles."

# View logs for the Gateway
logs-fog-linux:
	sudo docker logs -f ssns-gateway-linux

# View logs for the Radio (shows supervisor cycles)
logs-radio-fog-linux:
	sudo docker logs -f ssns-otbr-linux

# Quick health check — shows supervisor cycle, Thread state, and device status
status-fog-linux:
	@echo "── Linux OTBR Supervisor Status ───────────────────"
	@sudo docker exec ssns-otbr-linux sh -c \
		'echo "Thread State: \$$(ot-ctl state 2>/dev/null || echo NOT_RUNNING)"; \
		 echo "wpan0 exists:  \$$(ip link show wpan0 >/dev/null 2>&1 && echo YES || echo NO)"; \
		 echo "Device file:   \$$(ls -la /dev/ttyACM0 2>/dev/null || echo MISSING)"' 2>/dev/null || \
		echo "Container is not running."
	@echo "────────────────────────────────────────────────────"
	@echo "Recent logs:"
	@sudo docker logs --tail 8 ssns-otbr-linux 2>/dev/null || true

# Shell into the OTBR container for debugging
shell-fog-linux:
	sudo docker exec -it ssns-otbr-linux bash

# Clean up Docker resources and volumes
clean-fog-linux:
	sudo docker compose -f docker-compose.fog.yml down -v --remove-orphans
