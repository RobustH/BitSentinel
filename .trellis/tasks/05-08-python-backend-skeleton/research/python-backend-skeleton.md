# Python 后端最小服务骨架研究记录

## 本地架构依据

相关规范：

- `.trellis/spec/architecture/index.md`
- `.trellis/spec/architecture/technology-boundaries.md`
- `.trellis/spec/architecture/backend-roadmap.md`
- `.trellis/spec/guides/index.md`
- `.trellis/spec/guides/cross-layer-thinking-guide.md`

## 技术选择

- API 框架：FastAPI
- 配置：`pydantic-settings`
- 数据库连接：SQLAlchemy + psycopg，面向 PostgreSQL / TimescaleDB
- 实时行情：Python async worker 后续接 Binance WebSocket
- 指标计算：先用 pandas / numpy，后续按需接 pandas-ta / TA-Lib
- 回测：先做轻量事件回放，后续再评估 vectorbt / backtrader
- 推送：优先邮箱，后续补 WebSocket / SSE 到前端

## 最小骨架边界

这次只落目录、配置、入口和占位服务，不实现生产逻辑。原因：

- 可以先固定后端模块边界，避免前端原型继续膨胀。
- 后续 Trellis 任务可以按模块拆分：行情采集、指标计算、策略 Worker、复盘回测、告警推送。
- 当前前端已能验证产品交互，后端第一步应先建立稳定承载结构。

## 后续迁移映射

| 前端原型能力 | 后端落地位置 |
|---|---|
| `src/services/binanceApi.ts` | `backend/app/services/market_data/binance_rest.py` |
| `src/services/binanceWebSocket.ts` | `backend/app/services/market_data/binance_ws.py` |
| `src/services/strategyEvaluator.ts` | `backend/app/services/strategy_engine/evaluator.py` |
| Zustand 信号和状态 | PostgreSQL / TimescaleDB 表 |
| 前端复盘模拟 | `backend/app/services/backtest/` |
