import type { SymbolMarket } from "../types";

const BACKEND_API_BASE_URL = import.meta.env.VITE_BACKEND_API_BASE_URL ?? "http://127.0.0.1:8000";

type BackendMarketTicker = {
  symbol: string;
  price: number;
  price_change_percent: number;
  quote_volume: number;
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
