# 后端策略 Worker 原型研究记录

## 本地规范依据

- `.trellis/spec/architecture/technology-boundaries.md`：Python 后端负责指标计算、策略状态机、信号生成和告警触发；浏览器端 evaluator 属于原型层。
- `.trellis/spec/architecture/backend-roadmap.md`：第四阶段策略 Worker 应读取策略模板和策略实例，按 `strategy_instance_id + symbol` 独立维护状态，执行多周期条件链并生成信号/状态变更事件。
- `.trellis/spec/frontend/state-management.md`：前端 evaluator 的输出模型已经包含 `StrategyEvaluationResult`、条件明细、评分、建议状态和触发信号布尔值。

## 当前代码状态

- `backend/app/services/strategy_engine/evaluator.py` 已定义 `ConditionResult`、`StrategyEvaluationResult`、`StrategyEvaluator`，但所有条件当前返回未命中。
- `backend/app/services/strategy_engine/worker.py` 只有 `start/stop/running` 状态，不做调度和评估。
- `backend/app/models/domain.py` 已有 `StrategyInstance`、`ConditionBlock`、`StrategyState`、`SignalRecord` 等领域 dataclass。
- `src/services/strategyEvaluator.ts` 已实现可迁移的 MVP 条件逻辑：
  - EMA 趋势、EMA 金叉、MACD 动量扩张
  - OI 上升、主动买入占优、资金费率不过热
  - 趋势失效、结构波动扩大

## MVP 建议

第一版先做“按请求评估”的后端纯函数服务和 API，而不是后台常驻 Worker：

1. 设计后端请求/响应模型，允许调用方传入策略实例、条件、K 线、资金流和已有信号。
2. 实现 Python evaluator，输出 `strategy_instance_id + symbol` 粒度结果。
3. 新增 API，例如 `POST /api/strategy/evaluate`，用于前端或后续 Worker 调用。
4. 保留 `StrategyWorker` 为后续调度层，暂不引入任务循环、队列或数据库。

## 选择理由

- 现有项目还没有策略配置数据库，直接做常驻 Worker 会过早引入状态持久化问题。
- 按请求评估能先固定策略计算契约，后续数据库、调度器、WebSocket/SSE 都可以复用。
- 测试更直接，可以用固定 K 线和资金流样本覆盖状态机边界。

## 风险

- 前端现有 evaluator 使用浏览器侧类型，Python 版本需要明确后端字段命名，避免中英文 UI 文案耦合进服务层。
- 指标摘要 API 当前只返回 summary，不返回完整 EMA 序列；EMA 金叉、结构波动等条件仍需要 K 线输入或在 evaluator 内部计算。
- 资金流后端数据尚不完整，第一版建议通过请求输入模拟或使用可选字段。
