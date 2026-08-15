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

Rodar os testes: `npm test` (cobre o algoritmo de assinatura da Tuya).
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
