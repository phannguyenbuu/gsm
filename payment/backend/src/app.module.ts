import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BlockchainModule } from './modules/blockchain/blockchain.module';
import { CommonModule } from './modules/common/common.module';
import { DatabaseModule } from './database/database.module';
import { PayPalModule } from './modules/paypal/paypal.module';

@Module({
  imports: [
    // Đọc biến môi trường từ file `.env`
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Import các module
    DatabaseModule,
    BlockchainModule,
    PayPalModule,
    CommonModule,
  ],
})
export class AppModule {}