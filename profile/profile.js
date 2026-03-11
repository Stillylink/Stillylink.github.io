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
    where,
    orderBy,
    onSnapshot,
    deleteDoc,
    Timestamp,
    limit,
    startAfter,
    increment,
    persistentLocalCache,
    persistentMultipleTabManager,
    initializeFirestore,
    getDocFromCache,
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
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
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
const profileSocialLinks = document.getElementById("profileSocialLinks");
const avatarUpload = document.getElementById("avatarUpload");
const avatarUploadBtn = document.querySelector(".avatar-upload-btn");

const editProfileBtn = document.getElementById("editProfileBtn");

const postInput = document.getElementById("postInput");
const publishPostBtn = document.getElementById("publishPostBtn");
const attachPhotoBtn = document.getElementById("attachPhotoBtn");
const postPhotoInput = document.getElementById("postPhotoInput");
const postsList = document.getElementById("postsList");
const postComposer = document.getElementById("postComposer");

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

// ========================
// СОСТОЯНИЕ
// ========================
let currentUser = null;
let currentUserData = null;
let profileOwnerUID = null;
let profileOwnerData = null;
let isOwnProfile = false;

let currentPhotoFile = null;
const PROFILE_CACHE_KEY = "userProfileCache_v1";

// Infinite Scroll
const POSTS_PER_PAGE = 20;
let lastVisible = null;
let isFetching = false;
let hasMore = true;

// Unsubscribe-функции
let unsubscribeProfile = null;
let unsubscribePosts = null;
const postsPageListeners = [];

// ========================
// ЧИТАЕМ ?u= ИЗ URL
// ========================
const urlParams = new URLSearchParams(window.location.search);
const usernameFromURL = urlParams.get("u")?.toLowerCase().trim() || null;

// ========================
// АВАТАРКА ИЗ localStorage СРАЗУ
// ========================
const savedAvatar = localStorage.getItem('userAvatarLetter');
if (savedAvatar) {
    regBtn?.classList.add('hidden');
    avatar?.classList.remove('hidden');
    avatarLetter.textContent = savedAvatar;
}

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

// ========================
// СКРЫТЬ/ПОКАЗАТЬ ЭЛЕМЕНТЫ ВЛАДЕЛЬЦА
// ========================
function applyOwnerUI(isOwner) {
    editProfileBtn?.classList.toggle("hidden", !isOwner);
    avatarUploadBtn?.classList.toggle("hidden", !isOwner);
    postComposer?.classList.toggle("hidden", !isOwner);
    addVideoBtn?.classList.toggle("hidden", !isOwner);

    const wallTitle = document.querySelector(".wall-header h2");
    if (wallTitle) {
        wallTitle.textContent = isOwner ? "Мои записи" : "Записи";
    }
}

function hideDeleteButtons() {
    document.querySelectorAll(".post-delete").forEach(btn => {
        btn.classList.add("hidden");
    });
}

// ========================
// КОНФИГ СОЦИАЛЬНЫХ СЕТЕЙ
// ========================
const SOCIAL_NETWORKS_META = {
    instagram: {
        label: 'Instagram',
        svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>`
    },
    telegram: {
        label: 'Telegram',
        svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>`
    },
    vk: {
        label: 'ВКонтакте',
        svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.252.678-1.846 0-3.896-1.118-5.335-3.202C5.029 11.886 4.47 9.986 4.47 9.56c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.677.863 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V11.54c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.743c.372 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.27-1.422 2.168-3.608 2.168-3.608.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .779.186.254.796.779 1.202 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.745-.576.745z"/></svg>`
    },
    tiktok: {
        label: 'TikTok',
        svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`
    },
    youtube: {
        label: 'YouTube',
        svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`
    },
    twitter: {
        label: 'X (Twitter)',
        svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`
    },
    twitch: {
        label: 'Twitch',
        svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>`
    },
    discord: {
        label: 'Discord',
        svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.056a19.926 19.926 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`
    },
    github: {
        label: 'GitHub',
        svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>`
    },
    spotify: {
        label: 'Spotify',
        svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`
    }
};

// ========================
// РЕНДЕР СОЦИАЛЬНЫХ СЕТЕЙ
// ========================
function renderSocialLinks(socialLinks) {
    if (!profileSocialLinks) return;

    if (!socialLinks || socialLinks.length === 0) {
        profileSocialLinks.innerHTML = '';
        profileSocialLinks.classList.add('hidden');
        return;
    }

    profileSocialLinks.classList.remove('hidden');

    profileSocialLinks.innerHTML = socialLinks.map(item => {
        const meta    = SOCIAL_NETWORKS_META[item.network] || SOCIAL_NETWORKS_META.other;
        const label   = meta.label;
        const svg     = meta.svg;
        const network = item.network || 'other';

        return `<a
            href="${escapeHtml(item.url)}"
            target="_blank"
            rel="noopener noreferrer"
            class="social-icon-link"
            data-network="${escapeHtml(network)}"
            data-label="${escapeHtml(label)}"
            title="${escapeHtml(label)}"
        >${svg}</a>`;
    }).join('');
}

// ========================
// ИНФОРМАЦИЯ
// ========================
function renderInfo(infoData) {
    if (!infoContent) return;

    const hasLinks      = infoData?.links && infoData.links.length > 0;
    const hasEmail      = infoData?.email && infoData.email.trim() !== "";
    const hasCountry    = infoData?.country && infoData.country.trim() !== "";
    const hasNickname   = infoData?.nickname && infoData.nickname.trim() !== "";
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
// СТАТУС
// ========================
function renderStatus(status) {
    if (!statusText) return;

    if (!status || status.trim() === "") {
        statusText.innerHTML = `
            <span style="opacity: 0.5; font-style: italic; color: var(--text-secondary);">Статус не установлен</span>
        `;
    } else {
        statusText.innerHTML = `<div class="status-content" style="white-space: pre-wrap; word-break: break-word;"></div>`;
        statusText.querySelector('.status-content').textContent = status;
    }
}

// ========================
// YOUTUBE
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
    if (!isOwnProfile) return;
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
// ЗАГРУЗКА ЧУЖОГО ПРОФИЛЯ
// ========================
const usernameOwnerCache = {};

async function resolveProfileOwner(usernameID) {
    if (usernameOwnerCache[usernameID]) {
        console.log("⚡ ownerUID из in-memory кэша");
        return usernameOwnerCache[usernameID];
    }

    const usernameDocRef = doc(db, "usernames", usernameID);

    try {
        const cachedSnap = await getDocFromCache(usernameDocRef);
        if (cachedSnap.exists()) {
            const ownerUID = cachedSnap.data().ownerUID || null;
            if (ownerUID) {
                usernameOwnerCache[usernameID] = ownerUID;
                console.log("♻️ ownerUID из Firestore disk-кэша");
                return ownerUID;
            }
        }
    } catch (e) {
        // Кэша нет — идём в сеть
    }

    try {
        const usernameSnap = await getDoc(usernameDocRef);
        if (!usernameSnap.exists()) {
            return null;
        }
        const ownerUID = usernameSnap.data().ownerUID || null;
        if (ownerUID) usernameOwnerCache[usernameID] = ownerUID;
        console.log("🌐 ownerUID загружен из сети");
        return ownerUID;
    } catch (error) {
        console.error("Ошибка поиска владельца профиля:", error);
        return null;
    }
}

function subscribeToProfileOwner(ownerUID) {
    const userDocRef = doc(db, "users", ownerUID);

    unsubscribeProfile = onSnapshot(
        userDocRef,
        { includeMetadataChanges: true },
        (snap) => {
            if (!snap.exists()) {
                showProfileNotFound();
                return;
            }

            const data = snap.data();
            if (!data.socialLinks) data.socialLinks = [];
            if (!data.info) data.info = { links: [], email: "", country: "", nickname: "", nicknameLabel: "Прозвище", occupation: "" };

            profileOwnerData = data;

            renderProfile(profileOwnerData, ownerUID);
            renderSocialLinks(profileOwnerData.socialLinks);
            renderStatus(profileOwnerData.status || "");
            renderInfo(profileOwnerData.info);
            loadYoutubeVideo(profileOwnerData.youtubeVideoId);

            if (!observer) {
                initScrollListener();
                loadUserPosts();
            }
        },
        (error) => {
            console.error("Ошибка слушателя чужого профиля:", error);
        }
    );
}

function showProfileNotFound() {
    profileName.textContent = "Профиль не найден";
    profileBio.textContent = "Пользователь с таким именем не существует";
    postsList.innerHTML = `
        <div class="posts-empty">
            <div class="posts-empty-icon">🔍</div>
            <div class="posts-empty-text">Профиль не найден</div>
        </div>
    `;
}

// ========================
// ОБНОВЛЕНИЕ АВАТАРА В НАВБАРЕ
// ========================
function updateNavAvatar(user) {
    if (!user) {
        regBtn?.classList.remove('hidden');
        avatar?.classList.add('hidden');
        return;
    }

    regBtn?.classList.add('hidden');
    avatar?.classList.remove('hidden');

    const savedLetter = localStorage.getItem("userAvatarLetter");
    if (savedLetter) {
        avatarLetter.textContent = savedLetter;
    } else {
        avatarLetter.textContent = (user.email || "U").charAt(0).toUpperCase();
    }
}

// ========================
// ПРОВЕРКА АВТОРИЗАЦИИ
// ========================
onAuthStateChanged(auth, async (user) => {
    await updateNavAvatar(user);

    currentUser = user || null;

    if (usernameFromURL) {
        await handleURLProfile(user);
        return;
    }

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

    profileOwnerUID = user.uid;
    isOwnProfile = true;
    applyOwnerUI(true);

    const cachedProfile = localStorage.getItem(PROFILE_CACHE_KEY);
    if (cachedProfile) {
        try {
            currentUserData = JSON.parse(cachedProfile);
            renderProfile(currentUserData, user.uid);
            renderSocialLinks(currentUserData.socialLinks || []);
            renderStatus(currentUserData.status || "");
            renderInfo(currentUserData.info || {});
            loadYoutubeVideo(currentUserData.youtubeVideoId);
            console.log("⚡ Профиль отрисован из localStorage-кэша");
        } catch (e) {
            console.error("Ошибка парсинга кэша:", e);
            localStorage.removeItem(PROFILE_CACHE_KEY);
            currentUserData = null;
        }
    }

    subscribeToOwnProfile(user);
});

// ========================
// ПОДПИСКА НА СВОЙ ПРОФИЛЬ
// ========================
function subscribeToOwnProfile(user) {
    if (unsubscribeProfile) return;

    const userDocRef = doc(db, "users", user.uid);

    unsubscribeProfile = onSnapshot(
        userDocRef,
        { includeMetadataChanges: true },
        async (snap) => {
            const fromCache = snap.metadata.fromCache;
            const hasPendingWrites = snap.metadata.hasPendingWrites;

            console.log(`📥 Профиль: fromCache=${fromCache}, hasPendingWrites=${hasPendingWrites}`);

            if (!snap.exists()) {
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
                localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));
                return;
            }

            const freshData = snap.data();

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

            if (!freshData.socialLinks) freshData.socialLinks = [];
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

            const cachedJSON = JSON.stringify(currentUserData);
            const freshJSON  = JSON.stringify(freshData);

            if (cachedJSON !== freshJSON) {
                console.log(fromCache ? "♻️ Профиль из Firestore-кэша" : "🔄 Профиль обновлён с сервера");
                currentUserData = freshData;
                localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));
                renderProfile(currentUserData, user.uid);
                renderSocialLinks(currentUserData.socialLinks || []);
                renderStatus(currentUserData.status || "");
                renderInfo(currentUserData.info || {});
                loadYoutubeVideo(currentUserData.youtubeVideoId);
            } else {
                console.log(fromCache ? "✅ Профиль актуален (кэш)" : "✅ Профиль актуален (сервер подтвердил)");
                currentUserData = freshData;
            }

            const letter = currentUserData.name.charAt(0).toUpperCase();
            avatarLetter.textContent = letter;
            localStorage.setItem("userAvatarLetter", letter);

            if (!observer) {
                initScrollListener();
                loadUserPosts();
            }
        },
        (error) => {
            console.error("Ошибка слушателя профиля:", error);
        }
    );
}

// ========================
// ОБРАБОТКА ?u= ПРОФИЛЯ
// ========================
async function handleURLProfile(user) {
    const ownerUID = await resolveProfileOwner(usernameFromURL);

    if (!ownerUID) {
        showProfileNotFound();
        applyOwnerUI(false);
        return;
    }

    profileOwnerUID = ownerUID;
    isOwnProfile = user ? (user.uid === ownerUID) : false;
    applyOwnerUI(isOwnProfile);

    if (isOwnProfile) {
        localStorage.setItem("currentUserUID", user.uid);

        const cachedProfile = localStorage.getItem(PROFILE_CACHE_KEY);
        if (cachedProfile) {
            try {
                currentUserData = JSON.parse(cachedProfile);
                renderProfile(currentUserData, user.uid);
                renderSocialLinks(currentUserData.socialLinks || []);
                renderStatus(currentUserData.status || "");
                renderInfo(currentUserData.info || {});
                loadYoutubeVideo(currentUserData.youtubeVideoId);
            } catch (e) {
                localStorage.removeItem(PROFILE_CACHE_KEY);
            }
        }

        subscribeToOwnProfile(user);
    } else {
        subscribeToProfileOwner(ownerUID);
    }
}

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
function renderProfile(userData, ownerUID) {
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

    if (userData.createdAt) {
        try {
            const date = userData.createdAt.toDate
                ? userData.createdAt.toDate()
                : new Date(userData.createdAt);
            memberSince.textContent = date.toLocaleDateString("ru-RU", {
                year: "numeric",
                month: "long"
            });
        } catch (e) {
            memberSince.textContent = "—";
        }
    } else if (isOwnProfile && currentUser?.metadata?.creationTime) {
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
    if (!isOwnProfile || !currentUser) return;

    const file = e.target.files?.[0];
    if (!file) return;

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
    if (!isOwnProfile) return;
    window.location.href = "/profile/edit/";
});

// ========================
// ПУБЛИКАЦИЯ ЗАПИСИ
// ========================
attachPhotoBtn?.addEventListener("click", () => {
    postPhotoInput.click();
});

postPhotoInput?.addEventListener("change", (e) => {
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

publishPostBtn?.addEventListener("click", async () => {
    if (!isOwnProfile || !currentUser || !currentUserData) return;

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

        await addDoc(postsCollectionRef, newPostData);

        const userDocRef = doc(db, "users", currentUser.uid);
        await updateDoc(userDocRef, { postsCount: increment(1) });

        currentUserData.postsCount = (currentUserData.postsCount || 0) + 1;
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));

        if (postsCount) postsCount.textContent = currentUserData.postsCount.toString();

        postInput.value = "";
        currentPhotoFile = null;
        postPhotoInput.value = "";
        attachPhotoBtn.textContent = "📷 Фото";
        attachPhotoBtn.style.color = "";

        console.log("✅ Запись опубликована!");
    } catch (error) {
        console.error("Ошибка публикации записи:", error);
        if (uploadedPhotoRef) {
            try { await deleteObject(uploadedPhotoRef); } catch (e) {}
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
function loadUserPosts(isNextPage = false) {
    const targetUID = profileOwnerUID || currentUser?.uid;
    if (!targetUID || isFetching) return;
    if (isNextPage && !hasMore) return;

    isFetching = true;

    if (isNextPage) showLoadingIndicator();

    const postsCollectionRef = collection(db, "users", targetUID, "posts");

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

    const unsubscribe = onSnapshot(
        postsQuery,
        { includeMetadataChanges: false },
        (snapshot) => {
            console.log(`📄 Посты: docs=${snapshot.size}, isNextPage=${isNextPage}`);

            if (!isNextPage) {
                syncPostsFromSnapshot(snapshot);
            } else {
                if (snapshot.empty) {
                    hasMore = false;
                } else {
                    lastVisible = snapshot.docs[snapshot.docs.length - 1];
                    snapshot.forEach((docSnap) => {
                        if (!document.querySelector(`[data-post-id="${docSnap.id}"]`)) {
                            addPostToUI(docSnap.id, docSnap.data(), false);
                        }
                    });
                    if (snapshot.size < POSTS_PER_PAGE) hasMore = false;
                }
            }

            isFetching = false;
            hideLoadingIndicator();

            if (!isOwnProfile) hideDeleteButtons();

            if (!isNextPage && postsList.querySelectorAll('[data-post-id]').length === 0) {
                showEmptyPosts();
            }
        },
        (error) => {
            console.error("Ошибка слушателя постов:", error);
            isFetching = false;
            hideLoadingIndicator();
        }
    );

    if (!isNextPage) {
        if (unsubscribePosts) unsubscribePosts();
        unsubscribePosts = unsubscribe;
    } else {
        postsPageListeners.push(unsubscribe);
    }
}

function syncPostsFromSnapshot(snapshot) {
    const serverIds = new Set(snapshot.docs.map(d => d.id));

    document.querySelectorAll('[data-post-id]').forEach(el => {
        if (!serverIds.has(el.dataset.postId)) el.remove();
    });

    snapshot.docs.forEach((docSnap) => {
        if (!document.querySelector(`[data-post-id="${docSnap.id}"]`)) {
            addPostToUI(docSnap.id, docSnap.data(), false);
        }
    });

    snapshot.docs.forEach((docSnap) => {
        const el = document.querySelector(`[data-post-id="${docSnap.id}"]`);
        if (el) postsList.appendChild(el);
    });

    if (snapshot.docs.length > 0) {
        lastVisible = snapshot.docs[snapshot.docs.length - 1];
    }
    if (snapshot.size < POSTS_PER_PAGE) hasMore = false;
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
    if (indicator) indicator.remove();
}

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

function cleanupAllListeners() {
    if (observer) { observer.disconnect(); observer = null; }
    if (unsubscribeProfile) { unsubscribeProfile(); unsubscribeProfile = null; }
    if (unsubscribePosts) { unsubscribePosts(); unsubscribePosts = null; }
    postsPageListeners.forEach(unsub => unsub());
    postsPageListeners.length = 0;
    console.log("🧹 Все слушатели отключены");
}

window.addEventListener('beforeunload', cleanupAllListeners);

function showEmptyPosts() {
    postsList.innerHTML = `
        <div class="posts-empty">
            <div class="posts-empty-icon">📝</div>
            <div class="posts-empty-text">${isOwnProfile ? 'Здесь пока нет записей. Создайте первую!' : 'У этого пользователя пока нет записей.'}</div>
        </div>
    `;
    if (postsCount) postsCount.textContent = "0";
}

function addPostToUI(postId, post, toTop = false) {
    const postItem = document.createElement("div");
    postItem.className = "post-item";
    postItem.dataset.postId = postId;

    const userName   = post.userName || 'Пользователь';
    const userAvatar = post.userAvatar;
    const letter     = userName.charAt(0).toUpperCase();

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
                const diffMs    = now - date;
                const diffMins  = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMs / 3600000);
                const diffDays  = Math.floor(diffMs / 86400000);

                if (diffMs < 0)        timeStr = "Только что";
                else if (diffMins < 1) timeStr = "Только что";
                else if (diffMins < 60) timeStr = `${diffMins} ${pluralize(diffMins, 'минуту', 'минуты', 'минут')} назад`;
                else if (diffHours < 24) timeStr = `${diffHours} ${pluralize(diffHours, 'час', 'часа', 'часов')} назад`;
                else if (diffDays < 7)  timeStr = `${diffDays} ${pluralize(diffDays, 'день', 'дня', 'дней')} назад`;
                else timeStr = date.toLocaleDateString("ru-RU", {
                    day: 'numeric',
                    month: 'long',
                    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
                });
            }
        } catch (error) {
            console.warn('Ошибка обработки даты поста:', error);
        }
    }

    const avatarHtml = userAvatar
        ? `<img src="${userAvatar}" alt="${userName}" class="post-avatar-img">`
        : letter;

    const deleteBtn = `<button class="post-delete${isOwnProfile ? '' : ' hidden'}" data-post-id="${postId}">Удалить</button>`;

    postItem.innerHTML = `
        <div class="post-header">
            <div class="post-avatar">${avatarHtml}</div>
            <div class="post-info">
                <div class="post-author">${escapeHtml(userName)}</div>
                <div class="post-time">${timeStr}</div>
            </div>
            ${deleteBtn}
        </div>
        ${post.text ? `<div class="post-content">${escapeHtml(post.text)}</div>` : ''}
        ${post.photoUrl ? `<img src="${post.photoUrl}" alt="Post photo" class="post-image" data-photo="${post.photoUrl}">` : ''}
    `;

    if (toTop) {
        postsList.prepend(postItem);
    } else {
        postsList.appendChild(postItem);
    }

    if (isOwnProfile) {
        postItem.querySelector(".post-delete").addEventListener("click", async () => {
            if (!confirm("Удалить эту запись?")) return;
            try {
                if (post.photoPath) {
                    try { await deleteObject(storageRef(storage, post.photoPath)); } catch (e) {}
                } else if (post.photoUrl) {
                    try {
                        const urlParts = post.photoUrl.split('/o/')[1];
                        if (urlParts) {
                            const path = decodeURIComponent(urlParts.split('?')[0]);
                            await deleteObject(storageRef(storage, path));
                        }
                    } catch (e) {}
                }

                await deleteDoc(doc(db, "users", currentUser.uid, "posts", postId));

                const userDocRef = doc(db, "users", currentUser.uid);
                await updateDoc(userDocRef, { postsCount: increment(-1) });

                currentUserData.postsCount = Math.max(0, (currentUserData.postsCount || 1) - 1);
                localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(currentUserData));

                if (postsCount) postsCount.textContent = currentUserData.postsCount.toString();

                console.log("✅ Запись удалена!");
            } catch (error) {
                console.error("Ошибка удаления записи:", error);
                alert("Не удалось удалить запись");
            }
        });
    }

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

// ========================
// УТИЛИТЫ
// ========================
function pluralize(num, one, few, many) {
    const mod10  = num % 10;
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

// ========================
// ПОИСК ПОЛЬЗОВАТЕЛЕЙ
// ========================

const navSearchInput    = document.getElementById("navSearchInput");
const navSearchClear    = document.getElementById("navSearchClear");
const navSearchDropdown = document.getElementById("navSearchDropdown");
const navSearchResults  = document.getElementById("navSearchResults");

let searchDebounceTimer = null;
const SEARCH_DEBOUNCE_MS = 1500;
const SEARCH_MIN_CHARS   = 3;
const SEARCH_LIMIT       = 5;

function showSearchState(icon, text) {
    navSearchResults.innerHTML = `
        <div class="nav-search-state">
            <div class="nav-search-state-icon">${icon}</div>
            <span>${text}</span>
        </div>
    `;
}

function showSearchLoading() {
    navSearchResults.innerHTML = `
        <div class="nav-search-state">
            <div class="nav-search-spinner"></div>
            <span>Поиск...</span>
        </div>
    `;
}

function highlightMatch(text, q) {
    if (!q || !text) return escapeSearch(text);
    const lower = text.toLowerCase();
    const ql    = q.toLowerCase();
    if (lower.startsWith(ql)) {
        return `<mark>${escapeSearch(text.slice(0, ql.length))}</mark>${escapeSearch(text.slice(ql.length))}`;
    }
    return escapeSearch(text);
}

function escapeSearch(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function renderSearchResults(users, input) {
    if (users.length === 0) {
        showSearchState("🔍", "Пользователи не найдены");
        return;
    }

    navSearchResults.innerHTML = users.map(user => {
        const name   = user.name || "Пользователь";
        const uid    = user.usernameID || "";
        const letter = name.charAt(0).toUpperCase();

        const avatarHtml = user.avatarUrl
            ? `<img src="${escapeSearch(user.avatarUrl)}" alt="${escapeSearch(name)}" loading="lazy">`
            : letter;

        return `
            <a href="/profile/?u=${encodeURIComponent(uid)}" class="nav-search-result">
                <div class="nav-search-result-avatar">${avatarHtml}</div>
                <div class="nav-search-result-info">
                    <div class="nav-search-result-name">${escapeSearch(name)}</div>
                    <div class="nav-search-result-id">@${highlightMatch(uid, input)}</div>
                </div>
                <div class="nav-search-result-arrow">
                    <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 3L11 8L6 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
            </a>
        `;
    }).join("");
}

async function performSearch(rawInput) {
    const input = rawInput.trim().toLowerCase();
    if (input.length < SEARCH_MIN_CHARS) return;

    showSearchLoading();

    try {
        const usersRef = collection(db, "users");
        const q = query(
            usersRef,
            where("usernameID", ">=", input),
            where("usernameID", "<=", input + "\uf8ff"),
            limit(SEARCH_LIMIT)
        );

        const snapshot = await getDocs(q);
        const users = [];
        snapshot.forEach(docSnap => users.push({ id: docSnap.id, ...docSnap.data() }));

        renderSearchResults(users, input);
        console.log(`🔍 Поиск "${input}": ${users.length} результатов`);
    } catch (error) {
        console.error("Ошибка поиска:", error);
        showSearchState("⚠️", "Ошибка поиска. Попробуйте снова");
    }
}

function openDropdown() {
    navSearchDropdown.classList.remove("hidden");
}

function closeDropdown() {
    navSearchDropdown.classList.add("hidden");
    clearTimeout(searchDebounceTimer);
}

if (navSearchInput) {
    navSearchInput.addEventListener("input", (e) => {
        const val = e.target.value;

        navSearchClear.classList.toggle("hidden", val.length === 0);

        clearTimeout(searchDebounceTimer);

        if (val.trim().length === 0) {
            closeDropdown();
            return;
        }

        // Всегда открываем дропдаун и показываем спиннер
        openDropdown();
        showSearchLoading();

        if (val.trim().length < SEARCH_MIN_CHARS) {
            // Меньше 3 символов — спиннер на 600мс, потом пусто
            searchDebounceTimer = setTimeout(() => {
                navSearchResults.innerHTML = "";
            }, 600);
            return;
        }

        // 3+ символов — дебаунс, потом запрос
        searchDebounceTimer = setTimeout(() => performSearch(val), SEARCH_DEBOUNCE_MS);
    });

    navSearchClear.addEventListener("click", () => {
        navSearchInput.value = "";
        navSearchClear.classList.add("hidden");
        closeDropdown();
        navSearchInput.focus();
    });

    navSearchInput.addEventListener("focus", (e) => {
        if (e.target.value.trim().length > 0) {
            openDropdown();
            showSearchLoading();
            if (e.target.value.trim().length >= SEARCH_MIN_CHARS) {
                searchDebounceTimer = setTimeout(() => performSearch(e.target.value), SEARCH_DEBOUNCE_MS);
            }
        }
    });

    navSearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeDropdown();
            navSearchInput.blur();
        }
    });

    document.addEventListener("click", (e) => {
        const navSearch = document.getElementById("navSearch");
        if (navSearch && !navSearch.contains(e.target)) closeDropdown();
    });
}
