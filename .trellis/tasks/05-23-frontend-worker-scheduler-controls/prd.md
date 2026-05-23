# 前端 Worker 调度控制

## 背景

后端已经提供 Worker 定时调度 API，但前端策略监控页目前只能手动执行 `run-once?persist=true` 和刷新运行历史。用户需要在页面上直接启动/停止调度并查看当前调度状态。

## 目标

- 在前端 API client 中接入 Worker 调度 API。
- 在 Zustand store 中维护调度状态和启停 action。
- 在策略监控中心展示调度状态、最近运行、下次运行、错误、运行次数和跳过次数。
- 在策略监控中心提供启动/停止定时调度按钮。
- 启动调度时复用当前策略实例、K 线、资金流、信号和策略状态拼装请求体。
- 已知数据库表缺失时阻止 `persist=true` 调度启动，并提示初始化命令。

## 非目标

- 不做前端轮询调度状态。
- 不做调度配置持久化。
- 不做复杂调度表单；第一版固定使用 60 秒间隔。
- 不做后端策略配置表读取。

## 交互

- 策略监控页显示“Worker定时调度”卡片。
- 卡片显示：
  - 状态：运行中 / 未启动
  - 间隔
  - 最近启动
  - 最近停止
  - 最近运行
  - 下次运行
  - 运行次数
  - 跳过次数
  - 最近错误
- 按钮：
  - “启动定时调度”：调用后端 start，默认 `intervalSeconds=60`、`persist=true`。
  - “停止调度”：调用后端 stop。
  - “刷新状态”：调用后端 status。

## 验收

- API client 完成 snake_case/camelCase DTO 转换。
- store action 成功后写入 `strategyPersistenceStatus.schedulerStatus`。
- 启动成功后页面通知“Worker定时调度已启动”。
- 停止成功后页面通知“Worker定时调度已停止”。
- 调度 API 失败时保留旧状态，并写入 `strategyPersistenceStatus.error`。
- store 测试覆盖启动、停止、刷新状态和失败保留旧状态。
- TypeScript、前端测试通过。
