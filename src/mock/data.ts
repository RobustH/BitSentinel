import type {
  KlinePoint,
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

export const symbols: SymbolMarket[] = [
  { symbol: "BTCUSDT", price: 103842.5, change24h: 2.14, volume: "18.4B", status: "alert" },
  { symbol: "ETHUSDT", price: 4931.2, change24h: 1.28, volume: "7.9B", status: "watching" },
  { symbol: "SOLUSDT", price: 218.44, change24h: -0.72, volume: "2.1B", status: "watching" },
  { symbol: "BNBUSDT", price: 812.9, change24h: 0.36, volume: "894M", status: "normal" },
];

export const signalLibrary: SignalDefinition[] = [
  {
    id: "ema-trend-up",
    name: "EMA 多头排列",
    label: "EMA9 > EMA21，且斜率向上",
    description: "用于确认方向周期处于多头趋势，不直接触发交易。",
    defaultGroup: "watch",
    group: "watch",
    category: "indicator",
    supportedSlotKeys: ["direction_tf", "structure_tf"],
    params: { fast: 9, slow: 21 },
    enabled: true,
  },
  {
    id: "structure-squeeze-end",
    name: "震荡末期识别",
    label: "ATR 收缩后放大，结构进入蓄势末期",
    description: "用于结构周期过滤，避免小周期频繁金叉造成误触发。",
    defaultGroup: "watch",
    group: "watch",
    category: "structure",
    supportedSlotKeys: ["structure_tf"],
    params: { atrLookback: 14, squeezeBars: 12 },
    enabled: true,
  },
  {
    id: "ema-cross-up",
    name: "EMA 金叉",
    label: "EMA9 上穿 EMA21",
    description: "典型小周期触发信号，可填入触发周期。",
    defaultGroup: "trigger",
    group: "trigger",
    category: "indicator",
    supportedSlotKeys: ["trigger_tf"],
    params: { withinBars: 3 },
    enabled: true,
  },
  {
    id: "macd-expansion",
    name: "MACD 动量扩张",
    label: "MACD 柱体连续扩张",
    description: "用于确认触发周期的动量是否跟随趋势扩张。",
    defaultGroup: "trigger",
    group: "trigger",
    category: "indicator",
    supportedSlotKeys: ["trigger_tf", "structure_tf"],
    params: { bars: 3 },
    enabled: true,
  },
  {
    id: "oi-rising",
    name: "OI 增长",
    label: "OI 增加，资金流支持趋势延续",
    description: "资金流确认信号，可作为任意周期槽位的确认条件。",
    defaultGroup: "confirm",
    group: "confirm",
    category: "money_flow",
    supportedSlotKeys: ["direction_tf", "structure_tf", "trigger_tf"],
    params: { minChange: 1.2 },
    enabled: true,
  },
  {
    id: "taker-buy-dominant",
    name: "主动买入占优",
    label: "Taker Buy Ratio > 55%",
    description: "确认多头主动成交占优，降低假突破概率。",
    defaultGroup: "confirm",
    group: "confirm",
    category: "money_flow",
    supportedSlotKeys: ["trigger_tf", "structure_tf"],
    params: { minRatio: 55 },
    enabled: true,
  },
  {
    id: "funding-not-hot",
    name: "资金费率不过热",
    label: "资金费率低于 0.08%",
    description: "风控类信号，避免追入过度拥挤的趋势。",
    defaultGroup: "confirm",
    group: "confirm",
    category: "risk",
    supportedSlotKeys: ["direction_tf", "structure_tf", "trigger_tf"],
    params: { maxFunding: 0.08 },
    enabled: true,
  },
  {
    id: "trend-invalid",
    name: "趋势失效",
    label: "方向周期 EMA9 下破 EMA21",
    description: "用于监控策略失效，触发退出观察或冷却。",
    defaultGroup: "invalidate",
    group: "invalidate",
    category: "indicator",
    supportedSlotKeys: ["direction_tf"],
    params: { fast: 9, slow: 21 },
    enabled: true,
  },
];

export const conditionLibrary = signalLibrary;

export const timeframeSlotTemplates: TimeframeSlotTemplate[] = [
  {
    id: "slot-dual-trend",
    name: "双周期趋势模板",
    description: "方向周期确认趋势，触发周期等待入场信号。适合简单双均线趋势策略。",
    slots: [
      { key: "direction_tf", label: "方向周期", timeframe: "4h", roleDescription: "判断是否允许做多或做空" },
      { key: "trigger_tf", label: "触发周期", timeframe: "1h", roleDescription: "等待具体提醒条件" },
    ],
    defaultSignalIdsBySlot: {
      direction_tf: ["ema-trend-up"],
      trigger_tf: ["ema-cross-up", "oi-rising"],
    },
    riskSignalIds: ["funding-not-hot", "trend-invalid"],
  },
  {
    id: "slot-triple-trend",
    name: "三周期趋势模板",
    description: "大周期定方向，中周期过滤结构，小周期触发提醒。适合你当前的多周期趋势监控。",
    slots: [
      { key: "direction_tf", label: "方向周期", timeframe: "1d", roleDescription: "定义交易方向和趋势背景" },
      { key: "structure_tf", label: "结构周期", timeframe: "4h", roleDescription: "识别震荡末期或蓄势结构" },
      { key: "trigger_tf", label: "触发周期", timeframe: "1h", roleDescription: "触发提醒和推送" },
    ],
    defaultSignalIdsBySlot: {
      direction_tf: ["ema-trend-up"],
      structure_tf: ["structure-squeeze-end", "macd-expansion"],
      trigger_tf: ["ema-cross-up", "taker-buy-dominant"],
    },
    riskSignalIds: ["oi-rising", "funding-not-hot", "trend-invalid"],
  },
];

export const strategyTemplates: StrategyTemplate[] = timeframeSlotTemplates.map((template) => ({
  id: template.id === "slot-dual-trend" ? "tpl-dual-ma" : "tpl-triple-breakout",
  name: template.id === "slot-dual-trend" ? "双周期双均线趋势" : "三周期蓄势突破",
  description: template.description,
  slots: template.slots,
  conditions: signalLibrary.filter((signal) =>
    [...Object.values(template.defaultSignalIdsBySlot).flat(), ...template.riskSignalIds].includes(signal.id),
  ),
}));

export const strategyInstances: StrategyInstance[] = [
  {
    id: "inst-triple-01",
    templateId: "tpl-triple-breakout",
    slotTemplateId: "slot-triple-trend",
    name: "主流币三周期蓄势突破",
    symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
    enabled: true,
    slots: { direction_tf: "1d", structure_tf: "4h", trigger_tf: "1h" },
    signalIdsBySlot: {
      direction_tf: ["ema-trend-up"],
      structure_tf: ["structure-squeeze-end", "macd-expansion"],
      trigger_tf: ["ema-cross-up", "taker-buy-dominant"],
    },
    riskSignalIds: ["oi-rising", "funding-not-hot", "trend-invalid"],
    conditionIds: ["ema-trend-up", "structure-squeeze-end", "macd-expansion", "ema-cross-up", "taker-buy-dominant", "oi-rising"],
  },
];

export const strategyStates: StrategyState[] = [
  {
    instanceId: "inst-triple-01",
    symbol: "BTCUSDT",
    state: "triggered",
    lastUpdated: "00:31:18",
    nextWaitingFor: "推送已发送，等待冷却结束",
  },
  {
    instanceId: "inst-triple-01",
    symbol: "ETHUSDT",
    state: "waiting_trigger",
    lastUpdated: "00:28:44",
    nextWaitingFor: "等待 1h EMA9 上穿 EMA21",
  },
  {
    instanceId: "inst-triple-01",
    symbol: "SOLUSDT",
    state: "watching",
    lastUpdated: "00:22:09",
    nextWaitingFor: "4h 结构周期 ATR 收缩后放大",
  },
];

export const signals: Signal[] = [
  {
    id: "sig-001",
    symbol: "BTCUSDT",
    instanceId: "inst-triple-01",
    strength: "strong",
    direction: "long",
    reason: "1d 多头保持，4h 震荡末期完成，1h EMA 金叉，OI 增加。",
    createdAt: "00:31:18",
    pushStatus: "sent",
    flowConfirm: "资金费率温和，主动买入 58%，OI +2.6%",
  },
  {
    id: "sig-002",
    symbol: "ETHUSDT",
    instanceId: "inst-triple-01",
    strength: "watch",
    direction: "long",
    reason: "方向周期多头，结构周期接近震荡末期，但触发周期未金叉。",
    createdAt: "00:28:44",
    pushStatus: "queued",
    flowConfirm: "OI +1.1%，主动买入 53%，确认不足",
  },
  {
    id: "sig-003",
    symbol: "SOLUSDT",
    instanceId: "inst-triple-01",
    strength: "weak",
    direction: "neutral",
    reason: "小周期触发但资金流未确认，降级为观察信号。",
    createdAt: "00:19:02",
    pushStatus: "muted",
    flowConfirm: "资金费率偏热，Taker Buy Ratio 回落至 49%",
  },
];

export const timeframeDecisions: TimeframeDecision[] = [
  {
    symbol: "BTCUSDT",
    holdingTimeframe: "4h",
    executionTimeframe: "1h",
    confidence: 78,
    selectedReason: "4h 获得 1d 方向确认，1h 已触发，资金流未过热，适合作为真实持仓周期。",
    candidates: [
      { timeframe: "1h", score: 72, role: "执行周期" },
      { timeframe: "4h", score: 78, role: "持仓周期" },
      { timeframe: "1d", score: 66, role: "方向周期" },
    ],
    scoreBreakdown: [
      { name: "资金流", value: 82 },
      { name: "趋势结构", value: 76 },
      { name: "动量阶段", value: 71 },
      { name: "周期一致", value: 80 },
      { name: "风险惩罚", value: 10 },
    ],
  },
  {
    symbol: "ETHUSDT",
    holdingTimeframe: "4h",
    executionTimeframe: "1h",
    confidence: 64,
    selectedReason: "4h 接近震荡末期，但 1h 触发尚未确认，暂时只进入观察队列。",
    candidates: [
      { timeframe: "1h", score: 57, role: "待触发" },
      { timeframe: "4h", score: 64, role: "观察周期" },
      { timeframe: "1d", score: 70, role: "方向周期" },
    ],
    scoreBreakdown: [
      { name: "资金流", value: 59 },
      { name: "趋势结构", value: 73 },
      { name: "动量阶段", value: 58 },
      { name: "周期一致", value: 67 },
      { name: "风险惩罚", value: 18 },
    ],
  },
];

export const moneyFlows: MoneyFlowPoint[] = [
  { symbol: "BTCUSDT", fundingRate: 0.024, oiChange: 2.6, takerBuyRatio: 58, topLongRatio: 61, netFlow: 184 },
  { symbol: "ETHUSDT", fundingRate: 0.017, oiChange: 1.1, takerBuyRatio: 53, topLongRatio: 56, netFlow: 92 },
  { symbol: "SOLUSDT", fundingRate: 0.069, oiChange: -0.4, takerBuyRatio: 49, topLongRatio: 51, netFlow: -18 },
  { symbol: "BNBUSDT", fundingRate: 0.011, oiChange: 0.6, takerBuyRatio: 52, topLongRatio: 54, netFlow: 27 },
];

export const marketSeries: Record<string, KlinePoint[]> = {
  BTCUSDT: Array.from({ length: 44 }, (_, index) => {
    const base = 100900 + index * 74 + Math.sin(index / 3) * 460;
    return {
      time: `2026-05-${String(6 + Math.floor(index / 24)).padStart(2, "0")} ${String(index % 24).padStart(2, "0")}:00`,
      open: base - 120,
      high: base + 260,
      low: base - 340,
      close: base + Math.sin(index) * 170,
    };
  }),
};
