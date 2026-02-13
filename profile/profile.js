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
    getDocs,
    serverTimestamp,
    updateDoc,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    deleteDoc,
    Timestamp,
    limit,
    startAfter,
    increment,
    persistentLocalCache,
    initializeFirestore
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";

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

// ✅ ИСПРАВЛЕНО: Новый способ включения кэширования (без предупреждения)
const db = initializeFirestore(app, {
    localCache: persistentLocalCache(/*settings*/{})
});

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
const profileUsernameID = document.getElementById("profileUsernameID"); // ✅ НОВОЕ
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
const PROFILE_CACHE_KEY = "userProfileCache_v1";

// ✅ Infinite Scroll (бесконечная лента)
const POSTS_PER_PAGE = 20;
let lastVisible = null;
let isFetching = false;
let hasMore = true; // Флаг: есть ли ещё посты для загрузки

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
    
    // Всегда загружаем актуальные данные из Firestore
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
        // Новый пользователь - создаём профиль
        const defaultName = user.email.split('@')[0];

        const newProfile = {
            name: defaultName,
            email: user.email,
            bio: "",
            avatarUrl: null,
            youtubeVideoId: null,
            status: "",
            postsCount: 0,
            usernameID: user.uid, // ✅ По умолчанию равен uid
            info: {
                links: [],
                email: "",
                country: "",
                nickname: "",
                nicknameLabel: "Прозвище",
                occupation: ""
            }
        };

        // Создаём документ в коллекции usernames для отслеживания уникальности
        const usernameDocRef = doc(db, "usernames", user.uid.toLowerCase());

        await Promise.all([
            setDoc(userDocRef, newProfile),
            setDoc(usernameDocRef, { ownerUID: user.uid })
        ]);
        
        currentUserData = newProfile;
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));
        console.log("Создан новый профиль с usernameID:", user.uid);
    } else {
        // Профиль существует - получаем актуальные данные
        const freshData = userSnap.data();
        
        // ✅ Миграция старых пользователей: добавляем usernameID если его нет
        if (!freshData.usernameID) {
            freshData.usernameID = user.uid;
            
            // Создаём документ в usernames для старых пользователей
            const usernameDocRef = doc(db, "usernames", user.uid.toLowerCase());
            
            await Promise.all([
                updateDoc(userDocRef, { usernameID: user.uid }),
                setDoc(usernameDocRef, { ownerUID: user.uid })
            ]);
            
            console.log("✅ Миграция: добавлен usernameID для старого пользователя");
        }
        
        // Инициализация info, если его нет
        if (!freshData.info) {
            freshData.info = {
                links: [],
                email: "",
                country: "",
                nickname: "",
                nicknameLabel: "Прозвище",
                occupation: ""
            };
        }

        // Проверяем, изменились ли данные
        const cachedJSON = JSON.stringify(currentUserData);
        const freshJSON = JSON.stringify(freshData);

        if (cachedJSON !== freshJSON) {
            console.log("Обнаружены обновления профиля, синхронизация...");
            currentUserData = freshData;
            localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));
            
            // Обновляем UI с актуальными данными
            renderProfile(currentUserData);
            renderStatus(currentUserData.status || "");
            renderInfo(currentUserData.info || {});
            loadYoutubeVideo(currentUserData.youtubeVideoId);
        } else {
            console.log("Профиль актуален");
            // Если был загружен из кэша, используем свежие данные
            if (currentUserData) {
                currentUserData = freshData;
            }
        }
    }

    const letter = currentUserData.name.charAt(0).toUpperCase();
    avatarLetter.textContent = letter;
    localStorage.setItem("userAvatarLetter", letter);

    renderProfile(currentUserData);
    renderStatus(currentUserData.status || "");
    renderInfo(currentUserData.info || {});
    loadYoutubeVideo(currentUserData.youtubeVideoId);
    
    // ✅ Инициализируем скролл-листенер и загружаем посты
    initScrollListener();
    loadUserPosts();
});

// ========================
// ВЫХОД
// ========================
logoutBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    
    // ✅ Очищаем обработчик скролла (предотвращение утечки памяти)
    cleanupScrollListener();
    
    await signOut(auth);
    localStorage.clear();
    window.location.href = "/login/";
});

// ========================
// ЗАГРУЗКА ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ
// ========================
function renderProfile(userData) {
    profileName.textContent = userData.name;

    // ✅ НОВОЕ: Отображение usernameID
    if (profileUsernameID && userData.usernameID) {
        profileUsernameID.textContent = `@${userData.usernameID}`;
    }

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

    // ✅ Способ В: Отображаем счетчик постов из профиля (0 чтений вместо N)
    if (postsCount) {
        postsCount.textContent = (userData.postsCount || 0).toString();
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
        // ✅ Удаляем старую аватарку перед загрузкой новой
        if (currentUserData.avatarPath) {
            try {
                const oldAvatarRef = storageRef(storage, currentUserData.avatarPath);
                await deleteObject(oldAvatarRef);
                console.log("Старая аватарка удалена");
            } catch (error) {
                console.warn("Не удалось удалить старую аватарку:", error);
            }
        }

        const avatarPath = `avatars/${currentUser.uid}/${Date.now()}_${file.name}`;
        const avatarRef = storageRef(storage, avatarPath);
        await uploadBytes(avatarRef, file);
        const avatarUrl = await getDownloadURL(avatarRef);

        const userDocRef = doc(db, "users", currentUser.uid);
        await updateDoc(userDocRef, { 
            avatarUrl,
            avatarPath // ✅ Сохраняем путь для будущего удаления
        });

        currentUserData.avatarUrl = avatarUrl;
        currentUserData.avatarPath = avatarPath;
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
// ПУБЛИКАЦИЯ ЗАПИСИ (FIRESTORE)
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

    let uploadedPhotoRef = null; // ✅ Храним ссылку для отката

    try {
        let photoUrl = null;
        let photoPath = null; // ✅ Сохраняем путь для надёжного удаления

        if (currentPhotoFile) {
            const filePath = `posts/${currentUser.uid}/${Date.now()}_${currentPhotoFile.name}`;
            uploadedPhotoRef = storageRef(storage, filePath);
            await uploadBytes(uploadedPhotoRef, currentPhotoFile);
            photoUrl = await getDownloadURL(uploadedPhotoRef);
            photoPath = filePath; // ✅ Сохраняем путь
        }

        // Добавляем пост в Firestore: users/{uid}/posts/{postId}
        const postsCollectionRef = collection(db, "users", currentUser.uid, "posts");
        
        // Данные для сохранения
        const newPostData = {
            userName: currentUserData.name,
            userAvatar: currentUserData.avatarUrl || null,
            text: text || "",
            photoUrl: photoUrl,
            photoPath: photoPath, // ✅ Путь для надёжного удаления
            createdAt: serverTimestamp()
        };

        // ✅ ИСПРАВЛЕНО: Используем docRef вместо docSnap
        const docRef = await addDoc(postsCollectionRef, newPostData);

        // ✅ Способ В: Увеличиваем счетчик постов (+1)
        const userDocRef = doc(db, "users", currentUser.uid);
        await updateDoc(userDocRef, {
            postsCount: increment(1)
        });

        // Обновляем локальный счетчик
        currentUserData.postsCount = (currentUserData.postsCount || 0) + 1;
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));
        
        if (postsCount) {
            postsCount.textContent = currentUserData.postsCount.toString();
        }

        // ✅ МГНОВЕННОЕ ОТОБРАЖЕНИЕ: Убираем сообщение "нет постов" если оно есть
        const emptyMsg = document.querySelector(".posts-empty");
        if (emptyMsg) emptyMsg.remove();

        // ✅ МГНОВЕННОЕ ОТОБРАЖЕНИЕ: Добавляем пост в начало списка
        // Для UI используем текущее время вместо серверного timestamp
        const postDataForUI = {
            ...newPostData,
            createdAt: Timestamp.now() // Используем клиентское время для UI
        };
        addPostToUI(docRef.id, postDataForUI, true); // ✅ ИСПРАВЛЕНО: docRef вместо docSnap

        // ✅ Сбрасываем флаг hasMore, если были в конце списка
        // (теперь есть новый пост, возможно появятся и другие)
        if (!hasMore && currentUserData.postsCount === 1) {
            hasMore = true;
        }

        postInput.value = "";
        currentPhotoFile = null;
        postPhotoInput.value = "";
        attachPhotoBtn.textContent = "📷 Фото";
        attachPhotoBtn.style.color = "";

        console.log("Запись опубликована!");
    } catch (error) {
        console.error("Ошибка публикации записи:", error);
        
        // ✅ ОТКАТ: Если фото загрузилось, но пост не создался - удаляем фото
        if (uploadedPhotoRef) {
            try {
                await deleteObject(uploadedPhotoRef);
                console.log("Orphaned photo deleted (rollback)");
            } catch (rollbackError) {
                console.error("Failed to rollback photo:", rollbackError);
            }
        }
        
        alert("Не удалось опубликовать запись");
    } finally {
        publishPostBtn.disabled = false;
        publishPostBtn.textContent = "Опубликовать";
    }
});

// ========================
// ЗАГРУЗКА ПОСТОВ (INFINITE SCROLL)
// ========================
async function loadUserPosts(isNextPage = false) {
    if (!currentUser || isFetching) return;
    
    // ✅ Если это попытка загрузить следующую страницу, но постов больше нет
    if (isNextPage && !hasMore) return;
    
    isFetching = true;

    // Показываем индикатор загрузки при подгрузке
    if (isNextPage) {
        showLoadingIndicator();
    }

    try {
        const postsCollectionRef = collection(db, "users", currentUser.uid, "posts");
        
        // Формируем запрос
        let postsQuery;
        if (isNextPage && lastVisible) {
            // Запрос на следующую порцию (после курсора)
            postsQuery = query(
                postsCollectionRef, 
                orderBy("createdAt", "desc"), 
                startAfter(lastVisible), 
                limit(POSTS_PER_PAGE)
            );
        } else {
            // Первый запрос (первые 20 постов)
            postsList.innerHTML = ""; // Очищаем только при первой загрузке
            lastVisible = null; // Сбрасываем курсор
            hasMore = true; // Сбрасываем флаг
            postsQuery = query(
                postsCollectionRef, 
                orderBy("createdAt", "desc"), 
                limit(POSTS_PER_PAGE)
            );
        }

        const snapshot = await getDocs(postsQuery);
        
        if (!snapshot.empty) {
            // Запоминаем последний документ как курсор для следующей подгрузки
            lastVisible = snapshot.docs[snapshot.docs.length - 1];
            
            snapshot.forEach((docSnap) => {
                addPostToUI(docSnap.id, docSnap.data());
            });

            // ✅ Проверяем, есть ли ещё посты
            // Если получили меньше чем POSTS_PER_PAGE, значит это последняя порция
            if (snapshot.size < POSTS_PER_PAGE) {
                hasMore = false;
            }
        } else {
            // Постов нет вообще или больше не осталось
            if (!isNextPage) {
                showEmptyPosts();
            }
            hasMore = false;
        }
        
    } catch (error) {
        console.error("Ошибка загрузки постов:", error);
    } finally {
        isFetching = false;
        hideLoadingIndicator();
    }
}

function showLoadingIndicator() {
    let indicator = document.getElementById('loadingIndicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'loadingIndicator';
        indicator.className = 'loading-indicator';
        indicator.innerHTML = '<div class="spinner"></div><span>Загрузка...</span>';
        postsList.appendChild(indicator);
    }
}

function hideLoadingIndicator() {
    const indicator = document.getElementById('loadingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// ✅ Infinite Scroll: Профессиональный метод с Intersection Observer
let observer = null; // Храним наблюдателя для очистки

function initScrollListener() {
    // Удаляем старый наблюдатель, если есть
    if (observer) {
        observer.disconnect();
    }
    
    const sentinel = document.getElementById('scrollSentinel');
    if (!sentinel) {
        console.warn('Маячок scrollSentinel не найден');
        return;
    }
    
    // Создаём IntersectionObserver - современный API для отслеживания видимости элементов
    observer = new IntersectionObserver((entries) => {
        // entries[0].isIntersecting === true, когда маячок показался на экране
        if (entries[0].isIntersecting && !isFetching && hasMore) {
            console.log("🎯 Маячок сработал! Подгружаем посты...");
            loadUserPosts(true);
        }
    }, {
        // rootMargin: начинаем подгрузку за 400px до маячка (для плавности)
        rootMargin: '400px'
    });
    
    // Даём команду следить за маячком
    observer.observe(sentinel);
    console.log("✅ Intersection Observer активирован");
}

// Очистка при выходе (предотвращение утечки памяти)
function cleanupScrollListener() {
    if (observer) {
        observer.disconnect();
        observer = null;
        console.log("🧹 Intersection Observer отключён");
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

function addPostToUI(postId, post, toTop = false) {
    const postItem = document.createElement("div");
    postItem.className = "post-item";
    postItem.dataset.postId = postId;

    const userName = post.userName || 'Пользователь';
    const userAvatar = post.userAvatar;
    const letter = userName.charAt(0).toUpperCase();
    
    let timeStr = "Только что";
    
    // ✅ Безопасная обработка даты
    if (post.createdAt) {
        try {
            let date;
            
            // Если это Firestore Timestamp с методом toDate
            if (post.createdAt.toDate && typeof post.createdAt.toDate === 'function') {
                date = post.createdAt.toDate();
            } 
            // Если это обычный объект Date или число
            else if (post.createdAt instanceof Date) {
                date = post.createdAt;
            }
            // Если это число (миллисекунды)
            else if (typeof post.createdAt === 'number') {
                date = new Date(post.createdAt);
            }
            // Если это объект с seconds (Firestore Timestamp в JSON)
            else if (post.createdAt.seconds) {
                date = new Date(post.createdAt.seconds * 1000);
            }
            
            // Если дату удалось получить, рассчитываем время
            if (date && date instanceof Date && !isNaN(date)) {
                const now = new Date();
                const diffMs = now - date;

                // ✅ Проверка на отрицательное время (часы пользователя в будущем)
                if (diffMs < 0) {
                    timeStr = "Только что";
                } else {
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
            }
        } catch (error) {
            console.warn('Ошибка обработки даты поста:', error);
            timeStr = "Только что";
        }
    }

    const avatarHtml = userAvatar 
        ? `<img src="${userAvatar}" alt="${userName}" class="post-avatar-img">`
        : letter;

    postItem.innerHTML = `
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
    `;

    // ✅ Добавляем в начало (новые посты) или в конец (загрузка старых)
    if (toTop) {
        postsList.prepend(postItem); // Добавляет в начало
    } else {
        postsList.appendChild(postItem); // Добавляет в конец
    }

    const deleteBtn = postItem.querySelector(".post-delete");
    deleteBtn.addEventListener("click", async () => {
        if (confirm("Удалить эту запись?")) {
            try {
                // ✅ Удаляем фото из Storage используя photoPath (надёжнее чем URL)
                if (post.photoPath) {
                    try {
                        const photoRef = storageRef(storage, post.photoPath);
                        await deleteObject(photoRef);
                        console.log("Фото удалено из Storage");
                    } catch (storageError) {
                        // Если фото уже удалено или ссылка битая - не критично
                        console.warn("Не удалось удалить фото из Storage:", storageError);
                    }
                } else if (post.photoUrl) {
                    // Fallback: старые посты без photoPath
                    try {
                        // Извлекаем путь из URL
                        const urlParts = post.photoUrl.split('/o/')[1];
                        if (urlParts) {
                            const path = decodeURIComponent(urlParts.split('?')[0]);
                            const photoRef = storageRef(storage, path);
                            await deleteObject(photoRef);
                            console.log("Фото удалено из Storage (fallback)");
                        }
                    } catch (storageError) {
                        console.warn("Не удалось удалить фото из Storage (fallback):", storageError);
                    }
                }

                const postDocRef = doc(db, "users", currentUser.uid, "posts", postId);
                await deleteDoc(postDocRef);
                
                // ✅ МГНОВЕННОЕ УДАЛЕНИЕ: Убираем пост из DOM сразу
                postItem.remove();
                
                // ✅ Способ В: Уменьшаем счетчик постов (-1)
                const userDocRef = doc(db, "users", currentUser.uid);
                await updateDoc(userDocRef, {
                    postsCount: increment(-1)
                });

                // Обновляем локальный счетчик
                currentUserData.postsCount = Math.max(0, (currentUserData.postsCount || 1) - 1);
                localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));
                
                if (postsCount) {
                    postsCount.textContent = currentUserData.postsCount.toString();
                }

                // Если постов больше нет, показываем сообщение
                if (currentUserData.postsCount === 0) {
                    showEmptyPosts();
                }

                console.log("Запись удалена!");
            } catch (error) {
                console.error("Ошибка удаления записи:", error);
                alert("Не удалось удалить запись");
            }
        }
    });

    const photoImg = postItem.querySelector(".post-image");
    if (photoImg) {
        photoImg.addEventListener("click", () => {
            modalPhoto.src = photoImg.dataset.photo;
            photoModal.classList.remove("hidden");
        });
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
