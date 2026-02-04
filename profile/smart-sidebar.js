/**
 * Умная боковая панель с поведением как в Facebook
 * - Если панель короче экрана: фиксируется сверху
 * - Если панель длиннее экрана: прилипает к верху при скролле вверх и к низу при скролле вниз
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
    }

    handleResize() {
        // Сбрасываем состояние при изменении размера окна
        this.currentPosition = 'static';
        this.wrapper.style.cssText = '';
        this.update();
    }

    update() {
        const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
        
        // Определяем направление скролла
        const previousDirection = this.scrollDirection;
        if (currentScroll > this.lastScrollTop && currentScroll > 0) {
            this.scrollDirection = 'down';
        } else if (currentScroll < this.lastScrollTop) {
            this.scrollDirection = 'up';
        }

        // Запоминаем текущую позицию wrapper'а при смене направления
        if (previousDirection !== this.scrollDirection && this.currentPosition === 'static') {
            this.offsetWhenFixed = this.wrapper.getBoundingClientRect().top - this.container.getBoundingClientRect().top;
        }

        this.lastScrollTop = currentScroll;

        const viewportHeight = window.innerHeight;
        const sidebarHeight = this.wrapper.offsetHeight;
        const containerRect = this.container.getBoundingClientRect();
        const wrapperRect = this.wrapper.getBoundingClientRect();

        // Если панель помещается в экран
        if (sidebarHeight <= viewportHeight - 84) { // 60px navbar + 24px gap
            this.handleShortSidebar(containerRect, wrapperRect, sidebarHeight);
        } else {
            // Если панель длиннее экрана
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

        // Получаем текущие координаты
        const wrapperTop = wrapperRect.top;
        const wrapperBottom = wrapperRect.bottom;
        const containerTop = containerRect.top;
        const containerBottom = containerRect.bottom;

        // СКРОЛЛ ВНИЗ
        if (this.scrollDirection === 'down') {
            // Если мы в static режиме и низ панели достиг низа экрана
            if (this.currentPosition === 'static' && wrapperBottom <= viewportHeight) {
                // Запоминаем текущий offset и фиксируем низ
                this.offsetWhenFixed = this.wrapper.getBoundingClientRect().top - containerRect.top;
                
                this.setPosition('fixed-bottom', {
                    position: 'fixed',
                    top: 'auto',
                    bottom: '0',
                    width: `${this.sidebar.offsetWidth}px`,
                    left: `${this.sidebar.getBoundingClientRect().left}px`
                });
            }
            // Если зафиксированы по верху, снимаем фиксацию когда верх доходит до topOffset
            else if (this.currentPosition === 'fixed-top' && wrapperTop <= topOffset) {
                // Переходим в static с сохранением позиции
                const currentOffset = this.wrapper.getBoundingClientRect().top - containerRect.top;
                this.setPosition('static', {
                    position: 'absolute',
                    top: `${currentOffset}px`,
                    bottom: 'auto',
                    width: '',
                    left: '0'
                });
            }
            // Если зафиксированы по низу и низ контейнера поднялся выше низа экрана
            else if (this.currentPosition === 'fixed-bottom' && containerBottom <= viewportHeight) {
                // Прижимаем к низу контейнера
                this.setPosition('absolute-bottom', {
                    position: 'absolute',
                    top: `${containerRect.height - sidebarHeight}px`,
                    bottom: 'auto',
                    width: '',
                    left: '0'
                });
            }
        }

        // СКРОЛЛ ВВЕРХ
        if (this.scrollDirection === 'up') {
            // Если мы в static режиме и верх панели достиг topOffset
            if (this.currentPosition === 'static' && wrapperTop >= topOffset && containerTop < topOffset) {
                // Запоминаем текущий offset и фиксируем верх
                this.offsetWhenFixed = this.wrapper.getBoundingClientRect().top - containerRect.top;
                
                this.setPosition('fixed-top', {
                    position: 'fixed',
                    top: `${topOffset}px`,
                    bottom: 'auto',
                    width: `${this.sidebar.offsetWidth}px`,
                    left: `${this.sidebar.getBoundingClientRect().left}px`
                });
            }
            // Если зафиксированы по низу, снимаем фиксацию когда низ доходит до низа экрана
            else if (this.currentPosition === 'fixed-bottom' && wrapperBottom >= viewportHeight) {
                // Переходим в static с сохранением позиции
                const currentOffset = this.wrapper.getBoundingClientRect().top - containerRect.top;
                this.setPosition('static', {
                    position: 'absolute',
                    top: `${currentOffset}px`,
                    bottom: 'auto',
                    width: '',
                    left: '0'
                });
            }
            // Если зафиксированы по верху и верх контейнера опустился ниже topOffset
            else if (this.currentPosition === 'fixed-top' && containerTop >= topOffset) {
                // Возвращаем в начало контейнера
                this.setPosition('static', {
                    position: '',
                    top: '',
                    bottom: '',
                    width: '',
                    left: ''
                });
            }
            // Если в absolute-bottom и можем вернуться к скроллу
            else if (this.currentPosition === 'absolute-bottom' && containerBottom > viewportHeight) {
                // Возвращаем в static с позицией у низа контейнера
                this.setPosition('static', {
                    position: 'absolute',
                    top: `${containerRect.height - sidebarHeight}px`,
                    bottom: 'auto',
                    width: '',
                    left: '0'
                });
            }
        }

        // Проверка граничных условий
        // Если панель вышла за верхнюю границу контейнера
        if ((this.currentPosition === 'fixed-top' || this.currentPosition === 'fixed-bottom') && containerTop > topOffset) {
            this.setPosition('static', {
                position: '',
                top: '',
                bottom: '',
                width: '',
                left: ''
            });
        }

        // Если панель вышла за нижнюю границу контейнера
        if ((this.currentPosition === 'fixed-top' || this.currentPosition === 'fixed-bottom') && containerBottom < viewportHeight) {
            this.setPosition('absolute-bottom', {
                position: 'absolute',
                top: `${containerRect.height - sidebarHeight}px`,
                bottom: 'auto',
                width: '',
                left: '0'
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
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const smartSidebar = new SmartSidebar('.left-column');
});
