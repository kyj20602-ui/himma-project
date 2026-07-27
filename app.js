const FLOOR_NAMES = ["B2", "B1", "1F", "2F", "3F", "4F", "5F"];

const STORAGE_KEY = "himma-building-checker-v5";

const defaultState = {
  settings: {
    siteArea: 274.1,
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
  }))
};

let state = loadState() || structuredClone(defaultState);

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
      || localStorage.getItem("himma-building-checker-v4");
    if (!raw) return null;

    const saved = JSON.parse(raw);
    saved.settings = {
      ...defaultState.settings,
      ...(saved.settings || {}),
      parkingAreaPerSpace: saved.settings?.parkingAreaPerSpace ?? 134
    };
    saved.floors = FLOOR_NAMES.map((name, index) => ({
      ...defaultState.floors[index],
      ...(saved.floors?.[index] || {}),
      name
    }));
    return saved;
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
  container.innerHTML = `
    <label class="rule-card">
      <strong>주차 1대당 기준면적</strong>
      <span class="input-line">
        <input id="parkingAreaPerSpace" type="number" min="0" step="any" inputmode="decimal"
          value="${state.settings.parkingAreaPerSpace ?? 134}">
        <em>㎡/대</em>
      </span>
    </label>
  `;
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
  state.settings.parkingAreaPerSpace = clampNonNegative(document.getElementById("parkingAreaPerSpace").value);

  document.querySelectorAll(".floor-card").forEach((card) => {
    const index = Number(card.dataset.floorIndex);
    const floor = state.floors[index];

    card.querySelectorAll("[data-field]").forEach((input) => {
      const field = input.dataset.field;
      if (input.type === "checkbox") {
        floor[field] = input.checked;
      } else {
        floor[field] = clampNonNegative(input.value);
      }
    });

  });
}

function calculateFloor(floor) {
  const grossArea = clampNonNegative(floor.grossArea);
  const elevatorArea = floor.hasElevator ? clampNonNegative(floor.elevatorArea) : 0;
  const evacuationArea = clampNonNegative(floor.evacuationArea);

  const elevatorExcluded = Math.max(0, grossArea - elevatorArea);
  const netArea = Math.max(0, grossArea - elevatorArea - evacuationArea);

  // 주차 산정은 B2~5F 전 층을 포함하며, 각 층 전체면적에서
  // 엘리베이터 면적만 제외한 값을 사용합니다.
  const parkingArea = elevatorExcluded;

  return {
    ...floor,
    grossArea,
    elevatorArea,
    evacuationArea,
    elevatorExcluded,
    netArea,
    parkingArea
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
    .reduce((sum, floor) => sum + floor.elevatorExcluded, 0);
  const far = siteArea > 0 ? farArea / siteArea * 100 : 0;
  const permittedFarArea = siteArea * state.settings.maxFar / 100;
  const remainingFarArea = permittedFarArea - farArea;

  const totalParkingArea = calculatedFloors.reduce((sum, floor) => sum + floor.parkingArea, 0);
  const parkingAreaPerSpace = state.settings.parkingAreaPerSpace;
  if (parkingAreaPerSpace <= 0) {
    alert("주차 1대당 기준면적은 0보다 큰 값으로 입력해 주세요.");
    document.getElementById("parkingAreaPerSpace").focus();
    return;
  }

  // B2~5F의 엘리베이터 제외면적을 먼저 모두 합산한 뒤,
  // 하나의 주차 기준면적으로 나눕니다.
  const parkingRaw = totalParkingArea / parkingAreaPerSpace;
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
    requiredParking,
    totalParkingArea,
    parkingAreaPerSpace
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
      note: `총 산정면적 ${formatNumber(result.totalParkingArea)}㎡ ÷ ${formatNumber(result.parkingAreaPerSpace, 0)}㎡/대`,
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
      </td>
      ${areaCell(floor.grossArea)}
      ${areaCell(floor.elevatorExcluded)}
      ${areaCell(floor.netArea)}
      ${areaCell(floor.parkingArea)}
      <td>
        <strong>${formatNumber(floor.parkingArea / state.settings.parkingAreaPerSpace, 3)}대</strong>
        <small>${formatNumber(floor.parkingArea)}㎡ ÷ ${formatNumber(state.settings.parkingAreaPerSpace, 0)}㎡/대</small>
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
  const area = parkingRemainingRaw * state.settings.parkingAreaPerSpace;
  document.getElementById("parkingMarginGrid").innerHTML = `
    <article class="margin-card">
      <span>목표 주차대수까지 추가 가능한 면적</span>
      <strong>${formatNumber(area)}㎡</strong>
      <small>${formatNumber(sqmToPyeong(area))}평 · 기준 ${formatNumber(state.settings.parkingAreaPerSpace, 0)}㎡/대</small>
    </article>
  `;
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

function bindFloorEvents() {}

function initialize() {
  buildFloorCards();
  buildParkingRules();
  syncSettingsToInputs();
  bindFloorEvents();

  document.getElementById("reviewButton").addEventListener("click", performReview);
  document.getElementById("saveButton").addEventListener("click", saveProject);
  document.getElementById("resetButton").addEventListener("click", resetProject);
}

initialize();
