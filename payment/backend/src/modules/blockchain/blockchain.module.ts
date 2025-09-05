import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentController } from './controllers/payment.controller';
import { WebhookController } from './controllers/webhook.controller';
import { ApiKeysController } from './controllers/api-keys.controller';
// import { BlockchainController } from './controllers/blockchain.controller';
import { PaymentService } from './services/payment.service';
import { MultiChainPaymentService } from './services/multi-chain-payment.service';
import { BlockchainMonitorService } from './services/blockchain-monitor.service';
import { ApiKeyService } from './services/api-key.service';
import { BlockchainPayment, PaymentSchema } from './schemas/blockchain.chema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BlockchainPayment.name, schema: PaymentSchema }
    ])
  ],
  controllers: [
    PaymentController,
    WebhookController,
    ApiKeysController,
    // BlockchainController
  ],
  providers: [
    PaymentService,
    {
      provide: MultiChainPaymentService,
      useClass: MultiChainPaymentService
    },
    {
      provide: BlockchainMonitorService,
      useClass: BlockchainMonitorService
    },
    ApiKeyService
  ],
  exports: [
    PaymentService,
    MultiChainPaymentService,
    BlockchainMonitorService,
    ApiKeyService
  ]
})
export class BlockchainModule {}