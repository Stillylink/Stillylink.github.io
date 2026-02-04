/**
 * Умное sticky-позиционирование для левой колонки профиля
 */

document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  const leftColumn = document.querySelector('.left-column');
  
  if (!leftColumn) {
    console.warn('Left column not found');
    return;
  }

  let lastScrollTop = 0;
  let scrollDirection = 'down';
  let stickyState = 'none';

  function updateStickyBehavior() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Определяем направление скролла
    if (scrollTop > lastScrollTop) {
      scrollDirection = 'down';
    } else if (scrollTop < lastScrollTop) {
      scrollDirection = 'up';
    }
    lastScrollTop = scrollTop;

    // Получаем размеры и позиции
    const columnRect = leftColumn.getBoundingClientRect();
    const columnHeight = columnRect.height;
    const viewportHeight = window.innerHeight;
    
    // Если колонка меньше экрана, всегда sticky-top
    if (columnHeight < viewportHeight - 48) {
      if (stickyState !== 'top') {
        leftColumn.classList.remove('sticky-bottom');
        leftColumn.classList.add('sticky-top');
        stickyState = 'top';
      }
      return;
    }

    // Колонка больше экрана - нужна умная логика
    const columnTop = columnRect.top;
    const columnBottom = columnRect.bottom;

    if (scrollDirection === 'down') {
      // Скроллим вниз
      if (stickyState === 'top') {
        // Была прилипшей сверху, проверяем нужно ли отлепить
        if (columnBottom > viewportHeight - 24) {
          // Низ колонки вышел за пределы экрана, отлепляем
          leftColumn.classList.remove('sticky-top');
          stickyState = 'none';
        }
      } else if (stickyState === 'none') {
        // Не прилипшая, проверяем нужно ли прилепить снизу
        if (columnBottom <= viewportHeight - 24) {
          // Низ колонки достиг низа экрана, прилепляем снизу
          leftColumn.classList.add('sticky-bottom');
          stickyState = 'bottom';
        }
      }
    } else if (scrollDirection === 'up') {
      // Скроллим вверх
      if (stickyState === 'bottom') {
        // Была прилипшей снизу, проверяем нужно ли отлепить
        if (columnTop < 24) {
          // Верх колонки вышел за пределы экрана, отлепляем
          leftColumn.classList.remove('sticky-bottom');
          stickyState = 'none';
        }
      } else if (stickyState === 'none') {
        // Не прилипшая, проверяем нужно ли прилепить сверху
        if (columnTop >= 24) {
          // Верх колонки достиг верха экрана, прилепляем сверху
          leftColumn.classList.add('sticky-top');
          stickyState = 'top';
        }
      }
    }
  }

  // Используем throttle для оптимизации производительности
  let ticking = false;
  
  function requestTick() {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateStickyBehavior();
        ticking = false;
      });
      ticking = true;
    }
  }

  // Слушаем скролл
  window.addEventListener('scroll', requestTick, { passive: true });
  
  // Слушаем изменение размера окна
  window.addEventListener('resize', () => {
    // При ресайзе сбрасываем состояние
    leftColumn.classList.remove('sticky-top', 'sticky-bottom');
    stickyState = 'none';
    requestTick();
  }, { passive: true });

  // Инициализация при загрузке
  setTimeout(() => {
    updateStickyBehavior();
  }, 100);

  // Отключаем на мобильных (когда grid становится одноколоночным)
  const mediaQuery = window.matchMedia('(max-width: 1024px)');
  
  function handleMediaChange(e) {
    if (e.matches) {
      // Мобильная версия - отключаем sticky
      leftColumn.classList.remove('sticky-top', 'sticky-bottom');
      stickyState = 'none';
    } else {
      // Десктоп - включаем обратно
      updateStickyBehavior();
    }
  }
  
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleMediaChange);
  } else {
    mediaQuery.addListener(handleMediaChange);
  }
  handleMediaChange(mediaQuery);

  console.log('Sticky sidebar initialized');
});
