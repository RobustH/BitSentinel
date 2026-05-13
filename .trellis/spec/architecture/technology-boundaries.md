# 技术栈边界

## 核心决策

BitSentinel 的正式生产架构应采用：

```text
Frontend: React + TypeScript + Vite
Backend API: Python + FastAPI
Market Worker: Python async worker
Indicator Engine: pandas / numpy / pandas-ta / TA-Lib
Backtest Engine: Python event replay / vectorbt / backtrader
Database: PostgreSQL + TimescaleDB, later ClickHouse if needed
Realtime Push: WebSocket / SSE from backend to frontend
```

## 为什么前端现在使用 Node

当前项目的 Node 只承担前端工具链职责：

- Vite dev server
- React 编译和热更新
- TypeScript 类型检查
- 前端依赖管理
- 静态资源构建

Node 不承担以下职责：

- 不做生产策略计算
- 不做指标引擎
- 不做回测引擎
- 不做交易所密钥管理
- 不做真实下单
- 不做长期行情采集 Worker

当前前端中已有的 Binance REST/WebSocket 和策略 evaluator 是为了快速验证产品体验。它们属于原型层，不是最终生产架构。

## 为什么 Python 更适合后端核心

你的产品核心不是普通 CRUD，而是交易策略监控和量化分析。Python 更合适的原因：

- 指标计算生态成熟：pandas、numpy、TA-Lib、pandas-ta。
- K 线和资金流数据处理更自然。
- 回测框架选择多：vectorbt、backtrader，也方便自研事件回放。
- 策略研究、参数验证、批量回放和数据分析效率高。
- 后端 Worker 可以复用指标计算、策略判断和回测逻辑。

## 前端与后端职责分工

| 层 | 职责 | 不应承担 |
|---|---|---|
| React 前端 | 页面展示、策略配置表单、监控状态查看、信号详情、复盘录入 | 长期采集、密钥、真实指标批量计算、回测 |
| Zustand 前端状态 | 原型状态、UI 状态、临时交互状态 | 生产事实源、长期业务状态 |
| FastAPI 后端 | API 契约、认证、配置、信号、复盘、模拟交易接口 | 前端渲染 |
| Python Worker | 行情采集、指标计算、策略状态机、信号生成、告警触发 | 页面交互 |
| 数据库 | 策略配置、状态、信号、K 线、资金流、复盘、模拟交易 | 临时 UI 状态 |

## 指标计算框架建议

第一阶段建议：

- `pandas`
- `numpy`
- `pandas-ta` 或 `TA-Lib`

优先顺序：

1. 先用 pandas/numpy 自研少量核心指标：EMA、MACD、ATR、KDJ。
2. 再引入 pandas-ta 或 TA-Lib 补齐更多指标。
3. 对性能敏感的批量计算，再考虑 numba 或 polars。

原因：你的策略逻辑需要可解释、可复盘，不宜过早被复杂框架锁死。

## 回测框架建议

V1 不建议一开始上复杂回测框架。推荐分三步：

1. **轻量事件回放器**
   - 输入历史 K 线、资金流、策略配置。
   - 逐根 K 线 replay。
   - 输出信号、状态流转、模拟交易结果。
   - 最适合验证你的多周期状态机。

2. **vectorbt**
   - 适合参数扫描、向量化批量对比、指标组合研究。
   - 适合后续做策略参数优化。

3. **backtrader**
   - 适合更传统的事件驱动回测。
   - 如果后续模拟订单、仓位、手续费、滑点规则复杂，可以考虑。

当前最推荐：先自研轻量事件回放器，再根据需求接 vectorbt。

## 错误方向

不要做：

- 用 Node/NestJS 做策略 Worker，只因为前端也是 TypeScript。
- 在浏览器里做长期指标计算和回测。
- 把 Binance API Key 放到前端。
- 前端直接保存生产策略状态。
- 在 UI 表格 render 中写 EMA/MACD 等策略判断。

正确方向：

- 前端负责配置和展示。
- Python 后端负责计算和事实状态。
- 前端原型中的 evaluator 后续迁移为 Python Worker 的规则参考。
