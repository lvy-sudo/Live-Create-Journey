(() => {
  "use strict";

  const DEFAULT_DATA = window.LCJ_DEFAULT_DATA;
  if (!DEFAULT_DATA) {
    throw new Error("未找到内容配置：请确认 src/data.js 已在 main.js 之前加载。");
  }

  const STORAGE_KEY = "lcj-site-data-v2";
  const PHOTO_DB_NAME = "lcj-photo-library";
  const PHOTO_STORE_NAME = "photos";
  const SLIDE_MS = 500;
  const REDUCED_SLIDE_MS = 1;
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const supportsViewTransitions = typeof document.startViewTransition === "function";

  const app = document.querySelector("#app");
  const homeView = document.querySelector("#view-home");
  const cardContainer = document.querySelector("#category-cards");
  const installButton = document.querySelector("#install-app");
  const toast = document.querySelector("#app-toast");
  const toastText = toast?.querySelector(".toast-text");
  const toastAction = toast?.querySelector(".toast-action");
  const appDialog = document.querySelector("#app-dialog");

  const clone = (value) => (typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value)));

  const createId = (prefix) => {
    if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return clone(DEFAULT_DATA);
      const parsed = JSON.parse(saved);
      if (!parsed || parsed.version !== DEFAULT_DATA.version || !Array.isArray(parsed.categories)) {
        return clone(DEFAULT_DATA);
      }
      return parsed;
    } catch (error) {
      console.warn("无法读取本地内容，使用默认配置。", error);
      return clone(DEFAULT_DATA);
    }
  }

  let data = loadData();
  let routeStack = [{ view: "home" }];
  let activeView = homeView;
  let isAnimating = false;
  let toastTimer = null;
  let toastUndo = null;
  let dialogCleanup = null;

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error("保存内容失败。", error);
      showToast("保存失败：浏览器存储空间可能已满。", null, 5000);
      return false;
    }
  }

  function currentRoute() {
    return routeStack[routeStack.length - 1];
  }

  function routeKey(route) {
    return [route.view, route.categoryId, route.itemId, route.portfolioId, route.travelogueId]
      .filter(Boolean)
      .join(":");
  }

  function findCategory(categoryId) {
    return data.categories.find((category) => category.id === categoryId);
  }

  function findItem(categoryId, itemId) {
    return findCategory(categoryId)?.items?.find((item) => item.id === itemId);
  }

  function findPortfolio(categoryId, itemId, portfolioId) {
    return findItem(categoryId, itemId)?.portfolios?.find((portfolio) => portfolio.id === portfolioId);
  }

  function findTravelogue(categoryId, itemId, travelogueId) {
    return findItem(categoryId, itemId)?.travelogues?.find((travelogue) => travelogue.id === travelogueId);
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function makeButton(className, label, onClick) {
    const button = make("button", className, label);
    button.type = "button";
    if (onClick) button.addEventListener("click", onClick);
    return button;
  }

  function normalizeUrl(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    if (/^(https?:\/\/|mailto:|tel:|\/|\.\/|#)/i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  function renderSiteChrome() {
    const siteName = document.querySelector("#site-title");
    if (siteName) {
      siteName.replaceChildren();
      const pieces = String(data.site.name || DEFAULT_DATA.site.name).split("·");
      pieces.forEach((piece, index) => {
        if (index > 0) siteName.append(make("span", "dot", "·"));
        siteName.append(document.createTextNode(piece.trim()));
      });
    }

    const intro = document.querySelector(".home-intro");
    if (intro) intro.textContent = data.site.intro || DEFAULT_DATA.site.intro;
    const footer = document.querySelector("#site-footer");
    if (footer) footer.textContent = data.site.footer || DEFAULT_DATA.site.footer;
    document.title = data.site.name || DEFAULT_DATA.site.name;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = data.site.description || DEFAULT_DATA.site.description;
  }

  function createCategoryCard(category, index) {
    const card = make("button", "category-card");
    card.type = "button";
    card.dataset.categoryId = category.id;
    card.style.setProperty("--card-accent", category.accent);
    card.setAttribute("aria-label", `进入“${category.title}”分类`);
    card.append(
      make("span", "category-card__number", String(index + 1).padStart(2, "0")),
      make("span", "category-card__title", category.title),
      make("span", "category-card__hint", "View →")
    );
    card.addEventListener("click", () => {
      navigateForward({ view: "category", categoryId: category.id });
    });
    return card;
  }

  function renderHomeCards() {
    cardContainer.replaceChildren();
    data.categories.forEach((category, index) => {
      cardContainer.append(createCategoryCard(category, index));
    });
  }

  function createIntro({ category, title, description, eyebrow, note, titleId, actions = [] }) {
    const intro = make("header", "detail-intro");
    intro.append(make("p", "detail-eyebrow", eyebrow || category.subtitle));
    const heading = make("h2", "detail-title", title);
    heading.id = titleId;
    intro.append(heading);
    if (description) intro.append(make("p", "detail-description", description));
    if (note) intro.append(make("p", "detail-note", note));
    if (actions.length) {
      const actionRow = make("div", "intro-actions");
      actions.forEach((action) => actionRow.append(action));
      intro.append(actionRow);
    }
    return intro;
  }

  function createDetailFrame(route, category, indexLabel, backLabel) {
    const section = make("section", "view detail-view");
    section.id = `view-${routeKey(route).replace(/[^a-z0-9-]/gi, "-")}`;
    section.dataset.view = route.view;
    section.setAttribute("aria-hidden", "true");
    section.setAttribute("inert", "");

    const shell = make("div", "detail-shell");
    shell.style.setProperty("--detail-accent", category.accent || "#2e5c52");
    const topbar = make("div", "detail-topbar");
    const backButton = makeButton("back-button", "", () => navigateBack());
    backButton.innerHTML = '<span aria-hidden="true">←</span> 返回';
    backButton.setAttribute("aria-label", backLabel);
    const index = make("span", "detail-index", indexLabel);
    topbar.append(backButton, index);

    const body = make("div", "detail-body");
    shell.append(topbar, body);
    section.append(shell);
    return { section, shell, body };
  }

  function createAddCard(label, onClick, hint) {
    const button = makeButton("add-card", "", onClick);
    const plus = make("span", "add-card__plus", "＋");
    const copy = make("span", "add-card__copy");
    copy.append(make("strong", "", label));
    if (hint) copy.append(make("small", "", hint));
    button.append(plus, copy);
    return button;
  }

  function createEmptyState(text) {
    return make("p", "empty-state", text);
  }

  function createItemCard(category, item, index) {
    const card = make("article", "item-card");
    card.dataset.itemId = item.id;
    const open = makeButton("item-open", "", () => {
      navigateForward({ view: "item", categoryId: category.id, itemId: item.id });
    });
    open.setAttribute("aria-label", `打开${category.itemNoun || "条目"}“${item.title}”`);
    const copy = make("span", "item-copy");
    copy.append(
      make("strong", "", item.title || "未命名"),
      make("small", "", item.description || "暂无简介")
    );
    const arrow = make("span", "item-arrow", "→");
    arrow.setAttribute("aria-hidden", "true");
    open.append(make("span", "item-number", String(index + 1).padStart(2, "0")), copy, arrow);

    const actions = make("div", "item-actions");
    actions.append(
      makeButton("mini-action", "编辑", () => openItemEditor(category, item)),
      makeButton("mini-action mini-action--danger", "删除", () => deleteItem(category, item))
    );
    card.append(open, actions);
    return card;
  }

  function createCategoryView(route) {
    const category = findCategory(route.categoryId);
    if (!category) return createMissingView();
    const categoryIndex = data.categories.indexOf(category);
    const frame = createDetailFrame(
      route,
      category,
      `${String(categoryIndex + 1).padStart(2, "0")} / ${String(data.categories.length).padStart(2, "0")}`,
      `返回主页，离开${category.title}`
    );
    const titleId = `title-${routeKey(route).replace(/[^a-z0-9-]/gi, "-")}`;
    frame.section.setAttribute("aria-labelledby", titleId);
    const intro = createIntro({
      category,
      title: category.title,
      description: category.description,
      eyebrow: category.subtitle,
      note: "点击方框进入详情；右侧按钮可编辑或删除。",
      titleId
    });

    const list = make("div", "item-list");
    if (!Array.isArray(category.items)) category.items = [];
    if (category.items.length) {
      category.items.forEach((item, index) => list.append(createItemCard(category, item, index)));
    } else {
      list.append(createEmptyState(`还没有${category.itemNoun || "内容"}，点击下方按钮开始添加。`));
    }
    list.append(createAddCard(
      `添加${category.itemNoun || "内容"}`,
      () => openItemEditor(category, null),
      "新增后会自动保存到这台设备"
    ));
    frame.body.append(intro, list);
    return frame.section;
  }

  function createItemView(route) {
    const category = findCategory(route.categoryId);
    const item = findItem(route.categoryId, route.itemId);
    if (!category || !item) return createMissingView();
    const itemIndex = category.items.indexOf(item);
    const frame = createDetailFrame(
      route,
      category,
      `${String(itemIndex + 1).padStart(2, "0")} / ${String(category.items.length).padStart(2, "0")}`,
      `返回${category.title}`
    );
    const titleId = `title-${routeKey(route).replace(/[^a-z0-9-]/gi, "-")}`;
    frame.section.setAttribute("aria-labelledby", titleId);
    const intro = createIntro({
      category,
      title: item.title || "未命名",
      description: item.description,
      eyebrow: category.title,
      note: "内容修改会自动保存在当前浏览器中。",
      titleId,
      actions: [
        makeButton("text-button", "编辑内容", () => openItemEditor(category, item)),
        makeButton("text-button text-button--danger", "删除", () => deleteItem(category, item))
      ]
    });

    const content = make("div", "item-detail-content");
    content.append(createProseCard(item.body || "还没有详细内容。点击“编辑内容”补充说明。"));
    if (item.kind === "photography") content.append(createPortfolioSection(category, item));
    else if (item.kind === "travel") content.append(createTravelogueSection(category, item));
    content.append(createLinksSection(category, item));
    frame.body.append(intro, content);
    return frame.section;
  }

  function createProseCard(text) {
    const section = make("section", "content-section prose-card");
    section.append(make("h3", "section-title", "关于"));
    section.append(make("p", "prose-text", text));
    return section;
  }

  function createSectionHeader(title, actions = []) {
    const header = make("div", "section-header");
    header.append(make("h3", "section-title", title));
    if (actions.length) {
      const row = make("div", "section-actions");
      actions.forEach((action) => row.append(action));
      header.append(row);
    }
    return header;
  }

  function createLinksSection(category, item) {
    const section = make("section", "content-section");
    const add = makeButton("small-action", "＋ 添加链接", () => openLinkDialog(category, item, null));
    section.append(createSectionHeader("相关链接", [add]));
    const links = Array.isArray(item.links) ? item.links : [];
    if (!links.length) {
      section.append(createEmptyState("暂无链接，可以添加项目地址、文章或社交主页。"));
      return section;
    }
    const list = make("div", "link-list");
    links.forEach((link) => {
      const row = make("div", "link-row");
      const anchor = make("a", "link-anchor");
      anchor.href = normalizeUrl(link.url) || "#";
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.append(make("strong", "", link.label || "未命名链接"));
      anchor.append(make("small", "", link.url || ""));
      row.append(anchor, makeButton("mini-action mini-action--danger", "删除", () => {
        removeLinkWithUndo(category, item, link);
      }));
      list.append(row);
    });
    section.append(list);
    return section;
  }

  function createPortfolioSection(category, item) {
    if (!Array.isArray(item.portfolios)) item.portfolios = [];
    const section = make("section", "content-section");
    const add = makeButton("small-action small-action--accent", "＋ 添加照片", () => addPortfolioWithPhotos(category, item));
    section.append(createSectionHeader("摄影作品集", [add]));
    if (!item.portfolios.length) {
      section.append(createEmptyState("还没有作品集。点击“添加照片”，选择本地图片即可创建。"));
      return section;
    }
    const grid = make("div", "collection-grid");
    item.portfolios.forEach((portfolio, index) => {
      const card = make("article", "collection-card");
      card.dataset.portfolioId = portfolio.id;
      const open = makeButton("collection-open", "", () => {
        navigateForward({
          view: "portfolio",
          categoryId: category.id,
          itemId: item.id,
          portfolioId: portfolio.id
        });
      });
      const cover = make("div", "collection-cover");
      const firstPhoto = portfolio.photos?.[0];
      if (firstPhoto) cover.append(createPhotoImage(firstPhoto, portfolio.title));
      else cover.append(make("span", "collection-cover__empty", "还没有照片"));
      const copy = make("div", "collection-copy");
      copy.append(
        make("small", "collection-index", String(index + 1).padStart(2, "0")),
        make("strong", "", portfolio.title || "未命名作品集"),
        make("span", "", portfolio.description || `${portfolio.photos?.length || 0} 张照片`)
      );
      open.append(cover, copy);
      const actions = make("div", "collection-actions");
      actions.append(
        makeButton("mini-action", "编辑", () => openPortfolioEditor(category, item, portfolio)),
        makeButton("mini-action mini-action--danger", "删除", () => deletePortfolio(category, item, portfolio))
      );
      card.append(open, actions);
      grid.append(card);
    });
    section.append(grid);
    return section;
  }

  function createTravelogueSection(category, item) {
    if (!Array.isArray(item.travelogues)) item.travelogues = [];
    const section = make("section", "content-section");
    const add = makeButton("small-action small-action--accent", "＋ 新增游记", () => openTravelogueEditor(category, item, null));
    section.append(createSectionHeader("旅行游记", [add]));
    if (!item.travelogues.length) {
      section.append(createEmptyState("还没有游记。点击“新增游记”记录一段旅程。"));
      return section;
    }
    const list = make("div", "travelogue-list");
    item.travelogues.forEach((travelogue) => {
      const card = make("article", "travelogue-card");
      card.dataset.travelogueId = travelogue.id;
      const open = makeButton("travelogue-open", "", () => {
        navigateForward({
          view: "travelogue",
          categoryId: category.id,
          itemId: item.id,
          travelogueId: travelogue.id
        });
      });
      const copy = make("span", "travelogue-copy");
      copy.append(
        make("small", "", travelogue.date || "未标注日期"),
        make("strong", "", travelogue.title || "未命名游记"),
        make("span", "", travelogue.description || "点击进入游记")
      );
      open.append(copy, make("span", "item-arrow", "→"));
      const actions = make("div", "item-actions");
      actions.append(
        makeButton("mini-action", "编辑", () => openTravelogueEditor(category, item, travelogue)),
        makeButton("mini-action mini-action--danger", "删除", () => deleteTravelogue(category, item, travelogue))
      );
      card.append(open, actions);
      list.append(card);
    });
    section.append(list);
    return section;
  }

  function createPortfolioView(route) {
    const category = findCategory(route.categoryId);
    const item = findItem(route.categoryId, route.itemId);
    const portfolio = findPortfolio(route.categoryId, route.itemId, route.portfolioId);
    if (!category || !item || !portfolio) return createMissingView();
    const frame = createDetailFrame(route, category, "摄影作品集", `返回${item.title}`);
    const titleId = `title-${routeKey(route).replace(/[^a-z0-9-]/gi, "-")}`;
    frame.section.setAttribute("aria-labelledby", titleId);
    const intro = createIntro({
      category,
      title: portfolio.title || "未命名作品集",
      description: portfolio.description,
      eyebrow: `${item.title} · Portfolio`,
      note: `共 ${portfolio.photos?.length || 0} 张照片`,
      titleId,
      actions: [
        makeButton("text-button", "编辑信息", () => openPortfolioEditor(category, item, portfolio)),
        makeButton("text-button text-button--danger", "删除作品集", () => deletePortfolio(category, item, portfolio))
      ]
    });

    const content = make("div", "item-detail-content");
    const gallery = make("section", "content-section");
    gallery.append(createSectionHeader("照片", [
      makeButton("small-action small-action--accent", "＋ 添加照片", async () => {
        const files = await pickImages();
        if (!files.length) return;
        const photos = await filesToPhotos(files);
        portfolio.photos = Array.isArray(portfolio.photos) ? portfolio.photos : [];
        portfolio.photos.push(...photos);
        saveData();
        refreshActiveView();
        showToast(`已添加 ${photos.length} 张照片。`);
      })
    ]));
    gallery.append(createPhotoGallery(portfolio.photos || [], (photo) => {
      removePhotoWithUndo(portfolio, photo, "照片");
    }));
    content.append(gallery);
    frame.body.append(intro, content);
    return frame.section;
  }

  function createTravelogueView(route) {
    const category = findCategory(route.categoryId);
    const item = findItem(route.categoryId, route.itemId);
    const travelogue = findTravelogue(route.categoryId, route.itemId, route.travelogueId);
    if (!category || !item || !travelogue) return createMissingView();
    const frame = createDetailFrame(route, category, travelogue.date || "旅行游记", `返回${item.title}`);
    const titleId = `title-${routeKey(route).replace(/[^a-z0-9-]/gi, "-")}`;
    frame.section.setAttribute("aria-labelledby", titleId);
    const intro = createIntro({
      category,
      title: travelogue.title || "未命名游记",
      description: travelogue.description,
      eyebrow: `${item.title} · Travelogue`,
      note: travelogue.date || "未标注日期",
      titleId,
      actions: [
        makeButton("text-button", "编辑游记", () => openTravelogueEditor(category, item, travelogue)),
        makeButton("text-button text-button--danger", "删除游记", () => deleteTravelogue(category, item, travelogue))
      ]
    });

    const content = make("div", "item-detail-content");
    const records = make("section", "content-section");
    records.append(createSectionHeader("旅途记录", [
      makeButton("small-action", "＋ 添加文字记录", () => openTravelNoteEditor(travelogue, null)),
      makeButton("small-action small-action--accent", "＋ 添加照片", () => addTravelPhotoRecord(travelogue))
    ]));
    if (!Array.isArray(travelogue.notes) || !travelogue.notes.length) {
      records.append(createEmptyState("还没有记录。添加文字或照片，开始写下这段旅程。"));
    } else {
      const timeline = make("div", "travel-timeline");
      travelogue.notes.forEach((note) => timeline.append(createTravelNote(note, travelogue)));
      records.append(timeline);
    }
    content.append(records);
    frame.body.append(intro, content);
    return frame.section;
  }

  function createTravelNote(note, travelogue) {
    const article = make("article", "travel-note");
    const header = make("div", "travel-note__header");
    header.append(make("time", "", note.date || "未标注日期"));
    const actions = make("div", "travel-note__actions");
    actions.append(makeButton("mini-action", "编辑", () => openTravelNoteEditor(travelogue, note)));
    actions.append(makeButton("mini-action", "＋ 照片", () => addPhotosToTravelNote(travelogue, note)));
    actions.append(makeButton("mini-action mini-action--danger", "删除记录", () => {
      removeTravelNoteWithUndo(travelogue, note);
    }));
    header.append(actions);
    article.append(header);
    if (note.text) article.append(make("p", "travel-note__text", note.text));
    if (Array.isArray(note.photos) && note.photos.length) {
      article.append(createPhotoGallery(note.photos, (photo) => removePhotoWithUndo(note, photo, "照片")));
    }
    return article;
  }

  function createPhotoImage(photo, fallbackAlt = "照片") {
    const img = document.createElement("img");
    img.alt = photo.alt || fallbackAlt;
    img.loading = "lazy";
    img.decoding = "async";
    img.dataset.photoRef = photo.ref || "";
    if (photo.ref && !photo.ref.startsWith("idb:")) img.src = photo.ref;
    img.addEventListener("error", () => {
      img.closest("figure, .collection-cover")?.classList.add("is-broken");
    });
    return img;
  }

  function createPhotoGallery(photos, onDelete) {
    if (!photos.length) return createEmptyState("还没有照片，点击上方按钮从电脑中选择图片。");
    const grid = make("div", "photo-grid");
    photos.forEach((photo) => {
      const figure = make("figure", "photo-card");
      figure.append(createPhotoImage(photo));
      const caption = make("figcaption");
      caption.append(make("span", "", photo.caption || photo.alt || "照片"));
      if (onDelete) caption.append(makeButton("photo-delete", "删除", () => onDelete(photo)));
      figure.append(caption);
      grid.append(figure);
    });
    return grid;
  }

  function createMissingView() {
    const section = make("section", "view detail-view");
    const shell = make("div", "detail-shell");
    const topbar = make("div", "detail-topbar");
    topbar.append(makeButton("back-button", "← 返回", () => navigateBack()));
    const body = make("div", "detail-body detail-body--single");
    body.append(createEmptyState("这条内容已经不存在，请返回上一页。"));
    shell.append(topbar, body);
    section.append(shell);
    return section;
  }

  function createRouteView(route) {
    switch (route.view) {
      case "home": return homeView;
      case "category": return createCategoryView(route);
      case "item": return createItemView(route);
      case "portfolio": return createPortfolioView(route);
      case "travelogue": return createTravelogueView(route);
      default: return createMissingView();
    }
  }

  function setViewAccessibility(view, active) {
    if (active) {
      view.removeAttribute("inert");
      view.setAttribute("aria-hidden", "false");
    } else {
      view.setAttribute("inert", "");
      view.setAttribute("aria-hidden", "true");
    }
  }

  function resetTransitionClasses(view) {
    view.classList.remove("is-active", "is-from-left", "is-exiting-left", "is-exiting-right");
  }

  function focusAfterSwitch(targetView, targetRoute, direction, fromRoute) {
    let focusTarget = null;
    if (direction === "back" && fromRoute?.view === "item" && targetRoute.view === "category") {
      focusTarget = targetView.querySelector(`[data-item-id="${CSS.escape(fromRoute.itemId)}"] .item-open`);
    } else if (direction === "back" && fromRoute?.view === "category" && targetRoute.view === "home") {
      focusTarget = targetView.querySelector(`[data-category-id="${CSS.escape(fromRoute.categoryId)}"]`);
    } else if (direction === "back" && fromRoute?.portfolioId && targetRoute.view === "item") {
      focusTarget = targetView.querySelector(`[data-portfolio-id="${CSS.escape(fromRoute.portfolioId)}"] .collection-open`);
    } else if (direction === "back" && fromRoute?.travelogueId && targetRoute.view === "item") {
      focusTarget = targetView.querySelector(`[data-travelogue-id="${CSS.escape(fromRoute.travelogueId)}"] .travelogue-open`);
    }
    if (!focusTarget) focusTarget = targetView.querySelector(".back-button");
    focusTarget?.focus({ preventScroll: true });
  }

  function cleanupAfterSwitch(currentView, targetView, targetRoute, direction, fromRoute) {
    resetTransitionClasses(currentView);
    resetTransitionClasses(targetView);
    targetView.classList.add("is-active");
    setViewAccessibility(currentView, false);
    setViewAccessibility(targetView, true);
    if (currentView !== homeView) currentView.remove();
    activeView = targetView;
    isAnimating = false;
    focusAfterSwitch(targetView, targetRoute, direction, fromRoute);
  }

  function switchView(targetRoute, direction, fromRoute) {
    if (isAnimating) return;
    const targetView = createRouteView(targetRoute);
    if (!targetView || targetView === activeView) return;
    isAnimating = true;
    const currentView = activeView;
    setViewAccessibility(targetView, true);
    resetTransitionClasses(targetView);
    if (targetView !== homeView) app.append(targetView);

    const reduced = reduceMotionQuery.matches;
    const useViewTransitions = supportsViewTransitions && !reduced;
    if (useViewTransitions) {
      resetTransitionClasses(currentView);
      currentView.classList.add("is-active");
      document.documentElement.classList.add("uses-view-transition");
      document.documentElement.dataset.transitionDirection = direction;
      const commit = () => {
        currentView.classList.remove("is-active");
        currentView.classList.add(direction === "forward" ? "is-exiting-left" : "is-exiting-right");
        setViewAccessibility(currentView, false);
        targetView.classList.add("is-active");
        setViewAccessibility(targetView, true);
      };
      const transition = document.startViewTransition(commit);
      transition.finished.catch(() => {}).finally(() => {
        document.documentElement.classList.remove("uses-view-transition");
        delete document.documentElement.dataset.transitionDirection;
        cleanupAfterSwitch(currentView, targetView, targetRoute, direction, fromRoute);
        hydratePhotoImages(targetView);
      });
      return;
    }

    if (direction === "back") targetView.classList.add("is-from-left");
    void targetView.offsetWidth;
    currentView.classList.remove("is-active");
    currentView.classList.add(direction === "forward" ? "is-exiting-left" : "is-exiting-right");
    requestAnimationFrame(() => {
      if (direction === "back") targetView.classList.remove("is-from-left");
      targetView.classList.add("is-active");
    });
    const wait = reduced ? REDUCED_SLIDE_MS + 10 : SLIDE_MS + 40;
    window.setTimeout(() => {
      cleanupAfterSwitch(currentView, targetView, targetRoute, direction, fromRoute);
      hydratePhotoImages(targetView);
    }, wait);
  }

  function navigateForward(route) {
    if (isAnimating) return;
    const fromRoute = currentRoute();
    routeStack.push(route);
    switchView(route, "forward", fromRoute);
  }

  function navigateBack() {
    if (isAnimating || routeStack.length <= 1) return;
    const fromRoute = currentRoute();
    routeStack.pop();
    switchView(currentRoute(), "back", fromRoute);
  }

  function refreshActiveView(focusSelector) {
    const route = currentRoute();
    if (route.view === "home") {
      renderHomeCards();
      activeView = homeView;
      setViewAccessibility(homeView, true);
      return;
    }
    const scrollTop = activeView.scrollTop;
    const targetView = createRouteView(route);
    targetView.classList.add("is-active");
    setViewAccessibility(targetView, true);
    activeView.replaceWith(targetView);
    activeView = targetView;
    targetView.scrollTop = scrollTop;
    hydratePhotoImages(targetView);
    if (focusSelector) {
      requestAnimationFrame(() => targetView.querySelector(focusSelector)?.focus({ preventScroll: true }));
    }
  }

  function showToast(message, undo, duration = 5000) {
    if (!toast || !toastText || !toastAction) return;
    window.clearTimeout(toastTimer);
    toastUndo = undo || null;
    toastText.textContent = message;
    toastAction.hidden = !undo;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => { toast.hidden = true; }, 220);
      toastUndo = null;
    }, duration);
  }

  toastAction?.addEventListener("click", () => {
    const action = toastUndo;
    toastUndo = null;
    toast.hidden = true;
    toast.classList.remove("is-visible");
    window.clearTimeout(toastTimer);
    action?.();
  });

  function snapshotAndSave() {
    return clone(data);
  }

  function restoreSnapshot(snapshot) {
    data = snapshot;
    saveData();
    refreshActiveView();
    showToast("已撤销。");
  }

  function deleteItem(category, item) {
    const snapshot = snapshotAndSave();
    const index = category.items.findIndex((entry) => entry.id === item.id);
    if (index < 0) return;
    category.items.splice(index, 1);
    saveData();
    const isOnItemPage = currentRoute().view === "item" && currentRoute().itemId === item.id;
    if (isOnItemPage) {
      routeStack.pop();
      switchView(currentRoute(), "back", { view: "item", categoryId: category.id, itemId: item.id });
    } else {
      refreshActiveView();
    }
    showToast(`已删除“${item.title}”。`, () => restoreSnapshot(snapshot));
  }

  function deletePortfolio(category, item, portfolio) {
    const snapshot = snapshotAndSave();
    const index = item.portfolios.findIndex((entry) => entry.id === portfolio.id);
    if (index < 0) return;
    item.portfolios.splice(index, 1);
    saveData();
    const isOnPortfolio = currentRoute().view === "portfolio" && currentRoute().portfolioId === portfolio.id;
    if (isOnPortfolio) {
      routeStack.pop();
      switchView(currentRoute(), "back", {
        view: "portfolio",
        categoryId: category.id,
        itemId: item.id,
        portfolioId: portfolio.id
      });
    } else {
      refreshActiveView();
    }
    showToast(`已删除作品集“${portfolio.title}”。`, () => restoreSnapshot(snapshot));
  }

  function deleteTravelogue(category, item, travelogue) {
    const snapshot = snapshotAndSave();
    const index = item.travelogues.findIndex((entry) => entry.id === travelogue.id);
    if (index < 0) return;
    item.travelogues.splice(index, 1);
    saveData();
    const isOnTravelogue = currentRoute().view === "travelogue" && currentRoute().travelogueId === travelogue.id;
    if (isOnTravelogue) {
      routeStack.pop();
      switchView(currentRoute(), "back", {
        view: "travelogue",
        categoryId: category.id,
        itemId: item.id,
        travelogueId: travelogue.id
      });
    } else {
      refreshActiveView();
    }
    showToast(`已删除游记“${travelogue.title}”。`, () => restoreSnapshot(snapshot));
  }

  function removeLinkWithUndo(category, item, link) {
    const snapshot = snapshotAndSave();
    item.links = item.links.filter((entry) => entry.id !== link.id);
    saveData();
    refreshActiveView();
    showToast("链接已删除。", () => restoreSnapshot(snapshot));
  }

  function removePhotoWithUndo(owner, photo, label) {
    const snapshot = snapshotAndSave();
    owner.photos = owner.photos.filter((entry) => entry.id !== photo.id);
    saveData();
    refreshActiveView();
    showToast(`${label}已删除。`, () => restoreSnapshot(snapshot));
  }

  function removeTravelNoteWithUndo(travelogue, note) {
    const snapshot = snapshotAndSave();
    travelogue.notes = travelogue.notes.filter((entry) => entry.id !== note.id);
    saveData();
    refreshActiveView();
    showToast("旅途记录已删除。", () => restoreSnapshot(snapshot));
  }

  function openDialogBase({ title, description, fields = [], extraNode = null, submitLabel = "保存", onSubmit, onCleanup }) {
    if (!appDialog) return;
    if (appDialog.open) appDialog.close();
    dialogCleanup?.();
    dialogCleanup = onCleanup || null;
    appDialog.replaceChildren();

    const panel = make("div", "dialog-panel");
    const header = make("div", "dialog-header");
    const titleWrap = make("div");
    titleWrap.append(make("h2", "dialog-title", title));
    if (description) titleWrap.append(make("p", "dialog-description", description));
    const close = makeButton("dialog-close", "×", () => appDialog.close());
    close.setAttribute("aria-label", "关闭");
    header.append(titleWrap, close);

    const form = make("form", "dialog-form");
    const fieldGrid = make("div", "dialog-fields");
    const inputs = {};
    fields.forEach((field) => {
      const label = make("label", "dialog-field");
      label.append(make("span", "", field.label));
      let input;
      if (field.type === "textarea") {
        input = document.createElement("textarea");
        input.rows = field.rows || 5;
      } else {
        input = document.createElement("input");
        input.type = field.type || "text";
      }
      input.name = field.name;
      input.value = field.value ?? "";
      input.placeholder = field.placeholder || "";
      if (field.required) input.required = true;
      inputs[field.name] = input;
      label.append(input);
      fieldGrid.append(label);
    });
    form.append(fieldGrid);
    if (extraNode) form.append(extraNode);

    const footer = make("div", "dialog-footer");
    footer.append(makeButton("dialog-secondary", "取消", () => appDialog.close()));
    const submit = make("button", "dialog-primary", submitLabel);
    submit.type = "submit";
    footer.append(submit);
    form.append(footer);
    panel.append(header, form);
    appDialog.append(panel);

    let submitting = false;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submitting) return;
      submitting = true;
      submit.disabled = true;
      const values = {};
      Object.entries(inputs).forEach(([name, input]) => { values[name] = input.value.trim(); });
      try {
        const afterClose = await onSubmit?.(values, form);
        appDialog.close();
        if (typeof afterClose === "function") afterClose();
      } catch (error) {
        console.error(error);
        showToast(error?.message || "操作失败，请稍后重试。", null, 5000);
      } finally {
        submitting = false;
        submit.disabled = false;
      }
    });

    appDialog.showModal();
    requestAnimationFrame(() => form.querySelector("input, textarea")?.focus());
  }

  appDialog?.addEventListener("close", () => {
    dialogCleanup?.();
    dialogCleanup = null;
  });

  function openInfoDialog(title, paragraphs) {
    if (!appDialog) return;
    if (appDialog.open) appDialog.close();
    appDialog.replaceChildren();
    const panel = make("div", "dialog-panel dialog-panel--info");
    const header = make("div", "dialog-header");
    const titleWrap = make("div");
    titleWrap.append(make("h2", "dialog-title", title));
    header.append(titleWrap, makeButton("dialog-close", "×", () => appDialog.close()));
    const body = make("div", "dialog-info-body");
    paragraphs.forEach((paragraph) => body.append(make("p", "", paragraph)));
    const footer = make("div", "dialog-footer");
    footer.append(makeButton("dialog-primary", "知道了", () => appDialog.close()));
    panel.append(header, body, footer);
    appDialog.append(panel);
    appDialog.showModal();
  }

  function openItemEditor(category, item, preselectedFiles = []) {
    const isNew = !item;
    const workingItem = item ? clone(item) : {
      id: createId("item"),
      title: "",
      description: "",
      body: "",
      links: [],
      kind: category.kind === "standard" ? "standard" : category.kind
    };
    const selectedFiles = [...preselectedFiles];
    const supportsPhotos = preselectedFiles.length > 0;
    const photoPicker = supportsPhotos ? createPhotoPicker(selectedFiles) : null;

    openDialogBase({
      title: isNew ? `添加${category.itemNoun || "内容"}` : "编辑内容",
      description: isNew ? "填写后会自动保存，并立即出现在当前列表中。" : "修改会同步保存到当前浏览器。",
      fields: [
        { name: "title", label: "标题", value: workingItem.title, placeholder: "例如：我的新项目", required: true },
        { name: "description", label: "一句话简介", value: workingItem.description, placeholder: "简短说明它是什么" },
        { name: "body", label: "详细内容", type: "textarea", rows: 6, value: workingItem.body, placeholder: "可填写项目说明、技能经历或阅读记录" }
      ],
      extraNode: photoPicker?.node || null,
      onCleanup: photoPicker?.cleanup,
      submitLabel: isNew ? "添加" : "保存修改",
      onSubmit: async (values) => {
        workingItem.title = values.title;
        workingItem.description = values.description;
        workingItem.body = values.body;
        if (isNew && photoPicker?.getFiles().length) {
          workingItem.portfolios = [{
            id: createId("portfolio"),
            title: values.title,
            description: values.description,
            photos: await filesToPhotos(photoPicker.getFiles())
          }];
        }
        if (isNew) {
          if (!Array.isArray(category.items)) category.items = [];
          category.items.push(workingItem);
        } else {
          const index = category.items.findIndex((entry) => entry.id === item.id);
          if (index >= 0) category.items[index] = workingItem;
        }
        saveData();
        return () => refreshActiveView(isNew ? `[data-item-id="${CSS.escape(workingItem.id)}"] .item-open` : null);
      }
    });
  }

  function openLinkDialog(category, item, link) {
    const isNew = !link;
    openDialogBase({
      title: isNew ? "添加链接" : "编辑链接",
      description: "链接会显示在这条内容的详情页中。",
      fields: [
        { name: "label", label: "链接名称", value: link?.label || "", placeholder: "例如：项目主页", required: true },
        { name: "url", label: "链接地址", value: link?.url || "", placeholder: "https://example.com", required: true }
      ],
      submitLabel: isNew ? "添加" : "保存",
      onSubmit: async (values) => {
        const nextLink = { id: link?.id || createId("link"), label: values.label, url: normalizeUrl(values.url) };
        item.links = Array.isArray(item.links) ? item.links : [];
        if (isNew) item.links.push(nextLink);
        else Object.assign(link, nextLink);
        saveData();
        return () => refreshActiveView();
      }
    });
  }

  function openPortfolioEditor(category, item, portfolio) {
    const isNew = !portfolio;
    openDialogBase({
      title: isNew ? "新建作品集" : "编辑作品集",
      description: "照片可以稍后在作品集详情中添加。",
      fields: [
        { name: "title", label: "作品集名称", value: portfolio?.title || "", placeholder: "例如：城市光影", required: true },
        { name: "description", label: "作品集说明", type: "textarea", rows: 3, value: portfolio?.description || "", placeholder: "记录这组照片的主题" }
      ],
      submitLabel: isNew ? "创建" : "保存",
      onSubmit: async (values) => {
        const next = {
          id: portfolio?.id || createId("portfolio"),
          title: values.title,
          description: values.description,
          photos: portfolio?.photos || []
        };
        item.portfolios = Array.isArray(item.portfolios) ? item.portfolios : [];
        if (isNew) item.portfolios.push(next);
        else Object.assign(portfolio, next);
        saveData();
        return () => refreshActiveView();
      }
    });
  }

  async function addPortfolioWithPhotos(category, item) {
    const files = await pickImages();
    if (!files.length) return;
    const picker = createPhotoPicker(files);
    openDialogBase({
      title: "添加摄影作品集",
      description: "照片已经选好。填写作品集信息后保存即可。",
      fields: [
        { name: "title", label: "作品集名称", placeholder: "例如：城市光影", required: true },
        { name: "description", label: "作品集说明", type: "textarea", rows: 3, placeholder: "记录这组照片的主题" }
      ],
      extraNode: picker.node,
      onCleanup: picker.cleanup,
      submitLabel: "添加作品集",
      onSubmit: async (values) => {
        const photos = await filesToPhotos(picker.getFiles());
        item.portfolios = Array.isArray(item.portfolios) ? item.portfolios : [];
        item.portfolios.push({
          id: createId("portfolio"),
          title: values.title,
          description: values.description,
          photos
        });
        saveData();
        return () => refreshActiveView();
      }
    });
  }

  function openTravelogueEditor(category, item, travelogue) {
    const isNew = !travelogue;
    openDialogBase({
      title: isNew ? "新增游记" : "编辑游记",
      description: "创建后可以继续添加照片和文字记录。",
      fields: [
        { name: "title", label: "游记标题", value: travelogue?.title || "", placeholder: "例如：沿海公路", required: true },
        { name: "date", label: "日期", value: travelogue?.date || "", placeholder: "例如：2026.10" },
        { name: "description", label: "游记简介", type: "textarea", rows: 4, value: travelogue?.description || "", placeholder: "这段旅程从哪里开始？" }
      ],
      submitLabel: isNew ? "创建游记" : "保存",
      onSubmit: async (values) => {
        item.travelogues = Array.isArray(item.travelogues) ? item.travelogues : [];
        if (isNew) {
          item.travelogues.push({
            id: createId("travelogue"),
            title: values.title,
            date: values.date,
            description: values.description,
            notes: []
          });
        } else {
          Object.assign(travelogue, { title: values.title, date: values.date, description: values.description });
        }
        saveData();
        return () => refreshActiveView();
      }
    });
  }

  function openTravelNoteEditor(travelogue, note) {
    const isNew = !note;
    openDialogBase({
      title: isNew ? "添加文字记录" : "编辑文字记录",
      description: "记录这一站的见闻、感受或一句想留下的话。",
      fields: [
        { name: "date", label: "日期", value: note?.date || "", placeholder: "例如：2026.10.18" },
        { name: "text", label: "文字记录", type: "textarea", rows: 7, value: note?.text || "", placeholder: "写下这段旅程...", required: true }
      ],
      submitLabel: isNew ? "添加记录" : "保存",
      onSubmit: async (values) => {
        travelogue.notes = Array.isArray(travelogue.notes) ? travelogue.notes : [];
        if (isNew) {
          travelogue.notes.push({ id: createId("note"), date: values.date, text: values.text, photos: [] });
        } else {
          note.date = values.date;
          note.text = values.text;
        }
        saveData();
        return () => refreshActiveView();
      }
    });
  }

  async function addTravelPhotoRecord(travelogue) {
    const files = await pickImages();
    if (!files.length) return;
    const picker = createPhotoPicker(files);
    openDialogBase({
      title: "添加照片记录",
      description: "照片已经选好。可补充日期和一段文字。",
      fields: [
        { name: "date", label: "日期", placeholder: "例如：2026.10.18" },
        { name: "text", label: "配文（可选）", type: "textarea", rows: 4, placeholder: "这组照片背后的故事..." },
        { name: "caption", label: "照片说明（可选）", placeholder: "例如：海边的傍晚" }
      ],
      extraNode: picker.node,
      onCleanup: picker.cleanup,
      submitLabel: "添加记录",
      onSubmit: async (values) => {
        const photos = await filesToPhotos(picker.getFiles(), values.caption);
        travelogue.notes = Array.isArray(travelogue.notes) ? travelogue.notes : [];
        travelogue.notes.push({
          id: createId("note"),
          date: values.date,
          text: values.text,
          photos
        });
        saveData();
        return () => refreshActiveView();
      }
    });
  }

  async function addPhotosToTravelNote(travelogue, note) {
    const files = await pickImages();
    if (!files.length) return;
    const photos = await filesToPhotos(files);
    note.photos = Array.isArray(note.photos) ? note.photos : [];
    note.photos.push(...photos);
    saveData();
    refreshActiveView();
    showToast(`已添加 ${photos.length} 张照片。`);
  }

  function createPhotoPicker(initialFiles = []) {
    const files = [...initialFiles];
    const node = make("div", "photo-picker");
    const header = make("div", "photo-picker__header");
    header.append(make("strong", "", "照片"));
    const selectButton = makeButton("small-action small-action--accent", "＋ 选择照片");
    header.append(selectButton);
    const grid = make("div", "photo-picker__grid");
    const empty = make("p", "photo-picker__empty", "可从电脑中选择多张图片，照片会保存在当前浏览器中。");
    node.append(header, empty, grid);

    const render = () => {
      grid.replaceChildren();
      files.forEach((file, index) => {
        const card = make("figure", "photo-picker__item");
        const img = document.createElement("img");
        const url = URL.createObjectURL(file);
        img.src = url;
        img.alt = file.name;
        const remove = makeButton("photo-delete", "移除", () => {
          URL.revokeObjectURL(url);
          files.splice(index, 1);
          render();
        });
        const caption = make("figcaption");
        caption.append(make("span", "", file.name), remove);
        card.append(img, caption);
        grid.append(card);
      });
      empty.hidden = files.length > 0;
      grid.hidden = files.length === 0;
    };

    selectButton.addEventListener("click", async () => {
      const picked = await pickImages();
      if (picked.length) {
        files.push(...picked);
        render();
      }
    });
    render();
    return {
      node,
      getFiles: () => [...files],
      cleanup: () => grid.querySelectorAll("img").forEach((img) => URL.revokeObjectURL(img.src))
    };
  }

  function pickImages() {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.multiple = true;
      input.hidden = true;
      document.body.append(input);
      const finish = (files) => {
        input.remove();
        resolve(files);
      };
      input.addEventListener("change", () => finish(Array.from(input.files || [])));
      input.addEventListener("cancel", () => finish([]));
      input.click();
    });
  }

  let photoDbPromise = null;
  const photoUrlCache = new Map();

  function openPhotoDb() {
    if (photoDbPromise) return photoDbPromise;
    photoDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(PHOTO_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PHOTO_STORE_NAME)) {
          db.createObjectStore(PHOTO_STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return photoDbPromise;
  }

  async function storeImageFile(file) {
    const id = createId("photo");
    try {
      const db = await openPhotoDb();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(PHOTO_STORE_NAME, "readwrite");
        transaction.objectStore(PHOTO_STORE_NAME).put({
          id,
          blob: file,
          name: file.name,
          type: file.type,
          createdAt: Date.now()
        });
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      return `idb:${id}`;
    } catch (error) {
      console.warn("IndexedDB 不可用，改用内嵌图片。", error);
      return await fileToDataUrl(file);
    }
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function filesToPhotos(files, caption = "") {
    const photos = [];
    for (const file of files) {
      const ref = await storeImageFile(file);
      photos.push({
        id: createId("photo"),
        ref,
        alt: caption || file.name,
        caption: caption || file.name
      });
    }
    return photos;
  }

  async function resolvePhotoRef(ref) {
    if (!ref?.startsWith("idb:")) return ref;
    if (photoUrlCache.has(ref)) return photoUrlCache.get(ref);
    const id = ref.slice(4);
    try {
      const db = await openPhotoDb();
      const record = await new Promise((resolve, reject) => {
        const request = db.transaction(PHOTO_STORE_NAME, "readonly")
          .objectStore(PHOTO_STORE_NAME).get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!record?.blob) return "";
      const url = URL.createObjectURL(record.blob);
      photoUrlCache.set(ref, url);
      return url;
    } catch (error) {
      console.warn("读取照片失败。", error);
      return "";
    }
  }

  function hydratePhotoImages(root = document) {
    root.querySelectorAll('img[data-photo-ref^="idb:"]').forEach(async (img) => {
      if (img.dataset.loaded === "true") return;
      const src = await resolvePhotoRef(img.dataset.photoRef);
      if (src) {
        img.src = src;
        img.dataset.loaded = "true";
      } else {
        img.closest("figure, .collection-cover")?.classList.add("is-broken");
      }
    });
  }

  function setupInstallExperience() {
    if (!installButton) return;
    let deferredPrompt = null;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    installButton.hidden = Boolean(standalone);
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredPrompt = event;
      installButton.hidden = false;
      installButton.classList.add("is-ready");
    });

    installButton.addEventListener("click", async () => {
      if (!deferredPrompt) {
        openInfoDialog("安装到桌面", [
          "当前浏览器没有提供一键安装提示。请先确认网站是通过 http://localhost 或 HTTPS 打开的。",
          "Windows Chrome / Edge：点击地址栏右侧的“安装”图标，或打开浏览器菜单，选择“安装 Live · Create · Journey”。",
          "macOS Chrome / Edge：从浏览器菜单中选择“安装”或“添加到程序坞”。",
          "iPhone / iPad Safari：点击分享按钮，再选择“添加到主屏幕”。",
          "安装后可从桌面图标直接打开，已浏览内容支持离线访问。"
        ]);
        return;
      }
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") showToast("正在安装到桌面。");
      deferredPrompt = null;
    });

    window.addEventListener("appinstalled", () => {
      installButton.hidden = true;
      showToast("网站已安装到桌面。");
    });

    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("./service-worker.js").catch((error) => {
        console.warn("Service Worker 注册失败。", error);
      });
    }
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && routeStack.length > 1 && !isAnimating && !appDialog?.open) {
      navigateBack();
    }
  });

  renderSiteChrome();
  renderHomeCards();
  hydratePhotoImages(homeView);
  setupInstallExperience();
})();


