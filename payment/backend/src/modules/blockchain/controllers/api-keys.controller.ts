import { Controller, Post, Get, Body, UseGuards, Req, HttpException, HttpStatus } from '@nestjs/common';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { AdminGuard } from '../guards/admin.guard';
import { ApiKeyService } from '../services/api-key.service';
import { ApiKeyRequest, ApiKeyResponse, ApiKeyInfo } from '../interfaces/api-key.interface';

@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post('create')
  @UseGuards(ApiKeyGuard, AdminGuard)
  async createApiKey(@Body() body: ApiKeyRequest): Promise<{ success: boolean; data: ApiKeyResponse }> {
    try {
      const { name, permissions } = body;
      
      if (!name) {
        throw new HttpException('Name is required', HttpStatus.BAD_REQUEST);
      }

      const validPermissions = [
        'payment:create',
        'payment:verify', 
        'payment:status',
        'payment:balance',
        'admin'
      ];

      const keyPermissions = permissions || ['payment:create', 'payment:verify', 'payment:status'];
      
      const invalidPermissions = keyPermissions.filter(p => !validPermissions.includes(p));
      if (invalidPermissions.length > 0) {
        throw new HttpException({
          success: false,
          error: 'Invalid permissions',
          invalid: invalidPermissions,
          valid: validPermissions
        }, HttpStatus.BAD_REQUEST);
      }

      const newKey = this.apiKeyService.addAPIKey(name, keyPermissions);
      
      return {
        success: true,
        data: {
          apiKey: newKey,
          name,
          permissions: keyPermissions,
          message: 'Store this API key securely. It will not be shown again.'
        }
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('list')
  @UseGuards(ApiKeyGuard, AdminGuard)
  async listApiKeys(): Promise<{ success: boolean; data: { keys: any[]; total: number } }> {
    try {
      const keys = this.apiKeyService.listAPIKeys();
      
      return {
        success: true,
        data: {
          keys,
          total: keys.length
        }
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('revoke')
  @UseGuards(ApiKeyGuard, AdminGuard)
  async revokeApiKey(@Body() body: { apiKey: string }, @Req() req: any): Promise<{ success: boolean; message?: string }> {
    try {
      const { apiKey } = body;
      
      if (!apiKey) {
        throw new HttpException('API key is required', HttpStatus.BAD_REQUEST);
      }

      if (apiKey === req.apiKey.key) {
        throw new HttpException('Cannot revoke your own API key', HttpStatus.BAD_REQUEST);
      }

      const success = this.apiKeyService.revokeAPIKey(apiKey);
      
      if (!success) {
        throw new HttpException('API key not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        message: 'API key revoked successfully'
      };
    } catch (error) {
      throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('info')
  @UseGuards(ApiKeyGuard)
  async getApiKeyInfo(@Req() req: any): Promise<{ success: boolean; data: ApiKeyInfo }> {
    try {
      const { key, ...keyInfo } = req.apiKey;
      
      return {
        success: true,
        data: {
          ...keyInfo,
          keyId: key.substring(0, 8) + '...'
        }
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}