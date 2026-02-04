document.addEventListener('DOMContentLoaded', function() {
    const leftColumn = document.querySelector('.left-column');
    if (!leftColumn) return;

    let lastScrollTop = window.pageYOffset;
    
    function updateSticky() {
        const scrollTop = window.pageYOffset;
        const viewportHeight = window.innerHeight;
        const columnHeight = leftColumn.offsetHeight;
        const containerRect = leftColumn.parentElement.getBoundingClientRect();
        
        // Направление скролла
        const scrollingDown = scrollTop > lastScrollTop;
        
        // Если колонка меньше экрана — просто вешаем обычный sticky top
        if (columnHeight <= viewportHeight - 48) {
            leftColumn.classList.add('sticky-top');
            leftColumn.classList.remove('sticky-bottom');
        } else {
            // ЛОГИКА ДЛЯ ВЫСОКОЙ КОЛОНКИ
            const rect = leftColumn.getBoundingClientRect();

            if (scrollingDown) {
                // Если скроллим вниз и достигли низа колонки
                if (rect.bottom <= viewportHeight - 24) {
                    leftColumn.classList.add('sticky-bottom');
                    leftColumn.classList.remove('sticky-top');
                    leftColumn.style.top = 'auto';
                } else {
                    // Пока не дошли до низа, колонка должна скроллиться как обычно
                    // Для этого фиксируем её текущее положение относительно родителя
                    if (leftColumn.classList.contains('sticky-top')) {
                        const topOffset = rect.top - containerRect.top;
                        leftColumn.classList.remove('sticky-top');
                        leftColumn.style.position = 'relative';
                        leftColumn.style.top = topOffset + 'px';
                    }
                }
            } else {
                // Если скроллим вверх и достигли верха колонки
                if (rect.top >= 24) {
                    leftColumn.classList.add('sticky-top');
                    leftColumn.classList.remove('sticky-bottom');
                    leftColumn.style.top = '24px';
                } else {
                    // Пока не дошли до верха, фиксируем положение
                    if (leftColumn.classList.contains('sticky-bottom')) {
                        const topOffset = rect.top - containerRect.top;
                        leftColumn.classList.remove('sticky-bottom');
                        leftColumn.style.position = 'relative';
                        leftColumn.style.top = topOffset + 'px';
                    }
                }
            }
        }
        
        lastScrollTop = scrollTop;
    }

    // Оптимизация скролла
    window.addEventListener('scroll', updateSticky, { passive: true });
    window.addEventListener('resize', updateSticky);
    
    // Первичный запуск
    setTimeout(updateSticky, 100);
});
