/**
 * js/modes/classic.js — Classic crossword mode
 *
 * Exported API (consumed by play.js):
 *   normalize(rawData)  → throws on invalid JSON; returns a clean spec object
 *   init(spec, ui)      → builds the grid, wires all events, renders clues
 *                         spec may be null to render an empty placeholder grid
 *
 * This module is self-contained: it does not read the DOM itself on load.
 * All DOM references arrive through the `ui` object passed by play.js.
 */

// ── Validation helpers ────────────────────────────────────────────────────────

/**
 * Validate and normalise the raw JSON for a classic puzzle.
 * Returns a clean spec object; throws a descriptive Error on any problem.
 *
 * @param {object} rawData
 * @returns {object}
 */
export function normalize(rawData) {
  const data = Object.assign({}, rawData);

  // ── Grid dimensions ──────────────────────────────────────────────────────
  let rows, cols;
  const hasRect =
    data.rows != null &&
    data.cols != null &&
    Number.isInteger(data.rows) &&
    Number.isInteger(data.cols);

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

  // ── Blocks ───────────────────────────────────────────────────────────────
  if (!Array.isArray(data.blocks))
    throw new Error("blocks deve essere un array");

  for (let i = 0; i < data.blocks.length; i++) {
    const pair = data.blocks[i];
    if (
      !Array.isArray(pair) ||
      pair.length !== 2 ||
      !Number.isInteger(pair[0]) ||
      !Number.isInteger(pair[1])
    )
      throw new Error("blocks: ogni elemento deve essere [r, c] con interi");
    const [br, bc] = pair;
    if (br < 0 || br >= rows || bc < 0 || bc >= cols)
      throw new Error("blocks: coordinate fuori dalla griglia rows×cols");
  }

  // ── Solution ─────────────────────────────────────────────────────────────
  if (!Array.isArray(data.solution))
    throw new Error("solution deve essere un array");
  if (data.solution.length !== rows)
    throw new Error('solution deve avere esattamente "rows" righe');
  for (let i = 0; i < rows; i++) {
    if (
      typeof data.solution[i] !== "string" ||
      data.solution[i].length !== cols
    )
      throw new Error(
        'Ogni riga di solution deve avere lunghezza uguale a "cols"'
      );
  }

  // ── Cell numbers ─────────────────────────────────────────────────────────
  const blockSet = new Set(data.blocks.map(([r, c]) => r + "," + c));
  const rawLabels = Array.isArray(data.cellNumbers) ? data.cellNumbers : [];
  const seenCells = new Set();

  for (const it of rawLabels) {
    if (
      !it ||
      !Number.isInteger(it.row) ||
      !Number.isInteger(it.col) ||
      !Number.isInteger(it.num)
    )
      throw new Error(
        "cellNumbers: ogni elemento deve avere row, col e num interi"
      );
    if (it.row < 0 || it.row >= rows || it.col < 0 || it.col >= cols)
      throw new Error("cellNumbers: row/col fuori dalla griglia");
    if (it.num < 1)
      throw new Error("cellNumbers: num deve essere ≥ 1");
    const pk = it.row + "," + it.col;
    if (blockSet.has(pk))
      throw new Error(
        "cellNumbers: non può esserci un numero su una casella nera"
      );
    if (seenCells.has(pk))
      throw new Error("cellNumbers: stessa cella indicata due volte");
    seenCells.add(pk);
  }
  data.cellNumbers = rawLabels;

  // ── Clue lists ────────────────────────────────────────────────────────────
  function normalizeClueList(raw, label) {
    if (raw == null) return [];
    if (!Array.isArray(raw))
      throw new Error(label + ": deve essere un array oppure omettilo");

    const out = [];
    const seenNums = new Set();
    for (let i = 0; i < raw.length; i++) {
      const it = raw[i];
      if (!it || typeof it !== "object")
        throw new Error(label + ": elemento " + i + " non valido");
      if (!Number.isInteger(it.num) || it.num < 1)
        throw new Error(
          label + ": num intero ≥ 1 richiesto (voce " + i + ")"
        );
      if (typeof it.text !== "string")
        throw new Error(
          label + ": campo text stringa richiesto per num " + it.num
        );
      const t = it.text.trim();
      if (!t)
        throw new Error(label + ": testo vuoto per il numero " + it.num);
      if (seenNums.has(it.num))
        throw new Error(label + ": il numero " + it.num + " è duplicato");
      seenNums.add(it.num);
      out.push({ num: it.num, text: t });
    }
    out.sort((a, b) => a.num - b.num);
    return out;
  }

  data.cluesAcross = normalizeClueList(data.cluesAcross, "cluesAcross");
  data.cluesDown   = normalizeClueList(data.cluesDown,   "cluesDown");

  return data;
}

// ── Game initialisation ───────────────────────────────────────────────────────

/**
 * Initialise the classic mode.
 * @param {object|null} spec  Normalised puzzle spec, or null for an empty grid.
 * @param {object}      ui    DOM element references from play.js.
 */
export function init(spec, ui) {
  const {
    gridEl,
    btnOriz, btnVert,
    solveStatus,
    cluesAcrossEl, cluesDownEl,
  } = ui;

  // ── State ─────────────────────────────────────────────────────────────────
  const cells = [];
  let numRows = 15;
  let numCols = 15;
  /** @type {Set<string>} */
  let blockSet = new Set();
  /** @type {string[]|null} */
  let solutionRows = null;
  /** @type {Map<string, number>} */
  let numberLabelMap = new Map();
  /** @type {Map<number, string>} */
  let cluesAcrossByNum = new Map();
  /** @type {Map<number, string>} */
  let cluesDownByNum   = new Map();

  /** @type {Map<number, HTMLElement>} */
  const acrossClueEls = new Map();
  /** @type {Map<number, HTMLElement>} */
  const downClueEls   = new Map();

  /** @type {null|'horizontal'|'vertical'} */
  let advanceMode = 'horizontal'; // default to horizontal advance after typing
  let activeR = 0;
  let activeC = 0;

  // ── Pure helpers ──────────────────────────────────────────────────────────

  function keyRC(r, c) { return r + "," + c; }

  function isBlock(r, c) { return blockSet.has(keyRC(r, c)); }

  function acrossWordLen(r, c) {
    let L = 0;
    for (let cc = c; cc < numCols && !isBlock(r, cc); cc++) L++;
    return L;
  }

  function downWordLen(r, c) {
    let L = 0;
    for (let rr = r; rr < numRows && !isBlock(rr, c); rr++) L++;
    return L;
  }

  function isAcrossClueStart(r, c) {
    if (isBlock(r, c)) return false;
    return (c === 0 || isBlock(r, c - 1)) && acrossWordLen(r, c) >= 2;
  }

  function isDownClueStart(r, c) {
    if (isBlock(r, c)) return false;
    return (r === 0 || isBlock(r - 1, c)) && downWordLen(r, c) >= 2;
  }

  function cellAt(r, c) { return cells[r * numCols + c]; }

  function findFirstWhite() {
    for (let r = 0; r < numRows; r++)
      for (let c = 0; c < numCols; c++)
        if (!isBlock(r, c)) return { r, c };
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

  function setActive(r, c) {
    if (isBlock(r, c)) return;
    activeR = Math.max(0, Math.min(numRows - 1, r));
    activeC = Math.max(0, Math.min(numCols - 1, c));
    if (isBlock(activeR, activeC)) {
      const f = findFirstWhite();
      activeR = f.r;
      activeC = f.c;
    }
    updateSelection();
  }

  function stepByDelta(dr, dc) {
    const r = activeR + dr;
    const c = activeC + dc;
    if (r >= 0 && r < numRows && c >= 0 && c < numCols && !isBlock(r, c)) {
      setActive(r, c);
    }
  }

  // ── Advance after typing ──────────────────────────────────────────────────

  function advanceHorizontal() {
    const c = activeC + 1;
    if (c < numCols && !isBlock(activeR, c)) {
      setActive(activeR, c);
    }
  }

  function advanceVertical() {
    const r = activeR + 1;
    if (r < numRows && !isBlock(r, activeC)) {
      setActive(r, activeC);
    }
  }

  // ── Solve check ───────────────────────────────────────────────────────────

  function checkSolved() {
    if (!solutionRows) return false;
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        if (isBlock(r, c)) continue;
        const exp = solutionRows[r][c];
        if (!/[a-zA-Z]/.test(exp)) return false;
        const want = exp.toUpperCase();
        const got = cellAt(r, c).querySelector(".letter").textContent.trim();
        if (got !== want) return false;
      }
    }
    return true;
  }

  function updateSolveMessage() {
    if (!solutionRows) {
      solveStatus.textContent = "";
      solveStatus.classList.remove("is-solved");
      return;
    }
    if (checkSolved()) {
      solveStatus.textContent =
        "Ottimo! Hai risolto il cruciverba: tutte le lettere sono corrette.";
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

    if (!solutionRows || numberLabelMap.size === 0) {
      const msg = "— Nessun elenco: serve uno schema con numeri in griglia.";
      for (const el of [cluesAcrossEl, cluesDownEl]) {
        const li = document.createElement("li");
        li.className = "clues-empty";
        li.textContent = msg;
        el.appendChild(li);
      }
      return;
    }

    const across = [];
    const down   = [];
    for (const [key, num] of numberLabelMap) {
      const [sr, sc] = key.split(",");
      const r = Number(sr), c = Number(sc);
      if (isAcrossClueStart(r, c)) across.push({ num });
      if (isDownClueStart(r, c))   down.push({ num });
    }
    across.sort((a, b) => a.num - b.num);
    down.sort((a, b) => a.num - b.num);

    const TMPL_A = "Template: definizione orizzontale (sostituisci con il testo corretto).";
    const TMPL_D = "Template: definizione verticale (sostituisci con il testo corretto).";

    function fillList(el, items, clueMap, tmpl, clueElMap) {
      if (items.length === 0) {
        const li = document.createElement("li");
        li.className = "clues-empty";
        li.textContent = "— Nessuna parola in questa direzione.";
        el.appendChild(li);
        return;
      }
      for (const { num } of items) {
        const li      = document.createElement("li");
        const numSpan = document.createElement("span");
        numSpan.className = "clue-num";
        numSpan.textContent = num + ".";
        const textSpan = document.createElement("span");
        const custom = clueMap.get(num);
        textSpan.className  = custom ? "clue-text" : "clue-template";
        textSpan.textContent = " " + (custom ?? tmpl);
        li.appendChild(numSpan);
        li.appendChild(textSpan);
        el.appendChild(li);
        clueElMap.set(num, li);
      }
    }

    fillList(cluesAcrossEl, across, cluesAcrossByNum, TMPL_A, acrossClueEls);
    fillList(cluesDownEl,   down,   cluesDownByNum,   TMPL_D, downClueEls);
  }

  function findActiveClueNum(r, c, direction) {
    if (direction === "horizontal") {
      // Go left to find the start of the across word
      let cc = c;
      while (cc >= 0 && !isBlock(r, cc)) {
        if (isAcrossClueStart(r, cc)) {
          return numberLabelMap.get(keyRC(r, cc)) ?? null;
        }
        cc--;
      }
    } else if (direction === "vertical") {
      // Go up to find the start of the down word
      let rr = r;
      while (rr >= 0 && !isBlock(rr, c)) {
        if (isDownClueStart(rr, c)) {
          return numberLabelMap.get(keyRC(rr, c)) ?? null;
        }
        rr--;
      }
    }
    return null;
  }

  function updateActiveClueHighlight() {
    // Clear all highlights
    for (const el of acrossClueEls.values()) el.classList.remove("clue-active");
    for (const el of downClueEls.values()) el.classList.remove("clue-active");

    const direction = advanceMode || "horizontal"; // default to horizontal
    const activeNum = findActiveClueNum(activeR, activeC, direction);
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

  /**
   * Build (or rebuild) the DOM grid from the current state variables.
   * Called once during init().
   */
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

        // Cell number label (top-left corner)
        const labelNum = numberLabelMap.get(keyRC(r, c));
        if (labelNum != null && !isBlock(r, c)) {
          const numEl = document.createElement("span");
          numEl.className = "cell-num";
          numEl.textContent = String(labelNum);
          numEl.setAttribute("aria-hidden", "true");
          cell.appendChild(numEl);
        }

        // Letter span (always present; hidden on blocks via CSS)
        const letter = document.createElement("span");
        letter.className = "letter";
        letter.setAttribute("aria-hidden", "true");
        cell.appendChild(letter);

        if (isBlock(r, c)) {
          cell.classList.add("is-block");
          cell.setAttribute("aria-disabled", "true");
        } else {
          cell.addEventListener("click", () => {
            setActive(r, c);
            gridEl.focus();
          });
        }

        gridEl.appendChild(cell);
        cells.push(cell);
      }
    }
  }

  // ── Keyboard handling ─────────────────────────────────────────────────────

  gridEl.addEventListener("keydown", (e) => {
    if (isBlock(activeR, activeC)) return;
    const letterEl = cellAt(activeR, activeC).querySelector(".letter");

    switch (e.key) {
      case "ArrowUp":    e.preventDefault(); stepByDelta(-1,  0); return;
      case "ArrowDown":  e.preventDefault(); stepByDelta( 1,  0); return;
      case "ArrowLeft":  e.preventDefault(); stepByDelta( 0, -1); return;
      case "ArrowRight": e.preventDefault(); stepByDelta( 0,  1); return;
      case "Backspace":
      case "Delete":
        e.preventDefault();
        letterEl.textContent = "";
        if (advanceMode === "horizontal") {
          stepByDelta(0, -1);
        } else if (advanceMode === "vertical") {
          stepByDelta(-1, 0);
        }
        updateSolveMessage();
        return;
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

    if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
      e.preventDefault();
      letterEl.textContent = e.key.toUpperCase();
      if      (advanceMode === "horizontal") advanceHorizontal();
      else if (advanceMode === "vertical")   advanceVertical();
      updateSolveMessage();
    }
  });

  // ── Populate state from spec, then render ─────────────────────────────────

  if (spec) {
    numRows = spec.rows;
    numCols = spec.cols;
    blockSet      = new Set(spec.blocks.map(([r, c]) => keyRC(r, c)));
    solutionRows  = spec.solution;

    for (const { row, col, num } of (spec.cellNumbers ?? []))
      numberLabelMap.set(keyRC(row, col), num);

    for (const { num, text } of (spec.cluesAcross ?? []))
      cluesAcrossByNum.set(num, text);

    for (const { num, text } of (spec.cluesDown ?? []))
      cluesDownByNum.set(num, text);
  }
  // else: default 15×15 empty grid (state variables already at defaults)

  buildGrid();

  const start = findFirstWhite();
  activeR = start.r;
  activeC = start.c;
  updateSelection();
  updateSolveMessage();
  renderClues();
  updateActiveClueHighlight();
}
