import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { createHmac } from 'crypto';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['x-webhook-signature'];

    if (!signature) {
      throw new HttpException('Missing webhook signature', HttpStatus.UNAUTHORIZED);
    }

    const body = JSON.stringify(request.body);
    const expectedSignature = createHmac('sha256', process.env.WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new HttpException('Invalid webhook signature', HttpStatus.UNAUTHORIZED);
    }

    return true;
  }
}