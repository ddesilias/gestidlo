#!/usr/bin/env node

// Raspberry Pi + MCP3008 (SPI) + potentiomètre -> envoi de mesures vers le BFF
// Dépendances (sur le Pi): npm i mcp-spi-adc

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
Raspberry Pi -> GEstidlo (potentiomètre via MCP3008 / SPI)

Pré-requis:
  - SPI activé (raspi-config)
  - MCP3008 câblé sur SPI0 CE0
  - Potentiomètre sur CH0

Installation:
  npm i mcp-spi-adc
  export BFF_URL="http://<PC_IP>:9083"

Usage:
  node tools/pi/iot-pot-mcp3008.mjs --pointId POINT-001 --sensorId PI-POT-01

Options:
  --bffUrl       Base URL du BFF (défaut: ${DEFAULT_BFF_URL})
  --username     (défaut: ${DEFAULT_USERNAME})
  --password     (défaut: ${DEFAULT_PASSWORD})
  --pointId      (défaut: POINT-001)
  --sensorId     (défaut: PI-POT-01)
  --type         PRESSURE | LEVEL | FLOW (défaut: PRESSURE)
  --unit         (défaut: bar)
  --channel      0..7 (défaut: 0)
  --intervalMs   (défaut: 1000)
  --min          Valeur min envoyée (défaut: 0)
  --max          Valeur max envoyée (défaut: 3)
  --delta        Seuil de variation avant envoi (défaut: 0.05)
  --speedHz      SPI speed (défaut: 20000)
`);
}

function asNumber(value, fallback) {
  if (value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

async function openMcp3008(channel, speedHz) {
  let mcpadc;
  try {
    mcpadc = (await import('mcp-spi-adc')).default;
  } catch (e) {
    console.error('Module "mcp-spi-adc" introuvable. Sur le Pi: npm i mcp-spi-adc');
    throw e;
  }

  return new Promise((resolve, reject) => {
    mcpadc.open(channel, { speedHz }, (err, adc) => {
      if (err) return reject(err);
      resolve(adc);
    });
  });
}

async function readAdc(adc) {
  return new Promise((resolve, reject) => {
    adc.read((err, reading) => {
      if (err) return reject(err);
      // reading.value: 0..1
      // reading.rawValue: 0..1023
      resolve(reading);
    });
  });
}

function mapValue(unitValue, min, max) {
  const v = clamp(unitValue, 0, 1);
  return min + v * (max - min);
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
  const sensorId = String(args.sensorId ?? 'PI-POT-01');

  const type = String(args.type ?? 'PRESSURE').trim().toUpperCase();
  const unit = String(args.unit ?? 'bar');
  const channel = clamp(Math.trunc(asNumber(args.channel, 0)), 0, 7);
  const intervalMs = Math.max(200, Math.trunc(asNumber(args.intervalMs, 1000)));
  const min = asNumber(args.min, 0);
  const max = asNumber(args.max, 3);
  const delta = Math.max(0, asNumber(args.delta, 0.05));
  const speedHz = Math.max(1_000, Math.trunc(asNumber(args.speedHz, 20_000)));

  if (min === max) {
    throw new Error('--min et --max doivent être différents');
  }

  const adc = await openMcp3008(channel, speedHz);
  let session = null;
  let lastSent = null;

  console.log(
    `Lecture MCP3008 CH${channel}. Envoi toutes les ${intervalMs}ms (delta=${delta}). Ctrl+C pour arrêter.`
  );

  const timer = setInterval(async () => {
    try {
      const reading = await readAdc(adc);
      const value = mapValue(reading.value, min, max);

      if (lastSent != null && Math.abs(value - lastSent) < delta) {
        return;
      }

      session = await ensureSession({ session, bffUrl, username, password });
      const payload = {
        pointId,
        sensorId,
        type,
        value: Number(value.toFixed(3)),
        unit
      };

      const ingest = await requestJson(`${bffUrl}/api/iot/measurements`, {
        method: 'POST',
        token: session.token,
        body: payload
      });

      lastSent = payload.value;
      console.log(
        JSON.stringify(
          {
            at: new Date().toISOString(),
            adc: { value: reading.value, rawValue: reading.rawValue },
            sent: payload,
            ingest
          },
          null,
          2
        )
      );
    } catch (e) {
      console.error(e?.message ?? e);
      if (e?.payload) {
        console.error('Response payload:', JSON.stringify(e.payload, null, 2));
      }
    }
  }, intervalMs);

  process.on('SIGINT', () => {
    clearInterval(timer);
    try {
      adc.close(() => process.exit(0));
    } catch {
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

