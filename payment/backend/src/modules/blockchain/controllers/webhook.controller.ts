import { Controller, Post, Body, Headers, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { MultiChainPaymentService } from '../services/multi-chain-payment.service';
import { WebhookSignatureGuard } from '../guards/webhook-signature.guard';

@Controller('blockchainapi/webhook')
export class WebhookController {
  constructor(private readonly multiChainPaymentService: MultiChainPaymentService) {}

  @Post('payment-confirmed')
  @UseGuards(WebhookSignatureGuard)
  async handlePaymentConfirmed(
    @Body() body: { paymentId: string; txHash: string; confirmations: number }
  ) {
    try {
      console.log('Received payment confirmation webhook:', body);
      const { paymentId, txHash, confirmations } = body;
      
      const payment = await this.multiChainPaymentService.getPayment(paymentId);
      if (!payment) {
        console.log(`Payment not found: ${paymentId}`);
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }

      console.log('Found payment:', {
        id: paymentId,
        status: payment.status,
        network: payment.network,
        token: payment.token,
        amount: payment.amount,
        originalAmount: payment.originalAmount
      });

      const networkConfig = this.multiChainPaymentService.getNetworkInfo(payment.networkKey);
      console.log('Network config:', {
        name: networkConfig.name,
        minConfirmations: networkConfig.minConfirmations,
        currentConfirmations: confirmations
      });
      
      if (confirmations >= networkConfig.minConfirmations) {
        payment.status = 'confirmed';
        payment.confirmations = confirmations;
        payment.confirmedAt = new Date();
        
        console.log(`Payment ${paymentId} confirmed with ${confirmations} confirmations`);
        console.log(`Network: ${payment.network}, Token: ${payment.token}`);
        console.log(`Original amount: $${payment.originalAmount}, Paid: ${payment.amount} ${payment.token}`);
        console.log(`Transaction hash: ${txHash}`);
        console.log(`Block explorer: ${payment.blockExplorer}/tx/${txHash}`);
      } else {
        console.log(`Payment ${paymentId} needs more confirmations (${confirmations}/${networkConfig.minConfirmations})`);
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Webhook error:', error);
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('transaction-notification')
  @UseGuards(WebhookSignatureGuard)
  async handleTransactionNotification(
    @Body() body: { 
      txHash: string; 
      toAddress: string; 
      amount: string; 
      token: string; 
      network?: string; 
      chainId?: number 
    }
  ) {
    try {
      console.log('Received transaction notification webhook:', body);
      const { txHash, toAddress, amount, token, network, chainId } = body;
      
      if (toAddress.toLowerCase() === process.env.WALLET_ADDRESS.toLowerCase()) {
        console.log(`📥 New transaction received: ${txHash}`);
        console.log(`Network: ${network || 'Unknown'}, Token: ${token}, Amount: ${amount}`);
        
        // Try to find matching payment by amount
        let matchingPayment = null;
        
        // If network is provided, search in that network
        if (network) {
          console.log(`Searching for payment in network: ${network}`);
          matchingPayment = this.multiChainPaymentService.findPaymentByAmount(amount, network, 'usdt');
          if (!matchingPayment) {
            matchingPayment = this.multiChainPaymentService.findPaymentByAmount(amount, network, 'usdc');
          }
        } else {
          // Search across all networks
          console.log('Searching for payment across all networks');
          const supportedNetworks = this.multiChainPaymentService.getSupportedNetworks();
          for (const networkKey of supportedNetworks) {
            matchingPayment = this.multiChainPaymentService.findPaymentByAmount(amount, networkKey, 'usdt');
            if (matchingPayment) break;
            
            matchingPayment = this.multiChainPaymentService.findPaymentByAmount(amount, networkKey, 'usdc');
            if (matchingPayment) break;
          }
        }
        
        if (matchingPayment) {
          const { paymentId, payment } = matchingPayment;
          console.log('Found matching payment:', {
            id: paymentId,
            network: payment.network,
            token: payment.token,
            amount: payment.amount,
            originalAmount: payment.originalAmount
          });
          
          try {
            await this.multiChainPaymentService.verifyPayment(paymentId, txHash);
            console.log(`Auto-verified payment ${paymentId}`);
            console.log(`Network: ${payment.network}, Token: ${payment.token}`);
            console.log(`Original amount: $${payment.originalAmount}, Paid: ${payment.amount} ${payment.token}`);
            console.log(`Transaction hash: ${txHash}`);
            console.log(`Block explorer: ${payment.blockExplorer}/tx/${txHash}`);
          } catch (error) {
            console.error(`❌ Auto-verification failed for ${paymentId}:`, error.message);
          }
        } else {
          console.log(`❓ No matching pending payment found for amount: ${amount}`);
          
          console.log('Current pending payments:');
          for (const [id, payment] of this.multiChainPaymentService['pendingPayments']) {
            if (payment.status === 'pending') {
              console.log(`- ID: ${id}`);
              console.log(`  Amount: ${payment.amount} ${payment.token}`);
              console.log(`  Network: ${payment.network}`);
              console.log(`  Original: $${payment.originalAmount}`);
            }
          }
        }
      } else {
        console.log(`⚠️ Transaction to different address: ${toAddress}`);
        console.log(`Expected address: ${process.env.WALLET_ADDRESS}`);
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Transaction notification error:', error);
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}