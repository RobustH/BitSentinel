# 后端策略 Worker 原型

## Goal

把前端策略条件计算原型迁移到 Python 后端，建立最小的后端策略评估闭环：读取策略实例、交易对、指标摘要和资金流输入，输出策略状态建议、条件命中结果和是否应生成信号。目标是让策略状态机逐步成为后端事实源，而不是继续依赖浏览器端 evaluator。

## What I already know

- 当前 Trellis 活跃任务已清空，`main` 已推送到远端。
- 后端已有 FastAPI 骨架、`/api/market/*` 行情接口、`/api/indicators/summary` 指标摘要接口。
- 后端 `backend/app/services/strategy_engine/evaluator.py` 和 `worker.py` 已存在，但目前是占位实现。
- 前端已有 `src/services/strategyEvaluator.ts`，支持 EMA/MACD、OI、主动买入、资金费率和趋势失效等原型条件。
- 架构规范要求 Python 后端负责指标计算、策略状态机、信号生成和后续 Worker。

## Assumptions (temporary)

- 第一版先做纯函数 evaluator 和可测试 API，不做后台常驻调度循环。
- 第一版只支持已存在前端信号库中的核心条件，不接数据库。
- 资金流类条件可以通过请求 payload 注入，避免本任务扩大到完整资金流后端采集。
- 策略配置也先通过请求 payload 注入，后续再接数据库持久化。

## Open Questions

- 已确认：MVP 只做“按请求评估”的 API，不做内存级调度开关。

## Requirements (evolving)

- 后端新增策略评估模型，表达策略实例、条件、资金流输入、评估结果和信号建议。
- 后端实现纯函数策略 evaluator，计算粒度为 `strategyInstanceId + symbol`。
- 新增 `POST /api/strategy/evaluate`，请求体传入策略实例、条件、K 线、资金流和已有信号。
- 支持核心条件：
  - `ema-trend-up`
  - `ema-cross-up`
  - `macd-expansion`
  - `oi-rising`
  - `taker-buy-dominant`
  - `funding-not-hot`
  - `trend-invalid`
  - `structure-squeeze-end`
- 评估结果包含条件明细、命中数、总条件数、评分、建议状态、下一步等待内容、是否应触发信号。
- API 支持一次性评估一个或多个策略实例。
- 增加后端测试覆盖状态流转、触发信号、失效条件和资金流条件。

## Acceptance Criteria (evolving)

- [ ] 后端 evaluator 对每个 `strategyInstanceId + symbol` 输出一条评估结果。
- [ ] `POST /api/strategy/evaluate` 返回 200，并按请求中的策略实例和 symbol 返回评估结果。
- [ ] 方向条件满足但结构/触发未满足时，建议状态为 `watching` 或 `waiting_trigger`。
- [ ] 方向、结构、触发、确认条件满足时，建议状态为 `triggered` 且 `should_trigger_signal = true`。
- [ ] `trend-invalid` 命中时，建议状态为 `invalidated`。
- [ ] K 线或资金流不足时不抛异常，条件返回未命中和可解释原因。
- [ ] `ruff check .` 通过。
- [ ] `pytest` 通过。

## Definition of Done

- Tests added/updated for backend evaluator and API.
- Lint and tests pass.
- Trellis specs updated if this task introduces new API/contract knowledge.
- No database migration or real trading capability is introduced.

## Out of Scope

- 不做数据库表、迁移或持久化状态。
- 不做后台常驻定时调度或内存级 `start/stop` 调度开关。
- 不做真实下单、API Key、账户资产、订单管理。
- 不做多周期数据自动聚合和回测。
- 不改前端页面，除非后续单独任务接入该 API。

## Technical Notes

- Relevant specs:
  - `.trellis/spec/architecture/backend-roadmap.md`
  - `.trellis/spec/architecture/technology-boundaries.md`
  - `.trellis/spec/frontend/state-management.md`
- Existing backend files:
  - `backend/app/services/strategy_engine/evaluator.py`
  - `backend/app/services/strategy_engine/worker.py`
  - `backend/app/models/domain.py`
  - `backend/app/models/indicator.py`
  - `backend/app/api/router.py`
- Existing frontend reference:
  - `src/services/strategyEvaluator.ts`
- Research:
  - [`research/backend-strategy-worker-prototype.md`](research/backend-strategy-worker-prototype.md)

## Decision (ADR-lite)

**Context**: 当前已有后端行情和指标摘要接口，但策略配置、策略状态和信号记录还没有数据库持久化。直接做常驻 Worker 会过早引入调度、状态恢复和数据一致性问题。

**Decision**: MVP 只实现按请求评估的后端 API：`POST /api/strategy/evaluate`。API 接收策略实例、条件、K 线、资金流和已有信号，返回每个 `strategyInstanceId + symbol` 的评估结果。

**Consequences**: 先固定策略计算契约和测试边界，后续数据库、定时 Worker、WebSocket/SSE 推送可以复用 evaluator；缺点是本任务不会提供自动后台运行能力。
