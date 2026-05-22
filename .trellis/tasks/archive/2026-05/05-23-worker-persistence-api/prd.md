# Worker 持久化闭环 API

## Goal

把现有 `POST /api/strategy/worker/run-once` 和 `StrategyPersistenceRepository` 串起来，让 Worker 单次运行可以选择写入策略状态/信号表，并提供后端查询 API 查看当前持久化状态和信号。

## Requirements

* `POST /api/strategy/worker/run-once` 支持可选参数 `persist`：
  * `persist=false` 保持当前纯运行行为。
  * `persist=true` 将 `state_events` 和 `generated_signals` 写入 repository 并提交事务。
* Worker run response 返回可选 `persistence` 摘要。
* 新增查询 API：
  * `GET /api/strategy/states`
  * `GET /api/strategy/signals`
* 查询 API 支持可选过滤：
  * `instance_id`
  * `symbol`
* 测试使用 SQLite 内存数据库覆盖 API，不依赖本地 PostgreSQL。

## Acceptance Criteria

* [ ] `persist=false` 不访问/写入数据库。
* [ ] `persist=true` 写入状态和信号，并返回持久化计数。
* [ ] `GET /api/strategy/states` 能返回当前状态。
* [ ] `GET /api/strategy/signals` 能返回信号。
* [ ] `ruff check .` 通过。
* [ ] `pytest` 通过。

## Definition of Done

* API、模型、repository 和测试完成。
* 不新增 Alembic 迁移，不自动创建生产表。
* 不改前端。
* 使用中文提交信息。

## Technical Approach

* 在 `backend/app/models/strategy.py` 增加持久化摘要和查询响应模型。
* 在 `StrategyPersistenceRepository` 增加 `list_states` / `list_signals`。
* 在 `backend/app/api/strategy.py` 注入 `get_db_session`，实现可选持久化和查询 API。
* 测试通过 FastAPI dependency override 使用 SQLite 内存数据库。

## Out of Scope

* 不实现前端接入。
* 不实现 Worker 定时调度。
* 不实现 Alembic 迁移。
* 不实现真实告警。
