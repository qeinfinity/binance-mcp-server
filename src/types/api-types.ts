export interface MarketDataParams {
  symbol: string;
  type: 'spot' | 'futures';
}

export interface KlineParams {
  symbol: string;
  type: 'spot' | 'futures';
  interval: string;
  limit?: number;
}

export interface StreamParams {
  symbol: string;
  type: 'spot' | 'futures';
  streams: string[];
}

export interface FuturesDataParams {
  symbol: string;
}

export class APIError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'APIError';
  }
}

// Type guards
export function isMarketDataParams(params: any): params is MarketDataParams {
  return (
    typeof params === 'object' &&
    typeof params.symbol === 'string' &&
    (params.type === 'spot' || params.type === 'futures')
  );
}

export function isKlineParams(params: any): params is KlineParams {
  return (
    typeof params === 'object' &&
    typeof params.symbol === 'string' &&
    (params.type === 'spot' || params.type === 'futures') &&
    typeof params.interval === 'string' &&
    (params.limit === undefined || typeof params.limit === 'number')
  );
}

export function isStreamParams(params: any): params is StreamParams {
  return (
    typeof params === 'object' &&
    typeof params.symbol === 'string' &&
    (params.type === 'spot' || params.type === 'futures') &&
    Array.isArray(params.streams)
  );
}

export function isFuturesDataParams(params: any): params is FuturesDataParams {
  return (
    typeof params === 'object' &&
    typeof params.symbol === 'string'
  );
}