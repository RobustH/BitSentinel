# BitSentinel Python 后端

这是 BitSentinel 的 Python 后端最小服务骨架。当前阶段只建立服务边界，不实现完整行情采集、指标计算、策略状态机、回测和推送逻辑。

## 本地运行

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

健康检查：

```text
GET http://127.0.0.1:8000/api/health
```

## 模块边界

- `app/api/`：HTTP API 路由。
- `app/core/`：配置、数据库连接等基础设施。
- `app/models/`：领域模型和后续数据库模型。
- `app/services/market_data/`：Binance REST / WebSocket 行情采集。
- `app/services/indicators/`：指标计算引擎。
- `app/services/strategy_engine/`：策略条件计算、状态机和信号生成。
- `app/services/backtest/`：事件回放、复盘和模拟交易。
- `app/services/alerts/`：邮箱和后续推送通道。

## 当前原则

前端只负责配置和展示。指标计算、策略状态、信号生成、复盘和模拟交易后续都应落到 Python 后端。
