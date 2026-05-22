import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  CandlestickChart,
  Cpu,
  Database,
  FileSearch,
  GitBranch,
  Library,
  LineChart,
  ListChecks,
  RadioTower,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Workflow,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Col,
  ConfigProvider,
  Descriptions,
  Divider,
  Drawer,
  Flex,
  Form,
  Input,
  Layout,
  List,
  Menu,
  notification,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
  theme,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CandlestickSeries, HistogramSeries, LineSeries, createChart } from "lightweight-charts";
import { marketSeries as mockMarketSeries } from "./mock/data";
import { useAppStore } from "./store/appStore";
import type { AlertRule, BacktestDecision, IndicatorTrend, KlinePoint, MarketDataStatus, MarketStreamStatus, PushChannelConfig, ReviewErrorType, ReviewStatus, Signal, SignalCategory, SignalDefinition, SignalReviewResult, StrategyInstance, StrategyState, TimeframeSlotKey } from "./types";

const { Header, Sider, Content } = Layout;
const { Text, Title, Paragraph } = Typography;

const navItems = [
  { id: "dashboard", label: "工作台", icon: Activity },
  { id: "market", label: "市场监控", icon: CandlestickChart },
  { id: "strategy", label: "策略相关", icon: Workflow },
  { id: "warehouse", label: "数据仓", icon: Database },
  { id: "settings", label: "系统设置", icon: Settings },
];

const stateMeta: Record<StrategyState["state"], { label: string; color: string; badge: "default" | "processing" | "success" | "warning" | "error" }> = {
  idle: { label: "未命中", color: "default", badge: "default" },
  watching: { label: "列入监控", color: "blue", badge: "processing" },
  waiting_trigger: { label: "等待触发", color: "gold", badge: "warning" },
  triggered: { label: "已触发", color: "green", badge: "success" },
  invalidated: { label: "已失效", color: "red", badge: "error" },
  cooldown: { label: "冷却中", color: "purple", badge: "processing" },
};

const strengthMeta: Record<Signal["strength"], { label: string; color: string }> = {
  strong: { label: "强信号", color: "green" },
  weak: { label: "弱信号", color: "gold" },
  watch: { label: "观察", color: "blue" },
  invalidated: { label: "已失效", color: "red" },
};

const directionLabel: Record<Signal["direction"], string> = {
  long: "多头",
  short: "空头",
  neutral: "中性",
};

const categoryLabel: Record<SignalCategory, string> = {
  indicator: "指标",
  structure: "结构",
  money_flow: "资金流",
  time: "时间",
  risk: "风险",
};

const groupLabel: Record<SignalDefinition["group"], string> = {
  watch: "入监控",
  trigger: "触发",
  confirm: "确认",
  invalidate: "失效",
  exit: "退出",
};

const categoryColor: Record<SignalCategory, string> = {
  indicator: "cyan",
  structure: "blue",
  money_flow: "green",
  time: "purple",
  risk: "red",
};

const slotLabels: Record<TimeframeSlotKey, string> = {
  direction_tf: "方向周期",
  structure_tf: "结构周期",
  trigger_tf: "触发周期",
};

const fallbackSignalLabels: Record<string, string> = {
  "ema-trend-up": "EMA 多头排列",
  "structure-squeeze-end": "震荡末期识别",
  "ema-cross-up": "EMA 金叉",
  "macd-expansion": "MACD 动量扩张",
  "oi-rising": "OI 增长",
  "taker-buy-dominant": "主动买入占优",
  "funding-not-hot": "资金费率不过热",
  "trend-invalid": "趋势失效",
};

const timeframeOptions = ["15m", "1h", "4h", "1d"];

type ReviewRecord = {
  id: string;
  signalId: string;
  instanceId: string;
  symbol: string;
  strategyName: string;
  strategyVersion: number;
  direction: Signal["direction"];
  strength: Signal["strength"];
  status: ReviewStatus;
  triggerPrice: number;
  currentPrice: number;
  mfe: number;
  mae: number;
  result24h: number;
  signalScore: number;
  executionScore: number;
  holdingTimeframe: string;
  executionTimeframe: string;
  reason: string;
  tags: string[];
  traded: boolean;
  reviewNote?: string;
  errorTypes: ReviewErrorType[];
  reviewedAt?: string;
};

type MonitorSignalStat = {
  key: string;
  symbol: string;
  strategyName: string;
  state: StrategyState["state"];
  totalSignals: number;
  strongSignals: number;
  waitingSignals: number;
  lastSignalTime: string;
};

type MarketRankMode = "marketCap" | "volume" | "change24h" | "netFlow" | "custom";

type BacktestEvent = {
  id: string;
  time: string;
  symbol: string;
  status: ReviewStatus;
  triggerPrice: number;
  result: number;
  mfe: number;
  mae: number;
  waitBars: number;
  timeframeState: string;
  flowState: string;
};

type BacktestResult = {
  triggerCount: number;
  validCount: number;
  invalidCount: number;
  watchCount: number;
  winRate: number;
  avgMfe: number;
  avgMae: number;
  avgWaitBars: number;
  flowPassRate: number;
  events: BacktestEvent[];
};

const reviewStatusMeta: Record<ReviewStatus, { label: string; color: string }> = {
  pending: { label: "待复盘", color: "default" },
  valid: { label: "有效信号", color: "green" },
  invalid: { label: "无效信号", color: "red" },
  watching: { label: "继续观察", color: "blue" },
  execution_error: { label: "执行偏差", color: "gold" },
};

const reviewErrorMeta: Record<ReviewErrorType, string> = {
  chasing_entry: "追高入场",
  timeframe_mismatch: "周期误判",
  flow_divergence: "资金流背离",
  early_signal: "信号过早",
  late_signal: "信号过晚",
  risk_rule_missed: "风控遗漏",
};

const backtestDecisionMeta: Record<BacktestDecision, { label: string; color: string }> = {
  mount: { label: "建议挂载监控", color: "green" },
  observe: { label: "建议继续观察", color: "gold" },
  reject: { label: "不建议上线", color: "red" },
};

const alertActionMeta: Record<AlertRule["action"], { label: string; color: string }> = {
  popup: { label: "弹窗提醒", color: "green" },
  silent: { label: "静默入队", color: "default" },
  escalate: { label: "升级提醒", color: "red" },
};

const channelTypeMeta: Record<PushChannelConfig["type"], string> = {
  websocket: "Web 弹窗",
  telegram: "Telegram",
  email: "邮件",
  wechat: "企业微信",
};

const mockMarketCaps: Record<string, number> = {
  BTCUSDT: 2040,
  ETHUSDT: 592,
  BNBUSDT: 122,
  SOLUSDT: 104,
};

const rankModeLabel: Record<MarketRankMode, string> = {
  marketCap: "市值排行",
  volume: "交易量排行",
  change24h: "涨跌幅排行",
  netFlow: "资金流排行",
  custom: "自定义排行",
};

const streamStatusMeta: Record<MarketStreamStatus["status"], { label: string; color: string }> = {
  idle: { label: "未启动", color: "default" },
  connecting: { label: "连接中", color: "blue" },
  connected: { label: "实时连接", color: "green" },
  disconnected: { label: "已断开", color: "gold" },
  error: { label: "连接错误", color: "red" },
};

const marketSourceMeta: Record<MarketDataStatus["source"], { label: string; color: string }> = {
  mock: { label: "Mock 数据", color: "gold" },
  binance: { label: "Binance 直连", color: "green" },
  backend: { label: "后端实时数据", color: "blue" },
};

const trendMeta: Record<IndicatorTrend, { label: string; color: string }> = {
  bullish: { label: "多头趋势", color: "green" },
  bearish: { label: "空头趋势", color: "red" },
  neutral: { label: "震荡/中性", color: "gold" },
};

const emaAlignmentLabel = {
  bullish: "EMA 多头排列",
  bearish: "EMA 空头排列",
  mixed: "EMA 纠缠",
};

const macdSignalLabel = {
  bullish_cross: "MACD 金叉",
  bearish_cross: "MACD 死叉",
  bullish: "MACD 多头",
  bearish: "MACD 空头",
  neutral: "MACD 中性",
};

function formatPrice(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: value > 1000 ? 0 : 2 });
}

function parseVolumeToMillions(volume: string) {
  const numeric = Number(volume.replace(/[BM]/g, ""));
  if (volume.endsWith("B")) return numeric * 1000;
  return numeric;
}

function strategyDisplayName(instance?: StrategyInstance) {
  if (!instance) return "模拟策略实例";
  if (instance.name && !instance.name.includes("模拟实例")) return instance.name;
  return instance.slotTemplateId === "slot-dual-trend" ? "双周期趋势监控" : "三周期趋势监控";
}

function signalName(signalLibrary: SignalDefinition[], id: string) {
  return fallbackSignalLabels[id] ?? signalLibrary.find((signal) => signal.id === id)?.name ?? id;
}

function backtestSeed(value: string) {
  return value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function simulateBacktest(instance: StrategyInstance, symbol: string, timeframeCombo: string): BacktestResult {
  const seed = backtestSeed(`${instance.id}-${symbol}-${timeframeCombo}-${instance.version ?? 1}`);
  const conditionBonus = Math.min(instance.conditionIds.length, 10) * 1.4;
  const versionBonus = (instance.version ?? 1) > 1 ? 5 : 0;
  const comboBonus = timeframeCombo === "1d-4h-1h" ? 6 : timeframeCombo === "4h-1h-15m" ? 2 : 0;
  const symbolPenalty = symbol.startsWith("SOL") ? 5 : symbol.startsWith("BNB") ? 2 : 0;
  const quality = Math.max(42, Math.min(92, 58 + conditionBonus + versionBonus + comboBonus - symbolPenalty + (seed % 9)));
  const triggerCount = 8 + (seed % 7) + (timeframeCombo === "4h-1h-15m" ? 4 : 0);
  const validCount = Math.max(1, Math.round(triggerCount * (quality / 100)));
  const invalidCount = Math.max(0, Math.round(triggerCount * ((100 - quality) / 140)));
  const watchCount = Math.max(0, triggerCount - validCount - invalidCount);
  const events: BacktestEvent[] = Array.from({ length: triggerCount }, (_, index) => {
    const eventSeed = seed + index * 13;
    const status: ReviewStatus = index < validCount ? "valid" : index < validCount + invalidCount ? "invalid" : "watching";
    const basePrice = mockMarketSeries.BTCUSDT[index + 8]?.close ?? mockMarketSeries.BTCUSDT.at(-1)?.close ?? 1000;
    const priceScale = symbol.startsWith("ETH") ? 0.047 : symbol.startsWith("SOL") ? 0.0021 : symbol.startsWith("BNB") ? 0.0078 : 1;
    const result = status === "valid" ? Number((0.8 + (eventSeed % 34) / 10).toFixed(1)) : status === "invalid" ? Number((-0.4 - (eventSeed % 18) / 10).toFixed(1)) : Number(((eventSeed % 16) / 10).toFixed(1));
    return {
      id: `${instance.id}-${symbol}-${index}`,
      time: `2026-05-${String(2 + Math.floor(index / 4)).padStart(2, "0")} ${String((index * 3) % 24).padStart(2, "0")}:00`,
      symbol,
      status,
      triggerPrice: basePrice * priceScale,
      result,
      mfe: Number((Math.max(result, 0.4) + (eventSeed % 8) / 10).toFixed(1)),
      mae: Number((-0.3 - (eventSeed % 12) / 10).toFixed(1)),
      waitBars: 2 + (eventSeed % 9),
      timeframeState: timeframeCombo === "1d-4h-1h" ? "方向周期确认，结构周期收敛，触发周期入场" : "中短周期更快触发，需更强资金流过滤",
      flowState: eventSeed % 3 === 0 ? "资金流弱确认" : "资金流通过",
    };
  });
  const validEvents = events.filter((event) => event.status === "valid");
  return {
    triggerCount,
    validCount,
    invalidCount,
    watchCount,
    winRate: Math.round((validCount / Math.max(triggerCount, 1)) * 100),
    avgMfe: Number((events.reduce((sum, item) => sum + item.mfe, 0) / Math.max(events.length, 1)).toFixed(1)),
    avgMae: Number((events.reduce((sum, item) => sum + item.mae, 0) / Math.max(events.length, 1)).toFixed(1)),
    avgWaitBars: Number((events.reduce((sum, item) => sum + item.waitBars, 0) / Math.max(events.length, 1)).toFixed(1)),
    flowPassRate: Math.round((events.filter((event) => event.flowState === "资金流通过").length / Math.max(events.length, 1)) * 100),
    events: [...validEvents, ...events.filter((event) => event.status !== "valid")].slice(0, triggerCount),
  };
}

function decideBacktest(result: BacktestResult): { decision: BacktestDecision; conclusion: string; reasons: string[] } {
  const reasons: string[] = [];
  if (result.winRate >= 70 && result.avgMae >= -1.1 && result.flowPassRate >= 65) {
    reasons.push("胜率较高，平均回撤可控，资金流确认通过率达标。");
    return { decision: "mount", conclusion: "该策略版本适合进入监控队列。", reasons };
  }
  if (result.triggerCount > 14 && result.winRate < 60) reasons.push("触发次数偏多但有效率不足，需要收紧触发条件。");
  if (result.triggerCount < 6) reasons.push("触发次数偏少，可能需要放宽触发条件或缩短周期组合。");
  if (result.flowPassRate < 60) reasons.push("资金流通过率偏低，建议增强资金流过滤。");
  if (result.avgMae < -1.6) reasons.push("平均最大回撤偏大，需要增加风控或回踩确认。");
  if (result.winRate < 50 || result.avgMae < -2) {
    return { decision: "reject", conclusion: "该策略版本暂不适合上线监控。", reasons: reasons.length ? reasons : ["综合胜率和回撤不达标。"] };
  }
  return { decision: "observe", conclusion: "该策略版本可以继续观察，暂不建议直接扩大监控。", reasons: reasons.length ? reasons : ["核心指标中性，需要更多样本确认。"] };
}

function ema(values: number[], period: number) {
  const k = 2 / (period + 1);
  return values.reduce<number[]>((acc, value, index) => {
    acc.push(index === 0 ? value : value * k + acc[index - 1] * (1 - k));
    return acc;
  }, []);
}

function buildReviewRecords(signals: Signal[], strategyInstances: StrategyInstance[], signalReviews: SignalReviewResult[]): ReviewRecord[] {
  const seed: Array<Omit<ReviewRecord, "id" | "signalId" | "instanceId" | "symbol" | "strategyVersion" | "direction" | "strength">> = [
    {
      strategyName: "三周期趋势突破",
      status: "valid",
      triggerPrice: 102840,
      currentPrice: 104310,
      mfe: 3.6,
      mae: -0.8,
      result24h: 2.4,
      signalScore: 88,
      executionScore: 76,
      holdingTimeframe: "4h",
      executionTimeframe: "1h",
      reason: "大周期多头保持，结构周期完成收敛，小周期金叉后资金流同步增强。",
      tags: ["周期一致", "资金流确认", "入场略晚"],
      traded: true,
      errorTypes: [],
    },
    {
      strategyName: "双周期双均线趋势",
      status: "execution_error",
      triggerPrice: 4890,
      currentPrice: 4932,
      mfe: 1.9,
      mae: -1.4,
      result24h: 0.7,
      signalScore: 81,
      executionScore: 52,
      holdingTimeframe: "4h",
      executionTimeframe: "1h",
      reason: "信号有效，但人工入场点追高，止损距离被动放大。",
      tags: ["信号有效", "追高", "执行偏差"],
      traded: true,
      errorTypes: ["chasing_entry"],
    },
    {
      strategyName: "三周期趋势突破",
      status: "watching",
      triggerPrice: 216.8,
      currentPrice: 218.4,
      mfe: 2.1,
      mae: -0.6,
      result24h: 0.9,
      signalScore: 74,
      executionScore: 0,
      holdingTimeframe: "4h",
      executionTimeframe: "15m",
      reason: "结构周期接近突破，但资金流确认不足，需要等待下一次触发周期同步。",
      tags: ["观察有效", "资金流不足", "未交易"],
      traded: false,
      errorTypes: ["flow_divergence"],
    },
  ];

  return signals.map((signal, index) => {
    const savedReview = signalReviews.find((review) => review.signalId === signal.id);
    const baseReview = signal.createdAt === "刚刚"
      ? { ...(seed[index % seed.length] ?? seed[0]), status: "pending" as ReviewStatus, tags: ["待复盘", "真实信号"], traded: false, executionScore: 0, errorTypes: [] }
      : (seed[index % seed.length] ?? seed[0]);

    return {
      ...baseReview,
      id: `review-${signal.id}`,
      signalId: signal.id,
      instanceId: signal.instanceId,
      symbol: signal.symbol,
      strategyName: strategyDisplayName(strategyInstances.find((instance) => instance.id === signal.instanceId)),
      strategyVersion: signal.strategyVersion ?? strategyInstances.find((instance) => instance.id === signal.instanceId)?.version ?? 1,
      direction: signal.direction,
      strength: signal.strength,
      ...(savedReview
        ? {
            status: savedReview.status,
            reviewNote: savedReview.note,
            errorTypes: savedReview.errorTypes,
            traded: savedReview.traded,
            executionScore: savedReview.executionScore,
            reviewedAt: savedReview.reviewedAt,
            tags: [
              reviewStatusMeta[savedReview.status].label,
              ...savedReview.errorTypes.map((type) => reviewErrorMeta[type]),
              savedReview.traded ? "已交易" : "未交易",
            ],
          }
        : {}),
    };
  });
}

function buildMonitorSignalStats(strategyStates: StrategyState[], signals: Signal[], strategyInstances: StrategyInstance[]): MonitorSignalStat[] {
  return strategyStates.map((state) => {
    const instance = strategyInstances.find((item) => item.id === state.instanceId);
    const relatedSignals = signals.filter((signal) => signal.instanceId === state.instanceId && signal.symbol === state.symbol);
    return {
      key: `${state.instanceId}-${state.symbol}`,
      symbol: state.symbol,
      strategyName: instance?.slotTemplateId === "slot-dual-trend" ? "双周期趋势监控" : "三周期趋势监控",
      state: state.state,
      totalSignals: relatedSignals.length,
      strongSignals: relatedSignals.filter((signal) => signal.strength === "strong").length,
      waitingSignals: state.state === "waiting_trigger" ? 1 : 0,
      lastSignalTime: relatedSignals[0]?.createdAt ?? state.lastUpdated,
    };
  });
}

function MonitorSignalTicker({ title, data, mode }: { title: string; data: MonitorSignalStat[]; mode: "total" | "strong" | "waiting" }) {
  const visible = data.length > 0 ? data : [];
  const scrollItems = visible.length > 3 ? [...visible, ...visible] : visible;

  const valueForMode = (item: MonitorSignalStat) => {
    if (mode === "strong") return item.strongSignals;
    if (mode === "waiting") return item.waitingSignals;
    return item.totalSignals;
  };

  return (
    <div className="monitor-stat-panel">
      <Text type="secondary" className="monitor-stat-title">{title}</Text>
      <div className={visible.length > 3 ? "monitor-stat-viewport is-scrolling" : "monitor-stat-viewport"}>
        <div className="monitor-stat-track">
          {scrollItems.map((item, index) => (
            <div className="monitor-stat-row" key={`${item.key}-${index}`}>
              <div>
                <Space size={6}>
                  <Text strong>{item.symbol}</Text>
                  <Tag color={stateMeta[item.state].color}>{stateMeta[item.state].label}</Tag>
                </Space>
                <Text type="secondary" className="monitor-stat-subtitle">{item.strategyName} / {item.lastSignalTime}</Text>
              </div>
              <div className="monitor-stat-value">
                <Text strong>{valueForMode(item)}</Text>
                <Text type="secondary">{mode === "waiting" ? "等待" : "信号"}</Text>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniKline({ data, markerLabel = "信号触发", symbol = "BTCUSDT" }: { data: KlinePoint[]; markerLabel?: string; symbol?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const last = data[data.length - 1];
  const previous = data[data.length - 2] ?? last;
  const change = last.close - previous.close;
  const changePercent = previous.close ? (change / previous.close) * 100 : 0;

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      height: 360,
      layout: { background: { color: "#0b1220" }, textColor: "#94a3b8", attributionLogo: true },
      grid: { vertLines: { color: "rgba(51, 65, 85, 0.45)" }, horzLines: { color: "rgba(51, 65, 85, 0.45)" } },
      rightPriceScale: { borderColor: "rgba(148, 163, 184, 0.22)" },
      timeScale: { borderColor: "rgba(148, 163, 184, 0.22)" },
      crosshair: { mode: 0 },
      localization: { priceFormatter: (price: number) => price.toLocaleString("en-US", { maximumFractionDigits: 2 }) },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#16a34a",
      downColor: "#e11d48",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#fb7185",
      priceLineColor: "#22c55e",
      priceLineWidth: 1,
      priceLineStyle: 2,
    });
    const ema9 = chart.addSeries(LineSeries, { color: "#38bdf8", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    const ema21 = chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    const volume = chart.addSeries(HistogramSeries, {
      color: "#334155",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });

    const closes = data.map((item) => item.close);
    const ema9Values = ema(closes, 9);
    const ema21Values = ema(closes, 21);
    const candles = data.map((item, index) => ({
      time: (index + 1) as never,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
    }));

    series.setData(candles);
    ema9.setData(data.map((_, index) => ({ time: (index + 1) as never, value: ema9Values[index] })));
    ema21.setData(data.map((_, index) => ({ time: (index + 1) as never, value: ema21Values[index] })));
    volume.setData(
      data.map((item, index) => ({
        time: (index + 1) as never,
        value: Math.round(Math.abs(item.close - item.open) * 18 + 900 + index * 21),
        color: item.close >= item.open ? "rgba(34, 197, 94, 0.28)" : "rgba(244, 63, 94, 0.28)",
      })),
    );
    chart.timeScale().fitContent();
    const resize = () => chart.applyOptions({ width: ref.current?.clientWidth ?? 720 });
    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      chart.remove();
    };
  }, [data, markerLabel]);

  return (
    <div className="tv-chart-shell">
      <div className="tv-chart-head">
        <Space wrap>
          <Tag color="blue">TradingView Lightweight Charts</Tag>
          <Text type="secondary">Canvas 金融图表引擎</Text>
        </Space>
        <Space wrap>
          <Text type="secondary">O {formatPrice(last.open)}</Text>
          <Text type="secondary">H {formatPrice(last.high)}</Text>
          <Text type="secondary">L {formatPrice(last.low)}</Text>
          <Text strong>C {formatPrice(last.close)}</Text>
          <Text type={change >= 0 ? "success" : "danger"}>
            {change >= 0 ? "+" : ""}
            {change.toFixed(2)} / {changePercent.toFixed(2)}%
          </Text>
        </Space>
      </div>
      <div className="tv-chart-watermark">
        <strong>{symbol}</strong>
        <span>TradingView Lightweight</span>
      </div>
      <div className="chart-host" ref={ref} />
    </div>
  );
}

function Dashboard() {
  const { signals, strategyStates, moneyFlows, selectSignal, timeframeDecisions, strategyInstances, signalReviews } = useAppStore();
  const reviewRecords = buildReviewRecords(signals, strategyInstances, signalReviews);
  const monitorStats = buildMonitorSignalStats(strategyStates, signals, strategyInstances);
  const strongSignals = signals.filter((signal) => signal.strength === "strong").length;
  const triggered = strategyStates.filter((state) => state.state === "triggered").length;
  const waiting = strategyStates.filter((state) => state.state === "waiting_trigger").length;
  const validReviewCount = reviewRecords.filter((item) => item.status === "valid").length;
  const activeDecision = timeframeDecisions[0];
  const chartData = moneyFlows.map((item) => ({ symbol: item.symbol.replace("USDT", ""), flow: item.netFlow }));

  const stateColumns: ColumnsType<StrategyState> = [
    { title: "币种", dataIndex: "symbol" },
    {
      title: "状态",
      dataIndex: "state",
      render: (value: StrategyState["state"]) => <Badge status={stateMeta[value].badge} text={stateMeta[value].label} />,
    },
    { title: "下一步等待", dataIndex: "nextWaitingFor" },
    { title: "更新时间", dataIndex: "lastUpdated", width: 110 },
  ];

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card className="metric-stat-card">
            <Statistic title="今日信号" value={signals.length} prefix={<Bell size={18} />} />
            <MonitorSignalTicker title="监控信号统计" data={monitorStats} mode="total" />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card className="metric-stat-card">
            <Statistic title="强信号" value={strongSignals} valueStyle={{ color: "#52c41a" }} />
            <MonitorSignalTicker title="强信号分布" data={monitorStats} mode="strong" />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card className="metric-stat-card">
            <Statistic title="等待触发" value={waiting} valueStyle={{ color: "#faad14" }} />
            <MonitorSignalTicker title="等待触发分布" data={monitorStats} mode="waiting" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="策略运行状态" extra={<Tag color="green">{triggered} 个已触发</Tag>}>
            <Table rowKey={(row) => `${row.instanceId}-${row.symbol}`} columns={stateColumns} dataSource={strategyStates} pagination={false} scroll={{ x: 720 }} />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="资金流净流入">
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" />
                  <XAxis dataKey="symbol" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="flow" radius={[4, 4, 0, 0]}>
                    {chartData.map((item) => <Cell key={item.symbol} fill={item.flow >= 0 ? "#22c55e" : "#f43f5e"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="最新触发机会">
            <List
              dataSource={signals}
              renderItem={(signal) => (
                <List.Item className="clickable-list-item" onClick={() => selectSignal(signal.id)}>
                  <List.Item.Meta
                    title={<Space><Tag color={strengthMeta[signal.strength].color}>{strengthMeta[signal.strength].label}</Tag><Text strong>{signal.symbol}</Text></Space>}
                    description="点击查看信号快照、周期槽位、资金流确认和推送状态"
                  />
                  <Text type="secondary">{signal.createdAt}</Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="周期筛选结论" extra={<Tag color="blue">{activeDecision.confidence}% 置信度</Tag>}>
            <Paragraph>{activeDecision.selectedReason}</Paragraph>
            <Space wrap>
              <Tag color="green">持仓周期 {activeDecision.holdingTimeframe}</Tag>
              <Tag color="blue">执行周期 {activeDecision.executionTimeframe}</Tag>
              <Tag>候选周期 {activeDecision.candidates.map((item) => item.timeframe).join(" / ")}</Tag>
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

function MarketMonitor() {
  const { symbols, moneyFlows, timeframeDecisions, marketSeries } = useAppStore();
  const [timeframe, setTimeframe] = useState("4h");
  const columns: ColumnsType<(typeof symbols)[number]> = [
    { title: "币种", dataIndex: "symbol", fixed: "left" },
    { title: "价格", dataIndex: "price", align: "right", render: (value: number) => formatPrice(value) },
    {
      title: "24h",
      dataIndex: "change24h",
      align: "right",
      render: (value: number) => <Text type={value >= 0 ? "success" : "danger"}>{value}%</Text>,
    },
    { title: "成交量", dataIndex: "volume", align: "right" },
    {
      title: "监控状态",
      dataIndex: "status",
      render: (value: string) => <Tag color={value === "alert" ? "green" : value === "watching" ? "blue" : "default"}>{value}</Tag>,
    },
  ];

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card
            title="BTCUSDT K线监控"
            extra={<Segmented value={timeframe} onChange={(value) => setTimeframe(String(value))} options={timeframeOptions} />}
          >
            <MiniKline data={marketSeries.BTCUSDT ?? mockMarketSeries.BTCUSDT} />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="多周期状态">
            <List
              dataSource={timeframeDecisions[0].candidates}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta title={`${item.timeframe} / ${item.role}`} description={<Progress percent={item.score} size="small" />} />
                </List.Item>
              )}
            />
          </Card>
          <Card title="资金流概览" className="mt-12">
            <List
              dataSource={moneyFlows}
              renderItem={(item) => (
                <List.Item>
                  <Text>{item.symbol}</Text>
                  <Text type={item.netFlow >= 0 ? "success" : "danger"}>{item.netFlow}M</Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
      <Card title="行情列表">
        <Table rowKey="symbol" columns={columns} dataSource={symbols} pagination={false} scroll={{ x: 720 }} />
      </Card>
    </Space>
  );
}

function RankedMarketMonitor() {
  const { symbols, moneyFlows, timeframeDecisions, strategyInstances, strategyStates, marketSeries, indicatorSummaries, marketDataStatus, klineRefreshStatus, indicatorRefreshStatus, marketStreamStatus, refreshBackendMarketData, refreshBackendKlines, refreshBackendIndicatorSummary, startBinanceMarketStream, stopBinanceMarketStream, mountSymbolToStrategy } = useAppStore();
  const [rankMode, setRankMode] = useState<MarketRankMode>("marketCap");
  const [customFactors, setCustomFactors] = useState<string[]>(["marketCap", "volume", "netFlow"]);
  const [selectedMarketSymbol, setSelectedMarketSymbol] = useState<string | null>(null);
  const [selectedKlineInterval, setSelectedKlineInterval] = useState("1h");
  const [selectedStrategyId, setSelectedStrategyId] = useState("");
  const [mountResult, setMountResult] = useState<string | null>(null);
  const activeDecision = timeframeDecisions[0];

  const rows = useMemo(() => {
    const baseRows = symbols.map((symbol) => {
      const flow = moneyFlows.find((item) => item.symbol === symbol.symbol);
      const marketCap = mockMarketCaps[symbol.symbol] ?? symbol.price * 0.1;
      const volumeM = parseVolumeToMillions(symbol.volume);
      const netFlow = flow?.netFlow ?? 0;
      const customScore =
        (customFactors.includes("marketCap") ? marketCap / 20 : 0) +
        (customFactors.includes("volume") ? volumeM / 220 : 0) +
        (customFactors.includes("change24h") ? Math.max(symbol.change24h, 0) * 10 : 0) +
        (customFactors.includes("netFlow") ? Math.max(netFlow, 0) * 1.8 : 0) +
        (customFactors.includes("status") ? (symbol.status === "alert" ? 18 : symbol.status === "watching" ? 8 : 0) : 0);

      return {
        ...symbol,
        marketCap,
        volumeM,
        fundingRate: flow?.fundingRate ?? 0,
        oiChange: flow?.oiChange ?? 0,
        takerBuyRatio: flow?.takerBuyRatio ?? 0,
        netFlow,
        customScore,
      };
    });

    const scoreByMode = (row: (typeof baseRows)[number]) => {
      if (rankMode === "volume") return row.volumeM;
      if (rankMode === "change24h") return row.change24h;
      if (rankMode === "netFlow") return row.netFlow;
      if (rankMode === "custom") return row.customScore;
      return row.marketCap;
    };

    return baseRows.sort((a, b) => scoreByMode(b) - scoreByMode(a));
  }, [customFactors, moneyFlows, rankMode, symbols]);

  const selectedMarketRow = rows.find((row) => row.symbol === selectedMarketSymbol);
  const selectedKlines = selectedMarketSymbol
    ? (marketSeries[selectedMarketSymbol] ?? mockMarketSeries.BTCUSDT)
    : mockMarketSeries.BTCUSDT;
  const selectedIndicatorSummary = selectedMarketSymbol
    ? indicatorSummaries[`${selectedMarketSymbol}-${selectedKlineInterval}`]
    : undefined;
  const selectedMountedState = selectedMarketSymbol
    ? strategyStates.find((state) => state.instanceId === selectedStrategyId && state.symbol === selectedMarketSymbol)
    : undefined;
  const selectedExistingStates = selectedMarketSymbol ? strategyStates.filter((state) => state.symbol === selectedMarketSymbol) : [];
  const strategyOptions = strategyInstances.map((instance) => ({
    label: strategyDisplayName(instance),
    value: instance.id,
    disabled: selectedExistingStates.some((state) => state.instanceId === instance.id),
  }));
  const availableStrategyCount = strategyOptions.filter((item) => !item.disabled).length;

  const columns: ColumnsType<(typeof rows)[number]> = [
    {
      title: "排名",
      width: 74,
      render: (_, __, index) => <Tag color={index === 0 ? "gold" : index === 1 ? "blue" : "default"}>#{index + 1}</Tag>,
    },
    {
      title: "币种",
      dataIndex: "symbol",
      fixed: "left",
      render: (value: string, row) => (
        <Space direction="vertical" size={2}>
          <Text strong>{value}</Text>
          <Tag color={row.status === "alert" ? "green" : row.status === "watching" ? "blue" : "default"}>
            {row.status === "alert" ? "触发关注" : row.status === "watching" ? "监控中" : "普通"}
          </Tag>
        </Space>
      ),
    },
    { title: "价格", dataIndex: "price", align: "right", render: (value: number) => formatPrice(value) },
    { title: "市值", dataIndex: "marketCap", align: "right", sorter: (a, b) => a.marketCap - b.marketCap, render: (value: number) => `$${value.toFixed(0)}B` },
    { title: "交易量", dataIndex: "volumeM", align: "right", sorter: (a, b) => a.volumeM - b.volumeM, render: (value: number) => `$${(value / 1000).toFixed(1)}B` },
    {
      title: "24h",
      dataIndex: "change24h",
      align: "right",
      sorter: (a, b) => a.change24h - b.change24h,
      render: (value: number) => <Text type={value >= 0 ? "success" : "danger"}>{value}%</Text>,
    },
    {
      title: "资金流",
      dataIndex: "netFlow",
      align: "right",
      sorter: (a, b) => a.netFlow - b.netFlow,
      render: (value: number) => <Text type={value >= 0 ? "success" : "danger"}>{value}M</Text>,
    },
    { title: "OI", dataIndex: "oiChange", align: "right", render: (value: number) => <Text type={value >= 0 ? "success" : "danger"}>{value}%</Text> },
    {
      title: "自定义分",
      dataIndex: "customScore",
      align: "right",
      render: (value: number) => <Progress percent={Math.min(100, Math.round(value))} size="small" />,
    },
    {
      title: "操作",
      fixed: "right",
      width: 130,
      render: (_, row) => {
        const mountedCount = strategyStates.filter((state) => state.symbol === row.symbol).length;

        return (
          <Button
            type={mountedCount ? "default" : "primary"}
            onClick={() => {
              setSelectedMarketSymbol(row.symbol);
              const mountedIds = strategyStates.filter((state) => state.symbol === row.symbol).map((state) => state.instanceId);
              setSelectedStrategyId(strategyInstances.find((instance) => !mountedIds.includes(instance.id))?.id ?? strategyInstances[0]?.id ?? "");
            }}
          >
            {mountedCount ? `监控中 ${mountedCount}` : "加入监控"}
          </Button>
        );
      },
    },
  ];

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Card>
        <Flex justify="space-between" align="center" gap={16} wrap>
          <Space direction="vertical" size={4}>
            <Title level={4} className="page-title">市场排行榜</Title>
            <Text type="secondary">按市值、交易量、涨跌幅、资金流或自定义条件筛选监控标的。</Text>
          </Space>
          <Segmented
            value={rankMode}
            onChange={(value) => setRankMode(value as MarketRankMode)}
            options={[
              { label: "市值", value: "marketCap" },
              { label: "交易量", value: "volume" },
              { label: "涨跌幅", value: "change24h" },
              { label: "资金流", value: "netFlow" },
              { label: "自定义", value: "custom" },
            ]}
          />
          <Button loading={marketDataStatus.loading} onClick={() => void refreshBackendMarketData()}>
            刷新后端行情
          </Button>
          <Button
            type={marketStreamStatus.status === "connected" ? "default" : "primary"}
            loading={marketStreamStatus.status === "connecting"}
            onClick={marketStreamStatus.status === "connected" || marketStreamStatus.status === "connecting" ? stopBinanceMarketStream : startBinanceMarketStream}
          >
            {marketStreamStatus.status === "connected" || marketStreamStatus.status === "connecting" ? "停止实时行情" : "启动实时行情"}
          </Button>
        </Flex>
        <div className="market-source-bar">
          <Space wrap>
            <Tag color={marketSourceMeta[marketDataStatus.source].color}>
              {marketSourceMeta[marketDataStatus.source].label}
            </Tag>
            <Tag color={streamStatusMeta[marketStreamStatus.status].color}>
              {streamStatusMeta[marketStreamStatus.status].label}
            </Tag>
            <Text type="secondary">最近更新：{marketDataStatus.lastUpdated ?? "尚未刷新"}</Text>
            <Text type="secondary">最近推送：{marketStreamStatus.lastEventAt ?? "-"}</Text>
            <Text type="secondary">重连：{marketStreamStatus.reconnects}</Text>
            {marketDataStatus.error && <Text type="danger">刷新失败：{marketDataStatus.error}</Text>}
            {marketStreamStatus.error && <Text type="danger">实时错误：{marketStreamStatus.error}</Text>}
          </Space>
        </div>
        {rankMode === "custom" && (
          <div className="rank-custom-bar">
            <Text type="secondary">自定义排行条件</Text>
            <Select
              mode="multiple"
              value={customFactors}
              onChange={setCustomFactors}
              className="rank-custom-select"
              options={[
                { label: "市值权重", value: "marketCap" },
                { label: "交易量权重", value: "volume" },
                { label: "涨跌幅权重", value: "change24h" },
                { label: "资金流权重", value: "netFlow" },
                { label: "监控状态权重", value: "status" },
              ]}
            />
          </div>
        )}
        {mountResult && <Alert className="mt-12" type="success" showIcon message={mountResult} />}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={18}>
          <Card title={rankModeLabel[rankMode]}>
            <Table rowKey="symbol" columns={columns} dataSource={rows} pagination={false} scroll={{ x: 1300 }} />
          </Card>
        </Col>
        <Col xs={24} xl={6}>
          <Card title="当前筛选结果">
            <List
              dataSource={rows.slice(0, 5)}
              renderItem={(row, index) => (
                <List.Item>
                  <List.Item.Meta
                    title={<Space><Tag>#{index + 1}</Tag><Text strong>{row.symbol}</Text></Space>}
                    description={`市值 $${row.marketCap.toFixed(0)}B / 资金流 ${row.netFlow}M`}
                  />
                </List.Item>
              )}
            />
          </Card>
          <Card title="周期参考" className="mt-12">
            <List
              dataSource={activeDecision.candidates}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta title={`${item.timeframe} / ${item.role}`} description={<Progress percent={item.score} size="small" />} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
      <Drawer
        title={`加入监控${selectedMarketRow ? `：${selectedMarketRow.symbol}` : ""}`}
        open={Boolean(selectedMarketSymbol)}
        onClose={() => setSelectedMarketSymbol(null)}
        width={460}
      >
        {selectedMarketRow && (
          <Space direction="vertical" size={16} className="page-stack">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="币种">{selectedMarketRow.symbol}</Descriptions.Item>
              <Descriptions.Item label="价格">{formatPrice(selectedMarketRow.price)}</Descriptions.Item>
              <Descriptions.Item label="24h 涨跌">
                <Text type={selectedMarketRow.change24h >= 0 ? "success" : "danger"}>{selectedMarketRow.change24h}%</Text>
              </Descriptions.Item>
              <Descriptions.Item label="交易量">${(selectedMarketRow.volumeM / 1000).toFixed(1)}B</Descriptions.Item>
              <Descriptions.Item label="资金流">
                <Text type={selectedMarketRow.netFlow >= 0 ? "success" : "danger"}>{selectedMarketRow.netFlow}M</Text>
              </Descriptions.Item>
            </Descriptions>

            <Card
              title={`${selectedMarketRow.symbol} K线`}
              size="small"
              extra={
                <Space>
                  <Segmented
                    size="small"
                    value={selectedKlineInterval}
                    onChange={(value) => setSelectedKlineInterval(value as string)}
                    options={["15m", "1h", "4h", "1d"]}
                  />
                  <Button
                    size="small"
                    loading={klineRefreshStatus.loading && klineRefreshStatus.symbol === selectedMarketRow.symbol}
                    onClick={() => void refreshBackendKlines(selectedMarketRow.symbol, selectedKlineInterval)}
                  >
                    刷新K线
                  </Button>
                </Space>
              }
            >
              <Space direction="vertical" size={8} className="page-stack">
                <Space wrap>
                  <Tag color={klineRefreshStatus.source === "backend" ? "blue" : "gold"}>
                    {klineRefreshStatus.source === "backend" ? "后端K线" : "Mock K线"}
                  </Tag>
                  <Text type="secondary">
                    周期：{klineRefreshStatus.symbol === selectedMarketRow.symbol ? (klineRefreshStatus.interval ?? selectedKlineInterval) : selectedKlineInterval}
                  </Text>
                  <Text type="secondary">更新：{klineRefreshStatus.lastUpdated ?? "尚未刷新"}</Text>
                </Space>
                {klineRefreshStatus.error && klineRefreshStatus.symbol === selectedMarketRow.symbol && (
                  <Text type="danger">K线刷新失败：{klineRefreshStatus.error}</Text>
                )}
                <MiniKline data={selectedKlines} markerLabel={`${selectedMarketRow.symbol} ${selectedKlineInterval}`} symbol={selectedMarketRow.symbol} />
              </Space>
            </Card>

            <Card
              title="后端指标摘要"
              size="small"
              extra={
                <Button
                  size="small"
                  loading={indicatorRefreshStatus.loading && indicatorRefreshStatus.symbol === selectedMarketRow.symbol}
                  onClick={() => void refreshBackendIndicatorSummary(selectedMarketRow.symbol, selectedKlineInterval)}
                >
                  刷新指标
                </Button>
              }
            >
              {selectedIndicatorSummary ? (
                <Space direction="vertical" size={10} className="page-stack">
                  <Space wrap>
                    <Tag color={trendMeta[selectedIndicatorSummary.trend].color}>
                      {trendMeta[selectedIndicatorSummary.trend].label}
                    </Tag>
                    <Tag color={selectedIndicatorSummary.ema.alignment === "bullish" ? "green" : selectedIndicatorSummary.ema.alignment === "bearish" ? "red" : "gold"}>
                      {emaAlignmentLabel[selectedIndicatorSummary.ema.alignment]}
                    </Tag>
                    <Tag>{macdSignalLabel[selectedIndicatorSummary.macd.signal]}</Tag>
                  </Space>
                  <Progress percent={selectedIndicatorSummary.score} size="small" />
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="周期">{selectedIndicatorSummary.interval}</Descriptions.Item>
                    <Descriptions.Item label="最新收盘">{formatPrice(selectedIndicatorSummary.latestClose)}</Descriptions.Item>
                    <Descriptions.Item label="EMA9 / EMA21 / EMA55">
                      {formatPrice(selectedIndicatorSummary.ema.ema9)} / {formatPrice(selectedIndicatorSummary.ema.ema21)} / {formatPrice(selectedIndicatorSummary.ema.ema55)}
                    </Descriptions.Item>
                    <Descriptions.Item label="MACD DIF / DEA / Hist">
                      {selectedIndicatorSummary.macd.dif.toFixed(4)} / {selectedIndicatorSummary.macd.dea.toFixed(4)} / {selectedIndicatorSummary.macd.histogram.toFixed(4)}
                    </Descriptions.Item>
                    <Descriptions.Item label="样本K线">{selectedIndicatorSummary.sourceBars}</Descriptions.Item>
                  </Descriptions>
                </Space>
              ) : (
                <Space direction="vertical" size={8}>
                  <Text type="secondary">点击刷新指标，从后端计算 EMA/MACD 趋势摘要。</Text>
                  {indicatorRefreshStatus.error && indicatorRefreshStatus.symbol === selectedMarketRow.symbol && (
                    <Text type="danger">指标刷新失败：{indicatorRefreshStatus.error}</Text>
                  )}
                </Space>
              )}
            </Card>

            <Form layout="vertical">
              <Form.Item label="选择要挂载的监控策略">
                <Select
                  value={selectedStrategyId}
                  onChange={setSelectedStrategyId}
                  options={strategyOptions}
                  className="market-drawer-select"
                  placeholder="选择策略"
                />
              </Form.Item>
              {selectedExistingStates.length > 0 && (
                <Alert
                  type="info"
                  showIcon
                  message="当前已在监控队列"
                  description={
                    <Space wrap>
                      {selectedExistingStates.map((state) => (
                        <Tag key={`${state.instanceId}-${state.symbol}`} color={stateMeta[state.state].color}>
                          {strategyDisplayName(strategyInstances.find((item) => item.id === state.instanceId))} / {stateMeta[state.state].label}
                        </Tag>
                      ))}
                    </Space>
                  }
                />
              )}
              <Button
                type="primary"
                block
                disabled={!selectedStrategyId || Boolean(selectedMountedState)}
                onClick={() => {
                  if (!selectedStrategyId || !selectedMarketSymbol) return;
                  const result = mountSymbolToStrategy(selectedStrategyId, selectedMarketSymbol);
                  setMountResult(
                    result === "added"
                      ? `${selectedMarketSymbol} 已加入 ${strategyDisplayName(strategyInstances.find((item) => item.id === selectedStrategyId))} 监控队列`
                      : result === "exists"
                        ? `${selectedMarketSymbol} 已在该策略监控队列中`
                        : "策略不存在，无法加入监控",
                  );
                  if (result === "added") setSelectedMarketSymbol(null);
                }}
              >
                {selectedMountedState ? "该策略已在监控中" : "确认加入监控队列"}
              </Button>
            </Form>
          </Space>
        )}
      </Drawer>
    </Space>
  );
}

function SignalLibraryPage() {
  const { signalLibrary, addSignalDefinition } = useAppStore();
  const [filter, setFilter] = useState<"all" | SignalCategory>("all");
  const visible = filter === "all" ? signalLibrary : signalLibrary.filter((signal) => signal.category === filter);
  const columns: ColumnsType<SignalDefinition> = [
    { title: "信号名称", dataIndex: "id", render: (id: string) => signalName(signalLibrary, id) },
    { title: "类型", dataIndex: "category", width: 110, render: (value: SignalCategory) => <Tag color={categoryColor[value]}>{categoryLabel[value]}</Tag> },
    { title: "默认用途", dataIndex: "group", width: 110, render: (value: SignalDefinition["group"]) => groupLabel[value] },
    { title: "可填充槽位", dataIndex: "supportedSlotKeys", render: (keys: TimeframeSlotKey[]) => keys.map((key) => <Tag key={key}>{slotLabels[key]}</Tag>) },
  ];

  return (
    <Card title="信号条件库" extra={<Button type="primary" onClick={addSignalDefinition}>新增模拟信号</Button>}>
      <Space direction="vertical" size={16} className="page-stack">
        <Alert type="info" showIcon message="信号条件独立管理，策略组装时再填入不同周期槽位。" />
        <Segmented
          value={filter}
          onChange={(value) => setFilter(value as typeof filter)}
          options={[
            { label: "全部", value: "all" },
            { label: "指标", value: "indicator" },
            { label: "结构", value: "structure" },
            { label: "资金流", value: "money_flow" },
            { label: "风险", value: "risk" },
          ]}
        />
        <Table rowKey="id" columns={columns} dataSource={visible} pagination={false} scroll={{ x: 900 }} />
      </Space>
    </Card>
  );
}

const emptySlotTimes = (): Record<TimeframeSlotKey, string> => ({
  direction_tf: "1d",
  structure_tf: "4h",
  trigger_tf: "1h",
});

function SlotTemplatesPage() {
  const { timeframeSlotTemplates, signalLibrary, addTimeframeSlotTemplate } = useAppStore();

  return (
    <Card title="周期槽位模板" extra={<Button type="primary" onClick={addTimeframeSlotTemplate}>新增模拟槽位</Button>}>
      <Row gutter={[16, 16]}>
        {timeframeSlotTemplates.map((template) => (
          <Col xs={24} xl={12} key={template.id}>
            <Card type="inner" title={template.id === "slot-dual-trend" ? "双周期趋势模板" : "三周期趋势模板"} extra={<Tag color="blue">{template.slots.length} 个槽位</Tag>}>
              <Paragraph type="secondary">
                {template.id === "slot-dual-trend"
                  ? "方向周期确认趋势，触发周期等待入场条件。适合双均线趋势策略。"
                  : "大周期定方向，中周期过滤结构，小周期触发提醒。适合多周期趋势监控。"}
              </Paragraph>
              <List
                dataSource={template.slots}
                renderItem={(slot) => (
                  <List.Item>
                    <List.Item.Meta
                      title={<Space><Tag>{slotLabels[slot.key]}</Tag><Text>{slot.timeframe}</Text></Space>}
                      description={
                        <Space direction="vertical" size={4}>
                          <Text type="secondary">{slot.key === "direction_tf" ? "判断是否允许做多或做空" : slot.key === "structure_tf" ? "过滤震荡末期或蓄势结构" : "等待具体入场提醒"}</Text>
                          <Text type="secondary">默认信号：{(template.defaultSignalIdsBySlot[slot.key] ?? []).map((id) => signalName(signalLibrary, id)).join("、") || "未填充"}</Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
              <Divider />
              <Space wrap>
                {template.riskSignalIds.map((id) => <Tag color="red" key={id}>{signalName(signalLibrary, id)}</Tag>)}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
}

function StrategyBuilder() {
  const { timeframeSlotTemplates, signalLibrary, symbols, createStrategyInstance } = useAppStore();
  const [slotTemplateId, setSlotTemplateId] = useState(timeframeSlotTemplates[0].id);
  const [slotTimes, setSlotTimes] = useState<Record<TimeframeSlotKey, string>>(emptySlotTimes());
  const [signalIdsBySlot, setSignalIdsBySlot] = useState<Partial<Record<TimeframeSlotKey, string[]>>>({});
  const [riskSignalIds, setRiskSignalIds] = useState<string[]>([]);
  const [selectedSymbols, setSelectedSymbols] = useState(["BTCUSDT", "ETHUSDT"]);
  const [strategyName, setStrategyName] = useState("三周期趋势监控");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const activeTemplate = timeframeSlotTemplates.find((template) => template.id === slotTemplateId) ?? timeframeSlotTemplates[0];

  useEffect(() => {
    const nextTimes = emptySlotTimes();
    activeTemplate.slots.forEach((slot) => {
      nextTimes[slot.key] = slot.timeframe;
    });
    setSlotTimes(nextTimes);
    setSignalIdsBySlot(activeTemplate.defaultSignalIdsBySlot);
    setRiskSignalIds(activeTemplate.riskSignalIds);
    setStrategyName(slotTemplateId === "slot-dual-trend" ? "双周期趋势监控" : "三周期趋势监控");
  }, [activeTemplate]);

  const toggleSlotSignal = (slotKey: TimeframeSlotKey, values: string[]) => {
    setSignalIdsBySlot({ ...signalIdsBySlot, [slotKey]: values });
  };

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Alert type="info" showIcon message="策略 = 周期槽位模板 + 槽位内信号填充 + 币种挂载 + 全局风控信号。" />
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card title="槽位填充">
            <Form layout="vertical">
              <Form.Item label="周期槽位模板">
                <Select
                  value={slotTemplateId}
                  onChange={setSlotTemplateId}
                  options={timeframeSlotTemplates.map((template) => ({
                    label: template.id === "slot-dual-trend" ? "双周期趋势模板" : "三周期趋势模板",
                    value: template.id,
                  }))}
                />
              </Form.Item>
              <Form.Item label="策略名称">
                <Input value={strategyName} onChange={(event) => setStrategyName(event.target.value)} placeholder="例如：BTC 主升浪三周期监控" />
              </Form.Item>
              <Row gutter={[16, 16]}>
                {activeTemplate.slots.map((slot) => {
                  const availableSignals = signalLibrary.filter((signal) => signal.supportedSlotKeys.includes(slot.key));
                  return (
                    <Col xs={24} lg={8} key={slot.key}>
                      <Card
                        type="inner"
                        title={slotLabels[slot.key]}
                        extra={<Select className="tf-select" value={slotTimes[slot.key]} onChange={(value) => setSlotTimes({ ...slotTimes, [slot.key]: value })} options={timeframeOptions.map((value) => ({ label: value, value }))} />}
                      >
                        <Paragraph type="secondary">{slot.key === "direction_tf" ? "定义交易方向和趋势背景" : slot.key === "structure_tf" ? "过滤震荡、蓄势和假突破" : "触发提醒和推送"}</Paragraph>
                        <Checkbox.Group
                          className="vertical-checkbox"
                          value={signalIdsBySlot[slot.key] ?? []}
                          onChange={(values) => toggleSlotSignal(slot.key, values as string[])}
                          options={availableSignals.map((signal) => ({ label: `${signalName(signalLibrary, signal.id)} / ${categoryLabel[signal.category]}`, value: signal.id }))}
                        />
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </Form>
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="挂载与风控">
            <Form layout="vertical">
              <Form.Item label="挂载币种">
                <Checkbox.Group
                  className="vertical-checkbox"
                  value={selectedSymbols}
                  onChange={(values) => setSelectedSymbols(values as string[])}
                  options={symbols.map((symbol) => ({ label: symbol.symbol, value: symbol.symbol }))}
                />
              </Form.Item>
              <Form.Item label="全局确认 / 风控信号">
                <Checkbox.Group
                  className="vertical-checkbox"
                  value={riskSignalIds}
                  onChange={(values) => setRiskSignalIds(values as string[])}
                  options={signalLibrary
                    .filter((signal) => signal.category === "risk" || signal.defaultGroup === "invalidate" || signal.category === "money_flow")
                    .map((signal) => ({ label: signalName(signalLibrary, signal.id), value: signal.id }))}
                />
              </Form.Item>
              <Button
                type="primary"
                block
                onClick={() => {
                  const id = createStrategyInstance({
                    slotTemplateId,
                    templateId: slotTemplateId,
                    name: strategyName.trim() || (slotTemplateId === "slot-dual-trend" ? "双周期趋势监控" : "三周期趋势监控"),
                    symbols: selectedSymbols,
                    slots: slotTimes,
                    signalIdsBySlot,
                    riskSignalIds,
                  });
                  setCreatedId(id);
                }}
              >
                生成模拟策略
              </Button>
              {createdId && <Alert className="mt-12" type="success" showIcon message={`已生成策略实例：${createdId}`} />}
            </Form>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

function MonitorCenter() {
  const { strategyInstances, strategyStates, symbols, moneyFlows, signals, triggerMockSignal, selectSignal } = useAppStore();
  const [strategyFilter, setStrategyFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState<"all" | StrategyState["state"]>("all");

  const rows = useMemo(() => {
    return strategyStates
      .map((state) => {
        const instance = strategyInstances.find((item) => item.id === state.instanceId);
        const market = symbols.find((item) => item.symbol === state.symbol);
        const flow = moneyFlows.find((item) => item.symbol === state.symbol);
        const relatedSignals = signals.filter((signal) => signal.instanceId === state.instanceId && signal.symbol === state.symbol);

        return {
          key: `${state.instanceId}-${state.symbol}`,
          instanceId: state.instanceId,
          strategyName: strategyDisplayName(instance),
          slotTemplateId: instance?.slotTemplateId ?? "slot-triple-trend",
          symbol: state.symbol,
          state: state.state,
          lastUpdated: state.lastUpdated,
          nextWaitingFor: state.nextWaitingFor,
          price: market?.price ?? 0,
          change24h: market?.change24h ?? 0,
          volume: market?.volume ?? "-",
          marketStatus: market?.status ?? "normal",
          fundingRate: flow?.fundingRate ?? 0,
          oiChange: flow?.oiChange ?? 0,
          takerBuyRatio: flow?.takerBuyRatio ?? 0,
          netFlow: flow?.netFlow ?? 0,
          signalCount: relatedSignals.length,
          strongSignalCount: relatedSignals.filter((signal) => signal.strength === "strong").length,
        };
      })
      .filter((row) => strategyFilter === "all" || row.instanceId === strategyFilter)
      .filter((row) => stateFilter === "all" || row.state === stateFilter);
  }, [moneyFlows, signals, stateFilter, strategyFilter, strategyInstances, strategyStates, symbols]);

  const activeCount = rows.filter((row) => row.state === "watching" || row.state === "waiting_trigger" || row.state === "triggered").length;
  const triggeredCount = rows.filter((row) => row.state === "triggered").length;
  const waitingCount = rows.filter((row) => row.state === "waiting_trigger").length;

  const columns: ColumnsType<(typeof rows)[number]> = [
    {
      title: "策略 / 币种",
      fixed: "left",
      width: 220,
      render: (_, row) => (
        <Space direction="vertical" size={2}>
          <Text strong>{row.symbol}</Text>
          <Text type="secondary" className="monitor-stat-subtitle">{row.strategyName}</Text>
        </Space>
      ),
    },
    {
      title: "监控状态",
      dataIndex: "state",
      width: 120,
      render: (value: StrategyState["state"]) => <Badge status={stateMeta[value].badge} text={stateMeta[value].label} />,
    },
    { title: "价格", dataIndex: "price", align: "right", render: (value: number) => formatPrice(value) },
    {
      title: "24h",
      dataIndex: "change24h",
      align: "right",
      render: (value: number) => <Text type={value >= 0 ? "success" : "danger"}>{value}%</Text>,
    },
    { title: "成交量", dataIndex: "volume", align: "right" },
    {
      title: "资金流",
      dataIndex: "netFlow",
      align: "right",
      render: (value: number) => <Text type={value >= 0 ? "success" : "danger"}>{value}M</Text>,
    },
    {
      title: "OI",
      dataIndex: "oiChange",
      align: "right",
      render: (value: number) => <Text type={value >= 0 ? "success" : "danger"}>{value}%</Text>,
    },
    { title: "主动买入", dataIndex: "takerBuyRatio", align: "right", render: (value: number) => `${value}%` },
    {
      title: "信号",
      width: 120,
      render: (_, row) => <Space><Tag>{row.signalCount}</Tag><Tag color="green">{row.strongSignalCount} 强</Tag></Space>,
    },
    { title: "下一步等待", dataIndex: "nextWaitingFor", width: 280 },
    { title: "更新", dataIndex: "lastUpdated", width: 110 },
    {
      title: "操作",
      fixed: "right",
      width: 130,
      render: (_, row) => (
        <Button
          type="primary"
          disabled={row.state === "triggered" || row.state === "invalidated" || row.state === "cooldown"}
          onClick={() => {
            const id = triggerMockSignal(row.instanceId, row.symbol);
            if (!id) {
              notification.error({
                message: "触发失败",
                description: "该币种不在监控队列中，无法触发。",
                placement: "bottomRight",
              });
              return;
            }
            notification.success({
              message: `${row.symbol} 触发强信号`,
              description: "已写入信号中心和复盘中心，点击查看信号详情。",
              placement: "bottomRight",
              duration: 8,
              onClick: () => selectSignal(id),
            });
          }}
        >
          模拟触发
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}><Card><Statistic title="挂载监控币种" value={rows.length} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="活跃监控" value={activeCount} valueStyle={{ color: "#1677ff" }} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="等待触发" value={waitingCount} valueStyle={{ color: "#faad14" }} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="已触发" value={triggeredCount} valueStyle={{ color: "#52c41a" }} /></Card></Col>
      </Row>

      <Card>
        <Flex justify="space-between" align="center" gap={16} wrap>
          <Space direction="vertical" size={4}>
            <Title level={4} className="page-title">监控中心</Title>
            <Text type="secondary">按策略实例查看每个挂载币种的市场表现、资金流和状态机位置。</Text>
          </Space>
          <Space wrap>
            <Select
              value={strategyFilter}
              onChange={setStrategyFilter}
              className="monitor-filter-select"
              options={[
                { label: "全部策略", value: "all" },
                ...strategyInstances.map((instance) => ({ label: strategyDisplayName(instance), value: instance.id })),
              ]}
            />
            <Select
              value={stateFilter}
              onChange={(value) => setStateFilter(value as typeof stateFilter)}
              className="monitor-filter-select"
              options={[
                { label: "全部状态", value: "all" },
                ...Object.entries(stateMeta).map(([value, meta]) => ({ label: meta.label, value })),
              ]}
            />
          </Space>
        </Flex>
      </Card>

      <Card title="策略币种监控明细">
        <Table rowKey="key" columns={columns} dataSource={rows} pagination={false} scroll={{ x: 1460 }} />
      </Card>
    </Space>
  );
}

function StrategyMonitorCenter() {
  const {
    strategyInstances,
    strategyStates,
    strategyEvaluations,
    symbols,
    moneyFlows,
    signals,
    strategyPersistenceStatus,
    evaluateStrategyMonitors,
    refreshPersistedStrategyData,
    runStrategyWorkerOnceAndPersist,
    triggerMockSignal,
    selectSignal,
  } = useAppStore();
  const [selectedInstanceId, setSelectedInstanceId] = useState(strategyInstances[0]?.id ?? "");
  const [stateFilter, setStateFilter] = useState<"all" | StrategyState["state"]>("all");
  const activeInstanceId = selectedInstanceId || strategyInstances[0]?.id || "";
  const activeInstance = strategyInstances.find((instance) => instance.id === activeInstanceId);

  const strategySummaries = strategyInstances.map((instance) => {
    const states = strategyStates.filter((state) => state.instanceId === instance.id);
    return {
      instance,
      total: states.length,
      watching: states.filter((state) => state.state === "watching").length,
      waiting: states.filter((state) => state.state === "waiting_trigger").length,
      triggered: states.filter((state) => state.state === "triggered").length,
      invalidated: states.filter((state) => state.state === "invalidated").length,
      cooldown: states.filter((state) => state.state === "cooldown").length,
      signals: signals.filter((signal) => signal.instanceId === instance.id).length,
    };
  });

  const rows = strategyStates
    .filter((state) => state.instanceId === activeInstanceId)
    .filter((state) => stateFilter === "all" || state.state === stateFilter)
    .map((state) => {
      const market = symbols.find((item) => item.symbol === state.symbol);
      const flow = moneyFlows.find((item) => item.symbol === state.symbol);
      const relatedSignals = signals.filter((signal) => signal.instanceId === state.instanceId && signal.symbol === state.symbol);
      const evaluation = strategyEvaluations.find((item) => item.instanceId === state.instanceId && item.symbol === state.symbol);

      return {
        key: `${state.instanceId}-${state.symbol}`,
        instanceId: state.instanceId,
        symbol: state.symbol,
        state: state.state,
        lastUpdated: state.lastUpdated,
        nextWaitingFor: state.nextWaitingFor,
        price: market?.price ?? 0,
        change24h: market?.change24h ?? 0,
        volume: market?.volume ?? "-",
        netFlow: flow?.netFlow ?? 0,
        oiChange: flow?.oiChange ?? 0,
        takerBuyRatio: flow?.takerBuyRatio ?? 0,
        signalCount: relatedSignals.length,
        strongSignalCount: relatedSignals.filter((signal) => signal.strength === "strong").length,
        evaluation,
      };
    });

  const activeSummary = strategySummaries.find((item) => item.instance.id === activeInstanceId);

  const columns: ColumnsType<(typeof rows)[number]> = [
    {
      title: "币种",
      fixed: "left",
      width: 140,
      render: (_, row) => (
        <Space direction="vertical" size={2}>
          <Text strong>{row.symbol}</Text>
          <Text type="secondary">{row.volume}</Text>
        </Space>
      ),
    },
    {
      title: "监控状态",
      dataIndex: "state",
      width: 120,
      render: (value: StrategyState["state"]) => <Badge status={stateMeta[value].badge} text={stateMeta[value].label} />,
    },
    { title: "价格", dataIndex: "price", align: "right", render: (value: number) => formatPrice(value) },
    {
      title: "24h",
      dataIndex: "change24h",
      align: "right",
      render: (value: number) => <Text type={value >= 0 ? "success" : "danger"}>{value}%</Text>,
    },
    {
      title: "资金流",
      dataIndex: "netFlow",
      align: "right",
      render: (value: number) => <Text type={value >= 0 ? "success" : "danger"}>{value}M</Text>,
    },
    {
      title: "OI",
      dataIndex: "oiChange",
      align: "right",
      render: (value: number) => <Text type={value >= 0 ? "success" : "danger"}>{value}%</Text>,
    },
    { title: "主动买入", dataIndex: "takerBuyRatio", align: "right", render: (value: number) => `${value}%` },
    {
      title: "信号",
      width: 120,
      render: (_, row) => <Space><Tag>{row.signalCount}</Tag><Tag color="green">{row.strongSignalCount} 强</Tag></Space>,
    },
    { title: "下一步等待", dataIndex: "nextWaitingFor", width: 280 },
    {
      title: "操作",
      fixed: "right",
      width: 130,
      render: (_, row) => (
        <Button
          type="primary"
          disabled={row.state === "triggered" || row.state === "invalidated" || row.state === "cooldown"}
          onClick={() => {
            const id = triggerMockSignal(row.instanceId, row.symbol);
            if (!id) {
              notification.error({ message: "触发失败", description: "该币种不在监控队列中，无法触发。", placement: "bottomRight" });
              return;
            }
            notification.success({
              message: `${row.symbol} 触发强信号`,
              description: "已写入信号中心和复盘中心，点击查看信号详情。",
              placement: "bottomRight",
              duration: 8,
              onClick: () => selectSignal(id),
            });
          }}
        >
          模拟触发
        </Button>
      ),
    },
  ];

  return (
    <Row gutter={[16, 16]} className="strategy-monitor-layout">
      <Col xs={24} xl={7}>
        <Card title="策略列表">
          <List
            dataSource={strategySummaries}
            renderItem={(summary) => {
              const active = summary.instance.id === activeInstanceId;
              return (
                <List.Item className={active ? "strategy-list-item active" : "strategy-list-item"} onClick={() => setSelectedInstanceId(summary.instance.id)}>
                  <Space direction="vertical" size={8} className="page-stack">
                    <Flex justify="space-between" align="center" gap={8}>
                      <Text strong>{strategyDisplayName(summary.instance)}</Text>
                      <Tag color={active ? "blue" : "default"}>{summary.total} 币种</Tag>
                    </Flex>
                    <Space wrap>
                      <Tag color="blue">监控 {summary.watching}</Tag>
                      <Tag color="gold">等待 {summary.waiting}</Tag>
                      <Tag color="green">触发 {summary.triggered}</Tag>
                      <Tag>信号 {summary.signals}</Tag>
                    </Space>
                  </Space>
                </List.Item>
              );
            }}
          />
        </Card>
      </Col>

      <Col xs={24} xl={17}>
        <Space direction="vertical" size={16} className="page-stack">
          <Card>
            <Flex justify="space-between" align="center" gap={16} wrap>
              <Space direction="vertical" size={4}>
                <Title level={4} className="page-title">{activeInstance ? strategyDisplayName(activeInstance) : "监控中心"}</Title>
                <Text type="secondary">查看当前策略下所有挂载币种的市场情况和状态机位置。</Text>
              </Space>
              <Space>
                <Button loading={strategyPersistenceStatus.loading} icon={<RefreshCw size={16} />} onClick={() => void refreshPersistedStrategyData()}>
                  同步后端持久化
                </Button>
                <Button type="primary" loading={strategyPersistenceStatus.loading} icon={<Cpu size={16} />} onClick={() => void runStrategyWorkerOnceAndPersist()}>
                  运行Worker并入库
                </Button>
                <Button onClick={() => void evaluateStrategyMonitors()}>重新计算策略</Button>
              </Space>
              <Select
                value={stateFilter}
                onChange={(value) => setStateFilter(value as typeof stateFilter)}
                className="monitor-filter-select"
                options={[
                  { label: "全部状态", value: "all" },
                  ...Object.entries(stateMeta).map(([value, meta]) => ({ label: meta.label, value })),
                ]}
              />
            </Flex>
          </Card>

          {strategyPersistenceStatus.error && (
            <Alert type="warning" showIcon message="后端持久化数据同步失败" description={strategyPersistenceStatus.error} />
          )}

          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}><Card><Statistic title="挂载币种" value={activeSummary?.total ?? 0} /></Card></Col>
            <Col xs={12} md={6}><Card><Statistic title="等待触发" value={activeSummary?.waiting ?? 0} valueStyle={{ color: "#faad14" }} /></Card></Col>
            <Col xs={12} md={6}><Card><Statistic title="已触发" value={activeSummary?.triggered ?? 0} valueStyle={{ color: "#52c41a" }} /></Card></Col>
            <Col xs={12} md={6}><Card><Statistic title="信号数" value={activeSummary?.signals ?? 0} /></Card></Col>
          </Row>

          <Card title="监控列表">
            <Table rowKey="key" columns={columns} dataSource={rows} pagination={false} scroll={{ x: 1240 }} />
          </Card>
        </Space>
      </Col>
    </Row>
  );
}

function StrategyRuntime() {
  const { strategyInstances, strategyStates, signalLibrary, timeframeSlotTemplates } = useAppStore();

  return (
    <Space direction="vertical" size={16} className="page-stack">
      {strategyInstances.map((instance) => {
        const template = timeframeSlotTemplates.find((item) => item.id === instance.slotTemplateId);
        const stateRows = strategyStates.filter((item) => item.instanceId === instance.id);
        const columns: ColumnsType<StrategyState> = [
          { title: "币种", dataIndex: "symbol" },
          { title: "状态", dataIndex: "state", render: (value: StrategyState["state"]) => <Tag color={stateMeta[value].color}>{stateMeta[value].label}</Tag> },
          { title: "下一步", dataIndex: "nextWaitingFor" },
          { title: "更新时间", dataIndex: "lastUpdated", width: 120 },
        ];
        return (
          <Card key={instance.id} title={instance.name.includes("inst") ? "模拟策略实例" : instance.name} extra={<Tag color="green">{instance.symbols.length} 个币种挂载</Tag>}>
            <Descriptions title={template?.id === "slot-dual-trend" ? "双周期趋势模板" : "三周期趋势模板"} column={{ xs: 1, md: 3 }} size="small">
              {template?.slots.map((slot) => (
                <Descriptions.Item key={slot.key} label={`${slotLabels[slot.key]} / ${instance.slots[slot.key]}`}>
                  {(instance.signalIdsBySlot[slot.key] ?? []).map((id) => signalName(signalLibrary, id)).join("、") || "未填充"}
                </Descriptions.Item>
              ))}
            </Descriptions>
            <Divider />
            <Table rowKey={(row) => `${row.instanceId}-${row.symbol}`} columns={columns} dataSource={stateRows} pagination={false} />
          </Card>
        );
      })}
    </Space>
  );
}

function StrategyBacktest() {
  const { strategyInstances, symbols, signalLibrary, mountSymbolToStrategy, saveBacktestSnapshot } = useAppStore();
  const [selectedStrategyId, setSelectedStrategyId] = useState(strategyInstances[0]?.id ?? "");
  const [selectedSymbol, setSelectedSymbol] = useState(symbols[0]?.symbol ?? "BTCUSDT");
  const [timeframeCombo, setTimeframeCombo] = useState("1d-4h-1h");
  const selectedStrategy = strategyInstances.find((instance) => instance.id === selectedStrategyId) ?? strategyInstances[0];
  const comparisonStrategy = selectedStrategy
    ? strategyInstances.find((instance) => instance.id !== selectedStrategy.id && instance.templateId === selectedStrategy.templateId && (instance.version ?? 1) > (selectedStrategy.version ?? 1))
      ?? strategyInstances.find((instance) => instance.id !== selectedStrategy.id && instance.slotTemplateId === selectedStrategy.slotTemplateId)
    : undefined;
  const result = selectedStrategy ? simulateBacktest(selectedStrategy, selectedSymbol, timeframeCombo) : undefined;
  const comparison = comparisonStrategy ? simulateBacktest(comparisonStrategy, selectedSymbol, timeframeCombo) : undefined;
  const decision = result ? decideBacktest(result) : undefined;
  const eventColumns: ColumnsType<BacktestEvent> = [
    { title: "时间", dataIndex: "time", width: 140 },
    { title: "币种", dataIndex: "symbol", width: 110 },
    { title: "结果", dataIndex: "status", width: 110, render: (value: ReviewStatus) => <Tag color={reviewStatusMeta[value].color}>{reviewStatusMeta[value].label}</Tag> },
    { title: "触发价", dataIndex: "triggerPrice", align: "right", width: 110, render: formatPrice },
    { title: "收益", dataIndex: "result", align: "right", width: 90, render: (value: number) => <Text type={value >= 0 ? "success" : "danger"}>{value}%</Text> },
    { title: "最大浮盈", dataIndex: "mfe", align: "right", width: 100, render: (value: number) => `${value}%` },
    { title: "最大回撤", dataIndex: "mae", align: "right", width: 100, render: (value: number) => <Text type="danger">{value}%</Text> },
    { title: "等待K数", dataIndex: "waitBars", width: 90 },
    { title: "周期状态", dataIndex: "timeframeState", width: 260 },
    { title: "资金流", dataIndex: "flowState", width: 130, render: (value: string) => <Tag color={value === "资金流通过" ? "green" : "gold"}>{value}</Tag> },
  ];

  if (!selectedStrategy || !result) {
    return <Alert type="warning" showIcon message="暂无策略可回测，请先在策略组装中创建策略。" />;
  }

  const comparisonRows = [
    { metric: "触发次数", current: result.triggerCount, next: comparison?.triggerCount, suffix: "" },
    { metric: "有效率", current: result.winRate, next: comparison?.winRate, suffix: "%" },
    { metric: "平均最大浮盈", current: result.avgMfe, next: comparison?.avgMfe, suffix: "%" },
    { metric: "平均最大回撤", current: result.avgMae, next: comparison?.avgMae, suffix: "%" },
    { metric: "资金流通过率", current: result.flowPassRate, next: comparison?.flowPassRate, suffix: "%" },
  ];
  const isComparisonBetter = (metric: string, current: number, next: number) => metric === "平均最大回撤" ? next >= current : next >= current;
  const saveSnapshot = () => {
    if (!selectedStrategy || !result || !decision) return;
    saveBacktestSnapshot({
      instanceId: selectedStrategy.id,
      strategyVersion: selectedStrategy.version ?? 1,
      symbol: selectedSymbol,
      timeframeCombo,
      triggerCount: result.triggerCount,
      winRate: result.winRate,
      avgMfe: result.avgMfe,
      avgMae: result.avgMae,
      flowPassRate: result.flowPassRate,
      decision: decision.decision,
      conclusion: decision.conclusion,
    });
    notification.success({ message: "回测快照已保存", description: "策略列表会显示最近一次回测摘要。" });
  };
  const mountFromBacktest = () => {
    if (!selectedStrategy) return;
    const status = mountSymbolToStrategy(selectedStrategy.id, selectedSymbol);
    if (status === "added") notification.success({ message: "已加入监控队列", description: `${selectedSymbol} 已挂载到 ${strategyDisplayName(selectedStrategy)}` });
    if (status === "exists") notification.info({ message: "已在监控中", description: "该策略和币种已经存在监控队列。" });
    if (status === "missing") notification.error({ message: "策略不存在", description: "请重新选择策略后再加入监控。" });
  };

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Card>
        <Flex justify="space-between" align="center" wrap gap={12}>
          <Space direction="vertical" size={2}>
            <Title level={5}>策略回测 / 模拟运行</Title>
            <Text type="secondary">用前端模拟数据验证策略调整方向，真实回测引擎后续由后端替换。</Text>
          </Space>
          <Space wrap>
            <Select
              className="monitor-filter-select"
              value={selectedStrategy.id}
              onChange={setSelectedStrategyId}
              options={strategyInstances.map((instance) => ({ label: `${strategyDisplayName(instance)} / v${instance.version ?? 1}`, value: instance.id }))}
            />
            <Select
              className="monitor-filter-select"
              value={selectedSymbol}
              onChange={setSelectedSymbol}
              options={symbols.map((item) => ({ label: item.symbol, value: item.symbol }))}
            />
            <Segmented
              value={timeframeCombo}
              onChange={(value) => setTimeframeCombo(String(value))}
              options={[
                { label: "1d-4h-1h", value: "1d-4h-1h" },
                { label: "4h-1h-15m", value: "4h-1h-15m" },
                { label: "1d-4h-15m", value: "1d-4h-15m" },
              ]}
            />
          </Space>
        </Flex>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8} xl={4}><Card><Statistic title="触发次数" value={result.triggerCount} /></Card></Col>
        <Col xs={24} md={8} xl={4}><Card><Statistic title="有效信号" value={result.validCount} valueStyle={{ color: "#52c41a" }} /></Card></Col>
        <Col xs={24} md={8} xl={4}><Card><Statistic title="无效信号" value={result.invalidCount} valueStyle={{ color: "#ff4d4f" }} /></Card></Col>
        <Col xs={24} md={8} xl={4}><Card><Statistic title="胜率" value={result.winRate} suffix="%" /></Card></Col>
        <Col xs={24} md={8} xl={4}><Card><Statistic title="平均浮盈" value={result.avgMfe} suffix="%" /></Card></Col>
        <Col xs={24} md={8} xl={4}><Card><Statistic title="平均回撤" value={result.avgMae} suffix="%" valueStyle={{ color: "#ff4d4f" }} /></Card></Col>
      </Row>

      {decision && (
        <Card
          title="回测结论"
          extra={<Tag color={backtestDecisionMeta[decision.decision].color}>{backtestDecisionMeta[decision.decision].label}</Tag>}
        >
          <Flex justify="space-between" align="center" wrap gap={16}>
            <Space direction="vertical" size={8}>
              <Title level={5} className="page-title">{decision.conclusion}</Title>
              <Space direction="vertical" size={4}>
                {decision.reasons.map((reason) => <Text type="secondary" key={reason}>{reason}</Text>)}
              </Space>
            </Space>
            <Space wrap>
              <Button onClick={saveSnapshot}>保存回测快照</Button>
              <Button type="primary" disabled={decision.decision === "reject"} onClick={mountFromBacktest}>加入监控队列</Button>
            </Space>
          </Flex>
        </Card>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={15}>
          <Card title="模拟信号回放" extra={<Tag color="blue">平均等待 {result.avgWaitBars} 根K线</Tag>}>
            <Table rowKey="id" columns={eventColumns} dataSource={result.events} pagination={false} scroll={{ x: 1280 }} />
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <Space direction="vertical" size={16} className="page-stack">
            <Card title="策略条件快照">
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="策略">{strategyDisplayName(selectedStrategy)}</Descriptions.Item>
                <Descriptions.Item label="版本">v{selectedStrategy.version ?? 1}</Descriptions.Item>
                <Descriptions.Item label="周期组合">{timeframeCombo}</Descriptions.Item>
                <Descriptions.Item label="条件">{selectedStrategy.conditionIds.slice(0, 6).map((id) => signalName(signalLibrary, id)).join("、")}</Descriptions.Item>
              </Descriptions>
            </Card>
            <Card title="版本对比">
              <Table
                rowKey="metric"
                dataSource={comparisonRows}
                pagination={false}
                columns={[
                  { title: "指标", dataIndex: "metric" },
                  { title: `当前 v${selectedStrategy.version ?? 1}`, render: (_, row) => `${row.current}${row.suffix}` },
                  {
                    title: comparisonStrategy ? `对比 v${comparisonStrategy.version ?? 1}` : "对比版本",
                    render: (_, row) => row.next === undefined ? <Text type="secondary">暂无</Text> : (
                      <Text type={isComparisonBetter(row.metric, Number(row.current), Number(row.next)) ? "success" : "danger"}>{row.next}{row.suffix}</Text>
                    ),
                  },
                ]}
              />
            </Card>
          </Space>
        </Col>
      </Row>
    </Space>
  );
}

function SignalsCenter() {
  const { signals, selectSignal, strategyInstances } = useAppStore();
  const [filter, setFilter] = useState<"all" | Signal["strength"]>("all");
  const visible = filter === "all" ? signals : signals.filter((signal) => signal.strength === filter);
  const columns: ColumnsType<Signal> = [
    { title: "时间", dataIndex: "createdAt", width: 100 },
    { title: "币种", dataIndex: "symbol", width: 120 },
    { title: "强度", dataIndex: "strength", width: 110, render: (value: Signal["strength"]) => <Tag color={strengthMeta[value].color}>{strengthMeta[value].label}</Tag> },
    { title: "方向", dataIndex: "direction", width: 100, render: (value: Signal["direction"]) => directionLabel[value] },
    { title: "触发原因", render: () => "周期槽位命中，等待人工或系统复盘确认" },
    { title: "推送", dataIndex: "pushStatus", width: 100 },
  ];

  return (
    <Card
      title="信号中心"
      extra={
        <Segmented
          value={filter}
          onChange={(value) => setFilter(value as typeof filter)}
          options={[
            { label: "全部", value: "all" },
            { label: "强信号", value: "strong" },
            { label: "弱信号", value: "weak" },
            { label: "观察", value: "watch" },
          ]}
        />
      }
    >
      <Table rowKey="id" columns={columns} dataSource={visible} pagination={false} onRow={(record) => ({ onClick: () => selectSignal(record.id) })} scroll={{ x: 900 }} />
    </Card>
  );
}

function AlertRulesCenter() {
  const { alertRules, pushChannels, updateAlertRule, addAlertRule } = useAppStore();
  const channelOptions = pushChannels.map((channel) => ({ label: channel.name, value: channel.id }));
  const columns: ColumnsType<AlertRule> = [
    {
      title: "规则",
      fixed: "left",
      width: 230,
      render: (_, row) => (
        <Space direction="vertical" size={2}>
          <Text strong>{row.name}</Text>
          <Text type="secondary">{row.id}</Text>
        </Space>
      ),
    },
    {
      title: "启用",
      width: 90,
      render: (_, row) => <Checkbox checked={row.enabled} onChange={(event) => updateAlertRule(row.id, { enabled: event.target.checked })} />,
    },
    {
      title: "最低信号",
      width: 140,
      render: (_, row) => (
        <Select
          value={row.minStrength}
          onChange={(value) => updateAlertRule(row.id, { minStrength: value })}
          options={[
            { label: "强信号", value: "strong" },
            { label: "弱信号", value: "weak" },
            { label: "观察", value: "watch" },
          ]}
        />
      ),
    },
    {
      title: "回测要求",
      width: 170,
      render: (_, row) => (
        <Select
          value={row.requireBacktestDecision ?? "none"}
          onChange={(value) => updateAlertRule(row.id, { requireBacktestDecision: value === "none" ? undefined : value as BacktestDecision })}
          options={[
            { label: "不要求", value: "none" },
            { label: "建议挂载", value: "mount" },
            { label: "继续观察", value: "observe" },
            { label: "不建议上线", value: "reject" },
          ]}
        />
      ),
    },
    {
      title: "资金流通过率",
      width: 140,
      render: (_, row) => (
        <Select
          value={row.minFlowPassRate}
          onChange={(value) => updateAlertRule(row.id, { minFlowPassRate: value })}
          options={[0, 50, 60, 65, 75, 85].map((value) => ({ label: `${value}%`, value }))}
        />
      ),
    },
    {
      title: "提醒动作",
      width: 150,
      render: (_, row) => (
        <Select
          value={row.action}
          onChange={(value) => updateAlertRule(row.id, { action: value })}
          options={Object.entries(alertActionMeta).map(([value, meta]) => ({ label: meta.label, value }))}
        />
      ),
    },
    {
      title: "推送通道",
      render: (_, row) => (
        <Select
          mode="multiple"
          value={row.channels}
          onChange={(value) => updateAlertRule(row.id, { channels: value })}
          options={channelOptions}
        />
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}><Card><Statistic title="告警规则" value={alertRules.length} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="启用规则" value={alertRules.filter((rule) => rule.enabled).length} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="升级提醒" value={alertRules.filter((rule) => rule.action === "escalate").length} /></Card></Col>
      </Row>
      <Card title="告警规则中心" extra={<Button type="primary" onClick={addAlertRule}>新增模拟规则</Button>}>
        <Alert type="info" showIcon message="用于控制右下角弹窗、静默入队和升级推送；当前为前端模拟配置。" className="mb-12" />
        <Table rowKey="id" columns={columns} dataSource={alertRules} pagination={false} scroll={{ x: 1180 }} />
      </Card>
    </Space>
  );
}

function PushSettingsPrototype() {
  const { pushChannels, updatePushChannel } = useAppStore();
  const columns: ColumnsType<PushChannelConfig> = [
    {
      title: "通道",
      fixed: "left",
      width: 190,
      render: (_, row) => (
        <Space direction="vertical" size={2}>
          <Text strong>{row.name}</Text>
          <Tag>{channelTypeMeta[row.type]}</Tag>
        </Space>
      ),
    },
    {
      title: "启用",
      width: 90,
      render: (_, row) => <Checkbox checked={row.enabled} onChange={(event) => updatePushChannel(row.id, { enabled: event.target.checked })} />,
    },
    {
      title: "目标",
      render: (_, row) => <Input value={row.target} onChange={(event) => updatePushChannel(row.id, { target: event.target.value })} />,
    },
    {
      title: "严重级别",
      width: 150,
      render: (_, row) => (
        <Select
          value={row.severity}
          onChange={(value) => updatePushChannel(row.id, { severity: value })}
          options={[
            { label: "全部", value: "all" },
            { label: "仅强信号", value: "strong_only" },
            { label: "人工确认", value: "manual" },
          ]}
        />
      ),
    },
    {
      title: "静默时间",
      width: 170,
      render: (_, row) => <Input value={row.quietHours} onChange={(event) => updatePushChannel(row.id, { quietHours: event.target.value })} />,
    },
    {
      title: "状态",
      width: 110,
      render: (_, row) => <Tag color={row.enabled ? "green" : "default"}>{row.enabled ? "可用" : "未启用"}</Tag>,
    },
  ];

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}><Card><Statistic title="推送通道" value={pushChannels.length} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="已启用" value={pushChannels.filter((channel) => channel.enabled).length} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="强提醒通道" value={pushChannels.filter((channel) => channel.severity === "strong_only").length} /></Card></Col>
      </Row>
      <Card title="真实推送配置原型">
        <Alert type="warning" showIcon message="这里只模拟配置项，不保存真实密钥；后端接入时 API Key 和机器人 Token 必须加密保存。" className="mb-12" />
        <Table rowKey="id" columns={columns} dataSource={pushChannels} pagination={false} scroll={{ x: 980 }} />
      </Card>
    </Space>
  );
}

function SignalReview({ records }: { records: ReviewRecord[] }) {
  const { selectSignal, updateSignalReview } = useAppStore();
  const [editingRecord, setEditingRecord] = useState<ReviewRecord | null>(null);
  const [draftStatus, setDraftStatus] = useState<ReviewStatus>("pending");
  const [draftNote, setDraftNote] = useState("");
  const [draftErrorTypes, setDraftErrorTypes] = useState<ReviewErrorType[]>([]);
  const [draftTraded, setDraftTraded] = useState(false);
  const [draftExecutionScore, setDraftExecutionScore] = useState(0);

  const openReviewEditor = (record: ReviewRecord) => {
    setEditingRecord(record);
    setDraftStatus(record.status);
    setDraftNote(record.reviewNote ?? "");
    setDraftErrorTypes(record.errorTypes);
    setDraftTraded(record.traded);
    setDraftExecutionScore(record.executionScore);
  };

  const saveReview = () => {
    if (!editingRecord) return;
    updateSignalReview({
      signalId: editingRecord.signalId,
      status: draftStatus,
      note: draftNote || "已完成复盘，等待后续统计样本积累。",
      errorTypes: draftErrorTypes,
      traded: draftTraded,
      executionScore: draftTraded ? draftExecutionScore : 0,
      reviewedAt: "刚刚",
    });
    notification.success({ message: "复盘已保存", description: `${editingRecord.symbol} 已更新为${reviewStatusMeta[draftStatus].label}` });
    setEditingRecord(null);
  };

  const columns: ColumnsType<ReviewRecord> = [
    {
      title: "信号",
      render: (_, row) => (
        <Space direction="vertical" size={2}>
          <Space><Text strong>{row.symbol}</Text><Tag color={strengthMeta[row.strength].color}>{strengthMeta[row.strength].label}</Tag></Space>
          <Text type="secondary">{row.strategyName} / v{row.strategyVersion}</Text>
        </Space>
      ),
    },
    { title: "复盘结论", dataIndex: "status", render: (value: ReviewStatus) => <Tag color={reviewStatusMeta[value].color}>{reviewStatusMeta[value].label}</Tag> },
    { title: "持仓/执行周期", render: (_, row) => `${row.holdingTimeframe} / ${row.executionTimeframe}` },
    { title: "24h 表现", dataIndex: "result24h", align: "right", render: (value: number) => <Text type={value >= 0 ? "success" : "danger"}>{value}%</Text> },
    { title: "最大浮盈", dataIndex: "mfe", align: "right", render: (value: number) => `${value}%` },
    { title: "最大浮亏", dataIndex: "mae", align: "right", render: (value: number) => <Text type="danger">{value}%</Text> },
    { title: "标签", dataIndex: "tags", render: (tags: string[]) => tags.map((tag) => <Tag key={tag}>{tag}</Tag>) },
    {
      title: "操作",
      fixed: "right",
      width: 90,
      render: (_, row) => (
        <Button
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            openReviewEditor(row);
          }}
        >
          复盘
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Alert type="info" showIcon message="第一版复盘以信号质量为主，同时保留轻量交易执行评分。" />
      <Table rowKey="id" columns={columns} dataSource={records} pagination={false} scroll={{ x: 1120 }} onRow={(record) => ({ onClick: () => selectSignal(record.signalId) })} />
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={15}>
          <Card title="信号回放">
            <MiniKline data={mockMarketSeries.BTCUSDT} markerLabel="复盘信号" />
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <Card title="当前复盘样例">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="复盘对象">{records[0] ? `${records[0].symbol} / ${records[0].strategyName} v${records[0].strategyVersion}` : "-"}</Descriptions.Item>
              <Descriptions.Item label="信号结论">{records[0] ? <Tag color={reviewStatusMeta[records[0].status].color}>{reviewStatusMeta[records[0].status].label}</Tag> : "-"}</Descriptions.Item>
              <Descriptions.Item label="核心原因">{records[0]?.reason ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="人工动作">已交易，入场略晚，需要优化触发后等待规则。</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
      <Drawer
        title="编辑复盘结论"
        open={Boolean(editingRecord)}
        onClose={() => setEditingRecord(null)}
        width={560}
        extra={<Button type="primary" onClick={saveReview}>保存复盘</Button>}
      >
        {editingRecord && (
          <Space direction="vertical" size={16} className="page-stack">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="复盘对象">{editingRecord.symbol}</Descriptions.Item>
              <Descriptions.Item label="策略版本">{editingRecord.strategyName} / v{editingRecord.strategyVersion}</Descriptions.Item>
              <Descriptions.Item label="触发原因">{editingRecord.reason}</Descriptions.Item>
              <Descriptions.Item label="上次复盘">{editingRecord.reviewedAt ?? "未复盘"}</Descriptions.Item>
            </Descriptions>
            <Card title="结论">
              <Space direction="vertical" size={14} className="page-stack">
                <Select
                  value={draftStatus}
                  onChange={(value) => setDraftStatus(value as ReviewStatus)}
                  options={Object.entries(reviewStatusMeta).map(([value, meta]) => ({ label: meta.label, value }))}
                />
                <Checkbox.Group
                  value={draftErrorTypes}
                  onChange={(values) => setDraftErrorTypes(values as ReviewErrorType[])}
                  options={Object.entries(reviewErrorMeta).map(([value, label]) => ({ label, value }))}
                />
              </Space>
            </Card>
            <Card title="交易执行">
              <Space direction="vertical" size={14} className="page-stack">
                <Segmented
                  value={draftTraded ? "traded" : "not_traded"}
                  onChange={(value) => setDraftTraded(value === "traded")}
                  options={[
                    { label: "未交易", value: "not_traded" },
                    { label: "已交易", value: "traded" },
                  ]}
                />
                <Select
                  disabled={!draftTraded}
                  value={draftExecutionScore}
                  onChange={setDraftExecutionScore}
                  options={[0, 20, 40, 60, 80, 100].map((value) => ({ label: `${value} 分`, value }))}
                />
              </Space>
            </Card>
            <Card title="复盘备注">
              <Input.TextArea
                value={draftNote}
                onChange={(event) => setDraftNote(event.target.value)}
                rows={5}
                placeholder="记录为什么有效/无效、是否追高、周期是否选错、资金流是否背离。"
              />
            </Card>
          </Space>
        )}
      </Drawer>
    </Space>
  );
}

function TradeReview({ records }: { records: ReviewRecord[] }) {
  const traded = records.filter((item) => item.traded);
  const averageSignalScore = records.length ? Math.round(records.reduce((sum, item) => sum + item.signalScore, 0) / records.length) : 0;
  const averageExecutionScore = traded.length ? Math.round(traded.reduce((sum, item) => sum + item.executionScore, 0) / traded.length) : 0;
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={8}><Card><Statistic title="已参与交易" value={traded.length} suffix={`/ ${records.length}`} /></Card></Col>
      <Col xs={24} md={8}><Card><Statistic title="平均信号评分" value={averageSignalScore} /></Card></Col>
      <Col xs={24} md={8}><Card><Statistic title="平均执行评分" value={averageExecutionScore} /></Card></Col>
      <Col xs={24}>
        <Card title="交易执行复盘">
          <Table
            rowKey="id"
            dataSource={records}
            pagination={false}
            columns={[
              { title: "币种", dataIndex: "symbol" },
              { title: "是否参与", dataIndex: "traded", render: (value: boolean) => <Tag color={value ? "green" : "default"}>{value ? "已交易" : "未交易"}</Tag> },
              { title: "触发价", dataIndex: "triggerPrice", align: "right", render: formatPrice },
              { title: "当前价", dataIndex: "currentPrice", align: "right", render: formatPrice },
              { title: "信号评分", dataIndex: "signalScore", render: (value: number) => <Progress percent={value} size="small" /> },
              { title: "执行评分", dataIndex: "executionScore", render: (value: number) => (value ? <Progress percent={value} size="small" /> : <Text type="secondary">未交易</Text>) },
            ]}
            scroll={{ x: 900 }}
          />
        </Card>
      </Col>
    </Row>
  );
}

function TimeframeAttribution() {
  const { timeframeDecisions } = useAppStore();
  const active = timeframeDecisions[0];
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={14}>
        <Card title={`为什么选择 ${active.holdingTimeframe} 作为持仓周期`} extra={<Tag color="blue">{active.confidence}% 置信度</Tag>}>
          <Paragraph>{active.selectedReason}</Paragraph>
          <Row gutter={[16, 16]}>
            {active.candidates.map((candidate) => (
              <Col xs={24} md={8} key={candidate.timeframe}>
                <Card type="inner">
                  <Statistic title={candidate.role} value={candidate.timeframe} />
                  <Progress percent={candidate.score} size="small" />
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      </Col>
      <Col xs={24} xl={10}>
        <Card title="评分明细">
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={active.scoreBreakdown}>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#1677ff" fill="#1677ff" fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Col>
    </Row>
  );
}

function ConditionAttribution() {
  const data = [
    { name: "EMA 多头", value: 82 },
    { name: "结构收敛", value: 76 },
    { name: "EMA 金叉", value: 69 },
    { name: "OI 增长", value: 71 },
    { name: "资金费率", value: 58 },
  ];
  return (
    <Card title="条件归因">
      <Paragraph type="secondary">统计不同信号条件出现在有效信号里的比例，用于反推策略模板是否需要调整。</Paragraph>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" />
            <XAxis dataKey="name" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Bar dataKey="value" fill="#1677ff" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function ErrorLibrary({ records }: { records: ReviewRecord[] }) {
  const fallbackErrors: Array<{ type: ReviewErrorType; count: number; strategies: string[]; symbols: string[]; examples: string[]; category: string }> = [
    { type: "chasing_entry", count: 1, strategies: ["双周期双均线趋势"], symbols: ["ETHUSDT"], examples: ["信号触发后没有等待回踩，导致止损距离变大。"], category: "执行问题" },
    { type: "flow_divergence", count: 1, strategies: ["三周期趋势突破"], symbols: ["SOLUSDT"], examples: ["价格突破但 OI 和主动买入没有同步增强。"], category: "信号质量" },
    { type: "timeframe_mismatch", count: 1, strategies: ["三周期趋势突破"], symbols: ["BTCUSDT"], examples: ["小周期金叉有效，但大周期仍处于震荡区间。"], category: "周期归因" },
  ];
  const errorRows = Object.values(records.reduce<Record<string, { type: ReviewErrorType; count: number; strategies: Set<string>; symbols: Set<string>; examples: string[]; category: string }>>((acc, record) => {
    record.errorTypes.forEach((type) => {
      acc[type] ??= { type, count: 0, strategies: new Set(), symbols: new Set(), examples: [], category: type === "chasing_entry" ? "执行问题" : type === "timeframe_mismatch" ? "周期归因" : type === "flow_divergence" ? "信号质量" : "策略规则" };
      acc[type].count += 1;
      acc[type].strategies.add(`${record.strategyName} v${record.strategyVersion}`);
      acc[type].symbols.add(record.symbol);
      if (record.reviewNote) acc[type].examples.push(record.reviewNote);
      else acc[type].examples.push(record.reason);
    });
    return acc;
  }, {})).map((row) => ({
    ...row,
    strategies: Array.from(row.strategies),
    symbols: Array.from(row.symbols),
    examples: row.examples.slice(0, 2),
  }));
  const rows = errorRows.length ? errorRows : fallbackErrors;

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}><Card><Statistic title="错误类型" value={rows.length} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="错误样本" value={rows.reduce((sum, row) => sum + row.count, 0)} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="涉及币种" value={new Set(rows.flatMap((row) => row.symbols)).size} /></Card></Col>
      </Row>
      <Card title="复盘错误库">
        <Table
          rowKey="type"
          dataSource={rows}
          pagination={false}
          columns={[
            { title: "错误类型", dataIndex: "type", width: 130, render: (value: ReviewErrorType) => <Tag color="red">{reviewErrorMeta[value]}</Tag> },
            { title: "次数", dataIndex: "count", width: 70 },
            { title: "分类", dataIndex: "category", width: 100, render: (value: string) => <Tag>{value}</Tag> },
            { title: "关联策略", dataIndex: "strategies", render: (items: string[]) => <Space wrap>{items.map((item) => <Tag key={item} color="blue">{item}</Tag>)}</Space> },
            { title: "关联币种", dataIndex: "symbols", width: 190, render: (items: string[]) => <Space wrap>{items.map((item) => <Tag key={item}>{item}</Tag>)}</Space> },
            { title: "样例", dataIndex: "examples", render: (items: string[]) => <Text type="secondary">{items[0]}</Text> },
          ]}
          scroll={{ x: 980 }}
        />
      </Card>
    </Space>
  );
}

function StrategyHealth({ records }: { records: ReviewRecord[] }) {
  const rows = Object.values(records.reduce<Record<string, { key: string; strategy: string; version: number; total: number; valid: number; invalid: number; pending: number; executionErrors: number; scoreSum: number }>>((acc, record) => {
    const key = `${record.instanceId}-v${record.strategyVersion}`;
    acc[key] ??= { key, strategy: record.strategyName, version: record.strategyVersion, total: 0, valid: 0, invalid: 0, pending: 0, executionErrors: 0, scoreSum: 0 };
    acc[key].total += 1;
    acc[key].scoreSum += record.signalScore;
    if (record.status === "valid") acc[key].valid += 1;
    if (record.status === "invalid") acc[key].invalid += 1;
    if (record.status === "pending") acc[key].pending += 1;
    if (record.status === "execution_error") acc[key].executionErrors += 1;
    return acc;
  }, {})).map((row) => {
    const validRate = row.valid / Math.max(row.total, 1);
    const invalidRate = row.invalid / Math.max(row.total, 1);
    const executionErrorRate = row.executionErrors / Math.max(row.total, 1);
    const pendingPenalty = row.pending / Math.max(row.total, 1);
    const healthScore = Math.max(0, Math.round(100 * validRate + row.scoreSum / Math.max(row.total, 1) * 0.25 - invalidRate * 35 - executionErrorRate * 20 - pendingPenalty * 10));
    const action = healthScore < 50 ? "暂停或降权" : healthScore < 70 ? "调整触发条件" : healthScore < 85 ? "继续观察" : "保持运行";
    return { ...row, validRate, invalidRate, executionErrorRate, healthScore, action };
  }).sort((a, b) => a.healthScore - b.healthScore);

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}><Card><Statistic title="策略版本" value={rows.length} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="低健康策略" value={rows.filter((row) => row.healthScore < 70).length} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="待复盘样本" value={rows.reduce((sum, row) => sum + row.pending, 0)} /></Card></Col>
      </Row>
      <Card title="策略健康度">
        <Table
          rowKey="key"
          dataSource={rows}
          pagination={false}
          columns={[
            { title: "策略", dataIndex: "strategy", fixed: "left", width: 220 },
            { title: "版本", dataIndex: "version", width: 80, render: (value: number) => <Tag color="blue">v{value}</Tag> },
            { title: "健康分", dataIndex: "healthScore", width: 160, render: (value: number) => <Progress percent={value} size="small" status={value < 50 ? "exception" : value < 70 ? "active" : "success"} /> },
            { title: "样本", dataIndex: "total", width: 70 },
            { title: "有效率", width: 90, render: (_, row) => `${Math.round(row.validRate * 100)}%` },
            { title: "无效率", width: 90, render: (_, row) => `${Math.round(row.invalidRate * 100)}%` },
            { title: "执行偏差率", width: 110, render: (_, row) => `${Math.round(row.executionErrorRate * 100)}%` },
            { title: "待复盘", dataIndex: "pending", width: 90 },
            { title: "建议动作", dataIndex: "action", width: 120, render: (value: string) => <Tag color={value === "暂停或降权" ? "red" : value === "调整触发条件" ? "gold" : "green"}>{value}</Tag> },
          ]}
          scroll={{ x: 980 }}
        />
      </Card>
    </Space>
  );
}

function RuleAdvice({ records }: { records: ReviewRecord[] }) {
  const { strategyInstances, createStrategyRevisionDraft } = useAppStore();
  const [draftAdvice, setDraftAdvice] = useState<{
    type: ReviewErrorType;
    count: number;
    title: string;
    advice: string;
    target: string;
  } | null>(null);
  const errorCount = records.reduce<Record<ReviewErrorType, number>>((acc, record) => {
    record.errorTypes.forEach((type) => {
      acc[type] = (acc[type] ?? 0) + 1;
    });
    return acc;
  }, {} as Record<ReviewErrorType, number>);
  const adviceMap: Record<ReviewErrorType, { title: string; advice: string; target: string }> = {
    chasing_entry: { title: "追高入场偏多", advice: "增加回踩入场条件，例如触发后等待价格回踩 EMA 或前高支撑再确认。", target: "执行规则" },
    timeframe_mismatch: { title: "周期误判偏多", advice: "提高大周期优先级，要求方向周期和结构周期都达标后才允许触发周期入场。", target: "周期槽位" },
    flow_divergence: { title: "资金流背离偏多", advice: "增加资金流确认权重，把 OI、主动买入占比、资金费率作为确认条件而不是展示信息。", target: "资金流条件" },
    early_signal: { title: "信号过早偏多", advice: "增加收盘确认或二次确认，避免盘中假突破直接触发。", target: "触发条件" },
    late_signal: { title: "信号过晚偏多", advice: "降低触发周期滞后指标权重，增加结构末期预警，让监控提前进入等待区。", target: "预警规则" },
    risk_rule_missed: { title: "风控遗漏偏多", advice: "把最大追价距离、冷却间隔、失效条件放入策略模板的强制校验。", target: "风控规则" },
  };
  const adviceRows = Object.entries(adviceMap)
    .map(([type, item]) => ({ type: type as ReviewErrorType, count: errorCount[type as ReviewErrorType] ?? 0, ...item }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
  const rows = adviceRows.length
    ? adviceRows
    : [
        { type: "flow_divergence" as ReviewErrorType, count: 1, ...adviceMap.flow_divergence },
        { type: "chasing_entry" as ReviewErrorType, count: 1, ...adviceMap.chasing_entry },
      ];
  const targetRecord = draftAdvice ? records.find((record) => record.errorTypes.includes(draftAdvice.type)) ?? records[0] : undefined;
  const targetStrategy = strategyInstances.find((instance) => instance.id === targetRecord?.instanceId);
  const conditionPatchByError: Record<ReviewErrorType, string[]> = {
    chasing_entry: ["pullback-confirm"],
    timeframe_mismatch: ["higher-tf-confirm"],
    flow_divergence: ["oi-rising", "taker-buy-dominant", "funding-not-hot"],
    early_signal: ["close-confirm"],
    late_signal: ["structure-squeeze-end"],
    risk_rule_missed: ["trend-invalid", "max-chase-distance"],
  };
  const changeList = draftAdvice
    ? [
        { type: "新增", content: draftAdvice.type === "chasing_entry" ? "触发后等待回踩 EMA 或前高支撑确认" : draftAdvice.advice },
        { type: "增强", content: draftAdvice.type === "flow_divergence" ? "资金流确认权重：OI、主动买入占比、资金费率必须同步确认" : "大周期与结构周期的过滤权重" },
        { type: "降低", content: draftAdvice.type === "timeframe_mismatch" ? "小周期单独金叉的触发权重" : "单一指标直接触发的优先级" },
      ]
    : [];
  const confirmCreateDraft = () => {
    if (!draftAdvice || !targetRecord) return;
    const draftId = createStrategyRevisionDraft(
      targetRecord.instanceId,
      `来自复盘规则建议：${draftAdvice.title}`,
      conditionPatchByError[draftAdvice.type],
    );
    if (draftId) {
      notification.success({ message: "策略草案已生成", description: "新版本已进入策略列表，默认暂停且未挂载币种。" });
      setDraftAdvice(null);
    }
  };

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Alert type="info" showIcon message="规则建议来自复盘错误类型聚合，当前仍是前端模拟算法，后续可替换为后端规则引擎。" />
      <Row gutter={[16, 16]}>
        {rows.slice(0, 3).map((row) => (
          <Col xs={24} lg={8} key={row.type}>
            <Card title={row.title} extra={<Tag color="red">{row.count} 次</Tag>}>
              <Space direction="vertical" size={8}>
                <Tag color="blue">{row.target}</Tag>
                <Paragraph>{row.advice}</Paragraph>
                <Button type="primary" onClick={() => setDraftAdvice(row)}>生成策略草案</Button>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
      <Card title="可学习规则清单">
        <Table
          rowKey="type"
          dataSource={rows}
          pagination={false}
          columns={[
            { title: "问题", dataIndex: "title", width: 180 },
            { title: "出现次数", dataIndex: "count", width: 90 },
            { title: "作用模块", dataIndex: "target", width: 120, render: (value: string) => <Tag color="blue">{value}</Tag> },
            { title: "建议规则", dataIndex: "advice" },
            { title: "操作", width: 120, render: (_, row) => <Button size="small" onClick={() => setDraftAdvice(row)}>生成草案</Button> },
          ]}
          scroll={{ x: 820 }}
        />
      </Card>
      <Drawer
        title="策略调整草案"
        open={Boolean(draftAdvice)}
        onClose={() => setDraftAdvice(null)}
        width={760}
        extra={<Button type="primary" onClick={confirmCreateDraft} disabled={!targetRecord}>确认生成新版本</Button>}
      >
        {draftAdvice && (
          <Space direction="vertical" size={16} className="page-stack">
            <Alert type="warning" showIcon message="草案不会覆盖原策略。确认后会生成一个禁用状态的新策略版本，需要手动启用和挂载币种。" />
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card title="当前策略版本">
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="策略">{targetStrategy ? strategyDisplayName(targetStrategy) : "-"}</Descriptions.Item>
                    <Descriptions.Item label="版本">v{targetStrategy?.version ?? targetRecord?.strategyVersion ?? "-"}</Descriptions.Item>
                    <Descriptions.Item label="挂载币种">{targetStrategy?.symbols.length ?? 0}</Descriptions.Item>
                    <Descriptions.Item label="状态">{targetStrategy?.enabled ? "运行中" : "暂停"}</Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="建议版本">
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="版本">v{(targetStrategy?.version ?? targetRecord?.strategyVersion ?? 1) + 1}</Descriptions.Item>
                    <Descriptions.Item label="默认状态"><Tag color="gold">暂停</Tag></Descriptions.Item>
                    <Descriptions.Item label="挂载币种">0，需要确认后重新挂载</Descriptions.Item>
                    <Descriptions.Item label="来源">{draftAdvice.title}</Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
            </Row>
            <Card title="调整内容">
              <List
                dataSource={changeList}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta title={<Space><Tag color={item.type === "新增" ? "green" : item.type === "增强" ? "blue" : "gold"}>{item.type}</Tag><Text>{item.content}</Text></Space>} />
                  </List.Item>
                )}
              />
            </Card>
            <Card title="风险变化">
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="信号数量">可能减少，过滤更严格。</Descriptions.Item>
                <Descriptions.Item label="触发速度">可能变慢，但假信号风险降低。</Descriptions.Item>
                <Descriptions.Item label="适用范围">优先用于复盘中出现该错误类型的策略和币种。</Descriptions.Item>
              </Descriptions>
            </Card>
          </Space>
        )}
      </Drawer>
    </Space>
  );
}

function ReviewStats({ records }: { records: ReviewRecord[] }) {
  const validRate = records.length ? Math.round((records.filter((item) => item.status === "valid").length / records.length) * 100) : 0;
  const averageMfe = records.length ? (records.reduce((sum, item) => sum + item.mfe, 0) / records.length).toFixed(1) : "0.0";
  const averageResult24h = records.length ? (records.reduce((sum, item) => sum + item.result24h, 0) / records.length).toFixed(1) : "0.0";
  const versionRows = Object.values(records.reduce<Record<string, { key: string; strategy: string; version: number; total: number; valid: number; invalid: number; executionErrors: number }>>((acc, item) => {
    const key = `${item.instanceId}-v${item.strategyVersion}`;
    acc[key] ??= { key, strategy: item.strategyName, version: item.strategyVersion, total: 0, valid: 0, invalid: 0, executionErrors: 0 };
    acc[key].total += 1;
    if (item.status === "valid") acc[key].valid += 1;
    if (item.status === "invalid") acc[key].invalid += 1;
    if (item.status === "execution_error") acc[key].executionErrors += 1;
    return acc;
  }, {}));
  const symbolRows = Object.values(records.reduce<Record<string, { symbol: string; total: number; valid: number; watching: number; invalid: number }>>((acc, item) => {
    acc[item.symbol] ??= { symbol: item.symbol, total: 0, valid: 0, watching: 0, invalid: 0 };
    acc[item.symbol].total += 1;
    if (item.status === "valid") acc[item.symbol].valid += 1;
    if (item.status === "watching") acc[item.symbol].watching += 1;
    if (item.status === "invalid") acc[item.symbol].invalid += 1;
    return acc;
  }, {}));
  const optimizationHints = [
    ...versionRows
      .filter((row) => row.total >= 2 && row.invalid / row.total >= 0.5)
      .map((row) => `${row.strategy} v${row.version} 无效率偏高，优先检查触发条件是否过早或周期过滤是否不足。`),
    ...versionRows
      .filter((row) => row.executionErrors / Math.max(row.total, 1) >= 0.4)
      .map((row) => `${row.strategy} v${row.version} 执行偏差偏多，策略本身未必错误，应先优化入场执行规则。`),
    ...symbolRows
      .filter((row) => row.total >= 2 && row.invalid / row.total >= 0.5)
      .map((row) => `${row.symbol} 在当前样本里无效率偏高，可以考虑从相关策略监控队列移除或降低权重。`),
  ];
  const data = records.map((item) => ({
    symbol: item.symbol.replace("USDT", ""),
    signal: item.signalScore,
    execution: item.executionScore,
    result: item.result24h,
  }));
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={8}><Card><Statistic title="有效信号率" value={validRate} suffix="%" /></Card></Col>
      <Col xs={24} md={8}><Card><Statistic title="平均最大浮盈" value={averageMfe} suffix="%" /></Card></Col>
      <Col xs={24} md={8}><Card><Statistic title="平均 24h 表现" value={averageResult24h} suffix="%" /></Card></Col>
      <Col xs={24}>
        <Card title="评分与结果对比">
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" />
                <XAxis dataKey="symbol" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="signal" name="信号评分" fill="#1677ff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="execution" name="执行评分" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Col>
      <Col xs={24} xl={12}>
        <Card title="策略版本有效率">
          <Table
            rowKey="key"
            dataSource={versionRows}
            pagination={false}
            columns={[
              { title: "策略", dataIndex: "strategy" },
              { title: "版本", dataIndex: "version", width: 80, render: (value: number) => <Tag color="blue">v{value}</Tag> },
              { title: "样本", dataIndex: "total", width: 70 },
              { title: "有效率", width: 100, render: (_, row) => `${Math.round((row.valid / Math.max(row.total, 1)) * 100)}%` },
              { title: "执行偏差", dataIndex: "executionErrors", width: 90 },
            ]}
            scroll={{ x: 680 }}
          />
        </Card>
      </Col>
      <Col xs={24} xl={12}>
        <Card title="币种适配度">
          <Table
            rowKey="symbol"
            dataSource={symbolRows}
            pagination={false}
            columns={[
              { title: "币种", dataIndex: "symbol" },
              { title: "样本", dataIndex: "total", width: 70 },
              { title: "有效", dataIndex: "valid", width: 70 },
              { title: "观察", dataIndex: "watching", width: 70 },
              { title: "无效", dataIndex: "invalid", width: 70 },
              { title: "适配度", width: 100, render: (_, row) => `${Math.round((row.valid / Math.max(row.total, 1)) * 100)}%` },
            ]}
            scroll={{ x: 620 }}
          />
        </Card>
      </Col>
      <Col xs={24}>
        <Card title="策略优化建议">
          {optimizationHints.length ? (
            <List dataSource={optimizationHints} renderItem={(item) => <List.Item>{item}</List.Item>} />
          ) : (
            <Alert type="success" showIcon message="当前样本没有明显策略失效集中点，继续积累复盘样本。" />
          )}
        </Card>
      </Col>
    </Row>
  );
}

function StrategyListPage() {
  const { strategyInstances, strategyStates, signalLibrary, timeframeSlotTemplates, signals, symbols, backtestSnapshots, toggleStrategyEnabled, duplicateStrategy, updateStrategyInstance } = useAppStore();
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [editingStrategyId, setEditingStrategyId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [editSymbols, setEditSymbols] = useState<string[]>([]);
  const [editSlots, setEditSlots] = useState<Record<TimeframeSlotKey, string>>(emptySlotTimes());
  const rows = strategyInstances.map((instance) => {
    const states = strategyStates.filter((state) => state.instanceId === instance.id);
    return {
      ...instance,
      displayName: strategyDisplayName(instance),
      currentVersion: instance.version ?? 1,
      latestBacktest: backtestSnapshots.find((snapshot) => snapshot.instanceId === instance.id),
      versionHistory: instance.versionHistory ?? [{ version: 1, changedAt: "初始", summary: "创建策略" }],
      slotTemplateName: timeframeSlotTemplates.find((template) => template.id === instance.slotTemplateId)?.name ?? instance.slotTemplateId,
      mountedCount: instance.symbols.length,
      triggeredCount: states.filter((state) => state.state === "triggered").length,
      waitingCount: states.filter((state) => state.state === "waiting_trigger").length,
      watchingCount: states.filter((state) => state.state === "watching").length,
    };
  });

  const columns: ColumnsType<(typeof rows)[number]> = [
    {
      title: "策略名称",
      fixed: "left",
      width: 220,
      render: (_, row) => (
        <Space direction="vertical" size={2}>
          <Text strong>{row.displayName}</Text>
          <Text type="secondary">{row.id} / v{row.currentVersion}</Text>
        </Space>
      ),
    },
    { title: "周期模板", dataIndex: "slotTemplateName", width: 180 },
    { title: "版本", dataIndex: "currentVersion", width: 90, render: (value: number) => <Tag color="blue">v{value}</Tag> },
    {
      title: "挂载币种",
      dataIndex: "symbols",
      render: (symbols: string[]) => <Space wrap>{symbols.map((symbol) => <Tag key={symbol}>{symbol}</Tag>)}</Space>,
    },
    {
      title: "状态统计",
      width: 220,
      render: (_, row) => (
        <Space wrap>
          <Tag color="blue">监控 {row.watchingCount}</Tag>
          <Tag color="gold">等待 {row.waitingCount}</Tag>
          <Tag color="green">触发 {row.triggeredCount}</Tag>
        </Space>
      ),
    },
    {
      title: "周期槽位",
      width: 260,
      render: (_, row) => (
        <Space wrap>
          {(Object.keys(row.slots) as TimeframeSlotKey[]).map((slotKey) => (
            <Tag key={slotKey}>{slotLabels[slotKey]} {row.slots[slotKey]}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "信号条件",
      width: 260,
      render: (_, row) => <Text type="secondary">{row.conditionIds.slice(0, 4).map((id) => signalName(signalLibrary, id)).join("、")}</Text>,
    },
    {
      title: "最近回测",
      width: 240,
      render: (_, row) => row.latestBacktest ? (
        <Space direction="vertical" size={2}>
          <Space>
            <Tag color={backtestDecisionMeta[row.latestBacktest.decision].color}>{backtestDecisionMeta[row.latestBacktest.decision].label}</Tag>
            <Text>{row.latestBacktest.symbol}</Text>
          </Space>
          <Text type="secondary">胜率 {row.latestBacktest.winRate}% / 触发 {row.latestBacktest.triggerCount} / 回撤 {row.latestBacktest.avgMae}%</Text>
        </Space>
      ) : <Text type="secondary">暂无回测</Text>,
    },
  ];
  const selectedStrategy = rows.find((row) => row.id === selectedStrategyId);
  const selectedTemplate = timeframeSlotTemplates.find((template) => template.id === selectedStrategy?.slotTemplateId);
  const selectedStates = selectedStrategy ? strategyStates.filter((state) => state.instanceId === selectedStrategy.id) : [];
  const selectedSignals = selectedStrategy ? signals.filter((signal) => signal.instanceId === selectedStrategy.id) : [];
  const editingStrategy = rows.find((row) => row.id === editingStrategyId);

  const openEditor = (strategy: typeof rows[number]) => {
    setEditingStrategyId(strategy.id);
    setEditName(strategy.displayName);
    setEditEnabled(strategy.enabled);
    setEditSymbols(strategy.symbols);
    setEditSlots(strategy.slots);
  };

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}><Card><Statistic title="已创建策略" value={strategyInstances.length} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="挂载币种" value={strategyInstances.reduce((sum, item) => sum + item.symbols.length, 0)} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="等待触发" value={rows.reduce((sum, item) => sum + item.waitingCount, 0)} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="已触发" value={rows.reduce((sum, item) => sum + item.triggeredCount, 0)} /></Card></Col>
      </Row>
      <Card title="策略列表">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 1240 }}
          onRow={(record) => ({ onClick: () => setSelectedStrategyId(record.id) })}
        />
      </Card>
      <Drawer title="策略详情" open={Boolean(selectedStrategy)} onClose={() => setSelectedStrategyId(null)} width={720}>
        {selectedStrategy && (
          <Space direction="vertical" size={16} className="page-stack">
            <Card>
              <Flex justify="space-between" align="flex-start" gap={16} wrap>
                <Space direction="vertical" size={4}>
                  <Title level={4} className="page-title">{selectedStrategy.displayName}</Title>
                  <Text type="secondary">{selectedStrategy.id}</Text>
                </Space>
                <Space>
                  <Tag color={selectedStrategy.enabled ? "green" : "default"}>{selectedStrategy.enabled ? "运行中" : "已停用"}</Tag>
                  <Button
                    onClick={() => {
                      const id = duplicateStrategy(selectedStrategy.id);
                      if (id) {
                        notification.success({ message: "策略已复制", description: "副本已加入策略列表，默认停用且未挂载币种。", placement: "bottomRight" });
                        setSelectedStrategyId(id);
                      }
                    }}
                  >
                    复制策略
                  </Button>
                  <Button
                    onClick={() => {
                      toggleStrategyEnabled(selectedStrategy.id);
                      notification.info({
                        message: selectedStrategy.enabled ? "策略已停用" : "策略已启用",
                        description: selectedStrategy.enabled ? "该策略将不再触发新的模拟信号。" : "该策略已恢复运行。",
                        placement: "bottomRight",
                      });
                    }}
                  >
                    {selectedStrategy.enabled ? "停用策略" : "启用策略"}
                  </Button>
                  <Button type="primary" onClick={() => openEditor(selectedStrategy)}>编辑策略</Button>
                </Space>
              </Flex>
            </Card>

            <Row gutter={[12, 12]}>
              <Col xs={12} md={6}><Card size="small"><Statistic title="挂载币种" value={selectedStrategy.symbols.length} /></Card></Col>
              <Col xs={12} md={6}><Card size="small"><Statistic title="等待触发" value={selectedStrategy.waitingCount} /></Card></Col>
              <Col xs={12} md={6}><Card size="small"><Statistic title="已触发" value={selectedStrategy.triggeredCount} /></Card></Col>
              <Col xs={12} md={6}><Card size="small"><Statistic title="信号数" value={selectedSignals.length} /></Card></Col>
            </Row>

            <Card title="基本信息">
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="策略名称">{selectedStrategy.displayName}</Descriptions.Item>
                <Descriptions.Item label="当前版本">v{selectedStrategy.currentVersion}</Descriptions.Item>
                <Descriptions.Item label="周期模板">{selectedStrategy.slotTemplateName}</Descriptions.Item>
                <Descriptions.Item label="启用状态">{selectedStrategy.enabled ? "启用" : "停用"}</Descriptions.Item>
                <Descriptions.Item label="最近回测">
                  {selectedStrategy.latestBacktest
                    ? `${backtestDecisionMeta[selectedStrategy.latestBacktest.decision].label} / 胜率 ${selectedStrategy.latestBacktest.winRate}% / ${selectedStrategy.latestBacktest.createdAt}`
                    : "暂无回测"}
                </Descriptions.Item>
                <Descriptions.Item label="挂载币种">
                  <Space wrap>{selectedStrategy.symbols.map((symbol) => <Tag key={symbol}>{symbol}</Tag>)}</Space>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="周期槽位与信号填充">
              <Row gutter={[12, 12]}>
                {(selectedTemplate?.slots ?? []).map((slot) => (
                  <Col xs={24} md={8} key={slot.key}>
                    <Card type="inner" size="small" title={slotLabels[slot.key]} extra={<Tag>{selectedStrategy.slots[slot.key]}</Tag>}>
                      <Space direction="vertical" size={4}>
                        {(selectedStrategy.signalIdsBySlot[slot.key] ?? []).map((id) => (
                          <Tag key={id} color="blue">{signalName(signalLibrary, id)}</Tag>
                        ))}
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>

            <Card title="风控 / 失效条件">
              <Space wrap>
                {selectedStrategy.riskSignalIds.map((id) => <Tag color="red" key={id}>{signalName(signalLibrary, id)}</Tag>)}
              </Space>
            </Card>

            <Card title="版本历史">
              <Timeline
                items={[...selectedStrategy.versionHistory].reverse().map((item) => ({
                  color: item.version === selectedStrategy.currentVersion ? "blue" : "gray",
                  children: (
                    <Space direction="vertical" size={2}>
                      <Text strong>v{item.version}</Text>
                      <Text type="secondary">{item.changedAt} / {item.summary}</Text>
                    </Space>
                  ),
                }))}
              />
            </Card>

            <Card title="运行表现">
              <Table
                rowKey={(row) => `${row.instanceId}-${row.symbol}`}
                dataSource={selectedStates}
                pagination={false}
                columns={[
                  { title: "币种", dataIndex: "symbol" },
                  { title: "状态", dataIndex: "state", render: (value: StrategyState["state"]) => <Tag color={stateMeta[value].color}>{stateMeta[value].label}</Tag> },
                  { title: "下一步等待", dataIndex: "nextWaitingFor" },
                  { title: "更新", dataIndex: "lastUpdated", width: 100 },
                ]}
                scroll={{ x: 760 }}
              />
            </Card>
          </Space>
        )}
      </Drawer>
      <Drawer title="编辑策略" open={Boolean(editingStrategy)} onClose={() => setEditingStrategyId(null)} width={560}>
        {editingStrategy && (
          <Form layout="vertical">
            <Form.Item label="策略名称">
              <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
            </Form.Item>
            <Form.Item label="启用状态">
              <Segmented
                value={editEnabled ? "enabled" : "disabled"}
                onChange={(value) => setEditEnabled(value === "enabled")}
                options={[
                  { label: "启用", value: "enabled" },
                  { label: "停用", value: "disabled" },
                ]}
              />
            </Form.Item>
            <Form.Item label="挂载币种">
              <Checkbox.Group
                className="vertical-checkbox"
                value={editSymbols}
                onChange={(values) => setEditSymbols(values as string[])}
                options={symbols.map((symbol) => ({ label: symbol.symbol, value: symbol.symbol }))}
              />
            </Form.Item>
            <Form.Item label="周期槽位">
              <Row gutter={[12, 12]}>
                {(Object.keys(editSlots) as TimeframeSlotKey[]).map((slotKey) => (
                  <Col xs={24} md={8} key={slotKey}>
                    <Text type="secondary">{slotLabels[slotKey]}</Text>
                    <Select
                      className="page-stack"
                      value={editSlots[slotKey]}
                      onChange={(value) => setEditSlots({ ...editSlots, [slotKey]: value })}
                      options={timeframeOptions.map((value) => ({ label: value, value }))}
                    />
                  </Col>
                ))}
              </Row>
            </Form.Item>
            <Button
              type="primary"
              block
              onClick={() => {
                updateStrategyInstance(editingStrategy.id, {
                  name: editName.trim() || editingStrategy.displayName,
                  enabled: editEnabled,
                  symbols: editSymbols,
                  slots: editSlots,
                });
                notification.success({ message: "策略已保存", description: "策略列表和监控中心已同步更新。", placement: "bottomRight" });
                setEditingStrategyId(null);
              }}
            >
              保存策略
            </Button>
          </Form>
        )}
      </Drawer>
    </Space>
  );
}

function ReviewCenter() {
  const { signals, strategyInstances, signalReviews } = useAppStore();
  const [strategyFilter, setStrategyFilter] = useState("all");
  const [versionFilter, setVersionFilter] = useState("all");
  const [symbolFilter, setSymbolFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewStatus>("all");
  const records = useMemo(() => buildReviewRecords(signals, strategyInstances, signalReviews), [signals, strategyInstances, signalReviews]);
  const versionOptions = Array.from(new Set(records.map((record) => record.strategyVersion))).sort((a, b) => b - a);
  const symbolOptions = Array.from(new Set(records.map((record) => record.symbol))).sort();
  const filteredRecords = records.filter((record) => {
    if (strategyFilter !== "all" && record.instanceId !== strategyFilter) return false;
    if (versionFilter !== "all" && String(record.strategyVersion) !== versionFilter) return false;
    if (symbolFilter !== "all" && record.symbol !== symbolFilter) return false;
    if (statusFilter !== "all" && record.status !== statusFilter) return false;
    return true;
  });

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Card>
        <Flex justify="space-between" align="center" wrap gap={12}>
          <Space direction="vertical" size={2}>
            <Title level={5}>复盘筛选</Title>
            <Text type="secondary">按策略、版本、币种和复盘结论追溯每一次监控信号。</Text>
          </Space>
          <Space wrap>
            <Select
              className="monitor-filter-select"
              value={strategyFilter}
              onChange={setStrategyFilter}
              options={[
                { label: "全部策略", value: "all" },
                ...strategyInstances.map((instance) => ({ label: strategyDisplayName(instance), value: instance.id })),
              ]}
            />
            <Select
              className="monitor-filter-select"
              value={versionFilter}
              onChange={setVersionFilter}
              options={[{ label: "全部版本", value: "all" }, ...versionOptions.map((version) => ({ label: `v${version}`, value: String(version) }))]}
            />
            <Select
              className="monitor-filter-select"
              value={symbolFilter}
              onChange={setSymbolFilter}
              options={[{ label: "全部币种", value: "all" }, ...symbolOptions.map((symbol) => ({ label: symbol, value: symbol }))]}
            />
            <Select
              className="monitor-filter-select"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: "全部结论", value: "all" },
                ...Object.entries(reviewStatusMeta).map(([value, meta]) => ({ label: meta.label, value })),
              ]}
            />
          </Space>
        </Flex>
      </Card>
      <Tabs
        items={[
          { key: "signal-review", label: "信号复盘", children: <SignalReview records={filteredRecords} /> },
          { key: "trade-review", label: "交易复盘", children: <TradeReview records={filteredRecords} /> },
          { key: "timeframe-attribution", label: "周期归因", children: <TimeframeAttribution /> },
          { key: "condition-attribution", label: "条件归因", children: <ConditionAttribution /> },
          { key: "error-library", label: "错误库", children: <ErrorLibrary records={filteredRecords} /> },
          { key: "strategy-health", label: "策略健康度", children: <StrategyHealth records={filteredRecords} /> },
          { key: "rule-advice", label: "规则建议", children: <RuleAdvice records={filteredRecords} /> },
          { key: "review-stats", label: "复盘统计", children: <ReviewStats records={filteredRecords} /> },
        ]}
      />
    </Space>
  );
}

function StrategyWorkspace() {
  return (
    <Tabs
      items={[
        { key: "builder", label: "策略组装", children: <StrategyBuilder /> },
        { key: "strategy-list", label: "策略列表", children: <StrategyListPage /> },
        { key: "monitor", label: "监控中心", children: <StrategyMonitorCenter /> },
        { key: "runtime", label: "策略运行", children: <StrategyRuntime /> },
        { key: "backtest", label: "模拟回测", children: <StrategyBacktest /> },
        { key: "signals", label: "信号中心", children: <SignalsCenter /> },
        { key: "alert-rules", label: "告警规则", children: <AlertRulesCenter /> },
        { key: "push-settings", label: "推送配置", children: <PushSettingsPrototype /> },
        { key: "review", label: "复盘中心", children: <ReviewCenter /> },
        { key: "signal-library", label: "信号库", children: <SignalLibraryPage /> },
        { key: "slot-template", label: "周期槽位", children: <SlotTemplatesPage /> },
      ]}
    />
  );
}

function DataWarehouse() {
  const {
    symbols,
    moneyFlows,
    signals,
    strategyStates,
    timeframeDecisions,
    marketSeries,
    marketDataStatus,
    marketStreamStatus,
    strategyPersistenceStatus,
    refreshBackendMarketData,
    refreshPersistedStrategyData,
  } = useAppStore();
  const klineCount = Object.values(marketSeries).reduce((sum, series) => sum + series.length, 0);
  const warehouseTypes = [
    {
      key: "kline",
      name: "K线行情",
      category: "market",
      source: "Binance Futures",
      symbols: Object.keys(marketSeries).length,
      records: klineCount,
      frequency: "1m / 15m / 1h / 4h / 1d",
      latest: marketSeries.BTCUSDT.at(-1)?.time ?? "-",
      status: "采集中",
    },
    {
      key: "money-flow",
      name: "资金流数据",
      category: "derivative",
      source: "Funding / OI / Taker",
      symbols: moneyFlows.length,
      records: moneyFlows.length * 4,
      frequency: "5m",
      latest: "刚刚",
      status: "采集中",
    },
    {
      key: "market-rank",
      name: "市场排行快照",
      category: "market",
      source: "Ticker / Volume / Market Cap",
      symbols: symbols.length,
      records: symbols.length,
      frequency: "1m",
      latest: "刚刚",
      status: "已缓存",
    },
    {
      key: "strategy-state",
      name: "策略监控状态",
      category: "strategy",
      source: "Strategy Worker",
      symbols: new Set(strategyStates.map((item) => item.symbol)).size,
      records: strategyStates.length,
      frequency: "事件驱动",
      latest: strategyStates[0]?.lastUpdated ?? "-",
      status: "已入库",
    },
    {
      key: "signal-snapshot",
      name: "信号触发快照",
      category: "signal",
      source: "Signal Engine",
      symbols: new Set(signals.map((item) => item.symbol)).size,
      records: signals.length,
      frequency: "事件驱动",
      latest: signals[0]?.createdAt ?? "-",
      status: "已入库",
    },
    {
      key: "timeframe-decision",
      name: "周期决策结果",
      category: "decision",
      source: "Timeframe Selector",
      symbols: timeframeDecisions.length,
      records: timeframeDecisions.length,
      frequency: "信号触发时",
      latest: "刚刚",
      status: "已入库",
    },
  ];

  const typeColumns: ColumnsType<(typeof warehouseTypes)[number]> = [
    { title: "数据类型", dataIndex: "name", fixed: "left", render: (value: string, row) => <Space><Database size={15} /><Text strong>{value}</Text><Tag>{row.category}</Tag></Space> },
    { title: "来源", dataIndex: "source" },
    { title: "覆盖币种", dataIndex: "symbols", align: "right" },
    { title: "记录数", dataIndex: "records", align: "right" },
    { title: "采集频率", dataIndex: "frequency" },
    { title: "最新时间", dataIndex: "latest" },
    { title: "状态", dataIndex: "status", render: (value: string) => <Tag color={value === "采集中" ? "green" : value === "已入库" ? "blue" : "gold"}>{value}</Tag> },
  ];

  const klineRows = marketSeries.BTCUSDT.slice(-8).reverse().map((item, index) => ({ id: index, symbol: "BTCUSDT", ...item }));
  const klineColumns: ColumnsType<(typeof klineRows)[number]> = [
    { title: "币种", dataIndex: "symbol" },
    { title: "时间", dataIndex: "time" },
    { title: "Open", dataIndex: "open", align: "right", render: formatPrice },
    { title: "High", dataIndex: "high", align: "right", render: formatPrice },
    { title: "Low", dataIndex: "low", align: "right", render: formatPrice },
    { title: "Close", dataIndex: "close", align: "right", render: formatPrice },
  ];

  const flowColumns: ColumnsType<(typeof moneyFlows)[number]> = [
    { title: "币种", dataIndex: "symbol" },
    { title: "资金费率", dataIndex: "fundingRate", align: "right", render: (value: number) => `${value}%` },
    { title: "OI 变化", dataIndex: "oiChange", align: "right", render: (value: number) => <Text type={value >= 0 ? "success" : "danger"}>{value}%</Text> },
    { title: "主动买入", dataIndex: "takerBuyRatio", align: "right", render: (value: number) => `${value}%` },
    { title: "大户多头", dataIndex: "topLongRatio", align: "right", render: (value: number) => `${value}%` },
    { title: "净流入", dataIndex: "netFlow", align: "right", render: (value: number) => <Text type={value >= 0 ? "success" : "danger"}>{value}M</Text> },
  ];

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}><Card><Statistic title="数据类型" value={warehouseTypes.length} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="覆盖币种" value={symbols.length} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="市场记录" value={klineCount + moneyFlows.length + symbols.length} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="信号快照" value={signals.length} /></Card></Col>
      </Row>

      <Card>
        <Flex justify="space-between" align="center" gap={16} wrap>
          <Space direction="vertical" size={4}>
            <Text strong>后端公共行情源</Text>
            <Text type="secondary">
              当前数据源：{marketSourceMeta[marketDataStatus.source].label} / 最近更新：{marketDataStatus.lastUpdated ?? "尚未刷新"}
            </Text>
            <Text type="secondary">实时连接：{streamStatusMeta[marketStreamStatus.status].label} / 最近推送：{marketStreamStatus.lastEventAt ?? "-"}</Text>
            <Text type="secondary">策略持久化：{strategyPersistenceStatus.source === "backend" ? "后端数据库" : "本地模拟"} / 最近同步：{strategyPersistenceStatus.lastUpdated ?? "尚未同步"}</Text>
            {marketDataStatus.error && <Text type="danger">最近错误：{marketDataStatus.error}</Text>}
            {strategyPersistenceStatus.error && <Text type="danger">持久化同步错误：{strategyPersistenceStatus.error}</Text>}
          </Space>
          <Space>
            <Button loading={strategyPersistenceStatus.loading} icon={<RefreshCw size={16} />} onClick={() => void refreshPersistedStrategyData()}>
              同步策略库
            </Button>
            <Button loading={marketDataStatus.loading} onClick={() => void refreshBackendMarketData()}>
              刷新数据仓行情
            </Button>
          </Space>
        </Flex>
      </Card>

      <Card>
        <Space direction="vertical" size={4}>
          <Title level={4} className="page-title">数据仓</Title>
          <Text type="secondary">查看已采集到的数据资产、类型、来源、覆盖范围和最近入库状态。</Text>
        </Space>
      </Card>

      <Card title="数据类型目录">
        <Table rowKey="key" columns={typeColumns} dataSource={warehouseTypes} pagination={false} scroll={{ x: 980 }} />
      </Card>

      <Tabs
        items={[
          {
            key: "kline",
            label: "K线样例",
            children: (
              <Card title="BTCUSDT 最近 K线">
                <Table rowKey="id" columns={klineColumns} dataSource={klineRows} pagination={false} scroll={{ x: 780 }} />
              </Card>
            ),
          },
          {
            key: "flow",
            label: "资金流样例",
            children: (
              <Card title="资金流数据">
                <Table rowKey="symbol" columns={flowColumns} dataSource={moneyFlows} pagination={false} scroll={{ x: 820 }} />
              </Card>
            ),
          },
          {
            key: "state",
            label: "策略状态样例",
            children: (
              <Card title="策略状态数据">
                <Table
                  rowKey={(row) => `${row.instanceId}-${row.symbol}`}
                  dataSource={strategyStates}
                  pagination={false}
                  columns={[
                    { title: "实例", dataIndex: "instanceId" },
                    { title: "币种", dataIndex: "symbol" },
                    { title: "状态", dataIndex: "state", render: (value: StrategyState["state"]) => <Tag color={stateMeta[value].color}>{stateMeta[value].label}</Tag> },
                    { title: "下一步等待", dataIndex: "nextWaitingFor" },
                    { title: "更新", dataIndex: "lastUpdated" },
                  ]}
                  scroll={{ x: 880 }}
                />
              </Card>
            ),
          },
        ]}
      />
    </Space>
  );
}

function SettingsPage() {
  const settings = [
    ["交易所配置", "Binance Futures，只读 API Key，后端加密保存。"],
    ["推送配置", "强信号即时推送，观察信号进入队列，重复信号静默。"],
    ["策略参数", "信号库参数独立保存，策略只引用信号 ID 和版本。"],
    ["风控参数", "最大冷却时间、重复信号过滤、失效条件和交易周期限制。"],
  ];

  return (
    <Row gutter={[16, 16]}>
      {settings.map(([title, desc]) => (
        <Col xs={24} md={12} key={title}>
          <Card title={title}>
            <Paragraph type="secondary">{desc}</Paragraph>
          </Card>
        </Col>
      ))}
    </Row>
  );
}

function SignalDrawer() {
  const { signals, selectedSignalId, selectSignal, strategyInstances, symbols, moneyFlows, signalReviews, backtestSnapshots, marketSeries } = useAppStore();
  const signal = signals.find((item) => item.id === selectedSignalId);
  const strategy = strategyInstances.find((item) => item.id === signal?.instanceId);
  const market = symbols.find((item) => item.symbol === signal?.symbol);
  const flow = moneyFlows.find((item) => item.symbol === signal?.symbol);
  const relatedSignals = signal ? signals.filter((item) => item.symbol === signal.symbol && item.id !== signal.id) : [];
  const strategyReviews = signal ? buildReviewRecords(signals.filter((item) => item.instanceId === signal.instanceId), strategyInstances, signalReviews) : [];
  const strategyBacktests = signal ? backtestSnapshots.filter((item) => item.instanceId === signal.instanceId && item.strategyVersion === (signal.strategyVersion ?? strategy?.version ?? 1)) : [];
  const validRate = strategyReviews.length ? Math.round((strategyReviews.filter((item) => item.status === "valid").length / strategyReviews.length) * 100) : 0;
  const latestBacktest = strategyBacktests[0];
  const triggerPrice = market?.price ?? 0;
  const slots = strategy?.slots ?? { direction_tf: "1d", structure_tf: "4h", trigger_tf: "1h" };
  const signalIdsBySlot = strategy?.signalIdsBySlot ?? {
    direction_tf: ["ema-trend-up"],
    structure_tf: ["structure-squeeze-end", "macd-expansion"],
    trigger_tf: ["ema-cross-up", "taker-buy-dominant"],
  };

  return (
    <Drawer title="信号详情" open={Boolean(signal)} onClose={() => selectSignal(null)} width={680}>
      {signal && (
        <Space direction="vertical" size={16} className="page-stack">
          <Card>
            <Flex justify="space-between" align="flex-start" gap={16} wrap>
              <Space direction="vertical" size={4}>
                <Space wrap>
                  <Title level={4} className="page-title">{signal.symbol}</Title>
                  <Tag color={strengthMeta[signal.strength].color}>{strengthMeta[signal.strength].label}</Tag>
                  <Tag color={signal.direction === "long" ? "green" : signal.direction === "short" ? "red" : "default"}>{directionLabel[signal.direction]}</Tag>
                </Space>
                <Text type="secondary">{strategyDisplayName(strategy)} / v{signal.strategyVersion ?? strategy?.version ?? 1} / {signal.createdAt}</Text>
              </Space>
              <Space>
                <Button>标记已读</Button>
                <Button danger>标记失效</Button>
              </Space>
            </Flex>
          </Card>

          <Row gutter={[12, 12]}>
            <Col xs={12}>
              <Card size="small"><Statistic title="触发价格" value={triggerPrice} precision={triggerPrice > 1000 ? 0 : 2} /></Card>
            </Col>
            <Col xs={12}>
              <Card size="small"><Statistic title="24h 涨跌" value={market?.change24h ?? 0} suffix="%" valueStyle={{ color: (market?.change24h ?? 0) >= 0 ? "#52c41a" : "#ff4d4f" }} /></Card>
            </Col>
            <Col xs={12}>
              <Card size="small"><Statistic title="资金净流入" value={flow?.netFlow ?? 0} suffix="M" valueStyle={{ color: (flow?.netFlow ?? 0) >= 0 ? "#52c41a" : "#ff4d4f" }} /></Card>
            </Col>
            <Col xs={12}>
              <Card size="small"><Statistic title="主动买入" value={flow?.takerBuyRatio ?? 0} suffix="%" /></Card>
            </Col>
          </Row>

          <Card title="周期槽位">
            <Row gutter={[12, 12]}>
              {(Object.keys(slots) as TimeframeSlotKey[]).map((slotKey) => (
                <Col xs={24} md={8} key={slotKey}>
                  <Card type="inner" size="small" title={slotLabels[slotKey]} extra={<Tag>{slots[slotKey]}</Tag>}>
                    <Space direction="vertical" size={4}>
                      {(signalIdsBySlot[slotKey] ?? []).map((id) => (
                        <Tag key={id} color="blue">{signalName([], id)}</Tag>
                      ))}
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>

          <Card title="K线触发点">
            <MiniKline data={marketSeries.BTCUSDT ?? mockMarketSeries.BTCUSDT} markerLabel={`${signal.symbol} 触发`} />
          </Card>

          <Card title="信号快照">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="触发原因">{signal.reason}</Descriptions.Item>
              <Descriptions.Item label="资金流确认">{signal.flowConfirm}</Descriptions.Item>
              <Descriptions.Item label="推送状态"><Tag color={signal.pushStatus === "sent" ? "green" : "gold"}>{signal.pushStatus}</Tag></Descriptions.Item>
              <Descriptions.Item label="策略版本">v{signal.strategyVersion ?? strategy?.version ?? 1}</Descriptions.Item>
              <Descriptions.Item label="下一步建议">等待触发后走势确认；若价格回踩不破触发周期均线，可进入交易复盘跟踪。</Descriptions.Item>
            </Descriptions>
          </Card>

          <Row gutter={[12, 12]}>
            <Col xs={24} xl={12}>
              <Card title="同币种历史信号">
                <List
                  dataSource={relatedSignals.slice(0, 4)}
                  locale={{ emptyText: "暂无同币种历史信号" }}
                  renderItem={(item) => (
                    <List.Item onClick={() => selectSignal(item.id)} className="clickable-list-item">
                      <List.Item.Meta
                        title={<Space><Tag color={strengthMeta[item.strength].color}>{strengthMeta[item.strength].label}</Tag><Text>{item.createdAt}</Text></Space>}
                        description={item.reason}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card title="策略版本表现">
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="复盘样本">{strategyReviews.length}</Descriptions.Item>
                  <Descriptions.Item label="复盘有效率">{validRate}%</Descriptions.Item>
                  <Descriptions.Item label="最近回测">
                    {latestBacktest ? `${backtestDecisionMeta[latestBacktest.decision].label} / 胜率 ${latestBacktest.winRate}% / 回撤 ${latestBacktest.avgMae}%` : "暂无回测快照"}
                  </Descriptions.Item>
                  <Descriptions.Item label="触发后动作">
                    {latestBacktest?.decision === "mount" ? "可进入重点监控；若资金流继续通过，允许升级提醒。" : "保留观察，等待更多复盘和回测样本。"}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          </Row>

          <Card title="触发流程">
            <Timeline
              items={[
                { color: "blue", children: "方向周期进入多头监控" },
                { color: "gold", children: "结构周期完成收敛过滤" },
                { color: "green", children: "触发周期出现入场信号" },
                { color: "gray", children: "进入复盘跟踪，记录后续表现" },
              ]}
            />
          </Card>

          <Space.Compact className="signal-action-bar">
            <Button block type="primary">加入复盘</Button>
            <Button block>加入冷却</Button>
            <Button block danger>失效处理</Button>
          </Space.Compact>
        </Space>
      )}
    </Drawer>
  );
}

function App() {
  const { activeSection, setActiveSection, strategyStates, signals } = useAppStore();
  const normalizedSection = activeSection === "builder" || activeSection === "runtime" || activeSection === "signals" || activeSection === "timeframe" || activeSection === "flow" ? "strategy" : activeSection;
  const title = navItems.find((item) => item.id === normalizedSection)?.label ?? "工作台";
  const content = useMemo(() => {
    switch (normalizedSection) {
      case "market":
        return <RankedMarketMonitor />;
      case "strategy":
        return <StrategyWorkspace />;
      case "warehouse":
        return <DataWarehouse />;
      case "settings":
        return <SettingsPage />;
      default:
        return <Dashboard />;
    }
  }, [normalizedSection]);

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#1677ff",
          borderRadius: 6,
          colorBgLayout: "#0b1020",
          colorBgContainer: "#111827",
        },
      }}
    >
      <Layout className="app-layout">
        <Sider className="app-sider" width={256} breakpoint="lg" collapsedWidth={0}>
          <Flex className="brand" align="center" gap={12}>
            <div className="brand-icon"><ShieldAlert size={22} /></div>
            <div>
              <Title level={5} className="brand-title">BitSentinel</Title>
              <Text type="secondary">Quant Monitor</Text>
            </div>
          </Flex>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[normalizedSection]}
            onClick={({ key }) => setActiveSection(String(key))}
            items={navItems.map((item) => {
              const Icon = item.icon;
              return { key: item.id, icon: <Icon size={17} />, label: item.label };
            })}
          />
        </Sider>
        <Layout>
          <Header className="app-header">
            <div>
              <Text type="secondary">纯前端模拟数据原型</Text>
              <Title level={3} className="page-title">{title}</Title>
            </div>
            <Space wrap>
              <Button icon={<Search size={15} />}>BTC / 策略 / 信号</Button>
              <Tag color="green"><Cpu size={13} /> Worker Online</Tag>
              <Tag color="blue"><Database size={13} /> Mock Store</Tag>
              <Tag color="gold">{signals.length} Signals / {strategyStates.length} States</Tag>
            </Space>
          </Header>
          <Content className="app-content">{content}</Content>
        </Layout>
        <SignalDrawer />
      </Layout>
    </ConfigProvider>
  );
}

export default App;
