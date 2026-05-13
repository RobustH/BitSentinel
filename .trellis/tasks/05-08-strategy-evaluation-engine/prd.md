# 策略条件计算引擎原型

## Goal

把实时/刷新后的市场数据接到策略条件计算中，让系统能自动判断每个策略挂载币种当前处于观察、等待触发、触发、失效或冷却状态，并在满足触发条件时生成信号。

## Requirements

- 新增策略计算服务层，使用纯函数计算，不在组件里写业务判断。
- 支持当前信号库中的核心信号：
  - `ema-trend-up`
  - `ema-cross-up`
  - `macd-expansion`
  - `oi-rising`
  - `taker-buy-dominant`
  - `funding-not-hot`
  - `trend-invalid`
  - `structure-squeeze-end`
- Store 增加 `strategyEvaluations`。
- Store 增加 `evaluateStrategyMonitors` action。
- 计算粒度必须是 `strategyInstanceId + symbol`。
- 计算结果包含：
  - 每个条件是否命中
  - 命中率/评分
  - 建议状态
  - 下一步等待内容
  - 是否应该触发信号
- 行情 REST 刷新和 WebSocket ticker 到达后自动执行计算。
- 手动提供“重新计算策略”按钮，方便调试。
- 监控中心展示每个策略/币种的计算结果。

## Acceptance Criteria

- [ ] 页面能看到每个策略挂载币种的计算评分和命中条件数。
- [ ] REST 刷新后会自动更新策略计算结果。
- [ ] WebSocket ticker 到达后会自动更新策略计算结果。
- [ ] 满足触发条件时会生成一条信号，并把状态更新为 `triggered`。
- [ ] 未满足触发时，会把状态更新为 `watching` 或 `waiting_trigger`。
- [ ] 失效条件满足时，会把状态更新为 `invalidated`。
- [ ] TypeScript 检查和现有测试通过。

## Technical Approach

- 新增 `src/services/strategyEvaluator.ts`：
  - `evaluateStrategyInstance(...)`
  - `evaluateAllStrategyInstances(...)`
  - 内置轻量 EMA/MACD/资金流条件函数。
- 更新 `src/types.ts`：
  - `ConditionEvaluation`
  - `StrategyEvaluationResult`
- 更新 `src/store/appStore.ts`：
  - `strategyEvaluations`
  - `evaluateStrategyMonitors`
  - REST/WebSocket 更新行情后调用计算。
- 更新 `src/App.tsx`：
  - 监控中心或策略运行页展示计算结果。
  - 增加“重新计算策略”按钮。

## Decision (ADR-lite)

**Context**：当前系统已有行情和策略配置，但缺少自动判断逻辑。

**Decision**：先在前端实现纯函数 evaluator 原型，验证产品闭环；后续后端 Worker 可复用同样的数据结构和规则。

**Consequences**：能快速让原型具备策略监控能力；但多周期真实 K 线、历史回测一致性和后端计算性能留到后续任务。

## Out of Scope

- 不做真实下单。
- 不做后端 Worker。
- 不做完整多周期 K 线数据库。
- 不做复杂回测指标复用。

## Research References

- [`research/strategy-evaluation-engine.md`](research/strategy-evaluation-engine.md)：当前数据结构、MVP 计算规则和输出模型。
