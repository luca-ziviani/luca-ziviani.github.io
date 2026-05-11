/**
 * play.js — entry point
 *
 * Responsibilities:
 *   1. Read ?id= from the URL and validate it.
 *   2. Fetch puzzles-manifest.json and locate the matching entry.
 *   3. Fetch the puzzle JSON file.
 *   4. Read the "type" field and dynamically import the correct mode module.
 *   5. Hand control to the module via  module.init(data, ui).
 *
 * Each mode module lives at  js/modes/<type>.js  and must export:
 *   - normalize(data)  → validated/normalised copy of the raw JSON (throws on error)
 *   - init(data, ui)   → sets up the full game UI; returns nothing
 *
 * The `ui` object passed to init() contains references to every DOM element
 * declared in play.html.  Modes use what they need and ignore the rest.
 */

(function () {
  // ── DOM references of the page play.html ──────────────────────────────────
  const ui = {
    gridEl:       document.querySelector(".crossword"),
    btnOriz:      document.getElementById("btn-orizz"),
    btnVert:      document.getElementById("btn-vert"),
    loadHint:     document.getElementById("load-hint"),
    solveStatus:  document.getElementById("solve-status"),
    playTitle:    document.getElementById("play-title"),
    cluesAcrossEl: document.getElementById("clues-across"),
    cluesDownEl:   document.getElementById("clues-down"),
  };

  // ── Helpers for errors ────────────────────────────────────────────────────
  
  // Show a fatal load error: clear the grid and display a message.
  // We always fall back to the classic empty-grid rendering so the page
  // at least looks consistent.
  function failLoad(message) {
    ui.loadHint.textContent = message;
    ui.playTitle.textContent = "Cruciverba";
    document.title = "Cruciverba";
    // Render an empty classic grid so the page isn't completely blank.
    import("./modes/classic.js")
      .then((mod) => mod.init(null, ui))
      .catch(() => {
        // If even that fails, just clear the grid element.
        ui.gridEl.replaceChildren();
      });
  }

  // Allowlist check: only plain filenames like "puzzle-1.json" are accepted.
  // Prevents path-traversal attacks (e.g. "../../etc/passwd").
  function safeFileName(name) {
    if (!name || typeof name !== "string") return null;
    return /^[a-zA-Z0-9._-]+\.json$/.test(name) ? name : null;
  }

  // ── URL param ─────────────────────────────────────────────────────────────
  const puzzleId = new URLSearchParams(window.location.search).get("id");

  if (!puzzleId) {
    failLoad("Nessun cruciverba selezionato. Torna al menu e scegline uno.");
    return;
  }

  // ── Load pipeline ─────────────────────────────────────────────────────────
  // This is the list of operations to searce the json file,
  //  import the mode module, and initialise the game.
  fetch("puzzles-manifest.json")
    // Check if  the manifest is corectly opened.
    .then((r) => {
      if (!r.ok) throw new Error("manifest");
      return r.json();
    })

    // Find the manifest entry for the requested puzzle and fetch its JSON file.
    .then((manifest) => {
      const entry = manifest.puzzles.find((p) => p.id === puzzleId);
      if (!entry) throw new Error("unknown");

      const file = safeFileName(entry.file);
      if (!file) throw new Error("badfile");

      // Set title early so the page doesn't flicker with "Cruciverba".
      ui.playTitle.textContent = entry.title;
      document.title = entry.title + " – Cruciverba";

      // Parse the JSON file for the puzzle;
      // this is passed to the mode module for validation and normalisation.
      return fetch(file).then((r) => {
        if (!r.ok) throw new Error("puzzle");
        return r.json();
      });
    })

    // Derive the mode from the JSON and dynamically import the module.
    .then((rawData) => {
      // Set default to "classic" 
      const type = (typeof rawData.type === "string" && rawData.type.trim())
        ? rawData.type.trim()
        : "classic";

      // "type" = "classic" | "cornici" | "senza-schema" (must match a modes/*.js file)
      // Dynamically import the mode module.
      return import(`./modes/${type}.js`).then((mod) => ({ mod, rawData }));
    })

    // mod is the mode module (JS file), rawData is the original JSON from the file.
    // Let the mode validate and normalise the data, then init the game.
    .then(({ mod, rawData }) => {
      const data = mod.normalize(rawData);
      ui.loadHint.textContent = "";
      mod.init(data, ui);
    })

    // Error handling
    .catch((err) => {
      if (err?.message === "unknown") {
        failLoad("Cruciverba non trovato. Torna al menu e scegli un'opzione valida.");
      } else if (err?.message === "badmodule") {
        failLoad("Tipo di cruciverba non supportato.");
      } else {
        failLoad(
          "Impossibile caricare il gioco. " +
          "Usa un server locale nella cartella del progetto " +
          "(es. python3 -m http.server) e riprova."
        );
      }
    });
})();
