# 기록 — wnsdud412

GitHub Pages에서 운영하는 글 목록형 개인 블로그. 별도 유료 호스팅이나 서버 설치 불필요.

## 공개 글 작성

`content/posts/`에 Markdown 파일을 추가한다. 파일명은 `첫-기록.md` 또는 `first-note.md`처럼 작성한다.

```markdown
---
title: "글 제목"
date: "2026-11-10"
summary: "목록에 표시할 한두 문장의 요약"
category: "기록"
tags: ["생각", "배움"]
---

본문을 Markdown으로 작성한다.
```

`node scripts/build-index.mjs`를 실행하면 글 목록과 검색용 정보, 개별 HTML 페이지, RSS와 사이트맵을 생성한다. 변경 파일을 커밋하고 push하면 Pages에 반영된다. 제목과 본문은 각 글의 HTML에도 포함되어 JavaScript 없이 읽거나 링크를 공유할 수 있다. 직접 작성한 HTML은 실행하지 않고 글자로 표시한다.

이 저장소의 파일과 Git 이력은 모두 공개된다. 비공개 초안, 악보 원본, 토큰, 인증 키를 이 저장소에 넣지 않는다.

## 개인 악보

- 원본 저장소: `wnsdud412/private-tabs` (Private)
- 이 PC의 별도 작업 폴더: `D:\Personal\Blog-Private-Tabs`
- 지원: Markdown 메모, PDF, PNG/JPEG/WebP/GIF 이미지
- Markdown의 상대 이미지 경로와 다른 악보 파일 링크 지원
- 연결 후 GitHub API에서 파일을 직접 읽고 브라우저 메모리에서 표시
- 연결에 성공한 토큰은 이 브라우저의 localStorage에 저장하고 다음 방문에 자동 연결. 연결 해제 시 삭제하며, 만료되거나 취소된 토큰으로 인증이 거절되면 다시 입력
- 연결 해제 또는 페이지 이탈 시 요청 중단, 화면 제거, 캐시 초기화, 생성한 Blob URL 폐기
- 비공개 파일의 영구 공개 URL 생성이나 공개 저장소로의 자동 복사 없음

실제 연결은 사용자가 `private-tabs` 저장소 하나에 대한 `Contents: Read-only` 권한을 가진 Fine-grained PAT를 발급해 `/private/` 화면에 직접 입력해야 한다. 이 토큰은 제작자에게 전달할 필요가 없다. 외부 분석 도구나 광고 스크립트는 포함하지 않는다. 뷰어 코드나 의존 라이브러리를 변경할 때는 토큰과 자료가 노출되지 않도록 검토해야 한다.

GitHub API에 전달되는 토큰은 비밀 정보다. 공개 코드, 배포 파일, 로그, 채팅, URL에 넣지 않는다. GitHub의 SSH 작업 인증은 뷰어 토큰과 별개다.

## 개발과 배포

```powershell
node --test tests/*.test.mjs
node scripts/build-index.mjs
node scripts/preview.mjs
```

미리보기: `http://127.0.0.1:4173`

GitHub 저장소 Settings → Pages → Deploy from a branch → `main` / `/(root)` → Save.

`.nojekyll`이 포함된 정적 사이트이므로 별도 빌드 서버나 npm 패키지 설치 없이 배포 가능. Markdown 도구의 로컬 복사본, 버전, 원본 무결성 정보와 라이선스는 `assets/vendor/`에 보관한다. `.test-results/`는 로컬 검증용이며 Git에서 제외한다.
