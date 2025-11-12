# ⚡ Робота з роутером на UPS/Акумуляторі

## Проблема

Якщо твій роутер працює від UPS (безперебійник) або від акумулятора через інвертор, то WiFi підключення буде працювати **навіть коли світла немає**!

ESP8266 в режимі "WiFi only" не зможе визначити відключення світла, бо WiFi є завжди.

---

## ✅ Рішення

### Варіант 1: Подвійний ESP8266 (Рекомендований)

Використовуй **два ESP8266**:

**ESP #1 - Контрольний (на UPS)**
- Підключений до роутера з UPS
- Завжди має живлення та WiFi
- Отримує дані від ESP #2

**ESP #2 - Датчик (БЕЗ UPS)**
- Підключений до звичайної розетки
- Коли вимикається світло - вимикається ESP
- Коли ESP не відправляє дані = немає світла

**Як працює:**

```
          Роутер (UPS) ←→ ESP #1 (контрольний, на UPS) ←→ Сервер
                              ↑
                              | HTTP запити
                              |
                         ESP #2 (датчик, БЕЗ UPS)
```

**Алгоритм:**
1. ESP #2 кожні 10 сек відправляє "я живий" на ESP #1
2. ESP #1 перевіряє: якщо від ESP #2 немає сигналу > 30 сек = світла немає
3. ESP #1 відправляє статус на сервер

**Код для ESP #2 (датчик):**
```cpp
// Просто відправляє heartbeat
void loop() {
  http.POST("{\"alive\": true}");
  delay(10000);
}
```

**Код для ESP #1 (контрольний):**
```cpp
unsigned long lastHeartbeat = 0;

void checkPower() {
  unsigned long now = millis();
  bool hasPower = (now - lastHeartbeat) < 30000; // 30 сек timeout
  sendToServer(hasPower);
}
```

**Вартість:** ~$5 (один додатковий ESP8266)

---

### Варіант 2: ESP + Фоторезистор (Простіший)

Навіть якщо роутер на UPS, використовуй **фоторезистор**!

ESP підключений до роутера (на UPS), але визначає світло за **освітленістю в кімнаті**.

**Переваги:**
- ✅ Один ESP8266
- ✅ Працює навіть якщо роутер на UPS
- ✅ Дешево

**Недоліки:**
- ❌ ESP теж має бути на UPS (або окремому powerbank)
- ❌ Реагує на денне світло (можна вирішити програмно)

**Налаштування:**

```cpp
#define SENSOR_TYPE 1  // Фоторезистор
const char* SERVER_URL = "http://...";  // Через UPS роутер

// Якщо ESP на powerbank - він працює навіть без світла
// Але фоторезистор визначить що темно
```

**Рішення проблеми денного світла:**

```cpp
// Визначаємо чи зараз ніч за годинником
#include <NTPClient.h>
#include <WiFiUdp.h>

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 2*3600, 60000); // UTC+2

bool isNightTime() {
  timeClient.update();
  int hour = timeClient.getHours();
  return (hour >= 22 || hour < 6); // 22:00 - 06:00
}

bool checkPower() {
  int lightLevel = analogRead(LDR_PIN);

  if (isNightTime()) {
    // Вночі: темно = немає світла
    return lightLevel > LIGHT_THRESHOLD;
  } else {
    // Вдень: ігноруємо денне світло, дивимось тільки на лампу
    return lightLevel > LIGHT_THRESHOLD_DAY; // Вищий поріг
  }
}
```

---

### Варіант 3: Датчик 220V (Найточніший)

ESP визначає наявність напруги 220V **безпосередньо** через оптопару.

**Як працює:**
- ESP підключений до роутера на UPS
- ESP живиться від powerbank або окремого UPS
- Датчик підключений до розетки **без UPS**
- Коли 220V зникає → оптопара не світиться → ESP знає що світла немає

**Схема:**

```
220V (без UPS) → [Оптопара] → GPIO (ESP на UPS)
```

**Детальніше:** див. [HARDWARE.md](HARDWARE.md) варіант 3

**Переваги:**
- ✅ 100% точність
- ✅ Не залежить від освітлення
- ✅ ESP працює навіть без світла (на UPS/powerbank)

**Недоліки:**
- ❌ Складніше
- ❌ Робота з 220V (небезпечно!)

---

### Варіант 4: Комбінований (ESP + Raspberry Pi)

**Raspberry Pi на UPS:**
- Запускає backend сервер
- Підключений до роутера на UPS
- Завжди працює

**ESP без UPS:**
- Підключений до звичайної розетки
- Коли світло вимикається → ESP вимикається
- Коли ESP не надсилає heartbeat → Pi розуміє що світла немає

**Переваги:**
- ✅ Сервер працює навіть без світла (можеш дивитись статистику)
- ✅ Простий ESP датчик
- ✅ Історія зберігається

**Недоліки:**
- ❌ Треба Raspberry Pi (~$40)

---

## 🎯 Що обрати?

### Якщо роутер НА UPS:

| Варіант | Складність | Вартість | Точність |
|---------|-----------|----------|----------|
| Подвійний ESP | 🟢 Низька | $5 | ⭐⭐⭐⭐⭐ |
| ESP + Фоторезистор + Powerbank | 🟡 Середня | $8 | ⭐⭐⭐⭐ |
| Датчик 220V + ESP на UPS | 🔴 Висока | $7 | ⭐⭐⭐⭐⭐ |
| RPi + ESP | 🟡 Середня | $45 | ⭐⭐⭐⭐⭐ |

### Якщо роутер БЕЗ UPS:

Просто використовуй **WiFi only режим** (Варіант 2 з HARDWARE.md) - найпростіше рішення!

---

## Приклад коду: Подвійний ESP

### ESP #2 - Датчик (відправляє heartbeat)

```cpp
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>

const char* WIFI_SSID = "TviyWiFi";
const char* WIFI_PASSWORD = "TviyParol";
const char* CONTROLLER_IP = "192.168.1.100";  // IP ESP #1

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  Serial.println("Connected!");
}

void loop() {
  HTTPClient http;
  WiFiClient client;

  http.begin(client, String("http://") + CONTROLLER_IP + "/heartbeat");
  http.POST("");
  http.end();

  Serial.println("Heartbeat sent");
  delay(10000);  // Кожні 10 сек
}
```

### ESP #1 - Контрольний (на UPS, відправляє на сервер)

```cpp
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPClient.h>

const char* SERVER_URL = "http://YOUR_SERVER:3000/api/sensor/update";
unsigned long lastHeartbeat = 0;
bool lastPowerState = false;

ESP8266WebServer server(80);

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) delay(500);

  // Приймаємо heartbeat від ESP #2
  server.on("/heartbeat", HTTP_POST, [](){
    lastHeartbeat = millis();
    server.send(200, "text/plain", "OK");
    Serial.println("Heartbeat received!");
  });

  server.begin();
  Serial.println("Controller ready!");
}

void loop() {
  server.handleClient();

  // Перевірка кожні 30 сек
  static unsigned long lastCheck = 0;
  if (millis() - lastCheck > 30000) {
    lastCheck = millis();
    checkAndSendStatus();
  }
}

void checkAndSendStatus() {
  unsigned long now = millis();
  bool hasPower = (now - lastHeartbeat) < 30000;  // Якщо heartbeat < 30 сек тому

  if (hasPower != lastPowerState) {
    Serial.println(hasPower ? "Power ON" : "Power OFF");

    // Відправити на сервер
    HTTPClient http;
    WiFiClient client;
    http.begin(client, SERVER_URL);
    http.addHeader("Content-Type", "application/json");
    String json = String("{\"hasPower\":") + (hasPower ? "true" : "false") + "}";
    http.POST(json);
    http.end();

    lastPowerState = hasPower;
  }
}
```

---

## Висновок

Якщо роутер на UPS:
1. **Найпростіше:** Подвійний ESP (~$5)
2. **Найточніше:** Датчик 220V + ESP на powerbank (~$7)
3. **Найкраще для досвідчених:** Raspberry Pi + ESP (~$45)

Якщо роутер БЕЗ UPS:
1. **WiFi only режим** - безкоштовно, просто працює!

---

**Питання? Потрібна допомога з кодом?** Відкрий issue! 🚀
