// Everything you need to change to make this library your own lives in this file.

export default {
  // Shown in the header, the browser tab and the footer.
  title: "Open Video Library",
  tagline: "A browsable video library, powered by Mave.",

  // One entry per Mave collection. Each collection becomes a category tab, and
  // folders inside a collection become folders you can browse into.
  //
  // `token` is the same JWT you would pass to <mave-list token="...">: sign it on
  // your server with a read-only API key and put the collection ID in `sub`.
  // See https://www.mave.io/docs/list/
  //
  // `label` is optional and overrides the collection name from Mave.
  //
  // The two tokens below are the public demo collections from the Mave docs, so
  // the starter works before you have an account. Replace them with your own.
  collections: [
    {
      label: "Nature",
      token:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1Ymc1MDVkdTUzY2dvSkEifQ.4ckEUBuvz_Wpf92KKng824oEaPPfUl-TctdCGy5HBL0",
    },
    {
      label: "Pizza course",
      token:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1Ymc1MHlPSGt5RXpMb04ifQ.DZASNqtBtdUq7cT9EH1O5e1qCmIcJdbgYxdFDhrjGjM",
    },
  ],

  // Embed ID of the video in the banner on the home page. Leave empty to
  // feature the newest video.
  featured: "",

  // Player theme: "default", "dolphin" or "synthwave".
  // See https://www.mave.io/docs/theme/
  playerTheme: "default",

  // Play a short, silent preview when someone hovers a card. Only videos that
  // have clip renditions get a preview; the others keep their poster.
  hoverPreview: true,

  // Start the next video in the same category when one ends.
  autoplayNext: true,

  // Where the library reads its collections from. Managed Mave uses the default.
  // Self-hosting Mave Core? Point this at your own installation, for example
  // "https://video.example.com/api/v1", and swap the component <script> tags in
  // index.html and watch.html for the ones your dashboard generates.
  apiEndpoint: "https://api.mave.io/v1",
};
