# Binance REST 行情后端 API

## 目标

把前端原型中直接访问 Binance 的行情能力迁移到 Python FastAPI 后端，建立统一的后端行情入口。前端后续只调用 BitSentinel 后端，不直接依赖 Binance 公共接口。

## 范围

- 新增后端行情 API 路由：
  - `GET /api/market/symbols`
  - `GET /api/market/tickers`
  - `GET /api/market/klines`
  - `GET /api/market/funding-rate`
  - `GET /api/market/open-interest`
- 扩展 `backend/app/services/market_data/binance_rest.py`：
  - Binance 现货 24h ticker。
  - Binance 现货 K 线。
  - Binance 合约资金费率。
  - Binance 合约持仓量。
- 提供稳定的后端响应结构，便于前端后续替换模拟数据。
- 添加基础测试，避免接口和数据转换回归。

## 非目标

- 不做数据库落库。
- 不做定时采集 Worker。
- 不做 WebSocket 实时推送。
- 不做 API Key 私有接口。
- 不改前端页面调用方式。

## API 契约

### `GET /api/market/symbols`

返回当前支持监控的币种列表，先固定为：

- `BTCUSDT`
- `ETHUSDT`
- `SOLUSDT`
- `BNBUSDT`

### `GET /api/market/tickers`

参数：

- `symbols`：可选，逗号分隔，默认使用支持监控的币种列表。

返回每个币种的最新价格、24h 涨跌幅、成交量、成交额和来源时间。

### `GET /api/market/klines`

参数：

- `symbol`：必填。
- `interval`：默认 `1h`。
- `limit`：默认 `200`，最大 `1000`。

返回标准化 K 线数组。

### `GET /api/market/funding-rate`

参数：

- `symbol`：必填。

返回当前资金费率、标记价格、指数价格和下一次资金费率结算时间。

### `GET /api/market/open-interest`

参数：

- `symbol`：必填。

返回合约持仓量。

## 验收标准

- 后端路由挂载在 `/api/market/*`。
- 测试覆盖 symbols、ticker 数据转换、klines 数据转换、资金费率和 OI 转换。
- `ruff check .` 通过。
- `pytest` 通过。
- 现有 `/api/health` 不受影响。
