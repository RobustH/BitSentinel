import type {
  ConditionEvaluation,
  KlinePoint,
  MoneyFlowPoint,
  Signal,
  StrategyEvaluationResult,
  StrategyInstance,
  StrategyState,
  StrategyWorkerRunSummary,
  StrategyWorkerSchedulerStatus,
  TimeframeSlotKey,
} from "../types";

const BACKEND_API_BASE_URL = import.meta.env.VITE_BACKEND_API_BASE_URL ?? "http://127.0.0.1:8000";

type BackendStrategyKline = {
  symbol: string;
  interval: string;
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type BackendStrategyEvaluationRequest = {
  strategy_instances: Array<{
    id: string;
    name: string;
    symbols: string[];
    enabled: boolean;
    condition_ids: string[];
    risk_signal_ids: string[];
    signal_ids_by_slot: Record<string, string[]>;
  }>;
  market_series: Record<string, BackendStrategyKline[]>;
  money_flows: Array<{
    symbol: string;
    funding_rate: number;
    oi_change: number;
    taker_buy_ratio: number;
  }>;
  existing_signals: Array<{
    instance_id: string;
    symbol: string;
    strength: Signal["strength"];
  }>;
};

type BackendStrategyWorkerRunRequest = BackendStrategyEvaluationRequest & {
  existing_states: Array<{
    instance_id: string;
    symbol: string;
    state: StrategyState["state"];
  }>;
};

type BackendStrategyEvaluationResult = {
  instance_id: string;
  symbol: string;
  state: StrategyState["state"];
  score: number;
  passed_count: number;
  total_count: number;
  should_trigger_signal: boolean;
  next_waiting_for: string;
  conditions: Array<{
    id: string;
    label: string;
    slot_key: string | null;
    passed: boolean;
    score: number;
    reason: string;
  }>;
};

type BackendStrategyEvaluationResponse = {
  results: BackendStrategyEvaluationResult[];
};

type BackendStrategyWorkerRunResponse = {
  run_id: string;
  ran_at?: string;
  evaluated_count: number;
  generated_signal_count: number;
  persistence: {
    upserted_state_count: number;
    inserted_signal_count: number;
  } | null;
};

type BackendPersistedStrategyState = {
  strategy_instance_id: string;
  symbol: string;
  state: StrategyState["state"];
  last_score: number;
  next_waiting_for: string;
  updated_at: string;
};

type BackendPersistedStrategySignal = {
  signal_id: string;
  strategy_instance_id: string;
  symbol: string;
  strength: Signal["strength"];
  direction: Signal["direction"];
  reason: string;
  created_at: string;
};

type BackendPersistedStrategyWorkerRun = {
  run_id: string;
  ran_at: string;
  evaluated_count: number;
  generated_signal_count: number;
  upserted_state_count: number;
  inserted_signal_count: number;
};

type BackendStrategyWorkerSchedulerStatus = {
  running: boolean;
  interval_seconds: number | null;
  persist: boolean;
  last_started_at: string | null;
  last_stopped_at: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  last_run_id: string | null;
  last_error: string | null;
  run_count: number;
  skipped_count: number;
};

type FetchBackendStrategyEvaluationsInput = {
  strategyInstances: StrategyInstance[];
  marketSeries: Record<string, KlinePoint[]>;
  moneyFlows: MoneyFlowPoint[];
  signals: Signal[];
  interval?: string;
};

type RunBackendStrategyWorkerInput = FetchBackendStrategyEvaluationsInput & {
  strategyStates: StrategyState[];
};

type StartBackendStrategyWorkerSchedulerInput = RunBackendStrategyWorkerInput & {
  intervalSeconds?: number;
  persist?: boolean;
};

type BackendPersistedStrategyData = {
  states: StrategyState[];
  signals: Signal[];
};

const requestJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${BACKEND_API_BASE_URL}${path}`);
  if (!response.ok) throw new Error(`Backend strategy request failed: ${response.status}`);
  return response.json() as Promise<T>;
};

const parseOpenTime = (time: string, fallbackIndex: number) => {
  const parsed = Date.parse(time);
  if (Number.isFinite(parsed)) return parsed;
  return fallbackIndex;
};

const toBackendMarketSeries = (
  marketSeries: Record<string, KlinePoint[]>,
  interval: string,
): Record<string, BackendStrategyKline[]> =>
  Object.fromEntries(
    Object.entries(marketSeries).map(([symbol, rows]) => [
      symbol,
      rows.map((row, index) => ({
        symbol,
        interval,
        open_time: parseOpenTime(row.time, index),
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: 0,
      })),
    ]),
  );

const toBackendRequest = ({
  strategyInstances,
  marketSeries,
  moneyFlows,
  signals,
  interval = "1h",
}: FetchBackendStrategyEvaluationsInput): BackendStrategyEvaluationRequest => ({
  strategy_instances: strategyInstances.map((instance) => ({
    id: instance.id,
    name: instance.name,
    symbols: instance.symbols,
    enabled: instance.enabled,
    condition_ids: instance.conditionIds,
    risk_signal_ids: instance.riskSignalIds,
    signal_ids_by_slot: instance.signalIdsBySlot as Record<string, string[]>,
  })),
  market_series: toBackendMarketSeries(marketSeries, interval),
  money_flows: moneyFlows.map((flow) => ({
    symbol: flow.symbol,
    funding_rate: flow.fundingRate,
    oi_change: flow.oiChange,
    taker_buy_ratio: flow.takerBuyRatio,
  })),
  existing_signals: signals.map((signal) => ({
    instance_id: signal.instanceId,
    symbol: signal.symbol,
    strength: signal.strength,
  })),
});

const toBackendWorkerRequest = (input: RunBackendStrategyWorkerInput): BackendStrategyWorkerRunRequest => ({
  ...toBackendRequest(input),
  existing_states: input.strategyStates.map((state) => ({
    instance_id: state.instanceId,
    symbol: state.symbol,
    state: state.state,
  })),
});

const toSlotKey = (slotKey: string | null): TimeframeSlotKey | undefined => {
  if (slotKey === "direction_tf" || slotKey === "structure_tf" || slotKey === "trigger_tf") return slotKey;
  return undefined;
};

const toFrontendCondition = (condition: BackendStrategyEvaluationResult["conditions"][number]): ConditionEvaluation => ({
  id: condition.id,
  label: condition.label,
  slotKey: toSlotKey(condition.slot_key),
  passed: condition.passed,
  score: condition.score,
  reason: condition.reason,
});

const toFrontendResult = (row: BackendStrategyEvaluationResult): StrategyEvaluationResult => ({
  instanceId: row.instance_id,
  symbol: row.symbol,
  evaluatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
  suggestedState: row.state,
  score: row.score,
  passedCount: row.passed_count,
  totalCount: row.total_count,
  shouldTriggerSignal: row.should_trigger_signal,
  nextWaitingFor: row.next_waiting_for,
  conditions: row.conditions.map(toFrontendCondition),
});

const toFrontendPersistedState = (row: BackendPersistedStrategyState): StrategyState => ({
  instanceId: row.strategy_instance_id,
  symbol: row.symbol,
  state: row.state,
  lastUpdated: row.updated_at,
  nextWaitingFor: row.next_waiting_for,
});

const toFrontendPersistedSignal = (row: BackendPersistedStrategySignal): Signal => ({
  id: row.signal_id,
  symbol: row.symbol,
  instanceId: row.strategy_instance_id,
  strength: row.strength,
  direction: row.direction,
  reason: row.reason,
  createdAt: row.created_at,
  pushStatus: "sent",
  flowConfirm: "后端持久化信号",
});

const toFrontendWorkerRun = (row: BackendPersistedStrategyWorkerRun): StrategyWorkerRunSummary => ({
  runId: row.run_id,
  ranAt: row.ran_at,
  evaluatedCount: row.evaluated_count,
  generatedSignalCount: row.generated_signal_count,
  upsertedStateCount: row.upserted_state_count,
  insertedSignalCount: row.inserted_signal_count,
});

const toFrontendSchedulerStatus = (row: BackendStrategyWorkerSchedulerStatus): StrategyWorkerSchedulerStatus => ({
  running: row.running,
  intervalSeconds: row.interval_seconds,
  persist: row.persist,
  lastStartedAt: row.last_started_at,
  lastStoppedAt: row.last_stopped_at,
  lastRunAt: row.last_run_at,
  nextRunAt: row.next_run_at,
  lastRunId: row.last_run_id,
  lastError: row.last_error,
  runCount: row.run_count,
  skippedCount: row.skipped_count,
});

export async function fetchBackendStrategyEvaluations(
  input: FetchBackendStrategyEvaluationsInput,
): Promise<StrategyEvaluationResult[]> {
  const response = await fetch(`${BACKEND_API_BASE_URL}/api/strategy/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toBackendRequest(input)),
  });

  if (!response.ok) throw new Error(`Backend strategy request failed: ${response.status}`);

  const payload = (await response.json()) as BackendStrategyEvaluationResponse;
  return payload.results.map(toFrontendResult);
}

export async function runBackendStrategyWorkerOnceAndPersist(
  input: RunBackendStrategyWorkerInput,
): Promise<StrategyWorkerRunSummary> {
  const response = await fetch(`${BACKEND_API_BASE_URL}/api/strategy/worker/run-once?persist=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toBackendWorkerRequest(input)),
  });

  if (!response.ok) throw new Error(`Backend strategy worker request failed: ${response.status}`);

  const payload = (await response.json()) as BackendStrategyWorkerRunResponse;
  return {
    runId: payload.run_id,
    ranAt: payload.ran_at,
    evaluatedCount: payload.evaluated_count,
    generatedSignalCount: payload.generated_signal_count,
    upsertedStateCount: payload.persistence?.upserted_state_count ?? 0,
    insertedSignalCount: payload.persistence?.inserted_signal_count ?? 0,
  };
}

export async function fetchBackendPersistedStrategyStates(): Promise<StrategyState[]> {
  const payload = await requestJson<BackendPersistedStrategyState[]>("/api/strategy/states");
  return payload.map(toFrontendPersistedState);
}

export async function fetchBackendPersistedStrategySignals(): Promise<Signal[]> {
  const payload = await requestJson<BackendPersistedStrategySignal[]>("/api/strategy/signals");
  return payload.map(toFrontendPersistedSignal);
}

export async function fetchBackendPersistedStrategyData(): Promise<BackendPersistedStrategyData> {
  const [states, signals] = await Promise.all([
    fetchBackendPersistedStrategyStates(),
    fetchBackendPersistedStrategySignals(),
  ]);
  return { states, signals };
}

export async function fetchBackendStrategyWorkerRuns(limit = 10): Promise<StrategyWorkerRunSummary[]> {
  const payload = await requestJson<BackendPersistedStrategyWorkerRun[]>(`/api/strategy/worker/runs?limit=${limit}`);
  return payload.map(toFrontendWorkerRun);
}

export async function fetchBackendStrategyWorkerSchedulerStatus(): Promise<StrategyWorkerSchedulerStatus> {
  const payload = await requestJson<BackendStrategyWorkerSchedulerStatus>("/api/strategy/worker/scheduler/status");
  return toFrontendSchedulerStatus(payload);
}

export async function startBackendStrategyWorkerScheduler({
  intervalSeconds = 60,
  persist = true,
  ...input
}: StartBackendStrategyWorkerSchedulerInput): Promise<StrategyWorkerSchedulerStatus> {
  const response = await fetch(`${BACKEND_API_BASE_URL}/api/strategy/worker/scheduler/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      worker_request: toBackendWorkerRequest(input),
      interval_seconds: intervalSeconds,
      persist,
    }),
  });

  if (!response.ok) throw new Error(`Backend strategy worker scheduler start failed: ${response.status}`);

  const payload = (await response.json()) as BackendStrategyWorkerSchedulerStatus;
  return toFrontendSchedulerStatus(payload);
}

export async function stopBackendStrategyWorkerScheduler(): Promise<StrategyWorkerSchedulerStatus> {
  const response = await fetch(`${BACKEND_API_BASE_URL}/api/strategy/worker/scheduler/stop`, {
    method: "POST",
  });

  if (!response.ok) throw new Error(`Backend strategy worker scheduler stop failed: ${response.status}`);

  const payload = (await response.json()) as BackendStrategyWorkerSchedulerStatus;
  return toFrontendSchedulerStatus(payload);
}
