const PYEONG = 3.305785;

const labels = {
  cafe: '카페', office: '사무소', neighborhood: '근린생활',
  assembly: '문화·집회', residential: '주거', parking: '주차장', other: '기타'
};

const defaultSettings = {
  siteArea: 274.1,
  defaultElevatorArea: 4.41,
  maximumBuildingCoverageRate: 60,
  maximumFloorAreaRatio: 250,
  targetParkingSpaces: 6
};

const makeFloor = (id, name, parkingUse, includeInFar) => ({
  id, name, grossArea: 0, evacuationArea: 0, hasElevator: true,
  elevatorArea: 4.41, parkingUse, includeInFar, includeInParking: true,
  parkingAreaManual: null
});

const defaultFloors = [
  makeFloor('b2', 'B2', 'cafe', false),
  makeFloor('b1', 'B1', 'cafe', false),
  makeFloor('1f', '1F', 'neighborhood', true),
  makeFloor('2f', '2F', 'office', true),
  makeFloor('3f', '3F', 'office', true),
  makeFloor('4f', '4F', 'residential', true),
  makeFloor('5f', '5F', 'residential', true)
];

// 동작 확인용 임시값. 실제 법규 기준으로 수정해야 합니다.
const defaultParkingStandards = {
  cafe: 100, office: 100, neighborhood: 100,
  assembly: 100, residential: 100, parking: 999999, other: 100
};

const clone = value => JSON.parse(JSON.stringify(value));
const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) || clone(fallback); }
  catch { return clone(fallback); }
};

let settings = load('bc-settings', defaultSettings);
let floors = load('bc-floors', defaultFloors);
let parkingStandards = load('bc-parking', defaultParkingStandards);
let marginUse = 'cafe';

const format = (value, digits = 2) => Number(value).toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const num = value => Math.max(0, Number(value) || 0);

function getFloorValues(floor) {
  const elevator = floor.hasElevator ? floor.elevatorArea : 0;
  const excludingElevator = Math.max(0, floor.grossArea - elevator);
  const netArea = Math.max(0, excludingElevator - floor.evacuationArea);
  const parkingArea = floor.parkingAreaManual === null ? netArea : floor.parkingAreaManual;
  const parkingRaw = floor.includeInParking ? parkingArea / parkingStandards[floor.parkingUse] : 0;
  return { elevator, excludingElevator, netArea, parkingArea, parkingRaw };
}

function updateFloorCard(card, floor) {
  const values = getFloorValues(floor);
  card.querySelector('.excluding-elevator').textContent = `${format(values.excludingElevator)}㎡`;
  card.querySelector('.excluding-elevator-pyeong').textContent = `${format(values.excludingElevator / PYEONG)}평`;
  card.querySelector('.net-area').textContent = `${format(values.netArea)}㎡`;
  card.querySelector('.net-area-pyeong').textContent = `${format(values.netArea / PYEONG)}평`;
  card.querySelector('.parking-raw').textContent = `${format(values.parkingRaw, 3)}대`;

  const parkingInput = card.querySelector('.parking-area-input');
  if (floor.parkingAreaManual === null && document.activeElement !== parkingInput) {
    parkingInput.value = values.parkingArea;
  }
}

function field(label, value, unit, onChange, step = '0.01') {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';
  wrapper.innerHTML = `<label>${label}</label><div class="input-wrap"><input type="number" min="0" step="${step}" value="${value}"><span>${unit}</span></div>`;
  wrapper.querySelector('input').addEventListener('input', e => onChange(num(e.target.value)));
  return wrapper;
}

function renderSettings() {
  const grid = document.getElementById('settingsGrid');
  grid.innerHTML = '';
  grid.append(
    field('대지면적', settings.siteArea, '㎡', v => { settings.siteArea = v; calculate(); }),
    field('기본 엘리베이터 면적', settings.defaultElevatorArea, '㎡', v => {
      settings.defaultElevatorArea = v;
      floors.forEach(f => f.elevatorArea = v);
      renderFloors(); calculate();
    }),
    field('허용 건폐율', settings.maximumBuildingCoverageRate, '%', v => { settings.maximumBuildingCoverageRate = v; calculate(); }),
    field('허용 용적률', settings.maximumFloorAreaRatio, '%', v => { settings.maximumFloorAreaRatio = v; calculate(); }),
    field('목표 주차대수', settings.targetParkingSpaces, '대', v => { settings.targetParkingSpaces = v; calculate(); }, '1')
  );
}

function renderFloors() {
  const list = document.getElementById('floorList');
  list.innerHTML = '';
  floors.forEach(floor => {
    const { excludingElevator, netArea, parkingArea, parkingRaw } = getFloorValues(floor);

    const card = document.createElement('article');
    card.className = 'floor-card';
    card.innerHTML = `
      <div class="floor-head">
        <strong>${floor.name}</strong>
        <label class="check"><input class="far-check" type="checkbox" ${floor.includeInFar ? 'checked' : ''}>용적률 산입</label>
        <label class="check"><input class="parking-check" type="checkbox" ${floor.includeInParking ? 'checked' : ''}>주차 산정</label>
      </div>
      <div class="floor-fields"></div>
      <div class="tabs"></div>
      <div class="mini-results">
        <span>엘리베이터 제외 <b class="excluding-elevator">${format(excludingElevator)}㎡</b> / <span class="excluding-elevator-pyeong">${format(excludingElevator / PYEONG)}평</span></span>
        <span>순사용면적 <b class="net-area">${format(netArea)}㎡</b> / <span class="net-area-pyeong">${format(netArea / PYEONG)}평</span></span>
        <span>주차지수 <b class="parking-raw">${format(parkingRaw, 3)}대</b></span>
      </div>`;

    const fields = card.querySelector('.floor-fields');
    fields.append(
      field('전체 바닥면적', floor.grossArea, '㎡', v => { floor.grossArea = v; updateFloorCard(card, floor); calculate(); }),
      field('피난동선 면적', floor.evacuationArea, '㎡', v => { floor.evacuationArea = v; updateFloorCard(card, floor); calculate(); })
    );

    const elevatorField = document.createElement('div');
    elevatorField.className = 'field';
    elevatorField.innerHTML = `<label>엘리베이터</label><div class="inline-control"><input class="elevator-check" type="checkbox" ${floor.hasElevator ? 'checked' : ''}><input class="elevator-area" type="number" step="0.01" value="${floor.elevatorArea}" ${floor.hasElevator ? '' : 'disabled'}><span>㎡</span></div>`;
    fields.append(elevatorField);

    const parkingField = field('주차 산정면적', parkingArea, '㎡', v => { floor.parkingAreaManual = v; updateFloorCard(card, floor); calculate(); });
    parkingField.querySelector('input').classList.add('parking-area-input');
    fields.append(parkingField);

    card.querySelector('.far-check').addEventListener('change', e => { floor.includeInFar = e.target.checked; calculate(); });
    card.querySelector('.parking-check').addEventListener('change', e => { floor.includeInParking = e.target.checked; updateFloorCard(card, floor); calculate(); });
    card.querySelector('.elevator-check').addEventListener('change', e => { floor.hasElevator = e.target.checked; renderFloors(); calculate(); });
    card.querySelector('.elevator-area').addEventListener('input', e => { floor.elevatorArea = num(e.target.value); updateFloorCard(card, floor); calculate(); });

    const tabs = card.querySelector('.tabs');
    Object.keys(labels).forEach(use => {
      const button = document.createElement('button');
      button.textContent = labels[use];
      if (floor.parkingUse === use) button.className = 'active';
      button.addEventListener('click', () => { floor.parkingUse = use; renderFloors(); calculate(); });
      tabs.append(button);
    });
    list.append(card);
  });
}

function renderParkingStandards() {
  const grid = document.getElementById('parkingStandards');
  grid.innerHTML = '';
  Object.keys(labels).forEach(use => {
    grid.append(field(`${labels[use]} 1대당 면적`, parkingStandards[use], '㎡/대', v => {
      parkingStandards[use] = Math.max(v, 0.0001);
      document.querySelectorAll('.floor-card').forEach((card, index) => updateFloorCard(card, floors[index]));
      calculate();
    }));
  });
}

function renderMarginTabs() {
  const tabs = document.getElementById('marginTabs');
  tabs.innerHTML = '';
  Object.keys(labels).filter(use => use !== 'parking').forEach(use => {
    const button = document.createElement('button');
    button.textContent = labels[use];
    if (marginUse === use) button.className = 'active';
    button.addEventListener('click', () => { marginUse = use; renderMarginTabs(); calculate(); });
    tabs.append(button);
  });
}

function resultCard(title, main, lines, alert) {
  return `<article class="result-card ${alert ? 'alert' : ''}"><p>${title}</p><strong>${main}</strong>${lines.map(line => `<span>${line}</span>`).join('')}</article>`;
}

function calculate() {
  const rows = floors.map(floor => {
    const { excludingElevator, netArea, parkingArea, parkingRaw } = getFloorValues(floor);
    return { ...floor, excludingElevator, netArea, parkingArea, parkingRaw };
  });

  const farArea = rows.filter(r => r.includeInFar).reduce((sum, r) => sum + r.grossArea, 0);
  const far = settings.siteArea ? farArea / settings.siteArea * 100 : 0;
  const remainingFarArea = settings.siteArea * settings.maximumFloorAreaRatio / 100 - farArea;
  const buildingArea = rows.find(r => r.name === '1F')?.grossArea || 0;
  const bcr = settings.siteArea ? buildingArea / settings.siteArea * 100 : 0;
  const remainingBuildingArea = settings.siteArea * settings.maximumBuildingCoverageRate / 100 - buildingArea;
  const parkingRaw = rows.reduce((sum, r) => sum + r.parkingRaw, 0);
  const requiredParking = Math.ceil(parkingRaw - Number.EPSILON);
  const remainingParkingIndex = settings.targetParkingSpaces - parkingRaw;
  const additionalArea = Math.max(0, remainingParkingIndex) * parkingStandards[marginUse];

  document.getElementById('resultsGrid').innerHTML = [
    resultCard('건폐율', `${format(bcr)}%`, [`1층 건축면적 ${format(buildingArea)}㎡`, `허용 ${format(settings.maximumBuildingCoverageRate)}%`, `여유 ${format(remainingBuildingArea)}㎡`], remainingBuildingArea < 0),
    resultCard('용적률', `${format(far)}%`, [`산입 연면적 ${format(farArea)}㎡`, `허용 ${format(settings.maximumFloorAreaRatio)}%`, `추가 가능 ${format(remainingFarArea)}㎡`], remainingFarArea < 0),
    resultCard('예상 주차대수', `${requiredParking}대`, [`계산지수 ${format(parkingRaw, 3)}대`, `목표 ${settings.targetParkingSpaces}대`, requiredParking <= settings.targetParkingSpaces ? '목표 범위 내' : '목표 초과'], requiredParking > settings.targetParkingSpaces)
  ].join('');

  document.getElementById('marginTitle').textContent = `${settings.targetParkingSpaces}대까지 여유 면적`;
  document.getElementById('remainingParkingIndex').textContent = `${format(remainingParkingIndex, 3)}대`;
  document.getElementById('marginUseLabel').textContent = `${labels[marginUse]} 용도로 추가 가능한 예상 면적`;
  document.getElementById('additionalArea').textContent = remainingParkingIndex >= 0 ? `${format(additionalArea)}㎡` : '목표 초과';
}

document.getElementById('saveProject').addEventListener('click', () => {
  localStorage.setItem('bc-settings', JSON.stringify(settings));
  localStorage.setItem('bc-floors', JSON.stringify(floors));
  localStorage.setItem('bc-parking', JSON.stringify(parkingStandards));
  alert('현재 브라우저에 프로젝트를 저장했습니다.');
});

document.getElementById('saveDefaults').addEventListener('click', () => {
  localStorage.setItem('bc-settings', JSON.stringify(settings));
  alert('현재 설정을 앞으로 사용할 기본값으로 저장했습니다.');
});

document.getElementById('resetAll').addEventListener('click', () => {
  settings = clone(defaultSettings);
  floors = clone(defaultFloors);
  parkingStandards = clone(defaultParkingStandards);
  localStorage.clear();
  renderAll();
});

function renderAll() {
  renderSettings();
  renderFloors();
  renderParkingStandards();
  renderMarginTabs();
  calculate();
}

renderAll();
