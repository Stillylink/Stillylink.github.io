document.addEventListener('DOMContentLoaded', () => {
    const navbar       = document.querySelector('.navbar');
    const logo         = document.querySelector('.logo');
    const navToggle    = document.querySelector('.nav-toggle');
    const userAvatar   = document.querySelector('.user-avatar');
    const navSearch    = document.getElementById('navSearch');
    const searchInput  = document.getElementById('navSearchInput');

    const mobileSearchBtn = document.createElement('button');
    mobileSearchBtn.className = 'mobile-search-btn';
    mobileSearchBtn.setAttribute('aria-label', 'Поиск');
    mobileSearchBtn.innerHTML = `
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.7"/>
            <path d="M13 13L17 17" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
        </svg>
    `;

    const mobileSearchBack = document.createElement('button');
    mobileSearchBack.className = 'mobile-search-back hidden';
    mobileSearchBack.setAttribute('aria-label', 'Назад');
    mobileSearchBack.innerHTML = `
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13 4L7 10L13 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;

    navbar.insertBefore(mobileSearchBtn, navToggle);
    navbar.insertBefore(mobileSearchBack, navSearch);

    function openMobileSearch() {
        logo.classList.add('mobile-hidden');
        navToggle.classList.add('mobile-hidden');
        userAvatar.classList.add('mobile-hidden');
        mobileSearchBtn.classList.add('mobile-hidden');

        mobileSearchBack.classList.remove('hidden');
        navSearch.classList.add('mobile-search-active');

        searchInput.focus();
    }

    function closeMobileSearch() {
        logo.classList.remove('mobile-hidden');
        navToggle.classList.remove('mobile-hidden');
        if (!userAvatar.dataset.authHidden) {
            userAvatar.classList.remove('mobile-hidden');
        }
        mobileSearchBtn.classList.remove('mobile-hidden');

        mobileSearchBack.classList.add('hidden');
        navSearch.classList.remove('mobile-search-active');

        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
    }

    mobileSearchBtn.addEventListener('click', openMobileSearch);
    mobileSearchBack.addEventListener('click', closeMobileSearch);

    searchInput.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeMobileSearch();
    });

    const avatarObserver = new MutationObserver(() => {
        if (userAvatar.classList.contains('hidden')) {
            userAvatar.dataset.authHidden = '1';
        } else {
            delete userAvatar.dataset.authHidden;
        }
    });
    avatarObserver.observe(userAvatar, { attributes: true, attributeFilter: ['class'] });
});
