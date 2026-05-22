export type TimeframeSlotKey = "direction_tf" | "structure_tf" | "trigger_tf";

export type TimeframeSlot = {
  key: TimeframeSlotKey;
  label: string;
  timeframe: string;
  roleDescription?: string;
};

export type SignalGroup = "watch" | "trigger" | "confirm" | "invalidate" | "exit";

export type SignalCategory = "indicator" | "structure" | "money_flow" | "time" | "risk";

export type SignalDefinition = {
  id: string;
  name: string;
  label: string;
  description: string;
  defaultGroup: SignalGroup;
  group: SignalGroup;
  category: SignalCategory;
  supportedSlotKeys: TimeframeSlotKey[];
  params: Record<string, string | number | boolean>;
  enabled: boolean;
};

export type ConditionBlock = SignalDefinition;

export type TimeframeSlotTemplate = {
  id: string;
  name: string;
  description: string;
  slots: TimeframeSlot[];
  defaultSignalIdsBySlot: Partial<Record<TimeframeSlotKey, string[]>>;
  riskSignalIds: string[];
};

export type StrategyTemplate = {
  id: string;
  name: string;
  description: string;
  slots: TimeframeSlot[];
  conditions: SignalDefinition[];
};

export type StrategyInstance = {
  id: string;
  templateId: string;
  slotTemplateId: string;
  name: string;
  version?: number;
  versionHistory?: Array<{
    version: number;
    changedAt: string;
    summary: string;
  }>;
  symbols: string[];
  enabled: boolean;
  slots: Record<TimeframeSlotKey, string>;
  signalIdsBySlot: Partial<Record<TimeframeSlotKey, string[]>>;
  riskSignalIds: string[];
  conditionIds: string[];
};

export type StrategyState = {
  instanceId: string;
  symbol: string;
  state: "idle" | "watching" | "waiting_trigger" | "triggered" | "invalidated" | "cooldown";
  lastUpdated: string;
  nextWaitingFor: string;
};

export type Signal = {
  id: string;
  symbol: string;
  instanceId: string;
  strategyVersion?: number;
  strength: "strong" | "weak" | "watch" | "invalidated";
  direction: "long" | "short" | "neutral";
  reason: string;
  createdAt: string;
  pushStatus: "sent" | "queued" | "muted";
  flowConfirm: string;
};

export type ReviewStatus = "pending" | "valid" | "invalid" | "watching" | "execution_error";

export type ReviewErrorType = "chasing_entry" | "timeframe_mismatch" | "flow_divergence" | "early_signal" | "late_signal" | "risk_rule_missed";

export type SignalReviewResult = {
  signalId: string;
  status: ReviewStatus;
  note: string;
  errorTypes: ReviewErrorType[];
  traded: boolean;
  executionScore: number;
  reviewedAt: string;
};

export type BacktestDecision = "mount" | "observe" | "reject";

export type BacktestSnapshot = {
  id: string;
  instanceId: string;
  strategyVersion: number;
  symbol: string;
  timeframeCombo: string;
  triggerCount: number;
  winRate: number;
  avgMfe: number;
  avgMae: number;
  flowPassRate: number;
  decision: BacktestDecision;
  conclusion: string;
  createdAt: string;
};

export type AlertRule = {
  id: string;
  name: string;
  enabled: boolean;
  minStrength: Signal["strength"];
  requireBacktestDecision?: BacktestDecision;
  minFlowPassRate: number;
  channels: string[];
  action: "popup" | "silent" | "escalate";
};

export type PushChannelConfig = {
  id: string;
  name: string;
  type: "telegram" | "email" | "wechat" | "websocket";
  enabled: boolean;
  target: string;
  severity: "all" | "strong_only" | "manual";
  quietHours: string;
};

export type SymbolMarket = {
  symbol: string;
  price: number;
  change24h: number;
  volume: string;
  status: "normal" | "watching" | "alert";
};

export type TimeframeDecision = {
  symbol: string;
  holdingTimeframe: string;
  executionTimeframe: string;
  confidence: number;
  selectedReason: string;
  candidates: Array<{
    timeframe: string;
    score: number;
    role: string;
  }>;
  scoreBreakdown: Array<{
    name: string;
    value: number;
  }>;
};

export type MoneyFlowPoint = {
  symbol: string;
  fundingRate: number;
  oiChange: number;
  takerBuyRatio: number;
  topLongRatio: number;
  netFlow: number;
};

export type KlinePoint = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type MarketDataStatus = {
  source: "mock" | "binance" | "backend";
  loading: boolean;
  lastUpdated: string | null;
  error: string | null;
};

export type KlineRefreshStatus = {
  source: "mock" | "backend";
  loading: boolean;
  symbol: string | null;
  interval: string | null;
  lastUpdated: string | null;
  error: string | null;
};

export type IndicatorTrend = "bullish" | "bearish" | "neutral";

export type IndicatorSummary = {
  symbol: string;
  interval: string;
  latestClose: number;
  ema: {
    ema9: number;
    ema21: number;
    ema55: number;
    alignment: "bullish" | "bearish" | "mixed";
  };
  macd: {
    dif: number;
    dea: number;
    histogram: number;
    signal: "bullish_cross" | "bearish_cross" | "bullish" | "bearish" | "neutral";
  };
  trend: IndicatorTrend;
  score: number;
  sourceBars: number;
};

export type IndicatorRefreshStatus = {
  loading: boolean;
  symbol: string | null;
  interval: string | null;
  lastUpdated: string | null;
  error: string | null;
};

export type StrategyPersistenceStatus = {
  source: "mock" | "backend";
  loading: boolean;
  lastUpdated: string | null;
  error: string | null;
  lastWorkerRun: {
    runId: string;
    evaluatedCount: number;
    generatedSignalCount: number;
    upsertedStateCount: number;
    insertedSignalCount: number;
  } | null;
};

export type DatabaseConnectionStatus = {
  connected: boolean | null;
  loading: boolean;
  lastCheckedAt: string | null;
  error: string | null;
  message: string | null;
  target: {
    driver: string;
    host: string | null;
    port: number | null;
    database: string | null;
  } | null;
};

export type MarketStreamStatus = {
  status: "idle" | "connecting" | "connected" | "disconnected" | "error";
  lastEventAt: string | null;
  reconnects: number;
  endpoint: string | null;
  error: string | null;
};

export type BinanceTickerUpdate = {
  symbol: string;
  price: number;
  change24h: number;
  quoteVolume: number;
  eventTime: number;
};

export type ConditionEvaluation = {
  id: string;
  label: string;
  slotKey?: TimeframeSlotKey;
  passed: boolean;
  score: number;
  reason: string;
};

export type StrategyEvaluationResult = {
  instanceId: string;
  symbol: string;
  evaluatedAt: string;
  suggestedState: StrategyState["state"];
  score: number;
  passedCount: number;
  totalCount: number;
  shouldTriggerSignal: boolean;
  nextWaitingFor: string;
  conditions: ConditionEvaluation[];
};

export type CreateStrategyPayload = {
  templateId?: string;
  slotTemplateId?: string;
  name: string;
  symbols: string[];
  slots: Record<TimeframeSlotKey, string>;
  signalIdsBySlot?: Partial<Record<TimeframeSlotKey, string[]>>;
  riskSignalIds?: string[];
  conditionIds?: string[];
};
