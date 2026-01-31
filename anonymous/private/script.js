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

let searchScreen, chatWindow, endScreen, messagesEl, textInput, sendBtn;
let finishBtn, modal, modalCancel, modalFinish, newChatBtn;
let emojiBtn, emojiPanel, photoBtn, photoInput, cancelSearch, exitBtn;
let regBtn, avatar, avatarLetter, userMenu, logoutBtn;

function initializeDOM() {
    searchScreen = document.getElementById('searchScreen');
    chatWindow = document.getElementById('chatWindow');
    endScreen = document.getElementById('endScreen');
    messagesEl = document.getElementById('messages');
    textInput = document.getElementById('textInput');
    sendBtn = document.getElementById('sendBtn');
    finishBtn = document.getElementById('finishBtn');
    modal = document.getElementById('modal');
    modalCancel = document.getElementById('modalCancel');
    modalFinish = document.getElementById('modalFinish');
    newChatBtn = document.getElementById('newChatBtn');
    emojiBtn = document.getElementById('emojiBtn');
    emojiPanel = document.getElementById('emojiPanel');
    photoBtn = document.getElementById('photoBtn');
    photoInput = document.getElementById('photoInput');
    cancelSearch = document.getElementById('cancelSearch');
    exitBtn = document.getElementById('exitBtn');

    regBtn = document.querySelector(".register-btn");
    avatar = document.querySelector(".user-avatar");
    avatarLetter = document.querySelector(".user-avatar span");
    userMenu = document.querySelector(".user-menu");
    logoutBtn = document.getElementById("logoutBtn");

    if (!messagesEl || !textInput || !sendBtn) {
        console.error('Критические DOM элементы не найдены!');
        return false;
    }

    const savedAvatar = localStorage.getItem('userAvatarLetter');
    if (savedAvatar) {
        regBtn?.classList.add('hidden');
        avatar?.classList.remove('hidden');
        if (avatarLetter) avatarLetter.textContent = savedAvatar;
    }

    return true;
}

function initializeEventHandlers() {
    document.addEventListener("click", e => {
        const menu = document.querySelector(".nav-links");
        const toggle = document.querySelector(".nav-toggle");

        if (!menu || !menu.classList.contains("open")) return;
        if (menu.contains(e.target) || toggle?.contains(e.target)) return;

        menu.classList.remove("open");
    });

    document.addEventListener("click", e => {
        if (!userMenu || !userMenu.classList.contains("open")) return;
        if (userMenu.contains(e.target) || avatar?.contains(e.target)) return;
        userMenu.classList.remove("open");
    });

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

    photoBtn?.addEventListener('click', () => photoInput?.click());
    photoInput?.addEventListener('change', (e) => {
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

    sendBtn?.addEventListener('click', () => {
        const txt = textInput?.value.trim();
        if (!txt) return;

        textInput.value = '';
        textInput.style.display = 'none';
        textInput.offsetHeight;
        textInput.style.display = '';

        sendMessageToRoom(txt, 'text').catch(() => {});
    });

    textInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const txt = textInput?.value.trim();
            if (!txt) return;
            textInput.value = '';
            sendMessageToRoom(txt, 'text').catch(() => {});
        }
    });

    emojiBtn?.addEventListener('click', (e) => {
        emojiPanel?.classList.toggle('hidden');
        emojiPanel?.setAttribute('aria-hidden', emojiPanel.classList.contains('hidden'));
    });

    document.querySelectorAll('.emoji').forEach(b => {
        b.addEventListener('click', () => {
            if (textInput) textInput.value += b.textContent;
            textInput?.focus();
        });
    });

    document.addEventListener('click', (e) => {
        if (!emojiPanel || emojiPanel.classList.contains('hidden')) return;
        if (e.target === emojiBtn || emojiPanel.contains(e.target)) return;
        emojiPanel.classList.add('hidden');
    });

    finishBtn?.addEventListener('click', () => { modal?.classList.remove('hidden'); });
    modalCancel?.addEventListener('click', () => { modal?.classList.add('hidden'); });
    modalFinish?.addEventListener('click', async () => { 
        modal?.classList.add('hidden'); 
        await finishChat(); 
    });

    newChatBtn?.addEventListener('click', async () => {
        searchCancelled = false;
        
        await clearAllListenersAndState();
        clearRoomStorage();
        
        startSearch();
    });

    cancelSearch?.addEventListener('click', cancelSearchHandler);

    exitBtn?.addEventListener('click', async function (e) {
        e.preventDefault();
        
        await stopAllActivity();
        clearRoomStorage();

        const target = '/anonymous/';
        window.location.replace(target);
    });

    window.addEventListener('beforeunload', async (ev) => {
        try {
            if (waitingHeartbeatInterval) {
                clearInterval(waitingHeartbeatInterval);
                waitingHeartbeatInterval = null;
            }
            
            const currentUid = auth.currentUser?.uid;
            if (currentUid) {
                await remove(ref(rtdb, `waiting/${currentUid}`)).catch(() => { });
            }
            
            if (roomId && auth.currentUser) {
                await remove(ref(rtdb, `rooms/${roomId}/presence/${auth.currentUser.uid}`)).catch(() => { });
            }
        } catch (e) { }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            console.log('Вкладка неактивна, но поиск продолжается');
        } else {
            console.log('Вкладка активна');
        }
    });
}

function toggleMenu() {
    const menu = document.querySelector(".nav-links");
    menu?.classList.toggle("open");
}
window.toggleMenu = toggleMenu;

function toggleUserMenu() {
    userMenu?.classList.toggle("open");
}
window.toggleUserMenu = toggleUserMenu;

let uid = null;
let isRealUser = false;
let roomId = null;
let partnerId = null;
let chatClosed = false;
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

function show(el) { el?.classList.remove('hidden'); }
function hide(el) { el?.classList.add('hidden'); }

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

async function stopAllActivity() {
    if (presenceHeartbeatInterval) {
        clearInterval(presenceHeartbeatInterval);
        presenceHeartbeatInterval = null;
    }
    if (waitingHeartbeatInterval) {
        clearInterval(waitingHeartbeatInterval);
        waitingHeartbeatInterval = null;
    }
    
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
    
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
    
    const cleanupPromises = [];
    
    cleanupPromises.push(
        remove(ref(rtdb, `waiting/${currentUid}`)).catch(() => {})
    );
    
    if (roomId) {
        cleanupPromises.push(
            remove(ref(rtdb, `rooms/${roomId}/presence/${currentUid}`)).catch(() => {})
        );
    }
    
    await Promise.all(cleanupPromises);
    
    if (messagesEl) messagesEl.innerHTML = '';
}

async function clearAllListenersAndState() {
    await stopAllActivity();
    
    roomId = null;
    partnerId = null;
    isConnecting = false;
    matchmakingInProgress = false;
}

document.addEventListener("DOMContentLoaded", () => {
    console.log('DOM загружен, инициализация приложения...');
    
    if (!initializeDOM()) {
        console.error('Не удалось инициализировать DOM элементы!');
        return;
    }
    
    initializeEventHandlers();
    
    console.log('Приложение готово к работе');
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

function clearMessages() { 
    if (messagesEl) messagesEl.innerHTML = ''; 
}

function addMessageToUI(data) {
    if (!messagesEl) {
        console.warn('messagesEl не существует, сообщение не может быть отображено');
        return;
    }
    
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
    if (!roomId || chatClosed) return;
    
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

async function startWaitingHeartbeat(userUid) {
    if (!userUid) return;
    
    if (waitingHeartbeatInterval) clearInterval(waitingHeartbeatInterval);
    
    const waitingRef = ref(rtdb, `waiting/${userUid}`);
    
    waitingHeartbeatInterval = setInterval(async () => {
        if (!auth.currentUser || auth.currentUser.uid !== userUid) {
            console.warn("Heartbeat остановлен: UID изменился");
            if (waitingHeartbeatInterval) {
                clearInterval(waitingHeartbeatInterval);
                waitingHeartbeatInterval = null;
            }
            return;
        }
        
        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Остановить heartbeat если уже в комнате
        if (roomId || chatClosed) {
            console.log("Heartbeat остановлен: пользователь уже в комнате");
            if (waitingHeartbeatInterval) {
                clearInterval(waitingHeartbeatInterval);
                waitingHeartbeatInterval = null;
            }
            return;
        }
        
        try {
            await update(waitingRef, {
                lastSeen: Date.now()
            });
        } catch (e) {
            console.error("Ошибка heartbeat:", e);
            if (e.message?.includes('permission_denied')) {
                if (waitingHeartbeatInterval) {
                    clearInterval(waitingHeartbeatInterval);
                    waitingHeartbeatInterval = null;
                }
            }
        }
    }, WAITING_HEARTBEAT_INTERVAL);
}

async function startSearch() {
    if (!auth.currentUser) {
        console.warn("Ожидание авторизации для начала поиска...");
        return;
    }
    
    const myUid = auth.currentUser.uid;
    uid = myUid;
    
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
        // ИСПРАВЛЕНИЕ: Используем set вместо update
        await set(myWaitingRef, {
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

    // СЛУШАТЕЛЬ СЕБЯ (для роли Ведомого)
    onValue(myWaitingRef, (snap) => {
        const data = snap.val();
        if (!data) return;
        
        if (data.claimed === true && data.roomId && !roomId) {
            console.log("Нас нашли! Переход в комнату:", data.roomId);
            
            roomId = data.roomId; 
            
            off(myWaitingRef); 
            if (waitingRefPath) {
                off(ref(rtdb, waitingRefPath));
                waitingRefPath = null;
            }
            
            saveRoomToStorage(roomId, null);
            
            if (waitingHeartbeatInterval) {
                clearInterval(waitingHeartbeatInterval);
                waitingHeartbeatInterval = null;
            }
            
            hide(searchScreen);
            show(chatWindow);

            connectToRoom(data.roomId).catch(console.error);

            setTimeout(() => {
                remove(myWaitingRef).catch(() => {});
            }, 1000);
        }
    });

    startWaitingHeartbeat(myUid);

    // ПОИСК КАНДИДАТОВ (для роли Лидера)
    const waitingRef = ref(rtdb, 'waiting');
    waitingRefPath = 'waiting';
    
    onValue(waitingRef, async (snap) => {
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
            // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Сначала проверяем что пользователь свободен
            const otherUserRef = ref(rtdb, `waiting/${otherUid}`);
            const otherSnap = await get(otherUserRef);
            
            if (!otherSnap.exists() || otherSnap.val().claimed) {
                console.log("Другой пользователь уже забронирован");
                matchmakingInProgress = false;
                return;
            }

            // Атомарно обновляем обоих
            await update(otherUserRef, { claimed: true, roomId: newRoomId });
            await update(myWaitingRef, { claimed: true, roomId: newRoomId });

            // Создаем комнату
            const sortedParticipants = [myUid, otherUid].sort();
            await set(newRoomRef, {
                participants: sortedParticipants,
                createdAt: Date.now(),
                lastActivity: Date.now(),
                closed: false
            });

            console.log("Комната создана нами (Лидер):", newRoomId);
            
            roomId = newRoomId; 
            
            off(myWaitingRef);
            if (waitingRefPath) {
                off(ref(rtdb, waitingRefPath));
                waitingRefPath = null;
            }
            
            if (waitingHeartbeatInterval) {
                clearInterval(waitingHeartbeatInterval);
                waitingHeartbeatInterval = null;
            }
            
            hide(searchScreen);
            show(chatWindow);
            
            await connectToRoom(newRoomId);

            setTimeout(() => {
                remove(myWaitingRef).catch(() => {});
            }, 1500);

        } catch (err) {
            console.log("Конфликт бронирования, откат:", err);
            matchmakingInProgress = false;
        }
    });
}

async function connectToRoom(rId) {
    try {
        if (!rId) {
            console.error("connectToRoom вызван без roomId");
            return;
        }
        
        if (isConnecting) {
            console.log("Подключение уже в процессе");
            return;
        }

        isConnecting = true;
        chatClosed = false;

        // Удаляем себя из очереди
        if (uid) {
            remove(ref(rtdb, `waiting/${uid}`)).catch(() => {});
        }

        // Отключаем старые слушатели
        if (currentRoomRefPath) off(ref(rtdb, currentRoomRefPath));
        if (messagesRefPath) off(ref(rtdb, messagesRefPath));
        if (presenceRefPath) off(ref(rtdb, presenceRefPath));

        roomId = rId;
        const roomRef = ref(rtdb, `rooms/${roomId}`);
        currentRoomRefPath = `rooms/${roomId}`;

        // Проверяем существование комнаты
        const roomSnap = await get(roomRef);
        if (!roomSnap.exists()) {
            console.error("Комната не существует");
            isConnecting = false;
            roomId = null;
            clearRoomStorage();
            await startSearch();
            return;
        }

        const data = roomSnap.val();
        const parts = data.participants || [];

        if (!parts.includes(uid)) {
            console.error("Пользователь не является участником комнаты");
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

        // Слушаем изменения комнаты
        onValue(roomRef, async (snap) => {
            if (!snap.exists()) {
                if (!chatClosed) {
                    console.log("Комната удалена, закрываем чат");
                    chatClosed = true;
                    endChatUI();
                    setTimeout(async () => {
                        await clearAllListenersAndState();
                        clearRoomStorage();
                    }, 100);
                }
                return;
            }
            const data = snap.val();
            if (data.closed === true && !chatClosed) {
                console.log("Собеседник завершил чат, закрываем у себя");
                chatClosed = true;
                endChatUI();
                setTimeout(async () => {
                    await clearAllListenersAndState();
                    clearRoomStorage();
                }, 100);
            }
        });

        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Правильная загрузка сообщений
        const messagesRef = ref(rtdb, `rooms/${roomId}/messages`);
        messagesRefPath = `rooms/${roomId}/messages`;
        clearMessages();
        
        const loadedMessageIds = new Set();
        
        try {
            const existingMessagesSnap = await get(messagesRef);
            if (existingMessagesSnap.exists()) {
                const messages = [];
                existingMessagesSnap.forEach(child => {
                    const msg = child.val();
                    messages.push({ key: child.key, ...msg });
                    loadedMessageIds.add(child.key);
                });
                
                // Сортируем по времени
                messages.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
                
                // Отображаем все существующие сообщения
                messages.forEach(msg => {
                    if (!chatClosed) addMessageToUI(msg);
                });
                
                console.log(`Загружено ${messages.length} существующих сообщений`);
            }
        } catch (e) {
            console.error("Ошибка загрузки существующих сообщений:", e);
        }
        
        // Слушаем ТОЛЬКО новые сообщения
        onChildAdded(messagesRef, (snap) => {
            if (chatClosed) return;
            
            // Пропускаем уже загруженные
            if (loadedMessageIds.has(snap.key)) {
                return;
            }
            
            const msg = snap.val();
            addMessageToUI(msg);
        });

        await setMyPresence();
        
        isConnecting = false;

    } catch (err) {
        console.error("Ошибка connectToRoom:", err);
        isConnecting = false;
    }
}

async function setMyPresence() {
    if (!roomId || !auth.currentUser) return;
    
    const currentUid = auth.currentUser.uid;
    const presRef = ref(rtdb, `rooms/${roomId}/presence/${currentUid}`);
    presenceRefPath = `rooms/${roomId}/presence/${currentUid}`;
    
    try {
        await update(presRef, { lastSeen: Date.now() });
        onDisconnect(presRef).remove();
    } catch (e) { 
        console.error("Presence set error:", e);
        return;
    }
    
    if (presenceHeartbeatInterval) clearInterval(presenceHeartbeatInterval);
    
    presenceHeartbeatInterval = setInterval(async () => {
        if (!auth.currentUser || !roomId || chatClosed) {
            clearInterval(presenceHeartbeatInterval);
            presenceHeartbeatInterval = null;
            return;
        }
        
        try {
            await update(presRef, { lastSeen: Date.now() });
        } catch (e) { 
            console.error("Presence heartbeat error:", e);
            clearInterval(presenceHeartbeatInterval);
            presenceHeartbeatInterval = null;
        }
    }, PRESENCE_PING_INTERVAL);
}

async function finishChat() {
    const currentRoomId = roomId;
    
    if (currentRoomId && !chatClosed) {
        chatClosed = true;
        
        endChatUI();
        
        try {
            await update(ref(rtdb, `rooms/${currentRoomId}`), { 
                closed: true,
                lastActivity: Date.now()
            });
        } catch (err) {
            console.error("Ошибка закрытия комнаты:", err);
        }
        
        setTimeout(async () => {
            await clearAllListenersAndState();
            clearRoomStorage();
        }, 500);
    } else {
        endChatUI();
        await clearAllListenersAndState();
        clearRoomStorage();
    }
}

function endChatUI() {
    hide(searchScreen);
    hide(chatWindow);
    show(endScreen);
}

async function cancelSearchHandler() {
    searchCancelled = true;
    
    const currentUid = auth.currentUser?.uid;
    if (currentUid) {
        try {
            await remove(ref(rtdb, `waiting/${currentUid}`));
        } catch (e) {
            console.error("Ошибка удаления из очереди:", e);
        }
    }
    
    if (myWaitingRefPath) {
        off(ref(rtdb, myWaitingRefPath));
        myWaitingRefPath = null;
    }
    
    if (waitingRefPath) {
        off(ref(rtdb, waitingRefPath));
        waitingRefPath = null;
    }
    
    if (waitingHeartbeatInterval) {
        clearInterval(waitingHeartbeatInterval);
        waitingHeartbeatInterval = null;
    }
    
    hide(searchScreen);
    show(endScreen);
}
