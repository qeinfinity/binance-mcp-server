import WebSocket from 'ws';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import {
  WebSocketMessage,
  StreamEventType,
  StreamEventData,
  TradeData,
  TickerData,
  BookTickerData,
  KlineData,
  ForceOrderData,
  MarkPriceData,
  OpenInterestData
} from '../types/ws-stream.js';

type WSReadyState = number;

interface StreamSubscription {
  symbol: string;
  type: 'spot' | 'futures';
  streams: StreamEventType[];
  reconnectAttempts: number;
  reconnectTimeout?: NodeJS.Timeout;
}

type MessageHandler = (data: StreamEventData) => void;

export class BinanceWebSocketManager {
  private connections: Map<string, WebSocket>;
  private pingIntervals: Map<string, NodeJS.Timeout>;
  private messageCallbacks: Map<string, Map<StreamEventType, MessageHandler[]>>;
  private subscriptions: Map<string, StreamSubscription>;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = config.WS_RECONNECT_DELAY || 5000;

  constructor() {
    this.connections = new Map();
    this.pingIntervals = new Map();
    this.messageCallbacks = new Map();
    this.subscriptions = new Map();
  }

  public subscribe(symbol: string, type: 'spot' | 'futures', streams: StreamEventType[]): void {
    const subscription: StreamSubscription = {
      symbol,
      type,
      streams,
      reconnectAttempts: 0
    };
    
    if (!this.messageCallbacks.has(symbol)) {
      this.messageCallbacks.set(symbol, new Map());
    }
    
    const symbolCallbacks = this.messageCallbacks.get(symbol)!;
    streams.forEach(stream => {
      if (!symbolCallbacks.has(stream)) {
        symbolCallbacks.set(stream, []);
      }
    });

    this.subscriptions.set(symbol, subscription);
    this.connectWebSocket(subscription);
  }

  private connectWebSocket(subscription: StreamSubscription): void {
    const { symbol, type, streams } = subscription;
    const wsUrl = type === 'spot' ? config.SPOT_WS_URL : config.FUTURES_WS_URL;
    
    // Handle special futures streams
    const streamNames = streams.map(stream => {
      if (type === 'futures') {
        switch (stream) {
          case 'forceOrder':
            return `${symbol.toLowerCase()}@forceOrder`;
          case 'markPrice':
            return `${symbol.toLowerCase()}@markPrice@1s`; // 1s update frequency
          case 'openInterest':
            return `${symbol.toLowerCase()}@openInterest@1s`;
          default:
            return `${symbol.toLowerCase()}@${stream}`;
        }
      }
      return `${symbol.toLowerCase()}@${stream}`;
    });
    
    try {
      const ws = new WebSocket(`${wsUrl}/${streamNames.join('/')}`);
      
      ws.on('open', () => {
        logger.info(`WebSocket connected for ${symbol} ${streams.join(', ')}`);
        subscription.reconnectAttempts = 0;
        this.setupPingInterval(symbol, ws);
      });

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage<StreamEventData>;
          this.handleStreamMessage(symbol, message);
        } catch (error) {
          logger.error('Error parsing WebSocket message:', error);
        }
      });

      ws.on('error', (error: Error) => {
        logger.error(`WebSocket error for ${symbol}:`, error);
      });

      ws.on('close', () => {
        logger.info(`WebSocket closed for ${symbol}`);
        this.cleanup(symbol);
        this.handleReconnection(subscription);
      });

      ws.on('pong', () => {
        logger.debug(`Received pong from ${symbol} WebSocket`);
      });

      this.connections.set(symbol, ws);
    } catch (error) {
      logger.error(`Error creating WebSocket connection for ${symbol}:`, error);
      this.handleReconnection(subscription);
      throw error;
    }
  }

  private handleStreamMessage(symbol: string, message: WebSocketMessage<StreamEventData>): void {
    const symbolCallbacks = this.messageCallbacks.get(symbol);
    if (!symbolCallbacks) return;

    // Extract stream type from the stream name
    const streamParts = message.stream.split('@');
    if (streamParts.length < 2) return;

    let streamType = streamParts[1] as StreamEventType;
    // Handle special cases where the stream name has additional parts (e.g., markPrice@1s)
    if (streamParts.length > 2) {
      streamType = streamParts[1].split('@')[0] as StreamEventType;
    }

    const handlers = symbolCallbacks.get(streamType);
    
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message.data);
        } catch (error) {
          logger.error(`Error in message handler for ${symbol} ${streamType}:`, error);
        }
      });
    }
  }

  public onStreamData(symbol: string, streamType: StreamEventType, handler: MessageHandler): void {
    const symbolCallbacks = this.messageCallbacks.get(symbol);
    if (!symbolCallbacks) {
      logger.error(`No callbacks registered for symbol ${symbol}`);
      return;
    }

    const handlers = symbolCallbacks.get(streamType) || [];
    handlers.push(handler);
    symbolCallbacks.set(streamType, handlers);
  }

  private handleReconnection(subscription: StreamSubscription): void {
    const { symbol, reconnectAttempts } = subscription;

    if (reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logger.error(`Max reconnection attempts reached for ${symbol}`);
      return;
    }

    subscription.reconnectAttempts++;
    const delay = this.RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1); // Exponential backoff

    logger.info(`Attempting to reconnect ${symbol} in ${delay}ms (attempt ${reconnectAttempts})`);

    subscription.reconnectTimeout = setTimeout(() => {
      this.connectWebSocket(subscription);
    }, delay);
  }

  private setupPingInterval(symbol: string, ws: WebSocket): void {
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping((error?: Error) => {
          if (error) {
            logger.error(`Error sending ping for ${symbol}:`, error);
          }
        });
      }
    }, config.WS_PING_INTERVAL);
    this.pingIntervals.set(symbol, interval);
  }

  private cleanup(symbol: string): void {
    const interval = this.pingIntervals.get(symbol);
    if (interval) {
      clearInterval(interval);
      this.pingIntervals.delete(symbol);
    }

    const subscription = this.subscriptions.get(symbol);
    if (subscription?.reconnectTimeout) {
      clearTimeout(subscription.reconnectTimeout);
    }

    this.connections.delete(symbol);
  }

  public unsubscribe(symbol: string): void {
    const ws = this.connections.get(symbol);
    if (ws) {
      ws.close();
    }
    this.cleanup(symbol);
    this.subscriptions.delete(symbol);
    this.messageCallbacks.delete(symbol);
  }

  public close(): void {
    this.connections.forEach((ws, symbol) => {
      ws.close();
      this.cleanup(symbol);
    });
    this.subscriptions.clear();
    this.messageCallbacks.clear();
  }

  public getConnectionState(symbol: string): WSReadyState | undefined {
    const ws = this.connections.get(symbol);
    return ws?.readyState;
  }

  public isSubscribed(symbol: string, streamType: StreamEventType): boolean {
    const subscription = this.subscriptions.get(symbol);
    return subscription?.streams.includes(streamType) || false;
  }
}