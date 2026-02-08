/**
 * Умная боковая панель с поведением как в Facebook
 * - Если панель короче экрана: фиксируется сверху
 * - Если панель длиннее экрана: прилипает к верху при скролле вверх и к низу при скролле вниз
 * - ResizeObserver следит за изменением высоты правой колонки
 */

class SmartSidebar {
    constructor(sidebarSelector) {
        this.sidebar = document.querySelector(sidebarSelector);
        if (!this.sidebar) return;

        this.container = this.sidebar.closest('.content-grid');
        if (!this.container) return;

        this.lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        this.scrollDirection = 'down';
        this.currentPosition = 'static'; // 'static', 'fixed-top', 'fixed-bottom', 'absolute-bottom'
        this.offsetWhenFixed = 0; // Запоминаем offset когда становимся fixed
        this.isResizing = false; // Флаг для предотвращения конфликтов
        
        this.init();
    }

    init() {
        // Обернем содержимое в wrapper для управления позиционированием
        const wrapper = document.createElement('div');
        wrapper.className = 'sidebar-sticky-wrapper';
        
        // Переносим все содержимое в wrapper
        while (this.sidebar.firstChild) {
            wrapper.appendChild(this.sidebar.firstChild);
        }
        
        this.sidebar.appendChild(wrapper);
        this.wrapper = wrapper;

        // Начальная установка
        this.update();

        // Слушатели событий с debounce для производительности
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    this.update();
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        window.addEventListener('resize', this.handleResize.bind(this));

        // 🔥 НОВОЕ: ResizeObserver для отслеживания изменений высоты правой колонки
        this.setupResizeObserver();
    }

    setupResizeObserver() {
        const rightColumn = this.container.querySelector('.wall-section');
        if (!rightColumn) return;

        // Создаем ResizeObserver для правой колонки
        this.resizeObserver = new ResizeObserver(entries => {
            // Когда высота правой колонки меняется, пересчитываем позицию
            this.handleContentResize();
        });

        // Начинаем наблюдение за правой колонкой
        this.resizeObserver.observe(rightColumn);
    }

    handleContentResize() {
        // Устанавливаем флаг, что идет resize
        this.isResizing = true;
        
        const sidebarHeight = this.wrapper.offsetHeight;
        const rightColumn = this.container.querySelector('.wall-section');
        const rightColumnHeight = rightColumn ? rightColumn.offsetHeight : 0;
        
        // 1. Если сайдбар стал длиннее или равен контенту — возвращаем в поток
        if (sidebarHeight >= rightColumnHeight) {
            this.currentPosition = 'static';
            Object.assign(this.wrapper.style, {
                position: '',
                top: '',
                bottom: '',
                width: '',
                left: ''
            });
            this.isResizing = false;
            return; 
        }
        
        // 2. Если мы были прижаты к низу (absolute-bottom)
        if (this.currentPosition === 'absolute-bottom') {
            const maxAbsoluteTop = this.container.offsetHeight - sidebarHeight;
            const currentTopValue = parseInt(this.wrapper.style.top) || 0;
            
            // Если из-за удаления поста контейнер стал короче
            if (currentTopValue > maxAbsoluteTop) {
                // Просто подтягиваем панель выше, не меняя position
                this.wrapper.style.top = `${Math.max(0, maxAbsoluteTop)}px`;
            }
        }
        
        // 3. Для fixed-top и fixed-bottom просто корректируем, если нужно
        // НЕ вызываем update(), чтобы не было конфликта направления скролла
        
        this.isResizing = false;
    }

    handleResize() {
        // Сбрасываем состояние при изменении размера окна
        this.currentPosition = 'static';
        this.wrapper.style.cssText = '';
        this.update();
    }

    update() {
        // Если сейчас идет обработка resize, пропускаем update
        if (this.isResizing) return;
        
        const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
        const viewportHeight = window.innerHeight;
        const sidebarHeight = this.wrapper.offsetHeight;
        
        // 1. Находим правую колонку (стену), чтобы сравнить высоту
        const rightColumn = this.container.querySelector('.wall-section');
        const rightColumnHeight = rightColumn ? rightColumn.offsetHeight : 0;

        // 2. БАГФИКС: Если левая панель длиннее или равна правой, 
        // нам НЕЛЬЗЯ включать sticky, иначе будет "прыжок" у футера.
        if (sidebarHeight >= rightColumnHeight) {
            this.setPosition('static', {
                position: '',
                top: '',
                bottom: '',
                width: '',
                left: ''
            });
            return; // Просто выходим, ничего не фиксируем
        }

        // --- Дальше идет стандартный код определения направления ---
        const previousDirection = this.scrollDirection;
        if (currentScroll > this.lastScrollTop && currentScroll > 0) {
            this.scrollDirection = 'down';
        } else if (currentScroll < this.lastScrollTop) {
            this.scrollDirection = 'up';
        }

        if (previousDirection !== this.scrollDirection && this.currentPosition === 'static') {
            this.offsetWhenFixed = this.wrapper.getBoundingClientRect().top - this.container.getBoundingClientRect().top;
        }

        this.lastScrollTop = currentScroll;

        const containerRect = this.container.getBoundingClientRect();
        const wrapperRect = this.wrapper.getBoundingClientRect();

        // Логика фиксации
        if (sidebarHeight <= viewportHeight - 84) {
            this.handleShortSidebar(containerRect, wrapperRect, sidebarHeight);
        } else {
            this.handleLongSidebar(containerRect, wrapperRect, viewportHeight, sidebarHeight);
        }
    }

    handleShortSidebar(containerRect, wrapperRect, sidebarHeight) {
        const navbarHeight = 60;
        const gap = 24;
        const topOffset = navbarHeight + gap;

        // Проверяем, достиг ли контейнер верхнего порога
        if (containerRect.top <= topOffset) {
            // Проверяем, не вышли ли мы за нижнюю границу контейнера
            const maxTop = containerRect.bottom - sidebarHeight;
            
            if (maxTop <= topOffset) {
                // Прижимаем к низу контейнера (absolute)
                this.setPosition('absolute-bottom', {
                    position: 'absolute',
                    top: `${containerRect.height - sidebarHeight}px`,
                    bottom: 'auto',
                    width: `${this.sidebar.offsetWidth}px`,
                    left: '0'
                });
            } else {
                // Фиксируем сверху
                this.setPosition('fixed-top', {
                    position: 'fixed',
                    top: `${topOffset}px`,
                    bottom: 'auto',
                    width: `${this.sidebar.offsetWidth}px`,
                    left: `${this.sidebar.getBoundingClientRect().left}px`
                });
            }
        } else {
            // Возвращаем в обычное состояние
            this.setPosition('static', {
                position: '',
                top: '',
                bottom: '',
                width: '',
                left: ''
            });
        }
    }

    handleLongSidebar(containerRect, wrapperRect, viewportHeight, sidebarHeight) {
        const navbarHeight = 60;
        const gap = 24;
        const topOffset = navbarHeight + gap;
        const bottomGap = 24; 

        const wrapperTop = wrapperRect.top;
        const wrapperBottom = wrapperRect.bottom;
        const containerTop = containerRect.top;
        const containerBottom = containerRect.bottom;

        const maxAbsoluteTop = this.container.offsetHeight - sidebarHeight;

        // СКРОЛЛ ВНИЗ
        if (this.scrollDirection === 'down') {
            // 1. Если мы были фиксированы сверху, при скролле вниз "отклеиваемся" в static (absolute)
            if (this.currentPosition === 'fixed-top') {
                const currentTop = wrapperTop + window.pageYOffset - containerRect.top - window.pageYOffset;
                this.setPosition('static', {
                    position: 'absolute',
                    top: `${Math.max(0, currentTop)}px`,
                    bottom: 'auto',
                    width: `${this.sidebar.offsetWidth}px`,
                    left: '0'
                });
            } 
            // 2. Фиксируемся по НИЖНЕМУ краю, только когда низ панели коснулся низа экрана
            // НО при условии, что мы еще не доехали до конца контейнера
            else if (this.currentPosition === 'static' && wrapperBottom <= viewportHeight - bottomGap) {
                // Если до дна контейнера еще есть место
                if (containerBottom > viewportHeight - bottomGap) {
                    this.setPosition('fixed-bottom', {
                        position: 'fixed',
                        top: 'auto',
                        bottom: `${bottomGap}px`,
                        width: `${this.sidebar.offsetWidth}px`,
                        left: `${this.sidebar.getBoundingClientRect().left}px`
                    });
                }
            }
            // 3. Если мы фиксированы по низу, но уперлись в футер (конец контейнера)
            if (this.currentPosition === 'fixed-bottom' && containerBottom <= viewportHeight - bottomGap) {
                this.setPosition('absolute-bottom', {
                    position: 'absolute',
                    top: `${maxAbsoluteTop}px`,
                    bottom: 'auto',
                    width: `${this.sidebar.offsetWidth}px`,
                    left: '0'
                });
            }
        }

        // СКРОЛЛ ВВЕРХ
        if (this.scrollDirection === 'up') {
            // 1. Если были фиксированы снизу или стояли у футера — "отклеиваемся" в static
            if (this.currentPosition === 'fixed-bottom' || this.currentPosition === 'absolute-bottom') {
                const currentTop = wrapperTop + window.pageYOffset - containerRect.top - window.pageYOffset;
                this.setPosition('static', {
                    position: 'absolute',
                    top: `${Math.max(0, currentTop)}px`,
                    bottom: 'auto',
                    width: `${this.sidebar.offsetWidth}px`,
                    left: '0'
                });
            }
            // 2. Фиксируемся по ВЕРХНЕМУ краю, когда верх панели коснулся верха экрана
            else if (this.currentPosition === 'static' && wrapperTop >= topOffset) {
                if (containerTop < topOffset) {
                    this.setPosition('fixed-top', {
                        position: 'fixed',
                        top: `${topOffset}px`,
                        bottom: 'auto',
                        width: `${this.sidebar.offsetWidth}px`,
                        left: `${this.sidebar.getBoundingClientRect().left}px`
                    });
                }
            }
        }

        // Крайний случай: если скроллим очень быстро и пролетели момент статики
        if (containerTop >= topOffset) {
            this.setPosition('static', {
                position: '', top: '', bottom: '', width: '', left: ''
            });
        }
    }

    setPosition(newPosition, styles) {
        if (this.currentPosition === newPosition) return;
        
        this.currentPosition = newPosition;
        
        // Применяем стили
        Object.keys(styles).forEach(key => {
            this.wrapper.style[key] = styles[key];
        });
    }

    // Метод для очистки наблюдателя при уничтожении
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const smartSidebar = new SmartSidebar('.left-column');
});
