import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js ";
import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js ";

import {
    getFirestore,
    collection,
    doc,
    setDoc,
    addDoc,
    serverTimestamp,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    runTransaction,
    deleteDoc,
    updateDoc,
    getDocs,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js ";

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

  const searchScreen = document.getElementById('searchScreen');
  const chatWindow = document.getElementById('chatWindow');
  const endScreen = document.getElementById('endScreen');
  const messagesEl = document.getElementById('messages');
  const textInput = document.getElementById('textInput');
  const sendBtn = document.getElementById('sendBtn');
  const finishBtn = document.getElementById('finishBtn');
  const modal = document.getElementById('modal');
  const modalCancel = document.getElementById('modalCancel');
  const modalFinish = document.getElementById('modalFinish');
  const newChatBtn = document.getElementById('newChatBtn');
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPanel = document.getElementById('emojiPanel');
  const photoBtn = document.getElementById('photoBtn');
  const photoInput = document.getElementById('photoInput');
  const cancelSearch = document.getElementById('cancelSearch');
  const statusText = document.getElementById('statusText');
  const exitBtn = document.getElementById('exitBtn');

const regBtn      = document.querySelector(".register-btn");
const avatar      = document.querySelector(".user-avatar");
const avatarLetter = document.querySelector(".user-avatar span");
const userMenu     = document.querySelector(".user-menu");
const logoutBtn    = document.getElementById("logoutBtn");

window.addEventListener("DOMContentLoaded", () => {
    const savedAvatar = localStorage.getItem("userAvatarLetter");

    if (savedAvatar) {
        regBtn?.classList.add("hidden");
        avatar?.classList.remove("hidden");
        avatarLetter.textContent = savedAvatar;
    }

    logoutBtn?.addEventListener("click", e => {
        e.preventDefault();
        localStorage.removeItem("userAvatarLetter");
        window.location.href = "/login/";
    });
});

function toggleMenu() {
    const menu = document.querySelector(".nav-links");
    menu.classList.toggle("open");
}
window.toggleMenu = toggleMenu;

document.addEventListener("click", e => {
    const menu   = document.querySelector(".nav-links");
    const toggle = document.querySelector(".nav-toggle");

    if (!menu.classList.contains("open")) return;
    if (menu.contains(e.target) || toggle.contains(e.target)) return;

    menu.classList.remove("open");
});

function toggleUserMenu() {
    userMenu.classList.toggle("open");
}
window.toggleUserMenu = toggleUserMenu;

document.addEventListener("click", e => {
    if (!userMenu.classList.contains("open")) return;
    if (userMenu.contains(e.target) || avatar.contains(e.target)) return;
    userMenu.classList.remove("open");
});


  let uid = null;
  let isRealUser = false;
  let myWaitingRef = null;
  let myWaitingUnsub = null;
  let roomRef = null;
  let roomId = null;
  let partnerId = null;
  let messagesUnsub = null;
  let waitingUnsub = null;
  let roomMetaUnsub = null;   // ← новый слушатель мета-данных комнаты
  let presenceUnsub = null;
  let presenceHeartbeatInterval = null;
  let chatClosed = false;

  let waitingHeartbeatInterval = null;
  let cleanupWaitingInterval = null;

  const PRESENCE_PING_INTERVAL = 8000;
  const PRESENCE_STALE_MS = 25000;

  const WAITING_HEARTBEAT_INTERVAL = 8000;
  const WAITING_STALE_MS = 30000;

  function show(el){ el.classList.remove('hidden'); }
  function hide(el){ el.classList.add('hidden'); }


// =================== ХРАНИЛИЩЕ КОМНАТЫ ====================
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
// =========================================================

onAuthStateChanged(auth, user => {
    if (!user) {
        // совсем нет акка – анонимно, НО не показываем в UI
        signInAnonymously(auth);
        return;
    }

    uid = user.uid;

    // считаем «реальным» только если у него есть email
    isRealUser = !!user.email;

    if (isRealUser) {
        regBtn?.classList.add("hidden");
        avatar?.classList.remove("hidden");
        const letter = user.email.charAt(0).toUpperCase();
        avatarLetter.textContent = letter;
        localStorage.setItem("userAvatarLetter", letter);
    } else {
        // технический аноним – оставляем кнопку «Войти»
        regBtn?.classList.remove("hidden");
        avatar?.classList.add("hidden");
        localStorage.removeItem("userAvatarLetter");
    }

    // дальше одинаково для всех
    const saved = loadRoomFromStorage();
    if(saved.roomId){
        const rRef = doc(db, 'rooms', saved.roomId);
        getDoc(rRef).then(snap=>{
            if(snap.exists() && !snap.data().closed){
                roomRef = rRef; roomId = saved.roomId; partnerId = saved.partnerId;
                connectToRoom(roomRef);
            }else{
                clearRoomStorage(); startSearch();
            }
        });
    } else {
        startSearch();
    }
});

function clearMessages(){ messagesEl.innerHTML = ''; }
  function addMessageToUI(data){
    const { sender, text, type, createdAt } = data;
    const wrap = document.createElement('div');
    const isOwn = sender === uid;
    wrap.className = 'msg-row ' + (isOwn ? 'own' : 'other');

    const msg = document.createElement('div');
    msg.className = 'message' + (isOwn ? ' own' : '');
    if (type === 'image') {
      const img = document.createElement('img');
      img.src = text;
      img.style.maxWidth = '320px';
      img.style.borderRadius = '8px';
      msg.appendChild(img);
    } else {
      msg.textContent = text;
    }

    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    let time = '';
    try {
      if (createdAt && createdAt.toDate) time = createdAt.toDate().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      else time = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    } catch(e){ time = ''; }
    meta.textContent = time;
    msg.appendChild(meta);

    wrap.appendChild(msg);
    messagesEl.appendChild(wrap);

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function sendMessageToRoom(text, type = 'text'){
    if(!roomRef) return;
    const messagesCol = collection(roomRef, 'messages');
    await addDoc(messagesCol, {
      sender: uid,
      text,
      type,
      createdAt: serverTimestamp()
    });
  }

  photoBtn.addEventListener('click', ()=> photoInput.click());
  photoInput.addEventListener('change', (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(ev){
      const dataUrl = ev.target.result;
      sendMessageToRoom(dataUrl, 'image').catch(console.error);
    };
    reader.readAsDataURL(file);
    photoInput.value = '';
  });

  sendBtn.addEventListener('click', ()=>{
    const txt = textInput.value.trim();
    if(!txt) return;
    sendMessageToRoom(txt, 'text').then(()=>{ textInput.value = ''; });
  });

  textInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      sendBtn.click();
    }
  });

  emojiBtn.addEventListener('click', (e)=>{
    emojiPanel.classList.toggle('hidden');
    emojiPanel.setAttribute('aria-hidden', emojiPanel.classList.contains('hidden'));
  });
  document.querySelectorAll('.emoji').forEach(b=>{
    b.addEventListener('click', ()=>{
      textInput.value += b.textContent;
      textInput.focus();
    });
  });
  document.addEventListener('click', (e)=>{
    if(emojiPanel.classList.contains('hidden')) return;
    if(e.target === emojiBtn || emojiPanel.contains(e.target)) return;
    emojiPanel.classList.add('hidden');
  });

  async function startWaitingHeartbeat() {
    if (!myWaitingRef || !uid) return;
    try {
      await updateDoc(myWaitingRef, { lastSeen: serverTimestamp() }).catch(async (err) => {
        await setDoc(myWaitingRef, { uid, createdAt: serverTimestamp(), claimed: false, roomId: null, lastSeen: serverTimestamp() }, { merge: true });
      });
    } catch (e) {}

    if (waitingHeartbeatInterval) clearInterval(waitingHeartbeatInterval);
    waitingHeartbeatInterval = setInterval(async () => {
      try {
        await updateDoc(myWaitingRef, { lastSeen: serverTimestamp() });
      } catch (e) {}
    }, WAITING_HEARTBEAT_INTERVAL);
  }

  function stopWaitingHeartbeat() {
    if (waitingHeartbeatInterval) { clearInterval(waitingHeartbeatInterval); waitingHeartbeatInterval = null; }
    if (cleanupWaitingInterval) { clearInterval(cleanupWaitingInterval); cleanupWaitingInterval = null; }
  }

  async function cleanupStaleWaitingDocs() {
    try {
      const q = query(collection(db, 'waiting'), orderBy('lastSeen'), limit(50));
      const snap = await getDocs(q);
      const now = Date.now();
      for (const d of snap.docs) {
        const data = d.data();
        const ls = data.lastSeen?.toMillis ? data.lastSeen.toMillis() : (data.lastSeen ? new Date(data.lastSeen).getTime() : 0);
        const claimed = !!data.claimed;
        if (!claimed && ls && (now - ls) > WAITING_STALE_MS) {
          try { await deleteDoc(d.ref); } catch(e){}
        }
      }
    } catch (e) {}
  }

  async function startSearch(){
    const saved = loadRoomFromStorage();
    if(saved.roomId) return;

    chatClosed = false;
      
    clearAllListenersAndState();
    clearMessages();
    show(searchScreen);
    hide(chatWindow);
    hide(endScreen);
    statusText.textContent = 'Ищем собеседника...';

    try {
      const qMy = query(collection(db, 'waiting'), where('uid', '==', uid), where('claimed', '==', false), limit(1));
      const snap = await getDocs(qMy);
      if (!snap.empty) {
        myWaitingRef = snap.docs[0].ref;
        await setDoc(myWaitingRef, { uid, claimed: false, roomId: null }, { merge: true });
      } else {
        myWaitingRef = doc(db, 'waiting', uid);
        await setDoc(myWaitingRef, { uid, createdAt: serverTimestamp(), claimed: false, roomId: null, lastSeen: serverTimestamp() });
      }
    } catch (e) {
      myWaitingRef = doc(db, 'waiting', uid);
      await setDoc(myWaitingRef, { uid, createdAt: serverTimestamp(), claimed: false, roomId: null, lastSeen: serverTimestamp() });
    }

    if (myWaitingUnsub) myWaitingUnsub();
    myWaitingUnsub = onSnapshot(myWaitingRef, (snap) => {
      if(!snap.exists()) return;
      const data = snap.data();
      if(data.claimed && data.roomId){
        roomId = data.roomId;
        roomRef = doc(db, 'rooms', roomId);
        saveRoomToStorage(roomId, null);
        connectToRoom(roomRef).catch(console.warn);
      }
    });

    startWaitingHeartbeat();

    const q = query(collection(db, 'waiting'), where('claimed', '==', false), limit(20));
    if (waitingUnsub) waitingUnsub();
    waitingUnsub = onSnapshot(q, async (snap) => {
      if (!snap.empty) {
        const now = Date.now();
        let otherDoc = null;
        for (const d of snap.docs) {
          const data = d.data();
          if (data.uid && data.uid === uid) continue;
          const ls = data.lastSeen?.toMillis ? data.lastSeen.toMillis() : (data.lastSeen ? new Date(data.lastSeen).getTime() : (data.createdAt?.toMillis ? data.createdAt.toMillis() : 0));
          if (!ls || (now - ls) > WAITING_STALE_MS) continue;
          otherDoc = d;
          break;
        }
        if (!otherDoc) return;

        try {
          const result = await runTransaction(db, async (txn) => {
            const otherRef = otherDoc.ref;
            const otherSnap = await txn.get(otherRef);
            const mineSnap = await txn.get(myWaitingRef);

            if (!otherSnap.exists()) return null;
            if (!mineSnap.exists()) return null;
            if (otherSnap.data().claimed === true) throw 'other claimed';
            if (mineSnap.data().claimed === true) throw 'mine claimed';

            const otherLast = otherSnap.data().lastSeen;
            const otherLastMs = otherLast?.toMillis ? otherLast.toMillis() : (otherLast ? new Date(otherLast).getTime() : 0);
            if (!otherLastMs || (Date.now() - otherLastMs) > WAITING_STALE_MS) throw 'other stale';

            const newRoomRef = doc(collection(db, 'rooms'));
            const otherUid = otherSnap.data().uid;

            txn.set(newRoomRef, {
              participants: [uid, otherUid],
              createdAt: serverTimestamp(),
              closed: false
            });

            txn.update(otherRef, { claimed: true, roomId: newRoomRef.id });
            txn.update(myWaitingRef, { claimed: true, roomId: newRoomRef.id });

            return { roomId: newRoomRef.id };
          });

          if(result && result.roomId){
            roomId = result.roomId;
            roomRef = doc(db, 'rooms', roomId);
            saveRoomToStorage(roomId, null);
            stopWaitingHeartbeat();
            await connectToRoom(roomRef);
          }
        } catch (err) {
          console.log('Matchmaking transaction skipped (race condition):', err);
        }
      }
    });
  }

  async function connectToRoom(roomDocumentRef){
    try {
      if(!roomDocumentRef) return;
      if(roomId && roomId !== roomDocumentRef.id){
        await clearAllListenersAndState();
      }

      if(roomRef && roomRef.path === roomDocumentRef.path && roomMetaUnsub) {
        console.log('already connected to room');
        return;
      }

      roomRef = roomDocumentRef;
      roomId = roomDocumentRef.id;
      saveRoomToStorage(roomId, partnerId);

      hide(searchScreen);
      show(chatWindow);
      hide(endScreen);
      statusText.textContent = 'Соединено';

      try {
        await runTransaction(db, async txn => {
          const rSnap = await txn.get(roomRef);
          if(!rSnap.exists()) throw 'room gone';
          const data = rSnap.data();
          const parts = data.participants || [];
          if(!parts.includes(uid) && parts.length < 2){
            parts.push(uid);
            txn.update(roomRef, { participants: parts });
          }
        });
      } catch(e){}

      // мгновенный слушатель мета-документа комнаты
      if(roomMetaUnsub) roomMetaUnsub();
roomMetaUnsub = onSnapshot(roomRef, (snap) => {
  if(!snap.exists() || snap.data().closed){
    chatClosed = true;
    if(messagesUnsub){
      messagesUnsub();
      messagesUnsub = null;
    }
    endChatUI();               // теперь показываем финальный экран
  } else {
    const participants = snap.data().participants || [];
    partnerId = participants.find(p => p !== uid) || null;
    saveRoomToStorage(roomId, partnerId);
  }
});

      const messagesCol = collection(roomRef, 'messages');
      const msgsQuery = query(messagesCol, orderBy('createdAt'));
    messagesUnsub = onSnapshot(msgsQuery, (snap) => {
     if(chatClosed) return;   // <-- добавили
     messagesEl.innerHTML = '';
     snap.docs.forEach(d => {
       addMessageToUI(d.data());
     });
   });

      await setMyPresence();
      const presCol = collection(roomRef, 'presence');
      presenceUnsub = onSnapshot(presCol, async (snap) => {
        const docs = snap.docs.map(d=>({ id: d.id, data: d.data() }));
        const now = Date.now();
        const alive = docs.filter(d => {
          const ls = d.data.lastSeen?.toMillis ? d.data.lastSeen.toMillis() : (d.data.lastSeen ? new Date(d.data.lastSeen).getTime() : 0);
          return (now - ls) < PRESENCE_STALE_MS;
        });

        if(alive.length === 0){
          try {
            await fullRoomCleanup();
          } catch(e){}
        }
      });

    } catch(err){
      console.error('connectToRoom error', err);
    }
  }
  
  async function setMyPresence(){
    if(!roomRef || !uid) return;
    const presRef = doc(roomRef, 'presence', uid);
    try {
      await setDoc(presRef, { lastSeen: serverTimestamp() });
    } catch(e){
      console.warn('set presence failed', e);
    }
    if(presenceHeartbeatInterval) clearInterval(presenceHeartbeatInterval);
    presenceHeartbeatInterval = setInterval(async ()=>{
      try {
        await updateDoc(presRef, { lastSeen: serverTimestamp() });
      } catch(e){}
    }, PRESENCE_PING_INTERVAL);
  }

  async function tryJoinSavedRoom(rRef, savedPartner){
    try {
      const rSnap = await getDoc(rRef);
      if(!rSnap.exists()) {
        clearRoomStorage();
        startSearch();
        return;
      }
      const data = rSnap.data();
      if(data.closed){
        clearRoomStorage();
        startSearch();
        return;
      }
      await runTransaction(db, async txn => {
        const roomSnap = await txn.get(rRef);
        if(!roomSnap.exists()) throw 'no room';
        const parts = roomSnap.data().participants || [];
        if(!parts.includes(uid) && parts.length < 2){
          parts.push(uid);
          txn.update(rRef, { participants: parts });
        }
      });
      roomRef = rRef;
      roomId = rRef.id;
      partnerId = savedPartner;
      await connectToRoom(roomRef);
    } catch(e){
      console.warn('tryJoinSavedRoom failed', e);
      clearRoomStorage();
      startSearch();
    }
  }

async function finishChat() {
  // 1. Показываем экран завершения на своей стороне немедленно
  endChatUI();

  // 2. Ставим room.closed = true (оба клиента сразу увидят закрытие)
  if (roomRef) {
    await updateDoc(roomRef, { closed: true }).catch(()=>{});
  }

  // 3. Останавливаем прослушку, чтобы не видеть удаление сообщений
  if (messagesUnsub) { messagesUnsub(); messagesUnsub = null; }

  // 4. Сохраняем сохранённое roomId, чтобы очистки не запустились повторно
  clearRoomStorage();

  // 5. Задержка, чтобы второй пользователь тоже успел переключиться на экран завершения
  setTimeout(async () => {
    if (roomRef) {
      // чистим waiting
      const snap = await getDoc(roomRef);
      if (snap.exists()) {
        const parts = snap.data().participants || [];
        for (const p of parts) {
          await deleteDoc(doc(db, 'waiting', p)).catch(()=>{});
        }
      }

      // удаляем подколлекции
      const msgsSnap = await getDocs(collection(roomRef, 'messages'));
      for (const m of msgsSnap.docs) await deleteDoc(m.ref).catch(()=>{});

      const presSnap = await getDocs(collection(roomRef, 'presence'));
      for (const p of presSnap.docs) await deleteDoc(p.ref).catch(()=>{});

      // удаляем комнату
      await deleteDoc(roomRef).catch(()=>{});
    }
  }, 300);
}

function endChatUI(){
  connectedStopUI();          // просто показать экран «Чат завершён»
  statusText.textContent = 'Чат завершен';
}

  function connectedStopUI(){
    hide(searchScreen);
    hide(chatWindow);
    show(endScreen);
  }

  async function cancelSearchHandler(){
    if(myWaitingRef){
      try { await deleteDoc(myWaitingRef); } catch(e){}
      myWaitingRef = null;
    }
    if(myWaitingUnsub){ myWaitingUnsub(); myWaitingUnsub = null; }
    if(waitingUnsub){ waitingUnsub(); waitingUnsub = null; }
    hide(searchScreen);
    show(endScreen);
    statusText.textContent = 'Поиск отменён';
  }

  async function clearAllListenersAndState(){
    if(messagesUnsub){ messagesUnsub(); messagesUnsub = null; }
    if(roomMetaUnsub){ roomMetaUnsub(); roomMetaUnsub = null; }
    if(waitingUnsub){ waitingUnsub(); waitingUnsub = null; }
    if(myWaitingUnsub){ myWaitingUnsub(); myWaitingUnsub = null; }
    if(presenceUnsub){ presenceUnsub(); presenceUnsub = null; }
    if(presenceHeartbeatInterval){ clearInterval(presenceHeartbeatInterval); presenceHeartbeatInterval = null; }
    stopWaitingHeartbeat();

    if(myWaitingRef){
      try {
        const snap = await getDoc(myWaitingRef);
        if(snap.exists()){
          const d = snap.data();
          if(!d.claimed) {
            await deleteDoc(myWaitingRef);
          } else {
            await deleteDoc(myWaitingRef).catch(()=>{});
          }
        }
      } catch(e){
        console.warn('clear waiting doc error', e);
      }
      myWaitingRef = null;
    }
    if(roomRef && uid){
      try { await deleteDoc(doc(roomRef, 'presence', uid)).catch(()=>{}); } catch(e){}
    }

    messagesEl.innerHTML = '';
    roomRef = null; roomId = null; partnerId = null;
  }

  async function fullRoomCleanup(){
    // только best-effort убрать свою presence
    if(roomRef && uid){
      await deleteDoc(doc(roomRef,'presence',uid)).catch(()=>{});
    }
  }

  window.addEventListener('beforeunload', async (ev) => {
    try {
      stopWaitingHeartbeat();
      if(myWaitingRef){
        await deleteDoc(myWaitingRef).catch(()=>{});
      }
      if(roomRef && uid){
        await deleteDoc(doc(roomRef, 'presence', uid)).catch(()=>{});
        try {
          const rSnap = await getDoc(roomRef);
          if(rSnap.exists()){
            const parts = rSnap.data().participants || [];
            const newParts = parts.filter(p => p !== uid);
            if(newParts.length === 0){
              const msgsSnap = await getDocs(collection(roomRef, 'messages'));
              for(const m of msgsSnap.docs) await deleteDoc(m.ref).catch(()=>{});
              await deleteDoc(roomRef).catch(()=>{});
            } else {
              await updateDoc(roomRef, { participants: newParts }).catch(()=>{});
            }
          }
        } catch(e){}
      }
    } catch(e){}
  });

  function connectedCleanup(){
    if(messagesUnsub){ messagesUnsub(); messagesUnsub = null; }
    if(roomMetaUnsub){ roomMetaUnsub(); roomMetaUnsub = null; }
    if(presenceUnsub){ presenceUnsub(); presenceUnsub = null; }
    if(presenceHeartbeatInterval){ clearInterval(presenceHeartbeatInterval); presenceHeartbeatInterval = null; }
  }

  finishBtn.addEventListener('click', ()=>{ modal.classList.remove('hidden'); });
  modalCancel.addEventListener('click', ()=>{ modal.classList.add('hidden'); });
  modalFinish.addEventListener('click', async ()=>{ modal.classList.add('hidden'); await finishChat(); });

  newChatBtn.addEventListener('click', async ()=>{ 
    await fullRoomCleanup();
    await clearAllListenersAndState();
    clearRoomStorage();
    startSearch();
  });

  cancelSearch.addEventListener('click', cancelSearchHandler);

exitBtn.addEventListener('click', function (e) {
  e.preventDefault();

  const target = '/anonymous/';
  window.location.replace(target);   // или location.href = target;

  fullRoomCleanup().catch(() => {});
  clearAllListenersAndState().catch(() => {});
  clearRoomStorage();                // синхронно
});


// ========================= АВТО-УДАЛЕНИЕ НЕАКТИВНЫХ КОМНАТ =========================

async function deleteRoomFully(roomRef) {
    try {
        // Удаляем сообщения
        const msgs = await getDocs(collection(roomRef, "messages"));
        for (const m of msgs.docs) {
            await deleteDoc(m.ref).catch(() => {});
        }

        // Удаляем presence
        const pres = await getDocs(collection(roomRef, "presence"));
        for (const p of pres.docs) {
            await deleteDoc(p.ref).catch(() => {});
        }

        // Удаляем саму комнату
        await deleteDoc(roomRef).catch(() => {});

        console.log("🔥 Комната удалена автоматически:", roomRef.id);
    } catch (e) {
        console.warn("Ошибка авто-удаления:", e);
    }
}

async function cleanupRoomsByInactivity() {
    try {
        const q = query(collection(db, "rooms"), limit(20));
        const snap = await getDocs(q);
        const now = Date.now();

        for (const d of snap.docs) {
            const data = d.data();
            const roomRef = d.ref;

            // 0.1. Не трогаем комнаты, созданные менее 2 минут назад
            const created = data.createdAt?.toMillis?.() || 0;
            if (now - created < 2 * 60 * 1000) continue;

            // 1. Удаляем закрытые комнаты
            if (data.closed === true) {
                await deleteRoomFully(roomRef);
                continue;
            }

            // 2. Проверяем последнюю активность
            let lastActive = 0;

            const msgs = await getDocs(
                query(collection(roomRef, "messages"), orderBy("createdAt", "desc"), limit(1))
            );
            if (!msgs.empty) {
                lastActive = msgs.docs[0].data().createdAt?.toMillis?.() || 0;
            }

            if (!lastActive) lastActive = created;

            // 3. Неактивна >20 минут — удаляем
            if (now - lastActive > 20 * 60 * 1000) {
                await deleteRoomFully(roomRef);
            }
        }
    } catch (e) {
        console.warn("Ошибка проверки старых комнат:", e);
    }
}

// Запускаем авто-уборку каждые 5 минут
setInterval(cleanupRoomsByInactivity, 5 * 60 * 1000);

// Первую проверку запускаем через 20 секунд после входа
setTimeout(cleanupRoomsByInactivity, 20000);

  function tryJoinFromURL(){
    const url = new URL(location.href);
    const rId = url.searchParams.get('room');
    if(rId){
      const rRef = doc(db, 'rooms', rId);
      tryJoinSavedRoom(rRef, null).catch(()=>startSearch());
    }
  }
  setTimeout(tryJoinFromURL, 600);
