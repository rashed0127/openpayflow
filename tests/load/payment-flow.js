import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users over 30 seconds
    { duration: '1m', target: 10 },  // Stay at 10 users for 1 minute
    { duration: '30s', target: 20 }, // Ramp up to 20 users over 30 seconds
    { duration: '1m', target: 20 },  // Stay at 20 users for 1 minute
    { duration: '30s', target: 0 },  // Ramp down to 0 users over 30 seconds
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.1'],     // Error rate must be below 10%
    errors: ['rate<0.1'],              // Custom error rate must be below 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const DEMO_API_KEY = __ENV.DEMO_API_KEY || 'demo_key_placeholder';

// Generate a unique idempotency key for each virtual user iteration
function generateIdempotencyKey() {
  return `load_test_${__VU}_${__ITER}_${Date.now()}`;
}

// Generate random payment amount between $10 and $500
function generateAmount() {
  return Math.floor(Math.random() * 49000) + 1000; // 1000-50000 cents
}

// Generate random currency
function generateCurrency() {
  const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
  return currencies[Math.floor(Math.random() * currencies.length)];
}

// Generate random gateway
function generateGateway() {
  const gateways = ['mock', 'stripe', 'razorpay'];
  // Weight towards mock gateway for load testing
  const weights = [0.7, 0.15, 0.15];
  const random = Math.random();
  
  if (random < weights[0]) return gateways[0];
  if (random < weights[0] + weights[1]) return gateways[1];
  return gateways[2];
}

export default function () {
  // Test 1: Health Check
  const healthResponse = http.get(`${BASE_URL}/v1/healthz`);
  check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 200ms': (r) => r.timings.duration < 200,
  }) || errorRate.add(1);

  // Test 2: Create Payment
  const paymentPayload = {
    amount: generateAmount(),
    currency: generateCurrency(),
    gateway: generateGateway(),
    merchantApiKey: DEMO_API_KEY,
    metadata: {
      orderId: `load_test_order_${__VU}_${__ITER}`,
      customerId: `load_test_customer_${__VU}`,
      testRun: 'k6_load_test',
    },
  };

  const paymentHeaders = {
    'Content-Type': 'application/json',
    'Idempotency-Key': generateIdempotencyKey(),
  };

  const paymentResponse = http.post(
    `${BASE_URL}/v1/payments`,
    JSON.stringify(paymentPayload),
    { headers: paymentHeaders }
  );

  const paymentSuccess = check(paymentResponse, {
    'payment creation status is 201 or 401': (r) => r.status === 201 || r.status === 401,
    'payment creation response time < 5s': (r) => r.timings.duration < 5000,
    'payment response has success field': (r) => {
      if (r.status === 401) return true; // Expected for demo key
      try {
        const body = JSON.parse(r.body);
        return 'success' in body;
      } catch {
        return false;
      }
    },
  });

  if (!paymentSuccess) {
    errorRate.add(1);
    console.log(`Payment creation failed: ${paymentResponse.status} ${paymentResponse.body}`);
  }

  // If payment was created successfully, try to retrieve it
  if (paymentResponse.status === 201) {
    try {
      const paymentBody = JSON.parse(paymentResponse.body);
      if (paymentBody.success && paymentBody.data && paymentBody.data.id) {
        const paymentId = paymentBody.data.id;
        
        // Test 3: Get Payment Details
        const getPaymentResponse = http.get(
          `${BASE_URL}/v1/payments/${paymentId}?merchantApiKey=${DEMO_API_KEY}`
        );

        check(getPaymentResponse, {
          'get payment status is 200 or 401': (r) => r.status === 200 || r.status === 401,
          'get payment response time < 1s': (r) => r.timings.duration < 1000,
        }) || errorRate.add(1);
      }
    } catch (e) {
      console.log(`Error parsing payment response: ${e}`);
      errorRate.add(1);
    }
  }

  // Test 4: List Payments
  const listPaymentsResponse = http.get(
    `${BASE_URL}/v1/payments?merchantApiKey=${DEMO_API_KEY}&limit=10`
  );

  check(listPaymentsResponse, {
    'list payments status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'list payments response time < 2s': (r) => r.timings.duration < 2000,
  }) || errorRate.add(1);

  // Test 5: API Documentation
  if (__ITER % 10 === 0) { // Only test docs every 10 iterations to reduce load
    const docsResponse = http.get(`${BASE_URL}/docs`);
    check(docsResponse, {
      'docs status is 200': (r) => r.status === 200,
      'docs response time < 1s': (r) => r.timings.duration < 1000,
    }) || errorRate.add(1);
  }

  // Test 6: GraphQL Health Check
  if (__ITER % 5 === 0) { // Only test GraphQL every 5 iterations
    const graphqlPayload = {
      query: '{ hello }',
    };

    const graphqlResponse = http.post(
      `${BASE_URL}/graphql`,
      JSON.stringify(graphqlPayload),
      { headers: { 'Content-Type': 'application/json' } }
    );

    check(graphqlResponse, {
      'graphql status is 200': (r) => r.status === 200,
      'graphql response time < 1s': (r) => r.timings.duration < 1000,
      'graphql response has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return 'data' in body && body.data.hello;
        } catch {
          return false;
        }
      },
    }) || errorRate.add(1);
  }

  // Brief pause between iterations
  sleep(1);
}

// Setup function (runs once at the beginning)
export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);
  console.log(`Using demo API key: ${DEMO_API_KEY}`);
  
  // Verify the API is accessible
  const response = http.get(`${BASE_URL}/v1/healthz`);
  if (response.status !== 200) {
    throw new Error(`API health check failed: ${response.status} ${response.body}`);
  }
  
  console.log('API health check passed, starting load test...');
  return { baseUrl: BASE_URL, apiKey: DEMO_API_KEY };
}

// Teardown function (runs once at the end)
export function teardown(data) {
  console.log('Load test completed');
  console.log(`Tested against: ${data.baseUrl}`);
}
