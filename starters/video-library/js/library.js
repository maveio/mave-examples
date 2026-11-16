// The library page: category tabs, folders, search, sorting and the video grid.
//
// What you see is always derived from the URL (?c=category&folder=id&q=text&sort=key),
// so every view can be bookmarked and shared, and the back button just works.

import config from "../config.js";
import { findFolder, formatDate, formatDuration, loadLibrary, posterUrl, videosIn, watchUrl } from "./mave.js";
import { applyBranding, el, skeletonCards, videoCard } from "./ui.js";

const SORTS = {
  newest: (a, b) => b.created - a.created,
  oldest: (a, b) => a.created - b.created,
  title: (a, b) => a.title.localeCompare(b.title),
  longest: (a, b) => b.duration - a.duration,
  shortest: (a, b) => a.duration - b.duration,
};

const $ = (id) => document.getElementById(id);
const hero = $("hero");
const tabs = $("tabs");
const breadcrumb = $("breadcrumb");
const count = $("count");
const grid = $("grid");
const empty = $("empty");
const notice = $("notice");
const searchInput = $("q");
const sortSelect = $("sort");

let library;

applyBranding();
grid.append(...skeletonCards(8));

loadLibrary()
  .then((loaded) => {
    library = loaded;
    render();
  })
  .catch((error) => {
    library = { categories: [], videos: [], errors: [error.message] };
    render();
  });

// --- URL state ---------------------------------------------------------------

function readState() {
  const params = new URLSearchParams(location.search);
  return {
    category: params.get("c") || "",
    folder: params.get("folder") || "",
    query: params.get("q") || "",
    sort: SORTS[params.get("sort")] ? params.get("sort") : "newest",
  };
}

function urlFor(changes) {
  const state = { ...readState(), ...changes };
  const params = new URLSearchParams();
  if (state.category) params.set("c", state.category);
  if (state.folder) params.set("folder", state.folder);
  if (state.query) params.set("q", state.query);
  if (state.sort !== "newest") params.set("sort", state.sort);
  const search = params.toString();
  return search ? `?${search}` : location.pathname;
}

function navigate(changes, { replace = false } = {}) {
  history[replace ? "replaceState" : "pushState"](null, "", urlFor(changes));
  render();
}

// Links inside the page (tabs, folders, breadcrumbs) carry a real href, so they
// open in a new tab as expected. A normal click updates the page in place.
document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-nav]");
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault();
  history.pushState(null, "", link.getAttribute("href"));
  render();
  window.scrollTo({ top: 0 });
});

window.addEventListener("popstate", render);

searchInput.addEventListener("input", () => {
  navigate({ query: searchInput.value.trim(), folder: "" }, { replace: true });
});
$("search").addEventListener("submit", (event) => event.preventDefault());

sortSelect.addEventListener("change", () => navigate({ sort: sortSelect.value }, { replace: true }));

// --- Rendering ---------------------------------------------------------------

function render() {
  if (!library) return;

  const state = readState();
  const category = library.categories.find((c) => c.key === state.category);
  const single = library.categories.length === 1 ? library.categories[0] : null;
  const scope = category || single;
  const folder = scope ? findFolder(scope.root, state.folder) || scope.root : null;
  const searching = state.query !== "";

  if (searchInput.value.trim() !== state.query) searchInput.value = state.query;
  sortSelect.value = state.sort;

  // Searching looks through everything in the current category, folders included.
  // Browsing shows the videos that sit directly in the current folder.
  let videos;
  if (searching) videos = (scope ? videosIn(scope.root) : library.videos).filter(matches(state.query));
  else videos = folder ? folder.videos : library.videos;
  videos = [...videos].sort(SORTS[state.sort]);

  const folders = !searching && folder ? folder.folders : [];

  renderNotice();
  renderHero(!searching && !state.folder && !category);
  renderTabs(state, single);
  renderBreadcrumb(scope, folder, searching);
  renderCount(videos.length, folders.length, state.query);

  const categoryNames = new Map(library.categories.map((c) => [c.key, c.name]));
  grid.replaceChildren(
    ...folders.map(folderCard),
    ...videos.map((video) =>
      videoCard(video, { categoryName: scope ? "" : categoryNames.get(video.category) }),
    ),
  );

  renderEmpty(videos.length + folders.length === 0, state.query);
}

function matches(query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return (video) => {
    const title = video.title.toLowerCase();
    return words.every((word) => title.includes(word));
  };
}

function renderNotice() {
  notice.hidden = library.errors.length === 0;
  notice.replaceChildren(
    el("strong", {}, "Some videos could not be loaded. "),
    "Check the collection tokens in config.js.",
    el("ul", {}, ...library.errors.map((message) => el("li", {}, message))),
  );
}

function renderHero(show) {
  const video =
    library.videos.find((v) => v.id === config.featured) ||
    [...library.videos].sort(SORTS.newest)[0];

  hero.hidden = !show || !video;
  if (hero.hidden) {
    hero.replaceChildren();
    delete hero.dataset.video;
    return;
  }
  if (hero.dataset.video === video.id) return;

  hero.dataset.video = video.id;
  hero.href = watchUrl(video);
  hero.replaceChildren(
    el("img", { class: "hero-media", src: posterUrl(video, 1600), alt: "" }),
    // A silent looping clip as moving backdrop, when the video has one.
    video.hasClip && el("mave-clip", { class: "hero-media", embed: video.id, autoplay: "always" }),
    el(
      "div",
      { class: "hero-body" },
      el("p", { class: "eyebrow" }, config.featured ? "Featured" : "Latest video"),
      el("h1", {}, video.title),
      el("p", { class: "hero-meta" }, `${formatDuration(video.duration)} · ${formatDate(video.created)}`),
      el("span", { class: "button" }, "Watch now"),
    ),
  );
}

function renderTabs(state, single) {
  tabs.hidden = Boolean(single) || library.categories.length === 0;
  if (tabs.hidden) return;

  const tab = (label, key, total) =>
    el(
      "a",
      {
        class: "tab",
        href: urlFor({ category: key, folder: "" }),
        "data-nav": true,
        "aria-current": state.category === key ? "page" : null,
      },
      label,
      el("span", { class: "tab-count" }, String(total)),
    );

  tabs.replaceChildren(
    tab("All", "", library.videos.length),
    ...library.categories.map((c) => tab(c.name, c.key, videosIn(c.root).length)),
  );
}

function renderBreadcrumb(scope, folder, searching) {
  const trail = !searching && scope && folder ? folder.path : [];
  breadcrumb.hidden = trail.length === 0;
  if (breadcrumb.hidden) return;

  const link = (label, id) => el("a", { href: urlFor({ folder: id }), "data-nav": true }, label);
  const crumbs = [link(scope.name, ""), ...trail.slice(0, -1).map((step) => link(step.name, step.id))];

  breadcrumb.replaceChildren(
    ...crumbs.flatMap((crumb) => [crumb, el("span", { "aria-hidden": "true" }, "/")]),
    el("span", { "aria-current": "page" }, trail.at(-1).name),
  );
}

function renderCount(videoCount, folderCount, query) {
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (query) count.textContent = `${plural(videoCount, "result")} for “${query}”`;
  else if (folderCount) count.textContent = `${plural(folderCount, "folder")}, ${plural(videoCount, "video")}`;
  else count.textContent = plural(videoCount, "video");
}

function renderEmpty(isEmpty, query) {
  empty.hidden = !isEmpty || library.errors.length > 0;
  if (empty.hidden) return;

  if (query) {
    empty.replaceChildren(
      el("h2", {}, `No videos match “${query}”`),
      el("p", {}, "Try a different word, or look through everything."),
      el("a", { class: "button", href: urlFor({ query: "" }), "data-nav": true }, "Clear search"),
    );
  } else {
    empty.replaceChildren(
      el("h2", {}, "No videos here yet"),
      el("p", {}, "Upload a video to this collection in Mave and it shows up here."),
    );
  }
}

function folderCard(folder) {
  const inside = videosIn(folder);
  const cover = inside[0];

  return el(
    "a",
    { class: "card folder", href: urlFor({ folder: folder.id }), "data-nav": true },
    el(
      "div",
      { class: "thumb" },
      cover && el("img", { src: posterUrl(cover), alt: "", loading: "lazy", decoding: "async" }),
      el("span", { class: "badge folder-badge" }, "Folder"),
    ),
    el(
      "div",
      { class: "card-body" },
      el("h3", { class: "card-title" }, folder.name),
      el("p", { class: "card-meta" }, `${inside.length} video${inside.length === 1 ? "" : "s"}`),
    ),
  );
}
