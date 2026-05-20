# 前端接入后端策略评估 API

## Goal

把前端策略监控计算从浏览器本地 evaluator 迁移到 Python FastAPI 的 `POST /api/strategy/evaluate`。本任务先打通前端 API client 和 Zustand action，让页面现有“重新计算策略”入口优先使用后端评估结果，同时在后端不可用时保留现有本地计算兜底，避免原型页面失效。

## What I Already Know

* 后端已经提供 `POST /api/strategy/evaluate`，请求模型位于 `backend/app/models/strategy.py`。
* 前端当前通过 `src/services/strategyEvaluator.ts` 的 `evaluateAllStrategyInstances` 做本地计算。
* Zustand action `evaluateStrategyMonitors()` 会更新 `strategyEvaluations`、`strategyStates`、`signals` 和 `symbols`。
* 前端已有后端行情 client `src/services/backendMarketApi.ts`，请求集中在服务层，组件只调用 store action。
* 监控状态粒度必须保持 `strategyInstanceId + symbol`。

## Requirements

* 新增前端策略评估 API client，集中请求 `/api/strategy/evaluate`，组件不得直接 fetch。
* 将前端领域数据转换为后端 DTO：
  * `strategyInstances` -> `strategy_instances`
  * `marketSeries` -> `market_series`，补齐 `symbol`、`interval`、`open_time`、`volume`
  * `moneyFlows` -> `money_flows`
  * `signals` -> `existing_signals`
* 将后端响应转换回现有 `StrategyEvaluationResult`。
* `evaluateStrategyMonitors()` 改为异步，优先使用后端评估结果。
* 后端评估失败时保留当前本地 evaluator 兜底，不清空已有状态。
* 成功或兜底计算后继续复用现有状态 patch 逻辑，避免重复强信号。
* 补充 store 测试覆盖后端成功与后端失败兜底。

## Acceptance Criteria

* [ ] `evaluateStrategyMonitors()` 会调用前端策略评估 API client。
* [ ] 后端返回结果会写入 `strategyEvaluations` 并更新对应 `strategyStates`。
* [ ] 后端失败时仍能产生本地评估结果，页面不空白。
* [ ] 测试证明 `strategyInstanceId + symbol` 独立状态不会被合并。
* [ ] `npm.cmd test` 通过。
* [ ] TypeScript 构建或类型检查通过。

## Definition of Done

* Tests added/updated.
* Lint/typecheck/build command passes where applicable.
* No direct component fetch to `/api/strategy/evaluate`.
* No real trading or notification side effect added.
* Trellis task can be committed with Chinese commit message.

## Technical Approach

* 新建 `src/services/backendStrategyApi.ts`，与现有 `backendMarketApi.ts` 保持一致的服务层边界。
* 抽出通用 `applyEvaluationResults`，让后端与本地结果共享状态更新逻辑。
* 保留 `src/services/strategyEvaluator.ts` 作为后端失败时的开发兜底和原型兼容路径。
* K 线时间从前端 `time` 字符串转为 `open_time` 毫秒；若解析失败，用索引生成稳定时间戳。
* 前端暂无 `volume`，请求 DTO 暂传 `0`，后续接真实后端行情时由后端 K 线补齐。

## Decision (ADR-lite)

**Context**: 后端策略评估接口已完成，但前端仍在本地计算，导致生产事实源没有真正迁移到 Python 后端。

**Decision**: 前端先引入后端优先、本地兜底的 store action，不做 UI 大改和数据库持久化。

**Consequences**: 可以快速形成前后端闭环；短期仍保留本地 evaluator 以保证后端未启动时页面可用，后续 Worker 和数据库落地后再移除兜底路径。

## Out of Scope

* 不实现后端 Worker 调度。
* 不实现策略状态数据库持久化。
* 不实现真实通知或交易。
* 不拆分 `src/App.tsx`。
* 不删除本地 `strategyEvaluator.ts`。

## Technical Notes

* Relevant specs:
  * `.trellis/spec/frontend/index.md`
  * `.trellis/spec/frontend/state-management.md`
  * `.trellis/spec/frontend/type-safety.md`
  * `.trellis/spec/frontend/quality-guidelines.md`
  * `.trellis/spec/architecture/backend-roadmap.md`
  * `.trellis/spec/architecture/technology-boundaries.md`
* Existing code:
  * `src/store/appStore.ts`
  * `src/services/backendMarketApi.ts`
  * `src/services/strategyEvaluator.ts`
  * `src/types.ts`
  * `backend/app/models/strategy.py`
