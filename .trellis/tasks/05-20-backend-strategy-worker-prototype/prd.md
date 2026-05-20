# 后端策略 Worker 原型

## Goal

实现后端策略 Worker 的最小可测试原型，让后端在单次运行中复用现有 `StrategyEvaluator`，根据策略实例、K 线、资金流、已有信号和已有状态生成评估结果、状态变更事件和新信号事件。这个任务先打通 Worker 领域服务和手动 API 入口，为后续定时调度、数据库持久化、告警和模拟交易打基础。

## What I Already Know

* 后端已有 `POST /api/strategy/evaluate` 和纯函数式 `StrategyEvaluator`。
* `backend/app/services/strategy_engine/worker.py` 目前只是 start/stop 占位。
* 架构规范要求策略 Worker 负责读取策略实例、按 `strategy_instance_id + symbol` 独立维护状态、生成信号和状态变更事件。
* 当前任务不应引入真实交易、真实告警、数据库迁移或常驻调度。
* 前端已经能调用后端评估 API，后续可以消费 Worker run summary。

## Requirements

* 新增/扩展后端 Worker 输入输出模型：
  * 输入包含现有策略评估请求字段。
  * 输入可携带 `existing_states`，用于比较状态变化。
  * 输出包含 `run_id`、`evaluated_count`、`generated_signal_count`、`state_events`、`generated_signals`、`results`。
* `StrategyWorker.run_once(request)` 必须：
  * 调用现有 `StrategyEvaluator.evaluate_all`。
  * 按 `instance_id + symbol` 比较旧状态和新状态。
  * 只在状态发生变化时生成状态事件。
  * 只在 `should_trigger_signal = true` 时生成新信号事件。
  * 不写数据库、不发通知、不下单。
* 新增手动 API 入口 `POST /api/strategy/worker/run-once`，方便前端或测试触发一次 Worker 运行。
* 补后端测试覆盖：
  * Worker 能生成状态事件。
  * Worker 能生成信号事件。
  * 已有强信号时不重复生成信号。
  * disabled 策略不输出结果。

## Acceptance Criteria

* [ ] `POST /api/strategy/worker/run-once` 返回 Worker run summary。
* [ ] `StrategyWorker.run_once` 复用 evaluator，不复制策略条件计算。
* [ ] 状态事件按 `instance_id + symbol` 独立生成。
* [ ] 重复强信号不会产生新信号事件。
* [ ] `ruff check .` 通过。
* [ ] `pytest` 通过。

## Definition of Done

* 后端模型、服务、API 和测试完成。
* 不引入数据库、调度器、真实告警或交易副作用。
* 规范如有新增 Worker 契约则同步更新 `.trellis/spec/architecture/backend-roadmap.md`。
* 使用中文提交信息。

## Technical Approach

* 在 `backend/app/models/strategy.py` 中扩展 Worker 相关 Pydantic 模型，复用现有 `StrategyEvaluationRequest` / `StrategyEvaluationResult`。
* 在 `backend/app/services/strategy_engine/worker.py` 实现 `run_once`：
  * `run_id` 使用 UUID。
  * `ran_at` 使用 UTC ISO 时间。
  * `state_events` 只描述本次运行产生的状态变更。
  * `generated_signals` 只描述本次运行应生成的新信号。
* 在 `backend/app/api/strategy.py` 添加 `/worker/run-once` 子路径。
* 新增 `backend/tests/test_strategy_worker.py` 或扩展策略 API 测试。

## Decision (ADR-lite)

**Context**: 后端已有按请求评估 API，但还没有 Worker 层来表达“评估之后产生状态事件和信号事件”的系统边界。

**Decision**: 本任务先做 run-once Worker，不做常驻循环和数据库持久化。

**Consequences**: 可以测试 Worker 的核心状态转换和信号生成规则，同时避免过早绑定调度器、数据库 schema 或告警通道。后续任务可把 `run_once` 接入定时循环、DB repository 和推送层。

## Out of Scope

* 不实现后台常驻循环。
* 不接 PostgreSQL / TimescaleDB。
* 不实现真实邮件、WebSocket、SSE 或微信推送。
* 不实现真实交易或模拟交易入库。
* 不改前端 UI。

## Technical Notes

* Relevant specs:
  * `.trellis/spec/architecture/index.md`
  * `.trellis/spec/architecture/technology-boundaries.md`
  * `.trellis/spec/architecture/backend-roadmap.md`
  * `.trellis/spec/guides/index.md`
* Existing code:
  * `backend/app/models/strategy.py`
  * `backend/app/services/strategy_engine/evaluator.py`
  * `backend/app/services/strategy_engine/worker.py`
  * `backend/app/api/strategy.py`
  * `backend/tests/test_strategy_api.py`
