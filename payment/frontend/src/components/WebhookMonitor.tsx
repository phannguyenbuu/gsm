'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface WebhookEvent {
  id: string;
  event_type: string;
  resource_id: string;
  timestamp: string;
  status: 'success' | 'error' | 'pending';
  details?: any;
}

interface PaymentWithWebhook {
  _id: string;
  orderId: string;
  paypalOrderId: string;
  amount: number;
  currency: string;
  status: string;
  webhookProcessed: boolean;
  webhookProcessedAt?: string;
  webhookEventType?: string;
  webhookRetryCount: number;
  webhookError?: string;
  createdAt: string;
  updatedAt: string;
}

const WebhookMonitor: React.FC = () => {
  const [payments, setPayments] = useState<PaymentWithWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5512/api';

  useEffect(() => {
    fetchPayments();
  }, [selectedStatus]);

  // Thêm auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing webhook monitor...');
      fetchPayments();
      setLastUpdate(new Date());
    }, 12000); // Refresh every 12 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, selectedStatus]);

  // Thêm real-time updates cho pending webhooks
  useEffect(() => {
    if (!autoRefresh) return;

    const pendingWebhooks = payments.filter(p => 
      !p.webhookProcessed && !p.webhookError
    );

    if (pendingWebhooks.length === 0) return;

    const interval = setInterval(() => {
      console.log('🔍 Checking for webhook updates...');
      fetchPayments();
    }, 6000); // Check every 6 seconds for pending webhooks

    return () => clearInterval(interval);
  }, [autoRefresh, payments]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/paypalsapi/payments?limit=100&skip=0`;
      
      if (selectedStatus) {
        url += `&status=${selectedStatus}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setPayments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'APPROVED':
        return 'bg-blue-100 text-blue-800';
      case 'CREATED':
        return 'bg-yellow-100 text-yellow-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'REFUNDED':
        return 'bg-purple-100 text-purple-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
      case 'PENDING':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getWebhookStatusColor = (processed: boolean, error?: string) => {
    if (error) return 'bg-red-100 text-red-800';
    if (processed) return 'bg-green-100 text-green-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const retryWebhook = async (paypalOrderId: string) => {
    try {
      const response = await fetch(`${API_BASE}/paypalsapi/test-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paypalOrderId })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Webhook retry result:', result);
      alert('Webhook retry initiated! Check console for details.');
      
      // Refresh payments list
      fetchPayments();
    } catch (err: any) {
      console.error('Error retrying webhook:', err);
      setError('Failed to retry webhook');
    }
  };

  const webhookStats = {
    total: payments.length,
    processed: payments.filter(p => p.webhookProcessed).length,
    failed: payments.filter(p => p.webhookError).length,
    pending: payments.filter(p => !p.webhookProcessed && !p.webhookError).length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
                  <span className="text-purple-600 text-2xl">🔗</span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Webhook Monitor</h1>
                  <p className="text-purple-100">Real-time webhook processing status</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white text-sm">Last updated</div>
                <div className="text-white font-semibold">{new Date().toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Payments</p>
                <p className="text-2xl font-bold text-gray-900">{webhookStats.total}</p>
              </div>
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 text-sm font-bold">📊</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Webhook Processed</p>
                <p className="text-2xl font-bold text-green-600">{webhookStats.processed}</p>
              </div>
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-green-600 text-sm">✅</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Webhook Failed</p>
                <p className="text-2xl font-bold text-red-600">{webhookStats.failed}</p>
              </div>
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <span className="text-red-600 text-sm">❌</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Webhook Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{webhookStats.pending}</p>
              </div>
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <span className="text-yellow-600 text-sm">⏳</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Filter by Status:</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">All Status</option>
                <option value="CREATED">Created</option>
                <option value="APPROVED">Approved</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
                <option value="REFUNDED">Refunded</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Auto-refresh toggle */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Auto-refresh:</label>
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                    autoRefresh ? 'bg-purple-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoRefresh ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-xs text-gray-500">
                  {autoRefresh ? 'ON' : 'OFF'}
                </span>
              </div>

              {/* Last update indicator */}
              <div className="text-xs text-gray-500">
                Last: {lastUpdate.toLocaleTimeString()}
              </div>
              
              <button
                onClick={() => {
                  fetchPayments();
                  setLastUpdate(new Date());
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition duration-200"
              >
                Refresh Now
              </button>
            </div>
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Webhook Processing Status</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-2 text-gray-600">Loading payments...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <div className="text-red-600 mb-2">Error: {error}</div>
              <button
                onClick={() => {
                  setError('');
                  fetchPayments();
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          ) : payments.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">No payments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Webhook Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Processed At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {payment.orderId}
                        </div>
                        <div className="text-sm text-gray-500 font-mono">
                          {payment.paypalOrderId}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(payment.amount, payment.currency)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getWebhookStatusColor(payment.webhookProcessed, payment.webhookError)}`}>
                            {payment.webhookError ? 'Failed' : payment.webhookProcessed ? 'Processed' : 'Pending'}
                          </span>
                          {payment.webhookEventType && (
                            <span className="text-xs text-gray-500">
                              {payment.webhookEventType}
                            </span>
                          )}
                          {payment.webhookRetryCount > 0 && (
                            <span className="text-xs text-orange-600">
                              Retries: {payment.webhookRetryCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {payment.webhookProcessedAt ? formatDate(payment.webhookProcessedAt) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {payment.webhookError && (
                          <button
                            onClick={() => retryWebhook(payment.paypalOrderId)}
                            className="text-purple-600 hover:text-purple-900"
                          >
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebhookMonitor; 