# 🏗️ LightTracker V2 - Нова Архітектура

## Концепція

Версія 2.0 повністю переосмислює підхід до моніторингу світла:

### Проблема яку вирішує V2:

Користувач зазначив важливий момент: **роутер працює від акумулятора через інвертор**.

Це означає:
- 💡 Коли світло вимикається → роутер працює далі (від акумулятора)
- 🔌 Коли світло вмикається → треба фізично перемкнути роутер (вийняти/вставити штепсель)
- ⏱️ Час "ручного перемикання" **стабільний** (30-90 сек)
- ⚡ Час відключення **непередбачуваний** (години)

### Розв'язок:

**Скрипт на роутері** відправляє heartbeat кожні 15 секунд.

**Розумний сервер** аналізує проміжки між сигналами:
- Проміжок 30-180 сек = "ручне перемикання" = **світло повернулось**
- Проміжок > 180 сек = **відключення світла**

---

## 🎯 Архітектура

```
┌─────────────────┐
│   Роутер (UPS)  │  Heartbeat кожні 15 сек
│  OpenWRT/Padavan│
└────────┬────────┘
         │ HTTP POST /heartbeat
         ↓
┌─────────────────────────────┐
│  Heartbeat Server (Port 4000)│  Аналіз сигналів, детекція відключень
│  - Приймає heartbeat         │
│  - Визначає проміжки         │
│  - Калібрує час перемикання  │
│  - Зберігає в БД             │
└────────┬────────────────────┘
         │ REST API
         ↓
┌─────────────────────────────┐
│  Dashboard Server (Port 3000)│  Web інтерфейс
│  - Проксі до Heartbeat       │
│  - Сервує Frontend           │
│  - Адаптує API               │
└────────┬────────────────────┘
         │
         ↓
┌─────────────────────────────┐
│   Web Dashboard (Browser)    │  Відображення на iPhone/Desktop
│  - Статистика                │
│  - Графіки                   │
│  - Історія відключень        │
└─────────────────────────────┘
```

---

## 📁 Структура проекту V2

```
Vibecode/
├── router-script/           # 🔌 Скрипт для роутера (НЕЗМІННИЙ)
│   ├── heartbeat.sh         # Shell скрипт для OpenWRT/Padavan
│   └── README.md            # Інструкції встановлення
│
├── heartbeat-server/        # 📡 Сервер обробки heartbeat
│   ├── server.js            # Express сервер (Port 4000)
│   ├── db.js                # SQLite база даних
│   ├── package.json
│   └── .env.example
│
├── dashboard-server/        # 💡 Веб-інтерфейс
│   ├── server.js            # Dashboard сервер (Port 3000)
│   ├── package.json
│   ├── .env.example
│   └── public/              # Frontend (HTML/CSS/JS)
│       ├── index.html
│       ├── style.css
│       └── app.js
│
├── docs/                    # 📚 Документація
│   ├── SETUP_V2.md          # Інструкції налаштування V2
│   └── MIGRATION.md         # Міграція з V1 на V2
│
└── data/                    # 💾 Бази даних (автоматично створюється)
    └── heartbeat.db
```

---

## 🔄 Потік даних

### 1. Роутер → Heartbeat Server

**Кожні 15 секунд:**
```bash
# Роутер відправляє
POST /heartbeat
{
  "router_id": "home_router",
  "timestamp": 1710512400
}
```

### 2. Heartbeat Server: Аналіз

```javascript
// Розрахунок проміжку
gap = currentTime - lastHeartbeat

if (gap > 45 секунд) {
  if (gap <= 180 секунд) {
    // Ручне перемикання роутера
    recordManualReconnect()
    endPowerOutage()
  } else {
    // Справжнє відключення
    startPowerOutage()
  }
}
```

### 3. Dashboard Server ← Heartbeat Server

**Проксі API:**
- `GET /api/status` - Поточний стан
- `GET /api/stats` - Статистика
- `GET /api/outages` - Історія відключень
- `GET /api/reconnects` - Історія ручних перемикань

### 4. Frontend ← Dashboard Server

JavaScript автоматично оновлює інтерфейс кожні 10 секунд.

---

## 🎨 Ключові особливості V2

### ✅ Переваги нової архітектури:

1. **Розділення відповідальності**
   - Роутер: тільки heartbeat (простий, незмінний)
   - Heartbeat Server: логіка детекції
   - Dashboard Server: відображення даних

2. **Розумна детекція**
   - Відрізняє "ручне перемикання" від "відключення"
   - Калібрує час перемикання
   - Автоматична адаптація

3. **Легке розгортання**
   - Скрипт на роутері не потребує оновлень
   - Сервери можна оновлювати незалежно
   - Можна запустити на окремих машинах

4. **Масштабованість**
   - Підтримка кількох роутерів
   - Кожен роутер має свій `router_id`
   - Централізований моніторинг

5. **Реальні умови експлуатації**
   - Працює з роутером на UPS
   - Враховує людський фактор (ручне перемикання)
   - Точна детекція відключень

---

## 🚀 Швидкий старт

### 1. Встановити Heartbeat Server

```bash
cd heartbeat-server
npm install
cp .env.example .env
npm start
```

Сервер запуститься на **Port 4000**

### 2. Встановити Dashboard Server

```bash
cd dashboard-server
npm install
cp .env.example .env
# Змінити HEARTBEAT_SERVER=http://localhost:4000 (якщо треба)
npm start
```

Dashboard доступний на **http://localhost:3000**

### 3. Встановити скрипт на роутер

```bash
# Підключитись до роутера
ssh root@192.168.1.1

# Створити скрипт
mkdir -p /root/lighttracker
vi /root/lighttracker/heartbeat.sh
# [вставити вміст з router-script/heartbeat.sh]

# Налаштувати
vi /root/lighttracker/heartbeat.sh
# Змінити SERVER_URL на IP твого Heartbeat Server

# Запустити
chmod +x /root/lighttracker/heartbeat.sh
/root/lighttracker/heartbeat.sh &
```

Детально: [router-script/README.md](router-script/README.md)

---

## 📊 Що записується

### Таблиці бази даних:

1. **heartbeats** - Всі сигнали від роутера
   ```sql
   id, router_id, timestamp, router_timestamp
   ```

2. **status** - Зміни стану (є/немає світла)
   ```sql
   id, router_id, timestamp, has_power
   ```

3. **outages** - Відключення
   ```sql
   id, router_id, start_time, end_time, duration_minutes
   ```

4. **manual_reconnects** - Ручні перемикання (для калібрування)
   ```sql
   id, router_id, timestamp, gap_seconds
   ```

---

## ⚙️ Налаштування

### Heartbeat Server (.env)

```env
PORT=4000
EXPECTED_INTERVAL=15        # Інтервал heartbeat (сек)
TIMEOUT_BUFFER=30           # Буфер перед визначенням відключення
MAX_MANUAL_RECONNECT_TIME=180  # Макс час ручного перемикання (сек)
MIN_OUTAGE_TIME=60          # Мін час щоб вважати відключенням
```

### Dashboard Server (.env)

```env
PORT=3000
HEARTBEAT_SERVER=http://localhost:4000
```

### Router Script

```bash
SERVER_URL="http://192.168.1.100:4000/heartbeat"
ROUTER_ID="home_router"
INTERVAL=15
```

---

## 🔍 Моніторинг

### Перевірка стану:

```bash
# Heartbeat Server
curl http://localhost:4000/health

# Dashboard Server
curl http://localhost:3000/api/health

# Поточний стан роутера
curl http://localhost:4000/status/home_router
```

### Логи:

```bash
# Heartbeat Server
cd heartbeat-server
npm start
# Побачиш:
# 📡 Heartbeat from home_router
# ⏱️  Gap: 15s (expected: 15s)

# Роутер
ssh root@192.168.1.1
tail -f /root/lighttracker/heartbeat.log
```

---

## 🎯 Випадки використання

### Сценарій 1: Нормальна робота

```
15s → Heartbeat ✓
15s → Heartbeat ✓
15s → Heartbeat ✓
```

Стан: **Є світло** ✅

### Сценарій 2: Відключення світла

```
15s → Heartbeat ✓
15s → Heartbeat ✓
--- Світло вимкнулось ---
[Роутер працює від акумулятора]
15s → Heartbeat ✓
15s → Heartbeat ✓
15s → Heartbeat ✓
... (години) ...
```

Стан: **Є світло** (роутер на UPS) ✅

### Сценарій 3: Повернення світла + ручне перемикання

```
[Світло повернулось]
--- Перемикання роутера (вийняти/вставити штепсель) ---
60s пройшло без heartbeat
→ Heartbeat ✓
```

Детекція:
- Gap = 60 сек
- 60 < 180 сек → **Ручне перемикання**
- Записує: `manual_reconnect` з gap=60
- Визначає: **Світло повернулось** ✅

### Сценарій 4: Довге відключення

```
--- Світло вимкнулось ---
[Акумулятор на роутері розрядився через 6 годин]
--- Роутер вимкнувся ---
... (годин без heartbeat) ...
--- Світло повернулось + перемикання ---
→ Heartbeat ✓
```

Детекція:
- Gap = 6+ годин
- Gap > 180 сек → **Справжнє відключення**
- Записує: `outage` з тривалістю
- Світло повернулось ✅

---

## 🔧 Troubleshooting

### Heartbeat не приходить

1. Перевірити чи працює скрипт на роутері:
   ```bash
   ps | grep heartbeat
   ```

2. Перевірити доступність сервера з роутера:
   ```bash
   wget -O- http://192.168.1.100:4000/health
   ```

3. Перевірити firewall

### Неправильна детекція

Калібрувати параметри в `.env`:
- `TIMEOUT_BUFFER` - збільшити якщо false positives
- `MAX_MANUAL_RECONNECT_TIME` - збільшити якщо довго перемикаєш
- `MIN_OUTAGE_TIME` - зменшити для швидшої детекції

### Dashboard не показує дані

Перевірити connection між серверами:
```bash
curl http://localhost:4000/stats/default
```

---

## 📈 Roadmap V2

- [ ] Push notifications (Telegram bot)
- [ ] Multi-location support (кілька квартир)
- [ ] Machine learning для предикції
- [ ] Експорт даних (CSV, JSON)
- [ ] Інтеграція з Home Assistant
- [ ] Mobile app (React Native)

---

**V2 готова до prod використання!** 🚀

Питання? → Відкрий issue на GitHub
