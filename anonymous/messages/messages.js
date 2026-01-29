/*  messages.js – анонимные послания (RTDB) --------------------------------------------- */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import {
  getDatabase,
  ref, set, push, get, remove, update, increment, query, orderByChild, equalTo
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
const app   = initializeApp(firebaseConfig);
const auth  = getAuth(app);
const db    = getFirestore(app);
const rtdb  = getDatabase(app);

/*  ===============  DOM - Экраны  =============== */
const choiceScreen = document.getElementById('choiceScreen');
const writeScreen = document.getElementById('writeScreen');
const receiveScreen = document.getElementById('receiveScreen');

/*  ===============  DOM - Кнопки навигации  =============== */
const writeMsgBtn = document.getElementById('writeMsgBtn');
const receiveMsgBtn = document.getElementById('receiveMsgBtn');
const backFromWrite = document.getElementById('backFromWrite');
const backFromReceive = document.getElementById('backFromReceive');

/*  ===============  DOM - Экран написания  =============== */
const messageTextarea = document.getElementById('messageTextarea');
const charCount = document.getElementById('charCount');
const submitMessageBtn = document.getElementById('submitMessageBtn');
const writeError = document.getElementById('writeError');
const hasMessageInfo = document.getElementById('hasMessageInfo');

/*  ===============  DOM - Экран получения  =============== */
const loadingMessage = document.getElementById('loadingMessage');
const noMessagesBox = document.getElementById('noMessagesBox');
const messageBox = document.getElementById('messageBox');
const receivedMessage = document.getElementById('receivedMessage');
const messageMeta = document.getElementById('messageMeta');
const replyTextarea = document.getElementById('replyTextarea');
const replyCharCount = document.getElementById('replyCharCount');
const sendReplyBtn = document.getElementById('sendReplyBtn');
const replyError = document.getElementById('replyError');
const replySentBox = document.getElementById('replySentBox');
const getAnotherBtn = document.getElementById('getAnotherBtn');

/*  ===============  DOM - Модальное окно  =============== */
const guestModal = document.getElementById('guestModal');
const modalRegisterBtn = document.getElementById('modalRegisterBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');

/*  =====  Навигация / Аватарка  =====  */
const regBtn = document.querySelector('.register-btn');
const avatar = document.querySelector('.user-avatar');
const avatarLetter = document.querySelector('.user-avatar span');
const userMenu = document.querySelector('.user-menu');
const logoutBtn = document.getElementById('logoutBtn');
const navToggle = document.querySelector('.nav-toggle');

/*  ===============  Переменные  =============== */
let uid = null;
let isGuest = true; // По умолчанию считаем гостем
let currentMessageId = null; // ID послания, которое пользователь читает
let authReady = false; // ← НОВОЕ: флаг готовности авторизации

/*  ===============  Utils  =============== */
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');

/*  ===============  Logout  =============== */
logoutBtn?.addEventListener('click', async e => {
  e.preventDefault();
  await auth.signOut();
  localStorage.clear();
  window.location.reload();
});

/*  ===============  Меню  =============== */
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

/* ===== ОПТИМИЗАЦИЯ: локальная аватарка сразу ===== */
const savedAvatar = localStorage.getItem('userAvatarLetter');
if (savedAvatar) {
  regBtn?.classList.add('hidden');
  avatar?.classList.remove('hidden');
  avatarLetter.textContent = savedAvatar;
}

/*  ===============  Auth  =============== */
onAuthStateChanged(auth, user => {
  if (!user) { 
    signInAnonymously(auth); 
    return; 
  }
  uid = user.uid;
  authReady = true; // ← НОВОЕ: авторизация завершена
  
  // Проверяем, является ли пользователь гостем (анонимный вход без email)
  if (user.email) {
    isGuest = false;
    const cachedLetter = localStorage.getItem('userAvatarLetter');
    if (cachedLetter) {
      avatarLetter.textContent = cachedLetter;
    } else {
      const letter = user.email[0].toUpperCase();
      avatarLetter.textContent = letter;
      localStorage.setItem('userAvatarLetter', letter);
    }
    regBtn?.classList.add('hidden');
    avatar?.classList.remove('hidden');
  } else {
    isGuest = true;
    regBtn?.classList.remove('hidden');
    avatar?.classList.add('hidden');
    localStorage.removeItem('userAvatarLetter');
  }
});

/*  ===============  Функция ожидания авторизации  =============== */
async function waitForAuth() {
  // Если уже авторизованы, возвращаем сразу
  if (authReady) return true;
  
  // Ждём максимум 5 секунд
  let attempts = 0;
  while (!authReady && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  return authReady;
}

/*  ===============  Навигация между экранами  =============== */
writeMsgBtn.addEventListener('click', async () => {
  // Проверяем, является ли пользователь гостем
  if (isGuest) {
    show(guestModal);
    return;
  }
  
  hide(choiceScreen);
  show(writeScreen);
  
  // Проверяем, есть ли у пользователя уже послание
  const messageRef = ref(rtdb, `anonymous/messages/${uid}`);
  const snap = await get(messageRef);
  
  if (snap.exists()) {
    const data = snap.val();
    messageTextarea.value = data.text || '';
    charCount.textContent = messageTextarea.value.length;
    show(hasMessageInfo);
  } else {
    messageTextarea.value = '';
    charCount.textContent = '0';
    hide(hasMessageInfo);
  }
});

receiveMsgBtn.addEventListener('click', async () => {
  // ← Сразу переходим на экран получения
  hide(choiceScreen);
  show(receiveScreen);
  
  // Показываем индикатор загрузки
  show(loadingMessage);
  hide(noMessagesBox);
  hide(messageBox);
  hide(replySentBox);
  
  // ← Ждём завершения авторизации
  const ready = await waitForAuth();
  if (!ready) {
    hide(loadingMessage);
    alert('Ошибка авторизации. Попробуйте перезагрузить страницу.');
    hide(receiveScreen);
    show(choiceScreen);
    return;
  }
  
  // Загружаем послание
  loadRandomMessage();
});

backFromWrite.addEventListener('click', () => {
  hide(writeScreen);
  show(choiceScreen);
  messageTextarea.value = '';
  charCount.textContent = '0';
  hideWriteError();
});

backFromReceive.addEventListener('click', () => {
  hide(receiveScreen);
  show(choiceScreen);
  resetReceiveScreen();
});

/*  ===============  Счётчик символов  =============== */
messageTextarea.addEventListener('input', () => {
  charCount.textContent = messageTextarea.value.length;
  hideWriteError();
});

replyTextarea.addEventListener('input', () => {
  replyCharCount.textContent = replyTextarea.value.length;
  hideReplyError();
});

/*  ===============  Отправка послания  =============== */
submitMessageBtn.addEventListener('click', async () => {
  const text = messageTextarea.value.trim();
  
  if (text.length < 10) {
    showWriteError('Послание должно содержать минимум 10 символов');
    return;
  }
  
  if (text.length > 1000) {
    showWriteError('Послание не может быть длиннее 1000 символов');
    return;
  }
  
  try {
    submitMessageBtn.disabled = true;
    submitMessageBtn.textContent = 'Отправляем...';
    
    const messageRef = ref(rtdb, `anonymous/messages/${uid}`);
    
    // Сохраняем послание с uid пользователя в качестве ключа
    await set(messageRef, {
      text,
      authorId: uid,
      createdAt: Date.now(),
      repliesCount: 0
    });
    
    // Успешно отправлено
    messageTextarea.value = '';
    charCount.textContent = '0';
    hide(hasMessageInfo);
    
    alert('✓ Ваше послание отправлено в небытие!');
    
    hide(writeScreen);
    show(choiceScreen);
    
  } catch (error) {
    console.error('Ошибка отправки:', error);
    showWriteError('Не удалось отправить послание. Попробуйте позже.');
  } finally {
    submitMessageBtn.disabled = false;
    submitMessageBtn.textContent = 'Отправить в небытие';
  }
});

/*  ===============  Загрузка случайного послания  =============== */
async function loadRandomMessage() {
  // Скрываем другие блоки (loadingMessage уже показан)
  hide(noMessagesBox);
  hide(messageBox);
  hide(replySentBox);
  
  try {
    const messagesRef = ref(rtdb, 'anonymous/messages');
    const snapshot = await get(messagesRef);
    
    if (!snapshot.exists()) {
      show(noMessagesBox);
      hide(loadingMessage);
      return;
    }
    
    const allMessages = [];
    snapshot.forEach(child => {
      const data = child.val();
      // Не показываем своё собственное послание
      if (!uid || child.key !== uid) {
        allMessages.push({
          id: child.key,
          ...data
        });
      }
    });
    
    if (allMessages.length === 0) {
      show(noMessagesBox);
      hide(loadingMessage);
      return;
    }
    
    // Выбираем случайное послание
    const randomMsg = allMessages[Math.floor(Math.random() * allMessages.length)];
    currentMessageId = randomMsg.id;
    
    // Отображаем послание
    receivedMessage.textContent = randomMsg.text || 'Послание без текста';
    
    // Форматируем дату
    if (randomMsg.createdAt && !isNaN(randomMsg.createdAt)) {
      const date = new Date(randomMsg.createdAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (date.toDateString() === today.toDateString()) {
        messageMeta.textContent = 'Отправлено сегодня';
      } else if (date.toDateString() === yesterday.toDateString()) {
        messageMeta.textContent = 'Отправлено вчера';
      } else {
        messageMeta.textContent = `Отправлено ${date.toLocaleDateString('ru-RU')}`;
      }
    } else {
      messageMeta.textContent = 'Отправлено недавно';
    }
    
    replyTextarea.value = '';
    replyCharCount.textContent = '0';
    
    hide(loadingMessage);
    show(messageBox);
    
  } catch (error) {
    console.error('Ошибка загрузки:', error);
    show(noMessagesBox);
    hide(loadingMessage);
  }
}

/*  ===============  Отправка ответа  =============== */
sendReplyBtn.addEventListener('click', async () => {
  const text = replyTextarea.value.trim();
  
  if (text.length < 5) {
    showReplyError('Ответ должен содержать минимум 5 символов');
    return;
  }
  
  if (text.length > 500) {
    showReplyError('Ответ не может быть длиннее 500 символов');
    return;
  }
  
  if (!currentMessageId) {
    showReplyError('Не удалось определить послание');
    return;
  }
  
  try {
    sendReplyBtn.disabled = true;
    sendReplyBtn.textContent = 'Отправляем...';
    
    const newReplyRef = push(ref(rtdb, `replies/${currentMessageId}`));
    await set(newReplyRef, {
      text: text,
      createdAt: Date.now()
    });
    
    const messageRef = ref(rtdb, `anonymous/messages/${currentMessageId}`);
    await update(messageRef, {
      repliesCount: increment(1)
    });
    
    hide(messageBox);
    show(replySentBox);
    
  } catch (error) {
    console.error('Ошибка отправки ответа:', error);
    
    if (error.message.includes('PERMISSION_DENIED')) {
      showReplyError('Ошибка доступа: проверьте правила базы данных.');
    } else {
      showReplyError('Не удалось отправить ответ. Попробуйте позже.');
    }
  } finally {
    sendReplyBtn.disabled = false;
    sendReplyBtn.textContent = 'Отправить ответ';
  }
});

/*  ===============  Получить ещё послание  =============== */
getAnotherBtn.addEventListener('click', () => {
  resetReceiveScreen();
  show(loadingMessage); // ← Показываем индикатор загрузки
  loadRandomMessage();
});

/*  ===============  Сброс экрана получения  =============== */
function resetReceiveScreen() {
  hide(messageBox);
  hide(replySentBox);
  hide(noMessagesBox);
  currentMessageId = null;
  replyTextarea.value = '';
  replyCharCount.textContent = '0';
  hideReplyError();
}

/*  ===============  Ошибки  =============== */
function showWriteError(msg) {
  writeError.textContent = msg;
  writeError.classList.add('visible');
}

function hideWriteError() {
  writeError.textContent = '';
  writeError.classList.remove('visible');
}

function showReplyError(msg) {
  replyError.textContent = msg;
  replyError.classList.add('visible');
}

function hideReplyError() {
  replyError.textContent = '';
  replyError.classList.remove('visible');
}

/*  ===============  Модальное окно  =============== */
modalRegisterBtn.addEventListener('click', () => {
  window.location.href = '/login/';
});

modalCancelBtn.addEventListener('click', () => {
  hide(guestModal);
});

// Закрытие модального окна по клику вне его
guestModal.addEventListener('click', (e) => {
  if (e.target === guestModal) {
    hide(guestModal);
  }
});
