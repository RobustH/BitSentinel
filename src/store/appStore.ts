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
  timeframeDecisions,
  timeframeSlotTemplates,
} from "../mock/data";
import type {
  ConditionBlock,
  CreateStrategyPayload,
  MoneyFlowPoint,
  Signal,
  SignalDefinition,
  StrategyInstance,
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
  signals: Signal[];
  timeframeDecisions: TimeframeDecision[];
  moneyFlows: MoneyFlowPoint[];
  setActiveSection: (section: string) => void;
  selectSignal: (signalId: string | null) => void;
  addSignalDefinition: () => string;
  addTimeframeSlotTemplate: () => string;
  createStrategyInstance: (payload: CreateStrategyPayload) => string;
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
  signals,
  timeframeDecisions,
  moneyFlows,
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

const createStoreBody = (set: (partial: Partial<AppState>) => void, get: () => AppState): AppState => ({
  ...initialState,
  setActiveSection: (section) => set({ activeSection: section }),
  selectSignal: (signalId) => set({ selectedSignalId: signalId }),
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
});

export const createBitSentinelStore = () => createStore<AppState>((set, get) => createStoreBody(set, get));

export const useAppStore = create<AppState>((set, get) => createStoreBody(set, get));
