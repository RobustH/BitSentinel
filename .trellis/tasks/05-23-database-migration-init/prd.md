# 数据库表迁移与初始化

## Goal

为当前真实 PostgreSQL 数据库提供可执行的策略表初始化能力，让 `persist=true` 的策略 Worker 持久化接口在真实数据库中有表可写。

## What I Already Know

* 数据库连接已通过后端 `.env` 的 `BITSENTINEL_DATABASE_URL` 配置。
* 数据库连接测试接口已验证真实库 `bitsentinel` 可连接。
* 当前 SQLAlchemy ORM 模型已经定义：
  * `strategy_states`
  * `strategy_signals`
* 当前只有测试里使用 SQLite `Base.metadata.create_all`，真实数据库没有正式初始化入口。
* 项目暂未引入 Alembic，当前依赖里只有 SQLAlchemy 和 psycopg。

## Requirements

* 新增后端数据库初始化命令，使用后端配置文件中的数据库连接。
* 初始化命令创建当前受管理的策略持久化表：`strategy_states`、`strategy_signals`。
* 初始化必须幂等：重复运行不应报错、不应破坏已有数据。
* 初始化命令不得打印数据库密码或完整连接串。
* 不新增公开 HTTP 建表接口，避免在未认证阶段暴露危险运维动作。
* 保持 `/api/health` 和数据库连接测试接口语义不变。

## Acceptance Criteria

* [ ] 可以运行 `python -m app.scripts.init_db` 初始化策略持久化表。
* [ ] 初始化成功时输出 JSON 摘要，包含目标库脱敏信息和表名。
* [ ] 初始化失败时输出错误类别摘要并返回非 0 退出码。
* [ ] 初始化逻辑有单元测试，覆盖首次创建和重复运行。
* [ ] README 或规格说明记录初始化命令。
* [ ] `pytest` 和 `ruff check .` 通过。

## Definition of Done

* Tests added/updated.
* Lint and backend test suite green.
* Specs updated for the new database initialization contract.
* Commit plan presented before committing.

## Technical Approach

当前阶段先实现轻量初始化脚本，不引入 Alembic 依赖。具体做法：

* 新增数据库初始化 service，显式注册 `app.db.strategy` 模型。
* 使用 SQLAlchemy inspector 获取初始化前后的表状态。
* 使用 `Base.metadata.create_all(..., checkfirst=True)` 幂等创建当前受管理表。
* 新增 `app.scripts.init_db` CLI，读取 `Settings`，创建临时 engine，执行初始化并打印 JSON。

后续如果表结构开始频繁演进，再单独引入 Alembic 迁移体系。

## Decision (ADR-lite)

**Context**: 现在主要缺口是“真实库没有表”，而不是复杂 schema 版本演进。项目还没有 Alembic 依赖，当前需要先打通真实持久化闭环。

**Decision**: 先做 CLI 初始化脚本，保持幂等和可测试；不做无认证 HTTP 建表接口。

**Consequences**: 当前可以快速创建真实表并验证持久化 API。未来字段变更、历史迁移、回滚等能力需要升级到 Alembic。

## Out of Scope

* 不引入 Alembic。
* 不做公开 HTTP 初始化接口。
* 不做自动启动时建表。
* 不修改现有 ORM 表结构。
* 不创建行情、回测、用户等其他业务表。

## Technical Notes

* Relevant files:
  * `backend/app/db/base.py`
  * `backend/app/db/strategy.py`
  * `backend/app/core/database.py`
  * `backend/app/services/database/connection.py`
  * `backend/README.md`
  * `.trellis/spec/architecture/backend-roadmap.md`

## Verification Notes

* 2026-05-23: 已执行 `python -m app.scripts.init_db`，真实数据库 `bitsentinel` 返回 `ok = true`。
* 本次创建/确认表：
  * `strategy_signals`
  * `strategy_states`
* 已验证查询接口可用：
  * `GET /api/strategy/states` 返回 `[]`
  * `GET /api/strategy/signals` 返回 `[]`
