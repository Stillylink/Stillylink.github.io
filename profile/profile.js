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
const editModal = document.getElementById("editModal");
const closeEditModal = document.getElementById("closeEditModal");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const editName = document.getElementById("editName");
const editBio = document.getElementById("editBio");

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

// 📝 СТАТУС ФУНКЦИИ
function renderStatus(status) {
    if (!statusText) return;
    
    if (!status || status.trim() === "") {
        statusText.innerHTML = `
            <span style="opacity: 0.5; font-style: italic;">Нажмите, чтобы добавить статус</span>
        `;
    } else {
        statusText.innerHTML = `
            <div style="position: relative;">
                <div class="status-content">${escapeHtml(status)}</div>
                <button class="status-edit-btn" style="position: absolute; top: -8px; right: -8px; width: 28px; height: 28px; border-radius: 50%; background: var(--accent); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; opacity: 0; transition: opacity 0.2s;">✏️</button>
            </div>
        `;
        
        const editBtn = statusText.querySelector('.status-edit-btn');
        statusText.addEventListener('mouseenter', () => {
            editBtn.style.opacity = '1';
        });
        statusText.addEventListener('mouseleave', () => {
            editBtn.style.opacity = '0';
        });
        
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openStatusEditor(status);
        });
    }
    
    statusText.style.cursor = 'pointer';
    statusText.onclick = () => {
        if (!status || status.trim() === "") {
            openStatusEditor("");
        }
    };
}

function openStatusEditor(currentStatus) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Редактировать статус</h3>
                <button class="modal-close" id="closeStatusModal">×</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="statusInput">Ваш статус или цитата</label>
                    <textarea id="statusInput" class="form-textarea" rows="4" placeholder="Например: 'Живи, улыбайся, твори!' или 'На пути к новым целям 🚀'" maxlength="200">${escapeHtml(currentStatus || '')}</textarea>
                    <div style="text-align: right; font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                        <span id="statusCharCount">0</span>/200
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                ${currentStatus ? '<button class="modal-btn delete" id="deleteStatusBtn" style="margin-right: auto; background: transparent; border: 1px solid #ff3b30; color: #ff3b30;">Удалить</button>' : ''}
                <button class="modal-btn cancel" id="cancelStatusBtn">Отмена</button>
                <button class="modal-btn save" id="saveStatusBtn">Сохранить</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const statusInput = modal.querySelector('#statusInput');
    const charCount = modal.querySelector('#statusCharCount');
    const closeBtn = modal.querySelector('#closeStatusModal');
    const cancelBtn = modal.querySelector('#cancelStatusBtn');
    const saveBtn = modal.querySelector('#saveStatusBtn');
    const deleteBtn = modal.querySelector('#deleteStatusBtn');
    
    // Обновление счетчика символов
    function updateCharCount() {
        charCount.textContent = statusInput.value.length;
    }
    updateCharCount();
    statusInput.addEventListener('input', updateCharCount);
    
    // Закрытие
    const closeModal = () => {
        modal.remove();
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // Сохранение
    saveBtn.addEventListener('click', async () => {
        const newStatus = statusInput.value.trim();
        
        if (newStatus.length > 200) {
            alert('Статус не может быть длиннее 200 символов');
            return;
        }
        
        try {
            await saveStatus(newStatus);
            renderStatus(newStatus);
            closeModal();
        } catch (error) {
            alert('Не удалось сохранить статус');
        }
    });
    
    // Удаление
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (confirm('Удалить статус?')) {
                try {
                    await saveStatus("");
                    renderStatus("");
                    closeModal();
                } catch (error) {
                    alert('Не удалось удалить статус');
                }
            }
        });
    }
    
    statusInput.focus();
}

async function saveStatus(status) {
    if (!currentUser) return;
    
    try {
        const userDocRef = doc(db, "users", currentUser.uid);
        await setDoc(userDocRef, {
            status: status || ""
        }, { merge: true });
        
        // Обновляем кэш
        currentUserData.status = status || "";
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));
        
        console.log("Статус сохранен!");
    } catch (error) {
        console.error("Ошибка сохранения статуса:", error);
        throw error;
    }
}

// 🎬 YOUTUBE ФУНКЦИИ
function extractVideoId(url) {
    if (!url) return null;
    
    url = url.trim();
    
    // Проверка на shorts (исключаем)
    if (url.includes('/shorts/')) {
        return null;
    }
    
    // youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) {
        return watchMatch[1];
    }
    
    // youtu.be/VIDEO_ID
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) {
        return shortMatch[1];
    }
    
    // Если это просто VIDEO_ID (11 символов)
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
        
        // Обновляем кэш
        currentUserData.youtubeVideoId = videoId || null;
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));
        
        console.log("YouTube видео сохранено!");
    } catch (error) {
        console.error("Ошибка сохранения YouTube видео:", error);
        throw error;
    }
}

// Обработчик добавления видео
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

// Проверка авторизации
onAuthStateChanged(auth, async (user) => {
    if (!user || !user.email) {
        window.location.href = "/login/";
        return;
    }

    currentUser = user;

    const userDocRef = doc(db, "users", user.uid);

    // Пытаемся взять профиль из localStorage
    const cachedProfile = localStorage.getItem(PROFILE_CACHE_KEY);

    if (cachedProfile) {
        currentUserData = JSON.parse(cachedProfile);
        console.log("Профиль загружен из кэша");
    } else {
        // Если кэша нет — читаем Firestore
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
            const defaultName = user.email.split('@')[0];

            const newProfile = {
                name: defaultName,
                email: user.email,
                bio: "Расскажите о себе...",
                avatarUrl: null,
                youtubeVideoId: null,
                status: ""
            };

            await setDoc(userDocRef, newProfile);
            currentUserData = newProfile;
        } else {
            currentUserData = userSnap.data();
        }

        // Сохраняем в кэш
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));
        console.log("Профиль загружен из Firestore и закэширован");
    }

    // Навигация
    const letter = currentUserData.name.charAt(0).toUpperCase();
    avatarLetter.textContent = letter;
    localStorage.setItem("userAvatarLetter", letter);

    // Профиль
    renderProfile(currentUserData);
    
    // 📝 Загружаем статус
    renderStatus(currentUserData.status || "");
    
    // 🎬 Загружаем YouTube видео
    loadYoutubeVideo(currentUserData.youtubeVideoId);

    // Посты
    loadUserPosts();
});

// Выход
logoutBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    
    if (postsListener) {
        postsListener();
        postsListener = null;
    }
    
    await signOut(auth);
    localStorage.removeItem("userAvatarLetter");
    localStorage.removeItem(PROFILE_CACHE_KEY);
    window.location.href = "/login/";
});

// Загрузка профиля пользователя
function renderProfile(userData) {
    profileName.textContent = userData.name;

    if (!userData.bio || !userData.bio.trim()) {
        profileBio.textContent = "Расскажите о себе…";
        profileBio.classList.add("empty");
    } else {
        profileBio.textContent = userData.bio;
        profileBio.classList.remove("empty");
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

// Загрузка аватарки
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

// Редактирование профиля
editProfileBtn.addEventListener("click", () => {
    if (!currentUserData) return;

    editName.value = currentUserData.name || "";
    editBio.value = currentUserData.bio || "";

    editModal.classList.remove("hidden");
});

closeEditModal.addEventListener("click", () => {
    editModal.classList.add("hidden");
});

cancelEditBtn.addEventListener("click", () => {
    editModal.classList.add("hidden");
});

const bioTextarea = document.getElementById("editBio");

editBio.addEventListener("input", () => {
  editBio.value = normalizeBio(editBio.value);
});

let bioText = bioTextarea.value;
bioText = normalizeBio(bioText);

bioTextarea.value = bioText;

saveProfileBtn.addEventListener("click", async () => {
    if (!currentUser) return;

    const name = editName.value.trim();
    const bio = editBio.value.trim();

    if (!name) {
        alert("Введите имя");
        return;
    }

    try {
        const userDocRef = doc(db, "users", currentUser.uid);
        await updateDoc(userDocRef, {
            name,
            bio: bio || ""
        });

        currentUserData.name = name;
        currentUserData.bio = bio || "Расскажите о себе...";
        
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));

        profileName.textContent = name;
        profileBio.textContent = bio || "Расскажите о себе...";
        
        const newLetter = name.charAt(0).toUpperCase();
        avatarLetterProfile.textContent = newLetter;
        avatarLetter.textContent = newLetter;
        localStorage.setItem("userAvatarLetter", newLetter);
        
        editModal.classList.add("hidden");
        console.log("Профиль обновлен!");
    } catch (error) {
        console.error("Ошибка сохранения профиля:", error);
        alert("Не удалось сохранить изменения");
    }
});

editModal.addEventListener("click", (e) => {
    if (e.target === editModal) {
        editModal.classList.add("hidden");
    }
});

function normalizeBio(text) {
  text = text.replace(/\s+$/g, "");

  if (text.length > 100) {
    text = text.slice(0, 100);
  }

  const lines = text.split("\n");
  if (lines.length > 10) {
    text = lines.slice(0, 10).join("\n");
  }

  return text;
}

// Публикация записи
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

        const postsRef = dbRef(rtdb, 'posts');
        const newPostRef = push(postsRef);
        
        await set(newPostRef, {
            userId: currentUser.uid,
            userName: currentUserData.name,
            userAvatar: currentUserData.avatarUrl || null,
            userEmail: currentUser.email,
            text: text || "",
            photoUrl: photoUrl,
            createdAt: Date.now()
        });

        postInput.value = "";
        currentPhotoFile = null;
        postPhotoInput.value = "";
        attachPhotoBtn.textContent = "📷 Фото";
        attachPhotoBtn.style.color = "";

        console.log("Запись опубликована в Realtime Database!");
    } catch (error) {
        console.error("Ошибка публикации записи:", error);
        alert("Не удалось опубликовать запись");
    } finally {
        publishPostBtn.disabled = false;
        publishPostBtn.textContent = "Опубликовать";
    }
});

// Загрузка записей пользователя
function loadUserPosts() {
    if (!currentUser) return;

    if (postsListener) {
        postsListener();
    }

    const postsRef = dbRef(rtdb, 'posts');
    const userPostsQuery = query(
        postsRef,
        orderByChild('userId'),
        equalTo(currentUser.uid)
    );

    postsListener = onValue(userPostsQuery, (snapshot) => {
        postsList.innerHTML = "";

        if (!snapshot.exists()) {
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
            return;
        }

        const posts = [];
        snapshot.forEach(childSnapshot => {
            posts.push({
                id: childSnapshot.key,
                data: childSnapshot.val()
            });
        });

        posts.sort((a, b) => b.data.createdAt - a.data.createdAt);

        posts.forEach(post => {
            addPostToUI(post.id, post.data);
        });

        if (postsCount) {
            postsCount.textContent = posts.length.toString();
        }
    }, (error) => {
        console.error("Ошибка загрузки постов:", error);
    });
}

// Добавление записи в UI
function addPostToUI(postId, post) {
    const postItem = document.createElement("div");
    postItem.className = "post-item";
    postItem.dataset.postId = postId;

    const userName = post.userName || post.userEmail.split('@')[0];
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

    postsList.appendChild(postItem);

    const deleteBtn = postItem.querySelector(".post-delete");
    deleteBtn.addEventListener("click", async () => {
        if (confirm("Удалить эту запись?")) {
            try {
                const postRef = dbRef(rtdb, `posts/${postId}`);
                await remove(postRef);
                console.log("Запись удалена из Realtime Database");
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

// Закрытие модалки с фото
closePhotoModal.addEventListener("click", () => {
    photoModal.classList.add("hidden");
});

photoModal.addEventListener("click", (e) => {
    if (e.target === photoModal) {
        photoModal.classList.add("hidden");
    }
});

// Утилиты
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
