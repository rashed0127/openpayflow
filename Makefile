.PHONY: help up down logs restart clean build test lint seed migrate

# Default target
help: ## Show this help message
	@echo "OpenPayFlow Development Commands"
	@echo "================================"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

up: ## Start all services
	@echo "Starting OpenPayFlow services..."
	@cd deploy/docker && docker-compose up -d
	@echo "Services started! API: http://localhost:4000, Dashboard: http://localhost:3000, Grafana: http://localhost:3001"

down: ## Stop all services
	@echo "Stopping OpenPayFlow services..."
	@cd deploy/docker && docker-compose down

logs: ## Show logs from all services
	@cd deploy/docker && docker-compose logs -f

logs-api: ## Show API logs
	@cd deploy/docker && docker-compose logs -f api

logs-worker: ## Show worker logs
	@cd deploy/docker && docker-compose logs -f worker

logs-dashboard: ## Show dashboard logs
	@cd deploy/docker && docker-compose logs -f dashboard

restart: ## Restart all services
	@echo "Restarting OpenPayFlow services..."
	@cd deploy/docker && docker-compose restart

restart-api: ## Restart API service
	@cd deploy/docker && docker-compose restart api

restart-worker: ## Restart worker service
	@cd deploy/docker && docker-compose restart worker

restart-dashboard: ## Restart dashboard service
	@cd deploy/docker && docker-compose restart dashboard

clean: ## Clean up containers, volumes, and build artifacts
	@echo "Cleaning up..."
	@cd deploy/docker && docker-compose down -v --remove-orphans
	@docker system prune -f
	@pnpm clean

build: ## Build all services
	@echo "Building OpenPayFlow services..."
	@cd deploy/docker && docker-compose build --no-cache

build-api: ## Build API service
	@cd deploy/docker && docker-compose build --no-cache api

build-worker: ## Build worker service
	@cd deploy/docker && docker-compose build --no-cache worker

build-dashboard: ## Build dashboard service
	@cd deploy/docker && docker-compose build --no-cache dashboard

dev: ## Start development mode (with file watching)
	@echo "Starting OpenPayFlow in development mode..."
	@pnpm dev

test: ## Run all tests
	@echo "Running tests..."
	@pnpm test

test-unit: ## Run unit tests
	@echo "Running unit tests..."
	@pnpm test:unit

test-integration: ## Run integration tests
	@echo "Running integration tests..."
	@pnpm test:integration

test-e2e: ## Run end-to-end tests
	@echo "Running end-to-end tests..."
	@pnpm test:e2e

loadtest: ## Run load tests with k6
	@echo "Running load tests..."
	@cd tests/load && k6 run payment-flow.js

lint: ## Run linter
	@echo "Running linter..."
	@pnpm lint

lint-fix: ## Fix linting issues
	@echo "Fixing linting issues..."
	@pnpm lint:fix

typecheck: ## Run TypeScript type checking
	@echo "Running type checking..."
	@pnpm typecheck

migrate: ## Run database migrations
	@echo "Running database migrations..."
	@pnpm db:migrate

seed: ## Seed the database with sample data
	@echo "Seeding database..."
	@pnpm db:seed

reset-db: ## Reset database (WARNING: This will delete all data!)
	@echo "Resetting database..."
	@pnpm db:reset

install: ## Install all dependencies
	@echo "Installing dependencies..."
	@pnpm install

setup: install ## Setup the project for first-time use
	@echo "Setting up OpenPayFlow..."
	@cp .env.example .env || echo ".env already exists"
	@echo "Setup complete! Run 'make up' to start the services."

status: ## Show status of all services
	@cd deploy/docker && docker-compose ps

# Health checks
health: ## Check health of all services
	@echo "Checking service health..."
	@curl -s http://localhost:4000/v1/healthz | jq '.' || echo "API not responding"
	@curl -s http://localhost:4000/v1/readyz | jq '.' || echo "API not ready"

# Database utilities
db-shell: ## Connect to the database shell
	@cd deploy/docker && docker-compose exec postgres psql -U postgres -d openpayflow

redis-shell: ## Connect to Redis CLI
	@cd deploy/docker && docker-compose exec redis redis-cli

# Monitoring
grafana: ## Open Grafana dashboard
	@open http://localhost:3001 || echo "Open http://localhost:3001 in your browser"

prometheus: ## Open Prometheus UI
	@open http://localhost:9090 || echo "Open http://localhost:9090 in your browser"

docs: ## Open API documentation
	@open http://localhost:4000/docs || echo "Open http://localhost:4000/docs in your browser"
