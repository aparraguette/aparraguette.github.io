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
    constructor(gallery, img, hash, project) {
        this.gallery = gallery;
        this.img = img;
        this.hash = hash;
        this.project = project;
        this.resizeObserver = null;
        this.intersectionObserver = null;

        this.itemWrapperElement = domParser.parseFromString(/*html*/`
            <div class="gallery-item-wrapper" data-hash="${this.hash}" style="--data-color: ${this.project.color}">
                <a href="#${this.hash}">
                    ${(() => {
                    let extension = this.img.substr(this.img.length - 3);
                    switch (extension) {
                        case "jpg":
                        case "png":
                        case "gif":
                            return /*html*/`<img class="gallery-item" src="${contentRoot}${this.gallery.name}/gallery/${this.img}" data-hash="${this.hash}"/>`;
                        case "mov":
                        case "mp4":
                            return /*html*/`
                            <video class="gallery-item" data-hash="${this.hash}" autoplay>
                                <source type="video/${extension == "mp4" ? "mp4" : "quicktime"}" src="${contentRoot}${this.gallery.name}/gallery/${this.img}"></source>
                            </video>`;
                    }
                })()}
                </a>
            </div>
        `, "text/html").body.firstChild;
        this.itemElement = this.itemWrapperElement.querySelector(".gallery-item");
        this.subitemElement = domParser.parseFromString(/*html*/`
            <div class="gallery-subitem" data-hash="${this.hash}" style="--data-color: ${this.project.color}"></div>
        `, "text/html").body.firstChild;
    }

    clone() {
        return new GalleryItem(this.gallery, this.img, this.hash, this.project);
    }
}

class Gallery {
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
        
        this.scrollerElement = this.galleryElement.querySelector(".gallery-scroller");
        this.scrollerElement.append(
            ...this.items.map(item => item.itemWrapperElement)
        );
        this.subscrollerElement = this.galleryElement.querySelector(".gallery-subscroller");
        this.subscrollerElement.append(
            ...this.items.map(item => item.subitemElement)
        );
    }

    setupSubscrollerSync() {
        let scrollInitiator = null;
        let lastScrollOveredGalleryItem = null;

        function updateOveredItem() {
            const scrollOveredGalleryItem = document.elementsFromPoint(mousePosition.x, mousePosition.y)
                    .find(el => el.matches(".gallery-item-wrapper"));
            if (scrollOveredGalleryItem) {
                scrollOveredGalleryItem.setAttribute("data-overed", "");
                lastScrollOveredGalleryItem = scrollOveredGalleryItem;
            }
        }

        this.scrollerElement.addEventListener("scroll", (event) => {
            if (!this.scrollerElement.hasAttribute("data-disabled")) {
                if (scrollInitiator == this.subscrollerElement) {
                    scrollInitiator = null;
                    event.preventDefault();
                }
                else {
                    requestAnimationFrame(() => {
                        scrollInitiator = this.scrollerElement;
                        this.subscrollerElement.scrollTop = this.scrollerElement.scrollTop - this.subscrollerOffset;
                        if (lastScrollOveredGalleryItem !== null) {
                            lastScrollOveredGalleryItem.removeAttribute("data-overed");
                        }
                        updateOveredItem();
                    });
                }
            }
        });

        this.subscrollerElement.addEventListener("scroll", (event) => {
            if (!this.scrollerElement.hasAttribute("data-disabled")) {
                if (scrollInitiator == this.scrollerElement) {
                    scrollInitiator = null;
                    event.preventDefault();
                }
                else {
                    requestAnimationFrame(() => {
                        scrollInitiator = this.subscrollerElement;
                        this.scrollerElement.scrollTop = this.subscrollerElement.scrollTop + this.subscrollerOffset;
                    });
                }
            }
        });
    }

    setupInfiniteScrolling() {
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
                for (let entry of entries) {
                    if (entry.isIntersecting) {
                        const intersectingItem = this.items.find((item => item.itemWrapperElement == entry.target));
                        const intersectionSign = Math.sign(entry.boundingClientRect.x);
                        if (this.items_prev.includes(intersectingItem) && intersectionSign == -1) {
                            if (this.items_next.length > 0) {
                                const itemsWrappersRange = document.createRange();
                                itemsWrappersRange.setStartBefore(this.items_next[0].itemWrapperElement);
                                itemsWrappersRange.setEndAfter(this.items_next[this.items_next.length - 1].itemWrapperElement);

                                const subitemsRange = document.createRange();
                                subitemsRange.setStartBefore(this.items_next[0].subitemElement);
                                subitemsRange.setEndAfter(this.items_next[this.items_next.length - 1].subitemElement);

                                this.scrollerElement.prepend(itemsWrappersRange.extractContents());
                                this.subscrollerElement.prepend(subitemsRange.extractContents());

                                const curr_items = this.items_curr;
                                const prev_items = this.items_prev;
                                const next_items = this.items_next;
                                this.items_next = curr_items;
                                this.items_curr = prev_items;
                                this.items_prev = next_items;
                            }
                        }
                        else if (this.items_next.includes(intersectingItem) && intersectionSign == 1) {
                            if (this.items_prev.length > 0) {
                                const itemsWrappersRange = document.createRange();
                                itemsWrappersRange.setStartBefore(this.items_prev[0].itemWrapperElement);
                                itemsWrappersRange.setEndAfter(this.items_prev[this.items_prev.length - 1].itemWrapperElement);

                                const subitemsRange = document.createRange();
                                subitemsRange.setStartBefore(this.items_prev[0].subitemElement);
                                subitemsRange.setEndAfter(this.items_prev[this.items_next.length - 1].subitemElement);

                                this.scrollerElement.append(itemsWrappersRange.extractContents());
                                this.subscrollerElement.append(subitemsRange.extractContents());

                                const curr_items = this.items_curr;
                                const prev_items = this.items_prev;
                                const next_items = this.items_next;
                                this.items_prev = curr_items;
                                this.items_curr = next_items;
                                this.items_next = prev_items;
                            }
                        }
                    }
                }
            }
        };

        this.intersectionObserver = new IntersectionObserver(scrollerIntersectionObserverCallback, {
            root: this.scrollerElement
        });

        this.items.forEach((item) => {
            this.intersectionObserver.observe(item.itemWrapperElement);
        });
    }

    setupItemsCallbacks() {
        this.items.forEach((item) => {
            item.resizeObserver = new ResizeObserver((entries) => {
                for (let entry of entries) {
                    const clientRect = entry.target.getBoundingClientRect();
                    item.itemWrapperElement.style.setProperty("--width",  `${clientRect.width}px`);
                    item.itemWrapperElement.style.setProperty("--height",  `${clientRect.height}px`);
                    item.subitemElement.style.setProperty("--width", `${clientRect.width}px`);
                    item.subitemElement.style.setProperty("--height", `${clientRect.height}px`);
                }
            });
            item.resizeObserver.observe(item.itemElement);

            item.itemWrapperElement.addEventListener("mouseover", () => {
                if (!item.itemWrapperElement.hasAttribute("data-overed")) {
                    item.itemWrapperElement.setAttribute("data-overed", "");
                }
            });
            item.itemWrapperElement.addEventListener("mouseout", (event) => {
                if (!item.itemWrapperElement.contains(event.relatedTarget)) {
                    item.itemWrapperElement.removeAttribute("data-overed");
                }
            });
        });
    }
}

class Project {
    constructor(gallery, name, hash, imgs, lang) {
        this.gallery = gallery;
        this.name = name;
        this.hash = hash;
        this.imgs = imgs;
        this.lang = lang;

        this.projectElement = domParser.parseFromString(/*html*/`
            <main id="${this.name}" class="project">
                <section class="project-details">
                    ${(() => {
                        let createLangDetails = (lang) => {
                            let langContent = this.lang[lang];
                            return /*html*/`
                                <div lang="${lang}">
                                    <h1>${langContent.title || ""}</h1>
                                    <h2>${langContent.subtitle || ""}</h2>
                                    <p lang="${lang}">${langContent.description || ""}</p>
                                </div>`;
                        };
                        return (typeof this.lang === "object") ? Object.keys(this.lang).reduce((acc, lang) => acc + createLangDetails(lang), "") : "";
                    })()}
                    <a href="#${this.gallery.hash}" class="gallery-anchor"></a>
                </section>
                <div class="project-content">
                    ${(() => {
                        let createImgElement = (img) => {
                            let extension = img.substr(img.length - 3);
                            switch (extension) {
                                case "jpg":
                                case "png":
                                case "gif":
                                    return /*html*/`<img class="project-item" src="${contentRoot}${this.gallery.name}/projects/${this.name}/${img}"/>`;
                                case "mov":
                                case "mp4":
                                    return /*html*/`
                                    <video class="project-item" controls>
                                        <source type="video/${extension == "mp4" ? "mp4" : "quicktime"}" src="${contentRoot}${this.gallery.name}/projects/${this.name}/${img}"></source>
                                    </video>`;
                            }
                        }
                        return (Array.isArray(this.imgs)) ? this.imgs.reduce((acc, img) => acc + createImgElement(img), "") : "";
                    })()}
                    <div class="project-content-bottom"></div>
                </div>
            </main>
        `, "text/html").body.firstChild;

        this.imgsElements = this.projectElement.querySelectorAll("img, video");
    }

    setupImgsCallbacks() {
        const imgsResizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const clientRect = entry.target.getBoundingClientRect();
                entry.target.style.setProperty("--width",  `${clientRect.width}px`);
                entry.target.style.setProperty("--height",  `${clientRect.height}px`);
            }
        });
        this.imgsElements.forEach((img) => {
            imgsResizeObserver.observe(img);
        });
    }
}