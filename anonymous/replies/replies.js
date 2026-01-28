/*  replies.js – страница "Мои ответы" --------------------------------------------- */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import {
  getDatabase,
  ref, get
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

/*  ===============  DOM - Элементы  =============== */
const loadingBox = document.getElementById('loadingBox');
const noMessageBox = document.getElementById('noMessageBox');
const noRepliesBox = document.getElementById('noRepliesBox');
const guestBox = document.getElementById('guestBox');
const repliesContent = document.getElementById('repliesContent');

const yourMessageText = document.getElementById('yourMessageText');
const messageDate = document.getElementById('messageDate');
const repliesCount = document.getElementById('repliesCount');
const repliesList = document.getElementById('repliesList');

/*  =====  Навигация / Аватарка  =====  */
const regBtn = document.querySelector('.register-btn');
const avatar = document.querySelector('.user-avatar');
const avatarLetter = document.querySelector('.user-avatar span');
const userMenu = document.querySelector('.user-menu');
const logoutBtn = document.getElementById('logoutBtn');
const navToggle = document.querySelector('.nav-toggle');

/*  ===============  Переменные  =============== */
let uid = null;
let isGuest = true;

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
  
  // Проверяем, является ли пользователь гостем
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
    
    // Загружаем ответы только для зарегистрированных пользователей
    loadReplies();
  } else {
    isGuest = true;
    regBtn?.classList.remove('hidden');
    avatar?.classList.add('hidden');
    localStorage.removeItem('userAvatarLetter');
    
    // Показываем экран для гостей
    showGuestScreen();
  }
});

/*  ===============  Показать экран для гостей  =============== */
function showGuestScreen() {
  hide(loadingBox);
  hide(noMessageBox);
  hide(noRepliesBox);
  hide(repliesContent);
  show(guestBox);
}

/*  ===============  Загрузка ответов  =============== */
async function loadReplies() {
  try {
    // Показываем индикатор загрузки
    show(loadingBox);
    hide(noMessageBox);
    hide(noRepliesBox);
    hide(guestBox);
    hide(repliesContent);
    
    // Проверяем, есть ли у пользователя послание
    const messageRef = ref(rtdb, `anonymous/messages/${uid}`);
    const messageSnap = await get(messageRef);
    
    if (!messageSnap.exists()) {
      // У пользователя нет послания
      hide(loadingBox);
      show(noMessageBox);
      return;
    }
    
    const messageData = messageSnap.val();
    
    // Отображаем послание пользователя
    yourMessageText.textContent = messageData.text || 'Текст послания';
    
    // Форматируем дату
    if (messageData.createdAt && !isNaN(messageData.createdAt)) {
      const date = new Date(messageData.createdAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (date.toDateString() === today.toDateString()) {
        messageDate.textContent = 'Отправлено сегодня';
      } else if (date.toDateString() === yesterday.toDateString()) {
        messageDate.textContent = 'Отправлено вчера';
      } else {
        messageDate.textContent = `Отправлено ${date.toLocaleDateString('ru-RU')}`;
      }
    } else {
      messageDate.textContent = 'Отправлено недавно';
    }
    
    // Загружаем ответы на это послание
    const repliesRef = ref(rtdb, `replies/${uid}`);
    const repliesSnap = await get(repliesRef);
    
    if (!repliesSnap.exists()) {
      // Нет ответов
      const count = messageData.repliesCount || 0;
      repliesCount.textContent = formatRepliesCount(count);
      
      hide(loadingBox);
      show(noRepliesBox);
      return;
    }
    
    // Есть ответы - отображаем их
    const replies = [];
    repliesSnap.forEach(child => {
      replies.push({
        id: child.key,
        ...child.val()
      });
    });
    
    // Сортируем по дате (новые первыми)
    replies.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    
    // Обновляем счётчик ответов
    repliesCount.textContent = formatRepliesCount(replies.length);
    
    // Отображаем ответы
    displayReplies(replies);
    
    // Показываем контент
    hide(loadingBox);
    show(repliesContent);
    
  } catch (error) {
    console.error('Ошибка загрузки ответов:', error);
    hide(loadingBox);
    show(noMessageBox);
  }
}

/*  ===============  Отображение ответов  =============== */
function displayReplies(replies) {
  repliesList.innerHTML = '';
  
  replies.forEach((reply, index) => {
    const replyCard = document.createElement('div');
    replyCard.className = 'reply-card';
    
    // Форматируем дату
    let dateStr = 'Недавно';
    if (reply.createdAt && !isNaN(reply.createdAt)) {
      const date = new Date(reply.createdAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (date.toDateString() === today.toDateString()) {
        dateStr = 'Сегодня';
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateStr = 'Вчера';
      } else {
        dateStr = date.toLocaleDateString('ru-RU');
      }
    }
    
    replyCard.innerHTML = `
      <div class="reply-header">
        <span class="reply-author">Анонимный ответ #${replies.length - index}</span>
        <span class="reply-date">${dateStr}</span>
      </div>
      <div class="reply-text">${escapeHtml(reply.text || '')}</div>
    `;
    
    repliesList.appendChild(replyCard);
  });
}

/*  ===============  Форматирование счётчика ответов  =============== */
function formatRepliesCount(count) {
  if (count === 0) return '0 ответов';
  if (count === 1) return '1 ответ';
  if (count >= 2 && count <= 4) return `${count} ответа`;
  return `${count} ответов`;
}

/*  ===============  Экранирование HTML  =============== */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
