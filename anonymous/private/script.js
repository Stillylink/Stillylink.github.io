// ========================= FIREBASE INIT =========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
    getDatabase,
    ref,
    set,
    push,
    onValue,
    off,
    get,
    remove,
    update,
    serverTimestamp,
    onDisconnect
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const fs = getFirestore(app);

// ========================= DOM =========================
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

const regBtn = document.querySelector(".register-btn");
const avatar = document.querySelector(".user-avatar");
const avatarLetter = document.querySelector(".user-avatar span");
const userMenu = document.querySelector(".user-menu");
const logoutBtn = document.getElementById("logoutBtn");

// ========================= STATE =========================
let uid = null;
let isRealUser = false;
let myWaitingRef = null;
let roomRef = null;
let roomId = null;
let partnerId = null;
let messagesUnsub = null;
let roomMetaUnsub = null;
let presenceUnsub = null;
let presenceHeartbeatInterval = null;
let chatClosed = false;
let cleaning = false;
let searchCancelled = false;

const PRESENCE_PING_INTERVAL = 8000;
const PRESENCE_STALE_MS = 25000;
const WAITING_HEARTBEAT_INTERVAL = 8000;
const WAITING_STALE_MS = 30000;

// ========================= UTILS =========================
function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }

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

// ========================= UI =========================
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
        time = new Date(createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    } catch(e){ time = ''; }
    meta.textContent = time;
    msg.appendChild(meta);

    wrap.appendChild(msg);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ========================= MESSAGES =========================
async function sendMessageToRoom(text, type = 'text'){
    if(!roomRef) return;
    const msgRef = push(ref(db, `rooms/${roomId}/messages`));
    await set(msgRef, {
        sender: uid,
        text,
        type,
        createdAt: Date.now()
    });
}

// ========================= EMOJI & PHOTO =========================
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
    textInput.value = '';
    sendMessageToRoom(txt, 'text').catch(console.error);
});

textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const txt = textInput.value.trim();
        if (!txt) return;
        textInput.value = '';
        sendMessageToRoom(txt, 'text').catch(console.error);
    }
});

emojiBtn.addEventListener('click', ()=>{
    emojiPanel.classList.toggle('hidden');
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

// ========================= PRESENCE =========================
async function setMyPresence(){
    if(!roomRef || !uid) return;
    const presRef = ref(db, `rooms/${roomId}/presence/${uid}`);
    await set(presRef, { lastSeen: Date.now() });
    onDisconnect(presRef).remove();
    if(presenceHeartbeatInterval) clearInterval(presenceHeartbeatInterval);
    presenceHeartbeatInterval = setInterval(async ()=>{
        await update(presRef, { lastSeen: Date.now() }).catch(()=>{});
    }, PRESENCE_PING_INTERVAL);
}

// ========================= ROOM =========================
async function connectToRoom(rId){
    if(chatClosed) return;
    roomId = rId;
    roomRef = ref(db, `rooms/${roomId}`);
    saveRoomToStorage(roomId, partnerId);

    hide(searchScreen);
    show(chatWindow);
    hide(endScreen);
    statusText.textContent = 'Соединено';

    // Listen to room meta
    roomMetaUnsub = onValue(roomRef, async (snap) => {
        if(!snap.exists() || snap.val().closed){
            chatClosed = true;
            if(messagesUnsub){ off(messagesUnsub); messagesUnsub = null; }
            endChatUI();
        } else {
            const participants = snap.val().participants || [];
            partnerId = participants.find(p => p !== uid) || null;
            saveRoomToStorage(roomId, partnerId);
        }
    });

    // Listen to messages
    const msgsRef = ref(db, `rooms/${roomId}/messages`);
    messagesUnsub = onValue(msgsRef, (snap) => {
        if(chatClosed) return;
        clearMessages();
        snap.forEach(child => {
            addMessageToUI(child.val());
        });
    });

    await setMyPresence();
}

// ========================= SEARCH =========================
async function startSearch(){
    const saved = loadRoomFromStorage();
    if(saved.roomId && !chatClosed){
        roomId = saved.roomId;
        partnerId = saved.partnerId;
        await connectToRoom(roomId);
        return;
    }

    chatClosed = false;
    clearAllListenersAndState();
    clearMessages();
    show(searchScreen);
    hide(chatWindow);
    hide(endScreen);
    statusText.textContent = 'Ищем собеседника...';

    myWaitingRef = ref(db, `waiting/${uid}`);
    await set(myWaitingRef, {
        uid,
        createdAt: Date.now(),
        claimed: false,
        roomId: null,
        lastSeen: Date.now()
    });

    onValue(myWaitingRef, async (snap) => {
        if(!snap.exists()) return;
        const data = snap.val();
        if(data.claimed && data.roomId){
            roomId = data.roomId;
            await connectToRoom(roomId);
        }
    });

    // Cleanup stale waiting
    const waitingRef = ref(db, 'waiting');
    onValue(waitingRef, async (snap) => {
        const now = Date.now();
        snap.forEach(child => {
            const data = child.val();
            if(data.uid === uid) return;
            if(data.claimed) return;
            const ls = data.lastSeen || 0;
            if(now - ls > WAITING_STALE_MS){
                remove(ref(db, `waiting/${child.key}`));
            }
        });
    });

    // Matchmaking
    const q = ref(db, 'waiting');
    onValue(q, async (snap) => {
        const now = Date.now();
        for(const child of snap.forEach(child => {
            const data = child.val();
            if(data.uid === uid) return;
            if(data.claimed) return;
            const ls = data.lastSeen || 0;
            if(now - ls > WAITING_STALE_MS) return;

            // Create room
            const newRoomRef = ref(db, 'rooms');
            const newRoomKey = push(newRoomRef).key;
            const updates = {};
            updates[`rooms/${newRoomKey}`] = {
                participants: [uid, data.uid],
                createdAt: Date.now(),
                closed: false
            };
            updates[`waiting/${uid}`] = { claimed: true, roomId: newRoomKey };
            updates[`waiting/${data.uid}`] = { claimed: true, roomId: newRoomKey };

            update(ref(db), updates).then(()=>{
                roomId = newRoomKey;
                connectToRoom(roomId);
            });
        }));
    });
}

// ========================= END CHAT =========================
async function finishChat(){
    endChatUI();
    if(roomId){
        await update(ref(db, `rooms/${roomId}`), { closed: true });
    }
    clearRoomStorage();
    setTimeout(async ()=>{
        if(roomId){
            await remove(ref(db, `rooms/${roomId}`));
        }
    }, 300);
}

function endChatUI(){
    hide(searchScreen);
    hide(chatWindow);
    show(endScreen);
    statusText.textContent = 'Чат завершен';
}

// ========================= CLEANUP =========================
async function clearAllListenersAndState(){
    if(messagesUnsub){ off(messagesUnsub); messagesUnsub = null; }
    if(roomMetaUnsub){ off(roomMetaUnsub); roomMetaUnsub = null; }
    if(presenceUnsub){ off(presenceUnsub); presenceUnsub = null; }
    if(presenceHeartbeatInterval){ clearInterval(presenceHeartbeatInterval); presenceHeartbeatInterval = null; }

    if(myWaitingRef){
        await remove(myWaitingRef).catch(()=>{});
        myWaitingRef = null;
    }
    if(roomId && uid){
        await remove(ref(db, `rooms/${roomId}/presence/${uid}`)).catch(()=>{});
    }

    clearMessages();
    roomId = null;
    partnerId = null;
}

// ========================= AUTH =========================
onAuthStateChanged(auth, user => {
    if (!user) {
        signInAnonymously(auth);
        return;
    }

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
        roomId = saved.roomId;
        partnerId = saved.partnerId;
        connectToRoom(roomId);
    } else {
        startSearch();
    }
});

// ========================= BUTTONS =========================
finishBtn.addEventListener('click', ()=>{ modal.classList.remove('hidden'); });
modalCancel.addEventListener('click', ()=>{ modal.classList.add('hidden'); });
modalFinish.addEventListener('click', async ()=>{ modal.classList.add('hidden'); await finishChat(); });

newChatBtn.addEventListener('click', async ()=>{
    searchCancelled = false;
    await clearAllListenersAndState();
    clearRoomStorage();
    startSearch();
});

cancelSearch.addEventListener('click', async ()=>{
    searchCancelled = true;
    if(myWaitingRef){
        await remove(myWaitingRef);
        myWaitingRef = null;
    }
    hide(searchScreen);
    show(endScreen);
    statusText.textContent = 'Поиск отменён';
});

exitBtn.addEventListener('click', function (e) {
    e.preventDefault();
    clearAllListenersAndState();
    clearRoomStorage();
    window.location.replace('/anonymous/');
});

// ========================= CLEANUP ON LEAVE =========================
window.addEventListener('beforeunload', async ()=>{
    if(myWaitingRef){
        await remove(myWaitingRef);
    }
    if(roomId && uid){
        await remove(ref(db, `rooms/${roomId}/presence/${uid}`));
    }
});
