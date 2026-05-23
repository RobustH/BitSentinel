# 前端展示数据库表状态

## Goal

在系统设置页展示后端数据库受管理表的初始化状态，让用户能区分“数据库连接失败”和“数据库已连接但业务表缺失”。

## Requirements

* 在 `backendSystemApi.ts` 增加 `GET /api/system/database/schema` client。
* 新增前端类型保存 schema 诊断状态。
* Zustand 增加 `databaseSchemaStatus` 和 `refreshDatabaseSchemaStatus()`。
* 系统设置页展示：
  * ready / 未就绪状态。
  * managed tables。
  * existing tables。
  * missing tables。
  * 最近检查时间和错误摘要。
* 页面只读展示，不提供建表按钮，不保存数据库配置。
* 请求失败时保留旧目标/旧表状态，只写入错误。

## Acceptance Criteria

* [x] 系统设置页可以点击检查数据库表状态。
* [x] 表齐时展示 ready。
* [x] 缺表时展示 missing tables。
* [x] 请求失败时保留旧 schema 状态并展示错误。
* [x] Store 测试覆盖成功和失败分支。
* [x] `npm test` 和 `npm run build` 通过。

## Definition of Done

* 前端 API client、store、页面和测试完成。
* 前端状态管理规格同步更新。
* 任务归档并提交。

## Technical Approach

沿用数据库连接测试模式：`backendSystemApi.ts` 负责 DTO 转换，`appStore.ts` 维护 `databaseSchemaStatus`，系统设置页通过 store action 触发检查。展示层使用 `Tag`/`Descriptions`/`Alert` 呈现表状态，不直接请求后端。

## Out of Scope

* 不做网页建表或迁移入口。
* 不编辑数据库连接。
* 不自动轮询。
* 不改后端接口。

## Technical Notes

* Relevant files:
  * `src/types.ts`
  * `src/services/backendSystemApi.ts`
  * `src/store/appStore.ts`
  * `src/store/appStore.test.ts`
  * `src/App.tsx`
* Relevant spec:
  * `.trellis/spec/frontend/state-management.md`

## Verification Notes

* 2026-05-23: `npm test` 通过，20 个前端 store 测试全部通过。
* 2026-05-23: `npm run build` 通过，TypeScript 与 Vite 构建成功。
* Vite 仍提示主 chunk 超过 500 kB，这是既有单页体量警告，不阻断本任务。
