# Data Ninja — Level 1 🥷

A single-page, browser-only mini-lab where students complete 5 pandas/matplotlib “missions” inside an in-page Python runtime.  
No server required. Powered by **Pyodide** (Python in WebAssembly) + **CodeMirror**.

---

## What it does

- Loads a small coffee-sales CSV into the in-browser filesystem.
- Students type Python (e.g., `df.head()`), press **Run**, and see notebook-style output.
- `plt.show()` is intercepted and rendered inline.
- The final line auto-renders if it’s a bare expression (e.g., `df.head()`), and `print(df.head())` is handled too.
- Each mission has **Run**/**Check**; on success the mission collapses and the next opens.
- Timer, score, celebratory FX, sticky status panel, **Reset**, and quick links to docs.
- Optional JSON submission download.

---

## Run locally

No build step needed.

```bash
git clone https://github.com/bendupey87/dataninjagame.git
cd dataninjagame
```

Open `index.html` in a modern browser.

If your browser blocks WASM/CDN features from `file://`, serve it locally:

```bash
# Python 3
python -m http.server 8000
# or Node
npx serve .
```

Then visit `http://localhost:8000`.

---

## Deploy (GitHub Pages)

1. Push `index.html` to `main`.
2. Repo **Settings → Pages**  
   - **Source:** “Deploy from a branch”  
   - **Branch:** `main` and `/ (root)`
3. After it publishes, the site will appear at:  
   `https://<your-username>.github.io/dataninjagame/`

---

## How it works

- **Pyodide** is loaded from the CDN; we install `pandas` and `matplotlib`.
- We patch `matplotlib.pyplot.show()` to capture plots (base64 PNG) for display.
- We capture stdout/stderr and render notebook-like HTML for DataFrames/Series.
- We parse the last code line; if it’s a **bare expression** or `print(expr)`, we evaluate and render it like Jupyter.

---

## Student quickstart

```python
import pandas as pd
df = pd.read_csv("/tmp/mystic_coffee_sales.csv")
df.head()          # auto-renders as a table
```

For plots:

```python
import matplotlib.pyplot as plt
# your plotting code...
plt.show()         # required to render
```

Use **Check** to validate each mission. **Reset** reloads the page and clears progress.

---

## Customize

- **Timer:** search `DURATION_MS` in `index.html`.
- **Dataset:** replace the CSV text written to `/tmp/mystic_coffee_sales.csv`.
- **Theme:** tweak CSS variables in `:root` / `:root[data-theme="light"]`.
- **Missions:** adjust the per-mission checks in the `checkBtn` handler.
- **Docs row:** edit the `.docLinks` anchors in the Status panel.

---

## Troubleshooting

- **First load is slow:** Pyodide download on first visit is normal.
- **`df.head()` doesn’t render:** Ensure it’s the final line or use `print(df.head())`. Check the browser console for Pyodide errors.
- **Plots don’t appear:** Call `plt.show()` at the end.
- **Reset doesn’t clear:** It calls `window.location.reload()`. If caching interferes, hard-reload.

---

## Roadmap

- Levels 2/3 pages and a simple home page.
- Student identity (dropdown or secret code) + save scores to a database.
- Instructor dashboard.
- Keyboard shortcuts and mobile polish.

---

## License

MIT — feel free to fork and remix for your class.
