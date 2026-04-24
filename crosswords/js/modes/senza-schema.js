/**
 * js/modes/senza-schema.js — "Senza schema" crossword mode
 *
 * In this mode the grid starts entirely white: the solver does not know in
 * advance where the black cells are.  The challenge is to figure out the
 * black-cell layout AND fill in the correct letters at the same time.
 *
 * ── Controls ────────────────────────────────────────────────────────────────
 *   Left-click white cell   → select it for typing
 *   Right-click any cell    → toggle black / white
 *   Space (on selected cell)→ toggle black / white  (keyboard equivalent)
 *   Arrow keys              → move selection (skips black cells)
 *   Letter keys             → fill the selected cell
 *   Backspace / Delete      → erase the selected cell
 *   Orizzontale / Verticale → choose auto-advance direction after typing
 *
 * ── JSON format ──────────────────────────────────────────────────────────────
 * {
 *   "type"   : "senza-schema",
 *   "rows"   : 7,
 *   "cols"   : 7,
 *   "solution": [          // one string per row, length == cols
 *     "GATTO.T",           // letter = white cell;  '.' = black cell
 *     "A.....E",
 *     ...
 *   ],
 *   "cluesAcross": [       // one entry per row that has at least one word
 *     { "row": 0, "text": "Felino domestico / Lettera dell'alfabeto" },
 *     { "row": 1, "text": "Prima lettera / ..." },
 *     ...
 *   ],
 *   "cluesDown": [         // one entry per column that has at least one word
 *     { "col": 0, "text": "..." },
 *     ...
 *   ]
 * }
 *
 * Notes:
 *  • '.' in the solution marks a black cell.  No separate "blocks" array is
 *    needed; it is derived automatically during normalisation.
 *  • Clue text for a row / column often lists several words separated by ' / '
 *    when black cells divide that line into multiple words.
 *  • Rows / columns with no white cells at all may be omitted from the clue
 *    arrays (unusual but allowed).
 */

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate and normalise raw JSON for a "senza-schema" puzzle.
 * Returns a clean spec; throws a descriptive Error on any problem.
 *
 * @param {object} rawData
 * @returns {object}
 */
export function normalize(rawData) {
  const data = Object.assign({}, rawData);

  // ── Grid dimensions ──────────────────────────────────────────────────────
  let rows, cols;
  const hasRect =
    data.rows != null && data.cols != null &&
    Number.isInteger(data.rows) && Number.isInteger(data.cols);

  if (hasRect) {
    rows = data.rows;
    cols = data.cols;
    if (rows < 1 || cols < 1 || rows > 50 || cols > 50)
      throw new Error("rows e cols devono essere tra 1 e 50");
  } else if (data.size != null && Number.isInteger(data.size)) {
    rows = cols = data.size;
    if (rows < 1 || rows > 50)
      throw new Error("Campo size non valido (usa 1–50 oppure rows/cols)");
  } else {
    throw new Error(
      'Indica "size" (griglia quadrata) oppure "rows" e "cols" (rettangolare)'
    );
  }
  data.rows = rows;
  data.cols = cols;

  // ── Solution ─────────────────────────────────────────────────────────────
  // Each row is a string of length `cols`.
  // Letter [a-zA-Z] → white cell with that correct letter.
  // '.' (dot)       → black cell.
  // Any other character is rejected to catch copy-paste mistakes.
  if (!Array.isArray(data.solution))
    throw new Error("solution deve essere un array di stringhe");
  if (data.solution.length !== rows)
    throw new Error('solution deve avere esattamente "rows" righe');

  for (let r = 0; r < rows; r++) {
    const row = data.solution[r];
    if (typeof row !== "string" || row.length !== cols)
      throw new Error(
        `solution riga ${r}: deve essere una stringa di lunghezza ${cols}`
      );
    for (let c = 0; c < cols; c++) {
      if (!/[a-zA-Z.]/.test(row[c]))
        throw new Error(
          `solution riga ${r}, colonna ${c}: carattere non valido "${row[c]}" ` +
          "(usa lettere per le celle bianche e '.' per le celle nere)"
        );
    }
  }

  // Derive the set of black cells from '.' characters in the solution.
  // Stored as "r,c" strings, same convention as classic.js.
  data.solutionBlocks = new Set();
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (data.solution[r][c] === ".") data.solutionBlocks.add(r + "," + c);

  // ── Clue lists ────────────────────────────────────────────────────────────
  // cluesAcross: [{ row: <int 0..rows-1>, text: <string> }, ...]
  // cluesDown:   [{ col: <int 0..cols-1>, text: <string> }, ...]

  function normalizeLineClues(raw, label, indexKey, maxIndex) {
    if (raw == null) return [];
    if (!Array.isArray(raw))
      throw new Error(label + ": deve essere un array oppure omettilo");

    const out = [];
    const seenIdx = new Set();
    for (let i = 0; i < raw.length; i++) {
      const it = raw[i];
      if (!it || typeof it !== "object")
        throw new Error(`${label}: elemento ${i} non valido`);
      if (!Number.isInteger(it[indexKey]) || it[indexKey] < 0 || it[indexKey] >= maxIndex)
        throw new Error(
          `${label}: campo "${indexKey}" deve essere un intero tra 0 e ${maxIndex - 1} (voce ${i})`
        );
      if (typeof it.text !== "string" || !it.text.trim())
        throw new Error(
          `${label}: testo mancante o vuoto per ${indexKey}=${it[indexKey]}`
        );
      if (seenIdx.has(it[indexKey]))
        throw new Error(
          `${label}: ${indexKey}=${it[indexKey]} è duplicato`
        );
      seenIdx.add(it[indexKey]);
      out.push({ [indexKey]: it[indexKey], text: it.text.trim() });
    }
    out.sort((a, b) => a[indexKey] - b[indexKey]);
    return out;
  }

  data.cluesAcross = normalizeLineClues(data.cluesAcross, "cluesAcross", "row", rows);
  data.cluesDown   = normalizeLineClues(data.cluesDown,   "cluesDown",   "col", cols);

  return data;
}

// ── Mode-specific styles ──────────────────────────────────────────────────────

/**
 * Inject a <style> block scoped to body.mode-senza-schema.
 * Keeping styles here makes the mode self-contained; no changes to styles.css
 * are required to use this mode.
 */
function injectStyles() {
  if (document.getElementById("senza-schema-styles")) return; // already injected
  const style = document.createElement("style");
  style.id = "senza-schema-styles";
  style.textContent = `
    /* ── Senza-schema: cells toggled black by the player ── */
    body.mode-senza-schema .cell.player-block {
      background: #1a1a1a;
      cursor: pointer;        /* still clickable to un-toggle */
      pointer-events: auto;
    }
    body.mode-senza-schema .cell.player-block .letter {
      visibility: hidden;
    }

    /* Subtle right-click hint on hover for un-toggled cells */
    body.mode-senza-schema .cell:not(.player-block):hover::after {
      content: "";
      position: absolute;
      inset: 0;
      background: rgba(37, 99, 235, 0.06);
      pointer-events: none;
    }

    /* Active-clue highlight in the sidebar */
    body.mode-senza-schema .clues-list li.clue-active {
      background: #eef4ff;
      border-radius: 4px;
      outline: 2px solid #93b4f0;
      outline-offset: -2px;
    }

    /* Instruction banner below the grid */
    body.mode-senza-schema .senza-hint {
      font-size: 0.78rem;
      color: #666;
      line-height: 1.45;
      max-width: 34rem;
      text-align: center;
      margin: 0;
    }

    /* Make clue numbers in this mode show row/col labels, not word numbers */
    body.mode-senza-schema .clue-num {
      min-width: 3.2em;
      color: #444;
      font-weight: 600;
    }
  `;
  document.head.appendChild(style);
}

// ── Game initialisation ───────────────────────────────────────────────────────

/**
 * Initialise the senza-schema mode.
 * @param {object} spec   Normalised puzzle spec from normalize().
 * @param {object} ui     DOM element references from play.js.
 */
export function init(spec, ui) {
  const {
    gridEl,
    btnOriz, btnVert,
    solveStatus, loadHint,
    cluesAcrossEl, cluesDownEl,
  } = ui;

  // ── Mode setup ────────────────────────────────────────────────────────────
  document.body.classList.add("mode-senza-schema");
  injectStyles();

  // Update sidebar headings to reflect the per-line nature of clues.
  const headingAcross = document.getElementById("heading-across");
  const headingDown   = document.getElementById("heading-down");
  if (headingAcross) headingAcross.textContent = "Orizzontali";
  if (headingDown)   headingDown.textContent   = "Verticali";

  // ── State ─────────────────────────────────────────────────────────────────
  const numRows = spec.rows;
  const numCols = spec.cols;

  /** Black cells as determined by the solution (the "answer"). */
  const solutionBlocks = spec.solutionBlocks; // Set<"r,c">

  /**
   * Black cells toggled by the player.  Initially empty — the player starts
   * with a fully white grid and must discover where the blacks go.
   * @type {Set<string>}
   */
  const playerBlocks = new Set();

  /** All rendered cell <div> elements, row-major order. */
  const cells = [];

  // Maps row index → the clue <li> element (for active highlighting).
  /** @type {Map<number, HTMLElement>} */
  const acrossClueEls = new Map();
  // Maps col index → the clue <li> element.
  /** @type {Map<number, HTMLElement>} */
  const downClueEls = new Map();

  // Maps for quick clue lookup: row/col index → text.
  /** @type {Map<number, string>} */
  const acrossClueMap = new Map(spec.cluesAcross.map(({ row, text }) => [row, text]));
  /** @type {Map<number, string>} */
  const downClueMap   = new Map(spec.cluesDown.map(({ col, text }) => [col, text]));

  /** @type {null|'horizontal'|'vertical'} */
  let advanceMode = 'horizontal';
  let activeR = 0;
  let activeC = 0;

  // ── Pure helpers ──────────────────────────────────────────────────────────

  function keyRC(r, c) { return r + "," + c; }

  /** True if the player has marked this cell black. */
  function isPlayerBlock(r, c) { return playerBlocks.has(keyRC(r, c)); }

  /** True if this cell is black in the solution. */
  function isSolutionBlock(r, c) { return solutionBlocks.has(keyRC(r, c)); }

  function cellAt(r, c) { return cells[r * numCols + c]; }

  function findFirstWhite() {
    for (let r = 0; r < numRows; r++)
      for (let c = 0; c < numCols; c++)
        if (!isPlayerBlock(r, c)) return { r, c };
    return { r: 0, c: 0 };
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  function updateSelection() {
    cells.forEach((cell, i) => {
      const r = Math.floor(i / numCols);
      const c = i % numCols;
      cell.classList.toggle("selected", r === activeR && c === activeC);
    });
    updateActiveClueHighlight();
  }


    function findActiveClueNum(r, c, direction) {
    if (direction === "horizontal") {
      return acrossClueMap.has(r) ? r : null;
    } else if (direction === "vertical") {
      return downClueMap.has(c) ? c : null;}
    return null;
  }

  /**
   * Highlight the across clue for the active row and the down clue for the
   * active column, clearing any previously highlighted clues.
   */
  function updateActiveClueHighlight() {
    // Clear all highlights.
    for (const el of acrossClueEls.values()) el.classList.remove("clue-active");
    for (const el of downClueEls.values())   el.classList.remove("clue-active");

    const direction = advanceMode || "horizontal"; // default to horizontal
    const activeNum = findActiveClueNum(activeR, activeC, direction);
    // Apply highlight to the current row / column.
    if (activeNum != null) {
      const clueElMap = direction === "horizontal" ? acrossClueEls : downClueEls;
      const li = clueElMap.get(activeNum);
      if (li) {
        li.classList.add("clue-active");
        // Scroll only within the clues panel
        const panel = cluesAcrossEl.closest('.clues-panel') || cluesDownEl.closest('.clues-panel');
        li.scrollIntoView({ block: "center", behavior: "smooth", root: panel });
      }
    }
  }

  function setActive(r, c) {
    //if (isPlayerBlock(r, c)) return;
    activeR = Math.max(0, Math.min(numRows - 1, r));
    activeC = Math.max(0, Math.min(numCols - 1, c));
    // If that cell ended up black (race condition guard), find first white.
    //if (isPlayerBlock(activeR, activeC)) {
    //  const f = findFirstWhite();
    //  activeR = f.r;
    //  activeC = f.c;
    //}
    updateSelection();
  }

  function stepByDelta(dr, dc) {
    let r = activeR + dr;
    let c = activeC + dc;
    
    if (r >= 0 && r < numRows && c >= 0 && c < numCols )
      setActive(r, c);
  }

  // ── Auto-advance after typing ─────────────────────────────────────────────

  function advanceHorizontal() {
    let c = activeC + 1;
    while (c < numCols && isPlayerBlock(activeR, c)) c++;
    if (c < numCols) setActive(activeR, c);
  }

  function advanceVertical() {
    let r = activeR + 1;
    while (r < numRows && isPlayerBlock(r, activeC)) r++;
    if (r < numRows) setActive(r, activeC);
  }

  // ── Black-cell toggling ───────────────────────────────────────────────────

  /**
   * Toggle a cell between white and player-black.
   * Toggling a cell black also clears its letter and moves the selection
   * to the nearest white cell.
   */
  function toggleBlock(r, c) {
    const key = keyRC(r, c);
    const cell = cellAt(r, c);

    if (playerBlocks.has(key)) {
      // Un-toggle: restore white cell.
      playerBlocks.delete(key);
      cell.classList.remove("player-block");
      cell.setAttribute("aria-disabled", "false");
      setActive(r, c);
    } else {
      // Toggle black: clear letter, mark cell, move focus away.
      cell.querySelector(".letter").textContent = ".";
      playerBlocks.add(key);
      cell.classList.add("player-block");
      cell.setAttribute("aria-disabled", "true");
      // Move selection to the next available white cell.
      //if      (advanceMode === "horizontal") advanceHorizontal();
      //else if (advanceMode === "vertical")   advanceVertical();
      //if (activeR === r && activeC === c) {
      //  const f = findFirstWhite();
      //  activeR = f.r;
      //  activeC = f.c;
      //  updateSelection();
      //}
    }
    updateSolveMessage();
  }

  // ── Solve check ───────────────────────────────────────────────────────────

  /**
   * The puzzle is solved when:
   *   1. Every cell the player marked black matches a solution black cell, AND
   *      every solution black cell has been marked by the player.
   *   2. Every white cell contains the correct letter from the solution.
   *
   * @returns {boolean}
   */
  function checkSolved() {
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const key = keyRC(r, c);
        const shouldBeBlock = solutionBlocks.has(key);
        const isBlock       = playerBlocks.has(key);

        // Black-cell positions must match exactly.
        if (shouldBeBlock !== isBlock) return false;

        // Skip letter check for black cells.
        if (shouldBeBlock) continue;

        // White cells must have the right letter.
        const want = spec.solution[r][c].toUpperCase();
        const got  = cellAt(r, c).querySelector(".letter").textContent.trim();
        if (got !== want) return false;
      }
    }
    return true;
  }

  function updateSolveMessage() {
    if (checkSolved()) {
      solveStatus.textContent =
        "Ottimo! Hai risolto lo schema: celle nere e lettere sono tutti corretti.";
      solveStatus.classList.add("is-solved");
    } else {
      solveStatus.textContent = "";
      solveStatus.classList.remove("is-solved");
    }
  }

  // ── Clue rendering ────────────────────────────────────────────────────────

  function renderClues() {
    cluesAcrossEl.replaceChildren();
    cluesDownEl.replaceChildren();
    acrossClueEls.clear();
    downClueEls.clear();

    function fillLineClues(listEl, clues, indexKey, labelPrefix, clueElMap) {
      if (clues.length === 0) {
        const li = document.createElement("li");
        li.className = "clues-empty";
        li.textContent = "— Nessuna definizione per questa direzione.";
        listEl.appendChild(li);
        return;
      }
      for (const clue of clues) {
        const idx = clue[indexKey]; // 0-based row or col

        const li = document.createElement("li");

        const numSpan = document.createElement("span");
        numSpan.className = "clue-num";
        // Display as 1-based for readability (Riga 1, Col. 1, …).
        numSpan.textContent = labelPrefix + (idx + 1) + ".";

        const textSpan = document.createElement("span");
        textSpan.className = "clue-text";
        textSpan.textContent = " " + clue.text;

        li.appendChild(numSpan);
        li.appendChild(textSpan);
        listEl.appendChild(li);

        // Store reference for active-highlight updates.
        clueElMap.set(idx, li);
      }
    }

    fillLineClues(cluesAcrossEl, spec.cluesAcross, "row", "Riga ",  acrossClueEls);
    fillLineClues(cluesDownEl,   spec.cluesDown,   "col", "Col. ",  downClueEls);

    // Apply initial highlight for the starting cell.
    updateActiveClueHighlight();
  }

  // ── Direction buttons ─────────────────────────────────────────────────────

  function syncDirectionButtons() {
    btnOriz.classList.toggle("is-active", advanceMode === "horizontal");
    btnVert.classList.toggle("is-active", advanceMode === "vertical");
    btnOriz.setAttribute("aria-pressed", advanceMode === "horizontal" ? "true" : "false");
    btnVert.setAttribute("aria-pressed", advanceMode === "vertical"   ? "true" : "false");
  }

  function focusGrid() {
    requestAnimationFrame(() => gridEl.focus({ preventScroll: true }));
  }

  btnOriz.addEventListener("click", () => {
    advanceMode = advanceMode === "horizontal" ? null : "horizontal";
    syncDirectionButtons();
    focusGrid();
  });

  btnVert.addEventListener("click", () => {
    advanceMode = advanceMode === "vertical" ? null : "vertical";
    syncDirectionButtons();
    focusGrid();
  });

  syncDirectionButtons();


  function setAdvanceMode(mode) {
    advanceMode = advanceMode === mode ? null : mode;
    syncDirectionButtons();
    updateActiveClueHighlight();
  }

  // ── Grid construction ─────────────────────────────────────────────────────

  function buildGrid() {
    gridEl.replaceChildren();
    cells.length = 0;

    gridEl.style.setProperty("--grid-cols", String(numCols));
    gridEl.style.setProperty("--grid-rows", String(numRows));
    gridEl.setAttribute("aria-rowcount",  String(numRows));
    gridEl.setAttribute("aria-colcount",  String(numCols));

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-rowindex", String(r + 1));
        cell.setAttribute("aria-colindex", String(c + 1));

        // Every cell starts white — no solution blacks are pre-revealed.
        const letter = document.createElement("span");
        letter.className = "letter";
        letter.setAttribute("aria-hidden", "true");
        cell.appendChild(letter);

        // Left-click: select (or un-toggle if black).
        cell.addEventListener("click", () => {
          setActive(r, c);
          gridEl.focus();
        });

        // Right-click: toggle black/white.
        cell.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          toggleBlock(r, c);
          gridEl.focus();
        });

        gridEl.appendChild(cell);
        cells.push(cell);
      }
    }
  }

  // ── Keyboard handling ─────────────────────────────────────────────────────

  gridEl.addEventListener("keydown", (e) => {
    // Arrow navigation always works, even when on a black cell.
    switch (e.key) {
      case "ArrowUp":    e.preventDefault(); stepByDelta(-1,  0); return;
      case "ArrowDown":  e.preventDefault(); stepByDelta( 1,  0); return;
      case "ArrowLeft":  e.preventDefault(); stepByDelta( 0, -1); return;
      case "ArrowRight": e.preventDefault(); stepByDelta( 0,  1); return;
    }

        // Keyboard shortcuts for direction mode
    if (!e.ctrlKey && !e.metaKey && e.altKey) {
      const key = e.key.toLowerCase();
      if (key === "o" || key === "h") {
        e.preventDefault();
        setAdvanceMode("horizontal");
        return;
      }
      if (key === "v") {
        e.preventDefault();
        setAdvanceMode("vertical");
        return;
      }
    }


    // Space: toggle the currently active cell black / white.
    if (e.key === ".") {
      e.preventDefault();
      toggleBlock(activeR, activeC);
      setActive(activeR, activeC); // ensure focus stays on the toggled cell
      if      (advanceMode === "horizontal") advanceHorizontal();
      else if (advanceMode === "vertical")   advanceVertical();
      updateSolveMessage();
    }


    // The remaining keys only act on white (non-player-blocked) cells.
    

    const letterEl = cellAt(activeR, activeC).querySelector(".letter");

    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
        letterEl.textContent = "";
        if (isPlayerBlock(activeR, activeC)) toggleBlock(activeR, activeC);
  
        if (advanceMode === "horizontal") {
          stepByDelta(0, -1);
        } else if (advanceMode === "vertical") {
          stepByDelta(-1, 0);
        }
        updateSolveMessage();
        return;
    }

    if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
      e.preventDefault();
      letterEl.textContent = e.key.toUpperCase();
      if      (advanceMode === "horizontal") advanceHorizontal();
      else if (advanceMode === "vertical")   advanceVertical();
      updateSolveMessage();
    }
  });

  // ── Instruction hint ──────────────────────────────────────────────────────

  // Append a small usage hint below the grid, inside the left column.
  // We reuse the existing loadHint element that play.js already cleared.
  loadHint.className = "senza-hint";
  loadHint.textContent =
    "Clic sinistro per selezionare una cella · Clic destro (o Spazio) per annerirla o ripristinarla";

  // ── Boot ──────────────────────────────────────────────────────────────────

  buildGrid();

  // Start on the first cell (0,0).  In senza-schema there are no pre-set
  // blocks so the grid is guaranteed to be entirely white at this point.
  activeR = 0;
  activeC = 0;
  updateSelection();
  updateSolveMessage();
  renderClues();
}
