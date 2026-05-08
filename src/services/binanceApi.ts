import type { KlinePoint, MoneyFlowPoint, SymbolMarket } from "../types";

const SPOT_BASE_URL = "https://api.binance.com";
const FUTURES_BASE_URL = "https://fapi.binance.com";
const FUTURES_DATA_BASE_URL = "https://fapi.binance.com";

type BinanceTicker24h = {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
};

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

type BinancePremiumIndex = {
  symbol: string;
  lastFundingRate: string;
};

type BinanceOpenInterest = {
  symbol: string;
  sumOpenInterestValue: string;
};

type BinanceRatio = {
  symbol: string;
  longShortRatio?: string;
  buySellRatio?: string;
};

const requestJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Binance request failed: ${response.status}`);
  return response.json() as Promise<T>;
};

const formatQuoteVolume = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  return `${value.toFixed(0)}`;
};

const toLocalTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}`;
};

export async function fetchSpotTickers(symbols: string[]): Promise<SymbolMarket[]> {
  const params = new URLSearchParams({ symbols: JSON.stringify(symbols) });
  const rows = await requestJson<BinanceTicker24h[]>(`${SPOT_BASE_URL}/api/v3/ticker/24hr?${params.toString()}`);

  return rows.map((row) => ({
    symbol: row.symbol,
    price: Number(row.lastPrice),
    change24h: Number(Number(row.priceChangePercent).toFixed(2)),
    volume: formatQuoteVolume(Number(row.quoteVolume)),
    status: "normal",
  }));
}

export async function fetchSpotKlines(symbol: string, interval = "1h", limit = 80): Promise<KlinePoint[]> {
  const params = new URLSearchParams({ symbol, interval, limit: String(limit) });
  const rows = await requestJson<BinanceKline[]>(`${SPOT_BASE_URL}/api/v3/klines?${params.toString()}`);

  return rows.map((row) => ({
    time: toLocalTime(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
  }));
}

export async function fetchFuturesMoneyFlows(symbols: string[], period = "1h"): Promise<MoneyFlowPoint[]> {
  const rows = await Promise.all(
    symbols.map(async (symbol) => {
      const [premium, openInterest, takerRatio, topRatio] = await Promise.all([
        requestJson<BinancePremiumIndex>(`${FUTURES_BASE_URL}/fapi/v1/premiumIndex?symbol=${symbol}`),
        requestJson<BinanceOpenInterest[]>(
          `${FUTURES_DATA_BASE_URL}/futures/data/openInterestHist?symbol=${symbol}&period=${period}&limit=2`,
        ),
        requestJson<BinanceRatio[]>(
          `${FUTURES_DATA_BASE_URL}/futures/data/takerlongshortRatio?symbol=${symbol}&period=${period}&limit=1`,
        ),
        requestJson<BinanceRatio[]>(
          `${FUTURES_DATA_BASE_URL}/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=1`,
        ),
      ]);

      const latestOi = Number(openInterest.at(-1)?.sumOpenInterestValue ?? 0);
      const previousOi = Number(openInterest.at(-2)?.sumOpenInterestValue ?? latestOi);
      const oiChange = previousOi ? ((latestOi - previousOi) / previousOi) * 100 : 0;
      const buySellRatio = Number(takerRatio[0]?.buySellRatio ?? 1);
      const longShortRatio = Number(topRatio[0]?.longShortRatio ?? 1);

      return {
        symbol,
        fundingRate: Number((Number(premium.lastFundingRate) * 100).toFixed(4)),
        oiChange: Number(oiChange.toFixed(2)),
        takerBuyRatio: Number(((buySellRatio / (1 + buySellRatio)) * 100).toFixed(1)),
        topLongRatio: Number(((longShortRatio / (1 + longShortRatio)) * 100).toFixed(1)),
        netFlow: Number(((latestOi - previousOi) / 1_000_000).toFixed(1)),
      };
    }),
  );

  return rows;
}
