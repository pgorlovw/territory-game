from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

DATA_FILE = 'users.json'

def load_users():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_users(users):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

def find_user(users, username):
    return next((u for u in users if u['username'] == username), None)

# === API ЭНДПОИНТЫ ===

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    if not username or not password or len(password) < 8:
        return jsonify({'success': False, 'message': 'Неверные данные'}), 400
    users = load_users()
    if find_user(users, username):
        return jsonify({'success': False, 'message': 'Пользователь уже существует'}), 400
    # В реальном проекте пароль нужно хешировать!
    users.append({
        'username': username,
        'password': password,
        'totalDistance': 0,
        'territories': [],
        'colorLine': '#e94560',
        'colorTerritory': '#00ff88',
        'wins': 0,
        'losses': 0,
        'isOnline': False,
        'searching': None,      # время в минутах или None
        'activeDuel': None      # объект дуэли
    })
    save_users(users)
    return jsonify({'success': True, 'message': 'Регистрация успешна'})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    users = load_users()
    user = find_user(users, username)
    if not user or user['password'] != password:
        return jsonify({'success': False, 'message': 'Неверный логин или пароль'}), 401
    user['isOnline'] = True
    user['searching'] = None   # сбрасываем поиск при входе
    # Если была активная дуэль, очищаем (на случай, если она не завершена)
    user['activeDuel'] = None
    save_users(users)
    return jsonify({'success': True, 'user': user})

@app.route('/api/logout', methods=['POST'])
def logout():
    data = request.json
    username = data.get('username')
    users = load_users()
    user = find_user(users, username)
    if user:
        user['isOnline'] = False
        user['searching'] = None
        user['activeDuel'] = None
        save_users(users)
    return jsonify({'success': True})

@app.route('/api/update_user', methods=['POST'])
def update_user():
    data = request.json
    username = data.get('username')
    users = load_users()
    user = find_user(users, username)
    if not user:
        return jsonify({'success': False, 'message': 'Пользователь не найден'}), 404
    # Обновляем поля, которые пришли в запросе
    for key in ['totalDistance', 'territories', 'colorLine', 'colorTerritory', 'wins', 'losses', 'searching', 'activeDuel']:
        if key in data:
            user[key] = data[key]
    save_users(users)
    return jsonify({'success': True, 'user': user})

@app.route('/api/users', methods=['GET'])
def get_users():
    users = load_users()
    # Возвращаем публичные данные (без паролей)
    public = []
    for u in users:
        public.append({
            'username': u['username'],
            'totalDistance': u.get('totalDistance', 0),
            'territories': u.get('territories', []),
            'colorLine': u.get('colorLine', '#e94560'),
            'colorTerritory': u.get('colorTerritory', '#00ff88'),
            'wins': u.get('wins', 0),
            'losses': u.get('losses', 0),
            'isOnline': u.get('isOnline', False),
            'searching': u.get('searching'),
            'activeDuel': u.get('activeDuel')
        })
    return jsonify(public)

@app.route('/api/start_duel', methods=['POST'])
def start_duel():
    data = request.json
    player1 = data.get('player1')
    player2 = data.get('player2')
    time_minutes = data.get('time')  # в минутах
    if not player1 or not player2 or not time_minutes:
        return jsonify({'success': False, 'message': 'Недостаточно данных'}), 400
    users = load_users()
    p1 = find_user(users, player1)
    p2 = find_user(users, player2)
    if not p1 or not p2:
        return jsonify({'success': False, 'message': 'Игрок не найден'}), 404
    # Создаём дуэль
    duel = {
        'player1': player1,
        'player2': player2,
        'time': time_minutes * 60,  # в секундах
        'startTime': datetime.now().isoformat(),
        'finished': False,
        'winner': None
    }
    p1['activeDuel'] = duel
    p2['activeDuel'] = duel
    p1['searching'] = None
    p2['searching'] = None
    save_users(users)
    return jsonify({'success': True, 'duel': duel})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)