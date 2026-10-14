# Perfection Game

A remake of the classic Perfection board game: fit all pieces before the clock runs out.

## Play

Open `index.html` in any browser — no server or install needed. For development:

```bash
python3 -m http.server 3002 --directory Perfection
# open http://localhost:3002/index.html
```

## Controls

- **Mouse:** drag pieces from the tray into matching board holes.
- **Touch:** drag, or tap a piece then tap a slot.
- **Keyboard:** Tab to a piece, Enter to select, Tab/arrows on the board, Enter to place, Esc to cancel.
- **Buttons:** Start/Reset switch, Pause/Resume, Sound on/off, Difficulty select.

## Features

- 5×5 Normal (60s), 3×3 Easy (75s), 5×5 Blitz (30s)
- Visible countdown + rotating timer dial (red pulse at ≤10s)
- Placed N/M progress counter, persistent win/lose messages
- Best score per difficulty (`localStorage`)
- Flanking score panels: 🏆 Wins (fastest completion per difficulty + history) and 🧩 Before-the-pop (most pieces placed before timeout + history), persisted across visits, side-by-side on desktop and stacked on mobile
- Snap sound (WebAudio, no asset needed), ticking loop, pop on timeout + mute
- Responsive fluid board, `prefers-reduced-motion` support, ARIA roles/live regions

## Structure

- `index.html` — layout, controls, help
- `style.css` — board/tray/timer/feedback styles
- `script.js` — `PerfectionGame` (board, DnD + pointer + keyboard, timer, audio)
- `assets/` — board art, 25 shape tiles, timer dial, logo, sounds
- `docs/assignment.md` — original coursework prompt

## Testing

Manual smoke with Playwright (`playwright-cli open http://localhost:3002/index.html`):
start → countdown ticks → correct/wrong drops → full board wins → reset works, zero 404s / pageerrors.
