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

### 后端服务骨架契约

#### 1. Scope / Trigger

- Trigger: 建立 `backend/` FastAPI 服务作为后续行情、指标、策略、回测、告警的统一后端承载。
- Scope: 只定义入口、配置、目录边界和本地开发拓扑，不实现生产业务逻辑、数据库迁移或真实交易。

#### 2. Signatures

- 应用入口：`backend/app/main.py`
- API 路由入口：`backend/app/api/router.py`
- 健康检查：`GET /api/health`
- 配置入口：`backend/app/core/config.py`
- 数据库入口：`backend/app/core/database.py`
- 本地环境示例：`backend/.env.example`
- 本地拓扑：`docker-compose.yml`

#### 3. Contracts

- `/api/health` 返回服务状态、服务名和当前环境，且不得依赖数据库或外部网络。
- `backend/app/api/` 只放 HTTP 路由和请求/响应边界。
- `backend/app/core/` 只放配置、数据库连接等基础设施。
- `backend/app/models/` 放领域模型和后续数据库模型。
- `backend/app/services/market_data/` 放 Binance REST / WebSocket 行情采集。
- `backend/app/services/indicators/` 放 EMA/MACD 等指标计算。
- `backend/app/services/strategy_engine/` 放条件计算、状态机、信号生成和后续 Worker。
- `backend/app/services/backtest/` 放事件回放、复盘和模拟交易记录。
- `backend/app/services/alerts/` 放邮箱和后续推送通道。
- `docker-compose.yml` 表达 backend、PostgreSQL/TimescaleDB、Redis 的本地开发拓扑。

#### 4. Validation & Error Matrix

| 条件 | 处理 |
|---|---|
| 缺少 `.env` | 使用 `.env.example` 对应默认值或启动时报明确配置错误 |
| 数据库不可用 | `/api/health` 仍可返回服务健康，不把外部依赖作为基础存活条件 |
| 业务模块尚未实现 | 保留占位模块，但不得在入口导入会失败的未完成依赖 |
| 后续新增路由 | 通过 `backend/app/api/router.py` 挂载，避免散落在 `main.py` |

#### 5. Good/Base/Bad Cases

- Good: 新后端能力按 `api -> services -> models/core` 边界落位。
- Base: 业务逻辑未实现时保留轻量占位，不影响应用启动和健康检查。
- Bad: 在浏览器端继续扩展生产指标、策略 Worker、回测或真实交易能力。

#### 6. Tests Required

- 后端测试覆盖 `/api/health`。
- 后续新增 API 时补对应路由/转换测试。
- `ruff check .` 和 `pytest` 必须通过。

#### 7. Wrong vs Correct

#### Wrong

```python
# main.py 中直接塞业务逻辑和外部调用
@app.get("/api/market/tickers")
async def tickers():
    return await call_binance_directly()
```

#### Correct

```python
# main.py 只创建应用并挂载 router；业务逻辑放到 api/services 分层
app.include_router(api_router, prefix="/api")
```

### 后端数据库连接测试契约

#### 1. Scope / Trigger

- Trigger: 数据库连接必须由后端配置文件或部署环境变量管理，同时需要一个可测试的后端诊断入口确认当前配置是否可连。
- Scope: 只测试当前后端配置的数据库连接，不在页面编辑连接串，不创建业务表，不改变 `/api/health` 的无外部依赖语义。

#### 2. Signatures

- Env key: `BITSENTINEL_DATABASE_URL`
- Config field: `Settings.database_url`
- Engine provider: `backend/app/core/database.py::get_database_engine`
- Service: `check_database_connection(engine, database_url)`
- HTTP: `GET /api/system/database/test`
- Response model: `DatabaseConnectionTestResult`

#### 3. Contracts

- 数据库连接串只来自后端配置：`.env`、`.env.example` 或部署环境变量。
- 响应字段：
  - `connected`: `true` / `false`
  - `message`: 可读测试结果，不包含密码。
  - `target`: 脱敏目标信息，只允许包含 `driver`、`host`、`port`、`database`。
- 接口不得返回完整 database URL、用户名、密码或原始 secret。
- `/api/health` 仍只表达应用存活，不依赖数据库连接。

#### 4. Validation & Error Matrix

| 条件 | 处理 |
|---|---|
| 当前配置可连接 | 返回 `connected = true` 和脱敏目标信息 |
| 当前配置不可连接 | 返回 `connected = false` 和错误类别摘要 |
| database URL 包含用户名/密码 | 响应中只返回脱敏目标，不返回凭据 |
| 前端需要测试按钮 | 前端只调用测试接口，不保存或编辑连接串 |

#### 5. Good/Base/Bad Cases

- Good: 运维或本地开发通过后端 `.env` 设置 `BITSENTINEL_DATABASE_URL`，再调用测试接口确认连通。
- Base: 数据库不可用时，测试接口报告失败，但 `/api/health` 仍可返回应用存活。
- Bad: 在 React 页面、Zustand、localStorage 或前端 API client 中保存数据库连接串。

#### 6. Tests Required

- 单元测试覆盖 URL 脱敏，不得泄露密码。
- 单元测试覆盖连接成功和连接失败结果。
- API 测试覆盖 `GET /api/system/database/test` 返回稳定响应结构。
- `ruff check .` 和 `pytest` 必须通过。

#### 7. Wrong vs Correct

#### Wrong

```typescript
// 前端保存数据库连接串，凭据会进入浏览器环境
localStorage.setItem("databaseUrl", databaseUrl);
```

#### Correct

```python
# 后端从配置读取连接串，只返回脱敏诊断结果
return check_database_connection(engine, settings.database_url)
```

### 后端数据库表状态诊断契约

#### 1. Scope / Trigger

- Trigger: 数据库连接成功不代表业务表已初始化，需要后端诊断入口确认当前受管理表是否齐全。
- Scope: 只读检查 schema 状态，不创建表、不删除表、不修改数据，不改变 `/api/health` 的无外部依赖语义。

#### 2. Signatures

- Service: `check_database_schema(engine, database_url)`
- HTTP: `GET /api/system/database/schema`
- Response model: `DatabaseSchemaStatusResult`
- Managed table registry: `managed_table_names()`

#### 3. Contracts

- 响应字段：
  - `ready`: 受管理表是否全部存在。
  - `message`: 可读诊断结果，不包含密码或完整 URL。
  - `target`: 脱敏目标信息，只允许包含 `driver`、`host`、`port`、`database`。
  - `managed_tables`: 后端当前负责初始化的表名。
  - `existing_tables`: 当前数据库中已存在的受管理表。
  - `missing_tables`: 当前数据库中缺失的受管理表。
- 接口只读取当前配置数据库的表名，不执行 `create_all`。
- 数据库连接串只来自后端配置：`.env`、`.env.example` 或部署环境变量。
- 接口不得返回完整 database URL、用户名、密码或原始 secret。

#### 4. Validation & Error Matrix

| 条件 | 处理 |
|---|---|
| 所有受管理表存在 | 返回 `ready = true`，`missing_tables = []` |
| 部分或全部表缺失 | 返回 `ready = false` 和缺失表名 |
| 数据库不可用或 inspect 失败 | 返回 `ready = false` 和错误类别摘要 |
| database URL 包含用户名/密码 | 响应中只返回脱敏目标，不返回凭据 |

#### 5. Good/Base/Bad Cases

- Good: 部署后先调用 schema 诊断确认缺失表，再显式执行 `python -m app.scripts.init_db`。
- Base: 新库未初始化时接口报告缺失 `strategy_states`、`strategy_signals`、`strategy_worker_runs`。
- Bad: 暴露无认证 HTTP 建表接口，或 schema 诊断接口静默创建真实数据库表。

#### 6. Tests Required

- 单元测试覆盖全部缺表、全部表齐和响应脱敏。
- API 测试覆盖 `GET /api/system/database/schema` 的 ready、missing、failure 分支。
- `ruff check .` 和 `pytest` 必须通过。

#### 7. Wrong vs Correct

#### Wrong

```python
# 诊断接口里直接建表，部署副作用不可见
Base.metadata.create_all(bind=engine)
```

#### Correct

```python
# 只读检查，由部署动作显式初始化
return check_database_schema(engine, settings.database_url)
```

## 第二阶段：行情采集

范围：

- Binance REST 补历史 K 线。
- Binance WebSocket 采集实时 ticker/kline。
- 资金费率、OI、主动买卖比、大户多空比。
- 写入 PostgreSQL + TimescaleDB。
- 采集失败重试和断线重连。

### Binance REST 行情 API 契约

#### 1. Scope / Trigger

- Trigger: 后端提供 `/api/market/*` 作为前端和后续 Worker 的统一公共行情入口。
- Scope: 仅代理和标准化 Binance 公共行情数据，不包含 API Key、签名请求、账户数据、真实交易或落库。

#### 2. Signatures

- `GET /api/market/symbols`
- `GET /api/market/tickers?symbols=BTCUSDT,ETHUSDT`
- `GET /api/market/klines?symbol=BTCUSDT&interval=1h&limit=200`
- `GET /api/market/funding-rate?symbol=BTCUSDT`
- `GET /api/market/open-interest?symbol=BTCUSDT`
- Backend route: `backend/app/api/market.py`
- Binance service: `backend/app/services/market_data/binance_rest.py`

#### 3. Contracts

- `symbols`: 返回当前支持监控的交易对列表；第一版固定 `BTCUSDT`、`ETHUSDT`、`SOLUSDT`、`BNBUSDT`。
- `tickers`: 返回 `symbol`、最新价格、24h 涨跌幅、成交量、成交额和来源时间。
- `klines`: 请求必须包含 `symbol`；`interval` 默认 `1h`；`limit` 默认 `200`、最大 `1000`；返回标准化 K 线数组。
- `funding-rate`: 请求必须包含 `symbol`；返回资金费率、标记价格、指数价格和下一次结算时间。
- `open-interest`: 请求必须包含 `symbol`；返回合约持仓量。
- 路由层负责 FastAPI 参数校验和 HTTP 错误映射；服务层负责 Binance 调用与原始数据获取；标准化转换函数负责响应字段稳定。

#### 4. Validation & Error Matrix

| 条件 | 处理 |
|---|---|
| 必填 `symbol` 缺失 | FastAPI 参数校验返回 422 |
| `limit` 超过 1000 | 路由层限制到允许范围或返回参数错误 |
| Binance 超时、限流或非 2xx | 后端返回 502，不伪造成功行情 |
| Binance 返回字段缺失/格式异常 | 转换层抛出可测试错误，API 映射为服务错误 |
| 请求未支持 symbol | 第一版可由固定支持列表约束，后续改配置/数据库 |

#### 5. Good/Base/Bad Cases

- Good: 前端只调用 BitSentinel 后端 `/api/market/*`，后端返回稳定领域字段。
- Base: Binance 公共接口失败时，后端返回 502，前端按旧数据兜底。
- Bad: 前端继续把 Binance REST endpoint 作为生产主路径，或后端加入私有密钥/下单能力。

#### 6. Tests Required

- API 测试覆盖 `symbols`、`tickers`、`klines`、`funding-rate`、`open-interest` 路由。
- 转换测试覆盖 ticker、K 线、资金费率和 OI 字段映射。
- `ruff check .` 和 `pytest` 必须通过。
- 现有 `/api/health` 不得受影响。

#### 7. Wrong vs Correct

#### Wrong

```typescript
// 生产主路径直接从浏览器请求 Binance
await fetch("https://api.binance.com/api/v3/ticker/24hr");
```

#### Correct

```typescript
// 前端通过 BitSentinel 后端获取标准化行情
await fetch("/api/market/tickers?symbols=BTCUSDT,ETHUSDT");
```

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

### 指标摘要 API 契约

#### 1. Scope / Trigger

- Trigger: 新增跨层接口 `GET /api/indicators/summary`，后端负责计算 EMA/MACD 趋势摘要，前端只消费结果。
- 适用范围：趋势监控抽屉、后续策略 Worker 复用同一指标事实源。

#### 2. Signatures

- HTTP: `GET /api/indicators/summary?symbol=BTCUSDT&interval=1h`
- Backend route: `backend/app/api/indicators.py`
- Indicator engine: `backend/app/services/indicators/engine.py`

#### 3. Contracts

- Request:
  - `symbol`: 交易对字符串，例如 `BTCUSDT`。
  - `interval`: Binance K 线周期字符串，例如 `1h`。
- Response:
  - `symbol`: 原请求交易对。
  - `interval`: 原请求周期。
  - `ema`: 包含 `ema9`、`ema21`、`ema55`。
  - `macd`: 包含 `dif`、`dea`、`histogram`。
  - `ema_alignment`: `bullish` / `bearish` / `mixed`。
  - `macd_signal`: `bullish_cross` / `bearish_cross` / `bullish` / `bearish` / `neutral`。
  - `trend`: `bullish` / `bearish` / `neutral`。
  - `score`: 0-100 趋势评分。
- Boundary: 前端不得重新计算生产 EMA/MACD；只能展示 API 返回字段。

#### 4. Validation & Error Matrix

| 条件 | 处理 |
|---|---|
| `symbol` 缺失 | FastAPI 参数校验返回 422 |
| `interval` 缺失 | FastAPI 参数校验返回 422 |
| Binance K 线服务失败 | API 返回服务层错误，不在前端静默伪造指标 |
| K 线数量不足以计算指标 | 后端应返回可解释错误或中性结果，不能让前端补算 |

#### 5. Good/Base/Bad Cases

- Good: 后端返回完整 EMA/MACD 和趋势摘要，前端抽屉直接渲染。
- Base: 指标信号为 `neutral` 时，前端展示中性状态，不推导额外趋势。
- Bad: 在 React 组件或 Zustand action 中重复实现 EMA/MACD 公式。

#### 6. Tests Required

- 后端 API 测试断言 `/api/indicators/summary` 返回 200 和完整字段。
- 后端指标引擎测试覆盖 EMA 排列、MACD 多空信号和趋势评分边界。
- 前端 store 测试断言 action 从后端 API client 获取并保存指标摘要。

#### 7. Wrong vs Correct

#### Wrong

```typescript
// React/Zustand 中临时计算生产指标
const trend = calculateMacdTrend(candles);
```

#### Correct

```typescript
// 前端只消费后端事实源
const summary = await backendMarketApi.getIndicatorSummary(symbol, interval);
```

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

### 策略按请求评估 API 契约

#### 1. Scope / Trigger

- Trigger: 后端提供 `POST /api/strategy/evaluate`，用于把策略条件计算从前端原型迁移到 Python 后端。
- Scope: 只做按请求评估，不做后台常驻调度、数据库持久化、真实交易或 API Key 私有接口。

#### 2. Signatures

- HTTP: `POST /api/strategy/evaluate`
- Backend route: `backend/app/api/strategy.py`
- Request/response models: `backend/app/models/strategy.py`
- Evaluator: `backend/app/services/strategy_engine/evaluator.py`

#### 3. Contracts

- Request:
  - `strategy_instances`: 策略实例列表；每个实例包含 `id`、`name`、`symbols`、`enabled`、`condition_ids`、`risk_signal_ids`、`signal_ids_by_slot`。
  - `market_series`: `symbol -> K线数组` 映射；K 线包含 `symbol`、`interval`、`open_time`、`open`、`high`、`low`、`close`、`volume`。
  - `money_flows`: 可选资金流数组；每项包含 `symbol`、`funding_rate`、`oi_change`、`taker_buy_ratio`。
  - `existing_signals`: 可选已有信号数组；用于避免重复生成强信号。
- Response:
  - `results`: 每个 `strategyInstanceId + symbol` 一条结果。
  - 每条结果包含 `instance_id`、`symbol`、`state`、`score`、`passed_count`、`total_count`、`should_trigger_signal`、`next_waiting_for`、`conditions`。
- Evaluator 必须是纯函数式服务：只根据请求输入返回结果，不读写数据库，不直接触发告警或交易。

#### 4. Validation & Error Matrix

| 条件 | 处理 |
|---|---|
| 请求体字段类型错误 | Pydantic/FastAPI 返回 422 |
| `enabled = false` 的策略实例 | 不输出评估结果 |
| K 线不足 | 对应技术条件返回未命中和可解释原因，不抛异常 |
| 资金流缺失 | 资金流类条件返回未命中，不抛异常 |
| 已存在同策略/币种强信号 | `state` 可为 `triggered`，但 `should_trigger_signal = false` |

#### 5. Good/Base/Bad Cases

- Good: API 返回稳定状态建议，后续 Worker、前端和回测都复用同一 evaluator。
- Base: 输入只有少量 K 线或无资金流时，API 返回 `idle` 或待观察状态，并说明未命中原因。
- Bad: evaluator 在评估过程中直接写数据库、发通知、下单或读取全局状态。

#### 6. Tests Required

- API 测试覆盖 `watching` / `waiting_trigger`、`triggered`、重复强信号、`invalidated`、缺少输入。
- `ruff check .` 和 `pytest` 必须通过。
- 后续接数据库或调度 Worker 时，需要新增状态恢复和幂等测试。

#### 7. Wrong vs Correct

#### Wrong

```python
# 评估函数里产生副作用，后续无法复用到回测
if result.should_trigger_signal:
    send_email_alert()
```

#### Correct

```python
# 评估函数只返回事实结果，副作用由后续 Worker 或告警层处理
return StrategyEvaluationResponse(results=evaluator.evaluate_all(request))
```

### 策略 Worker 单次运行 API 契约

#### 1. Scope / Trigger

- Trigger: 后端需要把纯评估结果提升为 Worker 运行结果，表达状态变更事件和待生成信号事件。
- Scope: 只做 `run_once` 原型，不做后台常驻调度、数据库持久化、真实告警或真实交易。

#### 2. Signatures

- HTTP: `POST /api/strategy/worker/run-once`
- Request model: `StrategyWorkerRunRequest`
- Response model: `StrategyWorkerRunResponse`
- Worker service: `backend/app/services/strategy_engine/worker.py`

#### 3. Contracts

- Request 继承策略评估请求字段：
  - `strategy_instances`
  - `market_series`
  - `money_flows`
  - `existing_signals`
- Request 额外包含：
  - `existing_states`: 当前已知策略状态列表，每项按 `instance_id + symbol` 定位。
- Response 包含：
  - `run_id`: 本次 Worker 运行 ID。
  - `ran_at`: UTC ISO 时间。
  - `evaluated_count`: 本次评估结果数量。
  - `generated_signal_count`: 本次待生成信号数量。
  - `state_events`: 状态变化事件，只在旧状态与新状态不同或旧状态缺失时生成。
  - `generated_signals`: 只在 `should_trigger_signal = true` 时生成。
  - `results`: 原始 evaluator 结果，供前端和后续持久化复用。
- Worker 必须复用 `StrategyEvaluator`，不得复制策略条件计算逻辑。
- Worker 输出事件仍然是事实描述，不直接写数据库、不发通知、不下单。

#### 4. Validation & Error Matrix

| 条件 | 处理 |
|---|---|
| 请求体字段类型错误 | Pydantic/FastAPI 返回 422 |
| `enabled = false` 的策略实例 | evaluator 不输出结果，Worker 不生成事件 |
| `existing_states` 缺失某个 `instance_id + symbol` | 允许生成 `previous_state = null` 的状态事件 |
| 旧状态等于新状态 | 不生成状态事件 |
| 已存在同策略/币种强信号 | evaluator 返回 `should_trigger_signal = false`，Worker 不生成重复信号 |

#### 5. Good/Base/Bad Cases

- Good: Worker run summary 可被后续 DB repository、告警层和前端共同消费。
- Base: 没有已有状态时，Worker 仍可根据 evaluator 结果生成首个状态事件。
- Bad: Worker 内部直接发邮件、写数据库、下单，或重新实现 EMA/MACD 计算。

#### 6. Tests Required

- Worker service 测试覆盖状态事件生成、重复强信号抑制、disabled 策略跳过。
- API 测试覆盖 `/api/strategy/worker/run-once` 返回 run summary。
- `ruff check .` 和 `pytest` 必须通过。

#### 7. Wrong vs Correct

#### Wrong

```python
# Worker 中复制策略条件，并直接发通知
if ema9 > ema21:
    send_email_alert()
```

#### Correct

```python
# Worker 复用 evaluator，只产出事件，由后续层处理副作用
results = evaluator.evaluate_all(request)
return StrategyWorkerRunResponse(results=results, generated_signals=events)
```

### 策略状态和信号持久化契约

#### 1. Scope / Trigger

- Trigger: Worker 已经能产出 `state_events` 和 `generated_signals`，后端需要有事实状态持久化层。
- Scope: 第一版只定义 SQLAlchemy ORM 模型和 repository，不做 Alembic 迁移、查询 API、后台调度或真实告警。

#### 2. Signatures

- ORM Base: `backend/app/db/base.py`
- ORM models: `backend/app/db/strategy.py`
- Repository: `StrategyPersistenceRepository(session).apply_worker_run(run_response)`
- Persisting worker API: `POST /api/strategy/worker/run-once?persist=true`
- State query API: `GET /api/strategy/states?instance_id=&symbol=`
- Signal query API: `GET /api/strategy/signals?instance_id=&symbol=`
- Input: `StrategyWorkerRunResponse`
- Output: `StrategyPersistenceSummary`

#### 3. Contracts

- `strategy_states` 表按 `strategy_instance_id + symbol` 唯一保存当前策略状态。
- 状态字段至少包含：
  - `strategy_instance_id`
  - `symbol`
  - `state`
  - `last_score`
  - `next_waiting_for`
  - `updated_at`
- `strategy_signals` 表按 `signal_id` 唯一保存 Worker 生成的信号。
- 信号字段至少包含：
  - `signal_id`
  - `strategy_instance_id`
  - `symbol`
  - `strength`
  - `direction`
  - `reason`
  - `created_at`
- repository 只 `flush`，不隐式 `commit`；事务边界由 API、Worker 调度或调用方控制。
- `POST /api/strategy/worker/run-once` 默认 `persist=false`，保持纯运行行为。
- `persist=true` 时 API 层调用 repository、提交事务，并在响应中返回 `persistence` 摘要。
- 查询 API 返回当前持久化状态和信号，可按 `instance_id`、`symbol` 过滤。
- evaluator 和 Worker run summary 仍保持可测试边界；持久化层消费 Worker 输出，不把数据库副作用塞回 evaluator。

#### 4. Validation & Error Matrix

| 条件 | 处理 |
|---|---|
| 首次状态事件 | 插入 `strategy_states` |
| 同 `strategy_instance_id + symbol` 后续状态事件 | 更新已有 `strategy_states` |
| 首次信号事件 | 插入 `strategy_signals` |
| 重复 `signal_id` | 不重复插入，返回插入数为 0 |
| 调用方需要事务提交 | 调用方显式 `commit`，repository 不自动提交 |
| `persist=false` | 不访问持久化层，不要求数据库可用 |
| 查询过滤无匹配记录 | 返回空列表 |

#### 5. Good/Base/Bad Cases

- Good: Worker 调度层调用 repository 后统一提交事务。
- Base: 测试可用 SQLite 内存数据库创建 ORM 表验证 repository 行为。
- Bad: repository 自动 commit，或在 evaluator 中直接写数据库。

#### 6. Tests Required

- repository 测试覆盖状态插入、状态更新、信号插入、重复信号幂等。
- API 测试覆盖 `persist=true` 写入、`persist=false` 不写入、状态/信号查询过滤。
- 测试不得依赖本地 PostgreSQL；使用 SQLite 内存数据库即可。
- `ruff check .` 和 `pytest` 必须通过。

#### 7. Wrong vs Correct

#### Wrong

```python
# evaluator 内部写数据库，破坏 API、Worker 和回测复用
session.add(StrategySignalRecord(...))
session.commit()
```

#### Correct

```python
# Worker 产出事件，repository 消费事件，调用方控制事务
summary = repository.apply_worker_run(run_response)
session.commit()
```

### 策略表初始化命令契约

#### 1. Scope / Trigger

- Trigger: 策略状态和信号 ORM 模型已存在，真实 PostgreSQL 需要可执行的表初始化入口，避免 `persist=true` 因表不存在失败。
- Scope: 只初始化当前后端管理的策略持久化表，不做字段版本迁移、不做自动启动建表、不开放无认证 HTTP 建表接口。

#### 2. Signatures

- CLI: `python -m app.scripts.init_db`
- Service: `initialize_database(engine, database_url)`
- Managed table registry: `managed_table_names()`
- ORM models:
  - `backend/app/db/strategy.py::StrategyStateRecord`
  - `backend/app/db/strategy.py::StrategySignalRecord`

#### 3. Contracts

- 命令读取后端配置 `BITSENTINEL_DATABASE_URL`。
- 当前受管理表：
  - `strategy_states`
  - `strategy_signals`
- 初始化必须幂等；重复运行不得删除数据或重建已有表。
- 输出为 JSON：
  - `ok`: 命令是否成功。
  - `target`: 脱敏数据库目标，只包含 `driver`、`host`、`port`、`database`。
  - `managed_tables`: 当前后端负责初始化的表名列表。
  - `existing_tables`: 初始化后已存在的受管理表。
  - `created_tables`: 本次新创建的受管理表。
- 输出不得包含完整 database URL、用户名或密码。

#### 4. Validation & Error Matrix

| 条件 | 处理 |
|---|---|
| 首次运行且数据库可连接 | 创建 `strategy_states`、`strategy_signals`，返回 `ok = true` |
| 重复运行 | `created_tables = []`，保持 `ok = true` |
| 数据库不可连接或权限不足 | 返回 `ok = false` 和错误类别摘要，进程退出码非 0 |
| 需要从网页初始化 | 当前禁止；必须通过后端 CLI 或后续受认证管理入口执行 |

#### 5. Good/Base/Bad Cases

- Good: 部署后先运行 `python -m app.scripts.init_db`，再启用 `persist=true`。
- Base: 本地测试使用 SQLite 内存库验证首次创建和重复运行。
- Bad: 应用启动时静默建表，或暴露无认证 `/api/system/database/init`。

#### 6. Tests Required

- 测试 `managed_table_names()` 只包含当前策略持久化表。
- 测试首次初始化会创建两张表。
- 测试重复初始化幂等。
- 测试 CLI 输出 JSON 且不泄露密码。
- `ruff check .` 和 `pytest` 必须通过。

#### 7. Wrong vs Correct

#### Wrong

```python
# 应用启动时静默创建真实数据库表，部署行为不可见
Base.metadata.create_all(bind=engine)
```

#### Correct

```bash
# 运维动作显式执行，输出脱敏结果
python -m app.scripts.init_db
```

### 策略 Worker 运行历史契约

#### 1. Scope / Trigger

- Trigger: `persist=true` 的 Worker 运行需要留下后端事实记录，便于前端后续展示运行历史、排查调度和审计告警。
- Scope: 只记录 Worker run summary，不记录完整请求快照、条件明细、定时调度状态或告警投递结果。

#### 2. Signatures

- ORM model: `backend/app/db/strategy.py::StrategyWorkerRunRecord`
- Repository write: `StrategyPersistenceRepository(session).apply_worker_run(run_response)`
- Repository read: `StrategyPersistenceRepository(session).list_worker_runs(limit=20)`
- HTTP: `GET /api/strategy/worker/runs?limit=20`
- Response model: `PersistedStrategyWorkerRun`
- Managed table: `strategy_worker_runs`

#### 3. Contracts

- `strategy_worker_runs` 表按 `run_id` 唯一保存持久化 Worker 运行摘要。
- 字段至少包含：
  - `run_id`
  - `ran_at`
  - `evaluated_count`
  - `generated_signal_count`
  - `upserted_state_count`
  - `inserted_signal_count`
- `POST /api/strategy/worker/run-once?persist=true` 在同一事务中写入状态、信号和运行历史。
- `persist=false` 保持纯运行行为，不访问持久化层、不写运行历史。
- 查询 API 按 `ran_at desc` 返回最近运行记录，并限制 `limit` 范围，避免无界列表。
- repository 只 `flush`，不隐式 `commit`；事务边界仍由 API 或未来调度层控制。
- `python -m app.scripts.init_db` 必须把 `strategy_worker_runs` 纳入 managed tables。

#### 4. Validation & Error Matrix

| 条件 | 处理 |
|---|---|
| 首次持久化某个 `run_id` | 插入 `strategy_worker_runs` |
| 重复持久化同一 `run_id` | 更新已有摘要，不重复插入 |
| `persist=false` | 不写运行历史，查询结果不变 |
| `limit` 缺失 | 使用默认有限条数 |
| `limit` 超出允许范围 | FastAPI 参数校验返回 422 |

#### 5. Good/Base/Bad Cases

- Good: 前端历史列表只查询 `/api/strategy/worker/runs`，不从信号表反推运行记录。
- Base: 手动运行 Worker 后，历史表记录本次摘要和持久化计数。
- Bad: 把完整请求 payload 或数据库连接信息写入运行历史，或让 repository 自动 commit。

#### 6. Tests Required

- repository 测试覆盖运行历史插入、同 `run_id` 更新、倒序查询和 limit。
- API 测试覆盖 `persist=true` 写入历史、`persist=false` 不写历史、`GET /worker/runs` 查询。
- 初始化测试覆盖 managed tables 包含 `strategy_worker_runs`。
- `ruff check .` 和 `pytest` 必须通过。

#### 7. Wrong vs Correct

#### Wrong

```python
# 从 signals 表临时聚合运行历史，无法表达无信号但有状态更新的运行
session.query(StrategySignalRecord).order_by(StrategySignalRecord.created_at.desc())
```

#### Correct

```python
# Worker 持久化时显式记录运行摘要，查询层读取事实表
summary = repository.apply_worker_run(response)
session.commit()
return repository.list_worker_runs(limit=20)
```

### 策略 Worker 定时调度契约

#### 1. Scope / Trigger

- Trigger: Worker 已支持单次运行和运行历史，需要后端提供最小后台调度能力，让策略监控可以按周期自动执行。
- Scope: 第一版是进程内内存调度器，由启动请求传入 `StrategyWorkerRunRequest` 和执行间隔；不做进程重启恢复、不读取策略配置数据库、不接外部队列。

#### 2. Signatures

- Service: `StrategyWorkerScheduler`
- HTTP:
  - `POST /api/strategy/worker/scheduler/start`
  - `POST /api/strategy/worker/scheduler/stop`
  - `GET /api/strategy/worker/scheduler/status`
- Request model: `StrategyWorkerScheduleRequest`
- Response model: `StrategyWorkerSchedulerStatus`

#### 3. Contracts

- `start` 请求必须包含 `worker_request`，因为当前后端还没有策略配置事实源可供调度器自行加载。
- `interval_seconds` 必须有上下限校验，避免过高频或异常间隔。
- `persist=true` 时，调度器复用 `StrategyPersistenceRepository` 写入状态、信号和运行历史，并由调度器控制事务提交。
- `persist=false` 时，调度器不访问数据库。
- 重复启动会停止当前调度并替换为新的请求和间隔。
- 调度器不得复制 evaluator 或 Worker 的策略判断逻辑，只能调用 `StrategyWorker.run_once`。
- 状态响应至少包含运行开关、间隔、持久化开关、最近启动/停止/运行时间、下一次运行时间、最近 run id、最近错误、运行次数和跳过次数。

#### 4. Validation & Error Matrix

| 条件 | 处理 |
|---|---|
| 启动请求字段错误 | FastAPI/Pydantic 返回 422 |
| 调度器已运行时再次启动 | 停止旧任务，使用新配置启动 |
| `persist=false` | 不打开数据库 session |
| `persist=true` 且数据库写入失败 | 捕获错误写入 `last_error`，调度循环继续 |
| 后端进程重启 | 调度状态丢失，需要调用方重新启动 |

#### 5. Good/Base/Bad Cases

- Good: 前端或后续管理端先用当前策略输入启动调度，再通过状态接口观察最近运行结果。
- Base: 本地开发用 `persist=false` 验证调度循环，不依赖数据库。
- Bad: 调度器自行伪造策略配置、复制策略计算逻辑，或在应用启动时静默恢复未知调度任务。

#### 6. Tests Required

- service 测试覆盖启动、立即运行、停止和 `persist=false` 不访问数据库。
- API 测试覆盖 start/status/stop 和 interval 参数校验。
- `ruff check .` 和 `pytest` 必须通过。

### 后端策略实例配置事实源契约

#### 1. Scope / Trigger

- Trigger: Worker 调度当前依赖前端传入策略快照，后端需要先持久化策略实例配置，为后续自驱 Worker 提供事实源。
- Scope: 第一版只保存策略实例配置并提供 CRUD API，不让 Worker 调度器自动读取配置，不实现策略模板表、条件库表、认证、多租户或 Alembic 迁移。

#### 2. Signatures

- ORM model: `backend/app/db/strategy.py::StrategyInstanceRecord`
- Repository:
  - `create_strategy_instance(request)`
  - `update_strategy_instance(instance_id, request)`
  - `set_strategy_instance_enabled(instance_id, enabled)`
  - `list_strategy_instances()`
  - `get_strategy_instance(instance_id)`
- HTTP:
  - `GET /api/strategy/instances`
  - `POST /api/strategy/instances`
  - `PUT /api/strategy/instances/{instance_id}`
  - `POST /api/strategy/instances/{instance_id}/enable`
  - `POST /api/strategy/instances/{instance_id}/disable`
- Managed table: `strategy_instances`

#### 3. Contracts

- `strategy_instances` 表按 `id` 保存策略实例配置。
- 字段至少包含：
  - `id`
  - `name`
  - `symbols`
  - `enabled`
  - `condition_ids`
  - `risk_signal_ids`
  - `signal_ids_by_slot`
  - `created_at`
  - `updated_at`
- 第一版列表和映射字段使用 JSON 字符串列保存，由 repository 负责序列化和反序列化。
- repository 只 `flush`，不隐式 `commit`；事务边界由 API 控制。
- 启停 API 只修改 `enabled` 和 `updated_at`。
- `python -m app.scripts.init_db` 必须把 `strategy_instances` 纳入 managed tables。
- schema 诊断必须报告 `strategy_instances` 是否存在。
- 当前 Worker run request 仍可由前端传入；调度器读取后端策略配置属于后续任务。

#### 4. Validation & Error Matrix

| 条件 | 处理 |
|---|---|
| 创建策略实例 | 插入 `strategy_instances` 并返回持久化模型 |
| 更新存在的策略实例 | 更新传入字段，未传字段保持不变 |
| 更新或启停不存在的实例 | 返回 404 |
| JSON 字段为空 | 使用空数组或空映射 |
| 初始化数据库 | 幂等创建 `strategy_instances`，不删除已有数据 |

#### 5. Good/Base/Bad Cases

- Good: 前端后续保存策略配置到后端，再由 Worker 后续任务读取事实源。
- Base: 当前 API 可先通过测试或脚本写入策略实例。
- Bad: 在 evaluator 内部读取策略配置表，或让 repository 自动 commit。

#### 6. Tests Required

- repository 测试覆盖创建、更新、启停缺失实例。
- API 测试覆盖创建、列表、更新、启用和 404。
- 初始化和 schema 测试覆盖 `strategy_instances`。
- `ruff check .` 和 `pytest` 必须通过。

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
