from app.models.strategy import (
    ConditionEvaluation,
    ExistingSignalInput,
    StrategyEvaluationRequest,
    StrategyEvaluationResult,
    StrategyInstanceInput,
    StrategyKlineInput,
    StrategyMoneyFlowInput,
)

SIGNAL_LABELS: dict[str, str] = {
    "ema-trend-up": "EMA 多头排列",
    "structure-squeeze-end": "震荡末期识别",
    "ema-cross-up": "EMA 金叉",
    "macd-expansion": "MACD 动量扩张",
    "oi-rising": "OI 增长",
    "taker-buy-dominant": "主动买入占优",
    "funding-not-hot": "资金费率不过热",
    "trend-invalid": "趋势失效",
}

CONFIRM_SIGNAL_IDS = {"oi-rising", "taker-buy-dominant", "funding-not-hot"}


class StrategyEvaluator:
    def evaluate_all(self, request: StrategyEvaluationRequest) -> list[StrategyEvaluationResult]:
        return [
            self.evaluate_instance(
                instance=instance,
                symbol=symbol,
                series=request.market_series.get(symbol)
                or request.market_series.get("BTCUSDT")
                or [],
                money_flow=_find_money_flow(request.money_flows, symbol),
                existing_signals=request.existing_signals,
            )
            for instance in request.strategy_instances
            if instance.enabled
            for symbol in instance.symbols
        ]

    def evaluate_instance(
        self,
        instance: StrategyInstanceInput,
        symbol: str,
        series: list[StrategyKlineInput],
        money_flow: StrategyMoneyFlowInput | None,
        existing_signals: list[ExistingSignalInput],
    ) -> StrategyEvaluationResult:
        signal_ids = _unique_signal_ids(instance)
        conditions = [
            _evaluate_condition(signal_id, instance, series, money_flow)
            for signal_id in signal_ids
        ]
        risk_invalid = _condition_passed(conditions, "trend-invalid")
        direction_passed = _slot_passed(instance, conditions, "direction_tf", allow_empty=True)
        structure_passed = _slot_passed(instance, conditions, "structure_tf", allow_empty=True)
        trigger_passed = _slot_passed(instance, conditions, "trigger_tf", allow_empty=False)
        confirm_conditions = [item for item in conditions if item.id in CONFIRM_SIGNAL_IDS]
        confirm_passed = all(item.passed for item in confirm_conditions)
        passed_count = sum(1 for item in conditions if item.passed)
        total_count = len(conditions)
        score = round((passed_count / max(total_count, 1)) * 100)
        already_triggered = any(
            signal.instance_id == instance.id
            and signal.symbol == symbol
            and signal.strength == "strong"
            for signal in existing_signals
        )

        state = "idle"
        next_waiting_for = "等待方向周期条件满足"
        if risk_invalid:
            state = "invalidated"
            next_waiting_for = "趋势失效，等待重新进入观察条件"
        elif direction_passed and structure_passed and trigger_passed and confirm_passed:
            state = "triggered"
            next_waiting_for = "条件已满足，等待信号复盘或冷却"
        elif direction_passed and structure_passed:
            state = "waiting_trigger"
            next_waiting_for = "方向和结构已满足，等待触发周期信号"
        elif direction_passed:
            state = "watching"
            next_waiting_for = "方向周期已满足，等待结构周期确认"

        return StrategyEvaluationResult(
            instance_id=instance.id,
            symbol=symbol,
            state=state,
            score=score,
            passed_count=passed_count,
            total_count=total_count,
            should_trigger_signal=state == "triggered" and not already_triggered,
            next_waiting_for=next_waiting_for,
            conditions=conditions,
        )


def _evaluate_condition(
    signal_id: str,
    instance: StrategyInstanceInput,
    series: list[StrategyKlineInput],
    money_flow: StrategyMoneyFlowInput | None,
) -> ConditionEvaluation:
    slot_key = _slot_for_signal(instance, signal_id)
    passed = False
    reason = "暂未命中"

    if signal_id == "ema-trend-up":
        passed = len(series) >= 21 and _is_ema_trend_up(series)
        reason = "EMA9 高于 EMA21，短均线斜率向上" if passed else "趋势均线尚未形成多头排列"
    elif signal_id == "ema-cross-up":
        passed = len(series) >= 21 and _is_ema_cross_up(series)
        reason = "最近一根 K 线出现 EMA9 上穿 EMA21" if passed else "触发周期暂未出现 EMA 金叉"
    elif signal_id == "macd-expansion":
        passed = len(series) >= 26 and _is_macd_expanding(series)
        reason = "EMA12-EMA26 差值扩大，动量增强" if passed else "动量扩张不足"
    elif signal_id == "structure-squeeze-end":
        passed = len(series) >= 12 and _is_structure_squeeze_end(series)
        reason = "近期波动较前段扩大，结构接近蓄势末期" if passed else "结构仍偏收敛或无明显放大"
    elif signal_id == "oi-rising":
        oi_change = money_flow.oi_change if money_flow else None
        passed = oi_change is not None and oi_change > 0
        reason = f"OI 同向增加 {money_flow.oi_change}%" if passed else "OI 未形成正向增长"
    elif signal_id == "taker-buy-dominant":
        passed = (
            (money_flow.taker_buy_ratio if money_flow else None) is not None
            and money_flow.taker_buy_ratio >= 55
        )
        reason = (
            f"主动买入占比 {money_flow.taker_buy_ratio}%"
            if passed
            else "主动买入比例未达到 55%"
        )
    elif signal_id == "funding-not-hot":
        passed = (
            (money_flow.funding_rate if money_flow else None) is not None
            and money_flow.funding_rate <= 0.08
        )
        reason = f"资金费率 {money_flow.funding_rate}% 未过热" if passed else "资金费率偏热或缺失"
    elif signal_id == "trend-invalid":
        passed = len(series) >= 21 and not _is_ema_trend_up(series)
        reason = "方向均线转弱，触发失效条件" if passed else "方向趋势尚未失效"

    return ConditionEvaluation(
        id=signal_id,
        label=SIGNAL_LABELS.get(signal_id, signal_id),
        slot_key=slot_key,
        passed=passed,
        score=100 if passed else 0,
        reason=reason,
    )


def _unique_signal_ids(instance: StrategyInstanceInput) -> list[str]:
    ordered_ids: list[str] = []
    for signal_id in [*instance.condition_ids, *instance.risk_signal_ids]:
        if signal_id not in ordered_ids:
            ordered_ids.append(signal_id)
    for signal_ids in instance.signal_ids_by_slot.values():
        for signal_id in signal_ids:
            if signal_id not in ordered_ids:
                ordered_ids.append(signal_id)
    return ordered_ids


def _slot_for_signal(instance: StrategyInstanceInput, signal_id: str) -> str | None:
    return next(
        (
            slot_key
            for slot_key, signal_ids in instance.signal_ids_by_slot.items()
            if signal_id in signal_ids
        ),
        None,
    )


def _slot_passed(
    instance: StrategyInstanceInput,
    conditions: list[ConditionEvaluation],
    slot_key: str,
    allow_empty: bool,
) -> bool:
    signal_ids = instance.signal_ids_by_slot.get(slot_key, [])
    if not signal_ids:
        return allow_empty
    return all(_condition_passed(conditions, signal_id) for signal_id in signal_ids)


def _condition_passed(conditions: list[ConditionEvaluation], signal_id: str) -> bool:
    return next((item.passed for item in conditions if item.id == signal_id), False)


def _find_money_flow(
    money_flows: list[StrategyMoneyFlowInput],
    symbol: str,
) -> StrategyMoneyFlowInput | None:
    return next((item for item in money_flows if item.symbol == symbol), None)


def _ema(values: list[float], period: int) -> list[float]:
    multiplier = 2 / (period + 1)
    result: list[float] = []
    for value in values:
        previous = result[-1] if result else value
        result.append(value if not result else value * multiplier + previous * (1 - multiplier))
    return result


def _latest(values: list[float]) -> float:
    return values[-1]


def _previous(values: list[float]) -> float:
    return values[-2] if len(values) >= 2 else values[-1]


def _closes(series: list[StrategyKlineInput]) -> list[float]:
    return [item.close for item in series]


def _is_ema_trend_up(series: list[StrategyKlineInput]) -> bool:
    closes = _closes(series)
    fast = _ema(closes, 9)
    slow = _ema(closes, 21)
    return _latest(fast) > _latest(slow) and _latest(fast) >= _previous(fast)


def _is_ema_cross_up(series: list[StrategyKlineInput]) -> bool:
    closes = _closes(series)
    fast = _ema(closes, 9)
    slow = _ema(closes, 21)
    return _previous(fast) <= _previous(slow) and _latest(fast) > _latest(slow)


def _is_macd_expanding(series: list[StrategyKlineInput]) -> bool:
    closes = _closes(series)
    fast = _ema(closes, 12)
    slow = _ema(closes, 26)
    current = _latest(fast) - _latest(slow)
    prior = _previous(fast) - _previous(slow)
    return current > prior and current > 0


def _is_structure_squeeze_end(series: list[StrategyKlineInput]) -> bool:
    recent = series[-6:]
    prior = series[-12:-6]
    recent_range = sum(item.high - item.low for item in recent) / max(len(recent), 1)
    prior_range = sum(item.high - item.low for item in prior) / max(len(prior), 1)
    return recent_range > prior_range * 1.04
