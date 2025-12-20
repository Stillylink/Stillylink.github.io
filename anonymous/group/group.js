/*  group.js  –  групповой анонимный чат, последние 100 сообщений всегда онлайн
-------------------------------------------------- */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import {
  getFirestore,
  collection, doc, addDoc, serverTimestamp,
  query, orderBy, limit, onSnapshot, deleteDoc, getDocs, getDoc, setDoc, updateDoc, runTransaction
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';

/*  ===============  Firebase-конфиг  ===============  */
const firebaseConfig = {
  apiKey: "AIzaSyBWlR4QWdnbqXLKKaftEAzhXneTmV9xXX0",
  authDomain: "stillylink-f1d0f.firebaseapp.com",
  projectId: "stillylink-f1d0f",
  storageBucket: "stillylink-f1d0f.appspot.com",
  messagingSenderId: "772070114710",
  appId: "1:772070114710:web:939bce83e4d3be14bdc9b7"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/*  ===============  DOM-элементы  ===============  */
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

/*  =====  элементы шапки  =====  */
const regBtn        = document.querySelector('.register-btn');
const avatar        = document.querySelector('.user-avatar');
const avatarLetter  = document.querySelector('.user-avatar span');
const userMenu      = document.querySelector('.user-menu');
const logoutBtn     = document.getElementById('logoutBtn');
const navToggle     = document.querySelector('.nav-toggle');

/*  ===============  Глобальные переменные  ===============  */
const ROOM_ID = 'public_room';          // одна бессрочная комната
const MSG_LIMIT = 100;                  // максимум сообщений в коллекции
const PRESENCE_INTERVAL = 8_000;        // heartbeat онлайна
const STALE_MS = 40_000;                // считаем оффлайн после молчания

let uid = null;                         // anon uid
let nickname = '';                      // выбранный ник
let messagesUnsub = null;               // отписка от сообщений
let presenceUnsub = null;               // отписка от онлайна
let presenceInterval = null;            // heartbeat
let onlineUids = new Set();             // кто в онлайне прямо сейчас

/*  ===============  Утилиты  ===============  */
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');


/*  =====  выйти  =====  */
logoutBtn?.addEventListener('click', async e => {
  e.preventDefault();
  await auth.signOut();                 // выход из Firebase
  localStorage.removeItem('userAvatarLetter');
  window.location.reload();             // перезагрузить страницу
});

/*  =====  открыть/закрыть меню аватарки и бургера  =====  */
window.toggleUserMenu = () => userMenu.classList.toggle('open');
document.addEventListener('click', e => {
  if (!userMenu.classList.contains('open')) return;
  if (userMenu.contains(e.target) || avatar.contains(e.target)) return;
  userMenu.classList.remove('open');
});

window.toggleMenu = () => document.querySelector('.nav-links').classList.toggle('open');

document.addEventListener('click', e => {
  const menu = document.querySelector('.nav-links');
  if (!menu.classList.contains('open')) return;
  if (menu.contains(e.target)) return;
  if (navToggle.contains(e.target)) return;
  menu.classList.remove('open');
});

/*  ===============  Авторизация  ===============  */
onAuthStateChanged(auth, user => {
  if (!user) { signInAnonymously(auth); return; }

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

/*  ===============  Вход в чат  ===============  */
const nickError = document.getElementById('nickError');

function showNickError(msg) {
  nickError.textContent = msg;
}

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

nickInput.addEventListener('input', () => nickError.textContent = '');

/*  ===============  Присоединение к комнате  ===============  */
async function enterRoom() {
  const roomRef = doc(db, 'rooms', ROOM_ID);
  const presenceRef = doc(roomRef, 'presence', uid);

  // добавляем себя в participants (если ещё нет)
  await runTransaction(db, async tx => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) {
      tx.set(roomRef, { participants: [uid], createdAt: serverTimestamp() });
    } else {
      const pts = snap.data().participants || [];
      if (!pts.includes(uid)) pts.push(uid);
      tx.update(roomRef, { participants: pts });
    }
  });

  // ставим/обновляем своё присутствие
  await setDoc(presenceRef, { lastSeen: serverTimestamp(), nick: nickname }, { merge: true });
  presenceInterval = setInterval(() =>
    updateDoc(presenceRef, { lastSeen: serverTimestamp() }), PRESENCE_INTERVAL
  );

  // слушаем онлайн
  presenceUnsub = onSnapshot(collection(roomRef, 'presence'), snap => {
    onlineUids.clear();
    snap.docs.forEach(d => {
      const ls = d.data().lastSeen?.toMillis ? d.data().lastSeen.toMillis() : 0;
      if (Date.now() - ls < STALE_MS) onlineUids.add(d.id);
    });
    onlineCount.textContent = `${onlineUids.size} онлайн`;
  });

  // слушаем сообщения (последние 100)
  const q = query(collection(roomRef, 'messages'), orderBy('createdAt'), limit(MSG_LIMIT));
  messagesUnsub = onSnapshot(q, snap => {
    messagesEl.innerHTML = '';
    snap.docs.forEach(d => addMessageToUI(d.data()));
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

/*  ===============  Отправка текста / картинки  ===============  */
sendBtn.addEventListener('click', () => send(textInput.value.trim(), 'text'));
textInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(textInput.value.trim(), 'text'); }
});

async function send(text, type) {
  if (!text) return;
  textInput.value = '';
  const roomRef = doc(db, 'rooms', ROOM_ID);
  await addDoc(collection(roomRef, 'messages'), {
    sender: uid,
    nick: nickname,
    text,
    type,
    createdAt: serverTimestamp()
  });
  snapLimitMessages();   // сразу чистим, если стало >100
}

/*  ===============  Картинки  ===============  */
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
  btn.addEventListener('click', () => { textInput.value += btn.textContent; textInput.focus(); })
);
document.addEventListener('click', e => {
  if (!emojiPanel.classList.contains('hidden') &&
      !emojiPanel.contains(e.target) && e.target !== emojiBtn) emojiPanel.classList.add('hidden');
});

/*  ===============  Рендер одного сообщения  ===============  */
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
    img.style.cursor = 'pointer';
    img.onclick = () => window.open(text, '_blank');
    msg.appendChild(img);
  } else {
    msg.textContent = text;
  }

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  const time = createdAt?.toDate ? createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  meta.textContent = `${nick} · ${time}`;
  msg.appendChild(meta);

  if (isOwn) row.appendChild(msg);
  else { row.appendChild(ava); row.appendChild(msg); }
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/*  ===============  Удаляем лишние сообщения (>MSG_LIMIT)  ===============  */
async function snapLimitMessages() {
  const roomRef = doc(db, 'rooms', ROOM_ID);
  const q = query(collection(roomRef, 'messages'), orderBy('createdAt'), limit(MSG_LIMIT + 1));
  const snap = await getDocs(q);
  if (snap.size <= MSG_LIMIT) return;
  const toDelete = snap.docs.slice(0, snap.size - MSG_LIMIT);
  for (const d of toDelete) await deleteDoc(d.ref);
}

/*  ===============  Покинуть чат  ===============  */
leaveBtn.addEventListener('click', async () => {
  if (!uid) return;
  const roomRef = doc(db, 'rooms', ROOM_ID);
  const presenceRef = doc(roomRef, 'presence', uid);

  await runTransaction(db, async tx => {
    const snap = await tx.get(roomRef);
    if (snap.exists()) {
      const pts = (snap.data().participants || []).filter(p => p !== uid);
      tx.update(roomRef, { participants: pts });
    }
  });
  await deleteDoc(presenceRef);

  if (messagesUnsub) { messagesUnsub(); messagesUnsub = null; }
  if (presenceUnsub) { presenceUnsub(); presenceUnsub = null; }
  if (presenceInterval) { clearInterval(presenceInterval); presenceInterval = null; }

  window.location.replace('/anonymous/');
});

/*  ===============  Уборка при закрытии вкладки  ===============  */
window.addEventListener('beforeunload', async () => {
  if (!uid) return;
  const roomRef = doc(db, 'rooms', ROOM_ID);
  const presenceRef = doc(roomRef, 'presence', uid);
  await deleteDoc(presenceRef).catch(() => {});
});
