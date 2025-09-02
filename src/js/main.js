/**
 * main.js
 * Main logic for Data Ninja Game: CodeMirror setup, theme switching, mission handling,
 * timer, Python runtime (Pyodide), score submission, and UI interactions.
 * Usage: <script type="module" src="src/js/main.js"></script>
 */

const welcomeOverlay=document.getElementById('welcomeOverlay');
  const dismissWelcome=document.getElementById('dismissWelcome');
  // --- CodeMirror editors ---
  const editors = {}; // id -> CodeMirror instance
  function initEditors(){
    const TODO = '#TODO: YOUR CODE HERE\n';

    ['m1','m2','m3','m4','m5'].forEach(id=>{
      const ta = document.getElementById(`code-${id}`);
      if (!ta) return;

      const cm = CodeMirror.fromTextArea(ta, {
        mode:'python',
        theme:(document.documentElement.getAttribute('data-theme')==='light'?'neo':'material-darker'),
        lineNumbers:true,
        matchBrackets:true,
        indentUnit:4,
        tabSize:4,
        indentWithTabs:false,
        autofocus: id==='m1'
      });
      cm.setSize('100%','120px');

      // If it's empty, seed the TODO and mark as placeholder
      let hasPlaceholder = false;
      if (!cm.getValue().trim()) {
        cm.setValue(TODO);
        hasPlaceholder = true;
        cm.getWrapperElement().classList.add('cm-has-placeholder');
        cm.setCursor({line:0, ch:0});
      }

      // Remove placeholder on focus
      cm.on('focus', (_cm) => {
        if (hasPlaceholder && _cm.getValue() === TODO) {
          hasPlaceholder = false;
          _cm.getWrapperElement().classList.remove('cm-has-placeholder');
          _cm.setValue('');
        }
      });

      // First real keystroke clears the placeholder (keep this for fallback)
      cm.on('keydown', (_cm, e) => {
        if (!hasPlaceholder) return;
        const navKeys = ['Shift','Alt','Control','Meta','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab','CapsLock'];
        if (navKeys.includes(e.key)) return;

        if (_cm.getValue() === TODO) {
          hasPlaceholder = false;
          _cm.getWrapperElement().classList.remove('cm-has-placeholder');
          _cm.setValue('');
        }
      });
      editors[id] = cm;
    });
  }

  function getCode(id){ return editors[id] ? editors[id].getValue() : (document.getElementById(`code-${id}`)?.value || ''); }
  function setEditorTheme(mode){
    const theme = (mode==='light') ? 'neo' : 'material-darker';
    Object.values(editors).forEach(cm=>cm.setOption('theme', theme));
  }
  requestAnimationFrame(initEditors);

  // Initial theme (respects OS, defaults to dark)
  // --- THEME: single source of truth ---
  const themeToggle = document.getElementById('themeToggle');
  const root = document.documentElement;

  function applyTheme(mode){
    root.setAttribute('data-theme', mode);
    if (themeToggle){
      themeToggle.textContent = (mode === 'light') ? 'Dark mode' : 'Light mode';
    }
    setEditorTheme(mode);
  }

  // We set data-theme early in <head>; use it here
  const initial = root.getAttribute('data-theme') || 'dark';
  applyTheme(initial);

  if (themeToggle){
    themeToggle.addEventListener('click', ()=>{
      const next = (root.getAttribute('data-theme') === 'light') ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      applyTheme(next);
    });
  }

// Worker endpoint (browser hits this; do not expose APP_SHARED_KEY here)
// Replace your API constants to target the WORKER
const API_URL = 'https://dn-proxy.bendupey.workers.dev';
const API_WITH_ORIGIN = `${API_URL}?origin=${encodeURIComponent(window.location.origin)}`

dismissWelcome.addEventListener('click', async (e) => {
  e.preventDefault();
  const code = (document.getElementById('secretCode')?.value || '').trim();
  if (!code) { alert('Enter your secret code.'); return; }

  try {
    const res = await fetch(API_WITH_ORIGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'exchange', code })
    }).then(r => r.json());

    if (!res.ok) {
      if (res.error === 'already_submitted') {
        alert('⚠️ This code has already been used. Contact your instructor.');
      } else if (res.error === 'invalid_code') {
        alert('Code not recognized. Check with instructor.');
      } else {
        alert('Sign-in failed. Try again.');
        console.warn(res);
      }
      return; // 🚫 do not admit
    }

    // Admit
    sessionStorage.setItem('dn_code', res.code);
    window.currentCodeHash = res.code; // you’re using raw code now
    welcomeOverlay.style.display = 'none';
    await bootstrapPython();
  } catch (err) {
    console.error(err);
    alert('Network error. Could not reach server.');
  }
});


  const statusEl = document.getElementById('status');
  const scoreNow = document.getElementById('scoreNow');
  const scoreMax = document.getElementById('scoreMax');
  const timerEl  = document.getElementById('timer');
  const certModal = document.getElementById('certModal');
  const certTitle = document.getElementById('certTitle');
  const certBody  = document.getElementById('certBody');
  const playerNameEl = document.getElementById('playerName');
  const downloadSubmitBtn = document.getElementById('downloadSubmitBtn');
  const closeCertBtn = document.getElementById('closeCertBtn');

  const ORDER  = ['m1','m2','m3','m4','m5'];
  const POINTS = {m1:2,m2:3,m3:3,m4:3,m5:3};
  scoreMax.textContent = ORDER.reduce((s,k)=>s+POINTS[k],0);

  // Timer — 1 minute
  const DURATION_MS = 20 * 60 * 1000;
  // const DURATION_MS = 1 * 60 * 1000; // 1 minute for testing
  let startTs = Date.now();
  let finished=false, expired=false, ticker;

  function startTimer(){
  if (ticker) clearInterval(ticker);
  startTs = Date.now();
  let warned5 = false; 
  ticker = setInterval(()=>{
    const remain = Math.max(0, DURATION_MS - (Date.now() - startTs));
    const s  = Math.floor(remain/1000);
    const mm = String(Math.floor(s/60)).padStart(2,'0');
    const ss = String(s%60).padStart(2,'0');
    if (timerEl) timerEl.textContent = `${mm}:${ss}`;

    if (!warned5 && remain <= 5*60*1000 && remain > 4.99*60*1000) {
      warned5 = true;
      alert('⚠️ 5 minutes left! Finish up your missions.');
    }

    if (remain === 0 && !finished){
      clearInterval(ticker);
      expired = true;
      alert('⏰ Time up!'); 
      const code = sessionStorage.getItem('dn_code');
      const elapsed = Date.now() - startTs;
      if (code) {
        fetch(API_WITH_ORIGIN, {
          method:'POST',
          headers:{ 'Content-Type':'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'submit',
            code,
            level: 1,
            score: earned,
            elapsed_ms: elapsed
          })
        }).then(r=>r.json()).then(res=>{
          if (res.success){
            alert('⏰ Time up! Score submitted automatically.');
          } else {
            alert('⏰ Time up! Could not submit score.');
            console.warn(res);
          }
        }).catch(err=>{
          console.error(err);
          alert('⏰ Time up! Network error submitting score.');
        });
      }
    }
  }, 250);
}

// Pyodide bootstrap (deferred until user clicks Begin Training)
let pyodide = null, pythonReady = false;

async function bootstrapPython(){
  try{
    statusEl.textContent='Downloading Pyodide…';
    const { loadPyodide } = await import('https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.mjs');
    pyodide = await loadPyodide({ indexURL:'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/' });
    statusEl.textContent='Loading packages (pandas, matplotlib)…';
    await pyodide.loadPackage(['pandas','matplotlib']);
    await pyodide.runPythonAsync(`
import io, base64
import matplotlib
matplotlib.use('AGG')
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

def _bridge_show(*a, **k):
    buf = io.BytesIO(); plt.savefig(buf, format='png', bbox_inches='tight')
    b64 = base64.b64encode(buf.getvalue()).decode('ascii')
    globals()['_last_plot_png_'] = b64
    globals()['_plotted_'] = True
    try:
        labels = [t.get_text() for t in plt.gca().get_xticklabels() if t.get_text()]
        globals()['_last_xticks_'] = labels
    except Exception:
        globals()['_last_xticks_'] = []
    plt.close('all')
plt.show = _bridge_show
globals()['_last_html_'] = ''
def display(obj):
    try:
        if hasattr(obj, 'to_html'):
            html = obj.to_html(border=0)
        else:
            html = str(obj)
    except Exception:
        html = str(obj)
    globals()['_last_html_'] = html
    `);

    const CSV_TEXT = (
      "date,drink,qty,price,revenue,shop\n"+
      "2025-01-02,Latte,32,4.25,136,Downtown\n"+
      "2025-01-03,Mocha,20,4.75,95,Campus\n"+
      "2025-01-03,Cold Brew,18,4.00,72,Airport\n"+
      "2025-02-12,Latte,40,4.25,170,Campus\n"+
      "2025-02-13,Espresso,55,3.00,165,Downtown\n"+
      "2025-02-14,Cold Brew,60,4.00,240,Downtown\n"+
      "2025-03-01,Latte,28,4.25,119,Airport\n"+
      "2025-03-02,Mocha,42,4.75,199.5,Airport\n"+
      "2025-03-06,Americano,70,3.50,245,Campus\n"+
      "2025-03-21,Cappuccino,34,4.25,144.5,Downtown\n"
    );
    pyodide.FS.writeFile('/tmp/mystic_coffee_sales.csv', new TextEncoder().encode(CSV_TEXT));

    pythonReady = true;
    statusEl.textContent = 'Python ready ✔';

    // start timer
    startTimer();
  }catch(e){
    console.error(e);
    statusEl.textContent='Load error';
    alert('Failed to load Python runtime. See console.');
  }
}


  // Small helpers
  const el = id=>document.getElementById(id);
  const pill = id=>el('pill-'+id);
  const card = id=>el('card-'+id);

  // FX burst
  function celebrateFx(){
    const layer = el('fx-layer'); if(!layer) return;
    const count = 18;
    for(let i=0;i<count;i++){
      const d = document.createElement('div');
      d.className = 'fx'+(Math.random()>.7?' ninja':'');
      d.style.left = (Math.random()*window.innerWidth)+'px';
      d.style.top  = (window.innerHeight-24)+'px';
      d.style.setProperty('--r', String(Math.random()));
      layer.appendChild(d);
      const clean=()=>d.remove();
      d.addEventListener('animationend', clean);
      setTimeout(clean, 1500);
    }
  }

  // Wire each mission (notebook-style output only)
  function wireMission(id){
    const runBtn   = document.querySelector(`[data-run="${id}"]`);
    const checkBtn = document.querySelector(`[data-check="${id}"]`);

    const plot = document.getElementById(`plot-${id}`);   // <img> for matplotlib
    const nb   = document.getElementById(`nb-${id}`);     // notebook output div
    const out  = document.getElementById(`out-${id}`);    // legacy console (hide)

    if (out) out.style.display = 'none';

  runBtn.addEventListener('click', async () => {
    if (!pythonReady) return;

    // Busy state for the Run button
    const origLabel = runBtn.textContent;
    runBtn.textContent = 'Running…';
    runBtn.disabled = true;

    // Clear visuals
    if (nb){ nb.innerHTML = ''; nb.style.display = 'none'; }
    if (plot){ plot.style.display = 'none'; plot.src = ''; }

    // Reset Python-side buffers so nothing leaks
    await pyodide.runPythonAsync(`
      globals()['_last_html_'] = ''
      globals()['_last_plot_png_'] = ''
      globals()['_plotted_'] = False
      globals()['_last_xticks_'] = []
    `);

    // Capture stdout/stderr from this run
    let textBuf = '';
    pyodide.setStdout({ batched: s => textBuf += s });
    pyodide.setStderr({ batched: s => textBuf += s });

    try {
      const codeStr = getCode(id);

      // --- auto-render final bare expression (df.head(), etc.), Jupyter-style
      const lines = codeStr.split(/\r?\n/);
      let last = "";
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim() && !/^\s*#/.test(lines[i])) { last = lines[i]; lines.length = i; break; }
      }
      const body = lines.join("\n");
      const printMatch = last && last.match(/^\s*print\s*\(([\s\S]*)\)\s*$/);
      const exprSource = printMatch ? printMatch[1] : last;
      const looksLikeExpr =
        exprSource &&
        !/^\s*(import|from|for|while|if|elif|else|try|except|finally|def|class|with|return|raise|assert|pass|break|continue)\b/.test(exprSource) &&
        !/^\s*[\w\[\]\.]+\s*=/.test(exprSource);

      if (looksLikeExpr && body.trim()) {
        await pyodide.runPythonAsync(body);
      } else {
        await pyodide.runPythonAsync(codeStr);
      }

      if (looksLikeExpr) {
        const py = `
            _last_html_ = ''
            try:
                _last_expr = ${JSON.stringify(exprSource)}
                _val = eval(compile(_last_expr, "<expr>", "eval"), globals())
                try:
                    import pandas as _pd
                    if isinstance(_val, (_pd.DataFrame, _pd.Series)) and hasattr(_val, "to_html"):
                        _last_html_ = _val.to_html(border=0)
                    elif hasattr(_val, "to_html"):
                        _last_html_ = _val.to_html()
                    else:
                        _last_html_ = str(_val)
                except Exception:
                    _last_html_ = str(_val)
            except Exception:
                pass
        `;
        await pyodide.runPythonAsync(py);
      }

      // Render notebook-style outputs
      const html = await pyodide.runPythonAsync("globals().get('_last_html_', '')");
      if (nb && html && String(html).trim()) nb.innerHTML += html;

      const b64 = await pyodide.runPythonAsync("globals().get('_last_plot_png_', '')");
      if (plot && b64){ plot.src = 'data:image/png;base64,' + b64; plot.style.display = 'block'; }

      if (nb && textBuf.trim()){
        const esc = s => s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
        nb.innerHTML += `<pre style="margin-top:10px">${esc(textBuf)}</pre>`;
      }

      // 🔔 If there was truly no visible output, show a friendly note
      const madePlot = plot && plot.style.display === 'block';
      const hasHtml  = nb && nb.innerHTML.trim().length > 0;
      const hasText  = textBuf.trim().length > 0;

      if (nb && !hasHtml && !madePlot && !hasText) {
        nb.innerHTML = `<div class="no-output">✔ Code ran (no output)</div>`;
        nb.style.display = 'block';
      } else if (nb && (hasHtml || hasText || madePlot)) {
        nb.style.display = 'block';
      }
    } catch (e) {
      if (nb){
        nb.innerHTML = `<pre style="color:#ff6b6b;margin:0">${String(e)}</pre>`;
        nb.style.display = 'block';
      }
    } finally {
      // Restore Run button
      runBtn.textContent = origLabel;
      runBtn.disabled = false;
    }
  });


    // ✅ your existing check handler
    checkBtn.addEventListener('click', async()=>{
      if(!pythonReady) return;
      let ok=false;
      if(id==='m1') ok = await pyodide.runPythonAsync("'df' in globals() and hasattr(df,'head')");
      if(id==='m2') ok = (String(await pyodide.runPythonAsync("str(df['date'].dtype)"))).includes('datetime64');
      if(id==='m3') ok = await pyodide.runPythonAsync("'month' in df.columns");
      if(id==='m4') ok = await pyodide.runPythonAsync("'totals' in globals() and hasattr(totals,'sum')");
      if(id==='m5'){
        ok = await pyodide.runPythonAsync(`
  _exp_ok = False
  if globals().get('_plotted_', False):
      try:
          import pandas as _pd
          if 'totals' in globals():
              _exp = list(totals.sort_values(ascending=False).head(5).index)
          elif 'df' in globals():
              _exp = list(df.groupby('drink')['revenue'].sum().sort_values(ascending=False).head(5).index)
          else:
              _exp = []
      except Exception:
          _exp = []
      _ticks = list(globals().get('_last_xticks_', []))
      _exp_ok = len(_ticks)==5 and (_ticks==_exp)
  _exp_ok
        `);
      }
      finalizeMission(id, !!ok);
    });
  }


  ORDER.forEach(wireMission);

  const passed=new Set(); let earned=0;

  function finalizeMission(id, ok){
    if (!ok) {
      alert('Not quite — try again.');
      return;
    }

    if (!passed.has(id)){
      passed.add(id);
      earned += POINTS[id];
      scoreNow.textContent = earned;
      celebrateFx();
    }

    const cur = card(id);
    pill(id).textContent = '✅ Done';
    cur.classList.add('done');

    // Collapse the solved section (small delay lets the checkmark update first)
    setTimeout(() => { cur.open = false; }, 250);

    const idx = ORDER.indexOf(id);
    if (idx >= 0 && idx < ORDER.length - 1){
      const nextId = ORDER[idx+1];
      const nxt = card(nextId);
      pill(nextId).textContent = 'In progress';
      nxt.open = true;
      // bring the next task into view
      nxt.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (idx === ORDER.length - 1){
      finished = true;
      if (ticker) clearInterval(ticker);
      alert('🏆 All missions complete!'); 
    }
  }



  // Certificate + download


  async function submitScore(code, level, score, elapsed_ms) {
    const res = await fetch(API_WITH_ORIGIN, {
      method: "POST",
      headers: {'Content-Type':'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: "submit",
        code,
        level,
        score,
        elapsed_ms
      })
    });
    return res.json();
  }

const submitBtn = document.getElementById('submitBtn');
if (submitBtn){
  submitBtn.addEventListener('click', async ()=>{
    const code = sessionStorage.getItem('dn_code');  // raw code stored after exchange
    if (!code){
      alert('Missing code. Refresh and sign in again.');
      return;
    }

    // Optional “are you sure?” if not all missions completed
    const total = ORDER.reduce((s,k)=>s+POINTS[k],0);
    if (earned < total){
      const ok = confirm(`You have ${earned}/${total} points. Submit anyway?`);
      if (!ok) return;
    }

    const elapsed = Date.now() - startTs;

    try {
      const res = await fetch(API_WITH_ORIGIN, {
        method:'POST',
        headers:{ 'Content-Type':'text/plain;charset=utf-8' }, // NO X-App-Key in browser
        body: JSON.stringify({
          action: 'submit',
          code,              // raw code; Apps Script will accept it
          level: 1,
          score: earned,
          elapsed_ms: elapsed
        })
      }).then(r=>r.json());

      if (res.success){
        alert('✅ Submitted. Nice work!');
        submitBtn.disabled = true;
        if (ticker) clearInterval(ticker);
      } else if (res.reason === 'already_submitted' || res.error === 'already_submitted'){
        alert('⚠️ Already submitted for Level 1.');
        submitBtn.disabled = true;
      } else if (res.error === 'invalid_code'){
        alert('❌ Code not recognized or disabled. Contact instructor.');
      } else {
        alert('❌ Submit failed. Contact instructor.');
        console.warn(res);
      }
    } catch (err){
      console.error(err);
      alert('Network error. Try again.');
    }
  });
}

const resetEl = document.getElementById('resetBtn');
if (resetEl){
  resetEl.addEventListener('click', ()=>{
    if (confirm('Reset the training? You will lose all progress!')) {
      window.location.reload();
    }
  });
}
