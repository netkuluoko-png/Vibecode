/*
 * LightTracker - ESP8266/ESP32 Light Sensor
 *
 * Цей скетч відправляє дані про наявність світла на сервер
 *
 * Варіанти підключення:
 * 1. Фоторезистор (LDR) - A0 pin
 * 2. Просто підключений до USB - визначаємо світло за наявністю WiFi
 * 3. Digital pin з оптопарою або реле
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>

// ==================== КОНФІГУРАЦІЯ ====================

// WiFi налаштування
const char* WIFI_SSID = "YOUR_WIFI_SSID";        // Твій WiFi
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"; // Пароль WiFi

// Server налаштування
const char* SERVER_URL = "http://192.168.1.100:3000/api/sensor/update";  // IP твого сервера
const char* SENSOR_ID = "main";  // ID датчика (якщо кілька)

// Sensor налаштування
#define SENSOR_TYPE 1  // 1 = Фоторезистор, 2 = Digital pin, 3 = WiFi only

#if SENSOR_TYPE == 1
  #define LDR_PIN A0           // Аналоговий пін для фоторезистора
  #define LIGHT_THRESHOLD 512  // Поріг світла (0-1023)
#elif SENSOR_TYPE == 2
  #define DIGITAL_PIN D1       // Цифровий пін
#endif

// Timing
const unsigned long UPDATE_INTERVAL = 10000;  // Відправляти кожні 10 сек
const unsigned long WIFI_TIMEOUT = 10000;     // WiFi timeout

// ==================== ГЛОБАЛЬНІ ЗМІННІ ====================

unsigned long lastUpdate = 0;
bool lastPowerState = false;
bool firstRun = true;

WiFiClient wifiClient;

// ==================== ФУНКЦІЇ ====================

// Підключення до WiFi
bool connectToWiFi() {
  Serial.print("Підключення до WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - startTime > WIFI_TIMEOUT) {
      Serial.println("\nНе вдалось підключитись до WiFi!");
      return false;
    }
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi підключено!");
  Serial.print("IP адреса: ");
  Serial.println(WiFi.localIP());
  return true;
}

// Визначити чи є світло
bool checkPower() {
  #if SENSOR_TYPE == 1
    // Фоторезистор
    int lightLevel = analogRead(LDR_PIN);
    Serial.print("Рівень світла: ");
    Serial.println(lightLevel);
    return lightLevel > LIGHT_THRESHOLD;

  #elif SENSOR_TYPE == 2
    // Digital pin
    return digitalRead(DIGITAL_PIN) == HIGH;

  #else
    // WiFi only - якщо є WiFi, значить є світло
    return WiFi.status() == WL_CONNECTED;
  #endif
}

// Відправити дані на сервер
bool sendUpdate(bool hasPower) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Немає WiFi підключення");
    return false;
  }

  HTTPClient http;
  http.begin(wifiClient, SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  // Створити JSON
  StaticJsonDocument<200> doc;
  doc["hasPower"] = hasPower;
  doc["sensorId"] = SENSOR_ID;

  String jsonString;
  serializeJson(doc, jsonString);

  Serial.print("Відправка: ");
  Serial.println(jsonString);

  // Відправити POST запит
  int httpCode = http.POST(jsonString);

  if (httpCode > 0) {
    String response = http.getString();
    Serial.print("Відповідь сервера (");
    Serial.print(httpCode);
    Serial.print("): ");
    Serial.println(response);
    http.end();
    return httpCode == 200;
  } else {
    Serial.print("Помилка HTTP: ");
    Serial.println(http.errorToString(httpCode));
    http.end();
    return false;
  }
}

// ==================== SETUP ====================

void setup() {
  Serial.begin(115200);
  delay(100);

  Serial.println("\n\n");
  Serial.println("================================");
  Serial.println("💡 LightTracker Sensor v1.0");
  Serial.println("================================");

  #if SENSOR_TYPE == 1
    Serial.println("Режим: Фоторезистор (LDR)");
    pinMode(LDR_PIN, INPUT);
  #elif SENSOR_TYPE == 2
    Serial.println("Режим: Digital Pin");
    pinMode(DIGITAL_PIN, INPUT);
  #else
    Serial.println("Режим: WiFi Only");
  #endif

  // Підключення до WiFi
  if (!connectToWiFi()) {
    Serial.println("ПОМИЛКА: Не вдалось підключитись до WiFi!");
    Serial.println("Перевір SSID та пароль");
    // Перезавантаження через 5 сек
    delay(5000);
    ESP.restart();
  }

  Serial.println("Датчик готовий до роботи!");
  Serial.println("================================\n");
}

// ==================== LOOP ====================

void loop() {
  unsigned long currentTime = millis();

  // Перевірка WiFi підключення
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi втрачено, переподключення...");
    connectToWiFi();
  }

  // Перевірка чи настав час оновлення
  if (currentTime - lastUpdate >= UPDATE_INTERVAL || firstRun) {
    lastUpdate = currentTime;

    // Перевірити стан
    bool currentPowerState = checkPower();

    // Вивести статус
    Serial.print("Стан світла: ");
    Serial.println(currentPowerState ? "Є ✓" : "Немає ✗");

    // Відправити оновлення якщо змінився стан або перший запуск
    if (currentPowerState != lastPowerState || firstRun) {
      Serial.println("⚡ Стан змінився! Відправка даних...");

      if (sendUpdate(currentPowerState)) {
        Serial.println("✓ Дані успішно відправлені");
        lastPowerState = currentPowerState;
        firstRun = false;
      } else {
        Serial.println("✗ Помилка відправки даних");
      }
    } else {
      // Періодичне оновлення навіть якщо стан не змінився
      sendUpdate(currentPowerState);
    }

    Serial.println();
  }

  // Невелика затримка
  delay(100);
}
