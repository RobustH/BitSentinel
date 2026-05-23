# 后端 Worker 定时调度

## 背景

当前策略 Worker 已支持 `POST /api/strategy/worker/run-once` 单次执行，并可在 `persist=true` 时写入状态、信号和运行历史。下一步需要让 Worker 可以由后端周期性执行，形成后台监控的最小闭环。

## 目标

- 提供内存级 Worker 调度器，支持启动、停止、查询状态。
- 调度器复用现有 `StrategyWorker.run_once` 和 `StrategyPersistenceRepository`，不复制策略计算逻辑。
- 启动调度时由调用方传入本轮 Worker 请求体和间隔；调度器后续按同一请求周期执行。
- 支持 `persist` 开关，默认持久化运行结果。
- 避免重叠执行；前一轮未结束时跳过本轮并记录跳过次数。

## 非目标

- 不做进程重启后的调度恢复。
- 不做策略配置数据库表读取。
- 不接外部任务队列、Redis Queue、Celery 或 APScheduler。
- 不做真实交易和真实告警投递。

## API 契约

- `POST /api/strategy/worker/scheduler/start`
  - Body:
    - `worker_request`: `StrategyWorkerRunRequest`
    - `interval_seconds`: 调度间隔，有限范围校验
    - `persist`: 是否持久化，默认 `true`
  - Response: `StrategyWorkerSchedulerStatus`
- `POST /api/strategy/worker/scheduler/stop`
  - Response: `StrategyWorkerSchedulerStatus`
- `GET /api/strategy/worker/scheduler/status`
  - Response: `StrategyWorkerSchedulerStatus`

## 状态字段

- `running`
- `interval_seconds`
- `persist`
- `last_started_at`
- `last_stopped_at`
- `last_run_at`
- `next_run_at`
- `last_run_id`
- `last_error`
- `run_count`
- `skipped_count`

## 验收

- 调度器启动后返回 `running=true`。
- 查询接口可返回当前调度状态。
- 停止后返回 `running=false`。
- 调度运行复用现有 Worker，并在 `persist=true` 时复用 repository 写入。
- 重复启动会替换当前调度配置并重新计时。
- 后端测试通过 `ruff check .` 和 `pytest`。
