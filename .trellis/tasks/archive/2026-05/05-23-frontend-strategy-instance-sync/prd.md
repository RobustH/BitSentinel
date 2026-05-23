# 前端策略配置同步后端

## 背景

后端已经提供 `strategy_instances` 策略配置事实源，但前端策略实例仍主要存在 Zustand/mock 中。需要把前端策略配置保存到后端，并支持从后端同步回来，为后续 Worker 自驱读取配置打基础。

## 目标

- 前端 API client 接入后端策略实例配置 API。
- Zustand 增加策略配置同步状态和 action。
- 策略页提供“同步后端策略配置”和“保存当前配置到后端”入口。
- 保存时把当前 `strategyInstances` 批量 upsert 到后端。
- 同步时把后端 `strategy_instances` 映射为前端 `StrategyInstance`。
- 启停策略时尽量同步后端配置，失败时不破坏本地切换。

## 非目标

- 不删除 mock 初始数据。
- 不做复杂冲突解决。
- 不做分页、搜索或策略配置详情页。
- 不让 Worker 调度器读取配置表。

## 交互

- 策略相关页展示后端同步状态：
  - 数据源：本地模拟 / 后端数据库
  - 最近同步时间
  - 最近错误
- 按钮：
  - “同步后端策略配置”：读取后端实例并写入 Zustand。
  - “保存当前配置到后端”：逐个保存当前前端策略实例。

## 验收

- API client 完成 snake_case/camelCase DTO 转换。
- store action 成功同步后端策略配置。
- store action 批量保存当前策略实例到后端。
- 保存失败时保留本地策略配置并记录错误。
- 后端返回空数组时不清空本地策略，避免首次使用时页面空白。
- 前端测试、TypeScript、build 通过。
