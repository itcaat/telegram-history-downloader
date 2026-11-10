#!/usr/bin/env bash
# Creates the next semver tag on the current commit and pushes it.
# Usage: scripts/release.sh [patch|minor|major]
set -euo pipefail

BUMP="${1:-patch}"
case "$BUMP" in
  patch|minor|major) ;;
  *) echo "Unknown bump '$BUMP', expected patch, minor or major" >&2; exit 1 ;;
esac

command -v gh >/dev/null || { echo "gh CLI is required: https://cli.github.com" >&2; exit 1; }

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" ]]; then
  echo "Releases are only allowed from main (current branch: $BRANCH)" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean, commit or stash your changes first" >&2
  exit 1
fi

git fetch --quiet origin main
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
  echo "Local main differs from origin/main, push or pull first" >&2
  exit 1
fi

LATEST="$(gh api --paginate 'repos/{owner}/{repo}/git/matching-refs/tags/v' --jq '.[].ref' \
  | sed 's|^refs/tags/||' \
  | grep -E '^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$' \
  | sort -V \
  | tail -n 1 || true)"

if [[ -z "$LATEST" ]]; then
  NEXT="v$(node -p 'require("./package.json").version')"
  echo "No release tags found on GitHub, starting from package.json version"
else
  IFS=. read -r MAJOR MINOR PATCH <<< "${LATEST#v}"
  case "$BUMP" in
    major) NEXT="v$((MAJOR + 1)).0.0" ;;
    minor) NEXT="v${MAJOR}.$((MINOR + 1)).0" ;;
    patch) NEXT="v${MAJOR}.${MINOR}.$((PATCH + 1))" ;;
  esac
  echo "Latest tag: $LATEST"
fi

if git rev-parse -q --verify "refs/tags/$NEXT" >/dev/null; then
  echo "Tag $NEXT already exists locally" >&2
  exit 1
fi

echo "New tag:    $NEXT on $(git rev-parse --short HEAD)"
read -r -p "Create and push $NEXT? [y/N] " ANSWER
[[ "$ANSWER" =~ ^[Yy]$ ]] || { echo "Aborted"; exit 1; }

git tag -a "$NEXT" -m "Release $NEXT"
git push origin "$NEXT"
echo "Pushed $NEXT, the Release workflow will publish it"
