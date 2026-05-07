import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  CandlestickChart,
  Cpu,
  Database,
  Gauge,
  GitBranch,
  Library,
  LineChart,
  ListChecks,
  RadioTower,
  Search,
  Settings,
  ShieldAlert,
  Workflow,
  Zap,
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
  Layout,
  List,
  Menu,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
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
import { marketSeries } from "./mock/data";
import { useAppStore } from "./store/appStore";
import type { KlinePoint, Signal, SignalCategory, SignalDefinition, StrategyState, TimeframeSlotKey } from "./types";

const { Header, Sider, Content } = Layout;
const { Text, Title, Paragraph } = Typography;

const navItems = [
  { id: "dashboard", label: "工作台", icon: Activity },
  { id: "market", label: "市场监控", icon: CandlestickChart },
  { id: "builder", label: "策略管理", icon: Workflow },
  { id: "runtime", label: "策略运行", icon: ListChecks },
  { id: "signals", label: "信号中心", icon: Bell },
  { id: "timeframe", label: "周期筛选", icon: LineChart },
  { id: "flow", label: "资金流分析", icon: RadioTower },
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

function formatPrice(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: value > 1000 ? 0 : 2 });
}

function signalName(signalLibrary: SignalDefinition[], id: string) {
  return signalLibrary.find((signal) => signal.id === id)?.name ?? id;
}

function ema(values: number[], period: number) {
  const k = 2 / (period + 1);
  return values.reduce<number[]>((acc, value, index) => {
    acc.push(index === 0 ? value : value * k + acc[index - 1] * (1 - k));
    return acc;
  }, []);
}

function MiniKline({ data }: { data: KlinePoint[] }) {
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
    const ema9 = chart.addSeries(LineSeries, {
      color: "#38bdf8",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const ema21 = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const volume = chart.addSeries(HistogramSeries, {
      color: "#334155",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });
    const closes = data.map((item) => item.close);
    const ema9Values = ema(closes, 9);
    const ema21Values = ema(closes, 21);
    series.setData(
      data.map((item, index) => ({
        time: (index + 1) as never,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      })),
    );
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
  }, [data]);

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
        <strong>BTCUSDT</strong>
        <span>TradingView Lightweight</span>
      </div>
      <div className="chart-host" ref={ref} />
    </div>
  );
}

function Dashboard() {
  const { symbols, signals, strategyStates, moneyFlows, selectSignal, timeframeDecisions, signalLibrary, timeframeSlotTemplates } = useAppStore();
  const strongSignals = signals.filter((signal) => signal.strength === "strong").length;
  const triggered = strategyStates.filter((state) => state.state === "triggered").length;
  const waiting = strategyStates.filter((state) => state.state === "waiting_trigger").length;
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
        <Col xs={24} md={12} xl={6}>
          <Card><Statistic title="今日信号" value={signals.length} prefix={<Bell size={18} />} /></Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card><Statistic title="强信号" value={strongSignals} prefix={<Zap size={18} />} valueStyle={{ color: "#52c41a" }} /></Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card><Statistic title="信号库" value={signalLibrary.length} prefix={<Library size={18} />} /></Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card><Statistic title="周期槽位" value={timeframeSlotTemplates.length} prefix={<GitBranch size={18} />} suffix={`/${waiting} 等待`} /></Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card title="多币种独立状态机" extra={<Tag color="green">Worker 正常</Tag>}>
            <Table rowKey={(row) => `${row.instanceId}-${row.symbol}`} columns={stateColumns} dataSource={strategyStates} pagination={false} size="middle" />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="最新触发机会">
            <List
              dataSource={signals}
              renderItem={(signal) => (
                <List.Item className="clickable-list-item" onClick={() => selectSignal(signal.id)}>
                  <List.Item.Meta
                    title={<Space><Text strong>{signal.symbol}</Text><Tag color={strengthMeta[signal.strength].color}>{strengthMeta[signal.strength].label}</Tag></Space>}
                    description={signal.reason}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card title="资金流净流入">
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" strokeDasharray="3 3" />
                  <XAxis dataKey="symbol" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="flow" radius={[4, 4, 0, 0]}>
                    {chartData.map((item) => <Cell key={item.symbol} fill={item.flow > 0 ? "#22c55e" : "#f43f5e"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="周期选择解释" extra={<Tag color="blue">{activeDecision.confidence}% 置信度</Tag>}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="币种">{activeDecision.symbol}</Descriptions.Item>
              <Descriptions.Item label="持仓周期">{activeDecision.holdingTimeframe}</Descriptions.Item>
              <Descriptions.Item label="执行周期">{activeDecision.executionTimeframe}</Descriptions.Item>
            </Descriptions>
            <Divider />
            <Paragraph type="secondary">{activeDecision.selectedReason}</Paragraph>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

function MarketMonitor() {
  const { symbols } = useAppStore();
  const btc = symbols.find((item) => item.symbol === "BTCUSDT") ?? symbols[0];
  const [timeframe, setTimeframe] = useState("4h");
  const columns: ColumnsType<(typeof symbols)[number]> = [
    { title: "币种", dataIndex: "symbol", fixed: "left" },
    { title: "价格", dataIndex: "price", align: "right", render: (value: number) => formatPrice(value) },
    {
      title: "24h",
      dataIndex: "change24h",
      align: "right",
      render: (value: number) => <Text type={value >= 0 ? "success" : "danger"}>{value > 0 ? "+" : ""}{value}%</Text>,
    },
    { title: "成交量", dataIndex: "volume", align: "right" },
    {
      title: "状态",
      dataIndex: "status",
      render: (value: string) => <Tag color={value === "alert" ? "green" : value === "watching" ? "blue" : "default"}>{value}</Tag>,
    },
  ];

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={18}>
          <Card
            title={
              <Space>
                <Text strong>BTCUSDT 永续合约</Text>
                <Tag color={btc.change24h >= 0 ? "green" : "red"}>
                  {btc.change24h > 0 ? "+" : ""}
                  {btc.change24h}%
                </Tag>
              </Space>
            }
            extra={<Segmented value={timeframe} onChange={(value) => setTimeframe(String(value))} options={["15m", "1h", "4h", "1d"]} />}
          >
            <Row gutter={[12, 12]} className="quote-strip">
              <Col xs={12} md={6}><Statistic title="最新价" value={btc.price} precision={2} /></Col>
              <Col xs={12} md={6}><Statistic title="24h 成交量" value={btc.volume} /></Col>
              <Col xs={12} md={6}><Statistic title="EMA9" value="103,420" /></Col>
              <Col xs={12} md={6}><Statistic title="EMA21" value="102,860" /></Col>
            </Row>
            <MiniKline data={marketSeries.BTCUSDT} />
            <Flex justify="space-between" wrap="wrap" gap={8} className="chart-legend">
              <Space wrap>
                <Tag color="cyan">EMA9</Tag>
                <Tag color="gold">EMA21</Tag>
                <Tag color="green">Volume</Tag>
              </Space>
                <Text type="secondary">TradingView Lightweight Charts / {timeframe} / K 线、EMA、成交量</Text>
            </Flex>
          </Card>
        </Col>
        <Col xs={24} xl={6}>
          <Card title="指标快照">
            <List
              dataSource={[
                ["EMA", "EMA9 > EMA21", "方向确认"],
                ["MACD", "柱体连续扩张", "动量增强"],
                ["KDJ", "未进入过热", "触发可用"],
                ["ATR", "收缩后放大", "震荡末期"],
              ]}
              renderItem={([name, value, desc]) => (
                <List.Item>
                  <List.Item.Meta title={<Space><Tag>{name}</Tag><Text strong>{value}</Text></Space>} description={desc} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
      <Card title="监控市场">
        <Table rowKey="symbol" columns={columns} dataSource={symbols} pagination={false} size="middle" scroll={{ x: 720 }} />
      </Card>
    </Space>
  );
}

function SignalLibraryPage() {
  const { signalLibrary, addSignalDefinition } = useAppStore();
  const [filter, setFilter] = useState<"all" | SignalCategory>("all");
  const visible = filter === "all" ? signalLibrary : signalLibrary.filter((signal) => signal.category === filter);
  const columns: ColumnsType<SignalDefinition> = [
    { title: "信号名称", dataIndex: "name", render: (_, row) => <Space direction="vertical" size={0}><Text strong>{row.name}</Text><Text type="secondary">{row.label}</Text></Space> },
    { title: "分类", dataIndex: "category", width: 100, render: (value: SignalCategory) => <Tag color={categoryColor[value]}>{categoryLabel[value]}</Tag> },
    { title: "用途", dataIndex: "group", width: 100, render: (value: SignalDefinition["group"]) => <Tag>{groupLabel[value]}</Tag> },
    { title: "可用槽位", dataIndex: "supportedSlotKeys", render: (values: TimeframeSlotKey[]) => <Space wrap>{values.map((value) => <Tag key={value}>{value}</Tag>)}</Space> },
    { title: "状态", dataIndex: "enabled", width: 90, render: (value: boolean) => <Badge status={value ? "success" : "default"} text={value ? "启用" : "停用"} /> },
  ];

  return (
    <Card
      title="信号库"
      extra={<Button type="primary" onClick={addSignalDefinition}>新增模拟信号</Button>}
    >
      <Space direction="vertical" size={16} className="page-stack">
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

function SlotTemplatesPage() {
  const { timeframeSlotTemplates, signalLibrary, addTimeframeSlotTemplate } = useAppStore();

  return (
    <Card title="周期槽位模板" extra={<Button type="primary" onClick={addTimeframeSlotTemplate}>新增模拟槽位</Button>}>
      <Row gutter={[16, 16]}>
        {timeframeSlotTemplates.map((template) => (
          <Col xs={24} xl={12} key={template.id}>
            <Card type="inner" title={template.name} extra={<Tag color="blue">{template.slots.length} 个槽位</Tag>}>
              <Paragraph type="secondary">{template.description}</Paragraph>
              <List
                dataSource={template.slots}
                renderItem={(slot) => (
                  <List.Item>
                    <List.Item.Meta
                      title={<Space><Tag>{slot.label}</Tag><Text>{slot.timeframe}</Text></Space>}
                      description={
                        <Space direction="vertical" size={4}>
                          <Text type="secondary">{slot.roleDescription}</Text>
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

const emptySlotTimes = (): Record<TimeframeSlotKey, string> => ({
  direction_tf: "1d",
  structure_tf: "4h",
  trigger_tf: "1h",
});

function StrategyBuilder() {
  const { timeframeSlotTemplates, signalLibrary, symbols, createStrategyInstance } = useAppStore();
  const [slotTemplateId, setSlotTemplateId] = useState(timeframeSlotTemplates[0].id);
  const [slotTimes, setSlotTimes] = useState<Record<TimeframeSlotKey, string>>(emptySlotTimes());
  const [signalIdsBySlot, setSignalIdsBySlot] = useState<Partial<Record<TimeframeSlotKey, string[]>>>({});
  const [riskSignalIds, setRiskSignalIds] = useState<string[]>([]);
  const [selectedSymbols, setSelectedSymbols] = useState(["BTCUSDT", "ETHUSDT"]);
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
  }, [activeTemplate]);

  const toggleSlotSignal = (slotKey: TimeframeSlotKey, values: string[]) => {
    setSignalIdsBySlot({ ...signalIdsBySlot, [slotKey]: values });
  };

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Alert type="info" showIcon message="策略 = 周期槽位模板 + 槽位内信号填充 + 币种挂载 + 全局风控信号" />
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card title="槽位填充">
            <Form layout="vertical">
              <Form.Item label="周期槽位模板">
                <Select value={slotTemplateId} onChange={setSlotTemplateId} options={timeframeSlotTemplates.map((template) => ({ label: template.name, value: template.id }))} />
              </Form.Item>
              <Paragraph type="secondary">{activeTemplate.description}</Paragraph>
              <Row gutter={[16, 16]}>
                {activeTemplate.slots.map((slot) => {
                  const availableSignals = signalLibrary.filter((signal) => signal.supportedSlotKeys.includes(slot.key));
                  return (
                    <Col xs={24} lg={8} key={slot.key}>
                      <Card type="inner" title={slot.label} extra={<Select className="tf-select" value={slotTimes[slot.key]} onChange={(value) => setSlotTimes({ ...slotTimes, [slot.key]: value })} options={["15m", "1h", "4h", "1d"].map((value) => ({ label: value, value }))} />}>
                        <Paragraph type="secondary">{slot.roleDescription}</Paragraph>
                        <Checkbox.Group
                          className="vertical-checkbox"
                          value={signalIdsBySlot[slot.key] ?? []}
                          onChange={(values) => toggleSlotSignal(slot.key, values as string[])}
                          options={availableSignals.map((signal) => ({ label: `${signal.name} / ${categoryLabel[signal.category]}`, value: signal.id }))}
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
              <Form.Item label="全局确认/风控信号">
                <Checkbox.Group
                  className="vertical-checkbox"
                  value={riskSignalIds}
                  onChange={(values) => setRiskSignalIds(values as string[])}
                  options={signalLibrary
                    .filter((signal) => signal.category === "risk" || signal.defaultGroup === "invalidate" || signal.category === "money_flow")
                    .map((signal) => ({ label: signal.name, value: signal.id }))}
                />
              </Form.Item>
              <Button
                type="primary"
                block
                onClick={() => {
                  const id = createStrategyInstance({
                    slotTemplateId,
                    templateId: slotTemplateId,
                    name: `${activeTemplate.name} / 模拟实例`,
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

function StrategyWorkspace() {
  return (
    <Tabs
      items={[
        { key: "builder", label: "策略组装", children: <StrategyBuilder /> },
        { key: "signals", label: "信号库", children: <SignalLibraryPage /> },
        { key: "slots", label: "周期槽位", children: <SlotTemplatesPage /> },
      ]}
    />
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
          <Card key={instance.id} title={instance.name} extra={<Tag color="green">{instance.symbols.length} 个币种挂载</Tag>}>
            <Descriptions title={template?.name ?? "策略实例"} column={{ xs: 1, md: 3 }} size="small">
              {template?.slots.map((slot) => (
                <Descriptions.Item key={slot.key} label={`${slot.label} / ${instance.slots[slot.key]}`}>
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

function SignalsCenter() {
  const { signals, selectSignal } = useAppStore();
  const [filter, setFilter] = useState<"all" | Signal["strength"]>("all");
  const visible = filter === "all" ? signals : signals.filter((signal) => signal.strength === filter);
  const columns: ColumnsType<Signal> = [
    { title: "时间", dataIndex: "createdAt", width: 100 },
    { title: "币种", dataIndex: "symbol", width: 120 },
    { title: "强度", dataIndex: "strength", width: 110, render: (value: Signal["strength"]) => <Tag color={strengthMeta[value].color}>{strengthMeta[value].label}</Tag> },
    { title: "方向", dataIndex: "direction", width: 100 },
    { title: "原因", dataIndex: "reason" },
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

function TimeframeSelector() {
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

function MoneyFlow() {
  const { moneyFlows } = useAppStore();
  const columns: ColumnsType<(typeof moneyFlows)[number]> = [
    { title: "币种", dataIndex: "symbol" },
    { title: "资金费率", dataIndex: "fundingRate", align: "right", render: (value: number) => `${value}%` },
    { title: "OI 变化", dataIndex: "oiChange", align: "right", render: (value: number) => <Text type={value >= 0 ? "success" : "danger"}>{value}%</Text> },
    { title: "主动买入", dataIndex: "takerBuyRatio", align: "right", render: (value: number) => `${value}%` },
    { title: "大户多头", dataIndex: "topLongRatio", align: "right", render: (value: number) => `${value}%` },
    { title: "净流入", dataIndex: "netFlow", align: "right", render: (value: number) => <Text type={value >= 0 ? "success" : "danger"}>{value}M</Text> },
  ];

  return (
    <Card title="资金流分析">
      <Table rowKey="symbol" columns={columns} dataSource={moneyFlows} pagination={false} scroll={{ x: 760 }} />
    </Card>
  );
}

function SettingsPage() {
  const settings = [
    ["交易所配置", "Binance Futures，只读 API Key，后端加密保存。"],
    ["信号参数", "信号库参数独立保存，策略只引用信号 ID 和版本。"],
    ["周期槽位", "槽位模板独立管理，策略实例只保存选中的模板和填充结果。"],
    ["推送规则", "强信号即时推送，观察信号进入队列，重复信号静默。"],
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
  const { signals, selectedSignalId, selectSignal, strategyInstances } = useAppStore();
  const signal = signals.find((item) => item.id === selectedSignalId);
  const strategy = strategyInstances.find((item) => item.id === signal?.instanceId);

  return (
    <Drawer title="信号详情" open={Boolean(signal)} onClose={() => selectSignal(null)} width={460}>
      {signal && (
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="币种">{signal.symbol}</Descriptions.Item>
          <Descriptions.Item label="强度"><Tag color={strengthMeta[signal.strength].color}>{strengthMeta[signal.strength].label}</Tag></Descriptions.Item>
          <Descriptions.Item label="策略">{strategy?.name ?? signal.instanceId}</Descriptions.Item>
          <Descriptions.Item label="方向">{signal.direction}</Descriptions.Item>
          <Descriptions.Item label="触发原因">{signal.reason}</Descriptions.Item>
          <Descriptions.Item label="资金流确认">{signal.flowConfirm}</Descriptions.Item>
          <Descriptions.Item label="推送状态">{signal.pushStatus}</Descriptions.Item>
        </Descriptions>
      )}
    </Drawer>
  );
}

function App() {
  const { activeSection, setActiveSection, strategyStates, signals } = useAppStore();
  const title = navItems.find((item) => item.id === activeSection)?.label ?? "工作台";
  const content = useMemo(() => {
    switch (activeSection) {
      case "market":
        return <MarketMonitor />;
      case "builder":
        return <StrategyWorkspace />;
      case "runtime":
        return <StrategyRuntime />;
      case "signals":
        return <SignalsCenter />;
      case "timeframe":
        return <TimeframeSelector />;
      case "flow":
        return <MoneyFlow />;
      case "settings":
        return <SettingsPage />;
      default:
        return <Dashboard />;
    }
  }, [activeSection]);

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
            selectedKeys={[activeSection]}
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
