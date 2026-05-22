# 修复本地前端 CORS 配置

## Goal

修复本地前端运行在 `http://localhost:5173` 时，点击“市场监控 -> 刷新后端行情”被后端 CORS 拦截的问题。

## Requirements

* 后端默认 CORS 允许 `http://localhost:5173` 和 `http://127.0.0.1:5173`。
* 保留已有 `5176` 来源，避免影响旧本地端口。
* 同步更新 `backend/.env.example`。
* 验证带 `Origin: http://localhost:5173` 的 CORS 预检通过。

## Acceptance Criteria

* [ ] `OPTIONS /api/market/tickers` 对 `Origin: http://localhost:5173` 返回成功。
* [ ] `GET /api/market/tickers` 仍返回行情数据。
* [ ] 不改动业务接口逻辑。

## Technical Notes

* Root cause: 当前默认 `BITSENTINEL_CORS_ORIGINS` 只包含 `5176`，但 Vite 实际启动在 `5173`。
* Files:
  * `backend/app/core/config.py`
  * `backend/.env.example`
