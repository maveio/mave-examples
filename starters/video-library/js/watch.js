// The watch page: the player, a transcript that follows along, and what to watch next.
//
// Picking another video does not reload the page. It changes the `embed` attribute
// on <mave-player>, and the component takes care of the rest.

import config from "../config.js";
import { findFolder, formatDate, formatDuration, loadLibrary, posterUrl, videosIn, watchUrl } from "./mave.js";
import { applyBranding, el, skeletonCards, videoCard } from "./ui.js";

const COUNTDOWN_SECONDS = 5;

const $ = (id) => document.getElementById(id);
const player = $("player");
const frame = $("player-frame");
const endScreen = $("end-screen");
const transcript = $("transcript");
const upNext = $("up-next");
const share = $("share");

let library;
let current;
let countdown;

applyBranding();
player.setAttribute("theme", config.playerTheme);
upNext.append(...skeletonCards(4, { compact: true }));

loadLibrary()
  .catch(() => ({ categories: [], videos: [], errors: [] }))
  .then((loaded) => {
    library = loaded;
    showFromUrl();
  });

window.addEventListener("popstate", showFromUrl);

function showFromUrl() {
  const id = new URLSearchParams(location.search).get("v");
  const video = library.videos.find((v) => v.id === id);

  $("watch").hidden = !video;
  $("missing").hidden = Boolean(video);
  if (video) show(video);
  else player.pause();
}

function show(video, { autoplay = false } = {}) {
  stopCountdown();
  current = video;

  const category = library.categories.find((c) => c.key === video.category);
  const folder = findFolder(category.root, video.folder);

  applyBranding(video.title);
  frame.style.aspectRatio = `${video.width} / ${video.height}`;

  // This is the whole integration: point the component at an embed ID.
  player.setAttribute("embed", video.id);
  if (autoplay) player.play()?.catch?.(() => {});

  $("title").textContent = video.title;
  $("meta").textContent = [
    formatDate(video.created),
    formatDuration(video.duration),
    video.subtitles.length > 0 && `Subtitles: ${video.subtitles.join(", ").toUpperCase()}`,
  ]
    .filter(Boolean)
    .join(" · ");

  $("breadcrumb").replaceChildren(
    ...[
      el("a", { href: `./?c=${category.key}` }, category.name),
      ...folder.path.map((step) =>
        el("a", { href: `./?c=${category.key}&folder=${encodeURIComponent(step.id)}` }, step.name),
      ),
    ].flatMap((link, index) => (index ? [el("span", { "aria-hidden": "true" }, "/"), link] : [link])),
  );

  showTranscript(video);

  upNext.replaceChildren(...queueAfter(video).map((next) => videoCard(next, { compact: true })));
}

// <mave-text> follows along with the player that has the same embed ID, and a
// click on a sentence jumps to it.
function showTranscript(video) {
  transcript.querySelector("mave-text")?.remove();
  transcript.hidden = true;
  if (video.subtitles.length === 0) return;

  const text = el("mave-text", { embed: video.id });
  transcript.append(text);

  // Not every video with subtitles has a transcript, so the panel stays hidden
  // until <mave-text> has something to show.
  customElements.whenDefined("mave-text").then(() => {
    const reveal = () => {
      if (!text.isConnected) return observer.disconnect();
      if (!text.shadowRoot.querySelector("[role=region]")) return;
      transcript.hidden = false;
      observer.disconnect();
    };
    const observer = new MutationObserver(reveal);
    observer.observe(text.shadowRoot, { childList: true, subtree: true });
    reveal();
  });
}

// The rest of the category in upload order, starting after the current video
// and wrapping around, so a series plays through from wherever you start.
function queueAfter(video) {
  const category = library.categories.find((c) => c.key === video.category);
  const ordered = videosIn(category.root).sort((a, b) => a.created - b.created);
  const index = ordered.findIndex((v) => v.id === video.id);
  return [...ordered.slice(index + 1), ...ordered.slice(0, index)];
}

function open(video, options) {
  history.pushState(null, "", watchUrl(video));
  show(video, options);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Clicking a card in "Up next" swaps the video without leaving the page.
upNext.addEventListener("click", (event) => {
  const card = event.target.closest("a[data-video]");
  if (!card || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  const video = library.videos.find((v) => v.id === card.dataset.video);
  if (!video) return;
  event.preventDefault();
  open(video, { autoplay: true });
});

// --- End screen ----------------------------------------------------------------
// <mave-player> re-dispatches the media events of its video, and reveals whatever
// sits in slot="end-screen" once the video has ended.

player.addEventListener("ended", () => {
  const next = queueAfter(current)[0];
  renderEndScreen(next, config.autoplayNext && next ? COUNTDOWN_SECONDS : null);
});

player.addEventListener("play", stopCountdown);

function renderEndScreen(next, seconds) {
  stopCountdown();

  const replay = el("button", { type: "button", class: "button quiet" }, "Watch again");
  replay.addEventListener("click", () => player.restart());

  if (!next) {
    endScreen.replaceChildren(el("div", { class: "end-screen-body" }, replay));
    return;
  }

  const label = el("p", { class: "eyebrow" });
  const playNext = el("button", { type: "button", class: "button" }, "Play now");
  const cancel = el("button", { type: "button", class: "button quiet" }, "Cancel");

  playNext.addEventListener("click", () => open(next, { autoplay: true }));
  cancel.addEventListener("click", () => renderEndScreen(next, null));

  endScreen.replaceChildren(
    el(
      "div",
      { class: "end-screen-body" },
      label,
      el("img", { src: posterUrl(next, 320), alt: "" }),
      el("h3", {}, next.title),
      el("div", { class: "end-screen-actions" }, playNext, seconds == null ? replay : cancel),
    ),
  );

  if (seconds == null) {
    label.textContent = "Up next";
    return;
  }

  let remaining = seconds;
  const tick = () => {
    label.textContent = `Up next in ${remaining}`;
    if (remaining === 0) open(next, { autoplay: true });
    remaining -= 1;
  };
  tick();
  countdown = setInterval(tick, 1000);
}

function stopCountdown() {
  clearInterval(countdown);
  countdown = null;
}

// --- Share ---------------------------------------------------------------------

share.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    share.textContent = "Link copied";
  } catch {
    share.textContent = "Copy the address bar";
  }
  setTimeout(() => (share.textContent = "Copy link"), 2000);
});
