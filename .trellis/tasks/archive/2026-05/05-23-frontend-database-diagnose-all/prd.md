# 前端一键数据库诊断

## Goal

在系统设置页提供一键数据库诊断入口，按顺序完成连接测试和表状态检查，减少用户测试真实库时需要分别点击两个按钮的摩擦。

## Requirements

* Zustand 增加 `diagnoseDatabaseReadiness()` action。
* action 先调用现有连接测试；连接失败时停止，不继续检查表状态。
* 连接成功时继续调用表状态检查。
* 系统设置页增加“一键诊断”按钮。
* 一键诊断仍只读，不执行初始化、不保存数据库配置。
* 失败时沿用现有错误状态，不清空旧表状态。

## Acceptance Criteria

* [x] 点击一键诊断会先测试连接。
* [x] 连接成功后自动检查表状态。
* [x] 连接失败时不请求表状态。
* [x] Store 测试覆盖成功和连接失败分支。
* [x] `npm test` 和 `npm run build` 通过。

## Definition of Done

* Store action、页面按钮和测试完成。
* 前端状态管理规格同步更新。
* 任务归档并提交。

## Technical Approach

复用现有 `refreshDatabaseConnectionStatus()` 和 `refreshDatabaseSchemaStatus()`，新增组合 action `diagnoseDatabaseReadiness()`。为了判断连接是否成功，组合 action 在调用连接测试后读取最新 `databaseConnectionStatus.connected`，只有 true 才继续查 schema。

## Out of Scope

* 不做网页建表。
* 不自动轮询。
* 不改后端接口。
* 不编辑数据库连接。

## Technical Notes

* Relevant files:
  * `src/App.tsx`
  * `src/store/appStore.ts`
  * `src/store/appStore.test.ts`
  * `.trellis/spec/frontend/state-management.md`
* Relevant spec:
  * `.trellis/spec/frontend/state-management.md`

## Verification Notes

* 2026-05-23: `npm test` 通过，22 个前端 store 测试全部通过。
* 2026-05-23: `npm run build` 通过，TypeScript 与 Vite 构建成功。
* Vite 仍提示主 chunk 超过 500 kB，这是既有单页体量警告，不阻断本任务。
