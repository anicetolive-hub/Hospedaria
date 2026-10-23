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
  performance: {
    // Tarefas/projetos a N dias (ou menos) do prazo geram alerta "prazo a terminar"
    dueSoonDays: Number(process.env.ALERT_DUE_SOON_DAYS ?? 3),
    // Intervalo da verificação periódica de alertas (0 desliga)
    checkIntervalMinutes: Number(process.env.ALERT_CHECK_INTERVAL_MINUTES ?? 60),
    // Webhook (Microsoft Teams / Slack) que recebe os novos alertas
    webhookUrl: process.env.ALERT_WEBHOOK_URL ?? "",
    // Severidade mínima enviada ao webhook: CRITICAL | WARNING | INFO
    webhookMinSeverity: (process.env.ALERT_WEBHOOK_MIN_SEVERITY ?? "WARNING").toUpperCase(),
  },
};

export function assertTuyaConfigured(): void {
  required("TUYA_CLIENT_ID", env.tuya.clientId || undefined);
  required("TUYA_CLIENT_SECRET", env.tuya.clientSecret || undefined);
}
