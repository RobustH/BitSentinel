# 前端接入策略持久化状态与信号

## Goal

让前端可以从后端真实持久化表读取策略状态和信号，使数据库初始化后的 `strategy_states` / `strategy_signals` 能被页面消费，而不是继续只看 mock/Zustand 内存数据。

## What I Already Know

* 后端已有：
  * `GET /api/strategy/states`
  * `GET /api/strategy/signals`
* 真实数据库已经初始化并验证两张表存在。
* 前端当前已有 `src/services/backendStrategyApi.ts`，但只接了 `/api/strategy/evaluate`。
* Zustand store 当前持有 `strategyStates` 和 `signals`，并且页面多处直接消费这两个数组。
* 前端规范要求组件不得直接 `fetch` 后端，必须通过 API client + store action。

## Requirements

* 在 `backendStrategyApi.ts` 增加持久化状态和信号查询 client。
* 在 Zustand store 增加刷新持久化策略数据的 action。
* 后端成功时，把返回的状态和信号转换成现有前端领域类型并写入 `strategyStates` / `signals`。
* 后端失败时保留现有 mock/内存数据，不清空页面。
* 页面提供可触发刷新持久化策略数据的入口，优先放在已有策略运行/数据仓相关区域。
* 不让组件直接请求 `/api/strategy/states` 或 `/api/strategy/signals`。

## Acceptance Criteria

* [ ] API client 能请求并转换 `/api/strategy/states`。
* [ ] API client 能请求并转换 `/api/strategy/signals`。
* [ ] Store action 成功时写入后端返回的 `strategyStates` 和 `signals`。
* [ ] Store action 失败时保留旧数据并记录错误状态。
* [ ] 页面有按钮触发该 action。
* [ ] Store 测试覆盖成功和失败分支。
* [ ] `npm test` 和 `npm run build` 通过。

## Definition of Done

* Tests added/updated.
* Frontend build and tests green.
* Specs updated for the new front-end persisted strategy data contract.
* Commit plan presented before committing.

## Technical Approach

沿用现有前端后端接入模式：

* `src/services/backendStrategyApi.ts` 只负责请求和 DTO 转换。
* `src/store/appStore.ts` 新增 action，例如 `refreshPersistedStrategyData()`。
* 新增状态字段记录刷新 loading/error/lastUpdated。
* 页面只调用 store action，不直接 fetch。

## Decision (ADR-lite)

**Context**: 持久化表已存在，但前端仍只展示本地 mock 状态。需要先把后端事实源读进 Zustand。

**Decision**: 先做手动刷新 action 和按钮，不做轮询或 WebSocket。

**Consequences**: 用户可主动确认真实库数据，后续可以在 Worker 调度或 WebSocket 完成后再升级为自动同步。

## Out of Scope

* 不做 Worker 调度。
* 不做持久化写入按钮。
* 不做 WebSocket/SSE 自动推送。
* 不移除 mock 数据。
* 不改变后端 API。

## Technical Notes

* Relevant files:
  * `src/services/backendStrategyApi.ts`
  * `src/store/appStore.ts`
  * `src/store/appStore.test.ts`
  * `src/App.tsx`
  * `src/types.ts`
  * `.trellis/spec/frontend/state-management.md`

## Verification Notes

* 2026-05-23: `npm test` 通过，12 个前端 store 测试全部通过。
* 2026-05-23: `npm run build` 通过，TypeScript 与 Vite 构建成功。
* Vite 构建仍提示主 chunk 超过 500 kB，这是现有单页体量问题，不阻断本任务。
