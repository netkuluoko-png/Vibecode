require('dotenv').config();
const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());

// Логування
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// КОНФІГУРАЦІЯ ДЕТЕКЦІЇ
// ============================================

// Очікуваний інтервал heartbeat (секунди)
const EXPECTED_INTERVAL = 15;

// Буфер часу (tolerance) перед визначенням відключення
const TIMEOUT_BUFFER = 30; // 30 сек = 2 пропущених heartbeat

// Максимальний час "ручного перемикання" роутера
const MAX_MANUAL_RECONNECT_TIME = 180; // 3 хвилини

// Мінімальний час відключення щоб вважати його справжнім
const MIN_OUTAGE_TIME = 60; // 1 хвилина

// ============================================
// In-memory стан (можна замінити на Redis для production)
// ============================================

const routerState = new Map(); // router_id -> { lastHeartbeat, status }

// ============================================
// ENDPOINTS
// ============================================

/**
 * POST /heartbeat
 * Приймає heartbeat від роутера
 */
app.post('/heartbeat', (req, res) => {
  const { router_id = 'default', timestamp } = req.body;
  const now = Date.now();
  const routerTimestamp = timestamp ? timestamp * 1000 : now;

  console.log(`📡 Heartbeat from ${router_id}`);

  // Отримати попередній стан
  const prevState = routerState.get(router_id);

  // Записати новий heartbeat в БД
  db.addHeartbeat(router_id, routerTimestamp);

  // Якщо це перший heartbeat
  if (!prevState) {
    console.log(`✅ First heartbeat from ${router_id}`);
    routerState.set(router_id, {
      lastHeartbeat: now,
      status: 'online'
    });

    // Встановити початковий стан як "є світло"
    db.addStatus(router_id, true);

    return res.json({ status: 'ok', message: 'First heartbeat registered' });
  }

  // Розрахувати проміжок часу
  const gap = Math.floor((now - prevState.lastHeartbeat) / 1000); // секунди

  console.log(`⏱️  Gap: ${gap}s (expected: ${EXPECTED_INTERVAL}s)`);

  // Оновити стан
  routerState.set(router_id, {
    lastHeartbeat: now,
    status: 'online'
  });

  // Якщо проміжок великий - було відключення
  if (gap > EXPECTED_INTERVAL + TIMEOUT_BUFFER) {
    console.log(`⚠️  OUTAGE DETECTED! Gap: ${gap}s`);

    // Аналіз: це ручне перемикання чи справжнє відключення?
    const isManualReconnect = gap <= MAX_MANUAL_RECONNECT_TIME;

    if (isManualReconnect && gap >= MIN_OUTAGE_TIME) {
      console.log(`🔌 Manual reconnect detected (${gap}s) - possible power restored`);

      // Записати як "ручне перемикання" з міткою
      db.recordManualReconnect(router_id, gap);

      // Закрити попереднє відключення (якщо є)
      db.endOutage(router_id);

      // Записати що зараз є світло
      db.addStatus(router_id, true);

    } else if (gap >= MIN_OUTAGE_TIME) {
      console.log(`❌ Power outage confirmed (${gap}s)`);

      // Відключення почалось gap секунд тому
      const outageStartTime = new Date(prevState.lastHeartbeat + (EXPECTED_INTERVAL + TIMEOUT_BUFFER) * 1000);

      // Записати початок відключення
      db.startOutageAt(router_id, outageStartTime);

      // Записати статус "немає світла" в той час
      db.addStatusAt(router_id, false, outageStartTime);

      // Зараз світло повернулось
      db.addStatus(router_id, true);
      db.endOutage(router_id);
    }
  }

  res.json({ status: 'ok', gap, expected: EXPECTED_INTERVAL });
});

/**
 * GET /status/:router_id
 * Отримати поточний стан роутера
 */
app.get('/status/:router_id?', (req, res) => {
  const router_id = req.params.router_id || 'default';
  const state = routerState.get(router_id);

  if (!state) {
    return res.json({
      router_id,
      status: 'unknown',
      hasPower: null,
      message: 'No heartbeat received yet'
    });
  }

  const now = Date.now();
  const timeSinceLastHeartbeat = Math.floor((now - state.lastHeartbeat) / 1000);

  // Якщо давно не було heartbeat - можливо світла немає
  const hasPower = timeSinceLastHeartbeat <= (EXPECTED_INTERVAL + TIMEOUT_BUFFER);

  res.json({
    router_id,
    status: state.status,
    hasPower,
    lastHeartbeat: new Date(state.lastHeartbeat).toISOString(),
    timeSinceLastHeartbeat,
    isOnline: timeSinceLastHeartbeat <= EXPECTED_INTERVAL * 2
  });
});

/**
 * GET /stats/:router_id
 * Статистика
 */
app.get('/stats/:router_id?', (req, res) => {
  const router_id = req.params.router_id || 'default';
  const stats = db.getStats(router_id);
  const reconnectStats = db.getReconnectStats(router_id);

  res.json({
    router_id,
    outages: stats,
    reconnect: reconnectStats
  });
});

/**
 * GET /outages/:router_id
 * Історія відключень
 */
app.get('/outages/:router_id?', (req, res) => {
  const router_id = req.params.router_id || 'default';
  const limit = parseInt(req.query.limit) || 50;
  const outages = db.getOutages(router_id, limit);

  res.json(outages);
});

/**
 * GET /reconnects/:router_id
 * Історія ручних перемикань
 */
app.get('/reconnects/:router_id?', (req, res) => {
  const router_id = req.params.router_id || 'default';
  const limit = parseInt(req.query.limit) || 50;
  const reconnects = db.getReconnects(router_id, limit);

  res.json(reconnects);
});

/**
 * GET /stats/daily/:router_id
 * Денна статистика
 */
app.get('/stats/daily/:router_id?', (req, res) => {
  const router_id = req.params.router_id || 'default';
  const days = parseInt(req.query.days) || 30;
  const dailyStats = db.getDailyStats(router_id, days);

  res.json(dailyStats);
});

/**
 * GET /health
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    config: {
      expectedInterval: EXPECTED_INTERVAL,
      timeoutBuffer: TIMEOUT_BUFFER,
      maxManualReconnect: MAX_MANUAL_RECONNECT_TIME,
      minOutageTime: MIN_OUTAGE_TIME
    }
  });
});

// ============================================
// ФОНОВА ПЕРЕВІРКА (Watchdog)
// ============================================

/**
 * Кожні 30 секунд перевіряємо чи не втрачений зв'язок з роутером
 */
setInterval(() => {
  const now = Date.now();

  for (const [router_id, state] of routerState.entries()) {
    const timeSinceLastHeartbeat = Math.floor((now - state.lastHeartbeat) / 1000);

    // Якщо давно не було heartbeat і статус ще "online"
    if (timeSinceLastHeartbeat > EXPECTED_INTERVAL + TIMEOUT_BUFFER && state.status === 'online') {
      console.log(`⚠️  Watchdog: ${router_id} offline (${timeSinceLastHeartbeat}s without heartbeat)`);

      // Оновити стан
      state.status = 'offline';
      routerState.set(router_id, state);

      // Записати початок відключення
      const outageStartTime = new Date(state.lastHeartbeat + (EXPECTED_INTERVAL + TIMEOUT_BUFFER) * 1000);
      db.startOutageAt(router_id, outageStartTime);
      db.addStatusAt(router_id, false, outageStartTime);
    }
  }
}, 30000); // Кожні 30 сек

// ============================================
// Error handlers
// ============================================

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// ЗАПУСК СЕРВЕРА
// ============================================

app.listen(PORT, () => {
  console.log('');
  console.log('📡 LightTracker Heartbeat Server');
  console.log('='.repeat(50));
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(`🔗 Heartbeat endpoint: http://localhost:${PORT}/heartbeat`);
  console.log('');
  console.log('⚙️  Configuration:');
  console.log(`   Expected interval: ${EXPECTED_INTERVAL}s`);
  console.log(`   Timeout buffer: ${TIMEOUT_BUFFER}s`);
  console.log(`   Max manual reconnect: ${MAX_MANUAL_RECONNECT_TIME}s`);
  console.log(`   Min outage time: ${MIN_OUTAGE_TIME}s`);
  console.log('='.repeat(50));
  console.log('');
});

module.exports = app;
