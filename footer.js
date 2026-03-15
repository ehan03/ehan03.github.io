(() => {
    const FOOTER_TEXT = 'vibe coded, idk how to web dev';
    const LAST_UPDATED = 'Mar 15, 2026';

    const footer = document.getElementById('site-footer');
    if (!footer) return;

    const left = document.createElement('span');
    left.textContent = FOOTER_TEXT;

    const right = document.createElement('span');
    right.textContent = `Last updated: ${LAST_UPDATED}`;

    footer.replaceChildren(left, right);
})();
