/**
 * js/modes/cornici.js - Cornici concentriche mode
 *
 * This mode presents a square grid where answers run around concentric
 * rectangular frames. Horizontal and vertical clues are not used; instead
 * each frame has a single clue and a continuous path around the frame.
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
      throw new Error("Campo size non valido (usa 1-50 oppure rows/cols)");
  } else {
    throw new Error('Indica "size" oppure "rows" e "cols"');
  }

  if (rows !== cols) {
    throw new Error("Cornici concentriche richiede una griglia quadrata.");
  }

  data.rows = rows;
  data.cols = cols;

  // ── Solution ─────────────────────────────────────────────────────────────
  if (!Array.isArray(data.solution)) {
    throw new Error("solution deve essere un array di stringhe");
  }
  if (data.solution.length !== rows) {
    throw new Error(`solution deve avere esattamente ${rows} righe`);
  }
  for (let r = 0; r < rows; r++) {
    const row = data.solution[r];
    if (typeof row !== "string" || row.length !== cols) {
      throw new Error(`solution riga ${r}: deve essere una stringa di lunghezza ${cols}`);
    }
    for (let c = 0; c < cols; c++) {
      if (!/[A-Za-z.]/.test(row[c])) {
        throw new Error(`solution riga ${r}, colonna ${c}: carattere non valido "${row[c]}" (usa lettere o '.')`);
      }
    }
  }

  const maxFrames = Math.floor(rows / 2);

  function normalizeClueList(raw, label) {
    if (raw == null) {
      return [];
    }
    if (!Array.isArray(raw)) {
      throw new Error(`${label} deve essere un array`);
    }
    const seenNums = new Set();
    return raw.map((item, index) => {
      if (!item || typeof item !== "object") {
        throw new Error(`${label}[${index}] non è un oggetto valido`);
      }
      if (!Number.isInteger(item.num) || item.num < 1) {
        throw new Error(`${label}[${index}].num non valido`);
      }
      if (seenNums.has(item.num)) {
        throw new Error(`${label} numero duplicato: ${item.num}`);
      }
      seenNums.add(item.num);
      if (typeof item.text !== "string" || !item.text.trim()) {
        throw new Error(`${label}[${index}].text mancante o vuoto`);
      }
      return { num: item.num, text: item.text.trim() };
    });
  }

  // Handle both cluesAcross (array format) and cluesAcrossMixed (string format)
  if (data.cluesAcrossMixed != null) {
    if (typeof data.cluesAcrossMixed !== "string") {
      throw new Error("cluesAcrossMixed deve essere una stringa");
    }
    const clues = data.cluesAcrossMixed.split(" - ").map(text => text.trim()).filter(text => text);
    data.cluesAcross = clues.map((text, index) => ({
      num: index + 1,
      text: text
    }));
    // Preserve the original mixed format for rendering
    data.cluesAcrossMixed = data.cluesAcrossMixed;
  } else {
    data.cluesAcross = normalizeClueList(data.cluesAcross, "cluesAcross");
  }
  
  data.cluesFrame = normalizeClueList(data.cluesFrame, "cluesFrame");

  

  // If we plan not to use frame in the json, remove this part
  /**
  if (data.frames != null) {
    if (!Array.isArray(data.frames)) {
      throw new Error("frames deve essere un array di cornici");
    }

    const usedCells = new Set();
    const frameNums = new Set();
    const frames = data.frames.map((frame, index) => {
      if (!frame || typeof frame !== "object") {
        throw new Error(`frames[${index}] non è un oggetto valido`);
      }
      if (!Number.isInteger(frame.num) || frame.num < 1) {
        throw new Error(`frames[${index}].num non valido`);
      }
      if (frameNums.has(frame.num)) {
        throw new Error(`frames num duplicato: ${frame.num}`);
      }
      frameNums.add(frame.num);
      if (typeof frame.text !== "string" || !frame.text.trim()) {
        throw new Error(`frames[${index}].text mancante o vuoto`);
      }
      if (!Array.isArray(frame.path) || frame.path.length < 4) {
        throw new Error(`frames[${index}].path deve essere un array di almeno 4 coordinate`);
      }

      const path = frame.path.map((coord, coordIndex) => {
        if (!Array.isArray(coord) || coord.length !== 2) {
          throw new Error(`frames[${index}].path[${coordIndex}] non è una coppia [r,c] valida`);
        }
        const [r, c] = coord;
        if (!Number.isInteger(r) || !Number.isInteger(c)) {
          throw new Error(`frames[${index}].path[${coordIndex}] deve contenere interi`);
        }
        if (r < 0 || r >= rows || c < 0 || c >= cols) {
          throw new Error(`frames[${index}].path[${coordIndex}] fuori griglia: [${r},${c}]`);
        }
        const key = `${r},${c}`;
        if (usedCells.has(key)) {
          throw new Error(`cellula duplicata in più cornici: [${r},${c}]`);
        }
        usedCells.add(key);
        return { r, c };
      });

      return {
        num: frame.num,
        text: frame.text.trim(),
        path,
      };
    });

    data.frames = frames.sort((a, b) => a.num - b.num);
    return data;
  } */

  if (data.cluesFrame.length === 0) {
    throw new Error("cluesFrame deve contenere almeno una definizione");
  }
  if (data.cluesFrame.length !== maxFrames) {
    throw new Error(`cluesFrame deve contenere esattamente ${maxFrames} definizioni, una per ogni cornice`);
  }

  const missing = [];
  const frameNums = new Set();
  for (const clue of data.cluesFrame) {
    if (clue.num < 1 || clue.num > maxFrames) {
      throw new Error(`cluesFrame[${clue.num}] deve avere num compreso tra 1 e ${maxFrames}`);
    }
    if (frameNums.has(clue.num)) {
      throw new Error(`cluesFrame numero duplicato: ${clue.num}`);
    }
    frameNums.add(clue.num);
  }
  for (let n = 1; n <= maxFrames; n++) {
    if (!frameNums.has(n)) missing.push(n);
  }
  if (missing.length > 0) {
    throw new Error(`cluesFrame mancano le cornici: ${missing.join(", ")}`);
  }

  // Return the list of cells in order for the specified frame.
  function makeFramePath(frameNum) {
    const layer = frameNum - 1;
    const top = layer;
    const left = layer;
    const bottom = rows - 1 - layer;
    const right = cols - 1 - layer;
    if (top >= bottom || left >= right) {
      throw new Error(`Cornice ${frameNum} non valida per griglia ${rows}x${cols}`);
    }

    const path = [];
    for (let c = left; c <= right; c++) path.push({ r: top, c });
    for (let r = top + 1; r <= bottom; r++) path.push({ r, c: right });
    for (let c = right - 1; c >= left; c--) path.push({ r: bottom, c });
    for (let r = bottom - 1; r > top; r--) path.push({ r, c: left });
    if (path.length < 4) {
      throw new Error(`Cornice ${frameNum} è troppo piccola`);
    }
    return path;
  }
  // remove if we plan not to use frame in the json
  // MAYBE WE NEED TO KEEP THIS... data.frames is used in init
  // If so,we need to restore the makepath function as well
  
  data.frames = data.cluesFrame
    .slice()
    .sort((a, b) => a.num - b.num)
    .map((frame) => ({
      num: frame.num,
      text: frame.text,
      path: makeFramePath(frame.num),
    }));

  return data;
}

function injectStyles() {
  if (document.getElementById("cornici-styles")) return;
  const link = document.createElement("link");
  link.id = "cornici-styles";
  link.rel = "stylesheet";
  link.href = "css/cornici.css";
  document.head.appendChild(link);
}

export function init(spec, ui) {
  const {
    gridEl,
    solveStatus,
    loadHint,
    cluesAcrossEl,
    cluesDownEl,
    playTitle,
    btnOriz,
    btnVert,
  } = ui;

  document.body.classList.add("mode-cornici");
  injectStyles();

  if (btnOriz) btnOriz.textContent = "Orizzontale (Alt+O)";
  if (btnVert) btnVert.textContent = "Cornice (Alt+C)";

  const headingAcross = document.getElementById("heading-across");
  const headingDown   = document.getElementById("heading-down");
  if (headingAcross) headingAcross.textContent = "Orizzontali";
  if (headingDown)   headingDown.textContent   = "Cornici";

  const numRows = spec.rows;
  const numCols = spec.cols;
  const solutionRows = spec.solution;
  const frames = spec.frames;

  const cells = [];
  const framePaths = new Map();
  const cellToFrame = new Map();
  const acrossClueEls = new Map();
  const frameClueEls = new Map();

  let activeR = 0;
  let activeC = 0;
  let activeFrameNum = null;
  let activeFrameIndex = null;
  let advanceMode = "horizontal";

  function keyRC(r, c) { return `${r},${c}`; }

  function cellAt(r, c) { return cells[r * numCols + c]; }

  // Return the frame number for the cell at (r,c),
  // or null if it's not part of any frame.
  // cellToFrame is pre-populated with all frame cells,
  // so this is just a quick lookup.
  function getFrameInfoAt(r, c) {
    return cellToFrame.get(keyRC(r, c)) ?? null;
  }

  // color the active cell and all cells in the same frame.
  // ToDo: just color the frames alternatively and let css handle the rest.
  function updateSelectionFrame() {
    if (advanceMode === "alongFrame"){
      cells.forEach((cell, index) => {
      const r = Math.floor(index / numCols);
      const c = index % numCols;
      const frameInfo = getFrameInfoAt(r, c);
      cell.classList.toggle("selected", r === activeR && c === activeC);
      cell.classList.toggle("frame-active", frameInfo?.num === activeFrameNum);
    });
    } else if (advanceMode === "horizontal") {
      cells.forEach((cell, index) => {
        const r = Math.floor(index / numCols);
        const c = index % numCols;
        if (isBlock(r, c)) return;
        cell.classList.toggle("selected", r === activeR && c === activeC);
        cell.classList.toggle("frame-active", r === activeR);
      });
    }
        
    updateActiveClueHighlight();
  }

  // Set the active cell to (r,c).
  function setActive(r, c) {
    activeR = Math.max(0, Math.min(numRows - 1, r));
    activeC = Math.max(0, Math.min(numCols - 1, c));
    const frameInfo = getFrameInfoAt(activeR, activeC);
    activeFrameNum = frameInfo?.num ?? null;
    activeFrameIndex = frameInfo?.index ?? null;
    updateSelectionFrame();
  }

  // only one dentral block, fixed for all puzzles
  function isBlock(r, c) { return r === 6 && c === 6; }

  function stepByDelta(dr, dc) {
    const r = activeR + dr;
    const c = activeC + dc;
    if (r >= 0 && r < numRows && c >= 0 && c < numCols && !isBlock(r, c)) {
      setActive(r, c);
    }
  }

  function updateSolveMessage() {
    let total = 0;
    let correct = 0;

    for (const [key, info] of cellToFrame) {
      total += 1;
      const [r, c] = key.split(",").map(Number);
      const letter = cellAt(r, c).querySelector(".letter").textContent;
      if (letter && letter === solutionRows[r][c].toUpperCase()) {
        correct += 1;
      }
    }

    if (total === 0) {
      solveStatus.textContent = "Nessuna cornice definita.";
    } else if (correct === total) {
      //solveStatus.textContent = "COMPLETATO! Tutte le cornici sono corrette.";
      solveStatus.textContent = "";
      solveStatus.classList.add("is-solved");
      if (playTitle) {
        if (!playTitle.textContent.includes(" - COMPLETATO")) {
          playTitle.textContent += " - COMPLETATO";
        }
      }

      // Turn all white cells green
      for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
          if (!isBlock(r, c)) {
            const cell = cellAt(r, c);
            cell.classList.add("solved-cell");
          }
        }
      }

    } else {
      solveStatus.classList.remove("is-solved");
      if (playTitle) {
        playTitle.textContent = playTitle.textContent.replace(" - COMPLETATO", "");
      }
      //solveStatus.textContent = `${correct}/${total} lettere corrette`;
    }
  }

  function focusGrid() {
    requestAnimationFrame(() => gridEl.focus({ preventScroll: true }));
  }
// ── Clue rendering ────────────────────────────────────────────────────────
  function renderClues() {
    cluesAcrossEl.replaceChildren();
    cluesDownEl.replaceChildren();
    acrossClueEls.clear();
    frameClueEls.clear();

    if (spec.cluesAcrossMixed != null) {
      // Display the mixed clues as a single text block
      const p = document.createElement("p");
      p.className = "clues-mixed";
      p.textContent = spec.cluesAcrossMixed;
      cluesAcrossEl.appendChild(p);
    } else if (spec.cluesAcross?.length) {
      for (const clue of spec.cluesAcross) {
        const li = document.createElement("li");
        const numSpan = document.createElement("span");
        numSpan.className = "clue-num";
        numSpan.textContent = clue.num + ".";

        const textSpan = document.createElement("span");
        textSpan.className = "clue-text";
        textSpan.textContent = " " + clue.text;

        li.appendChild(numSpan);
        li.appendChild(textSpan);
        cluesAcrossEl.appendChild(li);
        acrossClueEls.set(clue.num, li);
      }
    } else {
      const li = document.createElement("li");
      li.className = "clues-empty";
      li.textContent = "- Nessuna definizione orizzontale disponibile.";
      cluesAcrossEl.appendChild(li);
    }

    if (spec.cluesFrame.length === 0) {
      const li = document.createElement("li");
      li.className = "clues-empty";
      li.textContent = "- Nessuna cornice disponibile.";
      cluesDownEl.appendChild(li);
    } else {
      for (const frame of frames) {
        const li = document.createElement("li");
        const numSpan = document.createElement("span");
        numSpan.className = "clue-num";
        numSpan.textContent = frame.num + ".";
        const textSpan = document.createElement("span");
        textSpan.className = "clue-text";
        textSpan.textContent = " " + frame.text;
        li.appendChild(numSpan);
        li.appendChild(textSpan);
        cluesDownEl.appendChild(li);
        frameClueEls.set(frame.num, li);
      }
    }
  }

  function updateActiveClueHighlight() {
    for (const li of acrossClueEls.values()) li.classList.remove("clue-active");
    for (const li of frameClueEls.values()) li.classList.remove("clue-active");

    // Remove highlight from mixed clues paragraph if it exists
    const mixedCluesEl = cluesAcrossEl.querySelector('.clues-mixed');
    if (mixedCluesEl) {
      mixedCluesEl.classList.remove("clue-active");
    }

    if (advanceMode === "horizontal") {
      if (spec.cluesAcrossMixed != null) {
        // Highlight the entire mixed clues paragraph
        if (mixedCluesEl) {
          mixedCluesEl.classList.add("clue-active");
          const panel = cluesAcrossEl.closest('.clues-panel') || cluesDownEl.closest('.clues-panel');
          mixedCluesEl.scrollIntoView({ block: "center", behavior: "smooth", root: panel });
        }
      } else {
        // Highlight individual clue as before
        const li = acrossClueEls.get(activeR + 1);
        if (li) {
          li.classList.add("clue-active");
          const panel = cluesAcrossEl.closest('.clues-panel') || cluesDownEl.closest('.clues-panel');
          li.scrollIntoView({ block: "center", behavior: "smooth", root: panel });
        }
      }
    } else if (activeFrameNum != null) {
      const li = frameClueEls.get(activeFrameNum);
      if (li) {
        li.classList.add("clue-active");
        const panel = cluesDownEl.closest('.clues-panel') || cluesAcrossEl.closest('.clues-panel');
        li.scrollIntoView({ block: "center", behavior: "smooth", root: panel });
      }
    }
  }

  // -- Advancement logic
  function advanceHorizontal() {
    const nextCol = activeC + 1;
    if (nextCol < numCols && !isBlock(activeR, nextCol)) {
      setActive(activeR, nextCol);
    }
  }

  function advanceAlongFrame(forward = true) {
    if (activeFrameNum == null) return;
    const path = framePaths.get(activeFrameNum);
    if (!path) return;
    const nextIndex = (activeFrameIndex + (forward ? 1 : -1) + path.length) % path.length;
    const next = path[nextIndex];
    setActive(next.r, next.c);
  }

  function setAdvanceMode(mode) {
    advanceMode = advanceMode === mode ? null : mode;
    syncDirectionButtons();
    updateSelectionFrame();
  }

  // -- Buttons listeners 
  function syncDirectionButtons() {
    if (!btnOriz || !btnVert) return;
    btnOriz.classList.toggle("is-active", advanceMode === "horizontal");
    btnVert.classList.toggle("is-active", advanceMode === "alongFrame");
    btnOriz.setAttribute("aria-pressed", advanceMode === "horizontal" ? "true" : "false");
    btnVert.setAttribute("aria-pressed", advanceMode === "alongFrame" ? "true" : "false");
  }

  if (btnOriz) {
    btnOriz.addEventListener("click", () => {
      advanceMode = "horizontal";
      syncDirectionButtons();
      updateSelectionFrame();
      gridEl.focus();
    });
  }
  if (btnVert) {
    btnVert.addEventListener("click", () => {
      advanceMode = "alongFrame";
      syncDirectionButtons();
      updateSelectionFrame();
      gridEl.focus();
    });
  }

  syncDirectionButtons();

  //── Grid construction ────────────────────────────────────────────────────────
  function buildGrid() {
    gridEl.replaceChildren();
    cells.length = 0;

    gridEl.style.setProperty("--grid-cols", String(numCols));
    gridEl.style.setProperty("--grid-rows", String(numRows));
    gridEl.setAttribute("aria-rowcount", String(numRows));
    gridEl.setAttribute("aria-colcount", String(numCols));

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        const frameInfo = getFrameInfoAt(r, c);
        if (frameInfo) {
          cell.classList.add("frame-cell");
          if (frameInfo.index === 0) {
            cell.classList.add("frame-start");
          }
          if (frameInfo.num % 2 === 0) {
            cell.classList.add("even-frame");
          }
        }

        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-rowindex", String(r + 1));
        cell.setAttribute("aria-colindex", String(c + 1));

        const letter = document.createElement("span");
        letter.className = "letter";
        letter.setAttribute("aria-hidden", "true");
        cell.appendChild(letter);

        if (isBlock(r, c)) {
          cell.classList.add("is-block");
          cell.setAttribute("aria-disabled", "true");
        } else{
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

  for (const frame of frames) {
    framePaths.set(frame.num, frame.path);
    frame.path.forEach((pos, index) => {
      cellToFrame.set(keyRC(pos.r, pos.c), { num: frame.num, index });
    });
  }

  buildGrid();

  const start = frames.length > 0 ? frames[0].path[0] : { r: 0, c: 0 };
  setActive(start.r, start.c);
  renderClues();
  updateSolveMessage();

  gridEl.addEventListener("keydown", (e) => {
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
        } else {
          advanceAlongFrame(false);
        }
        updateSolveMessage();
        return;
    }

    // Keyboard shortcuts for direction mode
    if (!e.ctrlKey && !e.metaKey && e.altKey) {
      const key = e.key.toLowerCase();
      if (key === "o") {
        e.preventDefault();
        setAdvanceMode("horizontal");
        return;
      }
      if (key === "c") {
        e.preventDefault();
        setAdvanceMode("alongFrame");
        return;
      }
    }

    if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
      e.preventDefault();
      letterEl.textContent = e.key.toUpperCase();
      updateSolveMessage();
      if (advanceMode === "horizontal") {
        advanceHorizontal();
      } else {
        advanceAlongFrame(true);
      }
    }
  });
  
  focusGrid()

  /**
  if (loadHint) {
    loadHint.textContent = "Seleziona una cornice e digita le lettere lungo il percorso.";
  } */
}
