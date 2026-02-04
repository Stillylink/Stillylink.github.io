document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.left-column');
    if (!sidebar) return;

    let lastScrollY = window.pageYOffset;
    let sidebarMode = 'static'; // 'top', 'bottom', 'static'

    function updateSticky() {
        const viewportHeight = window.innerHeight;
        const sidebarRect = sidebar.getBoundingClientRect();
        const sidebarHeight = sidebarRect.height;
        const scrollY = window.pageYOffset;
        const scrollingDown = scrollY > lastScrollY;

        // Если колонка целиком влезает в экран
        if (sidebarHeight <= viewportHeight - 48) {
            sidebar.style.position = 'sticky';
            sidebar.style.top = '24px';
            sidebar.style.bottom = 'auto';
            lastScrollY = scrollY;
            return;
        }

        // Если колонка БОЛЬШЕ экрана
        if (scrollingDown) {
            // СКРОЛЛИМ ВНИЗ
            if (sidebarMode === 'top') {
                // Если мы были приклеены к верху и начали скроллить вниз — "отлипаем"
                const topOffset = sidebarRect.top + scrollY - sidebar.parentElement.offsetTop;
                sidebar.style.position = 'relative';
                sidebar.style.top = `${topOffset}px`;
                sidebar.style.bottom = 'auto';
                sidebarMode = 'static';
            } else if (sidebarRect.bottom <= viewportHeight - 24) {
                // Если низ колонки показался внизу экрана — "прилипаем" к низу
                sidebar.style.position = 'sticky';
                sidebar.style.top = 'auto';
                sidebar.style.bottom = '24px';
                sidebarMode = 'bottom';
            }
        } else {
            // СКРОЛЛИМ ВВЕРХ
            if (sidebarMode === 'bottom') {
                // Если мы были приклеены к низу и начали скроллить вверх — "отлипаем"
                const topOffset = sidebarRect.top + scrollY - sidebar.parentElement.offsetTop;
                sidebar.style.position = 'relative';
                sidebar.style.top = `${topOffset}px`;
                sidebar.style.bottom = 'auto';
                sidebarMode = 'static';
            } else if (sidebarRect.top >= 24) {
                // Если верх колонки показался вверху экрана — "прилипаем" к верху
                sidebar.style.position = 'sticky';
                sidebar.style.top = '24px';
                sidebar.style.bottom = 'auto';
                sidebarMode = 'top';
            }
        }

        lastScrollY = scrollY;
    }

    // Слушаем скролл с пассивным режимом для плавности
    window.addEventListener('scroll', updateSticky, { passive: true });

    // ЭТО РЕШИТ ПРОБЛЕМУ С FIREBASE:
    // Следим за изменением высоты колонки и всей сетки
    const ro = new ResizeObserver(() => {
        updateSticky();
    });

    ro.observe(sidebar);
    ro.observe(document.querySelector('.content-grid'));

    // Первичный запуск после загрузки данных
    setTimeout(updateSticky, 500);
});
