const router = new Router();

const langBtn = document.getElementById("lang-btn");

const slideshow = document.getElementById("slideshow");
const header = document.getElementById("header");
const headerTitle = document.getElementById("header-title");
const headerBanner = document.getElementById("header-banner");
const headerBannerContent = document.getElementById("header-banner-content");
const headerBannerScrollBtns = document.getElementById("header-banner-scroll-btns");
const headerBannerScrollLeftBtn = document.getElementById("header-banner-scroll-btn-left");
const headerBannerScrollRightBtn = document.getElementById("header-banner-scroll-btn-right");
const headerContact = document.getElementById("header-contact");

const loader = document.getElementById("loader");
const intro = document.getElementById("intro");

const menuContainer = document.getElementById("menu-container");
const projectsContainer = document.getElementById("projects-container");
const galleriesContainer = document.getElementById("galleries-container");

const projectAwayDurationMs = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--project-away-duration-ms"));
const introStepTransitionDurationMs = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--intro-step-transition-duration-ms"));
const introStep0TransitionDelayMs = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--intro-step0-transition-delay-ms"));
const introStep1TransitionDelayMs = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--intro-step1-transition-delay-ms"));
const introTotalTransitionDurationMs = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--intro-total-transition-duration-ms"));

const langs = ["fr", "en"];
const defaultLang = langs[0];
const contentRoot = "media/content/";
const contentItems = ["identites", "illustrations", "photographies", "prints"];

const mousePosition = {
    x: 0,
    y: 0
};

const content = {
    /**
     * @type {Array<Gallery>}
     */
    galleries: [],
    /**
     * @type {Array<Project>}
     */
    projects: []
};

window.addEventListener("mousemove", (event) => {
    mousePosition.x = event.clientX;
    mousePosition.y = event.clientY;
});

document.addEventListener("touchmove", (event) => {
    const touch = event.touches.item(0);
    mousePosition.x = touch.clientX;
    mousePosition.y = touch.clientY;
});

[headerTitle, menuContainer].forEach((menuAreaElement) => {
    menuAreaElement.addEventListener("mouseenter", () => {
        document.body.toggleAttribute("data-with-menu", true);
    });
    menuAreaElement.addEventListener("mouseleave", () => {
        document.body.toggleAttribute("data-with-menu", false);
    });
});

function handleHashChange(oldHash, newHash) {
    document.body.toggleAttribute("data-index", !newHash);
    router.handleRouteChange(newHash, oldHash);
};

function handleLangParam(lang) {
    if (langs.includes(lang)) {
        const nextLang = langs[(langs.indexOf(lang) + 1) % langs.length];
        langBtn.innerText = nextLang;
        document.body.lang = lang;
        document.documentElement.lang = lang;
    }
};

function documentImgsLoadPromises() {
    const imgs = Array.from(document.querySelectorAll("img"));
    return imgs.map((img) => {
        return new Promise(
            (resolve) => {
                if (img.complete) {
                    resolve();
                }
                else {
                    img.addEventListener("load", () => {
                        resolve();
                    });
                }
            }
        )
    });
};

function setLayout(layout) {
    document.body.setAttribute("data-layout", layout);
}

function startLoader() {
    document.body.toggleAttribute("data-on-loading", true);
    loader.volumne = 0;
    loader.play();
}

function stopLoader() {
    document.body.toggleAttribute("data-on-loading", false);
    loader.pause();
}

function startIntro() {
    document.body.toggleAttribute("data-on-intro", true);
    intro.currentTime = 0;
    intro.play();
}

function stopIntro() {
    document.body.toggleAttribute("data-on-intro", false);
    intro.pause();
}

function startSlideshow() {
    Array.from(slideshow.querySelectorAll("video")).forEach((video) => {
        video.currentTime = 0;
        video.play();
    });
}

function stopSlideshow() {
    Array.from(slideshow.querySelectorAll("video")).forEach((video) => {
        video.pause();
    });
}

function loadContentPromise() {
    return new Promise((resolve) => {
        (async function() {
            for await (let item of contentItems) {
                const contentItem = await fetch(`${contentRoot}${item}/content.json`).then(
                    (response) => response.json()
                );
                const galleryContent = contentItem.gallery;
                const projectsContent = contentItem.projects;
                try {
                    galleryContent.items.forEach((galleryItem) => {
                        const relatedProject = galleryItem.hash = projectsContent.find(
                            (projectContent) => projectContent.name === galleryItem.project
                        );
                        if (relatedProject) {
                            galleryItem.hash = relatedProject.hash;
                        }
                        else {
                            console.error(`Project '${galleryItem.project}' not found in gallery '${galleryContent.name}'`);
                        }
                    });
                    
                    const gallery = new Gallery(galleryContent.name, galleryContent.hash, galleryContent.items, projectsContent);
                    content.galleries.push(gallery);

                    const galleryProjects = projectsContent.map(
                        projectContent => new Project(gallery, projectContent.name, projectContent.hash, projectContent.imgs, projectContent.lang)
                    );
                    gallery.projects.push(...galleryProjects);
                    content.projects.push(...galleryProjects);
                }
                catch (error) {
                    console.error(error);
                }
            }

            content.galleries.forEach((gallery) => {
                router.registerRouteHandlers(new RegExp(`^${gallery.hash}$`), {
                    onEnter: (fromRoute) => {
                        setLayout("gallery");

                        if (!galleriesContainer.contains(gallery.galleryElement)) {
                            startLoader();
                            gallery.hide();
                            galleriesContainer.append(gallery.galleryElement);
                            gallery.setup();
                        }
                        
                        const preLoadTime = new Date().getTime();
                        Promise.all(documentImgsLoadPromises()).then(() => {
                            gallery.show();
                            const routingFromGalleryProject = gallery.projects.find((project) => project.hash == fromRoute);
                            if (!routingFromGalleryProject) {
                                gallery.setScrollerOffset();
                                const postLoadingTime = new Date().getTime();
                                const remainingLoadingTime = Math.max(0, 4_000 - (postLoadingTime - preLoadTime));
                                setTimeout(() => {
                                    gallery.enableScroller();
                                    stopLoader();
                                }, remainingLoadingTime);
                            }
                            else {
                                gallery.enableScroller();
                            }
                        });
                    },
                    onLeave: (toRoute) => {
                        const routingToGalleryProject = gallery.projects.find((project) => project.hash == toRoute);
                        if (!routingToGalleryProject) {
                            gallery.hide();
                        }
                    }
                });
            });

            content.projects.forEach((project) => {
                router.registerRouteHandlers(new RegExp(`^${project.hash}$`), {
                    onEnter: (fromRoute) => {
                        setLayout("project");
                        
                        if (!galleriesContainer.contains(project.gallery.galleryElement)) {
                            project.gallery.hide();
                            galleriesContainer.append(project.gallery.galleryElement);
                            project.gallery.setup();
                        }

                        if (!projectsContainer.contains(project.projectElement)) {
                            project.hide();
                            projectsContainer.append(project.projectElement);
                            project.setup();
                        }

                        project.show();
                        const routingFromGallery = (fromRoute == project.gallery.hash);
                        if (routingFromGallery) {
                            project.setAway();
                        }
                        project.unsetAway();
                    },
                    onLeave: (toRoute) => {
                        const toParentGallery = toRoute == project.gallery.hash;
                        const toSiblingProject = project.gallery.projects.find((project) => project.hash == toRoute);
                        if (toParentGallery) {
                            project.setAway();
                        }
                        else {
                            project.hide();
                            if (!toSiblingProject) {
                                project.gallery.hide();
                            }
                        }
                    }
                });
            });

            router.registerRouteHandlers(new RegExp(`^$`), {
                onEnter: () => {
                    setLayout("index");
                    startSlideshow();
                },
                onLeave: () => {
                    stopSlideshow();
                }
            });

            router.registerRouteHandlers(new RegExp(`^Contact$`), {
                onEnter: () => {
                    setLayout("contact");
                    startSlideshow();
                },
                onLeave: () => {
                    stopSlideshow();
                }
            });
            
            resolve();
        })();
    });
};

headerContact.addEventListener("click", () => {
    const isClosed = headerContact.hasAttribute("data-closed");
    headerContact.toggleAttribute("data-closed", !isClosed);
    headerBannerContent.toggleAttribute("data-invisible", isClosed);
    headerBannerScrollBtns.hidden = isClosed;
});

langBtn.addEventListener("click", () => {
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set("lang", langBtn.textContent);
    window.location.search = searchParams.toString();
});

window.addEventListener("hashchange", (event) => {
    const newURL = event.newURL.substring(event.newURL.indexOf("#") + 1);
    const oldURL = event.oldURL.substring(event.oldURL.indexOf("#") + 1);
    handleHashChange(oldURL, newURL);
});

window.addEventListener("load", () => {
    const hash = window.location.hash.substring(window.location.hash.indexOf("#") + 1);
    const searchParams = new URLSearchParams(window.location.search || `?lang=${defaultLang}`);

    loadContentPromise().then(() => {
        Promise.all([documentImgsLoadPromises()]).then(() => {
            handleHashChange(void 0, hash);
            handleLangParam(searchParams.get("lang"));
            document.body.removeAttribute("data-before-intro");
            if (!hash) {
                startIntro();
                setTimeout(() => {
                    stopIntro();
                    startSlideshow();
                }, introTotalTransitionDurationMs);
            }
        });
    });
});

/*----------------------*/
/*		Observers		*/
/*----------------------*/

const headerObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
        const clientRect = entry.target.getBoundingClientRect();
        document.documentElement.style.setProperty("--header-height", `${clientRect.height}px`);
        document.documentElement.style.setProperty("--header-width",  `${clientRect.width}px`);
    }
});
headerObserver.observe(header);

const bodyObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
        const clientRect = entry.target.getBoundingClientRect();
        document.documentElement.style.setProperty("--body-width", `${clientRect.width}px`);
        document.documentElement.style.setProperty("--body-height", `${clientRect.height}px`);
    }
});
bodyObserver.observe(document.body);

const headerBannerObserver = new ResizeObserver(() => {
    if (headerBanner.scrollWidth < headerBannerContent.scrollWidth) {
        headerBannerScrollLeftBtn.hidden = true;
        headerBannerScrollRightBtn.hidden = false;
        headerBannerScrollLeftBtn.addEventListener("click", () => {
            headerBannerContent.scrollLeft = 0;
            headerBannerScrollLeftBtn.hidden = true;
            headerBannerScrollRightBtn.hidden = false;
        });
    
        headerBannerScrollRightBtn.addEventListener("click", () => {
            headerBannerContent.scrollLeft = headerBannerContent.scrollWidth;
            headerBannerScrollRightBtn.hidden = true;
            headerBannerScrollLeftBtn.hidden = false;
        });
    }
    else {
        headerBannerScrollLeftBtn.hidden = true;
        headerBannerScrollRightBtn.hidden = true;
    }
});
headerBannerObserver.observe(headerBanner);

const headerContactObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
        const clientRect = entry.target.getBoundingClientRect();
        document.documentElement.style.setProperty("--header-contact-width", `${clientRect.width}px`);
    }
});
headerContactObserver.observe(headerContact);

const headerTitleObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
        const clientRect = entry.target.getBoundingClientRect();
        document.documentElement.style.setProperty("--header-title-width", `${clientRect.width}px`);
    }
});
headerTitleObserver.observe(headerTitle);