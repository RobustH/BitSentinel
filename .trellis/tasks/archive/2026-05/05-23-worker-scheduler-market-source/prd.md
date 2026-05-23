# Worker调度接入后端行情事实源

## Goal

让 `config_source=database` 的 Worker 定时调度不再用空 `market_series` 运行，而是在每轮执行时根据数据库中已启用策略的 `symbols` 自动拉取后端公共 K 线，构造 Worker 输入并产生真实策略评估结果。

## Requirements

- 数据库配置模式下，调度器每轮从 `strategy_instances` 读取 enabled 策略，并收集这些策略挂载的去重 symbol。
- 调度器为每个 symbol 通过已有 Binance REST 行情服务拉取 K 线，并转换为 `StrategyKlineInput`。
- 第一版固定使用 `interval="1h"`、`limit=80`，与前端当前 Worker/图表原型保持一致。
- 行情源只用于 `config_source=database`；旧 `config_source=request` 模式仍完全使用请求里的 `worker_request.market_series`。
- 某个 symbol 的 K 线拉取失败时，不让整轮调度崩溃；该 symbol 使用空序列，Worker 仍运行并把错误写入调度状态或可追踪错误信息。
- 没有 enabled 策略或没有 symbol 时，调度器仍可运行，`market_series={}`，不视为启动失败。
- 保留 `money_flows=[]`，本任务不接资金费率、OI、主动买卖比。

## Acceptance Criteria

- [x] service 测试覆盖数据库模式会按 enabled 策略 symbol 拉取 K 线，并把 K 线传给 Worker。
- [x] service 测试覆盖 disabled 策略 symbol 不会触发行情拉取。
- [x] service 测试覆盖行情拉取失败时调度器不停止，且本轮仍可完成。
- [x] 旧 request 快照模式测试继续通过，且 `persist=false` 时不访问数据库。
- [x] `ruff check .` 和后端 `pytest` 通过。

## Definition of Done

- Tests added/updated.
- Lint/type checks green for touched backend code.
- Trellis 规格记录新的调度行情事实源契约。
- 变更已用中文提交信息提交。

## Technical Approach

- 新增轻量行情源抽象，复用 `backend/app/services/market_data/binance_rest.py::BinanceRestClient.fetch_klines`，避免调度器直接依赖 HTTP 细节。
- 调度器数据库模式构造 `StrategyWorkerRunRequest` 时：
  - 读取 enabled 策略；
  - 收集去重 symbol；
  - 异步拉取每个 symbol 的 K 线；
  - 转为 `StrategyKlineInput` 放入 `market_series`。
- 调度器仍只调用 `StrategyWorker.run_once`，不复制 evaluator 条件逻辑。

## Decision (ADR-lite)

**Context**: Worker 调度已经能读取数据库策略配置，但行情输入为空，导致自动调度无法基于真实市场数据产出有效信号。

**Decision**: 本任务先接入按需 Binance REST K线事实源，固定 `1h/80`，不新增行情表和迁移。

**Consequences**: 实现轻、闭环快；代价是每轮调度会访问外部 Binance 公共接口，后续需要补充缓存/落库/资金流事实源来降低外部依赖和丰富条件输入。

## Out of Scope

- 不新增行情数据库表或 TimescaleDB 落库。
- 不接资金费率、OI、主动买卖比。
- 不做多周期 K线配置。
- 不做进程重启后的调度恢复。
- 不改变前端启动调度 UI。

## Technical Notes

- 已有行情 API: `backend/app/api/market.py`
- 已有 Binance REST 服务: `backend/app/services/market_data/binance_rest.py`
- 当前调度器: `backend/app/services/strategy_engine/scheduler.py`
- 当前数据库模式缺口: `_build_worker_request()` 返回 `market_series={}`。
- Worker 输入模型: `backend/app/models/strategy.py::StrategyKlineInput`
- 后端规格: `.trellis/spec/architecture/backend-roadmap.md`
