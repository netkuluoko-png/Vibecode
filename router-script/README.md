# 🔌 Встановлення скрипта на роутері

## Підтримувані роутери

✅ **OpenWRT** - найкраща підтримка
✅ **Padavan** (Asus роутери з кастомною прошивкою)
✅ **DD-WRT**
✅ **Merlin** (Asus)
✅ **Tomato**
⚠️ **MikroTik RouterOS** - потрібен інший скрипт
❌ Стандартна прошивка провайдера - зазвичай не підтримує

---

## Швидка перевірка

### Чи підтримує мій роутер?

1. **SSH доступ** - чи можна підключитись через SSH?
2. **wget або curl** - чи є ці команди?
3. **cron або init script** - чи можна запускати скрипти автоматично?

**Як перевірити:**
```bash
# Підключись до роутера через SSH
ssh root@192.168.1.1

# Перевір наявність wget
which wget

# Перевір наявність curl
which curl

# Якщо хоча б одна команда є - ОК!
```

---

## Встановлення на OpenWRT

### Крок 1: Підключення до роутера

```bash
ssh root@192.168.1.1
# Введи пароль
```

### Крок 2: Створення скрипта

```bash
# Створи директорію
mkdir -p /root/lighttracker

# Створи файл скрипта
vi /root/lighttracker/heartbeat.sh
```

Скопіюй вміст файлу `heartbeat.sh` та вклей в редактор.

**Або через SCP:**
```bash
# На своєму комп'ютері
scp heartbeat.sh root@192.168.1.1:/root/lighttracker/
```

### Крок 3: Налаштування

Відредагуй скрипт:
```bash
vi /root/lighttracker/heartbeat.sh
```

Зміни:
```bash
SERVER_URL="http://192.168.1.100:4000/heartbeat"  # IP твого сервера
ROUTER_ID="home_router"  # Або "kitchen", "office" якщо кілька роутерів
```

### Крок 4: Зробити виконуваним

```bash
chmod +x /root/lighttracker/heartbeat.sh
```

### Крок 5: Тестування

```bash
# Запусти вручну
/root/lighttracker/heartbeat.sh

# Побачиш:
# LightTracker Heartbeat Script v1.0
# Server: http://192.168.1.100:4000/heartbeat
# Router ID: home_router
# Interval: 15 seconds
# Starting heartbeat loop...
# [2024-03-15 10:30:00] Heartbeat sent (wget) ✓
```

Натисни `Ctrl+C` щоб зупинити.

### Крок 6: Автозапуск через cron

**Варіант A: Через Web UI**
1. Зайди в LuCI (web інтерфейс OpenWRT)
2. System → Startup → Local Startup
3. Додай перед `exit 0`:
```bash
/root/lighttracker/heartbeat.sh &
```

**Варіант B: Через SSH**
```bash
vi /etc/rc.local
```

Додай перед `exit 0`:
```bash
# LightTracker heartbeat
/root/lighttracker/heartbeat.sh > /dev/null 2>&1 &
```

### Крок 7: Перезавантаження

```bash
reboot
```

Після перезавантаження скрипт запуститься автоматично.

### Перевірка чи працює:

```bash
# Перевір чи процес запущений
ps | grep heartbeat

# Повинен вивести щось типу:
# 1234 root     /bin/sh /root/lighttracker/heartbeat.sh
```

---

## Встановлення на Padavan

### Крок 1: Активувати SSH

1. Зайди в веб-інтерфейс роутера
2. Advanced Settings → Administration → System
3. Enable SSH: **Yes**
4. SSH Port: **22** (або змінити)
5. Apply

### Крок 2: Підключення

```bash
ssh admin@192.168.1.1
# Введи пароль (той же що й для веб-інтерфейсу)
```

### Крок 3: Створення скрипта

```bash
cd /etc/storage
mkdir -p lighttracker
cd lighttracker

# Створи файл
cat > heartbeat.sh << 'EOF'
[вставити вміст heartbeat.sh]
EOF

chmod +x heartbeat.sh
```

### Крок 4: Автозапуск

Padavan використовує `/etc/storage/started_script.sh`:

```bash
vi /etc/storage/started_script.sh
```

Додай:
```bash
# LightTracker heartbeat
/etc/storage/lighttracker/heartbeat.sh &
```

Збережи зміни:
```bash
mtd_storage.sh save
```

### Крок 5: Перезапуск

```bash
reboot
```

---

## Встановлення на DD-WRT

### Через Web UI

1. Administration → Commands
2. Вставити скрипт:
```bash
#!/bin/sh
# [вставити вміст heartbeat.sh]
```
3. Save Startup

### Через SSH

```bash
ssh root@192.168.1.1

# Створити скрипт
nvram set rc_startup="/tmp/lighttracker.sh &"
nvram commit
```

---

## Встановлення на MikroTik RouterOS

MikroTik використовує власну мову скриптів:

```routeros
/system scheduler add \
    name=lighttracker-heartbeat \
    interval=15s \
    on-event="/tool fetch url=\"http://192.168.1.100:4000/heartbeat\" \
        mode=http \
        http-method=post \
        http-header-field=\"Content-Type: application/json\" \
        http-data=\"{\\\"router_id\\\":\\\"home_router\\\",\\\"timestamp\\\":\\\"\$[/system clock get time]\\\"}\" \
        keep-result=no"
```

---

## Troubleshooting

### Скрипт не відправляє дані

**Перевірка 1: Чи працює wget/curl?**
```bash
wget -O- http://google.com
# Або
curl http://google.com
```

**Перевірка 2: Чи доступний сервер з роутера?**
```bash
ping 192.168.1.100
```

**Перевірка 3: Чи відкритий порт на сервері?**
```bash
telnet 192.168.1.100 4000
```

### Скрипт не запускається автоматично

**Перевірка 1: Чи виконуваний?**
```bash
ls -l /root/lighttracker/heartbeat.sh
# Повинно бути: -rwxr-xr-x (з 'x')
```

**Перевірка 2: Чи в rc.local?**
```bash
cat /etc/rc.local | grep heartbeat
```

**Перевірка 3: Логи**
```bash
logread | grep heartbeat
```

### Занадто багато запитів / високе навантаження

Змінити `INTERVAL` в скрипті на більше значення:
```bash
INTERVAL=30  # 30 секунд замість 15
```

---

## Видалення

### OpenWRT / Padavan
```bash
# Видалити скрипт
rm -rf /root/lighttracker

# Видалити з автозапуску
vi /etc/rc.local
# Видалити рядок з heartbeat.sh

# Перезапустити
reboot
```

---

## Альтернатива: Без SSH (для stock прошивки)

Якщо роутер **не підтримує SSH**, можна використовувати:

### Варіант 1: Окремий пристрій
- Raspberry Pi Zero W ($10)
- Orange Pi Zero ($15)
- Старий телефон на Android (Termux)

Запустити той же скрипт на Linux.

### Варіант 2: IFTTT / Webhooks
Використати автоматизацію IFTTT для періодичних запитів (обмеження: мін. інтервал 15 хв).

---

## Безпека

### Рекомендації:

1. **Змінити SSH порт** (не 22)
2. **Використовувати ключі замість паролів** для SSH
3. **Firewall:** дозволити heartbeat тільки до твого сервера
4. **HTTPS:** якщо сервер в інтернеті, використовувати HTTPS

### Firewall правило (OpenWRT):
```bash
iptables -A OUTPUT -p tcp -d 192.168.1.100 --dport 4000 -j ACCEPT
```

---

**Готово! Роутер буде відправляти heartbeat кожні 15 секунд!** 🚀

Наступний крок: налаштувати Heartbeat Server для прийому цих сигналів.
