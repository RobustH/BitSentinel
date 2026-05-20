# 策略状态和信号持久化

## Goal

为后端策略 Worker 的输出增加可测试的持久化层原型，把 `state_events` 和 `generated_signals` 从一次性返回结果推进到后端事实状态。第一版只实现 SQLAlchemy ORM 模型和 repository，使用测试内存数据库验证状态 upsert 和信号插入，为后续 PostgreSQL 迁移、Worker 调度和前端查询 API 做准备。

## What I Already Know

* 后端已有 SQLAlchemy `engine` / `SessionLocal` 基础设施，但没有 ORM Base、迁移或 repository。
* 后端 `StrategyWorker.run_once` 已能输出 `state_events`、`generated_signals` 和 `results`。
* 架构规范中明确 Zustand `strategyStates` / `signals` 后续应迁移到 PostgreSQL。
* 当前没有 Alembic 迁移框架；直接做生产迁移会扩大任务范围。

## Requirements

* 新增 SQLAlchemy ORM Base。
* 新增策略持久化 ORM 模型：
  * `StrategyStateRecord`：按 `strategy_instance_id + symbol` 唯一保存当前状态。
  * `StrategySignalRecord`：保存 Worker 生成的信号事件。
* 新增 repository：
  * `apply_worker_run(run_response)`：消费 Worker run summary。
  * 状态事件执行 upsert。
  * 信号事件执行 insert。
  * commit 由调用方控制，repository 不隐式 commit。
* 新增测试：
  * 首次状态事件会插入状态。
  * 后续同 `strategy_instance_id + symbol` 状态事件会更新已有状态。
  * 信号事件会插入信号记录。
  * 重复调用同一个信号事件不重复插入。

## Acceptance Criteria

* [ ] repository 能消费 `StrategyWorkerRunResponse`。
* [ ] `strategy_instance_id + symbol` 状态唯一性由 ORM/repository 共同保证。
* [ ] 信号事件持久化具备幂等保护。
* [ ] 测试使用 SQLite 内存数据库，不依赖本地 PostgreSQL。
* [ ] `ruff check .` 通过。
* [ ] `pytest` 通过。

## Definition of Done

* 后端 ORM Base、持久化模型、repository 和测试完成。
* 不新增 Alembic、不改真实数据库连接、不要求本地 PostgreSQL 可用。
* 不把持久化副作用塞回 evaluator。
* 如新增持久化契约，更新 `.trellis/spec/architecture/backend-roadmap.md`。
* 使用中文提交信息。

## Technical Approach

* 新建 `backend/app/db/base.py` 定义 SQLAlchemy `DeclarativeBase`。
* 新建 `backend/app/db/strategy.py` 定义策略状态和信号 ORM 表。
* 新建 `backend/app/services/strategy_engine/repository.py` 定义 `StrategyPersistenceRepository`。
* repository 从 `StrategyWorkerRunResponse` 的 `state_events` 和 `generated_signals` 写入数据库。
* 测试用 `sqlite+pysqlite:///:memory:` 创建表并验证 repository 行为。

## Decision (ADR-lite)

**Context**: Worker 已能生成事件，但还没有后端事实状态；同时项目还没有迁移框架。

**Decision**: 本任务先做 ORM + repository 原型，不做 Alembic 迁移和 API 查询。

**Consequences**: 可以先锁定持久化契约和幂等行为，降低后续接 Postgres 迁移、Worker 定时循环和前端查询 API 的不确定性。

## Out of Scope

* 不接 Alembic 迁移。
* 不新增查询 API。
* 不改前端。
* 不接 Worker 定时循环。
* 不接真实告警或模拟交易。

## Technical Notes

* Relevant specs:
  * `.trellis/spec/architecture/index.md`
  * `.trellis/spec/architecture/technology-boundaries.md`
  * `.trellis/spec/architecture/backend-roadmap.md`
  * `.trellis/spec/guides/index.md`
* Existing code:
  * `backend/app/core/database.py`
  * `backend/app/models/strategy.py`
  * `backend/app/services/strategy_engine/worker.py`
