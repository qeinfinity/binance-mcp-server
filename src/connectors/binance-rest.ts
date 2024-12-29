/*******************************************************************
 * binance-rest.ts
 * 
 * DROP THIS FILE IN PLACE of your existing binance-rest.ts
 *
 * KEY CHANGES:
 *  - /fapi/v1/forceOrders is user-data => must be signed with HMAC
 *  - We sign the query in getFuturesLiquidations(...) using config.API_SECRET
 *  - 24hr ticker is now at /fapi/v1/ticker/24hr
 *******************************************************************/

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto'; // <-- Needed for HMAC signing
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { APIError } from '../types/api-types.js';
import { MarketData, FuturesMarketData } from '../types/market-data.js';

/**
 * BinanceRestConnector
 *  - Provides getMarketData(...) for both spot & futures
 *  - getFuturesOpenInterest(...) / getFuturesFundingRate(...) / getFuturesLiquidations(...)
 *  - Also getKlines(...) & getExchangeInfo(...)
 */
export class BinanceRestConnector {
  private readonly axiosInstance: AxiosInstance;
  private readonly retryDelay = config.HTTP_RETRY_DELAY;
  private readonly maxRetries = config.HTTP_MAX_RETRIES;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: config.HTTP_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        // Attach your API key to EVERY request (public & signed)
        'X-MBX-APIKEY': config.API_KEY
      }
    });
    logger.info('BinanceRestConnector initialized');
  }

  /**
   * Retries a request up to `maxRetries` times with exponential backoff
   */
  private async executeWithRetry<T>(operation: () => Promise<T>, retries = 0): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      logger.error('Request failed:', error?.message || error);
      if (error?.response?.data) {
        logger.error('Response data:', error.response.data);
      }

      if (retries >= this.maxRetries) {
        throw error;
      }

      const delay = this.retryDelay * Math.pow(2, retries);
      logger.warn(`Retrying in ${delay}ms... (Attempt ${retries + 1}/${this.maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.executeWithRetry(operation, retries + 1);
    }
  }

  private safeNumber(value: string | number | undefined): number {
    if (value == null) return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Helper to sign user-data requests (like /forceOrders).
   *  1) Add `timestamp` to your params
   *  2) Generate signature using your `API_SECRET`
   */
  private signQuery(params: Record<string, any>, secret: string): string {
    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const signature = crypto
      .createHmac('sha256', secret)
      .update(queryString)
      .digest('hex');

    return `${queryString}&signature=${signature}`;
  }

  /***********************************************************
   * getMarketData
   * 
   *  - For spot: /api/v3/ticker/24hr?symbol=...
   *  - For futures: /fapi/v1/ticker/24hr + openInterest + fundingRate + forceOrders
   ***********************************************************/
  async getMarketData(symbol: string, type: 'spot' | 'futures'): Promise<MarketData | FuturesMarketData> {
    try {
      logger.info(`Getting ${type} market data for ${symbol}`);
      const upperSymbol = symbol.toUpperCase();

      if (type === 'spot') {
        // Spot 24hr ticker:
        const data = await this.executeWithRetry(() =>
          this.axiosInstance
            .get(`${config.SPOT_REST_URL}/ticker/24hr`, {
              params: { symbol: upperSymbol }
            })
            .then((res) => res.data)
        );

        // Build & return a MarketData object
        const spotResult: MarketData = {
          symbol: data.symbol,
          exchange: 'Binance',
          type: 'spot',
          price: this.safeNumber(data.lastPrice),
          timestamp: data.closeTime,
          volume24h: this.safeNumber(data.volume),
          priceChange24h: this.safeNumber(data.priceChange),
          price24hHigh: this.safeNumber(data.highPrice),
          price24hLow: this.safeNumber(data.lowPrice),
          tradeCount24h: data.count
        };
        return spotResult;
      }

      // FUTURES: get 24hr ticker, openInterest, fundingRate, liquidations
      logger.info('Fetching futures 24hr ticker + open interest + funding rate + liquidations');

      const [marketData, openInterest, fundingData, liquidations] = await Promise.all([
        // 1) 24hr ticker => /fapi/v1/ticker/24hr
        this.executeWithRetry(() =>
          this.axiosInstance
            .get(`${config.FUTURES_REST_URL}/fapi/v1/ticker/24hr`, {
              params: { symbol: upperSymbol }
            })
            .then((res) => res.data)
        ),

        // 2) open interest => /fapi/v1/openInterest
        this.getFuturesOpenInterest(upperSymbol),

        // 3) funding rate => /fapi/v1/premiumIndex
        this.getFuturesFundingRate(upperSymbol),

        // 4) forced orders => must be SIGNED => done inside getFuturesLiquidations
        this.getFuturesLiquidations(upperSymbol)
      ]);

      logger.info('Successfully fetched all futures data components');

      // Build & return a FuturesMarketData object
      const futuresResult: FuturesMarketData = {
        symbol: marketData.symbol,
        exchange: 'Binance',
        type: 'futures',
        price: this.safeNumber(marketData.lastPrice),
        timestamp: marketData.closeTime,
        volume24h: this.safeNumber(marketData.volume),
        priceChange24h: this.safeNumber(marketData.priceChange),
        price24hHigh: this.safeNumber(marketData.highPrice),
        price24hLow: this.safeNumber(marketData.lowPrice),
        tradeCount24h: marketData.count,

        markPrice: fundingData.markPrice,            // string
        indexPrice: fundingData.indexPrice,          // string
        lastFundingRate: fundingData.lastFundingRate,// string
        nextFundingTime: fundingData.nextFundingTime,// number
        openInterest: openInterest.openInterest      // string
      };

      // If you want # of liquidations in the last 24h, do:
      // futuresResult.liquidations24h = liquidations.length;

      return futuresResult;
    } catch (error: any) {
      logger.error(`Failed to get ${type} market data:`, error?.message || error);
      throw new APIError(`Failed to fetch ${type} market data`, error);
    }
  }

  /**
   * getFuturesOpenInterest => /fapi/v1/openInterest
   * Public, no signature needed
   */
  async getFuturesOpenInterest(symbol: string): Promise<any> {
    try {
      logger.info(`Getting futures open interest for ${symbol}`);
      const resp = await this.executeWithRetry(() =>
        this.axiosInstance.get(`${config.FUTURES_REST_URL}/fapi/v1/openInterest`, {
          params: { symbol }
        })
      );
      return resp.data;
    } catch (error: any) {
      logger.error('Failed to get futures open interest:', error?.message || error);
      throw new APIError('Failed to fetch futures open interest', error);
    }
  }

  /**
   * getFuturesFundingRate => /fapi/v1/premiumIndex
   * Public, no signature needed
   */
  async getFuturesFundingRate(symbol: string): Promise<any> {
    try {
      logger.info(`Getting futures funding rate for ${symbol}`);
      const resp = await this.executeWithRetry(() =>
        this.axiosInstance.get(`${config.FUTURES_REST_URL}/fapi/v1/premiumIndex`, {
          params: { symbol }
        })
      );
      return resp.data;
    } catch (error: any) {
      logger.error('Failed to get futures funding rate:', error?.message || error);
      throw new APIError('Failed to fetch futures funding rate', error);
    }
  }

  /**
   * getFuturesLiquidations => /fapi/v1/forceOrders
   * This is a USER_DATA endpoint => must sign with timestamp & signature
   */
  async getFuturesLiquidations(symbol: string): Promise<any[]> {
    try {
      logger.info(`Getting futures liquidations for ${symbol}`);

      // Must pass a timestamp & sign the entire query
      const params = {
        symbol,
        startTime: Date.now() - 24 * 60 * 60 * 1000,
        limit: 1000,
        timestamp: Date.now()
        // optionally: recvWindow: 5000
      };
      const query = this.signQuery(params, config.API_SECRET);

      const url = `${config.FUTURES_REST_URL}/fapi/v1/forceOrders?${query}`;
      const resp = await this.executeWithRetry(() => this.axiosInstance.get(url));
      return resp.data;
    } catch (error: any) {
      logger.error('Failed to get futures liquidations:', error?.message || error);
      throw new APIError('Failed to fetch futures liquidations', error);
    }
  }

  /**
   * getKlines => /api/v3/klines for spot, or /fapi/v1/klines for futures
   */
  async getKlines(symbol: string, type: 'spot' | 'futures', interval: string, limit?: number): Promise<any> {
    try {
      logger.info(`Getting ${type} klines for ${symbol}`);
      const baseUrl =
        type === 'spot'
          ? `${config.SPOT_REST_URL}/klines`
          : `${config.FUTURES_REST_URL}/fapi/v1/klines`;

      const resp = await this.executeWithRetry(() =>
        this.axiosInstance.get(baseUrl, {
          params: {
            symbol: symbol.toUpperCase(),
            interval,
            limit: limit || 500
          }
        })
      );
      return resp.data;
    } catch (error: any) {
      logger.error(`Failed to get ${type} klines:`, error?.message || error);
      throw new APIError('Failed to fetch klines data', error);
    }
  }

  /**
   * getExchangeInfo => /api/v3/exchangeInfo (spot) or /fapi/v1/exchangeInfo (futures)
   */
  async getExchangeInfo(type: 'spot' | 'futures'): Promise<any> {
    try {
      logger.info(`Getting ${type} exchange info`);
      const url =
        type === 'spot'
          ? `${config.SPOT_REST_URL}/exchangeInfo`
          : `${config.FUTURES_REST_URL}/fapi/v1/exchangeInfo`;

      const resp = await this.executeWithRetry(() => this.axiosInstance.get(url));
      return resp.data;
    } catch (error: any) {
      logger.error(`Failed to get ${type} exchange info:`, error?.message || error);
      throw new APIError('Failed to fetch exchange info', error);
    }
  }
}


