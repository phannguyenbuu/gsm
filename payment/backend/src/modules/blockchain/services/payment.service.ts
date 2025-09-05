import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Web3 } from 'web3';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { Payment, PaymentMetadata } from '../interfaces/payment.interface';
import { BlockchainPayment as PaymentDocument } from '../schemas/blockchain.chema';
import { getNetworkConfig, getTokenConfig } from '../../../config/networks';

type PaymentStatus = 'pending' | 'pending_confirmation' | 'confirmed' | 'expired';

@Injectable()
export class PaymentService implements OnModuleInit {
  private web3: Web3;
  private readonly usdtContract: string;
  private readonly walletAddress: string;
  private usedUniqueAmounts: Set<number>;

  constructor(
    @InjectModel(PaymentDocument.name)
    private paymentModel: Model<PaymentDocument>
  ) {
    const isTestnet = process.env.NODE_ENV !== 'production';
    const networkKey = isTestnet ? 'bsc-testnet' : 'bsc';
    const networkConfig = getNetworkConfig(networkKey, isTestnet);
    const tokenConfig = getTokenConfig(networkKey, 'usdt', isTestnet);

    this.web3 = new Web3(networkConfig.rpcUrls[0]);
    this.usdtContract = tokenConfig.address;
    this.walletAddress = process.env.WALLET_ADDRESS;
    this.usedUniqueAmounts = new Set();
  }

  async onModuleInit() {
    // Clean up expired amounts from usedUniqueAmounts
    const now = new Date();
    const expiredPayments = await this.paymentModel.find({
      status: 'pending',
      expiresAt: { $lt: now }
    });

    expiredPayments.forEach(payment => {
      this.usedUniqueAmounts.delete(parseFloat(payment.amount));
    });

    // Update expired payments status
    await this.paymentModel.updateMany(
      { status: 'pending', expiresAt: { $lt: now } },
      { $set: { status: 'expired' } }
    );
  }

  private generateUniqueAmount(originalAmount: number): number {
    let attempts = 0;
    let uniqueAmount: number;
    
    do {
      const randomCents = Math.floor(Math.random() * 99) + 1;
      const centsDecimal = randomCents / 100;
      
      uniqueAmount = parseFloat((originalAmount + centsDecimal).toFixed(2));
      attempts++;
      
      if (attempts > 50) {
        const timestamp = Date.now() % 100;
        uniqueAmount = parseFloat((originalAmount + (timestamp / 100)).toFixed(2));
        break;
      }
    } while (this.usedUniqueAmounts.has(uniqueAmount));
    
    this.usedUniqueAmounts.add(uniqueAmount);
    
    setTimeout(() => {
      this.usedUniqueAmounts.delete(uniqueAmount);
    }, 24 * 60 * 60 * 1000);
    
    return uniqueAmount;
  }

  async createPayment(amount: number, orderId: string, metadata: PaymentMetadata = {}): Promise<Payment> {
    const paymentId = uuidv4();
    const expiresAt = new Date(Date.now() + (Number(process.env.PAYMENT_TIMEOUT) * 1000));
    
    const uniqueAmount = this.generateUniqueAmount(parseFloat(amount.toString()));
    
    const isTestnet = process.env.NODE_ENV !== 'production';
    const networkKey = isTestnet ? 'bsc-testnet' : 'bsc';
    const networkConfig = getNetworkConfig(networkKey, isTestnet);
    const tokenConfig = getTokenConfig(networkKey, 'usdt', isTestnet);

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

    const trustWalletUrl = this.generateTrustWalletUrl(uniqueAmount, paymentId);
    const qrCode = await this.generateQRCode(trustWalletUrl);

    paymentData.walletUrls = {
      metamask: '',
      trustWallet: trustWalletUrl,
      coinbaseWallet: '',
            direct: {
          network: networkConfig.name,
          chainId: networkConfig.chainId,
          contractAddress: tokenConfig.address,
          toAddress: this.walletAddress,
          amount: uniqueAmount,
          tokenAmount: this.web3.utils.toWei(uniqueAmount.toString(), tokenConfig.decimals === 18 ? 'ether' : 'mwei'),
          decimals: tokenConfig.decimals,
          symbol: tokenConfig.symbol
        }
    };
    paymentData.qrCode = qrCode;

    // Save to MongoDB
    const payment = new this.paymentModel(paymentData);
    await payment.save();

    // Set expiration timeout
    setTimeout(async () => {
      await this.expirePayment(paymentId);
    }, Number(process.env.PAYMENT_TIMEOUT) * 1000);

    return paymentData;
  }

  private generateTrustWalletUrl(amount: number, paymentId: string): string {
    const params = new URLSearchParams({
      address: this.walletAddress,
      amount: amount.toString(),
      token: this.usdtContract,
      memo: paymentId
    });
    
    return `trust://send?${params.toString()}`;
  }

  private async generateQRCode(data: string): Promise<string> {
    try {
      return await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      throw new Error('Failed to generate QR code');
    }
  }

  async verifyPayment(paymentId: string, txHash: string): Promise<Payment> {
    try {
      const payment = await this.paymentModel.findOne({ id: paymentId });
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'pending') {
        throw new Error('Payment already processed');
      }

      const transaction = await this.web3.eth.getTransaction(txHash);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const receipt = await this.web3.eth.getTransactionReceipt(txHash);
      if (!receipt || !receipt.status) {
        throw new Error('Transaction failed');
      }

      const isValid = await this.validateTransaction(transaction, payment.toObject() as Payment);
      if (!isValid) {
        throw new Error('Invalid transaction');
      }

      const confirmations = await this.getConfirmations(txHash);
      const newStatus: PaymentStatus = confirmations >= Number(process.env.MIN_CONFIRMATIONS) ? 'confirmed' : 'pending_confirmation';
      
      // Update payment in MongoDB
      const updatedPayment = await this.paymentModel.findOneAndUpdate(
        { id: paymentId },
        {
          $set: {
            txHash,
            confirmations,
            status: newStatus,
            verifiedAt: new Date(),
            ...(newStatus === 'confirmed' ? { confirmedAt: new Date() } : {})
          }
        },
        { new: true }
      );
      
      if (!updatedPayment) {
        throw new Error('Failed to update payment');
      }

      return updatedPayment.toObject() as Payment;
    } catch (error) {
      throw new Error(`Payment verification failed: ${error.message}`);
    }
  }

  private async validateTransaction(transaction: any, payment: Payment): Promise<boolean> {
    if (transaction.to.toLowerCase() !== this.usdtContract.toLowerCase()) {
      return false;
    }

    try {
      const decodedInput = this.web3.eth.abi.decodeParameters(
        ['address', 'uint256'],
        transaction.input.slice(10)
      );

      const toAddress = decodedInput[0] || decodedInput['0'];
      const amount = decodedInput[1] || decodedInput['1'];
      const expectedAmount = this.web3.utils.toWei(payment.amount, 'mwei');

      return (
        typeof toAddress === 'string' &&
        toAddress.toLowerCase() === this.walletAddress.toLowerCase() &&
        amount.toString() === expectedAmount.toString()
      );
    } catch (error) {
      return false;
    }
  }

  async findPaymentByAmount(amount: string): Promise<{ paymentId: string; payment: Payment } | null> {
    const payment = await this.paymentModel.findOne({
      amount,
      status: 'pending'
    });

    if (!payment) {
      return null;
    }

    return {
      paymentId: payment.id,
      payment: payment.toObject() as Payment
    };
  }

  async getConfirmations(txHash: string): Promise<number> {
    try {
      const transaction = await this.web3.eth.getTransaction(txHash);
      if (!transaction || !transaction.blockNumber) {
        return 0;
      }

      const currentBlock = await this.web3.eth.getBlockNumber();
      return Number(currentBlock) - Number(transaction.blockNumber) + 1;
    } catch (error) {
      return 0;
    }
  }

  async getPayment(paymentId: string): Promise<Payment | null> {
    const payment = await this.paymentModel.findOne({ id: paymentId });
    return payment ? payment.toObject() as Payment : null;
  }

  private async expirePayment(paymentId: string): Promise<void> {
    const payment = await this.paymentModel.findOne({ id: paymentId });
    if (payment && payment.status === 'pending') {
      payment.status = 'expired' as PaymentStatus;
      await payment.save();
      
      this.usedUniqueAmounts.delete(parseFloat(payment.amount));
    }
  }

  async getWalletBalance(): Promise<string> {
    try {
      const balance = await this.web3.eth.getBalance(this.walletAddress);
      return this.web3.utils.fromWei(balance, 'ether');
    } catch (error) {
      throw new Error('Failed to get wallet balance');
    }
  }

  async getUSDTBalance(): Promise<string> {
    try {
      const contract = new this.web3.eth.Contract([
        {
          constant: true,
          inputs: [{ name: '_owner', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: 'balance', type: 'uint256' }],
          type: 'function'
        }
      ], this.usdtContract);

      const balance = await contract.methods.balanceOf(this.walletAddress).call() as string;
      return this.web3.utils.fromWei(balance, 'mwei');
    } catch (error) {
      throw new Error('Failed to get USDT balance');
    }
  }

  async handleWebhookNotification(paymentId: string, webhookResponse: any): Promise<void> {
    await this.paymentModel.findOneAndUpdate(
      { id: paymentId },
      {
        $set: {
          webhookSentAt: new Date(),
          webhookResponse
        }
      }
    );
  }

  async checkPaymentByTxHash(txHash: string): Promise<Payment | null> {
    const payment = await this.paymentModel.findOne({ txHash });
    return payment ? payment.toObject() as Payment : null;
  }

  async updatePaymentConfirmations(paymentId: string): Promise<Payment | null> {
    const payment = await this.paymentModel.findOne({ id: paymentId });
    if (!payment || !payment.txHash) {
      return null;
    }

    const confirmations = await this.getConfirmations(payment.txHash);
    const newStatus: PaymentStatus = confirmations >= Number(process.env.MIN_CONFIRMATIONS) ? 'confirmed' : 'pending_confirmation';

    const updates: any = {
      confirmations,
      status: newStatus
    };

    if (newStatus === 'confirmed' && !payment.confirmedAt) {
      updates.confirmedAt = new Date();
    }

    const updatedPayment = await this.paymentModel.findOneAndUpdate(
      { id: paymentId },
      { $set: updates },
      { new: true }
    );

    return updatedPayment ? updatedPayment.toObject() as Payment : null;
  }
}