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

## Private browser writing workspace

Open `/login/` directly and sign in with the owner GitHub account. The public
navigation has no Login link. Write is hidden until the server verifies the
owner session. The private editor runs on Cloudflare Workers; every asset and
publishing request requires its HttpOnly session. The server checks GitHub user
ID 250346925, including before publishing. Other accounts are rejected.

Drafts and images stay in this browser until Publish is chosen. Use JSON backup
and restore to move between devices. Older local drafts can be recovered at
`/admin/`, which no longer serves the editor. Public notes appear under `/posts/`;
old `/demos/` links still redirect. Direct MP4/WebM video URLs are supported.

The editor supports Markdown, inline/display TeX, tables, image drag-and-drop,
and Full width / Float right / Two columns image layouts. Export includes HTML,
Markdown, styles, and images. Publishing commits sanitized HTML and images to
GitHub; Pages deployment takes additional time after the commit.

Worker source and deployment instructions are in `_studio/README.md`. Never
put credentials in Jekyll configuration, browser code, or repository files.
