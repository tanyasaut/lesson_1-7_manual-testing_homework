import { PREFIX } from './api.js';

export const CANARY_KEY = `${PREFIX}canary`;

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
let blockedUntil = 0;

export function checkActivity(action, details = {}) {
  const now = Date.now();

  if (action === 'refresh') {
    refreshTimes = refreshTimes.filter(time => now - time < 5000);
    
    refreshTimes.push(now);

    if (refreshTimes.length >= 6) {
      reportIncident('T1', 'Подозрительная активность: слишком частые запросы обновления');
      refreshTimes = []; 
      blockedUntil = Date.now() + 30000;
    }
  }
  if (action === 'submit' && details.supportCode) {
    reportIncident('T2', 'Атака: заполнено скрытое поле supportCode');
  }

  if (action === 'decoy') {
    reportIncident('T3', 'Атака: вызвана скрытая кнопка staff-export');
  }
  
  if (action === 'submit' && details.topic) {
    const validTopics = ['html', 'javascript', 'api'];
    if (!validTopics.includes(details.topic)) {
      reportIncident('T4', 'Атака: получено недопустимое направление: ' + details.topic);
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
          reportIncident('T5', 'Атака: подмена canary (role: admin)');
        }
      } catch (e) {
        // Если JSON поврежден — по условию это не атака
      }
    }
  } catch { /* Бонус должен учитывать недоступное хранилище. */ }
  
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

  document.querySelector('#incident-list').replaceChildren();
  document.querySelector('#incident-count').textContent = '0';
  document.querySelector('#incidents-empty').hidden = false;
  document.querySelector('#security-status').textContent = 'Ограничений нет';
  document.querySelector('#restriction-detail').hidden = true;
}
