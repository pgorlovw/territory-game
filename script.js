// ============================================================
// 1. БАЗОВЫЕ НАСТРОЙКИ
// ============================================================

const API_BASE = 'https://ten-carpets-hunt.loca.lt/api';  // ← при публикации замени на https://твой-сервер.onrender.com/api

let currentUser = null;
let currentGameMode = null;
let duelData = null;
let map, myPolyline, myRoute = [], totalDistance = 0, isTracking = false, watchId = null;
let territoryPolygons = [];
let territoryBuffer = null;
let gameTimerInterval = null;
let duelTimerInterval = null;
let duelSearchInterval = null;
let isSearching = false;

// ============================================================
// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ РАБОТЫ С СЕРВЕРОМ
// ============================================================

async function apiRequest(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Ошибка сервера');
    }
    return response.json();
}

// ============================================================
// 3. РЕГИСТРАЦИЯ И ВХОД
// ============================================================

async function register() {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value.trim();
    if (!username || !password) { alert('Заполни все поля!'); return; }
    if (password.length < 8) { alert('Пароль не менее 8 символов!'); return; }
    try {
        const data = await apiRequest('/register', 'POST', { username, password });
        alert(data.message);
        showLoginForm();
    } catch (error) {
        alert(error.message);
    }
}

async function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    if (!username || !password) { alert('Заполни все поля!'); return; }
    try {
        const data = await apiRequest('/login', 'POST', { username, password });
        currentUser = data.user;
        await setOnlineStatus(true);
        alert(`Добро пожаловать, ${username}!`);
        showMainMenu();
    } catch (error) {
        alert(error.message);
    }
}

async function logout() {
    if (currentUser) {
        await setOnlineStatus(false);
    }
    currentUser = null;
    showLoginForm();
}

// ============================================================
// 4. ОНЛАЙН-СТАТУС
// ============================================================

async function setOnlineStatus(isOnline) {
    // await setOnlineStatus(true);
    if (!currentUser) return;
    try {
        await apiRequest('/logout', 'POST', { username: currentUser.username, isOnline });
    } catch (e) { console.warn('Не удалось обновить статус', e); }
}

// ============================================================
// 5. ОБНОВЛЕНИЕ ДАННЫХ ПОЛЬЗОВАТЕЛЯ
// ============================================================

async function saveUserData() {
    if (!currentUser) return;
    try {
        const data = await apiRequest('/update_user', 'POST', {
            username: currentUser.username,
            totalDistance: currentUser.totalDistance,
            territories: currentUser.territories,
            colorLine: currentUser.colorLine,
            colorTerritory: currentUser.colorTerritory,
            wins: currentUser.wins || 0,
            losses: currentUser.losses || 0
        });
        currentUser = data.user;
    } catch (e) { console.warn('Не удалось сохранить данные', e); }
}

async function saveColors() {
    const line = document.getElementById('color-line').value;
    const territory = document.getElementById('color-territory').value;
    currentUser.colorLine = line;
    currentUser.colorTerritory = territory;
    await saveUserData();
    alert('Цвета сохранены!');
}

// ============================================================
// 6. ОТОБРАЖЕНИЕ ЭКРАНОВ
// ============================================================

function showLoginForm() {
    console.trace('showLoginForm вызвана');
    document.getElementById('app').innerHTML = `
        <div class="auth-container">
            <h2>🔐 Вход</h2>
            <input id="login-username" placeholder="Никнейм">
            <input id="login-password" type="password" placeholder="Пароль (мин. 8 символов)">
            <button onclick="login()">Войти</button>
            <div class="link">Нет аккаунта? <a onclick="showRegisterForm()">Зарегистрироваться</a></div>
        </div>
    `;
}

function showRegisterForm() {
    document.getElementById('app').innerHTML = `
        <div class="auth-container">
            <h2>📝 Регистрация</h2>
            <input id="register-username" placeholder="Никнейм">
            <input id="register-password" type="password" placeholder="Пароль (мин. 8 символов)">
            <button onclick="register()">Зарегистрироваться</button>
            <div class="link">Уже есть аккаунт? <a onclick="showLoginForm()">Войти</a></div>
        </div>
    `;
}

function showMainMenu() {
    const user = currentUser;
    document.getElementById('app').innerHTML = `
        <div class="menu-container" style="position:relative;">
            <button class="credits-btn" onclick="showCredits()">📜 Credits</button>
            <h2>🏠 Главное меню</h2>
            <p>Привет, <strong>${user.username}</strong>!</p>
            <div style="margin: 15px 0;">
                <label>Цвет линии: </label>
                <input type="color" id="color-line" value="${user.colorLine || '#e94560'}">
                <label style="margin-left: 20px;">Цвет территории: </label>
                <input type="color" id="color-territory" value="${user.colorTerritory || '#00ff88'}">
                <button onclick="saveColors()" style="margin-top:10px; background:#0f3460; padding:8px 20px; border:none; border-radius:20px; color:white; cursor:pointer;">Сохранить</button>
            </div>
            <button class="menu-btn" onclick="startFreeGame()">🎮 Играть</button>
            <button class="menu-btn" onclick="showDuelMenu()">⚔️ Дуэль</button>
            <button class="menu-btn" onclick="showLeaderboard()">🏆 Лидерборд</button>
            <button class="menu-btn" onclick="alert('sorry for this bug but i will fix it soon and for now you cant leave your account')"" style="background:#555;">🚪 Выйти</button>
        </div>
    `;
}

// ============================================================
// 7. ЛИДЕРБОРД
// ============================================================

async function showLeaderboard() {
    try {
        const users = await apiRequest('/users');
        let html = `
            <div class="menu-container" style="width: 500px;">
                <h2>🏆 Лидерборд</h2>
                <div class="leaderboard">
                    <table>
                        <tr><th>Игрок</th><th>Победы</th><th>Поражения</th><th>Статус</th></tr>
        `;
        users.sort((a,b) => (b.wins || 0) - (a.wins || 0));
        users.forEach(u => {
            const status = u.isOnline ? '<span class="online">Онлайн</span>' : '<span class="offline">Офлайн</span>';
            html += `<tr><td>${u.username}</td><td>${u.wins || 0}</td><td>${u.losses || 0}</td><td>${status}</td></tr>`;
        });
        html += `
                    </table>
                </div>
                <button class="menu-btn" onclick="showMainMenu()" style="background:#555;">Назад</button>
            </div>
        `;
        document.getElementById('app').innerHTML = html;
    } catch (e) {
        alert('Не удалось загрузить лидерборд');
    }
}

// ============================================================
// 8. ДУЭЛИ (поиск соперника, меню)
// ============================================================

function showDuelMenu() {
    document.getElementById('app').innerHTML = `
        <div class="menu-container">
            <h2>⚔️ Дуэль</h2>
            <p>Выберите время и найдите соперника</p>
            <select id="duel-time-select" style="width:100%; padding:12px; margin:8px 0; border-radius:8px; background:#0f3460; color:white; border:none;">
                <option value="1">1 минута</option>
                <option value="5" selected>5 минут</option>
                <option value="10">10 минут</option>
                <option value="15">15 минут</option>
                <option value="20">20 минут</option>
                <option value="25">25 минут</option>
                <option value="30">30 минут</option>
                <option value="60">60 минут</option>
                <option value="120">2 часа</option>
            </select>
            <button class="menu-btn" onclick="startDuelSearch()">🔍 Найти соперника</button>
            <button class="menu-btn" onclick="cancelDuelSearch()" id="cancel-search-btn" style="display:none; background:#e67e22;">❌ Отменить поиск</button>
            <button class="menu-btn" onclick="showMainMenu()" style="background:#555;">Назад</button>
            <div id="search-status" style="margin-top:10px; color:#f1c40f;"></div>
            <div id="online-players" style="margin-top:15px; background:#0f3460; padding:10px; border-radius:8px; max-height:150px; overflow-y:auto;">
                <h4>Онлайн</h4>
                <div id="online-list"></div>
            </div>
        </div>
    `;
    if (duelSearchInterval) clearInterval(duelSearchInterval);
    duelSearchInterval = setInterval(updateOnlineList, 3000);
    updateOnlineList();
}

async function updateOnlineList() {
    try {
        const users = await apiRequest('/users');
        const online = users.filter(u => u.isOnline && u.username !== currentUser.username);
        const listDiv = document.getElementById('online-list');
        if (!listDiv) return;
        if (online.length === 0) {
            listDiv.innerHTML = 'Нет других онлайн-игроков';
        } else {
            listDiv.innerHTML = online.map(u => `<div>${u.username} ${u.searching ? '(ищет дуэль)' : ''}</div>`).join('');
        }
    } catch (e) {}
}

async function startDuelSearch() {
    if (isSearching) return;
    const time = parseInt(document.getElementById('duel-time-select').value);
    // Обновляем статус поиска на сервере
    try {
        await apiRequest('/update_user', 'POST', {
            username: currentUser.username,
            searching: time
        });
        currentUser.searching = time;
        isSearching = true;
        document.getElementById('cancel-search-btn').style.display = 'inline-block';
        document.getElementById('search-status').textContent = 'Поиск соперника...';
        if (duelSearchInterval) clearInterval(duelSearchInterval);
        duelSearchInterval = setInterval(checkDuelMatch, 3000);
        checkDuelMatch();
    } catch (e) {
        alert('Не удалось начать поиск');
    }
}

async function checkDuelMatch() {
    try {
        const users = await apiRequest('/users');
        const opponent = users.find(u => 
            u.username !== currentUser.username && 
            u.isOnline && 
            u.searching === currentUser.searching
        );
        if (opponent) {
            // Нашли соперника, начинаем дуэль
            clearInterval(duelSearchInterval);
            isSearching = false;
            // Сбрасываем поиск у обоих на сервере
            await apiRequest('/update_user', 'POST', { username: currentUser.username, searching: null });
            await apiRequest('/update_user', 'POST', { username: opponent.username, searching: null });
            currentUser.searching = null;
            // Создаём дуэль (данные сохраняются в activeDuel у обоих)
            const duelId = Date.now() + '_' + currentUser.username;
            const duelDataObj = {
                id: duelId,
                player1: currentUser.username,
                player2: opponent.username,
                time: currentUser.searching * 60, // секунды
                startTime: Date.now(),
                territories1: 0,
                territories2: 0,
                finished: false,
                winner: null
            };
            // Сохраняем дуэль в обоих пользователях
            await apiRequest('/update_user', 'POST', { username: currentUser.username, activeDuel: duelDataObj });
            await apiRequest('/update_user', 'POST', { username: opponent.username, activeDuel: duelDataObj });
            // Переходим в игру
            currentGameMode = 'duel';
            duelData = { opponent: opponent.username, time: duelDataObj.time, startTime: Date.now(), myScore: 0, opponentScore: 0 };
            startGame('duel');
            alert(`Дуэль с ${opponent.username} начинается!`);
        }
    } catch (e) {}
}

function cancelDuelSearch() {
    if (duelSearchInterval) clearInterval(duelSearchInterval);
    isSearching = false;
    apiRequest('/update_user', 'POST', { username: currentUser.username, searching: null });
    currentUser.searching = null;
    document.getElementById('cancel-search-btn').style.display = 'none';
    document.getElementById('search-status').textContent = 'Поиск отменён';
    setTimeout(() => showDuelMenu(), 2000);
}

// ============================================================
// 9. ИГРОВОЙ ПРОЦЕСС
// ============================================================

function startFreeGame() {
    currentGameMode = 'free';
    duelData = null;
    startGame('free');
}

function startGame(mode) {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    if (duelTimerInterval) clearInterval(duelTimerInterval);

    const app = document.getElementById('app');
    app.innerHTML = `
        <div id="map"></div>
        <div id="game-ui">
            <div class="stat">🏃 Пройдено: <span id="distance-display">0</span> м</div>
            <div class="stat">🏆 Захвачено территорий: <span id="territory-count">${currentUser.territories ? currentUser.territories.length : 0}</span></div>
            <div class="stat">📏 Всего км: <span id="total-km">${(currentUser.totalDistance/1000).toFixed(2)}</span> км</div>
            ${mode === 'duel' ? `<div id="duel-info"><div class="timer" id="duel-timer">--:--</div><div>Соперник: <span id="opponent-name">${duelData.opponent}</span> | Захвачено: <span id="opponent-score">0</span></div></div>` : ''}
        </div>
        <div id="controls">
            <button id="start-btn" onclick="startTracking()">▶ Старт</button>
            <button id="stop-btn" onclick="stopTracking()" disabled>⏹ Стоп</button>
            ${mode === 'free' ? `<button onclick="finishGame()" style="background:#555;">🏁 Завершить</button>` : ''}
        </div>
        <button id="logout-btn" onclick="exitGame()">🚪 Выйти</button>
        ${mode === 'duel' ? `<button id="logout-btn" onclick="exitGame()" style="right:80px;">🏁 Завершить дуэль</button>` : ''}
    `;

    map = L.map('map').setView([55.76, 37.64], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    myPolyline = L.polyline([], { color: currentUser.colorLine || '#e94560', weight: 4 }).addTo(map);

    // Отображаем сохранённые территории
    territoryPolygons = [];
    if (currentUser.territories) {
        currentUser.territories.forEach(polygon => {
            const poly = L.polygon(polygon, { color: currentUser.colorTerritory || '#00ff88', fillOpacity: 0.3 });
            poly.addTo(map);
            poly.bindPopup(currentUser.username);
            territoryPolygons.push(poly);
        });
        document.getElementById('territory-count').textContent = currentUser.territories.length;
    }

    if (mode === 'duel') {
        startDuelTimer();
        setInterval(updateOpponentScore, 3000);
    }
}

// ============================================================
// 10. ТАЙМЕР ДУЭЛИ
// ============================================================

function startDuelTimer() {
    const totalSeconds = duelData.time;
    let remaining = totalSeconds;
    const timerElement = document.getElementById('duel-timer');
    if (!timerElement) return;
    function updateTimer() {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        timerElement.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        if (remaining <= 0) {
            clearInterval(duelTimerInterval);
            endDuel();
            return;
        }
        remaining--;
        updateOpponentScore();
    }
    updateTimer();
    duelTimerInterval = setInterval(updateTimer, 1000);
}

async function updateOpponentScore() {
    try {
        const users = await apiRequest('/users');
        const opponent = users.find(u => u.username === duelData.opponent);
        if (opponent) {
            const oppTerritories = opponent.territories ? opponent.territories.length : 0;
            document.getElementById('opponent-score').textContent = oppTerritories;
            duelData.opponentScore = oppTerritories;
        }
    } catch (e) {}
}

async function endDuel() {
    alert('Время вышло! Подсчёт результатов...');
    const myScore = currentUser.territories ? currentUser.territories.length : 0;
    const oppScore = duelData.opponentScore || 0;
    let winner = null;
    if (myScore > oppScore) winner = currentUser.username;
    else if (oppScore > myScore) winner = duelData.opponent;
    else winner = 'Ничья';
    alert(`Результат: Вы захватили ${myScore} территорий, соперник ${oppScore}. Победитель: ${winner}`);
    // Обновляем статистику
    let wins = currentUser.wins || 0;
    let losses = currentUser.losses || 0;
    if (winner === currentUser.username) wins++;
    else if (winner !== 'Ничья') losses++;
    await apiRequest('/update_user', 'POST', {
        username: currentUser.username,
        wins, losses,
        activeDuel: null
    });
    // У соперника тоже сбрасываем activeDuel
    await apiRequest('/update_user', 'POST', {
        username: duelData.opponent,
        activeDuel: null
    });
    // Обновляем текущего пользователя
    currentUser.wins = wins;
    currentUser.losses = losses;
    currentUser.activeDuel = null;
    showMainMenu();
}

// ============================================================
// 11. ОТСЛЕЖИВАНИЕ И ЗАХВАТ ТЕРРИТОРИИ
// ============================================================

function startTracking() {
    if (!navigator.geolocation) {
        alert('Ваш браузер не поддерживает геолокацию.');
        return;
    }
    document.getElementById('start-btn').disabled = true;
    document.getElementById('stop-btn').disabled = false;
    isTracking = true;
    myRoute = [];
    totalDistance = 0;
    myPolyline.setLatLngs([]);
    updateDistance(0);
    territoryBuffer = null;
    watchId = navigator.geolocation.watchPosition(onLocationSuccess, onLocationError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
}

function stopTracking() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    isTracking = false;
    document.getElementById('start-btn').disabled = false;
    document.getElementById('stop-btn').disabled = true;
    // Захват территории по буферу уже происходит в реальном времени, поэтому просто сохраняем дистанцию
    currentUser.totalDistance += totalDistance;
    saveUserData();
    document.getElementById('total-km').textContent = (currentUser.totalDistance/1000).toFixed(2);
}

function onLocationSuccess(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const newPoint = [lat, lng];
    if (myRoute.length > 0) {
        const lastPoint = myRoute[myRoute.length - 1];
        const distance = calculateDistance(lastPoint, newPoint);
        totalDistance += distance;
        updateDistance(totalDistance);
    }
    myRoute.push(newPoint);
    myPolyline.setLatLngs(myRoute);
    map.panTo(newPoint);
    // Обновляем буфер территории
    updateTerritoryBuffer();
}

function onLocationError(error) {
    console.warn('Ошибка геолокации:', error.message);
    alert('Не удалось получить местоположение. Проверьте разрешения.');
    stopTracking();
}

function calculateDistance(p1, p2) {
    const R = 6371000;
    const lat1 = p1[0] * Math.PI / 180;
    const lat2 = p2[0] * Math.PI / 180;
    const deltaLat = (p2[0] - p1[0]) * Math.PI / 180;
    const deltaLng = (p2[1] - p1[1]) * Math.PI / 180;
    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function updateDistance(meters) {
    document.getElementById('distance-display').textContent = Math.round(meters);
}

// ============================================================
// 12. ЗАХВАТ ТЕРРИТОРИИ С РАДИУСОМ (5 МЕТРОВ)
// ============================================================

function updateTerritoryBuffer() {
    if (myRoute.length < 2) return;
    const line = turf.lineString(myRoute);
    const buffered = turf.buffer(line, 5, { units: 'meters' });
    if (territoryBuffer) {
        const union = turf.union(territoryBuffer, buffered);
        territoryBuffer = union ? union : buffered;
    } else {
        territoryBuffer = buffered;
    }
    // Пытаемся захватить
    captureTerritoryWithBuffer(territoryBuffer);
}

async function captureTerritoryWithBuffer(bufferPolygon) {
    // Проверяем, есть ли уже такая территория у пользователя
    let existingTerritories = currentUser.territories || [];
    let hasIntersection = false;
    for (let territory of existingTerritories) {
        const existingPoly = turf.polygon([territory]);
        try {
            const intersect = turf.intersect(bufferPolygon, existingPoly);
            if (intersect) {
                hasIntersection = true;
                break;
            }
        } catch (e) {}
    }
    if (!hasIntersection) {
        const coords = bufferPolygon.geometry.coordinates[0];
        currentUser.territories.push(coords);
        await saveUserData();
        displayTerritories();
        alert('Территория захвачена!');
        territoryBuffer = null;
    }
}

function displayTerritories() {
    territoryPolygons.forEach(poly => map.removeLayer(poly));
    territoryPolygons = [];
    if (currentUser.territories) {
        currentUser.territories.forEach(territory => {
            const poly = L.polygon(territory, {
                color: currentUser.colorTerritory || '#00ff88',
                fillOpacity: 0.3
            });
            poly.addTo(map);
            poly.bindPopup(currentUser.username);
            territoryPolygons.push(poly);
        });
    }
}

// ============================================================
// 13. ВЫХОД ИЗ ИГРЫ
// ============================================================

function exitGame() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    if (duelTimerInterval) clearInterval(duelTimerInterval);
    stopTracking();
    saveUserData();
    showMainMenu();
}

function finishGame() {
    stopTracking();
    saveUserData();
    alert('Игра завершена. Данные сохранены.');
    showMainMenu();
}

// ============================================================
// 14. CREDITS (модальное окно)
// ============================================================

function showCredits() {
    document.getElementById('credits-modal').style.display = 'flex';
}

function closeCredits() {
    document.getElementById('credits-modal').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('credits-modal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeCredits();
        });
    }
});

// ============================================================
// 15. ЗАПУСК
// ============================================================

document.addEventListener('DOMContentLoaded', async function() {
    // Проверяем, есть ли сохранённая сессия (пока не реализовано)
    // Просто показываем форму входа
    showLoginForm();
});
