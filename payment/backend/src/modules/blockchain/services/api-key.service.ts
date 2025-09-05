import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ApiKey, ApiKeyPermission } from '../interfaces/api-key.interface';

@Injectable()
export class ApiKeyService {
  private apiKeys: Map<string, ApiKey>;

  constructor() {
    this.apiKeys = new Map();
  }

  addAPIKey(name: string, permissions: ApiKeyPermission[]): string {
    const key = randomBytes(32).toString('hex');
    
    this.apiKeys.set(key, {
      key,
      name,
      permissions,
      createdAt: new Date()
    });

    return key;
  }

  validateAPIKey(key: string, requiredPermission?: ApiKeyPermission): ApiKey | null {
    const apiKey = this.apiKeys.get(key);
    
    if (!apiKey) {
      return null;
    }

    if (requiredPermission && !apiKey.permissions.includes(requiredPermission) && !apiKey.permissions.includes('admin')) {
      return null;
    }

    return apiKey;
  }

  revokeAPIKey(key: string): boolean {
    return this.apiKeys.delete(key);
  }

  listAPIKeys(): ApiKey[] {
    return Array.from(this.apiKeys.values()).map(({ key, ...rest }) => ({
      ...rest,
      key: key.substring(0, 8) + '...'
    })) as ApiKey[];
  }
}