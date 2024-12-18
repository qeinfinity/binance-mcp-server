import { BinanceWebSocketManager } from '../connectors/binance-ws';
import WebSocket from 'ws';
import { StreamEventData, TradeData } from '../types/ws-stream';

jest.mock('ws');

type MockWebSocket = jest.Mocked<WebSocket> & {
  readyState: number;
};

describe('BinanceWebSocketManager', () => {
  let wsManager: BinanceWebSocketManager;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    wsManager = new BinanceWebSocketManager();
    mockWs = {
      readyState: WebSocket.CONNECTING,
      on: jest.fn(),
      once: jest.fn(),
      emit: jest.fn(),
      close: jest.fn(),
      ping: jest.fn(),
      send: jest.fn(),
      terminate: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      setMaxListeners: jest.fn(),
      getMaxListeners: jest.fn(),
      listeners: jest.fn(),
      rawListeners: jest.fn(),
      listenerCount: jest.fn(),
      eventNames: jest.fn(),
      addListener: jest.fn(),
      off: jest.fn(),
      prependListener: jest.fn(),
      prependOnceListener: jest.fn(),
    } as unknown as MockWebSocket;

    (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);
  });

  afterEach(() => {
    wsManager.close();
    jest.clearAllMocks();
  });

  it('should successfully subscribe to stream', () => {
    const symbol = 'BTCUSDT';
    const streams = ['trade', 'ticker'] as const;

    wsManager.subscribe(symbol, 'spot', streams);

    expect(WebSocket).toHaveBeenCalledWith(
      expect.stringContaining(`btcusdt@trade/btcusdt@ticker`)
    );
  });

  it('should handle incoming messages correctly', (done) => {
    const symbol = 'BTCUSDT';
    const mockData = {
      stream: 'btcusdt@trade',
      data: {
        e: 'trade',
        E: 123456789,
        s: 'BTCUSDT',
        p: '50000.00',
        q: '1.0'
      } as TradeData
    };

    wsManager.subscribe(symbol, 'spot', ['trade']);
    wsManager.onStreamData(symbol, 'trade', (data: StreamEventData) => {
      expect(data).toEqual(mockData.data);
      done();
    });

    // Simulate receiving a message
    mockWs.emit('message', JSON.stringify(mockData));
  });

  it('should handle reconnection on connection close', () => {
    const symbol = 'BTCUSDT';
    wsManager.subscribe(symbol, 'spot', ['trade']);

    // Simulate connection close
    mockWs.emit('close');

    // Verify that a new connection attempt is made
    expect(WebSocket).toHaveBeenCalledTimes(2);
  });

  it('should clean up resources on unsubscribe', () => {
    const symbol = 'BTCUSDT';
    wsManager.subscribe(symbol, 'spot', ['trade']);
    wsManager.unsubscribe(symbol);

    expect(mockWs.close).toHaveBeenCalled();
  });

  it('should handle multiple stream subscriptions', () => {
    const symbol = 'BTCUSDT';
    const streams = ['trade', 'ticker', 'bookTicker'] as const;

    wsManager.subscribe(symbol, 'spot', streams);

    expect(WebSocket).toHaveBeenCalledWith(
      expect.stringContaining('btcusdt@trade/btcusdt@ticker/btcusdt@bookTicker')
    );
  });

  it('should properly maintain connection state', () => {
    const symbol = 'BTCUSDT';
    wsManager.subscribe(symbol, 'spot', ['trade']);

    // Update mockWs.readyState which is now properly typed
    mockWs.readyState = WebSocket.OPEN;
    mockWs.emit('open');

    expect(wsManager.getConnectionState(symbol)).toBe(WebSocket.OPEN);
  });
});