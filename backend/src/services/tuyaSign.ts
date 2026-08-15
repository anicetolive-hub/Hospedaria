import { createHash, createHmac, randomUUID } from "node:crypto";

/**
 * Implementação do algoritmo de assinatura da Tuya Cloud API (versão 2.0,
 * usada por todas as rotas /v1.x). Referência oficial:
 * https://developer.tuya.com/en/docs/iot/new-singnature?id=Kbw0q34cs2e5g
 *
 * stringToSign = METHOD + "\n" + SHA256(body) + "\n" + headersAssinados + "\n" + url
 * signStr      = client_id + access_token(se houver) + t + nonce + stringToSign
 * sign         = HMAC-SHA256(signStr, client_secret) em maiúsculas
 */

export function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function hmacSha256Upper(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex").toUpperCase();
}

export interface StringToSignInput {
  method: string;
  url: string; // path + query string, ex: /v1.0/devices/xxx/commands
  body?: string;
  signedHeadersStr?: string; // normalmente vazio, salvo uso de "Signature-Headers"
}

export function buildStringToSign({ method, url, body = "", signedHeadersStr = "" }: StringToSignInput): string {
  return [method.toUpperCase(), sha256Hex(body), signedHeadersStr, url].join("\n");
}

export interface SignInput {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  timestamp: number;
  nonce?: string;
  stringToSign: string;
}

export function buildSign({ clientId, clientSecret, accessToken = "", timestamp, nonce = "", stringToSign }: SignInput): string {
  const signStr = `${clientId}${accessToken}${timestamp}${nonce}${stringToSign}`;
  return hmacSha256Upper(signStr, clientSecret);
}

export function newNonce(): string {
  return randomUUID();
}
