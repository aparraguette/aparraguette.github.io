const router = new Router();

const langBtn = document.getElementById("lang-btn");

const header = document.getElementById("header");
const headerTitle = document.getElementById("header-title");
const headerBanner = document.getElementById("header-banner");
const headerBannerContent = document.getElementById("header-banner-content");
const headerBannerScrollBtns = document.getElementById("header-banner-scroll-btns");
const headerBannerScrollLeftBtn = document.getElementById("header-banner-scroll-btn-left");
const headerBannerScrollRightBtn = document.getElementById("header-banner-scroll-btn-right");
const headerContact = document.getElementById("header-contact");

const homeSliderContainer = document.getElementById("home-slider-container");
const projectsContainer = document.getElementById("projects-container");
const galleriesContainer = document.getElementById("galleries-container");
const galleryAnchor = document.getElementById("gallery-anchor");

const projectAwayDurationMs = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--project-away-duration-ms"));
const introStepTransitionDurationMs = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--intro-step-transition-duration-ms"));
const introStep0TransitionDelayMs = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--intro-step0-transition-delay-ms"));
const introStep1TransitionDelayMs = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--intro-step1-transition-delay-ms"));
const introTransitionDurationMs = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--intro-transition-duration-ms"));

const langs = ["fr", "en"];
const defaultLang = langs[0];
const contentRoot = "media/content/";
const contentItems = ["identites", /*"illustrations",*/ "photographies", /*"prints"*/];
const mousePosition = {x: 0, y: 0};

const content = {
    galleries: [],
    projects: []
};

function handleHashChange(oldHash, newHash) {
    if (newHash === "") {
        document.body.setAttribute("data-index", "");
    }
    else {
        document.body.removeAttribute("data-index");
    }
    router.handleRouteChange(newHash, oldHash);
};

function handleLangParam(lang) {
    if (langs.includes(lang)) {
        let nextLang = langs[(langs.indexOf(lang) + 1) % langs.length];
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

function loadContentPromise() {
    return new Promise((resolve) => {
        (async function() {
            for await (let item of contentItems) {
                let contentItem = await fetch(`${contentRoot}${item}/content.json`).then(
                    (response) => response.json()
                );
                let galleryContent = contentItem.gallery;
                let projectsContent = contentItem.projects;
                try {
                    galleryContent.items.forEach((galleryItem) => {
                        let relatedProject = galleryItem.hash = projectsContent.find(
                            (projectContent) => projectContent.name === galleryItem.project
                        );
                        if (relatedProject) {
                            galleryItem.hash = relatedProject.hash;
                        }
                        else {
                            console.error(`Project '${galleryItem.project}' not found in gallery '${galleryContent.name}'`);
                        }
                    });
                    
                    let gallery = new Gallery(galleryContent.name, galleryContent.hash, galleryContent.items, projectsContent);
                    content.galleries.push(gallery);

                    let galleryProjects = projectsContent.map(
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
                        document.body.setAttribute("data-layout", "gallery");

                        if (!galleriesContainer.contains(gallery.galleryElement)) {
                            document.body.setAttribute("data-on-loading", "");
                            gallery.galleryElement.hidden = true;
                            galleriesContainer.append(gallery.galleryElement);
                            gallery.setupSubscrollerSync();
                            gallery.setupInfiniteScrolling();
                            gallery.setupItemsCallbacks();
                        }
                        
                        gallery.scrollerElement.setAttribute("data-disabled", "");

                        Promise.all(documentImgsLoadPromises()).then(() => {
                            gallery.galleryElement.hidden = false;
                            setTimeout(() => {
                                let routingFromGalleryProject = gallery.projects.find((project) => project.hash == fromRoute);
                                if (!routingFromGalleryProject) {
                                    let firstItem = gallery.items.find(item => item.itemWrapperElement.getAttribute("data-pos") == 0);
                                    if (firstItem) {
                                        let firstItemWidth = parseFloat(window.getComputedStyle(firstItem.itemWrapperElement).getPropertyValue("--width"));
                                        firstItem.itemWrapperElement.scrollIntoView(true);
                                        gallery.scrollerElement.scrollTop += firstItemWidth * (2 / 3);
                                    }
                                }
                                setTimeout(() => {
                                    gallery.scrollerElement.removeAttribute("data-disabled");
                                    document.body.removeAttribute("data-on-loading");
                                }, 200)
                            }, 100);
                        });
                    },
                    onLeave: (toRoute) => {
                        let routingToGalleryProject = gallery.projects.find((project) => project.hash == toRoute);
                        if (!routingToGalleryProject) {
                            gallery.galleryElement.hidden = true;
                        }
                    }
                });
            });

            content.projects.forEach((project) => {
                router.registerRouteHandlers(new RegExp(`^${project.hash}$`), {
                    onEnter: (fromRoute) => {
                        document.body.setAttribute("data-layout", "project");
                        
                        if (!galleriesContainer.contains(project.gallery.galleryElement)) {
                            document.body.setAttribute("data-on-loading", "");
                            project.gallery.galleryElement.hidden = true;
                            galleriesContainer.append(project.gallery.galleryElement);
                            project.gallery.setupSubscrollerSync();
                            project.gallery.setupInfiniteScrolling();
                            project.gallery.setupItemsCallbacks();
                        }

                        if (!projectsContainer.contains(project.projectElement)) {
                            document.body.setAttribute("data-on-loading", "");
                            project.projectElement.hidden = true;
                            projectsContainer.append(project.projectElement);
                            project.setupImgsCallbacks();
                        }

                        galleryAnchor.href = `#${project.gallery.hash}`;

                        project.projectElement.hidden = false;
                        let routingFromGallery = (fromRoute == project.gallery.hash);
                        if (routingFromGallery) {
                            project.projectElement.setAttribute("data-away", "");
                        }
                        
                        Promise.all(documentImgsLoadPromises()).then(() => {
                            project.projectElement.scrollTop = 0;
                            document.body.removeAttribute("data-on-loading");
                            project.projectElement.removeAttribute("data-away");
                        });
                    },
                    onLeave: (toRoute) => {
                        let toParentGallery = toRoute == project.gallery.hash;
                        let toSiblingProject = project.gallery.projects.find((project) => project.hash == toRoute);
                        if (toParentGallery) {
                            project.projectElement.setAttribute("data-away", "");
                        }
                        else {
                            project.projectElement.hidden = true;
                            if (!toSiblingProject) {
                                project.gallery.galleryElement.hidden = true;
                            }
                        }
                    }
                });
            });

            router.registerRouteHandlers(new RegExp(`^$`), {
                onEnter: () => {
                    document.body.setAttribute("data-layout", "index");
                }
            });

            router.registerRouteHandlers(new RegExp(`^Contact$`), {
                onEnter: () => {
                    document.body.setAttribute("data-layout", "contact");
                    document.body.scrollTop = 0;
                }
            });
            
            resolve();
        })();
    });
};

window.addEventListener("mousemove", (event) => {
    mousePosition.x = event.clientX;
    mousePosition.y = event.clientY;
});

document.addEventListener("touchmove", (event) => {
    let touch = event.touches.item(0);
    mousePosition.x = touch.clientX;
    mousePosition.y = touch.clientY;
});

headerContact.addEventListener("click", () => {
    if (headerContact.getAttribute("data-closed") !== null) {
        headerContact.removeAttribute("data-closed");
        headerBannerContent.setAttribute("data-invisible", "");
        headerBannerScrollBtns.hidden = true;
    }
    else {
        headerContact.setAttribute("data-closed", "");
        headerBannerContent.removeAttribute("data-invisible");
        headerBannerScrollBtns.hidden = false;
    }
});

langBtn.addEventListener("click", () => {
    let searchParams = new URLSearchParams(window.location.search);
    searchParams.set("lang", langBtn.textContent);
    window.location.search = searchParams.toString();
});

window.addEventListener("hashchange", (event) => {
    let newURL = event.newURL.substring(event.newURL.indexOf("#") + 1);
    let oldURL = event.oldURL.substring(event.oldURL.indexOf("#") + 1);
    handleHashChange(oldURL, newURL);
});

window.addEventListener("load", () => {
    let hash = window.location.hash.substring(window.location.hash.indexOf("#") + 1);
    let searchParams = new URLSearchParams(window.location.search || `?lang=${defaultLang}`);

    loadContentPromise().then(() => {
        Promise.all([documentImgsLoadPromises()]).then(() => {
            handleHashChange(void 0, hash);
            handleLangParam(searchParams.get("lang"));
            document.body.removeAttribute("data-before-intro");
            if (!hash) {
                document.body.setAttribute("data-on-intro", "");
                setTimeout(() => {
                    document.body.removeAttribute("data-on-intro");
                }, introTransitionDurationMs);
            }
        });
    });
});


let headerObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
        let clientRect = entry.target.getBoundingClientRect();
        document.body.style.setProperty("--header-height", `${clientRect.height}px`);
        document.body.style.setProperty("--header-width",  `${clientRect.width}px`);
    }
});
headerObserver.observe(header);

let bodyObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
        let clientRect = entry.target.getBoundingClientRect();
        document.body.style.setProperty("--body-width",  `${clientRect.width}px`);
        document.body.style.setProperty("--body-height",  `${clientRect.height}px`);
    }
});
bodyObserver.observe(document.body);

let headerBannerObserver = new ResizeObserver(() => {
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

let headerContactObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
        let clientRect = entry.target.getBoundingClientRect();
        document.body.style.setProperty("--header-contact-width",  `${clientRect.width}px`);
    }
});
headerContactObserver.observe(headerContact);

let headerTitleObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
        let clientRect = entry.target.getBoundingClientRect();
        document.body.style.setProperty("--header-title-width",  `${clientRect.width}px`);
    }
});
headerTitleObserver.observe(headerTitle);