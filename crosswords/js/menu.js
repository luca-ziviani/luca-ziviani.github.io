(function () {
  const listEl = document.getElementById("puzzle-list");
  const errEl = document.getElementById("menu-error");

  fetch("puzzles-manifest.json")
    .then((r) => {
      if (!r.ok) throw new Error();
      return r.json();
    })
    .then((manifest) => {
      listEl.replaceChildren();
      for (const p of manifest.puzzles) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.className = "puzzle-card";
        a.href = "play.html?id=" + encodeURIComponent(p.id);
        const h2 = document.createElement("h2");
        h2.textContent = p.title;
        a.appendChild(h2);
        if (p.description) {
          const desc = document.createElement("p");
          desc.textContent = p.description;
          a.appendChild(desc);
        }
        li.appendChild(a);
        listEl.appendChild(li);
      }
    })
    .catch(() => {
      errEl.hidden = false;
      errEl.textContent =
        "Impossibile caricare l'elenco dei cruciverba. Avvia un server nella cartella del progetto (es. python3 -m http.server) e apri index.html da lì.";
    });
})();
