# KPubData Studio — Brand Assets

승인된 Brand Guide 최종 로고를 그대로 벡터화한 asset 세트입니다.
심볼은 승인 심볼 비트맵을 potrace로 벡터 추출 후 후처리했고, light/dark는 동일 geometry에
색상만 다르게 적용합니다. 워드마크는 Pretendard 아웃라인(패스)이며 폰트 파일은 포함하지 않습니다.

## 공식 색상
| 이름 | HEX | 용도 |
| :-- | :-- | :-- |
| Charcoal | `#18181B` | K 상단 형태(라이트), 하단 data layer |
| Indigo | `#5B5BD6` | 우측 diamond, "Studio" 워드마크 |
| Light Indigo | `#818CF8` | 상단 data layer |
| Dark UI Background | `#0F172A` | 다크 UI 배경(참고) |
| White | `#FFFFFF` | K 상단 형태(다크), 앱 아이콘 배경 |

## SVG (svg/)
| 파일 | 용도 |
| :-- | :-- |
| `horizontal_light.svg` | 라이트 헤더, 회원가입 브랜딩(라이트 배경) |
| `horizontal_dark.svg` | 데스크톱 사이드바(확장), 다크 헤더, 로그인 네이비 패널 |
| `vertical_light.svg` | 세로 락업(라이트) |
| `vertical_dark.svg` | 세로 락업(다크) |
| `symbol_light.svg` | 심볼 전용(라이트 배경), 텍스트 없음 |
| `symbol_dark.svg` | 심볼 전용(다크 배경), 텍스트 없음 |
| `sidebar_light.svg` | 작은 UI(사이드바 collapsed 등), 라이트 |
| `sidebar_dark.svg` | 데스크톱 사이드바(collapsed), 다크 |
| `favicon.svg` | 브라우저 파비콘(심볼, 텍스트 없음) |

모든 SVG는 실제 vector path이며 배경 투명, 외부 의존성/래스터 임베드가 없습니다.
`viewBox`만 지정하고 width/height는 고정하지 않아 비율을 유지한 채 크기 조절됩니다.

## PNG (png/) — 모두 투명 배경(앱 아이콘 제외)
| 파일 | 크기 | 용도 |
| :-- | :-- | :-- |
| `kpubdata-horizontal-light.png` | 1400×약294 | 라이트 헤더/브랜딩 |
| `kpubdata-horizontal-dark.png` | 1400×약294 | 다크 헤더, 로그인 패널, 사이드바(확장) |
| `kpubdata-vertical-light.png` | 1024×1024 | 세로 락업(라이트), 여백 포함 |
| `kpubdata-vertical-dark.png` | 1024×1024 | 세로 락업(다크), 여백 포함 |
| `kpubdata-symbol-light-512.png` | 512×512 | 심볼(라이트) |
| `kpubdata-symbol-dark-512.png` | 512×512 | 심볼(다크) |
| `kpubdata-app-icon-1024.png` | 1024×1024 | 앱 아이콘(흰 라운드 사각 + 심볼) |
| `favicon-32.png` | 32×32 | 파비콘 |
| `favicon-16.png` | 16×16 | 파비콘(심볼만, 텍스트 없음) |

## UI별 권장 사용
- 데스크톱 사이드바(확장): `horizontal_dark.svg`
- 데스크톱 사이드바(축소): `sidebar_dark.svg` 또는 `symbol_dark.svg`
- 라이트 헤더: `horizontal_light.svg` / 다크 헤더: `horizontal_dark.svg`
- 로그인 네이비 패널: `horizontal_dark.svg`
- 회원가입 브랜딩: 배경에 맞춰 `horizontal_light.svg` / `horizontal_dark.svg`
- 브라우저 파비콘: `favicon.svg` / `favicon-32.png` / `favicon-16.png`
- 앱 아이콘: `kpubdata-app-icon-1024.png`

## 금지
로고 재디자인, 형태·비율·레이어 위치 변경, 회전, gradient/glow/shadow/3D 추가,
다른 Indigo나 Emerald 계열 사용, 심볼에 "K" 글자 삽입, 파비콘에 텍스트 삽입.
