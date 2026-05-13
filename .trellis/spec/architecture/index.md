# BitSentinel 架构规范索引

> 本目录记录 BitSentinel 的跨层架构决策。后续创建后端、指标计算、回测、Worker、数据库相关 Trellis 任务前，应先读取这里的规范。

## 当前结论

BitSentinel 的正式技术路线是：

- 前端：React + TypeScript + Vite，用于界面、交互和原型验证。
- 后端：Python + FastAPI，用于 API、策略服务和系统编排。
- 行情采集：Python async worker，接 Binance REST / WebSocket。
- 指标计算：Python 生态，优先 pandas / numpy / pandas-ta / TA-Lib。
- 回测：Python 生态，按阶段选择自研轻量事件回放、vectorbt 或 backtrader。
- 数据库：PostgreSQL + TimescaleDB 起步，后续大规模时序分析再引入 ClickHouse。

## 规范文件

| 文档 | 说明 |
|---|---|
| [技术栈边界](./technology-boundaries.md) | Node、前端、Python 后端、指标计算、回测的职责边界 |
| [后端路线](./backend-roadmap.md) | Python 后端最小闭环、Worker、数据层和后续任务顺序 |

## 使用规则

1. 涉及后端、数据库、行情采集、指标计算、回测、模拟交易时，先读 `technology-boundaries.md`。
2. 不要把浏览器端策略计算原型误认为最终生产计算架构。
3. Node 只作为前端工具链，不作为策略 Worker 或回测引擎。
4. 指标计算、回测、信号生成、模拟交易应优先落到 Python 后端。
