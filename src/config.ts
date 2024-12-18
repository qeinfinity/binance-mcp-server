export const config = {

  // Server config
  NAME: 'binance-market-data',
  VERSION: '1.0.0',
  
  // REST endpoints
  SPOT_REST_URL: 'https://api.binance.com/api/v3',
  FUTURES_REST_URL: 'https://fapi.binance.com/fapi/v1',
  
  // WebSocket endpoints
  SPOT_WS_URL: 'wss://stream.binance.com:9443/ws',
  FUTURES_WS_URL: 'wss://fstream.binance.com/ws',
  
  // API credentials
  API_KEY: process.env.BINANCE_API_KEY || '',
  API_SECRET: process.env.BINANCE_API_SECRET || '',

  // Constants
  DEFAULT_ORDER_BOOK_LIMIT: 100,
  DEFAULT_TRADE_LIMIT: 1000,
  
  // Rate limits
  SPOT_RATE_LIMIT: 1200,
  FUTURES_RATE_LIMIT: 1200,
  
  // WebSocket configurations
  WS_PING_INTERVAL: 3 * 60 * 1000, // 3 minutes
  WS_RECONNECT_DELAY: 5000,        // 5 seconds
  WS_CONNECTION_TIMEOUT: 10000,     // 10 seconds
  WS_MAX_RECONNECT_ATTEMPTS: 5,
  
  // HTTP configurations
  HTTP_TIMEOUT: 10000,
  HTTP_MAX_RETRIES: 3,
  HTTP_RETRY_DELAY: 1000,
  
  ERRORS: {
    RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
    INVALID_SYMBOL: 'Invalid trading pair symbol',
    WS_CONNECTION_ERROR: 'WebSocket connection error',
    WS_SUBSCRIPTION_ERROR: 'WebSocket subscription error'
  }
} as const;

export type Config = typeof config;