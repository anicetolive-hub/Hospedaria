import { describe, expect, it } from "vitest";
import {
  combineScores,
  deliveryScore,
  evaluateKpi,
  evaluateSchedule,
  kpiAlert,
  kpiAttainment,
  kpiHealth,
  lastClosedPeriod,
  periodOf,
  projectProgress,
  scheduleAlert,
  scoreHealth,
  weightedKpiScore,
} from "./engine";

const now = new Date("2026-10-23T12:00:00Z");
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("kpiAttainment", () => {
  it("calcula atingimento quando maior é melhor", () => {
    expect(kpiAttainment(95, 100, "HIGHER_IS_BETTER")).toBe(95);
  });

  it("inverte a razão quando menor é melhor", () => {
    // Meta: resolver em 4h; levou 5h → 80%
    expect(kpiAttainment(5, 4, "LOWER_IS_BETTER")).toBe(80);
    expect(kpiAttainment(0, 4, "LOWER_IS_BETTER")).toBe(120);
  });

  it("limita o atingimento a 120%", () => {
    expect(kpiAttainment(300, 100, "HIGHER_IS_BETTER")).toBe(120);
  });

  it("trata meta zero sem dividir por zero", () => {
    expect(kpiAttainment(0, 0, "HIGHER_IS_BETTER")).toBe(100);
    expect(kpiAttainment(2, 0, "LOWER_IS_BETTER")).toBe(0);
  });
});

describe("saúde", () => {
  it("classifica KPI pelo limiar de alerta", () => {
    expect(kpiHealth(100, 90)).toBe("GREEN");
    expect(kpiHealth(92, 90)).toBe("YELLOW");
    expect(kpiHealth(80, 90)).toBe("RED");
    expect(kpiHealth(null, 90)).toBe("NO_DATA");
  });

  it("classifica nota final pelas faixas", () => {
    expect(scoreHealth(95)).toBe("GREEN");
    expect(scoreHealth(75)).toBe("YELLOW");
    expect(scoreHealth(50)).toBe("RED");
  });
});

describe("períodos", () => {
  it("gera identificadores ordenáveis por frequência", () => {
    expect(periodOf("MONTHLY", now)).toBe("2026-10");
    expect(periodOf("QUARTERLY", now)).toBe("2026-Q4");
    expect(periodOf("YEARLY", now)).toBe("2026");
    expect(periodOf("WEEKLY", now)).toBe("2026-W43");
    expect(periodOf("WEEKLY", day("2021-01-01"))).toBe("2020-W53");
  });

  it("devolve o último período encerrado", () => {
    expect(lastClosedPeriod("MONTHLY", now)).toBe("2026-09");
    expect(lastClosedPeriod("QUARTERLY", now)).toBe("2026-Q3");
    expect(lastClosedPeriod("YEARLY", now)).toBe("2025");
    expect(lastClosedPeriod("WEEKLY", now)).toBe("2026-W42");
    expect(lastClosedPeriod("MONTHLY", day("2026-01-31"))).toBe("2025-12");
  });
});

describe("evaluateKpi", () => {
  const kpi = {
    id: "k1",
    name: "Disponibilidade",
    unit: "%",
    direction: "HIGHER_IS_BETTER" as const,
    frequency: "MONTHLY" as const,
    target: 99.5,
    warningThreshold: 98,
    weight: 1,
    measurements: [
      { period: "2026-08", value: 99.9 },
      { period: "2026-09", value: 97 },
    ],
  };

  it("usa a medição mais recente e calcula tendência", () => {
    const evaluation = evaluateKpi(kpi, now);
    expect(evaluation.latestPeriod).toBe("2026-09");
    expect(evaluation.health).toBe("RED");
    expect(evaluation.trend).toBe("DOWN");
    expect(evaluation.missingLastPeriod).toBe(false);
  });

  it("gera alerta crítico para KPI vermelho", () => {
    const alert = kpiAlert(kpi, evaluateKpi(kpi, now), null);
    expect(alert?.severity).toBe("CRITICAL");
    expect(alert?.key).toBe("kpi-red:k1:2026-09");
  });

  it("gera alerta informativo quando falta a medição do período", () => {
    const stale = { ...kpi, measurements: [{ period: "2026-07", value: 100 }] };
    const alert = kpiAlert(stale, evaluateKpi(stale, now), null);
    expect(alert?.severity).toBe("INFO");
    expect(alert?.message).toContain("2026-09");
  });

  it("pondera a nota de KPIs pelo peso e ignora os sem dados", () => {
    expect(
      weightedKpiScore([
        { attainment: 100, weight: 3 },
        { attainment: 60, weight: 1 },
        { attainment: null, weight: 5 },
      ]),
    ).toBe(90);
    expect(weightedKpiScore([{ attainment: null, weight: 1 }])).toBeNull();
  });
});

describe("evaluateSchedule", () => {
  const base = { status: "IN_PROGRESS", progress: 50, createdAt: day("2026-10-01"), startDate: day("2026-10-01") };

  it("considera a data de vencimento até ao fim do dia", () => {
    const result = evaluateSchedule({ ...base, dueDate: day("2026-10-23") }, now, 3);
    expect(result.timing).toBe("DUE_SOON");
    expect(result.daysRemaining).toBe(0);
  });

  it("marca tarefa em atraso", () => {
    const result = evaluateSchedule({ ...base, dueDate: day("2026-10-20") }, now, 3);
    expect(result.timing).toBe("OVERDUE");
    expect(result.daysRemaining).toBe(-3);
  });

  it("marca em risco quando o prazo consumido supera o progresso", () => {
    const result = evaluateSchedule({ ...base, progress: 20, dueDate: day("2026-11-05") }, now, 3);
    expect(result.timing).toBe("AT_RISK");
  });

  it("marca bloqueada como em risco e no prazo quando o progresso acompanha", () => {
    expect(evaluateSchedule({ ...base, status: "BLOCKED", dueDate: day("2026-11-30") }, now, 3).timing).toBe("AT_RISK");
    expect(evaluateSchedule({ ...base, progress: 60, dueDate: day("2026-11-05") }, now, 3).timing).toBe("ON_TRACK");
  });

  it("distingue entrega no prazo e com atraso", () => {
    const done = { ...base, status: "DONE", progress: 100, dueDate: day("2026-10-10") };
    expect(evaluateSchedule({ ...done, completedAt: new Date("2026-10-10T18:00:00Z") }, now, 3).timing).toBe(
      "DONE_ON_TIME",
    );
    expect(evaluateSchedule({ ...done, completedAt: day("2026-10-12") }, now, 3).timing).toBe("DONE_LATE");
  });

  it("gera alertas com a severidade adequada", () => {
    const overdue = evaluateSchedule({ ...base, dueDate: day("2026-10-20") }, now, 3);
    const alert = scheduleAlert("TASK", { id: "t1", name: "Migrar AD", progress: 50, status: "IN_PROGRESS" }, overdue, {
      id: "p1",
      fullName: "Ana",
    });
    expect(alert).toMatchObject({ severity: "CRITICAL", key: "task-overdue:t1", ownerName: "Ana" });

    const onTrack = evaluateSchedule({ ...base, progress: 90, dueDate: day("2026-12-01") }, now, 3);
    expect(scheduleAlert("TASK", { id: "t2", name: "x", progress: 90, status: "IN_PROGRESS" }, onTrack, null)).toBeNull();
  });
});

describe("pontuação", () => {
  it("calcula progresso do projeto ignorando canceladas", () => {
    expect(
      projectProgress([
        { status: "DONE", progress: 0 },
        { status: "IN_PROGRESS", progress: 50 },
        { status: "CANCELLED", progress: 0 },
      ]),
    ).toBe(75);
    expect(projectProgress([])).toBe(0);
  });

  it("calcula nota de entrega só com tarefas já avaliáveis", () => {
    const t = (status: string, dueDate: string, completedAt?: string) => ({
      status,
      progress: status === "DONE" ? 100 : 30,
      createdAt: day("2026-09-01"),
      dueDate: day(dueDate),
      completedAt: completedAt ? day(completedAt) : null,
    });
    const score = deliveryScore(
      [
        t("DONE", "2026-10-10", "2026-10-09"), // no prazo = 1
        t("DONE", "2026-10-10", "2026-10-15"), // atrasada = 0,5
        t("IN_PROGRESS", "2026-10-15"), // em atraso = 0
        t("IN_PROGRESS", "2026-11-30"), // ainda no prazo: não conta
        t("DONE", "2025-01-10", "2025-01-09"), // fora da janela: não conta
      ],
      now,
    );
    expect(score).toBe(50);
    expect(deliveryScore([], now)).toBeNull();
  });

  it("combina KPI e entrega com os pesos configurados", () => {
    expect(combineScores(100, 50)).toBe(80);
    expect(combineScores(null, 70)).toBe(70);
    expect(combineScores(null, null)).toBeNull();
  });
});
