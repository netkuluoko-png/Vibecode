#!/bin/sh

# ============================================
# LightTracker Router Heartbeat Script
# ============================================
# Цей скрипт відправляє сигнал на сервер кожні 15 секунд
# Коли роутер працює = є світло
# Коли сигнал зникає = світла немає
#
# УВАГА: Цей скрипт НЕ ЗМІНЮЄТЬСЯ після встановлення!
# Вся логіка обробки на стороні сервера.
# ============================================

# КОНФІГУРАЦІЯ - Змінити тільки це!
SERVER_URL="http://YOUR_SERVER_IP:4000/heartbeat"
ROUTER_ID="home_router"  # Унікальний ID роутера (якщо кілька локацій)

# Інтервал відправки (секунди)
INTERVAL=15

# ============================================
# НЕ ЗМІНЮВАТИ КОД НИЖЧЕ!
# ============================================

echo "LightTracker Heartbeat Script v1.0"
echo "Server: $SERVER_URL"
echo "Router ID: $ROUTER_ID"
echo "Interval: $INTERVAL seconds"
echo "Starting heartbeat loop..."

# Головний цикл
while true; do
    # Поточний час (Unix timestamp)
    TIMESTAMP=$(date +%s)

    # Відправка HTTP POST запиту
    # Використовуємо wget (є на більшості роутерів) або curl
    if command -v curl > /dev/null; then
        # Якщо є curl
        curl -X POST \
             -H "Content-Type: application/json" \
             -d "{\"router_id\":\"$ROUTER_ID\",\"timestamp\":$TIMESTAMP}" \
             --connect-timeout 5 \
             --max-time 10 \
             "$SERVER_URL" > /dev/null 2>&1

        if [ $? -eq 0 ]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Heartbeat sent (curl) ✓"
        else
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Failed to send heartbeat (curl) ✗"
        fi

    elif command -v wget > /dev/null; then
        # Якщо є wget (більш поширений на роутерах)
        wget -O- \
             --header="Content-Type: application/json" \
             --post-data="{\"router_id\":\"$ROUTER_ID\",\"timestamp\":$TIMESTAMP}" \
             --timeout=10 \
             --tries=1 \
             "$SERVER_URL" > /dev/null 2>&1

        if [ $? -eq 0 ]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Heartbeat sent (wget) ✓"
        else
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Failed to send heartbeat (wget) ✗"
        fi
    else
        echo "ERROR: Neither curl nor wget found!"
        exit 1
    fi

    # Чекаємо до наступного циклу
    sleep $INTERVAL
done
