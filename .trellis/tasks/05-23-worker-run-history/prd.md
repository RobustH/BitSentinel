# Worker运行历史落库与查询

## Goal

把 `POST /api/strategy/worker/run-once?persist=true` 的运行摘要记录到数据库，并提供查询 API，让后续前端可以展示 Worker 历史运行列表，而不是只依赖页面内存里的最近一次结果。

## What I already know

* 后端已有 `StrategyWorkerRunResponse`，包含 `run_id`、`ran_at`、`evaluated_count`、`generated_signal_count`。
* 后端已有 `StrategyPersistenceRepository.apply_worker_run()`，负责落库当前策略状态和信号。
* 真实数据库初始化命令已由 `initialize_database()` / `python -m app.scripts.init_db` 管理当前策略表。
* 架构规范要求 Worker、数据库和事实状态留在 Python 后端，前端只消费 API。

## Requirements

* 新增 Worker 运行历史表，至少保存：
  * `run_id`
  * `ran_at`
  * `evaluated_count`
  * `generated_signal_count`
  * `upserted_state_count`
  * `inserted_signal_count`
* `persist=true` 时，API 在同一事务中写入运行历史、策略状态和信号。
* `persist=false` 时保持纯运行行为，不写入运行历史。
* 新增查询 API：`GET /api/strategy/worker/runs`，按运行时间倒序返回最近运行记录。
* 查询 API 支持 `limit` 参数，默认返回有限条数，避免无界列表。
* 初始化命令需要把 Worker 运行历史表纳入 managed tables。
* repository 仍只 `flush`，不隐式 `commit`，事务边界由 API 控制。

## Acceptance Criteria

* [x] `persist=true` 后数据库存在对应 run history 记录。
* [x] `persist=false` 不写入 run history。
* [x] `GET /api/strategy/worker/runs` 返回倒序历史记录，并支持 limit。
* [x] 数据库初始化命令包含新的运行历史表。
* [x] 后端测试覆盖 repository、API 和初始化表清单。
* [x] `pytest` 通过。

## Definition of Done

* Tests added/updated.
* Backend API/model/repository boundaries stay consistent.
* Trellis backend spec updated if新增契约有复用价值。
* Changes committed with Chinese commit message.

## Technical Approach

在 `backend/app/db/strategy.py` 增加 `StrategyWorkerRunRecord`，在 `backend/app/models/strategy.py` 增加持久化运行历史响应模型。扩展 `StrategyPersistenceRepository.apply_worker_run()`：先消费状态和信号事件，再插入或更新同 `run_id` 的历史摘要，并提供 `list_worker_runs(limit)` 查询方法。API 层在 `persist=true` 提交事务后返回原有响应结构，同时新增 `GET /api/strategy/worker/runs`。

## Decision (ADR-lite)

**Context**: 前端已经能手动触发 Worker 并显示最后一次摘要，但摘要没有后端事实记录，刷新页面后不可追溯。

**Decision**: 先做后端运行历史事实表和查询 API，不做定时调度或前端历史列表。

**Consequences**: 后续可以直接在前端接入历史列表，也能为自动调度、告警审计和失败排查打基础；短期仍不会记录 `persist=false` 的纯评估运行。

## Out of Scope

* 不做 Worker 定时调度。
* 不做前端历史列表。
* 不记录每条条件明细或完整请求快照。
* 不引入 Alembic 迁移框架。
* 不改变现有 `/api/strategy/worker/run-once` 响应字段。

## Technical Notes

* Relevant files:
  * `backend/app/models/strategy.py`
  * `backend/app/db/strategy.py`
  * `backend/app/services/strategy_engine/repository.py`
  * `backend/app/api/strategy.py`
  * `backend/app/services/database/initializer.py`
  * `backend/tests/test_strategy_persistence_api.py`
  * `backend/tests/test_strategy_persistence_repository.py`
  * `backend/tests/test_database_initializer.py`
* Relevant specs:
  * `.trellis/spec/architecture/backend-roadmap.md`
  * `.trellis/spec/architecture/technology-boundaries.md`

## Verification Notes

* 2026-05-23: `backend/.venv/Scripts/python.exe -m ruff check .` 通过。
* 2026-05-23: `backend/.venv/Scripts/python.exe -m pytest` 通过，39 个后端测试全部通过。
