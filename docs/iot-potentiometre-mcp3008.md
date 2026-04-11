# IoT Raspberry Pi + Potentiomètre (MCP3008 / SPI)

Objectif : utiliser un **potentiomètre** comme capteur analogique (ex: pression) sur un Raspberry Pi, puis envoyer des mesures vers ton PC (où tournent les services). Quand la valeur passe sous les seuils, `api-metier` crée/met à jour une **alerte**. Ensuite, validation humaine dans le SPA → création de ticket → démarrage du process Camunda.

## 0) Ce que déclenche le backend

Dans `api-metier`, les seuils par défaut (seed) sont :

- `PRESSURE`: WARN si `< 2.0`, CRIT si `< 1.0`

Donc si on mappe ton potentiomètre sur une pression `0.0 → 3.0`, tu peux :

- tourner vers le haut : pas d'alerte
- tourner vers le bas : WARN puis CRIT

## 1) Matériel (simple et fiable)

- Raspberry Pi (n'importe lequel avec SPI)
- 1x **MCP3008** (ADC 10 bits, SPI, 3.3V)
- 1x **potentiomètre 10k**
- 1x condensateur **100nF** (0.1µF) entre VDD et GND (recommandé)
- breadboard + jumpers

Pourquoi MCP3008 : le Pi n'a pas d'entrées analogiques natives.

## 2) Câblage (à reproduire dans Fritzing)

### Raspberry Pi (SPI)

Pins physiques du Pi (40 pins) :

- `3.3V` : pin **1**
- `GND` : pin **6**
- `SPI0 CE0` (GPIO8) : pin **24**
- `SPI0 MOSI` (GPIO10) : pin **19**
- `SPI0 MISO` (GPIO9) : pin **21**
- `SPI0 SCLK` (GPIO11) : pin **23**

### MCP3008 → Raspberry Pi

MCP3008 (DIP-16) :

- `VDD` → `3.3V`
- `VREF` → `3.3V`
- `AGND` → `GND`
- `DGND` → `GND`
- `CLK` → `SCLK` (GPIO11 / pin 23)
- `DOUT` → `MISO` (GPIO9 / pin 21)
- `DIN` → `MOSI` (GPIO10 / pin 19)
- `CS/SHDN` → `CE0` (GPIO8 / pin 24)

Condensateur 100nF : `VDD` ↔ `GND` (au plus près du MCP3008).

### Potentiomètre → MCP3008

- une extrémité du pot → `3.3V`
- l'autre extrémité → `GND`
- curseur (middle) → `CH0` du MCP3008

## 3) Activer SPI sur le Pi

Sur le Raspberry Pi :

```bash
sudo raspi-config
# Interface Options -> SPI -> Enable
sudo reboot
```

## 4) Programme Node.js (lecture ADC → HTTP)

Un script prêt est dans `tools/pi/iot-pot-mcp3008.mjs`.

Sur le Pi :

```bash
npm init -y
npm i mcp-spi-adc

export BFF_URL="http://<IP_DU_PC>:9083"
node tools/pi/iot-pot-mcp3008.mjs \
  --pointId POINT-001 --sensorId PI-POT-01 \
  --type PRESSURE --unit bar \
  --min 0 --max 3 --intervalMs 1000
```

Le script :

1. fait un login JWT (`operator/operator` par défaut)
2. lit `CH0` du MCP3008
3. mappe la lecture sur `[min..max]`
4. envoie `POST /api/iot/measurements` vers le BFF

## 5) Validation humaine + suivi

1. PC : `./start-all.sh`
2. SPA : `http://localhost:4200` → login `operator/operator`
3. Page **Alertes** : quand tu passes sous les seuils → l'alerte apparaît.
4. Clique **Créer un ticket** : ça démarre le process Camunda `gestidlo_intervention`.
5. Cockpit : `http://localhost:9080/camunda/app/cockpit/default/` (admin/admin)

