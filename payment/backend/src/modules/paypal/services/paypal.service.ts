import { Inject, Injectable } from '@nestjs/common';
import {
  PAYPAL_AUTHORIZATION_SERVICE_INSTANCE_TOKEN,
  PAYPAL_AXIOS_INSTANCE_TOKEN,
  PAYPAL_MODULE_OPTIONS, PAYPAL_UTILS_SERVICE_INSTANCE_TOKEN
} from "../constants/paypal-constants";
import { AxiosInstance } from 'axios';
import { PaypalModuleOptions } from '../interfaces/paypal-module-options';
import { PaypalUtilsService } from '../services/paypal-utils.service';
import { PaypalErrorsConstants } from '../errors/paypal-errors-constants';

import { PaypalAuthorizationService } from './authorization.service';
import { PaypalDatabaseService } from './paypal-database.service';
import { AuthorizeOrderHeadersDto, CreatePaypalOrderDto, InitiateOrderHeadersDto, PaypalOrderDto } from '../dtos';
import { UpdatePaypalOrderDto } from '../dtos/order';
import { PaymentSourceResponseDto } from '../dtos/payment-source-response.dto';

@Injectable()
export class PaypalPaymentService {


  constructor(
    @Inject(PAYPAL_AXIOS_INSTANCE_TOKEN) private readonly axiosInstance: AxiosInstance,
    @Inject(PAYPAL_MODULE_OPTIONS) private readonly options: PaypalModuleOptions,
    @Inject(PAYPAL_AUTHORIZATION_SERVICE_INSTANCE_TOKEN) private paypalAuthorizationService: PaypalAuthorizationService,
    @Inject(PAYPAL_UTILS_SERVICE_INSTANCE_TOKEN) private paypalUtilsService: PaypalUtilsService,
    private paypalDatabaseService: PaypalDatabaseService,
  ) {

  }


  async _preparePaypalRequestHeaders(customHeaders?: any) {
    const initiateTokenResponse = await this.paypalAuthorizationService.getAccessToken();
    const { access_token } = initiateTokenResponse;
    return {
      'Content-Type': 'application/json',
      'Authorization': access_token ? `Bearer ${access_token}` : `Basic ${this.paypalAuthorizationService.getBasicKey()}`,
      ...customHeaders
    };
  }

  async initiateOrder(orderPayload: CreatePaypalOrderDto, headers?: InitiateOrderHeadersDto): Promise<PaypalOrderDto> {
    const _headers = await this._preparePaypalRequestHeaders(headers);
    const apiUrl = this.paypalUtilsService.getApiUrl(this.options.environment);
    
    try {
      const result = await this.axiosInstance.post(`${apiUrl}/v2/checkout/orders`, orderPayload, {
        headers: _headers
      });

      // Lưu order vào database
      if (result.data && result.data.id) {
        const purchaseUnit = orderPayload.purchase_units?.[0];
        const amount = purchaseUnit?.amount?.value ? parseFloat(purchaseUnit.amount.value) : 0;
        const currency = purchaseUnit?.amount?.currency_code || 'USD';
        const orderId = purchaseUnit?.reference_id || `ORDER_${Date.now()}`;

        console.log('Saving order to database:', {
          orderId,
          paypalOrderId: result.data.id,
          amount,
          currency,
          status: result.data.status
        });

        try {
          const savedPayment = await this.paypalDatabaseService.createPayment({
            orderId: orderId,
            paypalOrderId: result.data.id,
            amount: amount,
            currency: currency,
            status: result.data.status || 'CREATED',
            paypalResponse: result.data
          });

          console.log(`✅ Order ${result.data.id} created and saved to database successfully`);
        } catch (dbError) {
          console.error('❌ Error saving order to database:', dbError);
          // Không throw error để không ảnh hưởng đến việc tạo order PayPal
        }
      } else {
        console.warn('⚠️ No PayPal order data to save to database');
      }

      return result.data;
    } catch (e) {
      throw {
        ...PaypalErrorsConstants.INITIATE_ORDER_FAILED,
        nativeError: e?.response?.data || e
      }
    }
  }


  async updateOrder(orderId: string, updateOrderDto: UpdatePaypalOrderDto[]): Promise<{ message: string }> {
    const _headers = await this._preparePaypalRequestHeaders();
    const apiUrl = this.paypalUtilsService.getApiUrl(this.options.environment);
    return this.axiosInstance.patch(`${apiUrl}/v2/checkout/orders/${orderId}`, updateOrderDto, {
      headers: _headers
    }).then(r => {
      if (r.status === 204) {
        return {
          message: `Order updated successfully.!`
        }
      }
      return r.data;
    }).catch(e => {
      throw {
        ...PaypalErrorsConstants.UPDATE_ORDER_FAILED,
        nativeError: e?.response?.data || e
      }
    })
  }


  async getOrderDetails(orderId: string): Promise<PaypalOrderDto> {
    const headers = await this._preparePaypalRequestHeaders();
    const apiUrl = this.paypalUtilsService.getApiUrl(this.options.environment);
    return this.axiosInstance.get(
      `${apiUrl}/v2/checkout/orders/${orderId}`,
      {
        headers
      }
    ).then(r => {
      if (r.status === 200) {
        return r.data;
      }
      throw {
        message: 'Un-expected error',
        data: r.data
      }
    }).catch(e => {
      throw {
        ...PaypalErrorsConstants.GET_ORDER_FAILED,
        nativeError: e?.response?.data || e
      }
    })
  }

  async authorizePaymentForOrder(orderId: string, payload: PaymentSourceResponseDto, headers?: AuthorizeOrderHeadersDto): Promise<PaypalOrderDto> {
    const _headers = await this._preparePaypalRequestHeaders(headers);
    const apiUrl = this.paypalUtilsService.getApiUrl(this.options.environment);

    return this.axiosInstance.post(`${apiUrl}/v2/checkout/orders/${orderId}/authorize`, payload, {
      headers: _headers
    })
      .then(r => r.data)
      .catch(e => {
        throw {
          ...PaypalErrorsConstants.AUTHORIZE_ORDER_FAILED,
          nativeError: e?.response?.data || e
        }
      })
  }

  async capturePaymentForOrder(orderId: string, payload: PaymentSourceResponseDto, headers?: AuthorizeOrderHeadersDto): Promise<PaypalOrderDto> {
    const _headers = await this._preparePaypalRequestHeaders(headers);
    const apiUrl = this.paypalUtilsService.getApiUrl(this.options.environment);

    try {
      const result = await this.axiosInstance.post(`${apiUrl}/v2/checkout/orders/${orderId}/capture`, payload, {
        headers: _headers
      });

      // Cập nhật trạng thái trong database
      if (result.data && result.data.id) {
        await this.paypalDatabaseService.updatePaymentStatus(
          orderId,
          result.data.status || 'COMPLETED',
          {
            paymentDate: new Date(),
            payerId: result.data.payer?.payer_id,
            payerDetails: result.data.payer
          }
        );

        console.log(`Payment ${orderId} captured and status updated in database`);
      }

      return result.data;
    } catch (e) {
      throw {
        ...PaypalErrorsConstants.CAPTURE_ORDER_FAILED,
        nativeError: e?.response?.data || e
      }
    }
  }

  async verifyWebhookSignature(headers: any, body: any): Promise<boolean> {
    try {
      // In a real implementation, you would verify the webhook signature
      // using PayPal's webhook verification endpoint
      // For now, we'll return true for development
      console.log('Verifying webhook signature...');
      return true;
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  async handlePaymentCompleted(resource: any): Promise<void> {
    try {
      console.log('💰 Payment completed:', resource);
      
      // Extract payment details
      const paymentId = resource.id;
      const amount = resource.amount?.value;
      const currency = resource.amount?.currency_code;
      const payerId = resource.payer?.payer_id;
      const paymentDate = new Date();
      
      console.log(`📊 Payment details: ${amount} ${currency} from payer ${payerId}`);

      // Update payment status in database with immediate processing
      const updatedPayment = await this.paypalDatabaseService.updatePaymentStatus(
        paymentId,
        'COMPLETED',
        {
          paymentDate: paymentDate,
          payerId: payerId,
          payerDetails: resource.payer,
          paypalResponse: resource,
          webhookEventType: 'PAYMENT.CAPTURE.COMPLETED',
          webhookProcessedAt: new Date(),
          webhookRetryCount: 0
        }
      );

      if (updatedPayment) {
        console.log(`✅ Payment ${paymentId} updated in database successfully`);
        
        // Send immediate notification
        await this.sendPaymentNotification(updatedPayment, 'completed');
        
        // TODO: Send confirmation email to customer
        // await this.sendPaymentConfirmationEmail(updatedPayment);
        
        // TODO: Update order status in main system
        // await this.updateMainSystemOrder(updatedPayment.orderId, 'PAID');
        
        // TODO: Trigger fulfillment process
        // await this.triggerFulfillment(updatedPayment.orderId);
        
        console.log(`🎉 Payment ${paymentId} processing completed successfully`);
      } else {
        console.warn(`⚠️ Payment ${paymentId} not found in database`);
        // Retry logic for failed updates
        await this.retryPaymentUpdate(paymentId, resource);
      }
    } catch (error) {
      console.error('❌ Error handling payment completed:', error);
      // Retry mechanism for failed webhook processing
      await this.retryWebhookProcessing(resource, 'PAYMENT.CAPTURE.COMPLETED');
    }
  }

  async handlePaymentDenied(resource: any): Promise<void> {
    try {
      console.log('Payment denied:', resource);
      
      // Update payment status in database
      await this.paypalDatabaseService.updatePaymentStatus(
        resource.id,
        'FAILED',
        {
          failureReason: 'Payment denied by PayPal',
          payerId: resource.payer?.payer_id
        }
      );

      // TODO: Send failure notification
      // TODO: Update order status in main system
      console.log(`Payment ${resource.id} marked as denied`);
    } catch (error) {
      console.error('Error handling payment denied:', error);
    }
  }

  async handlePaymentRefunded(resource: any): Promise<void> {
    try {
      console.log('Payment refunded:', resource);
      
      // Update payment status in database
      await this.paypalDatabaseService.refundPayment(
        resource.id,
        resource
      );

      // TODO: Process refund logic
      // TODO: Update order status in main system
      console.log(`Payment ${resource.id} marked as refunded`);
    } catch (error) {
      console.error('Error handling payment refunded:', error);
    }
  }

  async handleOrderApproved(resource: any): Promise<void> {
    try {
      console.log('Order approved:', resource);
      
      // Update order status in database
      await this.paypalDatabaseService.updatePaymentStatus(
        resource.id,
        'APPROVED',
        {
          payerId: resource.payer?.payer_id,
          payerDetails: resource.payer
        }
      );

      // TODO: Prepare for payment capture
      console.log(`Order ${resource.id} marked as approved`);
    } catch (error) {
      console.error('Error handling order approved:', error);
    }
  }

  async handleOrderCompleted(resource: any): Promise<void> {
    try {
      console.log('🎉 Order completed:', resource);
      
      // Update order status in database
      await this.paypalDatabaseService.updatePaymentStatus(
        resource.id,
        'COMPLETED',
        {
          paymentDate: new Date(),
          payerId: resource.payer?.payer_id,
          payerDetails: resource.payer
        }
      );

      // TODO: Send completion notification
      // TODO: Process fulfillment
      console.log(`✅ Order ${resource.id} marked as completed`);
    } catch (error) {
      console.error('❌ Error handling order completed:', error);
    }
  }

  async handleOrderCancelled(resource: any): Promise<void> {
    try {
      console.log('❌ Order cancelled:', resource);
      
      // Update order status in database
      await this.paypalDatabaseService.updatePaymentStatus(
        resource.id,
        'CANCELLED',
        {
          failureReason: 'Order cancelled by user',
          payerId: resource.payer?.payer_id
        }
      );

      // TODO: Send cancellation notification
      console.log(`✅ Order ${resource.id} marked as cancelled`);
    } catch (error) {
      console.error('❌ Error handling order cancelled:', error);
    }
  }

  async handlePaymentPending(resource: any): Promise<void> {
    try {
      console.log('⏳ Payment pending:', resource);
      
      // Update payment status in database
      await this.paypalDatabaseService.updatePaymentStatus(
        resource.id,
        'PENDING',
        {
          payerId: resource.payer?.payer_id,
          payerDetails: resource.payer
        }
      );

      // TODO: Send pending notification
      console.log(`✅ Payment ${resource.id} marked as pending`);
    } catch (error) {
      console.error('❌ Error handling payment pending:', error);
    }
  }

  // Database operations
  async getAllPayments(limit: number, skip: number): Promise<any[]> {
    return await this.paypalDatabaseService.getAllPayments(limit, skip);
  }

  async getPaymentsByStatus(status: string, limit: number, skip: number): Promise<any[]> {
    return await this.paypalDatabaseService.getPaymentsByStatus(status);
  }

  async getPaymentByOrderId(orderId: string): Promise<any> {
    return await this.paypalDatabaseService.getPaymentByOrderId(orderId);
  }

  async getPaymentStatistics(): Promise<any> {
    return await this.paypalDatabaseService.getPaymentStatistics();
  }

  // Thêm retry mechanism cho webhook processing
  private async retryWebhookProcessing(resource: any, eventType: string, retryCount = 0) {
    const maxRetries = 3;
    const retryDelay = 5000; // 5 seconds

    if (retryCount >= maxRetries) {
      console.error(`❌ Max retries exceeded for webhook processing: ${eventType}`);
      await this.sendErrorNotification('Webhook processing failed after max retries', {
        eventType,
        resource,
        retryCount
      });
      return;
    }

    try {
      console.log(`🔄 Retrying webhook processing (attempt ${retryCount + 1}/${maxRetries})`);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      // Retry the webhook processing
      switch (eventType) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          await this.handlePaymentCompleted(resource);
          break;
        case 'CHECKOUT.ORDER.COMPLETED':
          await this.handleOrderCompleted(resource);
          break;
        default:
          console.warn(`Unknown event type for retry: ${eventType}`);
      }
    } catch (error) {
      console.error(`❌ Retry ${retryCount + 1} failed:`, error);
      // Recursive retry
      await this.retryWebhookProcessing(resource, eventType, retryCount + 1);
    }
  }

  // Thêm retry mechanism cho payment update
  private async retryPaymentUpdate(paymentId: string, resource: any, retryCount = 0) {
    const maxRetries = 3;
    const retryDelay = 3000; // 3 seconds

    if (retryCount >= maxRetries) {
      console.error(`❌ Max retries exceeded for payment update: ${paymentId}`);
      return;
    }

    try {
      console.log(`🔄 Retrying payment update (attempt ${retryCount + 1}/${maxRetries})`);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      // Retry the update
      const updatedPayment = await this.paypalDatabaseService.updatePaymentStatus(
        paymentId,
        'COMPLETED',
        {
          paymentDate: new Date(),
          payerId: resource.payer?.payer_id,
          payerDetails: resource.payer,
          paypalResponse: resource,
          webhookEventType: 'PAYMENT.CAPTURE.COMPLETED',
          webhookProcessedAt: new Date(),
          webhookRetryCount: retryCount + 1
        }
      );

      if (updatedPayment) {
        console.log(`✅ Payment ${paymentId} updated successfully on retry ${retryCount + 1}`);
        await this.sendPaymentNotification(updatedPayment, 'completed');
      } else {
        // Recursive retry
        await this.retryPaymentUpdate(paymentId, resource, retryCount + 1);
      }
    } catch (error) {
      console.error(`❌ Retry ${retryCount + 1} failed for payment update:`, error);
      // Recursive retry
      await this.retryPaymentUpdate(paymentId, resource, retryCount + 1);
    }
  }

  // Thêm notification system
  private async sendPaymentNotification(payment: any, status: string) {
    try {
      console.log(`📢 Sending payment notification: ${payment.orderId} - ${status}`);
      
      // TODO: Implement real notification system (email, SMS, push notification)
      // For now, just log the notification
      console.log(`🔔 Payment ${status.toUpperCase()}: ${payment.orderId}`);
      console.log(`   Amount: ${payment.amount} ${payment.currency}`);
      console.log(`   Status: ${payment.status}`);
      console.log(`   Time: ${new Date().toISOString()}`);
      
    } catch (error) {
      console.error('❌ Error sending payment notification:', error);
    }
  }

  // Thêm error notification system
  private async sendErrorNotification(message: string, details: any) {
    try {
      console.error(`🚨 Error Notification: ${message}`, details);
      
      // TODO: Implement error notification system
      // For now, just log the error
      console.error(`🔔 Error Alert: ${message}`);
      console.error(`   Details:`, details);
      console.error(`   Time: ${new Date().toISOString()}`);
      
    } catch (error) {
      console.error('❌ Error sending error notification:', error);
    }
  }
}