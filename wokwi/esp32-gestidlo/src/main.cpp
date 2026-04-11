#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// Wokwi WiFi (fonctionne dans le simulateur)
static const char *WIFI_SSID = "Wokwi-GUEST";
static const char *WIFI_PASSWORD = "";

// IMPORTANT:
// - "localhost" ne marche généralement pas depuis le device simulé.
// - Mets ici l'IP LAN de ton PC.
// - Recommandé: pointer vers le BFF (9083), qui proxy vers l'API Métier.
// Exemple: http://192.168.1.20:9083
static const char *API_BASE_URL = "http://192.168.1.20:9083";

static const char *USERNAME = "operator";
static const char *PASSWORD = "operator";

static const char *POINT_ID = "POINT-001";

static const char *SENSOR_PRESSURE = "WOKWI-PRESSURE";
static const char *SENSOR_FLOW = "WOKWI-FLOW";
static const char *SENSOR_LEVEL = "WOKWI-LEVEL";

// Pressure (analog)
static const int POT_PRESSURE_PIN = 34;  // ADC1

// Level (HC-SR04)
static const int LEVEL_TRIG_PIN = 26;
static const int LEVEL_ECHO_PIN = 25;

// Flow (pulses via rotary encoder)
static const int FLOW_A_PIN = 27;
static const int FLOW_B_PIN = 14;
static const int FLOW_SW_PIN = 12;

static const uint32_t SEND_INTERVAL_MS = 1000;

static const float PRESSURE_MIN = 0.0f;
static const float PRESSURE_MAX = 3.0f;

static const float TANK_HEIGHT_CM = 100.0f;
static const float SPEED_OF_SOUND_CM_PER_US = 0.0343f;

// Calibration factor for the demo: convert pulses/s to L/min.
// (A rotary encoder is not a real flowmeter, this is only for simulation.)
static const float FLOW_LPM_PER_PULSE_PER_SEC = 0.5f;

static String jwtToken;
static uint32_t lastSentAtMs = 0;
static volatile uint32_t flowPulses = 0;

static void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connexion au WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print('.');
  }
  Serial.println();
  Serial.print("WiFi connecte, IP=");
  Serial.println(WiFi.localIP());
}

static bool httpPostJson(const String &url, const String &jsonBody, int &statusCode, String &responseBody,
                         const String &bearer = "") {
  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Accept", "application/json");
  if (bearer.length() > 0) {
    http.addHeader("Authorization", "Bearer " + bearer);
  }

  statusCode = http.POST((uint8_t *)jsonBody.c_str(), jsonBody.length());
  responseBody = http.getString();
  http.end();
  return statusCode > 0;
}

static bool login() {
  const String url = String(API_BASE_URL) + "/api/auth/login";

  StaticJsonDocument<256> body;
  body["username"] = USERNAME;
  body["password"] = PASSWORD;
  String json;
  serializeJson(body, json);

  int status = 0;
  String res;
  if (!httpPostJson(url, json, status, res)) {
    Serial.println("Erreur HTTP pendant la connexion");
    return false;
  }
  if (status != 200) {
    Serial.printf("Echec de connexion: HTTP %d\n", status);
    Serial.println(res);
    return false;
  }

  StaticJsonDocument<1024> doc;
  DeserializationError err = deserializeJson(doc, res);
  if (err) {
    Serial.print("Erreur de parsing JSON (connexion): ");
    Serial.println(err.c_str());
    Serial.println(res);
    return false;
  }

  const char *token = doc["token"];
  if (!token || strlen(token) == 0) {
    Serial.println("Reponse de connexion invalide (token manquant)");
    Serial.println(res);
    return false;
  }

  jwtToken = String(token);
  Serial.println("Connexion OK");
  return true;
}

static float adcToPressure(int raw) {
  // ESP32 ADC raw: 0..4095
  const float ratio = (float)raw / 4095.0f;
  return PRESSURE_MIN + ratio * (PRESSURE_MAX - PRESSURE_MIN);
}

static float clampf(float value, float minValue, float maxValue) {
  if (value < minValue) return minValue;
  if (value > maxValue) return maxValue;
  return value;
}

static float readTankLevelCm() {
  digitalWrite(LEVEL_TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(LEVEL_TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(LEVEL_TRIG_PIN, LOW);

  // timeout 30ms ~ 5 meters
  const uint32_t durationUs = pulseIn(LEVEL_ECHO_PIN, HIGH, 30000);
  if (durationUs == 0) {
    return NAN;
  }
  const float distanceCm = (durationUs * SPEED_OF_SOUND_CM_PER_US) / 2.0f;
  const float level = TANK_HEIGHT_CM - distanceCm;
  return clampf(level, 0.0f, TANK_HEIGHT_CM);
}

static void sendMeasurement(
  const char *pointId,
  const char *sensorId,
  const char *type,
  float value,
  const char *unit
) {
  const String url = String(API_BASE_URL) + "/api/iot/measurements";

  StaticJsonDocument<384> body;
  body["pointId"] = pointId;
  body["sensorId"] = sensorId;
  body["type"] = type;
  body["value"] = value;
  body["unit"] = unit;
  String json;
  serializeJson(body, json);

  int status = 0;
  String res;
  if (!httpPostJson(url, json, status, res, jwtToken)) {
    Serial.printf("Erreur HTTP ingestion (%s/%s)\n", pointId, type);
    return;
  }

  if (status == 401) {
    Serial.println("401 Non autorise, reconnexion...");
    jwtToken = "";
    if (!login()) {
      return;
    }
    // retry once
    if (!httpPostJson(url, json, status, res, jwtToken)) {
      Serial.printf("Erreur HTTP ingestion (retry) (%s/%s)\n", pointId, type);
      return;
    }
  }

  if (status < 200 || status >= 300) {
    Serial.printf("Echec ingestion: HTTP %d (%s/%s)\n", status, pointId, type);
    Serial.println(res);
    return;
  }

  Serial.printf("Envoye %s %s=%.3f %s\n", pointId, type, value, unit);
}

static void IRAM_ATTR onFlowPulse() {
  flowPulses++;
}

static uint32_t readAndResetFlowPulses() {
  noInterrupts();
  uint32_t pulses = flowPulses;
  flowPulses = 0;
  interrupts();
  return pulses;
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("GEstidlo IoT (Wokwi ESP32) demarrage...");

  analogReadResolution(12);
  pinMode(POT_PRESSURE_PIN, INPUT);

  pinMode(LEVEL_TRIG_PIN, OUTPUT);
  pinMode(LEVEL_ECHO_PIN, INPUT);
  digitalWrite(LEVEL_TRIG_PIN, LOW);

  pinMode(FLOW_A_PIN, INPUT_PULLUP);
  pinMode(FLOW_B_PIN, INPUT_PULLUP);
  pinMode(FLOW_SW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_A_PIN), onFlowPulse, RISING);

  connectWifi();
  login();

  Serial.println("Controles de simulation:");
  Serial.println("- Pression: potentiometre sur GPIO34");
  Serial.println("- Niveau: distance HC-SR04 (convertie en cm)");
  Serial.println("- Debit: impulsions encodeur rotatif (converties en L/min)");
  Serial.println("Seuils (configuration par defaut):");
  Serial.println("- PRESSURE WARN < 2.0 bar");
  Serial.println("- PRESSURE CRIT < 1.0 bar");
  Serial.println("- LEVEL CRIT < 10.0 cm");
}

void loop() {
  const uint32_t now = millis();
  if (now - lastSentAtMs < SEND_INTERVAL_MS) {
    delay(10);
    return;
  }
  lastSentAtMs = now;

  const float pressure = adcToPressure(analogRead(POT_PRESSURE_PIN));

  const uint32_t pulses = readAndResetFlowPulses();
  const float pulsesPerSec = (float)pulses / ((float)SEND_INTERVAL_MS / 1000.0f);
  const float flowLpm = pulsesPerSec * FLOW_LPM_PER_PULSE_PER_SEC;

  const float levelCm = readTankLevelCm();

  if (jwtToken.length() == 0) {
    login();
  }
  if (jwtToken.length() == 0) {
    return;
  }

  sendMeasurement(POINT_ID, SENSOR_PRESSURE, "PRESSURE", pressure, "bar");
  sendMeasurement(POINT_ID, SENSOR_FLOW, "FLOW", flowLpm, "L/min");
  if (!isnan(levelCm)) {
    sendMeasurement(POINT_ID, SENSOR_LEVEL, "LEVEL", levelCm, "cm");
  }
}
