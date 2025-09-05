import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PaymentMetadata, WalletUrls } from '../interfaces/payment.interface';

@Schema({ timestamps: true })
export class BlockchainPayment extends Document {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  originalAmount: string;

  @Prop({ required: true })
  amount: string;

  @Prop({ required: true })
  orderId: string;

  @Prop({ required: true })
  walletAddress: string;

  @Prop({ required: true })
  contractAddress: string;

  @Prop({ required: true })
  network: string;

  @Prop({ required: true })
  networkKey: string;

  @Prop({ required: true })
  chainId: number;

  @Prop({ required: true })
  token: string;

  @Prop({ required: true })
  tokenName: string;

  @Prop({ required: true })
  decimals: number;

  @Prop({ required: true })
  blockExplorer: string;

  @Prop({ 
    required: true,
    enum: ['pending', 'pending_confirmation', 'confirmed', 'expired'],
    default: 'pending'
  })
  status: string;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: Object })
  metadata?: PaymentMetadata;

  @Prop({ type: Object })
  walletUrls?: WalletUrls;

  @Prop()
  qrCode?: string;

  @Prop()
  txHash?: string;

  @Prop()
  confirmations?: number;

  @Prop()
  verifiedAt?: Date;

  @Prop()
  confirmedAt?: Date;

  @Prop()
  webhookSentAt?: Date;

  @Prop({ type: Object })
  webhookResponse?: any;
}

export const PaymentSchema = SchemaFactory.createForClass(BlockchainPayment);

// Indexes for better query performance
PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ txHash: 1 });
PaymentSchema.index({ amount: 1 });
