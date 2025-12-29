/********************************************************************
 * 1-to-1 анонимный чат на Realtime Database
 * Firestore используется ТОЛЬКО для аватарки/никнейма
 *******************************************************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

/* ==========  RTDB  ========== */
import {
  getDatabase,
  ref,
  set,
  update,
  push,
  onValue,
  off,
  remove,
  query,
  orderByChild,
  limitToLast
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

/* ==========  Firestore (только для аватарки)  ========== */
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBWlR4QWdnbqXLKKaftEAzhXneTmV9xXX0",
  authDomain: "stillylink-f1d0f.firebaseapp.com",
  projectId: "stillylink-f1d0f",
  storageBucket: "stillylink-f1d0f.appspot.com",
  messagingSenderId: "772070114710",
  appId: "1:772070114710:web:939bce83e4d3be14bdc9b7",
  databaseURL: "https://stillylink-f1d0f-default-rtdb.europe-west1.firebasedatabase.app/"
};

const app   = initializeApp(firebaseConfig);
const auth  = getAuth(app);
const db    = getFirestore(app);          // только для профиля
const rdb   = getDatabase(app);           // чат полностью тут

/* ---------- UI-элементы (без изменений) ---------- */
const searchScreen   = document.getElementById('searchScreen');
const chatWindow     = document.getElementById('chatWindow');
const endScreen      = document.getElementById('endScreen');
const messagesEl     = document.getElementById('messages');
const textInput      = document.getElementById('textInput');
const sendBtn        = document.getElementById('sendBtn');
const finishBtn      = document.getElementById('finishBtn');
const modal          = document.getElementById('modal');
const modalCancel    = document.getElementById('modalCancel');
const modalFinish    = document.getElementById('modalFinish');
const newChatBtn     = document.getElementById('newChatBtn');
const emojiBtn       = document.getElementById('emojiBtn');
const emojiPanel     = document.getElementById('emojiPanel');
const photoBtn       = document.getElementById('photoBtn');
const photoInput     = document.getElementById('photoInput');
const cancelSearch   = document.getElementById('cancelSearch');
const statusText     = document.getElementById('statusText');
const exitBtn        = document.getElementById('exitBtn');

const regBtn        = document.querySelector(".register-btn");
const avatar        = document.querySelector(".user-avatar");
const avatarLetter  = document.querySelector(".user-avatar span");
const userMenu      = document.querySelector(".user-menu");
const logoutBtn     = document.getElementById("logoutBtn");

/* ---------- глобальные переменные ---------- */
let uid              = null;
let isRealUser       = false;
let myWaitingRefRDB  = null;   // RTDB ref /waiting/{uid}
let roomRefRDB       = null;   // RTDB ref /rooms/{roomId}
let roomId           = null;
let partnerId        = null;
let messagesUnsub    = null;   // off() для messages
let roomMetaUnsub    = null;   // off() для meta
let presenceUnsub    = null;   // off() для presence
let presenceInterval = null;
let chatClosed       = false;
let cleaning         = false;
let searchCancelled  = false;

const PRESENCE_PING_MS  = 8000;
const PRESENCE_STALE_MS = 25000;
const WAITING_STALE_MS  = 30000;

/* ---------- вспомогательные функции ---------- */
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');

function saveRoomToStorage(rId, pId){
  if(rId) localStorage.setItem('roomId', rId);
  else localStorage.removeItem('roomId');
  if(pId) localStorage.setItem('partnerId', pId);
  else localStorage.removeItem('partnerId');
}
function loadRoomFromStorage(){
  return {
    roomId: localStorage.getItem('roomId'),
    partnerId: localStorage.getItem('partnerId')
  };
}
function clearRoomStorage(){
  localStorage.removeItem('roomId');
  localStorage.removeItem('partnerId');
}

/* ---------- инициализация профиля (Firestore) ---------- */
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

  const saved = loadRoomFromStorage();
  if(saved.roomId){
    const metaRef = ref(rdb, `rooms/${saved.roomId}/meta`);
    onValue(metaRef, snap => {
      if(snap.exists() && !snap.val().closed){
        roomId = saved.roomId; partnerId = saved.partnerId;
        connectToRoom(saved.roomId);
      }else{
        clearRoomStorage(); startSearch();
      }
    }, { onlyOnce: true });
  } else startSearch();
});

/* ---------- отрисовка сообщений ---------- */
function clearMessages(){ messagesEl.innerHTML = ''; }

function addMessageToUI(data){
  const { sender, text, type, createdAt } = data;
  const isOwn = sender === uid;
  const wrap = document.createElement('div');
  wrap.className = 'msg-row ' + (isOwn ? 'own' : 'other');

  const msg = document.createElement('div');
  msg.className = 'message' + (isOwn ? ' own' : '');
  if (type === 'image') {
    const img = document.createElement('img');
    img.src = text;
    img.style.maxWidth = '320px';
    img.style.borderRadius = '8px';
    msg.appendChild(img);
  } else msg.textContent = text;

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  let time = '';
  try {
    time = new Date(createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  } catch(e){ time = ''; }
  meta.textContent = time;
  msg.appendChild(meta);
  wrap.appendChild(msg);
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/* ---------- отправка сообщений (RTDB) ---------- */
async function sendMessageToRoom(text, type = 'text'){
  if(!roomId) return;
  const msgRef = push(ref(rdb, `rooms/${roomId}/messages`));
  await set(msgRef, {
    sender: uid,
    text,
    type,
    createdAt: { '.sv': 'timestamp' }
  });
}

/* ---------- UI-обработчики (без изменений) ---------- */
sendBtn.addEventListener('click', ()=>{
  const txt = textInput.value.trim(); if(!txt) return;
  textInput.value = '';
  sendMessageToRoom(txt, 'text').catch(console.error);
});
textInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const txt = textInput.value.trim(); if(!txt) return;
    textInput.value = '';
    sendMessageToRoom(txt, 'text').catch(console.error);
  }
});
photoBtn.addEventListener('click', ()=> photoInput.click());
photoInput.addEventListener('change', e=>{
  const file = e.target.files?.[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ev => sendMessageToRoom(ev.target.result, 'image').catch(console.error);
  reader.readAsDataURL(file);
  photoInput.value = '';
});
emojiBtn.addEventListener('click', ()=> emojiPanel.classList.toggle('hidden'));
document.querySelectorAll('.emoji').forEach(b=>{
  b.addEventListener('click', ()=>{ textInput.value += b.textContent; textInput.focus(); });
});
document.addEventListener('click', e=>{
  if(emojiPanel.classList.contains('hidden')) return;
  if(e.target === emojiBtn || emojiPanel.contains(e.target)) return;
  emojiPanel.classList.add('hidden');
});

/* ---------- поиск собеседника (RTDB) ---------- */
async function startSearch(){
  const saved = loadRoomFromStorage();
  if(saved.roomId) return;

  chatClosed = false;
  await clearAllListenersAndState();
  clearMessages();
  show(searchScreen); hide(chatWindow); hide(endScreen);
  statusText.textContent = 'Ищем собеседника...';

  myWaitingRefRDB = ref(rdb, `waiting/${uid}`);
  await set(myWaitingRefRDB, {
    uid,
    claimed: false,
    roomId: null,
    lastSeen: { '.sv': 'timestamp' }
  });

  /* слушаем свою запись – если нас пригласили – заходим */
  onValue(myWaitingRefRDB, snap => {
    if(!snap.exists()) return;
    const d = snap.val();
    if(d.claimed && d.roomId){
      roomId = d.roomId;
      saveRoomToStorage(roomId, null);
      connectToRoom(roomId);
    }
  });

  /* сканер свободных – берём первого не себя */
  const waitingRef = ref(rdb, 'waiting');
  onValue(waitingRef, async snap => {
    if(snap.exists()){
      const now = Date.now();
      let other = null;
      snap.forEach(child => {
        const v = child.val();
        if(v.uid === uid || v.claimed) return;
        const ls = v.lastSeen || 0;
        if(now - ls > WAITING_STALE_MS) return;
        other = { key: child.key, val: v };
      });
      if(!other) return;

      /* транзакция – создаём комнату, обновляем waiting */
      const newRoomRef = push(ref(rdb, 'rooms'));
      const updates = {};
      updates[`waiting/${other.key}/claimed`] = true;
      updates[`waiting/${other.key}/roomId`]  = newRoomRef.key;
      updates[`waiting/${uid}/claimed`]       = true;
      updates[`waiting/${uid}/roomId`]        = newRoomRef.key;

      updates[`rooms/${newRoomRef.key}/meta`] = {
        participants: [uid, other.val.uid],
        createdAt: { '.sv': 'timestamp' },
        closed: false
      };
      await update(ref(rdb), updates);
      roomId = newRoomRef.key;
      saveRoomToStorage(roomId, null);
    }
  });
}

/* ---------- подключаемся к комнате ---------- */
function connectToRoom(rId){
  roomId = rId;
  saveRoomToStorage(roomId, null);
  hide(searchScreen); show(chatWindow); hide(endScreen);
  statusText.textContent = 'Соединено';

  /* слушаем meta */
  const metaRef = ref(rdb, `rooms/${roomId}/meta`);
  roomMetaUnsub = onValue(metaRef, snap => {
    if(!snap.exists() || snap.val().closed){
      chatClosed = true;
      if(messagesUnsub){ off(messagesUnsub); messagesUnsub = null; }
      endChatUI();
    } else {
      const parts = snap.val().participants || [];
      partnerId = parts.find(p => p !== uid) || null;
      saveRoomToStorage(roomId, partnerId);
    }
  });

  /* слушаем messages */
  const msgRef = ref(rdb, `rooms/${roomId}/messages`);
  messagesUnsub = onValue(query(msgRef, orderByChild('createdAt'), limitToLast(100), snap => {
    if(chatClosed) return;
    clearMessages();
    snap.forEach(child => addMessageToUI(child.val()));
  }));

  /* присутствие */
  setMyPresence();
  const presRef = ref(rdb, `rooms/${roomId}/presence`);
  presenceUnsub = onValue(presRef, snap => {
    const now = Date.now();
    let alive = 0;
    snap.forEach(child => {
      const ls = child.val().lastSeen || 0;
      if(now - ls < PRESENCE_STALE_MS) alive++;
    });
    if(!alive) fullRoomCleanup();
  });
}

function setMyPresence(){
  if(!roomId || !uid) return;
  const myPresRef = ref(rdb, `rooms/${roomId}/presence/${uid}`);
  set(myPresRef, { lastSeen: { '.sv': 'timestamp' } });
  if(presenceInterval) clearInterval(presenceInterval);
  presenceInterval = setInterval(() =>
    update(myPresRef, { lastSeen: { '.sv': 'timestamp' } }), PRESENCE_PING_MS);
}

/* ---------- завершение чата ---------- */
async function finishChat(){
  endChatUI();
  if(roomId){
    await update(ref(rdb, `rooms/${roomId}/meta`), { closed: true });
  }
  if(messagesUnsub){ off(messagesUnsub); messagesUnsub = null; }
  clearRoomStorage();
  setTimeout(async () => {
    /* удаляем всё под /rooms/{roomId} */
    await remove(ref(rdb, `rooms/${roomId}`)).catch(()=>{});
  }, 300);
}

function endChatUI(){
  hide(searchScreen); hide(chatWindow); show(endScreen);
  statusText.textContent = 'Чат завершен';
}

/* ---------- кнопки ---------- */
finishBtn.addEventListener('click', ()=> modal.classList.remove('hidden'));
modalCancel.addEventListener('click', ()=> modal.classList.add('hidden'));
modalFinish.addEventListener('click', async ()=>{ modal.classList.add('hidden'); await finishChat(); });
newChatBtn.addEventListener('click', async ()=>{
  searchCancelled = false;
  await clearAllListenersAndState();
  clearRoomStorage();
  startSearch();
});
cancelSearch.addEventListener('click', async ()=>{
  searchCancelled = true;
  if(myWaitingRefRDB) await remove(myWaitingRefRDB);
  hide(searchScreen); show(endScreen);
  statusText.textContent = 'Поиск отменён';
});

exitBtn.addEventListener('click', e => {
  e.preventDefault();
  handlePageExit();
  window.location.replace('/anonymous/');
});

/* ---------- очистка слушателей ---------- */
async function clearAllListenersAndState(){
  if(messagesUnsub){ off(messagesUnsub); messagesUnsub = null; }
  if(roomMetaUnsub){ off(roomMetaUnsub); roomMetaUnsub = null; }
  if(presenceUnsub){ off(presenceUnsub); presenceUnsub = null; }
  if(presenceInterval){ clearInterval(presenceInterval); presenceInterval = null; }
  if(myWaitingRefRDB){ await remove(myWaitingRefRDB); myWaitingRefRDB = null; }
  if(roomId && uid) await remove(ref(rdb, `rooms/${roomId}/presence/${uid}`)).catch(()=>{});
  messagesEl.innerHTML = '';
  roomId = null; partnerId = null;
}

async function fullRoomCleanup(){
  if(roomId && uid) await remove(ref(rdb, `rooms/${roomId}/presence/${uid}`)).catch(()=>{});
}

/* ---------- уход/возврат страницы ---------- */
const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);

async function handlePageExit(){
  if(cleaning) return; cleaning = true;
  const promises = [];
  if(isMobile && !chatClosed && !roomId && myWaitingRefRDB){
    promises.push(remove(myWaitingRefRDB));
    clearRoomStorage();
    myWaitingRefRDB = null;
  }
  if(roomId && uid) promises.push(remove(ref(rdb, `rooms/${roomId}/presence/${uid}`)));
  await Promise.all(promises);
}
async function handlePageReturn(){
  cleaning = false;
  if(!roomId){
    if(searchCancelled) return;
    if(!myWaitingRefRDB){ startSearch(); return; }
    const s = await (await get(ref(rdb, `waiting/${uid}`))).val();
    if(!s){ myWaitingRefRDB = null; startSearch(); }
  }
}
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'hidden') handlePageExit();
  else handlePageReturn();
});

window.addEventListener('beforeunload', async () => {
  if(myWaitingRefRDB) await remove(myWaitingRefRDB).catch(()=>{});
  if(roomId && uid){
    await remove(ref(rdb, `rooms/${roomId}/presence/${uid}`)).catch(()=>{});
    const metaSnap = await (await get(ref(rdb, `rooms/${roomId}/meta`))).val();
    if(metaSnap){
      const parts = metaSnap.participants || [];
      const left = parts.filter(p => p !== uid);
      if(left.length){
        await update(ref(rdb, `rooms/${roomId}/meta`), { participants: left });
      }else{
        await remove(ref(rdb, `rooms/${roomId}`));
      }
    }
  }
});

/* ---------- авто-чистка старых комнат (по желанию) ---------- */
setInterval(async () => {
  const now = Date.now();
  const roomsSnap = await (await get(ref(rdb, 'rooms'))).val();
  if(!roomsSnap) return;
  for(const [rid, data] of Object.entries(roomsSnap)){
    if(data.meta?.closed){
      await remove(ref(rdb, `rooms/${rid}`));
      continue;
    }
    const created = data.meta?.createdAt || 0;
    const lastMsg = data.messages ? Math.max(...Object.values(data.messages).map(m => m.createdAt || 0)) : 0;
    const lastActive = lastMsg || created;
    if(now - lastActive > 20*60*1000) await remove(ref(rdb, `rooms/${rid}`));
  }
}, 5*60*1000);
