import { describe, expect, it } from "vitest";
import { buildSign, buildStringToSign, sha256Hex } from "./tuyaSign";

describe("tuyaSign", () => {
  it("sha256Hex do corpo vazio bate com o hash SHA-256 conhecido de string vazia", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("buildStringToSign monta METHOD\\nCONTENT-SHA256\\nHEADERS\\nURL", () => {
    const result = buildStringToSign({ method: "get", url: "/v1.0/token?grant_type=1" });
    const [method, contentHash, headers, url] = result.split("\n");
    expect(method).toBe("GET");
    expect(contentHash).toHaveLength(64);
    expect(headers).toBe("");
    expect(url).toBe("/v1.0/token?grant_type=1");
  });

  it("buildStringToSign inclui hash do corpo quando body é enviado", () => {
    const withBody = buildStringToSign({ method: "POST", url: "/v1.0/x", body: '{"a":1}' });
    const withoutBody = buildStringToSign({ method: "POST", url: "/v1.0/x", body: "" });
    expect(withBody).not.toBe(withoutBody);
  });

  it("buildSign produz um HMAC-SHA256 em maiúsculas de 64 caracteres hexadecimais", () => {
    const stringToSign = buildStringToSign({ method: "GET", url: "/v1.0/token?grant_type=1" });
    const sign = buildSign({
      clientId: "client123",
      clientSecret: "secretABC",
      timestamp: 1700000000000,
      nonce: "nonce-fixo",
      stringToSign,
    });
    expect(sign).toMatch(/^[0-9A-F]{64}$/);
  });

  it("buildSign é determinístico para as mesmas entradas", () => {
    const stringToSign = buildStringToSign({ method: "POST", url: "/v1.0/devices/abc/commands", body: '{"commands":[]}' });
    const args = {
      clientId: "client123",
      clientSecret: "secretABC",
      accessToken: "token-xyz",
      timestamp: 1700000000000,
      nonce: "nonce-fixo",
      stringToSign,
    };
    expect(buildSign(args)).toBe(buildSign(args));
  });

  it("buildSign muda quando o access_token muda (garante que o token entra na assinatura)", () => {
    const stringToSign = buildStringToSign({ method: "GET", url: "/v1.0/devices/abc" });
    const base = {
      clientId: "client123",
      clientSecret: "secretABC",
      timestamp: 1700000000000,
      nonce: "nonce-fixo",
      stringToSign,
    };
    const signA = buildSign({ ...base, accessToken: "token-a" });
    const signB = buildSign({ ...base, accessToken: "token-b" });
    expect(signA).not.toBe(signB);
  });
});
