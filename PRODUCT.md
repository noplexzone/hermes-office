# Product

## Register

brand

## Users

Caleb runs a durable Hermes Agent team across several software, server, media, research, and household projects. Jarvis coordinates the work; Light implements; L investigates and reviews; temporary delegated workers appear when a task fans out. Hermes Office lives on a second monitor and answers, at a glance: what is being worked on, what changed, what is blocked, what needs Caleb, and whether the work was actually verified.

The first release remains local, read-only, and desktop-only at 1280px or wider. Later releases may add narrow authenticated coordination controls, but observability must be trustworthy before control is introduced.

## Product Purpose

Hermes Office turns the normally invisible activity of Hermes profiles and delegated agents into a place Caleb can understand without reading transcripts or maintaining the coordination state himself. It reads Hermes profile databases in SQLite read-only mode, normalizes sessions into the inherited ClaudeVille model, and renders them two ways: an isometric pixel-art **World** for ambient awareness and a dense **Dashboard** for exact state.

The selected World remains the product's visual center. The default Keep at Night village and future world packages share the same truthful semantic landmarks, agent identities, and status language while changing their fiction, palette, terminology, and compatible assets. Jarvis, Light, L, and temporary workers are persistent characters rather than anonymous rows. Their locations, movement, status, and nearby landmarks communicate research, implementation, testing, review, shipping, incidents, and human attention. Dashboard mode is the precise operational ledger behind that world.

Hermes Office is a downstream fork of `TokenBrice/claude-ville`. It retains ClaudeVille's MIT license, renderer, dashboard, sprites, pathfinding, adapters, and visual craft while making Hermes the primary coordinator and data source.

### Release direction

- **v0.1 — Observe and comprehend:** read-only Hermes sessions, named profiles, live tool-state animation, project grouping, details, verification signals, and needs-attention views.
- **v0.2 — Coordinate:** authenticated task creation, assignment, comments, block/unblock, reprioritization, and safe retry through supported Hermes APIs.
- **v0.3 — Mission Control:** approved workflow starts, worker steering, release/build controls with confirmation gates, dependency maps, and project summaries.

Direct database writes are never a control mechanism. Future actions must use supported Hermes APIs and preserve explicit gates for destructive operations, publishing, container changes, and agent interruption.

## Brand Personality

Competent, watchful, and quietly alive. Each world package must be characterful rather than corporate. The default inherited village feels like a functioning command keep; alternate worlds may change the fiction, but agents retain identity and motion, work retains a stable place, and intervention signals remain unmistakable without becoming noisy.

Voice is concise and in-world where that helps orientation. It may be lightly mythic, but operational labels remain plain. The app must not turn serious blockers, failed verification, or destructive controls into jokes.

Emotional goal: calm command. Caleb should be able to glance over, understand the state of several projects, and return to his work without opening a transcript.

## Anti-references

Explicitly NOT:

- **Generic SaaS dashboard.** No cool-gray card grid, Inter monoculture, or analytics-tool look.
- **Neon cyberpunk / synthwave.** No purple-and-cyan grid or generic “AI command center” glow.
- **Corporate gamification.** No XP, streaks, or badges that make activity look like progress.
- **Decorative agent theatre.** Movement must be driven by real Hermes state, not random animation presented as work.
- **Unsafe direct control.** No SQLite writes, unauthenticated remote actions, fake retry buttons, or silent destructive commands.
- **Transcript surveillance by default.** Raw prompts, reasoning, secrets, and tool-result bodies do not belong in the ambient interface.

## Design Principles

1. **The place is the point.** Preserve a village worth leaving open; do not reduce the product to a dashboard wearing pixel art.
2. **Truth before theatre.** Every status, movement, task, verification mark, and attention signal must come from real Hermes state or be labeled unknown.
3. **Built for the corner of the eye.** Calm by default; loud only for human attention, errors, destructive gates, or failed verification.
4. **Agents are durable characters.** Named profiles retain recognizable identities. Temporary workers are visibly related to the parent that spawned them.
5. **Projects are places.** Rooms, buildings, and districts organize work by project and make ownership, branch, state, and recent change comprehensible.
6. **A grammar learned once.** Building, color, glow, and motion keep stable meanings across World and Dashboard modes.
7. **Observation is not authority.** Read-only data may be stale or incomplete; unknown remains unknown. Control actions require supported APIs and explicit confirmation where appropriate.
8. **Craft over volume.** One clear, verified signal beats five decorative effects.

## Accessibility & Inclusion

The first release is a private desktop tool at 1280px and wider. Preserve basic DOM readability, keyboard focus on existing controls, status cues that are not color-only where practical, and reduced-motion fallbacks for every animation. Mobile and formal WCAG conformance are not v0.1 commitments, but new work must not needlessly degrade existing accessibility.
