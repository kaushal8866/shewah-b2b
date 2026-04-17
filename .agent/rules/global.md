# Shewah B2B — Global Agent Rules

## 1. Operating Doctrine (§1.3)
- **Trust is the moat**: Prioritize transparency in pricing, weights, and timelines.
- **Gold is a state**: Always track gold through its lifecycle.
- **One source of truth**: No duplicate data definitions.
- **Audit everything**: Every write must be logged with before/after snapshots.
- **Slow writes, fast reads**: Confirmation for mutations, high speed for dashboards.
- **India-first**: Default to IST display, ₹ symbol, and Indian business customs.

## 2. Tech Stack & Implementation (§4)
- **Money**: Store in **integer paise** (₹1 = 100). Never use floats for currency.
- **Weight**: Store in **integer milligrams** (1g = 1000mg). Never use floats for gold.
- **Deletes**: Use **Soft Delete** only (`deleted_at`). Hard deletes are prohibited in production tables.
- **Time**: Database MUST store in **UTC**. UI MUST display in **Asia/Kolkata (IST)**.
- **Security**:
    - Every table MUST have **RLS enabled**.
    - No secrets in `NEXT_PUBLIC_` environment variables.
    - `middleware.ts` MUST enforce auth on all `/app/*` routes except `/auth`.

## 3. UI/UX: Editorial Brutalism
- **Aesthetic**: Monochromatic (Zink/Stone), high-performance, dense information.
- **High Contrast**: Use `surface-low` to `surface-highest` tokens.
- **No Placeholders**: If an image is missing, generate a dynamic SVG placeholder or use `generate_image`.
- **Micro-animations**: Use subtle transitions for state changes (loading, toast, hover).

## 4. Governance (§2)
- Validate user roles (`owner`, `rep`, `partner`) on the server before executing mutations.
- Enforce approval gates for:
    - Credit > ₹5L
    - Discount > 3%
    - New partner activation
    - Refunds
