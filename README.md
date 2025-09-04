# OpenPayFlow

**Developer-friendly, open-source payment orchestration sandbox that runs 100% locally**

OpenPayFlow is a comprehensive payment processing sandbox that demonstrates Stripe-style reliability patterns and best practices. It runs entirely on your local machine using Docker Compose, with no paid services required.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Dashboard     │    │      API        │    │     Worker      │
│   (Next.js)     │◄──►│   (Fastify)     │◄──►│  (Background)   │
│                 │    │                 │    │                 │
│ • Payments UI   │    │ • REST + GraphQL│    │ • Queue Proc.   │
│ • Webhooks CRUD │    │ • Swagger Docs  │    │ • Retries       │
│ • Health Monitor│    │ • Validation    │    │ • Outbox Drain  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
    │   PostgreSQL    │    │     Redis       │    │   Monitoring    │
    │                 │    │                 │    │                 │
    │ • Payments      │    │ • Queues        │    │ • OpenTelemetry │
    │ • Webhooks      │    │ • Rate Limiting │    │ • Prometheus    │
    │ • Outbox        │    │ • Idempotency   │    │ • Grafana       │
    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+**
- **pnpm 8+**
- **Docker & Docker Compose**

### One-Command Setup

```bash
# Clone and setup
git clone <repository-url>
cd openpayflow
make setup

# Start all services
make up
```

### Services Available

- **API Server**: http://localhost:4000
- **API Documentation**: http://localhost:4000/docs
- **GraphQL Playground**: http://localhost:4000/graphql
- **Dashboard**: http://localhost:3000
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090

## 🎯 Features

### ✅ Payment Processing
- **Multiple Gateways**: Stripe (test), Razorpay (test), Mock Gateway
- **Idempotency Keys**: Exactly-once payment processing
- **Status Tracking**: Real-time payment status updates
- **Metadata Support**: Custom payment metadata

### ✅ Reliability Patterns
- **Outbox Pattern**: Reliable event publishing
- **Exponential Backoff**: Smart retry mechanisms with jitter
- **Dead Letter Queues**: Failed message handling
- **Circuit Breakers**: Gateway fault tolerance

### ✅ Webhook System
- **Endpoint Management**: CRUD operations for webhook endpoints
- **Reliable Delivery**: Guaranteed webhook delivery with retries
- **Signature Verification**: Secure webhook payload verification
- **Delivery Tracking**: Monitor webhook delivery status

### ✅ Observability
- **OpenTelemetry**: Distributed tracing
- **Prometheus Metrics**: System and business metrics
- **Grafana Dashboards**: Pre-built monitoring dashboards
- **Structured Logging**: JSON-structured logs with correlation IDs

### ✅ Developer Experience
- **OpenAPI/Swagger**: Interactive API documentation
- **GraphQL**: Flexible query interface
- **TypeScript**: Full type safety across the stack
- **Hot Reloading**: Fast development iteration

## 🏛️ Core Domain Models

### Payment Flow
```typescript
Payment {
  id: string
  merchantId: string
  amount: number (in cents)
  currency: string
  status: 'pending' | 'processing' | 'succeeded' | 'failed'
  gateway: 'stripe' | 'razorpay' | 'mock'
  idempotencyKey: string
  metadata?: Record<string, any>
}
```

### Webhook Delivery
```typescript
WebhookDelivery {
  id: string
  endpointId: string
  eventId: string
  status: 'pending' | 'delivered' | 'failed' | 'abandoned'
  attemptCount: number
  nextRetryAt?: Date
}
```

## 🔧 API Examples

### Create Payment
```bash
curl -X POST http://localhost:4000/v1/payments \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: payment_123" \
  -d '{
    "amount": 2000,
    "currency": "USD",
    "gateway": "mock",
    "merchantApiKey": "demo",
    "metadata": {
      "orderId": "order_456"
    }
  }'
```

### Register Webhook Endpoint
```bash
curl -X POST http://localhost:4000/v1/webhook-endpoints \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks",
    "secret": "your_webhook_secret",
    "events": ["payment.succeeded", "payment.failed"],
    "merchantApiKey": "demo"
  }'
```

### GraphQL Query
```graphql
query {
  hello
}
```

## 🛠️ Development Commands

```bash
# Development
make dev              # Start in development mode
make logs             # View all service logs
make logs-api         # View API logs only

# Database
make migrate          # Run database migrations  
make seed             # Seed with sample data
make reset-db         # Reset database (⚠️  destructive)

# Testing
make test             # Run all tests
make test-unit        # Unit tests only
make test-e2e         # End-to-end tests
make loadtest         # Load testing with k6

# Utilities
make lint             # Run linter
make typecheck        # TypeScript checking
make health           # Check service health
make clean            # Clean up everything
```

## 🧪 Gateway Configuration

### Mock Gateway (Default)
- **Purpose**: Testing and development
- **Features**: Configurable success rates, latency simulation, chaos engineering
- **Configuration**: See `.env` file

### Stripe Test Mode
```bash
# In .env file
ENABLE_STRIPE=true
STRIPE_SECRET_KEY=sk_test_your_stripe_test_key_here
```

### Razorpay Test Mode
```bash
# In .env file  
ENABLE_RAZORPAY=true
RAZORPAY_KEY_ID=rzp_test_your_key_id_here
RAZORPAY_KEY_SECRET=your_key_secret_here
```

## 📊 Monitoring & Observability

### Grafana Dashboards
- **Payment Metrics**: Success rates, latency percentiles, error rates
- **System Health**: CPU, memory, database connections
- **Queue Metrics**: Queue depth, processing rates, retry counts
- **Webhook Delivery**: Success rates, retry patterns, endpoint health

### Key Metrics
- `payments_total`: Total payments processed
- `payments_duration_seconds`: Payment processing latency
- `webhook_deliveries_total`: Webhook delivery attempts
- `queue_depth`: Current queue sizes
- `gateway_requests_total`: Gateway API calls

## 🔒 Security Features

- **API Key Authentication**: Secure merchant API key validation
- **HMAC Webhook Signatures**: Cryptographic webhook verification
- **Rate Limiting**: Configurable request rate limits
- **Input Validation**: Zod-based request validation
- **SQL Injection Protection**: Prisma ORM with prepared statements

## 🏗️ Technology Stack

### Backend
- **Runtime**: Node.js 18+ with TypeScript
- **API Framework**: Fastify with OpenAPI/Swagger
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queues**: Redis with ioredis
- **Validation**: Zod schemas

### Frontend  
- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query
- **Charts**: Recharts

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Monitoring**: OpenTelemetry → Prometheus → Grafana
- **Package Management**: pnpm workspaces

### Testing
- **Unit Tests**: Jest with ts-jest
- **Integration Tests**: Docker-based test environment
- **E2E Tests**: Playwright
- **Load Testing**: k6

## 🎯 Why OpenPayFlow?

### Stripe-Style Reliability
- **Idempotency**: Prevent duplicate payments
- **Retry Logic**: Exponential backoff with jitter
- **Outbox Pattern**: Reliable event processing
- **Webhook Guarantees**: At-least-once delivery

### Production-Ready Patterns
- **Observability**: Full tracing and metrics
- **Error Handling**: Comprehensive error responses
- **Graceful Degradation**: Circuit breaker patterns
- **Data Consistency**: ACID transactions

### Developer Experience
- **Type Safety**: End-to-end TypeScript
- **API Documentation**: Interactive Swagger UI
- **Hot Reloading**: Fast development cycles
- **Comprehensive Testing**: Unit, integration, E2E, load tests

## 📈 Roadmap

- [ ] Advanced retry policies (linear, polynomial backoff)
- [ ] Payment method tokenization
- [ ] Multi-tenant support
- [ ] Advanced fraud detection simulation
- [ ] Performance benchmarking suite
- [ ] Kubernetes deployment manifests

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by Stripe's approach to payment reliability
- Built with modern open-source technologies
- Designed for educational and development purposes

---

**Note**: This is a sandbox environment for development and testing. Do not use with real payment credentials or process real money.
