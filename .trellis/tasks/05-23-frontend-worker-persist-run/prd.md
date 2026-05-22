# 前端触发策略Worker持久化运行

## Goal

让前端可以手动触发后端 `POST /api/strategy/worker/run-once?persist=true`，将当前策略评估结果写入真实数据库，然后刷新持久化状态和信号列表。

## Requirements

* 在 `backendStrategyApi.ts` 增加 Worker run-once 持久化请求。
* 请求复用现有策略实例、K线、资金流、信号和状态，补齐后端需要的 `existing_states`。
* Store 增加 action 触发 Worker 持久化运行。
* 运行成功后自动刷新后端持久化策略数据。
* 运行失败时保留当前状态并记录错误。
* 页面提供清晰按钮入口，不直接在组件中 fetch。

## Acceptance Criteria

* [ ] API client 能调用 `/api/strategy/worker/run-once?persist=true`。
* [ ] Store action 能触发 Worker 并随后刷新持久化数据。
* [ ] UI 有手动触发入口。
* [ ] Store 测试覆盖成功和失败分支。
* [ ] `npm test` 和 `npm run build` 通过。

## Technical Approach

沿用当前 `backendStrategyApi.ts` DTO 转换；新增 Worker request 在评估 request 基础上增加 `existing_states`。Store action 命名为 `runStrategyWorkerOnceAndPersist`，成功后复用 `refreshPersistedStrategyData` 的同一套状态写入逻辑。

## Out of Scope

* 不做定时调度。
* 不做 WebSocket/SSE 推送。
* 不新增后端接口。
* 不做真实交易或通知发送。

## Verification Notes

* 2026-05-23: `npm test` 通过，14 个前端 store 测试全部通过。
* 2026-05-23: `npm run build` 通过，TypeScript 与 Vite 构建成功。
* Vite 构建仍提示主 chunk 超过 500 kB，这是现有单页体量问题，不阻断本任务。
