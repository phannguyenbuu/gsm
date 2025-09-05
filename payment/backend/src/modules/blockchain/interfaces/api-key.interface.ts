export type ApiKeyPermission = 'payment:create' | 'payment:verify' | 'payment:status' | 'payment:balance' | 'admin';

export interface ApiKey {
  key: string;
  name: string;
  permissions: ApiKeyPermission[];
  createdAt: Date;
}

export interface ApiKeyRequest {
  name: string;
  permissions?: ApiKeyPermission[];
}

export interface ApiKeyResponse {
  apiKey: string;
  name: string;
  permissions: ApiKeyPermission[];
  message: string;
}

export interface ApiKeyInfo {
  name: string;
  permissions: ApiKeyPermission[];
  createdAt: Date;
  keyId: string;
}