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

// Информация элементы
const editInfoBtn = document.getElementById("editInfoBtn");
const infoContent = document.getElementById("infoContent");
const editInfoModal = document.getElementById("editInfoModal");
const closeInfoModal = document.getElementById("closeInfoModal");
const cancelInfoBtn = document.getElementById("cancelInfoBtn");
const saveInfoBtn = document.getElementById("saveInfoBtn");
const linksContainer = document.getElementById("linksContainer");
const addLinkBtn = document.getElementById("addLinkBtn");
const editEmail = document.getElementById("editEmail");
const editCountry = document.getElementById("editCountry");
const editNickname = document.getElementById("editNickname");
const editOccupation = document.getElementById("editOccupation");
const occupationCounter = document.getElementById("occupationCounter");
const renameNicknameBtn = document.getElementById("renameNicknameBtn");
const renameFieldModal = document.getElementById("renameFieldModal");
const closeRenameModal = document.getElementById("closeRenameModal");
const cancelRenameBtn = document.getElementById("cancelRenameBtn");
const saveRenameBtn = document.getElementById("saveRenameBtn");
const newFieldName = document.getElementById("newFieldName");

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
// 📝 ИНФОРМАЦИЯ ФУНКЦИИ
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
    
    // Ссылки
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
    
    // Электронная почта
    if (hasEmail) {
        html += `
            <div class="info-item">
                <div class="info-label">Связь</div>
                <div class="info-value">${escapeHtml(infoData.email)}</div>
            </div>
        `;
    }
    
    // Местоположение
    if (hasCountry) {
        html += `
            <div class="info-item">
                <div class="info-label">Местоположение</div>
                <div class="info-value">${escapeHtml(infoData.country)}</div>
            </div>
        `;
    }
    
    // Прозвище (с кастомным названием)
    if (hasNickname) {
        const nicknameLabel = infoData.nicknameLabel || "Прозвище";
        html += `
            <div class="info-item">
                <div class="info-label">${escapeHtml(nicknameLabel)}</div>
                <div class="info-value">${escapeHtml(infoData.nickname)}</div>
            </div>
        `;
    }
    
    // Род деятельности
    if (hasOccupation) {
        html += `
            <div class="info-item">
                <div class="info-label">Род деятельности</div>
                <div class="info-value">${escapeHtml(infoData.occupation)}</div>
            </div>
        `;
    }
    
    infoContent.innerHTML = html;
}

// Открыть модальное окно редактирования информации
editInfoBtn?.addEventListener('click', () => {
    if (!currentUserData) return;
    
    const infoData = currentUserData.info || {};
    
    // Заполняем ссылки
    renderLinkInputs(infoData.links || []);
    
    // Заполняем остальные поля
    editEmail.value = infoData.email || '';
    editCountry.value = infoData.country || '';
    editNickname.value = infoData.nickname || '';
    editOccupation.value = infoData.occupation || '';
    
    // Обновляем label прозвища
    updateNicknameLabel(infoData.nicknameLabel || 'Прозвище');
    
    // Обновляем счётчик символов
    updateOccupationCounter();
    
    editInfoModal.classList.remove('hidden');
});

// Рендер полей ввода ссылок
function renderLinkInputs(links = []) {
    linksContainer.innerHTML = '';
    
    links.forEach((link, index) => {
        addLinkInput(link.name, link.url);
    });
    
    updateAddLinkButton();
}

// Добавить поле ввода ссылки
function addLinkInput(name = '', url = '') {
    const linkItem = document.createElement('div');
    linkItem.className = 'link-item';
    
    linkItem.innerHTML = `
        <input type="text" placeholder="Название" value="${escapeHtml(name)}" class="link-name" maxlength="50">
        <input type="url" placeholder="https://example.com" value="${escapeHtml(url)}" class="link-url">
        <button type="button" class="remove-link-btn">×</button>
    `;
    
    const removeBtn = linkItem.querySelector('.remove-link-btn');
    removeBtn.addEventListener('click', () => {
        linkItem.remove();
        updateAddLinkButton();
    });
    
    linksContainer.appendChild(linkItem);
}

// Кнопка добавления ссылки
addLinkBtn?.addEventListener('click', () => {
    const currentLinks = linksContainer.querySelectorAll('.link-item');
    if (currentLinks.length >= 3) return;
    
    addLinkInput();
    updateAddLinkButton();
});

// Обновление состояния кнопки "Добавить ссылку"
function updateAddLinkButton() {
    const currentLinks = linksContainer.querySelectorAll('.link-item');
    if (currentLinks.length >= 3) {
        addLinkBtn.disabled = true;
        addLinkBtn.textContent = '+ Максимум 3 ссылки';
    } else {
        addLinkBtn.disabled = false;
        addLinkBtn.textContent = '+ Добавить ссылку';
    }
}

// Счётчик символов для рода деятельности
editOccupation?.addEventListener('input', updateOccupationCounter);

function updateOccupationCounter() {
    if (!editOccupation || !occupationCounter) return;
    
    const length = editOccupation.value.length;
    occupationCounter.textContent = length;
    
    if (length > 200) {
        occupationCounter.style.color = '#ff3b30';
    } else {
        occupationCounter.style.color = 'var(--text-secondary)';
    }
}

// Сохранение информации
saveInfoBtn?.addEventListener('click', async () => {
    if (!currentUser) return;
    
    // Собираем ссылки
    const linkItems = linksContainer.querySelectorAll('.link-item');
    const links = [];
    
    linkItems.forEach(item => {
        const nameInput = item.querySelector('.link-name');
        const urlInput = item.querySelector('.link-url');
        
        const name = nameInput.value.trim();
        const url = urlInput.value.trim();
        
        if (name && url) {
            // Проверяем валидность URL
            try {
                new URL(url);
                links.push({ name, url });
            } catch (e) {
                // Игнорируем невалидные URL
            }
        }
    });
    
    // Собираем остальные данные
    const infoData = {
        links: links,
        email: editEmail.value.trim(),
        country: editCountry.value,
        nickname: editNickname.value.trim(),
        nicknameLabel: currentUserData.info?.nicknameLabel || 'Прозвище',
        occupation: editOccupation.value.trim().slice(0, 200) // Ограничение 200 символов
    };
    
    try {
        const userDocRef = doc(db, "users", currentUser.uid);
        await setDoc(userDocRef, {
            info: infoData
        }, { merge: true });
        
        currentUserData.info = infoData;
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));
        
        renderInfo(infoData);
        editInfoModal.classList.add('hidden');
        
        console.log("Информация сохранена!");
    } catch (error) {
        console.error("Ошибка сохранения информации:", error);
        alert("Не удалось сохранить информацию");
    }
});

// Закрытие модального окна информации
closeInfoModal?.addEventListener('click', () => {
    editInfoModal.classList.add('hidden');
});

cancelInfoBtn?.addEventListener('click', () => {
    editInfoModal.classList.add('hidden');
});

editInfoModal?.addEventListener('click', (e) => {
    if (e.target === editInfoModal) {
        editInfoModal.classList.add('hidden');
    }
});

// ========================
// ПЕРЕИМЕНОВАНИЕ ПОЛЯ "ПРОЗВИЩЕ"
// ========================

function updateNicknameLabel(label) {
    const nicknameLabel = document.querySelector('label[for="editNickname"]');
    if (nicknameLabel) {
        nicknameLabel.textContent = label;
    }
}

renameNicknameBtn?.addEventListener('click', () => {
    const currentLabel = currentUserData.info?.nicknameLabel || 'Прозвище';
    newFieldName.value = currentLabel;
    renameFieldModal.classList.remove('hidden');
    newFieldName.focus();
});

saveRenameBtn?.addEventListener('click', () => {
    const label = newFieldName.value.trim();
    
    if (!label) {
        alert('Введите название поля');
        return;
    }
    
    if (label.length > 30) {
        alert('Название не может быть длиннее 30 символов');
        return;
    }
    
    if (!currentUserData.info) {
        currentUserData.info = {};
    }
    
    currentUserData.info.nicknameLabel = label;
    updateNicknameLabel(label);
    
    renameFieldModal.classList.add('hidden');
});

closeRenameModal?.addEventListener('click', () => {
    renameFieldModal.classList.add('hidden');
});

cancelRenameBtn?.addEventListener('click', () => {
    renameFieldModal.classList.add('hidden');
});

renameFieldModal?.addEventListener('click', (e) => {
    if (e.target === renameFieldModal) {
        renameFieldModal.classList.add('hidden');
    }
});

// ========================
// 📝 СТАТУС ФУНКЦИИ
// ========================
function renderStatus(status) {
    if (!statusText) return;
    
    if (!status || status.trim() === "") {
        statusText.innerHTML = `
            <span style="opacity: 0.5; font-style: italic; color: var(--text-secondary);">Нажмите, чтобы добавить статус</span>
        `;
    } else {
        statusText.innerHTML = `
            <div style="position: relative;">
                <div class="status-content" style="white-space: pre-wrap; word-break: break-word;"></div>
                <button class="status-edit-btn" style="position: absolute; top: -8px; right: -8px; width: 28px; height: 28px; border-radius: 50%; background: var(--accent); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; opacity: 0; transition: opacity 0.2s;">✏️</button>
            </div>
        `;
        
        const contentDiv = statusText.querySelector('.status-content');
        contentDiv.textContent = status;
        
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
                    <textarea id="statusInput" class="form-textarea" rows="4" placeholder="Добавьте статус"></textarea>
                    <div style="text-align: right; font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                        <span id="statusCharCount">0</span>/100 символов, <span id="statusLineCount">0</span>/10 строк
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
    const lineCount = modal.querySelector('#statusLineCount');
    const closeBtn = modal.querySelector('#closeStatusModal');
    const cancelBtn = modal.querySelector('#cancelStatusBtn');
    const saveBtn = modal.querySelector('#saveStatusBtn');
    const deleteBtn = modal.querySelector('#deleteStatusBtn');
    
    if (currentStatus) {
        statusInput.value = currentStatus;
    }
    
    function updateCounts() {
        const text = statusInput.value;
        const lines = text.split('\n');
        
        charCount.textContent = text.length;
        lineCount.textContent = lines.length;
        
        if (text.length > 100) {
            charCount.style.color = '#ff3b30';
        } else {
            charCount.style.color = 'var(--text-secondary)';
        }
        
        if (lines.length > 10) {
            lineCount.style.color = '#ff3b30';
        } else {
            lineCount.style.color = 'var(--text-secondary)';
        }
    }
    
    statusInput.addEventListener('input', () => {
        let text = statusInput.value;
        let lines = text.split('\n');
        
        if (lines.length > 10) {
            text = lines.slice(0, 10).join('\n');
            statusInput.value = text;
            lines = text.split('\n');
        }
        
        if (text.length > 100) {
            statusInput.value = text.slice(0, 100);
        }
        
        updateCounts();
    });
    
    updateCounts();
    
    const closeModal = () => {
        modal.remove();
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    saveBtn.addEventListener('click', async () => {
        const newStatus = statusInput.value.trim();
        
        const lines = newStatus.split('\n');
        if (lines.length > 10) {
            alert('Статус не может содержать более 10 строк');
            return;
        }
        
        if (newStatus.length > 100) {
            alert('Статус не может быть длиннее 100 символов');
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
        
        currentUserData.status = status || "";
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));
        
        console.log("Статус сохранен!");
    } catch (error) {
        console.error("Ошибка сохранения статуса:", error);
        throw error;
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
    if (!currentUserData) return;

    editName.value = currentUserData.name || "";

    const hasBio = currentUserData.bio && 
                   currentUserData.bio.trim() !== "" && 
                   currentUserData.bio !== "Расскажите о себе..." &&
                   currentUserData.bio !== "Расскажите о себе…";

    editBio.value = hasBio ? currentUserData.bio : "";

    editModal.classList.remove("hidden");
});

closeEditModal.addEventListener("click", () => {
    editModal.classList.add("hidden");
});

cancelEditBtn.addEventListener("click", () => {
    editModal.classList.add("hidden");
});

editBio.addEventListener("input", () => {
  editBio.value = normalizeBio(editBio.value);
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
            bio: bio || ""
        });

        currentUserData.name = name;
        currentUserData.bio = bio || "";
        
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));

        profileName.textContent = name;
        if (bio) {
            profileBio.textContent = bio;
            profileBio.classList.remove("empty");
        } else {
            profileBio.textContent = "Расскажите о себе…";
            profileBio.classList.add("empty");
        }
        
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
  const lines = text.split("\n");
  if (lines.length > 10) {
    text = lines.slice(0, 10).join("\n");
  }

  if (text.length > 100) {
    text = text.slice(0, 100);
  }

  return text;
}

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
        postsList.innerHTML = "";

        if (!snapshot.exists()) {
            showEmptyPosts();
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

        myPosts.forEach(post => {
            addPostToUI(post.id, post.data);
        });

        if (postsCount) {
            postsCount.textContent = myPosts.length.toString();
        }
    }, (error) => {
        console.error("Ошибка загрузки постов:", error);
    });
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

function addPostToUI(postId, post) {
    const postItem = document.createElement("div");
    postItem.className = "post-item";
    postItem.dataset.postId = postId;

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
                await update(dbRef(rtdb), {
                    [`posts/${postId}`]: null,
                    [`postOwners/${postId}`]: null
                });
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

// ========================
// УТИЛИТЫ
// ========================
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
