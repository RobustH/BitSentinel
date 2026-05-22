# 前端展示Worker入库运行结果

## Goal

前端点击“运行Worker并入库”后，展示本次后端 Worker 运行摘要，让用户知道评估了多少条、生成了多少信号、写入/更新了多少数据库记录。

## Requirements

* Store 保存最近一次 Worker 入库运行摘要。
* Worker 成功后显示运行 ID、评估数量、生成信号数、更新状态数、插入信号数。
* Worker 失败时保留上一条成功摘要，同时展示错误。
* 策略监控页展示最近一次运行摘要。
* 不新增后端接口。

## Acceptance Criteria

* [ ] 运行 Worker 成功后，store 写入最近一次运行摘要。
* [ ] 策略监控页展示摘要。
* [ ] 失败时旧摘要不被清空。
* [ ] Store 测试覆盖成功摘要和失败保留。
* [ ] `npm test` 和 `npm run build` 通过。

## Out of Scope

* 不做 Worker 历史列表。
* 不做自动调度。
* 不做后端 schema 变更。

## Verification Notes

* 2026-05-23: `npm test` 通过，16 个前端 store 测试全部通过。
* 2026-05-23: `npm run build` 通过，TypeScript 与 Vite 构建成功。
* Vite 构建仍提示主 chunk 超过 500 kB，这是现有单页体量问题，不阻断本任务。
