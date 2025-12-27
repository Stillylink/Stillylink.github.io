/*  anon1x1.js  –  анонимный чат 1-on-1, полностью RTDB  */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js"; // только для аватарки
import {
  getDatabase, ref, set, push, onValue, onDisconnect, remove, get, query, limitToLast, orderByChild, equalTo
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

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
getFirestore(app);                      // нужно только для шапки
const rtdb  = getDatabase(app);

/* ---------- DOM (ваш прежний) ---------- */
const searchScreen = document.getElementById('searchScreen');
const chatWindow   = document.getElementById('chatWindow');
const endScreen    = document.getElementById('endScreen');
const messagesEl   = document.getElementById('messages');
const textInput    = document.getElementById('textInput');
const sendBtn      = document.getElementById('sendBtn');
const finishBtn    = document.getElementById('finishBtn');
const modal        = document.getElementById('modal');
const modalCancel  = document.getElementById('modalCancel');
const modalFinish  = document.getElementById('modalFinish');
const newChatBtn   = document.getElementById('newChatBtn');
const emojiBtn     = document.getElementById('emojiBtn');
const emojiPanel   = document.getElementById('emojiPanel');
const photoBtn     = document.getElementById('photoBtn');
const photoInput   = document.getElementById('photoInput');
const cancelSearch = document.getElementById('cancelSearch');
const statusText   = document.getElementById('statusText');
const exitBtn      = document.getElementById('exitBtn');

const regBtn       = document.querySelector(".register-btn");
const avatar       = document.querySelector(".user-avatar");
const avatarLetter = document.querySelector(".user-avatar span");
const userMenu     = document.querySelector(".user-menu");
const logoutBtn    = document.getElementById("logoutBtn");

/* ---------- глобальные переменные ---------- */
let uid = null, isRealUser = false, myWaitingRef = null, roomId = null, partnerId = null;
let messagesUnsub = null, waitingUnsub = null, roomMetaUnsub = null, presenceUnsub = null;
let chatClosed = false, cleaning = false, searchCancelled = false;
let presenceHeartbeatInterval = null, waitingHeartbeatInterval = null;

const PRESENCE_PING_INTERVAL = 8000;
const PRESENCE_STALE_MS      = 25000;
const WAITING_HEARTBEAT_INTERVAL = 8000;
const WAITING_STALE_MS         = 30000;

/* ---------- утилиты ---------- */
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');

/* ---------- шапка (без изменений) ---------- */
logoutBtn?.addEventListener("click", async e => {
  e.preventDefault();
  if (roomId && !chatClosed) {
    chatClosed = true;
    await set(ref(rtdb, `rooms/${roomId}/meta/closed`), true);
  }
  await clearAllListenersAndState();
  clearRoomStorage();
  await auth.signOut();
  localStorage.removeItem("userAvatarLetter");
  window.location.reload();
});
window.toggleMenu = () => document.querySelector(".nav-links").classList.toggle('open');
window.toggleUserMenu = () => userMenu.classList.toggle('open');

/* ---------- хранилище комнаты ---------- */
function saveRoomToStorage(rId, pId) {
  if (rId) localStorage.setItem('roomId', rId); else localStorage.removeItem('roomId');
  if (pId) localStorage.setItem('partnerId', pId); else localStorage.removeItem('partnerId');
}
function loadRoomFromStorage() {
  return { roomId: localStorage.getItem('roomId'), partnerId: localStorage.getItem('partnerId') };
}
function clearRoomStorage() {
  localStorage.removeItem('roomId');
  localStorage.removeItem('partnerId');
}

/* ---------- авторизация + восстановление сессии ---------- */
onAuthStateChanged(auth, user => {
  if (!user) { signInAnonymously(auth); return; }
  uid = user.uid;
  isRealUser = !!user.email;
  if (isRealUser) {
    regBtn?.classList.add("hidden");
    avatar?.classList.remove("hidden");
    const letter = user.email.charAt(0).toUpperCase();
    avatarLetter.textContent = letter;
    localStorage.setItem("userAvatarLetter", letter);
  } else {
    regBtn?.classList.remove("hidden");
    avatar?.classList.add("hidden");
    localStorage.removeItem("userAvatarLetter");
  }

  /* ставим onDisconnect только теперь */
  myWaitingRef = ref(rtdb, `waiting/${uid}`);
  onDisconnect(myWaitingRef).remove();

  const saved = loadRoomFromStorage();
  if (saved.roomId) connectToRoom(saved.roomId);
  else startSearch();
});

/* ---------- сообщения ---------- */
function clearMessages() { messagesEl.innerHTML = ''; }
function addMessageToUI(data) {
  const { sender, text, type, createdAt } = data;
  const isOwn = sender === uid;
  const wrap = document.createElement('div');
  wrap.className = 'msg-row ' + (isOwn ? 'own' : 'other');
  const msg = document.createElement('div');
  msg.className = 'message' + (isOwn ? ' own' : '');
  if (type === 'image') {
    const img = document.createElement('img');
    img.src = text; img.style.maxWidth = '320px'; img.style.borderRadius = '8px';
    msg.appendChild(img);
  } else msg.textContent = text;
  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  const time = createdAt
    ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  meta.textContent = time;
  msg.appendChild(meta);
  wrap.appendChild(msg);
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function sendMessageToRoom(text, type = 'text') {
  if (!roomId) return;
  await push(ref(rtdb, `rooms/${roomId}/messages`), {
    sender: uid,
    text,
    type,
    createdAt: Date.now()
  });
}

/* ---------- компоненты UI ---------- */
sendBtn.addEventListener('click', () => {
  const txt = textInput.value.trim(); if (!txt) return;
  textInput.value = '';
  sendMessageToRoom(txt, 'text').catch(console.error);
});
textInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const txt = textInput.value.trim(); if (!txt) return;
    textInput.value = '';
    sendMessageToRoom(txt, 'text').catch(console.error);
  }
});
photoBtn.addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', e => {
  const file = e.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => sendMessageToRoom(ev.target.result, 'image').catch(console.error);
  reader.readAsDataURL(file);
  photoInput.value = '';
});
emojiBtn.addEventListener('click', () => {
  emojiPanel.classList.toggle('hidden');
  emojiPanel.setAttribute('aria-hidden', emojiPanel.classList.contains('hidden'));
});
document.querySelectorAll('.emoji').forEach(b => {
  b.addEventListener('click', () => { textInput.value += b.textContent; textInput.focus(); });
});
document.addEventListener('click', e => {
  if (emojiPanel.classList.contains('hidden')) return;
  if (e.target === emojiBtn || emojiPanel.contains(e.target)) return;
  emojiPanel.classList.add('hidden');
});

/* ---------- waiting (очередь) ---------- */
async function startWaitingHeartbeat() {
  if (!myWaitingRef) return;
  await set(myWaitingRef, { lastSeen: Date.now() });
  if (waitingHeartbeatInterval) clearInterval(waitingHeartbeatInterval);
  waitingHeartbeatInterval = setInterval(() => {
    set(myWaitingRef, { lastSeen: Date.now() });
  }, WAITING_HEARTBEAT_INTERVAL);
}
function stopWaitingHeartbeat() {
  if (waitingHeartbeatInterval) { clearInterval(waitingHeartbeatInterval); waitingHeartbeatInterval = null; }
}

/* ---------- поиск собеседника ---------- */
async function startSearch() {
  const saved = loadRoomFromStorage(); if (saved.roomId) return;
  chatClosed = false; clearAllListenersAndState(); clearMessages();
  show(searchScreen); hide(chatWindow); hide(endScreen);
  statusText.textContent = 'Ищем собеседника...';

  myWaitingRef = ref(rtdb, `waiting/${uid}`);
  await set(myWaitingRef, { uid, claimed: false, roomId: null, lastSeen: Date.now() });
  /* onDisconnect уже вызван в onAuthStateChanged */

  /* слушаем свою запись */
  onValue(myWaitingRef, snap => {
    if (!snap.exists()) return;
    const data = snap.val();
    if (data.claimed && data.roomId) {
      roomId = data.roomId;
      saveRoomToStorage(roomId, null);
      connectToRoom(roomId);
    }
  });

  startWaitingHeartbeat();

  /* слушаем свободных */
  const qFree = query(ref(rtdb, 'waiting'), orderByChild('claimed'), equalTo(false), limitToLast(20));
  waitingUnsub = onValue(qFree, async snap => {
    const now = Date.now();
    let other = null;
    snap.forEach(c => {
      const d = c.val();
      if (d.uid === uid) return;
      const ls = d.lastSeen || 0;
      if (now - ls > WAITING_STALE_MS) return;
      other = { ref: c.ref, val: d };
    });
    if (!other) return;

    /* транзакция RTDB */
    const newRoomId = `${uid}_${other.val.uid}_${Date.now()}`;
    const updates = {};
    updates[`waiting/${uid}/claimed`]   = true;
    updates[`waiting/${uid}/roomId`]    = newRoomId;
    updates[`waiting/${other.val.uid}/claimed`] = true;
    updates[`waiting/${other.val.uid}/roomId`]  = newRoomId;
    updates[`rooms/${newRoomId}/meta`] = {
      participants: [uid, other.val.uid],
      createdAt: Date.now(),
      closed: false
    };
    await set(ref(rtdb), updates);
  });
}

/* ---------- подключаемся к комнате ---------- */
function connectToRoom(rId) {
  roomId = rId; saveRoomToStorage(roomId, null);
  hide(searchScreen); show(chatWindow); hide(endScreen);
  statusText.textContent = 'Соединено';

  /* слушаем meta */
  roomMetaUnsub = onValue(ref(rtdb, `rooms/${roomId}/meta`), snap => {
    if (!snap.exists() || snap.val().closed) {
      chatClosed = true; if (messagesUnsub) messagesUnsub(); endChatUI();
    } else {
      const parts = snap.val().participants || [];
      partnerId = parts.find(p => p !== uid) || null;
      saveRoomToStorage(roomId, partnerId);
    }
  });

  /* слушаем сообщения */
  const msgRef = query(ref(rtdb, `rooms/${roomId}/messages`), limitToLast(100));
  messagesUnsub = onValue(msgRef, snap => {
    if (chatClosed) return;
    messagesEl.innerHTML = '';
    snap.forEach(c => addMessageToUI(c.val()));
  });

  /* presence */
  const myPresRef = ref(rtdb, `rooms/${roomId}/presence/${uid}`);
  set(myPresRef, { lastSeen: Date.now() });
  onDisconnect(myPresRef).remove();
  if (presenceHeartbeatInterval) clearInterval(presenceHeartbeatInterval);
  presenceHeartbeatInterval = setInterval(() => set(myPresRef, { lastSeen: Date.now() }), PRESENCE_PING_INTERVAL);

  presenceUnsub = onValue(ref(rtdb, `rooms/${roomId}/presence`), snap => {
    const now = Date.now();
    const alive = [];
    snap.forEach(c => {
      const ls = (c.val().lastSeen || 0);
      if (now - ls < PRESENCE_STALE_MS) alive.push(c.key);
    });
    if (alive.length === 0) fullRoomCleanup().catch(() => {});
  });
}

/* ---------- выход / завершение ---------- */
async function finishChat() {
  endChatUI();
  if (roomId) await set(ref(rtdb, `rooms/${roomId}/meta/closed`), true);
  if (messagesUnsub) { messagesUnsub(); messagesUnsub = null; }
  clearRoomStorage();
  setTimeout(() => deleteRoomFully(roomId), 300);
}
function endChatUI() { connectedStopUI(); statusText.textContent = 'Чат завершен'; }
function connectedStopUI() { hide(searchScreen); hide(chatWindow); show(endScreen); }

async function clearAllListenersAndState() {
  if (messagesUnsub)  { messagesUnsub();  messagesUnsub  = null; }
  if (roomMetaUnsub)  { roomMetaUnsub();  roomMetaUnsub  = null; }
  if (waitingUnsub)   { waitingUnsub();   waitingUnsub   = null; }
  if (presenceUnsub)  { presenceUnsub();  presenceUnsub  = null; }
  if (presenceHeartbeatInterval)  { clearInterval(presenceHeartbeatInterval);  presenceHeartbeatInterval  = null; }
  if (waitingHeartbeatInterval)   { clearInterval(waitingHeartbeatInterval);   waitingHeartbeatInterval   = null; }

  if (myWaitingRef) {
    await remove(myWaitingRef).catch(() => {});
    myWaitingRef = null;
  }
  if (roomId && uid) {
    await remove(ref(rtdb, `rooms/${roomId}/presence/${uid}`)).catch(() => {});
  }
  messagesEl.innerHTML = '';
  roomId = null; partnerId = null;
}

async function fullRoomCleanup() {
  if (roomId && uid) await remove(ref(rtdb, `rooms/${roomId}/presence/${uid}`)).catch(() => {});
}

/* ---------- авто-удаление комнаты целиком ---------- */
async function deleteRoomFully(rId) {
  if (!rId) return;
  const batch = {};
  const snap = await get(ref(rtdb, `rooms/${rId}`));
  if (!snap.exists()) return;
  const data = snap.val();
  const parts = data.meta?.participants || [];
  parts.forEach(p => { batch[`waiting/${p}`] = null; });
  batch[`rooms/${rId}`] = null;
  await set(ref(rtdb), batch);
}

/* ---------- beforeunload / visibility ---------- */
window.addEventListener('beforeunload', async () => {
  if (myWaitingRef) await remove(myWaitingRef).catch(() => {});
  if (roomId && uid) {
    await remove(ref(rtdb, `rooms/${roomId}/presence/${uid}`)).catch(() => {});
    const metaSnap = await get(ref(rtdb, `rooms/${roomId}/meta`));
    if (metaSnap.exists()) {
      const parts = metaSnap.val().participants || [];
      const rest = parts.filter(p => p !== uid);
      if (rest.length) {
        await set(ref(rtdb, `rooms/${roomId}/meta/participants`), rest);
      } else {
        await deleteRoomFully(roomId);
      }
    }
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (myWaitingRef) remove(myWaitingRef).catch(() => {});
    if (roomId && uid) remove(ref(rtdb, `rooms/${roomId}/presence/${uid}`)).catch(() => {});
  } else {
    if (!roomId && !myWaitingRef) startSearch();
  }
});

/* ---------- кнопки ---------- */
finishBtn.addEventListener('click', () => modal.classList.remove('hidden'));
modalCancel.addEventListener('click', () => modal.classList.add('hidden'));
modalFinish.addEventListener('click', async () => { modal.classList.add('hidden'); await finishChat(); });
newChatBtn.addEventListener('click', async () => { searchCancelled = false; await fullRoomCleanup(); await clearAllListenersAndState(); clearRoomStorage(); startSearch(); });
cancelSearch.addEventListener('click', async () => { searchCancelled = true; if (myWaitingRef) await remove(myWaitingRef).catch(() => {}); hide(searchScreen); show(endScreen); statusText.textContent = 'Поиск отменён'; });
exitBtn.addEventListener('click', e => { e.preventDefault(); if (myWaitingRef) remove(myWaitingRef).catch(() => {}); if (roomId && uid) remove(ref(rtdb, `rooms/${roomId}/presence/${uid}`)).catch(() => {}); clearAllListenersAndState(); clearRoomStorage(); window.location.replace('/anonymous/'); });

/* ---------- старт ---------- */
setTimeout(() => {
  const url = new URL(location.href);
  const rId = url.searchParams.get('room');
  if (rId) connectToRoom(rId); else startSearch();
}, 600);
