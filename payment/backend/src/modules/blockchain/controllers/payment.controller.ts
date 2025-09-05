import { Controller, Post, Get, Body, Param, Query, UseGuards, Req, HttpException, HttpStatus } from '@nestjs/common';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { AdminGuard } from '../guards/admin.guard';
import { MultiChainPaymentService } from '../services/multi-chain-payment.service';
import { PaymentRequest } from '../interfaces/payment.interface';
import { validatePaymentRequest, validateVerificationRequest } from '../validators/payment.validator';
import { RequirePermission } from '../decorators/permission.decorator';

@Controller('blockchainapi')
@UseGuards(ApiKeyGuard)
export class PaymentController {
  constructor(private readonly multiChainPaymentService: MultiChainPaymentService) {}

  @Post('create')
  @RequirePermission('payment:create')
  async createPayment(@Body() body: PaymentRequest, @Req() req: any) {
    try {
      const { error } = validatePaymentRequest(body);
      if (error) {
        throw new HttpException(error.details[0].message, HttpStatus.BAD_REQUEST);
      }

      const { amount, orderId, network = 'ethereum', token = 'usdt', metadata } = body;
      
      const enhancedMetadata = {
        ...metadata,
        apiKeyName: req.apiKey.name,
        requestedBy: req.apiKey.key.substring(0, 8) + '...',
        requestedAt: new Date().toISOString()
      };

      const payment = await this.multiChainPaymentService.createPayment(
        amount, 
        orderId, 
        network, 
        token, 
        enhancedMetadata
      );

      return {
        success: true,
        data: {
          paymentId: payment.id,
          originalAmount: payment.originalAmount,
          amount: payment.amount,
          walletAddress: payment.walletAddress,
          contractAddress: payment.contractAddress,
          network: payment.network,
          networkKey: payment.networkKey,
          chainId: payment.chainId,
          token: payment.token,
          tokenName: payment.tokenName,
          decimals: payment.decimals,
          blockExplorer: payment.blockExplorer,
          walletUrls: payment.walletUrls,
          qrCode: payment.qrCode,
          expiresAt: payment.expiresAt,
          note: `Please pay exactly ${payment.amount} ${payment.token} (${payment.originalAmount} + unique identifier)`,
          instructions: [
            `1. Send exactly ${payment.amount} ${payment.token} to the provided wallet address`,
            `2. Use ${payment.network} network (Chain ID: ${payment.chainId})`,
            `3. Token contract: ${payment.contractAddress}`,
            `4. Payment expires at ${payment.expiresAt}`,
            `5. You can use the provided wallet URLs for easy payment`
          ]
        }
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('verify')
  @RequirePermission('payment:verify')
  async verifyPayment(@Body() body: { paymentId: string; txHash: string }, @Req() req: any) {
    try {
      const { error } = validateVerificationRequest(body);
      if (error) {
        throw new HttpException(error.details[0].message, HttpStatus.BAD_REQUEST);
      }

      const { paymentId, txHash } = body;
      
      console.log(`Payment verification requested by ${req.apiKey.name} for payment ${paymentId}`);
      
      const payment = await this.multiChainPaymentService.verifyPayment(paymentId, txHash);

      return {
        success: true,
        data: {
          paymentId: payment.id,
          originalAmount: payment.originalAmount,
          paidAmount: payment.amount,
          status: payment.status,
          txHash: payment.txHash,
          confirmations: payment.confirmations,
          verifiedAt: payment.verifiedAt,
          network: payment.network,
          token: payment.token,
          blockExplorer: `${payment.blockExplorer}/tx/${payment.txHash}`,
          message: payment.status === 'confirmed' 
            ? 'Payment confirmed successfully' 
            : `Payment verified but waiting for confirmations (${payment.confirmations} confirmations received)`
        }
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('status/:paymentId')
  @RequirePermission('payment:status')
  async getPaymentStatus(@Param('paymentId') paymentId: string, @Req() req: any) {
    try {
      const payment = await this.multiChainPaymentService.getPayment(paymentId);

      if (!payment) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }

      if (!req.apiKey.permissions.includes('admin')) {
        const paymentMetadata = payment.metadata || {};
        const requestedBy = req.apiKey.key.substring(0, 8) + '...';
        
        if (paymentMetadata.requestedBy !== requestedBy) {
          throw new HttpException('Access denied to this payment', HttpStatus.FORBIDDEN);
        }
      }

      return {
        success: true,
        data: {
          paymentId: payment.id,
          status: payment.status,
          originalAmount: payment.originalAmount,
          amount: payment.amount,
          orderId: payment.orderId,
          createdAt: payment.createdAt,
          expiresAt: payment.expiresAt,
          txHash: payment.txHash,
          confirmations: payment.confirmations,
          verifiedAt: payment.verifiedAt,
          network: payment.network,
          networkKey: payment.networkKey,
          chainId: payment.chainId,
          token: payment.token,
          tokenName: payment.tokenName,
          contractAddress: payment.contractAddress,
          blockExplorer: payment.blockExplorer,
          walletUrls: payment.walletUrls
        }
      };
    } catch (error) {
      throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('monitoring/status')
  @RequirePermission('payment:status')
  async getMonitoringStatus(@Req() req: any) {
    try {
      const status = this.multiChainPaymentService.getMonitoringStatus();
      
      return {
        success: true,
        data: status
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('monitoring/check/:paymentId')
  @RequirePermission('payment:status')
  async manualCheckPayment(@Param('paymentId') paymentId: string, @Req() req: any) {
    try {
      await this.multiChainPaymentService.manualCheckPayment(paymentId);
      
      return {
        success: true,
        message: 'Manual check completed'
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('monitoring/refresh')
  @RequirePermission('payment:status')
  async refreshMonitoring(@Req() req: any) {
    try {
      const status = await this.multiChainPaymentService.refreshMonitoring();
      
      return {
        success: true,
        message: 'Monitoring refreshed successfully',
        data: status
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('monitoring/force-refresh')
  @RequirePermission('payment:status')
  async forceRefreshMonitoring(@Req() req: any) {
    try {
      const status = await this.multiChainPaymentService.forceRefreshMonitoring();
      
      return {
        success: true,
        message: 'Monitoring force refreshed successfully',
        data: status
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('monitoring/remove-confirmed')
  @RequirePermission('payment:status')
  async removeConfirmedPayments(@Req() req: any) {
    try {
      const status = await this.multiChainPaymentService.removeConfirmedPayments();
      
      return {
        success: true,
        message: 'Confirmed payments removed from monitoring successfully',
        data: status
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('monitoring/force-check-all')
  @RequirePermission('payment:status')
  async forceCheckAllPayments(@Req() req: any) {
    try {
      console.log('🔍 Force checking all pending payments...');
      await this.multiChainPaymentService.forceCheckAllPayments();
      return { success: true, message: 'Force check completed' };
    } catch (error) {
      console.error('Error force checking payments:', error);
      throw new HttpException('Failed to force check payments', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('monitoring/force-check/:paymentId')
  @RequirePermission('payment:status')
  async forceCheckPayment(@Param('paymentId') paymentId: string, @Req() req: any) {
    try {
      console.log(`🔍 Force checking payment ${paymentId}...`);
      await this.multiChainPaymentService.forceCheckPayment(paymentId);
      return { success: true, message: `Force check completed for payment ${paymentId}` };
    } catch (error) {
      console.error(`Error force checking payment ${paymentId}:`, error);
      throw new HttpException('Failed to force check payment', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('monitoring/detailed-stats')
  @RequirePermission('payment:status')
  async getDetailedMonitoringStats(@Req() req: any) {
    try {
      const stats = this.multiChainPaymentService.getDetailedMonitoringStats();
      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('Error getting detailed monitoring stats:', error);
      throw new HttpException('Failed to get detailed monitoring stats', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('monitoring/check-transaction')
  @RequirePermission('payment:status')
  async checkTransaction(@Body() body: { txHash: string; networkKey: string }, @Req() req: any) {
    try {
      const { txHash, networkKey } = body;
      
      if (!txHash || !networkKey) {
        throw new HttpException('txHash and networkKey are required', HttpStatus.BAD_REQUEST);
      }

      const receipt = await this.multiChainPaymentService.checkTransactionByHash(txHash, networkKey);
      
      return {
        success: true,
        data: {
          txHash,
          networkKey,
          receipt,
          status: receipt ? 'confirmed' : 'not_found'
        }
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('verify-transaction-details')
  @RequirePermission('payment:verify')
  async verifyTransactionDetails(@Body() body: { txHash: string; paymentId: string }, @Req() req: any) {
    try {
      const { txHash, paymentId } = body;
      
      if (!txHash || !paymentId) {
        throw new HttpException('txHash and paymentId are required', HttpStatus.BAD_REQUEST);
      }

      console.log(` Transaction verification requested by ${req.apiKey.name} for payment ${paymentId} with tx ${txHash}`);
      
      const verificationResult = await this.multiChainPaymentService.verifyTransactionDetails(txHash, paymentId);
      
      if (verificationResult.isValid) {
        // If verification is successful, automatically verify the payment
        try {
          await this.multiChainPaymentService.verifyPayment(paymentId, txHash);
          console.log(`Payment ${paymentId} automatically verified after transaction verification`);
        } catch (verifyError) {
          console.warn(`⚠️ Auto-verification failed for ${paymentId}:`, verifyError.message);
        }
      }
      
      return {
        success: true,
        data: verificationResult
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('balance')
  @RequirePermission('payment:balance')
  async getBalance(@Query('network') network?: string) {
    try {
      if (network) {
        const balances = await this.multiChainPaymentService.getAllBalances();
        const networkBalance = balances[network];
        
        if (!networkBalance) {
          throw new HttpException(`Network ${network} not supported or not available`, HttpStatus.NOT_FOUND);
        }
        
        return {
          success: true,
          data: {
            walletAddress: process.env.WALLET_ADDRESS,
            network: networkBalance.network,
            chainId: networkBalance.chainId,
            balances: {
              native: networkBalance.native.native,
              tokens: networkBalance.tokens
            },
            lastUpdated: new Date().toISOString()
          }
        };
      } else {
        const allBalances = await this.multiChainPaymentService.getAllBalances();
        
        return {
          success: true,
          data: {
            walletAddress: process.env.WALLET_ADDRESS,
            networks: allBalances,
            lastUpdated: new Date().toISOString()
          }
        };
      }
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('list')
  @UseGuards(AdminGuard)
  async listPayments(
    @Query('status') status?: string,
    @Query('network') network?: string,
    @Query('token') token?: string,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0'
  ) {
    try {
      const payments = Array.from(this.multiChainPaymentService['pendingPayments'].values())
        .filter(payment => {
          if (status && payment.status !== status) return false;
          if (network && payment.networkKey !== network) return false;
          if (token && payment.token.toLowerCase() !== token.toLowerCase()) return false;
          return true;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(Number(offset), Number(offset) + Number(limit));

      const total = Array.from(this.multiChainPaymentService['pendingPayments'].values())
        .filter(payment => {
          if (status && payment.status !== status) return false;
          if (network && payment.networkKey !== network) return false;
          if (token && payment.token.toLowerCase() !== token.toLowerCase()) return false;
          return true;
        }).length;

      return {
        success: true,
        data: {
          payments: payments.map(payment => ({
            paymentId: payment.id,
            status: payment.status,
            originalAmount: payment.originalAmount,
            amount: payment.amount,
            orderId: payment.orderId,
            createdAt: payment.createdAt,
            expiresAt: payment.expiresAt,
            txHash: payment.txHash,
            confirmations: payment.confirmations,
            network: payment.network,
            networkKey: payment.networkKey,
            chainId: payment.chainId,
            token: payment.token,
            tokenName: payment.tokenName,
            contractAddress: payment.contractAddress,
            metadata: payment.metadata
          })),
          pagination: {
            total,
            limit: Number(limit),
            offset: Number(offset),
            hasMore: (Number(offset) + Number(limit)) < total
          }
        }
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('payments')
  @UseGuards(AdminGuard)
  async getAllPayments() {
    try {
      const payments = Array.from(this.multiChainPaymentService['pendingPayments'].values())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return payments.map(payment => ({
        id: payment.id,
        orderId: payment.orderId,
        networkKey: payment.networkKey,
        network: payment.network,
        token: payment.token,
        amount: payment.amount,
        originalAmount: payment.originalAmount,
        walletAddress: payment.walletAddress,
        status: payment.status,
        txHash: payment.txHash,
        confirmations: payment.confirmations,
        createdAt: payment.createdAt,
        expiresAt: payment.expiresAt,
        blockExplorer: payment.blockExplorer
      }));
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('networks')
  @RequirePermission('payment:status')
  async getNetworks() {
    try {
      const supportedNetworks = this.multiChainPaymentService.getSupportedNetworks();
      const networksInfo = {};
      
      for (const networkKey of supportedNetworks) {
        try {
          networksInfo[networkKey] = this.multiChainPaymentService.getNetworkInfo(networkKey);
        } catch (error) {
          console.warn(`Failed to get info for ${networkKey}:`, error.message);
        }
      }
      
      return {
        success: true,
        data: {
          supported: supportedNetworks,
          details: networksInfo,
          isTestnet: process.env.NODE_ENV !== 'production'
        }
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('networks/:networkKey')
  @RequirePermission('payment:status')
  async getNetworkInfo(@Param('networkKey') networkKey: string) {
    try {
      const networkInfo = this.multiChainPaymentService.getNetworkInfo(networkKey);
      const supportedTokens = this.multiChainPaymentService.getSupportedTokens(networkKey);
      
      return {
        success: true,
        data: {
          ...networkInfo,
          supportedTokens
        }
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('tokens/:networkKey')
  @RequirePermission('payment:status')
  async getNetworkTokens(@Param('networkKey') networkKey: string) {
    try {
      const supportedTokens = this.multiChainPaymentService.getSupportedTokens(networkKey);
      const networkInfo = this.multiChainPaymentService.getNetworkInfo(networkKey);
      
      return {
        success: true,
        data: {
          network: networkInfo.name,
          chainId: networkInfo.chainId,
          supportedTokens,
          tokens: networkInfo.tokens
        }
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('blockchain/payments')
  async getBlockchainPayments() {
    try {
      const payments = Array.from(this.multiChainPaymentService['pendingPayments'].values())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return payments.map(payment => ({
        id: payment.id,
        orderId: payment.orderId,
        networkKey: payment.networkKey,
        network: payment.network,
        token: payment.token,
        amount: payment.amount,
        originalAmount: payment.originalAmount,
        walletAddress: payment.walletAddress,
        status: payment.status,
        txHash: payment.txHash,
        confirmations: payment.confirmations,
        createdAt: payment.createdAt,
        expiresAt: payment.expiresAt,
        blockExplorer: payment.blockExplorer
      }));
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('blockchain/monitoring/status')
  async getBlockchainMonitoringStatus() {
    try {
      const status = this.multiChainPaymentService.getMonitoringStatus();
      return status;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('blockchain/monitoring/refresh')
  async refreshBlockchainMonitoring() {
    try {
      const status = await this.multiChainPaymentService.refreshMonitoring();
      return status;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('blockchain/monitoring/force-check-all')
  async forceCheckAllBlockchainPayments() {
    try {
      console.log('🔍 Force checking all pending payments...');
      await this.multiChainPaymentService.forceCheckAllPayments();
      return { success: true, message: 'Force check completed' };
    } catch (error) {
      console.error('Error force checking payments:', error);
      throw new HttpException('Failed to force check payments', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}