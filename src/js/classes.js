const domParser = new DOMParser();

class Router {
    /**
     * Route handlers currently registered.
     * @type {Map<string, {
     *  onEnter: (fromRoute) => void,
     *  onLeave: (toRoute) => void
     * }}
     */
    handlers;
    
    constructor() {
        this.handlers = new Map();
    }
    
    registerRouteHandlers(regexp, handlers) {
        this.handlers.set(regexp, handlers);
    }
    
    getRouteHandlers(route) {
        const handlers = [];
        const keys = this.handlers.keys();
        let next = keys.next();
        while (!next.done) {
            const value = next.value;
            if (
                (typeof value == "string" && value == route)
                || (value instanceof RegExp && value.test(route))
            ) {
                handlers.push(this.handlers.get(value));
            }
            next = keys.next();
        }
        return handlers;
    }

    handleRouteChange(toRoute, fromRoute) {
        if (fromRoute !== toRoute) {
            this.getRouteHandlers(fromRoute).forEach((handler) => {
                if ("onLeave" in handler && typeof handler.onLeave === "function") {
                    handler.onLeave(toRoute);
                }
            });
            this.getRouteHandlers(toRoute).forEach((handler) => {
                if ("onEnter" in handler && typeof handler.onEnter === "function") {
                    handler.onEnter(fromRoute);
                }
            });
        }
    }
}

class GalleryItem {
    /**
     * @type {Gallery}
     */
    gallery;

    /**
     * @type {string}
     */
    img;

    /**
     * @type {string}
     */
    hash;

    /**
     * @type {string}
     */
    project;

    static instances = [];
    
    constructor(gallery, img, hash, project) {
        const thisIndex = GalleryItem.instances.push(this) - 1;
        this.gallery = gallery;
        this.img = img;
        this.hash = hash;
        this.project = project;
        this.resizeObserver = null;
        this.intersectionObserver = null;

        this.itemWrapperElement = domParser.parseFromString(/*html*/`
            <div class="gallery-item-wrapper" style="--data-color: ${this.project.color}">
                <a href="#${this.hash}">
                    ${(() => {
                    const filename = this.img.substring(this.img.lastIndexOf("/"), this.img.length - 4);
                    const extension = this.img.substring(this.img.length - 3);
                    switch (extension) {
                        case "webm":
                        case "mp4":
                            return /*html*/`
                            <video class="gallery-item" data-item-index=${thisIndex} autoplay muted loop playsinline>
                                <source type="video/webm" src="${contentRoot}${this.gallery.name}/gallery/${filename}.webm"></source>
                                <source type="video/mp4" src="${contentRoot}${this.gallery.name}/gallery/${filename}.mp4"></source>
                            </video>`;
                        default:
                            return /*html*/`<img class="gallery-item" data-item-index=${thisIndex} src="${contentRoot}${this.gallery.name}/gallery/${this.img}"/>`;
                    }
                })()}
                </a>
            </div>
        `, "text/html").body.firstChild;
        this.itemElement = this.itemWrapperElement.querySelector(".gallery-item");
        this.subitemElement = domParser.parseFromString(/*html*/`
            <div class="gallery-subitem" style="--data-color: ${this.project.color}"></div>
        `, "text/html").body.firstChild;
    }

    static _resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
            const clientRect = entry.target.getBoundingClientRect();
            const index = entry.target.getAttribute("data-item-index");
            const item = GalleryItem.instances[index];
            item.itemWrapperElement.style.setProperty("--width", `${clientRect.width}px`);
            item.itemWrapperElement.style.setProperty("--height", `${clientRect.height}px`);
            item.subitemElement.style.setProperty("--width", `${clientRect.width}px`);
            item.subitemElement.style.setProperty("--height", `${clientRect.height}px`);
        }
    });

    setup() {
        GalleryItem._resizeObserver.observe(this.itemElement);
    }

    clone() {
        return new GalleryItem(this.gallery, this.img, this.hash, this.project);
    }
}

class Gallery {
    /**
     * @type {HTMLElement}
     */
    galleryElement;

    /**
     * @type {HTMLElement}
     */
    scrollerElement;
    
    /**
     * @type {HTMLElement}
     */
    subscrollerElement;

    /**
     * @type {number}
     */
    subscrollerOffset;

    /**
     * @type {Set<GalleryItem>}
     */
    #items;

    /**
     * @type {Array<GalleryItem>}
     */
    items;

    constructor(name, hash, items, projects) {
        this.name = name;
        this.hash = hash;
        this.#items = new Set(items.map(item => new GalleryItem(this, item.img, item.hash, projects.find((project) => project.hash === item.hash))));
        this.items = Array.from(this.#items);
        this.projects = [];
        this.intersectionObserver = null;
        this.subscrollerOffset = 0;
        
        this.galleryElement = domParser.parseFromString(/*html*/`
            <main id="${this.name}" class="gallery">
                <div class="gallery-scroller"></div>
                <div class="gallery-subscroller"></div>
            </main>
        `, "text/html").body.firstChild;
        
        this.scrollerElement = this.galleryElement.getElementsByClassName("gallery-scroller")[0];
        this.scrollerElement.append(
            ...this.items.map(item => item.itemWrapperElement)
        );
        this.subscrollerElement = this.galleryElement.getElementsByClassName("gallery-subscroller")[0];
        this.subscrollerElement.append(
            ...this.items.map(item => item.subitemElement)
        );
    }

    setup() {
        this._setupSubscrollerSync();
        this._setupInfiniteScrolling();
        this._setupItems();
    }

    show() {
        this.galleryElement.hidden = false;
    }

    hide() {
        this.galleryElement.hidden = true;
    }

    enableScroller() {
        this.scrollerElement.toggleAttribute("data-disabled", false);
        this.intersectionCallback(this.intersectionObserver.takeRecords());
    }

    disableScroller() {
        this.scrollerElement.toggleAttribute("data-disabled", true);
    }

    setScrollerOffset() {
        const firstItem = this.items_curr[0];
        const middleItem = this.items_curr[Math.trunc(this.items_curr.length / 2)];
        const firstItemWidth = parseFloat(window.getComputedStyle(firstItem.itemWrapperElement).getPropertyValue("width"));
        const scrollerOffset = firstItemWidth * (2 / 3);
        firstItem.itemWrapperElement.scrollIntoView();
        middleItem.subitemElement.scrollIntoView();
        this.scrollerElement.scrollTop += scrollerOffset;
        this.scrollerOffset = scrollerOffset;
    }

    scrollerOffset = 0;
    _scrollInitiator = null;
    _hoveredWrapper = null;

    _setupSubscrollerSync() {
        const updateOveredWrapper = () => {
            const overedWrapper = document.elementsFromPoint(mousePosition.x, mousePosition.y)
                    .find(el => el.classList.contains("gallery-item-wrapper"));
            if (overedWrapper) {
                if (this._hoveredWrapper !== null) {
                    this._hoveredWrapper.toggleAttribute("data-overed", false);
                }
                this._hoveredWrapper = overedWrapper;
                overedWrapper.toggleAttribute("data-overed", true);
            }
        }

        this.scrollerElement.addEventListener("scroll", (event) => {
            if (!this.scrollerElement.hasAttribute("data-disabled")) {
                if (this._scrollInitiator == this.subscrollerElement) {
                    this._scrollInitiator = null;
                    event.preventDefault();
                }
                else {
                    requestAnimationFrame(() => {
                        const subscrollerWidth = this.subscrollerElement.getBoundingClientRect().width;
                        this._scrollInitiator = this.scrollerElement;
                        this.subscrollerElement.scrollTop = this.subscrollerElement.scrollHeight - subscrollerWidth - this.scrollerElement.scrollTop + this.scrollerOffset;
                        if (this._hoveredWrapper !== null) {
                            this._hoveredWrapper.toggleAttribute("data-overed", false);
                            this._hoveredWrapper = null;
                        }
                        updateOveredWrapper();
                    });
                }
            }
        });

        this.subscrollerElement.addEventListener("scroll", (event) => {
            if (!this.scrollerElement.hasAttribute("data-disabled")) {
                if (this._scrollInitiator == this.scrollerElement) {
                    this._scrollInitiator = null;
                    event.preventDefault();
                }
                else {
                    requestAnimationFrame(() => {
                        this._scrollInitiator = this.subscrollerElement;
                        const subscrollerWidth = this.subscrollerElement.getBoundingClientRect().width;
                        this.scrollerElement.scrollTop = this.subscrollerElement.scrollHeight - this.subscrollerElement.scrollTop - subscrollerWidth - this.scrollerOffset;
                    });
                }
            }
        });
    }

    _setupInfiniteScrolling() {
        this.items_curr = Array.from(this.#items);
        this.items_prev = this.items_curr.map(item => item.clone());
        this.items_next = this.items_curr.map(item => item.clone());
        
        this.items = [
            ...this.items_prev,
            ...this.items_curr,
            ...this.items_next
        ];

        this.scrollerElement.textContent = "";
        this.scrollerElement.append(
            ...this.items.map(item => item.itemWrapperElement)
        );

        this.subscrollerElement.textContent = "";
        this.subscrollerElement.append(
            ...this.items.map(item => item.subitemElement)
        );

        const scrollerIntersectionObserverCallback = (entries) => {
            if (!this.scrollerElement.hasAttribute("data-disabled")) {
                if (this.skipNextIntersection) {
                    this.skipNextIntersection = false;
                    return;
                }
                for (let entry of entries) {
                    if (entry.isIntersecting) {
                        const intersectingItem = this.items.find((item => item.itemWrapperElement == entry.target));
                        const intersectionSign = Math.sign(entry.boundingClientRect.x);
                        if (intersectionSign == -1 && this.items_prev.includes(intersectingItem)) {
                            const curr = this.items_curr.find(item => item.hash === intersectingItem.hash);
                            curr.itemWrapperElement.scrollIntoView({block: "start"});
                            this.scrollerElement.scrollTop += entry.target.scrollHeight;
                            this.skipNextIntersection = true;
                        }
                        else if (intersectionSign == 1 && this.items_next.includes(intersectingItem)) {
                            const curr = this.items_curr.find(item => item.hash === intersectingItem.hash);
                            curr.itemWrapperElement.scrollIntoView({block: "end"});
                            this.scrollerElement.scrollTop -= entry.target.scrollHeight;
                            this.skipNextIntersection = true;
                        }
                    }
                }
            }
        };

        this.intersectionCallback = scrollerIntersectionObserverCallback;

        this.intersectionObserver = new IntersectionObserver(scrollerIntersectionObserverCallback, {
            root: this.scrollerElement
        });

        this.items.forEach((item) => {
            this.intersectionObserver.observe(item.itemWrapperElement);
        });
    }

    _setupItems() {
        this.items.forEach((item) => {
            item.setup();
        });
        this.galleryElement.addEventListener("mouseover", (event) => {
            const target = event.target;
            if (target && target instanceof Element) {
                const wrapper = target.matches(".gallery-item-wrapper") ? target : target.closest(".gallery-item-wrapper");
                if (wrapper) {
                    this._hoveredWrapper = wrapper;
                    wrapper.toggleAttribute("data-overed", true);
                }
            }
        });
        this.galleryElement.addEventListener("mouseout", (event) => {
            const relatedTarget = event.relatedTarget;
            if (this._hoveredWrapper && !this._hoveredWrapper.contains(relatedTarget)) {
                this._hoveredWrapper.toggleAttribute("data-overed", false);
                this._hoveredWrapper = null;
            }
        });
    }
}

class Project {
    /**
     * @type {Gallery}
     */
    gallery;

    /**
     * @type {HTMLElement}
     */
    projectElement;

    constructor(gallery, name, hash, imgs, lang) {
        this.gallery = gallery;
        this.name = name;
        this.hash = hash;
        this.imgs = imgs;
        this.lang = lang;

        this.projectElement = domParser.parseFromString(/*html*/`
            <main id="${this.name}" class="project">
                <section class="project-anchor">
                    <a href="#${this.gallery.hash}" class="gallery-anchor"></a>
                </section>
                <section class="project-details">
                    ${(() => {
                        const createLangDetails = (lang) => {
                            const langContent = this.lang[lang];
                            return /*html*/`
                                <div lang="${lang}">
                                    <h1>${langContent.title || ""}</h1>
                                    <h2>${langContent.subtitle || ""}</h2>
                                    <p lang="${lang}">${langContent.description || ""}</p>
                                </div>`;
                        };
                        return (typeof this.lang === "object") ? Object.keys(this.lang).reduce((acc, lang) => acc + createLangDetails(lang), "") : "";
                    })()}
                </section>
                <div class="project-content">
                    ${(() => {
                        const createImgElement = (img) => {
                            const filename = img.substring(img.lastIndexOf("/"), img.length - 4);
                            const extension = img.substring(img.length - 3);
                            switch (extension) {
                                case "webm":
                                case "mp4":
                                    return /*html*/`
                                    <video class="project-item" autoplay muted loop playsinline controls>
                                        <source type="video/webm" src="${contentRoot}${this.gallery.name}/projects/${this.name}/${filename}.webm"></source>
                                        <source type="video/mp4" src="${contentRoot}${this.gallery.name}/projects/${this.name}/${filename}.mp4"></source>
                                    </video>`;
                                default:
                                    return /*html*/`<img class="project-item" src="${contentRoot}${this.gallery.name}/projects/${this.name}/${img}"/>`;
                            }
                        }
                        return (Array.isArray(this.imgs)) ? this.imgs.reduce((acc, img) => acc + createImgElement(img), "") : "";
                    })()}
                    <div class="project-content-bottom"></div>
                </div>
            </main>
        `, "text/html").body.firstChild;
    }

    setup() {
        this._setupObservers();
    }

    show() {
        this.projectElement.hidden = false;
    }

    hide() {
        this.projectElement.hidden = true;
    }

    setAway() {
        this.projectElement.toggleAttribute("data-away", true);
    }

    unsetAway() {
        this.projectElement.scrollTop = 0;
        this.projectElement.toggleAttribute("data-away", false);
    }

    static _resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
            const clientRect = entry.target.getBoundingClientRect();
            entry.target.style.setProperty("--width", `${clientRect.width}px`);
            entry.target.style.setProperty("--height", `${clientRect.height}px`);
        }
    });

    _setupObservers() {
        Array.from(this.projectElement.querySelectorAll("img, video")).forEach((img) => {
            Project._resizeObserver.observe(img);
        });
    }
}