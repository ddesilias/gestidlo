# Wokwi ESP32 (capteurs simulés) → GEstidlo

Ce scénario simule un équipement IoT en **ESP32** (Wokwi) avec des capteurs proches d’un cas réel :

- **Pression** (analogique)
- **Niveau** (HC-SR04) en cm
- **Débit** (impulsions via encodeur rotatif)

Le firmware effectue :

1. connexion WiFi (SSID `Wokwi-GUEST`)
2. login JWT via le **BFF**
3. envoi périodique de mesures sur `POST /api/iot/measurements`

Ensuite, l’opérateur valide dans la SPA : alertes → ticket → suivi Camunda.

## 1) Démarrer le backend sur le PC

```bash
./start-all.sh
```

Vérifie que `api-metier` répond : `http://localhost:9082/actuator/health`.

Vérifie que le BFF répond : `http://localhost:9083/api/health`.

## 2) Configurer l'URL côté firmware

Dans `wokwi/esp32-gestidlo/src/main.cpp:1`, remplace :

- `API_BASE_URL` par l’IP LAN du PC, ex: `http://192.168.1.20:9083`

Pourquoi : le device simulé n’accède généralement pas à `localhost` de la machine hôte.

Si besoin, autorise les ports sur le firewall macOS pour `9083`.

## 3) Lancer Wokwi

Ouvre le dossier `wokwi/esp32-gestidlo` dans VS Code.

Pré-requis : PlatformIO + Wokwi for VS Code.

1. Build PlatformIO (ça génère `.pio/build/esp32dev/firmware.bin`)
2. `Wokwi: Start Simulator`

## 4) Utilisation du circuit (contrôles)

Le circuit est défini dans `wokwi/esp32-gestidlo/diagram.json`.

- Potentiomètre **Pressure** : fait varier `PRESSURE` sur `POINT-001`
- HC-SR04 **Tank level** : ajuster la distance dans Wokwi (convertie en niveau en cm sur `POINT-001`)
- Encodeur rotatif **Flow pulses** : génère des impulsions, converties en `FLOW` (L/min) sur `POINT-001`

## 5) Déclencher une alerte

Tourner le potentiomètre **Pressure** :

- `PRESSURE < 2.0` → alerte WARN
- `PRESSURE < 1.0` → alerte CRIT

Pour déclencher une alerte de niveau, ajuster la distance du HC-SR04 (dans Wokwi). Le firmware convertit la distance en niveau avec une hauteur de cuve simulée de 100 cm :

- `LEVEL = 100 - distance`
- `LEVEL < 10.0 cm` → alerte CRIT

Dans le SPA : `http://localhost:4200` → login `operator/operator` → page **Alertes**.

## 6) Flux complet (validation humaine)

1. Page **Alertes** : sélectionner une alerte ACTIVE
2. Cliquer **Créer un ticket** : lance le process Camunda `gestidlo_intervention`
3. Cockpit : `http://localhost:9080/camunda/app/cockpit/default/` (admin/admin)
