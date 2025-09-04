import { PrismaClient } from '@prisma/client';
import { hashString, generateSecureId } from '@openpayflow/common';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo merchant
  const demoApiKey = 'demo_key_' + generateSecureId(16);
  const demoApiKeyHash = hashString(demoApiKey);

  const merchant = await prisma.merchant.upsert({
    where: { apiKeyHash: demoApiKeyHash },
    update: {},
    create: {
      name: 'Demo Merchant',
      apiKeyHash: demoApiKeyHash,
    },
  });

  console.log('✅ Created demo merchant:', {
    id: merchant.id,
    name: merchant.name,
    apiKey: demoApiKey, // Only show in seed script
  });

  // Create demo webhook endpoint
  const webhookEndpoint = await prisma.webhookEndpoint.create({
    data: {
      merchantId: merchant.id,
      url: 'http://localhost:3000/api/webhooks',
      secret: 'webhook_secret_' + generateSecureId(16),
      events: [
        'payment.created',
        'payment.succeeded',
        'payment.failed',
        'refund.created',
        'refund.succeeded',
        'refund.failed',
      ],
      isActive: true,
    },
  });

  console.log('✅ Created demo webhook endpoint:', {
    id: webhookEndpoint.id,
    url: webhookEndpoint.url,
    events: webhookEndpoint.events,
  });

  // Create some sample payments
  const samplePayments = [
    {
      amount: 2000, // $20.00
      currency: 'USD',
      gateway: 'MOCK',
      status: 'SUCCEEDED',
      metadata: { orderId: 'order_001', customerId: 'cust_001' },
    },
    {
      amount: 1500, // $15.00
      currency: 'USD',
      gateway: 'MOCK',
      status: 'PROCESSING',
      metadata: { orderId: 'order_002', customerId: 'cust_002' },
    },
    {
      amount: 5000, // $50.00
      currency: 'USD',
      gateway: 'MOCK',
      status: 'FAILED',
      metadata: { orderId: 'order_003', customerId: 'cust_001' },
    },
  ];

  for (const [index, paymentData] of samplePayments.entries()) {
    const payment = await prisma.payment.create({
      data: {
        merchantId: merchant.id,
        amount: paymentData.amount,
        currency: paymentData.currency,
        status: paymentData.status as any,
        gateway: paymentData.gateway as any,
        providerPaymentId: `mock_pi_${generateSecureId(16)}`,
        idempotencyKey: `seed_${index}_${generateSecureId(8)}`,
        metadata: paymentData.metadata,
      },
    });

    // Create payment attempt
    await prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        attemptNo: 1,
        status: paymentData.status === 'SUCCEEDED' ? 'SUCCEEDED' : 
                paymentData.status === 'FAILED' ? 'FAILED' : 'PROCESSING',
        providerResponse: {
          mockResponse: true,
          status: paymentData.status.toLowerCase(),
        },
      },
    });

    console.log(`✅ Created sample payment ${index + 1}:`, {
      id: payment.id,
      amount: payment.amount,
      status: payment.status,
    });
  }

  // Create some sample events
  const sampleEvents = [
    {
      type: 'payment.created',
      payload: { paymentId: 'sample_payment_1', amount: 2000 },
    },
    {
      type: 'payment.succeeded',
      payload: { paymentId: 'sample_payment_1', amount: 2000 },
    },
    {
      type: 'webhook.delivery_failed',
      payload: { endpointId: webhookEndpoint.id, attempts: 3 },
    },
  ];

  for (const [index, eventData] of sampleEvents.entries()) {
    const event = await prisma.event.create({
      data: {
        type: eventData.type,
        payload: eventData.payload,
      },
    });

    console.log(`✅ Created sample event ${index + 1}:`, {
      id: event.id,
      type: event.type,
    });
  }

  console.log('\n🎉 Database seeding completed!');
  console.log('\n📝 Demo credentials:');
  console.log(`   Merchant API Key: ${demoApiKey}`);
  console.log(`   Webhook Secret: ${webhookEndpoint.secret}`);
  console.log('\n🔗 Try creating a payment:');
  console.log(`   curl -X POST http://localhost:4000/v1/payments \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -H "Idempotency-Key: test_$(date +%s)" \\`);
  console.log(`     -d '{`);
  console.log(`       "amount": 1999,`);
  console.log(`       "currency": "USD",`);
  console.log(`       "gateway": "mock",`);
  console.log(`       "merchantApiKey": "${demoApiKey}",`);
  console.log(`       "metadata": {"orderId": "test_order_001"}`);
  console.log(`     }'`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
