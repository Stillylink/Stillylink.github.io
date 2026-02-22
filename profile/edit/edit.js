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
    updateDoc,
    deleteDoc,
    serverTimestamp,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

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

// DOM элементы навигации
const regBtn = document.querySelector(".register-btn");
const avatar = document.querySelector(".user-avatar");
const avatarLetter = document.querySelector(".user-avatar span");
const userMenu = document.querySelector(".user-menu");
const logoutBtn = document.getElementById("logoutBtn");

// DOM элементы табов
const editTabs = document.querySelectorAll(".edit-tab");
const editSections = document.querySelectorAll(".edit-section");

// DOM элементы профиля
const editAvatarLetter = document.getElementById("editAvatarLetter");
const editProfileName = document.getElementById("editProfileName");
const editProfileId = document.getElementById("editProfileId");
const idHint = document.getElementById("idHint");
const idError = document.getElementById("idError");
const editProfileBio = document.getElementById("editProfileBio");
const bioCharCount = document.getElementById("bioCharCount");
const bioLineCount = document.getElementById("bioLineCount");
const saveProfileBtn = document.getElementById("saveProfileBtn");

// DOM элементы статуса
const editStatusText = document.getElementById("editStatusText");
const statusCharCount = document.getElementById("statusCharCount");
const statusLineCount = document.getElementById("statusLineCount");
const saveStatusBtn = document.getElementById("saveStatusBtn");
const cancelStatusBtn = document.getElementById("cancelStatusBtn");

// DOM элементы информации
const editInfoCountry = document.getElementById("editInfoCountry");
const editInfoNickname = document.getElementById("editInfoNickname");
const editInfoEmail = document.getElementById("editInfoEmail");
const editInfoOccupation = document.getElementById("editInfoOccupation");
const occupationCharCount = document.getElementById("occupationCharCount");
const infoLinksContainer = document.getElementById("infoLinksContainer");
const addInfoLinkBtn = document.getElementById("addInfoLinkBtn");
const saveInfoBtn = document.getElementById("saveInfoBtn");
const cancelInfoBtn = document.getElementById("cancelInfoBtn");
const renameNicknameBtn = document.getElementById("renameNicknameBtn");
const nicknameLabel = document.getElementById("nicknameLabel");

// DOM элементы видео
const editVideoUrl = document.getElementById("editVideoUrl");
const videoEmpty = document.getElementById("videoEmpty");
const videoPlayer = document.getElementById("videoPlayer");
const videoIframe = document.getElementById("videoIframe");
const saveVideoBtn = document.getElementById("saveVideoBtn");
const deleteVideoBtn = document.getElementById("deleteVideoBtn");

// DOM элементы модального окна
const renameModal = document.getElementById("renameModal");
const closeRenameModal = document.getElementById("closeRenameModal");
const cancelRenameBtn = document.getElementById("cancelRenameBtn");
const saveRenameBtn = document.getElementById("saveRenameBtn");
const newFieldName = document.getElementById("newFieldName");

// DOM элементы социальных сетей
const socialLinksList  = document.getElementById("socialLinksList");
const addSocialLinkBtn = document.getElementById("addSocialLinkBtn");
const socialLinksHint  = document.getElementById("socialLinksHint");

let currentUser = null;
let currentUserData = null;
let originalData = {};
const PROFILE_CACHE_KEY = "userProfileCache_v1";

// Константы для смены ID
const USERNAME_CHANGE_COOLDOWN_DAYS = 7;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;

// ========================
// СОЦИАЛЬНЫЕ СЕТИ — КОНФИГ
// ========================
const MAX_SOCIAL_LINKS = 5;

const SOCIAL_NETWORKS = [
    { value: 'instagram', label: 'Instagram',   placeholder: 'https://instagram.com/username' },
    { value: 'telegram',  label: 'Telegram',    placeholder: 'https://t.me/username' },
    { value: 'vk',        label: 'ВКонтакте',   placeholder: 'https://vk.com/username' },
    { value: 'tiktok',    label: 'TikTok',      placeholder: 'https://tiktok.com/@username' },
    { value: 'youtube',   label: 'YouTube',     placeholder: 'https://youtube.com/@channel' },
    { value: 'twitter',   label: 'X (Twitter)', placeholder: 'https://x.com/username' },
    { value: 'twitch',    label: 'Twitch',      placeholder: 'https://twitch.tv/username' },
    { value: 'discord',   label: 'Discord',     placeholder: 'https://discord.gg/invite' },
    { value: 'github',    label: 'GitHub',      placeholder: 'https://github.com/username' },
    { value: 'spotify',   label: 'Spotify',     placeholder: 'https://open.spotify.com/...' },
];

// ========================
// НАВИГАЦИЯ
// ========================
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

// Загрузка аватарки из localStorage
const savedAvatar = localStorage.getItem('userAvatarLetter');
if (savedAvatar) {
    regBtn?.classList.add('hidden');
    avatar?.classList.remove('hidden');
    avatarLetter.textContent = savedAvatar;
}

// ========================
// ПЕРЕКЛЮЧЕНИЕ ТАБОВ
// ========================
editTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;

        editTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        editSections.forEach(section => {
            if (section.dataset.section === targetTab) {
                section.classList.add('active');
            } else {
                section.classList.remove('active');
            }
        });
    });
});

// ========================
// ФУНКЦИЯ ГЕНЕРАЦИИ USERNAMEID
// ========================
function generateUsernameID(email, uid) {
    const emailPart = email.split('@')[0];
    const cleanEmail = emailPart.replace(/[^a-zA-Z0-9]/g, '');
    const shortUID = uid.substring(0, 4);
    const generatedID = `${cleanEmail}_${shortUID}`.toLowerCase();
    return generatedID;
}

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
            console.error("Ошибка парсинга кэша");
            localStorage.removeItem(PROFILE_CACHE_KEY);
            currentUserData = null;
        }
    }

    if (!currentUserData) {
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
            const defaultName = user.email.split('@')[0];
            const generatedID = generateUsernameID(user.email, user.uid);

            const newProfile = {
                name: defaultName,
                email: user.email,
                bio: "",
                avatarUrl: null,
                youtubeVideoId: null,
                status: "",
                usernameID: generatedID,
                socialLinks: [],
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
        } else {
            currentUserData = userSnap.data();

            // Миграция: добавляем usernameID если его нет
            if (!currentUserData.usernameID) {
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

                        currentUserData.usernameID = fallbackID;
                        console.log("✅ Миграция: добавлен fallback usernameID:", fallbackID);
                    } else {
                        transaction.set(usernameDocRef, { ownerUID: user.uid });
                        transaction.update(userDocRef, { usernameID: generatedID });

                        currentUserData.usernameID = generatedID;
                        console.log("✅ Миграция: добавлен usernameID:", generatedID);
                    }
                });
            }

            // Миграция: добавляем socialLinks если нет
            if (!currentUserData.socialLinks) {
                currentUserData.socialLinks = [];
            }

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
        console.log("Профиль загружен из Firestore");
    }

    const letter = currentUserData.name.charAt(0).toUpperCase();
    avatarLetter.textContent = letter;
    localStorage.setItem("userAvatarLetter", letter);

    loadProfileData();
    loadStatusData();
    loadInfoData();
    loadVideoData();

    checkUsernameCooldown();
    saveOriginalData();
});

// ========================
// ВЫХОД
// ========================
logoutBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    await signOut(auth);
    localStorage.clear();
    window.location.href = "/login/";
});

// ========================
// СОХРАНЕНИЕ ОРИГИНАЛЬНЫХ ДАННЫХ
// ========================
function saveOriginalData() {
    originalData = {
        profile: {
            name: currentUserData.name,
            bio: currentUserData.bio || "",
            usernameID: currentUserData.usernameID || ""
        },
        status: currentUserData.status || "",
        info: JSON.parse(JSON.stringify(currentUserData.info || {})),
        video: currentUserData.youtubeVideoId || null,
        socialLinks: JSON.parse(JSON.stringify(currentUserData.socialLinks || []))
    };
}

// ========================
// ПРОФИЛЬ
// ========================
function loadProfileData() {
    editAvatarLetter.textContent = currentUserData.name.charAt(0).toUpperCase();
    editProfileName.value = currentUserData.name;
    editProfileId.value = currentUserData.usernameID || "";
    editProfileBio.value = currentUserData.bio || "";

    updateBioCounter();
    loadSocialLinks(currentUserData.socialLinks || []);
}

function updateBioCounter() {
    const text = editProfileBio.value;
    const lines = text.split('\n');

    bioCharCount.textContent = text.length;
    bioLineCount.textContent = lines.length;

    bioCharCount.style.color = text.length > 100 ? '#ff3b30' : 'var(--text-secondary)';
    bioLineCount.style.color = lines.length > 10  ? '#ff3b30' : 'var(--text-secondary)';
}

editProfileBio.addEventListener('input', () => {
    let text = editProfileBio.value;
    let lines = text.split('\n');

    if (lines.length > 10) {
        text = lines.slice(0, 10).join('\n');
        editProfileBio.value = text;
        lines = text.split('\n');
    }

    if (text.length > 100) {
        editProfileBio.value = text.slice(0, 100);
    }

    updateBioCounter();
});

// ========================
// ВАЛИДАЦИЯ USERNAMEID
// ========================
function validateUsernameID(username) {
    username = username.toLowerCase().trim();

    if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
        return {
            valid: false,
            error: `ID должен быть от ${USERNAME_MIN_LENGTH} до ${USERNAME_MAX_LENGTH} символов`
        };
    }

    const validFormat = /^[a-z0-9_]+$/;
    if (!validFormat.test(username)) {
        return {
            valid: false,
            error: "Только латиница, цифры и нижнее подчеркивание"
        };
    }

    const reserved = ['admin', 'root', 'system', 'api', 'app', 'stillylink', 'support', 'help'];
    if (reserved.includes(username)) {
        return {
            valid: false,
            error: "Этот ID зарезервирован"
        };
    }

    return { valid: true, username };
}

// ========================
// ПРОВЕРКА COOLDOWN
// ========================
function checkUsernameCooldown() {
    const lastChange = currentUserData.lastUsernameChange;

    if (!lastChange) return;

    let changeDate;
    if (lastChange.toDate && typeof lastChange.toDate === 'function') {
        changeDate = lastChange.toDate();
    } else if (lastChange.seconds) {
        changeDate = new Date(lastChange.seconds * 1000);
    } else {
        changeDate = new Date(lastChange);
    }

    const now = new Date();
    const diffDays = (now - changeDate) / (1000 * 60 * 60 * 24);

    if (diffDays < USERNAME_CHANGE_COOLDOWN_DAYS) {
        const daysLeft = Math.ceil(USERNAME_CHANGE_COOLDOWN_DAYS - diffDays);
        editProfileId.disabled = true;
        idHint.textContent = `Смена ID доступна через ${daysLeft} ${pluralize(daysLeft, 'день', 'дня', 'дней')}`;
        idHint.classList.add('cooldown');
    } else {
        editProfileId.disabled = false;
        idHint.classList.remove('cooldown');
    }
}

// ========================
// ВАЛИДАЦИЯ ID ПРИ ВВОДЕ
// ========================
editProfileId.addEventListener('input', () => {
    const value = editProfileId.value.trim().toLowerCase();
    editProfileId.value = value;

    editProfileId.classList.remove('error');
    idError.classList.add('hidden');
    idError.textContent = '';

    if (value.length > 0) {
        const validation = validateUsernameID(value);
        if (!validation.valid) {
            editProfileId.classList.add('error');
            idError.classList.remove('hidden');
            idError.textContent = validation.error;
        }
    }
});

// ========================
// СОХРАНЕНИЕ ПРОФИЛЯ
// ========================
saveProfileBtn.addEventListener('click', async () => {
    if (!currentUser) return;

    const name = editProfileName.value.trim();
    const bio = editProfileBio.value.trim();
    const newUsernameID = editProfileId.value.trim().toLowerCase();
    const socialLinks = collectSocialLinks();

    if (!name) {
        alert('Введите имя');
        return;
    }

    const validation = validateUsernameID(newUsernameID);
    if (!validation.valid) {
        editProfileId.classList.add('error');
        idError.classList.remove('hidden');
        idError.textContent = validation.error;
        return;
    }

    const oldUsernameID = currentUserData.usernameID;
    let usernameChanged = false;

    if (newUsernameID !== oldUsernameID) {
        usernameChanged = true;

        const lastChange = currentUserData.lastUsernameChange;
        if (lastChange) {
            let changeDate;
            if (lastChange.toDate && typeof lastChange.toDate === 'function') {
                changeDate = lastChange.toDate();
            } else if (lastChange.seconds) {
                changeDate = new Date(lastChange.seconds * 1000);
            } else {
                changeDate = new Date(lastChange);
            }

            const diffDays = (new Date() - changeDate) / (1000 * 60 * 60 * 24);

            if (diffDays < USERNAME_CHANGE_COOLDOWN_DAYS) {
                const daysLeft = Math.ceil(USERNAME_CHANGE_COOLDOWN_DAYS - diffDays);
                alert(`⏱️ Сменить ID можно будет через ${daysLeft} ${pluralize(daysLeft, 'день', 'дня', 'дней')}`);
                return;
            }
        }
    }

    saveProfileBtn.disabled = true;
    saveProfileBtn.textContent = 'Сохранение...';

    try {
        const userDocRef = doc(db, "users", currentUser.uid);

        if (usernameChanged) {
            await runTransaction(db, async (transaction) => {
                const oldUsernameDocRef = doc(db, "usernames", oldUsernameID.toLowerCase());
                const newUsernameDocRef = doc(db, "usernames", newUsernameID);

                const newUsernameSnap = await transaction.get(newUsernameDocRef);

                if (newUsernameSnap.exists()) {
                    throw new Error('ID_ALREADY_TAKEN');
                }

                transaction.delete(oldUsernameDocRef);
                transaction.set(newUsernameDocRef, { ownerUID: currentUser.uid });
                transaction.update(userDocRef, {
                    name,
                    bio: bio || "",
                    usernameID: newUsernameID,
                    lastUsernameChange: serverTimestamp(),
                    socialLinks
                });
            });

            currentUserData.usernameID = newUsernameID;
            currentUserData.lastUsernameChange = new Date();

            console.log("✅ ID успешно изменён:", newUsernameID);
        } else {
            await setDoc(userDocRef, {
                name,
                bio: bio || "",
                socialLinks
            }, { merge: true });
        }

        currentUserData.name = name;
        currentUserData.bio = bio || "";
        currentUserData.socialLinks = socialLinks;

        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));

        const newLetter = name.charAt(0).toUpperCase();
        editAvatarLetter.textContent = newLetter;
        avatarLetter.textContent = newLetter;
        localStorage.setItem("userAvatarLetter", newLetter);

        saveOriginalData();
        checkUsernameCooldown();

        alert('✅ Профиль успешно сохранён!');
    } catch (error) {
        console.error("Ошибка сохранения профиля:", error);

        if (error.message === 'ID_ALREADY_TAKEN') {
            editProfileId.classList.add('error');
            idError.classList.remove('hidden');
            idError.textContent = '❌ Этот ID уже занят';
        } else {
            alert('❌ Не удалось сохранить профиль: ' + error.message);
        }
    } finally {
        saveProfileBtn.disabled = false;
        saveProfileBtn.textContent = 'Сохранить изменения';
    }
});

// ========================
// СТАТУС
// ========================
function loadStatusData() {
    editStatusText.value = currentUserData.status || "";
    updateStatusCounter();
}

function updateStatusCounter() {
    const text = editStatusText.value;
    const lines = text.split('\n');

    statusCharCount.textContent = text.length;
    statusLineCount.textContent = lines.length;

    statusCharCount.style.color = text.length > 100 ? '#ff3b30' : 'var(--text-secondary)';
    statusLineCount.style.color = lines.length > 10  ? '#ff3b30' : 'var(--text-secondary)';
}

editStatusText.addEventListener('input', () => {
    let text = editStatusText.value;
    let lines = text.split('\n');

    if (lines.length > 10) {
        text = lines.slice(0, 10).join('\n');
        editStatusText.value = text;
        lines = text.split('\n');
    }

    if (text.length > 100) {
        editStatusText.value = text.slice(0, 100);
    }

    updateStatusCounter();
});

cancelStatusBtn.addEventListener('click', () => {
    editStatusText.value = originalData.status;
    updateStatusCounter();
});

saveStatusBtn.addEventListener('click', async () => {
    if (!currentUser) return;

    const status = editStatusText.value.trim();
    const lines = status.split('\n');

    if (lines.length > 10) {
        alert('Статус не может содержать более 10 строк');
        return;
    }

    if (status.length > 100) {
        alert('Статус не может быть длиннее 100 символов');
        return;
    }

    saveStatusBtn.disabled = true;
    saveStatusBtn.textContent = 'Сохранение...';

    try {
        const userDocRef = doc(db, "users", currentUser.uid);
        await setDoc(userDocRef, { status: status || "" }, { merge: true });

        currentUserData.status = status || "";
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));

        saveOriginalData();

        alert('✅ Статус успешно сохранён!');
    } catch (error) {
        console.error("Ошибка сохранения статуса:", error);
        alert('❌ Не удалось сохранить статус');
    } finally {
        saveStatusBtn.disabled = false;
        saveStatusBtn.textContent = 'Сохранить';
    }
});

// ========================
// ИНФОРМАЦИЯ
// ========================
function loadInfoData() {
    const infoData = currentUserData.info || {};

    editInfoCountry.value = infoData.country || "";
    editInfoNickname.value = infoData.nickname || "";
    editInfoEmail.value = infoData.email || "";
    editInfoOccupation.value = infoData.occupation || "";

    nicknameLabel.textContent = infoData.nicknameLabel || "Прозвище";

    renderInfoLinks(infoData.links || []);
    updateOccupationCounter();
}

function updateOccupationCounter() {
    const length = editInfoOccupation.value.length;
    occupationCharCount.textContent = length;
    occupationCharCount.style.color = length > 200 ? '#ff3b30' : 'var(--text-secondary)';
}

editInfoOccupation.addEventListener('input', () => {
    if (editInfoOccupation.value.length > 200) {
        editInfoOccupation.value = editInfoOccupation.value.slice(0, 200);
    }
    updateOccupationCounter();
});

function renderInfoLinks(links = []) {
    infoLinksContainer.innerHTML = '';
    links.forEach(link => addInfoLinkInput(link.name, link.url));
    updateAddLinkButton();
}

function addInfoLinkInput(name = '', url = '') {
    const linkItem = document.createElement('div');
    linkItem.className = 'link-item';

    linkItem.innerHTML = `
        <input type="text" placeholder="Название" value="${escapeHtml(name)}" class="link-name" maxlength="50">
        <input type="url" placeholder="https://example.com" value="${escapeHtml(url)}" class="link-url">
        <button type="button" class="remove-link-btn">×</button>
    `;

    linkItem.querySelector('.remove-link-btn').addEventListener('click', () => {
        linkItem.remove();
        updateAddLinkButton();
    });

    infoLinksContainer.appendChild(linkItem);
}

addInfoLinkBtn.addEventListener('click', () => {
    const currentLinks = infoLinksContainer.querySelectorAll('.link-item');
    if (currentLinks.length >= 3) return;
    addInfoLinkInput();
    updateAddLinkButton();
});

function updateAddLinkButton() {
    const currentLinks = infoLinksContainer.querySelectorAll('.link-item');
    if (currentLinks.length >= 3) {
        addInfoLinkBtn.disabled = true;
        addInfoLinkBtn.textContent = '+ Максимум 3 ссылки';
    } else {
        addInfoLinkBtn.disabled = false;
        addInfoLinkBtn.textContent = '+ Добавить ссылку';
    }
}

cancelInfoBtn.addEventListener('click', () => {
    loadInfoData();
});

saveInfoBtn.addEventListener('click', async () => {
    if (!currentUser) return;

    const linkItems = infoLinksContainer.querySelectorAll('.link-item');
    const links = [];

    linkItems.forEach(item => {
        const name = item.querySelector('.link-name').value.trim();
        const url  = item.querySelector('.link-url').value.trim();

        if (name && url) {
            try {
                new URL(url);
                links.push({ name, url });
            } catch (e) {
                // Игнорируем невалидные URL
            }
        }
    });

    const infoData = {
        links,
        email: editInfoEmail.value.trim(),
        country: editInfoCountry.value,
        nickname: editInfoNickname.value.trim(),
        nicknameLabel: nicknameLabel.textContent,
        occupation: editInfoOccupation.value.trim().slice(0, 200)
    };

    saveInfoBtn.disabled = true;
    saveInfoBtn.textContent = 'Сохранение...';

    try {
        const userDocRef = doc(db, "users", currentUser.uid);
        await setDoc(userDocRef, { info: infoData }, { merge: true });

        currentUserData.info = infoData;
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));

        saveOriginalData();

        alert('✅ Информация успешно сохранена!');
    } catch (error) {
        console.error("Ошибка сохранения информации:", error);
        alert('❌ Не удалось сохранить информацию');
    } finally {
        saveInfoBtn.disabled = false;
        saveInfoBtn.textContent = 'Сохранить';
    }
});

// Переименование поля "Прозвище"
renameNicknameBtn.addEventListener('click', () => {
    newFieldName.value = nicknameLabel.textContent;
    renameModal.classList.remove('hidden');
    newFieldName.focus();
});

saveRenameBtn.addEventListener('click', () => {
    const label = newFieldName.value.trim();

    if (!label) {
        alert('Введите название поля');
        return;
    }

    if (label.length > 30) {
        alert('Название не может быть длиннее 30 символов');
        return;
    }

    nicknameLabel.textContent = label;
    renameModal.classList.add('hidden');
});

closeRenameModal.addEventListener('click', () => renameModal.classList.add('hidden'));
cancelRenameBtn.addEventListener('click', () => renameModal.classList.add('hidden'));

renameModal.addEventListener('click', (e) => {
    if (e.target === renameModal) renameModal.classList.add('hidden');
});

// ========================
// ВИДЕО
// ========================
function loadVideoData() {
    const videoId = currentUserData.youtubeVideoId;

    if (videoId) {
        editVideoUrl.value = `https://www.youtube.com/watch?v=${videoId}`;
        showVideoPreview(videoId);
    } else {
        editVideoUrl.value = "";
        hideVideoPreview();
    }
}

function showVideoPreview(videoId) {
    videoIframe.src = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
    videoEmpty.classList.add('hidden');
    videoPlayer.classList.remove('hidden');
}

function hideVideoPreview() {
    videoIframe.src = "";
    videoEmpty.classList.remove('hidden');
    videoPlayer.classList.add('hidden');
}

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

editVideoUrl.addEventListener('input', () => {
    const url = editVideoUrl.value.trim();
    if (!url) { hideVideoPreview(); return; }
    const videoId = extractVideoId(url);
    if (videoId) { showVideoPreview(videoId); } else { hideVideoPreview(); }
});

saveVideoBtn.addEventListener('click', async () => {
    if (!currentUser) return;

    const url = editVideoUrl.value.trim();
    const videoId = extractVideoId(url);

    if (url && !videoId) {
        alert('❌ Неверная ссылка!\n\nПроверьте, что:\n• Это ссылка на обычное YouTube видео\n• Это НЕ Shorts\n• Формат: youtube.com/watch?v=... или youtu.be/...');
        return;
    }

    saveVideoBtn.disabled = true;
    saveVideoBtn.textContent = 'Сохранение...';

    try {
        const userDocRef = doc(db, "users", currentUser.uid);
        await setDoc(userDocRef, { youtubeVideoId: videoId || null }, { merge: true });

        currentUserData.youtubeVideoId = videoId || null;
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));

        saveOriginalData();

        alert('✅ Видео успешно сохранено!');
    } catch (error) {
        console.error("Ошибка сохранения видео:", error);
        alert('❌ Не удалось сохранить видео');
    } finally {
        saveVideoBtn.disabled = false;
        saveVideoBtn.textContent = 'Сохранить';
    }
});

deleteVideoBtn.addEventListener('click', async () => {
    if (!confirm('Удалить видео из профиля?')) return;

    deleteVideoBtn.disabled = true;
    deleteVideoBtn.textContent = 'Удаление...';

    try {
        const userDocRef = doc(db, "users", currentUser.uid);
        await setDoc(userDocRef, { youtubeVideoId: null }, { merge: true });

        currentUserData.youtubeVideoId = null;
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));

        editVideoUrl.value = "";
        hideVideoPreview();

        saveOriginalData();

        alert('✅ Видео успешно удалено!');
    } catch (error) {
        console.error("Ошибка удаления видео:", error);
        alert('❌ Не удалось удалить видео');
    } finally {
        deleteVideoBtn.disabled = false;
        deleteVideoBtn.textContent = 'Удалить видео';
    }
});

// ========================
// СОЦИАЛЬНЫЕ СЕТИ
// ========================
function buildSelectOptions(selectedValue = '') {
    return SOCIAL_NETWORKS.map(n =>
        `<option value="${n.value}" ${n.value === selectedValue ? 'selected' : ''}>${n.label}</option>`
    ).join('');
}

function getPlaceholder(value) {
    return (SOCIAL_NETWORKS.find(n => n.value === value) || SOCIAL_NETWORKS.at(-1)).placeholder;
}

function isValidUrl(url) {
    try { new URL(url); return true; } catch { return false; }
}

function addSocialLinkRow(network = 'instagram', url = '') {
    const row = document.createElement('div');
    row.className = 'social-link-item';

    row.innerHTML = `
        <select class="social-select">
            ${buildSelectOptions(network)}
        </select>
        <input
            type="url"
            class="social-url-input"
            placeholder="${getPlaceholder(network)}"
            value="${escapeHtml(url)}"
        >
        <button type="button" class="remove-link-btn" title="Удалить">×</button>
    `;

    const select = row.querySelector('.social-select');
    const input  = row.querySelector('.social-url-input');

    select.addEventListener('change', () => {
        input.placeholder = getPlaceholder(select.value);
        input.classList.remove('invalid');
    });

    input.addEventListener('blur', () => {
        const val = input.value.trim();
        if (val && !isValidUrl(val)) {
            input.classList.add('invalid');
        } else {
            input.classList.remove('invalid');
        }
    });

    input.addEventListener('input', () => input.classList.remove('invalid'));

    row.querySelector('.remove-link-btn').addEventListener('click', () => {
        row.remove();
        updateSocialLinkButton();
    });

    socialLinksList.appendChild(row);
    updateSocialLinkButton();
}

function updateSocialLinkButton() {
    const count = socialLinksList.querySelectorAll('.social-link-item').length;
    addSocialLinkBtn.disabled = count >= MAX_SOCIAL_LINKS;
    addSocialLinkBtn.textContent = count >= MAX_SOCIAL_LINKS
        ? `+ Максимум ${MAX_SOCIAL_LINKS} ссылок`
        : '+ Добавить социальную сеть';

    if (socialLinksHint) {
        socialLinksHint.textContent = `${count}/${MAX_SOCIAL_LINKS} ссылок`;
    }
}

function loadSocialLinks(links = []) {
    socialLinksList.innerHTML = '';
    links.forEach(l => addSocialLinkRow(l.network, l.url));
    updateSocialLinkButton();
}

function collectSocialLinks() {
    const rows = socialLinksList.querySelectorAll('.social-link-item');
    const result = [];

    rows.forEach(row => {
        const network = row.querySelector('.social-select').value;
        const url     = row.querySelector('.social-url-input').value.trim();

        if (url && isValidUrl(url)) {
            result.push({ network, url });
        }
    });

    return result;
}

addSocialLinkBtn.addEventListener('click', () => {
    if (socialLinksList.querySelectorAll('.social-link-item').length < MAX_SOCIAL_LINKS) {
        addSocialLinkRow();
    }
});

// ========================
// УТИЛИТЫ
// ========================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function pluralize(num, one, few, many) {
    const mod10  = num % 10;
    const mod100 = num % 100;

    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
}
