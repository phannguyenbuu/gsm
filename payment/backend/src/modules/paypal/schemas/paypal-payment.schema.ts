import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PaypalPaymentDocument = PaypalPayment & Document;

@Schema({ timestamps: true })
export class PaypalPayment {
  @Prop({ required: true, unique: true })
  orderId: string;

  @Prop({ required: true, unique: true })
  paypalOrderId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, default: 'USD' })
  currency: string;

  @Prop({ 
    required: true, 
    enum: ['CREATED', 'APPROVED', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED', 'PENDING'],
    default: 'CREATED' 
  })
  status: string;

  @Prop()
  paymentDate?: Date;

  @Prop()
  payerId?: string;

  @Prop({ type: Object })
  payerDetails?: any;

  @Prop()
  failureReason?: string;

  @Prop({ default: false })
  isRefunded: boolean;

  @Prop()
  refundDate?: Date;

  @Prop({ type: Object })
  refundDetails?: any;

  @Prop({ type: Object })
  paypalResponse?: any;

  // Webhook tracking fields
  @Prop({ default: false })
  webhookProcessed: boolean;

  @Prop()
  webhookProcessedAt?: Date;

  @Prop()
  webhookEventType?: string;

  @Prop({ type: Object })
  webhookData?: any;

  @Prop({ default: 0 })
  webhookRetryCount: number;

  @Prop()
  lastWebhookAttempt?: Date;

  @Prop()
  webhookError?: string;
}

export const PaypalPaymentSchema = SchemaFactory.createForClass(PaypalPayment);