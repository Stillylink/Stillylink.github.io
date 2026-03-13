/**
 * Переключатель вкладок правой колонки профиля
 * - Анимация смаха как в TikTok (slide left/right)
 * - Поддержка свайпа пальцем / зажатой мышью
 * - Легко расширяется новыми вкладками
 */

class ProfileTabs {
    constructor() {
        this.wallSection = document.querySelector('.wall-section');
        if (!this.wallSection) return;

        // Текущая активная вкладка
        this.activeTab = 'posts';

        // Порог свайпа в пикселях
        this.SWIPE_THRESHOLD = 60;

        // Состояние свайпа
        this.swipe = {
            startX: 0,
            startY: 0,
            active: false,
            isDragging: false
        };

        this.init();
    }

    init() {
        this.buildTabBar();
        this.buildPanels();
        this.bindSwipe();
    }

    // ========================
    // ПОСТРОЕНИЕ СТРУКТУРЫ
    // ========================

    buildTabBar() {
        // Таб-бар вставляем как отдельную карточку ПЕРЕД .wall-section
        this.tabBar = document.createElement('div');
        this.tabBar.className = 'profile-tabs-bar';
        this.tabBar.innerHTML = `
            <button class="profile-tab active" data-tab="posts">Записи</button>
            <button class="profile-tab" data-tab="questions">Вопросы</button>
            <div class="profile-tabs-indicator"></div>
        `;

        this.wallSection.parentNode.insertBefore(this.tabBar, this.wallSection);

        this.indicator = this.tabBar.querySelector('.profile-tabs-indicator');

        // Клики по кнопкам
        this.tabBar.querySelectorAll('.profile-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                if (tab !== this.activeTab) {
                    const direction = tab === 'questions' ? 'left' : 'right';
                    this.switchTab(tab, direction);
                }
            });
        });

        // Начальное положение индикатора
        this.updateIndicator(false);
    }

    buildPanels() {
        // Обёртка для анимируемых панелей
        this.viewport = document.createElement('div');
        this.viewport.className = 'profile-tabs-viewport';

        // Панель «Записи» — переносим в неё всё что было в .wall-section
        // (кроме самого таб-бара, который уже вставлен)
        this.postsPanel = document.createElement('div');
        this.postsPanel.className = 'profile-tab-panel active';
        this.postsPanel.dataset.panel = 'posts';

        // Переносим оригинальное содержимое (.wall-header, .post-composer, .posts-list, sentinel)
        const children = Array.from(this.wallSection.children).filter(
            el => !el.classList.contains('profile-tabs-bar')
        );
        children.forEach(el => this.postsPanel.appendChild(el));

        // Панель «Вопросы» — пока пустая заглушка
        this.questionsPanel = document.createElement('div');
        this.questionsPanel.className = 'profile-tab-panel';
        this.questionsPanel.dataset.panel = 'questions';
        this.questionsPanel.innerHTML = `
            <div class="tab-placeholder">
                <div class="tab-placeholder-icon">❓</div>
                <div class="tab-placeholder-text">Вопросы появятся здесь</div>
            </div>
        `;

        this.viewport.appendChild(this.postsPanel);
        this.viewport.appendChild(this.questionsPanel);
        this.wallSection.appendChild(this.viewport);
    }

    // ========================
    // ПЕРЕКЛЮЧЕНИЕ ВКЛАДКИ
    // ========================

    switchTab(tab, direction) {
        if (tab === this.activeTab) return;

        const leaving  = this.getPanelByTab(this.activeTab);
        const entering = this.getPanelByTab(tab);

        // Обновляем кнопки
        this.tabBar.querySelectorAll('.profile-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Позиционируем входящую панель за кадром
        const enterFrom = direction === 'left' ? '100%' : '-100%';
        const leaveTo   = direction === 'left' ? '-100%' : '100%';

        entering.style.transform = `translateX(${enterFrom})`;
        entering.style.transition = 'none';
        entering.classList.add('active');

        // Форсируем reflow чтобы transition сработал
        entering.getBoundingClientRect();

        // Запускаем анимацию
        const duration = '280ms';
        const easing   = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';

        leaving.style.transition  = `transform ${duration} ${easing}`;
        entering.style.transition = `transform ${duration} ${easing}`;

        leaving.style.transform  = `translateX(${leaveTo})`;
        entering.style.transform = 'translateX(0)';

        leaving.addEventListener('transitionend', () => {
            leaving.classList.remove('active');
            leaving.style.transform  = '';
            leaving.style.transition = '';
            entering.style.transition = '';
        }, { once: true });

        this.activeTab = tab;
        this.updateIndicator(true);
    }

    getPanelByTab(tab) {
        return tab === 'posts' ? this.postsPanel : this.questionsPanel;
    }

    // ========================
    // ИНДИКАТОР (ПОЛОСКА)
    // ========================

    updateIndicator(animate) {
        const activeBtn = this.tabBar.querySelector(`.profile-tab[data-tab="${this.activeTab}"]`);
        if (!activeBtn || !this.indicator) return;

        this.indicator.style.transition = animate
            ? 'left 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94), width 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            : 'none';

        this.indicator.style.left  = `${activeBtn.offsetLeft}px`;
        this.indicator.style.width = `${activeBtn.offsetWidth}px`;
    }

    // ========================
    // СВАЙП (touch + mouse)
    // ========================

    bindSwipe() {
        const el = this.wallSection;

        // Touch
        el.addEventListener('touchstart', e => this.onSwipeStart(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
        el.addEventListener('touchmove',  e => this.onSwipeMove(e.touches[0].clientX, e.touches[0].clientY),  { passive: true });
        el.addEventListener('touchend',   () => this.onSwipeEnd());

        // Mouse (зажатая кнопка)
        el.addEventListener('mousedown', e => {
            // Только левая кнопка, не по интерактивным элементам
            if (e.button !== 0) return;
            if (e.target.closest('button, input, textarea, a, .post-delete, label')) return;
            this.onSwipeStart(e.clientX, e.clientY);
        });

        window.addEventListener('mousemove', e => {
            if (!this.swipe.active) return;
            this.onSwipeMove(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', () => {
            if (!this.swipe.active) return;
            this.onSwipeEnd();
        });
    }

    onSwipeStart(x, y) {
        this.swipe.startX    = x;
        this.swipe.startY    = y;
        this.swipe.active    = true;
        this.swipe.isDragging = false;
    }

    onSwipeMove(x, y) {
        if (!this.swipe.active) return;
        const dx = x - this.swipe.startX;
        const dy = y - this.swipe.startY;

        // Если вертикальный скролл — не перехватываем
        if (!this.swipe.isDragging && Math.abs(dy) > Math.abs(dx)) {
            this.swipe.active = false;
            return;
        }

        if (Math.abs(dx) > 8) {
            this.swipe.isDragging = true;
        }
    }

    onSwipeEnd() {
        if (!this.swipe.active || !this.swipe.isDragging) {
            this.swipe.active = false;
            this.swipe.isDragging = false;
            return;
        }

        const dx = (window.lastMouseX ?? this.swipe.startX) - this.swipe.startX;

        // Для touch используем финальное значение, для mouse — уже есть
        const finalDx = this._lastSwipeX !== undefined
            ? this._lastSwipeX - this.swipe.startX
            : dx;

        this.swipe.active    = false;
        this.swipe.isDragging = false;
        this._lastSwipeX = undefined;

        if (finalDx < -this.SWIPE_THRESHOLD && this.activeTab === 'posts') {
            this.switchTab('questions', 'left');
        } else if (finalDx > this.SWIPE_THRESHOLD && this.activeTab === 'questions') {
            this.switchTab('posts', 'right');
        }
    }

    bindSwipe() {
        const el = this.wallSection;
        let lastX = 0;

        // Touch
        el.addEventListener('touchstart', e => {
            this.onSwipeStart(e.touches[0].clientX, e.touches[0].clientY);
            lastX = e.touches[0].clientX;
        }, { passive: true });

        el.addEventListener('touchmove', e => {
            lastX = e.touches[0].clientX;
            this.onSwipeMove(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });

        el.addEventListener('touchend', () => {
            this._lastSwipeX = lastX;
            this.onSwipeEnd();
        });

        // Mouse
        el.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            if (e.target.closest('button, input, textarea, a, .post-delete, label')) return;
            lastX = e.clientX;
            this.onSwipeStart(e.clientX, e.clientY);
        });

        window.addEventListener('mousemove', e => {
            if (!this.swipe.active) return;
            lastX = e.clientX;
            this.onSwipeMove(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', () => {
            if (!this.swipe.active) return;
            this._lastSwipeX = lastX;
            this.onSwipeEnd();
        });
    }
}

// ========================
// ИНИЦИАЛИЗАЦИЯ
// ========================

document.addEventListener('DOMContentLoaded', () => {
    new ProfileTabs();
});
