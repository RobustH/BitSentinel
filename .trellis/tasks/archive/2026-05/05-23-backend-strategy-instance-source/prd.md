# 后端策略配置事实源

## 背景

当前 Worker 调度仍依赖前端启动时传入策略快照。要让后端 Worker 后续具备自驱监控能力，需要先把策略实例配置保存到后端数据库，形成策略配置事实源。

## 目标

- 新增 `strategy_instances` ORM 表，保存策略实例配置。
- 新增 repository，支持创建、更新、查询、启停策略实例。
- 新增策略实例 CRUD API。
- 将 `strategy_instances` 纳入 `python -m app.scripts.init_db` 管理表和 schema 诊断。
- 保持 evaluator / Worker 当前按请求运行能力不变。

## 非目标

- 不改前端策略配置页面。
- 不让 Worker 调度器自动读取策略配置。
- 不实现 Alembic 迁移。
- 不做认证和多租户。
- 不做策略模板表、条件库表拆分。

## API 契约

- `GET /api/strategy/instances`
  - 返回所有策略实例，默认按更新时间倒序。
- `POST /api/strategy/instances`
  - 创建策略实例。
- `PUT /api/strategy/instances/{instance_id}`
  - 更新策略实例。
- `POST /api/strategy/instances/{instance_id}/enable`
  - 启用策略实例。
- `POST /api/strategy/instances/{instance_id}/disable`
  - 停用策略实例。

## 字段

- `id`
- `name`
- `symbols`
- `enabled`
- `condition_ids`
- `risk_signal_ids`
- `signal_ids_by_slot`
- `created_at`
- `updated_at`

列表类字段第一版使用 JSON 字符串列保存，repository 负责转换为 Pydantic 模型。

## 验收

- 创建策略实例后可以查询到。
- 更新策略实例可修改名称、币种、启用状态和条件配置。
- 启停 API 只修改 `enabled`。
- 初始化命令包含 `strategy_instances`。
- schema 诊断包含 `strategy_instances`。
- repository 和 API 测试覆盖成功路径和缺失实例 404。
- 后端 `ruff check .` 和 `pytest` 通过。
