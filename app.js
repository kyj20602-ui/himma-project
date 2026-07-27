const FLOOR_NAMES = ["B2", "B1", "1F", "2F", "3F", "4F", "5F"];

const USES = [
  { id: "cafe", label: "카페" },
  { id: "office", label: "사무소" },
  { id: "neighborhood", label: "근린생활" },
  { id: "assembly", label: "문화·집회" },
  { id: "residential", label: "주거" },
  { id: "parking", label: "주차장" },
  { id: "other", label: "기타" }
];

const STORAGE_KEY = "himma-building-checker-v3";

const defaultState = {
  settings: {
    siteArea: 274.1,
    defaultElevatorArea: 4.41,
    maxBcr: 60,
    maxFar: 250,
    targetParking: 6
  },
  floors: FLOOR_NAMES.map((name) => ({
    name,
    grossArea: 0,
    evacuationArea: 0,
    hasElevator: true,
    elevatorArea: 4.41,
    includeFar: !name.startsWith("B"),
    includeParking: true,
    use: name === "B2" ? "cafe" : "other",
    parkingAreaManual: "",
  })),
  parkingRules: {
    cafe: 100,
    office: 100,
    neighborhood: 100,
    assembly: 100,
    residential: 100,
    parking: 0,
    other: 100
  }
};

let state = loadState() || structuredClone(defaultState);

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampNonNegative(value) {
  return Math.max(0, numberValue(value));
}

function formatNumber(value, digits = 2) {
  return Number(value).toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function sqmToPyeong(sqm) {
  return sqm / 3.305785;
}

function buildFloorCards() {
  const container = document.getElementById("floorsContainer");
  container.innerHTML = state.floors.map((floor, index) => `
    <article class="floor-card" data-floor-index="${index}">
      <div class="floor-header">
        <h3>${floor.name}</h3>
        <div class="floor-toggles">
          <label class="checkbox-label">
            <input type="checkbox" data-field="includeFar" ${floor.includeFar ? "checked" : ""}>
            용적률 산입
          </label>
          <label class="checkbox-label">
            <input type="checkbox" data-field="includeParking" ${floor.includeParking ? "checked" : ""}>
            주차 산정
          </label>
        </div>
      </div>

      <div class="floor-grid">
        ${numberField("전체 바닥면적", "grossArea", floor.grossArea, "㎡")}
        ${numberField("피난동선 면적", "evacuationArea", floor.evacuationArea, "㎡")}

        <label class="field">
          <span>엘리베이터</span>
          <span class="input-line">
            <span style="display:flex;align-items:center;gap:8px;min-width:0;">
              <input type="checkbox" data-field="hasElevator" ${floor.hasElevator ? "checked" : ""}>
              <input type="number" min="0" step="any" inputmode="decimal"
                data-field="elevatorArea" value="${floor.elevatorArea}">
            </span>
            <em>㎡</em>
          </span>
        </label>

        ${numberField("주차 산정면적", "parkingAreaManual", floor.parkingAreaManual, "㎡", "비워두면 자동 계산")}
      </div>

      <div class="use-tabs" role="group" aria-label="${floor.name} 주차 산정용도">
        ${USES.map((use) => `
          <button type="button"
            class="use-tab ${floor.use === use.id ? "is-active" : ""}"
            data-use="${use.id}">
            ${use.label}
          </button>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function numberField(label, field, value, unit, placeholder = "") {
  return `
    <label class="field">
      <span>${label}</span>
      <span class="input-line">
        <input type="number" min="0" step="any" inputmode="decimal"
          data-field="${field}" value="${value}" placeholder="${placeholder}">
        <em>${unit}</em>
      </span>
    </label>
  `;
}

function buildParkingRules() {
  const container = document.getElementById("parkingRulesContainer");
  container.innerHTML = USES.filter((use) => use.id !== "parking").map((use) => `
    <label class="rule-card">
      <strong>${use.label}</strong>
      <span class="input-line">
        <input type="number" min="0" step="any" inputmode="decimal"
          data-rule="${use.id}" value="${state.parkingRules[use.id]}">
        <em>㎡/대</em>
      </span>
    </label>
  `).join("");
}

function syncSettingsToInputs() {
  Object.entries(state.settings).forEach(([key, value]) => {
    const element = document.getElementById(key);
    if (element) element.value = value;
  });
}

function readAllInputs() {
  state.settings.siteArea = clampNonNegative(document.getElementById("siteArea").value);
  state.settings.defaultElevatorArea = clampNonNegative(document.getElementById("defaultElevatorArea").value);
  state.settings.maxBcr = clampNonNegative(document.getElementById("maxBcr").value);
  state.settings.maxFar = clampNonNegative(document.getElementById("maxFar").value);
  state.settings.targetParking = clampNonNegative(document.getElementById("targetParking").value);

  document.querySelectorAll(".floor-card").forEach((card) => {
    const index = Number(card.dataset.floorIndex);
    const floor = state.floors[index];

    card.querySelectorAll("[data-field]").forEach((input) => {
      const field = input.dataset.field;
      if (input.type === "checkbox") {
        floor[field] = input.checked;
      } else if (field === "parkingAreaManual") {
        floor[field] = input.value.trim();
      } else {
        floor[field] = clampNonNegative(input.value);
      }
    });

    const activeUse = card.querySelector(".use-tab.is-active");
    if (activeUse) floor.use = activeUse.dataset.use;
  });

  document.querySelectorAll("[data-rule]").forEach((input) => {
    state.parkingRules[input.dataset.rule] = clampNonNegative(input.value);
  });
}

function calculateFloor(floor) {
  const grossArea = clampNonNegative(floor.grossArea);
  const elevatorArea = floor.hasElevator ? clampNonNegative(floor.elevatorArea) : 0;
  const evacuationArea = clampNonNegative(floor.evacuationArea);

  const elevatorExcluded = Math.max(0, grossArea - elevatorArea);
  const netArea = Math.max(0, grossArea - elevatorArea - evacuationArea);

  const hasManualParkingArea = String(floor.parkingAreaManual).trim() !== "";
  const parkingArea = floor.includeParking
    ? (hasManualParkingArea ? clampNonNegative(floor.parkingAreaManual) : netArea)
    : 0;

  const rule = clampNonNegative(state.parkingRules[floor.use]);
  const parkingIndex = floor.includeParking && rule > 0 ? parkingArea / rule : 0;

  return {
    ...floor,
    grossArea,
    elevatorArea,
    evacuationArea,
    elevatorExcluded,
    netArea,
    parkingArea,
    parkingIndex
  };
}

function performReview() {
  readAllInputs();

  const siteArea = state.settings.siteArea;
  if (siteArea <= 0) {
    alert("대지면적은 0보다 큰 값으로 입력해 주세요.");
    document.getElementById("siteArea").focus();
    return;
  }

  const calculatedFloors = state.floors.map(calculateFloor);

  const buildingAreaFloor = calculatedFloors.find((floor) => floor.name === "1F");
  const buildingArea = buildingAreaFloor ? buildingAreaFloor.grossArea : 0;
  const bcr = siteArea > 0 ? buildingArea / siteArea * 100 : 0;
  const permittedBuildingArea = siteArea * state.settings.maxBcr / 100;
  const remainingBuildingArea = permittedBuildingArea - buildingArea;

  const farArea = calculatedFloors
    .filter((floor) => floor.includeFar)
    .reduce((sum, floor) => sum + floor.grossArea, 0);
  const far = siteArea > 0 ? farArea / siteArea * 100 : 0;
  const permittedFarArea = siteArea * state.settings.maxFar / 100;
  const remainingFarArea = permittedFarArea - farArea;

  const parkingRaw = calculatedFloors.reduce((sum, floor) => sum + floor.parkingIndex, 0);
  const requiredParking = Math.ceil(parkingRaw - 1e-10);
  const parkingRemainingRaw = Math.max(0, state.settings.targetParking - parkingRaw);

  renderSummary({
    buildingArea,
    bcr,
    remainingBuildingArea,
    farArea,
    far,
    remainingFarArea,
    parkingRaw,
    requiredParking
  });

  renderFloorResults(calculatedFloors);
  renderParkingMargins(parkingRemainingRaw);

  const resultsSection = document.getElementById("resultsSection");
  resultsSection.classList.remove("is-hidden");
  document.getElementById("reviewedAt").textContent =
    `검토 시각: ${new Date().toLocaleString("ko-KR")}`;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderSummary(result) {
  const bcrStatus = result.bcr <= state.settings.maxBcr ? "status-pass" : "status-fail";
  const farStatus = result.far <= state.settings.maxFar ? "status-pass" : "status-fail";
  const parkingStatus = result.requiredParking <= state.settings.targetParking ? "status-pass" : "status-fail";

  const cards = [
    {
      title: "계획 건폐율",
      value: `${formatNumber(result.bcr)}%`,
      note: `허용 ${formatNumber(state.settings.maxBcr)}% · 건축면적 ${formatNumber(result.buildingArea)}㎡`,
      status: bcrStatus
    },
    {
      title: "건폐율 여유면적",
      value: `${formatNumber(result.remainingBuildingArea)}㎡`,
      note: result.remainingBuildingArea >= 0 ? "허용 건축면적까지 남은 값" : "허용 기준 초과",
      status: result.remainingBuildingArea >= 0 ? "status-pass" : "status-fail"
    },
    {
      title: "계획 용적률",
      value: `${formatNumber(result.far)}%`,
      note: `허용 ${formatNumber(state.settings.maxFar)}% · 산입면적 ${formatNumber(result.farArea)}㎡`,
      status: farStatus
    },
    {
      title: "용적률 추가 가능면적",
      value: `${formatNumber(result.remainingFarArea)}㎡`,
      note: result.remainingFarArea >= 0 ? "허용 용적률까지 남은 값" : "허용 기준 초과",
      status: result.remainingFarArea >= 0 ? "status-pass" : "status-fail"
    },
    {
      title: "현재 주차지수",
      value: `${formatNumber(result.parkingRaw, 3)}대`,
      note: "용도별 산정값 합계",
      status: parkingStatus
    },
    {
      title: "예상 법정 주차대수",
      value: `${result.requiredParking}대`,
      note: `목표 ${formatNumber(state.settings.targetParking, 0)}대`,
      status: parkingStatus
    },
    {
      title: "목표 충족 여부",
      value: result.requiredParking <= state.settings.targetParking ? "충족" : "초과",
      note: result.requiredParking <= state.settings.targetParking
        ? "입력된 기준상 목표 주차대수 이내"
        : `${result.requiredParking - state.settings.targetParking}대 초과`,
      status: parkingStatus
    }
  ];

  document.getElementById("summaryCards").innerHTML = cards.map((card) => `
    <article class="summary-card ${card.status}">
      <span>${card.title}</span>
      <strong>${card.value}</strong>
      <small>${card.note}</small>
    </article>
  `).join("");
}

function renderFloorResults(floors) {
  document.getElementById("floorResultsBody").innerHTML = floors.map((floor) => `
    <tr>
      <td>
        <strong>${floor.name}</strong>
        <small>${USES.find((use) => use.id === floor.use)?.label || floor.use}</small>
      </td>
      ${areaCell(floor.grossArea)}
      ${areaCell(floor.elevatorExcluded)}
      ${areaCell(floor.netArea)}
      ${areaCell(floor.parkingArea)}
      <td>
        <strong>${formatNumber(floor.parkingIndex, 3)}대</strong>
        <small>${floor.includeParking ? "주차 산정 포함" : "주차 산정 제외"}</small>
      </td>
    </tr>
  `).join("");
}

function areaCell(sqm) {
  return `
    <td>
      <strong>${formatNumber(sqm)}㎡</strong>
      <small>${formatNumber(sqmToPyeong(sqm))}평</small>
    </td>
  `;
}

function renderParkingMargins(parkingRemainingRaw) {
  const uses = USES.filter((use) => !["parking"].includes(use.id));
  document.getElementById("parkingMarginGrid").innerHTML = uses.map((use) => {
    const rule = clampNonNegative(state.parkingRules[use.id]);
    const area = parkingRemainingRaw * rule;
    const unavailable = rule <= 0;

    return `
      <article class="margin-card">
        <span>${use.label}</span>
        <strong>${unavailable ? "계산 불가" : `${formatNumber(area)}㎡`}</strong>
        <small>${unavailable ? "주차기준을 입력하세요." : `${formatNumber(sqmToPyeong(area))}평`}</small>
      </article>
    `;
  }).join("");
}

function saveProject() {
  readAllInputs();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  alert("현재 입력값을 이 브라우저에 저장했습니다.");
}

function resetProject() {
  const confirmed = confirm("모든 입력값을 초기값으로 되돌릴까요?");
  if (!confirmed) return;

  state = structuredClone(defaultState);
  localStorage.removeItem(STORAGE_KEY);
  syncSettingsToInputs();
  buildFloorCards();
  buildParkingRules();
  bindFloorEvents();
  document.getElementById("resultsSection").classList.add("is-hidden");
}

function bindFloorEvents() {
  document.querySelectorAll(".floor-card").forEach((card) => {
    card.querySelectorAll(".use-tab").forEach((button) => {
      button.addEventListener("click", () => {
        card.querySelectorAll(".use-tab").forEach((tab) => tab.classList.remove("is-active"));
        button.classList.add("is-active");
      });
    });
  });
}

function initialize() {
  syncSettingsToInputs();
  buildFloorCards();
  buildParkingRules();
  bindFloorEvents();

  document.getElementById("reviewButton").addEventListener("click", performReview);
  document.getElementById("saveButton").addEventListener("click", saveProject);
  document.getElementById("resetButton").addEventListener("click", resetProject);
}

initialize();
