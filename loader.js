/*! Gym Membership Checker - single-file loader (scoped + gated by sub-account ID) */
(function () {
  // -------- GATE: only run if we're in this sub-account (location) --------
  const REQ_LOCATION_ID = "De4KzEafMS49YtrOrGeW";

  // Try hard to detect the current GHL sub-account (location) id
  function detectLocationId() {
    const href = String(location.href || "");

    // A) App URLs like: /v2/location/<id>/...
    const mPath = href.match(/\/v2\/location\/([A-Za-z0-9_-]+)/i);
    if (mPath && mPath[1]) return mPath[1];

    // B) Query params:
    const qp = new URLSearchParams(location.search);
    const qKeys = ["locationId", "location", "lid", "accountId"];
    for (const k of qKeys) {
      const v = qp.get(k);
      if (v && /^[A-Za-z0-9_-]+$/.test(v)) return v;
    }

    // C) Look for common DOM hints (some GHL templates add these)
    const attrHints = [
      '[data-location-id]',
      '[data-location]',
      'meta[name="ghl:location-id"]',
      '#locationId', '#location-id'
    ];
    for (const sel of attrHints) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const val = (el.getAttribute("content") || el.getAttribute("data-location-id") || el.getAttribute("data-location") || el.textContent || "").trim();
      if (val && /^[A-Za-z0-9_-]+$/.test(val)) return val;
    }

    // D) Sometimes GHL stores it in localStorage
    const lsKeys = ["ghlLocationId", "hl_location_id", "locationId"];
    for (const k of lsKeys) {
      const v = localStorage.getItem(k);
      if (v && /^[A-Za-z0-9_-]+$/.test(v)) return v;
    }

    return null;
  }

  function startIfAllowed() {
    const locId = detectLocationId();
    if (locId !== REQ_LOCATION_ID) return; // hard gate: do nothing if not the target location

    if (window.__gymWidgetLoaded) return;
    window.__gymWidgetLoaded = true;

    // ----------------- CONFIG -----------------
    const CONFIG = {
      API_ENDPOINT: "https://hook.us2.make.com/blek3nrd1y6aohwerlrmgzb9voymbdnk",
      API_METHOD: "POST",
      API_HEADERS: { "Content-Type": "application/json" },
      API_TIMEOUT_MS: 10000,
      projectTag: "GHL-Gym-NFC",
      keyboardScan: { enabled: true, minLength: 6, terminator: "Enter", maxKeyIntervalMs: 35, allowWhileTypingInInputs: false },
      ui: { success: "#16a34a", warning: "#d97706", danger: "#dc2626", neutral: "#64748b" }
    };

    // ----------------- FONT & SCOPED CSS -----------------
    const font = document.createElement("link");
    font.rel = "stylesheet";
    font.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap";
    document.head.appendChild(font);

    const css = `
#gymWidgetRoot, #gymWidgetRoot * { font-family: 'Poppins', sans-serif; box-sizing: border-box; }
#gymWidgetRoot { position: relative; z-index: 99998; }
#gymWidgetRoot .overlay{ position:fixed; inset:0; background:rgba(15,23,42,.6); display:none; align-items:center; justify-content:center; padding:16px; z-index:999999; }
#gymWidgetRoot .overlay.show{ display:flex; }
#gymWidgetRoot .card{ width:100%; max-width:600px; background:#fff; border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,.25); overflow:hidden; animation:gymFadeInScale .25s ease; }
#gymWidgetRoot .hd{ display:flex; align-items:center; justify-content:space-between; padding:14px 18px; background:#f8fafc; border-bottom:1px solid #e5e7eb; }
#gymWidgetRoot .ttl{ font-weight:600; font-size:16px; color:#0f172a; }
#gymWidgetRoot .bd{ padding:16px; display:grid; gap:16px; }
#gymWidgetRoot .input-wrap{ display:flex; gap:8px; }
#gymWidgetRoot #manualInput, #gymWidgetRoot #branchInput{ flex:1; border:1px solid #e5e7eb; border-radius:10px; padding:10px 12px; font-size:14px; }
#gymWidgetRoot #lookupBtn, #gymWidgetRoot #saveBranchBtn{ padding:10px 16px; border-radius:10px; border:none; background:#2563eb; color:#fff; font-size:14px; cursor:pointer; transition:filter .15s ease; }
#gymWidgetRoot #lookupBtn:hover, #gymWidgetRoot #saveBranchBtn:hover{ filter:brightness(.95); }
#gymWidgetRoot #lookupBtn:disabled, #gymWidgetRoot #saveBranchBtn:disabled{ background:#cbd5e1; cursor:not-allowed; }
#gymWidgetRoot .ghost-btn{ all:unset; cursor:pointer; padding:6px 10px; border-radius:8px; border:1px solid #e5e7eb; font-size:12px; background:#fff; }
#gymWidgetRoot .ghost-btn:hover{ background:#f1f5f9; }
#gymWidgetRoot .status{ display:flex; align-items:center; gap:8px; font-weight:600; font-size:15px; color:#0f172a; }
#gymWidgetRoot .status .dot{ width:12px; height:12px; border-radius:50%; box-shadow:0 0 0 2px #fff inset; }
#gymWidgetRoot .kv{ display:grid; grid-template-columns:150px 1fr; gap:10px 16px; }
#gymWidgetRoot .kv .k{ color:#64748b; font-size:13px; font-weight:500; }
#gymWidgetRoot .kv .v{ color:#0f172a; font-size:14px; }
#gymWidgetRoot pre.json{ margin:0; padding:14px; background:#0f172a; color:#e2e8f0; border-radius:12px; max-height:50vh; overflow:auto; font-size:12px; line-height:1.4; }
#gymWidgetRoot .fab{ position:fixed; bottom:20px; right:20px; z-index:999999; display:inline-flex; align-items:center; gap:8px; padding:10px 14px; border-radius:9999px; border:1px solid #e5e7eb; background:#fff; box-shadow:0 8px 20px rgba(0,0,0,.1); cursor:pointer; font-size:14px; font-weight:500; transition:box-shadow .2s ease, transform .2s ease; }
#gymWidgetRoot .fab:hover{ box-shadow:0 12px 28px rgba(0,0,0,.12); transform:translateY(-2px); }
#gymWidgetRoot .badge{ width:10px; height:10px; border-radius:50%; background:#64748b; box-shadow:0 0 0 2px #fff inset; }
#gymWidgetRoot .label{ white-space:nowrap; }
@keyframes gymFadeInScale{ from{ transform:scale(.95); opacity:0 } to{ transform:scale(1); opacity:1 } }
`;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    // ----------------- HTML -----------------
    const root = document.createElement("div");
    root.id = "gymWidgetRoot";
    root.innerHTML = `
<button class="fab" id="fabBtn" title="Branch: Main">
  <span class="badge" id="statusBadge" title="Branch: Main"></span>
  <span class="label">Gym</span>
</button>
<div class="overlay" id="overlay">
  <div class="card" role="dialog" aria-modal="true" aria-labelledby="gym-ttl">
    <div class="hd">
      <div id="gym-ttl" class="ttl">Membership Check</div>
      <div>
        <button id="toggleViewBtn" class="ghost-btn">Show JSON</button>
        <button id="closeModal" class="ghost-btn" aria-label="Close">✕</button>
      </div>
    </div>
    <div class="bd">
      <div class="input-wrap">
        <input id="branchInput" placeholder="Branch name (e.g., Downtown)" autocomplete="off" />
        <button id="saveBranchBtn" disabled>Save</button>
      </div>
      <div class="input-wrap">
        <input id="manualInput" placeholder="Enter/scan Card ID" autocomplete="off" />
        <button id="lookupBtn" disabled>Check</button>
      </div>
      <div id="resultCard" class="card-view"></div>
      <pre id="resultRaw" class="json" style="display:none">Waiting for scan…</pre>
    </div>
  </div>
</div>`;
    const appendRoot = () => { if (!document.getElementById("gymWidgetRoot")) document.body.appendChild(root); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", appendRoot); else appendRoot();

    // ----------------- JS LOGIC -----------------
    const $ = id => document.getElementById(id);
    const els = {
      overlay: $("overlay"), fabBtn: $("fabBtn"), statusBadge: $("statusBadge"),
      branchInput: $("branchInput"), saveBranchBtn: $("saveBranchBtn"),
      manualInput: $("manualInput"), lookupBtn: $("lookupBtn"),
      closeModal: $("closeModal"), toggleBtn: $("toggleViewBtn"),
      resultCard: $("resultCard"), resultRaw: $("resultRaw")
    };
    const state = { buffer: "", lastKeyTime: 0, lastStatus: null, lastData: null };

    function uuidv4(){ return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=(crypto.getRandomValues(new Uint8Array(1))[0])&15;const v=c==="x"?r:(r&0x3)|0x8;return v.toString(16);});}
    function getKioskId(){ const qp=new URLSearchParams(location.search); const u=(qp.get("kiosk")||qp.get("kid"))?.trim(); if(u){localStorage.setItem("gym.kioskId",u); return u;} let s=localStorage.getItem("gym.kioskId"); if(!s){s=uuidv4(); localStorage.setItem("gym.kioskId",s);} return s; }
    const KIOSK_ID = getKioskId();

    function getBranch(){ const qp=new URLSearchParams(location.search); const u=(qp.get("branch")||qp.get("b"))?.trim(); if(u){localStorage.setItem("gym.branch",u); return u;} return localStorage.getItem("gym.branch")||"Main"; }
    let CURRENT_BRANCH = getBranch();

    function parseJsonLoose(t){ const c=t.replace(/^\uFEFF/,"").replace(/[\u200B-\u200D\u2060]/g,"").trim(); return JSON.parse(c); }
    async function fetchJSON(url, options={}, timeoutMs=10000){
      const ctrl=new AbortController(); const timer=setTimeout(()=>ctrl.abort(new DOMException("Request timed out","TimeoutError")),timeoutMs);
      try{
        const resp=await fetch(url,{...options,signal:ctrl.signal}); const text=await resp.text();
        let json; try{ json=text?JSON.parse(text):{}; }catch{ try{ json=text?parseJsonLoose(text):{}; }catch{ json={raw:text}; } }
        if(!resp.ok) throw new Error(json?.message||`HTTP ${resp.status}`); return json;
      } finally { clearTimeout(timer); }
    }

    function showModal(){ els.overlay.classList.add("show"); els.branchInput.value=CURRENT_BRANCH; els.manualInput.value=els.manualInput.value||""; updateSaveDisabled(); updateCheckDisabled(); els.manualInput.focus(); }
    function hideModal(){ els.overlay.classList.remove("show"); }
    function updateCheckDisabled(){ els.lookupBtn.disabled = els.manualInput.value.trim() === ""; }
    function updateSaveDisabled(){ els.saveBranchBtn.disabled = els.branchInput.value.trim() === ""; }

    function renderResult(data){
      if (data && typeof data.raw === "string") { try { data = parseJsonLoose(data.raw); } catch {} }
      state.lastData = data;

      try { els.resultRaw.textContent = JSON.stringify(data, null, 2); }
      catch { els.resultRaw.textContent = String(data); }

      const sMap = {
        active:{text:"Active",color:"#16a34a"}, expired:{text:"Expired",color:"#d97706"},
        on_hold:{text:"On Hold",color:"#64748b"}, cancelled:{text:"Cancelled",color:"#dc2626"},
        not_found:{text:"Not Found",color:"#64748b"}, error:{text:"Error",color:"#dc2626"}
      };
      const statusKey = (data?.status || "").toLowerCase();
      const badge = sMap[statusKey] || sMap.error;
      state.lastStatus = badge;
      els.statusBadge.style.background = badge.color;

      const m = data?.member || {};
      const fmtDate = x => x ? new Date(x).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"2-digit"}) : "—";
      const fmtDT   = x => x ? new Date(x).toLocaleString() : "—";

      els.resultCard.innerHTML = `
        <div class="status"><span class="dot" style="background:${badge.color}"></span>${badge.text}</div>
        <div class="kv" style="margin-top:8px">
          <div class="k">Scanner Branch</div><div class="v">${CURRENT_BRANCH}</div>
          <div class="k">Scanner ID</div><div class="v">${localStorage.getItem("gym.kioskId") || KIOSK_ID}</div>
          <div class="k">Name</div><div class="v">${m.name ?? "—"}</div>
          <div class="k">Contact ID</div><div class="v">${m.contactId ?? "—"}</div>
          <div class="k">Card ID</div><div class="v">${m.cardId ?? "—"}</div>
          <div class="k">Plan</div><div class="v">${m.plan ?? "—"}</div>
          <div class="k">Start</div><div class="v">${fmtDate(m.startDate)}</div>
          <div class="k">Expiry</div><div class="v">${fmtDate(m.expiryDate)}</div>
          <div class="k">Payment</div><div class="v">${m.paymentStatus ?? "—"}</div>
          <div class="k">Last Check-in</div><div class="v">${fmtDT(m.lastCheckIn)}</div>
          <div class="k">Member Branch</div><div class="v">${m.branch ?? "—"}</div>
          ${data?.message ? `<div class="k">Message</div><div class="v">${data.message}</div>` : ""}
        </div>`;
      els.resultCard.style.display = ""; els.resultRaw.style.display = "none"; els.toggleBtn.textContent = "Show JSON";
    }

    async function lookup(cardId){
      if(!cardId) return;
      const mock = new URLSearchParams(location.search).get("mock");
      if (mock){
        const demo = { status:"active", member:{ name:"Jane Doe", contactId:"abc123", cardId:cardId||"NFC-8877", plan:"Gold Monthly", startDate:"2025-07-15", expiryDate:"2025-08-15", paymentStatus:"Paid", lastCheckIn:"2025-08-09T08:32:00Z", branch:"Downtown" }, message:"Welcome back, Jane!" };
        renderResult(demo); showModal(); state.buffer=""; updateCheckDisabled(); return;
      }
      try{
        const data = await fetchJSON(CONFIG.API_ENDPOINT, {
          method: CONFIG.API_METHOD,
          headers: CONFIG.API_HEADERS,
          body: JSON.stringify({
            cardId, tag: CONFIG.projectTag,
            branch: CURRENT_BRANCH,
            kioskId: localStorage.getItem("gym.kioskId") || KIOSK_ID,
            scannedAt: new Date().toISOString()
          })
        }, CONFIG.API_TIMEOUT_MS);
        renderResult(data); showModal();
      }catch(e){
        renderResult({ status:"error", message:e.message }); showModal();
      }finally{ state.buffer=""; updateCheckDisabled(); }
    }

    function saveBranch(){
      const next = els.branchInput.value.trim(); if(!next) return;
      CURRENT_BRANCH = next; localStorage.setItem("gym.branch", CURRENT_BRANCH);
      els.fabBtn.setAttribute("title", `Branch: ${CURRENT_BRANCH}`);
      els.statusBadge.setAttribute("title", `Branch: ${CURRENT_BRANCH}`);
      if(state.lastData) renderResult(state.lastData);
    }

    function isTypingInField(t){ if(!t) return false; const tag=(t.tagName||"").toLowerCase(); return tag==="input"||tag==="textarea"||t.isContentEditable; }
    function onKeyDown(e){
      const kb = CONFIG.keyboardScan;
      if(!kb.enabled) return;
      if(!kb.allowWhileTypingInInputs && isTypingInField(e.target)) return;
      const now = performance.now();
      if(now - state.lastKeyTime > kb.maxKeyIntervalMs) state.buffer="";
      state.lastKeyTime = now;
      if(e.key === kb.terminator){
        const code = state.buffer.trim(); state.buffer="";
        if(code.length >= kb.minLength){ e.preventDefault(); lookup(code); }
        return;
      }
      if(e.key.length===1) state.buffer += e.key;
    }

    function toggleView(){
      const rawVisible = getComputedStyle(els.resultRaw).display !== "none";
      const cardVisible = getComputedStyle(els.resultCard).display !== "none";
      if (rawVisible){ els.resultRaw.style.display="none"; els.resultCard.style.display=""; els.toggleBtn.textContent="Show JSON"; }
      else if (cardVisible){ els.resultCard.style.display="none"; els.resultRaw.style.display=""; els.toggleBtn.textContent="Show Card"; }
      else { els.resultRaw.style.display=""; els.resultCard.style.display="none"; els.toggleBtn.textContent="Show Card"; }
    }

    function bind(){
      window.addEventListener("keydown", onKeyDown, true);
      els.fabBtn.addEventListener("click", showModal);
      els.lookupBtn.addEventListener("click", ()=>lookup(els.manualInput.value.trim()));
      els.closeModal.addEventListener("click", hideModal);
      els.manualInput.addEventListener("input", updateCheckDisabled);
      els.branchInput.addEventListener("input", updateSaveDisabled);
      els.manualInput.addEventListener("keydown", e=>{ if(e.key==="Enter" && !els.lookupBtn.disabled){ e.preventDefault(); els.lookupBtn.click(); }});
      els.branchInput.addEventListener("keydown", e=>{ if(e.key==="Enter" && !els.saveBranchBtn.disabled){ e.preventDefault(); saveBranch(); }});
      els.saveBranchBtn.addEventListener("click", saveBranch);
      els.toggleBtn.addEventListener("click", toggleView);

      // Init tooltips & buttons
      els.fabBtn.setAttribute("title", `Branch: ${CURRENT_BRANCH}`);
      els.statusBadge.setAttribute("title", `Branch: ${CURRENT_BRANCH}`);
      updateCheckDisabled(); updateSaveDisabled();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
    else setTimeout(bind, 0);
  }

  // SPA-friendly: run the gate after DOM is ready; small delay helps when GHL updates URL
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(startIfAllowed, 50));
  } else {
    setTimeout(startIfAllowed, 50);
  }
})();
