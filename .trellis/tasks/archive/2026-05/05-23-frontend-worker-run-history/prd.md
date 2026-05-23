# 前端展示Worker运行历史

## Goal

前端读取后端 `GET /api/strategy/worker/runs`，在策略监控页展示最近的 Worker 入库运行历史，帮助用户确认多次运行的评估数量、状态更新数和信号插入数。

## Requirements

* 在 `backendStrategyApi.ts` 增加 Worker 运行历史查询 client。
* 新增/复用前端类型表达 Worker 运行历史记录。
* Zustand 增加运行历史状态和刷新 action。
* 策略监控页展示最近 Worker 运行历史列表。
* 点击“运行Worker并入库”成功后自动刷新运行历史。
* 失败时保留旧历史列表，只写入 `strategyPersistenceStatus.error`。
* 组件不得直接请求后端 API。

## Acceptance Criteria

* [x] 页面可以手动刷新 Worker 运行历史。
* [x] Worker 入库成功后历史列表自动刷新。
* [x] 后端运行历史查询失败时保留旧列表并展示错误。
* [x] Store 测试覆盖成功和失败分支。
* [x] `npm test` 和 `npm run build` 通过。

## Definition of Done

* 前端 API client、store、页面和测试完成。
* 前端状态管理规格同步更新。
* 任务归档并提交。

## Technical Approach

沿用现有 `strategyPersistenceStatus`。新增 `workerRunHistory` 数组和 `refreshWorkerRunHistory()` action；API client 请求 `/api/strategy/worker/runs?limit=10`，把 snake_case 转换为 camelCase。策略监控页在最近一次摘要下方展示表格，并提供刷新按钮。`runStrategyWorkerOnceAndPersist()` 成功刷新持久化策略数据后，再刷新运行历史。

## Out of Scope

* 不做历史详情页。
* 不做分页。
* 不做自动轮询。
* 不改后端接口。

## Technical Notes

* Relevant files:
  * `src/types.ts`
  * `src/services/backendStrategyApi.ts`
  * `src/store/appStore.ts`
  * `src/store/appStore.test.ts`
  * `src/App.tsx`
* Relevant spec:
  * `.trellis/spec/frontend/state-management.md`

## Verification Notes

* 2026-05-23: `npm test` 通过，18 个前端 store 测试全部通过。
* 2026-05-23: `npm run build` 通过，TypeScript 与 Vite 构建成功。
* Vite 仍提示主 chunk 超过 500 kB，这是既有单页体量警告，不阻断本任务。
