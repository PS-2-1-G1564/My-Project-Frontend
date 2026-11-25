
 
document.addEventListener("DOMContentLoaded", function () {

    const navigationLinks = document.querySelectorAll(".nav-link");

    const currentPage = window.location.pathname
        .split("/")
        .pop()
        .toLowerCase();

    navigationLinks.forEach(link => {

        const linkPage = link.getAttribute("href");

        link.classList.remove("active");

        if (linkPage && linkPage.toLowerCase() === currentPage) {
            link.classList.add("active");
        }

    });

});

