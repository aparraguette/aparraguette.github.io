const domParser = new DOMParser();

class Router {
    constructor() {
        this.handlers = new Map();
    }
    
    registerRouteHandlers(regexp, handlers) {
        this.handlers.set(regexp, handlers);
    }
    
    getRouteHandlers(route) {
        let handlers = [];
        let keys = this.handlers.keys();
        let next = keys.next();
        while (!next.done) {
            let value = next.value;
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
    constructor(gallery, img, hash, project, pos) {
        this.gallery = gallery;
        this.img = img;
        this.hash = hash;
        this.project = project;
        this.pos = pos;
        this.resizeObserver = null;
        this.intersectionObserver = null;

        this.itemWrapperElement = domParser.parseFromString(/*html*/`
            <div class="gallery-item-wrapper" data-hash="${this.hash}" data-pos="${this.pos}" style="--data-color: ${this.project.color}">
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
            <div class="gallery-subitem" data-pos="${this.pos}" data-hash="${this.hash}" style="--data-color: ${this.project.color}"></div>
        `, "text/html").body.firstChild;
    }
}

class Gallery {
    constructor(name, hash, items, projects) {
        this.name = name;
        this.hash = hash;
        this.items = [
            ...items.map(item => new GalleryItem(this, item.img, item.hash, projects.find((project) => project.hash === item.hash), -1)),
            ...items.map(item => new GalleryItem(this, item.img, item.hash, projects.find((project) => project.hash === item.hash),  0)),
            ...items.map(item => new GalleryItem(this, item.img, item.hash, projects.find((project) => project.hash === item.hash), +1))
        ];
        this.projects = [];
        this.intersectionObserver = null;
        
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

        this.scrollerElement.addEventListener("scroll", (event) => {
            if (scrollInitiator == this.subscrollerElement) {
                scrollInitiator = null;
                event.preventDefault();
                return false;
            }
            requestAnimationFrame(() => {
                scrollInitiator = this.scrollerElement;
                this.subscrollerElement.scrollTop = this.scrollerElement.scrollTop;
                if (lastScrollOveredGalleryItem !== null) {
                    lastScrollOveredGalleryItem.removeAttribute("data-overed");
                }
                let scrollOveredGalleryItem = document.elementsFromPoint(mousePosition.x, mousePosition.y)
                    .find(el => el.matches(".gallery-item-wrapper"));
                if (scrollOveredGalleryItem) {
                    scrollOveredGalleryItem.setAttribute("data-overed", "");
                    lastScrollOveredGalleryItem = scrollOveredGalleryItem;
                }
            });
        });

        this.subscrollerElement.addEventListener("scroll", (event) => {
            if (scrollInitiator == this.scrollerElement) {
                scrollInitiator = null;
                event.preventDefault();
                return;
            }
            requestAnimationFrame(() => {
                scrollInitiator = this.subscrollerElement;
                this.scrollerElement.scrollTop = this.subscrollerElement.scrollTop;
            });
        });
    }

    setupInfiniteScrolling() {
        const scrollerIntersectionObserverCallback = (entries) => {
            if (!this.scrollerElement.hasAttribute("data-disabled")) {
                for (let entry of entries) {
                    if (entry.isIntersecting) {
                        let intersectingItem = this.items.find((item => item.itemWrapperElement == entry.target));
                        let intersectionSign = Math.sign(entry.boundingClientRect.x);
                        if (intersectingItem) {
                            let sameHashItems = this.items.filter(item => item.hash == intersectingItem.hash);
                            if (intersectingItem.itemWrapperElement.dataset.pos == -1 && intersectionSign == -1) {
                                let currPosItem = sameHashItems.find((item => item.itemWrapperElement.dataset.pos == 0));
                                let nextPosItem = sameHashItems.find((item => item.itemWrapperElement.dataset.pos == 1));
                                if (currPosItem) {
                                    currPosItem.itemWrapperElement.dataset.pos = 1;
                                    currPosItem.subitemElement.dataset.pos = 1;
                                }
                                if (nextPosItem) {
                                    nextPosItem.itemWrapperElement.dataset.pos = -1;
                                    nextPosItem.subitemElement.dataset.pos = -1;
                                    this.scrollerElement.insertAdjacentElement("afterbegin", nextPosItem.itemWrapperElement);
                                    this.subscrollerElement.insertAdjacentElement("afterbegin", nextPosItem.subitemElement);
                                }
                                intersectingItem.itemWrapperElement.dataset.pos = 0;
                                intersectingItem.subitemElement.dataset.pos = 0;
                            }
                            else if (intersectingItem.itemWrapperElement.dataset.pos == 1 && intersectionSign == 1) {
                                let currPosItem = sameHashItems.find((item => item.itemWrapperElement.dataset.pos == 0));
                                let prevPosItem = sameHashItems.find((item => item.itemWrapperElement.dataset.pos == -1));
                                if (currPosItem) {
                                    currPosItem.itemWrapperElement.dataset.pos = -1;
                                    currPosItem.subitemElement.dataset.pos = -1;
                                }
                                if (prevPosItem) {
                                    prevPosItem.itemWrapperElement.dataset.pos = 1;
                                    prevPosItem.subitemElement.dataset.pos = 1;
                                    this.scrollerElement.insertAdjacentElement("beforeend", prevPosItem.itemWrapperElement);
                                    this.subscrollerElement.insertAdjacentElement("beforeend", prevPosItem.subitemElement);
                                }
                                intersectingItem.itemWrapperElement.dataset.pos = 0;
                                intersectingItem.subitemElement.dataset.pos = 0;
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
                    let clientRect = entry.target.getBoundingClientRect();
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
                    <a href="#${this.gallery.hash}" class="gallery-anchor desktop"></a>
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
                let clientRect = entry.target.getBoundingClientRect();
                entry.target.style.setProperty("--width",  `${clientRect.width}px`);
                entry.target.style.setProperty("--height",  `${clientRect.height}px`);
            }
        });
        this.imgsElements.forEach((img) => {
            imgsResizeObserver.observe(img);
        });
    }
}