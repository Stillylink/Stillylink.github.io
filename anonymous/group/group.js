/*  group.js – групповой анонимный чат (RTDB)
-------------------------------------------------- */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import {
  getDatabase,
  ref,
  set,
  push,
  onChildAdded,
  onValue,
  onDisconnect
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
getFirestore(app); // Firestore оставляем для профиля/аватарки
const rtdb = getDatabase(app);

/*  ===============  DOM  ===============  */
const joinScreen = document.getElementById('joinScreen');
const chatWindow = document.getElementById('chatWindow');
const nickInput = document.getElementById('nickInput');
const joinBtn = document.getElementById('joinBtn');
const messagesEl = document.getElementById('messages');
const textInput = document.getElementById('textInput');
const sendBtn = document.getElementById('sendBtn');
const leaveBtn = document.getElementById('leaveBtn');
const onlineCount = document.getElementById('onlineCount');
const emojiBtn = document.getElementById('emojiBtn');
const emojiPanel = document.getElementById('emojiPanel');
const photoBtn = document.getElementById('photoBtn');
const photoInput = document.getElementById('photoInput');
const nickError = document.getElementById('nickError');

/*  =====  шапка  =====  */
const regBtn = document.querySelector('.register-btn');
const avatar = document.querySelector('.user-avatar');
const avatarLetter = document.querySelector('.user-avatar span');
const userMenu = document.querySelector('.user-menu');
const logoutBtn = document.getElementById('logoutBtn');
const navToggle = document.querySelector('.nav-toggle');

/*  ===============  Переменные  ===============  */
const ROOM_ID = 'public_room';
const MSG_LIMIT = 100;
const STALE_MS = 120_000; // 2 минуты
const MARK_DELTA = 30_000; // 30 секунд

let uid = null;
let nickname = '';
let presenceRef = null;
let messagesRef = null;

/*  ===============  Utils  ===============  */
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');

/*  ===============  Logout  ===============  */
logoutBtn?.addEventListener('click', async e => {
  e.preventDefault();
  await auth.signOut();
  localStorage.removeItem('userAvatarLetter');
  window.location.reload();
});

/*  ===============  Меню  ===============  */
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

/* ===== локальная аватарка сразу ===== */
const savedAvatar = localStorage.getItem('userAvatarLetter');
if (savedAvatar) {
  regBtn?.classList.add('hidden');
  avatar?.classList.remove('hidden');
  avatarLetter.textContent = savedAvatar;
}

/*  ===============  Auth  ===============  */
onAuthStateChanged(auth, user => {
  if (!user) {
    signInAnonymously(auth);
    return;
  }

  uid = user.uid;

  if (user.email) {
    regBtn?.classList.add('hidden');
    avatar?.classList.remove('hidden');
    const letter = user.email.charAt(0).toUpperCase();
    avatarLetter.textContent = letter;
    localStorage.setItem('userAvatarLetter', letter);
  } else {
    regBtn?.classList.remove('hidden');
    avatar?.classList.add('hidden');
    localStorage.removeItem('userAvatarLetter');
  }

  show(joinScreen);
});

/*  ===============  Join  ===============  */
function showNickError(msg) { nickError.textContent = msg; }

joinBtn.addEventListener('click', () => {
  const raw = nickInput.value.trim();
  if (raw.length < 3 || raw.length > 20) {
    showNickError('Никнейм должен быть от 3 до 20 символов.');
    return;
  }
  nickError.textContent = '';
  nickname = raw;
  hide(joinScreen);
  show(chatWindow);
  enterRoom();
});

/*  ===============  Enter room (RTDB)  ===============  */
function enterRoom() {
  messagesRef = ref(rtdb, `messages/${ROOM_ID}`);
  presenceRef = ref(rtdb, `presence/${ROOM_ID}/${uid}`);

  // initial presence
  set(presenceRef, {
    nick: nickname,
    online: true,
    lastSeen: Date.now()
  });

  // disconnect handler
  onDisconnect(presenceRef).set({
    online: false,
    lastSeen: Date.now()
  });

  // listen presence
  onValue(ref(rtdb, `presence/${ROOM_ID}`), snap => {
    const data = snap.val() || {};
    const count = Object.values(data).filter(u => u.online).length;
    onlineCount.textContent = `${Math.max(1, count)} онлайн`;
  });

  // listen messages
  let loaded = 0;
  onChildAdded(messagesRef, snap => {
    if (++loaded > MSG_LIMIT) messagesEl.firstChild?.remove();
    addMessageToUI(snap.val());
  });

  // mark user as online periodically
  let lastMark = 0;
  const markOnline = () => {
    const now = Date.now();
    if (now - lastMark < MARK_DELTA) return;
    lastMark = now;
    if (!presenceRef) return;
    set(presenceRef, {
      nick: nickname,
      online: true,
      lastSeen: Date.now()
    });
  };
  document.addEventListener('keydown', markOnline);
  document.addEventListener('mousemove', markOnline);
  setInterval(markOnline, MARK_DELTA);

  // авто-выключение неактивных пользователей
  setInterval(() => {
    const presenceRoomRef = ref(rtdb, `presence/${ROOM_ID}`);
    onValue(presenceRoomRef, snap => {
      const data = snap.val() || {};
      Object.entries(data).forEach(([id, user]) => {
        if (Date.now() - user.lastSeen > STALE_MS && user.online) {
          set(ref(rtdb, `presence/${ROOM_ID}/${id}`), {
            ...user,
            online: false
          });
        }
      });
    }, { onlyOnce: true });
  }, 5 * 60 * 1000); // каждые 5 минут
}

/*  ===============  Send  ===============  */
sendBtn.addEventListener('click', () => send(textInput.value.trim(), 'text'));
textInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send(textInput.value.trim(), 'text');
  }
});

function send(text, type) {
  if (!text) return;
  textInput.value = '';

  push(messagesRef, {
    sender: uid,
    nick: nickname,
    text,
    type,
    createdAt: Date.now()
  });
}

/*  ===============  Images  ===============  */
photoBtn.addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', () => {
  const file = photoInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => send(e.target.result, 'image');
  reader.readAsDataURL(file);
  photoInput.value = '';
});

/*  ===============  Emoji  ===============  */
emojiBtn.addEventListener('click', () => emojiPanel.classList.toggle('hidden'));
document.querySelectorAll('.emoji').forEach(btn =>
  btn.addEventListener('click', () => {
    textInput.value += btn.textContent;
    textInput.focus();
  })
);

/*  ===============  Render message  ===============  */
function addMessageToUI(data) {
  const { sender, nick, text, type, createdAt } = data;
  const isOwn = sender === uid;

  const row = document.createElement('div');
  row.className = 'msg-row ' + (isOwn ? 'own' : 'other');

  const ava = document.createElement('div');
  ava.className = 'avatar';
  ava.textContent = nick.slice(0, 2).toUpperCase();

  const msg = document.createElement('div');
  msg.className = 'message' + (isOwn ? ' own' : '');

  if (type === 'image') {
    const img = document.createElement('img');
    img.src = text;
    img.style.maxWidth = '240px';
    img.style.borderRadius = '8px';
    img.onclick = () => window.open(text, '_blank');
    msg.appendChild(img);
  } else {
    msg.textContent = text;
  }

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  const time = createdAt
    ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  meta.textContent = `${nick} · ${time}`;
  msg.appendChild(meta);

  if (isOwn) row.appendChild(msg);
  else { row.appendChild(ava); row.appendChild(msg); }

  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/*  ===============  Leave  ===============  */
leaveBtn.addEventListener('click', async () => {
  if (presenceRef) await set(presenceRef, { online: false, lastSeen: Date.now(), nick: nickname });
  window.location.replace('/anonymous/');
});
