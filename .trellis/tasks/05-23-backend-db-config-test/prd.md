# 后端数据库连接配置与测试

## Goal

让数据库连接只通过后端配置文件管理，并提供一个后端测试接口，用于确认当前配置的数据库是否可连接。这个任务不做页面编辑数据库连接，避免把数据库凭据暴露到浏览器或前端状态中。

## What I Already Know

* 用户明确要求：不在页面上配置数据库连接，改为在后端配置文件里配置。
* 当前后端使用 `BITSENTINEL_DATABASE_URL` / `Settings.database_url` 作为数据库连接来源。
* 当前数据库入口是 `backend/app/core/database.py`，启动时创建 SQLAlchemy engine 和 `SessionLocal`。
* 当前 `/api/health` 不依赖数据库，符合已有架构规范。
* 数据库相关能力应留在 Python FastAPI 后端，不进入前端或 Node 工具链。

## Requirements

* 后端配置文件继续作为数据库连接唯一来源，示例配置写入 `backend/.env.example`。
* 新增后端数据库连接测试能力，使用当前后端配置的 `database_url` 发起轻量 SQL 检查。
* 测试接口不得返回完整数据库连接串、用户名、密码或其他敏感凭据。
* 数据库不可用时，接口返回明确失败结果，不影响 `/api/health`。
* 保持现有策略持久化 API 的数据库依赖注入方式可用。

## Acceptance Criteria

* [ ] 后端存在可调用的数据库连接测试接口。
* [ ] 连接成功时返回成功状态和基础数据库信息，且不泄露连接密码。
* [ ] 连接失败时返回失败状态和可读错误摘要，HTTP 行为可被测试覆盖。
* [ ] `.env.example` 说明数据库 URL 由后端配置文件管理。
* [ ] 后端测试覆盖成功和失败分支。
* [ ] `pytest` 和 `ruff check .` 通过。

## Definition of Done

* Tests added/updated.
* Lint and backend test suite green.
* Specs updated if this introduces a durable API contract.
* Commit plan presented before committing.

## Technical Approach

新增后端-only 的系统/数据库测试接口，优先放在独立 API 模块，例如 `backend/app/api/system.py` 或 `backend/app/api/database.py`。接口通过后端当前配置创建/复用连接，并执行 `SELECT 1` 或等价 SQLAlchemy `text("SELECT 1")` 检查。

为避免测试时依赖真实 PostgreSQL，连接测试逻辑应做成小服务函数，可用 SQLite 内存库或 monkeypatch engine/session factory 覆盖。

## Decision (ADR-lite)

**Context**: 数据库连接包含凭据，不适合由前端页面编辑和保存。当前项目也已经把数据库、Worker、策略状态事实源放在 Python 后端。

**Decision**: 数据库连接只通过后端配置文件和环境变量配置；前端最多触发测试动作，不参与保存连接信息。本任务先实现后端测试能力，不做页面配置。

**Consequences**: 安全边界更清晰，但修改连接仍需要编辑后端 `.env` 或部署环境变量并重启服务。后续如要做运维面板，也应该只展示脱敏状态，不编辑原始凭据。

## Out of Scope

* 不做网页编辑数据库连接。
* 不把数据库 URL 写入前端状态或 localStorage。
* 不实现 Alembic 迁移。
* 不自动创建业务表。
* 不改变 `/api/health` 的无外部依赖语义。

## Technical Notes

* Relevant files:
  * `backend/app/core/config.py`
  * `backend/app/core/database.py`
  * `backend/app/api/router.py`
  * `backend/.env.example`
  * `.trellis/spec/architecture/backend-roadmap.md`
  * `.trellis/spec/architecture/technology-boundaries.md`
