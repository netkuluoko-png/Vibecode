// API Configuration
const API_BASE = window.location.origin;
const REFRESH_INTERVAL = 10000; // 10 секунд

// State
let refreshTimer = null;

// Utility Functions
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'щойно';
    if (minutes < 60) return `${minutes} хв тому`;
    if (hours < 24) return `${hours} год тому`;
    if (days < 7) return `${days} дн тому`;

    return date.toLocaleDateString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDuration(minutes) {
    if (!minutes) return '-';

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) return `${mins} хв`;
    if (mins === 0) return `${hours} год`;
    return `${hours} год ${mins} хв`;
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatFullDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// API Calls
async function fetchStatus() {
    try {
        const response = await fetch(`${API_BASE}/api/status`);
        const data = await response.json();
        updateStatusCard(data);
    } catch (error) {
        console.error('Error fetching status:', error);
        showError('Помилка підключення до сервера');
    }
}

async function fetchStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const data = await response.json();
        updateStats(data);
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

async function fetchOutages() {
    try {
        const response = await fetch(`${API_BASE}/api/outages?limit=20`);
        const data = await response.json();
        updateOutagesList(data);
    } catch (error) {
        console.error('Error fetching outages:', error);
    }
}

async function fetchDailyStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats/daily?days=30`);
        const data = await response.json();
        updateChart(data);
    } catch (error) {
        console.error('Error fetching daily stats:', error);
    }
}

// Update UI Functions
function updateStatusCard(data) {
    const card = document.getElementById('statusCard');
    const icon = document.getElementById('statusIcon');
    const title = document.getElementById('statusTitle');
    const subtitle = document.getElementById('statusSubtitle');
    const lastUpdate = document.getElementById('lastUpdate');

    if (data.hasPower === null) {
        card.className = 'card status-card';
        icon.textContent = '❓';
        title.textContent = 'Немає даних';
        subtitle.textContent = 'Очікування сигналу від датчика';
        lastUpdate.textContent = 'Останнє оновлення: -';
        return;
    }

    if (data.hasPower) {
        card.className = 'card status-card status-on';
        icon.textContent = '💡';
        title.textContent = 'Світло є!';
        subtitle.textContent = 'Все працює нормально';
    } else {
        card.className = 'card status-card status-off';
        icon.textContent = '🔌';
        title.textContent = 'Немає світла';
        subtitle.textContent = 'Відключення електроенергії';
    }

    lastUpdate.textContent = `Останнє оновлення: ${formatDate(data.lastUpdate)}`;
}

function updateStats(data) {
    document.getElementById('totalOutages').textContent = data.totalOutages || 0;
    document.getElementById('avgDuration').textContent = formatDuration(data.avgDurationMinutes);
    document.getElementById('todayOutages').textContent = data.todayOutages || 0;

    const totalHours = Math.round((data.totalMinutesWithoutPower || 0) / 60);
    document.getElementById('totalHours').textContent = `${totalHours} год`;

    // Update current outage alert
    const alert = document.getElementById('currentOutageAlert');
    const alertText = document.getElementById('currentOutageText');

    if (data.currentOutage) {
        const start = new Date(data.currentOutage.start_time);
        const now = new Date();
        const duration = Math.floor((now - start) / 60000);

        alert.style.display = 'flex';
        alertText.textContent = `Почалось о ${formatTime(data.currentOutage.start_time)} (${formatDuration(duration)})`;
    } else {
        alert.style.display = 'none';
    }
}

function updateOutagesList(outages) {
    const container = document.getElementById('outagesList');

    if (!outages || outages.length === 0) {
        container.innerHTML = '<div class="loading">Відключень поки не було 🎉</div>';
        return;
    }

    container.innerHTML = outages.map(outage => {
        const isOngoing = !outage.end_time;
        const itemClass = isOngoing ? 'outage-item outage-ongoing' : 'outage-item';

        let duration = '';
        if (isOngoing) {
            const start = new Date(outage.start_time);
            const now = new Date();
            const mins = Math.floor((now - start) / 60000);
            duration = `${formatDuration(mins)} (триває)`;
        } else {
            duration = formatDuration(outage.duration_minutes);
        }

        return `
            <div class="${itemClass}">
                <div class="outage-header">
                    <span class="outage-duration">${duration}</span>
                    <span class="outage-date">${formatDate(outage.start_time)}</span>
                </div>
                <div class="outage-time">
                    ${formatTime(outage.start_time)} - ${outage.end_time ? formatTime(outage.end_time) : 'зараз'}
                </div>
            </div>
        `;
    }).join('');
}

function updateChart(dailyStats) {
    const container = document.getElementById('chartContainer');

    if (!dailyStats || dailyStats.length === 0) {
        container.innerHTML = '<div class="loading">Немає даних для графіка</div>';
        return;
    }

    // Find max value for scaling
    const maxMinutes = Math.max(...dailyStats.map(d => d.total_minutes || 0));

    container.innerHTML = dailyStats.map(day => {
        const date = new Date(day.date);
        const label = date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
        const width = maxMinutes > 0 ? (day.total_minutes / maxMinutes * 100) : 0;
        const hours = Math.round(day.total_minutes / 60);
        const count = day.outages_count;

        return `
            <div class="chart-bar">
                <div class="chart-label">${label}</div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill" style="width: ${width}%">
                        ${width > 15 ? `${hours}г` : ''}
                    </div>
                </div>
                <div class="chart-value">${hours}г (${count}x)</div>
            </div>
        `;
    }).join('');
}

function showError(message) {
    const card = document.getElementById('statusCard');
    card.className = 'card status-card';
    document.getElementById('statusIcon').textContent = '⚠️';
    document.getElementById('statusTitle').textContent = 'Помилка';
    document.getElementById('statusSubtitle').textContent = message;
}

// Refresh Data
async function refreshData() {
    await Promise.all([
        fetchStatus(),
        fetchStats(),
        fetchOutages(),
        fetchDailyStats()
    ]);
}

// Initialize
async function init() {
    console.log('💡 LightTracker Dashboard ініціалізовано');

    // Initial load
    await refreshData();

    // Auto-refresh
    refreshTimer = setInterval(refreshData, REFRESH_INTERVAL);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (refreshTimer) {
        clearInterval(refreshTimer);
    }
});

// Start the app
init();
