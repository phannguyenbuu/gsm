// Network configurations for multi-chain support
const networks = {
  // ethereum: {
  //   name: 'Ethereum',
  //   chainId: 1,
  //   symbol: 'ETH',
  //   rpcUrls: [
  //     'https://eth-mainnet.g.alchemy.com/v2/demo',
  //     'https://rpc.ankr.com/eth',
  //     'https://ethereum.publicnode.com'
  //   ],
  //   blockExplorer: 'https://etherscan.io',
  //   tokens: {
  //     usdt: {
  //       address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  //       decimals: 6,
  //       symbol: 'USDT',
  //       name: 'Tether USD'
  //     },
  //     usdc: {
  //       address: '0xA0b86a33E6441b7178FcE7DcE53e9B7e3b2bB0BD',
  //       decimals: 6,
  //       symbol: 'USDC',
  //       name: 'USD Coin'
  //     }
  //   },
  //   minConfirmations: 12,
  //   gasLimit: 100000
  // },
  // optimism: {
  //   name: 'Optimism',
  //   chainId: 10,
  //   symbol: 'ETH',
  //   rpcUrls: [
  //     'https://opt-mainnet.g.alchemy.com/v2/demo',
  //     'https://rpc.ankr.com/optimism',
  //     'https://mainnet.optimism.io'
  //   ],
  //   blockExplorer: 'https://optimistic.etherscan.io',
  //   tokens: {
  //     usdt: {
  //       address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
  //       decimals: 6,
  //       symbol: 'USDT',
  //       name: 'Tether USD'
  //     },
  //     usdc: {
  //       address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
  //       decimals: 6,
  //       symbol: 'USDC',
  //       name: 'USD Coin'
  //     }
  //   },
  //   minConfirmations: 10,
  //   gasLimit: 80000
  // },
  // arbitrum: {
  //   name: 'Arbitrum One',
  //   chainId: 42161,
  //   symbol: 'ETH',
  //   rpcUrls: [
  //     'https://arb-mainnet.g.alchemy.com/v2/demo',
  //     'https://rpc.ankr.com/arbitrum',
  //     'https://arb1.arbitrum.io/rpc'
  //   ],
  //   blockExplorer: 'https://arbiscan.io',
  //   tokens: {
  //     usdt: {
  //       address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  //       decimals: 6,
  //       symbol: 'USDT',
  //       name: 'Tether USD'
  //     },
  //     usdc: {
  //       address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  //       decimals: 6,
  //       symbol: 'USDC',
  //       name: 'USD Coin'
  //     }
  //   },
  //   minConfirmations: 10,
  //   gasLimit: 80000
  // },
  // avalanche: {
  //   name: 'Avalanche C-Chain',
  //   chainId: 43114,
  //   symbol: 'AVAX',
  //   rpcUrls: [
  //     'https://api.avax.network/ext/bc/C/rpc',
  //     'https://rpc.ankr.com/avalanche',
  //     'https://avalanche-c-chain.publicnode.com'
  //   ],
  //   blockExplorer: 'https://snowtrace.io',
  //   tokens: {
  //     usdt: {
  //       address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
  //       decimals: 6,
  //       symbol: 'USDT',
  //       name: 'Tether USD'
  //     },
  //     usdc: {
  //       address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  //       decimals: 6,
  //       symbol: 'USDC',
  //       name: 'USD Coin'
  //     }
  //   },
  //   minConfirmations: 10,
  //   gasLimit: 80000
  // },
  // base: {
  //   name: 'Base',
  //   chainId: 8453,
  //   symbol: 'ETH',
  //   rpcUrls: [
  //     'https://base-mainnet.g.alchemy.com/v2/demo',
  //     'https://rpc.ankr.com/base',
  //     'https://mainnet.base.org'
  //   ],
  //   blockExplorer: 'https://basescan.org',
  //   tokens: {
  //     usdt: {
  //       address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
  //       decimals: 6,
  //       symbol: 'USDT',
  //       name: 'Tether USD'
  //     },
  //     usdc: {
  //       address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  //       decimals: 6,
  //       symbol: 'USDC',
  //       name: 'USD Coin'
  //     }
  //   },
  //   minConfirmations: 10,
  //   gasLimit: 80000
  // },
  bsc: {
    name: 'BNB Smart Chain',
    chainId: 56,
    symbol: 'BNB',
    rpcUrls: [
      'https://bsc-dataseed1.binance.org',
      'https://bsc-dataseed2.binance.org',
      'https://rpc.ankr.com/bsc'
    ],
    blockExplorer: 'https://bscscan.com',
    tokens: {
      usdt: {
        address: '0x55d398326f99059fF775485246999027B3197955',
        decimals: 18,
        symbol: 'USDT',
        name: 'Tether USD'
      },
      usdc: {
        address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        decimals: 18,
        symbol: 'USDC',
        name: 'USD Coin'
      }
    },
    minConfirmations: 12,
    gasLimit: 100000
  }
};

// Testnet configurations
const testnets = {
  // sepolia: {
  //   name: 'Ethereum Sepolia',
  //   chainId: 11155111,
  //   symbol: 'ETH',
  //   rpcUrls: [
  //     'https://eth-sepolia.g.alchemy.com/v2/demo',
  //     'https://rpc.ankr.com/eth_sepolia'
  //   ],
  //   blockExplorer: 'https://sepolia.etherscan.io',
  //   tokens: {
  //     usdt: {
  //       address: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
  //       decimals: 6,
  //       symbol: 'USDT',
  //       name: 'Tether USD'
  //     },
  //     usdc: {
  //       address: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8',
  //       decimals: 6,
  //       symbol: 'USDC',
  //       name: 'USD Coin'
  //     }
  //   },
  //   minConfirmations: 3,
  //   gasLimit: 100000
  // },
  // 'optimism-sepolia': {
  //   name: 'Optimism Sepolia',
  //   chainId: 11155420,
  //   symbol: 'ETH',
  //   rpcUrls: [
  //     'https://sepolia.optimism.io'
  //   ],
  //   blockExplorer: 'https://sepolia-optimism.etherscan.io',
  //   tokens: {
  //     usdt: {
  //       address: '0x05D032ac25d322df992303dCa074EE7392C117b9',
  //       decimals: 6,
  //       symbol: 'USDT',
  //       name: 'Tether USD'
  //     },
  //     usdc: {
  //       address: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
  //       decimals: 6,
  //       symbol: 'USDC',
  //       name: 'USD Coin'
  //     }
  //   },
  //   minConfirmations: 3,
  //   gasLimit: 80000
  // },
  // 'arbitrum-sepolia': {
  //   name: 'Arbitrum Sepolia',
  //   chainId: 421614,
  //   symbol: 'ETH',
  //   rpcUrls: [
  //     'https://sepolia-rollup.arbitrum.io/rpc'
  //   ],
  //   blockExplorer: 'https://sepolia.arbiscan.io',
  //   tokens: {
  //     usdt: {
  //       address: '0xb1D4538B4571d411F07960EF2838Ce337FE1E80E',
  //       decimals: 6,
  //       symbol: 'USDT',
  //       name: 'Tether USD'
  //     },
  //     usdc: {
  //       address: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  //       decimals: 6,
  //       symbol: 'USDC',
  //       name: 'USD Coin'
  //     }
  //   },
  //   minConfirmations: 3,
  //   gasLimit: 80000
  // },
  // fuji: {
  //   name: 'Avalanche Fuji',
  //   chainId: 43113,
  //   symbol: 'AVAX',
  //   rpcUrls: [
  //     'https://api.avax-test.network/ext/bc/C/rpc'
  //   ],
  //   blockExplorer: 'https://testnet.snowtrace.io',
  //   tokens: {
  //     usdt: {
  //       address: '0xd00ae08403B9bbb9124bB305C09058E32C39A48c',
  //       decimals: 6,
  //       symbol: 'USDT',
  //       name: 'Tether USD'
  //     },
  //     usdc: {
  //       address: '0x5425890298aed601595a70AB815c96711a31Bc65',
  //       decimals: 6,
  //       symbol: 'USDC',
  //       name: 'USD Coin'
  //     }
  //   },
  //   minConfirmations: 3,
  //   gasLimit: 80000
  // },
  // 'base-sepolia': {
  //   name: 'Base Sepolia',
  //   chainId: 84532,
  //   symbol: 'ETH',
  //   rpcUrls: [
  //     'https://sepolia.base.org'
  //   ],
  //   blockExplorer: 'https://sepolia.basescan.org',
  //   tokens: {
  //     usdt: {
  //       address: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
  //       decimals: 6,
  //       symbol: 'USDT',
  //       name: 'Tether USD'
  //     },
  //     usdc: {
  //       address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  //       decimals: 6,
  //       symbol: 'USDC',
  //       name: 'USD Coin'
  //     }
  //   },
  //   minConfirmations: 3,
  //   gasLimit: 80000
  // },
  'bsc-testnet': {
    name: 'BNB Smart Chain Testnet',
    chainId: 97,
    symbol: 'tBNB',
    rpcUrls: [
      'https://data-seed-prebsc-1-s1.binance.org:8545'
    ],
    blockExplorer: 'https://testnet.bscscan.com',
    tokens: {
      usdt: {
        address: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
        decimals: 18,
        symbol: 'USDT',
        name: 'Tether USD'
      },
      usdc: {
        address: '0x64544969ed7EBf5f083679233325356EbE738930',
        decimals: 18,
        symbol: 'USDC',
        name: 'USD Coin'
      }
    },
    minConfirmations: 3,
    gasLimit: 100000
  }
};

// ERC-20 ABI for token operations
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function'
  }
];

function getNetworkConfig(networkKey, isTestnet = false) {
  const networkConfigs = isTestnet ? testnets : networks;
  const config = networkConfigs[networkKey];

  if (!config) {
    throw new Error(`Network ${networkKey} not supported`);
  }

  return config;
}

function getTokenConfig(networkKey, tokenSymbol, isTestnet = false) {
  const networkConfig = getNetworkConfig(networkKey, isTestnet);
  const token = networkConfig.tokens[tokenSymbol.toLowerCase()];

  if (!token) {
    throw new Error(`Token ${tokenSymbol} not supported on ${networkConfig.name}`);
  }

  return token;
}

function getSupportedNetworks(isTestnet = false) {
  const networkConfigs = isTestnet ? testnets : networks;
  return Object.keys(networkConfigs);
}

function getSupportedTokens(networkKey, isTestnet = false) {
  const networkConfig = getNetworkConfig(networkKey, isTestnet);
  return Object.keys(networkConfig.tokens);
}

function getRpcUrl(networkKey, isTestnet = false) {
  const networkConfig = getNetworkConfig(networkKey, isTestnet);

  // Check for environment variable first
  const envKey = `${networkKey.toUpperCase().replace('-', '_')}_RPC_URL`;
  const envRpcUrl = process.env[envKey];

  if (envRpcUrl) {
    return envRpcUrl;
  }

  // Return first available RPC URL
  return networkConfig.rpcUrls[0];
}

function getNetworkByChainId(chainId, isTestnet = false) {
  const networkConfigs = isTestnet ? testnets : networks;

  for (const [key, config] of Object.entries(networkConfigs)) {
    if (config.chainId === chainId) {
      return { key, config };
    }
  }

  throw new Error(`Network with chain ID ${chainId} not found`);
}

export {
  networks,
  testnets,
  ERC20_ABI,
  getNetworkConfig,
  getTokenConfig,
  getSupportedNetworks,
  getSupportedTokens,
  getRpcUrl,
  getNetworkByChainId
};
