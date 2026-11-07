#!/usr/bin/env bash
# 一条命令重新发布：./deploy.sh "这次改了什么"
set -euo pipefail

REPO="chengtefeng16/elemental-match"
SITE="https://chengtefeng16.github.io/elemental-match"
PROXY="${PROXY:-http://127.0.0.1:40009}"
export HTTPS_PROXY="$PROXY" HTTP_PROXY="$PROXY"

cd "$(dirname "$0")"

branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$branch" != "master" ]; then
  echo "当前在 $branch 分支，发布要在 master 分支上进行。" >&2
  exit 1
fi

git add -A

# 进入公开仓库前的最后一道检查：有疑似密钥就停下，什么都不发布
if git diff --cached -U0 | grep -E '^\+' | grep -qE 'ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}'; then
  git reset -q
  echo "改动里有疑似密钥，已停止发布，请先删掉。" >&2
  exit 1
fi

if git diff --cached --quiet; then
  echo "没有新改动，直接同步已有提交。"
else
  git commit -q -m "${1:-update: $(date '+%Y-%m-%d %H:%M')}"
fi

git push origin master:main
commit="$(git rev-parse HEAD)"

echo "等待 GitHub Pages 部署..."
for _ in $(seq 1 40); do
  read -r built status < <(gh api "repos/$REPO/pages/builds/latest" --jq '"\(.commit) \(.status)"' 2>/dev/null || echo "- -")
  if [ "$built" = "$commit" ] && [ "$status" = "built" ]; then
    home="$(curl -s -o /dev/null -w '%{http_code}' -x "$PROXY" "$SITE/")"
    play="$(curl -s -o /dev/null -w '%{http_code}' -x "$PROXY" "$SITE/playbook.html")"
    echo "主页 $home  $SITE/"
    echo "Playbook $play  $SITE/playbook.html"
    [ "$home" = "200" ] && [ "$play" = "200" ] && { echo "发布完成。CDN 可能还要几分钟才刷新。"; exit 0; }
    echo "部署完成，但网址没有返回 200，请检查。" >&2
    exit 1
  fi
  if [ "$built" = "$commit" ] && [ "$status" = "errored" ]; then
    echo "GitHub Pages 部署失败，请到仓库的 Actions 页面看原因。" >&2
    exit 1
  fi
  sleep 15
done

echo "代码已推送，但 10 分钟内没等到部署完成，请稍后打开网址确认。" >&2
exit 1
