# 前端数据库初始化指引

## Goal

当系统设置页检测到数据库受管理表缺失时，给出明确的后端初始化命令和说明，帮助用户知道下一步该在后端环境执行什么，而不是猜测为什么 Worker 入库失败。

## Requirements

* 在系统设置页数据库表状态卡片中，缺表时显示初始化指引。
* 指引必须是只读说明，不提供网页建表按钮。
* 指引包含后端工作目录和命令：`python -m app.scripts.init_db`。
* 指引说明初始化读取后端 `.env` / `BITSENTINEL_DATABASE_URL`。
* 表齐时不显示初始化指引，避免干扰。
* 不展示数据库密码、用户名或完整连接串。

## Acceptance Criteria

* [x] 缺表时页面显示初始化命令。
* [x] 表齐时不显示初始化命令。
* [x] 指引不包含密码或完整 URL。
* [x] `npm test` 和 `npm run build` 通过。

## Definition of Done

* 前端 UI 完成并通过构建。
* 前端状态管理规格同步记录只读初始化指引边界。
* 任务归档并提交。

## Technical Approach

在 `SettingsPage` 的数据库表状态卡片中根据 `databaseSchemaStatus.missingTables.length` 条件渲染 `Alert`，展示固定命令和注意事项。该 UI 不新增 store action，不调用初始化 API。

## Out of Scope

* 不做网页建表。
* 不调用后端初始化脚本。
* 不编辑数据库连接。
* 不新增后端接口。

## Technical Notes

* Relevant files:
  * `src/App.tsx`
  * `.trellis/spec/frontend/state-management.md`
* Relevant spec:
  * `.trellis/spec/frontend/state-management.md`

## Verification Notes

* 2026-05-23: `npm test` 通过，20 个前端 store 测试全部通过。
* 2026-05-23: `npm run build` 通过，TypeScript 与 Vite 构建成功。
* Vite 仍提示主 chunk 超过 500 kB，这是既有单页体量警告，不阻断本任务。
