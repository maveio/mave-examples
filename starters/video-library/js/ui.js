// Small DOM helpers shared by the library page and the watch page.

import config from "../config.js";
import { formatDate, formatDuration, posterUrl, watchUrl } from "./mave.js";

const PREVIEW_DELAY = 350;

/** Creates an element: el("a", { class: "card", href: "/" }, child, "text"). */
export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === false || value == null) continue;
    node.setAttribute(name, value === true ? "" : value);
  }
  node.append(...children.filter((child) => child != null && child !== false));
  return node;
}

/** Fills in the site title and tagline wherever the page asks for them. */
export function applyBranding(pageTitle) {
  document.title = pageTitle ? `${pageTitle} · ${config.title}` : config.title;
  document.querySelectorAll("[data-site-title]").forEach((node) => {
    node.textContent = config.title;
  });
  document.querySelectorAll("[data-site-tagline]").forEach((node) => {
    node.textContent = config.tagline;
  });
}

/**
 * A video card: poster, duration, title and date.
 * `compact` renders the horizontal variant used in the "Up next" list.
 */
export function videoCard(video, { compact = false, categoryName = "" } = {}) {
  const thumb = el(
    "div",
    { class: "thumb" },
    el("img", {
      src: posterUrl(video, compact ? 320 : 640),
      alt: "",
      loading: "lazy",
      decoding: "async",
    }),
    el("span", { class: "badge duration" }, formatDuration(video.duration)),
    video.subtitles.length > 0 &&
      el("span", { class: "badge captions", title: "Subtitles available" }, "CC"),
  );

  const meta = [categoryName, formatDate(video.created)].filter(Boolean).join(" · ");

  const card = el(
    "a",
    { class: compact ? "card compact" : "card", href: watchUrl(video), "data-video": video.id },
    thumb,
    el(
      "div",
      { class: "card-body" },
      el("h3", { class: "card-title" }, video.title),
      el("p", { class: "card-meta" }, meta),
    ),
  );

  if (!compact && config.hoverPreview && video.hasClip) attachPreview(card, thumb, video);

  return card;
}

// Hover (or keyboard focus) swaps the poster for a silent, looping <mave-clip>.
// The clip is only created once someone lingers, so a grid of cards stays cheap.
function attachPreview(card, thumb, video) {
  let timer;
  let clip;

  const start = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (clip) return;
      clip = el("mave-clip", { embed: video.id, autoplay: "always", quality: "sd" });
      thumb.append(clip);
    }, PREVIEW_DELAY);
  };

  const stop = () => {
    clearTimeout(timer);
    clip?.remove();
    clip = null;
  };

  card.addEventListener("mouseenter", start);
  card.addEventListener("mouseleave", stop);
  card.addEventListener("focus", start);
  card.addEventListener("blur", stop);
}

/** Placeholder cards shown while the collections load. */
export function skeletonCards(count, { compact = false } = {}) {
  return Array.from({ length: count }, () =>
    el(
      "div",
      { class: compact ? "card compact skeleton" : "card skeleton", "aria-hidden": "true" },
      el("div", { class: "thumb" }),
      el("div", { class: "card-body" }, el("div", { class: "line" }), el("div", { class: "line short" })),
    ),
  );
}
