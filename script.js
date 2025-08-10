/***** CONFIG *****/
const CONFIG = {
  API_ENDPOINT: "https://hook.us2.make.com/blek3nrd1y6aohwerlrmgzb9voymbdnk",
  API_METHOD: "POST",
  API_HEADERS: { "Content-Type": "application/json" },
  API_TIMEOUT_MS: 10000,
  projectTag: "GHL-Gym-NFC",
  keyboardScan: { enabled: true, minLength: 6, terminator: "Enter", maxKeyIntervalMs: 35, allowWhileTypingInInputs: false },
  ui: { success: "#16a34a", warning: "#d97706", danger: "#dc2626", neutral: "#64748b" }
};

/***** ELEMENTS *****/
const els = {
  overlay: document.getElementById("overlay"),
  fabBtn: document.getElementById("fabBtn"),
  statusBadge: document.getElementById("statusBadge"),
  branchInput: document.getElementById("branchInput"),
  saveBranchBtn: document.getElementById("saveBranchBtn"),
  manualInput: document.getElementById("manualInput"),
  lookupBtn: document.getElementById("lookupBtn"),
  closeModal: document.getElementById("closeModal"),
  toggleBtn: document.getElementById("toggleViewBtn"),
  resultCard: document.getElementById("resultCard"),
  resultRaw: document.getElementById("resultRaw"),
};

const state = { buffer:"", lastKeyTime:0, lastStatus:null, lastData:null };

/***** KIOSK ID (stable per device) *****/
function uuidv4(){
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
function getKioskId(){
  const qp = new URLSearchParams(location.search);
  const fromUrl = (qp.get('kiosk') || qp.get('kid'))?.trim();
  if (fromUrl){ localStorage.setItem('gym.kioskId', fromUrl); return fromUrl; }
  let stored = localStorage.getItem('gym.kioskId');
  if (!stored){ stored = uuidv4(); localStorage.setItem('gym.kioskId', stored); }
  return stored;
}
const KIOSK_ID = getKioskId();

/***** BRANCH (per device) *****/
function getBranch(){
  const qp = new URLSearchParams(location.search);
  const fromUrl = (qp.get('branch') || qp.get('b'))?.trim();
  if (fromUrl){ localStorage.setItem('gym.branch', fromUrl); return fromUrl; }
  return localStorage.getItem('gym.branch') || 'Main';
}
let CURRENT_BRANCH = getBranch();
els.fabBtn.setAttribute("title", `Branch: ${CURRENT_BRANCH}`);
els.statusBadge.setAttribute("title", `Branch: ${CURRENT_BRANCH}`);

/***** HELPERS *****/
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

/***** UI STATE *****/
function showModal(){
  els.overlay.classList.add("show");
  els.branchInput.value = CURRENT_BRANCH;
  els.manualInput.value = els.manualInput.value || "";
  updateSaveDisabled();
  updateCheckDisabled();
  els.manualInput.focus();
}
function hideModal(){ els.overlay.classList.remove("show"); }

/***** BUTTON ENABLE/DISABLE *****/
function updateCheckDisabled(){
  els.lookupBtn.disabled = els.manualInput.value.trim() === "";
}
function updateSaveDisabled(){
  els.saveBranchBtn.disabled = els.branchInput.value.trim() === "";
}

/***** RENDER RESULT *****/
function renderResult(data){
  // handle raw string payloads from Make
  if (data && typeof data.raw === "string") {
    try { data = parseJsonLoose(data.raw); } catch {}
  }
  state.lastData = data;

  // Raw JSON pretty
  try { els.resultRaw.textContent = JSON.stringify(data, null, 2); }
  catch { els.resultRaw.textContent = String(data); }

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
  els.statusBadge.style.background = badge.color;

  const m = data?.member || {};
  const fmtDate = x => x ? new Date(x).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"2-digit"}) : "—";
  const fmtDT   = x => x ? new Date(x).toLocaleString() : "—";

  els.resultCard.innerHTML = `
    <div class="status"><span class="dot" style="background:${badge.color}"></span>${badge.text}</div>
    <div class="kv" style="margin-top:8px">
      <div class="k">Scanner Branch</div><div class="v">${CURRENT_BRANCH}</div>
      <div class="k">Scanner ID</div><div class="v">${localStorage.getItem('gym.kioskId') || KIOSK_ID}</div>

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
    </div>
  `;

  // Auto-show card view on success
  els.resultCard.style.display = "";
  els.resultRaw.style.display = "none";
  els.toggleBtn.textContent = "Show JSON";
}

/***** ACTIONS *****/
async function lookup(cardId){
  if(!cardId) return;
  try{
    const data = await fetchJSON(
      CONFIG.API_ENDPOINT,
      {
        method: CONFIG.API_METHOD,
        headers: CONFIG.API_HEADERS,
        body: JSON.stringify({
          cardId,
          tag: CONFIG.projectTag,
          branch: CURRENT_BRANCH,
          kioskId: localStorage.getItem('gym.kioskId') || KIOSK_ID,
          scannedAt: new Date().toISOString()
        })
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
    updateCheckDisabled();
  }
}

function saveBranch(){
  const next = els.branchInput.value.trim();
  if (!next) return;
  CURRENT_BRANCH = next;
  localStorage.setItem("gym.branch", CURRENT_BRANCH);
  // Update tooltips
  els.fabBtn.setAttribute("title", `Branch: ${CURRENT_BRANCH}`);
  els.statusBadge.setAttribute("title", `Branch: ${CURRENT_BRANCH}`);
  // If a result is already visible, re-render to show the new branch
  if (state.lastData) renderResult(state.lastData);
}

/***** KEYBOARD SCANNER *****/
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

/***** TOGGLE VIEW (fixed to use computed styles) *****/
function toggleView() {
  const rawVisible  = getComputedStyle(els.resultRaw).display !== "none";
  const cardVisible = getComputedStyle(els.resultCard).display !== "none";

  if (rawVisible) {
    els.resultRaw.style.display  = "none";
    els.resultCard.style.display = "";
    els.toggleBtn.textContent = "Show JSON";
  } else if (cardVisible) {
    els.resultCard.style.display = "none";
    els.resultRaw.style.display  = "";
    els.toggleBtn.textContent = "Show Card";
  } else {
    // If both hidden (initial edge case), show JSON
    els.resultRaw.style.display  = "";
    els.resultCard.style.display = "none";
    els.toggleBtn.textContent = "Show Card";
  }
}

/***** LISTENERS *****/
window.addEventListener("keydown", onKeyDown, true);
els.fabBtn.addEventListener("click", showModal);
els.lookupBtn.addEventListener("click", () => lookup(els.manualInput.value.trim()));
els.closeModal.addEventListener("click", hideModal);
els.manualInput.addEventListener("input", updateCheckDisabled);
els.branchInput.addEventListener("input", updateSaveDisabled);
els.manualInput.addEventListener("keydown", (e)=>{ if(e.key==="Enter" && !els.lookupBtn.disabled){ e.preventDefault(); els.lookupBtn.click(); }});
els.branchInput.addEventListener("keydown", (e)=>{ if(e.key==="Enter" && !els.saveBranchBtn.disabled){ e.preventDefault(); saveBranch(); }});
els.saveBranchBtn.addEventListener("click", saveBranch);
els.toggleBtn.addEventListener("click", toggleView);

// Initialize disabled states on load
updateCheckDisabled();
updateSaveDisabled();
