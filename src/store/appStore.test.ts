import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBackendIndicatorSummary, fetchBackendMarketKlines, fetchBackendMarketTickers } from "../services/backendMarketApi";
import {
  fetchBackendPersistedStrategyData,
  fetchBackendStrategyInstances,
  fetchBackendStrategyEvaluations,
  fetchBackendStrategyWorkerRuns,
  fetchBackendStrategyWorkerSchedulerStatus,
  runBackendStrategyWorkerOnceAndPersist,
  saveBackendStrategyInstances,
  setBackendStrategyInstanceEnabled,
  startBackendStrategyWorkerScheduler,
  stopBackendStrategyWorkerScheduler,
} from "../services/backendStrategyApi";
import { fetchBackendDatabaseConnectionStatus, fetchBackendDatabaseSchemaStatus } from "../services/backendSystemApi";
import { createBitSentinelStore } from "./appStore";

vi.mock("../services/backendMarketApi", () => ({
  fetchBackendIndicatorSummary: vi.fn(),
  fetchBackendMarketKlines: vi.fn(),
  fetchBackendMarketTickers: vi.fn(),
}));

vi.mock("../services/backendStrategyApi", () => ({
  fetchBackendPersistedStrategyData: vi.fn(),
  fetchBackendStrategyInstances: vi.fn(),
  fetchBackendStrategyEvaluations: vi.fn(),
  fetchBackendStrategyWorkerRuns: vi.fn(),
  fetchBackendStrategyWorkerSchedulerStatus: vi.fn(),
  runBackendStrategyWorkerOnceAndPersist: vi.fn(),
  saveBackendStrategyInstances: vi.fn(),
  setBackendStrategyInstanceEnabled: vi.fn(),
  startBackendStrategyWorkerScheduler: vi.fn(),
  stopBackendStrategyWorkerScheduler: vi.fn(),
}));

vi.mock("../services/backendSystemApi", () => ({
  fetchBackendDatabaseConnectionStatus: vi.fn(),
  fetchBackendDatabaseSchemaStatus: vi.fn(),
}));

const mockedFetchBackendIndicatorSummary = vi.mocked(fetchBackendIndicatorSummary);
const mockedFetchBackendMarketKlines = vi.mocked(fetchBackendMarketKlines);
const mockedFetchBackendMarketTickers = vi.mocked(fetchBackendMarketTickers);
const mockedFetchBackendPersistedStrategyData = vi.mocked(fetchBackendPersistedStrategyData);
const mockedFetchBackendStrategyInstances = vi.mocked(fetchBackendStrategyInstances);
const mockedFetchBackendStrategyEvaluations = vi.mocked(fetchBackendStrategyEvaluations);
const mockedFetchBackendStrategyWorkerRuns = vi.mocked(fetchBackendStrategyWorkerRuns);
const mockedFetchBackendStrategyWorkerSchedulerStatus = vi.mocked(fetchBackendStrategyWorkerSchedulerStatus);
const mockedFetchBackendDatabaseConnectionStatus = vi.mocked(fetchBackendDatabaseConnectionStatus);
const mockedFetchBackendDatabaseSchemaStatus = vi.mocked(fetchBackendDatabaseSchemaStatus);
const mockedRunBackendStrategyWorkerOnceAndPersist = vi.mocked(runBackendStrategyWorkerOnceAndPersist);
const mockedSaveBackendStrategyInstances = vi.mocked(saveBackendStrategyInstances);
const mockedSetBackendStrategyInstanceEnabled = vi.mocked(setBackendStrategyInstanceEnabled);
const mockedStartBackendStrategyWorkerScheduler = vi.mocked(startBackendStrategyWorkerScheduler);
const mockedStopBackendStrategyWorkerScheduler = vi.mocked(stopBackendStrategyWorkerScheduler);

const runningSchedulerStatus = {
  running: true,
  intervalSeconds: 60,
  persist: true,
  lastStartedAt: "2026-05-23T10:50:00Z",
  lastStoppedAt: null,
  lastRunAt: "2026-05-23T10:50:01Z",
  nextRunAt: "2026-05-23T10:51:01Z",
  lastRunId: "run-scheduled",
  lastError: null,
  runCount: 1,
  skippedCount: 0,
};

describe("strategy assembly mock store", () => {
  beforeEach(() => {
    mockedFetchBackendIndicatorSummary.mockReset();
    mockedFetchBackendMarketKlines.mockReset();
    mockedFetchBackendMarketTickers.mockReset();
    mockedFetchBackendPersistedStrategyData.mockReset();
    mockedFetchBackendStrategyInstances.mockReset();
    mockedFetchBackendStrategyEvaluations.mockReset();
    mockedFetchBackendStrategyWorkerRuns.mockReset();
    mockedFetchBackendStrategyWorkerSchedulerStatus.mockReset();
    mockedFetchBackendDatabaseConnectionStatus.mockReset();
    mockedFetchBackendDatabaseSchemaStatus.mockReset();
    mockedRunBackendStrategyWorkerOnceAndPersist.mockReset();
    mockedSaveBackendStrategyInstances.mockReset();
    mockedSetBackendStrategyInstanceEnabled.mockReset();
    mockedStartBackendStrategyWorkerScheduler.mockReset();
    mockedStopBackendStrategyWorkerScheduler.mockReset();
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

  it("refreshes strategy instances from backend without bypassing store state reconciliation", async () => {
    const store = createBitSentinelStore();
    const currentInstances = store.getState().strategyInstances;
    const syncedInstance = {
      ...currentInstances[0],
      name: "后端策略配置",
      symbols: ["BTCUSDT", "ETHUSDT"],
      enabled: true,
    };
    mockedFetchBackendStrategyInstances.mockResolvedValue([syncedInstance]);

    const result = await store.getState().refreshBackendStrategyInstances();

    expect(mockedFetchBackendStrategyInstances).toHaveBeenCalledWith(currentInstances);
    expect(result).toHaveLength(1);
    expect(store.getState().strategyInstances[0]).toMatchObject({
      id: syncedInstance.id,
      name: "后端策略配置",
      symbols: ["BTCUSDT", "ETHUSDT"],
    });
    expect(store.getState().strategyStates.filter((item) => item.instanceId === syncedInstance.id)).toHaveLength(2);
    expect(store.getState().strategyConfigSyncStatus).toMatchObject({
      source: "backend",
      loading: false,
      error: null,
      savedCount: 1,
    });
  });

  it("keeps local strategy instances when backend config source is empty", async () => {
    const store = createBitSentinelStore();
    const previousInstances = store.getState().strategyInstances;
    mockedFetchBackendStrategyInstances.mockResolvedValue([]);

    const result = await store.getState().refreshBackendStrategyInstances();

    expect(result).toBe(previousInstances);
    expect(store.getState().strategyInstances).toBe(previousInstances);
    expect(store.getState().strategyConfigSyncStatus).toMatchObject({
      source: "backend",
      loading: false,
      error: null,
      savedCount: 0,
    });
  });

  it("saves current strategy instances to backend and records saved count", async () => {
    const store = createBitSentinelStore();
    const currentInstances = store.getState().strategyInstances;
    mockedSaveBackendStrategyInstances.mockResolvedValue(currentInstances);

    const result = await store.getState().saveStrategyInstancesToBackend();

    expect(mockedSaveBackendStrategyInstances).toHaveBeenCalledWith(currentInstances);
    expect(result).toBe(currentInstances);
    expect(store.getState().strategyConfigSyncStatus).toMatchObject({
      source: "backend",
      loading: false,
      error: null,
      savedCount: currentInstances.length,
    });
  });

  it("keeps local strategy instances when backend config save fails", async () => {
    const store = createBitSentinelStore();
    const previousInstances = store.getState().strategyInstances;
    mockedSaveBackendStrategyInstances.mockRejectedValue(new Error("config save unavailable"));

    const result = await store.getState().saveStrategyInstancesToBackend();

    expect(result).toBeNull();
    expect(store.getState().strategyInstances).toBe(previousInstances);
    expect(store.getState().strategyConfigSyncStatus.error).toBe("config save unavailable");
  });

  it("optimistically toggles strategy enabled state and syncs the backend flag", async () => {
    const store = createBitSentinelStore();
    const target = store.getState().strategyInstances[0];
    mockedSetBackendStrategyInstanceEnabled.mockResolvedValue({ ...target, enabled: !target.enabled });

    store.getState().toggleStrategyEnabled(target.id);
    await Promise.resolve();

    expect(store.getState().strategyInstances.find((item) => item.id === target.id)?.enabled).toBe(!target.enabled);
    expect(mockedSetBackendStrategyInstanceEnabled).toHaveBeenCalledWith(target.id, !target.enabled);
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
    mockedFetchBackendStrategyWorkerRuns.mockResolvedValue([
      {
        runId: "run-1",
        ranAt: "2026-05-23T10:10:00Z",
        evaluatedCount: 1,
        generatedSignalCount: 1,
        upsertedStateCount: 1,
        insertedSignalCount: 1,
      },
    ]);

    const result = await store.getState().runStrategyWorkerOnceAndPersist();

    expect(mockedRunBackendStrategyWorkerOnceAndPersist).toHaveBeenCalledWith({
      strategyInstances: expect.any(Array),
      marketSeries: expect.any(Object),
      moneyFlows: expect.any(Array),
      signals: expect.any(Array),
      strategyStates: expect.any(Array),
    });
    expect(result).toMatchObject({
      runId: "run-1",
      evaluatedCount: 1,
      upsertedStateCount: 1,
      insertedSignalCount: 1,
    });
    expect(mockedFetchBackendPersistedStrategyData).toHaveBeenCalled();
    expect(mockedFetchBackendStrategyWorkerRuns).toHaveBeenCalledWith(10);
    expect(store.getState().strategyStates[0]).toMatchObject({ state: "triggered", nextWaitingFor: "Worker 已入库" });
    expect(store.getState().strategyPersistenceStatus.lastWorkerRun).toMatchObject({
      runId: "run-1",
      evaluatedCount: 1,
      generatedSignalCount: 1,
      upsertedStateCount: 1,
      insertedSignalCount: 1,
    });
    expect(store.getState().strategyPersistenceStatus.error).toBeNull();
    expect(store.getState().strategyPersistenceStatus.workerRunHistory).toHaveLength(1);
  });

  it("refreshes backend worker run history", async () => {
    const store = createBitSentinelStore();
    mockedFetchBackendStrategyWorkerRuns.mockResolvedValue([
      {
        runId: "run-2",
        ranAt: "2026-05-23T10:30:00Z",
        evaluatedCount: 3,
        generatedSignalCount: 1,
        upsertedStateCount: 2,
        insertedSignalCount: 1,
      },
    ]);

    await store.getState().refreshWorkerRunHistory();

    expect(mockedFetchBackendStrategyWorkerRuns).toHaveBeenCalledWith(10);
    expect(store.getState().strategyPersistenceStatus.workerRunHistory[0]).toMatchObject({
      runId: "run-2",
      evaluatedCount: 3,
      upsertedStateCount: 2,
    });
    expect(store.getState().strategyPersistenceStatus.error).toBeNull();
  });

  it("keeps backend worker run history when refresh fails", async () => {
    const store = createBitSentinelStore();
    mockedFetchBackendStrategyWorkerRuns.mockResolvedValueOnce([
      {
        runId: "run-success",
        ranAt: "2026-05-23T10:30:00Z",
        evaluatedCount: 1,
        generatedSignalCount: 0,
        upsertedStateCount: 1,
        insertedSignalCount: 0,
      },
    ]);
    await store.getState().refreshWorkerRunHistory();
    const previousHistory = store.getState().strategyPersistenceStatus.workerRunHistory;

    mockedFetchBackendStrategyWorkerRuns.mockRejectedValue(new Error("history unavailable"));
    await store.getState().refreshWorkerRunHistory();

    expect(store.getState().strategyPersistenceStatus.workerRunHistory).toBe(previousHistory);
    expect(store.getState().strategyPersistenceStatus.error).toBe("history unavailable");
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
    mockedFetchBackendStrategyWorkerRuns.mockResolvedValueOnce([]);
    await store.getState().runStrategyWorkerOnceAndPersist();
    const previousStates = store.getState().strategyStates;
    const previousRun = store.getState().strategyPersistenceStatus.lastWorkerRun;

    mockedRunBackendStrategyWorkerOnceAndPersist.mockRejectedValue(new Error("worker unavailable"));

    const failedResult = await store.getState().runStrategyWorkerOnceAndPersist();

    expect(store.getState().strategyStates).toBe(previousStates);
    expect(store.getState().strategyPersistenceStatus.lastWorkerRun).toBe(previousRun);
    expect(failedResult).toBeNull();
    expect(store.getState().strategyPersistenceStatus.error).toBe("worker unavailable");
  });

  it("starts backend worker scheduler with database strategy config source", async () => {
    const store = createBitSentinelStore();
    mockedStartBackendStrategyWorkerScheduler.mockResolvedValue(runningSchedulerStatus);

    const result = await store.getState().startWorkerScheduler();

    expect(mockedStartBackendStrategyWorkerScheduler).toHaveBeenCalledWith({
      configSource: "database",
      intervalSeconds: 60,
      persist: true,
    });
    expect(result).toMatchObject({ running: true, intervalSeconds: 60, runCount: 1 });
    expect(store.getState().strategyPersistenceStatus.schedulerStatus).toMatchObject({
      running: true,
      lastRunId: "run-scheduled",
    });
    expect(store.getState().strategyPersistenceStatus.error).toBeNull();
  });

  it("refreshes backend worker scheduler status", async () => {
    const store = createBitSentinelStore();
    mockedFetchBackendStrategyWorkerSchedulerStatus.mockResolvedValue(runningSchedulerStatus);

    await store.getState().refreshWorkerSchedulerStatus();

    expect(mockedFetchBackendStrategyWorkerSchedulerStatus).toHaveBeenCalled();
    expect(store.getState().strategyPersistenceStatus.schedulerStatus).toMatchObject({
      running: true,
      nextRunAt: "2026-05-23T10:51:01Z",
    });
  });

  it("stops backend worker scheduler", async () => {
    const store = createBitSentinelStore();
    mockedStopBackendStrategyWorkerScheduler.mockResolvedValue({
      ...runningSchedulerStatus,
      running: false,
      lastStoppedAt: "2026-05-23T10:52:00Z",
      nextRunAt: null,
    });

    const result = await store.getState().stopWorkerScheduler();

    expect(mockedStopBackendStrategyWorkerScheduler).toHaveBeenCalled();
    expect(result).toMatchObject({ running: false, nextRunAt: null });
    expect(store.getState().strategyPersistenceStatus.schedulerStatus.running).toBe(false);
  });

  it("keeps previous backend worker scheduler status when refresh fails", async () => {
    const store = createBitSentinelStore();
    mockedFetchBackendStrategyWorkerSchedulerStatus.mockResolvedValueOnce(runningSchedulerStatus);
    await store.getState().refreshWorkerSchedulerStatus();
    const previousStatus = store.getState().strategyPersistenceStatus.schedulerStatus;

    mockedFetchBackendStrategyWorkerSchedulerStatus.mockRejectedValue(new Error("scheduler unavailable"));
    await store.getState().refreshWorkerSchedulerStatus();

    expect(store.getState().strategyPersistenceStatus.schedulerStatus).toBe(previousStatus);
    expect(store.getState().strategyPersistenceStatus.error).toBe("scheduler unavailable");
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

  it("refreshes backend database schema status", async () => {
    const store = createBitSentinelStore();
    mockedFetchBackendDatabaseSchemaStatus.mockResolvedValue({
      ready: false,
      loading: false,
      lastCheckedAt: "2026-05-23 10:30:00",
      error: "Database schema is missing managed tables",
      message: "Database schema is missing managed tables",
      target: {
        driver: "postgresql+psycopg",
        host: "159.75.180.231",
        port: 35432,
        database: "bitsentinel",
      },
      managedTables: ["strategy_states", "strategy_signals", "strategy_worker_runs"],
      existingTables: ["strategy_states"],
      missingTables: ["strategy_signals", "strategy_worker_runs"],
    });

    await store.getState().refreshDatabaseSchemaStatus();

    expect(mockedFetchBackendDatabaseSchemaStatus).toHaveBeenCalled();
    expect(store.getState().databaseSchemaStatus).toMatchObject({
      ready: false,
      missingTables: ["strategy_signals", "strategy_worker_runs"],
      target: { database: "bitsentinel" },
    });
  });

  it("keeps previous database schema status when refresh fails", async () => {
    const store = createBitSentinelStore();
    mockedFetchBackendDatabaseSchemaStatus.mockResolvedValueOnce({
      ready: true,
      loading: false,
      lastCheckedAt: "2026-05-23 10:30:00",
      error: null,
      message: "Database schema is ready",
      target: null,
      managedTables: ["strategy_states"],
      existingTables: ["strategy_states"],
      missingTables: [],
    });
    await store.getState().refreshDatabaseSchemaStatus();
    const previousExistingTables = store.getState().databaseSchemaStatus.existingTables;

    mockedFetchBackendDatabaseSchemaStatus.mockRejectedValue(new Error("schema unavailable"));
    await store.getState().refreshDatabaseSchemaStatus();

    expect(store.getState().databaseSchemaStatus.existingTables).toBe(previousExistingTables);
    expect(store.getState().databaseSchemaStatus.error).toBe("schema unavailable");
  });

  it("diagnoses database readiness by checking connection before schema", async () => {
    const store = createBitSentinelStore();
    mockedFetchBackendDatabaseConnectionStatus.mockResolvedValue({
      connected: true,
      loading: false,
      lastCheckedAt: "2026-05-23 10:40:00",
      error: null,
      message: "Database connection succeeded",
      target: null,
    });
    mockedFetchBackendDatabaseSchemaStatus.mockResolvedValue({
      ready: true,
      loading: false,
      lastCheckedAt: "2026-05-23 10:40:01",
      error: null,
      message: "Database schema is ready",
      target: null,
      managedTables: ["strategy_states"],
      existingTables: ["strategy_states"],
      missingTables: [],
    });

    await store.getState().diagnoseDatabaseReadiness();

    expect(mockedFetchBackendDatabaseConnectionStatus).toHaveBeenCalled();
    expect(mockedFetchBackendDatabaseSchemaStatus).toHaveBeenCalled();
    expect(store.getState().databaseConnectionStatus.connected).toBe(true);
    expect(store.getState().databaseSchemaStatus.ready).toBe(true);
  });

  it("does not check schema when database readiness connection check fails", async () => {
    const store = createBitSentinelStore();
    mockedFetchBackendDatabaseConnectionStatus.mockResolvedValue({
      connected: false,
      loading: false,
      lastCheckedAt: "2026-05-23 10:40:00",
      error: "Database connection failed: OperationalError",
      message: "Database connection failed: OperationalError",
      target: null,
    });

    await store.getState().diagnoseDatabaseReadiness();

    expect(mockedFetchBackendDatabaseConnectionStatus).toHaveBeenCalled();
    expect(mockedFetchBackendDatabaseSchemaStatus).not.toHaveBeenCalled();
    expect(store.getState().databaseConnectionStatus.connected).toBe(false);
    expect(store.getState().databaseSchemaStatus.ready).toBeNull();
  });
});
