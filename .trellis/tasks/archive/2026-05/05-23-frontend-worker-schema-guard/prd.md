# Worker入库前置诊断提示

## Goal

当系统已知数据库受管理表缺失时，前端在点击“运行Worker并入库”前直接提示用户先初始化数据库表，避免把可解释的缺表问题变成后端 Worker 运行失败。

## Requirements

* 策略监控页运行 Worker 前检查 `databaseSchemaStatus`。
* 如果 `databaseSchemaStatus.ready === false` 且存在 `missingTables`，阻止运行 Worker。
* 阻止时弹出错误通知，展示缺失表和初始化命令。
* 如果 schema 状态未知（`ready === null`），不阻止原流程。
* 如果 schema ready，沿用原 Worker 入库流程。
* 不新增后端接口，不执行建表。

## Acceptance Criteria

* [x] 已知缺表时点击运行 Worker 不调用 store 的入库 action。
* [x] 已知缺表时通知展示缺失表和初始化命令。
* [x] schema 状态未知或 ready 时不改变原有流程。
* [x] `npm test` 和 `npm run build` 通过。

## Definition of Done

* 页面前置判断完成。
* 前端状态管理规格同步记录。
* 任务归档并提交。

## Technical Approach

在 `StrategyMonitorCenter` 中读取 `databaseSchemaStatus`。`handleRunWorker` 开始处判断 `ready === false && missingTables.length > 0`，命中则 `notification.error` 并 return；否则继续调用 `runStrategyWorkerOnceAndPersist()`。

## Out of Scope

* 不自动运行一键诊断。
* 不网页建表。
* 不修改后端接口。
* 不阻止 schema 未检查状态下的手动运行。

## Technical Notes

* Relevant files:
  * `src/App.tsx`
  * `.trellis/spec/frontend/state-management.md`
* Relevant spec:
  * `.trellis/spec/frontend/state-management.md`

## Verification Notes

* 2026-05-23: `npm test` 通过，22 个前端 store 测试全部通过。
* 2026-05-23: `npm run build` 通过，TypeScript 与 Vite 构建成功。
* Vite 仍提示主 chunk 超过 500 kB，这是既有单页体量警告，不阻断本任务。
