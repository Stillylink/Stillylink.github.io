/*  group.js – групповой анонимный чат (RTDB) --------------------------------------------- */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import {
  getDatabase,
  ref, set, push, onChildAdded, onDisconnect, remove, get, off
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

/*  ===============  Firebase-конфиг  ===============  */
const firebaseConfig = {
  apiKey: "AIzaSyBWlR4QWdnbqXLKKaftEAzhXneTmV9xXX0",
  authDomain: "stillylink-f1d0f.firebaseapp.com",
  projectId: "stillylink-f1d0f",
  storageBucket: "stillylink-f1d0f.appspot.com",
  messagingSenderId: "772070114710",
  appId: "1:772070114710:web:939bce83e4d3be14bdc9b7",
  databaseURL: "https://stillylink-f1d0f-default-rtdb.europe-west1.firebasedatabase.app"
};
const app   = initializeApp(firebaseConfig);
const auth  = getAuth(app);
const db    = getFirestore(app);
const rtdb  = getDatabase(app);

/*  ===============  DOM  =============== */
const joinScreen  = document.getElementById('joinScreen');
const chatWindow  = document.getElementById('chatWindow');
const nickInput   = document.getElementById('nickInput');
const joinBtn     = document.getElementById('joinBtn');
const messagesEl  = document.getElementById('messages');
const textInput   = document.getElementById('textInput');
const sendBtn     = document.getElementById('sendBtn');
const leaveBtn    = document.getElementById('leaveBtn');
const onlineCount = document.getElementById('onlineCount');
const emojiBtn    = document.getElementById('emojiBtn');
const emojiPanel  = document.getElementById('emojiPanel');
const photoBtn    = document.getElementById('photoBtn');
const photoInput  = document.getElementById('photoInput');
const nickError   = document.getElementById('nickError');

/*  =====  шапка  =====  */
const regBtn      = document.querySelector('.register-btn');
const avatar      = document.querySelector('.user-avatar');
const avatarLetter= document.querySelector('.user-avatar span');
const userMenu    = document.querySelector('.user-menu');
const logoutBtn   = document.getElementById('logoutBtn');
const navToggle   = document.querySelector('.nav-toggle');

/*  ===============  Переменные  =============== */
const ROOM_ID   = 'public_room';
const MSG_LIMIT = 80;
const STALE_MS  = 120_000;   // 2 мин бездействия
const MARK_DELTA= 30_000;    // пинг не чаще 30 с

let uid         = null;
let nickname    = '';
let presenceRef = null;
let messagesRef = null;
let lastMark    = 0;
let hasJoinedRoom = false; // ← КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: флаг входа в комнату
let messagesListener = null; // ← Для отписки от слушателя
let onlineInterval = null; // ← Для очистки интервала

/*  ===============  Utils  =============== */
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');

/*  ===============  Logout  =============== */
logoutBtn?.addEventListener('click', async e => {
  e.preventDefault();
  await auth.signOut();
  localStorage.clear();
  window.location.reload();
});

/*  ===============  Меню  =============== */
window.toggleUserMenu = () => userMenu.classList.toggle('open');
document.addEventListener('click', e => {
  if (userMenu.classList.contains('open') &&
      !userMenu.contains(e.target) && !avatar.contains(e.target))
    userMenu.classList.remove('open');
});
window.toggleMenu = () => document.querySelector('.nav-links').classList.toggle('open');
document.addEventListener('click', e => {
  const menu = document.querySelector('.nav-links');
  if (menu.classList.contains('open') &&
      !menu.contains(e.target) && !navToggle.contains(e.target))
    menu.classList.remove('open');
});

/* ===== ОПТИМИЗАЦИЯ: локальная аватарка сразу ===== */
const savedAvatar = localStorage.getItem('userAvatarLetter');
if (savedAvatar) {
  regBtn?.classList.add('hidden');
  avatar?.classList.remove('hidden');
  avatarLetter.textContent = savedAvatar;
}

/*  ===============  Auth  =============== */
onAuthStateChanged(auth, user => {
  if (!user) { signInAnonymously(auth); return; }
  uid = user.uid;
  
  if (user.email) {
    // ОПТИМИЗАЦИЯ: Используем кэш или первую букву email, БЕЗ запроса в Firestore
    const cachedLetter = localStorage.getItem('userAvatarLetter');
    if (cachedLetter) {
      avatarLetter.textContent = cachedLetter;
    } else {
      const letter = user.email[0].toUpperCase();
      avatarLetter.textContent = letter;
      localStorage.setItem('userAvatarLetter', letter);
    }

    regBtn?.classList.add('hidden');
    avatar?.classList.remove('hidden');
  } else {
    regBtn?.classList.remove('hidden');
    avatar?.classList.add('hidden');
    localStorage.removeItem('userAvatarLetter');
  }
  
  // ← КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: показываем joinScreen только если ещё не в чате
  if (!hasJoinedRoom) {
    show(joinScreen);
  }
});

/*  ===============  Join  =============== */
function showNickError(msg) {
  nickError.textContent = msg;
  nickError.classList.add('visible');
}

function hideNickError() {
  nickError.textContent = '';
  nickError.classList.remove('visible');
}

nickInput.addEventListener('input', hideNickError);

joinBtn.addEventListener('click', () => {
  // ← Защита от повторного нажатия
  if (hasJoinedRoom) return;
  
  const raw = nickInput.value.trim();
  if (raw.length < 3 || raw.length > 20) {
    showNickError('Никнейм должен быть от 3 до 20 символов.');
    return;
  }
  
  // ← Блокируем кнопку
  joinBtn.disabled = true;
  
  nickError.textContent = '';
  nickname = raw;
  hasJoinedRoom = true; // ← Устанавливаем флаг ДО скрытия экрана
  
  hide(joinScreen);
  show(chatWindow);
  enterRoom();
});

/*  ===============  Enter room (RTDB)  =============== */
async function enterRoom() {
  // ← Очищаем старые слушатели если они есть
  if (messagesRef && messagesListener) {
    off(messagesRef, 'child_added', messagesListener);
  }
  
  messagesRef = ref(rtdb, `messages/${ROOM_ID}`);
  presenceRef = ref(rtdb, `presence/${ROOM_ID}/${uid}`);

  onlineCount.classList.remove('hidden');

  try {
    /* 1. Регистрируем присутствие */
    const now = Date.now();
    await set(presenceRef, { nick: nickname, online: true, lastSeen: now });

    onDisconnect(presenceRef).remove();

    /* 2. слушаем сообщения */
    let loaded = 0;
    messagesListener = (snap) => {
      if (++loaded > MSG_LIMIT) messagesEl.firstChild?.remove();
      addMessageToUI(snap.val());
    };
    onChildAdded(messagesRef, messagesListener);

    /* 3. сразу считаем и показываем онлайн, потом таймер */
    const presenceRoot = ref(rtdb, `presence/${ROOM_ID}`);

    async function countAndDisplay() {
      try {
        const snap = await get(presenceRoot);
        const data = snap.val() || {};
        let onlineUsers = 0;
        const now = Date.now();
        for (const [id, u] of Object.entries(data)) {
          if (now - u.lastSeen > STALE_MS) {
            remove(ref(rtdb, `presence/${ROOM_ID}/${id}`)).catch(() => {});
          } else if (u.online) onlineUsers++;
        }
        onlineCount.textContent = `${Math.max(1, onlineUsers)} онлайн`;
      } catch (err) {
        console.error('Ошибка подсчёта онлайн:', err);
      }
    }

    await countAndDisplay();
    
    // ← Очищаем старый интервал если есть
    if (onlineInterval) clearInterval(onlineInterval);
    onlineInterval = setInterval(countAndDisplay, 5_000);

    /* 4. регулярный пинг */
    markOnlineEvents();
    
  } catch (error) {
    console.error('Ошибка входа в чат:', error);
    alert('Не удалось войти в чат. Попробуйте перезагрузить страницу.');
    
    // ← Откатываем состояние при ошибке
    hasJoinedRoom = false;
    joinBtn.disabled = false;
    hide(chatWindow);
    show(joinScreen);
  }
}

/*  =====  пинг-обновление ===== */
let markEventsInitialized = false; // ← Защита от повторной инициализации

function markOnlineEvents() {
  if (markEventsInitialized) return; // ← Важно!
  markEventsInitialized = true;
  
  document.addEventListener('keydown', markOnline);
  document.addEventListener('mousemove', markOnline);
  setInterval(markOnline, MARK_DELTA);
}

function markOnline() {
  if (!presenceRef || !hasJoinedRoom) return;
  const now = Date.now();
  if (now - lastMark < MARK_DELTA) return;
  lastMark = now;
  set(presenceRef, { nick: nickname, online: true, lastSeen: now }).catch(() => {});
}

/*  ===============  Send  =============== */
sendBtn.addEventListener('click', () => send(textInput.value.trim(), 'text'));
textInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send(textInput.value.trim(), 'text');
  }
});

function resetTextareaHeight() {
  textInput.style.height = 'auto';
  textInput.style.height = textInput.scrollHeight + 'px';
}

function send(text, type) {
  if (!text || !hasJoinedRoom) return;

  textInput.value = '';
  resetTextareaHeight();

  push(messagesRef, {
    sender: uid,
    nick: nickname,
    text,
    type,
    createdAt: Date.now()
  }).catch(err => {
    console.error('Ошибка отправки:', err);
  });
}

/*  ===============  Images  =============== */
photoBtn.addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', () => {
  const file = photoInput.files?.[0];
  if (!file) return;
  
  // ← Проверка размера (макс 5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert('Файл слишком большой. Максимум 5 МБ.');
    photoInput.value = '';
    return;
  }
  
  const reader = new FileReader();
  reader.onload = e => send(e.target.result, 'image');
  reader.readAsDataURL(file);
  photoInput.value = '';
});

/*  ===============  Emoji  =============== */
emojiBtn.addEventListener('click', () => emojiPanel.classList.toggle('hidden'));
document.querySelectorAll('.emoji').forEach(btn =>
  btn.addEventListener('click', () => {
    textInput.value += btn.textContent;
    textInput.focus();
  })
);

/*  ===============  Render message  =============== */
function addMessageToUI(data) {
  if (!data) return;
  
  const { sender, nick, text, type, createdAt } = data;
  const isOwn = sender === uid;

  const row = document.createElement('div');
  row.className = 'msg-row ' + (isOwn ? 'own' : 'other');

  const ava = document.createElement('div');
  ava.className = 'avatar';
  ava.textContent = (nick || 'A').slice(0, 2).toUpperCase();

  const msg = document.createElement('div');
  msg.className = 'message' + (isOwn ? ' own' : '');

  if (type === 'image') {
    const img = document.createElement('img');
    img.src = text;
    img.style.maxWidth = '240px';
    img.style.borderRadius = '8px';
    img.style.cursor = 'pointer';
    img.onclick = () => window.open(text, '_blank');
    img.onerror = () => {
      img.style.display = 'none';
      msg.textContent = '[Изображение не загрузилось]';
    };
    msg.appendChild(img);
  } else {
    msg.textContent = text || '';
  }

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  const time = createdAt
    ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  meta.textContent = `${nick || 'Аноним'} · ${time}`;
  msg.appendChild(meta);

  if (isOwn) row.appendChild(msg);
  else { row.appendChild(ava); row.appendChild(msg); }

  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/*  ===============  Leave  =============== */
leaveBtn.addEventListener('click', async () => {
  // ← Очищаем всё перед уходом
  if (presenceRef) {
    await remove(presenceRef).catch(() => {});
  }
  
  if (messagesRef && messagesListener) {
    off(messagesRef, 'child_added', messagesListener);
  }
  
  if (onlineInterval) {
    clearInterval(onlineInterval);
  }
  
  hasJoinedRoom = false;
  
  window.location.replace('/anonymous/');
});
