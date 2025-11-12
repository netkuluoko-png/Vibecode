# 🚀 Налаштування LightTracker

## Швидкий старт (3 хвилини)

### 1️⃣ Встановлення Backend

```bash
# Клонуй репозиторій
git clone https://github.com/YOUR_USERNAME/Vibecode.git
cd Vibecode

# Встанови залежності
cd backend
npm install

# Створи .env файл
cp .env.example .env

# Запусти сервер
npm start
```

Сервер запуститься на `http://localhost:3000`

### 2️⃣ Відкрий Dashboard

Відкрий в браузері: `http://localhost:3000`

Або просто відкрий файл `frontend/index.html`

### 3️⃣ Налаштуй датчик

Див. [HARDWARE.md](HARDWARE.md) для детальних інструкцій

---

## Детальна інструкція

### Backend сервер

#### Встановлення Node.js

**Windows:**
1. Завантаж з https://nodejs.org
2. Встанови LTS версію
3. Перевір: `node --version`

**macOS:**
```bash
brew install node
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Запуск сервера

```bash
cd backend
npm install
npm start
```

**Для розробки (з auto-reload):**
```bash
npm run dev
```

#### Конфігурація (.env)

Створи файл `backend/.env`:

```env
PORT=3000
DB_PATH=../data/lights.db
```

---

### Доступ з інтернету (для перегляду на iPhone не вдома)

#### Варіант 1: ngrok (Найпростіший)

1. Зареєструйся на https://ngrok.com (безкоштовно)
2. Завантаж ngrok
3. Запусти:

```bash
ngrok http 3000
```

4. Отримаєш URL типу: `https://abc123.ngrok.io`
5. Відкривай цей URL на iPhone!

**Плюси:**
- ✅ Безкоштовно
- ✅ Миттєве налаштування
- ✅ HTTPS автоматично

**Мінуси:**
- ❌ URL змінюється при кожному запуску (на безкоштовному плані)
- ❌ Треба тримати ngrok запущеним

#### Варіант 2: Port Forwarding на роутері

1. Знайди локальний IP сервера: `ipconfig` (Windows) або `ifconfig` (Linux/Mac)
2. Зайди в налаштування роутера (зазвичай 192.168.1.1)
3. Знайди "Port Forwarding" або "Virtual Server"
4. Додай правило:
   - External Port: 3000
   - Internal IP: [IP твого комп'ютера]
   - Internal Port: 3000
   - Protocol: TCP

5. Знайди свій зовнішній IP: https://whatismyipaddress.com
6. Доступ: `http://[ТвійIP]:3000`

**Плюси:**
- ✅ Безкоштовно
- ✅ Постійний доступ

**Мінуси:**
- ❌ Складніше налаштувати
- ❌ IP може змінюватись (треба динамічний DNS)
- ❌ Проблеми безпеки (треба додати автентифікацію)

#### Варіант 3: Deploy в хмару

**Railway.app (Рекомендовано):**

1. Зареєструйся на https://railway.app
2. Створи новий проект
3. Підключи GitHub репозиторій
4. Railway автоматично задеплоїть
5. Отримаєш постійний URL

**Переваги:**
- ✅ Безкоштовно до 500 годин/місяць
- ✅ Автодеплой з GitHub
- ✅ HTTPS автоматично
- ✅ База даних зберігається

**Інші варіанти:**
- Render.com
- Fly.io
- Heroku (платно)
- DigitalOcean ($5/місяць)

---

### Налаштування датчика ESP8266

#### 1. Встановлення Arduino IDE

1. Завантаж з https://www.arduino.cc/en/software
2. Встанови для своєї ОС
3. Запусти Arduino IDE

#### 2. Додавання ESP8266

1. **File → Preferences**
2. В "Additional Board Manager URLs" додай:
   ```
   http://arduino.esp8266.com/stable/package_esp8266com_index.json
   ```
3. **Tools → Board → Boards Manager**
4. Шукай "ESP8266"
5. Встанови "esp8266 by ESP8266 Community"

#### 3. Встановлення бібліотек

**ArduinoJson:**
- Tools → Manage Libraries
- Шукай "ArduinoJson"
- Встанови by Benoit Blanchon

**ESP8266HTTPClient** - вже включений в ESP8266 core

#### 4. Завантаження коду

1. Відкрий `sensor/light_sensor.ino`
2. Змінити налаштування:

```cpp
// WiFi
const char* WIFI_SSID = "TviyWiFi";
const char* WIFI_PASSWORD = "TviyParol123";

// Server (якщо локально)
const char* SERVER_URL = "http://192.168.1.100:3000/api/sensor/update";

// Або якщо використовуєш ngrok
const char* SERVER_URL = "https://abc123.ngrok.io/api/sensor/update";

// Режим датчика
#define SENSOR_TYPE 1  // 1=Фоторезистор, 2=Digital, 3=WiFi only
```

3. **Tools → Board** → обери свою плату (NodeMCU 1.0 або Wemos D1 Mini)
4. **Tools → Port** → обери COM порт
5. Натисни **Upload** (стрілка →)

#### 5. Перевірка роботи

1. **Tools → Serial Monitor**
2. Встанови швидкість **115200**
3. Побачиш:

```
💡 LightTracker Sensor v1.0
================================
Режим: Фоторезистор (LDR)
Підключення до WiFi: MyWiFi
...
WiFi підключено!
IP адреса: 192.168.1.105
Датчик готовий до роботи!
================================

Рівень світла: 743
Стан світла: Є ✓
✓ Дані успішно відправлені
```

---

## iPhone налаштування

### Додати на головний екран (як додаток)

1. Відкрий dashboard в **Safari** (не Chrome!)
2. Натисни кнопку "Поділитися" (квадрат зі стрілкою)
3. Прокрути вниз → "На головний екран"
4. Назви "LightTracker" → Додати

Тепер маєш іконку як звичайний додаток! 📱

### Автоматичне оновлення

Dashboard автоматично оновлюється кожні 10 секунд.

### Темна тема

Dashboard завжди у темній темі для економії батареї OLED дисплея.

---

## API документація

### Endpoints

#### GET `/api/status`

Поточний стан світла

**Response:**
```json
{
  "hasPower": true,
  "lastUpdate": "2024-03-15T10:30:00Z",
  "sensorId": "main"
}
```

#### POST `/api/sensor/update`

Оновлення від датчика

**Request:**
```json
{
  "hasPower": true,
  "sensorId": "main"
}
```

**Response:**
```json
{
  "success": true,
  "hasPower": true,
  "changed": true,
  "timestamp": "2024-03-15T10:30:00Z"
}
```

#### GET `/api/stats`

Статистика

**Response:**
```json
{
  "totalOutages": 15,
  "avgDurationMinutes": 120,
  "longestOutageMinutes": 360,
  "totalMinutesWithoutPower": 1800,
  "todayOutages": 3,
  "currentOutage": null
}
```

#### GET `/api/outages?limit=20`

Історія відключень

#### GET `/api/stats/daily?days=30`

Денна статистика

#### GET `/api/history?limit=100`

Історія статусів

---

## Troubleshooting

### Backend не запускається

**Помилка:** `Cannot find module 'express'`
```bash
cd backend
npm install
```

**Помилка:** `EADDRINUSE: address already in use`
- Порт 3000 зайнятий
- Зміни PORT в .env
- Або зупини інший процес на порті 3000

### Frontend не бачить backend

**Помилка в консолі:** `Failed to fetch`

1. Перевір чи backend запущений: http://localhost:3000/api/health
2. Перевір CORS налаштування
3. Відкривай frontend через той же домен що й backend

### Датчик не відправляє дані

1. Перевір Serial Monitor - чи є помилки
2. Перевір WiFi підключення
3. Перевір SERVER_URL - чи правильний IP
4. Ping сервер з комп'ютера: `ping 192.168.1.100`
5. Спробуй відкрити в браузері: `http://SERVER_IP:3000/api/health`

### Дані не зберігаються

- Перевір чи створена папка `data/`
- Перевір права на запис

---

## Оновлення

### Backend
```bash
cd backend
git pull
npm install
npm start
```

### Датчик
1. Завантаж новий код з GitHub
2. Відкрий в Arduino IDE
3. Upload на плату

---

## Додатково

### Запуск при старті системи (Linux)

Створи systemd service:

```bash
sudo nano /etc/systemd/system/lighttracker.service
```

```ini
[Unit]
Description=LightTracker Backend
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/Vibecode/backend
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable lighttracker
sudo systemctl start lighttracker
```

### Backup бази даних

```bash
cp data/lights.db data/lights.db.backup
```

Або налаштуй автоматичний backup в cron.

---

**Готово! Тепер можеш моніторити світло з будь-якої точки світу! 🌍💡**
