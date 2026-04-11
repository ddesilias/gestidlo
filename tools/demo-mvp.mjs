#!/usr/bin/env node

const DEFAULT_BFF_URL = 'http://localhost:9083';

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
Prépare un scénario de démonstration MVP (via le BFF):
  - envoi de mesures sur 1 point (PRESSURE + LEVEL + FLOW)
  - génération d'une alerte CRIT (PRESSURE)
  - optionnel: création d'un ticket (+ assignation) et progression du workflow

Usage (scénario par défaut):
  node tools/demo-mvp.mjs

Usage (avec création ticket et clôture):
  node tools/demo-mvp.mjs --withTicket --advance 10

Options:
  --baseUrl        Base URL du BFF (défaut: ${DEFAULT_BFF_URL})
  --username       Username (défaut: operator)
  --password       Password (défaut: operator)
  --pointId        Point de mesure (défaut: POINT-001)
  --sensorId       Identifiant capteur (défaut: DEMO-SIM-01)
  --pressure       Valeur pressure en bar (défaut: 0.8)
  --level          Valeur level en cm (défaut: 50)
  --flow           Valeur flow en L/min (défaut: 10)
  --resetAlerts    Acquitte les alertes ACTIVE existantes (true/false)
  --withTicket     Crée un ticket à partir de l'alerte (flag)
  --assignee       Assignee ticket (défaut: tech)
  --advance        Nombre d'avancées ticket (défaut: 0)
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

function asBoolean(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(s)) return false;
  return fallback;
}

function asNumber(value, fallback) {
  if (value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function latestAlert(alerts, { pointId, type } = {}) {
  const filtered = (Array.isArray(alerts) ? alerts : []).filter((a) => {
    if (!a) return false;
    if (pointId && a.pointId !== pointId) return false;
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

  const baseUrl = String(args.baseUrl ?? DEFAULT_BFF_URL).replace(/\/$/, '');
  const username = String(args.username ?? 'operator');
  const password = String(args.password ?? 'operator');
  const pointId = String(args.pointId ?? 'POINT-001').trim();
  const sensorId = String(args.sensorId ?? 'DEMO-SIM-01').trim();
  const pressure = asNumber(args.pressure, 0.8);
  const level = asNumber(args.level, 50);
  const flow = asNumber(args.flow, 10);
  const resetAlerts = asBoolean(args.resetAlerts, true);
  const withTicket = !!args.withTicket;
  const assignee = String(args.assignee ?? 'tech').trim();
  const advance = Math.max(0, Math.trunc(asNumber(args.advance, 0)));

  if (!pointId) {
    throw new Error('pointId est requis');
  }

  const login = await requestJson(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    body: { username, password }
  });
  const token = login?.token;
  if (!token) throw new Error('Login succeeded but no token returned');

  const report = {
    baseUrl,
    pointId,
    resetAlerts,
    desired: { pressure, level, flow },
    sentMeasurements: [],
    createdAlert: null,
    createdTicket: null,
    dashboard: null
  };

  if (resetAlerts) {
    const active = await requestJson(`${baseUrl}/api/alerts?status=ACTIVE`, { token });
    const toAck = (Array.isArray(active) ? active : []).filter((a) => a?.pointId === pointId);
    for (const alert of toAck) {
      await requestJson(`${baseUrl}/api/alerts/${alert.id}/ack`, { method: 'POST', token, body: {} });
    }
  }

  const measurements = [
    { pointId, sensorId, type: 'PRESSURE', value: pressure, unit: 'bar' },
    { pointId, sensorId, type: 'LEVEL', value: level, unit: 'cm' },
    { pointId, sensorId, type: 'FLOW', value: flow, unit: 'L/min' }
  ];

  for (const payload of measurements) {
    const ingest = await requestJson(`${baseUrl}/api/iot/measurements`, {
      method: 'POST',
      token,
      body: payload
    });
    report.sentMeasurements.push({ payload, ingest });
  }

  const activeAlerts = await requestJson(`${baseUrl}/api/alerts?status=ACTIVE`, { token });
  const alert = latestAlert(activeAlerts, { pointId, type: 'PRESSURE' });
  if (!alert) {
    throw new Error(`Aucune alerte ACTIVE trouvée pour ${pointId} (PRESSURE)`);
  }
  report.createdAlert = {
    id: alert.id,
    pointId: alert.pointId,
    sensorId: alert.sensorId,
    type: alert.type,
    severity: alert.severity,
    status: alert.status,
    message: alert.message,
    updatedAt: alert.updatedAt
  };

  if (withTicket) {
    let ticket = await requestJson(`${baseUrl}/api/tickets`, {
      method: 'POST',
      token,
      body: { alertId: alert.id, assignee }
    });

    for (let i = 0; i < advance; i++) {
      ticket = await requestJson(`${baseUrl}/api/tickets/${ticket.id}/advance`, {
        method: 'POST',
        token,
        body: {}
      });
    }

    report.createdTicket = {
      id: ticket.id,
      status: ticket.status,
      assignee: ticket.assignee,
      camundaProcessInstanceId: ticket.camundaProcessInstanceId
    };
  }

  report.dashboard = await requestJson(`${baseUrl}/api/dashboard`, { token });

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e?.message ?? e);
  if (e?.payload) {
    console.error('Response payload:', JSON.stringify(e.payload, null, 2));
  }
  process.exit(1);
});
