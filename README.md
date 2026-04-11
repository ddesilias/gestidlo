# GEstidlo

GEstidlo est une application de supervision et de gestion d’interventions, construite autour de **Camunda 7** (processus BPMN), de microservices **Spring Boot** et d’une **SPA Angular**.

Ce document décrit comment exécuter l’environnement complet en local.

## Architecture

Le dépôt est organisé en monorepo et expose les services suivants :

| Service | Dossier | Port | Description |
| :-- | :-- | :-- | :-- |
| Camunda Engine | `backend/camunda-engine` | `9080` | Moteur Camunda 7, Cockpit et endpoint REST `engine-rest` |
| Camunda API | `backend/camunda-api` | `9081` | Façade/proxy vers Camunda Engine |
| API Métier | `backend/api-metier` | `9082` | Logique métier (mesures, alertes, tickets, authentification) |
| BFF | `frontend/bff` | `9083` | Backend-for-Frontend (agrégation, contrôle d’accès, proxy) |
| SPA | `frontend/spa` | `4200` | Application Angular |

Flux fonctionnel principal : ingestion de mesures (IoT) → alertes → tickets → orchestration Camunda.

## Prérequis

- Java 17
- Maven 3.8+
- Node.js 18+ et npm

## Démarrage rapide (recommandé)

### 1) Installer les dépendances Angular

`start-all.sh` démarre `ng serve` mais n’installe pas les dépendances npm.

```bash
cd frontend/spa
npm ci
cd ../..
```

### 2) Lancer l’environnement complet

Depuis la racine du dépôt :

```bash
chmod +x start-all.sh
./start-all.sh
```

Le script compile les services Spring Boot (tests Maven ignorés) puis démarre : Camunda Engine, Camunda API, API Métier, BFF et la SPA.

Pour arrêter proprement l’ensemble, appuyer sur `ENTER` dans le terminal du script.

### 3) Points de contrôle

- SPA : `http://localhost:4200`
- BFF (état agrégé) : `http://localhost:9083/api/health`
- Actuator (health) :
  - `http://localhost:9080/actuator/health`
  - `http://localhost:9081/actuator/health`
  - `http://localhost:9082/actuator/health`
  - `http://localhost:9083/actuator/health`

Pour une vérification fonctionnelle rapide, le BFF expose également un endpoint d’agrégation (authentifié) :

- `http://localhost:9083/api/dashboard`

Exemple (récupérer un token puis appeler `dashboard`) :

```bash
TOKEN=$(curl -s http://localhost:9082/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"operator","password":"operator"}' \
  | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).token")

curl -s http://localhost:9083/api/dashboard -H "Authorization: Bearer $TOKEN"
```

## Accès

### Camunda Cockpit

- URL : `http://localhost:9080/camunda/app/cockpit/default/`
- Identifiants : `admin` / `admin`

### Comptes applicatifs (initialisation)

Au démarrage, l’API Métier initialise des comptes par défaut (voir `backend/api-metier/src/main/java/com/example/api_metier/ApiMetierApplication.java`) :

| Utilisateur | Mot de passe | Rôle |
| :-- | :-- | :-- |
| `admin` | `admin` | `ADMIN` |
| `tech` | `tech` | `TECH` |
| `operator` | `operator` | `OPERATOR` |

Règles d’accès principales :

- `/api/auth/login` est public.
- `/api/reference/**` requiert le rôle `ADMIN` (API Métier et BFF).

## Configuration

### JWT

L’API Métier émet un JWT (HMAC) et le BFF valide ce même JWT. La valeur `gestidlo.jwt.secret` doit être identique dans :

- `backend/api-metier/src/main/resources/application.properties`
- `frontend/bff/src/main/resources/application.properties`

### Base de données

En local, l’API Métier et Camunda Engine utilisent **H2 en mémoire** (réinitialisé à chaque démarrage). Des données de référence sont insérées automatiquement au démarrage.

Les fichiers `metier-db.mv.db` et `metier-db.trace.db` présents à la racine peuvent être ignorés.

## API (OpenAPI/Swagger)

- Camunda API : `http://localhost:9081/swagger-ui.html` (ou `http://localhost:9081/swagger-ui/index.html`)
- API Métier : `http://localhost:9082/swagger-ui.html` (ou `http://localhost:9082/swagger-ui/index.html`)

## Postman

Des collections Postman sont disponibles dans `postman/`.

1. Importer l’environnement `postman/GEstidlo_Local_Env.json`.
2. Importer les collections `postman/*.json`.
3. Utiliser l’environnement “local” pour accéder aux services sur les ports par défaut.

## Exemples (curl)

### Authentification (récupérer un JWT)

```bash
curl -s http://localhost:9082/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"operator","password":"operator"}'
```

### Envoyer une mesure

```bash
curl -s http://localhost:9082/api/iot/measurements \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer TOKEN" \
  -d '{"pointId":"POINT-001","sensorId":"SIM-01","type":"PRESSURE","value":0.8,"unit":"bar"}'
```

Seuils par défaut (initialisation) :

- `PRESSURE` : WARN < 2.0 ; CRIT < 1.0
- `LEVEL` : CRIT < 10.0

## Simulation IoT (Wokwi ESP32)

Un exemple de capteur (ESP32) est disponible dans `wokwi/esp32-gestidlo`.

- Source : `wokwi/esp32-gestidlo/src/main.cpp`
- Mettre à jour `API_BASE_URL` avec l’adresse IP de la machine qui exécute le BFF (ex. `http://192.168.x.y:9083`).

Le circuit simule :

- `PRESSURE` sur `POINT-001` (potentiomètre)
- `LEVEL` (cm) sur `POINT-001` (HC-SR04)
- `FLOW` sur `POINT-001` (impulsions via encodeur rotatif)

Remarque : `localhost` ne pointe pas vers la machine hôte depuis le simulateur ; utiliser une adresse IP joignable.

### Lancer le simulateur dans VS Code

Prérequis (VS Code) :

- Extension **PlatformIO IDE**
- Extension **Wokwi Simulator**

Étapes :

1. Ouvrir le dossier `wokwi/esp32-gestidlo` dans VS Code.
2. Mettre à jour `API_BASE_URL` dans `wokwi/esp32-gestidlo/src/main.cpp`.
3. Construire le firmware :
   - via VS Code : commande `PlatformIO: Build` (si disponible),
   - ou via CLI PlatformIO Core (voir ci-dessous).
4. Démarrer la simulation via l’extension Wokwi (Palette de commandes : rechercher une commande Wokwi de démarrage).
5. Ouvrir le **Serial Monitor** (PlatformIO) pour suivre :
   - la connexion WiFi,
   - le login (`/api/auth/login`),
   - l’envoi des mesures vers `/api/iot/measurements`.

En cas de `401 Unauthorized`, le simulateur tente un re-login automatiquement (visible dans le Serial Monitor).

### Option ligne de commande (PlatformIO Core)

Si les commandes PlatformIO n’apparaissent pas dans VS Code, vous pouvez compiler via la CLI PlatformIO Core. Pour une carte physique, la CLI permet également d’ouvrir un moniteur série.

Installation (Python requis) :

macOS (Homebrew) :

```bash
brew install platformio
```

Installation via `pip` :

```bash
python3 -m pip install -U platformio
```

Si la commande `pio` n’est pas disponible dans le terminal, utiliser `python3 -m platformio` à la place de `pio`.

Compilation :

```bash
cd wokwi/esp32-gestidlo
pio run
```

Moniteur série :

```bash
cd wokwi/esp32-gestidlo
pio device monitor
```

Remarque : `pio device monitor` s’applique à une carte ESP32 physique connectée en USB. Pour la simulation Wokwi, utiliser le moniteur série intégré au simulateur.

## Flux d’utilisation (end-to-end)

Cette section décrit un parcours complet pour valider que l’environnement fonctionne correctement.

Pour accélérer la démonstration, un script est disponible pour préparer un scénario standard (1 point, plusieurs types de mesures, 1 alerte critique) :

```bash
node tools/demo-mvp.mjs
```

### 1) Démarrer tous les services

- Lancer `./start-all.sh`.
- Vérifier `http://localhost:9083/api/health`.
- Vérifier `http://localhost:9082/actuator/health` (API Métier) et `http://localhost:9080/actuator/health` (Camunda Engine).

### 2) Se connecter à l’application

- Ouvrir `http://localhost:4200`.
- Se connecter avec `operator` / `operator`.

### 3) Générer une alerte

Option A (recommandé) : via le simulateur Wokwi (section “Simulation IoT”).

Option B : via curl (voir “Envoyer une mesure”). Utiliser une valeur `PRESSURE` < `1.0` pour forcer une alerte critique.

Option C : via script :

```bash
node tools/demo-mvp.mjs
```

Résultat attendu :

- Une alerte apparaît dans l’application (et/ou via `GET http://localhost:9083/api/alerts?status=ACTIVE`).

Selon les valeurs envoyées, plusieurs alertes peuvent être actives simultanément sur un même point (ex. `PRESSURE` et `LEVEL`).

Pour vérifier l’ingestion “temps réel” : `GET http://localhost:9083/api/realtime/points`.

### 4) Créer un ticket et démarrer le process Camunda

- Depuis l’UI, créer un ticket à partir de l’alerte.
- Résultat attendu :
  - le ticket est visible via `GET http://localhost:9083/api/tickets`,
  - un process instance Camunda est démarré (référence stockée sur le ticket).

### 5) Suivre le workflow dans Camunda Cockpit

- Ouvrir Cockpit : `http://localhost:9080/camunda/app/cockpit/default/` (admin/admin).
- Vérifier qu’une instance du process `gestidlo_intervention` est présente.
- Vérifier l’état des tâches et leur progression.

### 6) Faire avancer le ticket

- Depuis l’UI (ou via `POST http://localhost:9083/api/tickets/{id}/advance`), avancer le ticket.
- Résultat attendu :
  - des tâches Camunda sont complétées,
  - le statut du ticket évolue (`OPEN` → `ASSIGNED`/`IN_PROGRESS` → `CLOSED`).

## Structure du dépôt

```
.
├── backend/
│   ├── camunda-engine/
│   ├── camunda-api/
│   └── api-metier/
├── frontend/
│   ├── bff/
│   └── spa/
├── postman/
├── docs/
├── wokwi/
└── start-all.sh
```

## Dépannage

- Conflit de ports : vérifier `lsof -i :9080` (idem `:9081`, `:9082`, `:9083`, `:4200`).
- SPA incapable d’appeler le BFF : vérifier l’URL du BFF dans `frontend/spa/src/app/api/bff-api.service.ts` (valeur attendue `http://localhost:9083/api`).
- Erreurs 401 : vérifier la cohérence de `gestidlo.jwt.secret` entre API Métier et BFF.
- Sous Windows : exécuter `start-all.sh` via WSL2 (recommandé) ou un environnement bash compatible.
