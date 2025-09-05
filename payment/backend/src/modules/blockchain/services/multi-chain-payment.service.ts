import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Web3 from 'web3';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { validatePaymentRequest } from '../validators/payment.validator';
import { 
  getNetworkConfig, 
  getTokenConfig, 
  getRpcUrl, 
  ERC20_ABI,
  getSupportedNetworks,
  getSupportedTokens
} from '../../../config/networks';
import { 
  Payment, 
  PaymentMetadata, 
  WalletUrls, 
  NetworkBalance, 
  NetworkInfo, 
  TokenBalance,
  NativeBalance 
} from '../interfaces/payment.interface';
import { BlockchainPayment as PaymentDocument } from '../schemas/blockchain.chema';
import { BlockchainMonitorService } from './blockchain-monitor.service';

@Injectable()
export class MultiChainPaymentService implements OnModuleInit {
  private web3Instances: Map<string, Web3>;
  private pendingPayments: Map<string, Payment>;
  private usedUniqueAmounts: Set<string>;
  private readonly walletAddress: string;
  private readonly isTestnet: boolean;

  constructor(
    @InjectModel(PaymentDocument.name)
    private paymentModel: Model<PaymentDocument>,
    @Inject(forwardRef(() => BlockchainMonitorService))
    private blockchainMonitorService: BlockchainMonitorService
  ) {
    this.web3Instances = new Map();
    this.pendingPayments = new Map();
    this.usedUniqueAmounts = new Set();
    this.walletAddress = process.env.WALLET_ADDRESS;
    this.isTestnet = process.env.NODE_ENV !== 'production';
  }

  async onModuleInit() {
    this.initializeNetworks();
  }

  private initializeNetworks(): void {
    const supportedNetworks = getSupportedNetworks(this.isTestnet);
    
    for (const networkKey of supportedNetworks) {
      try {
        const rpcUrl = getRpcUrl(networkKey, this.isTestnet);
        const web3 = new Web3(rpcUrl);
        this.web3Instances.set(networkKey, web3);
        console.log(`Initialized ${networkKey} network`);
      } catch (error) {
        console.warn(`⚠️ Failed to initialize ${networkKey}:`, error.message);
      }
    }
  }

  private getWeb3Instance(networkKey: string): Web3 {
    const web3 = this.web3Instances.get(networkKey);
    if (!web3) {
      throw new Error(`Network ${networkKey} not initialized`);
    }
    return web3;
  }

  private generateUniqueAmount(originalAmount: number, networkKey: string, token: string): number {
    let attempts = 0;
    let uniqueAmount: number;
    const key = `${networkKey}-${token}`;
    
    do {
      const randomCents = Math.floor(Math.random() * 99) + 1;
      const centsDecimal = randomCents / 100;
      
      uniqueAmount = parseFloat((originalAmount + centsDecimal).toFixed(6));
      attempts++;
      
      if (attempts > 50) {
        const timestamp = Date.now() % 100;
        uniqueAmount = parseFloat((originalAmount + (timestamp / 100)).toFixed(6));
        break;
      }
    } while (this.usedUniqueAmounts.has(`${key}-${uniqueAmount}`));
    
    this.usedUniqueAmounts.add(`${key}-${uniqueAmount}`);
    
    // Cleanup after 24 hours
    setTimeout(() => {
      this.usedUniqueAmounts.delete(`${key}-${uniqueAmount}`);
    }, 24 * 60 * 60 * 1000);
    
    return originalAmount;
  }

  async createPayment(
    amount: number, 
    orderId: string, 
    networkKey: string = 'ethereum', 
    token: string = 'usdt', 
    metadata: PaymentMetadata = {}
  ): Promise<Payment> {
    // Validate network and token
    const networkConfig = getNetworkConfig(networkKey, this.isTestnet);
    const tokenConfig = getTokenConfig(networkKey, token, this.isTestnet);
    
    if (!this.web3Instances.has(networkKey)) {
      throw new Error(`Network ${networkKey} not available`);
    }

    const paymentId = uuidv4();
    const expiresAt = new Date(Date.now() + (Number(process.env.PAYMENT_TIMEOUT) || 1800) * 1000);
    
    const uniqueAmount = this.generateUniqueAmount(parseFloat(amount.toString()), networkKey, token);
    
    const paymentData: Payment = {
      id: paymentId,
      originalAmount: amount.toString(),
      amount: uniqueAmount.toString(),
      orderId,
      walletAddress: this.walletAddress,
      contractAddress: tokenConfig.address,
      network: networkConfig.name,
      networkKey: networkKey,
      chainId: networkConfig.chainId,
      token: tokenConfig.symbol,
      tokenName: tokenConfig.name,
      decimals: tokenConfig.decimals,
      blockExplorer: networkConfig.blockExplorer,
      status: 'pending',
      createdAt: new Date(),
      expiresAt,
      metadata
    };

    // Generate wallet URLs for different wallets
    const walletUrls = await this.generateWalletUrls(
      uniqueAmount, 
      paymentId, 
      networkConfig, 
      tokenConfig
    );
    
    const qrCode = await this.generateQRCode(walletUrls.metamask);

    paymentData.walletUrls = walletUrls;
    paymentData.qrCode = qrCode;

    // Save to database
    const payment = new this.paymentModel(paymentData);
    await payment.save();
    
    this.pendingPayments.set(paymentId, paymentData);
    
    // Add to blockchain monitoring
    await this.blockchainMonitorService.addPaymentToMonitoring(paymentData);
    
    // Set expiration timeout
    setTimeout(async () => {
      await this.expirePayment(paymentId);
    }, (Number(process.env.PAYMENT_TIMEOUT) || 1800) * 1000);

    return paymentData;
  }

  private generateWalletUrls(
    amount: number, 
    paymentId: string, 
    networkConfig: any, 
    tokenConfig: any
  ): WalletUrls {
    const chainId = networkConfig.chainId;
    const contractAddress = tokenConfig.address;
    const decimals = tokenConfig.decimals;
    
    // Calculate token amount with decimals
    const tokenAmount = (amount * Math.pow(10, decimals)).toString();
    
    return {
      metamask: `https://metamask.app.link/send/${contractAddress}@${chainId}/transfer?address=${this.walletAddress}&uint256=${tokenAmount}`,
      trustWallet: `trust://send?asset=${chainId}&address=${this.walletAddress}&amount=${amount}&token=${contractAddress}&memo=${paymentId}`,
      coinbaseWallet: `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(`ethereum:${contractAddress}/transfer?address=${this.walletAddress}&uint256=${tokenAmount}`)}`,
      direct: {
        network: networkConfig.name,
        chainId: chainId,
        contractAddress: contractAddress,
        toAddress: this.walletAddress,
        amount: amount,
        tokenAmount: tokenAmount,
        decimals: decimals,
        symbol: tokenConfig.symbol
      }
    };
  }

  private async generateQRCode(data: string): Promise<string> {
    try {
      return await QRCode.toDataURL(data);
    } catch (error) {
      throw new Error('Failed to generate QR code');
    }
  }

  async verifyPayment(paymentId: string, txHash: string): Promise<Payment> {
    try {
      const payment = this.pendingPayments.get(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'pending') {
        throw new Error('Payment already processed');
      }

      const web3 = this.getWeb3Instance(payment.networkKey);
      
      const transaction = await web3.eth.getTransaction(txHash);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const receipt = await web3.eth.getTransactionReceipt(txHash);
      if (!receipt || !receipt.status) {
        throw new Error('Transaction failed');
      }

      const isValid = await this.validateTransaction(transaction, payment, web3);
      if (!isValid) {
        throw new Error('Invalid transaction');
      }

      const confirmations = await this.getConfirmations(txHash, payment.networkKey);
      const networkConfig = getNetworkConfig(payment.networkKey, this.isTestnet);
      const minConfirmations = networkConfig.minConfirmations;
      
      payment.txHash = txHash;
      payment.confirmations = confirmations;
      payment.status = confirmations >= minConfirmations ? 'confirmed' : 'pending_confirmation';
      payment.verifiedAt = new Date();

      // Update in memory
      this.pendingPayments.set(paymentId, payment);
      
      // Update in database
      await this.paymentModel.findOneAndUpdate(
        { id: paymentId },
        { 
          $set: { 
            txHash,
            confirmations,
            status: payment.status,
            verifiedAt: payment.verifiedAt
          } 
        }
      );
      
      // Remove from blockchain monitoring if confirmed
      if (payment.status === 'confirmed') {
        await this.blockchainMonitorService.removePaymentFromMonitoring(paymentId);
      }
      
      return payment;
    } catch (error) {
      throw new Error(`Payment verification failed: ${error.message}`);
    }
  }

  private async validateTransaction(transaction: any, payment: Payment, web3: Web3): Promise<boolean> {
    try {
      // Check if transaction is to the token contract
      if (transaction.to.toLowerCase() !== payment.contractAddress.toLowerCase()) {
        return false;
      }

      // Decode transfer function call
      const transferMethodId = '0xa9059cbb'; // transfer(address,uint256)
      
      if (!transaction.input.startsWith(transferMethodId)) {
        return false;
      }

      // Decode the input data
      const inputData = transaction.input.slice(10); // Remove method ID
      const result = web3.eth.abi.decodeParameters(
        ['address', 'uint256'],
        inputData
      ) as unknown as { 0: string; 1: string };
      
      const toAddress = result[0];
      const amount = result[1];
      
      // Calculate expected amount with token decimals
      const expectedAmount = (parseFloat(payment.amount) * Math.pow(10, payment.decimals)).toString();
      
      return toAddress.toLowerCase() === this.walletAddress.toLowerCase() && 
             amount.toString() === expectedAmount;
    } catch (error) {
      console.error('Transaction validation error:', error);
      return false;
    }
  }

  async findPaymentByAmount(amount: string, networkKey: string, token: string): Promise<{ paymentId: string; payment: Payment } | null> {
    try {
      // First try memory
      const numAmount = parseFloat(amount);
      for (const [paymentId, payment] of Array.from(this.pendingPayments.entries())) {
        if (payment.status === 'pending' && 
            payment.networkKey === networkKey &&
            payment.token.toLowerCase() === token.toLowerCase() &&
            parseFloat(payment.amount) === numAmount) {
          return { paymentId, payment };
        }
      }
      
      // If not in memory, try database
      const payment = await this.paymentModel.findOne({
        amount,
        networkKey,
        token: { $regex: new RegExp(token, 'i') },
        status: 'pending'
      });

      if (!payment) {
        return null;
      }

      return {
        paymentId: payment.id,
        payment: payment.toObject() as Payment
      };
    } catch (error) {
      console.error('Error finding payment by amount:', error);
      return null;
    }
  }

  async getConfirmations(txHash: string, networkKey: string): Promise<number> {
    try {
      const web3 = this.getWeb3Instance(networkKey);
      const transaction = await web3.eth.getTransaction(txHash);
      
      if (!transaction || !transaction.blockNumber) {
        return 0;
      }

      const currentBlock = await web3.eth.getBlockNumber();
      return Number(currentBlock) - Number(transaction.blockNumber) + 1;
    } catch (error) {
      console.error('Error getting confirmations:', error);
      return 0;
    }
  }

  async getPayment(paymentId: string): Promise<Payment | null> {
    try {
      // First try to get from memory
      const memoryPayment = this.pendingPayments.get(paymentId);
      if (memoryPayment) {
        // Also check database for latest status
        const dbPayment = await this.paymentModel.findOne({ id: paymentId });
        if (dbPayment) {
          const dbPaymentObj = dbPayment.toObject() as Payment;
          // Update memory with latest database status
          if (dbPaymentObj.status !== memoryPayment.status || 
              dbPaymentObj.txHash !== memoryPayment.txHash ||
              dbPaymentObj.confirmations !== memoryPayment.confirmations) {
            Object.assign(memoryPayment, {
              status: dbPaymentObj.status,
              txHash: dbPaymentObj.txHash,
              confirmations: dbPaymentObj.confirmations,
              verifiedAt: dbPaymentObj.verifiedAt
            });
            this.pendingPayments.set(paymentId, memoryPayment);
          }
        }
        return memoryPayment;
      }
      
      // If not in memory, try database
      const payment = await this.paymentModel.findOne({ id: paymentId });
      if (payment) {
        const paymentObj = payment.toObject() as Payment;
        // Add to memory for future requests
        this.pendingPayments.set(paymentId, paymentObj);
        return paymentObj;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting payment:', error);
      return null;
    }
  }

  private async expirePayment(paymentId: string): Promise<void> {
    const payment = this.pendingPayments.get(paymentId);
    if (payment && payment.status === 'pending') {
      payment.status = 'expired';
      this.pendingPayments.set(paymentId, payment);
      
      // Remove from unique amounts
      const key = `${payment.networkKey}-${payment.token}-${payment.amount}`;
      this.usedUniqueAmounts.delete(key);
      
      // Remove from blockchain monitoring
      await this.blockchainMonitorService.removePaymentFromMonitoring(paymentId);
      
      // Update in database
      await this.paymentModel.findOneAndUpdate(
        { id: paymentId },
        { $set: { status: 'expired' } }
      );
    }
  }

  async getWalletBalance(networkKey: string): Promise<NativeBalance> {
    try {
      const web3 = this.getWeb3Instance(networkKey);
      const networkConfig = getNetworkConfig(networkKey, this.isTestnet);
      
      const balance = await web3.eth.getBalance(this.walletAddress);
      const balanceInEther = web3.utils.fromWei(balance, 'ether');
      
      return {
        amount: balanceInEther,
        symbol: networkConfig.symbol,
        network: networkConfig.name
      };
    } catch (error) {
      throw new Error(`Failed to get wallet balance for ${networkKey}: ${error.message}`);
    }
  }

  async getTokenBalance(networkKey: string, tokenSymbol: string): Promise<TokenBalance> {
    try {
      const web3 = this.getWeb3Instance(networkKey);
      const tokenConfig = getTokenConfig(networkKey, tokenSymbol, this.isTestnet);
      
      const contract = new web3.eth.Contract(ERC20_ABI, tokenConfig.address);
      const balance = await contract.methods.balanceOf(this.walletAddress).call() as string;
      
      const balanceFormatted = (parseFloat(balance) / Math.pow(10, tokenConfig.decimals)).toString();
      
      return {
        amount: balanceFormatted,
        symbol: tokenConfig.symbol,
        name: tokenConfig.name,
        contractAddress: tokenConfig.address,
        decimals: tokenConfig.decimals
      };
    } catch (error) {
      throw new Error(`Failed to get ${tokenSymbol} balance on ${networkKey}: ${error.message}`);
    }
  }

  async getAllBalances(): Promise<{ [key: string]: NetworkBalance }> {
    const balances: { [key: string]: NetworkBalance } = {};
    const supportedNetworks = (getSupportedNetworks(this.isTestnet) || []) as string[];
    
    for (const networkKey of supportedNetworks) {
      if (!this.web3Instances.has(networkKey)) continue;
      
      try {
        const networkConfig = getNetworkConfig(networkKey, this.isTestnet);
        balances[networkKey] = {
          network: networkConfig.name,
          chainId: networkConfig.chainId,
          native: {
            native: await this.getWalletBalance(networkKey)
          },
          tokens: {}
        };
        
        // Get token balances
        const supportedTokens = (getSupportedTokens(networkKey, this.isTestnet) || []) as string[];
        for (const token of supportedTokens) {
          try {
            balances[networkKey].tokens[token] = await this.getTokenBalance(networkKey, token);
          } catch (error) {
            console.warn(`Failed to get ${token} balance on ${networkKey}:`, error.message);
          }
        }
      } catch (error) {
        console.warn(`Failed to get balances for ${networkKey}:`, error.message);
      }
    }
    
    return balances;
  }

  getSupportedNetworks(): string[] {
    return (getSupportedNetworks(this.isTestnet) || []) as string[];
  }

  getSupportedTokens(networkKey: string): string[] {
    return (getSupportedTokens(networkKey, this.isTestnet) || []) as string[];
  }

  getNetworkInfo(networkKey: string): NetworkInfo {
    const networkConfig = getNetworkConfig(networkKey, this.isTestnet);
    return {
      name: networkConfig.name,
      chainId: networkConfig.chainId,
      symbol: networkConfig.symbol,
      blockExplorer: networkConfig.blockExplorer,
      tokens: networkConfig.tokens,
      minConfirmations: networkConfig.minConfirmations
    };
  }

  // Get blockchain monitoring status
  getMonitoringStatus() {
    return this.blockchainMonitorService.getMonitoringStatus();
  }

  // Get detailed monitoring statistics
  getDetailedMonitoringStats() {
    return this.blockchainMonitorService.getDetailedMonitoringStats();
  }

  // Manual check for a specific payment
  async manualCheckPayment(paymentId: string) {
    return this.blockchainMonitorService.manualCheckPayment(paymentId);
  }

  // Check transaction by hash
  async checkTransactionByHash(txHash: string, networkKey: string) {
    return this.blockchainMonitorService.checkTransactionByHash(txHash, networkKey);
  }

  // Verify transaction details against payment requirements
  async verifyTransactionDetails(txHash: string, paymentId: string) {
    return this.blockchainMonitorService.verifyTransactionDetails(txHash, paymentId);
  }

  // Refresh monitoring
  async refreshMonitoring() {
    return this.blockchainMonitorService.refreshMonitoring();
  }

  // Force refresh monitoring
  async forceRefreshMonitoring() {
    return this.blockchainMonitorService.forceRefreshMonitoring();
  }

  // Remove confirmed payments from monitoring
  async removeConfirmedPayments() {
    return this.blockchainMonitorService.removeConfirmedPayments();
  }

  // Force check all pending payments
  async forceCheckAllPayments() {
    return this.blockchainMonitorService.forceCheckAllPayments();
  }

  // Force check a specific payment
  async forceCheckPayment(paymentId: string) {
    return this.blockchainMonitorService.forceCheckPayment(paymentId);
  }
}