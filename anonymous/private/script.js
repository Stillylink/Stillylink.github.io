import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Firestore только для профиля/навигации
import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Realtime Database для чата
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
    limitToFirst,
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
const db = getFirestore(app); // Firestore для профиля
const rtdb = getDatabase(app); // Realtime DB для чата

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

window.addEventListener("DOMContentLoaded", () => {
    if (isRealUser) {
        const saved = localStorage.getItem("userAvatarLetter");
        if (saved) {
            regBtn?.classList.add("hidden");
            avatar?.classList.remove("hidden");
            avatarLetter.textContent = saved;
        }
    } else {
        regBtn?.classList.remove("hidden");
        avatar?.classList.add("hidden");
    }

    logoutBtn?.addEventListener("click", async e => {
        e.preventDefault();

        if (roomId && !chatClosed) {
            chatClosed = true;
            try {
                await update(ref(rtdb, `rooms/${roomId}`), { closed: true });
            } catch (err) { /* silent */ }
        }

        await clearAllListenersAndState();
        clearRoomStorage();

        await auth.signOut();
        localStorage.removeItem("userAvatarLetter");

        window.location.reload();
    });
});

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
let isConnecting = false; // Флаг для предотвращения множественных подключений
let matchmakingInProgress = false; // Флаг для предотвращения race condition

let waitingHeartbeatInterval = null;
let presenceHeartbeatInterval = null;

// Для хранения refs слушателей
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

// =================== ХРАНИЛИЩЕ КОМНАТЫ =====================
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
// ==========================================================

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
    const messagesRef = ref(rtdb, `rooms/${roomId}/messages`);
    const newMsgRef = push(messagesRef);
    await set(newMsgRef, {
        sender: uid,
        text,
        type,
        createdAt: rtdbServerTimestamp()
    });
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

    sendMessageToRoom(txt, 'text')
        .catch(err => console.error(err));
});

textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const txt = textInput.value.trim();
        if (!txt) return;
        textInput.value = '';
        sendMessageToRoom(txt, 'text')
            .catch(err => console.error('send failed:', err));
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
        await update(waitingRef, { lastSeen: rtdbServerTimestamp() }).catch(async () => {
            await set(waitingRef, {
                uid,
                createdAt: rtdbServerTimestamp(),
                claimed: false,
                roomId: null,
                lastSeen: rtdbServerTimestamp()
            });
        });
    } catch (e) { }

    if (waitingHeartbeatInterval) clearInterval(waitingHeartbeatInterval);
    waitingHeartbeatInterval = setInterval(async () => {
        try {
            await update(waitingRef, { lastSeen: rtdbServerTimestamp() });
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
    statusText.textContent = 'Ищем собеседника...';

    const myWaitingRef = ref(rtdb, `waiting/${uid}`);
    myWaitingRefPath = `waiting/${uid}`;
    
    try {
        await set(myWaitingRef, {
            uid,
            createdAt: rtdbServerTimestamp(),
            claimed: false,
            roomId: null,
            lastSeen: rtdbServerTimestamp()
        });
    } catch (e) {
        console.error('Failed to create waiting entry', e);
        return;
    }

    // Слушаем своё состояние
    onValue(myWaitingRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.val();
        if (data.claimed && data.roomId) {
            roomId = data.roomId;
            saveRoomToStorage(roomId, null);
            stopWaitingHeartbeat();
            
            // Отписываемся от очереди ожидания
            if (waitingRefPath) {
                off(ref(rtdb, waitingRefPath));
                waitingRefPath = null;
            }
            
            connectToRoom(roomId).catch(console.warn);
        }
    });

    startWaitingHeartbeat();

    // Слушаем очередь ожидания
    const waitingRef = ref(rtdb, 'waiting');
    waitingRefPath = 'waiting';
    
    onValue(waitingRef, async (snap) => {
        if (!snap.exists()) return;
        if (matchmakingInProgress) return; // Предотвращаем race condition
        
        const now = Date.now();
        let otherUid = null;

        snap.forEach(child => {
            const data = child.val();
            if (data.uid === uid) return;
            if (data.claimed) return;
            
            const ls = data.lastSeen || data.createdAt || 0;
            if ((now - ls) > WAITING_STALE_MS) return;
            
            if (!otherUid) {
                otherUid = child.key;
            }
        });

        if (!otherUid) return;

        matchmakingInProgress = true;

        // Проверяем ещё раз перед созданием комнаты
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
            if (otherSnap.val().claimed || mySnap.val().claimed) {
                matchmakingInProgress = false;
                return;
            }

            // Создаём комнату
            const roomsRef = ref(rtdb, 'rooms');
            const newRoomRef = push(roomsRef);
            const newRoomId = newRoomRef.key;

            await set(newRoomRef, {
                participants: [uid, otherUid],
                createdAt: rtdbServerTimestamp(),
                closed: false
            });

            // Помечаем обоих как claimed
            await Promise.all(deletePromises);
    } catch (e) {
        console.warn('Ошибка при чистке waiting:', e);
    }
}

setInterval(() => {
    cleanupRoomsByInactivity();
    cleanupStaleWaitingUsers();
}, 5 * 60 * 1000);

setTimeout(() => {
    cleanupRoomsByInactivity();
    cleanupStaleWaitingUsers();
}, 20000);all([
                update(otherRef, { claimed: true, roomId: newRoomId }),
                update(myRef, { claimed: true, roomId: newRoomId })
            ]);

            console.log('Room created:', newRoomId);
            
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

        // Полностью очищаем старые слушатели
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
        statusText.textContent = 'Соединено';

        // Добавляем себя в participants если нужно
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

        // Слушаем мета-данные комнаты
        onValue(roomRef, (snap) => {
            if (!snap.exists() || snap.val().closed) {
                chatClosed = true;
                endChatUI();
            } else {
                const participants = snap.val().participants || [];
                partnerId = participants.find(p => p !== uid) || null;
                saveRoomToStorage(roomId, partnerId);
            }
        });

        // Слушаем сообщения - ОДИН РАЗ
        const messagesRef = ref(rtdb, `rooms/${roomId}/messages`);
        messagesRefPath = `rooms/${roomId}/messages`;
        const messagesQuery = query(messagesRef, orderByChild('createdAt'));
        
        clearMessages();
        
        onChildAdded(messagesQuery, (snap) => {
            if (chatClosed) return;
            addMessageToUI(snap.val());
        });

        // Устанавливаем presence
        await setMyPresence();
        
        // Слушаем presence других
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
        await set(presRef, { lastSeen: rtdbServerTimestamp() });
        
        // Устанавливаем onDisconnect
        onDisconnect(presRef).remove();
        
    } catch (e) {
        console.warn('set presence failed', e);
    }
    
    if (presenceHeartbeatInterval) clearInterval(presenceHeartbeatInterval);
    presenceHeartbeatInterval = setInterval(async () => {
        try {
            await update(presRef, { lastSeen: rtdbServerTimestamp() });
        } catch (e) { }
    }, PRESENCE_PING_INTERVAL);
}

async function finishChat() {
    endChatUI();

    if (roomId) {
        await update(ref(rtdb, `rooms/${roomId}`), { closed: true }).catch(() => { });
        
        // Удаляем комнату полностью
        setTimeout(async () => {
            await deleteRoomFully(roomId);
        }, 500);
    }

    clearRoomStorage();
}

function endChatUI() {
    connectedStopUI();
    statusText.textContent = 'Чат завершен';
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
    statusText.textContent = 'Поиск отменён';
}

async function clearAllListenersAndState() {
    // Отписываемся от всех слушателей
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

// ========================= АВТО-УДАЛЕНИЕ НЕАКТИВНЫХ КОМНАТ =========================

async function deleteRoomFully(rId) {
    try {
        const roomRef = ref(rtdb, `rooms/${rId}`);
        const snap = await get(roomRef);
        
        if (!snap.exists()) return;

        const participants = snap.val().participants || [];

        for (const uid of participants) {
            await remove(ref(rtdb, `waiting/${uid}`)).catch(() => { });
        }

        await remove(ref(rtdb, `rooms/${rId}/messages`)).catch(() => { });
        await remove(ref(rtdb, `rooms/${rId}/presence`)).catch(() => { });
        await remove(roomRef).catch(() => { });

        console.log("Комната удалена:", rId);
    } catch (e) {
        console.warn("Ошибка удаления комнаты:", e);
    }
}

async function cleanupRoomsByInactivity() {
    try {
        const roomsRef = ref(rtdb, 'rooms');
        const snap = await get(roomsRef);
        
        if (!snap.exists()) return;
        
        const now = Date.now();

        const deletePromises = [];

        snap.forEach((child) => {
            const data = child.val();
            const rId = child.key;

            const created = data.createdAt || 0;
            
            // Удаляем закрытые комнаты
            if (data.closed === true) {
                deletePromises.push(deleteRoomFully(rId));
                return;
            }
            
            // Удаляем комнаты старше 2 минут без активности
            if (created && (now - created) < 2 * 60 * 1000) return;

            // Проверяем последнюю активность
            const checkInactivity = async () => {
                let lastActive = 0;

                const msgsRef = ref(rtdb, `rooms/${rId}/messages`);
                const msgsQuery = query(msgsRef, orderByChild('createdAt'), limitToLast(1));
                const msgsSnap = await get(msgsQuery);
                
                if (msgsSnap.exists()) {
                    msgsSnap.forEach(msg => {
                        lastActive = msg.val().createdAt || 0;
                    });
                }

                if (!lastActive) lastActive = created;

                if (now - lastActive > 20 * 60 * 1000) {
                    await deleteRoomFully(rId);
                }
            };

            deletePromises.push(checkInactivity());
        });

        await Promise.all(deletePromises);
    } catch (e) {
        console.warn("Ошибка проверки старых комнат:", e);
    }
}

// ========== УДАЛЕНИЕ ЗАВИСШИХ В ОЧЕРЕДИ ==========
async function cleanupStaleWaitingUsers() {
    try {
        const waitingRef = ref(rtdb, 'waiting');
        const snap = await get(waitingRef);
        
        if (!snap.exists()) return;
        
        const now = Date.now();

        const deletePromises = [];

        snap.forEach((child) => {
            const data = child.val();
            if (data.claimed === true) return;

            const ls = data.lastSeen || 0;
            if (!ls) return;

            if (now - ls > WAITING_STALE_MS) {
                deletePromises.push(
                    remove(child.ref).then(() => {
                        console.log('Удалён зависший пользователь:', child.key);
                    }).catch(() => {})
                );
            }
        });

        await Promise.all(deletePromises);
    } catch (e) {
        console.warn('Ошибка при чистке waiting:', e);
    }
}

setInterval(() => {
    cleanupRoomsByInactivity();
    cleanupStaleWaitingUsers();
}, 5 * 60 * 1000);

setTimeout(() => {
    cleanupRoomsByInactivity();
    cleanupStaleWaitingUsers();
}, 20000);
