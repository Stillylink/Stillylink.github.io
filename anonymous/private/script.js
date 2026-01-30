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
            await update(ref(rtdb, `rooms/${roomId}`), { 
                closed: true,
                lastActivity: Date.now() 
            });
        } catch (err) {
            console.error("Ошибка закрытия комнаты:", err);
        }
    }

    await clearAllListenersAndState();
    clearRoomStorage();

    await auth.signOut();
    localStorage.clear();

    window.location.reload();
});
});

let currentUserUid = null;
onAuthStateChanged(auth, async user => {
    if (!user) {
        signInAnonymously(auth);
        return;
    }

    if (currentUserUid && currentUserUid !== user.uid) {
        console.warn("UID changed! Cleaning up...", currentUserUid, "->", user.uid);
        await clearAllListenersAndState();
        clearRoomStorage();
        hide(chatWindow);
        hide(searchScreen);
        show(endScreen);
    }
    
    currentUserUid = user.uid;
    uid = user.uid;
    isRealUser = !!user.email;

    if (isRealUser) {
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
        try {
            const roomRef = ref(rtdb, `rooms/${saved.roomId}`);
            const snap = await get(roomRef);
            
            if (snap.exists() && !snap.val().closed) {
                roomId = saved.roomId;
                partnerId = saved.partnerId;
                connectToRoom(roomId);
                return;
            }
        } catch (e) {
            console.warn("Комната не валидна, идем в поиск");
        }
        clearRoomStorage();
    }
    
    if (!roomId) {
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
    
    try {
        const messagesRef = ref(rtdb, `rooms/${roomId}/messages`);
        const newMsgRef = push(messagesRef);

        await set(newMsgRef, {
            sender: uid,
            text: text,
            type: type,
            createdAt: Date.now()
        });

        const roomRef = ref(rtdb, `rooms/${roomId}`);
        await update(roomRef, {
            lastActivity: Date.now()
        });

    } catch (err) {
        console.error("Ошибка в sendMessageToRoom:", err);
    }
}

photoBtn.addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
        const dataUrl = ev.target.result;
        sendMessageToRoom(dataUrl, 'image').catch(() => {});
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

    sendMessageToRoom(txt, 'text').catch(() => {});
});

textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const txt = textInput.value.trim();
        if (!txt) return;
        textInput.value = '';
        sendMessageToRoom(txt, 'text').catch(() => {});
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

async function startWaitingHeartbeat(userUid) {
    if (!userUid) return;
    
    if (waitingHeartbeatInterval) clearInterval(waitingHeartbeatInterval);
    
    const waitingRef = ref(rtdb, `waiting/${userUid}`);
    
    waitingHeartbeatInterval = setInterval(async () => {
        if (!auth.currentUser || auth.currentUser.uid !== userUid) {
            console.warn("Heartbeat остановлен: UID изменился");
            stopWaitingHeartbeat();
            return;
        }
        
        try {
            await update(waitingRef, {
                lastSeen: Date.now()
            });
        } catch (e) {
            console.error("Ошибка heartbeat:", e);
            if (e.message?.includes('permission_denied')) {
                stopWaitingHeartbeat();
            }
        }
    }, WAITING_HEARTBEAT_INTERVAL);
}

function stopWaitingHeartbeat() {
    if (waitingHeartbeatInterval) {
        clearInterval(waitingHeartbeatInterval);
        waitingHeartbeatInterval = null;
    }
}

async function startSearch() {
    if (!auth.currentUser) {
        console.warn("Ожидание авторизации для начала поиска...");
        return;
    }
    
    const myUid = auth.currentUser.uid;
    uid = myUid;
    
    // Проверка на существующую комнату
    const saved = loadRoomFromStorage();
    if (roomId || saved.roomId) {
        console.log("Поиск отменен: уже в комнате");
        return;
    }

    chatClosed = false;
    matchmakingInProgress = false;
    searchCancelled = false;

    await clearAllListenersAndState();
    clearMessages();
    show(searchScreen);
    hide(chatWindow);
    hide(endScreen);

    const myWaitingRef = ref(rtdb, `waiting/${myUid}`);
    myWaitingRefPath = `waiting/${myUid}`;
    
    try {
        await update(myWaitingRef, {
            uid: myUid,
            createdAt: Date.now(),
            claimed: false,
            roomId: null,
            lastSeen: Date.now()
        });
        onDisconnect(myWaitingRef).remove().catch(() => {});
    } catch (e) {
        console.error("Ошибка входа в очередь:", e);
        return;
    }

    // --- СЛУШАТЕЛЬ СЕБЯ (для роли Ведомого) ---
    const unsubscribeSelf = onValue(myWaitingRef, (snap) => {
        const data = snap.val();
        if (!data) return;
        
        // Если Лидер нас уже выбрал
        if (data.claimed === true && data.roomId && !roomId) {
            console.log("Нас нашли! Переход в комнату:", data.roomId);
            
            // НЕМЕДЛЕННО блокируем повторные входы
            roomId = data.roomId; 
            
            // Гасим все слушатели очереди
            off(myWaitingRef); 
            if (waitingRefPath) {
                off(ref(rtdb, waitingRefPath));
                waitingRefPath = null;
            }
            
            saveRoomToStorage(roomId, null);
            stopWaitingHeartbeat();
            
            // Гарантируем смену экранов
            hide(searchScreen);
            show(chatWindow);

            connectToRoom(data.roomId).catch(console.error);

            setTimeout(() => {
                remove(myWaitingRef).catch(() => {});
            }, 1000);
        }
    });

    startWaitingHeartbeat(myUid);

    // --- ПОИСК КАНДИДАТОВ (для роли Лидера) ---
    const waitingRef = ref(rtdb, 'waiting');
    waitingRefPath = 'waiting';
    
    onValue(waitingRef, async (snap) => {
        // Если нас уже "забрали" (roomId заполнен) или идет процесс — выходим
        if (roomId || !snap.exists() || searchCancelled || matchmakingInProgress) return;
        
        const now = Date.now();
        let candidates = [];

        snap.forEach(child => {
            const data = child.val();
            if (child.key === myUid || data.claimed) return;
            
            const lastSeen = data.lastSeen || data.createdAt || 0;
            if ((now - lastSeen) < WAITING_STALE_MS) {
                candidates.push({id: child.key, ...data});
            }
        });

        if (candidates.length === 0) return;

        candidates.sort((a, b) => a.createdAt - b.createdAt);
        const otherUid = candidates[0].id;

        // Лидер — тот, чей UID меньше
        if (myUid > otherUid) return;

        matchmakingInProgress = true;

        const newRoomRef = push(ref(rtdb, 'rooms'));
        const newRoomId = newRoomRef.key;

        try {
            // Атомарно бронируем обоих
            await Promise.all([
                update(ref(rtdb, `waiting/${otherUid}`), { claimed: true, roomId: newRoomId }),
                update(myWaitingRef, { claimed: true, roomId: newRoomId })
            ]);

            // Если бронь прошла, создаем комнату
            const sortedParticipants = [myUid, otherUid].sort();
            await set(newRoomRef, {
                participants: sortedParticipants,
                createdAt: Date.now(),
                lastActivity: Date.now(),
                closed: false
            });

            console.log("Комната создана нами (Лидер):", newRoomId);
            
            roomId = newRoomId; 
            
            // Выключаем поиск
            off(myWaitingRef);
            if (waitingRefPath) {
                off(ref(rtdb, waitingRefPath));
                waitingRefPath = null;
            }
            
            stopWaitingHeartbeat();
            
            // Принудительный UI переход
            hide(searchScreen);
            show(chatWindow);
            
            await connectToRoom(newRoomId);

            setTimeout(() => {
                remove(myWaitingRef).catch(() => {});
            }, 1500);

        } catch (err) {
            console.log("Конфликт бронирования, откат.");
            matchmakingInProgress = false;
        }
    });
}

async function connectToRoom(rId) {
    try {
        if (!rId) {
            return;
        }
        
        if (isConnecting) {
            return;
        }

        isConnecting = true;

        // ✅ ИСПРАВЛЕНИЕ: Удаляем себя из очереди при входе в комнату
        if (uid) {
            remove(ref(rtdb, `waiting/${uid}`)).catch(() => {});
        }

        if (currentRoomRefPath) off(ref(rtdb, currentRoomRefPath));
        if (messagesRefPath) off(ref(rtdb, messagesRefPath));
        if (presenceRefPath) off(ref(rtdb, presenceRefPath));

        roomId = rId;
        const roomRef = ref(rtdb, `rooms/${roomId}`);
        currentRoomRefPath = `rooms/${roomId}`;

        const roomSnap = await get(roomRef);
        if (!roomSnap.exists()) {
            isConnecting = false;
            roomId = null;
            clearRoomStorage();
            await startSearch();
            return;
        }

        const data = roomSnap.val();
        const parts = data.participants || [];

        if (!parts.includes(uid)) {
            isConnecting = false;
            roomId = null;
            clearRoomStorage();
            await startSearch();
            return;
        }

        partnerId = parts.find(p => p !== uid) || null;

        saveRoomToStorage(roomId, partnerId);

        hide(searchScreen);
        textInput.value = '';
        show(chatWindow);
        hide(endScreen);

        onValue(roomRef, (snap) => {
            if (!snap.exists()) {
                chatClosed = true;
                endChatUI();
                return;
            }
            const data = snap.val();
            if (data.closed === true) {
                chatClosed = true;
                endChatUI();
            }
        });

        const messagesRef = ref(rtdb, `rooms/${roomId}/messages`);
        messagesRefPath = `rooms/${roomId}/messages`;
        clearMessages();
        
        onChildAdded(messagesRef, (snap) => {
            if (!chatClosed) addMessageToUI(snap.val());
        });

        await setMyPresence();
        
        isConnecting = false;

    } catch (err) {
        isConnecting = false;
    }
}

async function setMyPresence() {
    if (!roomId || !auth.currentUser) return;
    
    const currentUid = auth.currentUser.uid;
    const presRef = ref(rtdb, `rooms/${roomId}/presence/${currentUid}`);
    
    try {
        await update(presRef, { lastSeen: Date.now() });
        onDisconnect(presRef).remove();
    } catch (e) { 
        console.error("Presence set error:", e);
    }
    
    if (presenceHeartbeatInterval) clearInterval(presenceHeartbeatInterval);
    presenceHeartbeatInterval = setInterval(async () => {
        if (!auth.currentUser) return;
        try {
            await update(presRef, { lastSeen: Date.now() });
        } catch (e) { 
            if (e.message?.includes('permission_denied')) {
                clearInterval(presenceHeartbeatInterval);
            }
        }
    }, PRESENCE_PING_INTERVAL);
}

async function finishChat() {
    const currentRoomId = roomId;
    
    if (currentRoomId) {
        try {
            await update(ref(rtdb, `rooms/${currentRoomId}`), { 
                closed: true,
                lastActivity: Date.now()
            });
            
            await deleteRoomFully(currentRoomId);
            
            endChatUI();
            await clearAllListenersAndState();
            clearRoomStorage();

        } catch (err) {
            console.error("Ошибка завершения чата:", err);
            endChatUI();
            await clearAllListenersAndState();
        }
    } else {
        endChatUI();
        await clearAllListenersAndState();
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

    // ✅ ИСПРАВЛЕНИЕ: Используем текущий UID из auth
    const currentUid = auth.currentUser?.uid;
    if (currentUid) {
        const myWaitingRef = ref(rtdb, `waiting/${currentUid}`);
        try {
            const snap = await get(myWaitingRef);
            if (snap.exists()) {
                await remove(myWaitingRef);
            }
        } catch (e) { 
            console.warn("Ошибка удаления waiting узла:", e);
        }
    }
    
    if (roomId && currentUid) {
        try {
            await remove(ref(rtdb, `rooms/${roomId}/presence/${currentUid}`));
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
        
        const currentUid = auth.currentUser?.uid;
        if (currentUid) {
            await remove(ref(rtdb, `waiting/${currentUid}`)).catch(() => { });
        }
        
        if (roomId && auth.currentUser) {
            await remove(ref(rtdb, `rooms/${roomId}/presence/${auth.currentUser.uid}`)).catch(() => { });
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
    const oldRoomId = roomId;
    searchCancelled = false;
    await fullRoomCleanup();
    await clearAllListenersAndState();
    clearRoomStorage();

    if (oldRoomId) {
        deleteRoomFully(oldRoomId);
    }

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
    if (!rId) return;
    try {
        const roomRef = ref(rtdb, `rooms/${rId}`);
        await update(roomRef, { closed: true, lastActivity: Date.now() });
    } catch (e) { 
        console.warn("Не удалось удалить комнату вручную (защита правил), она будет очищена ботом.");
    }
}

const ROOM_TTL = 20 * 60 * 1000; 

async function runAutoCleanup() {
    const now = Date.now();
    const TWENTY_MINUTES = 20 * 60 * 1000;

    try {
        const roomsSnap = await get(ref(rtdb, 'rooms'));
        if (roomsSnap.exists()) {
            roomsSnap.forEach(snap => {
                const room = snap.val();
                const last = room.lastActivity || room.createdAt || 0;
                if (room.closed === true || (now - last > TWENTY_MINUTES)) {
                    remove(ref(rtdb, `rooms/${snap.key}`)).catch(() => {});
                }
            });
        }

        const waitingSnap = await get(ref(rtdb, 'waiting'));
        if (waitingSnap.exists()) {
            waitingSnap.forEach(snap => {
                const user = snap.val();
                const ls = user.lastSeen || user.createdAt || 0;
                if (now - ls > 60000) {
                    remove(ref(rtdb, `waiting/${snap.key}`)).catch(() => {});
                }
            });
        }
    } catch (e) { }
}

setInterval(runAutoCleanup, 120000);
