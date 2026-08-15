import { env, assertTuyaConfigured } from "../lib/env";
import { buildSign, buildStringToSign, newNonce } from "./tuyaSign";

export class TuyaApiError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly raw?: unknown,
  ) {
    super(message);
    this.name = "TuyaApiError";
  }
}

export interface TuyaCommand {
  code: string;
  value: string | number | boolean;
}

interface TokenCache {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

interface TuyaEnvelope<T> {
  success: boolean;
  code?: number;
  msg?: string;
  result: T;
  t: number;
}

let tokenCache: TokenCache | null = null;

function isTokenValid(cache: TokenCache | null): cache is TokenCache {
  // renova 60s antes de expirar para evitar corrida
  return !!cache && cache.expiresAt - 60_000 > Date.now();
}

async function rawRequest<T>(method: string, path: string, body?: unknown, accessToken?: string): Promise<TuyaEnvelope<T>> {
  const bodyStr = body !== undefined ? JSON.stringify(body) : "";
  const timestamp = Date.now();
  const nonce = newNonce();

  const stringToSign = buildStringToSign({ method, url: path, body: bodyStr });
  const sign = buildSign({
    clientId: env.tuya.clientId,
    clientSecret: env.tuya.clientSecret,
    accessToken,
    timestamp,
    nonce,
    stringToSign,
  });

  const headers: Record<string, string> = {
    client_id: env.tuya.clientId,
    sign,
    t: String(timestamp),
    sign_method: "HMAC-SHA256",
    nonce,
    "Content-Type": "application/json",
  };
  if (accessToken) headers.access_token = accessToken;

  const response = await fetch(`${env.tuya.baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? bodyStr : undefined,
  });

  const json = (await response.json()) as TuyaEnvelope<T>;

  if (!response.ok || json.success === false) {
    throw new TuyaApiError(json.msg ?? `Falha na chamada Tuya (${response.status})`, json.code, json);
  }

  return json;
}

async function getAccessToken(): Promise<string> {
  assertTuyaConfigured();

  if (isTokenValid(tokenCache)) {
    return tokenCache.accessToken;
  }

  const envelope = await rawRequest<{
    access_token: string;
    refresh_token: string;
    expire_time: number; // segundos
  }>("GET", "/v1.0/token?grant_type=1");

  tokenCache = {
    accessToken: envelope.result.access_token,
    refreshToken: envelope.result.refresh_token,
    expiresAt: Date.now() + envelope.result.expire_time * 1000,
  };

  return tokenCache.accessToken;
}

async function authedRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const accessToken = await getAccessToken();
  const envelope = await rawRequest<T>(method, path, body, accessToken);
  return envelope.result;
}

/** Envia uma lista de comandos a um dispositivo Tuya (ex: fechadura, tomada). */
export async function sendDeviceCommands(deviceId: string, commands: TuyaCommand[]): Promise<unknown> {
  if (commands.length === 0) return { skipped: true };
  return authedRequest("POST", `/v1.0/devices/${deviceId}/commands`, { commands });
}

/** Consulta informações básicas de um dispositivo (nome, online, etc.), útil para validar o mapeamento quarto -> dispositivo. */
export async function getDeviceInfo(deviceId: string): Promise<unknown> {
  return authedRequest("GET", `/v1.0/devices/${deviceId}`);
}

/** Consulta o status atual (DPs) de um dispositivo. */
export async function getDeviceStatus(deviceId: string): Promise<unknown> {
  return authedRequest("GET", `/v1.0/devices/${deviceId}/status`);
}

/** Verifica conectividade com a Tuya Cloud (obtém token com sucesso). */
export async function checkTuyaConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    await getAccessToken();
    return { connected: true };
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function parseTuyaCommands(json: string | null | undefined): TuyaCommand[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is TuyaCommand =>
        item && typeof item === "object" && typeof item.code === "string" && "value" in item,
    );
  } catch {
    return [];
  }
}

// exportado para testes
export const __internal = { rawRequest, isTokenValid };
