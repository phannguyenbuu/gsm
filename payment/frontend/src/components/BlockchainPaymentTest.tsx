'use client';

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface PaymentRequest {
    amount: number;
    orderId: string;
    network?: string;
    token?: string;
    metadata?: any;
}

interface PaymentResponse {
    success: boolean;
    data: {
        paymentId: string;
        originalAmount: number;
        amount: number;
        walletAddress: string;
        contractAddress: string;
        network: string;
        networkKey: string;
        chainId: number;
        token: string;
        tokenName: string;
        decimals: number;
        blockExplorer: string;
        walletUrls: any;
        qrCode: string;
        expiresAt: string;
        note: string;
        instructions: string[];
    };
}

interface PaymentStatus {
    success: boolean;
    data: {
        paymentId: string;
        status: string;
        originalAmount: number;
        amount: number;
        orderId: string;
        createdAt: string;
        expiresAt: string;
        txHash?: string;
        confirmations?: number;
        verifiedAt?: string;
        network: string;
        networkKey: string;
        chainId: number;
        token: string;
        tokenName: string;
        contractAddress: string;
        blockExplorer: string;
        walletUrls: any;
    };
}

interface NetworkInfo {
    name: string;
    chainId: number;
    symbol: string;
    blockExplorer: string;
    tokens: any;
    minConfirmations: number;
}

const BlockchainPaymentTest: React.FC = () => {
    const [paymentRequest, setPaymentRequest] = useState<PaymentRequest>({
        amount: 1,
        orderId: '',
        network: 'bsc-testnet',
        token: 'usdt'
    });

    // Ensure all input values are always defined
    const safePaymentRequest = {
        amount: paymentRequest.amount || 0,
        orderId: paymentRequest.orderId || '',
        network: paymentRequest.network || 'bsc-testnet',
        token: paymentRequest.token || 'usdt'
    };

    const [currentPayment, setCurrentPayment] = useState<PaymentResponse['data'] | null>(null);
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus['data'] | null>(null);
    const [networks, setNetworks] = useState<{ [key: string]: NetworkInfo }>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [success, setSuccess] = useState<string>('');
    const [txHash, setTxHash] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [account, setAccount] = useState('');
    const [provider, setProvider] = useState<any>(null);
    const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
    const [monitoringStatus, setMonitoringStatus] = useState<any>(null);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5512/api';
    const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'test-api-key-123456789';

    useEffect(() => {
        generateOrderId();
        loadNetworks();
        checkWalletConnection();
        loadMonitoringStatus();

        // Cleanup function to stop polling when component unmounts
        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
                console.log('Cleaned up polling interval on unmount');
            }
        };
    }, [pollingInterval]);

    // Listen for MetaMask events
    useEffect(() => {
        if (typeof window !== 'undefined' && window.ethereum) {
            const handleAccountsChanged = (accounts: string[]) => {
                console.log('MetaMask accounts changed:', accounts);
                if (accounts.length === 0) {
                    setIsConnected(false);
                    setAccount('');
                    setProvider(null);
                    setError('MetaMask disconnected');
                } else {
                    setIsConnected(true);
                    setAccount(accounts[0]);
                    if (window.ethereum) {
                        setProvider(new ethers.providers.Web3Provider(window.ethereum));
                    }
                    setSuccess(`MetaMask account changed: ${accounts[0].substring(0, 6)}...${accounts[0].substring(38)}`);
                }
            };

            const handleChainChanged = (chainId: string) => {
                console.log('MetaMask chain changed:', chainId);
                setSuccess(`Network changed to chain ID: ${chainId}`);
            };

            const handleTransactionConfirmed = async (txHash: string) => {
                console.log('MetaMask transaction confirmed:', txHash);
                if (currentPayment && txHash) {
                    setTxHash(txHash);
                    setSuccess(`Transaction confirmed! Hash: ${txHash}`);

                    // Auto-verify payment after MetaMask confirmation
                    setTimeout(async () => {
                        try {
                            console.log('🔄 Auto-verifying payment after MetaMask confirmation...');
                            const verifyResponse = await fetch(`${API_BASE}/blockchainapi/verify-transaction-details`, {
                                method: 'POST',
                                headers: {
                                    'X-API-Key': API_KEY,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    paymentId: currentPayment.paymentId,
                                    txHash: txHash
                                })
                            });

                            const verifyData = await verifyResponse.json();
                            if (verifyData.success && verifyData.data.isValid) {
                                setSuccess(prev => prev + `\nPayment automatically verified on blockchain!`);

                                // Refresh monitoring status
                                setTimeout(() => {
                                    loadMonitoringStatus();
                                }, 2000);
                            }
                        } catch (error) {
                            console.error('Auto-verification after MetaMask confirmation failed:', error);
                        }
                    }, 3000);
                }
            };

            if (window.ethereum) {
                window.ethereum.on('accountsChanged', handleAccountsChanged);
                window.ethereum.on('chainChanged', handleChainChanged);

                // Listen for transaction confirmations
                if (window.ethereum.on) {
                    window.ethereum.on('transactionConfirmed', handleTransactionConfirmed);
                }

                return () => {
                    if (window.ethereum) {
                        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                        window.ethereum.removeListener('chainChanged', handleChainChanged);
                        if (window.ethereum.removeListener) {
                            window.ethereum.removeListener('transactionConfirmed', handleTransactionConfirmed);
                        }
                    }
                };
            }
        }
    }, [currentPayment]);

    const generateOrderId = () => {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        setPaymentRequest(prev => ({
            ...prev,
            orderId: `ORDER_${timestamp}_${random}`
        }));
    };

    const loadNetworks = async () => {
        try {
            const response = await fetch(`${API_BASE}/blockchainapi/networks`, {
                headers: {
                    'X-API-Key': API_KEY,
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();
            if (data.success) {
                setNetworks(data.data.details);
            }
        } catch (error) {
            console.error('Failed to load networks:', error);
        }
    };

    const loadMonitoringStatus = async () => {
        try {
            const response = await fetch(`${API_BASE}/blockchainapi/monitoring/status`, {
                headers: {
                    'X-API-Key': API_KEY,
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();
            if (data.success) {
                setMonitoringStatus(data.data);
            }
        } catch (error) {
            console.error('Failed to load monitoring status:', error);
        }
    };

    const checkWalletConnection = async () => {
        if (typeof window !== 'undefined' && window.ethereum) {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    setIsConnected(true);
                    setAccount(accounts[0]);
                    setProvider(new ethers.providers.Web3Provider(window.ethereum));
                }
            } catch (error) {
                console.error('Failed to check wallet connection:', error);
            }
        }
    };

    const connectWallet = async () => {
        if (typeof window !== 'undefined' && window.ethereum) {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                if (accounts.length > 0) {
                    setIsConnected(true);
                    setAccount(accounts[0]);
                    setProvider(new ethers.providers.Web3Provider(window.ethereum));
                    setSuccess('Wallet connected successfully!');
                }
            } catch (error) {
                setError('Failed to connect wallet');
            }
        } else {
            setError('MetaMask not found. Please install MetaMask extension.');
        }
    };

    const createPayment = async () => {
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch(`${API_BASE}/blockchainapi/create`, {
                method: 'POST',
                headers: {
                    'X-API-Key': API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(safePaymentRequest)
            });

            const data: PaymentResponse = await response.json();

            if (data.success) {
                setCurrentPayment(data.data);
                setSuccess('Payment created successfully!');
                // Start polling for status
                pollPaymentStatus(data.data.paymentId);
            } else {
                setError('Failed to create payment');
            }
        } catch (error) {
            setError('Network error occurred');
        } finally {
            setLoading(false);
        }
    };

    const pollPaymentStatus = async (paymentId: string) => {
        // Clear any existing polling
        if (pollingInterval) {
            clearInterval(pollingInterval);
        }

        let pollCount = 0;
        const maxPolls = 120; // 10 minutes with 10 second intervals

        const interval = setInterval(async () => {
            try {
                pollCount++;
                console.log(`Polling payment status (${pollCount}/${maxPolls}): ${paymentId}`);

                const response = await fetch(`${API_BASE}/blockchainapi/status/${paymentId}`, {
                    headers: {
                        'X-API-Key': API_KEY
                    }
                });

                if (response.status === 429) {
                    console.log('Rate limited, slowing down polling...');
                    clearInterval(interval);
                    setPollingInterval(null);
                    // Retry with longer interval
                    setTimeout(() => pollPaymentStatus(paymentId), 30000); // 30 seconds
                    return;
                }

                const data: PaymentStatus = await response.json();

                if (data.success) {
                    setPaymentStatus(data.data);

                    if (data.data.status === 'confirmed') {
                        setSuccess('Payment confirmed successfully!');
                        clearInterval(interval);
                        setPollingInterval(null);
                        console.log('Payment confirmed, stopping polling');

                        // Refresh monitoring status to remove confirmed payment
                        setTimeout(() => {
                            loadMonitoringStatus();
                        }, 2000);

                        return; // Stop polling immediately
                    } else if (data.data.status === 'expired') {
                        setError('Payment expired');
                        clearInterval(interval);
                        setPollingInterval(null);
                        console.log('Payment expired, stopping polling');
                        return; // Stop polling immediately
                    } else if (data.data.status === 'pending_confirmation') {
                        console.log(`Payment pending confirmation: ${data.data.confirmations || 0} confirmations`);
                    }
                }
            } catch (error) {
                console.error('Failed to poll payment status:', error);
                if (pollCount >= maxPolls) {
                    clearInterval(interval);
                    setPollingInterval(null);
                    console.log('Max polls reached, stopping');
                }
            }
        }, 10000); // Poll every 10 seconds instead of 5

        // Store the interval for cleanup
        setPollingInterval(interval);

        // Stop polling after 10 minutes
        setTimeout(() => {
            clearInterval(interval);
            setPollingInterval(null);
            console.log('Polling timeout reached');
        }, 600000);
    };

    const verifyPayment = async () => {
        if (!txHash || !currentPayment) return;

        setLoading(true);
        setError('');

        try {
            // First, verify transaction details on blockchain
            const verifyResponse = await fetch(`${API_BASE}/blockchainapi/verify-transaction-details`, {
                method: 'POST',
                headers: {
                    'X-API-Key': API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    paymentId: currentPayment.paymentId,
                    txHash: txHash
                })
            });

            const verifyData = await verifyResponse.json();

            if (verifyData.success && verifyData.data.isValid) {
                setSuccess(`Transaction verified on blockchain!`);
                setSuccess(prev => prev + `\nRecipient: ${verifyData.data.recipientAddress}`);
                setSuccess(prev => prev + `\nAmount: ${verifyData.data.transferAmount} (expected: ${verifyData.data.expectedAmount})`);
                setSuccess(prev => prev + `\nBlock: ${verifyData.data.blockNumber}`);
                setSuccess(prev => prev + `\nConfirmations: ${verifyData.data.confirmations}`);

                // Payment is automatically verified if transaction details are valid
                // Stop current polling and start new one
                if (pollingInterval) {
                    clearInterval(pollingInterval);
                    setPollingInterval(null);
                }
                pollPaymentStatus(currentPayment.paymentId);
            } else {
                setError(verifyData.data?.error || 'Transaction verification failed');
            }
        } catch (error) {
            setError('Network error occurred');
        } finally {
            setLoading(false);
        }
    };

    const sendTestPayment = async () => {
        if (!provider || !currentPayment) return;

        setLoading(true);
        setError('');

        try {
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(
                currentPayment.contractAddress,
                [
                    'function transfer(address to, uint256 amount) returns (bool)',
                    'function balanceOf(address owner) view returns (uint256)',
                    'function decimals() view returns (uint8)'
                ],
                signer
            );

            // Check balance first
            const balance = await contract.balanceOf(account);
            const decimals = await contract.decimals();
            const requiredAmount = ethers.utils.parseUnits(currentPayment.amount.toString(), decimals);

            if (balance < requiredAmount) {
                setError(`Insufficient balance. Required: ${currentPayment.amount} ${currentPayment.token}, Available: ${ethers.utils.formatUnits(balance, decimals)} ${currentPayment.token}`);
                setLoading(false);
                return;
            }

            // Send transaction
            const tx = await contract.transfer(currentPayment.walletAddress, requiredAmount);
            setSuccess(`Transaction sent! Hash: ${tx.hash}`);
            setTxHash(tx.hash);

            // Wait for confirmation
            const receipt = await tx.wait();
            const confirmedHash = receipt.hash || tx.hash;
            setSuccess(`Transaction confirmed! Hash: ${confirmedHash}`);
            setTxHash(confirmedHash);

            // Auto-verify payment immediately after confirmation
            console.log('🔄 Auto-verifying payment after transaction confirmation...');
            try {
                const verifyResponse = await fetch(`${API_BASE}/blockchainapi/verify-transaction-details`, {
                    method: 'POST',
                    headers: {
                        'X-API-Key': API_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        paymentId: currentPayment.paymentId,
                        txHash: confirmedHash
                    })
                });

                const verifyData = await verifyResponse.json();
                if (verifyData.success && verifyData.data.isValid) {
                    setSuccess(prev => prev + `\nPayment automatically verified on blockchain!`);
                    setSuccess(prev => prev + `\nRecipient: ${verifyData.data.recipientAddress}`);
                    setSuccess(prev => prev + `\nAmount: ${verifyData.data.transferAmount} (expected: ${verifyData.data.expectedAmount})`);
                    setSuccess(prev => prev + `\nBlock: ${verifyData.data.blockNumber}`);
                    setSuccess(prev => prev + `\nConfirmations: ${verifyData.data.confirmations}`);

                    // Stop current polling and start new one to get updated status
                    if (pollingInterval) {
                        clearInterval(pollingInterval);
                        setPollingInterval(null);
                    }
                    pollPaymentStatus(currentPayment.paymentId);

                    // Refresh monitoring status to remove confirmed payment
                    setTimeout(() => {
                        loadMonitoringStatus();
                    }, 3000);
                } else {
                    setError(`Auto-verification failed: ${verifyData.data?.error || 'Unknown error'}`);
                }
            } catch (verifyError) {
                console.error('Auto-verification error:', verifyError);
                setError('Auto-verification failed, please verify manually');
            }

        } catch (error: any) {
            setError(`Transaction failed: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const simulateWebhook = async () => {
        if (!currentPayment || !txHash) return;

        setLoading(true);
        setError('');

        try {
            // Simulate payment confirmation webhook
            const response = await fetch(`${API_BASE}/blockchainapi/webhook/payment-confirmed`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Signature': 'test-signature'
                },
                body: JSON.stringify({
                    paymentId: currentPayment.paymentId,
                    txHash: txHash,
                    confirmations: networks[currentPayment.networkKey]?.minConfirmations || 12
                })
            });

            if (response.ok) {
                setSuccess('Webhook simulation successful!');
                // Stop current polling and start new one
                if (pollingInterval) {
                    clearInterval(pollingInterval);
                    setPollingInterval(null);
                }
                pollPaymentStatus(currentPayment.paymentId);
            } else {
                setError('Webhook simulation failed');
            }
        } catch (error) {
            setError('Webhook simulation error');
        } finally {
            setLoading(false);
        }
    };

    const openMetaMaskPayment = async () => {
        if (!currentPayment) return;

        try {
            setError('');
            setSuccess('🔄 Connecting to MetaMask...');

            // Check if MetaMask is available
            if (typeof window !== 'undefined' && window.ethereum) {
                console.log('MetaMask detected, attempting to connect...');

                // Try to connect to MetaMask and open it
                const accounts = await window.ethereum.request({
                    method: 'eth_requestAccounts'
                });

                console.log('MetaMask accounts:', accounts);

                if (accounts && accounts.length > 0) {
                    setSuccess(`MetaMask connected! Account: ${accounts[0].substring(0, 6)}...${accounts[0].substring(38)}`);

                    // Update connection state
                    setIsConnected(true);
                    setAccount(accounts[0]);
                    setProvider(new ethers.providers.Web3Provider(window.ethereum));

                    // Try to switch to the correct network
                    setTimeout(() => {
                        switchToCorrectNetwork();
                    }, 1000);
                } else {
                    setError('No accounts found in MetaMask. Please unlock MetaMask and try again.');
                }
            } else {
                // MetaMask not available, open installation page
                window.open('https://metamask.io/download/', '_blank');
                setError('❌ MetaMask not found. Please install MetaMask extension first.');
            }
        } catch (error: any) {
            console.error('MetaMask connection error:', error);
            setError(`❌ Failed to connect MetaMask: ${error.message || 'Unknown error'}`);
        }
    };

    const switchToCorrectNetwork = async () => {
        if (!currentPayment || !window.ethereum) {
            console.log('Cannot switch network: no currentPayment or window.ethereum');
            return;
        }

        try {
            console.log(`Attempting to switch to network: ${currentPayment.network} (Chain ID: ${currentPayment.chainId})`);
            setSuccess(`🔄 Switching to ${currentPayment.network} network...`);

            // Try to switch to the correct network
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${currentPayment.chainId.toString(16)}` }],
            });

            console.log(`Successfully switched to ${currentPayment.network}`);
            setSuccess(`Switched to ${currentPayment.network} network!`);
        } catch (switchError: any) {
            console.error('Switch network error:', switchError);

            // If network doesn't exist, try to add it
            if (switchError.code === 4902) {
                console.log(`Network ${currentPayment.network} not found, attempting to add it...`);
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: `0x${currentPayment.chainId.toString(16)}`,
                            chainName: currentPayment.network,
                            nativeCurrency: {
                                name: 'ETH',
                                symbol: 'ETH',
                                decimals: 18
                            },
                            rpcUrls: ['https://rpc.sepolia.org'], // Default RPC
                            blockExplorerUrls: [currentPayment.blockExplorer]
                        }],
                    });
                    console.log(`Successfully added ${currentPayment.network} network`);
                    setSuccess(`Added ${currentPayment.network} network!`);
                } catch (addError) {
                    console.error('Failed to add network:', addError);
                    setError(`❌ Please manually add ${currentPayment.network} network to MetaMask.`);
                }
            } else {
                console.error('Failed to switch network:', switchError);
                setError(`❌ Please manually switch to ${currentPayment.network} network.`);
            }
        }
    };

    const checkMetaMaskStatus = () => {
        if (typeof window !== 'undefined' && window.ethereum) {
            return 'MetaMask Extension Available';
        } else {
            return '❌ MetaMask Extension Not Found';
        }
    };

    const getDetailedMetaMaskStatus = () => {
        if (typeof window === 'undefined') {
            return '❌ Window not available (SSR)';
        }

        if (!window.ethereum) {
            return '❌ MetaMask Extension Not Found';
        }

        if (isConnected) {
            return `Connected: ${account.substring(0, 6)}...${account.substring(38)}`;
        }

        return '⚠️ MetaMask Available but Not Connected';
    };

    const stopPolling = () => {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
            setSuccess('Polling stopped manually');
            console.log('Polling stopped manually');
        }
    };

    const refreshMonitoringStatus = async () => {
        try {
            const response = await fetch(`${API_BASE}/blockchainapi/monitoring/refresh`, {
                method: 'POST',
                headers: {
                    'X-API-Key': API_KEY,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            if (data.success) {
                setMonitoringStatus(data.data);
                setSuccess('Monitoring refreshed successfully!');
            } else {
                setError('Failed to refresh monitoring');
            }
        } catch (error) {
            setError('Failed to refresh monitoring');
        }
    };

    const forceRefreshMonitoringStatus = async () => {
        try {
            const response = await fetch(`${API_BASE}/blockchainapi/monitoring/force-refresh`, {
                method: 'POST',
                headers: {
                    'X-API-Key': API_KEY,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            if (data.success) {
                setMonitoringStatus(data.data);
                setSuccess('Monitoring force refreshed successfully!');
            } else {
                setError('Failed to force refresh monitoring');
            }
        } catch (error) {
            setError('Failed to force refresh monitoring');
        }
    };

    const removeConfirmedPayments = async () => {
        try {
            const response = await fetch(`${API_BASE}/blockchainapi/monitoring/remove-confirmed`, {
                method: 'POST',
                headers: {
                    'X-API-Key': API_KEY,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            if (data.success) {
                setMonitoringStatus(data.data);
                setSuccess('Confirmed payments removed from monitoring successfully!');
            } else {
                setError('Failed to remove confirmed payments');
            }
        } catch (error) {
            setError('Failed to remove confirmed payments');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-800 mb-4">
                        Blockchain Payment Test Interface
                    </h1>
                </div>

                {/* Wallet Connection */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <h2 className="text-2xl font-semibold mb-4">Wallet Connection</h2>
                    {!isConnected ? (
                        <button
                            onClick={connectWallet}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                        >
                            Connect MetaMask
                        </button>
                    ) : (
                        <div className="flex items-center space-x-4">
                            <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg">
                                Connected: {account.substring(0, 6)}...{account.substring(38)}
                            </div>
                            <button
                                onClick={() => window.open('https://metamask.io', '_blank')}
                                className="text-blue-600 hover:text-blue-800 underline"
                            >
                                Install MetaMask
                            </button>
                        </div>
                    )}
                </div>

                {/* Blockchain Monitoring Status */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <h2 className="text-2xl font-semibold mb-4"> Blockchain Monitoring</h2>
                    {monitoringStatus ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <span className={`w-3 h-3 rounded-full ${monitoringStatus.isMonitoring ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                    <span className="font-medium">
                                        {monitoringStatus.isMonitoring ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <div className="text-sm text-blue-600 font-medium">Pending Payments</div>
                                    <div className="text-2xl font-bold text-blue-800">{monitoringStatus.pendingPayments}</div>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg">
                                    <div className="text-sm text-green-600 font-medium">Active Networks</div>
                                    <div className="text-2xl font-bold text-green-800">{monitoringStatus.networks.length}</div>
                                </div>
                                <div className="bg-purple-50 p-4 rounded-lg">
                                    <div className="text-sm text-purple-600 font-medium">Monitoring Networks</div>
                                    <div className="text-sm text-purple-800">
                                        {monitoringStatus.networks.join(', ')}
                                    </div>
                                </div>
                            </div>

                            {monitoringStatus.payments.length > 0 && (
                                <div className="mt-4">
                                    <h3 className="text-lg font-medium mb-3">Monitored Payments</h3>
                                    <div className="space-y-2">
                                        {monitoringStatus.payments.map((payment: any) => (
                                            <div key={payment.paymentId} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                                                <div>
                                                    <div className="font-medium text-sm">{payment.paymentId.substring(0, 8)}...</div>
                                                    <div className="text-xs text-gray-600">
                                                        {payment.amount} {payment.token} on {payment.network}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {new Date(payment.createdAt).toLocaleString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <div className="text-gray-500">Loading monitoring status...</div>
                        </div>
                    )}
                </div>

                {/* Payment Creation Form */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <h2 className="text-2xl font-semibold mb-4">Create Payment</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Amount (USD)
                            </label>
                            <input
                                type="number"
                                value={safePaymentRequest.amount}
                                onChange={(e) => setPaymentRequest(prev => ({
                                    ...prev,
                                    amount: parseFloat(e.target.value) || 0
                                }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                step="0.01"
                                min="0.01"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Order ID
                            </label>
                            <input
                                type="text"
                                value={safePaymentRequest.orderId}
                                onChange={(e) => setPaymentRequest(prev => ({
                                    ...prev,
                                    orderId: e.target.value
                                }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Network
                            </label>
                            <select
                                value={safePaymentRequest.network}
                                onChange={(e) => setPaymentRequest(prev => ({
                                    ...prev,
                                    network: e.target.value
                                }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                {Object.keys(networks).map(network => (
                                    <option key={network} value={network}>
                                        {networks[network]?.name || network}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Token
                            </label>
                            <select
                                value={safePaymentRequest.token}
                                onChange={(e) => setPaymentRequest(prev => ({
                                    ...prev,
                                    token: e.target.value
                                }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="usdt">USDT</option>
                                <option value="usdc">USDC</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex space-x-4">
                        <button
                            onClick={createPayment}
                            disabled={loading || !safePaymentRequest.orderId || safePaymentRequest.amount <= 0}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                        >
                            {loading ? 'Creating...' : 'Create Payment'}
                        </button>
                        <button
                            onClick={generateOrderId}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                        >
                            Generate Order ID
                        </button>
                    </div>
                </div>

                {/* Current Payment Details */}
                {currentPayment && (
                    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                        <h2 className="text-2xl font-semibold mb-4">Payment Details</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-lg font-medium mb-3">Payment Information</h3>
                                <div className="space-y-2 text-sm">
                                    <div><strong>Payment ID:</strong> {currentPayment.paymentId}</div>
                                    <div><strong>Original Amount:</strong> ${currentPayment.originalAmount}</div>
                                    <div><strong>Token Amount:</strong> {currentPayment.amount} {currentPayment.token.toUpperCase()}</div>
                                    <div><strong>Network:</strong> {currentPayment.network}</div>
                                    <div><strong>Chain ID:</strong> {currentPayment.chainId}</div>
                                    <div><strong>Token:</strong> {currentPayment.tokenName}</div>
                                    <div><strong>Expires:</strong> {new Date(currentPayment.expiresAt).toLocaleString()}</div>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-medium mb-3">Wallet Information</h3>
                                <div className="space-y-2 text-sm">
                                    <div><strong>Wallet Address:</strong> {currentPayment.walletAddress}</div>
                                    <div><strong>Contract Address:</strong> {currentPayment.contractAddress}</div>
                                    <div><strong>Block Explorer:</strong>
                                        <a
                                            href={currentPayment.blockExplorer}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 ml-1"
                                        >
                                            {currentPayment.blockExplorer}
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* QR Code */}
                        {currentPayment.qrCode && (
                            <div className="mt-6">
                                <h3 className="text-lg font-medium mb-3">QR Code</h3>
                                <img
                                    src={currentPayment.qrCode}
                                    alt="Payment QR Code"
                                    className="w-48 h-48 mx-auto border rounded-lg"
                                />
                            </div>
                        )}

                        {/* MetaMask Instructions */}
                        <div className="mt-6 mb-4 p-4 bg-blue-50 rounded-lg">
                            <h3 className="text-lg font-medium mb-2 text-blue-800">How to Pay with MetaMask</h3>
                            <div className="text-sm text-blue-700 space-y-1">
                                <p><strong>Status:</strong> {getDetailedMetaMaskStatus()}</p>
                                <p><strong>Polling:</strong> {pollingInterval ? '🔄 Active (checking payment status every 10s)' : '⏸️ Inactive'}</p>
                                <p>1. <strong>Desktop:</strong> Click "Connect MetaMask" to open MetaMask extension</p>
                                <p>2. <strong>Mobile:</strong> Click "Deep Link (Mobile)" or scan QR code</p>
                                <p>3. <strong>Network:</strong> System will auto-switch to {currentPayment.network} (Chain ID: {currentPayment.chainId})</p>
                                <p>4. <strong>Send Payment:</strong> Transfer exactly {currentPayment.amount} {currentPayment.token} to the address above</p>
                                <p>5. <strong>Verify:</strong> Use the transaction hash to verify your payment</p>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="mt-6 flex flex-wrap gap-4">
                            <button
                                onClick={openMetaMaskPayment}
                                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                                Connect MetaMask
                            </button>
                          

                            {isConnected && (
                                <button
                                    onClick={sendTestPayment}
                                    disabled={loading}
                                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                                >
                                    {loading ? 'Sending...' : 'Send Test Payment'}
                                </button>
                            )}
                        </div>

                        {/* Mobile Wallet Links */}
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                            <h3 className="text-lg font-medium mb-3 text-gray-800">Mobile Wallet Links</h3>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => window.open(currentPayment.walletUrls.metamask, '_blank')}
                                    className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded text-sm font-medium"
                                >
                                    MetaMask Mobile
                                </button>

                            </div>
                        </div>
                    </div>
                )}

                {/* Payment Status */}
                {paymentStatus && (
                    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                        <h2 className="text-2xl font-semibold mb-4">Payment Status</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-lg font-medium mb-3">Status Information</h3>
                                <div className="space-y-2 text-sm">
                                    <div><strong>Status:</strong>
                                        <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${paymentStatus.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                            paymentStatus.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                paymentStatus.status === 'expired' ? 'bg-red-100 text-red-800' :
                                                    'bg-blue-100 text-blue-800'
                                            }`}>
                                            {paymentStatus.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <div><strong>Created:</strong> {new Date(paymentStatus.createdAt).toLocaleString()}</div>
                                    <div><strong>Expires:</strong> {new Date(paymentStatus.expiresAt).toLocaleString()}</div>
                                    {paymentStatus.txHash && (
                                        <div><strong>Transaction Hash:</strong>
                                            <a
                                                href={`${paymentStatus.blockExplorer}/tx/${paymentStatus.txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:text-blue-800 ml-1"
                                            >
                                                {paymentStatus.txHash.substring(0, 10)}...{paymentStatus.txHash.substring(58)}
                                            </a>
                                        </div>
                                    )}
                                    {paymentStatus.confirmations !== undefined && (
                                        <div><strong>Confirmations:</strong> {paymentStatus.confirmations}</div>
                                    )}
                                    {paymentStatus.verifiedAt && (
                                        <div><strong>Verified:</strong> {new Date(paymentStatus.verifiedAt).toLocaleString()}</div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-medium mb-3">Payment Details</h3>
                                <div className="space-y-2 text-sm">
                                    <div><strong>Order ID:</strong> {paymentStatus.orderId}</div>
                                    <div><strong>Original Amount:</strong> ${paymentStatus.originalAmount}</div>
                                    <div><strong>Token Amount:</strong> {paymentStatus.amount} {paymentStatus.token.toUpperCase()}</div>
                                    <div><strong>Network:</strong> {paymentStatus.network}</div>
                                    <div><strong>Token:</strong> {paymentStatus.tokenName}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Messages */}
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
                        <strong>Error:</strong> {error}
                    </div>
                )}
                {success && (
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-6">
                        <strong>Success:</strong> {success}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BlockchainPaymentTest; 