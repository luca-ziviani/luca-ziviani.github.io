(function () {
  const params = new URLSearchParams(window.location.search);
  const puzzleId = params.get("id");

  const gridEl = document.querySelector(".crossword");
  const btnOriz = document.getElementById("btn-orizz");
  const btnVert = document.getElementById("btn-vert");
  const loadHint = document.getElementById("load-hint");
  const solveStatus = document.getElementById("solve-status");
  const playTitle = document.getElementById("play-title");
  const cluesAcrossEl = document.getElementById("clues-across");
  const cluesDownEl = document.getElementById("clues-down");

  const cells = [];
  let numRows = 15;
  let numCols = 15;
  /** @type {Set<string>} */
  let blockSet = new Set();
  /** @type {string[] | null} */
  let solutionRows = null;
  /** @type {Map<string, number>} */
  let numberLabelMap = new Map();
  /** @type {Map<number, string>} */
  let cluesAcrossByNum = new Map();
  /** @type {Map<number, string>} */
  let cluesDownByNum = new Map();

  /** @type {null | 'horizontal' | 'vertical'} */
  let advanceMode = null;

  let activeR = 0;
  let activeC = 0;

  function keyRC(r, c) {
    return r + "," + c;
  }

  function isBlock(r, c) {
    return blockSet.has(keyRC(r, c));
  }

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
    const leftBlocked = c === 0 || isBlock(r, c - 1);
    return leftBlocked && acrossWordLen(r, c) >= 2;
  }

  function isDownClueStart(r, c) {
    if (isBlock(r, c)) return false;
    const upBlocked = r === 0 || isBlock(r - 1, c);
    return upBlocked && downWordLen(r, c) >= 2;
  }

  function renderClueTemplates() {
    cluesAcrossEl.replaceChildren();
    cluesDownEl.replaceChildren();

    if (!solutionRows || numberLabelMap.size === 0) {
      const msg =
        "— Nessun elenco: serve uno schema con numeri in griglia.";
      const liA = document.createElement("li");
      liA.className = "clues-empty";
      liA.textContent = msg;
      cluesAcrossEl.appendChild(liA);
      const liD = document.createElement("li");
      liD.className = "clues-empty";
      liD.textContent = msg;
      cluesDownEl.appendChild(liD);
      return;
    }

    const across = [];
    const down = [];
    for (const [key, num] of numberLabelMap) {
      const [sr, sc] = key.split(",");
      const r = Number(sr);
      const c = Number(sc);
      if (isAcrossClueStart(r, c)) across.push({ num });
      if (isDownClueStart(r, c)) down.push({ num });
    }
    across.sort((a, b) => a.num - b.num);
    down.sort((a, b) => a.num - b.num);

    const templateAcross =
      "Template: definizione orizzontale (sostituisci con il testo corretto).";
    const templateDown =
      "Template: definizione verticale (sostituisci con il testo corretto).";

    function fillList(el, items, clueMap, templateText) {
      if (items.length === 0) {
        const li = document.createElement("li");
        li.className = "clues-empty";
        li.textContent = "— Nessuna parola in questa direzione.";
        el.appendChild(li);
        return;
      }
      for (const { num } of items) {
        const li = document.createElement("li");
        const numSpan = document.createElement("span");
        numSpan.className = "clue-num";
        numSpan.textContent = num + ".";
        const textSpan = document.createElement("span");
        const custom = clueMap.get(num);
        textSpan.className = custom ? "clue-text" : "clue-template";
        textSpan.textContent = " " + (custom != null ? custom : templateText);
        li.appendChild(numSpan);
        li.appendChild(textSpan);
        el.appendChild(li);
      }
    }

    fillList(cluesAcrossEl, across, cluesAcrossByNum, templateAcross);
    fillList(cluesDownEl, down, cluesDownByNum, templateDown);
  }

  function syncDirectionButtons() {
    btnOriz.classList.toggle("is-active", advanceMode === "horizontal");
    btnVert.classList.toggle("is-active", advanceMode === "vertical");
    btnOriz.setAttribute(
      "aria-pressed",
      advanceMode === "horizontal" ? "true" : "false"
    );
    btnVert.setAttribute(
      "aria-pressed",
      advanceMode === "vertical" ? "true" : "false"
    );
  }

  function focusGridForTyping() {
    requestAnimationFrame(() => {
      gridEl.focus({ preventScroll: true });
    });
  }

  btnOriz.addEventListener("click", () => {
    advanceMode = advanceMode === "horizontal" ? null : "horizontal";
    syncDirectionButtons();
    focusGridForTyping();
  });

  btnVert.addEventListener("click", () => {
    advanceMode = advanceMode === "vertical" ? null : "vertical";
    syncDirectionButtons();
    focusGridForTyping();
  });

  syncDirectionButtons();

  function cellAt(r, c) {
    return cells[r * numCols + c];
  }

  function findFirstWhite() {
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        if (!isBlock(r, c)) {
          return { r, c };
        }
      }
    }
    return { r: 0, c: 0 };
  }

  function updateSelection() {
    cells.forEach((cell, i) => {
      const r = Math.floor(i / numCols);
      const c = i % numCols;
      cell.classList.toggle("selected", r === activeR && c === activeC);
    });
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
    let r = activeR + dr;
    let c = activeC + dc;
    let guard = 0;
    while (
      r >= 0 &&
      r < numRows &&
      c >= 0 &&
      c < numCols &&
      isBlock(r, c) &&
      guard < numRows * numCols
    ) {
      r += dr;
      c += dc;
      guard++;
    }
    if (r >= 0 && r < numRows && c >= 0 && c < numCols && !isBlock(r, c)) {
      setActive(r, c);
    }
  }

  function advanceAfterLetterHorizontal() {
    let c = activeC + 1;
    let r = activeR;
    while (c < numCols && isBlock(r, c)) c++;
    if (c < numCols) setActive(r, c);
  }

  function advanceAfterLetterVertical() {
    let r = activeR + 1;
    let c = activeC;
    while (r < numRows && isBlock(r, c)) r++;
    if (r < numRows) setActive(r, c);
  }

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
        "Complimenti! Hai risolto il cruciverba: tutte le lettere sono corrette.";
      solveStatus.classList.add("is-solved");
    } else {
      solveStatus.textContent = "";
      solveStatus.classList.remove("is-solved");
    }
  }

  function applyPuzzleSpec(spec) {
    gridEl.replaceChildren();
    cells.length = 0;

    numberLabelMap = new Map();
    cluesAcrossByNum = new Map();
    cluesDownByNum = new Map();
    if (!spec) {
      numRows = 15;
      numCols = 15;
      blockSet = new Set();
      solutionRows = null;
    } else {
      numRows = spec.rows;
      numCols = spec.cols;
      blockSet = new Set(spec.blocks.map(([r, c]) => keyRC(r, c)));
      solutionRows = spec.solution;
      if (spec.cellNumbers && spec.cellNumbers.length) {
        for (const item of spec.cellNumbers) {
          numberLabelMap.set(keyRC(item.row, item.col), item.num);
        }
      }
      if (spec.cluesAcross && spec.cluesAcross.length) {
        for (const { num, text } of spec.cluesAcross) {
          cluesAcrossByNum.set(num, text);
        }
      }
      if (spec.cluesDown && spec.cluesDown.length) {
        for (const { num, text } of spec.cluesDown) {
          cluesDownByNum.set(num, text);
        }
      }
    }

    gridEl.style.setProperty("--grid-cols", String(numCols));
    gridEl.style.setProperty("--grid-rows", String(numRows));
    gridEl.setAttribute("aria-rowcount", String(numRows));
    gridEl.setAttribute("aria-colcount", String(numCols));

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-rowindex", String(r + 1));
        cell.setAttribute("aria-colindex", String(c + 1));
        const labelNum = numberLabelMap.get(keyRC(r, c));
        if (labelNum != null && !isBlock(r, c)) {
          const numEl = document.createElement("span");
          numEl.className = "cell-num";
          numEl.textContent = String(labelNum);
          numEl.setAttribute("aria-hidden", "true");
          cell.appendChild(numEl);
        }
        const letter = document.createElement("span");
        letter.className = "letter";
        letter.setAttribute("aria-hidden", "true");
        cell.appendChild(letter);

        if (isBlock(r, c)) {
          cell.classList.add("is-block");
          cell.setAttribute("aria-disabled", "true");
        }

        if (!isBlock(r, c)) {
          cell.addEventListener("click", () => {
            setActive(r, c);
            gridEl.focus();
          });
        }

        gridEl.appendChild(cell);
        cells.push(cell);
      }
    }

    const start = findFirstWhite();
    activeR = start.r;
    activeC = start.c;
    updateSelection();
    updateSolveMessage();
    renderClueTemplates();
  }

  function normalizePuzzleJSON(data) {
    let rows;
    let cols;
    const hasRect =
      data.rows != null &&
      data.cols != null &&
      Number.isInteger(data.rows) &&
      Number.isInteger(data.cols);
    if (hasRect) {
      rows = data.rows;
      cols = data.cols;
      if (rows < 1 || cols < 1 || rows > 50 || cols > 50) {
        throw new Error("rows e cols devono essere tra 1 e 50");
      }
    } else if (data.size != null && Number.isInteger(data.size)) {
      rows = cols = data.size;
      if (rows < 1 || rows > 50) {
        throw new Error("Campo size non valido (usa 1–50 oppure rows/cols)");
      }
    } else {
      throw new Error(
        'Indica "size" (griglia quadrata) oppure "rows" e "cols" (rettangolare)'
      );
    }
    data.rows = rows;
    data.cols = cols;

    if (!Array.isArray(data.blocks) || !Array.isArray(data.solution)) {
      throw new Error("blocks e solution devono essere array");
    }
    for (let b = 0; b < data.blocks.length; b++) {
      const pair = data.blocks[b];
      if (
        !Array.isArray(pair) ||
        pair.length !== 2 ||
        !Number.isInteger(pair[0]) ||
        !Number.isInteger(pair[1])
      ) {
        throw new Error("blocks: ogni elemento deve essere [r, c] con interi");
      }
      const [br, bc] = pair;
      if (br < 0 || br >= rows || bc < 0 || bc >= cols) {
        throw new Error("blocks: coordinate fuori dalla griglia rows×cols");
      }
    }
    if (data.solution.length !== rows) {
      throw new Error("solution deve avere esattamente \"rows\" righe");
    }
    for (let i = 0; i < rows; i++) {
      if (
        typeof data.solution[i] !== "string" ||
        data.solution[i].length !== cols
      ) {
        throw new Error(
          "Ogni riga di solution deve avere lunghezza uguale a \"cols\""
        );
      }
    }
    const blockCheck = new Set(data.blocks.map(([r, c]) => r + "," + c));
    const rawLabels = Array.isArray(data.cellNumbers) ? data.cellNumbers : [];
    const seenLabelCells = new Set();
    for (const it of rawLabels) {
      if (
        !it ||
        !Number.isInteger(it.row) ||
        !Number.isInteger(it.col) ||
        !Number.isInteger(it.num)
      ) {
        throw new Error(
          "cellNumbers: ogni elemento deve avere row, col e num interi"
        );
      }
      if (
        it.row < 0 ||
        it.row >= rows ||
        it.col < 0 ||
        it.col >= cols
      ) {
        throw new Error("cellNumbers: row/col fuori dalla griglia");
      }
      if (it.num < 1) {
        throw new Error("cellNumbers: num deve essere ≥ 1");
      }
      const pk = it.row + "," + it.col;
      if (blockCheck.has(pk)) {
        throw new Error(
          "cellNumbers: non può esserci un numero su una casella nera"
        );
      }
      if (seenLabelCells.has(pk)) {
        throw new Error("cellNumbers: stessa cella indicata due volte");
      }
      seenLabelCells.add(pk);
    }
    data.cellNumbers = rawLabels;

    function normalizeClueList(raw, label) {
      if (raw === undefined || raw === null) return [];
      if (!Array.isArray(raw)) {
        throw new Error(label + ": deve essere un array oppure omettilo");
      }
      const out = [];
      const seenNums = new Set();
      for (let i = 0; i < raw.length; i++) {
        const it = raw[i];
        if (!it || typeof it !== "object") {
          throw new Error(label + ": elemento " + i + " non valido");
        }
        if (!Number.isInteger(it.num) || it.num < 1) {
          throw new Error(label + ": num intero ≥ 1 richiesto (voce " + i + ")");
        }
        if (typeof it.text !== "string") {
          throw new Error(label + ": campo text stringa richiesto per num " + it.num);
        }
        const t = it.text.trim();
        if (!t) {
          throw new Error(label + ": testo vuoto per il numero " + it.num);
        }
        if (seenNums.has(it.num)) {
          throw new Error(label + ": il numero " + it.num + " è duplicato");
        }
        seenNums.add(it.num);
        out.push({ num: it.num, text: t });
      }
      out.sort((a, b) => a.num - b.num);
      return out;
    }

    data.cluesAcross = normalizeClueList(data.cluesAcross, "cluesAcross");
    data.cluesDown = normalizeClueList(data.cluesDown, "cluesDown");
    return data;
  }

  gridEl.addEventListener("keydown", (e) => {
    if (isBlock(activeR, activeC)) return;

    const letterEl = cellAt(activeR, activeC).querySelector(".letter");

    if (e.key === "ArrowUp") {
      e.preventDefault();
      stepByDelta(-1, 0);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      stepByDelta(1, 0);
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      stepByDelta(0, -1);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      stepByDelta(0, 1);
      return;
    }

    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      letterEl.textContent = "";
      updateSolveMessage();
      return;
    }

    if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
      e.preventDefault();
      letterEl.textContent = e.key.toUpperCase();
      if (advanceMode === "horizontal") {
        advanceAfterLetterHorizontal();
      } else if (advanceMode === "vertical") {
        advanceAfterLetterVertical();
      }
      updateSolveMessage();
    }
  });

  function failLoad(message) {
    applyPuzzleSpec(null);
    loadHint.textContent = message;
    playTitle.textContent = "Cruciverba";
    document.title = "Cruciverba";
  }

  function safeFileName(name) {
    if (!name || typeof name !== "string") return null;
    if (/^[a-zA-Z0-9._-]+\.json$/.test(name)) return name;
    return null;
  }

  if (!puzzleId) {
    failLoad(
      "Nessun cruciverba selezionato. Torna al menu e scegline uno."
    );
    return;
  }

  fetch("puzzles-manifest.json")
    .then((r) => {
      if (!r.ok) throw new Error("manifest");
      return r.json();
    })
    .then((manifest) => {
      const entry = manifest.puzzles.find((p) => p.id === puzzleId);
      if (!entry) {
        throw new Error("unknown");
      }
      const file = safeFileName(entry.file);
      if (!file) {
        throw new Error("badfile");
      }
      playTitle.textContent = entry.title;
      document.title = entry.title + " – Cruciverba";
      return fetch(file).then((r) => {
        if (!r.ok) throw new Error("puzzle");
        return r.json().then((data) => ({
          data: normalizePuzzleJSON(data),
          entry,
        }));
      });
    })
    .then(({ data }) => {
      applyPuzzleSpec(data);
      loadHint.textContent = "";
    })
    .catch((err) => {
      if (err && err.message === "unknown") {
        failLoad(
          "Cruciverba non trovato. Torna al menu e scegli un'opzione valida."
        );
      } else {
        failLoad(
          "Impossibile caricare il gioco. Usa un server locale nella cartella del progetto (es. python3 -m http.server) e riprova."
        );
      }
    });
})();
