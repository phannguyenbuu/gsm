import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiKeyGuard } from '../blockchain/guards/api-key.guard';

@Controller()
export class CommonController {
  @Get('health')
  getHealth() {
    return { 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };
  }

  @Get('docs')
  getApiDocs() {
    return {
      success: true,
      data: {
        title: 'Multi-Chain Crypto Payment Gateway API',
        version: '2.0.0',
        description: 'API for processing USDT and USDC payments on multiple blockchain networks',
        supportedNetworks: [
          'Ethereum',
          'Optimism', 
          'Arbitrum',
          'Avalanche',
          'Base',
          'BNB Smart Chain'
        ],
        supportedTokens: ['USDT', 'USDC'],
        authentication: {
          type: 'API Key',
          header: 'X-API-Key',
          alternative: 'Authorization: Bearer <api-key>'
        },
        endpoints: {
          payment: {
            'POST /api/payment/create': {
              description: 'Create new payment',
              permission: 'payment:create',
              body: {
                amount: 'number (required)',
                orderId: 'string (required)',
                network: 'string (optional, default: ethereum)',
                token: 'string (optional, default: usdt)', 
                metadata: 'object (optional)'
              }
            },
            'POST /api/payment/verify': {
              description: 'Verify payment with transaction hash',
              permission: 'payment:verify',
              body: {
                paymentId: 'string (required)',
                txHash: 'string (required)'
              }
            },
            'GET /api/payment/status/:paymentId': {
              description: 'Get payment status',
              permission: 'payment:status'
            },
            'GET /api/payment/balance': {
              description: 'Get wallet balance (all networks or specific)',
              permission: 'payment:balance',
              query: {
                network: 'string (optional)'
              }
            },
            'GET /api/payment/list': {
              description: 'List payments (Admin only)',
              permission: 'admin',
              query: {
                status: 'string (optional)',
                network: 'string (optional)',
                token: 'string (optional)',
                limit: 'number (optional)',
                offset: 'number (optional)'
              }
            },
            'GET /api/payment/networks': {
              description: 'Get supported networks',
              permission: 'payment:status'
            },
            'GET /api/payment/networks/:networkKey': {
              description: 'Get specific network information',
              permission: 'payment:status'
            },
            'GET /api/payment/tokens/:networkKey': {
              description: 'Get supported tokens for network',
              permission: 'payment:status'
            }
          },
          apiKeys: {
            'POST /api/keys/create': {
              description: 'Create new API key (Admin only)',
              permission: 'admin'
            },
            'GET /api/keys/list': {
              description: 'List API keys (Admin only)',
              permission: 'admin'
            },
            'POST /api/keys/revoke': {
              description: 'Revoke API key (Admin only)',
              permission: 'admin'
            },
            'GET /api/keys/info': {
              description: 'Get current API key info',
              permission: 'any'
            }
          }
        },
        permissions: [
          'payment:create - Create new payments',
          'payment:verify - Verify payments',
          'payment:status - Check payment status',
          'payment:balance - View wallet balance',
          'admin - Full access to all endpoints'
        ]
      }
    };
  }

  @Get('auth/test')
  @UseGuards(ApiKeyGuard)
  testAuth(@Req() req: any) {
    return {
      success: true,
      message: 'Authentication successful',
      data: {
        keyName: req.apiKey.name,
        permissions: req.apiKey.permissions,
        lastUsed: req.apiKey.lastUsed
      }
    };
  }
}