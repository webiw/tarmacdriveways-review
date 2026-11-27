"use strict";

const all = (root, selector) => [...root.querySelectorAll(selector)];
function activate(control, handler) {
  control.addEventListener("click", handler);
  if (control.matches('button, a[href]')) return;
  control.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handler(event);
    }
  });
}

for (const button of all(document, ".elementor-menu-toggle")) {
  const nav = document.getElementById(button.getAttribute("aria-controls"));
  if (!nav) continue;
  const isOpen = () => button.getAttribute("aria-expanded") === "true";
  const setOpen = open => {
    button.classList.toggle("elementor-active", open);
    button.setAttribute("aria-expanded", String(open));
    nav.inert = !open;
    nav.setAttribute("aria-hidden", String(!open));
    if (open) {
      nav.style.left = "0";
      const offset = nav.getBoundingClientRect().left;
      nav.style.left = `${-offset}px`;
    }
  };
  activate(button, () => setOpen(!isOpen()));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && isOpen()) {
      setOpen(false);
      button.focus();
    }
  });
  document.addEventListener("click", event => {
    if (isOpen() && !nav.contains(event.target) && !button.contains(event.target)) setOpen(false);
  });
  nav.addEventListener("click", event => {
    if (event.target.closest("a[href]")) setOpen(false);
  });
  matchMedia("(min-width: 1025px)").addEventListener("change", () => setOpen(false));
}

let mediaDialog;
function showMedia(items, start, trigger) {
  if (!mediaDialog) {
    mediaDialog = document.createElement("dialog");
    mediaDialog.className = "static-dialog";
    mediaDialog.setAttribute("aria-label", "Image viewer");
    mediaDialog.innerHTML = `
      <div class="static-dialog-controls">
        <button type="button" data-close aria-label="Close image viewer">Close</button>
      </div>
      <figure>
        <div class="static-dialog-photo">
          <img alt="" draggable="false">
          <button type="button" data-previous aria-label="Previous image">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>
          </button>
          <button type="button" data-next aria-label="Next image">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>
          </button>
        </div>
        <figcaption aria-live="polite"></figcaption>
      </figure>`;
    document.body.append(mediaDialog);
  }
  const image = mediaDialog.querySelector("img");
  const caption = mediaDialog.querySelector("figcaption");
  const previous = mediaDialog.querySelector("[data-previous]");
  const next = mediaDialog.querySelector("[data-next]");
  let index = start;
  const show = shift => {
    index = (index + shift + items.length) % items.length;
    const item = items[index];
    image.src = item.src;
    image.alt = item.title;
    caption.textContent = items.length > 1 ? `${index + 1} / ${items.length} · ${item.title}` : item.title;
  };
  previous.hidden = next.hidden = items.length < 2;
  previous.onclick = () => show(-1);
  next.onclick = () => show(1);
  mediaDialog.querySelector("[data-close]").onclick = () => mediaDialog.close();
  mediaDialog.onkeydown = event => {
    if (items.length < 2 || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    show(event.key === "ArrowLeft" ? -1 : 1);
  };
  mediaDialog.onclick = event => {
    if (event.target === mediaDialog) {
      const box = mediaDialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right ||
          event.clientY < box.top || event.clientY > box.bottom) mediaDialog.close();
    }
  };
  mediaDialog.onclose = () => trigger.focus();
  show(0);
  mediaDialog.showModal();
  mediaDialog.querySelector("[data-close]").focus();
}

for (const gallery of all(document, ".static-gallery")) {
  const items = all(gallery, ".e-gallery-item");
  const tabs = all(gallery.closest(".elementor-widget-gallery"), ".elementor-gallery-title");
  function layout() {
    const visible = items.filter(item => !item.hidden);
    const variant = gallery.dataset.layout;
    if (variant === "masonry") {
      const css = getComputedStyle(gallery);
      const count = Number(css.getPropertyValue("--gallery-columns")) || 1;
      const heights = Array(count).fill(0);
      const columns = heights.map(() => {
        const column = document.createElement("div");
        column.className = "gallery-column";
        return column;
      });
      for (const item of visible) {
        const image = item.querySelector("img");
        const ratio = (Number(image?.getAttribute("height")) || 1) /
                      (Number(image?.getAttribute("width")) || 1);
        const index = heights.indexOf(Math.min(...heights));
        columns[index].append(item);
        heights[index] += ratio;
      }
      gallery.classList.add("gallery-ready");
      gallery.replaceChildren(...columns);
    }
    if (variant === "justified") {
      const preferred = parseFloat(getComputedStyle(gallery).getPropertyValue("--preferred-gallery-height")) || 150;
      const width = gallery.clientWidth;
      if (!width) return;
      let row = [];
      let totalRatio = 0;
      function paintRow(complete) {
        if (!row.length) return;
        const fitted = (width - 10 * (row.length - 1) - 1) / totalRatio;
        const height = complete ? fitted : Math.min(preferred, fitted);
        for (const [item, ratio] of row) {
          item.style.setProperty("--gallery-basis", `${Math.floor(height * ratio)}px`);
          item.style.setProperty("--gallery-height", `${height}px`);
        }
        row = [];
        totalRatio = 0;
      }
      for (const item of visible) {
        const image = item.querySelector("img");
        const ratio = (Number(image?.getAttribute("width")) || 1) / (Number(image?.getAttribute("height")) || 1);
        row.push([item, ratio]);
        totalRatio += ratio;
        if (totalRatio * preferred + (row.length - 1) * 10 >= width) paintRow(true);
      }
      paintRow(false);
    }
  }
  let lastWidth;
  new ResizeObserver(entries => {
    const width = entries[0].contentRect.width;
    if (width !== lastWidth) {
      lastWidth = width;
      layout();
    }
  }).observe(gallery);
  for (const tab of tabs) {
    activate(tab, () => {
      for (const option of tabs) option.setAttribute("aria-pressed", String(option === tab));
      const key = tab.dataset.galleryIndex;
      for (const item of items) item.hidden = key !== "all" && !item.dataset.eGalleryTags?.split(",").includes(key);
      layout();
    });
  }
}

document.addEventListener("click", event => {
  const link = event.target.closest("a[data-elementor-open-lightbox=yes][href]");
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  const group = link.dataset.elementorLightboxSlideshow;
  const links = group ? all(document, 'a[data-elementor-open-lightbox="yes"][href]')
    .filter(candidate => candidate.dataset.elementorLightboxSlideshow === group && !candidate.hidden) : [link];
  const entries = links.map(item => ({
    src: item.href,
    title: item.dataset.elementorLightboxTitle || item.querySelector("img")?.alt || "Driveway photo"
  }));
  showMedia(entries, Math.max(links.indexOf(link), 0), link);
});

for (const slider of all(document, ".elementor-main-swiper, .elementor-image-carousel-wrapper")) {
  const slides = all(slider, ".swiper-wrapper > .swiper-slide");
  if (slides.length < 2) continue;
  const dots = slider.querySelector(".swiper-pagination");
  let index = 0;
  let paused = false;
  const show = next => {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, position) => {
      slide.classList.toggle("is-current", position === index);
      slide.setAttribute("aria-hidden", String(position !== index));
      slide.inert = position !== index;
    });
    if (dots) all(dots, "button").forEach((dot, position) => dot.classList.toggle("swiper-pagination-bullet-active", position === index));
  };
  if (dots) slides.forEach((_, position) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "swiper-pagination-bullet";
    dot.setAttribute("aria-label", `Go to slide ${position + 1}`);
    dot.addEventListener("click", () => show(position));
    dots.append(dot);
  });
  for (const [selector, offset] of [[".elementor-swiper-button-prev", -1], [".elementor-swiper-button-next", 1]]) {
    const arrow = slider.querySelector(selector);
    if (arrow) activate(arrow, () => show(index + offset));
  }
  slider.dataset.carouselReady = "";
  show(0);
  slider.addEventListener("mouseenter", () => { paused = true; });
  slider.addEventListener("mouseleave", () => { paused = false; });
  let swipeStart;
  slider.addEventListener("touchstart", event => { swipeStart = event.touches[0].clientX; }, { passive: true });
  slider.addEventListener("touchend", event => {
    const distance = event.changedTouches[0].clientX - swipeStart;
    if (Math.abs(distance) > 42) show(index + (distance < 0 ? 1 : -1));
  }, { passive: true });
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setInterval(() => {
      if (!paused && !slider.contains(document.activeElement) && document.visibilityState === "visible") show(index + 1);
    }, 5000);
  }
}

for (const item of all(document, ".e-n-accordion-item")) {
  item.addEventListener("toggle", () => {
    item.querySelector("summary").setAttribute("aria-expanded", String(item.open));
    if (!item.open) return;
    for (const sibling of item.parentElement.children) {
      if (sibling !== item && sibling.matches("details.e-n-accordion-item")) sibling.open = false;
    }
  });
}
for (const tab of all(document, ".elementor-accordion .elementor-tab-title")) {
  const panel = tab.nextElementSibling;
  if (!panel?.matches(".elementor-tab-content")) continue;
  tab.tabIndex = 0;
  const set = open => {
    tab.setAttribute("aria-expanded", String(open));
    tab.classList.toggle("elementor-active", open);
    panel.hidden = !open;
    panel.style.display = open ? "block" : "";
  };
  set(tab === tab.closest(".elementor-accordion").querySelector(".elementor-tab-title"));
  activate(tab, () => set(panel.hidden));
}
for (const outline of all(document, ".elementor-widget-table-of-contents")) {
  const body = outline.querySelector(".elementor-toc__body");
  if (!body) continue;
  const buttons = all(outline, ".elementor-toc__toggle-button");
  const set = open => {
    body.hidden = !open;
    outline.classList.toggle("elementor-toc--collapsed", !open);
    buttons.forEach(button => button.setAttribute("aria-expanded", String(open)));
  };
  set(!outline.matches(".elementor-toc--minimized-on-tablet") || innerWidth > 1024);
  buttons.forEach(button => activate(button, () => set(body.hidden)));
}
for (const video of all(document, "[data-youtube]")) {
  const play = video.querySelector(".elementor-custom-embed-play, .static-video-play");
  if (!play) continue;
  activate(play, () => {
    const frame = document.createElement("iframe");
    frame.title = play.getAttribute("aria-label") || "Driveway video";
    frame.src = `https://www.youtube-nocookie.com/embed/${video.dataset.youtube}?autoplay=1`;
    frame.allow = "autoplay; encrypted-media; picture-in-picture";
    frame.allowFullscreen = true;
    video.replaceChildren(frame);
    frame.focus();
  });
}

for (const reviews of all(document, ".ti-widget[data-layout-id]")) {
  const track = reviews.querySelector(".ti-reviews-container-wrapper");
  const container = reviews.querySelector(".ti-widget-container");
  if (!track || !container) continue;
  let lastWidth;
  new ResizeObserver(([{ contentRect }]) => {
    const width = contentRect.width;
    if (width === lastWidth) return;
    lastWidth = width;
    const columns = width < 600 ? 1 : Math.min(4, Math.max(1, Math.floor((width - 260) / 245)));
    container.classList.remove(...[...container.classList].filter(name => name.startsWith("ti-col-")));
    container.classList.add(`ti-col-${columns === 1 ? 1 : columns + 1}`);
    track.style.setProperty("--review-columns", columns);
  }).observe(container);
  for (const [selector, direction] of [[".ti-prev", -1], [".ti-next", 1]]) {
    const control = reviews.querySelector(selector);
    if (!control) continue;
    activate(control, () => {
      const limit = track.scrollWidth - track.clientWidth;
      const item = track.querySelector(".ti-review-item");
      const step = (item?.getBoundingClientRect().width || track.clientWidth) + 12;
      const left = track.scrollLeft + step * direction;
      track.scrollTo({ left: left > limit + 2 ? 0 : left < -2 ? limit : left, behavior: "smooth" });
    });
  }
  for (const text of all(track, ".ti-review-content")) {
    const slot = text.closest(".ti-inner")?.querySelector(".ti-read-more");
    if (slot && text.textContent.trim().length > 160) {
      const read = document.createElement("button");
      text.classList.add("truncated");
      read.type = "button";
      read.textContent = "Read more";
      read.setAttribute("aria-expanded", "false");
      slot.replaceChildren(read);
      read.addEventListener("click", () => {
        const truncated = text.classList.toggle("truncated");
        read.textContent = truncated ? "Read more" : "Read less";
        read.setAttribute("aria-expanded", String(!truncated));
      });
    }
    for (const picture of all(text, ".ti-review-image img")) {
      picture.tabIndex = 0;
      picture.setAttribute("role", "button");
      activate(picture, () => showMedia([{ src: picture.currentSrc || picture.src, title: "Review photo" }], 0, picture));
    }
  }
}

const newsFeed = document.querySelector("[data-trustindex-feed]");
if (newsFeed) {
  const fallback = newsFeed.querySelector("[data-feed-fallback]");
  const protectLinks = root => {
    for (const link of all(root, "a[href]")) {
      if (!/^https?:/.test(link.protocol) || link.origin === location.origin) continue;
      link.target = "_blank";
      link.rel = "nofollow noopener";
    }
  };
  const widgetUpdates = new MutationObserver(() => {
    protectLinks(newsFeed);
    fallback.hidden = Boolean(newsFeed.querySelector(".ti-layout-item"));
  });
  widgetUpdates.observe(newsFeed, { childList: true, subtree: true });

  const viewerUpdates = new MutationObserver(() => {
    const viewer = document.querySelector("#ti-lightbox");
    if (!viewer) return;
    protectLinks(viewer);
    viewerUpdates.observe(viewer, { childList: true, subtree: true });
  });
  viewerUpdates.observe(document.body, { childList: true });

  const script = document.createElement("script");
  script.src = newsFeed.dataset.trustindexFeed;
  script.async = true;
  newsFeed.append(script);
}

const rates = {
  TARMAC: [[90, 110], [80, 90], [65, 85]],
  ASPHALT: [[95, 115], [85, 95], [70, 90]],
  RESIN: [[130, 170], [130, 170], [130, 170]],
  DUNNO: [[90, 115], [80, 95], [65, 90]]
};
const decimal = new Intl.NumberFormat("en-IE", { useGrouping: false, maximumFractionDigits: 2 });
for (const calculator of all(document, "[data-calculator]")) {
  const length = calculator.querySelector("[data-calc-length]");
  const width = calculator.querySelector("[data-calc-width]");
  const area = calculator.querySelector("[data-calc-area]");
  const material = calculator.querySelector("[data-calc-material]");
  const low = calculator.querySelector("[data-calc-from]");
  const high = calculator.querySelector("[data-calc-to]");
  const update = () => {
    const metres = area.valueAsNumber * (calculator.dataset.calculator === "ft" ? 0.09290304 : 1);
    const valid = Number.isFinite(metres) && metres > 0 && (metres >= 30 || material.value === "RESIN");
    const bracket = metres <= 60 ? 0 : metres <= 90 ? 1 : 2;
    const range = rates[material.value][bracket];
    low.value = valid ? decimal.format(metres * range[0]) : "";
    high.value = valid ? decimal.format(metres * range[1]) : "";
  };
  [length, width].forEach(input => input.addEventListener("input", () => {
    const size = length.valueAsNumber * width.valueAsNumber;
    area.value = Number.isFinite(size) && size > 0 ? Number(size.toFixed(4)) : "";
    update();
  }));
  area.addEventListener("input", update);
  material.addEventListener("change", update);
  update();
}

function booking(form) {
  const service = form.querySelector("[data-booking-service]");
  const times = form.querySelector("[data-booking-times]");
  const calendar = form.querySelector("[data-booking-calendar]");
  const availableFrom = new Date();
  availableFrom.setHours(0, 0, 0, 0);
  availableFrom.setDate(availableFrom.getDate() + 4);
  const date = new Date(availableFrom.getFullYear(), availableFrom.getMonth(), 1);
  let selectedDay;
  let selectedTime;
  function timeOptions() {
    selectedTime = null;
    times.replaceChildren();
    if (!selectedDay) return;
    if (service.value === "asphalt") {
      times.textContent = "No sample times for this service.";
      return;
    }
    const saturday = selectedDay.getDay() === 6;
    const slots = saturday ? ["09:10-10:10", "10:10-11:10"] : Array.from({ length: 9 }, (_, index) => {
      const time = hour => String(hour).padStart(2, "0") + ":00";
      return `${time(index + 8)}-${time(index + 9)}`;
    });
    for (const slot of slots) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = slot;
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        selectedTime = slot;
        for (const item of times.children) item.setAttribute("aria-pressed", String(item === button));
      });
      times.append(button);
    }
  }
  function paint() {
    const initialMonth = date.getFullYear() === availableFrom.getFullYear() && date.getMonth() === availableFrom.getMonth();
    calendar.innerHTML = `<div class="booking-month"><button type="button" aria-label="Previous month" ${initialMonth ? "disabled" : ""}>&lt;</button>
      <strong></strong><button type="button" aria-label="Next month">&gt;</button></div>
      <div class="booking-grid"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div>`;
    calendar.querySelector("strong").textContent = date.toLocaleDateString("en-IE", { month: "long", year: "numeric" });
    const [back, forward] = all(calendar, "button");
    back.addEventListener("click", () => { date.setMonth(date.getMonth() - 1); paint(); });
    forward.addEventListener("click", () => { date.setMonth(date.getMonth() + 1); paint(); });
    const grid = calendar.querySelector(".booking-grid");
    const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    for (let empty = 0; empty < date.getDay(); empty++) grid.append(document.createElement("span"));
    for (let day = 1; day <= days; day++) {
      const value = new Date(date.getFullYear(), date.getMonth(), day);
      const button = document.createElement("button");
      button.type = "button";
      button.disabled = value < availableFrom || value.getDay() === 0;
      button.textContent = String(day);
      button.setAttribute("aria-label", value.toLocaleDateString("en-IE", { dateStyle: "full" }));
      button.setAttribute("aria-pressed", String(value.getTime() === selectedDay?.getTime()));
      button.addEventListener("click", () => {
        selectedDay = value;
        for (const item of all(grid, "button")) item.setAttribute("aria-pressed", String(item === button));
        timeOptions();
      });
      grid.append(button);
    }
  }
  service.addEventListener("change", timeOptions);
  selectedDay = new Date(availableFrom);
  if (selectedDay.getDay() === 0) selectedDay.setDate(selectedDay.getDate() + 1);
  date.setFullYear(selectedDay.getFullYear(), selectedDay.getMonth(), 1);
  paint();
  timeOptions();
  return () => selectedTime ? "Demo complete. No appointment was made." : "Choose a sample date and time.";
}

for (const form of all(document, "form[data-demo]")) {
  const result = form.dataset.demo === "booking" ? booking(form) : () => "Demo complete. No message was sent.";
  const status = form.querySelector(".demo-status");
  form.addEventListener("submit", event => {
    event.preventDefault();
    status.hidden = false;
    status.textContent = result();
  });
  form.inert = false;
}

const search = document.querySelector("[data-site-search]");
if (search) {
  const input = search.querySelector("input");
  const entries = all(search, "li");
  const count = search.querySelector("[data-results-count]");
  const filter = () => {
    const terms = input.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    let total = 0;
    for (const item of entries) {
      item.hidden = !terms.every(term => item.dataset.searchText.includes(term));
      if (!item.hidden) total++;
    }
    count.textContent = `${total} result${total === 1 ? "" : "s"}`;
  };
  input.value = new URLSearchParams(location.search).get("s") || "";
  input.addEventListener("input", filter);
  filter();
}
