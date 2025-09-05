import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { apiKeys } from '../../../middleware/auth';
import { ApiKeyPermission } from '../interfaces/api-key.interface';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] || request.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      throw new HttpException('API key is required', HttpStatus.UNAUTHORIZED);
    }

    const keyData = apiKeys.get(apiKey);
    if (!keyData || !keyData.isActive) {
      throw new HttpException('Invalid or inactive API key', HttpStatus.UNAUTHORIZED);
    }

    const requiredPermission = this.reflector.get<ApiKeyPermission>('permission', context.getHandler());
    if (requiredPermission && !keyData.permissions.includes(requiredPermission) && !keyData.permissions.includes('admin')) {
      throw new HttpException('Insufficient permissions', HttpStatus.FORBIDDEN);
    }

    keyData.lastUsed = new Date();
    request.apiKey = keyData;

    return true;
  }
}