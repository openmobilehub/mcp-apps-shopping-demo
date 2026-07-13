#!/usr/bin/env bash
#
# Migrate the Attesto packages out of mcp-apps-shopping-demo into their own repo
# (openmobilehub/attesto), PRESERVING git history for packages/, examples/, specs/, and
# the relevant docs/. Runs on a FRESH CLONE — never on your working tree (it rewrites
# history). It does NOT push and does NOT publish; it leaves a ready-to-review repo and
# prints the remaining manual steps.
#
# Prereqs: git-filter-repo (`pip install git-filter-repo` or `brew install git-filter-repo`),
#          and an EMPTY GitHub repo created at openmobilehub/attesto.
#
# Usage: scripts/migrate-to-attesto-repo.sh [SRC_BRANCH] [SRC_REMOTE] [NEW_REMOTE] [WORKDIR]
set -euo pipefail

SRC_BRANCH="${1:-feat/attesto-gate-v0.1}"   # the branch that has the packages (or main once merged)
SRC_REMOTE="${2:-https://github.com/openmobilehub/mcp-apps-shopping-demo.git}"
NEW_REMOTE="${3:-git@github.com:openmobilehub/attesto.git}"
WORK="${4:-$HOME/attesto-migrate}"
STAGE="$(mktemp -d)"

command -v git-filter-repo >/dev/null 2>&1 || { echo "ERROR: git-filter-repo not installed (pip install git-filter-repo)"; exit 1; }

echo "==> Fresh clone of $SRC_REMOTE ($SRC_BRANCH) → $WORK"
rm -rf "$WORK"
git clone "$SRC_REMOTE" "$WORK"
cd "$WORK"
git checkout "$SRC_BRANCH"

echo "==> Stash the new-repo content (docs/attesto/) before the history rewrite"
cp -R docs/attesto/. "$STAGE"/

echo "==> filter-repo: keep ONLY the library paths (history preserved)"
git filter-repo --force \
  --path packages/attesto-gate \
  --path packages/attesto-storefront \
  --path examples \
  --path storefront-gate.test.ts \
  --path specs/001-attesto-sdk \
  --path specs/002-attesto-storefront \
  --path specs/003-gate-ceremony-extraction \
  --path specs/004-cart-mandate \
  --path docs/PUBLISHING.md \
  --path docs/naming-clearance.md \
  --path docs/repo-migration-plan.md \
  --path .specify/memory/constitution.md

echo "==> Lay down the new-repo root content (README, CONTRIBUTING, ARCHITECTURE,"
echo "    SECURITY-INVARIANTS, CLAUDE.md, docs/reference/, .github/, package.json, etc.)"
cp -R "$STAGE"/. .

echo "==> Sanity: install + build + test the new repo"
npm install
npm run build
npm test

echo "==> Commit the scaffolding + point at the new remote (NO push — review first)"
git add -A
git commit -s -m "chore: scaffold openmobilehub/attesto (docs, CI, root workspace) post-extraction"
git remote remove origin 2>/dev/null || true
git remote add origin "$NEW_REMOTE"

cat <<NEXT

========================================================================
✅ New repo assembled at: $WORK   (history preserved for packages/examples/specs)

NEXT (manual — review before pushing):
  1. Inspect:        cd "$WORK" && git log --oneline | head -20 && ls
  2. Re-verify:      npm run build && npm test     # should be green
  3. Push:           git push -u origin main
  4. GitHub setup:   branch protection (require ci + 1 review); add the
                     CLAUDE_CODE_OAUTH_TOKEN secret + a claude-code-review workflow;
                     add the NPM_TOKEN secret (publish rights to @openmobilehub).
  5. Publish:        create a GitHub Release → .github/workflows/publish.yml runs
                     (gate first, then storefront). Or manually, IN ORDER:
                       npm publish -w @openmobilehub/attesto-gate --access public
                       npm publish -w @openmobilehub/attesto-storefront --access public
  6. Flip the demo:  in mcp-apps-shopping-demo, change the demo's dependency on
                     @openmobilehub/attesto-* from the workspace to the published
                     ^0.1.x and remove packages/ there. (See docs/repo-migration-plan.md.)
========================================================================
NEXT
