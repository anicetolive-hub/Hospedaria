import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/asyncHandler";
import { notifyNewAlerts } from "../services/performance/alertNotifier";
import { periodOf } from "../services/performance/engine";
import { isOpen, loadSnapshot } from "../services/performance/snapshot";

export const performanceRouter = Router();

const roles = z.enum(["DIRECTOR", "MANAGER", "COORDINATOR", "STAFF"]);
const priorities = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const optionalId = z.string().min(1).nullable().optional();
const optionalText = z.string().nullable().optional();

// ---------------------------------------------------------------------------
// Painel e alertas
// ---------------------------------------------------------------------------

performanceRouter.get(
  "/dashboard",
  asyncHandler(async (_req, res) => {
    const snap = await loadSnapshot();
    const leaders = snap.people.filter((p) => p.active && p.role !== "STAFF");
    const openProjects = snap.projects.filter((p) => isOpen(p.status));

    res.json({
      generatedAt: snap.generatedAt,
      departments: snap.departments,
      leaders: [...leaders].sort((a, b) => (b.scorecard.score ?? -1) - (a.scorecard.score ?? -1)),
      kpiHealth: countBy(snap.kpis.map((k) => k.evaluation.health)),
      taskTiming: countBy(snap.tasks.filter((t) => isOpen(t.status)).map((t) => t.schedule.timing)),
      projects: {
        open: openProjects.length,
        overdue: openProjects.filter((p) => p.schedule.timing === "OVERDUE").length,
        atRisk: openProjects.filter((p) => p.schedule.timing === "AT_RISK" || p.schedule.timing === "DUE_SOON").length,
      },
      alerts: snap.alerts,
    });
  }),
);

performanceRouter.get(
  "/alerts",
  asyncHandler(async (req, res) => {
    const { alerts } = await loadSnapshot();
    const ownerId = typeof req.query.ownerId === "string" ? req.query.ownerId : undefined;
    res.json(ownerId ? alerts.filter((a) => a.ownerId === ownerId) : alerts);
  }),
);

// Dispara manualmente o envio dos alertas novos ao webhook (Teams/Slack)
performanceRouter.post(
  "/alerts/notify",
  asyncHandler(async (_req, res) => {
    res.json(await notifyNewAlerts());
  }),
);

// ---------------------------------------------------------------------------
// Departamentos
// ---------------------------------------------------------------------------

const departmentSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(1).max(20),
  description: optionalText,
  parentId: optionalId,
});

performanceRouter.get(
  "/departments",
  asyncHandler(async (_req, res) => {
    res.json((await loadSnapshot()).departments);
  }),
);

performanceRouter.post(
  "/departments",
  asyncHandler(async (req, res) => {
    const data = departmentSchema.parse(req.body);
    res.status(201).json(await prisma.department.create({ data: { ...data, code: data.code.toUpperCase() } }));
  }),
);

performanceRouter.put(
  "/departments/:id",
  asyncHandler(async (req, res) => {
    const data = departmentSchema.partial().parse(req.body);
    if (data.parentId && data.parentId === req.params.id) {
      return res.status(400).json({ error: "Um departamento não pode ser subordinado a si próprio" });
    }
    res.json(
      await prisma.department.update({
        where: { id: req.params.id },
        data: { ...data, code: data.code?.toUpperCase() },
      }),
    );
  }),
);

performanceRouter.delete(
  "/departments/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const [people, kpis, projects, children] = await Promise.all([
      prisma.person.count({ where: { departmentId: id } }),
      prisma.kpi.count({ where: { departmentId: id } }),
      prisma.project.count({ where: { departmentId: id } }),
      prisma.department.count({ where: { parentId: id } }),
    ]);
    if (people + kpis + projects + children > 0) {
      return res.status(409).json({
        error: "Departamento possui pessoas, KPIs, projetos ou áreas subordinadas; mova-os antes de remover",
      });
    }
    await prisma.department.delete({ where: { id } });
    res.status(204).send();
  }),
);

// ---------------------------------------------------------------------------
// Pessoas (direção, gestores, coordenadores e equipa)
// ---------------------------------------------------------------------------

const personSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email().nullable().optional().or(z.literal("")),
  jobTitle: optionalText,
  role: roles.default("STAFF"),
  departmentId: optionalId,
  active: z.boolean().optional(),
});

performanceRouter.get(
  "/people",
  asyncHandler(async (_req, res) => {
    res.json((await loadSnapshot()).people);
  }),
);

performanceRouter.post(
  "/people",
  asyncHandler(async (req, res) => {
    const data = personSchema.parse(req.body);
    res.status(201).json(await prisma.person.create({ data }));
  }),
);

performanceRouter.put(
  "/people/:id",
  asyncHandler(async (req, res) => {
    const data = personSchema.partial().parse(req.body);
    res.json(await prisma.person.update({ where: { id: req.params.id }, data }));
  }),
);

performanceRouter.delete(
  "/people/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    // Mantém KPIs, projetos e tarefas, apenas sem responsável
    await prisma.$transaction([
      prisma.kpi.updateMany({ where: { ownerId: id }, data: { ownerId: null } }),
      prisma.project.updateMany({ where: { ownerId: id }, data: { ownerId: null } }),
      prisma.task.updateMany({ where: { assigneeId: id }, data: { assigneeId: null } }),
      prisma.person.delete({ where: { id } }),
    ]);
    res.status(204).send();
  }),
);

// ---------------------------------------------------------------------------
// KPIs e medições
// ---------------------------------------------------------------------------

const kpiSchema = z.object({
  name: z.string().min(2),
  description: optionalText,
  unit: optionalText,
  direction: z.enum(["HIGHER_IS_BETTER", "LOWER_IS_BETTER"]).default("HIGHER_IS_BETTER"),
  frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]).default("MONTHLY"),
  target: z.coerce.number(),
  warningThreshold: z.coerce.number().min(0).max(100).default(90),
  weight: z.coerce.number().positive().default(1),
  departmentId: optionalId,
  ownerId: optionalId,
  active: z.boolean().optional(),
});

const measurementSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}(-(0[1-9]|1[0-2])|-Q[1-4]|-W(0[1-9]|[1-4]\d|5[0-3]))?$/, "Período inválido (ex: 2026-10, 2026-Q4, 2026-W43, 2026)")
    .optional(),
  value: z.coerce.number(),
  notes: optionalText,
});

performanceRouter.get(
  "/kpis",
  asyncHandler(async (_req, res) => {
    res.json((await loadSnapshot()).kpis);
  }),
);

performanceRouter.post(
  "/kpis",
  asyncHandler(async (req, res) => {
    const data = kpiSchema.parse(req.body);
    res.status(201).json(await prisma.kpi.create({ data }));
  }),
);

performanceRouter.put(
  "/kpis/:id",
  asyncHandler(async (req, res) => {
    const data = kpiSchema.partial().parse(req.body);
    res.json(await prisma.kpi.update({ where: { id: req.params.id }, data }));
  }),
);

performanceRouter.delete(
  "/kpis/:id",
  asyncHandler(async (req, res) => {
    await prisma.kpi.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);

// Regista (ou corrige) o valor de um período; sem período usa o período atual
performanceRouter.post(
  "/kpis/:id/measurements",
  asyncHandler(async (req, res) => {
    const kpi = await prisma.kpi.findUnique({ where: { id: req.params.id } });
    if (!kpi) return res.status(404).json({ error: "KPI não encontrado" });

    const data = measurementSchema.parse(req.body);
    const period = data.period ?? periodOf(kpi.frequency as Parameters<typeof periodOf>[0], new Date());
    if (!matchesFrequency(period, kpi.frequency)) {
      return res.status(400).json({ error: `Período ${period} não corresponde à frequência ${kpi.frequency} do KPI` });
    }

    const measurement = await prisma.kpiMeasurement.upsert({
      where: { kpiId_period: { kpiId: kpi.id, period } },
      create: { kpiId: kpi.id, period, value: data.value, notes: data.notes },
      update: { value: data.value, notes: data.notes },
    });
    res.status(201).json(measurement);
  }),
);

performanceRouter.delete(
  "/kpis/:id/measurements/:measurementId",
  asyncHandler(async (req, res) => {
    await prisma.kpiMeasurement.delete({ where: { id: req.params.measurementId, kpiId: req.params.id } });
    res.status(204).send();
  }),
);

// ---------------------------------------------------------------------------
// Projetos
// ---------------------------------------------------------------------------

const projectSchema = z.object({
  name: z.string().min(2),
  description: optionalText,
  status: z.enum(["PLANNED", "IN_PROGRESS", "ON_HOLD", "DONE", "CANCELLED"]).default("PLANNED"),
  priority: priorities.default("MEDIUM"),
  startDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  ownerId: optionalId,
  departmentId: optionalId,
});

performanceRouter.get(
  "/projects",
  asyncHandler(async (_req, res) => {
    res.json((await loadSnapshot()).projects);
  }),
);

performanceRouter.post(
  "/projects",
  asyncHandler(async (req, res) => {
    const data = projectSchema.parse(req.body);
    if (data.dueDate < data.startDate) {
      return res.status(400).json({ error: "O prazo deve ser igual ou posterior à data de início" });
    }
    res.status(201).json(await prisma.project.create({ data: { ...data, ...completion(data.status) } }));
  }),
);

performanceRouter.put(
  "/projects/:id",
  asyncHandler(async (req, res) => {
    const data = projectSchema.partial().parse(req.body);
    const current = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: "Projeto não encontrado" });
    if ((data.dueDate ?? current.dueDate) < (data.startDate ?? current.startDate)) {
      return res.status(400).json({ error: "O prazo deve ser igual ou posterior à data de início" });
    }
    res.json(
      await prisma.project.update({
        where: { id: req.params.id },
        data: { ...data, ...(data.status ? completion(data.status, current) : {}) },
      }),
    );
  }),
);

performanceRouter.delete(
  "/projects/:id",
  asyncHandler(async (req, res) => {
    await prisma.project.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);

// ---------------------------------------------------------------------------
// Tarefas
// ---------------------------------------------------------------------------

const taskSchema = z.object({
  title: z.string().min(2),
  description: optionalText,
  status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]).default("TODO"),
  priority: priorities.default("MEDIUM"),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  startDate: z.coerce.date().nullable().optional(),
  dueDate: z.coerce.date(),
  projectId: optionalId,
  assigneeId: optionalId,
});

performanceRouter.get(
  "/tasks",
  asyncHandler(async (req, res) => {
    const { assigneeId, projectId } = req.query;
    const { tasks } = await loadSnapshot();
    res.json(
      tasks.filter(
        (t) =>
          (typeof assigneeId !== "string" || t.assigneeId === assigneeId) &&
          (typeof projectId !== "string" || t.projectId === projectId),
      ),
    );
  }),
);

performanceRouter.post(
  "/tasks",
  asyncHandler(async (req, res) => {
    const data = taskSchema.parse(req.body);
    res.status(201).json(await prisma.task.create({ data: { ...data, ...completion(data.status), ...doneProgress(data.status) } }));
  }),
);

performanceRouter.put(
  "/tasks/:id",
  asyncHandler(async (req, res) => {
    const data = taskSchema.partial().parse(req.body);
    const current = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: "Tarefa não encontrada" });
    res.json(
      await prisma.task.update({
        where: { id: req.params.id },
        data: {
          ...data,
          ...(data.status ? { ...completion(data.status, current), ...doneProgress(data.status) } : {}),
        },
      }),
    );
  }),
);

performanceRouter.delete(
  "/tasks/:id",
  asyncHandler(async (req, res) => {
    await prisma.task.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);

// ---------------------------------------------------------------------------

/** Regista a data de conclusão ao passar a DONE e limpa-a ao reabrir. */
function completion(status: string, current?: { status: string; completedAt: Date | null }) {
  if (status === "DONE") {
    return { completedAt: current?.status === "DONE" && current.completedAt ? current.completedAt : new Date() };
  }
  return { completedAt: null };
}

function doneProgress(status: string) {
  return status === "DONE" ? { progress: 100 } : {};
}

function matchesFrequency(period: string, frequency: string): boolean {
  const patterns: Record<string, RegExp> = {
    YEARLY: /^\d{4}$/,
    QUARTERLY: /^\d{4}-Q[1-4]$/,
    MONTHLY: /^\d{4}-\d{2}$/,
    WEEKLY: /^\d{4}-W\d{2}$/,
  };
  return patterns[frequency]?.test(period) ?? false;
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, v) => ({ ...acc, [v]: (acc[v] ?? 0) + 1 }), {});
}
