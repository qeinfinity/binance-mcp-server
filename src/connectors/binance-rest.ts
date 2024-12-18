import axios, { AxiosInstance } from 'axios';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { APIError } from '../types/api-types.js';

export class BinanceRestConnector {
  private readonly axiosInstance: AxiosInstance;
  private readonly retryDelay = config.HTTP_RETRY_DELAY;
  private readonly maxRetries = config.HTTP_MAX_RETRIES;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: config.HTTP_TIMEOUT,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    logger.info('BinanceRestConnector initialized');
    logger.info(`Futures REST URL: ${config.FUTURES_REST_URL}`);
  }

  private async executeWithRetry<T>(operation: () => Promise<T>, retries = 0): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retries >= this.maxRetries) {
        throw error;
      }

      const delay = this.retryDelay * Math.pow(2, retries);
      logger.warn(`Request failed, retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.executeWithRetry(operation, retries + 1);
    }
  }

  public async getMarketData(symbol: string, type: 'spot' | 'futures'): Promise<any> {
    try {
      logger.info(`Getting ${type} market data for ${symbol}`);

      if (type === 'spot') {
        const data = await this.executeWithRetry(() =>
          this.axiosInstance.get(`${config.SPOT_REST_URL}/ticker/24hr`, {
            params: { symbol: symbol.toUpperCase() }
          }).then(response => response.data)
        );
        logger.info('Successfully fetched spot market data');
        return data;
      }

      // For futures, fetch all relevant data in parallel
      logger.info('Fetching futures data from multiple endpoints...');
      
      try {
        const [
          marketData,
          openInterest,
          fundingData,
          liquidations
        ] = await Promise.all([
          // Basic market data
          this.executeWithRetry(() =>
            this.axiosInstance.get(`${config.FUTURES_REST_URL}/ticker/24hr`, {
              params: { symbol: symbol.toUpperCase() }
            }).then(response => {
              logger.info('Successfully fetched futures ticker data');
              return response.data;
            })
          ),
          // Open interest
          this.executeWithRetry(() =>
            this.axiosInstance.get(`${config.FUTURES_REST_URL}/openInterest`, {
              params: { symbol: symbol.toUpperCase() }
            }).then(response => {
              logger.info('Successfully fetched open interest data');
              return response.data;
            })
          ),
          // Premium index (funding rate)
          this.executeWithRetry(() =>
            this.axiosInstance.get(`${config.FUTURES_REST_URL}/premiumIndex`, {
              params: {
                symbol: symbol.toUpperCase()
              }
            }).then(response => {
              logger.info('Successfully fetched funding rate data');
              return response.data;
            })
          ),
          // Recent liquidations
          this.executeWithRetry(() =>
            this.axiosInstance.get(`${config.FUTURES_REST_URL}/forceOrders`, {
              params: {
                symbol: symbol.toUpperCase(),
                startTime: Date.now() - 24 * 60 * 60 * 1000,
                limit: 100
              }
            }).then(response => {
              logger.info('Successfully fetched liquidations data');
              return response.data;
            })
          )
        ]);

        logger.info('Successfully fetched all futures data, combining responses...');

        // Combine all futures data with correct field mappings
        const combinedData = {
          ...marketData,
          openInterest: openInterest.openInterest,
          fundingRate: fundingData.lastFundingRate,
          markPrice: fundingData.markPrice,
          nextFundingTime: fundingData.nextFundingTime,
          liquidations24h: liquidations.length,
          liquidationVolume24h: liquidations.reduce((sum: number, order: any) => 
            sum + parseFloat(order.executedQty), 0
          )
        };

        logger.info('Successfully combined futures data');
        return combinedData;

      } catch (error) {
        logger.error('Error in futures data Promise.all:', error);
        throw error;
      }

    } catch (error) {
      logger.error('Error fetching market data:', error);
      throw new APIError('Failed to fetch market data', error as Error);
    }
  }

  public async getFuturesOpenInterest(symbol: string): Promise<any> {
    try {
      logger.info(`Getting futures open interest for ${symbol}`);
      const response = await this.executeWithRetry(() =>
        this.axiosInstance.get(`${config.FUTURES_REST_URL}/openInterest`, {
          params: { symbol: symbol.toUpperCase() }
        })
      );
      logger.info('Successfully fetched open interest data');
      return response.data;
    } catch (error) {
      logger.error('Error fetching open interest:', error);
      throw new APIError('Failed to fetch open interest data', error as Error);
    }
  }

  public async getFuturesFundingRate(symbol: string): Promise<any> {
    try {
      logger.info(`Getting futures funding rate for ${symbol}`);
      const response = await this.executeWithRetry(() =>
        this.axiosInstance.get(`${config.FUTURES_REST_URL}/premiumIndex`, {
          params: {
            symbol: symbol.toUpperCase()
          }
        })
      );
      logger.info('Successfully fetched funding rate data');
      return response.data;
    } catch (error) {
      logger.error('Error fetching funding rate:', error);
      throw new APIError('Failed to fetch funding rate data', error as Error);
    }
  }

  public async getFuturesLiquidations(symbol: string): Promise<any> {
    try {
      logger.info(`Getting futures liquidations for ${symbol}`);
      const response = await this.executeWithRetry(() =>
        this.axiosInstance.get(`${config.FUTURES_REST_URL}/forceOrders`, {
          params: {
            symbol: symbol.toUpperCase(),
            startTime: Date.now() - 24 * 60 * 60 * 1000,
            limit: 1000
          }
        })
      );
      logger.info('Successfully fetched liquidations data');
      return response.data;
    } catch (error) {
      logger.error('Error fetching liquidations:', error);
      throw new APIError('Failed to fetch liquidations data', error as Error);
    }
  }

  public async getKlines(
    symbol: string,
    type: 'spot' | 'futures',
    interval: string,
    limit?: number
  ): Promise<any> {
    try {
      logger.info(`Getting ${type} klines for ${symbol}`);
      const baseUrl = type === 'spot' ? config.SPOT_REST_URL : config.FUTURES_REST_URL;
      const response = await this.executeWithRetry(() =>
        this.axiosInstance.get(`${baseUrl}/klines`, {
          params: {
            symbol: symbol.toUpperCase(),
            interval,
            limit: limit || 500
          }
        })
      );
      logger.info('Successfully fetched klines data');
      return response.data;
    } catch (error) {
      logger.error('Error fetching klines:', error);
      throw new APIError('Failed to fetch klines data', error as Error);
    }
  }

  public async getExchangeInfo(type: 'spot' | 'futures'): Promise<any> {
    try {
      logger.info(`Getting ${type} exchange info`);
      const baseUrl = type === 'spot' ? config.SPOT_REST_URL : config.FUTURES_REST_URL;
      const response = await this.executeWithRetry(() =>
        this.axiosInstance.get(`${baseUrl}/exchangeInfo`)
      );
      logger.info('Successfully fetched exchange info');
      return response.data;
    } catch (error) {
      logger.error('Error fetching exchange info:', error);
      throw new APIError('Failed to fetch exchange info', error as Error);
    }
  }
}