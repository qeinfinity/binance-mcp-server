export type StreamEventType = 
  | 'trade'
  | 'ticker'
  | 'bookTicker'
  | 'kline'
  | 'depth'
  | 'forceOrder'    // Liquidation orders
  | 'markPrice'     // Mark price and funding rate
  | 'openInterest'; // Open interest updates

export interface WebSocketMessage<T> {
  stream: string;
  data: T;
  timestamp: number;
}

export type StreamEventData =
  | TradeData
  | TickerData
  | BookTickerData
  | KlineData
  | DepthData
  | ForceOrderData
  | MarkPriceData
  | OpenInterestData;

// Existing interfaces
export interface TradeData {
  e: 'trade';
  E: number;
  s: string;
  t: number;
  p: string;
  q: string;
  b: number;
  a: number;
  T: number;
  m: boolean;
}

export interface TickerData {
  e: '24hrTicker';
  E: number;
  s: string;
  p: string;
  P: string;
  w: string;
  c: string;
  Q: string;
  o: string;
  h: string;
  l: string;
  v: string;
  q: string;
}

export interface BookTickerData {
  e: 'bookTicker';
  u: number;
  s: string;
  b: string;
  B: string;
  a: string;
  A: string;
}

export interface KlineData {
  e: 'kline';
  E: number;
  s: string;
  k: {
    t: number;
    T: number;
    s: string;
    i: string;
    f: number;
    L: number;
    o: string;
    c: string;
    h: string;
    l: string;
    v: string;
    n: number;
    x: boolean;
    q: string;
    V: string;
    Q: string;
  };
}

export interface DepthData {
  e: 'depthUpdate';
  E: number;
  s: string;
  U: number;
  u: number;
  b: [string, string][];
  a: [string, string][];
}

// New Futures-specific interfaces
export interface ForceOrderData {
  e: 'forceOrder';
  E: number;              // Event time
  o: {
    s: string;           // Symbol
    S: 'SELL' | 'BUY';   // Side
    o: 'LIMIT';          // Order type
    f: 'IOC';           // Time in force
    q: string;          // Original quantity
    p: string;          // Price
    ap: string;         // Average price
    X: 'FILLED';        // Order status
    l: string;          // Last filled quantity
    z: string;          // Cumulative filled quantity
    T: number;          // Trade time
  };
}

export interface MarkPriceData {
  e: 'markPriceUpdate';
  E: number;           // Event time
  s: string;          // Symbol
  p: string;          // Mark price
  i: string;          // Index price
  P: string;          // Estimated settle price
  r: string;          // Funding rate
  T: number;          // Next funding time
}

export interface OpenInterestData {
  e: 'openInterest';
  E: number;          // Event time
  s: string;          // Symbol
  o: string;          // Open interest
  T: number;          // Transaction time
}