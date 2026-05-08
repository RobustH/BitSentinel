import type { BinanceTickerUpdate, MarketStreamStatus } from "../types";

type BinanceTickerPayload = {
  e: "24hrTicker";
  E: number;
  s: string;
  c: string;
  P: string;
  q: string;
};

type CombinedStreamMessage = {
  stream: string;
  data: BinanceTickerPayload;
};

type StreamOptions = {
  symbols: string[];
  onTicker: (update: BinanceTickerUpdate) => void;
  onStatus: (status: Partial<MarketStreamStatus>) => void;
};

export type StopMarketStream = () => void;

const endpointForSymbols = (symbols: string[]) => {
  const streams = symbols.map((symbol) => `${symbol.toLowerCase()}@ticker`).join("/");
  return `wss://stream.binance.com:9443/stream?streams=${streams}`;
};

export function startBinanceTickerStream({ symbols, onTicker, onStatus }: StreamOptions): StopMarketStream {
  if (typeof WebSocket === "undefined") {
    onStatus({ status: "error", error: "Current runtime does not support WebSocket" });
    return () => undefined;
  }

  let socket: WebSocket | null = null;
  let stopped = false;
  let reconnectTimer: number | null = null;
  let reconnects = 0;
  const endpoint = endpointForSymbols(symbols);

  const connect = () => {
    if (stopped) return;
    onStatus({ status: "connecting", endpoint, error: null });
    socket = new WebSocket(endpoint);

    socket.onopen = () => {
      onStatus({ status: "connected", endpoint, error: null, reconnects });
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as CombinedStreamMessage;
        const payload = message.data;
        if (!payload?.s || !payload.c) return;
        onTicker({
          symbol: payload.s,
          price: Number(payload.c),
          change24h: Number(Number(payload.P).toFixed(2)),
          quoteVolume: Number(payload.q),
          eventTime: payload.E,
        });
      } catch (error) {
        onStatus({ status: "error", error: error instanceof Error ? error.message : "Invalid WebSocket payload" });
      }
    };

    socket.onerror = () => {
      onStatus({ status: "error", error: "Binance WebSocket connection error" });
    };

    socket.onclose = () => {
      if (stopped) {
        onStatus({ status: "disconnected", error: null });
        return;
      }

      reconnects += 1;
      onStatus({ status: "disconnected", reconnects, error: "Binance WebSocket disconnected, reconnecting" });
      const delay = Math.min(10000, 1000 + reconnects * 1000);
      reconnectTimer = window.setTimeout(connect, delay);
    };
  };

  connect();

  return () => {
    stopped = true;
    if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
    if (socket && socket.readyState <= WebSocket.OPEN) socket.close();
    socket = null;
    onStatus({ status: "disconnected", error: null });
  };
}
