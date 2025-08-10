// ---------- Config ----------
const CONFIG = {
  API_ENDPOINT: "https://hook.us2.make.com/blek3nrd1y6aohwerlrmgzb9voymbdnk", // your Make webhook
  API_METHOD: "POST",
  API_HEADERS: { "Content-Type": "application/json" },
  API_TIMEOUT_MS: 10000,
  projectTag: "GHL-Gym-NFC",
  keyboardScan: {
    enabled: true,
    minLength: 6,
    terminator: "Enter",
    maxKeyIntervalMs: 35,
    allowWhileTypingInInputs: false,
  },
  ui: {
    success: "#16a34a", warning: "#d97706", danger: "#dc2626", neutral: "#64748b"
  }
};

// ---------- Helpers ----------
function parseJsonLoose(text){
  const clean = text
    .replace(/^\uFEFF/, "")            // BOM
    .replace(/[\u200B-\u200D\u2060]/g,"") // zero-width
    .trim();
  return JSON.parse(clean);
}

async function fetchJSON(url, options = {}, timeoutMs = 10000){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new DOMException("Request timed out","TimeoutError")), timeoutMs);
  try{
    const resp = await fetch(url, { ...options, signal: ctrl.signal });
    const text = await resp.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; }
    catch {
      try { json = text ? parseJsonLoose(text) : {}; }
      catch { json = { raw: text }; }
    }
    if(!resp.ok) throw new Error(json?.message || `HTTP ${resp.status}`);
    return json;
  } finally { clearTimeout(t); }
}

const els = {
  overlay: document.getElementById("overlay"),
  fabBtn: document.getElementById("fabBtn"),
  statusBadge: document.getElementById("statusBadge"),
  manualInput: document.getElementById("manualInput"),
  lookupBtn: document.getElementById("lookupBtn"),
  closeModal: document.getElementById("closeModal"),
  toggleBtn: document.getElementById("toggleViewBtn"),
  resultCard: document.getElementById("resultCard"),
  resultRaw: document.getElementById("resultRaw"),
};

const state = { buffer:"", lastKeyTime:0, lastStatus:null };

function showModal(){ els.overlay.classList.add("show"); els.manualInput.focus(); }
function hideModal(){ els.overlay.classList.remove("show"); }

// ---------- Rendering ----------
function renderResult(data){
  // If Make returned plain text
  if (data && typeof data.raw === "string") {
    try { data = parseJsonLoose(data.raw); } catch {}
  }

  // Raw JSON
  try { els.resultRaw.textContent = JSON.stringify(data, null, 2); }
  catch { els.resultRaw.textContent = String(data); }

  // Card view
  const sMap = {
    active:    { text: "Active",    color: CONFIG.ui.success },
    expired:   { text: "Expired",   color: CONFIG.ui.warning },
    on_hold:   { text: "On Hold",   color: CONFIG.ui.neutral },
    cancelled: { text: "Cancelled", color: CONFIG.ui.danger },
    not_found: { text: "Not Found", color: CONFIG.ui.neutral },
    error:     { text: "Error",     color: CONFIG.ui.danger },
  };

  const statusKey = (data?.status || "").toLowerCase();
  const badge = sMap[statusKey] || sMap.error;
  state.lastStatus = badge;

  // Update FAB badge color to reflect last result
  if (els.statusBadge) els.statusBadge.style.background = badge.color;

  const m = data?.member || {};
  const fmtDate = x => x ? new Date(x).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"2-digit"}) : "—";
  const fmtDT   = x => x ? new Date(x).toLocaleString() : "—";

  els.resultCard.innerHTML = `
    <div class="status"><span class="dot" style="background:${badge.color}"></span>${badge.text}</div>
    <div class="kv">
      <div class="k">Name</div><div class="v">${m.name ?? "—"}</div>
      <div class="k">Contact ID</div><div class="v">${m.contactId ?? "—"}</div>
      <div class="k">Card ID</div><div class="v">${m.cardId ?? "—"}</div>
      <div class="k">Plan</div><div class="v">${m.plan ?? "—"}</div>
      <div class="k">Start</div><div class="v">${fmtDate(m.startDate)}</div>
      <div class="k">Expiry</div><div class="v">${fmtDate(m.expiryDate)}</div>
      <div class="k">Payment</div><div class="v">${m.paymentStatus ?? "—"}</div>
      <div class="k">Last Check-in</div><div class="v">${fmtDT(m.lastCheckIn)}</div>
      <div class="k">Branch</div><div class="v">${m.branch ?? "—"}</div>
      ${data?.message ? `<div class="k">Message</div><div class="v">${data.message}</div>` : ""}
    </div>
  `;

  // Always show card view on success
  els.resultCard.style.display = "";
  els.resultRaw.style.display = "none";
  els.toggleBtn.textContent = "Show JSON";
}

// ---------- Actions ----------
async function lookup(cardId){
  if(!cardId) return;
  try{
    const data = await fetchJSON(
      CONFIG.API_ENDPOINT,
      {
        method: CONFIG.API_METHOD,
        headers: CONFIG.API_HEADERS,
        body: JSON.stringify({ cardId, tag: CONFIG.projectTag })
      },
      CONFIG.API_TIMEOUT_MS
    );
    renderResult(data);
    showModal();
  }catch(e){
    renderResult({ status:"error", message: e.message });
    showModal();
  }finally{
    state.buffer = "";
  }
}

// ---------- Keyboard scanner ----------
function isTypingInField(target){
  if(!target) return false;
  const tag = (target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea") return true;
  if (target.isContentEditable) return true;
  return false;
}
function onKeyDown(e){
  if (!CONFIG.keyboardScan.enabled) return;
  if (!CONFIG.keyboardScan.allowWhileTypingInInputs && isTypingInField(e.target)) return;

  const now = performance.now();
  if (now - state.lastKeyTime > CONFIG.keyboardScan.maxKeyIntervalMs) state.buffer = "";
  state.lastKeyTime = now;

  if (e.key === CONFIG.keyboardScan.terminator){
    const code = state.buffer.trim();
    state.buffer = "";
    if (code.length >= CONFIG.keyboardScan.minLength){
      e.preventDefault();
      lookup(code);
    }
    return;
  }
  if (e.key.length === 1) state.buffer += e.key;
}

// ---------- Listeners ----------
window.addEventListener("keydown", onKeyDown, true);
els.fabBtn.addEventListener("click", showModal);
els.lookupBtn.addEventListener("click", () => lookup(els.manualInput.value.trim()));
els.closeModal.addEventListener("click", hideModal);
els.manualInput.addEventListener("keydown", (e)=>{ if(e.key==="Enter"){ e.preventDefault(); els.lookupBtn.click(); }});
els.toggleBtn.addEventListener("click", ()=>{
  const showingRaw = els.resultRaw.style.display !== "none";
  els.resultRaw.style.display = showingRaw ? "none" : "";
  els.resultCard.style.display = showingRaw ? "" : "none";
  els.toggleBtn.textContent = showingRaw ? "Show JSON" : "Show Card";
});
