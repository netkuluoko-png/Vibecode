const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/lights.db');
const db = new Database(dbPath);

// Створення таблиць
db.exec(`
  CREATE TABLE IF NOT EXISTS status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    has_power INTEGER NOT NULL,
    sensor_id TEXT DEFAULT 'main'
  );

  CREATE TABLE IF NOT EXISTS outages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    duration_minutes INTEGER,
    sensor_id TEXT DEFAULT 'main'
  );

  CREATE INDEX IF NOT EXISTS idx_status_timestamp ON status(timestamp);
  CREATE INDEX IF NOT EXISTS idx_outages_start ON outages(start_time);
`);

// Функції для роботи з даними

// Додати новий статус
function addStatus(hasPower, sensorId = 'main') {
  const stmt = db.prepare('INSERT INTO status (has_power, sensor_id) VALUES (?, ?)');
  return stmt.run(hasPower ? 1 : 0, sensorId);
}

// Отримати поточний статус
function getCurrentStatus(sensorId = 'main') {
  const stmt = db.prepare(`
    SELECT has_power, timestamp
    FROM status
    WHERE sensor_id = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `);
  return stmt.get(sensorId);
}

// Почати нове відключення
function startOutage(sensorId = 'main') {
  const stmt = db.prepare('INSERT INTO outages (start_time, sensor_id) VALUES (datetime("now"), ?)');
  return stmt.run(sensorId);
}

// Завершити відключення
function endOutage(sensorId = 'main') {
  const stmt = db.prepare(`
    UPDATE outages
    SET end_time = datetime("now"),
        duration_minutes = CAST((julianday(datetime("now")) - julianday(start_time)) * 24 * 60 AS INTEGER)
    WHERE sensor_id = ? AND end_time IS NULL
  `);
  return stmt.run(sensorId);
}

// Отримати історію статусів
function getStatusHistory(limit = 100, sensorId = 'main') {
  const stmt = db.prepare(`
    SELECT * FROM status
    WHERE sensor_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(sensorId, limit);
}

// Отримати історію відключень
function getOutages(limit = 50, sensorId = 'main') {
  const stmt = db.prepare(`
    SELECT * FROM outages
    WHERE sensor_id = ?
    ORDER BY start_time DESC
    LIMIT ?
  `);
  return stmt.all(sensorId, limit);
}

// Статистика
function getStats(sensorId = 'main') {
  const totalOutages = db.prepare(`
    SELECT COUNT(*) as count FROM outages WHERE sensor_id = ?
  `).get(sensorId);

  const avgDuration = db.prepare(`
    SELECT AVG(duration_minutes) as avg FROM outages
    WHERE sensor_id = ? AND duration_minutes IS NOT NULL
  `).get(sensorId);

  const longestOutage = db.prepare(`
    SELECT MAX(duration_minutes) as max FROM outages
    WHERE sensor_id = ? AND duration_minutes IS NOT NULL
  `).get(sensorId);

  const totalMinutesWithoutPower = db.prepare(`
    SELECT SUM(duration_minutes) as total FROM outages
    WHERE sensor_id = ? AND duration_minutes IS NOT NULL
  `).get(sensorId);

  const todayOutages = db.prepare(`
    SELECT COUNT(*) as count FROM outages
    WHERE sensor_id = ? AND date(start_time) = date('now')
  `).get(sensorId);

  const currentOutage = db.prepare(`
    SELECT * FROM outages
    WHERE sensor_id = ? AND end_time IS NULL
    ORDER BY start_time DESC
    LIMIT 1
  `).get(sensorId);

  return {
    totalOutages: totalOutages.count,
    avgDurationMinutes: avgDuration.avg ? Math.round(avgDuration.avg) : 0,
    longestOutageMinutes: longestOutage.max || 0,
    totalMinutesWithoutPower: totalMinutesWithoutPower.total || 0,
    todayOutages: todayOutages.count,
    currentOutage: currentOutage || null
  };
}

// Статистика по днях (останні 30 днів)
function getDailyStats(days = 30, sensorId = 'main') {
  const stmt = db.prepare(`
    SELECT
      date(start_time) as date,
      COUNT(*) as outages_count,
      SUM(duration_minutes) as total_minutes,
      AVG(duration_minutes) as avg_minutes
    FROM outages
    WHERE sensor_id = ?
      AND date(start_time) >= date('now', '-' || ? || ' days')
      AND duration_minutes IS NOT NULL
    GROUP BY date(start_time)
    ORDER BY date DESC
  `);
  return stmt.all(sensorId, days);
}

module.exports = {
  db,
  addStatus,
  getCurrentStatus,
  startOutage,
  endOutage,
  getStatusHistory,
  getOutages,
  getStats,
  getDailyStats
};
