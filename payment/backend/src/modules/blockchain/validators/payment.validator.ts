import * as Joi from 'joi';

const paymentRequestSchema = Joi.object({
  amount: Joi.number().positive().precision(6).required(),
  orderId: Joi.string().pattern(/^[a-zA-Z0-9_-]+$/).min(1).max(100).required(),
  network: Joi.string().valid(
    'ethereum', 'base', 'bsc', 'bsc-testnet'
  ).default('ethereum'),
  token: Joi.string().valid('usdt', 'usdc').default('usdt'),
  metadata: Joi.object().optional()
});

const verificationRequestSchema = Joi.object({
  paymentId: Joi.string().uuid().required(),
  txHash: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required()
});

const webhookPaymentSchema = Joi.object({
  paymentId: Joi.string().uuid().required(),
  txHash: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required(),
  confirmations: Joi.number().integer().min(0).required()
});

const webhookTransactionSchema = Joi.object({
  txHash: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required(),
  toAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  amount: Joi.number().positive().required(),
  token: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required()
});

export function validatePaymentRequest(data: any) {
  return paymentRequestSchema.validate(data);
}

export function validateVerificationRequest(data: any) {
  return verificationRequestSchema.validate(data);
}

export function validateWebhookPayment(data: any) {
  return webhookPaymentSchema.validate(data);
}

export function validateWebhookTransaction(data: any) {
  return webhookTransactionSchema.validate(data);
}