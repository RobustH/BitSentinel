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


---

## 后端策略评估接入约定

### 1. Scope / Trigger
- Trigger: 前端需要把策略监控评估迁移到 Python FastAPI `POST /api/strategy/evaluate`。
- Scope: 只负责请求后端按需评估和把结果写回 Zustand，不实现 Worker 调度、持久化、真实通知或交易。

### 2. Signatures
- API client：`fetchBackendStrategyEvaluations({ strategyInstances, marketSeries, moneyFlows, signals, interval })`。
- Store action：`evaluateStrategyMonitors(): Promise<void>`。
- Backend endpoint：`POST /api/strategy/evaluate`。

### 3. Contracts
- API client 负责 DTO 转换：
  - `strategyInstances` -> `strategy_instances`。
  - `marketSeries` -> `market_series`，每根 K 线必须包含 `symbol`、`interval`、`open_time`、`open`、`high`、`low`、`close`、`volume`。
  - `moneyFlows` -> `money_flows`。
  - `signals` -> `existing_signals`，用于避免重复强信号。
- 后端响应字段使用 snake_case，client 转换为前端 `StrategyEvaluationResult` 的 camelCase 字段。
- `evaluateStrategyMonitors` 优先调用后端；后端不可用时可使用本地 `evaluateAllStrategyInstances` 作为原型兜底。
- Store 统一复用 evaluation patch 逻辑更新 `strategyEvaluations`、`strategyStates`、`signals` 和 `symbols`。

### 4. Validation & Error Matrix
| 条件 | 处理 |
|---|---|
| 后端返回非 2xx | 抛出错误，由 store action 使用本地 evaluator 兜底 |
| 后端结果 `slot_key` 不是已知周期槽位 | 转换为 `undefined`，不把未知字符串强写入领域类型 |
| 前端 K 线 `time` 解析失败 | 使用稳定 fallback `open_time`，避免请求构造失败 |
| 前端暂无 K 线 `volume` | 暂传 `0`，后续真实行情接入后补齐 |
| 已有同策略/币种强信号 | 依赖后端 `should_trigger_signal` 和前端已有去重逻辑，不重复生成强信号 |

### 5. Good/Base/Bad Cases
- Good: 页面点击“重新计算策略”只调用 store action，store 通过 client 请求后端并写回统一状态。
- Base: 后端未启动时页面仍通过本地 evaluator 产生可展示结果。
- Bad: 组件直接 `fetch("/api/strategy/evaluate")`，或后端失败时清空 `strategyEvaluations` / `strategyStates`。

### 6. Tests Required
- 后端成功分支：断言 `evaluateStrategyMonitors` 调用 API client，并写入后端返回的评估结果。
- 后端失败分支：断言 action 回退到本地 evaluator，且不合并或丢失 `strategyInstanceId + symbol` 独立状态。
- TypeScript build 必须通过，确保 DTO 转换没有绕过领域类型。

### 7. Wrong vs Correct

#### Wrong
```typescript
// 组件直接请求后端，失败兜底和状态同步会分散
await fetch("/api/strategy/evaluate", { method: "POST", body: JSON.stringify(payload) });
```

#### Correct
```typescript
// 组件只触发 store action，API client 和兜底逻辑集中维护
void evaluateStrategyMonitors();
```


---

## 后端策略持久化数据接入约定

### 1. Scope / Trigger
- Trigger: 后端已提供 `GET /api/strategy/states` 和 `GET /api/strategy/signals`，前端需要读取真实数据库中的策略状态和信号。
- Scope: 只做手动刷新和 Zustand 写入，不做 Worker 调度、轮询、WebSocket/SSE 自动推送或持久化写入。

### 2. Signatures
- API client：`fetchBackendPersistedStrategyData()`。
- Store action：`refreshPersistedStrategyData(): Promise<void>`。
- Store state：`strategyPersistenceStatus`，记录 `source`、`loading`、`lastUpdated`、`error`。
- Backend endpoints：
  - `GET /api/strategy/states`
  - `GET /api/strategy/signals`

### 3. Contracts
- API client 负责 DTO 转换：
  - `strategy_instance_id` -> `instanceId`
  - `next_waiting_for` -> `nextWaitingFor`
  - `updated_at` -> `lastUpdated`
  - `signal_id` -> `id`
  - `created_at` -> `createdAt`
- Store action 成功时把后端状态写入 `strategyStates`，把后端信号写入 `signals`。
- Store action 成功时同步更新 `symbols.status`：存在 triggered 状态的币种标为 `alert`，watching / waiting_trigger 标为 `watching`。
- Store action 失败时保留现有 `strategyStates` 和 `signals`，只写入错误状态。
- 组件只能调用 store action，不得直接请求后端持久化 API。

### 4. Validation & Error Matrix
| 条件 | 处理 |
|---|---|
| 后端返回空数组 | 前端状态同步为空，表示真实库当前无记录 |
| 后端返回非 2xx | 保留旧数据，写入 `strategyPersistenceStatus.error` |
| 后端返回未知字段 | API client 只读取契约字段，不把原始 DTO 直接写入 store |
| 后端信号 strength 为 `invalidated` | 前端 `Signal["strength"]` 必须支持并显示为失效状态 |

### 5. Good/Base/Bad Cases
- Good: 数据仓或策略监控页点击按钮，调用 `refreshPersistedStrategyData`，成功显示真实库快照。
- Base: 真实库暂无策略记录时页面显示空状态，但状态来源标记为后端。
- Bad: 组件直接 `fetch("/api/strategy/states")`，或者同步失败时清空现有 mock 数据。

### 6. Tests Required
- 成功分支：断言 store 调用 API client，并写入后端状态和信号。
- 失败分支：断言旧状态/信号对象保留，错误写入 `strategyPersistenceStatus.error`。
- TypeScript build 必须通过，确保 DTO 转换没有绕过领域类型。

### 7. Wrong vs Correct

#### Wrong
```typescript
// 组件直接请求，失败兜底和 DTO 转换会散落
const states = await fetch("/api/strategy/states");
```

#### Correct
```typescript
// 组件只触发 store action，转换和失败保留逻辑集中维护
void refreshPersistedStrategyData();
```


---

## 前端触发策略 Worker 持久化约定

### 1. Scope / Trigger
- Trigger: 用户需要从前端手动触发后端策略 Worker 单次运行，并将结果写入真实数据库。
- Scope: 只做手动 `run-once?persist=true`，不做后台调度、轮询或推送。

### 2. Signatures
- API client：`runBackendStrategyWorkerOnceAndPersist(input)`。
- Store action：`runStrategyWorkerOnceAndPersist(): Promise<StrategyWorkerRunSummary | null>`。
- Backend endpoint：`POST /api/strategy/worker/run-once?persist=true`。

### 3. Contracts
- API client 请求必须包含：
  - `strategy_instances`
  - `market_series`
  - `money_flows`
  - `existing_signals`
  - `existing_states`
- `existing_states` 从当前 Zustand `strategyStates` 转换为后端 snake_case。
- Store action 成功后必须再次调用持久化数据查询，把数据库事实源刷新回 `strategyStates` 和 `signals`。
- Store action 成功后必须保存最近一次 Worker 运行摘要，至少包括 `runId`、评估数量、生成信号数、更新状态数、插入信号数。
- Store action 成功时应返回本次 Worker 运行摘要，方便页面给出即时通知。
- Store action 失败时保留现有状态和信号，只记录 `strategyPersistenceStatus.error`。
- Store action 失败时返回 `null`，页面可据此展示失败通知。
- Store action 失败时不得清空上一条成功 Worker 运行摘要。
- 页面组件仍只能调用 store action；成功通知展示评估数量、更新状态数、插入信号数，失败通知展示 `strategyPersistenceStatus.error`。

### 4. Validation & Error Matrix
| 条件 | 处理 |
|---|---|
| Worker 运行成功且持久化成功 | 刷新真实库快照并标记 `source = backend` |
| Worker 请求失败 | 保留旧数据，记录错误 |
| Worker 成功但后续刷新失败 | 保留旧数据，记录错误 |
| 当前已有强信号 | 后端负责去重，前端只提交 `existing_signals` |
| 已有上一条成功运行摘要 | 失败时保留摘要，方便用户判断上一次成功入库结果 |

### 5. Good/Base/Bad Cases
- Good: 策略监控页点击“运行Worker并入库”，随后页面展示真实库状态。
- Base: 没有新信号时仍会更新当前策略状态。
- Bad: 组件直接拼 DTO fetch，或只运行 Worker 不刷新数据库事实源。

### 6. Tests Required
- 成功分支：断言 Worker client 被调用，随后刷新持久化数据。
- 成功分支：断言 store 写入并返回最近一次 Worker 运行摘要。
- 失败分支：断言返回 `null`，旧状态和上一条运行摘要保留，错误写入 `strategyPersistenceStatus.error`。
- TypeScript build 必须通过。

### 7. Wrong vs Correct

#### Wrong
```typescript
// 只运行 Worker，不刷新真实库快照，页面仍旧
await runBackendStrategyWorkerOnceAndPersist(input);
```

#### Correct
```typescript
// Store action 运行 Worker 后立即读取数据库事实源
void runStrategyWorkerOnceAndPersist();
```


---

## 前端读取策略 Worker 运行历史约定

### 1. Scope / Trigger
- Trigger: 后端提供 `GET /api/strategy/worker/runs`，前端需要展示最近 Worker 入库运行历史。
- Scope: 只做手动刷新和运行成功后的自动刷新，不做分页、轮询或历史详情页。

### 2. Signatures
- API client：`fetchBackendStrategyWorkerRuns(limit)`。
- Store action：`refreshWorkerRunHistory(): Promise<void>`。
- Store state：`strategyPersistenceStatus.workerRunHistory: StrategyWorkerRunSummary[]`。
- Backend endpoint：`GET /api/strategy/worker/runs?limit=10`。

### 3. Contracts
- API client 负责 DTO 转换：
  - `run_id` -> `runId`
  - `ran_at` -> `ranAt`
  - `evaluated_count` -> `evaluatedCount`
  - `generated_signal_count` -> `generatedSignalCount`
  - `upserted_state_count` -> `upsertedStateCount`
  - `inserted_signal_count` -> `insertedSignalCount`
- Store action 成功时写入 `workerRunHistory`，并标记 `source = backend`。
- Store action 失败时保留旧历史列表，只写入 `strategyPersistenceStatus.error`。
- `runStrategyWorkerOnceAndPersist` 成功后应刷新运行历史，让页面能看到刚完成的后端事实记录。
- 组件只能调用 store action，不得直接请求 `/api/strategy/worker/runs`。

### 4. Validation & Error Matrix
| 条件 | 处理 |
|---|---|
| 后端返回空数组 | 展示空历史，不视为错误 |
| 后端返回非 2xx | 保留旧历史，写入错误状态 |
| 运行 Worker 成功 | 先刷新持久化状态和信号，再刷新运行历史 |
| 运行历史刷新失败 | 不清空最近一次 Worker 摘要或旧历史 |

### 5. Good/Base/Bad Cases
- Good: 策略监控页展示 `workerRunHistory` 表格，并通过按钮调用 `refreshWorkerRunHistory`。
- Base: 真实库暂无历史时页面展示可解释空态。
- Bad: 组件直接 `fetch("/api/strategy/worker/runs")`，或失败时清空旧历史列表。

### 6. Tests Required
- 成功分支：断言 store 调用 API client，并写入运行历史。
- 失败分支：断言旧历史列表保留，错误写入 `strategyPersistenceStatus.error`。
- Worker 入库成功分支：断言成功后刷新运行历史。
- TypeScript build 必须通过。

### 7. Wrong vs Correct

#### Wrong
```typescript
// 组件直接请求后端，状态和失败兜底会散落
const runs = await fetch("/api/strategy/worker/runs");
```

#### Correct
```typescript
// 组件只触发 store action
void refreshWorkerRunHistory();
```


---

## 后端数据库连接状态接入约定

### 1. Scope / Trigger
- Trigger: 后端提供 `GET /api/system/database/test`，前端需要展示当前数据库连接状态。
- Scope: 只测试和展示脱敏连接状态，不编辑、不保存、不回显数据库连接串或密码。

### 2. Signatures
- API client：`fetchBackendDatabaseConnectionStatus()`。
- Store action：`refreshDatabaseConnectionStatus(): Promise<void>`。
- Store state：`databaseConnectionStatus`。
- Backend endpoint：`GET /api/system/database/test`。

### 3. Contracts
- API client 只读取后端返回的 `connected`、`message`、`target`。
- `target` 只允许展示 `driver`、`host`、`port`、`database`。
- Store action 成功时更新连接状态、最近测试时间和脱敏目标。
- Store action 失败时保留旧目标，只写入错误状态。
- 页面组件只能调用 store action，不得直接 fetch。

### 4. Validation & Error Matrix
| 条件 | 处理 |
|---|---|
| 后端连接成功 | 显示连接正常和脱敏目标 |
| 后端连接失败 | 显示连接失败和后端错误摘要 |
| 请求后端失败 | 保留旧状态，显示请求错误 |
| 响应包含敏感字段 | 前端不得展示用户名、密码或完整 URL |

### 5. Good/Base/Bad Cases
- Good: 系统设置页点击“测试连接”，展示数据库名和主机端口。
- Base: 尚未测试时显示“未测试”。
- Bad: 页面提供数据库密码输入框或把连接串写入 localStorage。

### 6. Tests Required
- 成功分支：断言 store 写入连接状态和脱敏目标。
- 失败分支：断言错误写入且不清空旧目标。
- TypeScript build 必须通过。

### 7. Wrong vs Correct

#### Wrong
```typescript
// 前端保存数据库连接串，凭据进入浏览器环境
localStorage.setItem("databaseUrl", databaseUrl);
```

#### Correct
```typescript
// 前端只触发后端测试接口并展示脱敏结果
void refreshDatabaseConnectionStatus();
```


---

## 后端数据库表状态接入约定

### 1. Scope / Trigger
- Trigger: 后端提供 `GET /api/system/database/schema`，前端需要展示当前受管理表是否已初始化。
- Scope: 只读展示数据库表状态，不编辑连接、不保存凭据、不提供网页建表或迁移入口。

### 2. Signatures
- API client：`fetchBackendDatabaseSchemaStatus()`。
- Store action：`refreshDatabaseSchemaStatus(): Promise<void>`。
- Composite action：`diagnoseDatabaseReadiness(): Promise<void>`。
- Store state：`databaseSchemaStatus`。
- Backend endpoint：`GET /api/system/database/schema`。

### 3. Contracts
- API client 负责 DTO 转换：
  - `ready` -> `ready`
  - `managed_tables` -> `managedTables`
  - `existing_tables` -> `existingTables`
  - `missing_tables` -> `missingTables`
- `target` 只允许展示 `driver`、`host`、`port`、`database`。
- Store action 成功时更新表状态、最近检查时间和脱敏目标。
- Store action 失败时保留旧表状态，只写入错误状态。
- `diagnoseDatabaseReadiness` 必须先调用 `refreshDatabaseConnectionStatus`；只有连接结果为 `connected = true` 时才继续调用 `refreshDatabaseSchemaStatus`。
- 页面组件只能调用 store action，不得直接 fetch。
- 页面不得提供建表按钮；初始化仍通过后端 CLI 或后续受认证管理入口完成。
- 缺表时页面可以展示只读初始化指引，命令固定为 `python -m app.scripts.init_db`，并说明命令读取后端 `.env` / `BITSENTINEL_DATABASE_URL`。
- 初始化指引不得展示数据库用户名、密码或完整连接串。

### 4. Validation & Error Matrix
| 条件 | 处理 |
|---|---|
| 后端表齐全 | 显示 ready 和已存在表 |
| 后端缺表 | 显示 missing tables 和未就绪状态 |
| 请求后端失败 | 保留旧表状态，显示请求错误 |
| 一键诊断连接失败 | 不继续请求表状态 |
| 响应包含敏感字段 | 前端不得展示用户名、密码或完整 URL |

### 5. Good/Base/Bad Cases
- Good: 系统设置页点击“检查表状态”，展示受管理表、已存在表、缺失表。
- Base: 尚未检查时显示“未检查”；缺表时显示后端 CLI 初始化指引。
- Bad: 页面提供“初始化数据库”按钮，或把 database URL 写入前端状态。

### 6. Tests Required
- 成功分支：断言 store 写入 ready/missing/existing 表状态。
- 失败分支：断言错误写入且不清空旧表状态。
- 一键诊断：断言连接成功后查表，连接失败时不查表。
- TypeScript build 必须通过。

### 7. Wrong vs Correct

#### Wrong
```typescript
// 前端提供建表入口，容易形成无认证高风险操作
await fetch("/api/system/database/init", { method: "POST" });
```

#### Correct
```typescript
// 前端只触发只读诊断接口并展示脱敏结果
void refreshDatabaseSchemaStatus();
```
