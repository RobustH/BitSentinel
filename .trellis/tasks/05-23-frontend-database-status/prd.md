# 前端展示数据库连接状态

## Goal

在系统设置页展示后端数据库连接状态，允许用户手动测试当前后端 `.env` 中配置的数据库连接，但不在前端编辑或保存数据库连接串。

## Requirements

* 新增前端 API client 调用 `GET /api/system/database/test`。
* 新增 Zustand action 刷新数据库连接状态。
* 系统设置页展示连接状态、目标库脱敏信息、最近测试时间和错误。
* 提供“测试连接”按钮。
* 失败时保留已有状态并显示错误。
* 不在前端展示用户名、密码或完整数据库 URL。

## Acceptance Criteria

* [ ] 系统设置页可以点击测试数据库连接。
* [ ] 成功时展示 host、port、database、driver。
* [ ] 失败时展示错误信息但不泄露凭据。
* [ ] Store 测试覆盖成功和失败分支。
* [ ] `npm test` 和 `npm run build` 通过。

## Technical Approach

新增 `src/services/backendSystemApi.ts`，集中处理系统诊断 API。Store 增加 `databaseConnectionStatus` 和 `refreshDatabaseConnectionStatus()`。系统设置页读取 store 并展示 Ant Design Card/Descriptions/Button。

## Out of Scope

* 不做数据库连接配置编辑。
* 不保存数据库密码到前端。
* 不做自动轮询。

## Verification Notes

* 2026-05-23: `npm test` 通过，16 个前端 store 测试全部通过。
* 2026-05-23: `npm run build` 通过，TypeScript 与 Vite 构建成功。
* Vite 构建仍提示主 chunk 超过 500 kB，这是现有单页体量问题，不阻断本任务。
