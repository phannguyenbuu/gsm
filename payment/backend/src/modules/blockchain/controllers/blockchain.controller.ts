// import { Controller, Get, Post } from '@nestjs/common';
// import { MultiChainPaymentService } from '../services/multi-chain-payment.service';

// @Controller('blockchainapi')
// export class BlockchainController {
//   constructor(private readonly multiChainPaymentService: MultiChainPaymentService) {}

//   @Get('payments')
//   async getPayments() {
//     try {
//       const payments = Array.from(this.multiChainPaymentService['pendingPayments'].values())
//         .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

//       return payments.map(payment => ({
//         id: payment.id,
//         orderId: payment.orderId,
//         networkKey: payment.networkKey,
//         network: payment.network,
//         token: payment.token,
//         amount: payment.amount,
//         originalAmount: payment.originalAmount,
//         walletAddress: payment.walletAddress,
//         status: payment.status,
//         txHash: payment.txHash,
//         confirmations: payment.confirmations,
//         createdAt: payment.createdAt,
//         expiresAt: payment.expiresAt,
//         blockExplorer: payment.blockExplorer
//       }));
//     } catch (error) {
//       throw new Error(error.message);
//     }
//   }

//   @Get('monitoring/status')
//   async getMonitoringStatus() {
//     try {
//       const status = this.multiChainPaymentService.getMonitoringStatus();
//       return status;
//     } catch (error) {
//       throw new Error(error.message);
//     }
//   }

//   @Post('monitoring/refresh')
//   async refreshMonitoring() {
//     try {
//       const status = await this.multiChainPaymentService.refreshMonitoring();
//       return status;
//     } catch (error) {
//       throw new Error(error.message);
//     }
//   }

//   @Post('monitoring/force-check-all')
//   async forceCheckAllPayments() {
//     try {
//       console.log('🔍 Force checking all pending payments...');
//       await this.multiChainPaymentService.forceCheckAllPayments();
//       return { success: true, message: 'Force check completed' };
//     } catch (error) {
//       console.error('Error force checking payments:', error);
//       throw new Error('Failed to force check payments');
//     }
//   }
// } 