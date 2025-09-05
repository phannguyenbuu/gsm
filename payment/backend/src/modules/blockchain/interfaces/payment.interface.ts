export interface PaymentMetadata {
  apiKeyName?: string;
  requestedBy?: string;
  requestedAt?: string;
  [key: string]: any;
}

export interface PaymentRequest {
  amount: number;
  orderId: string;
  network?: string;
  token?: string;
  metadata?: PaymentMetadata;
}

export interface WalletUrls {
  metamask: string;
  trustWallet: string;
  coinbaseWallet: string;
  direct: {
    network: string;
    chainId: number;
    contractAddress: string;
    toAddress: string;
    amount: number;
    tokenAmount: string;
    decimals: number;
    symbol: string;
  };
}

export interface Payment {
  id: string;
  originalAmount: string;
  amount: string;
  orderId: string;
  walletAddress: string;
  contractAddress: string;
  network: string;
  networkKey: string;
  chainId: number;
  token: string;
  tokenName: string;
  decimals: number;
  blockExplorer: string;
  status: 'pending' | 'pending_confirmation' | 'confirmed' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  metadata?: PaymentMetadata;
  walletUrls?: WalletUrls;
  qrCode?: string;
  txHash?: string;
  confirmations?: number;
  verifiedAt?: Date;
  confirmedAt?: Date;
}

export interface TokenBalance {
  amount: string;
  symbol: string;
  name: string;
  contractAddress: string;
  decimals: number;
}

export interface NativeBalance {
  amount: string;
  symbol: string;
  network: string;
}

export interface NetworkBalance {
  network: string;
  chainId: number;
  native: {
    native: NativeBalance;
  };
  tokens: {
    [key: string]: TokenBalance;
  };
}

export interface NetworkInfo {
  name: string;
  chainId: number;
  symbol: string;
  blockExplorer: string;
  tokens: any;
  minConfirmations: number;
}