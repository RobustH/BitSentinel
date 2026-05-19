# Binance REST 行情后端 API 研究记录

## 本地架构依据

- `.trellis/spec/architecture/technology-boundaries.md` 要求生产级行情采集和指标计算放在 Python 后端。
- `.trellis/spec/architecture/backend-roadmap.md` 将 Binance REST 行情采集列为后端第二阶段。
- 当前前端已有 `src/services/binanceApi.ts` 原型能力，本任务只在 Python 后端建立等价入口。

## Binance 公共接口映射

| 能力 | Binance 接口 | 后端服务方法 |
|---|---|---|
| 24h ticker | `/api/v3/ticker/24hr` | `fetch_tickers` |
| 现货 K 线 | `/api/v3/klines` | `fetch_klines` |
| 合约资金费率快照 | `/fapi/v1/premiumIndex` | `fetch_futures_premium_index` |
| 合约持仓量 | `/fapi/v1/openInterest` | `fetch_open_interest` |

## 设计取舍

- 先不落库，API 直接代理并标准化 Binance 公共数据。
- 先不引入复杂缓存，避免把第一版范围扩大。
- 路由层负责参数校验和 HTTP 错误映射，服务层负责调用 Binance 和原始数据获取。
- 标准化输出由单独转换函数处理，方便后续复用到 Worker 入库。

## 风险

- Binance 公共接口可能超时或限流，当前阶段先返回 `502`，后续任务再加重试、缓存和降级。
- 当前默认支持币种固定，后续应从数据库或配置表读取。
