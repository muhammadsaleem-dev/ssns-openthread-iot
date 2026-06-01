.PHONY: start stop start-platform stop-platform start-otbr stop-otbr logs logs-otbr

# Start everything on the Mac (Platform + OTBR)
start: start-platform start-otbr
	@echo "=================================================="
	@echo "✅ All services and OTBR are now running in the background!"
	@echo "=================================================="

# Stop everything on the Mac
stop: stop-otbr stop-platform
	@echo "=================================================="
	@echo "🛑 All services and OTBR have been stopped."
	@echo "=================================================="

# Start just the platform (Gateway, Dashboard, Mongo, ML)
start-platform:
# 	cd platform && docker-compose up -d --build
	cd platform && docker-compose -f docker-compose.server.yml up -d --build

# Stop just the platform
stop-platform:
	cd platform && docker-compose -f docker-compose.server.yml down

# Start just the Mac OTBR
start-otbr:
	cd edge-nodes/mac-otbr && docker-compose -f docker-compose.otbr.yml up -d --build

# Stop just the Mac OTBR
stop-otbr:
	cd edge-nodes/mac-otbr && docker-compose -f docker-compose.otbr.yml down

# View logs for the Gateway
logs:
	docker logs -f ssns-monitoring-gateway

# View logs for the OTBR
logs-otbr:
	docker logs -f ssns-otbr
