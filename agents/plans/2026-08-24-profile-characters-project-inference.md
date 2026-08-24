# Profile Characters and Project Inference Implementation Plan

> **For Hermes:** Use the claude-code skill to implement this plan task-by-task.

**Goal:** Give Jarvis, Light, and L stable profile-specific character silhouettes and replace Unknown Project with a privacy-safe inferred project when Hermes gateway origin metadata explicitly names a project.

**Architecture:** Preserve the read-only Hermes adapter boundary. Carry a sanitized `profile` key through the normalized session/domain model and apply a presentation-only profile override over the existing model identity. For project assignment, continue preferring authoritative `git_repo_root`/`cwd`, then derive only a conservative slug from selected `origin_json` display fields; never return raw titles, origin text, prompts, tool arguments, or messages. Child sessions inherit an inferred parent project when they have no authoritative project metadata.

**Tech Stack:** Node.js 22.13+, `node:sqlite`, dependency-free ESM/CommonJS frontend/server, `node:test`, Canvas sprite compositor.

## Global Constraints

- Work only in `/mnt/user/appdata/dev/hermes-office` on `develop`.
- Hermes databases remain read-only/query-only.
- Do not expose session titles, message bodies, reasoning, tool arguments/results, arbitrary origin metadata, IDs, or secrets.
- Existing authoritative `git_repo_root` and `cwd` win over inference.
- Inference is conservative and bounded; malformed or unrelated origin JSON returns no project.
- Profile visuals are presentation-only and must not misstate or alter the actual LLM model.
- Use existing validated sprites for this slice: Jarvis = Sol, Light = Luna, L = Terra. Do not generate new sprite PNGs.
- Preserve unknown-profile and non-Hermes model behavior.
- Update `CHANGELOG.md` under Unreleased and relevant adapter/design documentation.
- No commit, push, container mutation, or publication from Claude Code. Jarvis owns verification and release.

---

### Task 1: Privacy-safe Hermes project inference

**Objective:** Infer a synthetic project path from explicit project wording in selected gateway origin display fields and inherit parent projects for child sessions.

**Files:**
- Modify: `scripts/tests/hermes-adapter.test.mjs`
- Modify: `claudeville/adapters/hermes.js`

**Interfaces:**
- Consumes: `sessions.origin_json`, `git_repo_root`, `cwd`, `parent_session_id`.
- Produces: session/detail `project` as authoritative path or `/hermes-projects/<safe-slug>`.

**Steps:**
1. Extend the SQLite test fixture schema with `origin_json` and add failing cases for `work on our radarr branch`, malformed/unrelated metadata, authoritative path precedence, parent inheritance, and secret non-leakage.
2. Run `NODE_NO_WARNINGS=1 node --test scripts/tests/hermes-adapter.test.mjs`; verify the new assertions fail for Unknown Project.
3. Select `origin_json` only when the schema provides it. Parse only bounded strings from `auto_thread_initial_name`, `chat_topic`, and `chat_name`.
4. Extract a lower-case safe slug only from explicit project/repo/branch phrasing, reject generic/unsafe values, cap input and slug lengths, and return a synthetic project path. Never return source text.
5. Resolve projects in two passes so child sessions can inherit their parent’s project.
6. Reuse the same resolver in session detail without reading raw messages or tool arguments.
7. Rerun the focused adapter test to green.

### Task 2: Profile-specific character identities

**Objective:** Render the three configured Hermes profiles as stable, distinct characters independent of their shared model.

**Files:**
- Modify: `scripts/tests/hermes-presentation.test.mjs`
- Modify: `claudeville/adapters/hermes.js`
- Modify: `claudeville/adapters/index.js`
- Modify: `claudeville/src/domain/entities/Agent.js`
- Modify: `claudeville/src/presentation/shared/ModelVisualIdentity.js`
- Modify call sites in `AvatarCanvas.js`, `AgentSprite.js`, and `AgentPresentation.js` as required.

**Interfaces:**
- Consumes: sanitized Hermes profile key.
- Produces: `profile` on normalized sessions/agents and a presentation-only sprite override.

**Steps:**
1. Add failing presentation assertions: Jarvis uses `agent.codex.gpt56sol`, Light uses `agent.codex.gpt56luna`, L uses `agent.codex.gpt56terra`; unknown Hermes profiles and non-Hermes providers retain model-driven identity.
2. Run the focused presentation test and verify RED.
3. Carry `profile` from adapter through normalization and the Agent entity.
4. Refactor model visual identity minimally so profile overrides only `spriteId` and profile-specific visual accents while model labels/context accounting remain based on the real model.
5. Update all world/dashboard identity call sites to pass `agent.profile`.
6. Rerun presentation and frontend syntax tests.

### Task 3: Documentation and verification preparation

**Objective:** Record the behavior and keep project contracts current.

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `claudeville/adapters/README.md`
- Modify: `DESIGN.md` or `README.md` only where the runtime contract needs explanation.

**Steps:**
1. Document profile-specific silhouettes and conservative origin-derived project fallback.
2. State clearly that raw origin/title text never crosses the adapter boundary and authoritative git/cwd metadata wins.
3. Run `git diff --check`, focused tests, `npm run validate:quick`, and inspect the complete diff.
4. Hand back exact changed files and test output to Jarvis without committing or pushing.
