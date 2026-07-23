const helpButton = document.querySelector('.section-label-help');
const helpPopup = document.getElementById('section-disclaimer-popup');

if (helpButton && helpPopup) {
    const closePopup = () => {
        helpButton.classList.remove('is-active');
        helpPopup.classList.remove('is-visible');
        helpButton.setAttribute('aria-expanded', 'false');
    };

    helpButton.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = helpButton.classList.toggle('is-active');
        helpPopup.classList.toggle('is-visible', isOpen);
        helpButton.setAttribute('aria-expanded', String(isOpen));
    });

    document.addEventListener('click', (event) => {
        if (!helpButton.contains(event.target) && !helpPopup.contains(event.target)) {
            closePopup();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closePopup();
        }
    });
}
