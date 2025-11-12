require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const HEARTBEAT_SERVER = process.env.HEARTBEAT_SERVER || 'http://localhost:4000';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Логування
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// PROXY API до Heartbeat Server
// ============================================

/**
 * GET /api/status
 * Проксі до heartbeat сервера (адаптований для сумісності з фронтендом)
 */
app.get('/api/status', async (req, res) => {
  try {
    const router_id = req.query.router || 'default';
    const response = await axios.get(`${HEARTBEAT_SERVER}/status/${router_id}`);

    // Адаптувати формат для сумісності зі старим фронтендом
    const data = response.data;
    res.json({
      hasPower: data.hasPower,
      lastUpdate: data.lastHeartbeat,
      sensorId: data.router_id,
      isOnline: data.isOnline
    });
  } catch (error) {
    console.error('Error fetching status:', error.message);
    res.status(500).json({
      error: 'Не вдалось отримати статус',
      details: error.message
    });
  }
});

/**
 * GET /api/stats
 * Проксі статистики (адаптований)
 */
app.get('/api/stats', async (req, res) => {
  try {
    const router_id = req.query.router || 'default';
    const response = await axios.get(`${HEARTBEAT_SERVER}/stats/${router_id}`);

    // Адаптувати формат: { outages: {...}, reconnect: {...} } -> старий формат
    const data = response.data;
    res.json({
      ...data.outages,  // Розгорнути outages stats
      reconnectStats: data.reconnect  // Додати reconnect stats окремо
    });
  } catch (error) {
    console.error('Error fetching stats:', error.message);
    res.status(500).json({
      error: 'Не вдалось отримати статистику',
      details: error.message
    });
  }
});

/**
 * GET /api/outages
 * Проксі відключень
 */
app.get('/api/outages', async (req, res) => {
  try {
    const router_id = req.query.router || 'default';
    const limit = req.query.limit || 50;
    const response = await axios.get(`${HEARTBEAT_SERVER}/outages/${router_id}?limit=${limit}`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching outages:', error.message);
    res.status(500).json({
      error: 'Не вдалось отримати відключення',
      details: error.message
    });
  }
});

/**
 * GET /api/reconnects
 * Історія ручних перемикань
 */
app.get('/api/reconnects', async (req, res) => {
  try {
    const router_id = req.query.router || 'default';
    const limit = req.query.limit || 20;
    const response = await axios.get(`${HEARTBEAT_SERVER}/reconnects/${router_id}?limit=${limit}`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching reconnects:', error.message);
    res.status(500).json({
      error: 'Не вдалось отримати перемикання',
      details: error.message
    });
  }
});

/**
 * GET /api/stats/daily
 * Денна статистика для графіків
 */
app.get('/api/stats/daily', async (req, res) => {
  try {
    const router_id = req.query.router || 'default';
    const days = req.query.days || 30;

    const response = await axios.get(`${HEARTBEAT_SERVER}/stats/daily/${router_id}?days=${days}`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching daily stats:', error.message);
    res.status(500).json({
      error: 'Не вдалось отримати денну статистику',
      details: error.message
    });
  }
});

/**
 * GET /api/health
 * Health check (перевірка обох серверів)
 */
app.get('/api/health', async (req, res) => {
  try {
    const heartbeatHealth = await axios.get(`${HEARTBEAT_SERVER}/health`);

    res.json({
      dashboard: {
        status: 'ok',
        uptime: process.uptime()
      },
      heartbeat: heartbeatHealth.data
    });
  } catch (error) {
    res.status(500).json({
      dashboard: {
        status: 'ok',
        uptime: process.uptime()
      },
      heartbeat: {
        status: 'error',
        message: error.message
      }
    });
  }
});

// ============================================
// SERVE FRONTEND
// ============================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// ERROR HANDLERS
// ============================================

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint не знайдено' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Внутрішня помилка сервера' });
});

// ============================================
// ЗАПУСК СЕРВЕРА
// ============================================

app.listen(PORT, () => {
  console.log('');
  console.log('💡 LightTracker Dashboard Server');
  console.log('='.repeat(50));
  console.log(`🚀 Dashboard: http://localhost:${PORT}`);
  console.log(`🔗 Heartbeat Server: ${HEARTBEAT_SERVER}`);
  console.log('='.repeat(50));
  console.log('');
});

module.exports = app;
