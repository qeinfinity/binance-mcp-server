// market-data.ts
// Updated interfaces with volumeDelta24h and priceChange1h removed.

export interface MarketData {
  symbol: string;
  exchange: string;
  type: 'spot' | 'futures';
  price: number;            // lastPrice
  timestamp: number;        // e.g., Date.now() or the closeTime from the 24hr ticker
  volume24h: number;        // volume from 24hr ticker
  priceChange24h: number;   // priceChange from 24hr ticker
  price24hHigh: number;     // highPrice from 24hr ticker
  price24hLow: number;      // lowPrice from 24hr ticker
  tradeCount24h: number;    // count from 24hr ticker
  // volumeDelta24h REMOVED
  // priceChange1h REMOVED
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

export interface FuturesMarketData extends MarketData {
  markPrice: string;
  indexPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
  openInterest: string;
}
