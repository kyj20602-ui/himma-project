# 건축법규 면적·주차 검토기 MVP

설치 과정 없이 브라우저에서 바로 실행되는 HTML·CSS·JavaScript 프로젝트입니다.

## 현재 기능

- 대지면적, 기본 엘리베이터 면적, 허용 건폐율·용적률, 목표 주차대수 변경
- 기본 엘리베이터 면적 `4.41㎡`
- B2~5F 층별 전체면적·피난동선 입력
- 층별 엘리베이터 적용 여부와 면적 변경
- B2 기본 주차 산정용도 `카페`
- 층별 주차 산정용도 탭 변경
- 엘리베이터 제외면적과 순사용면적의 ㎡·평 출력
- 계획 건폐율·용적률 계산
- 예상 법정 주차대수 및 목표 주차대수까지의 추가 가능면적 계산
- 브라우저 저장 기능

> 주차 기준은 아직 최종 법규값이 정해지지 않아 100㎡/대 임시값으로 설정했습니다. 사이트의 “주차 기준 설정”에서 실제 기준으로 수정해야 합니다.

## 컴퓨터에서 먼저 열어보기

압축을 푼 뒤 `index.html`을 더블클릭하면 실행됩니다.

일부 브라우저 환경에서는 로컬 파일 제한이 있을 수 있습니다. 그 경우 Visual Studio Code에서 `Live Server` 확장 프로그램을 설치하고 `index.html`을 우클릭해 **Open with Live Server**를 선택하세요.

## GitHub에 업로드하기

1. GitHub에 로그인합니다.
2. 오른쪽 위 `+` → **New repository**를 선택합니다.
3. 저장소 이름을 `building-code-checker`로 정합니다.
4. **Create repository**를 누릅니다.
5. 압축을 푼 폴더의 모든 파일을 저장소 화면에 드래그해서 업로드하거나, 아래 Git 명령을 사용합니다.

```bash
git init
git add .
git commit -m "Initial building checker MVP"
git branch -M main
git remote add origin https://github.com/본인아이디/building-code-checker.git
git push -u origin main
```

## GitHub Pages로 사이트 공개하기

1. 저장소 상단의 **Settings**를 엽니다.
2. 왼쪽 메뉴의 **Pages**를 선택합니다.
3. `Build and deployment`의 Source를 **GitHub Actions**로 설정합니다.
4. 상단 **Actions** 메뉴에서 `Deploy static site to GitHub Pages`가 완료될 때까지 확인합니다.
5. Pages 화면에 표시된 주소를 엽니다.

예상 주소:

```text
https://본인아이디.github.io/building-code-checker/
```

## 파일 설명

- `index.html`: 화면 구조
- `styles.css`: 화면 디자인
- `app.js`: 입력값 저장과 모든 계산 로직
- `.github/workflows/deploy.yml`: GitHub Pages 자동 배포
- `README.md`: 사용 및 배포 방법

## 다음 작업 권장 순서

1. 서울시와 해당 자치구의 실제 용도별 주차 설치기준 확정
2. 주차대수 끝수 처리 규정 확정
3. 각 용도의 주차 산정면적 포함·제외 범위 확정
4. 한 층에 여러 용도를 나누어 입력하는 혼합용도 기능
5. 여러 프로젝트를 이름별로 저장하는 기능
6. PDF·Excel 결과 내보내기

## 주의사항

이 버전은 초기 설계 시뮬레이션용입니다. 실제 인허가 판단에는 최신 법령·조례 및 관할 행정기관 검토가 필요합니다.
