const FLOOR_NAMES = ["B2", "B1", "1F", "2F", "3F", "4F", "5F"];
const STORAGE_KEY = "himma-building-checker-v6";

const defaultState = {
  settings: {
    reviewDate: new Date().toISOString().slice(0, 10),
    siteArea: 274.1,
    buildingArea: 0,
    defaultElevatorArea: 4.41,
    maxBcr: 60,
    maxFar: 250,
    targetParking: 6,
    parkingAreaPerSpace: 134
  },
  floors: FLOOR_NAMES.map((name) => ({
    name,
    grossArea: 0,
    evacuationArea: 0,
    hasElevator: true,
    elevatorArea: 4.41,
    includeFar: !name.startsWith("B")
  })),
  imageDataUrl: ""
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeSaveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn("프로젝트 저장 실패:", error);
    return false;
  }
}

let state = loadState();
let lastResult = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("himma-building-checker-v5");
    if (!raw) return deepClone(defaultState);
    const saved = JSON.parse(raw);
    return {
      settings: { ...defaultState.settings, ...(saved.settings || {}) },
      floors: FLOOR_NAMES.map((name, i) => ({ ...defaultState.floors[i], ...(saved.floors?.[i] || {}), name })),
      imageDataUrl: saved.imageDataUrl || ""
    };
  } catch {
    return deepClone(defaultState);
  }
}

const n = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const fmt = (value, digits = 2) => Number(value).toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const py = (sqm) => sqm / 3.305785;

function buildFloorCards() {
  document.getElementById("floorsContainer").innerHTML = state.floors.map((floor, index) => `
    <article class="floor-card" data-floor-index="${index}">
      <div class="floor-header">
        <h3>${floor.name}</h3>
        <label class="checkbox-label"><input type="checkbox" data-field="includeFar" ${floor.includeFar ? "checked" : ""}> 용적률 산입</label>
      </div>
      <div class="floor-grid">
        ${numberField("전체 바닥면적", "grossArea", floor.grossArea, "㎡")}
        ${numberField("피난동선 면적", "evacuationArea", floor.evacuationArea, "㎡")}
        <label class="field"><span>엘리베이터</span><span class="input-line elevator-input"><input type="checkbox" data-field="hasElevator" ${floor.hasElevator ? "checked" : ""}><input type="number" min="0" step="any" data-field="elevatorArea" value="${floor.elevatorArea}"><em>㎡</em></span></label>
      </div>
    </article>`).join("");
}

function numberField(label, field, value, unit) {
  return `<label class="field"><span>${label}</span><span class="input-line"><input type="number" min="0" step="any" data-field="${field}" value="${value}"><em>${unit}</em></span></label>`;
}

function syncInputs() {
  Object.entries(state.settings).forEach(([key, value]) => {
    const el = document.getElementById(key);
    if (el) el.value = value;
  });
  updateImagePreview();
}

function readInputs() {
  ["siteArea", "buildingArea", "defaultElevatorArea", "maxBcr", "maxFar", "targetParking", "parkingAreaPerSpace"].forEach((id) => {
    state.settings[id] = n(document.getElementById(id).value);
  });
  state.settings.reviewDate = document.getElementById("reviewDate").value || new Date().toISOString().slice(0, 10);
  document.querySelectorAll(".floor-card").forEach((card) => {
    const floor = state.floors[Number(card.dataset.floorIndex)];
    card.querySelectorAll("[data-field]").forEach((input) => {
      floor[input.dataset.field] = input.type === "checkbox" ? input.checked : n(input.value);
    });
  });
}

function calculateFloor(floor) {
  const grossArea = n(floor.grossArea);
  const elevatorArea = floor.hasElevator ? n(floor.elevatorArea) : 0;
  const evacuationArea = n(floor.evacuationArea);
  const elevatorExcluded = Math.max(0, grossArea - elevatorArea);
  const netArea = Math.max(0, elevatorExcluded - evacuationArea);
  return { ...floor, grossArea, elevatorArea, evacuationArea, elevatorExcluded, netArea };
}

function performReview({ scroll = true } = {}) {
  readInputs();
  const { siteArea, buildingArea, maxBcr, maxFar, targetParking, parkingAreaPerSpace } = state.settings;
  if (siteArea <= 0) return focusError("siteArea", "대지면적은 0보다 큰 값이어야 합니다.");
  if (parkingAreaPerSpace <= 0) return focusError("parkingAreaPerSpace", "주차 기준면적은 0보다 큰 값이어야 합니다.");

  const floors = state.floors.map(calculateFloor);
  const bcr = buildingArea / siteArea * 100;
  const permittedBuildingArea = siteArea * maxBcr / 100;
  const farArea = floors.filter(f => f.includeFar).reduce((sum, f) => sum + f.elevatorExcluded, 0);
  const far = farArea / siteArea * 100;
  const permittedFarArea = siteArea * maxFar / 100;
  const totalParkingArea = floors.reduce((sum, f) => sum + f.elevatorExcluded, 0);
  const parkingRaw = totalParkingArea / parkingAreaPerSpace;
  const requiredParking = Math.ceil(parkingRaw - 1e-10);
  const parkingRemainingSpaces = targetParking - parkingRaw;
  const parkingRemainingArea = parkingRemainingSpaces * parkingAreaPerSpace;

  lastResult = {
    floors, buildingArea, bcr,
    remainingBuildingArea: permittedBuildingArea - buildingArea,
    farArea, far, remainingFarArea: permittedFarArea - farArea,
    totalParkingArea, parkingRaw, requiredParking,
    parkingRemainingSpaces, parkingRemainingArea
  };

  renderSummary(lastResult);
  renderFloorResults(floors);
  renderPrintReport(lastResult);
  document.getElementById("resultsSection").classList.remove("is-hidden");
  document.getElementById("pdfButton").disabled = false;
  document.getElementById("reviewedAt").textContent = `검토 날짜: ${formatDate(state.settings.reviewDate)}`;
  safeSaveState();
  if (scroll) document.getElementById("resultsSection").scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

function focusError(id, message) {
  alert(message);
  document.getElementById(id).focus();
  return false;
}

function renderSummary(r) {
  const status = (ok) => ok ? "status-pass" : "status-fail";
  const cards = [
    ["계획 건폐율", `${fmt(r.bcr)}%`, `건축면적 ${fmt(r.buildingArea)}㎡`, status(r.bcr <= state.settings.maxBcr)],
    ["건폐율 여유면적", `${fmt(r.remainingBuildingArea)}㎡`, r.remainingBuildingArea >= 0 ? "허용 기준까지 남은 면적" : "허용 기준 초과", status(r.remainingBuildingArea >= 0)],
    ["계획 용적률", `${fmt(r.far)}%`, `산입면적 ${fmt(r.farArea)}㎡`, status(r.far <= state.settings.maxFar)],
    ["용적률 추가 가능면적", `${fmt(r.remainingFarArea)}㎡`, r.remainingFarArea >= 0 ? "허용 기준까지 남은 면적" : "허용 기준 초과", status(r.remainingFarArea >= 0)],
    ["현재 주차지수", `${fmt(r.parkingRaw, 3)}대`, `총 산정면적 ${fmt(r.totalParkingArea)}㎡`, status(r.requiredParking <= state.settings.targetParking)],
    ["예상 법정 주차대수", `${r.requiredParking}대`, `목표 ${fmt(state.settings.targetParking, 0)}대`, status(r.requiredParking <= state.settings.targetParking)],
    ["주차대수 여유 면적", `${fmt(r.parkingRemainingArea)}㎡`, `${fmt(r.parkingRemainingSpaces, 3)}대 여유`, status(r.parkingRemainingArea >= 0)]
  ];
  document.getElementById("summaryCards").innerHTML = cards.map(c => `<article class="summary-card ${c[3]}"><span>${c[0]}</span><strong>${c[1]}</strong><small>${c[2]}</small></article>`).join("");
}

function renderFloorResults(floors) {
  document.getElementById("floorResultsBody").innerHTML = floors.map(f => `<tr><td><strong>${f.name}</strong></td>${areaCell(f.grossArea)}${areaCell(f.elevatorExcluded)}${areaCell(f.netArea)}</tr>`).join("");
}
function areaCell(sqm) { return `<td><strong>${fmt(sqm)}㎡</strong><small>${fmt(py(sqm))}평</small></td>`; }

function renderPrintReport(r) {
  document.getElementById("printDate").textContent = formatDate(state.settings.reviewDate);
  const metrics = [
    ["대지면적", `${fmt(state.settings.siteArea)}㎡`],
    ["기본 엘리베이터", `${fmt(state.settings.defaultElevatorArea)}㎡`],
    ["건폐율", `${fmt(r.bcr)}%`],
    ["용적률", `${fmt(r.far)}%`],
    ["주차대수", `${fmt(r.parkingRaw, 2)}대 (${r.requiredParking}대)`],
    ["주차 여유 면적", `${fmt(r.parkingRemainingArea)}㎡`]
  ];
  document.getElementById("printMetrics").innerHTML = metrics.map(([k,v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join("");
  document.getElementById("printFloorRows").innerHTML = r.floors.map(f => `<div class="print-floor-row"><strong>${f.name}</strong><span>${fmt(f.grossArea)}㎡</span><span>${fmt(f.elevatorExcluded)}㎡</span><span>${fmt(f.netArea)}㎡</span></div>`).join("");
  document.getElementById("printCalculation").innerHTML = `
    <div><span>용적률 산입면적</span><strong>${fmt(r.farArea)}㎡</strong></div>
    <div><span>주차 산정 총면적</span><strong>${fmt(r.totalParkingArea)}㎡</strong></div>
    <div><span>주차 산정</span><strong>${fmt(r.totalParkingArea)} ÷ ${fmt(state.settings.parkingAreaPerSpace)} = ${fmt(r.parkingRaw, 3)}대</strong></div>`;
  const printImage = document.getElementById("printImage");
  const placeholder = document.getElementById("printImagePlaceholder");
  if (state.imageDataUrl) { printImage.src = state.imageDataUrl; printImage.style.display = "block"; placeholder.style.display = "none"; }
  else { printImage.removeAttribute("src"); printImage.style.display = "none"; placeholder.style.display = "grid"; }
}

function formatDate(value) {
  if (!value) return "";
  const [y,m,d] = value.split("-");
  return `${y}. ${Number(m)}. ${Number(d)}.`;
}

function updateImagePreview() {
  const wrap = document.getElementById("imagePreviewWrap");
  const img = document.getElementById("imagePreview");
  if (state.imageDataUrl) { img.src = state.imageDataUrl; wrap.classList.remove("is-empty"); }
  else { img.removeAttribute("src"); wrap.classList.add("is-empty"); }
}

function handleImage(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) return alert("이미지 파일을 선택해 주세요.");
  if (file.size > 12 * 1024 * 1024) return alert("이미지는 12MB 이하로 선택해 주세요.");
  const reader = new FileReader();
  reader.onload = () => { state.imageDataUrl = reader.result; updateImagePreview(); safeSaveState(); };
  reader.readAsDataURL(file);
}

function saveProject() { readInputs(); const saved = safeSaveState(); alert(saved ? "현재 입력값을 저장했습니다." : "입력값은 유지되지만, 첨부 이미지 용량 때문에 브라우저 저장에 실패했습니다."); }
function resetProject() {
  if (!confirm("모든 입력값과 첨부 이미지를 초기화할까요?")) return;
  state = deepClone(defaultState); lastResult = null; localStorage.removeItem(STORAGE_KEY);
  buildFloorCards(); syncInputs(); document.getElementById("resultsSection").classList.add("is-hidden"); document.getElementById("pdfButton").disabled = true;
}
function printPdf() { if (performReview({ scroll: false })) setTimeout(() => window.print(), 120); }

function initialize() {
  buildFloorCards();
  syncInputs();

  const reviewButton = document.getElementById("reviewButton");
  const pdfButton = document.getElementById("pdfButton");
  reviewButton.addEventListener("click", () => performReview());
  pdfButton.disabled = false;
  pdfButton.addEventListener("click", printPdf);
  document.getElementById("saveButton").addEventListener("click", saveProject);
  document.getElementById("resetButton").addEventListener("click", resetProject);
  document.getElementById("projectImage").addEventListener("change", e => handleImage(e.target.files[0]));
  document.getElementById("removeImageButton").addEventListener("click", () => {
    state.imageDataUrl = "";
    document.getElementById("projectImage").value = "";
    updateImagePreview();
    safeSaveState();
  });
  document.getElementById("defaultElevatorArea").addEventListener("change", (e) => {
    readInputs();
    const value = n(e.target.value);
    state.floors.forEach(f => { if (f.hasElevator) f.elevatorArea = value; });
    buildFloorCards();
  });
}

try {
  initialize();
} catch (error) {
  console.error("검토기 초기화 오류:", error);
  alert("페이지 기능을 불러오는 중 오류가 발생했습니다. 새로고침 후 다시 시도해 주세요.");
}
