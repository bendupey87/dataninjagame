/** CONFIG **/
const SHEET_NAME    = 'Submissions';
const CODES_SHEET   = 'Codes';        // tab that holds raw secret codes
const ENFORCE_CODES = true;           // validate against Codes tab

/** Helpers **/
function json(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function getSheet(name){
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Missing sheet: ' + name);
  return sh;
}
function parseBody(e){
  try{ if (e && e.postData && e.postData.contents){ return JSON.parse(e.postData.contents); } }catch(_){}
  return {};
}
function ensureSubmissionHeaders(sh){
  const rng = sh.getDataRange();
  const vals = rng.getValues();
  const header = vals[0] || [];
  // If empty or wrong, enforce standard header
  if (header.length === 0 || String(header[0]).trim() === '' || header.map(h => String(h).toLowerCase().trim()).indexOf('code') < 0){
    sh.clear();
    sh.appendRow(['code','level','score','elapsed_ms','submitted_at']);
  }
}
function headerIndex(header, name){
  return header.map(h => String(h).toLowerCase().trim()).indexOf(String(name).toLowerCase());
}
function isCodeAllowed(rawCode){
  if (!ENFORCE_CODES) return true;
  const sh = getSheet(CODES_SHEET);
  const rows = sh.getDataRange().getValues();
  if (!rows.length) return false;

  const h = rows[0].map(x => String(x).toLowerCase().trim());
  const idxCode = h.indexOf('code');
  if (idxCode < 0) throw new Error('Codes sheet must have a header "code" in A1');

  const idxAllowed = h.indexOf('allowed'); // optional
  const needle = String(rawCode).trim();

  for (let i=1;i<rows.length;i++){
    const codeCell = String(rows[i][idxCode] || '').trim();
    if (!codeCell) continue;
    if (codeCell === needle){
      if (idxAllowed >= 0){
        const v = String(rows[i][idxAllowed] || '').toLowerCase().trim();
        return (v === '' || v === 'true' || v === '1');
      }
      return true;
    }
  }
  return false;
}
function isCodeAlreadySubmitted(rawCode){
  const sh = getSheet(SHEET_NAME);
  ensureSubmissionHeaders(sh);

  const rows = sh.getDataRange().getValues();
  const header = rows[0] || [];
  const idxCode = headerIndex(header, 'code');
  if (idxCode < 0) return false; // should not happen after ensureSubmissionHeaders

  const needle = String(rawCode).trim();
  for (let i=1;i<rows.length;i++){
    const val = String(rows[i][idxCode] || '').trim();
    if (val && val === needle) return true;
  }
  return false;
}

/** Router **/
function doGet(_e){ return json({ ok:true, service:'data-ninja' }); }

function doPost(e){
  try{
    const body   = parseBody(e);
    const action = String(body.action || '').toLowerCase();

    if (action === 'exchange'){
      const code = String(body.code || '').trim();
      if (!code) return json({ ok:false, error:'missing_code' });
      if (!isCodeAllowed(code)) return json({ ok:false, error:'invalid_code' });
      if (isCodeAlreadySubmitted(code)) return json({ ok:false, error:'already_submitted' });
      return json({ ok:true, code });  // admit and echo the raw code back
    }

    if (action === 'submit'){
      const code       = String(body.code || '').trim();
      const level      = Number(body.level);
      const score      = Number(body.score);
      const elapsed_ms = Number(body.elapsed_ms);

      if (!code)                        return json({ success:false, error:'missing_code' });
      if (!Number.isFinite(level) ||
          !Number.isFinite(score) ||
          !Number.isFinite(elapsed_ms)) return json({ success:false, error:'bad_payload' });
      if (!isCodeAllowed(code))         return json({ success:false, error:'invalid_code' });

      const sh = getSheet(SHEET_NAME);
      ensureSubmissionHeaders(sh);

      // prevent duplicate submit (same code+level)
      const rows = sh.getDataRange().getValues();
      const header = rows[0] || [];
      const idxCode  = headerIndex(header, 'code');
      const idxLevel = headerIndex(header, 'level');

      const dupe = rows.some((r,i)=> i>0 &&
        String(r[idxCode]||'').trim() === code &&
        Number(r[idxLevel]) === level
      );
      if (dupe) return json({ success:false, reason:'already_submitted' });

      sh.appendRow([code, level, score, elapsed_ms, new Date()]);
      return json({ success:true });
    }

    return json({ error:'unknown_action' });
  }catch(err){
    return json({ error:'server_error', detail:String(err) });
  }
}
