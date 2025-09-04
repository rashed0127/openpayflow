import { useState, useEffect } from 'react';
import Head from 'next/head';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  gateway: string;
  providerPaymentId?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

interface PaymentListResponse {
  success: boolean;
  data: Payment[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false,
  });

  const fetchPayments = async (offset = 0) => {
    try {
      setLoading(true);
      setError(null);
      
      // Use environment variables with fallbacks
      const merchantApiKey = process.env.NEXT_PUBLIC_MERCHANT_API_KEY || 'demo_key_1e61a79fab692a92c99c91e4060c94cb';
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const url = `${apiUrl}/v1/payments?` + new URLSearchParams({
        merchantApiKey,
        limit: '50',
        offset: offset.toString(),
      });
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: PaymentListResponse = await response.json();
      
      if (data.success) {
        setPayments(data.data);
        setPagination(data.pagination);
      } else {
        throw new Error('Failed to fetch payments');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Test basic connectivity first
    console.log('Testing basic connectivity...');
    fetch('http://localhost:4000/health')
      .then(response => {
        console.log('Health check response:', response.status);
        return response.json();
      })
      .then(data => {
        console.log('Health check data:', data);
        // Now try payments
        fetchPayments();
      })
      .catch(err => {
        console.error('Health check failed:', err);
        setError('Cannot connect to API server');
        setLoading(false);
      });
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'succeeded':
        return 'text-green-600 bg-green-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      case 'processing':
        return 'text-blue-600 bg-blue-50';
      case 'requires_action':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  // Debug logging
  console.log('Render - loading:', loading, 'error:', error, 'payments:', payments.length);

  return (
    <>
      <Head>
        <title>Payments - OpenPayFlow Dashboard</title>
        <meta name="description" content="View and manage payments" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                      <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
              <p className="mt-2 text-sm text-gray-600">
                View and manage payment transactions across all gateways
              </p>
              <div className="mt-4">
                <button 
                  onClick={() => fetchPayments(0)}
                  className="bg-blue-500 text-white px-4 py-2 rounded"
                >
                  Test Fetch
                </button>
                <span className="ml-4 text-sm">
                  Loading: {loading.toString()}, Payments: {payments.length}, Error: {error || 'none'}
                </span>
              </div>
            </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Payments</dt>
                      <dd className="text-lg font-medium text-gray-900">{pagination.total}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Successful</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {payments.filter(p => p.status.toLowerCase() === 'succeeded').length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Failed</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {payments.filter(p => p.status.toLowerCase() === 'failed').length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Processing</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {payments.filter(p => p.status.toLowerCase() === 'processing').length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payments Table */}
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Payments</h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    Latest payment transactions across all gateways
                  </p>
                </div>
                <button
                  onClick={() => fetchPayments(pagination.offset)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Refresh
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-sm text-gray-500">Loading payments...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <div className="text-red-500 text-sm">
                  Error: {error}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Make sure the API server is running and accessible
                </p>
              </div>
            ) : payments.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-500">No payments found</p>
                <p className="mt-1 text-xs text-gray-400">
                  Try creating a payment using the API or seed script
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {payments.map((payment) => (
                  <li key={payment.id} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                            {payment.status}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {formatAmount(payment.amount, payment.currency)}
                            </p>
                            <span className="ml-2 text-sm text-gray-500">
                              via {payment.gateway}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">
                            {payment.id} • {formatDate(payment.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        {payment.providerPaymentId && (
                          <span className="text-xs text-gray-400 font-mono">
                            {payment.providerPaymentId}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Pagination */}
          {pagination.total > pagination.limit && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-6 rounded-lg shadow">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => fetchPayments(Math.max(0, pagination.offset - pagination.limit))}
                  disabled={pagination.offset === 0}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => fetchPayments(pagination.offset + pagination.limit)}
                  disabled={!pagination.hasMore}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{pagination.offset + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(pagination.offset + pagination.limit, pagination.total)}
                    </span>{' '}
                    of <span className="font-medium">{pagination.total}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => fetchPayments(Math.max(0, pagination.offset - pagination.limit))}
                      disabled={pagination.offset === 0}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => fetchPayments(pagination.offset + pagination.limit)}
                      disabled={!pagination.hasMore}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
