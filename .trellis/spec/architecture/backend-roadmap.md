# Python 后端路线

## 后端 V1 目标

V1 后端不是一次性做完整量化平台，而是先打通最小闭环：

```text
Binance 数据采集 -> 指标计算 -> 策略状态机 -> 信号生成 -> 前端展示 -> 邮箱告警 -> 模拟交易记录
```

## 第一阶段：后端最小服务骨架

建议 Trellis 任务：

```text
用 Trellis 创建并实现 Python 后端最小服务骨架任务
```

范围：

- `backend/` FastAPI 项目
- `/api/health`
- `.env.example`
- PostgreSQL / TimescaleDB 连接配置
- Binance 公共 API 配置
- 目录预留：
  - `backend/app/api/`
  - `backend/app/core/`
  - `backend/app/models/`
  - `backend/app/services/market_data/`
  - `backend/app/services/indicators/`
  - `backend/app/services/strategy_engine/`
  - `backend/app/services/backtest/`
  - `backend/app/services/alerts/`
- Docker Compose：
  - backend
  - postgres
  - redis 可先预留

## 第二阶段：行情采集

范围：

- Binance REST 补历史 K 线。
- Binance WebSocket 采集实时 ticker/kline。
- 资金费率、OI、主动买卖比、大户多空比。
- 写入 PostgreSQL + TimescaleDB。
- 采集失败重试和断线重连。

## 第三阶段：指标计算服务

范围：

- EMA9 / EMA21 / EMA55
- MACD
- ATR
- KDJ
- 布林带可后置
- 指标结果落库或按需缓存

原则：

- 指标计算必须是后端事实源。
- 前端只能展示指标结果，不负责生产计算。

## 第四阶段：策略 Worker

范围：

- 读取策略模板和策略实例。
- 按 `strategy_instance_id + symbol` 独立维护状态。
- 执行多周期条件链：
  - direction_tf
  - structure_tf
  - trigger_tf
  - confirm_conditions
  - invalidate_conditions
- 生成信号和状态变更事件。

## 第五阶段：回测与复盘

推荐先做轻量事件回放：

- 输入历史 K 线、资金流、策略实例。
- 按时间顺序回放。
- 输出：
  - 信号触发记录
  - 状态流转记录
  - 模拟交易记录
  - 胜率、MFE、MAE、最大回撤

后续再接：

- vectorbt：参数扫描和批量研究。
- backtrader：复杂订单和仓位模拟。

## 第六阶段：告警与模拟交易

范围：

- 邮箱告警优先。
- WebSocket/SSE 推送给前端。
- 信号触发后可生成模拟交易。
- 模拟交易记录开仓、平仓、盈亏、复盘结论。

## 当前前端原型如何迁移

| 前端原型能力 | 后端落地位置 |
|---|---|
| `binanceApi.ts` | `backend/app/services/market_data/binance_rest.py` |
| `binanceWebSocket.ts` | `backend/app/services/market_data/binance_ws.py` |
| `strategyEvaluator.ts` | `backend/app/services/strategy_engine/evaluator.py` |
| Zustand `strategyStates` | PostgreSQL `strategy_states` |
| Zustand `signals` | PostgreSQL `signals` |
| 前端模拟回测 | `backend/app/services/backtest/` |

## 技术判断

Python 后端更适合 BitSentinel 的核心能力。Node 保留在前端，不进入策略计算和回测主链路。
