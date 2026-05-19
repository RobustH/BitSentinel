# Python 后端最小服务骨架

## 目标

为 BitSentinel 建立生产后端的最小 Python 服务骨架，明确前端原型能力后续迁移到 Python 后端的位置，避免继续把指标计算、策略状态机、回测和模拟交易放在浏览器端。

## 范围

- 新建 `backend/` FastAPI 项目骨架。
- 提供 `/api/health` 健康检查接口。
- 提供环境变量示例和 PostgreSQL / TimescaleDB / Redis / Binance 公共 API 配置入口。
- 预留核心服务目录：
  - 行情采集：Binance REST / WebSocket
  - 指标计算：EMA/MACD 等后续指标引擎
  - 策略引擎：条件计算、状态机、信号生成
  - 回测复盘：事件回放和模拟交易记录
  - 告警推送：邮箱优先
- 提供 Docker Compose 骨架，包含 backend、TimescaleDB、Redis。

## 非目标

- 不实现真实数据库迁移。
- 不实现真实 Binance 数据落库。
- 不实现完整指标计算、策略状态机和回测。
- 不接入真实交易 API。
- 不改动当前前端页面和交互。

## 验收标准

- `backend/` 目录结构清晰，后续任务可以按模块继续填充。
- FastAPI 应用有明确入口 `backend/app/main.py`。
- `/api/health` 返回服务状态、环境、服务名。
- `.env.example` 包含后端启动和外部服务所需的关键配置。
- `docker-compose.yml` 能表达后端、TimescaleDB、Redis 的本地开发拓扑。
- 后端 Python 文件通过语法编译检查。

## 设计约束

- Node 只保留为前端工具链，不作为策略 Worker 或回测引擎。
- Python 后端是指标计算、策略状态机、信号生成、回测和模拟交易的事实源。
- 当前阶段只做骨架，保证边界清晰，不提前引入复杂业务实现。
