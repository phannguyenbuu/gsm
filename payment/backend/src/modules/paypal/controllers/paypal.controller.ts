import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { PaypalPaymentService } from '../services/paypal.service';
import { CreatePaypalOrderDto } from '../dtos';

@Controller('paypalsapi')
export class PaypalController {
  constructor(private readonly paypalService: PaypalPaymentService) { }

  @Post('create-order')
  async createOrder(@Body() createOrderDto: CreatePaypalOrderDto) {
    console.log('Creating PayPal order:', createOrderDto);
    try {
      const result = await this.paypalService.initiateOrder(createOrderDto);
      return result;
    } catch (error) {
      console.error('Error creating PayPal order:', error);
      throw error;
    }
  }

  @Get('order/:orderId')
  async getOrderDetails(@Param('orderId') orderId: string) {
    return this.paypalService.getOrderDetails(orderId);
  }

  @Post('order/:orderId/capture')
  async capturePayment(
    @Param('orderId') orderId: string,
    @Body() paymentSource: any,
  ) {
    console.log('Capturing PayPal payment for order:', orderId);
    try {
      const result = await this.paypalService.capturePaymentForOrder(orderId, paymentSource);
      return result;
    } catch (error) {
      console.error('Error capturing PayPal payment:', error);
      throw error;
    }
  }

  @Post('order/:orderId/authorize')
  async authorizePayment(
    @Param('orderId') orderId: string,
    @Body() paymentSource: any,
  ) {
    return this.paypalService.authorizePaymentForOrder(orderId, paymentSource);
  }

  @Post('webhooks')
  async handleWebhook(@Body() webhookData: any, @Headers() headers: any) {
    console.log('🔄 Received PayPal webhook:', {
      event_type: webhookData.event_type,
      resource_id: webhookData.resource?.id,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Verify webhook signature
      const isValidSignature = await this.paypalService.verifyWebhookSignature(
        headers,
        webhookData
      );

      if (!isValidSignature) {
        console.error('❌ Invalid webhook signature');
        return { error: 'Invalid signature', status: 400 };
      }

      // Process webhook based on event type
      const eventType = webhookData.event_type;
      const resource = webhookData.resource;

      console.log(`📋 Processing webhook event: ${eventType}`);

      switch (eventType) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          await this.paypalService.handlePaymentCompleted(resource);
          break;
        case 'PAYMENT.CAPTURE.DENIED':
          await this.paypalService.handlePaymentDenied(resource);
          break;
        case 'PAYMENT.CAPTURE.REFUNDED':
          await this.paypalService.handlePaymentRefunded(resource);
          break;
        case 'CHECKOUT.ORDER.APPROVED':
          await this.paypalService.handleOrderApproved(resource);
          break;
        case 'CHECKOUT.ORDER.COMPLETED':
          await this.paypalService.handleOrderCompleted(resource);
          break;
        case 'CHECKOUT.ORDER.CANCELLED':
          await this.paypalService.handleOrderCancelled(resource);
          break;
        case 'PAYMENT.CAPTURE.PENDING':
          await this.paypalService.handlePaymentPending(resource);
          break;
        default:
          console.log(`⚠️ Unhandled webhook event type: ${eventType}`);
      }

      console.log(`✅ Webhook processed successfully: ${eventType}`);
      return { 
        received: true, 
        processed: true, 
        event_type: eventType,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      return { 
        error: 'Webhook processing failed', 
        details: error.message,
        status: 500 
      };
    }
  }

  @Get('payments')
  async getAllPayments(
    @Query('limit') limit = 50,
    @Query('skip') skip = 0,
    @Query('status') status?: string
  ) {
    try {
      if (status) {
        return await this.paypalService.getPaymentsByStatus(status, limit, skip);
      }
      return await this.paypalService.getAllPayments(limit, skip);
    } catch (error) {
      console.error('Error fetching payments:', error);
      throw error;
    }
  }

  @Get('payments/:orderId')
  async getPaymentByOrderId(@Param('orderId') orderId: string) {
    try {
      return await this.paypalService.getPaymentByOrderId(orderId);
    } catch (error) {
      console.error('Error fetching payment:', error);
      throw error;
    }
  }

  @Get('statistics')
  async getPaymentStatistics() {
    try {
      return await this.paypalService.getPaymentStatistics();
    } catch (error) {
      console.error('Error fetching statistics:', error);
      throw error;
    }
  }

  @Get('debug/orders')
  async debugOrders() {
    try {
      const allPayments = await this.paypalService.getAllPayments(100, 0);
      return {
        total: allPayments.length,
        payments: allPayments.map(payment => ({
          id: payment._id,
          orderId: payment.orderId,
          paypalOrderId: payment.paypalOrderId,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt
        }))
      };
    } catch (error) {
      console.error('Error debugging orders:', error);
      throw error;
    }
  }

  @Post('test-webhook')
  async testWebhook() {
    try {
      // Simulate a payment completed webhook
      const testWebhookData = {
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'TEST_PAYMENT_123',
          status: 'COMPLETED',
          amount: {
            value: '10.00',
            currency_code: 'USD'
          },
          payer: {
            payer_id: 'TEST_PAYER_123',
            email_address: 'test@example.com'
          },
          create_time: new Date().toISOString()
        }
      };

      console.log('🧪 Testing webhook with data:', testWebhookData);
      
      // Process the test webhook
      await this.paypalService.handlePaymentCompleted(testWebhookData.resource);
      
      return {
        success: true,
        message: 'Test webhook processed successfully',
        test_data: testWebhookData
      };
    } catch (error) {
      console.error('Error testing webhook:', error);
      throw error;
    }
  }
}