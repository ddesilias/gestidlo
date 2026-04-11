# IoT Raspberry Pi (simulation simple)

Ce projet déclenche les alertes à partir des mesures envoyées vers `api-metier` via le BFF.

Important : dans l'état actuel du code, **Camunda n'est démarré que lorsqu'un ticket est créé** (depuis l'UI, validation humaine). Les capteurs ne font donc que créer/mette à jour une alerte, puis un opérateur clique sur **Créer un ticket**.

## 1) Pré-requis

- Les services tournent sur le PC : `./start-all.sh`
- Le Raspberry Pi est sur le même réseau que le PC.
- Sur le Pi : Node.js 18+

## 2) Payload attendu par l'API

Endpoint (via le BFF) : `POST http://<PC_IP>:9083/api/iot/measurements`

Body JSON :

```json
{
  "pointId": "POINT-001",
  "sensorId": "SIM-01",
  "type": "PRESSURE",
  "value": 0.5,
  "unit": "bar"
}
```

Types valides (par défaut) : `PRESSURE`, `LEVEL`, `FLOW`.

Seuils par défaut (seed) :

- `PRESSURE`: WARN si `< 2.0`, CRIT si `< 1.0`
- `LEVEL`: CRIT si `< 10.0`

## 3) Authentification (JWT)

Les endpoints (dont l'ingestion IoT) sont protégés par JWT.

Le Pi doit donc :

1. Login : `POST http://<PC_IP>:9083/api/auth/login` avec `{ "username": "operator", "password": "operator" }`
2. Réutiliser `token` dans `Authorization: Bearer <token>` pour les appels suivants.

Comptes seedés : `admin/admin`, `tech/tech`, `operator/operator`.

## 4) Montage le plus simple (Fritzing)

Comme Fritzing ne simule pas l'HTTP, le plus simple pour une démo est de simuler des "capteurs" par des boutons (scénarios) sur GPIO.

### Composants

- Raspberry Pi (40 pins)
- 3x boutons poussoirs
- 3x résistances 10k (pull-down)
- (Optionnel) 1x LED + résistance 330Ω

### Câblage proposé

Alimentation :

- `3.3V` : pin physique **1**
- `GND` : pin physique **6**

Boutons (un par scénario) :

- **NORMAL** : GPIO17 (pin **11**)
- **WARN** : GPIO27 (pin **13**)
- **CRIT** : GPIO22 (pin **15**)

Pour chaque bouton :

- Une résistance 10k entre `GPIOxx` et `GND` (pull-down)
- Le bouton entre `3.3V` et `GPIOxx`

Optionnel LED (retour visuel à l'envoi) :

- GPIO23 (pin **16**) → résistance 330Ω → LED → GND

## 5) Programme Node sur le Pi

Copie `tools/pi/iot-buttons.mjs` sur le Pi, puis :

```bash
npm init -y
npm i onoff

export BFF_URL="http://<PC_IP>:9083"
node iot-buttons.mjs --pointId POINT-001 --sensorId PI-01
```

## 6) Validation humaine + suivi Camunda

1. Ouvrir le SPA : `http://localhost:4200`
2. Login `operator/operator`
3. Page **Alertes** → vous verrez l'alerte ACTIVE suite au bouton WARN/CRIT.
4. Cliquer **Créer un ticket** → démarre le process Camunda `gestidlo_intervention`.
5. Suivi Camunda Cockpit : `http://localhost:9080/camunda/app/cockpit/default/` (admin/admin)

