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
  strength: "strong" | "weak" | "watch";
  direction: "long" | "short" | "neutral";
  reason: string;
  createdAt: string;
  pushStatus: "sent" | "queued" | "muted";
  flowConfirm: string;
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
