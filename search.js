/**
 * Поиск пользователей — универсальный модуль для всех страниц
 * - Показывается только авторизованным пользователям
 * - Подключать как type="module"
 */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    limit,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// ========================
// FIREBASE
// ========================
const firebaseConfig = {
    apiKey: "AIzaSyBWlR4QWdnbqXLKKaftEAzhXneTmV9xXX0",
    authDomain: "stillylink-f1d0f.firebaseapp.com",
    projectId: "stillylink-f1d0f",
    storageBucket: "stillylink-f1d0f.appspot.com",
    messagingSenderId: "772070114710",
    appId: "1:772070114710:web:939bce83e4d3be14bdc9b7"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ========================
// DOM
// ========================
const navSearch         = document.getElementById("navSearch");
const navSearchInput    = document.getElementById("navSearchInput");
const navSearchClear    = document.getElementById("navSearchClear");
const navSearchDropdown = document.getElementById("navSearchDropdown");
const navSearchResults  = document.getElementById("navSearchResults");

if (!navSearch || !navSearchInput) {
    throw new Error("search.js: элементы поиска не найдены");
}

// Скрываем поиск по умолчанию — покажем только после проверки авторизации
navSearch.style.display = 'none';

// ========================
// АВТОРИЗАЦИЯ
// ========================
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Авторизован — показываем поиск
        navSearch.style.display = 'flex';
        initSearch();
    } else {
        // Гость — скрываем поиск
        navSearch.style.display = 'none';
    }
});

// ========================
// НАСТРОЙКИ
// ========================
const SEARCH_DEBOUNCE_MS = 1500;
const SEARCH_MIN_CHARS   = 3;
const SEARCH_LIMIT       = 5;

let searchDebounceTimer = null;
let searchInitialized   = false;

// ========================
// УТИЛИТЫ
// ========================
function escapeSearch(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
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

// ========================
// ИНИЦИАЛИЗАЦИЯ СОБЫТИЙ (один раз)
// ========================
function initSearch() {
    if (searchInitialized) return;
    searchInitialized = true;

    navSearchInput.addEventListener("input", (e) => {
        const val = e.target.value;

        navSearchClear.classList.toggle("hidden", val.length === 0);
        clearTimeout(searchDebounceTimer);

        if (val.trim().length === 0) {
            closeDropdown();
            return;
        }

        openDropdown();
        showSearchLoading();

        if (val.trim().length < SEARCH_MIN_CHARS) {
            searchDebounceTimer = setTimeout(() => {
                navSearchResults.innerHTML = "";
            }, 600);
            return;
        }

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
        if (!navSearch.contains(e.target)) closeDropdown();
    });
}
