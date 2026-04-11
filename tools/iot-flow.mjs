#!/usr/bin/env node

const DEFAULT_BASE_URL = 'http://localhost:9083';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const current = argv[i];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function usage() {
  const msg = `
Simule un flux IoT complet via le BFF:
  1) login (JWT)
  2) ingestion d'une mesure (/api/iot/measurements)
  3) lecture des alertes actives (/api/alerts)
  4) création d'un ticket (/api/tickets) => démarre un process Camunda
  5) optionnel: avance le ticket (/api/tickets/{id}/advance)

Usage:
  node tools/iot-flow.mjs \
    --type PRESSURE --value 0.5 --unit bar \
    --pointId POINT-001 --sensorId SIM-01 \
    --username operator --password operator \
    --assignee tech --advance 2

Options:
  --baseUrl   Base URL du BFF (défaut: ${DEFAULT_BASE_URL})
  --username  Username (défaut: operator)
  --password  Password (défaut: operator)
  --pointId   Point de mesure (défaut: POINT-001)
  --sensorId  Id capteur (défaut: SIM-01)
  --type      PRESSURE | LEVEL | FLOW (défaut: PRESSURE)
  --value     Valeur numérique (défaut: 0.5)
  --unit      Unité (défaut: bar)
  --assignee  Assignee ticket (défaut: tech)
  --advance   Nombre d'avancées (défaut: 0)
`;
  console.log(msg.trimStart());
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function requestJson(url, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body != null) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined
  });

  const payload = await readJson(res);
  if (!res.ok) {
    const error = new Error(`HTTP ${res.status} ${res.statusText} for ${method} ${url}`);
    error.payload = payload;
    throw error;
  }
  return payload;
}

function asNumber(value, fallback) {
  if (value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function latestAlert(alerts, { pointId, sensorId, type } = {}) {
  const filtered = (Array.isArray(alerts) ? alerts : []).filter((a) => {
    if (!a) return false;
    if (pointId && a.pointId !== pointId) return false;
    if (sensorId && a.sensorId !== sensorId) return false;
    if (type && a.type !== type) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const ta = Date.parse(a.updatedAt ?? a.openedAt ?? 0);
    const tb = Date.parse(b.updatedAt ?? b.openedAt ?? 0);
    return tb - ta;
  });

  return filtered[0] ?? null;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || args.h) {
    usage();
    process.exit(0);
  }

  const baseUrl = (args.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const username = args.username ?? 'operator';
  const password = args.password ?? 'operator';
  const pointId = args.pointId ?? 'POINT-001';
  const sensorId = args.sensorId ?? 'SIM-01';
  const type = String(args.type ?? 'PRESSURE').trim().toUpperCase();
  const value = asNumber(args.value, 0.5);
  const unit = args.unit ?? 'bar';
  const assignee = args.assignee ?? 'tech';
  const advance = Math.max(0, Math.trunc(asNumber(args.advance, 0)));

  const login = await requestJson(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    body: { username, password }
  });
  const token = login?.token;
  if (!token) throw new Error('Login succeeded but no token returned');

  const ingest = await requestJson(`${baseUrl}/api/iot/measurements`, {
    method: 'POST',
    token,
    body: { pointId, sensorId, type, value, unit }
  });

  const activeAlerts = await requestJson(`${baseUrl}/api/alerts?status=ACTIVE`, { token });
  const alert = latestAlert(activeAlerts, { pointId, sensorId, type });
  if (!alert) {
    console.log(JSON.stringify({ login, ingest, activeAlerts }, null, 2));
    throw new Error('No ACTIVE alert found matching this measurement');
  }

  const ticket = await requestJson(`${baseUrl}/api/tickets`, {
    method: 'POST',
    token,
    body: { alertId: alert.id, assignee }
  });

  let updatedTicket = ticket;
  for (let i = 0; i < advance; i++) {
    updatedTicket = await requestJson(`${baseUrl}/api/tickets/${ticket.id}/advance`, {
      method: 'POST',
      token,
      body: {}
    });
  }

  const tasks = updatedTicket?.camundaProcessInstanceId
    ? await requestJson(
        `${baseUrl}/api/tasks?processInstanceId=${encodeURIComponent(updatedTicket.camundaProcessInstanceId)}`,
        { token }
      )
    : null;

  console.log(
    JSON.stringify(
      {
        measurement: ingest,
        alert: {
          id: alert.id,
          pointId: alert.pointId,
          sensorId: alert.sensorId,
          type: alert.type,
          severity: alert.severity,
          status: alert.status,
          message: alert.message,
          updatedAt: alert.updatedAt
        },
        ticket: {
          id: updatedTicket.id,
          status: updatedTicket.status,
          assignee: updatedTicket.assignee,
          camundaProcessInstanceId: updatedTicket.camundaProcessInstanceId
        },
        tasks
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e?.message ?? e);
  if (e?.payload) {
    console.error('Response payload:', JSON.stringify(e.payload, null, 2));
  }
  process.exit(1);
});

