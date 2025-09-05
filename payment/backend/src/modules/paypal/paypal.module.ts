import { forwardRef, Module } from '@nestjs/common';
import { PaypalPaymentService } from './services/paypal.service';
import { PaypalUtilsService } from './services/paypal-utils.service';
import { PaypalAuthorizationService } from './services/authorization.service';
import { PaypalDatabaseService } from './services/paypal-database.service';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import axios from 'axios';
import { getPayPalConfig } from './config/paypal.config';
import {
  PAYPAL_AUTHORIZATION_SERVICE_INSTANCE_TOKEN,
  PAYPAL_AXIOS_INSTANCE_TOKEN,
  PAYPAL_MODULE_OPTIONS,
  PAYPAL_UTILS_SERVICE_INSTANCE_TOKEN,
} from './constants/paypal-constants';
import { PaypalController } from './controllers/paypal.controller';
import { PaypalPayment, PaypalPaymentSchema } from './schemas/paypal-payment.schema';

@Module({
  imports: [
    ConfigModule.forRoot(), // For accessing PayPal configuration
    MongooseModule.forFeature([
      { name: PaypalPayment.name, schema: PaypalPaymentSchema },
    ]),
  ],
  controllers: [PaypalController],
  providers: [
    PaypalPaymentService,
    PaypalUtilsService,
    PaypalAuthorizationService,
    PaypalDatabaseService,
    {
      provide: PAYPAL_AXIOS_INSTANCE_TOKEN,
      useFactory: () => axios.create(),
    },
    {
      provide: PAYPAL_MODULE_OPTIONS,
      useFactory: () => ({
        environment: process.env.PAYPAL_ENV || 'sandbox',
        ...getPayPalConfig(),
      }),
    },
    {
      provide: PAYPAL_AUTHORIZATION_SERVICE_INSTANCE_TOKEN,
      useExisting: PaypalAuthorizationService,
    },
    {
      provide: PAYPAL_UTILS_SERVICE_INSTANCE_TOKEN,
      useExisting: PaypalUtilsService,
    },
  ],
  exports: [
    PaypalPaymentService,
    PaypalUtilsService,
    PaypalAuthorizationService,
    PaypalDatabaseService,
  ],
})
export class PayPalModule { }
