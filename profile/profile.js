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
    initializeFirestore,
    runTransaction
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

const db = initializeFirestore(app, {
    localCache: persistentLocalCache({})
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
const profileUsernameID = document.getElementById("profileUsernameID");
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

const youtubeCard = document.getElementById("youtubeCard");
const youtubeEmpty = document.getElementById("youtubeEmpty");
const youtubeIframe = document.getElementById("youtubeIframe");
const addVideoBtn = document.getElementById("addVideoBtn");

const statusText = document.querySelector(".status-text");
const infoContent = document.getElementById("infoContent");

let currentUser = null;
let currentUserData = null;
let currentPhotoFile = null;
const PROFILE_CACHE_KEY = "userProfileCache_v1";

// ✅ Infinite Scroll
const POSTS_PER_PAGE = 20;
let lastVisible = null;
let isFetching = false;
let hasMore = true;

// ✅ Unsubscribe-функции для onSnapshot слушателей
let unsubscribeProfile = null;
let unsubscribePosts = null;

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
// 📝 ИНФОРМАЦИЯ
// ========================
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
    
    if (hasCountry) {
        html += `
            <div class="info-item">
                <div class="info-label">Местоположение</div>
                <div class="info-value">${escapeHtml(infoData.country)}</div>
            </div>
        `;
    }
    
    if (hasNickname) {
        const nicknameLabel = infoData.nicknameLabel || "Прозвище";
        html += `
            <div class="info-item">
                <div class="info-label">${escapeHtml(nicknameLabel)}</div>
                <div class="info-value">${escapeHtml(infoData.nickname)}</div>
            </div>
        `;
    }
    
    if (hasEmail) {
        html += `
            <div class="info-item">
                <div class="info-label">Связь</div>
                <div class="info-value">${escapeHtml(infoData.email)}</div>
            </div>
        `;
    }
    
    if (hasOccupation) {
        html += `
            <div class="info-item">
                <div class="info-label">Род деятельности</div>
                <div class="info-value">${escapeHtml(infoData.occupation)}</div>
            </div>
        `;
    }
    
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
// 📝 СТАТУС
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
        statusText.querySelector('.status-content').textContent = status;
    }
}

// ========================
// 🎬 YOUTUBE
// ========================
function extractVideoId(url) {
    if (!url) return null;
    url = url.trim();
    if (url.includes('/shorts/')) return null;
    const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) return watchMatch[1];
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return shortMatch[1];
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
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
        await setDoc(userDocRef, { youtubeVideoId: videoId || null }, { merge: true });
        currentUserData.youtubeVideoId = videoId || null;
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));
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
// ГЕНЕРАЦИЯ USERNAMEID
// ========================
function generateUsernameID(email, uid) {
    const emailPart = email.split('@')[0];
    const cleanEmail = emailPart.replace(/[^a-zA-Z0-9]/g, '');
    const shortUID = uid.substring(0, 4);
    return `${cleanEmail}_${shortUID}`.toLowerCase();
}

// ========================
// 🔑 ПРОВЕРКА АВТОРИЗАЦИИ
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

    // ✅ Загружаем кэш из localStorage для мгновенного отображения
    const cachedProfile = localStorage.getItem(PROFILE_CACHE_KEY);
    if (cachedProfile) {
        try {
            currentUserData = JSON.parse(cachedProfile);
            // Сразу рисуем UI из кэша — пользователь не ждёт сети
            renderProfile(currentUserData);
            renderStatus(currentUserData.status || "");
            renderInfo(currentUserData.info || {});
            loadYoutubeVideo(currentUserData.youtubeVideoId);
            console.log("⚡ Профиль отрисован из localStorage-кэша (0 чтений Firestore)");
        } catch (e) {
            console.error("Ошибка парсинга кэша:", e);
            localStorage.removeItem(PROFILE_CACHE_KEY);
            currentUserData = null;
        }
    }

    const userDocRef = doc(db, "users", user.uid);

    // ✅ КЛЮЧЕВОЕ ИЗМЕНЕНИЕ #1:
    // Заменяем getDoc (всегда сервер) на onSnapshot (кэш → сервер при изменениях).
    // При наличии persistentLocalCache первый вызов onSnapshot отдаёт данные
    // из локального кэша (0 чтений Firestore), а сервер опрашивается только
    // если данные изменились.
    unsubscribeProfile = onSnapshot(
        userDocRef,
        { includeMetadataChanges: true }, // слушаем смену кэш↔сервер
        async (snap) => {
            const fromCache = snap.metadata.fromCache;
            const hasPendingWrites = snap.metadata.hasPendingWrites;

            console.log(`📥 Профиль: fromCache=${fromCache}, hasPendingWrites=${hasPendingWrites}`);

            if (!snap.exists()) {
                // ── Новый пользователь, создаём профиль ──
                const defaultName = user.email.split('@')[0];
                const generatedID = generateUsernameID(user.email, user.uid);

                const newProfile = {
                    name: defaultName,
                    email: user.email,
                    bio: "",
                    avatarUrl: null,
                    youtubeVideoId: null,
                    status: "",
                    postsCount: 0,
                    usernameID: generatedID,
                    info: {
                        links: [],
                        email: "",
                        country: "",
                        nickname: "",
                        nicknameLabel: "Прозвище",
                        occupation: ""
                    }
                };

                const usernameDocRef = doc(db, "usernames", generatedID.toLowerCase());
                await Promise.all([
                    setDoc(userDocRef, newProfile),
                    setDoc(usernameDocRef, { ownerUID: user.uid })
                ]);

                currentUserData = newProfile;
                localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));
                console.log("✅ Создан новый профиль с usernameID:", generatedID);
                return;
            }

            // ── Профиль существует ──
            const freshData = snap.data();

            // Миграция старых пользователей: добавляем usernameID если его нет
            if (!freshData.usernameID) {
                const generatedID = generateUsernameID(user.email, user.uid);
                await runTransaction(db, async (transaction) => {
                    const usernameDocRef = doc(db, "usernames", generatedID.toLowerCase());
                    const usernameSnap = await transaction.get(usernameDocRef);
                    if (usernameSnap.exists()) {
                        const timestamp = Date.now().toString().slice(-6);
                        const fallbackID = `${generatedID}_${timestamp}`.toLowerCase();
                        const fallbackDocRef = doc(db, "usernames", fallbackID);
                        transaction.set(fallbackDocRef, { ownerUID: user.uid });
                        transaction.update(userDocRef, { usernameID: fallbackID });
                        freshData.usernameID = fallbackID;
                    } else {
                        transaction.set(usernameDocRef, { ownerUID: user.uid });
                        transaction.update(userDocRef, { usernameID: generatedID });
                        freshData.usernameID = generatedID;
                    }
                });
            }

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

            // ✅ Если данные пришли из кэша — просто убеждаемся, что UI отрисован,
            //    никаких "платных" чтений Firestore нет.
            // ✅ Если данные пришли с сервера (fromCache=false) — обновляем UI и кэш
            //    только при реальном изменении данных.
            const cachedJSON = JSON.stringify(currentUserData);
            const freshJSON = JSON.stringify(freshData);

            if (cachedJSON !== freshJSON) {
                console.log(fromCache
                    ? "♻️ Профиль из Firestore-кэша (0 чтений)"
                    : "🔄 Профиль обновлён с сервера (1 чтение)"
                );
                currentUserData = freshData;
                localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));
                renderProfile(currentUserData);
                renderStatus(currentUserData.status || "");
                renderInfo(currentUserData.info || {});
                loadYoutubeVideo(currentUserData.youtubeVideoId);
            } else {
                console.log(fromCache
                    ? "✅ Профиль актуален (кэш, 0 чтений)"
                    : "✅ Профиль актуален (сервер подтвердил, 1 чтение)"
                );
                currentUserData = freshData;
            }

            const letter = currentUserData.name.charAt(0).toUpperCase();
            avatarLetter.textContent = letter;
            localStorage.setItem("userAvatarLetter", letter);

            // Запускаем посты только при первой инициализации
            if (!observer) {
                initScrollListener();
                loadUserPosts();
            }
        },
        (error) => {
            console.error("Ошибка слушателя профиля:", error);
        }
    );
});

// ========================
// ВЫХОД
// ========================
logoutBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    cleanupAllListeners();
    await signOut(auth);
    localStorage.clear();
    window.location.href = "/login/";
});

// ========================
// РЕНДЕР ПРОФИЛЯ
// ========================
function renderProfile(userData) {
    profileName.textContent = userData.name;

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
        if (currentUserData.avatarPath) {
            try {
                const oldAvatarRef = storageRef(storage, currentUserData.avatarPath);
                await deleteObject(oldAvatarRef);
            } catch (error) {
                console.warn("Не удалось удалить старую аватарку:", error);
            }
        }

        const avatarPath = `avatars/${currentUser.uid}/${Date.now()}_${file.name}`;
        const avatarRef = storageRef(storage, avatarPath);
        await uploadBytes(avatarRef, file);
        const avatarUrl = await getDownloadURL(avatarRef);

        const userDocRef = doc(db, "users", currentUser.uid);
        await updateDoc(userDocRef, { avatarUrl, avatarPath });

        currentUserData.avatarUrl = avatarUrl;
        currentUserData.avatarPath = avatarPath;
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));

        avatarLetterProfile.style.display = "none";
        const img = document.createElement("img");
        img.src = avatarUrl;
        img.alt = "Avatar";
        profileAvatar.innerHTML = "";
        profileAvatar.appendChild(img);
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

    let uploadedPhotoRef = null;

    try {
        let photoUrl = null;
        let photoPath = null;

        if (currentPhotoFile) {
            const filePath = `posts/${currentUser.uid}/${Date.now()}_${currentPhotoFile.name}`;
            uploadedPhotoRef = storageRef(storage, filePath);
            await uploadBytes(uploadedPhotoRef, currentPhotoFile);
            photoUrl = await getDownloadURL(uploadedPhotoRef);
            photoPath = filePath;
        }

        const postsCollectionRef = collection(db, "users", currentUser.uid, "posts");
        const newPostData = {
            userName: currentUserData.name,
            userAvatar: currentUserData.avatarUrl || null,
            text: text || "",
            photoUrl: photoUrl,
            photoPath: photoPath,
            createdAt: serverTimestamp()
        };

        const docRef = await addDoc(postsCollectionRef, newPostData);

        const userDocRef = doc(db, "users", currentUser.uid);
        await updateDoc(userDocRef, { postsCount: increment(1) });

        currentUserData.postsCount = (currentUserData.postsCount || 0) + 1;
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));

        if (postsCount) {
            postsCount.textContent = currentUserData.postsCount.toString();
        }

        const emptyMsg = document.querySelector(".posts-empty");
        if (emptyMsg) emptyMsg.remove();

        const postDataForUI = {
            ...newPostData,
            createdAt: Timestamp.now()
        };
        addPostToUI(docRef.id, postDataForUI, true);

        postInput.value = "";
        currentPhotoFile = null;
        postPhotoInput.value = "";
        attachPhotoBtn.textContent = "📷 Фото";
        attachPhotoBtn.style.color = "";

        console.log("✅ Запись опубликована!");
    } catch (error) {
        console.error("Ошибка публикации записи:", error);
        if (uploadedPhotoRef) {
            try {
                await deleteObject(uploadedPhotoRef);
            } catch (rollbackError) {
                console.error("Не удалось откатить фото:", rollbackError);
            }
        }
        alert("Не удалось опубликовать запись");
    } finally {
        publishPostBtn.disabled = false;
        publishPostBtn.textContent = "Опубликовать";
    }
});

// ========================
// 📜 ЗАГРУЗКА ПОСТОВ (INFINITE SCROLL + CACHE-FIRST)
// ========================
function loadUserPosts(isNextPage = false) {
    if (!currentUser || isFetching) return;
    if (isNextPage && !hasMore) return;

    isFetching = true;

    if (isNextPage) {
        showLoadingIndicator();
    }

    const postsCollectionRef = collection(db, "users", currentUser.uid, "posts");

    let postsQuery;
    if (isNextPage && lastVisible) {
        postsQuery = query(
            postsCollectionRef,
            orderBy("createdAt", "desc"),
            startAfter(lastVisible),
            limit(POSTS_PER_PAGE)
        );
    } else {
        postsList.innerHTML = "";
        lastVisible = null;
        hasMore = true;
        postsQuery = query(
            postsCollectionRef,
            orderBy("createdAt", "desc"),
            limit(POSTS_PER_PAGE)
        );
    }

    // ✅ КЛЮЧЕВОЕ ИЗМЕНЕНИЕ #2:
    // Заменяем getDocs (всегда сервер) на onSnapshot.
    //
    // Как это работает с persistentLocalCache:
    //   1. Первый вызов onSnapshot мгновенно отдаёт данные из локального кэша
    //      на диске → fromCache=true → 0 чтений Firestore.
    //   2. Firebase параллельно проверяет сервер. Если ничего не изменилось —
    //      повторного события НЕ будет → 0 чтений.
    //   3. Только если появился новый/изменённый/удалённый пост — придёт
    //      второе событие с fromCache=false → платное чтение только дельты.
    //
    // Для пагинации: каждый "следующий блок" тоже получает свой onSnapshot,
    // который сохраняем в массив postsPageListeners для очистки при выходе.
    const unsubscribe = onSnapshot(
        postsQuery,
        { includeMetadataChanges: true },
        (snapshot) => {
            const fromCache = snapshot.metadata.fromCache;

            console.log(`📄 Посты: fromCache=${fromCache}, docs=${snapshot.size}, isNextPage=${isNextPage}`);

            // Если данные из кэша — рисуем сразу. Если с сервера — обновляем UI.
            // Для пагинации не перерисовываем всё, а только добавляем новые.
            if (!fromCache || isNextPage) {
                // Очищаем предыдущий контент только при первой загрузке с сервера
                // (не пагинация, не из кэша)
                if (!isNextPage && !fromCache) {
                    // Пост-список уже был наполнен из кэша — мягко обновляем
                    syncPostsFromSnapshot(snapshot);
                    return;
                }
            }

            if (snapshot.empty) {
                if (!isNextPage) showEmptyPosts();
                hasMore = false;
            } else {
                lastVisible = snapshot.docs[snapshot.docs.length - 1];
                snapshot.forEach((docSnap) => {
                    // Пропускаем посты, которые уже есть в DOM (при обновлении кэша)
                    if (!document.querySelector(`[data-post-id="${docSnap.id}"]`)) {
                        addPostToUI(docSnap.id, docSnap.data(), isNextPage ? false : false);
                    }
                });
                if (snapshot.size < POSTS_PER_PAGE) hasMore = false;
            }

            isFetching = false;
            hideLoadingIndicator();
        },
        (error) => {
            console.error("Ошибка слушателя постов:", error);
            isFetching = false;
            hideLoadingIndicator();
        }
    );

    // Сохраняем unsubscribe для очистки
    if (!isNextPage) {
        // Для первой страницы — переподписываемся
        if (unsubscribePosts) unsubscribePosts();
        unsubscribePosts = unsubscribe;
    } else {
        // Для пагинации — добавляем в массив
        postsPageListeners.push(unsubscribe);
    }
}

// ✅ Умная синхронизация: обновляем только изменившиеся посты,
//    не перерисовывая весь список (предотвращает мигание UI)
function syncPostsFromSnapshot(snapshot) {
    const serverIds = new Set(snapshot.docs.map(d => d.id));

    // Удаляем из DOM посты, которых нет на сервере
    document.querySelectorAll('[data-post-id]').forEach(el => {
        if (!serverIds.has(el.dataset.postId)) {
            el.remove();
        }
    });

    // Добавляем новые посты (которых ещё нет в DOM)
    snapshot.forEach((docSnap) => {
        if (!document.querySelector(`[data-post-id="${docSnap.id}"]`)) {
            addPostToUI(docSnap.id, docSnap.data(), true);
        }
    });
}

// Массив для хранения unsubscribe пагинации
const postsPageListeners = [];

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
    if (indicator) indicator.remove();
}

// ✅ Intersection Observer для бесконечного скролла
let observer = null;

function initScrollListener() {
    if (observer) observer.disconnect();

    const sentinel = document.getElementById('scrollSentinel');
    if (!sentinel) {
        console.warn('Маячок scrollSentinel не найден');
        return;
    }

    observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isFetching && hasMore) {
            console.log("🎯 Маячок сработал! Подгружаем посты...");
            loadUserPosts(true);
        }
    }, { rootMargin: '400px' });

    observer.observe(sentinel);
    console.log("✅ Intersection Observer активирован");
}

// ✅ Полная очистка всех слушателей (вызывается при logout и unload)
function cleanupAllListeners() {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
    }
    if (unsubscribePosts) {
        unsubscribePosts();
        unsubscribePosts = null;
    }
    postsPageListeners.forEach(unsub => unsub());
    postsPageListeners.length = 0;
    console.log("🧹 Все слушатели отключены");
}

// Очистка при закрытии вкладки
window.addEventListener('beforeunload', cleanupAllListeners);

function showEmptyPosts() {
    postsList.innerHTML = `
        <div class="posts-empty">
            <div class="posts-empty-icon">📝</div>
            <div class="posts-empty-text">
                Здесь пока нет записей. Создайте первую!
            </div>
        </div>
    `;
    if (postsCount) postsCount.textContent = "0";
}

function addPostToUI(postId, post, toTop = false) {
    const postItem = document.createElement("div");
    postItem.className = "post-item";
    postItem.dataset.postId = postId;

    const userName = post.userName || 'Пользователь';
    const userAvatar = post.userAvatar;
    const letter = userName.charAt(0).toUpperCase();

    let timeStr = "Только что";

    if (post.createdAt) {
        try {
            let date;
            if (post.createdAt.toDate && typeof post.createdAt.toDate === 'function') {
                date = post.createdAt.toDate();
            } else if (post.createdAt instanceof Date) {
                date = post.createdAt;
            } else if (typeof post.createdAt === 'number') {
                date = new Date(post.createdAt);
            } else if (post.createdAt.seconds) {
                date = new Date(post.createdAt.seconds * 1000);
            }

            if (date && date instanceof Date && !isNaN(date)) {
                const now = new Date();
                const diffMs = now - date;
                if (diffMs < 0) {
                    timeStr = "Только что";
                } else {
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMs / 3600000);
                    const diffDays = Math.floor(diffMs / 86400000);

                    if (diffMins < 1) timeStr = "Только что";
                    else if (diffMins < 60) timeStr = `${diffMins} ${pluralize(diffMins, 'минуту', 'минуты', 'минут')} назад`;
                    else if (diffHours < 24) timeStr = `${diffHours} ${pluralize(diffHours, 'час', 'часа', 'часов')} назад`;
                    else if (diffDays < 7) timeStr = `${diffDays} ${pluralize(diffDays, 'день', 'дня', 'дней')} назад`;
                    else timeStr = date.toLocaleDateString("ru-RU", {
                        day: 'numeric',
                        month: 'long',
                        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
                    });
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

    if (toTop) {
        postsList.prepend(postItem);
    } else {
        postsList.appendChild(postItem);
    }

    const deleteBtn = postItem.querySelector(".post-delete");
    deleteBtn.addEventListener("click", async () => {
        if (confirm("Удалить эту запись?")) {
            try {
                if (post.photoPath) {
                    try {
                        const photoRef = storageRef(storage, post.photoPath);
                        await deleteObject(photoRef);
                    } catch (storageError) {
                        console.warn("Не удалось удалить фото:", storageError);
                    }
                } else if (post.photoUrl) {
                    try {
                        const urlParts = post.photoUrl.split('/o/')[1];
                        if (urlParts) {
                            const path = decodeURIComponent(urlParts.split('?')[0]);
                            await deleteObject(storageRef(storage, path));
                        }
                    } catch (storageError) {
                        console.warn("Не удалось удалить фото (fallback):", storageError);
                    }
                }

                const postDocRef = doc(db, "users", currentUser.uid, "posts", postId);
                await deleteDoc(postDocRef);

                postItem.remove();

                const userDocRef = doc(db, "users", currentUser.uid);
                await updateDoc(userDocRef, { postsCount: increment(-1) });

                currentUserData.postsCount = Math.max(0, (currentUserData.postsCount || 1) - 1);
                localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));

                if (postsCount) postsCount.textContent = currentUserData.postsCount.toString();
                if (currentUserData.postsCount === 0) showEmptyPosts();

                console.log("✅ Запись удалена!");
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
    if (e.target === photoModal) photoModal.classList.add("hidden");
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
