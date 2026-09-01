# KisanGati — Specs

Per-component specifications. Each spec is the source of truth for what we're building for that
component: purpose, features (MVP vs later), the data it touches, and the API it needs. Keep these updated
as the build evolves so we never lose context.

See also: [`../DESIGN.md`](../DESIGN.md) (architecture + tech decisions) and
[`../docs/KisanGati-Business-Plan.html`](../docs/KisanGati-Business-Plan.html) (business plan).

## Index

| Spec | Component | Status |
|---|---|---|
| [dashboard.md](dashboard.md) | Admin web dashboard (React) — order processing, payments, inventory, dispatch | **Built** |
| [whatsapp-intake.md](whatsapp-intake.md) | WhatsApp Cloud API intake (webhook → order + Hindi auto-reply) | **Built** (media download deferred) |
| [mobile-app.md](mobile-app.md) | Flutter customer app (farmer + mistri) + customer API | **Built — partial** (voice/photo next) |
| _data-model.md_ | Prisma schema / database | Lives in `prisma/schema.prisma` |
| _ml-service.md_ | Python part-identification + speech-to-text service | Planned |

## Conventions
- **[MVP]** = part of the first money loop (build now). **[Later]** = deferred until the loop works.
- Specs describe *what* and *why*; implementation details that change often live in code, not here.
