# Jaehun Shon · Academic website

GitHub Pages / Jekyll 기반의 개인 연구자 홈페이지입니다. 잉크 네이비 배경과 구리색 포인트, IBM Plex Mono 제목과 IBM Plex Sans 본문을 사용합니다. 별도의 JavaScript나 프런트엔드 빌드 없이 동작합니다.

## 내용 수정

`_data/profile.yml`에서 소개, 소속, 이메일, 외부 링크, 연구 소개, 논문과 학력을 수정합니다.

- `photo`: 프로필 사진 경로. 현재 `assets/images/jaehun-2026.png`를 상반신이 보이는 작은 세로 사각형으로 표시합니다. 비워 두면 기본 사람 실루엣을 표시합니다.
- `publications`: 논문 제목, 저자, 출판 정보, 요약, Paper/Code 링크. 공동 기여 저자는 이름 뒤에 `*`를 붙입니다.
- `cv`, `scholar`, `phone`: 빈 문자열이면 표시하지 않습니다. CV를 추가하려면 PDF를 저장하고 경로를 입력합니다.
- `news`: 날짜와 내용을 추가하면 News 섹션이 표시됩니다.
- `introduction`, `research`: Markdown 링크와 강조를 지원합니다.
- 연락처는 `manfromearth@yonsei.ac.kr`을 사용합니다.

## 화면 구성

- `_layouts/academic.html`: 페이지 기본 구조, 메뉴, 메타데이터
- `_includes/academic-profile.html`: 프로필과 본문
- `assets/css/academic.css`: 데스크톱/모바일/인쇄 스타일
- `index.html`, `_pages/about.md`: 홈과 `/about/` 경로

기존 Minimal Mistakes 테마는 이전 블로그 페이지를 위해 유지합니다. 새 홈페이지는 독립된 academic 레이아웃을 사용합니다.

## 로컬 실행

Ruby와 Bundler가 설치된 환경에서:

```sh
bundle install
bundle exec jekyll serve
```

브라우저에서 `http://localhost:4000`을 엽니다. `_config.yml`을 수정하면 서버를 재시작합니다.

GitHub Pages에 연결된 브랜치에 커밋하고 push하면 저장소의 Pages 설정에 따라 배포됩니다.

## Browser writing workspace

Open `/admin/` (or **Write** in the footer) to write Markdown with Vditor 4.0.1.
Inline `$...$` and display `$$...$$` math use KaTeX. The toolbar supports tables,
formatting, instant rendering, and source/preview modes. Raster images can be
pasted, dropped, or selected, up to 8 MB each.

This is a local authoring prototype, **not a publishing CMS**. Drafts and embedded
images are stored in IndexedDB for this browser and origin. No login, server upload,
or GitHub publishing is configured. Download a JSON backup to restore a draft on
another browser/device. Markdown ZIP export includes relative `images/` assets.
Browser data removal also removes drafts. The editor dependencies are pinned on
jsDelivr, so loading the editor requires internet access. Public note listing and
OAuth-backed publication are a separate next step.

Image layouts: use **Add image layout** to choose Full width, Float right, or Two
columns, with a caption and Markdown/TeX description. Existing layouts can be
reopened via **Edit layout**. Layout blocks are stored as HTML within Markdown;
use the included `note.html` and `note-layout.css` to view their exported layout.
Mobile layouts stack vertically. Layout metadata also survives JSON backups.
**Add video** embeds a direct HTTPS MP4/WebM URL; it does not upload local videos.

Public notes and videos are listed at `/posts/`. The existing RL-YAI video is at
`/posts/rl-yai/`; the old `/demos/` URLs redirect to the corresponding Posts pages.
