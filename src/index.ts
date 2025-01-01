#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { BinanceWebSocketManager } from './connectors/binance-ws.js';
import { BinanceRestConnector } from './connectors/binance-rest.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { 
  MarketDataParams, 
  KlineParams, 
  StreamParams, 
  FuturesDataParams,
  APIError,
  isMarketDataParams,
  isKlineParams,
  isStreamParams,
  isFuturesDataParams
} from './types/api-types.js';
import { StreamEventData, StreamEventType } from './types/ws-stream.js';

function isStreamEventType(stream: string): stream is StreamEventType {
  return ['trade', 'ticker', 'bookTicker', 'kline', 'depth', 'forceOrder', 'markPrice', 'openInterest'].includes(stream);
}

const wsManager = new BinanceWebSocketManager();
const restConnector = new BinanceRestConnector();

const server = new Server(
  {
    name: config.NAME,
    version: config.VERSION,
    description: 'Binance market data provider with WebSocket support'
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_market_data",
        description: "Get comprehensive market data for a trading pair",
        inputSchema: {
          type: "object",
          properties: {
            symbol: { 
              type: "string", 
              description: "Trading pair symbol (e.g., BTCUSDT)" 
            },
            type: { 
              type: "string", 
              enum: ["spot", "futures"], 
              description: "Market type" 
            }
          },
          required: ["symbol", "type"]
        }
      },
      {
        name: "test_futures_endpoints",
        description: "Test individual futures endpoints",
        inputSchema: {
          type: "object",
          properties: {
            symbol: { 
              type: "string", 
              description: "Trading pair symbol (e.g., BTCUSDT)" 
            }
          },
          required: ["symbol"]
        }
      },
      {
        name: "get_futures_open_interest",
        description: "Get current open interest for a futures trading pair",
        inputSchema: {
          type: "object",
          properties: {
            symbol: { 
              type: "string", 
              description: "Trading pair symbol (e.g., BTCUSDT)" 
            }
          },
          required: ["symbol"]
        }
      },
      {
        name: "get_futures_funding_rate",
        description: "Get current funding rate for a futures trading pair",
        inputSchema: {
          type: "object",
          properties: {
            symbol: { 
              type: "string", 
              description: "Trading pair symbol (e.g., BTCUSDT)" 
            }
          },
          required: ["symbol"]
        }
      },
      {
        name: "get_klines",
        description: "Get historical candlestick data",
        inputSchema: {
          type: "object",
          properties: {
            symbol: { 
              type: "string", 
              description: "Trading pair symbol (e.g., BTCUSDT)" 
            },
            type: { 
              type: "string", 
              enum: ["spot", "futures"], 
              description: "Market type" 
            },
            interval: {
              type: "string",
              enum: ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w", "1M"],
              description: "Kline/candlestick chart interval"
            },
            limit: {
              type: "number",
              description: "Number of klines to retrieve (default 500, max 1000)"
            }
          },
          required: ["symbol", "type", "interval"]
        }
      },
      {
        name: "subscribe_market_data",
        description: "Subscribe to real-time market data updates",
        inputSchema: {
          type: "object",
          properties: {
            symbol: { 
              type: "string", 
              description: "Trading pair symbol (e.g., BTCUSDT)" 
            },
            type: { 
              type: "string", 
              enum: ["spot", "futures"], 
              description: "Market type" 
            },
            streams: {
              type: "array",
              items: {
                type: "string",
                enum: ["ticker", "trade", "bookTicker", "kline", "depth", "forceOrder", "markPrice", "openInterest"]
              },
              description: "List of data streams to subscribe to"
            }
          },
          required: ["symbol", "type", "streams"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case "get_market_data": {
        if (!isMarketDataParams(request.params.arguments)) {
          logger.error('Invalid market data parameters:', request.params.arguments);
          throw new Error('Invalid market data parameters');
        }

        const { symbol, type } = request.params.arguments;
        
        try {
          logger.info(`Fetching ${type} market data for ${symbol}`);
          const data = await restConnector.getMarketData(symbol, type);
          return {
            content: [{
              type: "text",
              text: JSON.stringify(data, null, 2)
            }]
          };
        } catch (error: any) {
          logger.error(`Market data error for ${symbol} (${type}):`, error?.message || error);
          if (error?.response?.data) {
            logger.error('Response data:', error.response.data);
          }
          throw new APIError(error?.message || 'Failed to fetch market data', error);
        }
      }

      case "test_futures_endpoints": {
        if (!isFuturesDataParams(request.params.arguments)) {
          throw new Error('Invalid futures data parameters');
        }
        
        const { symbol } = request.params.arguments;
        logger.info(`Testing futures endpoints for ${symbol}`);
        
        try {
          const [openInterest, fundingRate, liquidations] = await Promise.all([
            restConnector.getFuturesOpenInterest(symbol),
            restConnector.getFuturesFundingRate(symbol),
            restConnector.getFuturesLiquidations(symbol)
          ]);

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                openInterest,
                fundingRate,
                liquidations
              }, null, 2)
            }]
          };
        } catch (error: any) {
          logger.error(`Futures endpoints test error for ${symbol}:`, error?.message || error);
          throw new APIError(error?.message || 'Failed to test futures endpoints', error);
        }
      }

      case "get_futures_open_interest": {
        if (!isFuturesDataParams(request.params.arguments)) {
          throw new Error('Invalid futures data parameters');
        }
        const { symbol } = request.params.arguments;
        const data = await restConnector.getFuturesOpenInterest(symbol);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(data, null, 2)
          }]
        };
      }

      case "get_futures_funding_rate": {
        if (!isFuturesDataParams(request.params.arguments)) {
          throw new Error('Invalid futures data parameters');
        }
        const { symbol } = request.params.arguments;
        const data = await restConnector.getFuturesFundingRate(symbol);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(data, null, 2)
          }]
        };
      }

      case "get_klines": {
        if (!isKlineParams(request.params.arguments)) {
          throw new Error('Invalid kline parameters');
        }
        const { symbol, type, interval, limit } = request.params.arguments;
        const data = await restConnector.getKlines(symbol, type, interval, limit);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(data, null, 2)
          }]
        };
      }

      case "subscribe_market_data": {
        if (!isStreamParams(request.params.arguments)) {
          throw new Error('Invalid stream parameters');
        }
        const { symbol, type, streams } = request.params.arguments;
        
        const validatedStreams = streams.map(stream => {
          if (isStreamEventType(stream)) {
            return stream;
          }
          throw new Error(`Invalid stream type: ${stream}`);
        });

        wsManager.subscribe(symbol, type, validatedStreams);
        
        wsManager.onStreamData(symbol, validatedStreams[0], (data: StreamEventData) => {
          logger.info(`Received WebSocket data for ${symbol}:`, data);
        });

        return {
          content: [{
            type: "text",
            text: `Successfully subscribed to ${streams.join(", ")} for ${symbol}`
          }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error: any) {
    logger.error('Error handling tool request:', error?.message || error);
    throw error instanceof APIError ? error : new APIError(
      error?.message || 'Unknown error occurred',
      error
    );
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Binance MCP server started successfully');
}

process.on('SIGINT', () => {
  logger.info('Shutting down server...');
  wsManager.close();
  process.exit(0);
});

main().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
