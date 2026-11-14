#!/usr/bin/env bash
# 상국포털 GitHub Pages 배포 스크립트
# 전제: simsangguk-jpg/simsangguk-jpg.github.io 저장소가 존재해야 한다.
# 사용: bash work/sangguk-portal-repo/deploy-portal.sh
set -uo pipefail

OWNER="simsangguk-jpg"
REPO="simsangguk-jpg.github.io"
DIR="/workspace/work/sangguk-portal-repo"
LIVE="https://${OWNER}.github.io/"

cd "$DIR" || { echo "FAIL: 작업 폴더 없음 ($DIR)"; exit 1; }

echo "== 1) 저장소 확인"
if ! gh api "repos/${OWNER}/${REPO}" --jq '.full_name' 2>/dev/null; then
  echo "FAIL: 저장소 ${OWNER}/${REPO} 가 없습니다. github.com/new 에서 먼저 만들어 주세요."
  exit 2
fi

echo "== 2) 원격 설정 및 푸시"
git remote remove origin 2>/dev/null
git remote add origin "https://github.com/${OWNER}/${REPO}.git"
if ! git push -u origin main 2>&1; then
  echo "FAIL: push 실패 (앱 토큰 권한 문제일 수 있음)"
  exit 3
fi

echo "== 3) GitHub Pages 활성화 (main / 루트)"
gh api -X POST "repos/${OWNER}/${REPO}/pages" \
  -f "source[branch]=main" -f "source[path]=/" 2>&1 | head -5
gh api "repos/${OWNER}/${REPO}/pages" --jq '{status,url,html_url,cname,source}' 2>&1

echo "== 4) 배포 대기 (최대 10분)"
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$LIVE")
  echo "  [$i] $LIVE -> $code"
  [ "$code" = "200" ] && break
  sleep 10
done

echo "== 5) 자산 검증"
for p in "" robots.txt manifest.json icon-192.png icon-512.png; do
  printf '  /%-14s -> %s  (%s)\n' "$p" \
    "$(curl -s -o /dev/null -w '%{http_code}' "${LIVE}${p}")" \
    "$(curl -s -o /dev/null -w '%{content_type}' "${LIVE}${p}")"
done

echo "== 6) noindex 확인 (라이브 HTML 메타)"
curl -s "$LIVE" | grep -m2 -i 'name="robots"\|googlebot'
