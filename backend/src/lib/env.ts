import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3333),
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  tuya: {
    baseUrl: process.env.TUYA_BASE_URL ?? "https://openapi.tuyaus.com",
    // Só exigidos quando o serviço Tuya for efetivamente usado (ver tuyaService.ts)
    clientId: process.env.TUYA_CLIENT_ID ?? "",
    clientSecret: process.env.TUYA_CLIENT_SECRET ?? "",
  },
};

export function assertTuyaConfigured(): void {
  required("TUYA_CLIENT_ID", env.tuya.clientId || undefined);
  required("TUYA_CLIENT_SECRET", env.tuya.clientSecret || undefined);
}
