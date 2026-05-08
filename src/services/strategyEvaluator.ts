import type {
  ConditionEvaluation,
  KlinePoint,
  MoneyFlowPoint,
  Signal,
  StrategyEvaluationResult,
  StrategyInstance,
  StrategyState,
  TimeframeSlotKey,
} from "../types";

type EvaluateInput = {
  strategyInstances: StrategyInstance[];
  marketSeries: Record<string, KlinePoint[]>;
  moneyFlows: MoneyFlowPoint[];
  signals: Signal[];
};

const signalLabels: Record<string, string> = {
  "ema-trend-up": "EMA 多头排列",
  "structure-squeeze-end": "震荡末期识别",
  "ema-cross-up": "EMA 金叉",
  "macd-expansion": "MACD 动量扩张",
  "oi-rising": "OI 增长",
  "taker-buy-dominant": "主动买入占优",
  "funding-not-hot": "资金费率不过热",
  "trend-invalid": "趋势失效",
};

const ema = (values: number[], period: number) => {
  const k = 2 / (period + 1);
  return values.reduce<number[]>((acc, value, index) => {
    acc.push(index === 0 ? value : value * k + acc[index - 1] * (1 - k));
    return acc;
  }, []);
};

const latest = <T>(items: T[]) => items[items.length - 1];
const previous = <T>(items: T[]) => items[items.length - 2] ?? latest(items);

const isEmaTrendUp = (series: KlinePoint[]) => {
  const closes = series.map((item) => item.close);
  const fast = ema(closes, 9);
  const slow = ema(closes, 21);
  return latest(fast) > latest(slow) && latest(fast) >= previous(fast);
};

const isEmaCrossUp = (series: KlinePoint[]) => {
  const closes = series.map((item) => item.close);
  const fast = ema(closes, 9);
  const slow = ema(closes, 21);
  return previous(fast) <= previous(slow) && latest(fast) > latest(slow);
};

const isMacdExpanding = (series: KlinePoint[]) => {
  const closes = series.map((item) => item.close);
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const current = latest(fast) - latest(slow);
  const prior = previous(fast) - previous(slow);
  return current > prior && current > 0;
};

const isStructureSqueezeEnd = (series: KlinePoint[]) => {
  const recent = series.slice(-6);
  const prior = series.slice(-12, -6);
  const recentRange = recent.reduce((sum, item) => sum + (item.high - item.low), 0) / Math.max(recent.length, 1);
  const priorRange = prior.reduce((sum, item) => sum + (item.high - item.low), 0) / Math.max(prior.length, 1);
  return recentRange > priorRange * 1.04;
};

const slotForSignal = (instance: StrategyInstance, signalId: string): TimeframeSlotKey | undefined => {
  const entries = Object.entries(instance.signalIdsBySlot) as Array<[TimeframeSlotKey, string[] | undefined]>;
  return entries.find(([, ids]) => ids?.includes(signalId))?.[0];
};

const evaluateCondition = (signalId: string, instance: StrategyInstance, series: KlinePoint[], flow?: MoneyFlowPoint): ConditionEvaluation => {
  const slotKey = slotForSignal(instance, signalId);
  let passed = false;
  let reason = "暂未命中";

  if (signalId === "ema-trend-up") {
    passed = series.length >= 21 && isEmaTrendUp(series);
    reason = passed ? "EMA9 高于 EMA21，短均线斜率向上" : "趋势均线尚未形成多头排列";
  } else if (signalId === "ema-cross-up") {
    passed = series.length >= 21 && isEmaCrossUp(series);
    reason = passed ? "最近一根 K 线出现 EMA9 上穿 EMA21" : "触发周期暂未出现 EMA 金叉";
  } else if (signalId === "macd-expansion") {
    passed = series.length >= 26 && isMacdExpanding(series);
    reason = passed ? "EMA12-EMA26 差值扩大，动量增强" : "动量扩张不足";
  } else if (signalId === "structure-squeeze-end") {
    passed = series.length >= 12 && isStructureSqueezeEnd(series);
    reason = passed ? "近期波动较前段扩大，结构接近蓄势末期" : "结构仍偏收敛或无明显放大";
  } else if (signalId === "oi-rising") {
    passed = (flow?.oiChange ?? 0) > 0;
    reason = passed ? `OI 同向增加 ${flow?.oiChange}%` : "OI 未形成正向增长";
  } else if (signalId === "taker-buy-dominant") {
    passed = (flow?.takerBuyRatio ?? 0) >= 55;
    reason = passed ? `主动买入占比 ${flow?.takerBuyRatio}%` : "主动买入比例未达到 55%";
  } else if (signalId === "funding-not-hot") {
    passed = (flow?.fundingRate ?? 0) <= 0.08;
    reason = passed ? `资金费率 ${flow?.fundingRate}% 未过热` : "资金费率偏热";
  } else if (signalId === "trend-invalid") {
    passed = series.length >= 21 && !isEmaTrendUp(series);
    reason = passed ? "方向均线转弱，触发失效条件" : "方向趋势尚未失效";
  }

  return {
    id: signalId,
    label: signalLabels[signalId] ?? signalId,
    slotKey,
    passed,
    score: passed ? 100 : 0,
    reason,
  };
};

export function evaluateStrategyInstance(
  instance: StrategyInstance,
  symbol: string,
  marketSeries: Record<string, KlinePoint[]>,
  moneyFlows: MoneyFlowPoint[],
  signals: Signal[],
): StrategyEvaluationResult {
  const fallbackSeries = marketSeries.BTCUSDT ?? [];
  const series = marketSeries[symbol] ?? fallbackSeries;
  const flow = moneyFlows.find((item) => item.symbol === symbol);
  const signalIds = Array.from(new Set([...instance.conditionIds, ...instance.riskSignalIds]));
  const conditions = signalIds.map((signalId) => evaluateCondition(signalId, instance, series, flow));
  const riskInvalid = conditions.find((item) => item.id === "trend-invalid")?.passed ?? false;
  const directionSignals = instance.signalIdsBySlot.direction_tf ?? [];
  const structureSignals = instance.signalIdsBySlot.structure_tf ?? [];
  const triggerSignals = instance.signalIdsBySlot.trigger_tf ?? [];
  const directionPassed = directionSignals.length === 0 || directionSignals.every((id) => conditions.find((item) => item.id === id)?.passed);
  const structurePassed = structureSignals.length === 0 || structureSignals.every((id) => conditions.find((item) => item.id === id)?.passed);
  const triggerPassed = triggerSignals.length > 0 && triggerSignals.every((id) => conditions.find((item) => item.id === id)?.passed);
  const confirmPassed = conditions.filter((item) => ["oi-rising", "taker-buy-dominant", "funding-not-hot"].includes(item.id)).every((item) => item.passed);
  const passedCount = conditions.filter((item) => item.passed).length;
  const score = Math.round((passedCount / Math.max(conditions.length, 1)) * 100);
  const alreadyTriggered = signals.some((signal) => signal.instanceId === instance.id && signal.symbol === symbol && signal.strength === "strong");

  let suggestedState: StrategyState["state"] = "idle";
  let nextWaitingFor = "等待方向周期条件满足";
  if (riskInvalid) {
    suggestedState = "invalidated";
    nextWaitingFor = "趋势失效，等待重新进入观察条件";
  } else if (directionPassed && structurePassed && triggerPassed && confirmPassed) {
    suggestedState = "triggered";
    nextWaitingFor = "条件已满足，等待信号复盘或冷却";
  } else if (directionPassed && structurePassed) {
    suggestedState = "waiting_trigger";
    nextWaitingFor = "方向和结构已满足，等待触发周期信号";
  } else if (directionPassed) {
    suggestedState = "watching";
    nextWaitingFor = "方向周期已满足，等待结构周期确认";
  }

  return {
    instanceId: instance.id,
    symbol,
    evaluatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    suggestedState,
    score,
    passedCount,
    totalCount: conditions.length,
    shouldTriggerSignal: suggestedState === "triggered" && !alreadyTriggered,
    nextWaitingFor,
    conditions,
  };
}

export function evaluateAllStrategyInstances({ strategyInstances, marketSeries, moneyFlows, signals }: EvaluateInput) {
  return strategyInstances.flatMap((instance) =>
    instance.symbols.map((symbol) => evaluateStrategyInstance(instance, symbol, marketSeries, moneyFlows, signals)),
  );
}
