# 前端Worker入库反馈通知

## Goal

点击“运行Worker并入库”后，通过右下角通知即时反馈成功或失败，避免用户只靠页面摘要变化判断运行结果。

## Requirements

* `runStrategyWorkerOnceAndPersist` 成功时返回本次 Worker 运行摘要。
* 失败时返回 `null`，并保留现有错误状态写入逻辑。
* 策略监控页点击按钮后：
  * 成功时弹出成功通知，展示评估数量、更新状态数、插入信号数。
  * 失败时弹出失败通知，展示错误摘要。
* 不重复请求后端，不改变现有入库和刷新逻辑。

## Acceptance Criteria

* [x] 成功运行后有成功通知。
* [x] 失败运行后有失败通知。
* [x] Store 测试覆盖 action 返回摘要和失败返回 null。
* [x] `npm test` 和 `npm run build` 通过。

## Out of Scope

* 不做历史运行列表。
* 不做自动调度。
* 不改后端接口。

## Verification Notes

* 2026-05-23: `npm test` 通过，16 个前端 store 测试全部通过。
* 2026-05-23: `npm run build` 通过，TypeScript 与 Vite 构建成功。
* Vite 构建仍提示主 chunk 超过 500 kB，这是现有单页体量问题，不阻断本任务。
