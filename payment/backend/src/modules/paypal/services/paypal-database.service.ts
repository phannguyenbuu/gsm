import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaypalPayment, PaypalPaymentDocument } from '../schemas/paypal-payment.schema';

@Injectable()
export class PaypalDatabaseService {
  constructor(
    @InjectModel(PaypalPayment.name) private paypalPaymentModel: Model<PaypalPaymentDocument>,
  ) {}

  async createPayment(paymentData: {
    orderId: string;
    paypalOrderId: string;
    amount: number;
    currency: string;
    status: string;
    paypalResponse?: any;
  }): Promise<PaypalPayment> {
    const payment = new this.paypalPaymentModel(paymentData);
    return await payment.save();
  }

  async updatePaymentStatus(
    paypalOrderId: string,
    status: string,
    additionalData?: any
  ): Promise<PaypalPayment | null> {
    const updateData: any = { 
      status,
      updatedAt: new Date(),
      webhookProcessed: true,
      webhookProcessedAt: new Date()
    };
    
    if (additionalData) {
      if (additionalData.paymentDate) {
        updateData.paymentDate = additionalData.paymentDate;
      }
      if (additionalData.payerId) {
        updateData.payerId = additionalData.payerId;
      }
      if (additionalData.payerDetails) {
        updateData.payerDetails = additionalData.payerDetails;
      }
      if (additionalData.failureReason) {
        updateData.failureReason = additionalData.failureReason;
      }
      if (additionalData.paypalResponse) {
        updateData.paypalResponse = additionalData.paypalResponse;
      }
      if (additionalData.webhookEventType) {
        updateData.webhookEventType = additionalData.webhookEventType;
      }
      if (additionalData.webhookData) {
        updateData.webhookData = additionalData.webhookData;
      }
    }

    console.log(`🔄 Updating payment ${paypalOrderId} to status: ${status}`);

    const updatedPayment = await this.paypalPaymentModel.findOneAndUpdate(
      { paypalOrderId },
      updateData,
      { new: true }
    );

    if (updatedPayment) {
      console.log(`✅ Payment ${paypalOrderId} updated successfully to ${status}`);
    } else {
      console.warn(`⚠️ Payment ${paypalOrderId} not found for status update`);
    }

    return updatedPayment;
  }

  async getPaymentByPaypalOrderId(paypalOrderId: string): Promise<PaypalPayment | null> {
    return await this.paypalPaymentModel.findOne({ paypalOrderId }).exec();
  }

  async getPaymentByOrderId(orderId: string): Promise<PaypalPayment | null> {
    return await this.paypalPaymentModel.findOne({ orderId }).exec();
  }

  async getAllPayments(limit = 50, skip = 0): Promise<PaypalPayment[]> {
    return await this.paypalPaymentModel
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .exec();
  }

  async getPaymentsByStatus(status: string): Promise<PaypalPayment[]> {
    return await this.paypalPaymentModel.find({ status }).exec();
  }

  async refundPayment(
    paypalOrderId: string,
    refundDetails: any
  ): Promise<PaypalPayment | null> {
    return await this.paypalPaymentModel.findOneAndUpdate(
      { paypalOrderId },
      {
        isRefunded: true,
        refundDate: new Date(),
        refundDetails,
        status: 'REFUNDED'
      },
      { new: true }
    );
  }

  async getPaymentStatistics(): Promise<{
    total: number;
    completed: number;
    pending: number;
    failed: number;
    refunded: number;
    totalAmount: number;
  }> {
    const stats = await this.paypalPaymentModel.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
          },
          pending: {
            $sum: { $cond: [{ $in: ['$status', ['CREATED', 'APPROVED']] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] }
          },
          refunded: {
            $sum: { $cond: [{ $eq: ['$status', 'REFUNDED'] }, 1, 0] }
          }
        }
      }
    ]);

    return stats[0] || {
      total: 0,
      completed: 0,
      pending: 0,
      failed: 0,
      refunded: 0,
      totalAmount: 0
    };
  }
} 