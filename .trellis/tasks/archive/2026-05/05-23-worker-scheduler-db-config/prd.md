# Worker 调度读取后端策略配置

## Goal

让后端 Worker 定时调度可以直接从数据库 `strategy_instances` 读取已启用策略配置启动，前端启动调度时不再必须提交完整策略实例快照。

## What I already know

* 后端已经持久化完整策略配置字段，`strategy_instances` 可以作为策略配置事实源。
* 当前调度接口 `POST /api/strategy/worker/scheduler/start` 要求请求体包含 `worker_request`。
* 当前前端 `startWorkerScheduler` 会把 `strategyInstances`、行情快照、资金流、信号、状态一并发给后端。
* Worker 运行仍需要行情、资金流、已有状态和已有信号。第一版数据库配置模式先从 DB 读取策略、状态、信号；行情快照若未提供则为空，后续再接后端行情事实源。

## Requirements

* 调度启动请求支持两种来源：
  * `request`：兼容旧模式，使用请求里的 `worker_request`。
  * `database`：新模式，每轮运行从数据库读取已启用策略实例、已有状态和已有信号。
* `database` 模式下，`worker_request` 可为空。
* `request` 模式下，`worker_request` 仍必填，保持旧接口兼容。
* 后端调度器每轮运行都重新读取数据库策略配置，避免启动后策略变更不生效。
* 前端启动调度改为数据库配置模式，只传 `config_source=database`、`interval_seconds=60`、`persist=true`。
* 失败时保持现有错误记录方式，不清空旧调度状态。

## Acceptance Criteria

* [ ] `POST /api/strategy/worker/scheduler/start` 在 `config_source=database` 且没有 `worker_request` 时返回 200。
* [ ] 数据库模式只运行 enabled 策略。
* [ ] 数据库模式从持久化状态/信号构造 `existing_states` / `existing_signals`。
* [ ] `request` 模式缺少 `worker_request` 返回 422。
* [ ] 前端 `startWorkerScheduler` 不再发送策略实例快照。
* [ ] 后端 scheduler 测试、前端 store 测试、ruff、pytest、TypeScript、build 通过。

## Definition of Done

* 后端 scheduler service/API 测试覆盖数据库配置模式和兼容模式。
* 前端 store/API client 测试覆盖新的启动请求体。
* `.trellis/spec/` 更新调度契约。
* 中文提交并归档任务。

## Technical Approach

在 `StrategyWorkerScheduleRequest` 增加 `config_source` 字段，默认 `request` 兼容旧调用；`worker_request` 改为可选，并用 Pydantic model validator 保证 `request` 模式下必填。

调度器执行时：

* `request` 模式：继续使用启动请求里的 `worker_request`。
* `database` 模式：打开 DB session，读取 `strategy_instances`、`strategy_states`、`strategy_signals` 组装 `StrategyWorkerRunRequest`。
* `persist=true` 时复用同一个 session 写入 Worker 结果并提交。

前端 `startBackendStrategyWorkerScheduler` 改为只提交调度配置，旧快照启动能力保留为 client 可选参数。

## Out of Scope

* 不在本任务中接后端行情/K 线事实源。
* 不做后台调度重启恢复。
* 不做 WebSocket/SSE 推送。
* 不做 Worker 从数据库读取策略模板或条件库。

## Technical Notes

* 后端模型：`backend/app/models/strategy.py`
* 调度器：`backend/app/services/strategy_engine/scheduler.py`
* 策略 repository：`backend/app/services/strategy_engine/repository.py`
* API：`backend/app/api/strategy.py`
* 前端 API client：`src/services/backendStrategyApi.ts`
* 前端 store：`src/store/appStore.ts`
