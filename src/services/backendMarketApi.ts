import type { IndicatorSummary, KlinePoint, SymbolMarket } from "../types";

const BACKEND_API_BASE_URL = import.meta.env.VITE_BACKEND_API_BASE_URL ?? "http://127.0.0.1:8000";

type BackendMarketTicker = {
  symbol: string;
  price: number;
  price_change_percent: number;
  quote_volume: number;
};

type BackendMarketKline = {
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type BackendIndicatorSummary = {
  symbol: string;
  interval: string;
  latest_close: number;
  ema: IndicatorSummary["ema"];
  macd: IndicatorSummary["macd"];
  trend: IndicatorSummary["trend"];
  score: number;
  source_bars: number;
};

const requestJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${BACKEND_API_BASE_URL}${path}`);
  if (!response.ok) throw new Error(`Backend market request failed: ${response.status}`);
  return response.json() as Promise<T>;
};

const formatQuoteVolume = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  return `${value.toFixed(0)}`;
};

export async function fetchBackendMarketTickers(symbols: string[]): Promise<SymbolMarket[]> {
  const params = new URLSearchParams({ symbols: symbols.join(",") });
  const rows = await requestJson<BackendMarketTicker[]>(`/api/market/tickers?${params.toString()}`);

  return rows.map((row) => ({
    symbol: row.symbol,
    price: row.price,
    change24h: Number(row.price_change_percent.toFixed(2)),
    volume: formatQuoteVolume(row.quote_volume),
    status: "normal",
  }));
}

const toLocalTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}`;
};

export async function fetchBackendMarketKlines(
  symbol: string,
  interval = "1h",
  limit = 80,
): Promise<KlinePoint[]> {
  const params = new URLSearchParams({ symbol, interval, limit: String(limit) });
  const rows = await requestJson<BackendMarketKline[]>(`/api/market/klines?${params.toString()}`);

  return rows.map((row) => ({
    time: toLocalTime(row.open_time),
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
  }));
}

export async function fetchBackendIndicatorSummary(
  symbol: string,
  interval = "1h",
  limit = 200,
): Promise<IndicatorSummary> {
  const params = new URLSearchParams({ symbol, interval, limit: String(limit) });
  const row = await requestJson<BackendIndicatorSummary>(`/api/indicators/summary?${params.toString()}`);

  return {
    symbol: row.symbol,
    interval: row.interval,
    latestClose: row.latest_close,
    ema: row.ema,
    macd: row.macd,
    trend: row.trend,
    score: row.score,
    sourceBars: row.source_bars,
  };
}
