import { describe, expect, it } from "vitest";
import { createBitSentinelStore } from "./appStore";

describe("strategy assembly mock store", () => {
  it("creates a strategy instance and independent states for every mounted symbol", () => {
    const store = createBitSentinelStore();

    const instanceId = store.getState().createStrategyInstance({
      templateId: "tpl-dual-ma",
      name: "4h/1h 双均线趋势监控",
      symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
      slots: {
        direction_tf: "4h",
        structure_tf: "1h",
        trigger_tf: "15m",
      },
      conditionIds: ["ema-trend-up", "ema-cross-up", "oi-rising"],
    });

    const state = store.getState();
    expect(state.strategyInstances.find((item) => item.id === instanceId)?.symbols).toEqual([
      "BTCUSDT",
      "ETHUSDT",
      "SOLUSDT",
    ]);
    expect(state.strategyStates.filter((item) => item.instanceId === instanceId)).toHaveLength(3);
    expect(
      state.strategyStates
        .filter((item) => item.instanceId === instanceId)
        .map((item) => item.symbol)
        .sort(),
    ).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
  });
});
