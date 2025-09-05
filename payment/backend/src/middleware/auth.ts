import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

const apiKeys = new Map();

function generateAPIKey() {
  return crypto.randomBytes(32).toString('hex');
}

function initializeAPIKey() {
  // Tạo key mới nếu không có trong env
  const configService = new ConfigService();
  const envApiKey = configService.get<string>('API_KEY');
  const defaultKey = envApiKey || 'test-api-key-123456789';

  if (!envApiKey) {
    console.log('No API_KEY found in environment variables');
    console.log(`Generated API Key: ${defaultKey}`);
    console.log('Add this to your .env file: API_KEY=' + defaultKey);
  } else {
    console.log('Using API Key from environment variables');
  }
  
  // Luôn set key vào Map, bất kể là key từ env hay key mới tạo
  apiKeys.set(defaultKey, {
    key: defaultKey,
    name: 'Default Admin Key',
    permissions: ['admin', 'payment:create', 'payment:verify', 'payment:status', 'payment:balance'],
    createdAt: new Date(),
    lastUsed: null,
    isActive: true
  });
  
  return defaultKey;
}

function addAPIKey(name: string, permissions = ['payment:create', 'payment:verify', 'payment:status']) {
  const key = generateAPIKey();
  apiKeys.set(key, {
    key,
    name,
    permissions,
    createdAt: new Date(),
    lastUsed: null,
    isActive: true
  });
  return key;
}

function revokeAPIKey(key: string) {
  const keyData = apiKeys.get(key);
  if (keyData) {
    keyData.isActive = false;
    return true;
  }
  return false;
}

function listAPIKeys() {
  const keys: any[] = [];
  for (const [key, data] of apiKeys) {
    keys.push({
      id: key.substring(0, 8) + '...',
      name: data.name,
      permissions: data.permissions,
      createdAt: data.createdAt,
      lastUsed: data.lastUsed,
      isActive: data.isActive
    });
  }
  return keys;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
        message: 'Provide API key in X-API-Key header or Authorization: Bearer <key>'
      });
    }

    const keyData = apiKeys.get(apiKey);
    if (!keyData || !keyData.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or inactive API key'
      });
    }

    keyData.lastUsed = new Date();
    (req as any).apiKey = keyData;
    
    next();
  }
}

export function authenticateAPI(requiredPermission: string = null) {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
        message: 'Provide API key in X-API-Key header or Authorization: Bearer <key>'
      });
    }

    const keyData = apiKeys.get(apiKey);
    if (!keyData || !keyData.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or inactive API key'
      });
    }

    if (requiredPermission && !keyData.permissions.includes(requiredPermission) && !keyData.permissions.includes('admin')) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: requiredPermission
      });
    }

    keyData.lastUsed = new Date();
    (req as any).apiKey = keyData;
    
    next();
  };
}

// Khởi tạo default API key
const defaultAPIKey = initializeAPIKey();

// Log tất cả các API key hiện có để debug
console.log('Available API Keys:', Array.from(apiKeys.keys()));

export {
  generateAPIKey,
  addAPIKey,
  revokeAPIKey,
  listAPIKeys,
  defaultAPIKey,
  apiKeys
};