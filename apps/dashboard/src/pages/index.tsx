import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
  return (
    <>
      <Head>
        <title>OpenPayFlow Dashboard</title>
        <meta name="description" content="Payment orchestration sandbox dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              OpenPayFlow Dashboard
            </h1>
            <p className="text-xl text-gray-600">
              Payment orchestration sandbox
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <Link href="/payments" className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Payments</h3>
              <p className="text-gray-600">View and manage payment transactions across all gateways</p>
            </Link>
            
            <div className="bg-white rounded-lg shadow-md p-6 opacity-75">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Webhooks</h3>
              <p className="text-gray-600">Configure webhook endpoints and deliveries (Coming Soon)</p>
            </div>
            
            <a 
              href="http://localhost:3001" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Analytics</h3>
              <p className="text-gray-600">Monitor system health and performance with Grafana</p>
            </a>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900">Multiple Gateways</h4>
                <p className="text-sm text-blue-700">Stripe, Razorpay, and Mock gateway support</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-900">Reliability Features</h4>
                <p className="text-sm text-green-700">Idempotency, retries, and audit logs</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="font-semibold text-purple-900">REST + GraphQL</h4>
                <p className="text-sm text-purple-700">Flexible APIs with OpenAPI docs</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-semibold text-yellow-900">Observability</h4>
                <p className="text-sm text-yellow-700">OpenTelemetry, Prometheus, Grafana</p>
              </div>
            </div>
          </div>

          <div className="text-center space-y-4">
            <div className="space-x-4">
              <a
                href="http://localhost:4000/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                API Documentation
              </a>
              <a
                href="http://localhost:4000/graphql"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-6 py-3 border border-indigo-600 text-base font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                GraphQL Playground
              </a>
            </div>
            <p className="text-sm text-gray-500">
              Make sure to start the services with <code className="bg-gray-200 px-2 py-1 rounded">make up</code> first
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
