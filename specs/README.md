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
| _data-model.md_ | Prisma schema / database | Planned (living in `prisma/` once built) |
| _ml-service.md_ | Python part-identification + speech-to-text service | Planned |
| _mobile-app.md_ | Flutter customer app (farmer + mistri) | Planned |

## Conventions
- **[MVP]** = part of the first money loop (build now). **[Later]** = deferred until the loop works.
- Specs describe *what* and *why*; implementation details that change often live in code, not here.
