# Project memory

## Product intent & audience

- Mobile-first gaming/betting web app (24xbet) targeting Bengali-speaking users
- Features: Jili games, rigged Aviator crash game, football predictions, local payment integrations
- Responsive design optimized for mobile play

## Brand personality & voice

- Gaming/entertainment brand with casino-style energy
- Localized content for Bengali market (game names, UI text in Bengali)
- User communicates in Bengali; responses match user's language

## Visual design & UX direction

- Stack: React (Vite), Tailwind CSS, Lucide React icons
- Path alias `@/` → `src/` (per `.bolt/prompt`)
- Icon library: lucide-react only for logos/icons (per `.bolt/prompt`)
- Aesthetic: production-grade, non-cookie-cutter (per `.bolt/prompt`)
- Mobile-first responsive layout

## Decisions, constraints & rationale

- **Super Ace game**: Card win sounds use spoken card name (speech synthesis or audio)
- **King card win override**: Plays custom MP3 instead of spoken card name; other cards keep voice announcement
- **Scatter → Free Spin flow**: Scatter image shows with `Super_Ace_Scatter_sound.mp3`; image stays until sound ends, then auto-removes and free spin starts
- **Scatter timing**: Replaced previous 2-second fixed timer with sound-ended event listener; fallback ensures game proceeds if audio fails to load
- Custom sounds imported via Vite as assets; stored in `src/lib`
- Existing chain/sound logic in `src/lib` used as pattern for new audio integration
- Builds verified successful after sound integrations

## Open questions & assumptions

- Scatter sound & King win sound not browser-tested — need manual verification
- Fallback behavior for Scatter sound (if audio fails) assumed: proceeds automatically — needs runtime confirmation
- Payment integrations: which local providers (bKash, Nagad, Rocket?) — not yet specified
- Rigged Aviator: algorithm/crash multiplier logic details unconfirmed
- Football predictions: data source and scoring model undefined