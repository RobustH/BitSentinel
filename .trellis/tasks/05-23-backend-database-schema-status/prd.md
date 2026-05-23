# 后端数据库表状态诊断

## Goal

提供一个后端只读诊断接口，确认当前数据库中受管理业务表是否已经初始化，解决“数据库连接成功但 Worker 入库因缺表失败”的排查问题。

## Requirements

* 新增服务函数检查当前数据库受管理表状态。
* 新增 `GET /api/system/database/schema` 接口。
* 响应包含脱敏数据库目标、受管理表、已存在表、缺失表、是否 ready。
* 接口只读，不创建表、不删除表、不修改数据。
* 接口不得返回完整数据库 URL、用户名、密码或任何 secret。
* 连接或检查失败时返回稳定结构，`ready=false`，并给出错误摘要。

## Acceptance Criteria

* [x] 所有受管理表存在时返回 `ready=true`。
* [x] 缺表时返回 `ready=false` 和 `missing_tables`。
* [x] 数据库不可用时返回 `ready=false`，且不泄露凭据。
* [x] API 测试覆盖成功、缺表和失败。
* [x] `ruff check .` 和 `pytest` 通过。

## Definition of Done

* 后端模型、服务、API 和测试完成。
* 架构规格同步记录数据库 schema 诊断契约。
* 任务提交、归档、写入开发日志。

## Technical Approach

在 `backend/app/services/database/initializer.py` 或相邻服务中增加只读检查函数，复用 `managed_table_names()` 和 `describe_database_target()`。API 层创建当前配置 engine，调用检查函数后 dispose。响应模型放在 `backend/app/models/system.py`，保持 `/api/health` 不依赖数据库。

## Out of Scope

* 不提供 HTTP 建表接口。
* 不做 Alembic 迁移。
* 不改 `python -m app.scripts.init_db` 的创建行为。
* 不在前端展示本接口。

## Technical Notes

* Relevant files:
  * `backend/app/api/system.py`
  * `backend/app/models/system.py`
  * `backend/app/services/database/initializer.py`
  * `backend/tests/test_system_database_api.py`
* Relevant specs:
  * `.trellis/spec/architecture/backend-roadmap.md`
  * `.trellis/spec/architecture/technology-boundaries.md`

## Verification Notes

* 2026-05-23: `backend/.venv/Scripts/python.exe -m ruff check .` 通过。
* 2026-05-23: `backend/.venv/Scripts/python.exe -m pytest` 通过，44 个后端测试全部通过。
