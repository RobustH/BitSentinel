import type { DatabaseConnectionStatus } from "../types";

const BACKEND_API_BASE_URL = import.meta.env.VITE_BACKEND_API_BASE_URL ?? "http://127.0.0.1:8000";

type BackendDatabaseConnectionTestResult = {
  connected: boolean;
  message: string;
  target: {
    driver: string;
    host: string | null;
    port: number | null;
    database: string | null;
  };
};

export async function fetchBackendDatabaseConnectionStatus(): Promise<DatabaseConnectionStatus> {
  const response = await fetch(`${BACKEND_API_BASE_URL}/api/system/database/test`);
  if (!response.ok) throw new Error(`Backend database test failed: ${response.status}`);

  const payload = (await response.json()) as BackendDatabaseConnectionTestResult;
  return {
    connected: payload.connected,
    loading: false,
    lastCheckedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    error: payload.connected ? null : payload.message,
    message: payload.message,
    target: payload.target,
  };
}
