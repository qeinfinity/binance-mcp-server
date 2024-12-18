# Binance MCP Server

A Model Context Protocol (MCP) server implementation for Binance market data with WebSocket support.

## Features

- Real-time market data streaming via WebSocket
- Support for both spot and futures markets
- Automatic reconnection with exponential backoff
- Type-safe message handling
- Comprehensive error handling

## Installation

```bash
npm install
```

## Usage

### Starting the Server

```bash
npm start
```

### WebSocket Stream Types

The following stream types are supported:

- `trade`: Real-time trade data
- `ticker`: 24-hour rolling window price change statistics
- `bookTicker`: Best bid/ask price and quantity
- `kline`: Candlestick data
- `markPrice`: Mark price and funding rate (futures only)
- `fundingRate`: Funding rate data (futures only)

### Example Usage in Claude Desktop

```typescript
// Subscribe to trade and ticker streams for BTC/USDT
await server.subscribe('BTCUSDT', 'spot', ['trade', 'ticker']);

// Handle incoming data
server.onStreamData('BTCUSDT', 'trade', (data) => {
  console.log('New trade:', data);
});
```

## Development

### Running Tests

```bash
npm test
```

### Building

```bash
npm run build
```

## License

Private
