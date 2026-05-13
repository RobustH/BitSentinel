import { createStore } from "zustand/vanilla";
import { create } from "zustand";
import {
  conditionLibrary,
  moneyFlows,
  signalLibrary,
  signals,
  strategyInstances,
  strategyStates,
  strategyTemplates,
  symbols,
  marketSeries,
  timeframeDecisions,
  timeframeSlotTemplates,
} from "../mock/data";
import { fetchFuturesMoneyFlows, fetchSpotKlines, fetchSpotTickers } from "../services/binanceApi";
import { fetchBackendMarketTickers } from "../services/backendMarketApi";
import { startBinanceTickerStream, type StopMarketStream } from "../services/binanceWebSocket";
import { evaluateAllStrategyInstances } from "../services/strategyEvaluator";
import type {
  ConditionBlock,
  BacktestSnapshot,
  BinanceTickerUpdate,
  CreateStrategyPayload,
  AlertRule,
  KlinePoint,
  MarketDataStatus,
  MarketStreamStatus,
  MoneyFlowPoint,
  PushChannelConfig,
  SignalReviewResult,
  Signal,
  SignalDefinition,
  StrategyInstance,
  StrategyEvaluationResult,
  StrategyState,
  StrategyTemplate,
  SymbolMarket,
  TimeframeDecision,
  TimeframeSlotTemplate,
} from "../types";

type AppState = {
  activeSection: string;
  selectedSignalId: string | null;
  symbols: SymbolMarket[];
  signalLibrary: SignalDefinition[];
  conditionLibrary: ConditionBlock[];
  timeframeSlotTemplates: TimeframeSlotTemplate[];
  strategyTemplates: StrategyTemplate[];
  strategyInstances: StrategyInstance[];
  strategyStates: StrategyState[];
  strategyEvaluations: StrategyEvaluationResult[];
  signals: Signal[];
  signalReviews: SignalReviewResult[];
  timeframeDecisions: TimeframeDecision[];
  moneyFlows: MoneyFlowPoint[];
  backtestSnapshots: BacktestSnapshot[];
  alertRules: AlertRule[];
  pushChannels: PushChannelConfig[];
  marketSeries: Record<string, KlinePoint[]>;
  marketDataStatus: MarketDataStatus;
  marketStreamStatus: MarketStreamStatus;
  setActiveSection: (section: string) => void;
  selectSignal: (signalId: string | null) => void;
  refreshBackendMarketData: () => Promise<void>;
  refreshBinanceMarketData: () => Promise<void>;
  evaluateStrategyMonitors: () => void;
  startBinanceMarketStream: () => void;
  stopBinanceMarketStream: () => void;
  addSignalDefinition: () => string;
  addTimeframeSlotTemplate: () => string;
  createStrategyInstance: (payload: CreateStrategyPayload) => string;
  mountSymbolToStrategy: (instanceId: string, symbol: string) => "added" | "exists" | "missing";
  triggerMockSignal: (instanceId: string, symbol: string) => string | null;
  toggleStrategyEnabled: (instanceId: string) => void;
  duplicateStrategy: (instanceId: string) => string | null;
  updateStrategyInstance: (instanceId: string, patch: Partial<Pick<StrategyInstance, "name" | "enabled" | "symbols" | "slots">>) => void;
  createStrategyRevisionDraft: (instanceId: string, summary: string, conditionIds?: string[]) => string | null;
  updateSignalReview: (payload: SignalReviewResult) => void;
  saveBacktestSnapshot: (payload: Omit<BacktestSnapshot, "id" | "createdAt">) => string;
  updateAlertRule: (id: string, patch: Partial<AlertRule>) => void;
  addAlertRule: () => string;
  updatePushChannel: (id: string, patch: Partial<PushChannelConfig>) => void;
};

const defaultAlertRules: AlertRule[] = [
  {
    id: "rule-strong-backed",
    name: "强信号 + 回测建议挂载",
    enabled: true,
    minStrength: "strong",
    requireBacktestDecision: "mount",
    minFlowPassRate: 65,
    channels: ["websocket", "telegram"],
    action: "popup",
  },
  {
    id: "rule-watch-muted",
    name: "观察信号静默入队",
    enabled: true,
    minStrength: "watch",
    minFlowPassRate: 0,
    channels: ["websocket"],
    action: "silent",
  },
  {
    id: "rule-exception-escalate",
    name: "强信号资金流确认升级提醒",
    enabled: true,
    minStrength: "strong",
    minFlowPassRate: 75,
    channels: ["websocket", "telegram", "email"],
    action: "escalate",
  },
];

const defaultPushChannels: PushChannelConfig[] = [
  { id: "websocket", name: "浏览器弹窗", type: "websocket", enabled: true, target: "当前 Web 控制台", severity: "all", quietHours: "不静默" },
  { id: "telegram", name: "Telegram Bot", type: "telegram", enabled: false, target: "@bitsentinel_alert", severity: "strong_only", quietHours: "01:00-08:00" },
  { id: "email", name: "邮件", type: "email", enabled: false, target: "alerts@example.com", severity: "manual", quietHours: "不静默" },
  { id: "wechat", name: "企业微信", type: "wechat", enabled: false, target: "量化监控群机器人", severity: "strong_only", quietHours: "00:00-07:00" },
];

let stopMarketStream: StopMarketStream | null = null;

const formatQuoteVolume = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  return `${value.toFixed(0)}`;
};

const nowText = () => new Date().toLocaleString("zh-CN", { hour12: false });

const applyTickerToKline = (series: KlinePoint[] = [], update: BinanceTickerUpdate): KlinePoint[] => {
  if (!series.length) return series;
  const next = [...series];
  const last = next[next.length - 1];
  next[next.length - 1] = {
    ...last,
    close: update.price,
    high: Math.max(last.high, update.price),
    low: Math.min(last.low, update.price),
  };
  return next;
};

const buildEvaluationPatch = (state: AppState): Pick<AppState, "strategyEvaluations" | "strategyStates" | "signals" | "symbols"> => {
  const evaluations = evaluateAllStrategyInstances({
    strategyInstances: state.strategyInstances,
    marketSeries: state.marketSeries,
    moneyFlows: state.moneyFlows,
    signals: state.signals,
  });
  const createdSignals: Signal[] = evaluations
    .filter((evaluation) => evaluation.shouldTriggerSignal)
    .map((evaluation) => {
      const instance = state.strategyInstances.find((item) => item.id === evaluation.instanceId);
      return {
        id: `sig-eval-${Date.now()}-${evaluation.instanceId}-${evaluation.symbol}`,
        symbol: evaluation.symbol,
        instanceId: evaluation.instanceId,
        strategyVersion: instance?.version ?? 1,
        strength: "strong",
        direction: "long",
        reason: `策略计算引擎触发：${evaluation.passedCount}/${evaluation.totalCount} 条件命中，评分 ${evaluation.score}`,
        createdAt: "刚刚",
        pushStatus: "sent",
        flowConfirm: evaluation.conditions.filter((item) => item.passed).map((item) => item.label).join(" / "),
      };
    });
  const evaluationByKey = new Map(evaluations.map((item) => [`${item.instanceId}-${item.symbol}`, item]));

  return {
    strategyEvaluations: evaluations,
    signals: [...createdSignals, ...state.signals],
    strategyStates: state.strategyStates.map((item) => {
      const evaluation = evaluationByKey.get(`${item.instanceId}-${item.symbol}`);
      if (!evaluation) return item;
      return {
        ...item,
        state: evaluation.suggestedState,
        lastUpdated: evaluation.evaluatedAt,
        nextWaitingFor: evaluation.nextWaitingFor,
      };
    }),
    symbols: state.symbols.map((item) =>
      evaluations.some((evaluation) => evaluation.symbol === item.symbol && evaluation.suggestedState === "triggered")
        ? { ...item, status: "alert" }
        : item,
    ),
  };
};

const initialState = {
  activeSection: "dashboard",
  selectedSignalId: null,
  symbols,
  signalLibrary,
  conditionLibrary,
  timeframeSlotTemplates,
  strategyTemplates,
  strategyInstances,
  strategyStates,
  strategyEvaluations: [],
  signals,
  signalReviews: [],
  timeframeDecisions,
  moneyFlows,
  backtestSnapshots: [],
  alertRules: defaultAlertRules,
  pushChannels: defaultPushChannels,
  marketSeries,
  marketDataStatus: {
    source: "mock",
    loading: false,
    lastUpdated: null,
    error: null,
  },
  marketStreamStatus: {
    status: "idle",
    lastEventAt: null,
    reconnects: 0,
    endpoint: null,
    error: null,
  },
};

const buildMountedStates = (instanceId: string, symbolsToMount: string[]): StrategyState[] =>
  symbolsToMount.map((symbol, index) => ({
    instanceId,
    symbol,
    state: index === 0 ? "watching" : index === 1 ? "waiting_trigger" : "idle",
    lastUpdated: "刚刚",
    nextWaitingFor:
      index === 0
        ? "方向周期已满足，等待结构周期确认"
        : index === 1
          ? "等待触发周期 EMA 金叉"
          : "等待入监控条件满足",
  }));

const flattenSignalIds = (payload: CreateStrategyPayload) => {
  const slotSignalIds = Object.values(payload.signalIdsBySlot ?? {}).flat();
  return Array.from(new Set([...(payload.conditionIds ?? []), ...slotSignalIds, ...(payload.riskSignalIds ?? [])]));
};

const initialVersionHistory = (summary: string) => [{ version: 1, changedAt: "刚刚", summary }];

const createStoreBody = (set: (partial: Partial<AppState>) => void, get: () => AppState): AppState => ({
  ...initialState,
  setActiveSection: (section) => set({ activeSection: section }),
  selectSignal: (signalId) => set({ selectedSignalId: signalId }),
  refreshBackendMarketData: async () => {
    const targetSymbols = get().symbols.map((item) => item.symbol);
    set({ marketDataStatus: { ...get().marketDataStatus, loading: true, error: null } });

    try {
      const nextSymbols = await fetchBackendMarketTickers(targetSymbols);
      const previousStatusBySymbol = new Map(get().symbols.map((item) => [item.symbol, item.status]));
      set({
        symbols: nextSymbols.map((item) => ({
          ...item,
          status: previousStatusBySymbol.get(item.symbol) ?? item.status,
        })),
        marketDataStatus: {
          source: "backend",
          loading: false,
          lastUpdated: nowText(),
          error: null,
        },
      });
      set(buildEvaluationPatch(get()));
    } catch (error) {
      set({
        marketDataStatus: {
          ...get().marketDataStatus,
          loading: false,
          error: error instanceof Error ? error.message : "后端行情刷新失败",
        },
      });
    }
  },
  refreshBinanceMarketData: async () => {
    const targetSymbols = get().symbols.map((item) => item.symbol);
    set({ marketDataStatus: { ...get().marketDataStatus, loading: true, error: null } });

    try {
      const [nextSymbols, btcKlines, nextMoneyFlows] = await Promise.all([
        fetchSpotTickers(targetSymbols),
        fetchSpotKlines("BTCUSDT", "1h", 80),
        fetchFuturesMoneyFlows(targetSymbols, "1h"),
      ]);

      const previousStatusBySymbol = new Map(get().symbols.map((item) => [item.symbol, item.status]));
      set({
        symbols: nextSymbols.map((item) => ({
          ...item,
          status: previousStatusBySymbol.get(item.symbol) ?? item.status,
        })),
        moneyFlows: nextMoneyFlows,
        marketSeries: { ...get().marketSeries, BTCUSDT: btcKlines },
        marketDataStatus: {
          source: "binance",
          loading: false,
          lastUpdated: new Date().toLocaleString("zh-CN", { hour12: false }),
          error: null,
        },
      });
      set(buildEvaluationPatch(get()));
    } catch (error) {
      set({
        marketDataStatus: {
          ...get().marketDataStatus,
          loading: false,
          error: error instanceof Error ? error.message : "Binance 行情刷新失败",
        },
      });
    }
  },
  evaluateStrategyMonitors: () => {
    set(buildEvaluationPatch(get()));
  },
  startBinanceMarketStream: () => {
    if (stopMarketStream) return;

    const targetSymbols = get().symbols.map((item) => item.symbol);
    set({
      marketStreamStatus: {
        ...get().marketStreamStatus,
        status: "connecting",
        error: null,
      },
    });

    stopMarketStream = startBinanceTickerStream({
      symbols: targetSymbols,
      onStatus: (patch) => {
        set({ marketStreamStatus: { ...get().marketStreamStatus, ...patch } });
        if (patch.status === "disconnected" && !patch.error) stopMarketStream = null;
      },
      onTicker: (update) => {
        const previousStatusBySymbol = new Map(get().symbols.map((item) => [item.symbol, item.status]));
        set({
          symbols: get().symbols.map((item) =>
            item.symbol === update.symbol
              ? {
                  ...item,
                  price: update.price,
                  change24h: update.change24h,
                  volume: formatQuoteVolume(update.quoteVolume),
                  status: previousStatusBySymbol.get(item.symbol) ?? item.status,
                }
              : item,
          ),
          marketSeries:
            update.symbol === "BTCUSDT"
              ? { ...get().marketSeries, BTCUSDT: applyTickerToKline(get().marketSeries.BTCUSDT, update) }
              : get().marketSeries,
          marketDataStatus: {
            ...get().marketDataStatus,
            source: "binance",
            lastUpdated: nowText(),
            error: null,
          },
          marketStreamStatus: {
            ...get().marketStreamStatus,
            status: "connected",
            lastEventAt: nowText(),
            error: null,
          },
        });
        set(buildEvaluationPatch(get()));
      },
    });
  },
  stopBinanceMarketStream: () => {
    stopMarketStream?.();
    stopMarketStream = null;
    set({
      marketStreamStatus: {
        ...get().marketStreamStatus,
        status: "disconnected",
        error: null,
      },
    });
  },
  addSignalDefinition: () => {
    const id = `signal-custom-${Date.now()}`;
    const nextSignal: SignalDefinition = {
      id,
      name: "自定义资金流确认",
      label: "主动买入占优 + OI 同向增加",
      description: "模拟新增信号，用于验证信号库可以像市场一样独立管理。",
      defaultGroup: "confirm",
      group: "confirm",
      category: "money_flow",
      supportedSlotKeys: ["structure_tf", "trigger_tf"],
      params: { takerBuyRatio: 56, oiChange: 1.5 },
      enabled: true,
    };
    const next = [...get().signalLibrary, nextSignal];
    set({ signalLibrary: next, conditionLibrary: next });
    return id;
  },
  addTimeframeSlotTemplate: () => {
    const id = `slot-custom-${Date.now()}`;
    const nextTemplate: TimeframeSlotTemplate = {
      id,
      name: "自定义三周期过滤模板",
      description: "模拟新增槽位模板：大周期定方向，中周期做风险过滤，小周期触发。",
      slots: [
        { key: "direction_tf", label: "方向周期", timeframe: "1d", roleDescription: "定义趋势方向" },
        { key: "structure_tf", label: "过滤周期", timeframe: "4h", roleDescription: "过滤震荡和资金风险" },
        { key: "trigger_tf", label: "触发周期", timeframe: "1h", roleDescription: "等待入场提醒" },
      ],
      defaultSignalIdsBySlot: {
        direction_tf: ["ema-trend-up"],
        structure_tf: ["funding-not-hot", "oi-rising"],
        trigger_tf: ["ema-cross-up"],
      },
      riskSignalIds: ["trend-invalid"],
    };
    set({ timeframeSlotTemplates: [...get().timeframeSlotTemplates, nextTemplate] });
    return id;
  },
  createStrategyInstance: (payload) => {
    const instanceId = `inst-${Date.now()}`;
    const slotTemplateId = payload.slotTemplateId ?? payload.templateId ?? "slot-custom";
    const conditionIds = flattenSignalIds(payload);
    const instance: StrategyInstance = {
      id: instanceId,
      templateId: payload.templateId ?? slotTemplateId,
      slotTemplateId,
      name: payload.name,
      version: 1,
      versionHistory: initialVersionHistory("创建策略"),
      symbols: payload.symbols,
      enabled: true,
      slots: payload.slots,
      signalIdsBySlot: payload.signalIdsBySlot ?? {},
      riskSignalIds: payload.riskSignalIds ?? [],
      conditionIds,
    };

    set({
      strategyInstances: [...get().strategyInstances, instance],
      strategyStates: [...get().strategyStates, ...buildMountedStates(instanceId, payload.symbols)],
    });

    return instanceId;
  },
  mountSymbolToStrategy: (instanceId, symbol) => {
    const instance = get().strategyInstances.find((item) => item.id === instanceId);
    if (!instance) return "missing";

    const alreadyMounted = get().strategyStates.some((state) => state.instanceId === instanceId && state.symbol === symbol);
    if (alreadyMounted) return "exists";

    const nextInstances = get().strategyInstances.map((item) =>
      item.id === instanceId
        ? {
            ...item,
            symbols: item.symbols.includes(symbol) ? item.symbols : [...item.symbols, symbol],
          }
        : item,
    );

    const nextState: StrategyState = {
      instanceId,
      symbol,
      state: "watching",
      lastUpdated: "刚刚",
      nextWaitingFor: "已加入监控队列，等待方向周期条件满足",
    };

    set({
      strategyInstances: nextInstances,
      strategyStates: [...get().strategyStates, nextState],
      symbols: get().symbols.map((item) => (item.symbol === symbol ? { ...item, status: item.status === "alert" ? "alert" : "watching" } : item)),
    });

    return "added";
  },
  triggerMockSignal: (instanceId, symbol) => {
    const instance = get().strategyInstances.find((item) => item.id === instanceId);
    if (!instance?.enabled) return null;

    const state = get().strategyStates.find((item) => item.instanceId === instanceId && item.symbol === symbol);
    if (!state) return null;

    const id = `sig-${Date.now()}`;
    const signal: Signal = {
      id,
      symbol,
      instanceId,
      strategyVersion: instance.version ?? 1,
      strength: "strong",
      direction: "long",
      reason: "模拟触发：方向周期多头成立，结构周期完成过滤，触发周期出现入场信号，资金流同步确认。",
      createdAt: "刚刚",
      pushStatus: "sent",
      flowConfirm: "资金费率温和，主动买入占优，OI 同向增加。",
    };

    set({
      signals: [signal, ...get().signals],
      strategyStates: get().strategyStates.map((item) =>
        item.instanceId === instanceId && item.symbol === symbol
          ? {
              ...item,
              state: "triggered",
              lastUpdated: "刚刚",
              nextWaitingFor: "模拟信号已触发，等待复盘或进入冷却",
            }
          : item,
      ),
      symbols: get().symbols.map((item) => (item.symbol === symbol ? { ...item, status: "alert" } : item)),
    });

    return id;
  },
  toggleStrategyEnabled: (instanceId) => {
    set({
      strategyInstances: get().strategyInstances.map((item) => (item.id === instanceId ? { ...item, enabled: !item.enabled } : item)),
    });
  },
  duplicateStrategy: (instanceId) => {
    const source = get().strategyInstances.find((item) => item.id === instanceId);
    if (!source) return null;

    const id = `inst-copy-${Date.now()}`;
    const copy: StrategyInstance = {
      ...source,
      id,
      name: `${source.name} 副本`,
      version: 1,
      versionHistory: initialVersionHistory(`复制自 ${source.name} v${source.version ?? 1}`),
      symbols: [],
      enabled: false,
    };

    set({ strategyInstances: [...get().strategyInstances, copy] });
    return id;
  },
  updateStrategyInstance: (instanceId, patch) => {
    const source = get().strategyInstances.find((item) => item.id === instanceId);
    if (!source) return;

    const nextSymbols = patch.symbols ?? source.symbols;
    const existingStates = get().strategyStates.filter((state) => state.instanceId === instanceId);
    const existingSymbols = new Set(existingStates.map((state) => state.symbol));
    const addedStates: StrategyState[] = nextSymbols
      .filter((symbol) => !existingSymbols.has(symbol))
      .map((symbol) => ({
        instanceId,
        symbol,
        state: "watching",
        lastUpdated: "刚刚",
        nextWaitingFor: "编辑策略后加入监控，等待方向周期条件满足",
      }));

    const nextVersion = (source.version ?? 1) + 1;
    const versionHistory = source.versionHistory ?? initialVersionHistory("创建策略");

    set({
      strategyInstances: get().strategyInstances.map((item) =>
        item.id === instanceId
          ? {
              ...item,
              ...patch,
              symbols: nextSymbols,
              version: nextVersion,
              versionHistory: [...versionHistory, { version: nextVersion, changedAt: "刚刚", summary: "轻量编辑策略配置" }],
            }
          : item,
      ),
      strategyStates: [...get().strategyStates.filter((state) => state.instanceId !== instanceId || nextSymbols.includes(state.symbol)), ...addedStates],
    });
  },
  createStrategyRevisionDraft: (instanceId, summary, conditionIds = []) => {
    const source = get().strategyInstances.find((item) => item.id === instanceId);
    if (!source) return null;

    const nextVersion = (source.version ?? 1) + 1;
    const id = `inst-revision-${Date.now()}`;
    const mergedConditionIds = Array.from(new Set([...source.conditionIds, ...conditionIds]));
    const versionHistory = source.versionHistory ?? initialVersionHistory("创建策略");
    const draft: StrategyInstance = {
      ...source,
      id,
      name: `${source.name} v${nextVersion} 草案`,
      version: nextVersion,
      versionHistory: [...versionHistory, { version: nextVersion, changedAt: "刚刚", summary }],
      symbols: [],
      enabled: false,
      conditionIds: mergedConditionIds,
    };

    set({ strategyInstances: [...get().strategyInstances, draft] });
    return id;
  },
  updateSignalReview: (payload) => {
    const existing = get().signalReviews.some((item) => item.signalId === payload.signalId);
    set({
      signalReviews: existing
        ? get().signalReviews.map((item) => (item.signalId === payload.signalId ? payload : item))
        : [payload, ...get().signalReviews],
    });
  },
  saveBacktestSnapshot: (payload) => {
    const id = `bt-${Date.now()}`;
    const snapshot: BacktestSnapshot = {
      ...payload,
      id,
      createdAt: "刚刚",
    };
    set({ backtestSnapshots: [snapshot, ...get().backtestSnapshots] });
    return id;
  },
  updateAlertRule: (id, patch) => {
    set({ alertRules: get().alertRules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)) });
  },
  addAlertRule: () => {
    const id = `rule-${Date.now()}`;
    set({
      alertRules: [
        {
          id,
          name: "自定义强信号规则",
          enabled: true,
          minStrength: "strong",
          requireBacktestDecision: "mount",
          minFlowPassRate: 60,
          channels: ["websocket"],
          action: "popup",
        },
        ...get().alertRules,
      ],
    });
    return id;
  },
  updatePushChannel: (id, patch) => {
    set({ pushChannels: get().pushChannels.map((channel) => (channel.id === id ? { ...channel, ...patch } : channel)) });
  },
});

export const createBitSentinelStore = () => createStore<AppState>((set, get) => createStoreBody(set, get));

export const useAppStore = create<AppState>((set, get) => createStoreBody(set, get));
