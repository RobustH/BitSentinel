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
