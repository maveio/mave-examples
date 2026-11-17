// The data layer: everything this starter knows about your videos comes from here.
//
// It reads the same public endpoint the <mave-list> component uses
// (GET {apiEndpoint}/collection/{token}), so a collection token is all you need.
// No API key ever reaches the browser.

import config from "../config.js";

const CACHE_KEY = "mave-library:v1";
const CACHE_TTL = 5 * 60 * 1000;
const MAX_FOLDER_DEPTH = 3;

let pending;

/**
 * Loads every configured collection, including the folders inside it.
 *
 * Returns { categories, videos, errors } where
 * - categories: [{ key, name, root }] and root is a folder { id, name, path, videos, folders }
 * - videos: every video in the library as one flat list
 * - errors: one message per collection that could not be loaded
 */
export function loadLibrary() {
  pending ??= readCache() ?? fetchLibrary().then(writeCache);
  return Promise.resolve(pending);
}

async function fetchLibrary() {
  const keys = new Set();
  const results = await Promise.allSettled(
    config.collections.map((collection) => fetchFolder(collection.token)),
  );

  const categories = [];
  const errors = [];

  results.forEach((result, index) => {
    const { label } = config.collections[index];
    if (result.status === "rejected") {
      errors.push(`${label || `Collection ${index + 1}`}: ${result.reason.message}`);
      return;
    }

    const name = label || result.value.name || `Collection ${index + 1}`;
    let key = slugify(name) || `collection-${index + 1}`;
    if (keys.has(key)) key = `${key}-${index + 1}`;
    keys.add(key);

    const root = { ...result.value, name };
    tag(root, key, []);
    categories.push({ key, name, root });
  });

  return {
    categories,
    videos: categories.flatMap((category) => flatten(category.root)),
    errors,
  };
}

async function fetchFolder(token, folderId = null, depth = 0) {
  const url = new URL(`${config.apiEndpoint}/collection/${token}`);
  if (folderId) url.searchParams.set("embed", folderId);

  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  // `embeds` carries the renditions per video, which tells us whether a short
  // preview clip exists for the hover effect.
  const withClip = new Set(
    (data.embeds || [])
      .filter((embed) => embed.video?.renditions?.some((r) => r.type === "clip"))
      .map((embed) => embed.id),
  );

  // A collection token can open its own folders. Folders that cannot be opened
  // (too deep, or removed in the meantime) are skipped instead of breaking the page.
  const folders =
    depth < MAX_FOLDER_DEPTH
      ? await Promise.all(
          (data.collections || []).map((folder) =>
            fetchFolder(token, folder.id, depth + 1)
              .then((loaded) => ({ ...loaded, id: folder.id, name: folder.name }))
              .catch((error) => {
                console.warn(`Skipped folder "${folder.name}": ${error.message}`);
                return null;
              }),
          ),
        )
      : [];

  return {
    id: folderId,
    name: data.name || "",
    videos: (data.videos || []).map((video) => toVideo(video, withClip.has(video.id))),
    folders: folders.filter(Boolean),
  };
}

function toVideo(video, hasClip) {
  return {
    id: video.id,
    title: video.name || "Untitled",
    duration: video.duration || 0,
    created: (video.created || 0) * 1000,
    width: video.width || 16,
    height: video.height || 9,
    language: video.language || "",
    subtitles: video.subtitles || [],
    poster: video.poster_image || "",
    hasClip,
  };
}

// Remember where each folder and video lives, so every page can build
// breadcrumbs and "more from this category" without another request.
function tag(folder, categoryKey, path) {
  folder.path = path;
  folder.videos.forEach((video) => {
    video.category = categoryKey;
    video.folder = folder.id;
  });
  folder.folders.forEach((child) =>
    tag(child, categoryKey, [...path, { id: child.id, name: child.name }]),
  );
}

function flatten(folder) {
  return [...folder.videos, ...folder.folders.flatMap(flatten)];
}

export function findFolder(folder, id) {
  if (!id) return folder;
  if (folder.id === id) return folder;
  for (const child of folder.folders) {
    const match = findFolder(child, id);
    if (match) return match;
  }
  return null;
}

export function videosIn(folder) {
  return flatten(folder);
}

// The collections are cached for a few minutes per browser tab, which makes
// moving between the library and a video instant.
function readCache() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY));
    if (cached && cached.config === configFingerprint() && Date.now() - cached.at < CACHE_TTL) {
      return cached.library;
    }
  } catch {
    // Storage can be unavailable (private mode, blocked site data). Just fetch.
  }
  return null;
}

function writeCache(library) {
  try {
    if (library.errors.length === 0) {
      sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ at: Date.now(), config: configFingerprint(), library }),
      );
    }
  } catch {
    // See readCache.
  }
  return library;
}

function configFingerprint() {
  return JSON.stringify([config.apiEndpoint, config.collections]);
}

// Posters come from Mave's image API, which resizes on the fly.
// See https://www.mave.io/docs/images/
export function posterUrl(video, width = 640) {
  if (!video.poster) return "";
  try {
    const url = new URL(video.poster);
    url.searchParams.set("width", width);
    return url.toString();
  } catch {
    return video.poster;
  }
}

export function formatDuration(seconds) {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function formatDate(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function watchUrl(video) {
  return `watch.html?v=${encodeURIComponent(video.id)}`;
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
