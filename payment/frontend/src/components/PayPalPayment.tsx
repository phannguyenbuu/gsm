'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface PayPalOrderRequest {
  amount: number;
  currency: string;
  orderId: string;
  description?: string;
  items?: Array<{
    name: string;
    quantity: string;
    unit_amount: {
      currency_code: string;
      value: string;
    };
    tax: {
      currency_code: string;
      value: string;
    };
    description: string;
    sku: string;
    category: 'DIGITAL_GOODS' | 'PHYSICAL_GOODS';
  }>;
}

interface PayPalOrderResponse {
  id: string;
  status: string;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

interface PaymentStatus {
  orderId: string;
  status: string;
  paymentId?: string;
  amount: number;
  currency: string;
  paymentDate?: string;
  payerId?: string;
}

const PayPalPayment: React.FC = () => {
  const [orderRequest, setOrderRequest] = useState<PayPalOrderRequest>({
    amount: 1.00,
    currency: 'USD',
    orderId: '',
    description: 'Test payment for services',
    items: [
      {
        name: 'Test Product',
        quantity: '1',
        unit_amount: {
          currency_code: 'USD',
          value: '1.00'
        },
        tax: {
          currency_code: 'USD',
          value: '0.00'
        },
        description: 'Test product for payment',
        sku: 'TEST-001',
        category: 'DIGITAL_GOODS'
      }
    ]
  });

  const [currentOrder, setCurrentOrder] = useState<PayPalOrderResponse | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5512/api';

  // Generate random order ID if empty
  useEffect(() => {
    if (!orderRequest.orderId) {
      setOrderRequest(prev => ({
        ...prev,
        orderId: `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }));
    }
  }, []);

  const createPayPalOrder = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const paypalOrderData = {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: orderRequest.orderId,
            description: orderRequest.description,
            amount: {
              currency_code: orderRequest.currency,
              value: orderRequest.amount.toFixed(2),
              breakdown: {
                item_total: {
                  currency_code: orderRequest.currency,
                  value: orderRequest.amount.toFixed(2)
                },
                tax_total: {
                  currency_code: orderRequest.currency,
                  value: '0.00'
                }
              }
            },
            items: orderRequest.items
          }
        ],
        application_context: {
          return_url: `${window.location.origin}/paypal/success`,
          cancel_url: `${window.location.origin}/paypal/cancel`,
          brand_name: 'Your Company Name',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING'
        }
      };

      console.log('Creating PayPal order with data:', paypalOrderData);

      const response = await fetch(`${API_BASE}/paypalsapi/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paypalOrderData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('PayPal API Error:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('PayPal order created successfully:', result);
      
      setCurrentOrder(result);
      setSuccess(`PayPal order created successfully! Order ID: ${result.id}`);
      
      // Redirect to PayPal for payment
      const approveLink = result.links.find((link: any) => link.rel === 'approve');
      if (approveLink) {
        console.log('Redirecting to PayPal:', approveLink.href);
        window.location.href = approveLink.href;
      }
    } catch (err: any) {
      console.error('Error creating PayPal order:', err);
      setError(err.message || 'Failed to create PayPal order');
    } finally {
      setLoading(false);
    }
  };

  const capturePayment = async (orderId: string) => {
    setIsProcessing(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/paypalsapi/order/${orderId}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      setPaymentStatus({
        orderId: orderRequest.orderId,
        status: result.status,
        paymentId: result.id,
        amount: orderRequest.amount,
        currency: orderRequest.currency,
        paymentDate: new Date().toISOString(),
        payerId: result.payer?.payer_id
      });

      setSuccess('Payment captured successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to capture payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const checkOrderStatus = async (orderId: string) => {
    try {
      const response = await fetch(`${API_BASE}/paypalsapi/order/${orderId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (err: any) {
      console.error('Error checking order status:', err);
      return null;
    }
  };

  const checkDatabaseOrders = async () => {
    try {
      const response = await fetch(`${API_BASE}/paypalsapi/debug/orders`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Database orders:', result);
      alert(`Found ${result.total} orders in database. Check console for details.`);
      return result;
    } catch (err: any) {
      console.error('Error checking database orders:', err);
      setError('Failed to check database orders');
      return null;
    }
  };

  const testWebhook = async () => {
    try {
      const response = await fetch(`${API_BASE}/paypalsapi/test-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Webhook test result:', result);
      setSuccess('Webhook test completed successfully! Check console for details.');
      return result;
    } catch (err: any) {
      console.error('Error testing webhook:', err);
      setError('Failed to test webhook');
      return null;
    }
  };

  const handleAmountChange = (value: string) => {
    const amount = parseFloat(value) || 0;
    setOrderRequest(prev => ({
      ...prev,
      amount,
      items: [
        {
          name: 'Test Product',
          quantity: '1',
          unit_amount: {
            currency_code: prev.currency,
            value: amount.toFixed(2)
          },
          tax: {
            currency_code: prev.currency,
            value: '0.00'
          },
          description: 'Test product for payment',
          sku: 'TEST-001',
          category: 'DIGITAL_GOODS'
        }
      ]
    }));
  };

  const handleCurrencyChange = (currency: string) => {
    setOrderRequest(prev => ({
      ...prev,
      currency,
      items: [
        {
          name: 'Test Product',
          quantity: '1',
          unit_amount: {
            currency_code: currency,
            value: prev.amount.toFixed(2)
          },
          tax: {
            currency_code: currency,
            value: '0.00'
          },
          description: 'Test product for payment',
          sku: 'TEST-001',
          category: 'DIGITAL_GOODS'
        }
      ]
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
                  <Image
                    src="/paypal-logo.png"
                    alt="PayPal"
                    width={32}
                    height={32}
                    className="object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">PayPal Payment</h1>
                  <p className="text-blue-100">Secure and fast payment processing</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white text-sm">Powered by</div>
                <div className="text-white font-semibold">PayPal API</div>
              </div>
            </div>
          </div>

          <div className="p-8">
            {/* Payment Form */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - Payment Details */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">Payment Details</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Order ID
                      </label>
                      <input
                        type="text"
                        value={orderRequest.orderId}
                        onChange={(e) => setOrderRequest(prev => ({ ...prev, orderId: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter order ID"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="number"
                          value={orderRequest.amount}
                          onChange={(e) => handleAmountChange(e.target.value)}
                          step="0.01"
                          min="0.01"
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="0.00"
                        />
                        <select
                          value={orderRequest.currency}
                          onChange={(e) => handleCurrencyChange(e.target.value)}
                          className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                          <option value="JPY">JPY</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <textarea
                        value={orderRequest.description}
                        onChange={(e) => setOrderRequest(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Payment description"
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={createPayPalOrder}
                    disabled={loading || !orderRequest.orderId || orderRequest.amount <= 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Creating Order...</span>
                      </>
                    ) : (
                      <>
                        <Image
                          src="/paypal-logo.png"
                          alt="PayPal"
                          width={20}
                          height={20}
                          className="object-contain"
                        />
                        <span>Pay with PayPal</span>
                      </>
                    )}
                  </button>

                  {currentOrder && (
                    <button
                      onClick={() => capturePayment(currentOrder.id)}
                      disabled={isProcessing}
                      className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                    >
                      {isProcessing ? 'Capturing Payment...' : 'Capture Payment'}
                    </button>
                  )}
                </div>

                {/* Status Messages */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">!</span>
                      </div>
                      <span className="text-red-700 font-medium">{error}</span>
                    </div>
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                      <span className="text-green-700 font-medium">{success}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Order Summary & Status */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">Order Summary</h2>
                  <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Order ID:</span>
                      <span className="font-mono text-sm bg-gray-200 px-2 py-1 rounded">
                        {orderRequest.orderId}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-semibold text-lg">
                        {orderRequest.amount.toFixed(2)} {orderRequest.currency}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Description:</span>
                      <span className="text-sm text-gray-800 max-w-xs truncate">
                        {orderRequest.description}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Current Order Status */}
                {currentOrder && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Order Status</h2>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">PayPal Order ID:</span>
                        <span className="font-mono text-sm bg-blue-200 px-2 py-1 rounded">
                          {currentOrder.id}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Status:</span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          currentOrder.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                          currentOrder.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {currentOrder.status}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Status */}
                {paymentStatus && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Payment Status</h2>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Payment ID:</span>
                        <span className="font-mono text-sm bg-green-200 px-2 py-1 rounded">
                          {paymentStatus.paymentId}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Status:</span>
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                          {paymentStatus.status}
                        </span>
                      </div>
                      {paymentStatus.payerId && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Payer ID:</span>
                          <span className="font-mono text-sm bg-green-200 px-2 py-1 rounded">
                            {paymentStatus.payerId}
                          </span>
                        </div>
                      )}
                      {paymentStatus.paymentDate && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Payment Date:</span>
                          <span className="text-sm">
                            {new Date(paymentStatus.paymentDate).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayPalPayment; 