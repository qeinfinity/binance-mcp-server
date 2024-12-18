export interface MarketData {
  symbol: string;
  exchange: string;
  type: 'spot' | 'futures';
  price: number;
  timestamp: number;
  volume24h: number;
  volumeDelta24h?: number;
  priceChange24h: number;
  priceChange1h?: number;
  price24hHigh: number;
  price24hLow: number;
  tradeCount24h: number;
  bidAskSpread?: number;
  openInterest?: number;
  fundingRate?: number;
  liquidations24h?: number;
}

export interface OrderBookData {
  symbol: string;
  type: 'spot' | 'futures';
  bids: [number, number][];
  asks: [number, number][];
  timestamp: number;
  lastUpdateId: number;
}

export interface TradeData {
  symbol: string;
  type: 'spot' | 'futures';
  price: number;
  quantity: number;
  timestamp: number;
  isBuyerMaker: boolean;
  tradeId: number;
}