# 后端指标计算服务原型研究记录

## 本地规范依据

- `.trellis/spec/architecture/backend-roadmap.md`：第三阶段是指标计算服务，包含 EMA9 / EMA21 / EMA55 / MACD。
- `.trellis/spec/architecture/technology-boundaries.md`：指标计算必须优先落到 Python 后端。
- `.trellis/spec/frontend/state-management.md`：前端接后端前应先补 API client，页面不直接 fetch。

## 设计

- 后端新增 `app/api/indicators.py`。
- 后端新增 `app/models/indicator.py`，定义响应模型。
- 扩展 `backend/app/services/indicators/engine.py`，复用现有 EMA/MACD 函数，新增摘要计算函数。
- 前端扩展 `backendMarketApi.ts`，新增 `fetchBackendIndicatorSummary`。
- 前端 store 新增 `indicatorSummaries` 和 `refreshBackendIndicatorSummary`。

## 指标判断规则

- EMA 多头：`ema9 > ema21 > ema55`。
- EMA 空头：`ema9 < ema21 < ema55`。
- MACD 金叉：上一根 DIF <= DEA，当前 DIF > DEA。
- MACD 死叉：上一根 DIF >= DEA，当前 DIF < DEA。
- 趋势评分：
  - EMA 多头加 45，空头加 20，混乱加 10。
  - MACD 多头/金叉加 35，空头/死叉加 10，中性加 15。
  - 收盘价在 EMA55 上方加 20，否则加 5。

## 风险

- 当前 EMA/MACD 使用自研简单计算，足够原型验证；未来可替换为 pandas/numpy 批量计算。
- K 线不足时返回 400，避免产生误导性指标。
