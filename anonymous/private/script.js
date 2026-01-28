import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import {
    getDatabase,
    ref,
    set,
    push,
    onValue,
    onChildAdded,
    update,
    remove,
    get,
    query,
    orderByChild,
    limitToLast,
    serverTimestamp as rtdbServerTimestamp,
    onDisconnect,
    off
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

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
const exitBtn = document.getElementById('exitBtn');

const regBtn = document.querySelector(".register-btn");
const avatar = document.querySelector(".user-avatar");
const avatarLetter = document.querySelector(".user-avatar span");
const userMenu = document.querySelector(".user-menu");
const logoutBtn = document.getElementById("logoutBtn");

const savedAvatar = localStorage.getItem('userAvatarLetter');
if (savedAvatar) {
  regBtn?.classList.add('hidden');
  avatar?.classList.remove('hidden');
  avatarLetter.textContent = savedAvatar;
}

function toggleMenu() {
    const menu = document.querySelector(".nav-links");
    menu.classList.toggle("open");
}
window.toggleMenu = toggleMenu;

document.addEventListener("click", e => {
    const menu = document.querySelector(".nav-links");
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
let roomId = null;
let partnerId = null;
let chatClosed = false;
let cleaning = false;
let searchCancelled = false;
let isConnecting = false;
let matchmakingInProgress = false;

let waitingHeartbeatInterval = null;
let presenceHeartbeatInterval = null;

let myWaitingRefPath = null;
let waitingRefPath = null;
let currentRoomRefPath = null;
let messagesRefPath = null;
let presenceRefPath = null;

const PRESENCE_PING_INTERVAL = 8000;
const PRESENCE_STALE_MS = 25000;
const WAITING_HEARTBEAT_INTERVAL = 8000;
const WAITING_STALE_MS = 30000;

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function saveRoomToStorage(rId, pId) {
    if (rId) localStorage.setItem('roomId', rId);
    else localStorage.removeItem('roomId');
    if (pId) localStorage.setItem('partnerId', pId);
    else localStorage.removeItem('partnerId');
}

function loadRoomFromStorage() {
    return {
        roomId: localStorage.getItem('roomId'),
        partnerId: localStorage.getItem('partnerId')
    };
}

function clearRoomStorage() {
    localStorage.removeItem('roomId');
    localStorage.removeItem('partnerId');
}

window.addEventListener("DOMContentLoaded", () => {
    logoutBtn?.addEventListener("click", async e => {
        e.preventDefault();

        if (roomId && !chatClosed) {
            chatClosed = true;
            try {
                await update(ref(rtdb, `rooms/${roomId}`), { closed: true });
            } catch (err) { }
        }

        await clearAllListenersAndState();
        clearRoomStorage();

        await auth.signOut();
        localStorage.clear();

        window.location.reload();
    });
});

onAuthStateChanged(auth, user => {
    if (!user) {
        signInAnonymously(auth);
        return;
    }

    uid = user.uid;
    isRealUser = !!user.email;

    if (isRealUser) {
        // ОПТИМИЗАЦИЯ: Используем кэш или первую букву email, БЕЗ запроса в Firestore
        const cachedLetter = localStorage.getItem('userAvatarLetter');
        if (cachedLetter) {
            avatarLetter.textContent = cachedLetter;
        } else {
            const letter = user.email[0].toUpperCase();
            avatarLetter.textContent = letter;
            localStorage.setItem('userAvatarLetter', letter);
        }

        regBtn?.classList.add("hidden");
        avatar?.classList.remove("hidden");
    } else {
        regBtn?.classList.remove("hidden");
        avatar?.classList.add("hidden");
        localStorage.removeItem("userAvatarLetter");
    }

    const saved = loadRoomFromStorage();
    if (saved.roomId) {
        const roomRef = ref(rtdb, `rooms/${saved.roomId}`);
        get(roomRef).then(snap => {
            if (snap.exists() && !snap.val().closed) {
                roomId = saved.roomId;
                partnerId = saved.partnerId;
                connectToRoom(roomId);
            } else {
                clearRoomStorage();
                startSearch();
            }
        }).catch(() => {
            clearRoomStorage();
            startSearch();
        });
    } else {
        startSearch();
    }
});

function clearMessages() { messagesEl.innerHTML = ''; }

function addMessageToUI(data) {
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
        if (createdAt) {
            time = new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    } catch (e) { time = ''; }
    meta.textContent = time;
    msg.appendChild(meta);

    wrap.appendChild(msg);
    messagesEl.appendChild(wrap);

    messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function sendMessageToRoom(text, type = 'text') {
    if (!roomId) return;

    const now = Date.now();
    const roomRef = ref(rtdb, `rooms/${roomId}`);
    const messagesRef = ref(rtdb, `rooms/${roomId}/messages`);
    const newMsgRef = push(messagesRef);

    await Promise.all([
        set(newMsgRef, {
            sender: uid,
            text,
            type,
            createdAt: now
        }),
        update(roomRef, {
            lastActivity: now
        })
    ]);
}

photoBtn.addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
        const dataUrl = ev.target.result;
        sendMessageToRoom(dataUrl, 'image').catch(console.error);
    };
    reader.readAsDataURL(file);
    photoInput.value = '';
});

sendBtn.addEventListener('click', () => {
    const txt = textInput.value.trim();
    if (!txt) return;

    textInput.value = '';
    textInput.style.display = 'none';
    textInput.offsetHeight;
    textInput.style.display = '';

    sendMessageToRoom(txt, 'text').catch(err => console.error(err));
});

textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const txt = textInput.value.trim();
        if (!txt) return;
        textInput.value = '';
        sendMessageToRoom(txt, 'text').catch(err => console.error('send failed:', err));
    }
});

emojiBtn.addEventListener('click', (e) => {
    emojiPanel.classList.toggle('hidden');
    emojiPanel.setAttribute('aria-hidden', emojiPanel.classList.contains('hidden'));
});

document.querySelectorAll('.emoji').forEach(b => {
    b.addEventListener('click', () => {
        textInput.value += b.textContent;
        textInput.focus();
    });
});

document.addEventListener('click', (e) => {
    if (emojiPanel.classList.contains('hidden')) return;
    if (e.target === emojiBtn || emojiPanel.contains(e.target)) return;
    emojiPanel.classList.add('hidden');
});

async function startWaitingHeartbeat() {
    if (!uid) return;
    
    const waitingRef = ref(rtdb, `waiting/${uid}`);
    
    try {
        await update(waitingRef, { lastSeen: Date.now() }).catch(async () => {
            await set(waitingRef, {
                uid,
                createdAt: Date.now(),
                claimed: false,
                roomId: null,
                lastSeen: Date.now()
            });
        });
    } catch (e) { }

    if (waitingHeartbeatInterval) clearInterval(waitingHeartbeatInterval);
    waitingHeartbeatInterval = setInterval(async () => {
        try {
            await update(waitingRef, { lastSeen: Date.now() });
        } catch (e) { }
    }, WAITING_HEARTBEAT_INTERVAL);
}

function stopWaitingHeartbeat() {
    if (waitingHeartbeatInterval) {
        clearInterval(waitingHeartbeatInterval);
        waitingHeartbeatInterval = null;
    }
}

async function startSearch() {
    const saved = loadRoomFromStorage();
    if (saved.roomId) return;

    chatClosed = false;
    matchmakingInProgress = false;

    await clearAllListenersAndState();
    clearMessages();
    show(searchScreen);
    hide(chatWindow);
    hide(endScreen);

    const myWaitingRef = ref(rtdb, `waiting/${uid}`);
    myWaitingRefPath = `waiting/${uid}`;
    
    try {
        await set(myWaitingRef, {
            uid,
            createdAt: Date.now(),
            claimed: false,
            roomId: null,
            lastSeen: Date.now()
        });
    } catch (e) {
        console.error('Failed to create waiting entry', e);
        return;
    }

    onValue(myWaitingRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.val();
        if (data.claimed && data.roomId) {
            roomId = data.roomId;
            saveRoomToStorage(roomId, null);
            stopWaitingHeartbeat();
            
            if (waitingRefPath) {
                off(ref(rtdb, waitingRefPath));
                waitingRefPath = null;
            }
            
            connectToRoom(roomId).catch(console.warn);
        }
    });

    startWaitingHeartbeat();

    const waitingRef = ref(rtdb, 'waiting');
    waitingRefPath = 'waiting';
    
    onValue(waitingRef, async (snap) => {
        if (!snap.exists()) return;
        if (matchmakingInProgress) return;
        
        const now = Date.now();
        let otherUid = null;

        snap.forEach(child => {
            const data = child.val();
            
            if (child.key === uid || data.uid === uid) return;
            if (data.claimed) return;
            
            const ls = data.lastSeen || data.createdAt || 0;
            if ((now - ls) > WAITING_STALE_MS) return;
            
            if (!otherUid) {
                otherUid = child.key;
            }
        });

        if (!otherUid) return;

        if (uid > otherUid) {
            return;
        }

        matchmakingInProgress = true;

        try {
            const otherRef = ref(rtdb, `waiting/${otherUid}`);
            const myRef = ref(rtdb, `waiting/${uid}`);
            
            const [otherSnap, mySnap] = await Promise.all([
                get(otherRef),
                get(myRef)
            ]);

            if (!otherSnap.exists() || !mySnap.exists()) {
                matchmakingInProgress = false;
                return;
            }
            
            const otherData = otherSnap.val();
            const myData = mySnap.val();
            
            if (otherData.claimed || myData.claimed) {
                matchmakingInProgress = false;
                return;
            }
            
            if (otherData.uid === uid || otherUid === uid) {
                console.warn('Попытка создать комнату с самим собой!');
                matchmakingInProgress = false;
                return;
            }

            const roomsRef = ref(rtdb, 'rooms');
            const newRoomRef = push(roomsRef);
            const newRoomId = newRoomRef.key;

            await set(newRoomRef, {
                participants: [uid, otherUid],
                createdAt: Date.now(),
                lastActivity: Date.now(),
                closed: false
            });

            await Promise.all([
                update(otherRef, { claimed: true, roomId: newRoomId }),
                update(myRef, { claimed: true, roomId: newRoomId })
            ]);

            await Promise.all([
                remove(otherRef),
                remove(myRef)
            ]);

            console.log('✅ Комната создана:', newRoomId);
            
        } catch (err) {
            console.log('Matchmaking race condition:', err);
            matchmakingInProgress = false;
        }
    });
}

async function connectToRoom(rId) {
    try {
        if (!rId) return;
        if (isConnecting) {
            console.log('Already connecting to a room');
            return;
        }

        isConnecting = true;

        if (currentRoomRefPath) {
            off(ref(rtdb, currentRoomRefPath));
        }
        if (messagesRefPath) {
            off(ref(rtdb, messagesRefPath));
        }
        if (presenceRefPath) {
            off(ref(rtdb, presenceRefPath));
        }

        roomId = rId;
        const roomRef = ref(rtdb, `rooms/${roomId}`);
        currentRoomRefPath = `rooms/${roomId}`;
        
        saveRoomToStorage(roomId, partnerId);

        hide(searchScreen);
        show(chatWindow);
        hide(endScreen);

        const roomSnap = await get(roomRef);
        if (roomSnap.exists()) {
            const data = roomSnap.val();
            const parts = data.participants || [];
            if (!parts.includes(uid) && parts.length < 2) {
                parts.push(uid);
                await update(roomRef, { participants: parts });
            }
            
            partnerId = parts.find(p => p !== uid) || null;
            saveRoomToStorage(roomId, partnerId);
        }

        onValue(roomRef, (snap) => {
            if (!snap.exists()) {
                console.log('Комната удалена');
                chatClosed = true;
                endChatUI();
                return;
            }
            
            const data = snap.val();
            
            if (data.closed === true) {
                console.log('Комната закрыта собеседником');
                chatClosed = true;
                endChatUI();
                return;
            }
            
            const participants = data.participants || [];
            partnerId = participants.find(p => p !== uid) || null;
            saveRoomToStorage(roomId, partnerId);
        });

        const messagesRef = ref(rtdb, `rooms/${roomId}/messages`);
        messagesRefPath = `rooms/${roomId}/messages`;
        
        clearMessages();

        onChildAdded(messagesRef, (snap) => {
            if (chatClosed) return;
            addMessageToUI(snap.val());
        });

        await setMyPresence();
        
        const presenceRef = ref(rtdb, `rooms/${roomId}/presence`);
        presenceRefPath = `rooms/${roomId}/presence`;
        
        onValue(presenceRef, async (snap) => {
            if (!snap.exists()) return;
            
            const now = Date.now();
            let hasAlive = false;
            
            snap.forEach(child => {
                const data = child.val();
                const ls = data.lastSeen || 0;
                if ((now - ls) < PRESENCE_STALE_MS) {
                    hasAlive = true;
                }
            });

            if (!hasAlive && !chatClosed) {
                try {
                    await fullRoomCleanup();
                } catch (e) { }
            }
        });

        isConnecting = false;

    } catch (err) {
        console.error('connectToRoom error', err);
        isConnecting = false;
    }
}

async function setMyPresence() {
    if (!roomId || !uid) return;
    
    const presRef = ref(rtdb, `rooms/${roomId}/presence/${uid}`);
    
    try {
        await set(presRef, { lastSeen: Date.now() });
        onDisconnect(presRef).remove();
    } catch (e) {
        console.warn('set presence failed', e);
    }
    
    if (presenceHeartbeatInterval) clearInterval(presenceHeartbeatInterval);
    presenceHeartbeatInterval = setInterval(async () => {
        try {
            await update(presRef, { lastSeen: Date.now() });
        } catch (e) { }
    }, PRESENCE_PING_INTERVAL);
}

async function finishChat() {
    console.log('🛑 Завершаем чат');
    
    const currentRoomId = roomId;
    
    if (currentRoomId) {
        try {
            await update(ref(rtdb, `rooms/${currentRoomId}`), { closed: true });
            console.log('✅ Комната помечена как закрытая:', currentRoomId);
        } catch (err) {
            console.warn('Ошибка закрытия комнаты:', err);
        }
    }
    
    endChatUI();
    
    await clearAllListenersAndState();
    clearRoomStorage();
    
    if (currentRoomId) {
        setTimeout(async () => {
            await deleteRoomFully(currentRoomId);
        }, 2000);
    }
}

function endChatUI() {
    connectedStopUI();
}

function connectedStopUI() {
    hide(searchScreen);
    hide(chatWindow);
    show(endScreen);
}

async function cancelSearchHandler() {
    searchCancelled = true;
    
    if (myWaitingRefPath) {
        const myWaitingRef = ref(rtdb, myWaitingRefPath);
        try {
            await remove(myWaitingRef);
        } catch (e) { }
        myWaitingRefPath = null;
    }
    
    if (myWaitingRefPath) {
        off(ref(rtdb, myWaitingRefPath));
    }
    
    if (waitingRefPath) {
        off(ref(rtdb, waitingRefPath));
        waitingRefPath = null;
    }
    
    stopWaitingHeartbeat();
    
    hide(searchScreen);
    show(endScreen);
}

async function clearAllListenersAndState() {
    if (messagesRefPath) {
        off(ref(rtdb, messagesRefPath));
        messagesRefPath = null;
    }
    
    if (currentRoomRefPath) {
        off(ref(rtdb, currentRoomRefPath));
        currentRoomRefPath = null;
    }
    
    if (waitingRefPath) {
        off(ref(rtdb, waitingRefPath));
        waitingRefPath = null;
    }
    
    if (myWaitingRefPath) {
        off(ref(rtdb, myWaitingRefPath));
        myWaitingRefPath = null;
    }
    
    if (presenceRefPath) {
        off(ref(rtdb, presenceRefPath));
        presenceRefPath = null;
    }
    
    if (presenceHeartbeatInterval) {
        clearInterval(presenceHeartbeatInterval);
        presenceHeartbeatInterval = null;
    }
    
    stopWaitingHeartbeat();

    if (uid) {
        const myWaitingRef = ref(rtdb, `waiting/${uid}`);
        try {
            const snap = await get(myWaitingRef);
            if (snap.exists()) {
                await remove(myWaitingRef);
            }
        } catch (e) {
            console.warn('clear waiting error', e);
        }
    }
    
    if (roomId && uid) {
        try {
            await remove(ref(rtdb, `rooms/${roomId}/presence/${uid}`));
        } catch (e) { }
    }

    messagesEl.innerHTML = '';
    roomId = null;
    partnerId = null;
    isConnecting = false;
}

async function fullRoomCleanup() {
    if (roomId && uid) {
        await remove(ref(rtdb, `rooms/${roomId}/presence/${uid}`)).catch(() => { });
    }
}

window.addEventListener('beforeunload', async (ev) => {
    try {
        stopWaitingHeartbeat();
        
        if (uid) {
            await remove(ref(rtdb, `waiting/${uid}`)).catch(() => { });
        }
        
        if (roomId && uid) {
            await remove(ref(rtdb, `rooms/${roomId}/presence/${uid}`)).catch(() => { });
        }
    } catch (e) { }
});

const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);

async function handlePageExit() {
    if (cleaning) return;
    cleaning = true;

    const promises = [];

    if (uid) {
        promises.push(remove(ref(rtdb, `waiting/${uid}`)).catch(() => { }));
    }

    if (roomId && uid) {
        promises.push(remove(ref(rtdb, `rooms/${roomId}/presence/${uid}`)).catch(() => { }));
    }

    await Promise.all(promises);
}

async function handlePageReturn() {
    cleaning = false;

    if (!roomId && !searchCancelled && isMobile) {
        const myWaitingRef = ref(rtdb, `waiting/${uid}`);
        const snap = await get(myWaitingRef);
        if (!snap.exists()) {
            startSearch();
        }
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        handlePageExit();
    } else {
        handlePageReturn();
    }
});

finishBtn.addEventListener('click', () => { modal.classList.remove('hidden'); });
modalCancel.addEventListener('click', () => { modal.classList.add('hidden'); });
modalFinish.addEventListener('click', async () => { 
    modal.classList.add('hidden'); 
    await finishChat(); 
});

newChatBtn.addEventListener('click', async () => {
    searchCancelled = false;
    await fullRoomCleanup();
    await clearAllListenersAndState();
    clearRoomStorage();
    startSearch();
});

cancelSearch.addEventListener('click', cancelSearchHandler);

exitBtn.addEventListener('click', function (e) {
    e.preventDefault();
    handlePageExit();

    const target = '/anonymous/';
    window.location.replace(target);

    fullRoomCleanup().catch(() => { });
    clearAllListenersAndState().catch(() => { });
    clearRoomStorage();
});

async function deleteRoomFully(rId) {
    try {
        const roomRef = ref(rtdb, `rooms/${rId}`);
        const snap = await get(roomRef);
        
        if (!snap.exists()) return;

        const participants = snap.val().participants || [];

        await remove(ref(rtdb, `rooms/${rId}/messages`)).catch(() => { });
        await remove(ref(rtdb, `rooms/${rId}/presence`)).catch(() => { });

        console.log("Комната удалена:", rId);
    } catch (e) {
        console.warn("Ошибка удаления комнаты:", e);
    }
}

const ROOM_TTL = 20 * 60 * 1000; 
