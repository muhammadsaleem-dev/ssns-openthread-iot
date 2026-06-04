.PHONY: start stop restart logs logs-radio status shell clean

# Start the complete Fog Node (OTBR + Gateway + Redis)
start:
	sudo docker compose -f docker-compose.fog.yml up -d --build --remove-orphans
	@echo "✓ Windows Fog Node (Native) services are booting..."

# Stop the Fog Node
stop:
	sudo docker compose -f docker-compose.fog.yml down --remove-orphans

# Restart with a full rebuild (use after code changes)
restart:
	sudo docker compose -f docker-compose.fog.yml down --remove-orphans
	sudo docker compose -f docker-compose.fog.yml up -d --build --remove-orphans
	@echo "✓ Restarted. Use 'make logs-radio' to watch supervisor cycles."

# View logs for the Gateway
logs:
	sudo docker logs -f ssns-gateway-windows

# View logs for the Radio (shows supervisor cycles)
logs-radio:
	sudo docker logs -f ssns-otbr-windows

# Quick health check — shows supervisor cycle, Thread state, and last 5 log lines
status:
	@echo "── OTBR Supervisor Status ──────────────────────────"
	@sudo docker exec ssns-otbr-windows sh -c \
		'echo "Thread State: $$(ot-ctl state 2>/dev/null || echo NOT_RUNNING)"; \
		 echo "wpan0 exists:  $$(ip link show wpan0 >/dev/null 2>&1 && echo YES || echo NO)"; \
		 echo "Device file:   $$(ls -la /dev/ttyACM0 2>/dev/null || echo MISSING)"' 2>/dev/null || \
		echo "Container is not running."
	@echo "────────────────────────────────────────────────────"
	@echo "Recent logs:"
	@sudo docker logs --tail 8 ssns-otbr-windows 2>/dev/null || true

# Shell into the OTBR container for debugging
shell:
	sudo docker exec -it ssns-otbr-windows bash

# Clean up Docker resources
clean:
	sudo docker compose -f docker-compose.fog.yml down -v --remove-orphans
