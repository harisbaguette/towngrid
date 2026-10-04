# 타운그리드 디자인 시스템

**산업 제어반**은 청록색 에나멜과 강철 프레임, 주황색 조작 버튼을 사용하는 게임 UI다.

[실제 컴포넌트 열기](http://localhost:5173/design-system) · [화면 배치](UI_DESIGN.md)

## 플레이 화면

플레이 화면과 홈은 3번 시안의 청록색 프레임·나사·입체 버튼을 공유한다. 프레임 안에 다시 상자를 겹치지 않고, 배치는 미니멀 시안을 따른다. 자원은 하나의 계기판에 모은다.

- 상단에는 자원 세 가지와 시간·메뉴만 둔다. 나머지 재고는 펼침 메뉴에서 본다.
- 하단에는 기본 메뉴, 건설 목록, 배치 안내, 시설 요약 중 하나만 둔다.
- 건설 목록은 세 개의 기본 분류와 건물 그림·이름·가격으로 구성한다. 선택된 분류에는 주황색 밑줄을 쓴다.
- 시설 요약은 이름·상태·생산 진행·가동 버튼을 제공한다. 자세한 설정은 별도 창에서 연다.
- 메뉴와 상세 창은 금속 프레임 안의 크림색 바탕, 얇은 구분선, 청록색 제목판을 사용한다.

`MinimalHud`와 `MinimalFacilityDock`은 `src/app/game/MinimalHud.tsx`에 있다. 배치는 `src/app/minimal-game.css`, 공통 이미지 외형은 `src/app/component-art.css`에서 관리한다.

## 색상

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `--ui-metal` | `#235F63` | 외부 프레임, 제목판, 보조 버튼 |
| `--ui-metal-dark` | `#153D42` | 자원 계기판, 버튼 하부, 게이지 홈 |
| `--ui-paper` | `#F1EDDF` | 패널의 읽기 영역 |
| `--ui-ink` | `#19383B` | 밝은 바탕 위 글자 |
| `--ui-metal-ink` | `#FFF5DF` | 청록색 바탕 위 글자 |
| `--ui-action` | `#EE701B` | 건설·확정·현재 선택 |
| `--ui-action-ink` | `#251D12` | 주황색 바탕 위 글자 |
| `--ui-progress` | `#1BB8A4` | 실제 생산 진행량 |
| `--ui-success` | `#146C5C` | 정상 가동 |
| `--ui-warning` | `#795211` | 재료·연료 부족 |
| `--ui-danger` | `#AD3D2C` | 수리 필요·철거 확인 |
| `--ui-info` | `#285F7A` | 운반 대기·안내 |
| `--ui-disabled` | `#CCD0C8` | 잠김·사용 불가 |
| `--ui-gold` | `#EABE61` | 화폐 |
| `--ui-focus` | `#FFB965` | 키보드 포커스 |

상태는 색과 아이콘·문구를 함께 쓴다. 이미지 버튼은 시안의 밝고 굵은 글자와 짙은 문자 그림자를 사용한다. 건물 그림과 자원 아이콘은 기존 픽셀 원화를 사용한다.

## 형태와 크기

- 기본 간격은 4px이며 내부 여백은 8·12·16·24px를 사용한다.
- 주요 테두리는 2px, 내부 구분선은 1px, 모서리는 3px다.
- 패널은 금속 외곽과 밝은 읽기 영역으로 나눈다. 고정 나사는 큰 패널의 네 모서리에만 둔다.
- 버튼은 위쪽 하이라이트와 단단한 아래쪽 그림자로 높이를 표현한다. 누르면 2px 내려간다.
- 기본 버튼 높이는 40px, 조밀한 도구는 32px, 주요 터치 조작은 44px 이상을 기준으로 한다. 좁은 HUD의 보조 도구는 현재 화면 규격을 따른다.
- 본문은 14px, 보조 문구는 12px, 짧은 계기판 표시는 11px부터 사용한다. 긴 한국어 설명을 픽셀 폰트로 바꾸지 않는다.
- 건설 카드는 제목·건물·비용 순서다. 선택은 주황색 테두리와 체크, 잠김은 자물쇠와 해금 조건으로 표시한다.
- 작은 화면의 건설 목록은 가로로 넘긴다. 낮은 가로 화면에서는 카드 높이를 줄이고 도구와 탭 사이에 여백을 둔다.

## 공용 컴포넌트

| 컴포넌트 | 사용법 |
| --- | --- |
| `Button` | `default`: 주 행동, `secondary`: 청록색 보조 조작, `outline`: 밝은 보조 조작, `destructive`: 위험 행동 |
| `GamePanel` | `title`, `icon`, `onClose`를 받는 금속 프레임 패널 |
| `BuildingCard` | 건물 그림·가격·선택·잠김·이미 건설됨 상태 |
| `ResourceCounter` | 실제 자원 아이콘과 수량 |
| `StatusBadge` | `success`, `warning`, `info`, `danger`, `neutral` 상태 |
| `Tabs` | 청록색 분류 탭과 주황색 현재 탭 |
| `Progress` | 실제 값에 따라 채워지는 분절형 생산 게이지 |
| `Switch` | 사각 손잡이가 움직이는 가동·설정 스위치 |
| `Dialog`, `Tooltip` | 동일한 프레임·문자 대비·포커스 규칙 |

기본 컴포넌트는 `src/components/ui/`, 게임 전용 컴포넌트는 `src/components/game-ui/industrial-kit.tsx`에서 가져온다. 견본 화면과 실제 건설 목록이 같은 `BuildingCard`를 사용한다.

```tsx
import { Button } from '@/components/ui/button';
import { GamePanel, StatusBadge } from '@/components/game-ui/industrial-kit';

<GamePanel title="제재소">
  <StatusBadge tone="warning">목재 부족</StatusBadge>
  <Button variant="secondary" onClick={openStock}>재고 확인</Button>
</GamePanel>
```

## 동작

- 버튼에는 행동 이름을 쓰고, 아이콘만 쓰는 버튼은 `aria-label`을 제공한다.
- 탭과 선택 버튼은 `aria-selected` 또는 `aria-pressed`로 현재 상태를 알린다.
- 잠긴 조작은 실제 `disabled` 상태로 만들고 이유를 함께 표시한다.
- 포커스는 3px 밝은 외곽선으로 표시한다. 대화창은 Escape로 닫고 기존 포커스로 돌아간다.
- 동작 줄이기 설정에서는 누름 이동과 CSS 전환을 생략한다.
- 견본의 수량·진행률은 예시다. 게임에서는 저장된 재고·가동 상태·생산 진행을 연결한다.

## 스타일 수정 위치

토큰은 `src/app/design-tokens.css`, 기본 컴포넌트 값은 `src/app/industrial-components.css`에 둔다. 배치 CSS 뒤에 읽는 `component-art.css`가 공통 이미지 외형을 적용한다. 원본은 `art-source/ui-components/2026-10-03/runtime-frames/`, 실행용은 `public/assets/ui/industrial/`이며 `node scripts/pack-ui-components.mjs`로 패킹한다. 9분할 프레임의 모서리는 고정하고 중앙과 변만 늘린다. 새 화면은 공용 토큰과 컴포넌트를 사용한다. 장면·지도·캐릭터의 색은 UI 토큰으로 대체하지 않는다.
