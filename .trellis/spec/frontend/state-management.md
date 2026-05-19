# 状态管理规范

> 当前项目使用 Zustand 管理前端全局 mock 状态。

---

## 当前状态来源

主要状态文件：

- `src/store/appStore.ts`
- `src/mock/data.ts`
- `src/types.ts`

`src/mock/data.ts` 提供初始数据，`src/store/appStore.ts` 将其加载为 Zustand state，并提供 action 修改。

真实示例：

- `createStrategyInstance`：创建策略实例，并为挂载币种生成独立 `StrategyState`。
- `mountSymbolToStrategy`：把币种挂载到策略，并防止重复挂载。
- `triggerMockSignal`：生成模拟触发信号。
- `updateSignalReview`：保存复盘结果。
- `saveBacktestSnapshot`：保存回测快照。

---

## 状态分类

### 全局状态

适合放入 Zustand：

- 当前菜单 `activeSection`
- 当前选中信号 `selectedSignalId`
- 市场币种列表
- 信号库
- 周期槽位模板
- 策略实例
- 策略状态
- 信号列表
- 复盘结果
- 回测快照
- 告警规则
- 推送渠道

### 局部状态

适合放在组件 `useState`：

- 当前表单输入
- 当前 tab
- 当前筛选条件
- 当前 drawer 是否打开
- 临时排序方式
- 表格局部选择项

### 派生状态

适合用 `useMemo`：

- 按策略聚合的监控统计
- 筛选后的信号列表
- 复盘统计
- 市场排行结果
- 策略健康评分

---

## 领域状态规则

监控状态的唯一粒度是：

```text
strategyInstanceId + symbol
```

不要只按 symbol 保存监控状态。

原因：

- 一个币种可以被多个策略监控。
- 同一个币种在不同策略下可能处于不同状态。

---

## Action 规则

Zustand action 应放在 `src/store/appStore.ts`，命名使用动词开头：

- `setActiveSection`
- `selectSignal`
- `addSignalDefinition`
- `addTimeframeSlotTemplate`
- `createStrategyInstance`
- `mountSymbolToStrategy`
- `triggerMockSignal`
- `toggleStrategyEnabled`
- `duplicateStrategy`
- `updateSignalReview`

规则：

- action 内部负责保持相关状态一致。
- 创建策略时，应同步创建挂载币种的状态。
- 挂载币种时，应避免重复的 `strategyInstanceId + symbol`。
- 复盘和回测应保留策略版本。

---

## 后端接入前规则

当前没有 server state 库。

接后端前不要把 API 请求直接散落到组件中。应先确定：

- API client 放置位置。
- 请求缓存策略。
- WebSocket 事件如何写入 store。
- 乐观更新和失败回滚规则。

---

## 常见问题

- 不要在多个组件中复制同一份业务状态。
- 不要在 `src/mock/data.ts` 中写会修改运行时状态的逻辑。
- 不要让组件直接修改数组对象，必须通过 store action。
- 不要把长期业务状态只存在组件局部 state 中。


---

## Binance 公共行情接入约定

- 真实交易所公共行情请求集中放在 `src/services/binanceApi.ts`，页面组件不得直接 `fetch` Binance。
- `src/store/appStore.ts` 负责把 API 返回值写入 Zustand，并维护 `marketDataStatus`。
- `marketDataStatus.source` 用于区分当前展示的是 `mock` 还是 `binance` 数据。
- 请求失败时保留旧数据或 mock 数据，只记录 `marketDataStatus.error`，不要让市场页或数据仓页空白。
- 前端只允许接入公共行情端点，不允许保存 API Key、secret 或发起签名下单请求。


---

## 后端 Ticker 接入约定

### 1. Scope / Trigger
- Trigger: 前端需要优先从 Python FastAPI `/api/market/tickers` 获取市场列表行情。
- Scope: 只接后端公共行情 API，不删除前端 Binance 原型服务，不引入真实交易能力。

### 2. Signatures
- API client：`fetchBackendMarketTickers(symbols)`。
- Store action：`refreshBackendMarketData()`。
- Store state：`marketDataStatus.source` 必须支持 `mock` / `binance` / `backend`。

### 3. Contracts
- API client 只负责请求和响应解析，不直接修改 Zustand。
- Store action 负责把后端 ticker 映射到现有 `symbols`，并维护 `marketDataStatus`。
- 成功时把 `source` 标记为 `backend`。
- 失败时保留旧市场数据或 mock 数据，只写入 `marketDataStatus.error`。
- 组件只能调用 store action，不能直接请求 `/api/market/tickers`。

### 4. Validation & Error Matrix
- 后端不可用 -> 保留旧 `symbols`，记录错误状态。
- 部分 symbol 缺失 -> 只更新返回的 symbol，未返回的保留旧值。
- 响应字段格式异常 -> 记录错误，不写入半解析数据。
- 前端 Binance 原型服务仍存在 -> 不作为后端路径失败时的隐式自动重试，除非 action 明确设计该回退。

### 5. Good/Base/Bad Cases
- Good: 页面点击刷新后调用 `refreshBackendMarketData`，成功显示后端来源。
- Base: 后端失败时页面继续展示旧数据，同时显示错误。
- Bad: 组件直接 `fetch("/api/market/tickers")`，或失败时清空市场列表。

### 6. Tests Required
- 成功分支：写入后端 ticker，`marketDataStatus.source` 为 `backend`。
- 失败分支：旧 `symbols` 保留，错误写入 `marketDataStatus.error`。
- TypeScript 必须通过，确保 `backend` source 类型和状态字段一致。

### 7. Wrong vs Correct

#### Wrong
```typescript
// 组件直接请求后端，状态来源和失败兜底会分散
const tickers = await fetch("/api/market/tickers");
```

#### Correct
```typescript
// 组件只触发 store action
refreshBackendMarketData();
```


---

## Binance WebSocket 公共行情接入约定

### 1. Scope / Trigger
- Trigger: 需要从 Binance 公共 WebSocket 推送更新前端市场状态。
- Scope: 仅限公共行情 stream，不包含账户 User Data Stream、API Key、secret、签名请求或真实交易。

### 2. Signatures
- 服务层入口：`startBinanceTickerStream({ symbols, onTicker, onStatus }) => StopMarketStream`。
- Store action：`startBinanceMarketStream()`、`stopBinanceMarketStream()`。
- Store state：`marketStreamStatus: MarketStreamStatus`。

### 3. Contracts
- ticker update 字段：`symbol`、`price`、`change24h`、`quoteVolume`、`eventTime`。
- status 字段：`status`、`lastEventAt`、`reconnects`、`endpoint`、`error`。
- WebSocket 服务层只负责连接和 payload 转换，不能直接修改 Zustand。
- Zustand action 负责把 ticker 写入 `symbols` 和 `marketSeries`。

### 4. Validation & Error Matrix
- WebSocket unsupported -> `marketStreamStatus.status = "error"`。
- Payload parse failed -> 保留旧行情，写入 `marketStreamStatus.error`。
- Connection closed unexpectedly -> 标记 `disconnected` 并重连。
- Manual stop -> 标记 `disconnected`，不重连。

### 5. Good/Base/Bad Cases
- Good: 页面调用 store action 启停，服务层集中管理连接。
- Base: ticker 到达后只更新对应 symbol，BTCUSDT 同步更新最后一根 K 线。
- Bad: 在组件里直接 `new WebSocket`，或把 API Key/账户流放到浏览器。

### 6. Tests Required
- Store 初始状态为 `idle`。
- Stop action 后状态为 `disconnected`，且不清空市场数据。
- TypeScript 必须通过，确保 payload 和 state 类型一致。

### 7. Wrong vs Correct

#### Wrong
```typescript
// 组件里直接连接，状态散落，无法统一停止或测试
new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@ticker");
```

#### Correct
```typescript
// 组件只调用 store action，连接细节集中在服务层
startBinanceMarketStream();
```


---

## 后端 K 线接入约定

### 1. Scope / Trigger
- Trigger: 前端需要从 Python FastAPI `/api/market/klines` 获取指定交易对和周期的 K 线。
- Scope: 只负责 UI 展示所需 K 线刷新；指标计算、落库和生产事实源由后端任务处理。

### 2. Signatures
- API client：`fetchBackendMarketKlines(symbol, interval, limit)`。
- Store action：`refreshBackendKlines(symbol, interval)`。
- Store state：K 线刷新状态必须记录 `loading`、`error`、`source`、`timeframe` 和最近更新时间。

### 3. Contracts
- 请求参数：`symbol` 使用交易对字符串，`interval` 支持 `15m` / `1h` / `4h` / `1d`，`limit` 使用页面所需的有限条数。
- 成功时把返回 K 线写入 `marketSeries[symbol]`，并把来源标记为后端。
- 失败时保留旧 `marketSeries[symbol]`，只更新错误状态；图表不能变空。
- 组件只能调用 store action，不能直接请求 `/api/market/klines`。

### 4. Validation & Error Matrix
- 后端不可用 -> 保留旧 K 线，写入错误状态。
- 返回空数组 -> 保留旧 K 线或显示可解释空态，不清空为不可用图表。
- 周期切换 -> 更新 `timeframe` 后重新请求，不复用错误周期的数据状态。
- 非当前选中币种返回 -> 只写入对应 `symbol` 的 `marketSeries`。

### 5. Good/Base/Bad Cases
- Good: 用户切换币种或周期后，store action 刷新对应 K 线并保持旧数据兜底。
- Base: 后端慢或失败时，页面显示 loading/error，同时图表继续展示旧数据。
- Bad: 组件直接 `fetch("/api/market/klines")`，失败时把 `marketSeries[symbol]` 清空。

### 6. Tests Required
- 成功分支：`refreshBackendKlines` 写入 `marketSeries[symbol]` 和刷新状态。
- 失败分支：旧 K 线保留，错误写入状态。
- TypeScript 必须通过，确保周期、K 线字段和状态字段一致。

### 7. Wrong vs Correct

#### Wrong
```typescript
// 组件直接请求并覆盖图表数据，失败时容易清空旧 K 线
const response = await fetch("/api/market/klines");
```

#### Correct
```typescript
// 组件只发起 store action，兜底和状态一致性由 store 维护
refreshBackendKlines(symbol, timeframe);
```


---

## 策略条件计算引擎约定

### 1. Scope / Trigger
- Trigger: 行情刷新、WebSocket ticker 到达或用户手动点击重新计算。
- Scope: 前端原型中的策略计算，计算粒度必须是 `strategyInstanceId + symbol`。

### 2. Signatures
- 服务层入口：`evaluateAllStrategyInstances({ strategyInstances, marketSeries, moneyFlows, signals })`。
- Store action：`evaluateStrategyMonitors()`。
- Store state：`strategyEvaluations: StrategyEvaluationResult[]`。

### 3. Contracts
- 每条结果必须包含：`instanceId`、`symbol`、`suggestedState`、`score`、`passedCount`、`totalCount`、`conditions`、`nextWaitingFor`。
- evaluator 只能返回计算结果，不能直接修改 Zustand。
- Zustand action 负责把计算结果写入 `strategyEvaluations`，并同步更新 `strategyStates`。
- 满足触发条件时可生成信号，但必须避免同一策略/币种重复生成强信号。

### 4. Validation & Error Matrix
- K 线不足 -> 条件返回未命中，页面保留待计算/低评分状态。
- 资金流缺失 -> 资金流类条件未命中，不抛异常。
- 策略无挂载币种 -> 不生成计算结果。
- 触发条件满足但已有强信号 -> 不重复生成信号。

### 5. Good/Base/Bad Cases
- Good: REST/WebSocket 更新行情后调用 store action 重新计算。
- Base: 页面读取 `strategyEvaluations` 展示评分和命中条件。
- Bad: 在组件表格 render 中直接计算 EMA/MACD。

### 6. Tests Required
- `evaluateStrategyMonitors` 后应生成至少一条计算结果。
- 计算后不能丢失 `strategyInstanceId + symbol` 独立状态。
- TypeScript 必须通过，保证条件结果和状态机字段一致。

### 7. Wrong vs Correct

#### Wrong
```typescript
// 页面层直接写策略判断，无法复用到后端 Worker
const passed = ema9 > ema21;
```

#### Correct
```typescript
// 页面只展示结果，业务判断集中在 evaluator 服务层
evaluateStrategyMonitors();
```
