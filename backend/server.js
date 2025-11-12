require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Логування
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// API Endpoints
// ============================================

// Отримати поточний статус
app.get('/api/status', (req, res) => {
  try {
    const sensorId = req.query.sensor || 'main';
    const status = db.getCurrentStatus(sensorId);

    if (!status) {
      return res.json({
        hasPower: null,
        lastUpdate: null,
        message: 'Немає даних від датчика'
      });
    }

    res.json({
      hasPower: status.has_power === 1,
      lastUpdate: status.timestamp,
      sensorId: sensorId
    });
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ error: 'Помилка отримання статусу' });
  }
});

// Оновлення від датчика
app.post('/api/sensor/update', (req, res) => {
  try {
    const { hasPower, sensorId = 'main' } = req.body;

    if (typeof hasPower !== 'boolean') {
      return res.status(400).json({ error: 'hasPower має бути boolean' });
    }

    // Отримати попередній статус
    const prevStatus = db.getCurrentStatus(sensorId);
    const prevHasPower = prevStatus ? prevStatus.has_power === 1 : null;

    // Додати новий статус
    db.addStatus(hasPower, sensorId);

    // Якщо статус змінився, оновити відключення
    if (prevHasPower !== null && prevHasPower !== hasPower) {
      if (!hasPower) {
        // Світло вимкнулось - почати відключення
        db.startOutage(sensorId);
        console.log(`⚠️ Світло вимкнулось (sensor: ${sensorId})`);
      } else {
        // Світло увімкнулось - завершити відключення
        db.endOutage(sensorId);
        console.log(`✅ Світло увімкнулось (sensor: ${sensorId})`);
      }
    }

    res.json({
      success: true,
      hasPower,
      changed: prevHasPower !== null && prevHasPower !== hasPower,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating sensor:', error);
    res.status(500).json({ error: 'Помилка оновлення датчика' });
  }
});

// Отримати історію статусів
app.get('/api/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const sensorId = req.query.sensor || 'main';
    const history = db.getStatusHistory(limit, sensorId);
    res.json(history);
  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({ error: 'Помилка отримання історії' });
  }
});

// Отримати історію відключень
app.get('/api/outages', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const sensorId = req.query.sensor || 'main';
    const outages = db.getOutages(limit, sensorId);
    res.json(outages);
  } catch (error) {
    console.error('Error getting outages:', error);
    res.status(500).json({ error: 'Помилка отримання відключень' });
  }
});

// Отримати статистику
app.get('/api/stats', (req, res) => {
  try {
    const sensorId = req.query.sensor || 'main';
    const stats = db.getStats(sensorId);
    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Помилка отримання статистики' });
  }
});

// Отримати статистику по днях
app.get('/api/stats/daily', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const sensorId = req.query.sensor || 'main';
    const dailyStats = db.getDailyStats(days, sensorId);
    res.json(dailyStats);
  } catch (error) {
    console.error('Error getting daily stats:', error);
    res.status(500).json({ error: 'Помилка отримання денної статистики' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint не знайдено' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Внутрішня помилка сервера' });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log('');
  console.log('💡 LightTracker Server');
  console.log('='.repeat(50));
  console.log(`🚀 Сервер запущено на http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔌 API: http://localhost:${PORT}/api`);
  console.log('='.repeat(50));
  console.log('');
});

module.exports = app;
