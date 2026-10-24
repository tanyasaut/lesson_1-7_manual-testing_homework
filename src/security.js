import { PREFIX } from './api.js';

export const CANARY_KEY = `${PREFIX}canary`;
const LOG_KEY = `${PREFIX}security-log`;
const BLOCK_KEY = `${PREFIX}blocked-until`;

// Временный вывод для проверки ловушек. Постоянный журнал добавляется в бонусе.
export function reportIncident(type, reason) {
  const list = document.querySelector('#incident-list');
  const item = document.createElement('li');
  item.textContent = `${type}: ${reason}`;
  list.prepend(item);
  document.querySelector('#incidents-empty').hidden = true;
  document.querySelector('#incident-count').textContent = String(list.children.length);
}

// События: startup, refresh, submit, decoy. Условия ловушек добавьте здесь.
let refreshTimes = [];
let blockedUntil = Number(localStorage.getItem(BLOCK_KEY)) || 0;
let timerId = null;

function saveToLog(type, reason) {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    let log = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(log)) log = [];
    log.push({ time: new Date().toISOString(), type, reason });
    if (log.length > 30) log = log.slice(-30);
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {}
}

function registerIncident(type, reason) {
  reportIncident(type, reason);
  saveToLog(type, reason);
  blockedUntil = Date.now() + 30000;
  try { localStorage.setItem(BLOCK_KEY, String(blockedUntil)); } catch {}
  updateSecurityUI();
}

function updateSecurityUI() {
  const status = document.querySelector('#security-status');
  const detail = document.querySelector('#restriction-detail');
  if (!status || !detail) return;
  
  if (Date.now() < blockedUntil) {
    status.textContent = 'Действия временно ограничены!';
    detail.hidden = false;
    let timerEl = document.querySelector('#restriction-timer');
    if (!timerEl) {
      timerEl = document.createElement('div');
      timerEl.id = 'restriction-timer';
      timerEl.style.marginTop = '8px';
      timerEl.style.color = '#a52c24';
      timerEl.style.fontWeight = 'bold';
      detail.appendChild(timerEl);
    }
    if (!timerId) {
      timerId = setInterval(() => {
        if (Date.now() >= blockedUntil) {
          clearInterval(timerId);
          timerId = null;
          updateSecurityUI();
        } else {
          const sec = Math.ceil((blockedUntil - Date.now()) / 1000);
          timerEl.textContent = `До снятия ограничений: ${sec} сек.`;
        }
      }, 500);
    }
    const sec = Math.ceil((blockedUntil - Date.now()) / 1000);
    timerEl.textContent = `До снятия ограничений: ${sec} сек.`;
  } else {
    status.textContent = 'Ограничений нет';
    detail.hidden = true;
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }
}

export function checkActivity(action, details = {}) {
  const now = Date.now();

  if (action === 'refresh') {
    refreshTimes = refreshTimes.filter(time => now - time < 5000);
    
    refreshTimes.push(now);

    if (refreshTimes.length >= 6) {
      registerIncident('T1', 'Подозрительная активность: слишком частые запросы обновления');
      refreshTimes = []; 
    }
  }
  if (action === 'submit' && details.supportCode) {
    registerIncident('T2', 'Атака: заполнено скрытое поле supportCode');
  }

  if (action === 'decoy') {
    registerIncident('T3', 'Атака: вызвана скрытая кнопка staff-export');
  }
  
  if (action === 'submit' && details.topic) {
    const validTopics = ['html', 'javascript', 'api'];
    if (!validTopics.includes(details.topic)) {
      registerIncident('T4', 'Атака: получено недопустимое направление: ' + details.topic);
    }
  }
  if (action === 'startup') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('staff') === '1') {
      registerIncident('T6', 'Атака: в адресе найден параметр staff=1');
    }
  }
}

// Приложение вызывает эту функцию перед отправкой и обновлением списка.
export function isRestricted() {
  if (Date.now() < blockedUntil) {
    return true;
  }
  return false;
}

export function initializeSecurity() {
  try {
    const canary = localStorage.getItem(CANARY_KEY);
    
    if (canary === null) {
      localStorage.setItem(CANARY_KEY, JSON.stringify({ role: 'visitor' }));
    } else {
      try {
        const data = JSON.parse(canary);
        if (data && data.role === 'admin') {
          registerIncident('T5', 'Атака: подмена canary (role: admin)'); 
          localStorage.setItem(CANARY_KEY, JSON.stringify({ role: 'visitor' }));
        }
      } catch (e) {
        // Если JSON поврежден — по условию это не атака
      }
    }
  } catch { /* Бонус должен учитывать недоступное хранилище. */ }

  // ВСТАВИТЬ ВОТ СЮДА (восстановление журнала):
  try {
    const rawLog = localStorage.getItem(LOG_KEY);
    if (rawLog) {
      const log = JSON.parse(rawLog);
      if (Array.isArray(log)) {
        const list = document.querySelector('#incident-list');
        if (list) {
          list.replaceChildren();
          log.forEach(item => {
            const li = document.createElement('li');
            li.textContent = `${item.type}: ${item.reason}`;
            list.prepend(li);
          });
          document.querySelector('#incidents-empty').hidden = log.length > 0;
          document.querySelector('#incident-count').textContent = String(log.length);
        }
      }
    }
  } catch {}
  // КОНЕЦ ВСТАВКИ

  updateSecurityUI(); // Показываем таймер, если он идет
  checkActivity('startup');
}

export function resetSecurity() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX) && key !== `${PREFIX}applications`) localStorage.removeItem(key);
    }
    localStorage.setItem(CANARY_KEY, JSON.stringify({ role: 'visitor' }));
  } catch { /* Учебный сброс остаётся доступным без storage. */ }

  blockedUntil = 0;
  refreshTimes = [];

    if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  updateSecurityUI();

  document.querySelector('#incident-list').replaceChildren();
  document.querySelector('#incident-count').textContent = '0';
  document.querySelector('#incidents-empty').hidden = false;
  document.querySelector('#security-status').textContent = 'Ограничений нет';
  document.querySelector('#restriction-detail').hidden = true;
}

