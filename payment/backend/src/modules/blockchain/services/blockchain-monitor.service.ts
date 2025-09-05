import { Injectable, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Web3 from 'web3';
import { MultiChainPaymentService } from './multi-chain-payment.service';
import { BlockchainPayment as PaymentDocument } from '../schemas/blockchain.chema';
import { getNetworkConfig, getRpcUrl } from '../../../config/networks';

interface PendingPayment {
  paymentId: string;
  networkKey: string;
  amount: string;
  walletAddress: string;
  contractAddress: string;
  token: string;
  decimals: number;
  createdAt: Date;
}

@Injectable()
export class BlockchainMonitorService implements OnModuleInit, OnModuleDestroy {
  private web3Instances: Map<string, Web3> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private pendingPayments: Map<string, PendingPayment> = new Map();
  private isMonitoring = false;

  constructor(
    @InjectModel(PaymentDocument.name)
    private paymentModel: Model<PaymentDocument>,
    @Inject(forwardRef(() => MultiChainPaymentService))
    private multiChainPaymentService: MultiChainPaymentService
  ) {}

  async onModuleInit() {
    await this.initializeMonitoring();
  }

  async onModuleDestroy() {
    this.stopAllMonitoring();
  }

  private async initializeMonitoring() {
    console.log('Initializing blockchain monitoring...');
    
    // Load pending payments from database
    await this.loadPendingPayments();
    
    // Start monitoring for each network
    const networks = ['bsc-testnet'];
    
    for (const networkKey of networks) {
      try {
        await this.startNetworkMonitoring(networkKey);
      } catch (error) {
        console.warn(`⚠️ Failed to start monitoring for ${networkKey}:`, error.message);
      }
    }
    
    this.isMonitoring = true;
    console.log('Blockchain monitoring initialized');
  }

     private async loadPendingPayments() {
     try {
       const pendingPayments = await this.paymentModel.find({ 
         status: 'pending',
         expiresAt: { $gt: new Date() }
       });

       for (const payment of pendingPayments) {
         // Skip payments that are already confirmed
         if (payment.status === 'confirmed' || payment.txHash) {
           console.log(`⏭️ Skipping confirmed payment ${payment.id}`);
           continue;
         }
         
         this.pendingPayments.set(payment.id, {
           paymentId: payment.id,
           networkKey: payment.networkKey,
           amount: payment.amount,
           walletAddress: payment.walletAddress,
           contractAddress: payment.contractAddress,
           token: payment.token,
           decimals: payment.decimals,
           createdAt: payment.createdAt
         });
       }

       console.log(`Loaded ${this.pendingPayments.size} pending payments for monitoring`);
     } catch (error) {
       console.error('❌ Failed to load pending payments:', error);
     }
   }

   // Method to refresh pending payments from database
   private async refreshPendingPayments() {
     try {
       // Clear current pending payments
       this.pendingPayments.clear();
       
       // Reload from database
       await this.loadPendingPayments();
       
       console.log(`🔄 Refreshed pending payments. Current count: ${this.pendingPayments.size}`);
     } catch (error) {
       console.error('❌ Failed to refresh pending payments:', error);
     }
   }

  private async startNetworkMonitoring(networkKey: string) {
    try {
      const rpcUrl = getRpcUrl(networkKey, true); // true for testnet
      const web3 = new Web3(rpcUrl);
      this.web3Instances.set(networkKey, web3);

      // Giảm interval xuống 30 giây để cập nhật nhanh hơn
      const interval = setInterval(async () => {
        await this.checkNetworkPayments(networkKey);
        // Cleanup expired payments every 5 minutes (10 cycles)
        if (Math.random() < 0.2) { // ~20% chance each cycle
          await this.cleanupExpiredPayments();
        }
        // Refresh pending payments every 10 minutes (20 cycles)
        if (Math.random() < 0.1) { // ~10% chance each cycle
          await this.refreshPendingPayments();
        }
      }, 30000); // 30 seconds instead of 120 seconds

      this.monitoringIntervals.set(networkKey, interval);
      console.log(`Started monitoring ${networkKey} network with 30s intervals`);
    } catch (error) {
      console.error(`Failed to start monitoring ${networkKey}:`, error);
    }
  }

  private async checkNetworkPayments(networkKey: string) {
    try {
      const web3 = this.web3Instances.get(networkKey);
      if (!web3) {
        console.warn(`Web3 instance not found for ${networkKey}`);
        return;
      }

      // Get pending payments for this network
      const networkPayments = Array.from(this.pendingPayments.values())
        .filter(payment => payment.networkKey === networkKey);

      if (networkPayments.length === 0) {
        console.log(`No pending payments for ${networkKey}`);
        return;
      }

      console.log(` Checking ${networkPayments.length} pending payments on ${networkKey}`);

      // Process payments in parallel for better performance
      const checkPromises = networkPayments.map(payment => 
        this.checkPaymentStatus(payment, web3).catch(error => {
          console.error(`Error checking payment ${payment.paymentId}:`, error);
        })
      );

      await Promise.allSettled(checkPromises);
    } catch (error) {
      console.error(`Error checking ${networkKey} payments:`, error);
    }
  }

  private async checkPaymentStatus(payment: PendingPayment, web3: Web3) {
    try {
      // First, do a quick balance check to see if payment was received
      await this.checkPaymentByBalance(payment, web3);
      
      // Get recent transactions to the wallet address
      const currentBlock = await web3.eth.getBlockNumber();
      
      // Tăng block range lên 20 blocks để không bỏ lỡ giao dịch
      const blockRange = 20;
      const fromBlock = Math.max(0, Number(currentBlock) - blockRange);

      // Get transfer events for the token contract
      const contract = new web3.eth.Contract([
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "name": "from",
              "type": "address"
            },
            {
              "indexed": true,
              "name": "to",
              "type": "address"
            },
            {
              "indexed": false,
              "name": "value",
              "type": "uint256"
            }
          ],
          "name": "Transfer",
          "type": "event"
        }
      ], payment.contractAddress);

      // Use proper event filtering for Web3.js v4 with larger range
      const events = await contract.getPastEvents('allEvents', {
        fromBlock: fromBlock,
        toBlock: 'latest',
        filter: {
          to: payment.walletAddress
        }
      }) as any[];

      // Check each transfer event
      for (const event of events) {
        // Only process Transfer events
        if (event.event === 'Transfer' && event.returnValues && event.returnValues.value) {
          const transferAmount = event.returnValues.value;
          const expectedAmount = (parseFloat(payment.amount) * Math.pow(10, payment.decimals)).toString();

          // Check if amount matches and transaction is recent
          if (transferAmount === expectedAmount) {
            const txHash = event.transactionHash;
            const blockNumber = event.blockNumber;
            const block = await web3.eth.getBlock(blockNumber);
            
            // Tăng thời gian chấp nhận lên 30 phút để không bỏ lỡ giao dịch cũ
            const txTime = new Date(Number(block.timestamp) * 1000);
            const now = new Date();
            const timeDiff = (now.getTime() - txTime.getTime()) / 1000 / 60; // minutes

            if (timeDiff <= 30) { // Within 30 minutes instead of 10
              console.log(`🎯 Found matching payment for ${payment.paymentId}:`);
              console.log(`   Amount: ${transferAmount} (expected: ${expectedAmount})`);
              console.log(`   Transaction: ${txHash}`);
              console.log(`   Block: ${blockNumber}`);
              console.log(`   Time: ${txTime.toISOString()}`);

              // Auto-verify the payment
              await this.autoVerifyPayment(payment.paymentId, txHash);
              break;
            }
          }
        }
      }
    } catch (error) {
      // Handle RPC limit errors gracefully
      if (error.message && error.message.includes('limit exceeded')) {
        console.warn(`RPC limit exceeded for payment ${payment.paymentId}, will retry later`);
        return;
      }
      
      // Handle other errors
      if (error.message && error.message.includes('rate limit')) {
        console.warn(`Rate limit hit for payment ${payment.paymentId}, will retry later`);
        return;
      }
      
      console.error(`Error checking payment ${payment.paymentId}:`, error.message || error);
    }
  }

  private async autoVerifyPayment(paymentId: string, txHash: string) {
    try {
      console.log(`Auto-verifying payment ${paymentId} with tx ${txHash}`);

      // Use the existing verification logic
      await this.multiChainPaymentService.verifyPayment(paymentId, txHash);

      // Remove from pending payments
      this.pendingPayments.delete(paymentId);

      console.log(`Payment ${paymentId} auto-verified successfully!`);
    } catch (error) {
      console.error(`Auto-verification failed for ${paymentId}:`, error);
    }
  }

  // Add new payment to monitoring
  async addPaymentToMonitoring(payment: {
    id: string;
    networkKey: string;
    amount: string;
    walletAddress: string;
    contractAddress: string;
    token: string;
    decimals: number;
    createdAt: Date;
  }) {
    this.pendingPayments.set(payment.id, {
      paymentId: payment.id,
      networkKey: payment.networkKey,
      amount: payment.amount,
      walletAddress: payment.walletAddress,
      contractAddress: payment.contractAddress,
      token: payment.token,
      decimals: payment.decimals,
      createdAt: payment.createdAt
    });

    console.log(`Added payment ${payment.id} to monitoring`);
  }

  // Remove payment from monitoring
  async removePaymentFromMonitoring(paymentId: string) {
    this.pendingPayments.delete(paymentId);
    console.log(`Removed payment ${paymentId} from monitoring`);
  }

  // Get monitoring status
  getMonitoringStatus() {
    return {
      isMonitoring: this.isMonitoring,
      pendingPayments: this.pendingPayments.size,
      networks: Array.from(this.monitoringIntervals.keys()),
      payments: Array.from(this.pendingPayments.values()).map(payment => ({
        paymentId: payment.paymentId,
        network: payment.networkKey,
        amount: payment.amount,
        token: payment.token,
        createdAt: payment.createdAt
      }))
    };
  }

  // Stop all monitoring
  private stopAllMonitoring() {
    console.log('Stopping all blockchain monitoring...');
    
    for (const [network, interval] of this.monitoringIntervals) {
      clearInterval(interval);
      console.log(`Stopped monitoring ${network}`);
    }
    
    this.monitoringIntervals.clear();
    this.pendingPayments.clear();
    this.isMonitoring = false;
  }

     // Manual check for a specific payment
   async manualCheckPayment(paymentId: string) {
     const payment = this.pendingPayments.get(paymentId);
     if (!payment) {
       throw new Error('Payment not found in monitoring');
     }

     const web3 = this.web3Instances.get(payment.networkKey);
     if (!web3) {
       throw new Error(`Web3 instance not found for ${payment.networkKey}`);
     }

     await this.checkPaymentStatus(payment, web3);
   }

   // Manual refresh of pending payments
   async refreshMonitoring() {
     await this.refreshPendingPayments();
     return this.getMonitoringStatus();
   }

   // Force refresh monitoring and remove confirmed payments
   async forceRefreshMonitoring() {
     try {
       console.log('Starting force refresh monitoring...');
       
       // Clear current pending payments
       this.pendingPayments.clear();
       console.log('Cleared current pending payments');
       
       // Reload from database with confirmed payment filtering
       await this.loadPendingPayments();
       
       console.log(`Force refreshed pending payments. Current count: ${this.pendingPayments.size}`);
       
       // Also refresh from database to get latest status
       await this.refreshPendingPayments();
       
       const status = this.getMonitoringStatus();
       console.log('Updated monitoring status:', status);
       
       return status;
     } catch (error) {
       console.error('Failed to force refresh pending payments:', error);
       throw error;
     }
   }

   // Manually remove confirmed payments from monitoring
   async removeConfirmedPayments() {
     try {
       console.log('Removing confirmed payments from monitoring...');
       
       const confirmedPayments: string[] = [];
       
       // Check each payment in monitoring
       for (const [paymentId, payment] of this.pendingPayments.entries()) {
         try {
           // Get payment from database to check current status
           const dbPayment = await this.paymentModel.findById(paymentId);
           if (dbPayment && (dbPayment.status === 'confirmed' || dbPayment.txHash)) {
             confirmedPayments.push(paymentId);
             console.log(`Found confirmed payment: ${paymentId}`);
           }
         } catch (error) {
           console.warn(`Error checking payment ${paymentId}:`, error.message);
         }
       }
       
       // Remove confirmed payments from monitoring
       for (const paymentId of confirmedPayments) {
         this.pendingPayments.delete(paymentId);
         console.log(`Removed confirmed payment from monitoring: ${paymentId}`);
       }
       
       console.log(`Removed ${confirmedPayments.length} confirmed payments from monitoring`);
       return this.getMonitoringStatus();
     } catch (error) {
       console.error('Failed to remove confirmed payments:', error);
       throw error;
     }
   }

  // Alternative method to check payment using direct balance check
  private async checkPaymentByBalance(payment: PendingPayment, web3: Web3) {
    try {
      // Get current balance of the wallet address
      const contract = new web3.eth.Contract([
        {
          "constant": true,
          "inputs": [{"name": "_owner", "type": "address"}],
          "name": "balanceOf",
          "outputs": [{"name": "balance", "type": "uint256"}],
          "type": "function"
        }
      ], payment.contractAddress);

      const balance = await contract.methods.balanceOf(payment.walletAddress).call();
      const expectedAmount = (parseFloat(payment.amount) * Math.pow(10, payment.decimals)).toString();

      // If balance matches expected amount, payment might have been received
      if (balance && balance.toString() === expectedAmount) {
        console.log(`Balance matches expected amount for ${payment.paymentId}`);
        console.log(`Balance: ${balance}, Expected: ${expectedAmount}`);
        
        // Note: This method can't provide txHash, so we'll need to use events for verification
        // But we can use this as a quick check to see if payment was received
      }
    } catch (error) {
      console.warn(`Balance check failed for ${payment.paymentId}:`, error.message);
    }
  }

     // Method to check transaction directly by hash (if available)
   async checkTransactionByHash(txHash: string, networkKey: string) {
     try {
       const web3 = this.web3Instances.get(networkKey);
       if (!web3) {
         throw new Error(`Web3 instance not found for ${networkKey}`);
       }

       const receipt = await web3.eth.getTransactionReceipt(txHash);
       if (!receipt) {
         console.log(`Transaction ${txHash} not found or pending`);
         return null;
       }

       // Convert BigInt values to numbers for JSON serialization
       const serializedReceipt = {
         transactionHash: receipt.transactionHash,
         blockNumber: Number(receipt.blockNumber),
         blockHash: receipt.blockHash,
         status: receipt.status,
         gasUsed: Number(receipt.gasUsed),
         cumulativeGasUsed: Number(receipt.cumulativeGasUsed),
         effectiveGasPrice: Number(receipt.effectiveGasPrice),
         logs: receipt.logs,
         contractAddress: receipt.contractAddress,
         from: receipt.from,
         to: receipt.to,
         type: receipt.type
       };

       if (receipt.status) {
         console.log(`Transaction ${txHash} confirmed successfully`);
         return serializedReceipt;
       } else {
         console.log(`Transaction ${txHash} failed`);
         return serializedReceipt;
       }
     } catch (error) {
       console.error(`Error checking transaction ${txHash}:`, error.message);
       return null;
     }
   }

  // Method to verify transaction details against payment requirements
  async verifyTransactionDetails(txHash: string, paymentId: string) {
    try {
      // Get payment details
      const payment = this.pendingPayments.get(paymentId);
      if (!payment) {
        throw new Error('Payment not found in monitoring');
      }

      const web3 = this.web3Instances.get(payment.networkKey);
      if (!web3) {
        throw new Error(`Web3 instance not found for ${payment.networkKey}`);
      }

      // Get transaction receipt
      const receipt = await web3.eth.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new Error('Transaction not found or pending');
      }

      if (!receipt.status) {
        throw new Error('Transaction failed');
      }

      // Get transaction details
      const tx = await web3.eth.getTransaction(txHash);
      if (!tx) {
        throw new Error('Transaction details not found');
      }

      // Check if transaction is to the correct contract
      if (tx.to?.toLowerCase() !== payment.contractAddress.toLowerCase()) {
        throw new Error('Transaction is not to the correct token contract');
      }

      // Parse transaction input to get transfer details
      const contract = new web3.eth.Contract([
        {
          "constant": false,
          "inputs": [
            {"name": "_to", "type": "address"},
            {"name": "_value", "type": "uint256"}
          ],
          "name": "transfer",
          "outputs": [{"name": "", "type": "bool"}],
          "type": "function"
        }
      ], payment.contractAddress);

      // Decode transaction input using web3.utils
      const transferMethodSignature = web3.utils.sha3('transfer(address,uint256)')?.substring(0, 10);
      if (!tx.input.startsWith(transferMethodSignature)) {
        throw new Error('Transaction is not a transfer method call');
      }

      // Remove method signature and decode parameters
      const inputData = tx.input.substring(10);
      const recipientAddress = '0x' + inputData.substring(0, 64).substring(24); // Remove padding
      const transferAmount = web3.utils.hexToNumberString('0x' + inputData.substring(64, 128));
      const expectedAmount = (parseFloat(payment.amount) * Math.pow(10, payment.decimals)).toString();

      // Verify recipient address
      if (recipientAddress.toLowerCase() !== payment.walletAddress.toLowerCase()) {
        throw new Error('Transaction recipient does not match payment wallet address');
      }

      // Verify amount
      if (transferAmount !== expectedAmount) {
        throw new Error(`Amount mismatch: received ${transferAmount}, expected ${expectedAmount}`);
      }

      // Get block details for timestamp
      const block = await web3.eth.getBlock(receipt.blockNumber);
      const txTime = new Date(Number(block.timestamp) * 1000);
      const now = new Date();
      const timeDiff = (now.getTime() - txTime.getTime()) / 1000 / 60; // minutes

      // Check if transaction is recent (within last 30 minutes)
      if (timeDiff > 30) {
        throw new Error('Transaction is too old (more than 30 minutes)');
      }

             const verificationResult = {
         isValid: true,
         txHash,
         paymentId,
         recipientAddress,
         transferAmount,
         expectedAmount,
         blockNumber: Number(receipt.blockNumber),
         timestamp: txTime.toISOString(),
         confirmations: await this.getConfirmations(Number(receipt.blockNumber), web3),
         network: payment.networkKey,
         token: payment.token
       };

      console.log(`Transaction verification successful for ${paymentId}:`);
      console.log(`   Recipient: ${recipientAddress}`);
      console.log(`   Amount: ${transferAmount} (expected: ${expectedAmount})`);
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Time: ${txTime.toISOString()}`);

      return verificationResult;

    } catch (error) {
      console.error(`Transaction verification failed for ${paymentId}:`, error.message);
      return {
        isValid: false,
        error: error.message,
        txHash,
        paymentId
      };
    }
  }

  // Helper method to get confirmations
  private async getConfirmations(blockNumber: number, web3: Web3): Promise<number> {
    try {
      const currentBlock = await web3.eth.getBlockNumber();
      return Math.max(0, Number(currentBlock) - blockNumber);
    } catch (error) {
      console.warn('Failed to get confirmations:', error.message);
      return 0;
    }
  }

  // Cleanup expired payments
  private async cleanupExpiredPayments() {
    const now = new Date();
    const expiredPayments: string[] = [];

    for (const [paymentId, payment] of this.pendingPayments.entries()) {
      // Check if payment is older than 30 minutes (1800 seconds)
      const paymentAge = (now.getTime() - payment.createdAt.getTime()) / 1000;
      if (paymentAge > 1800) {
        expiredPayments.push(paymentId);
      }
    }

    if (expiredPayments.length > 0) {
      console.log(`Cleaning up ${expiredPayments.length} expired payments`);
      for (const paymentId of expiredPayments) {
        this.pendingPayments.delete(paymentId);
        console.log(`Removed expired payment: ${paymentId}`);
      }
    }
  }

  // Get detailed monitoring statistics
  getDetailedMonitoringStats() {
    const now = new Date();
    const stats = {
      isMonitoring: this.isMonitoring,
      totalPendingPayments: this.pendingPayments.size,
      activeNetworks: Array.from(this.monitoringIntervals.keys()),
      networkStats: {} as Record<string, { count: number; oldestPayment: string | null }>,
      averagePaymentAge: 0
    };

    // Calculate network-specific stats
    for (const [networkKey, interval] of this.monitoringIntervals) {
      const networkPayments = Array.from(this.pendingPayments.values())
        .filter(payment => payment.networkKey === networkKey);
      
      stats.networkStats[networkKey] = {
        count: networkPayments.length,
        oldestPayment: networkPayments.length > 0 
          ? networkPayments.reduce((oldest, current) => 
              current.createdAt < oldest.createdAt ? current : oldest
            ).paymentId
          : null
      };
    }

    // Calculate average payment age
    if (this.pendingPayments.size > 0) {
      const totalAge = Array.from(this.pendingPayments.values())
        .reduce((sum, payment) => sum + (now.getTime() - payment.createdAt.getTime()), 0);
      stats.averagePaymentAge = totalAge / this.pendingPayments.size / 1000; // in seconds
    }

    return stats;
  }

  // Thêm method để force check payment ngay lập tức
  async forceCheckPayment(paymentId: string) {
    const payment = this.pendingPayments.get(paymentId);
    if (!payment) {
      throw new Error('Payment not found in monitoring');
    }

    const web3 = this.web3Instances.get(payment.networkKey);
    if (!web3) {
      throw new Error(`Web3 instance not found for ${payment.networkKey}`);
    }

    console.log(`🔍 Force checking payment ${paymentId}...`);
    await this.checkPaymentStatus(payment, web3);
  }

  // Thêm method để check tất cả payments ngay lập tức
  async forceCheckAllPayments() {
    console.log('🔍 Force checking all pending payments...');
    
    for (const [paymentId, payment] of this.pendingPayments.entries()) {
      try {
        const web3 = this.web3Instances.get(payment.networkKey);
        if (web3) {
          await this.checkPaymentStatus(payment, web3);
        }
      } catch (error) {
        console.error(`Error force checking payment ${paymentId}:`, error);
      }
    }
    
    console.log('✅ Force check completed');
  }
} 