const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Переконатись що директорія існує
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'heartbeat.db');
const db = new Database(dbPath);

// Створення таблиць
db.exec(`
  -- Heartbeat логи (всі сигнали від роутера)
  CREATE TABLE IF NOT EXISTS heartbeats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    router_id TEXT NOT NULL DEFAULT 'default',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    router_timestamp DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Статуси (є світло / немає світла)
  CREATE TABLE IF NOT EXISTS status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    router_id TEXT NOT NULL DEFAULT 'default',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    has_power INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Відключення
  CREATE TABLE IF NOT EXISTS outages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    router_id TEXT NOT NULL DEFAULT 'default',
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    duration_minutes INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Ручні перемикання роутера (для калібрування)
  CREATE TABLE IF NOT EXISTS manual_reconnects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    router_id TEXT NOT NULL DEFAULT 'default',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    gap_seconds INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_heartbeats_router ON heartbeats(router_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_status_router ON status(router_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_outages_router ON outages(router_id, start_time);
  CREATE INDEX IF NOT EXISTS idx_reconnects_router ON manual_reconnects(router_id, timestamp);
`);

// ============================================
// ФУНКЦІЇ ДЛЯ HEARTBEAT
// ============================================

/**
 * Додати heartbeat від роутера
 */
function addHeartbeat(routerId, routerTimestamp = null) {
  const stmt = db.prepare(`
    INSERT INTO heartbeats (router_id, router_timestamp)
    VALUES (?, ?)
  `);

  const ts = routerTimestamp ? new Date(routerTimestamp).toISOString() : null;
  return stmt.run(routerId, ts);
}

/**
 * Отримати останній heartbeat
 */
function getLastHeartbeat(routerId) {
  const stmt = db.prepare(`
    SELECT * FROM heartbeats
    WHERE router_id = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `);
  return stmt.get(routerId);
}

/**
 * Отримати історію heartbeats
 */
function getHeartbeats(routerId, limit = 100) {
  const stmt = db.prepare(`
    SELECT * FROM heartbeats
    WHERE router_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(routerId, limit);
}

// ============================================
// ФУНКЦІЇ ДЛЯ СТАТУСУ
// ============================================

/**
 * Додати новий статус (є світло / немає)
 */
function addStatus(routerId, hasPower) {
  const stmt = db.prepare(`
    INSERT INTO status (router_id, has_power)
    VALUES (?, ?)
  `);
  return stmt.run(routerId, hasPower ? 1 : 0);
}

/**
 * Додати статус з конкретним часом
 */
function addStatusAt(routerId, hasPower, timestamp) {
  const stmt = db.prepare(`
    INSERT INTO status (router_id, has_power, timestamp)
    VALUES (?, ?, ?)
  `);
  return stmt.run(routerId, hasPower ? 1 : 0, timestamp.toISOString());
}

/**
 * Отримати поточний статус
 */
function getCurrentStatus(routerId) {
  const stmt = db.prepare(`
    SELECT * FROM status
    WHERE router_id = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `);
  return stmt.get(routerId);
}

// ============================================
// ФУНКЦІЇ ДЛЯ ВІДКЛЮЧЕНЬ
// ============================================

/**
 * Почати нове відключення
 */
function startOutage(routerId) {
  const stmt = db.prepare(`
    INSERT INTO outages (router_id, start_time)
    VALUES (?, datetime('now'))
  `);
  return stmt.run(routerId);
}

/**
 * Почати відключення з конкретним часом
 */
function startOutageAt(routerId, startTime) {
  const stmt = db.prepare(`
    INSERT INTO outages (router_id, start_time)
    VALUES (?, ?)
  `);
  return stmt.run(routerId, startTime.toISOString());
}

/**
 * Завершити поточне відключення
 */
function endOutage(routerId) {
  const stmt = db.prepare(`
    UPDATE outages
    SET end_time = datetime('now'),
        duration_minutes = CAST((julianday(datetime('now')) - julianday(start_time)) * 24 * 60 AS INTEGER)
    WHERE router_id = ? AND end_time IS NULL
  `);
  return stmt.run(routerId);
}

/**
 * Отримати історію відключень
 */
function getOutages(routerId, limit = 50) {
  const stmt = db.prepare(`
    SELECT * FROM outages
    WHERE router_id = ?
    ORDER BY start_time DESC
    LIMIT ?
  `);
  return stmt.all(routerId, limit);
}

/**
 * Статистика відключень
 */
function getStats(routerId) {
  const totalOutages = db.prepare(`
    SELECT COUNT(*) as count FROM outages WHERE router_id = ?
  `).get(routerId);

  const avgDuration = db.prepare(`
    SELECT AVG(duration_minutes) as avg FROM outages
    WHERE router_id = ? AND duration_minutes IS NOT NULL
  `).get(routerId);

  const longestOutage = db.prepare(`
    SELECT MAX(duration_minutes) as max FROM outages
    WHERE router_id = ? AND duration_minutes IS NOT NULL
  `).get(routerId);

  const totalMinutesWithoutPower = db.prepare(`
    SELECT SUM(duration_minutes) as total FROM outages
    WHERE router_id = ? AND duration_minutes IS NOT NULL
  `).get(routerId);

  const todayOutages = db.prepare(`
    SELECT COUNT(*) as count FROM outages
    WHERE router_id = ? AND date(start_time) = date('now')
  `).get(routerId);

  const currentOutage = db.prepare(`
    SELECT * FROM outages
    WHERE router_id = ? AND end_time IS NULL
    ORDER BY start_time DESC
    LIMIT 1
  `).get(routerId);

  return {
    totalOutages: totalOutages.count,
    avgDurationMinutes: avgDuration.avg ? Math.round(avgDuration.avg) : 0,
    longestOutageMinutes: longestOutage.max || 0,
    totalMinutesWithoutPower: totalMinutesWithoutPower.total || 0,
    todayOutages: todayOutages.count,
    currentOutage: currentOutage || null
  };
}

// ============================================
// ФУНКЦІЇ ДЛЯ РУЧНИХ ПЕРЕМИКАНЬ
// ============================================

/**
 * Записати ручне перемикання роутера
 */
function recordManualReconnect(routerId, gapSeconds) {
  const stmt = db.prepare(`
    INSERT INTO manual_reconnects (router_id, gap_seconds)
    VALUES (?, ?)
  `);
  return stmt.run(routerId, gapSeconds);
}

/**
 * Отримати історію перемикань
 */
function getReconnects(routerId, limit = 50) {
  const stmt = db.prepare(`
    SELECT * FROM manual_reconnects
    WHERE router_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(routerId, limit);
}

/**
 * Статистика ручних перемикань (для калібрування)
 */
function getReconnectStats(routerId) {
  const total = db.prepare(`
    SELECT COUNT(*) as count FROM manual_reconnects WHERE router_id = ?
  `).get(routerId);

  const avg = db.prepare(`
    SELECT AVG(gap_seconds) as avg FROM manual_reconnects WHERE router_id = ?
  `).get(routerId);

  const min = db.prepare(`
    SELECT MIN(gap_seconds) as min FROM manual_reconnects WHERE router_id = ?
  `).get(routerId);

  const max = db.prepare(`
    SELECT MAX(gap_seconds) as max FROM manual_reconnects WHERE router_id = ?
  `).get(routerId);

  return {
    totalReconnects: total.count,
    avgReconnectTime: avg.avg ? Math.round(avg.avg) : 0,
    minReconnectTime: min.min || 0,
    maxReconnectTime: max.max || 0
  };
}

// ============================================
// СТАТИСТИКА ПО ДНЯХ
// ============================================

function getDailyStats(routerId, days = 30) {
  const stmt = db.prepare(`
    SELECT
      date(start_time) as date,
      COUNT(*) as outages_count,
      SUM(duration_minutes) as total_minutes,
      AVG(duration_minutes) as avg_minutes
    FROM outages
    WHERE router_id = ?
      AND date(start_time) >= date('now', '-' || ? || ' days')
      AND duration_minutes IS NOT NULL
    GROUP BY date(start_time)
    ORDER BY date DESC
  `);
  return stmt.all(routerId, days);
}

module.exports = {
  db,
  addHeartbeat,
  getLastHeartbeat,
  getHeartbeats,
  addStatus,
  addStatusAt,
  getCurrentStatus,
  startOutage,
  startOutageAt,
  endOutage,
  getOutages,
  getStats,
  recordManualReconnect,
  getReconnects,
  getReconnectStats,
  getDailyStats
};
