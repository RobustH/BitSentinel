import { afterEach, describe, expect, it, vi } from "vitest";
import type { StrategyInstance } from "../types";
import { fetchBackendStrategyInstances, saveBackendStrategyInstances } from "./backendStrategyApi";

const jsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const strategyInstance: StrategyInstance = {
  id: "strategy-config-1",
  templateId: "tpl-triple-trend",
  slotTemplateId: "slot-triple-trend",
  name: "三周期趋势策略",
  version: 2,
  versionHistory: [
    { version: 1, changedAt: "2026-05-20 10:00:00", summary: "创建策略" },
    { version: 2, changedAt: "2026-05-21 10:00:00", summary: "调整槽位" },
  ],
  symbols: ["BTCUSDT", "ETHUSDT"],
  enabled: true,
  slots: { direction_tf: "1d", structure_tf: "4h", trigger_tf: "1h" },
  signalIdsBySlot: { direction_tf: ["ema-trend-up"] },
  riskSignalIds: ["trend-invalid"],
  conditionIds: ["ema-trend-up", "macd-expansion"],
};

const backendStrategyInstance = {
  id: "strategy-config-1",
  template_id: "tpl-triple-trend",
  slot_template_id: "slot-triple-trend",
  name: "三周期趋势策略",
  version: 2,
  version_history: [
    { version: 1, changed_at: "2026-05-20 10:00:00", summary: "创建策略" },
    { version: 2, changed_at: "2026-05-21 10:00:00", summary: "调整槽位" },
  ],
  symbols: ["BTCUSDT", "ETHUSDT"],
  enabled: true,
  slots: { direction_tf: "1d", structure_tf: "4h", trigger_tf: "1h" },
  condition_ids: ["ema-trend-up", "macd-expansion"],
  risk_signal_ids: ["trend-invalid"],
  signal_ids_by_slot: { direction_tf: ["ema-trend-up"] },
  created_at: "2026-05-20T10:00:00+08:00",
  updated_at: "2026-05-21T10:00:00+08:00",
};

describe("backend strategy API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps complete backend strategy instance fields to frontend fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([backendStrategyInstance]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchBackendStrategyInstances();

    expect(result[0]).toMatchObject(strategyInstance);
    expect(result[0].versionHistory?.[1]).toEqual({
      version: 2,
      changedAt: "2026-05-21 10:00:00",
      summary: "调整槽位",
    });
  });

  it("sends complete frontend strategy instance fields when saving", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(backendStrategyInstance));
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveBackendStrategyInstances([strategyInstance]);
    const [, requestInit] = fetchMock.mock.calls[1];
    const body = JSON.parse(String(requestInit.body));

    expect(body).toMatchObject({
      id: "strategy-config-1",
      template_id: "tpl-triple-trend",
      slot_template_id: "slot-triple-trend",
      version: 2,
      version_history: [
        { version: 1, changed_at: "2026-05-20 10:00:00", summary: "创建策略" },
        { version: 2, changed_at: "2026-05-21 10:00:00", summary: "调整槽位" },
      ],
      slots: { direction_tf: "1d", structure_tf: "4h", trigger_tf: "1h" },
    });
    expect(result[0]).toMatchObject(strategyInstance);
  });
});
