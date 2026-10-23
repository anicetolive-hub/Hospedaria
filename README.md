# Hospedaria

Sistema de gestão para hospedaria (hóspedes, quartos e reservas) com
**automação de quartos via Tuya Cloud**: ao confirmar o check-in de uma
reserva, a API dispara comandos automaticamente para o dispositivo Tuya
vinculado ao quarto (ex.: destrancar a fechadura inteligente, ligar a
energia/ar-condicionado). No check-out, o comando inverso é enviado.

## Estrutura do projeto

```
backend/   API REST em Node.js + TypeScript + Express + Prisma (SQLite)
frontend/  Painel web em React + Vite + TypeScript
```

## Como rodar

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # ajuste as credenciais Tuya (veja abaixo)
npm run prisma:migrate    # cria o banco SQLite local (dev.db)
npm run seed              # opcional: cria 2 quartos e 1 hóspede de exemplo
npm run dev                # inicia a API em http://localhost:3333
```

Para carregar dados de exemplo do módulo de performance (uma Direção de SI
com áreas, gestores, KPIs e projetos): `npm run seed:performance`.

Rodar os testes: `npm test` (cobre o algoritmo de assinatura da Tuya e o
motor de cálculo de performance/alertas).
Buildar para produção: `npm run build && npm start`.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env       # aponta VITE_API_URL para a API
npm run dev                 # abre em http://localhost:5173
```

## Integração com a Tuya Cloud

O check-in físico é sempre confirmado no sistema, mesmo se a chamada à Tuya
falhar (ex.: nuvem indisponível) — a recepção pode liberar o hóspede
manualmente e o painel mostra o erro da automação para diagnóstico. Isso
evita que uma falha externa impeça o check-in administrativo.

### Passo a passo para configurar

1. Crie uma conta e um projeto Cloud em https://iot.tuya.com (aba
   **Cloud > Development**).
2. No projeto, ative a API **"IoT Core"** (necessária para token e comandos
   de dispositivos).
3. Em **Devices > Link Devices**, vincule a conta do app Tuya/Smart Life
   onde os dispositivos dos quartos (fechaduras, tomadas, etc.) estão
   cadastrados.
4. Copie o **Access ID** e o **Access Secret** da aba **Overview** do
   projeto e preencha no `backend/.env`:

   ```
   TUYA_BASE_URL="https://openapi.tuyaus.com"   # ajuste a região (us/eu/cn/in)
   TUYA_CLIENT_ID="seu_access_id"
   TUYA_CLIENT_SECRET="seu_access_secret"
   ```

5. Para cada dispositivo, obtenha o `device_id` (visível em **Devices** no
   projeto Cloud) e cole-o no cadastro do quarto correspondente, no painel
   web (tela **Quartos**), junto com os comandos DP que devem ser enviados
   no check-in e no check-out (ex.: `switch_1` = `true`/`false`).
6. Use o botão **"Testar dispositivo"** na tela de Quartos para confirmar
   que a API consegue consultar o dispositivo antes de usá-lo em produção.

### Como funciona a assinatura das requisições

A Tuya exige que cada chamada seja assinada com HMAC-SHA256
(`backend/src/services/tuyaSign.ts` e `tuyaService.ts`), seguindo o
algoritmo oficial: token obtido via `/v1.0/token`, cache do `access_token`
com renovação automática, e comandos enviados via
`POST /v1.0/devices/{device_id}/commands`.

## Modelo de dados

- **Guest** (hóspede): nome, documento, contato.
- **Room** (quarto): número, status, `tuyaDeviceId` e os comandos Tuya de
  check-in/check-out.
- **Reservation** (reserva): hóspede + quarto + datas + status
  (`BOOKED` → `CHECKED_IN` → `CHECKED_OUT`, ou `CANCELLED`) + último
  resultado da automação Tuya, para auditoria.

## Módulo de Gestão de Performance

Painel para a direção acompanhar a performance dos **departamentos**, dos
**gestores e coordenadores** e da **própria direção** através de KPIs, e
gerir **projetos e tarefas** com alertas de prazo. Fica no menu
**Performance** do painel web.

| Página | Para que serve |
| --- | --- |
| **Visão geral** | Nota consolidada da direção, ranking dos departamentos e dos gestores/coordenadores, e os alertas prioritários. |
| **KPIs** | Cadastro de KPIs por departamento e responsável (meta, sentido, frequência, peso) e registo dos valores de cada período, com histórico e tendência. |
| **Projetos e tarefas** | Projetos com progresso e situação de prazo; tarefas com responsável, prazo e progresso. Filtros "As minhas", "Abertas" e "Atrasadas / em risco". |
| **Equipa** | Estrutura de departamentos (a direção no topo e as áreas por baixo) e pessoas com o seu nível: diretor, gestor, coordenador ou colaborador. |
| **Alertas** | Todos os alertas ativos, com filtro por severidade e "só os meus". |

No topo de todas as páginas, o seletor **"Eu sou"** indica quem está a usar
o painel (fica guardado no navegador) e o sino mostra os alertas críticos /
de atenção dessa pessoa.

### Como as notas são calculadas

- **Atingimento de um KPI** = valor ÷ meta (ou meta ÷ valor quando "menor é
  melhor"), limitado a 120%. Verde a partir de 100%, amarelo entre o
  *limiar crítico* do KPI e 100%, vermelho abaixo do limiar.
- **Nota de KPIs** de uma pessoa ou departamento = média do atingimento dos
  seus KPIs, ponderada pelo peso de cada um (usa a medição mais recente).
- **Nota de entrega** = tarefas com prazo nos últimos 90 dias: no prazo
  vale 100, entregue com atraso 50, em atraso (aberta e vencida) 0.
- **Nota final** = 60% KPIs + 40% entrega (se faltar um dos lados, usa só o
  outro). Verde ≥ 90, amarelo ≥ 70, vermelho abaixo de 70.
- **Departamento**: nota própria = KPIs do departamento + entrega das
  tarefas da sua equipa; **nota consolidada** = média da nota própria com a
  consolidada de cada área subordinada. A nota consolidada do departamento
  de topo é a nota da direção.

Os pesos e faixas estão em `backend/src/services/performance/engine.ts`.

### Alertas de prazos e KPIs

Recalculados a cada consulta:

| Alerta | Severidade |
| --- | --- |
| Tarefa ou projeto com prazo ultrapassado | Crítico |
| KPI abaixo do limiar crítico | Crítico |
| Prazo termina em `ALERT_DUE_SOON_DAYS` dias ou menos (padrão 3) | Atenção |
| Em risco: bloqueado/em espera, ou mais de metade do prazo consumido com o progresso 25 pontos atrás do tempo | Atenção |
| KPI abaixo da meta, mas acima do limiar | Atenção |
| KPI sem o valor do último período encerrado | Info |

Formas de receber os alertas:

1. **No painel**: sino no topo e página **Alertas** (atualiza a cada 5 min).
2. **Notificação do navegador**: em **Alertas → Ativar notificações no
   navegador**. Com o painel aberto, cada alerta crítico novo gera uma
   notificação.
3. **Microsoft Teams ou Slack**: crie um *Incoming Webhook* no canal e
   preencha `ALERT_WEBHOOK_URL` no `backend/.env`. A API verifica a cada
   `ALERT_CHECK_INTERVAL_MINUTES` (padrão 60) e envia apenas os alertas
   novos a partir de `ALERT_WEBHOOK_MIN_SEVERITY` (padrão `WARNING`). Cada
   alerta é enviado uma única vez (registo na tabela `AlertNotification`).
   Para forçar uma verificação, use o botão **Enviar novos para Teams/Slack**
   ou `POST /api/performance/alerts/notify`.

### API

Todas as rotas ficam em `/api/performance`: `dashboard`, `alerts`,
`departments`, `people`, `kpis` (+ `POST /kpis/:id/measurements` com
`{ period, value }`; períodos `2026-10`, `2026-Q4`, `2026-W43` ou `2026`),
`projects` e `tasks` (CRUD com GET/POST/PUT/DELETE). Ao mudar uma tarefa
para concluída, a data de conclusão é registada automaticamente; é essa data
que define se foi entregue no prazo.
