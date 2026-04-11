#!/usr/bin/env node

// Raspberry Pi GPIO -> envoi de mesures vers le BFF
// Dépendances (sur le Pi): npm i onoff

const DEFAULT_BFF_URL = process.env.BFF_URL ?? 'http://<PC_IP>:9083';
const DEFAULT_USERNAME = process.env.GESTIDLO_USER ?? 'operator';
const DEFAULT_PASSWORD = process.env.GESTIDLO_PASS ?? 'operator';

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
  console.log(`
Raspberry Pi -> GEstidlo (simulation capteurs via boutons GPIO)

Pins BCM (défaut):
  NORMAL: 17   WARN: 27   CRIT: 22   LED: 23 (optionnel)

Valeurs envoyées (type PRESSURE par défaut):
  NORMAL=3.0  WARN=1.5  CRIT=0.5

Usage:
  npm i onoff
  export BFF_URL="http://<PC_IP>:9083"
  node tools/pi/iot-buttons.mjs --pointId POINT-001 --sensorId PI-01

Options:
  --bffUrl     Base URL du BFF (défaut: ${DEFAULT_BFF_URL})
  --username   (défaut: ${DEFAULT_USERNAME})
  --password   (défaut: ${DEFAULT_PASSWORD})
  --pointId    (défaut: POINT-001)
  --sensorId   (défaut: PI-01)
  --type       (défaut: PRESSURE)
  --unit       (défaut: bar)
  --pinNormal  BCM pin (défaut: 17)
  --pinWarn    BCM pin (défaut: 27)
  --pinCrit    BCM pin (défaut: 22)
  --pinLed     BCM pin (défaut: 23, 0 pour désactiver)
`);
}

function asNumber(value, fallback) {
  if (value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

async function login({ bffUrl, username, password }) {
  const res = await requestJson(`${bffUrl}/api/auth/login`, {
    method: 'POST',
    body: { username, password }
  });
  if (!res?.token) {
    throw new Error('Login succeeded but no token returned');
  }
  return {
    token: res.token,
    expiresAt: res.expiresAt ? Date.parse(res.expiresAt) : null
  };
}

function tokenStillValid(session) {
  if (!session?.token) return false;
  if (!session?.expiresAt) return true;
  return Date.now() < session.expiresAt - 30_000;
}

async function ensureSession({ session, bffUrl, username, password }) {
  if (tokenStillValid(session)) return session;
  return login({ bffUrl, username, password });
}

function debounce(fn, delayMs) {
  let last = 0;
  return async (...args) => {
    const now = Date.now();
    if (now - last < delayMs) return;
    last = now;
    return fn(...args);
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || args.h) {
    usage();
    process.exit(0);
  }

  const bffUrl = String(args.bffUrl ?? DEFAULT_BFF_URL).replace(/\/$/, '');
  const username = String(args.username ?? DEFAULT_USERNAME);
  const password = String(args.password ?? DEFAULT_PASSWORD);
  const pointId = String(args.pointId ?? 'POINT-001');
  const sensorId = String(args.sensorId ?? 'PI-01');
  const type = String(args.type ?? 'PRESSURE').trim().toUpperCase();
  const unit = String(args.unit ?? 'bar');

  const pinNormal = Math.trunc(asNumber(args.pinNormal, 17));
  const pinWarn = Math.trunc(asNumber(args.pinWarn, 27));
  const pinCrit = Math.trunc(asNumber(args.pinCrit, 22));
  const pinLed = Math.trunc(asNumber(args.pinLed, 23));

  let session = null;

  let Gpio;
  try {
    ({ Gpio } = await import('onoff'));
  } catch (e) {
    console.error('Module "onoff" introuvable. Sur le Pi: npm i onoff');
    throw e;
  }

  const led = pinLed > 0 ? new Gpio(pinLed, 'out') : null;

  async function blink() {
    if (!led) return;
    led.writeSync(1);
    setTimeout(() => {
      try {
        led.writeSync(0);
      } catch {
        // ignore
      }
    }, 120);
  }

  async function send(value, label) {
    session = await ensureSession({ session, bffUrl, username, password });
    const payload = { pointId, sensorId, type, value, unit };
    const ingest = await requestJson(`${bffUrl}/api/iot/measurements`, {
      method: 'POST',
      token: session.token,
      body: payload
    });
    await blink();
    console.log(
      JSON.stringify(
        {
          at: new Date().toISOString(),
          scenario: label,
          sent: payload,
          ingest
        },
        null,
        2
      )
    );
  }

  const sendDebounced = debounce(send, 700);

  // Entrées en pull-down externe recommandées.
  // En edge="rising" : le bouton connecte 3.3V vers GPIO.
  const normal = new Gpio(pinNormal, 'in', 'rising');
  const warn = new Gpio(pinWarn, 'in', 'rising');
  const crit = new Gpio(pinCrit, 'in', 'rising');

  normal.watch((err) => {
    if (err) return console.error('GPIO normal error:', err);
    sendDebounced(3.0, 'NORMAL').catch((e) => console.error(e.message ?? e));
  });

  warn.watch((err) => {
    if (err) return console.error('GPIO warn error:', err);
    sendDebounced(1.5, 'WARN').catch((e) => console.error(e.message ?? e));
  });

  crit.watch((err) => {
    if (err) return console.error('GPIO crit error:', err);
    sendDebounced(0.5, 'CRIT').catch((e) => console.error(e.message ?? e));
  });

  console.log(
    `En écoute. BFF=${bffUrl} pointId=${pointId} sensorId=${sensorId} type=${type}. Ctrl+C pour arrêter.`
  );

  process.on('SIGINT', () => {
    try {
      normal.unexport();
      warn.unexport();
      crit.unexport();
      if (led) led.unexport();
    } finally {
      process.exit(0);
    }
  });
}

main().catch((e) => {
  console.error(e?.message ?? e);
  if (e?.payload) {
    console.error('Response payload:', JSON.stringify(e.payload, null, 2));
  }
  process.exit(1);
});

