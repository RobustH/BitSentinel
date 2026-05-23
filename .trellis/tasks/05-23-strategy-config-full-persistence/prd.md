# 策略配置完整持久化

## Goal

让后端 `strategy_instances` 成为前端策略配置的完整事实源。用户保存当前策略配置后，重启前端或重新同步后端配置时，应能恢复 `slots`、模板 ID、版本和版本历史，而不是依赖前端本地兜底。

## What I already know

* 前端 `StrategyInstance` 包含 `templateId`、`slotTemplateId`、`version`、`versionHistory`、`slots`、`symbols`、`enabled`、`conditionIds`、`riskSignalIds`、`signalIdsBySlot`。
* 后端当前 `strategy_instances` 只保存核心字段：`id`、`name`、`symbols`、`enabled`、`condition_ids`、`risk_signal_ids`、`signal_ids_by_slot`、`created_at`、`updated_at`。
* 前端当前同步逻辑会在后端缺少完整字段时合并本地已有字段，或者用默认槽位兜底。
* `python -m app.scripts.init_db` 当前通过 `Base.metadata.create_all(checkfirst=True)` 创建新表，但不会给已存在表补新增列。

## Requirements

* 后端 `strategy_instances` 增加完整策略元数据持久化字段：
  * `template_id`
  * `slot_template_id`
  * `version`
  * `version_history`
  * `slots`
* 后端创建、更新、列表、启停策略实例 API 均返回完整配置字段。
* 后端 repository 负责 JSON 字段序列化和反序列化，并为旧记录提供安全默认值。
* 数据库初始化脚本对新库创建完整表，对已存在的 `strategy_instances` 表补齐新增列，不删除已有数据。
* 前端策略实例 DTO 保存完整字段，读取后端字段后不再依赖“后端缺字段时保留本地字段”作为主路径。
* 前端仍允许兼容旧后端响应：若字段缺失，保留当前兜底，避免页面直接崩溃。

## Acceptance Criteria

* [ ] 新建策略实例 API 请求包含完整字段时，响应和列表接口原样返回这些字段。
* [ ] 更新策略实例 API 可更新完整字段，未传字段保持不变。
* [ ] 启停策略实例只修改 `enabled` 和 `updated_at`，不丢失完整配置字段。
* [ ] `initialize_database` 能在已有旧表上补齐新增列。
* [ ] 前端保存当前策略配置时提交完整字段。
* [ ] 前端同步后端策略配置时恢复完整 `slots`、模板 ID 和版本历史。
* [ ] 后端 pytest 通过，前端 store 测试、TypeScript 和 build 通过。

## Definition of Done

* 后端 repository/API/initializer 测试覆盖新增字段和旧表补列。
* 前端 store/API DTO 测试覆盖完整字段往返。
* `ruff check .`、`pytest`、`npm.cmd test`、`npx.cmd tsc --noEmit`、`npm.cmd run build` 通过，若环境限制无法运行需记录原因。
* `.trellis/spec/` 更新本次新增的跨层契约。
* 中文提交并归档任务。

## Technical Approach

后端沿用当前“JSON 字符串列 + repository 转换”的轻量方案，不引入迁移框架。新增字符串/整数字段直接进入 `StrategyInstanceRecord`，`slots` 和 `version_history` 使用 JSON 字符串列，`template_id`、`slot_template_id` 使用普通字符串列，`version` 使用整数列。

初始化阶段新增一个小型列补齐步骤：`create_all` 后检查 `strategy_instances` 已有列，缺少新增列时执行 `ALTER TABLE ADD COLUMN`。该步骤仅补列，不改类型、不删数据、不做复杂迁移。

前端更新 `BackendStrategyInstance` 类型、`toBackendStrategyInstance` 和 `toFrontendStrategyInstance`，完整映射字段；旧响应字段缺失时保留兼容默认值。

## Decision (ADR-lite)

**Context**: 现在项目还没有 Alembic，已有初始化脚本也只承担幂等建表。为了让用户当前 PostgreSQL 环境马上可用，需要一个低风险补列机制。

**Decision**: 本任务使用 SQLAlchemy inspection + `ALTER TABLE ADD COLUMN` 补齐 `strategy_instances` 新增列，不引入 Alembic。

**Consequences**: 可以快速兼容当前数据库；后续一旦表结构演进变多，应单独引入正式迁移工具。

## Out of Scope

* 不做 Worker 调度器自动读取 `strategy_instances`。
* 不做策略模板表、条件库表或多租户隔离。
* 不做认证、权限、审计。
* 不引入 Alembic 或完整迁移管理。
* 不重构 `src/App.tsx`。

## Technical Notes

* 后端模型：`backend/app/db/strategy.py`
* 后端 DTO：`backend/app/models/strategy.py`
* 后端 repository：`backend/app/services/strategy_engine/repository.py`
* 初始化：`backend/app/services/database/initializer.py`
* 前端 API client：`src/services/backendStrategyApi.ts`
* 前端状态：`src/store/appStore.ts`
* 相关规范：
  * `.trellis/spec/architecture/backend-roadmap.md`
  * `.trellis/spec/frontend/state-management.md`
  * `.trellis/spec/frontend/type-safety.md`
