import { PrismaClient } from "@prisma/client";

// Dados de exemplo do módulo de performance: uma Direção de Sistemas de
// Informação com três áreas, os respetivos gestores/coordenadores, KPIs com
// histórico e projetos/tarefas em várias situações de prazo. As datas são
// relativas a hoje, para os alertas aparecerem logo ao abrir o painel.
// Só cria dados quando o módulo ainda está vazio.

const prisma = new PrismaClient();

const today = new Date();
today.setUTCHours(0, 0, 0, 0);
const inDays = (n: number) => new Date(today.getTime() + n * 24 * 60 * 60 * 1000);

function lastMonths(count: number): string[] {
  const periods: string[] = [];
  for (let i = count; i >= 1; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    periods.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return periods;
}

async function main() {
  if ((await prisma.department.count()) > 0) {
    console.log("Módulo de performance já tem dados; seed ignorado.");
    return;
  }

  const dsi = await prisma.department.create({
    data: { name: "Direção de Sistemas de Informação", code: "DSI", description: "Direção responsável por toda a área de SI/TI" },
  });
  const [infra, dev, suporte] = await Promise.all([
    prisma.department.create({ data: { name: "Infraestrutura e Redes", code: "INFRA", parentId: dsi.id } }),
    prisma.department.create({ data: { name: "Desenvolvimento e Sistemas", code: "DEV", parentId: dsi.id } }),
    prisma.department.create({ data: { name: "Suporte ao Utilizador (Service Desk)", code: "SD", parentId: dsi.id } }),
  ]);

  const person = (fullName: string, jobTitle: string, role: string, departmentId: string) =>
    prisma.person.create({ data: { fullName, jobTitle, role, departmentId } });

  const diretor = await person("Diretor de SI", "Diretor de Sistemas de Informação", "DIRECTOR", dsi.id);
  const gInfra = await person("Gestor de Infraestrutura", "Gestor", "MANAGER", infra.id);
  const cRedes = await person("Coordenador de Redes", "Coordenador", "COORDINATOR", infra.id);
  const gDev = await person("Gestor de Desenvolvimento", "Gestor", "MANAGER", dev.id);
  const cSd = await person("Coordenador do Service Desk", "Coordenador", "COORDINATOR", suporte.id);
  const tecnico = await person("Técnico de Suporte", "Técnico", "STAFF", suporte.id);

  const months = lastMonths(4);
  const kpi = async (
    data: {
      name: string;
      unit: string;
      target: number;
      direction?: string;
      warningThreshold?: number;
      weight?: number;
      departmentId: string;
      ownerId: string;
    },
    values: number[],
  ) => {
    const created = await prisma.kpi.create({ data });
    await prisma.kpiMeasurement.createMany({
      data: values.map((value, i) => ({ kpiId: created.id, period: months[months.length - values.length + i], value })),
    });
  };

  await kpi({ name: "Execução do orçamento de SI", unit: "%", target: 95, departmentId: dsi.id, ownerId: diretor.id }, [80, 86, 91, 93]);
  await kpi({ name: "Projetos entregues no prazo", unit: "%", target: 85, departmentId: dsi.id, ownerId: diretor.id, weight: 2 }, [70, 75, 78, 72]);
  await kpi({ name: "Disponibilidade dos sistemas críticos", unit: "%", target: 99.5, warningThreshold: 99, departmentId: infra.id, ownerId: gInfra.id, weight: 2 }, [99.8, 99.9, 99.2, 99.7]);
  await kpi({ name: "Incidentes de segurança graves", unit: "incidentes", target: 0, direction: "LOWER_IS_BETTER", departmentId: infra.id, ownerId: gInfra.id }, [0, 1, 0, 0]);
  await kpi({ name: "Uptime da rede WAN", unit: "%", target: 99.9, warningThreshold: 99, departmentId: infra.id, ownerId: cRedes.id }, [99.95, 99.4, 98.7]);
  await kpi({ name: "Entregas de sprint cumpridas", unit: "%", target: 90, departmentId: dev.id, ownerId: gDev.id }, [88, 92, 95]);
  await kpi({ name: "Bugs críticos em produção", unit: "bugs", target: 2, direction: "LOWER_IS_BETTER", departmentId: dev.id, ownerId: gDev.id }, [3, 2, 4]);
  await kpi({ name: "Tickets resolvidos dentro do SLA", unit: "%", target: 90, departmentId: suporte.id, ownerId: cSd.id, weight: 2 }, [84, 87, 91, 89]);
  await kpi({ name: "Tempo médio de resolução", unit: "h", target: 8, direction: "LOWER_IS_BETTER", departmentId: suporte.id, ownerId: cSd.id }, [10, 9, 7.5, 8.2]);
  await kpi({ name: "Satisfação dos utilizadores", unit: "/5", target: 4.2, departmentId: suporte.id, ownerId: cSd.id }, [4.0, 4.3]);

  const erp = await prisma.project.create({
    data: { name: "Migração do ERP para a cloud", status: "IN_PROGRESS", priority: "HIGH", startDate: inDays(-60), dueDate: inDays(30), ownerId: gDev.id, departmentId: dev.id },
  });
  const firewall = await prisma.project.create({
    data: { name: "Renovação dos firewalls", status: "IN_PROGRESS", priority: "CRITICAL", startDate: inDays(-45), dueDate: inDays(-2), ownerId: gInfra.id, departmentId: infra.id },
  });
  const plano = await prisma.project.create({
    data: { name: "Plano estratégico de SI 2027", status: "IN_PROGRESS", priority: "HIGH", startDate: inDays(-20), dueDate: inDays(40), ownerId: diretor.id, departmentId: dsi.id },
  });

  const task = (data: {
    title: string;
    dueDate: Date;
    status?: string;
    progress?: number;
    priority?: string;
    startDate?: Date;
    completedAt?: Date;
    projectId?: string;
    assigneeId: string;
  }) => prisma.task.create({ data });

  await task({ title: "Levantamento dos módulos a migrar", projectId: erp.id, assigneeId: gDev.id, startDate: inDays(-60), dueDate: inDays(-40), status: "DONE", progress: 100, completedAt: inDays(-41) });
  await task({ title: "Ambiente de testes na cloud", projectId: erp.id, assigneeId: gDev.id, startDate: inDays(-40), dueDate: inDays(-10), status: "DONE", progress: 100, completedAt: inDays(-6) });
  await task({ title: "Migração de dados históricos", projectId: erp.id, assigneeId: gDev.id, startDate: inDays(-10), dueDate: inDays(4), status: "IN_PROGRESS", progress: 25, priority: "HIGH" });
  await task({ title: "Formação dos utilizadores-chave", projectId: erp.id, assigneeId: cSd.id, startDate: inDays(5), dueDate: inDays(25) });

  await task({ title: "Aquisição dos equipamentos", projectId: firewall.id, assigneeId: gInfra.id, startDate: inDays(-45), dueDate: inDays(-30), status: "DONE", progress: 100, completedAt: inDays(-31) });
  await task({ title: "Configuração das regras e VPNs", projectId: firewall.id, assigneeId: cRedes.id, startDate: inDays(-30), dueDate: inDays(-5), status: "IN_PROGRESS", progress: 60, priority: "CRITICAL" });
  await task({ title: "Janela de substituição em produção", projectId: firewall.id, assigneeId: cRedes.id, startDate: inDays(-5), dueDate: inDays(-2), status: "BLOCKED", progress: 0, priority: "CRITICAL" });

  await task({ title: "Diagnóstico da maturidade de SI", projectId: plano.id, assigneeId: diretor.id, startDate: inDays(-20), dueDate: inDays(-3), status: "DONE", progress: 100, completedAt: inDays(-4) });
  await task({ title: "Workshops com as áreas de negócio", projectId: plano.id, assigneeId: diretor.id, startDate: inDays(-3), dueDate: inDays(2), status: "IN_PROGRESS", progress: 50 });
  await task({ title: "Proposta de orçamento 2027", projectId: plano.id, assigneeId: diretor.id, startDate: inDays(0), dueDate: inDays(20) });

  // Tarefas avulsas (sem projeto)
  await task({ title: "Avaliação de desempenho semestral dos coordenadores", assigneeId: diretor.id, dueDate: inDays(10), priority: "HIGH" });
  await task({ title: "Reunião de acompanhamento com o CEO", assigneeId: diretor.id, dueDate: inDays(-1), progress: 0, priority: "HIGH" });
  await task({ title: "Atualizar base de conhecimento do Service Desk", assigneeId: tecnico.id, startDate: inDays(-30), dueDate: inDays(15), status: "IN_PROGRESS", progress: 20 });
  await task({ title: "Relatório mensal de SLA", assigneeId: cSd.id, dueDate: inDays(-15), status: "DONE", progress: 100, completedAt: inDays(-16) });

  console.log("Dados de exemplo do módulo de performance criados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
