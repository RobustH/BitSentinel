import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBackendIndicatorSummary, fetchBackendMarketKlines, fetchBackendMarketTickers } from "../services/backendMarketApi";
import { fetchBackendPersistedStrategyData, fetchBackendStrategyEvaluations, runBackendStrategyWorkerOnceAndPersist } from "../services/backendStrategyApi";
import { fetchBackendDatabaseConnectionStatus } from "../services/backendSystemApi";
import { createBitSentinelStore } from "./appStore";

vi.mock("../services/backendMarketApi", () => ({
  fetchBackendIndicatorSummary: vi.fn(),
  fetchBackendMarketKlines: vi.fn(),
  fetchBackendMarketTickers: vi.fn(),
}));

vi.mock("../services/backendStrategyApi", () => ({
  fetchBackendPersistedStrategyData: vi.fn(),
  fetchBackendStrategyEvaluations: vi.fn(),
  runBackendStrategyWorkerOnceAndPersist: vi.fn(),
}));

vi.mock("../services/backendSystemApi", () => ({
  fetchBackendDatabaseConnectionStatus: vi.fn(),
}));

const mockedFetchBackendIndicatorSummary = vi.mocked(fetchBackendIndicatorSummary);
const mockedFetchBackendMarketKlines = vi.mocked(fetchBackendMarketKlines);
const mockedFetchBackendMarketTickers = vi.mocked(fetchBackendMarketTickers);
const mockedFetchBackendPersistedStrategyData = vi.mocked(fetchBackendPersistedStrategyData);
const mockedFetchBackendStrategyEvaluations = vi.mocked(fetchBackendStrategyEvaluations);
const mockedFetchBackendDatabaseConnectionStatus = vi.mocked(fetchBackendDatabaseConnectionStatus);
const mockedRunBackendStrategyWorkerOnceAndPersist = vi.mocked(runBackendStrategyWorkerOnceAndPersist);

describe("strategy assembly mock store", () => {
  beforeEach(() => {
    mockedFetchBackendIndicatorSummary.mockReset();
    mockedFetchBackendMarketKlines.mockReset();
    mockedFetchBackendMarketTickers.mockReset();
    mockedFetchBackendPersistedStrategyData.mockReset();
    mockedFetchBackendStrategyEvaluations.mockReset();
    mockedFetchBackendDatabaseConnectionStatus.mockReset();
    mockedRunBackendStrategyWorkerOnceAndPersist.mockReset();
  });

  it("creates a strategy instance and independent states for every mounted symbol", () => {
    const store = createBitSentinelStore();

    const instanceId = store.getState().createStrategyInstance({
      templateId: "tpl-dual-ma",
      name: "4h/1h 双均线趋势监控",
      symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
      slots: {
        direction_tf: "4h",
        structure_tf: "1h",
        trigger_tf: "15m",
      },
      conditionIds: ["ema-trend-up", "ema-cross-up", "oi-rising"],
    });

    const state = store.getState();
    expect(state.strategyInstances.find((item) => item.id === instanceId)?.symbols).toEqual([
      "BTCUSDT",
      "ETHUSDT",
      "SOLUSDT",
    ]);
    expect(state.strategyStates.filter((item) => item.instanceId === instanceId)).toHaveLength(3);
    expect(
      state.strategyStates
        .filter((item) => item.instanceId === instanceId)
        .map((item) => item.symbol)
        .sort(),
    ).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
  });

  it("tracks market stream status independently from mock market data", () => {
    const store = createBitSentinelStore();

    expect(store.getState().marketStreamStatus.status).toBe("idle");
    store.getState().stopBinanceMarketStream();

    expect(store.getState().marketStreamStatus.status).toBe("disconnected");
    expect(store.getState().symbols.length).toBeGreaterThan(0);
  });

  it("evaluates strategy monitors from backend without collapsing independent strategy states", async () => {
    const store = createBitSentinelStore();
    mockedFetchBackendStrategyEvaluations.mockResolvedValue([
      {
        instanceId: "inst-ma-btc",
        symbol: "BTCUSDT",
        evaluatedAt: "2026-05-20 10:00:00",
        suggestedState: "waiting_trigger",
        score: 80,
        passedCount: 4,
        totalCount: 5,
        shouldTriggerSignal: false,
        nextWaitingFor: "后端返回：等待触发周期信号",
        conditions: [],
      },
    ]);

    await store.getState().evaluateStrategyMonitors();

    const state = store.getState();
    expect(mockedFetchBackendStrategyEvaluations).toHaveBeenCalledWith({
      strategyInstances: expect.any(Array),
      marketSeries: expect.any(Object),
      moneyFlows: expect.any(Array),
      signals: expect.any(Array),
    });
    expect(state.strategyEvaluations).toHaveLength(1);
    expect(state.strategyEvaluations[0]).toMatchObject({
      instanceId: "inst-ma-btc",
      symbol: "BTCUSDT",
      totalCount: 5,
      passedCount: 4,
    });
    expect(state.strategyStates).toHaveLength(3);
  });

  it("falls back to local strategy evaluation when backend evaluation fails", async () => {
    const store = createBitSentinelStore();
    mockedFetchBackendStrategyEvaluations.mockRejectedValue(new Error("strategy backend unavailable"));

    await store.getState().evaluateStrategyMonitors();

    const state = store.getState();
    expect(state.strategyEvaluations.length).toBeGreaterThan(0);
    expect(state.strategyStates).toHaveLength(3);
  });

  it("refreshes market data from backend API and marks backend as source", async () => {
    const store = createBitSentinelStore();
    const nextSymbols = store.getState().symbols.map((item) => ({
      ...item,
      price: item.symbol === "BTCUSDT" ? 123456 : item.price,
      change24h: item.symbol === "BTCUSDT" ? 1.23 : item.change24h,
    }));
    mockedFetchBackendMarketTickers.mockResolvedValue(nextSymbols);

    await store.getState().refreshBackendMarketData();

    expect(mockedFetchBackendMarketTickers).toHaveBeenCalledWith(["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"]);
    expect(store.getState().marketDataStatus.source).toBe("backend");
    expect(store.getState().marketDataStatus.error).toBeNull();
    expect(store.getState().symbols.find((item) => item.symbol === "BTCUSDT")?.price).toBe(123456);
  });

  it("keeps existing market data when backend refresh fails", async () => {
    const store = createBitSentinelStore();
    const previousSymbols = store.getState().symbols;
    mockedFetchBackendMarketTickers.mockRejectedValue(new Error("backend unavailable"));

    await store.getState().refreshBackendMarketData();

    expect(store.getState().symbols).toBe(previousSymbols);
    expect(store.getState().marketDataStatus.source).toBe("mock");
    expect(store.getState().marketDataStatus.error).toBe("backend unavailable");
  });

  it("refreshes symbol klines from backend API", async () => {
    const store = createBitSentinelStore();
    mockedFetchBackendMarketKlines.mockResolvedValue([
      { time: "2026-05-13 20:00", open: 100, high: 110, low: 95, close: 108 },
      { time: "2026-05-13 21:00", open: 108, high: 120, low: 104, close: 118 },
    ]);

    await store.getState().refreshBackendKlines("ETHUSDT", "4h");

    expect(mockedFetchBackendMarketKlines).toHaveBeenCalledWith("ETHUSDT", "4h", 80);
    expect(store.getState().marketSeries.ETHUSDT).toHaveLength(2);
    expect(store.getState().klineRefreshStatus).toMatchObject({
      source: "backend",
      symbol: "ETHUSDT",
      interval: "4h",
      error: null,
    });
  });

  it("keeps existing klines when backend kline refresh fails", async () => {
    const store = createBitSentinelStore();
    const previousSeries = store.getState().marketSeries.BTCUSDT;
    mockedFetchBackendMarketKlines.mockRejectedValue(new Error("kline unavailable"));

    await store.getState().refreshBackendKlines("BTCUSDT", "1d");

    expect(store.getState().marketSeries.BTCUSDT).toBe(previousSeries);
    expect(store.getState().klineRefreshStatus.error).toBe("kline unavailable");
  });

  it("refreshes indicator summary from backend API", async () => {
    const store = createBitSentinelStore();
    mockedFetchBackendIndicatorSummary.mockResolvedValue({
      symbol: "BTCUSDT",
      interval: "1h",
      latestClose: 100,
      ema: { ema9: 99, ema21: 95, ema55: 90, alignment: "bullish" },
      macd: { dif: 1.2, dea: 0.8, histogram: 0.4, signal: "bullish" },
      trend: "bullish",
      score: 100,
      sourceBars: 200,
    });

    await store.getState().refreshBackendIndicatorSummary("BTCUSDT", "1h");

    expect(mockedFetchBackendIndicatorSummary).toHaveBeenCalledWith("BTCUSDT", "1h", 200);
    expect(store.getState().indicatorSummaries["BTCUSDT-1h"].trend).toBe("bullish");
    expect(store.getState().indicatorRefreshStatus.error).toBeNull();
  });

  it("keeps previous indicator summary when backend indicator refresh fails", async () => {
    const store = createBitSentinelStore();
    mockedFetchBackendIndicatorSummary.mockRejectedValue(new Error("indicator unavailable"));

    await store.getState().refreshBackendIndicatorSummary("BTCUSDT", "4h");

    expect(store.getState().indicatorSummaries["BTCUSDT-4h"]).toBeUndefined();
    expect(store.getState().indicatorRefreshStatus.error).toBe("indicator unavailable");
  });

  it("refreshes persisted strategy states and signals from backend", async () => {
    const store = createBitSentinelStore();
    mockedFetchBackendPersistedStrategyData.mockResolvedValue({
      states: [
        {
          instanceId: "inst-ma-btc",
          symbol: "BTCUSDT",
          state: "triggered",
          lastUpdated: "2026-05-23T10:00:00Z",
          nextWaitingFor: "后端数据库状态",
        },
      ],
      signals: [
        {
          id: "sig-db-1",
          instanceId: "inst-ma-btc",
          symbol: "BTCUSDT",
          strength: "strong",
          direction: "long",
          reason: "后端持久化信号",
          createdAt: "2026-05-23T10:00:00Z",
          pushStatus: "sent",
          flowConfirm: "后端持久化信号",
        },
      ],
    });

    await store.getState().refreshPersistedStrategyData();

    expect(mockedFetchBackendPersistedStrategyData).toHaveBeenCalled();
    expect(store.getState().strategyStates).toHaveLength(1);
    expect(store.getState().strategyStates[0]).toMatchObject({ state: "triggered", nextWaitingFor: "后端数据库状态" });
    expect(store.getState().signals).toHaveLength(1);
    expect(store.getState().symbols.find((item) => item.symbol === "BTCUSDT")?.status).toBe("alert");
    expect(store.getState().strategyPersistenceStatus).toMatchObject({ source: "backend", loading: false, error: null });
  });

  it("keeps existing strategy data when persisted refresh fails", async () => {
    const store = createBitSentinelStore();
    const previousStates = store.getState().strategyStates;
    const previousSignals = store.getState().signals;
    mockedFetchBackendPersistedStrategyData.mockRejectedValue(new Error("persistence unavailable"));

    await store.getState().refreshPersistedStrategyData();

    expect(store.getState().strategyStates).toBe(previousStates);
    expect(store.getState().signals).toBe(previousSignals);
    expect(store.getState().strategyPersistenceStatus.error).toBe("persistence unavailable");
    expect(store.getState().strategyPersistenceStatus.source).toBe("mock");
  });

  it("runs backend strategy worker with persistence and refreshes persisted data", async () => {
    const store = createBitSentinelStore();
    mockedRunBackendStrategyWorkerOnceAndPersist.mockResolvedValue({
      runId: "run-1",
      evaluatedCount: 1,
      generatedSignalCount: 1,
      upsertedStateCount: 1,
      insertedSignalCount: 1,
    });
    mockedFetchBackendPersistedStrategyData.mockResolvedValue({
      states: [
        {
          instanceId: "inst-ma-btc",
          symbol: "BTCUSDT",
          state: "triggered",
          lastUpdated: "2026-05-23T10:10:00Z",
          nextWaitingFor: "Worker 已入库",
        },
      ],
      signals: [],
    });

    await store.getState().runStrategyWorkerOnceAndPersist();

    expect(mockedRunBackendStrategyWorkerOnceAndPersist).toHaveBeenCalledWith({
      strategyInstances: expect.any(Array),
      marketSeries: expect.any(Object),
      moneyFlows: expect.any(Array),
      signals: expect.any(Array),
      strategyStates: expect.any(Array),
    });
    expect(mockedFetchBackendPersistedStrategyData).toHaveBeenCalled();
    expect(store.getState().strategyStates[0]).toMatchObject({ state: "triggered", nextWaitingFor: "Worker 已入库" });
    expect(store.getState().strategyPersistenceStatus.lastWorkerRun).toMatchObject({
      runId: "run-1",
      evaluatedCount: 1,
      generatedSignalCount: 1,
      upsertedStateCount: 1,
      insertedSignalCount: 1,
    });
    expect(store.getState().strategyPersistenceStatus.error).toBeNull();
  });

  it("keeps existing strategy data when backend worker persistence fails", async () => {
    const store = createBitSentinelStore();
    mockedRunBackendStrategyWorkerOnceAndPersist.mockResolvedValueOnce({
      runId: "run-success",
      evaluatedCount: 1,
      generatedSignalCount: 1,
      upsertedStateCount: 1,
      insertedSignalCount: 1,
    });
    mockedFetchBackendPersistedStrategyData.mockResolvedValueOnce({ states: [], signals: [] });
    await store.getState().runStrategyWorkerOnceAndPersist();
    const previousStates = store.getState().strategyStates;
    const previousRun = store.getState().strategyPersistenceStatus.lastWorkerRun;

    mockedRunBackendStrategyWorkerOnceAndPersist.mockRejectedValue(new Error("worker unavailable"));

    await store.getState().runStrategyWorkerOnceAndPersist();

    expect(store.getState().strategyStates).toBe(previousStates);
    expect(store.getState().strategyPersistenceStatus.lastWorkerRun).toBe(previousRun);
    expect(store.getState().strategyPersistenceStatus.error).toBe("worker unavailable");
  });

  it("refreshes backend database connection status", async () => {
    const store = createBitSentinelStore();
    mockedFetchBackendDatabaseConnectionStatus.mockResolvedValue({
      connected: true,
      loading: false,
      lastCheckedAt: "2026-05-23 10:20:00",
      error: null,
      message: "Database connection succeeded",
      target: {
        driver: "postgresql+psycopg",
        host: "159.75.180.231",
        port: 35432,
        database: "bitsentinel",
      },
    });

    await store.getState().refreshDatabaseConnectionStatus();

    expect(mockedFetchBackendDatabaseConnectionStatus).toHaveBeenCalled();
    expect(store.getState().databaseConnectionStatus).toMatchObject({
      connected: true,
      error: null,
      target: { database: "bitsentinel" },
    });
  });

  it("keeps previous database connection target when refresh fails", async () => {
    const store = createBitSentinelStore();
    mockedFetchBackendDatabaseConnectionStatus.mockRejectedValue(new Error("database unavailable"));

    await store.getState().refreshDatabaseConnectionStatus();

    expect(store.getState().databaseConnectionStatus.connected).toBeNull();
    expect(store.getState().databaseConnectionStatus.error).toBe("database unavailable");
  });
});
