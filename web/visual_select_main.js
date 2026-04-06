import { app } from "../../scripts/app.js";

console.log("🚀 [Visual_Select] Extension script starting to load!");

const cssUrl = new URL("./css/model_preview.css", import.meta.url).href;
const link = document.createElement("link");
link.rel = "stylesheet";
link.type = "text/css";
link.href = cssUrl;
document.head.appendChild(link);

console.log("🚀 [Visual_Select] CSS loaded:", cssUrl);

const MODEL_EXTENSIONS = [".safetensors", ".ckpt", ".pt", ".pth", ".gguf", ".sft"];

// Initialize global config
window._vs_config = {
    enabled: true,
    intercept_types: "ckpt,model,lora,vae,unet,controlnet,checkpoint",
    intercept_excludes: "model_type",
    language: "zh-CN",
    nsfw_blur: true,
    replace_zoom_preview: false,
};

// I18n strings
const I18N = {
    "en-US": {
        selectModel: "Select Model",
        browser: "Browser",
        searchPlaceholder: "Search by filename or model name...",
        allBaseModels: "All Base Models",
        allFpFormats: "All FP formats",
        allContent: "All Content",
        sfwOnly: "SFW Only",
        nsfwOnly: "NSFW Only",
        nsfwBlur: "Blur NSFW",
        loading: "Loading models...",
        noModels: "No models match the criteria",
        noImage: "No Image",
        details: "Details",
        note: "Notes",
        notesTitle: "Notes",
        add: "Add",
        del: "Delete",
        copy: "Copy",
        emptyNotes: "No notes yet",
        select: "Select",
        all: "All",
        withInfo: "With Info",
        noInfo: "No Info",
        modelDetails: "Model Details",
        floatingBtn: "🎨 Visual Select",
        errorLoading: "Error loading models."
    },
    "zh-CN": {
        selectModel: "选择模型",
        browser: "模型浏览",
        searchPlaceholder: "按文件名或模型名称搜索...",
        allBaseModels: "所有基础模型",
        allFpFormats: "所有精度",
        allContent: "所有内容",
        sfwOnly: "仅安全内容 (SFW)",
        nsfwOnly: "仅成人内容 (NSFW)",
        nsfwBlur: "NSFW 模糊",
        loading: "加载模型中...",
        noModels: "没有符合条件的模型",
        noImage: "无图片",
        details: "详情",
        note: "备注",
        notesTitle: "备注",
        add: "新增",
        del: "删除",
        copy: "复制",
        emptyNotes: "暂无备注",
        select: "选择",
        all: "全部",
        withInfo: "有信息",
        noInfo: "无信息",
        modelDetails: "模型详情",
        floatingBtn: "🎨 视图选择",
        errorLoading: "加载模型失败。"
    }
};

function t(key) {
    const lang = window._vs_config.language === "en-US" ? "en-US" : "zh-CN";
    return I18N[lang][key] || key;
}

// Fetch backend config on load to support incognito mode persistence
fetch("/visual_select/config")
    .then(r => r.json())
    .then(cfg => {
        window._vs_config = cfg;
        // Sync ComfyUI settings UI with backend config
        try {
            if (app.extensionManager?.settings) {
                app.extensionManager.settings.set("VisualSelect.Settings.Enabled", cfg.enabled);
                app.extensionManager.settings.set("VisualSelect.Settings.InterceptTypes", cfg.intercept_types);
                app.extensionManager.settings.set("VisualSelect.Settings.InterceptExcludes", cfg.intercept_excludes);
                app.extensionManager.settings.set("VisualSelect.Settings.Language", cfg.language);
                app.extensionManager.settings.set("VisualSelect.Settings.ReplaceZoomPreview", cfg.replace_zoom_preview);
            } else if (app.ui && app.ui.settings) {
                app.ui.settings.setSettingValue("VisualSelect.Settings.Enabled", cfg.enabled);
                app.ui.settings.setSettingValue("VisualSelect.Settings.InterceptTypes", cfg.intercept_types);
                app.ui.settings.setSettingValue("VisualSelect.Settings.InterceptExcludes", cfg.intercept_excludes);
                app.ui.settings.setSettingValue("VisualSelect.Settings.Language", cfg.language);
                app.ui.settings.setSettingValue("VisualSelect.Settings.ReplaceZoomPreview", cfg.replace_zoom_preview);
            }
        } catch(e) {}
    })
    .catch(e => console.error("[Visual_Select] Error loading backend config", e));

function _vsIsElementVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 5 && rect.height > 5;
}

function _vsFindLargestMediaWithin(rootEl) {
    if (!rootEl) return null;
    const media = Array.from(rootEl.querySelectorAll("img, video"));
    let best = null;
    let bestArea = 0;
    for (const el of media) {
        if (!_vsIsElementVisible(el)) continue;
        const src = (el.currentSrc || el.src || "").trim();
        if (!src) continue;
        const rect = el.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (area > bestArea) {
            bestArea = area;
            best = el;
        }
    }
    return best;
}

function _vsFindMediaFromZoomButton(btn) {
    const btnRect = btn.getBoundingClientRect();
    const btnCx = btnRect.left + btnRect.width / 2;
    const btnCy = btnRect.top + btnRect.height / 2;
    let cur = btn;
    for (let i = 0; i < 5 && cur; i++) {
        if (cur === document.body || cur === document.documentElement) break;
        const candidate = _vsFindLargestMediaWithin(cur);
        if (candidate) {
            const r = candidate.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const dist = Math.hypot(cx - btnCx, cy - btnCy);
            if (dist <= 420) return candidate;
        }
        cur = cur.parentElement;
    }
    return null;
}

function _vsEnsureZoomViewer() {
    if (window.__vsZoomViewer) return window.__vsZoomViewer;

    const overlay = document.createElement("div");
    overlay.className = "vs-imgviewer-overlay";
    overlay.innerHTML = `
        <div class="vs-imgviewer-close" role="button" tabindex="0">&times;</div>
        <div class="vs-imgviewer-stage">
            <img class="vs-imgviewer-media" draggable="false" />
            <video class="vs-imgviewer-media" controls autoplay loop draggable="false"></video>
        </div>
    `;

    const imgEl = overlay.querySelector("img.vs-imgviewer-media");
    const vidEl = overlay.querySelector("video.vs-imgviewer-media");
    const stageEl = overlay.querySelector(".vs-imgviewer-stage");
    const closeEl = overlay.querySelector(".vs-imgviewer-close");

    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let activePointerId = null;
    let startX = 0;
    let startY = 0;
    let rafPending = false;

    function activeMediaEl() {
        return imgEl.style.display === "block" ? imgEl : vidEl;
    }

    function updateTransform() {
        const m = activeMediaEl();
        m.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
    }

    function scheduleTransform() {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
            rafPending = false;
            updateTransform();
        });
    }

    function resetTransform() {
        scale = 1;
        translateX = 0;
        translateY = 0;
        updateTransform();
    }

    function close() {
        overlay.remove();
        imgEl.src = "";
        vidEl.pause();
        vidEl.src = "";
        document.removeEventListener("keydown", onKeyDown, true);
    }

    function onKeyDown(e) {
        if (e.key === "Escape") {
            e.preventDefault();
            close();
        }
    }

    function startDrag(e) {
        if (activePointerId !== null && activePointerId !== e.pointerId) return;
        isDragging = true;
        activePointerId = e.pointerId;
        try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        activeMediaEl().style.cursor = "grabbing";
        e.preventDefault();
        e.stopPropagation();
    }

    function doDrag(e) {
        if (!isDragging || activePointerId === null || e.pointerId !== activePointerId) return;
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        scheduleTransform();
        e.preventDefault();
        e.stopPropagation();
    }

    function stopDrag(e) {
        if (!isDragging) return;
        if (activePointerId !== null && e && e.pointerId !== activePointerId) return;
        isDragging = false;
        activePointerId = null;
        activeMediaEl().style.cursor = "grab";
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    overlay.addEventListener("wheel", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const nextScale = Math.min(Math.max(0.1, scale + delta), 10);
        scale = nextScale;
        scheduleTransform();
    }, { passive: false });

    imgEl.addEventListener("pointerdown", startDrag);
    vidEl.addEventListener("pointerdown", startDrag);
    imgEl.addEventListener("pointermove", doDrag);
    vidEl.addEventListener("pointermove", doDrag);
    imgEl.addEventListener("pointerup", stopDrag);
    vidEl.addEventListener("pointerup", stopDrag);
    imgEl.addEventListener("pointercancel", stopDrag);
    vidEl.addEventListener("pointercancel", stopDrag);
    imgEl.ondragstart = (e) => e.preventDefault();
    vidEl.ondragstart = (e) => e.preventDefault();

    closeEl.addEventListener("click", (e) => { e.preventDefault(); close(); });
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay || e.target === stageEl) {
            e.preventDefault();
            close();
        }
    });

    function open({ src, kind }) {
        document.body.appendChild(overlay);
        document.addEventListener("keydown", onKeyDown, true);

        resetTransform();
        if (kind === "video") {
            vidEl.src = src;
            vidEl.style.display = "block";
            imgEl.style.display = "none";
            imgEl.src = "";
        } else {
            imgEl.src = src;
            imgEl.style.display = "block";
            vidEl.style.display = "none";
            vidEl.pause();
            vidEl.src = "";
        }
        activeMediaEl().style.cursor = "grab";
    }

    window.__vsZoomViewer = { open, close };
    return window.__vsZoomViewer;
}

function _vsInstallZoomPreviewInterceptor() {
    if (window.__vsZoomPreviewInterceptorInstalled) return;
    window.__vsZoomPreviewInterceptorInstalled = true;
    console.log("[Visual_Select][ZoomPreview] interceptor installed");

    document.addEventListener("click", (e) => {
        if (!window._vs_config?.replace_zoom_preview) return;

        const targetEl = e.target instanceof Element ? e.target : null;
        let btn = targetEl?.closest?.('button[aria-label="Zoom in"],button[aria-label="Zoom"],button[aria-label="Preview"]') || null;
        if (!btn) {
            const zoomIconEl = targetEl?.closest?.('i[class*="lucide--zoom-in"],i[class*="lucide--zoom"]') || null;
            btn = zoomIconEl?.closest?.("button") || null;
        }
        if (!btn) return;

        const ariaLabel = btn.getAttribute("aria-label") || "";
        const hasZoomIcon = !!btn.querySelector?.('i[class*="lucide--zoom-in"],i[class*="lucide--zoom"]');
        if (!hasZoomIcon && ariaLabel.toLowerCase() !== "zoom in") {
            console.debug("[Visual_Select][ZoomPreview] matched button but not zoom icon/label", { ariaLabel });
            return;
        }

        console.debug("[Visual_Select][ZoomPreview] click intercepted", { ariaLabel });

        const media = _vsFindMediaFromZoomButton(btn);
        if (!media) {
            const ancestors = [];
            let cur = btn;
            for (let i = 0; i < 8 && cur; i++) {
                ancestors.push(cur.tagName.toLowerCase() + (cur.className ? "." + String(cur.className).split(/\s+/).filter(Boolean).slice(0, 3).join(".") : ""));
                cur = cur.parentElement;
            }
            console.debug("[Visual_Select][ZoomPreview] no media found near button", { ariaLabel, ancestors });
            return;
        }

        const src = (media.currentSrc || media.src || "").trim();
        if (!src) {
            console.debug("[Visual_Select][ZoomPreview] media found but empty src", { tag: media.tagName.toLowerCase() });
            return;
        }

        e.preventDefault();
        e.stopImmediatePropagation();

        const kind = media.tagName.toLowerCase() === "video" ? "video" : "image";
        console.debug("[Visual_Select][ZoomPreview] opening viewer", { kind, src });
        _vsEnsureZoomViewer().open({ src, kind });
    }, true);
}

function isModelWidget(widget) {
    if (!widget || widget.type !== "combo") return false;

    if (!window._vs_config.enabled) {
        return false;
    }

    // 1. Fallback check first (Widget name) - This handles cases where options are loaded asynchronously
    const name = (widget.name || "").toLowerCase();
    
    let excludesStr = window._vs_config.intercept_excludes || "model_type";
    let excludes = excludesStr.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
    if (excludes.some(ex => name.includes(ex))) {
        return false;
    }
    
    let interceptConfigStr = window._vs_config.intercept_types || "ckpt,model,lora,vae,unet,controlnet,checkpoint";
    
    let interceptTypes = interceptConfigStr.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
    if (interceptTypes.length === 0) {
        interceptTypes = ["ckpt", "model", "lora", "vae", "unet", "controlnet", "checkpoint"];
    }
    
    if (interceptTypes.some(type => name.includes(type))) {
        return true;
    }

    // 2. Check if it contains common model extensions (if options are already loaded)
    if (widget.options && widget.options.values && widget.options.values.length > 0) {
        const hasExt = widget.options.values.some(v => typeof v === 'string' && MODEL_EXTENSIONS.some(ext => v.toLowerCase().endsWith(ext)));
        if (hasExt) return true;
    }
    
    return false;
}

let currentDialog = null;

function closeDialog() {
    if (currentDialog) {
        document.body.removeChild(currentDialog);
        currentDialog = null;
    }
}

function showDetailsDialog(name) {
    const encodedName = encodeURIComponent(name);
    const url = `/visual_select/preview?name=${encodedName}&format=html`;
    
    const dialog = document.createElement("div");
    dialog.className = "vs-details-dialog";
    dialog.innerHTML = `
        <div class="vs-overlay"></div>
        <div class="vs-modal vs-modal-large">
            <div class="vs-header">
                <h2>${t('modelDetails')}: ${name.split('/').pop()}</h2>
                <div class="vs-close">&times;</div>
            </div>
            <div class="vs-body vs-body-no-padding">
                <iframe src="${url}" class="vs-iframe" frameborder="0"></iframe>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    dialog.querySelector(".vs-close").onclick = () => document.body.removeChild(dialog);
    dialog.querySelector(".vs-overlay").onclick = () => document.body.removeChild(dialog);
}

function _escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function _cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
        return window.CSS.escape(value);
    }
    return String(value).replaceAll('"', '\\"');
}

function _copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
    }
    const ta = document.createElement("textarea");
    ta.value = text || "";
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand("copy");
    } finally {
        document.body.removeChild(ta);
    }
    return Promise.resolve();
}

async function showNotesDialog(modelPath, displayName) {
    const encodedName = encodeURIComponent(modelPath);
    const type = window._vs_current_model_type || "";
    const encodedType = encodeURIComponent(type);
    const url = `/visual_select/notes?name=${encodedName}&type=${encodedType}`;

    const dialog = document.createElement("div");
    dialog.className = "vs-notes-dialog";
    dialog.innerHTML = `
        <div class="vs-overlay"></div>
        <div class="vs-modal vs-modal-large">
            <div class="vs-header">
                <h2>📝 ${t('notesTitle')}: ${_escapeHtml(displayName || modelPath.split('/').pop())}</h2>
                <div class="vs-close">&times;</div>
            </div>
            <div class="vs-notes-toolbar">
                <button class="vs-details-btn vs-notes-add">${t('add')}</button>
                <button class="vs-note-btn vs-notes-del" disabled>${t('del')}</button>
            </div>
            <div class="vs-notes-body">
                <div class="vs-notes-top">
                    <div class="vs-notes-list"></div>
                    <div class="vs-notes-editor">
                        <input class="vs-note-title-input" type="text" />
                        <div class="vs-note-content-wrap">
                            <textarea class="vs-note-content-input"></textarea>
                            <button class="vs-note-copy-btn" title="${t('copy')}" type="button" aria-label="${t('copy')}">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm4 4H8c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 18H8V7h12v16z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="vs-notes-preview"></div>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    const close = () => document.body.removeChild(dialog);
    dialog.querySelector(".vs-close").onclick = close;
    dialog.querySelector(".vs-overlay").onclick = close;

    const listEl = dialog.querySelector(".vs-notes-list");
    const addBtn = dialog.querySelector(".vs-notes-add");
    const delBtn = dialog.querySelector(".vs-notes-del");
    const titleInput = dialog.querySelector(".vs-note-title-input");
    const contentInput = dialog.querySelector(".vs-note-content-input");
    const copyBtn = dialog.querySelector(".vs-note-copy-btn");
    const previewEl = dialog.querySelector(".vs-notes-preview");

    const state = {
        items: [],
        selectedId: null,
        saving: false,
        dragId: null
    };

    function renderList() {
        listEl.innerHTML = "";
        if (!state.items.length) {
            const empty = document.createElement("div");
            empty.className = "vs-notes-empty";
            empty.innerText = t("emptyNotes");
            listEl.appendChild(empty);
        } else {
            for (const item of state.items) {
                const row = document.createElement("div");
                row.className = "vs-notes-item" + (item.id === state.selectedId ? " active" : "");
                row.setAttribute("data-id", item.id);
                row.setAttribute("draggable", "true");
                row.innerText = item.title || "";
                row.onclick = () => {
                    state.selectedId = item.id;
                    renderAll();
                };
                row.ondragstart = (e) => {
                    state.dragId = item.id;
                    try {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", item.id);
                    } catch (err) {}
                    row.classList.add("dragging");
                };
                row.ondragend = () => {
                    state.dragId = null;
                    listEl.querySelectorAll(".vs-notes-item.dragging").forEach(el => el.classList.remove("dragging"));
                    listEl.querySelectorAll(".vs-notes-item.drag-over").forEach(el => el.classList.remove("drag-over"));
                };
                row.ondragover = (e) => {
                    e.preventDefault();
                    row.classList.add("drag-over");
                    try { e.dataTransfer.dropEffect = "move"; } catch (err) {}
                };
                row.ondragleave = () => {
                    row.classList.remove("drag-over");
                };
                row.ondrop = async (e) => {
                    e.preventDefault();
                    row.classList.remove("drag-over");
                    const fromId = state.dragId || (() => {
                        try { return e.dataTransfer.getData("text/plain"); } catch (err) { return ""; }
                    })();
                    const toId = item.id;
                    if (!fromId || fromId === toId) return;
                    const fromIndex = state.items.findIndex(x => x.id === fromId);
                    const toIndex = state.items.findIndex(x => x.id === toId);
                    if (fromIndex === -1 || toIndex === -1) return;

                    const next = state.items.slice();
                    const [moved] = next.splice(fromIndex, 1);
                    const insertIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
                    next.splice(insertIndex, 0, moved);
                    state.items = next;
                    renderAll();
                    await saveNotes();
                };
                listEl.appendChild(row);
            }
        }
        delBtn.disabled = !state.selectedId;
    }

    function renderPreview() {
        previewEl.innerHTML = "";
        if (!state.items.length) {
            const empty = document.createElement("div");
            empty.className = "vs-notes-preview-empty";
            empty.innerText = t("emptyNotes");
            previewEl.appendChild(empty);
            return;
        }

        for (const item of state.items) {
            const wrap = document.createElement("div");
            wrap.className = "vs-notes-preview-item" + (item.id === state.selectedId ? " active" : "");
            wrap.setAttribute("data-id", item.id);
            wrap.onclick = () => {
                state.selectedId = item.id;
                renderAll();
            };

            const title = document.createElement("div");
            title.className = "vs-notes-preview-title";
            title.innerText = item.title || "";

            const content = document.createElement("div");
            content.className = "vs-notes-preview-content";
            content.innerText = item.content || "";

            wrap.appendChild(title);
            wrap.appendChild(content);
            previewEl.appendChild(wrap);
        }
    }

    function selectedItem() {
        if (!state.selectedId) return null;
        return state.items.find(i => i.id === state.selectedId) || null;
    }

    function renderEditor() {
        const item = selectedItem();
        if (!item) {
            titleInput.value = "";
            contentInput.value = "";
            titleInput.disabled = true;
            contentInput.disabled = true;
            copyBtn.disabled = true;
            return;
        }
        titleInput.disabled = false;
        contentInput.disabled = false;
        copyBtn.disabled = false;
        titleInput.value = item.title || "";
        contentInput.value = item.content || "";
    }

    function renderAll() {
        renderList();
        renderEditor();
        renderPreview();
    }

    async function saveNotes() {
        if (state.saving) return;
        state.saving = true;
        try {
            await fetch("/visual_select/notes", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    name: modelPath,
                    type,
                    items: state.items
                })
            });
        } finally {
            state.saving = false;
        }
    }

    addBtn.onclick = async () => {
        const id = String(Date.now()) + "_" + Math.random().toString(16).slice(2);
        const newItem = {id, title: t("note"), content: ""};
        state.items = [newItem, ...state.items];
        state.selectedId = id;
        renderAll();
        titleInput.focus();
        titleInput.select();
        await saveNotes();
    };

    delBtn.onclick = async () => {
        if (!state.selectedId) return;
        state.items = state.items.filter(i => i.id !== state.selectedId);
        state.selectedId = state.items.length ? state.items[0].id : null;
        renderAll();
        await saveNotes();
    };

    titleInput.addEventListener("input", () => {
        const item = selectedItem();
        if (!item) return;
        item.title = titleInput.value;
        const row = listEl.querySelector(`.vs-notes-item[data-id="${_cssEscape(item.id)}"]`);
        if (row) row.innerText = item.title || "";
        const p = previewEl.querySelector(`.vs-notes-preview-item[data-id="${_cssEscape(item.id)}"] .vs-notes-preview-title`);
        if (p) p.innerText = item.title || "";
    });

    contentInput.addEventListener("input", () => {
        const item = selectedItem();
        if (!item) return;
        item.content = contentInput.value;
        const p = previewEl.querySelector(`.vs-notes-preview-item[data-id="${_cssEscape(item.id)}"] .vs-notes-preview-content`);
        if (p) p.innerText = item.content || "";
    });

    titleInput.addEventListener("blur", saveNotes);
    contentInput.addEventListener("blur", saveNotes);

    copyBtn.onclick = async () => {
        const item = selectedItem();
        if (!item) return;
        await _copyToClipboard(item.content || "");
    };

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data && Array.isArray(data.items)) {
            state.items = data.items;
        } else {
            state.items = [];
        }
        state.selectedId = state.items.length ? state.items[0].id : null;
    } catch (e) {
        state.items = [];
        state.selectedId = null;
    }

    renderAll();
}

function buildUI(dialog, widget, node, models, info) {
    dialog.querySelector(".vs-loading").style.display = "none";
    
    // Parse folders
    const folders = new Set();
    folders.add("/"); // root
    
    const modelData = [];
    for (const model of models) {
        if (typeof model !== "string") continue;
        let folder = "/";
        let name = model;
        const lastSlash = Math.max(model.lastIndexOf("/"), model.lastIndexOf("\\"));
        if (lastSlash !== -1) {
            folder = model.substring(0, lastSlash);
            name = model.substring(lastSlash + 1);
            folders.add(folder);
            
            // Add parent folders too
            let parentFolder = folder;
            while (true) {
                const parentSlash = Math.max(parentFolder.lastIndexOf("/"), parentFolder.lastIndexOf("\\"));
                if (parentSlash !== -1) {
                    parentFolder = parentFolder.substring(0, parentSlash);
                    folders.add(parentFolder);
                } else {
                    break;
                }
            }
        }
        const modelInfo = info[model] || {has_image: false, has_html: false, civitai_name: null};
        const hasAnyInfo = modelInfo.has_image || modelInfo.has_html || modelInfo.civitai_name;
        
        modelData.push({
            fullPath: model,
            folder: folder,
            name: name,
            info: modelInfo,
            hasAnyInfo: hasAnyInfo
        });
    }
    
    // Sort folders alphabetically
    const sortedFolders = Array.from(folders).sort((a, b) => a.localeCompare(b));
    
    const treeEl = dialog.querySelector(".vs-folder-tree");
    const gridEl = dialog.querySelector(".vs-grid");
    
    // Top bar elements
    const searchInput = dialog.querySelector(".vs-search-input");
    const basemodelSelect = dialog.querySelector("#vs-basemodel-filter");
    const fpSelect = dialog.querySelector("#vs-fp-filter");
    const nsfwSelect = dialog.querySelector("#vs-nsfw-filter");
    const nsfwBlurToggle = dialog.querySelector("#vs-nsfw-blur-toggle");
    
    // Extract unique base models and fp formats
    const baseModels = new Set();
    const fpFormats = new Set();
    modelData.forEach(m => {
        if (m.info.base_model) baseModels.add(m.info.base_model);
        if (m.info.fp_format) fpFormats.add(m.info.fp_format);
    });
    
    Array.from(baseModels).sort().forEach(bm => {
        const opt = document.createElement("option");
        opt.value = bm;
        opt.innerText = bm;
        basemodelSelect.appendChild(opt);
    });
    
    Array.from(fpFormats).sort().forEach(fp => {
        const opt = document.createElement("option");
        opt.value = fp;
        opt.innerText = fp;
        fpSelect.appendChild(opt);
    });
    
    let activeFolderEl = null;
    let currentFilter = 'all'; // 'all', 'with_info', 'without_info'
    let currentFolder = '/';
    
    function renderFolder() {
        gridEl.innerHTML = "";
        
        const searchTerm = searchInput.value.toLowerCase();
        const selectedBaseModel = basemodelSelect.value;
        const selectedFp = fpSelect.value;
        const selectedNsfw = nsfwSelect.value;
        const blurNsfw = window._vs_config.nsfw_blur !== false;
        
        let displayModels;
        if (currentFolder === '/') {
            // Root folder shows ALL models
            displayModels = modelData.slice();
        } else {
            // Other folders only show models exactly in that folder (or subfolders if desired, 
            // but exact match is usually better for specific folders, though we could do startsWith)
            displayModels = modelData.filter(m => m.folder === currentFolder || m.folder.startsWith(currentFolder + "/"));
        }
        
        // Apply sidebar filter
        if (currentFilter === 'with_info') {
            displayModels = displayModels.filter(m => m.hasAnyInfo);
        } else if (currentFilter === 'without_info') {
            displayModels = displayModels.filter(m => !m.hasAnyInfo);
        }
        
        // Apply top bar filters
        displayModels = displayModels.filter(m => {
            // Text Search
            let matchSearch = true;
            if (searchTerm) {
                const searchTarget = (m.name + " " + (m.info.civitai_name || "")).toLowerCase();
                matchSearch = searchTarget.includes(searchTerm);
            }
            if (!matchSearch) return false;
            
            // Base Model
            if (selectedBaseModel !== "all" && m.info.base_model !== selectedBaseModel) {
                return false;
            }
            
            // FP Format
            if (selectedFp !== "all" && m.info.fp_format !== selectedFp) {
                return false;
            }
            
            // NSFW
            if (selectedNsfw === "sfw" && m.info.is_nsfw) {
                return false;
            } else if (selectedNsfw === "nsfw" && !m.info.is_nsfw) {
                return false;
            }
            
            return true;
        });
        
        if (displayModels.length === 0) {
            gridEl.innerHTML = `<div class="vs-empty">${t('noModels')}</div>`;
            return;
        }
        
        for (const m of displayModels) {
            const card = document.createElement("div");
            card.className = "vs-card";
            
            let imgHtml = `<div class="vs-no-image">${t('noImage')}</div>`;
            if (m.info.has_image) {
                const encodedName = encodeURIComponent(m.fullPath);
                imgHtml = `<img src="/visual_select/preview?name=${encodedName}&format=image&type=${window._vs_current_model_type || ''}" alt="${m.name}" loading="lazy" />`;
            }
            
            let detailsBtn = "";
            if (m.info.has_html) {
                const encodedName = encodeURIComponent(m.fullPath);
                detailsBtn = `<button class="vs-details-btn" data-url="/visual_select/preview?name=${encodedName}&format=html&type=${window._vs_current_model_type || ''}">${t('details')}</button>`;
            }
            
            let displayName = m.name;
            let subNameHtml = '';
            if (m.info.civitai_name) {
                displayName = m.info.civitai_name;
                subNameHtml = `<div class="vs-card-filename" title="${m.name}">${m.name}</div>`;
            }
            
            let badgesHtml = '<div class="vs-badges">';
            if (m.info.base_model) {
                badgesHtml += `<span class="vs-badge vs-badge-model">${m.info.base_model}</span>`;
            }
            if (m.info.fp_format) {
                badgesHtml += `<span class="vs-badge vs-badge-fp">${m.info.fp_format}</span>`;
            }
            if (m.info.is_nsfw) {
                badgesHtml += `<span class="vs-badge vs-badge-nsfw">NSFW</span>`;
            }
            badgesHtml += '</div>';
            
            const actionRowHtml = `
                <div class="vs-card-actions-row">
                    <button class="vs-note-btn" data-name="${_escapeHtml(m.fullPath)}" data-display="${_escapeHtml(displayName)}">${t('note')}</button>
                    ${detailsBtn}
                </div>
            `;

            card.innerHTML = `
                <div class="vs-card-img${(blurNsfw && m.info.is_nsfw) ? ' vs-nsfw-blur' : ''}">${imgHtml}</div>
                <div class="vs-card-info-wrapper">
                    <div class="vs-card-name" title="${displayName}">${displayName}</div>
                    ${subNameHtml}
                    ${badgesHtml}
                </div>
                <div class="vs-card-actions">
                    <button class="vs-select-btn" data-name="${m.fullPath}">
                        ${t('select')}
                    </button>
                    ${actionRowHtml}
                </div>
            `;
            
            gridEl.appendChild(card);
        }
        
        // Bind events
        gridEl.querySelectorAll(".vs-select-btn").forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const name = e.target.getAttribute("data-name");
                widget.value = name;
                if (widget.callback) {
                    widget.callback(name, app.canvas, node, null, null);
                }
                app.graph.setDirtyCanvas(true, true);
                closeDialog();
            };
        });
        
        // Bind details button event
        gridEl.querySelectorAll(".vs-details-btn").forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const url = e.target.getAttribute("data-url");
                if (url) {
                    window.open(url, "_blank");
                }
            };
        });

        gridEl.querySelectorAll(".vs-note-btn").forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const name = btn.getAttribute("data-name");
                const display = btn.getAttribute("data-display");
                if (name) {
                    await showNotesDialog(name, display);
                }
            };
        });
        
        // Add double click on card image/name/filename to select
        gridEl.querySelectorAll(".vs-card-img, .vs-card-name, .vs-card-filename").forEach(el => {
            el.ondblclick = (e) => {
                const card = el.closest(".vs-card");
                const selectBtn = card.querySelector(".vs-select-btn");
                if (selectBtn) selectBtn.click();
            };
        });
    }
    
    // Render sidebar
    const filterContainer = document.createElement("div");
    filterContainer.className = "vs-filters";
    filterContainer.innerHTML = `
        <div class="vs-filter-btn active" data-filter="all">${t('all')}</div>
        <div class="vs-filter-btn" data-filter="with_info">${t('withInfo')}</div>
        <div class="vs-filter-btn" data-filter="without_info">${t('noInfo')}</div>
    `;
    treeEl.parentNode.insertBefore(filterContainer, treeEl);
    
    filterContainer.querySelectorAll('.vs-filter-btn').forEach(btn => {
        btn.onclick = (e) => {
            filterContainer.querySelectorAll('.vs-filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.getAttribute('data-filter');
            renderFolder();
        };
    });

    // Bind events to top bar filters
    searchInput.addEventListener("input", renderFolder);
    basemodelSelect.addEventListener("change", renderFolder);
    fpSelect.addEventListener("change", renderFolder);
    nsfwSelect.addEventListener("change", renderFolder);
    if (nsfwBlurToggle) {
        nsfwBlurToggle.checked = window._vs_config.nsfw_blur !== false;
        nsfwBlurToggle.addEventListener("change", () => {
            window._vs_config.nsfw_blur = nsfwBlurToggle.checked;
            fetch("/visual_select/config", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({nsfw_blur: window._vs_config.nsfw_blur})
            }).catch(e => console.error(e));
            renderFolder();
        });
    }

    for (const folder of sortedFolders) {
        const li = document.createElement("li");
        li.innerText = folder;
        li.className = "vs-folder-item";
        li.onclick = () => {
            if (activeFolderEl) activeFolderEl.classList.remove("active");
            li.classList.add("active");
            activeFolderEl = li;
            currentFolder = folder;
            renderFolder();
        };
        treeEl.appendChild(li);
        
        // Default select root (or first folder if root is empty, but we click root first)
        if (folder === "/") {
            li.click();
        }
    }
    
    // If root was empty but clicked, and we have other folders, maybe auto-select the first non-empty
    if (activeFolderEl && modelData.filter(m => m.folder === "/").length === 0 && sortedFolders.length > 1) {
        treeEl.children[1].click();
    }
}

// Global variables for tracking mouse
window._vs_mouseX = 0;
window._vs_mouseY = 0;
document.addEventListener('mousemove', e => {
    window._vs_mouseX = e.clientX;
    window._vs_mouseY = e.clientY;
});

let floatingBtn = null;
let floatingBtnTimeout = null;

function showFloatingButton(widget, node, forceType) {
    if (floatingBtn) {
        floatingBtn.remove();
        floatingBtn = null;
    }
    if (floatingBtnTimeout) {
        clearTimeout(floatingBtnTimeout);
        floatingBtnTimeout = null;
    }

    floatingBtn = document.createElement('div');
    floatingBtn.className = 'vs-floating-btn';
    floatingBtn.innerHTML = t('floatingBtn');
    floatingBtn.style.position = 'fixed';
    
    // Position it to the left of the mouse
    let leftPos = window._vs_mouseX - 140;
    if (leftPos < 0) leftPos = window._vs_mouseX + 20; // fallback to right if no space
    
    floatingBtn.style.left = leftPos + 'px';
    floatingBtn.style.top = (window._vs_mouseY - 15) + 'px';
    floatingBtn.style.zIndex = '9999999';
    // Base style: Light green
    floatingBtn.style.background = '#e6f7e6';
    floatingBtn.style.color = '#004400';
    floatingBtn.style.padding = '6px 12px';
    floatingBtn.style.border = '1px solid #90ee90';
    floatingBtn.style.borderRadius = '6px';
    floatingBtn.style.cursor = 'pointer';
    floatingBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
    floatingBtn.style.fontSize = '12px';
    floatingBtn.style.fontFamily = 'sans-serif';
    floatingBtn.style.transition = 'all 0.15s ease';

    floatingBtn.onmouseenter = () => {
        // Hover style: slightly darker green
        floatingBtn.style.background = '#ccf0cc';
        floatingBtn.style.borderColor = '#66cc66';
        floatingBtn.style.transform = 'scale(1.02)';
        floatingBtn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.4)';
    };
    floatingBtn.onmouseleave = () => {
        // Revert to base style
        floatingBtn.style.background = '#e6f7e6';
        floatingBtn.style.borderColor = '#90ee90';
        floatingBtn.style.transform = 'scale(1)';
        floatingBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
    };

    floatingBtn.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Active (click) style
        floatingBtn.style.background = '#90ee90';
        floatingBtn.style.transform = 'scale(0.98)';
        floatingBtn.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.2)';
    };

    floatingBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        floatingBtn.remove();
        floatingBtn = null;
        if (floatingBtnTimeout) clearTimeout(floatingBtnTimeout);

        if (window.LiteGraph && LiteGraph.closeAllContextMenus) {
            LiteGraph.closeAllContextMenus();
        }
        document.body.click();

        showAdvancedBrowser(widget, node, forceType);
    };

    document.body.appendChild(floatingBtn);

    // Auto-hide after 5 seconds
    floatingBtnTimeout = setTimeout(() => {
        if (floatingBtn) {
            floatingBtn.style.opacity = '0';
            setTimeout(() => { 
                if (floatingBtn) {
                    floatingBtn.remove(); 
                    floatingBtn = null; 
                }
            }, 300); // Wait for CSS transition (if any) before removing DOM
        }
    }, 5000);
}

document.addEventListener('mousedown', (e) => {
    // LiteGraph canvas click handler removed, relying on 5s auto-hide instead
}, true);

function injectWidget(w, node) {
    if (isModelWidget(w) && !w._vs_injected) {
        // We no longer rely on w.mouse because combo widgets don't trigger it in LiteGraph.
        // Handled by LiteGraph.ContextMenu override and global mousedown listener instead.
        
        // HOWEVER, for PromptAssistant compatibility, some widgets might be wrapped.
        // Let's also attach a custom event listener to the element if it exists
        if (w.element || w.inputEl) {
            const el = w.element || w.inputEl;
            el.addEventListener("mousedown", (e) => {
                if (e.button === 0) {
                    const wName = (w.name || "").toLowerCase();
                    let excludesStr = window._vs_config.intercept_excludes || "model_type";
                    let excludes = excludesStr.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
                    if (!excludes.some(ex => wName.includes(ex))) {
                        setTimeout(() => showFloatingButton(w, node, null), 10);
                    }
                }
            });
        }
        
        w._vs_injected = true;
        console.log("[Visual_Select] Successfully marked widget for tracking:", w.name);
    }
}

// Global mousedown listener for Node 2.0 Vue components and fallback for LiteGraph
document.addEventListener("mousedown", (e) => {
    if (!window._vs_config.enabled) return;

    // Detect if we clicked on a combo widget input area (works for both Vue and LiteGraph HTML elements)
    const comboEl = e.target.closest("select, input, .p-dropdown, .p-select, .comfy-multiline-input");
    
    // Fallback: Check if clicked inside a node to handle LiteGraph canvas clicks
    const nodeEl = e.target.closest(".comfy-node, .comfy-vue-node, [data-node-id]");
    
    if (comboEl || nodeEl) {
        if (app.graph) {
            let nodeId = null;
            if (nodeEl) {
                nodeId = nodeEl.getAttribute("data-node-id") || (nodeEl.id && nodeEl.id.replace("node-", ""));
            }
            
            // If we can't find node id from DOM, try to get active node from graph
            const node = nodeId ? app.graph.getNodeById(Number(nodeId)) : null;
            
            if (node) {
                // Find the specific widget that was clicked
                const widgetEl = e.target.closest("[data-widget-name], .p-field, .property-wrapper, .litemenu-entry");
                let targetWidget = null;
                
                if (widgetEl) {
                    const wName = widgetEl.getAttribute("data-widget-name") || (widgetEl.querySelector("label") ? widgetEl.querySelector("label").innerText.replace("*", "").trim() : "");
                    if (wName) {
                        targetWidget = node.widgets?.find(w => w.name === wName || w.name + ":" === wName || wName.includes(w.name));
                    }
                }
                
                // If DOM search failed (e.g., pure canvas click), try to find widget by mouse position
                if (!targetWidget && node.widgets) {
                    // This is a rough estimation for LiteGraph canvas clicks
                    const localY = e.offsetY || (e.clientY - node.pos[1]);
                    // Only check if we are in the widget area (below inputs/outputs)
                    if (localY > 30) {
                        for (const w of node.widgets) {
                            if (node.type === "VisualSelectModelBrowser" && w.name === "model_type") {
                                targetWidget = w;
                                break;
                            } else if (isModelWidget(w)) {
                                targetWidget = w;
                                break; // Just grab the first model widget we find for now
                            }
                        }
                    }
                }

                if (targetWidget) {
                    // Check exclusion for fallback clicks
                    const wName = (targetWidget.name || "").toLowerCase();
                    let excludesStr = window._vs_config.intercept_excludes || "model_type";
                    let excludes = excludesStr.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
                    
                    if (excludes.some(ex => wName.includes(ex))) {
                        // Do not show button for excluded widgets
                        return;
                    }

                    if (isModelWidget(targetWidget)) {
                        let forceType = null;
                        if (node.type === "VisualSelectModelBrowser") {
                            const typeWidget = node.widgets.find(w => w.name === "model_type");
                            if (typeWidget) forceType = typeWidget.value;
                        }
                        setTimeout(() => showFloatingButton(targetWidget, node, forceType), 50);
                    }
                }
            }
        }
    }
}, true);

async function showAdvancedBrowser(widget, node, forceType) {
    if (currentDialog) {
        closeDialog();
    }

    let type = forceType;
    let targetWidget = widget;
    let modelValues = widget.options?.values || [];
    let titleName = `${t('selectModel')}: ${widget.name}`;

    if (forceType) {
        titleName = `${t('browser')}: ${type}`;
        try {
            const res = await fetch(`/visual_select/get_models?type=${type}`);
            const models = await res.json();
            modelValues = models.map(m => m.name);
            if (widget.options) widget.options.values = modelValues;
        } catch(e) {
            console.error("Failed to load models for browser", e);
        }
    } else {
        // Try to infer type for image fetching fallback
        const wName = widget.name.toLowerCase();
        if (wName.includes("unet")) type = "unet";
        else if (wName.includes("clip")) type = "clip";
        else if (wName.includes("lora")) type = "loras";
        else if (wName.includes("vae")) type = "vae";
        else if (wName.includes("control")) type = "controlnet";
        else type = "checkpoints";
    }

    const dialog = document.createElement("div");
    dialog.className = "visual-select-dialog vs-dialog";
    
    dialog.innerHTML = `
        <div class="vs-overlay"></div>
        <div class="vs-modal">
            <div class="vs-header">
                <h2>🎨 ${titleName}</h2>
                <div class="vs-close">&times;</div>
            </div>
            <div class="vs-toolbar">
                <input type="text" class="vs-search-input" placeholder="${t('searchPlaceholder')}" />
                <select class="vs-filter-select" id="vs-basemodel-filter">
                    <option value="all">${t('allBaseModels')}</option>
                </select>
                <select class="vs-filter-select" id="vs-fp-filter">
                    <option value="all">${t('allFpFormats')}</option>
                </select>
                <select class="vs-filter-select" id="vs-nsfw-filter">
                    <option value="all">${t('allContent')}</option>
                    <option value="sfw">${t('sfwOnly')}</option>
                    <option value="nsfw">${t('nsfwOnly')}</option>
                </select>
                <label class="vs-nsfw-blur-toggle">
                    <input type="checkbox" id="vs-nsfw-blur-toggle" />
                    <span>${t('nsfwBlur')}</span>
                </label>
            </div>
            <div class="vs-body">
                <div class="vs-sidebar">
                    <ul class="vs-folder-tree"></ul>
                </div>
                <div class="vs-content vs-main">
                    <div class="vs-loading">${t('loading')}</div>
                    <div class="vs-grid"></div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    currentDialog = dialog;
    
    dialog.querySelector(".vs-close").onclick = () => closeDialog();
    dialog.querySelector(".vs-overlay").onclick = () => closeDialog();
    
    window._vs_current_model_type = type; // Tell buildUI which type to fetch images for
    
    fetch("/visual_select/preview_info", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({names: modelValues, type})
    })
    .then(r => r.json())
    .then(info => {
        buildUI(dialog, targetWidget, node, modelValues, info);
    })
    .catch(err => {
        const loadingEl = dialog.querySelector(".vs-loading");
        if(loadingEl) {
            loadingEl.innerText = t('errorLoading');
        }
        console.error(err);
    });
}

app.registerExtension({
    name: "visual_select.model_preview",
    settings: [
        {
            id: "VisualSelect.Settings.Enabled",
            name: "开启视图选择器",
            category: ["🎨Visual Select", "基础", "总开关"],
            type: "boolean",
            defaultValue: true,
            tooltip: "关闭后将不拦截下拉框并禁用视图选择器弹窗",
            onChange: (val) => {
                window._vs_config.enabled = val;
                fetch("/visual_select/config", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({enabled: val})
                }).catch(e => console.error(e));
            }
        },
        {
            id: "VisualSelect.Settings.InterceptTypes",
            name: "监听关键字（逗号分隔）",
            category: ["🎨Visual Select", "基础", "监听关键字"],
            type: "text",
            defaultValue: "ckpt,model,lora,vae,unet,controlnet,checkpoint",
            tooltip: "只有当节点属性名包含这些关键字时才弹出悬浮按钮",
            onChange: (val) => {
                window._vs_config.intercept_types = val;
                fetch("/visual_select/config", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({intercept_types: val})
                }).catch(e => console.error(e));
            }
        },
        {
            id: "VisualSelect.Settings.InterceptExcludes",
            name: "排除关键字（逗号分隔）",
            category: ["🎨Visual Select", "基础", "排除关键字"],
            type: "text",
            defaultValue: "model_type",
            tooltip: "当节点属性名包含这些关键字时将强制使用原生下拉框（不拦截）",
            onChange: (val) => {
                window._vs_config.intercept_excludes = val;
                fetch("/visual_select/config", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({intercept_excludes: val})
                }).catch(e => console.error(e));
            }
        },
        {
            id: "VisualSelect.Settings.Language",
            name: "语言 (Language)",
            category: ["🎨Visual Select", "界面", "语言"],
            type: "combo",
            options: [
                { text: "中文 (Chinese)", value: "zh-CN" },
                { text: "English", value: "en-US" }
            ],
            defaultValue: "zh-CN",
            tooltip: "切换插件界面语言",
            onChange: (val) => {
                window._vs_config.language = val;
                fetch("/visual_select/config", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({language: val})
                }).catch(e => console.error(e));
            }
        }
        ,
        {
            id: "VisualSelect.Settings.ReplaceZoomPreview",
            name: "增强 ComfyUI 图片放大预览",
            category: ["🎨Visual Select", "界面", "图片预览增强"],
            type: "boolean",
            defaultValue: false,
            tooltip: "拦截 ComfyUI 的放大镜预览按钮，增强支持滚轮缩放和拖拽移动的全屏预览",
            onChange: (val) => {
                window._vs_config.replace_zoom_preview = val;
                fetch("/visual_select/config", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({replace_zoom_preview: val})
                }).catch(e => console.error(e));
            }
        }
    ],
    async setup() {
        console.log("🚀 [Visual_Select] Main Extension setup executed!");
        _vsInstallZoomPreviewInterceptor();

        // Intercept LiteGraph ContextMenu for Combo Widgets (V1 Canvas)
        if (window.LiteGraph && window.LiteGraph.ContextMenu) {
            const origContextMenu = window.LiteGraph.ContextMenu;
            window.LiteGraph.ContextMenu = function(values, options) {
                // Check if plugin is enabled
                if (window._vs_config.enabled && app.canvas && app.canvas.current_node) {
                    const node = app.canvas.current_node;
                    // Find which widget this menu belongs to by comparing the values array
                    const widget = node.widgets?.find(w => w.options && w.options.values === values);
                    
                    if (widget) {
                        const wName = (widget.name || "").toLowerCase();
                        let excludesStr = window._vs_config.intercept_excludes || "model_type";
                        let excludes = excludesStr.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
                        
                        if (!excludes.some(ex => wName.includes(ex)) && isModelWidget(widget)) {
                            setTimeout(() => showFloatingButton(widget, node, null), 10);
                        }
                    }
                }
                
                return origContextMenu.apply(this, arguments);
            };
            console.log("🚀 [Visual_Select] Hooked into LiteGraph.ContextMenu!");
        }
    },
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // --- Special Logic for the Visual Select Model Browser Node ---
        if (nodeData.name === "VisualSelectModelBrowser") {
            const origOnNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                if (origOnNodeCreated) {
                    origOnNodeCreated.apply(this, arguments);
                }
                
                if (this.widgets) {
                    for (const w of this.widgets) {
                        if (w) injectWidget(w, this);
                    }
                }
                
                const modelTypeWidget = this.widgets.find(w => w.name === "model_type");
                const selectedModelWidget = this.widgets.find(w => w.name === "selected_model");
                
                if (modelTypeWidget && selectedModelWidget) {
                    const origCallback = modelTypeWidget.callback;
                    modelTypeWidget.callback = async function(val) {
                        if (origCallback) origCallback.apply(this, arguments);
                        try {
                            const res = await fetch(`/visual_select/get_models?type=${val}`);
                            const models = await res.json();
                            const modelNames = models.map(m => m.name);
                            selectedModelWidget.options.values = modelNames;
                            if (modelNames.length > 0) {
                                selectedModelWidget.value = modelNames[0];
                            } else {
                                selectedModelWidget.value = "";
                            }
                            if (app.canvas) app.graph.setDirtyCanvas(true, true);
                        } catch (e) {
                            console.error("Failed to update models", e);
                        }
                    };
                }
                
                if (this.setSize) {
                    this.setSize([300, 80]);
                }
            };
            
            return;
        }

        // --- Logic for injecting into other nodes ---
        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            if (origOnNodeCreated) {
                origOnNodeCreated.apply(this, arguments);
            }
            if (this.widgets) {
                for (const w of this.widgets) {
                    if (w) {
                        injectWidget(w, this);
                    }
                }
            }
            
            // Overwrite this instance's addWidget to catch dynamically added widgets
            const origAddWidget = this.addWidget;
            this.addWidget = function(...args) {
                const w = origAddWidget.apply(this, args);
                if (w) {
                    injectWidget(w, this);
                }
                return w;
            };
        };

        const origOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function (info) {
            if (origOnConfigure) {
                origOnConfigure.apply(this, arguments);
            }
            if (this.widgets) {
                for (const w of this.widgets) {
                    injectWidget(w, this);
                }
            }
        };
    },
    
    loadedGraphNode(node, app) {
        // Ensure widgets are injected when a graph is loaded
        if (node.widgets) {
            for (const w of node.widgets) {
                injectWidget(w, node);
            }
        }
    }
});
