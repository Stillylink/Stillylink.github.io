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
    collection,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    deleteDoc,
    serverTimestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

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
    appId: "1:772070114710:web:939bce83e4d3be14bdc9b7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
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
const profileEmail = document.getElementById("profileEmail");
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

const chatsCount = document.getElementById("chatsCount");
const postsCount = document.getElementById("postsCount");
const memberSince = document.getElementById("memberSince");

let currentUser = null;
let currentPhotoFile = null;

// ЗАГРУЗКА АВАТАРКИ ИЗ localStorage СРАЗУ (как в анонимном чате)
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

// Проверка авторизации
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/login/";
        return;
    }

    // Анонимные пользователи не могут использовать профиль
    if (!user.email) {
        alert("Профиль доступен только зарегистрированным пользователям");
        window.location.href = "/login/";
        return;
    }

    currentUser = user;

    // Обновляем навигацию
    regBtn?.classList.add("hidden");
    avatar?.classList.remove("hidden");
    const letter = user.email.charAt(0).toUpperCase();
    avatarLetter.textContent = letter;
    localStorage.setItem("userAvatarLetter", letter);

    // Загружаем профиль
    await loadUserProfile();
    
    // Загружаем записи
    loadUserPosts();
});

// Выход
logoutBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    await signOut(auth);
    localStorage.removeItem("userAvatarLetter");
    window.location.href = "/login/";
});

// Загрузка профиля пользователя
async function loadUserProfile() {
    if (!currentUser) return;

    try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Имя
            profileName.textContent = userData.name || "Пользователь";
            
            // Email
            profileEmail.textContent = currentUser.email;
            
            // О себе
            profileBio.textContent = userData.bio || "Расскажите о себе...";
            
            // Аватар
            if (userData.avatarUrl) {
                avatarLetterProfile.style.display = "none";
                const img = document.createElement("img");
                img.src = userData.avatarUrl;
                img.alt = "Avatar";
                profileAvatar.innerHTML = "";
                profileAvatar.appendChild(img);
            } else {
                const letter = currentUser.email.charAt(0).toUpperCase();
                avatarLetterProfile.textContent = letter;
            }

            // Статистика
            if (userData.createdAt) {
                const date = userData.createdAt.toDate();
                memberSince.textContent = date.toLocaleDateString("ru-RU", { 
                    year: 'numeric', 
                    month: 'long' 
                });
            }

            // Подсчитываем записи
            updatePostsCount();

        } else {
            // Создаем профиль если его нет
            await setDoc(userDocRef, {
                name: currentUser.email.split('@')[0],
                email: currentUser.email,
                bio: "Расскажите о себе...",
                avatarUrl: null,
                createdAt: serverTimestamp()
            });
            
            profileName.textContent = currentUser.email.split('@')[0];
            profileEmail.textContent = currentUser.email;
            const letter = currentUser.email.charAt(0).toUpperCase();
            avatarLetterProfile.textContent = letter;
        }
    } catch (error) {
        console.error("Ошибка загрузки профиля:", error);
    }
}

// Загрузка аватарки
avatarUpload.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    // Проверка размера (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert("Файл слишком большой. Максимальный размер: 5MB");
        return;
    }

    try {
        // Загружаем в Storage
        const avatarRef = storageRef(storage, `avatars/${currentUser.uid}/${Date.now()}_${file.name}`);
        await uploadBytes(avatarRef, file);
        const avatarUrl = await getDownloadURL(avatarRef);

        // Обновляем в Firestore
        const userDocRef = doc(db, "users", currentUser.uid);
        await updateDoc(userDocRef, { avatarUrl });

        // Обновляем UI
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
editProfileBtn.addEventListener("click", async () => {
    if (!currentUser) return;

    try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            editName.value = userData.name || "";
            editBio.value = userData.bio || "";
        }

        editModal.classList.remove("hidden");
    } catch (error) {
        console.error("Ошибка открытия редактирования:", error);
    }
});

closeEditModal.addEventListener("click", () => {
    editModal.classList.add("hidden");
});

cancelEditBtn.addEventListener("click", () => {
    editModal.classList.add("hidden");
});

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
            bio: bio || "Расскажите о себе..."
        });

        profileName.textContent = name;
        profileBio.textContent = bio || "Расскажите о себе...";
        
        // Обновляем аватарку на первую букву нового имени
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

// Закрытие модалки по клику вне её
editModal.addEventListener("click", (e) => {
    if (e.target === editModal) {
        editModal.classList.add("hidden");
    }
});

// Публикация записи
attachPhotoBtn.addEventListener("click", () => {
    postPhotoInput.click();
});

postPhotoInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка размера (макс 10MB)
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
    if (!currentUser) return;

    const text = postInput.value.trim();

    if (!text && !currentPhotoFile) {
        alert("Напишите текст или добавьте фото");
        return;
    }

    publishPostBtn.disabled = true;
    publishPostBtn.textContent = "Публикация...";

    try {
        let photoUrl = null;

        // Загружаем фото если есть
        if (currentPhotoFile) {
            const photoRef = storageRef(storage, `posts/${currentUser.uid}/${Date.now()}_${currentPhotoFile.name}`);
            await uploadBytes(photoRef, currentPhotoFile);
            photoUrl = await getDownloadURL(photoRef);
        }

        // Создаем запись
        const postsCollection = collection(db, "posts");
        await addDoc(postsCollection, {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            text: text || "",
            photoUrl: photoUrl,
            createdAt: serverTimestamp()
        });

        // Очищаем форму
        postInput.value = "";
        currentPhotoFile = null;
        postPhotoInput.value = "";
        attachPhotoBtn.textContent = "📷 Фото";
        attachPhotoBtn.style.color = "";

        console.log("Запись опубликована!");
        updatePostsCount();
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

    const postsCollection = collection(db, "posts");
    const q = query(
        postsCollection, 
        where("userId", "==", currentUser.uid),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {
        postsList.innerHTML = "";

        if (snapshot.empty) {
            postsList.innerHTML = `
                <div class="posts-empty">
                    <div class="posts-empty-icon">📝</div>
                    <div class="posts-empty-text">Здесь пока нет записей. Создайте первую!</div>
                </div>
            `;
            return;
        }

        snapshot.forEach((doc) => {
            const post = doc.data();
            addPostToUI(doc.id, post);
        });
    });
}

// Добавление записи в UI
function addPostToUI(postId, post) {
    const postItem = document.createElement("div");
    postItem.className = "post-item";
    postItem.dataset.postId = postId;

    const letter = post.userEmail.charAt(0).toUpperCase();
    const userName = post.userEmail.split('@')[0];
    
    let timeStr = "Только что";
    if (post.createdAt) {
        const date = post.createdAt.toDate();
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

    postItem.innerHTML = `
        <div class="post-header">
            <div class="post-avatar">${letter}</div>
            <div class="post-info">
                <div class="post-author">${userName}</div>
                <div class="post-time">${timeStr}</div>
            </div>
            <button class="post-delete" data-post-id="${postId}">Удалить</button>
        </div>
        ${post.text ? `<div class="post-content">${escapeHtml(post.text)}</div>` : ''}
        ${post.photoUrl ? `<img src="${post.photoUrl}" alt="Post photo" class="post-image" data-photo="${post.photoUrl}">` : ''}
    `;

    postsList.appendChild(postItem);

    // Обработчик удаления
    const deleteBtn = postItem.querySelector(".post-delete");
    deleteBtn.addEventListener("click", async () => {
        if (confirm("Удалить эту запись?")) {
            try {
                await deleteDoc(doc(db, "posts", postId));
                console.log("Запись удалена");
                updatePostsCount();
            } catch (error) {
                console.error("Ошибка удаления записи:", error);
                alert("Не удалось удалить запись");
            }
        }
    });

    // Обработчик просмотра фото
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

// Обновление счетчика записей
async function updatePostsCount() {
    if (!currentUser) return;

    try {
        const postsCollection = collection(db, "posts");
        const q = query(postsCollection, where("userId", "==", currentUser.uid));
        const snapshot = await getDoc(q);
        
        // Простой подсчет через DOM (так как уже загружены)
        const count = postsList.querySelectorAll(".post-item").length;
        postsCount.textContent = count;
    } catch (error) {
        console.error("Ошибка подсчета записей:", error);
    }
}

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
