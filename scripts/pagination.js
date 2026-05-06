(() => {
    const pageSize = 5;
    const postRows = Array.from(document.querySelectorAll(".writings .post-row"));
    const pagination = document.querySelector(".post-pagination");
    const prevButton = pagination?.querySelector("[data-page='prev']");
    const nextButton = pagination?.querySelector("[data-page='next']");
    const status = pagination?.querySelector(".page-status");

    if (pagination && postRows.length > pageSize) {
        let currentPage = 0;
        const totalPages = Math.ceil(postRows.length / pageSize);

        const renderPage = () => {
            const start = currentPage * pageSize;
            const end = start + pageSize;

            postRows.forEach((row, index) => {
                row.style.display = index >= start && index < end ? "grid" : "none";
            });

            status.textContent = `page ${currentPage + 1} of ${totalPages}`;
            prevButton.disabled = currentPage === 0;
            nextButton.disabled = currentPage === totalPages - 1;
        };

        prevButton.addEventListener("click", () => {
            if (currentPage > 0) {
                currentPage -= 1;
                renderPage();
            }
        });

        nextButton.addEventListener("click", () => {
            if (currentPage < totalPages - 1) {
                currentPage += 1;
                renderPage();
            }
        });

        renderPage();
    } else if (pagination) {
        pagination.style.display = "none";
    }
})();
