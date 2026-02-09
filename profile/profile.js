import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import {
    getDatabase,
    ref as dbRef,
    push,
    set,
    onValue,
    remove,
    update,
    query,
    orderByChild,
    equalTo,
    get
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";

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
const storage = getStorage(app);

// DOM элементы
const regBtn = document.querySelector(".register-btn");
const avatar = document.querySelector(".user-avatar");
const avatarLetter = document.querySelector(".user-avatar span");
const userMenu = document.querySelector(".user-menu");
const logoutBtn = document.getElementById("logoutBtn");

const profileAvatar = document.getElementById("profileAvatar");
const avatarLetterProfile = document.getElementById("avatarLetter");
const profileName = document.getElementById("profileName");
const profileBio = document.getElementById("profileBio");
const avatarUpload = document.getElementById("avatarUpload");

const editProfileBtn = document.getElementById("editProfileBtn");

const postInput = document.getElementById("postInput");
const publishPostBtn = document.getElementById("publishPostBtn");
const attachPhotoBtn = document.getElementById("attachPhotoBtn");
const postPhotoInput = document.getElementById("postPhotoInput");
const postsList = document.getElementById("postsList");

const photoModal = document.getElementById("photoModal");
const closePhotoModal = document.getElementById("closePhotoModal");
const modalPhoto = document.getElementById("modalPhoto");

const postsCount = document.getElementById("postsCount");
const memberSince = document.getElementById("memberSince");

// YouTube элементы
const youtubeCard = document.getElementById("youtubeCard");
const youtubeEmpty = document.getElementById("youtubeEmpty");
const youtubeIframe = document.getElementById("youtubeIframe");
const addVideoBtn = document.getElementById("addVideoBtn");

// Статус элементы
const statusText = document.querySelector(".status-text");

// Информация элементы
const infoContent = document.getElementById("infoContent");

let currentUser = null;
let currentUserData = null; 
let currentPhotoFile = null;
let postsListener = null;
const PROFILE_CACHE_KEY = "userProfileCache_v1";

// ЗАГРУЗКА АВАТАРКИ ИЗ localStorage СРАЗУ
const savedAvatar = localStorage.getItem('userAvatarLetter');
if (savedAvatar) {
    regBtn?.classList.add('hidden');
    avatar?.classList.remove('hidden');
    avatarLetter.textContent = savedAvatar;
}

// Навигация
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

// ========================
// 📝 ИНФОРМАЦИЯ ФУНКЦИИ (ТОЛЬКО ОТОБРАЖЕНИЕ)
// ========================

// Рендер блока информации
function renderInfo(infoData) {
    if (!infoContent) return;
    
    const hasLinks = infoData?.links && infoData.links.length > 0;
    const hasEmail = infoData?.email && infoData.email.trim() !== "";
    const hasCountry = infoData?.country && infoData.country.trim() !== "";
    const hasNickname = infoData?.nickname && infoData.nickname.trim() !== "";
    const hasOccupation = infoData?.occupation && infoData.occupation.trim() !== "";
    
    const hasAnyInfo = hasLinks || hasEmail || hasCountry || hasNickname || hasOccupation;
    
    if (!hasAnyInfo) {
        infoContent.innerHTML = '<div class="info-empty">Информация отсутствует</div>';
        return;
    }
    
    let html = '';
    
    // 1) Местоположение
    if (hasCountry) {
        html += `
            <div class="info-item">
                <div class="info-label">Местоположение</div>
                <div class="info-value">${escapeHtml(infoData.country)}</div>
            </div>
        `;
    }
    
    // 2) Прозвище (с кастомным названием)
    if (hasNickname) {
        const nicknameLabel = infoData.nicknameLabel || "Прозвище";
        html += `
            <div class="info-item">
                <div class="info-label">${escapeHtml(nicknameLabel)}</div>
                <div class="info-value">${escapeHtml(infoData.nickname)}</div>
            </div>
        `;
    }
    
    // 3) Электронная почта
    if (hasEmail) {
        html += `
            <div class="info-item">
                <div class="info-label">Связь</div>
                <div class="info-value">${escapeHtml(infoData.email)}</div>
            </div>
        `;
    }
    
    // 4) Род деятельности
    if (hasOccupation) {
        html += `
            <div class="info-item">
                <div class="info-label">Род деятельности</div>
                <div class="info-value">${escapeHtml(infoData.occupation)}</div>
            </div>
        `;
    }
    
    // 5) Ссылки
    if (hasLinks) {
        html += `
            <div class="info-item">
                <div class="info-label">Ссылки</div>
                <div class="info-links">
                    ${infoData.links.map(link => `
                        <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="info-link">
                            ${escapeHtml(link.name)}
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    infoContent.innerHTML = html;
}

// ========================
// 📝 СТАТУС ФУНКЦИИ (ТОЛЬКО ОТОБРАЖЕНИЕ)
// ========================
function renderStatus(status) {
    if (!statusText) return;
    
    if (!status || status.trim() === "") {
        statusText.innerHTML = `
            <span style="opacity: 0.5; font-style: italic; color: var(--text-secondary);">Статус не установлен</span>
        `;
    } else {
        statusText.innerHTML = `
            <div class="status-content" style="white-space: pre-wrap; word-break: break-word;"></div>
        `;
        
        const contentDiv = statusText.querySelector('.status-content');
        contentDiv.textContent = status;
    }
}

// ========================
// 🎬 YOUTUBE ФУНКЦИИ
// ========================
function extractVideoId(url) {
    if (!url) return null;
    
    url = url.trim();
    
    if (url.includes('/shorts/')) {
        return null;
    }
    
    const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) {
        return watchMatch[1];
    }
    
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) {
        return shortMatch[1];
    }
    
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
        return url;
    }
    
    return null;
}

function loadYoutubeVideo(videoId) {
    if (!videoId) {
        youtubeIframe.src = "";
        youtubeCard.classList.add('hidden');
        youtubeEmpty.classList.remove('hidden');
        return;
    }

    youtubeIframe.src = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
    youtubeCard.classList.remove('hidden');
    youtubeEmpty.classList.add('hidden');
}

async function saveYoutubeVideo(videoId) {
    if (!currentUser) return;
    
    try {
        const userDocRef = doc(db, "users", currentUser.uid);
        await setDoc(userDocRef, {
            youtubeVideoId: videoId || null
        }, { merge: true });
        
        currentUserData.youtubeVideoId = videoId || null;
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));
        
        console.log("YouTube видео сохранено!");
    } catch (error) {
        console.error("Ошибка сохранения YouTube видео:", error);
        throw error;
    }
}

addVideoBtn?.addEventListener("click", async () => {
    const url = prompt("Вставьте ссылку на YouTube видео:\n\nПоддерживаемые форматы:\n• youtube.com/watch?v=...\n• youtu.be/...\n\n⚠️ Shorts не поддерживаются!");
    
    if (!url) return;
    
    const videoId = extractVideoId(url);
    
    if (!videoId) {
        alert("❌ Неверная ссылка!\n\nПроверьте, что:\n• Это ссылка на обычное YouTube видео\n• Это НЕ Shorts\n• Формат: youtube.com/watch?v=... или youtu.be/...");
        return;
    }
    
    try {
        await saveYoutubeVideo(videoId);
        loadYoutubeVideo(videoId);
        alert("✅ Видео успешно добавлено!");
    } catch (error) {
        alert("❌ Не удалось сохранить видео");
    }
});

// ========================
// ПРОВЕРКА АВТОРИЗАЦИИ
// ========================
onAuthStateChanged(auth, async (user) => {
    if (!user || !user.email) {
        window.location.href = "/login/";
        return;
    }

    const cachedUID = localStorage.getItem("currentUserUID");
    
    if (cachedUID && cachedUID !== user.uid) {
        console.log("Обнаружена смена пользователя, очистка кэша...");
        localStorage.removeItem(PROFILE_CACHE_KEY);
        localStorage.removeItem("userAvatarLetter");
    }
    
    localStorage.setItem("currentUserUID", user.uid);

    currentUser = user;

    const userDocRef = doc(db, "users", user.uid);

    const cachedProfile = localStorage.getItem(PROFILE_CACHE_KEY);

    if (cachedProfile) {
        try {
            currentUserData = JSON.parse(cachedProfile);
            console.log("Профиль загружен из кэша");
        } catch (e) {
            console.error("Ошибка парсинга кэша, загружаем из Firestore");
            localStorage.removeItem(PROFILE_CACHE_KEY);
            currentUserData = null;
        }
    }
    
    if (!currentUserData) {
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
            const defaultName = user.email.split('@')[0];

            const newProfile = {
                name: defaultName,
                email: user.email,
                bio: "",
                avatarUrl: null,
                youtubeVideoId: null,
                status: "",
                info: {
                    links: [],
                    email: "",
                    country: "",
                    nickname: "",
                    nicknameLabel: "Прозвище",
                    occupation: ""
                }
            };

            await setDoc(userDocRef, newProfile);
            currentUserData = newProfile;
        } else {
            currentUserData = userSnap.data();
            
            // Инициализация info, если его нет
            if (!currentUserData.info) {
                currentUserData.info = {
                    links: [],
                    email: "",
                    country: "",
                    nickname: "",
                    nicknameLabel: "Прозвище",
                    occupation: ""
                };
            }
        }

        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));
        console.log("Профиль загружен из Firestore и закэширован");
    }

    const letter = currentUserData.name.charAt(0).toUpperCase();
    avatarLetter.textContent = letter;
    localStorage.setItem("userAvatarLetter", letter);

    renderProfile(currentUserData);
    renderStatus(currentUserData.status || "");
    renderInfo(currentUserData.info || {});
    loadYoutubeVideo(currentUserData.youtubeVideoId);
    loadUserPosts();
});

// ========================
// ВЫХОД
// ========================
logoutBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    
    if (postsListener) {
        postsListener();
        postsListener = null;
    }
    
    await signOut(auth);
    localStorage.clear();
    window.location.href = "/login/";
});

// ========================
// ЗАГРУЗКА ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ
// ========================
function renderProfile(userData) {
    profileName.textContent = userData.name;

    const hasBio = userData.bio && 
                   userData.bio.trim() !== "" && 
                   userData.bio !== "Расскажите о себе..." &&
                   userData.bio !== "Расскажите о себе…";

    if (hasBio) {
        profileBio.textContent = userData.bio;
        profileBio.classList.remove("empty");
    } else {
        profileBio.textContent = "Расскажите о себе…";
        profileBio.classList.add("empty");
    }

    if (userData.avatarUrl) {
        avatarLetterProfile.style.display = "none";
        const img = document.createElement("img");
        img.src = userData.avatarUrl;
        profileAvatar.innerHTML = "";
        profileAvatar.appendChild(img);
    } else {
        avatarLetterProfile.textContent = userData.name.charAt(0).toUpperCase();
    }

    if (currentUser?.metadata?.creationTime) {
        const date = new Date(currentUser.metadata.creationTime);
        memberSince.textContent = date.toLocaleDateString("ru-RU", {
            year: "numeric",
            month: "long"
        });
    }
}

// ========================
// ЗАГРУЗКА АВАТАРКИ
// ========================
avatarUpload.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (file.size > 5 * 1024 * 1024) {
        alert("Файл слишком большой. Максимальный размер: 5MB");
        return;
    }

    try {
        const avatarRef = storageRef(storage, `avatars/${currentUser.uid}/${Date.now()}_${file.name}`);
        await uploadBytes(avatarRef, file);
        const avatarUrl = await getDownloadURL(avatarRef);

        const userDocRef = doc(db, "users", currentUser.uid);
        await updateDoc(userDocRef, { avatarUrl });

        currentUserData.avatarUrl = avatarUrl;
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));

        avatarLetterProfile.style.display = "none";
        const img = document.createElement("img");
        img.src = avatarUrl;
        img.alt = "Avatar";
        profileAvatar.innerHTML = "";
        profileAvatar.appendChild(img);

        console.log("Аватар обновлен!");
    } catch (error) {
        console.error("Ошибка загрузки аватара:", error);
        alert("Не удалось загрузить аватар");
    }

    avatarUpload.value = "";
});

// ========================
// РЕДАКТИРОВАНИЕ ПРОФИЛЯ
// ========================
editProfileBtn.addEventListener("click", () => {
    window.location.href = "/profile/edit/";
});

// ========================
// ПУБЛИКАЦИЯ ЗАПИСИ
// ========================
attachPhotoBtn.addEventListener("click", () => {
    postPhotoInput.click();
});

postPhotoInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        alert("Файл слишком большой. Максимальный размер: 10MB");
        postPhotoInput.value = "";
        return;
    }

    currentPhotoFile = file;
    attachPhotoBtn.textContent = `📷 Фото выбрано`;
    attachPhotoBtn.style.color = "var(--accent)";
});

publishPostBtn.addEventListener("click", async () => {
    if (!currentUser || !currentUserData) return;

    const text = postInput.value.trim();

    if (!text && !currentPhotoFile) {
        alert("Напишите текст или добавьте фото");
        return;
    }

    publishPostBtn.disabled = true;
    publishPostBtn.textContent = "Публикация...";

    try {
        let photoUrl = null;

        if (currentPhotoFile) {
            const photoRef = storageRef(storage, `posts/${currentUser.uid}/${Date.now()}_${currentPhotoFile.name}`);
            await uploadBytes(photoRef, currentPhotoFile);
            photoUrl = await getDownloadURL(photoRef);
        }

        // Генерируем pushId
        const newPostId = push(dbRef(rtdb, 'posts')).key;

        // Атомарный update: пост без uid + owner в отдельную ветку
        await update(dbRef(rtdb), {
            [`posts/${newPostId}`]: {
                userName: currentUserData.name,
                userAvatar: currentUserData.avatarUrl || null,
                text: text || "",
                photoUrl: photoUrl,
                createdAt: Date.now()
            },
            [`postOwners/${newPostId}`]: currentUser.uid
        });

        postInput.value = "";
        currentPhotoFile = null;
        postPhotoInput.value = "";
        attachPhotoBtn.textContent = "📷 Фото";
        attachPhotoBtn.style.color = "";

        console.log("Запись опубликована!");
    } catch (error) {
        console.error("Ошибка публикации записи:", error);
        alert("Не удалось опубликовать запись");
    } finally {
        publishPostBtn.disabled = false;
        publishPostBtn.textContent = "Опубликовать";
    }
});

// ========================
// ЗАГРУЗКА ПОСТОВ
// ========================
function loadUserPosts() {
    if (!currentUser) return;

    if (postsListener) {
        postsListener();
    }

    const postsRef = dbRef(rtdb, 'posts');

    postsListener = onValue(postsRef, async (snapshot) => {
        if (!snapshot.exists()) {
            if (postsList.children.length > 0 || !postsList.querySelector('.posts-empty')) {
                showEmptyPosts();
            }
            return;
        }

        // Собираем все посты
        const allPosts = [];
        snapshot.forEach(childSnapshot => {
            allPosts.push({
                id: childSnapshot.key,
                data: childSnapshot.val()
            });
        });

        // Для каждого поста проверяем, наш ли он через postOwners
        const myPosts = [];
        const ownerChecks = allPosts.map(async (post) => {
            try {
                const ownerSnap = await get(dbRef(rtdb, `postOwners/${post.id}`));

                if (ownerSnap.exists() && ownerSnap.val() === currentUser.uid) {
                    myPosts.push(post);
                }
            } catch (e) {
            }
        });

        await Promise.all(ownerChecks);

        if (myPosts.length === 0) {
            showEmptyPosts();
            return;
        }

        myPosts.sort((a, b) => b.data.createdAt - a.data.createdAt);

        // УМНЫЙ РЕНДЕР С DOCUMENTFRAGMENT
        // 1. Создаем карту существующих элементов
        const currentElements = {};
        postsList.querySelectorAll('.post-item').forEach(el => {
            currentElements[el.dataset.postId] = el;
        });

        // 2. Собираем новый список в fragment
        const fragment = document.createDocumentFragment();
        
        myPosts.forEach(post => {
            if (currentElements[post.id]) {
                // Пост уже существует - переиспользуем элемент
                fragment.appendChild(currentElements[post.id]);
                delete currentElements[post.id]; // Убираем из списка "на удаление"
            } else {
                // Новый пост - создаем элемент
                const tempContainer = document.createElement('div');
                tempContainer.innerHTML = createPostHTML(post.id, post.data);
                const postElement = tempContainer.firstElementChild;
                
                // Навешиваем обработчики
                attachPostHandlers(postElement, post.id, post.data);
                
                fragment.appendChild(postElement);
            }
        });

        // 3. Удаляем элементы, которых больше нет
        Object.values(currentElements).forEach(el => el.remove());

        // 4. Обновляем список одним махом (без полного innerHTML = '')
if (postsList.innerHTML !== "") {
            postsList.replaceChildren(fragment);
        } else {
            postsList.appendChild(fragment);
        }

        if (postsCount) {
            postsCount.textContent = myPosts.length.toString();
        }
    }, (error) => {
        console.error("Ошибка загрузки постов:", error);
    });
}

// Вспомогательная функция: создание HTML поста
function createPostHTML(postId, post) {
    const userName = post.userName || 'Пользователь';
    const userAvatar = post.userAvatar;
    const letter = userName.charAt(0).toUpperCase();
    
    let timeStr = "Только что";
    if (post.createdAt) {
        const date = new Date(post.createdAt);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            timeStr = "Только что";
        } else if (diffMins < 60) {
            timeStr = `${diffMins} ${pluralize(diffMins, 'минуту', 'минуты', 'минут')} назад`;
        } else if (diffHours < 24) {
            timeStr = `${diffHours} ${pluralize(diffHours, 'час', 'часа', 'часов')} назад`;
        } else if (diffDays < 7) {
            timeStr = `${diffDays} ${pluralize(diffDays, 'день', 'дня', 'дней')} назад`;
        } else {
            timeStr = date.toLocaleDateString("ru-RU", { 
                day: 'numeric', 
                month: 'long',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        }
    }

    const avatarHtml = userAvatar 
        ? `<img src="${userAvatar}" alt="${userName}" class="post-avatar-img">`
        : letter;

    return `
        <div class="post-item" data-post-id="${postId}">
            <div class="post-header">
                <div class="post-avatar">${avatarHtml}</div>
                <div class="post-info">
                    <div class="post-author">${escapeHtml(userName)}</div>
                    <div class="post-time">${timeStr}</div>
                </div>
                <button class="post-delete" data-post-id="${postId}">Удалить</button>
            </div>
            ${post.text ? `<div class="post-content">${escapeHtml(post.text)}</div>` : ''}
            ${post.photoUrl ? `<img src="${post.photoUrl}" alt="Post photo" class="post-image" data-photo="${post.photoUrl}">` : ''}
        </div>
    `;
}

// Вспомогательная функция: навешивание обработчиков
function attachPostHandlers(postElement, postId, post) {
    const deleteBtn = postElement.querySelector(".post-delete");
    if (deleteBtn) {
        deleteBtn.addEventListener("click", () => {
            deletePostSafely(postId);
        });
    }

    const photoImg = postElement.querySelector(".post-image");
    if (photoImg && post.photoUrl) {
        photoImg.addEventListener("click", () => {
            modalPhoto.src = post.photoUrl;
            photoModal.classList.remove("hidden");
        });
    }
}

function showEmptyPosts() {
    postsList.innerHTML = `
        <div class="posts-empty">
            <div class="posts-empty-icon">📝</div>
            <div class="posts-empty-text">
                Здесь пока нет записей. Создайте первую!
            </div>
        </div>
    `;
    if (postsCount) {
        postsCount.textContent = "0";
    }
}

// ========================
// БЕЗОПАСНОЕ УДАЛЕНИЕ ПОСТА
// ========================
async function deletePostSafely(postId) {
    if (!confirm("Удалить эту запись?")) return;
    
    // Сохраняем текущую позицию скролла
    const scrollPos = window.pageYOffset || document.documentElement.scrollTop;
    
    try {
        // 1. МОЩНАЯ ЗАМОРОЗКА: Используем height вместо minHeight для надежности
        const wallSection = document.querySelector('.wall-section');
        const postsList = document.getElementById('postsList');
        const contentGrid = document.querySelector('.content-grid');
        
        let savedHeights = {};
        
        if (wallSection && postsList) {
            savedHeights = {
                wall: wallSection.offsetHeight,
                posts: postsList.offsetHeight,
                grid: contentGrid ? contentGrid.offsetHeight : null
            };
            
            // Фиксируем через height (жестче чем minHeight)
            wallSection.style.height = `${savedHeights.wall}px`;
            postsList.style.height = `${savedHeights.posts}px`;
            if (contentGrid) {
                contentGrid.style.height = `${savedHeights.grid}px`;
            }
        }
        
        // 2. Удаляем пост из Firebase
        await update(dbRef(rtdb), {
            [`posts/${postId}`]: null,
            [`postOwners/${postId}`]: null
        });
        
        console.log("Запись удалена!");
        
        // 3. Принудительно удерживаем скролл
        window.scrollTo(0, scrollPos);
        
        // 4. РАЗМОРОЗКА: Снимаем фиксацию через 250ms
        setTimeout(() => {
            if (wallSection) wallSection.style.height = '';
            if (postsList) postsList.style.height = '';
            if (contentGrid) contentGrid.style.height = '';
            
            // Финальная проверка скролла
            requestAnimationFrame(() => {
                window.scrollTo(0, scrollPos);
            });
        }, 250);
        
    } catch (error) {
        console.error("Ошибка удаления записи:", error);
        alert("Не удалось удалить запись");
        
        // В случае ошибки снимаем все фиксации
        const wallSection = document.querySelector('.wall-section');
        const postsList = document.getElementById('postsList');
        const contentGrid = document.querySelector('.content-grid');
        
        if (wallSection) wallSection.style.height = '';
        if (postsList) postsList.style.height = '';
        if (contentGrid) contentGrid.style.height = '';
        
        // Восстанавливаем скролл
        window.scrollTo(0, scrollPos);
    }
}

closePhotoModal.addEventListener("click", () => {
    photoModal.classList.add("hidden");
});

photoModal.addEventListener("click", (e) => {
    if (e.target === photoModal) {
        photoModal.classList.add("hidden");
    }
});

function pluralize(num, one, few, many) {
    const mod10 = num % 10;
    const mod100 = num % 100;
    
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}
