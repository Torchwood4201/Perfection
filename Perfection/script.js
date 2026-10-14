const CONFIG = {
    ROWS: 5,
    COLS: 5,
    TIME_SEC: 60,
    WIN_DELAY_MS: 1000,
    MESSAGE_HIDE_MS: 3000,
};

const DIFFICULTIES = {
    easy: { label: 'Easy 3×3 · 75s', rows: 3, cols: 3, time: 75 },
    normal: { label: 'Normal 5×5 · 60s', rows: 5, cols: 5, time: 60 },
    blitz: { label: 'Blitz 5×5 · 30s', rows: 5, cols: 5, time: 30 },
};

const WINS_KEY = 'perfection.wins.v1';
const POPS_KEY = 'perfection.pops.v1';
const SCORE_LIMIT = 10;

// Hole geometry measured from assets/Board/full-win.png (220×220).
// Each rect is the painted shape's bounding box (+1.5px margin) as
// fractions of board width/height. Slots are absolutely positioned
// on these rects so placed pieces land exactly inside the artwork
// at ANY board size. Order is row-major: index = row * COLS + col.
const HOLE_RECTS = [
    { x: 0.0023, y: 0.0023, w: 0.1682, h: 0.1682 },
    { x: 0.2068, y: 0.0068, w: 0.1864, h: 0.1864 },
    { x: 0.4114, y: 0.0295, w: 0.1773, h: 0.1409 },
    { x: 0.6068, y: 0.0159, w: 0.1864, h: 0.1682 },
    { x: 0.8250, y: 0.0114, w: 0.1636, h: 0.1773 },
    { x: 0.0295, y: 0.2159, w: 0.1545, h: 0.1682 },
    { x: 0.2205, y: 0.2205, w: 0.1591, h: 0.1591 },
    { x: 0.4250, y: 0.2250, w: 0.1500, h: 0.1500 },
    { x: 0.6205, y: 0.2295, w: 0.1318, h: 0.1409 },
    { x: 0.8023, y: 0.2341, w: 0.1955, h: 0.1318 },
    { x: 0.0250, y: 0.4023, w: 0.1500, h: 0.1955 },
    { x: 0.2295, y: 0.4023, w: 0.1682, h: 0.1682 },
    { x: 0.4250, y: 0.4250, w: 0.1500, h: 0.1500 },
    { x: 0.6023, y: 0.4023, w: 0.1955, h: 0.1955 },
    { x: 0.8114, y: 0.4295, w: 0.1773, h: 0.1409 },
    { x: 0.0114, y: 0.6114, w: 0.1773, h: 0.1773 },
    { x: 0.2250, y: 0.6341, w: 0.1500, h: 0.1318 },
    { x: 0.4250, y: 0.6341, w: 0.1500, h: 0.1318 },
    { x: 0.6205, y: 0.6205, w: 0.1591, h: 0.1591 },
    { x: 0.8159, y: 0.6159, w: 0.1682, h: 0.1682 },
    { x: 0.0250, y: 0.8432, w: 0.1318, h: 0.1318 },
    { x: 0.2295, y: 0.8159, w: 0.1545, h: 0.1682 },
    { x: 0.4250, y: 0.8250, w: 0.1500, h: 0.1500 },
    { x: 0.6432, y: 0.8205, w: 0.1136, h: 0.1591 },
    { x: 0.8068, y: 0.8295, w: 0.1636, h: 0.1636 },
];

function fisherYates(arr, rand = Math.random) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function generateShapeTypes(count) {
    const types = [];
    for (let i = 0; i < count; i++) {
        const n = String(i).padStart(3, '0');
        types.push({ name: `shape${i}`, sprite: `assets/shapes/tile${n}.png` });
    }
    return types;
}

class PerfectionGame {
    constructor() {
        this.gameBoard = document.getElementById('gameBoard');
        this.shapeTray = document.getElementById('shapeTray');
        this.timerElement = document.getElementById('timer');
        this.switchInput = document.getElementById('gameSwitch');
        this.switchLabel = document.getElementById('switchLabel');
        this.messageElement = document.getElementById('message');
        this.timerNumber = document.getElementById('timerNumber');
        this.dialImg = this.timerElement ? this.timerElement.querySelector('.timer-dial-img') : null;
        this.progressElement = document.getElementById('progress');
        this.bestElement = document.getElementById('bestScore');
        this.difficultySelect = document.getElementById('difficulty');
        this.pauseButton = document.getElementById('pauseButton');
        this.muteButton = document.getElementById('muteButton');
        this.winsBest = document.getElementById('winsBest');
        this.winsList = document.getElementById('winsList');
        this.winsClear = document.getElementById('winsClear');
        this.popsBest = document.getElementById('popsBest');
        this.popsList = document.getElementById('popsList');
        this.popsClear = document.getElementById('popsClear');

        if (!this.gameBoard || !this.shapeTray || !this.timerElement || !this.messageElement) {
            throw new Error('PerfectionGame: required DOM nodes missing');
        }

        this.difficulty = (this.difficultySelect && this.difficultySelect.value in DIFFICULTIES)
            ? this.difficultySelect.value : 'normal';
        const diff = DIFFICULTIES[this.difficulty];
        this.rows = diff.rows;
        this.cols = diff.cols;
        this.totalShapes = this.rows * this.cols;

        this.timeLeft = diff.time;
        this.timerInterval = null;
        this.gameActive = false;
        this.paused = false;
        this.won = false;
        this.shapes = [];
        this.slots = [];
        this.draggedShape = null;
        this.selectedShape = null;
        this.placedShapes = 0;
        this.currentDragTarget = null;
        this.listenersBound = false;
        this.timeouts = new Set();
        this.messageTimeoutId = null;
        this.winTimeoutId = null;
        this.muted = localStorage.getItem('perfection.muted') === '1';

        // Lazy audio: created on first user gesture (see ensureAudio)
        this.timerSound = null;
        this.endingSound = null;
        this.audioReady = false;

        // Full 25-shape catalog; board uses a slice of it
        this.allShapeTypes = generateShapeTypes(25);
        this.shapeTypes = this.allShapeTypes.slice(0, this.totalShapes);

        this.init();
        // Test hook (1 line, harmless in production)
        window.__game = this;
    }

    later(fn, ms) {
        const id = setTimeout(() => {
            this.timeouts.delete(id);
            fn();
        }, ms);
        this.timeouts.add(id);
        return id;
    }

    clearAllTimers() {
        this.timeouts.forEach((id) => clearTimeout(id));
        this.timeouts.clear();
        if (this.messageTimeoutId) {
            clearTimeout(this.messageTimeoutId);
            this.messageTimeoutId = null;
        }
        if (this.winTimeoutId) {
            clearTimeout(this.winTimeoutId);
            this.winTimeoutId = null;
        }
    }

    ensureAudio() {
        if (this.audioReady) return;
        try {
            this.timerSound = new Audio('assets/sounds/timer.mp3');
            this.timerSound.loop = true;
            this.endingSound = new Audio('assets/sounds/ending%20pop.mp3');
            this.endingSound.src = 'assets/sounds/ending pop.mp3';
            this.audioReady = true;
            this.applyMute();
        } catch (e) {
            this.audioReady = false;
        }
    }

    applyMute() {
        const muted = this.muted;
        if (this.timerSound) this.timerSound.muted = muted;
        if (this.endingSound) this.endingSound.muted = muted;
        if (this.muteButton) {
            this.muteButton.textContent = muted ? '🔇 Muted' : '🔊 Sound';
            this.muteButton.setAttribute('aria-pressed', String(muted));
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        localStorage.setItem('perfection.muted', this.muted ? '1' : '0');
        this.ensureAudio();
        this.applyMute();
    }

    playSnap() {
        if (this.muted) return;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            this._audioCtx = this._audioCtx || new Ctx();
            const ctx = this._audioCtx;
            if (ctx.state === 'suspended') ctx.resume();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(620, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.09);
            gain.gain.setValueAtTime(0.18, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
            osc.connect(gain).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.11);
        } catch (e) { /* visual feedback already shown */ }
    }

    init() {
        this.createGameBoard();
        this.createShapes();
        this.setupEventListeners();
        this.renderBest();
        this.renderScores();
        this.updateTimer();
        this.updateProgress();
        this.applyMute();
    }

    currentConfig() {
        return DIFFICULTIES[this.difficulty] || DIFFICULTIES.normal;
    }

    setDifficulty(name) {
        if (!(name in DIFFICULTIES)) return;
        this.difficulty = name;
        const diff = DIFFICULTIES[name];
        this.rows = diff.rows;
        this.cols = diff.cols;
        this.totalShapes = this.rows * this.cols;
        this.shapeTypes = this.allShapeTypes.slice(0, this.totalShapes);
        this.resetGame(true);
    }

    // Maps a slot index to a hole-art index. 5×5 uses holes in order;
    // 3×3 (easy) plays the CENTER block so pieces sit in real holes.
    holeIndexForSlot(index) {
        if (this.rows === 5 && this.cols === 5) return index;
        if (this.rows === 3 && this.cols === 3) {
            return [6, 7, 8, 11, 12, 13, 16, 17, 18][index];
        }
        return index % HOLE_RECTS.length;
    }

    createGameBoard() {
        this.gameBoard.innerHTML = '';
        this.slots = [];
        this.placedShapes = 0;
        this.won = false;
        this.gameBoard.classList.remove('filled', 'win');
        this.gameBoard.setAttribute('role', 'grid');
        this.gameBoard.setAttribute('aria-label', `Perfection board, ${this.rows} by ${this.cols}`);

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const index = row * this.cols + col;
                const hole = HOLE_RECTS[this.holeIndexForSlot(index)];
                const slot = document.createElement('div');
                slot.className = 'slot';
                slot.dataset.index = index;
                slot.dataset.row = row;
                slot.dataset.col = col;
                slot.dataset.expectedShape = this.shapeTypes[index].name;
                slot.dataset.hole = this.holeIndexForSlot(index);
                slot.style.left = `${hole.x * 100}%`;
                slot.style.top = `${hole.y * 100}%`;
                slot.style.width = `${hole.w * 100}%`;
                slot.style.height = `${hole.h * 100}%`;
                slot.setAttribute('role', 'gridcell');
                slot.setAttribute('tabindex', '0');
                slot.setAttribute('aria-label', `Empty slot row ${row + 1} column ${col + 1}`);

                this.gameBoard.appendChild(slot);
                this.slots.push(slot);
            }
        }
    }

    createShapes() {
        this.shapeTray.innerHTML = '';
        this.shapes = [];
        this.selectedShape = null;

        const shuffledShapes = fisherYates(this.shapeTypes);

        shuffledShapes.forEach((shapeType) => {
            const shape = document.createElement('div');
            shape.className = 'shape';
            shape.dataset.shapeType = shapeType.name;
            shape.setAttribute('role', 'button');
            shape.setAttribute('tabindex', '0');
            shape.setAttribute('aria-label', `${shapeType.name}. Press Enter to select, then choose a board slot.`);

            const img = document.createElement('img');
            img.src = shapeType.sprite;
            img.alt = shapeType.name;
            img.loading = 'lazy';
            img.onerror = () => {
                img.alt = `${shapeType.name} (image missing)`;
                shape.classList.add('img-missing');
            };

            shape.appendChild(img);
            this.shapeTray.appendChild(shape);
            this.shapes.push(shape);
        });
    }

    setupEventListeners() {
        if (this.listenersBound) return;
        this.listenersBound = true;

        if (this.switchInput) {
            this.switchInput.addEventListener('change', () => {
                if (this.switchInput.checked) {
                    this.startGame();
                    if (this.switchLabel) this.switchLabel.textContent = 'Reset';
                } else {
                    this.resetGame();
                    if (this.switchLabel) this.switchLabel.textContent = 'Start';
                }
            });
        }

        if (this.difficultySelect) {
            this.difficultySelect.addEventListener('change', (e) => this.setDifficulty(e.target.value));
        }
        if (this.pauseButton) {
            this.pauseButton.addEventListener('click', () => this.togglePause());
        }
        if (this.muteButton) {
            this.muteButton.addEventListener('click', () => this.toggleMute());
        }
        if (this.winsClear) {
            this.winsClear.addEventListener('click', () => {
                this.saveScoreList(WINS_KEY, []);
                this.renderScores();
            });
        }
        if (this.popsClear) {
            this.popsClear.addEventListener('click', () => {
                this.saveScoreList(POPS_KEY, []);
                this.renderScores();
            });
        }
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.gameActive && !this.paused) this.togglePause(true);
        });

        // --- HTML5 drag & drop (delegated, desktop fallback) ---
        this.shapeTray.addEventListener('dragstart', (e) => {
            const shape = e.target.closest('.shape');
            if (shape) this.handleDragStart(e, shape);
        });
        this.shapeTray.addEventListener('dragend', (e) => {
            const shape = e.target.closest('.shape');
            if (shape) this.handleDragEnd(e, shape);
        });
        this.gameBoard.addEventListener('dragenter', (e) => {
            const slot = e.target.closest('.slot');
            if (slot) this.handleDragEnter(e, slot);
        });
        this.gameBoard.addEventListener('dragover', (e) => {
            const slot = e.target.closest('.slot');
            if (slot) this.handleDragOver(e, slot);
            else e.preventDefault();
        });
        this.gameBoard.addEventListener('dragleave', (e) => {
            const slot = e.target.closest('.slot');
            if (slot) this.handleDragLeave(e, slot);
        });
        this.gameBoard.addEventListener('drop', (e) => {
            const slot = e.target.closest('.slot');
            if (slot) this.handleDrop(e, slot);
        });

        // --- Pointer drag (touch/mouse/pen) + tap-to-place ---
        this.shapeTray.addEventListener('pointerdown', (e) => {
            const shape = e.target.closest('.shape');
            if (!shape || !this.gameActive || this.paused) return;
            this.ensureAudio();
            this.pointerDrag = {
                shape,
                startX: e.clientX,
                startY: e.clientY,
                active: false,
                ghost: null,
                pointerId: e.pointerId,
            };
        });
        const cancelPointerDrag = () => {
            const pd = this.pointerDrag;
            if (!pd) return;
            this.pointerDrag = null;
            if (pd.ghost) pd.ghost.remove();
            pd.shape.classList.remove('dragging');
            document.body.classList.remove('is-dragging');
            this.draggedShape = null;
            this.clearDragStates();
        };
        window.addEventListener('pointermove', (e) => {
            const pd = this.pointerDrag;
            if (!pd || !this.gameActive || this.paused) return;
            if (e.pointerId !== undefined && pd.pointerId !== undefined && e.pointerId !== pd.pointerId) return;
            const dx = e.clientX - pd.startX;
            const dy = e.clientY - pd.startY;
            if (!pd.active && Math.hypot(dx, dy) > 10) {
                pd.active = true;
                this.draggedShape = pd.shape;
                pd.shape.classList.add('dragging');
                document.body.classList.add('is-dragging');
                try {
                    if (pd.shape.setPointerCapture && e.pointerId !== undefined) {
                        // Capture on the tray so we keep receiving moves; hit-test via elementFromPoint
                        this.shapeTray.setPointerCapture(e.pointerId);
                    }
                } catch (err) { /* capture unsupported — continue without it */ }
                const ghost = pd.shape.cloneNode(true);
                ghost.className = 'shape drag-ghost';
                const size = pd.shape.offsetWidth || 64;
                ghost.style.width = `${size}px`;
                ghost.style.height = `${size}px`;
                pd.half = size / 2;
                document.body.appendChild(ghost);
                pd.ghost = ghost;
                this.clearSelection();
            }
            if (pd.active) {
                if (e.cancelable) e.preventDefault();
                if (pd.ghost) {
                    const half = pd.half || 39;
                    pd.ghost.style.left = `${e.clientX - half}px`;
                    pd.ghost.style.top = `${e.clientY - half}px`;
                }
                const el = document.elementFromPoint(e.clientX, e.clientY);
                // Ghost has pointer-events:none so elementFromPoint sees the slot beneath
                const slot = el && el.closest ? el.closest('.slot') : null;
                this.clearDragStates();
                if (slot && this.gameBoard.contains(slot) && !slot.querySelector('.placed')) {
                    this.currentDragTarget = slot;
                    const ok = slot.dataset.expectedShape === pd.shape.dataset.shapeType;
                    slot.classList.add(ok ? 'valid-drop' : 'invalid-drop', 'drag-over');
                }
            }
        }, { passive: false });
        window.addEventListener('pointerup', (e) => {
            const pd = this.pointerDrag;
            if (!pd) return;
            if (e.pointerId !== undefined && pd.pointerId !== undefined && e.pointerId !== pd.pointerId) return;
            this.pointerDrag = null;
            if (pd.ghost) pd.ghost.remove();
            pd.shape.classList.remove('dragging');
            document.body.classList.remove('is-dragging');
            if (!this.gameActive || this.paused) { this.draggedShape = null; this.clearDragStates(); return; }
            if (pd.active) {
                const el = document.elementFromPoint(e.clientX, e.clientY);
                const slot = el && el.closest ? el.closest('.slot') : null;
                if (slot && this.gameBoard.contains(slot)) {
                    this.draggedShape = pd.shape;
                    this.placeByRule(slot, pd.shape);
                }
                this.draggedShape = null;
                this.clearDragStates();
            } else {
                // tap = select / place
                this.handleTap(pd.shape);
            }
        });
        window.addEventListener('pointercancel', cancelPointerDrag);

        // Long-press context menu would interrupt touch drags — suppress on game surfaces
        this.shapeTray.addEventListener('contextmenu', (e) => e.preventDefault());
        this.gameBoard.addEventListener('contextmenu', (e) => e.preventDefault());
        // Older iOS Safari may scroll from touchmove even with touch-action:none —
        // hold the page still while a piece drag is active.
        document.addEventListener('touchmove', (e) => {
            if (this.pointerDrag && this.pointerDrag.active && e.cancelable) e.preventDefault();
        }, { passive: false });

        // --- Tap on empty slot with a selected shape ---
        this.gameBoard.addEventListener('click', (e) => {
            const slot = e.target.closest('.slot');
            if (slot && this.selectedShape) this.placeByRule(slot, this.selectedShape);
        });

        // --- Keyboard: tray select + board arrows/enter ---
        document.addEventListener('keydown', (e) => {
            if (!this.gameActive || this.paused) {
                if (e.key === 'Escape') this.clearSelection();
                return;
            }
            const shape = e.target.closest ? e.target.closest('.shape') : null;
            const slot = e.target.closest ? e.target.closest('.slot') : null;
            if (shape && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                this.handleTap(shape);
            } else if (slot && e.key === 'Enter') {
                e.preventDefault();
                if (this.selectedShape) this.placeByRule(slot, this.selectedShape);
            } else if (slot && e.key.startsWith('Arrow')) {
                e.preventDefault();
                this.moveSlotFocus(slot, e.key);
            } else if (e.key === 'Escape') {
                this.clearSelection();
            }
        });

        // Prevent default drag behaviors (bound once)
        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => e.preventDefault());
    }

    handleTap(shape) {
        if (!this.gameActive || this.paused) return;
        if (this.selectedShape === shape) {
            this.clearSelection();
            return;
        }
        this.clearSelection();
        this.selectedShape = shape;
        shape.classList.add('selected');
        shape.setAttribute('aria-grabbed', 'true');
        this.showMessage(`${shape.dataset.shapeType} selected. Choose a board slot.`, 'info');
    }

    clearSelection() {
        if (this.selectedShape) {
            this.selectedShape.classList.remove('selected');
            this.selectedShape.setAttribute('aria-grabbed', 'false');
            this.selectedShape = null;
        }
    }

    moveSlotFocus(slot, key) {
        const r = Number(slot.dataset.row);
        const c = Number(slot.dataset.col);
        let nr = r; let nc = c;
        if (key === 'ArrowUp') nr = Math.max(0, r - 1);
        if (key === 'ArrowDown') nr = Math.min(this.rows - 1, r + 1);
        if (key === 'ArrowLeft') nc = Math.max(0, c - 1);
        if (key === 'ArrowRight') nc = Math.min(this.cols - 1, c + 1);
        const next = this.slots.find((s) => Number(s.dataset.row) === nr && Number(s.dataset.col) === nc);
        if (next) next.focus();
    }

    placeByRule(slot, shape) {
        if (!this.gameActive || this.paused || !shape) return;
        if (slot.querySelector('.placed')) {
            this.showMessage('That slot is already filled.', 'error');
            return;
        }
        this.draggedShape = shape;
        const expectedShape = slot.dataset.expectedShape;
        if (expectedShape === shape.dataset.shapeType) {
            this.clearDragStates();
            this.placeShape(slot, shape);
            this.clearSelection();
            this.checkWinCondition();
        } else {
            this.clearDragStates();
            this.showMessage('Wrong shape! Try again.', 'error');
            this.bounceShapeBack();
        }
        if (!slot.querySelector('.placed')) this.draggedShape = null;
    }

    handleDragStart(e, shape) {
        if (!this.gameActive || this.paused) {
            e.preventDefault();
            return;
        }

        this.draggedShape = shape;
        shape.classList.add('dragging');
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            try {
                e.dataTransfer.setData('text/plain', shape.dataset.shapeType);
            } catch (err) {
                // Some synthetic drag events have no dataTransfer payload support
            }
        }

        // Add a small delay to make the drag ghost visible
        this.later(() => {
            shape.style.opacity = '0.5';
        }, 0);
    }

    handleDragEnd(e, shape) {
        shape.classList.remove('dragging');
        shape.style.opacity = '1';
        this.draggedShape = null;

        // Clear all drag states
        this.clearDragStates();
    }

    handleDragEnter(e, slot) {
        if (!this.gameActive || this.paused || !this.draggedShape) return;

        e.preventDefault();
        this.currentDragTarget = slot;

        // Check if this is a valid drop target
        const expectedShape = slot.dataset.expectedShape;
        const droppedShape = this.draggedShape.dataset.shapeType;

        if (expectedShape === droppedShape) {
            slot.classList.add('valid-drop');
            slot.classList.remove('invalid-drop');
        } else {
            slot.classList.add('invalid-drop');
            slot.classList.remove('valid-drop');
        }
    }

    handleDragOver(e, slot) {
        if (!this.gameActive || this.paused) return;

        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
        }

        // Only show drag-over effect for valid targets
        if (this.currentDragTarget === slot) {
            slot.classList.add('drag-over');
        }
    }

    handleDragLeave(e, slot) {
        // Only remove classes if we're actually leaving the slot
        if (!e.relatedTarget || !slot.contains(e.relatedTarget)) {
            slot.classList.remove('drag-over', 'valid-drop', 'invalid-drop');
            if (this.currentDragTarget === slot) {
                this.currentDragTarget = null;
            }
        }
    }

    handleDrop(e, slot) {
        if (!this.gameActive || this.paused || !this.draggedShape) return;

        e.preventDefault();
        e.stopPropagation();
        this.placeByRule(slot, this.draggedShape);
        this.draggedShape = null;
    }

    clearDragStates() {
        this.slots.forEach((slot) => {
            slot.classList.remove('drag-over', 'valid-drop', 'invalid-drop');
        });
        this.currentDragTarget = null;
    }

    bounceShapeBack() {
        if (this.draggedShape) {
            const shape = this.draggedShape; // Store reference
            shape.style.animation = 'shake 0.5s ease-in-out';
            this.later(() => {
                if (shape && shape.style) {
                    shape.style.animation = '';
                }
            }, 500);
        }
    }

    // A placed piece is a "sticker" cut from the full-win artwork:
    // same image, scaled so the slot shows exactly its own hole region.
    // This guarantees the piece art registers pixel-perfect with the
    // board at any board size (unlike stretching the 44px tile PNGs).
    makePlacedSticker(slot) {
        const hole = HOLE_RECTS[Number(slot.dataset.hole)];
        const W = hole.w * 100;
        const H = hole.h * 100;
        const L = hole.x * 100;
        const T = hole.y * 100;
        const sticker = document.createElement('div');
        sticker.className = 'placed placed-piece';
        sticker.style.backgroundImage = "url('assets/Board/full-win.png')";
        sticker.style.backgroundRepeat = 'no-repeat';
        sticker.style.backgroundSize = `${10000 / W}% ${10000 / H}%`;
        sticker.style.backgroundPosition = `${(L / (100 - W)) * 100}% ${(T / (100 - H)) * 100}%`;
        return sticker;
    }

    placeShape(slot, shape) {
        // Remove shape from tray
        shape.remove();

        // Cover the hole with its art slice
        const placedShape = this.makePlacedSticker(slot);

        // Clear any existing content in the slot
        slot.innerHTML = '';
        slot.appendChild(placedShape);
        slot.setAttribute('aria-label', `Filled slot row ${Number(slot.dataset.row) + 1} column ${Number(slot.dataset.col) + 1}`);

        this.placedShapes++;
        this.updateProgress();

        // Update board appearance when all shapes are placed
        if (this.placedShapes === this.totalShapes) {
            this.gameBoard.classList.add('filled');
        }

        this.playSnap();
        this.playPlacementEffect(slot);
        this.showGridAlignment();
    }

    showGridAlignment() {
        // Temporary grid highlight effect (styled in style.css)
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const gridHighlight = document.createElement('div');
        gridHighlight.className = 'grid-highlight';
        this.gameBoard.appendChild(gridHighlight);
        this.later(() => gridHighlight.remove(), 600);
    }

    playPlacementEffect(slot) {
        // Slot-local pop (styled in style.css)
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const effect = document.createElement('div');
        effect.className = 'place-pop';
        effect.textContent = '✓';
        (slot || document.body).appendChild(effect);
        this.later(() => effect.remove(), 800);
    }

    startGame() {
        if (this.gameActive) return;
        this.ensureAudio();
        this.clearAllTimers();
        this.cleanupEffects();
        this.gameActive = true;
        this.paused = false;
        this.won = false;
        this.timeLeft = this.currentConfig().time;
        if (this.switchLabel) this.switchLabel.textContent = 'Reset';
        if (this.pauseButton) this.pauseButton.textContent = '⏸ Pause';

        // Start timer sound
        if (this.timerSound) {
            this.timerSound.currentTime = 0;
            this.timerSound.play().catch(() => {});
        }

        this.updateTimer();
        this.updateProgress();
        this.timerInterval = setInterval(() => {
            if (this.paused || this.won) return;
            this.timeLeft--;
            this.updateTimer();
            if (this.timeLeft <= 0) {
                this.endGame(false);
            }
        }, 1000);
        this.showMessage('Game started! Place all shapes correctly before time runs out!', 'info');
    }

    togglePause(force) {
        if (!this.gameActive) return;
        const wantPause = typeof force === 'boolean' ? force : !this.paused;
        if (wantPause === this.paused) return;
        this.paused = wantPause;
        if (this.pauseButton) this.pauseButton.textContent = this.paused ? '▶ Resume' : '⏸ Pause';
        if (this.timerSound) {
            if (this.paused) this.timerSound.pause();
            else if (!this.muted) this.timerSound.play().catch(() => {});
        }
        this.showMessage(this.paused ? 'Paused. Press Resume to continue.' : 'Resumed!', 'info');
    }

    resetGame(silent = false) {
        this.clearAllTimers();
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.gameActive = false;
        this.paused = false;
        this.won = false;
        this.draggedShape = null;
        this.pointerDrag = null;
        this.cleanupEffects();
        this.clearSelection();
        this.createGameBoard();
        this.createShapes();
        // listeners are delegated + bound once; no re-binding here
        this.timeLeft = this.currentConfig().time;
        this.updateTimer();
        this.updateProgress();
        if (this.switchInput) this.switchInput.checked = false;
        if (this.switchLabel) this.switchLabel.textContent = 'Start';
        if (this.pauseButton) this.pauseButton.textContent = '⏸ Pause';

        // Ensure timer sound is stopped on reset
        if (this.timerSound) {
            this.timerSound.pause();
            this.timerSound.currentTime = 0;
        }

        if (!silent) this.showMessage('Game reset! Click Start to begin.', 'info');
    }

    cleanupEffects() {
        document.querySelectorAll('.spilled-tile, .grid-highlight, .place-pop').forEach((n) => n.remove());
        document.body.style.animation = '';
    }

    endGame(won = null) {
        this.gameActive = false;
        this.clearAllTimers();
        if (this.switchLabel) this.switchLabel.textContent = 'Start';
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        // Stop timer sound
        if (this.timerSound) {
            this.timerSound.pause();
            this.timerSound.currentTime = 0;
        }

        if (won === true) {
            this.saveBest();
            this.recordWin();
            this.showMessage(`Congratulations! You won with ${this.timeLeft} seconds remaining!`, 'win', { sticky: true });
        } else if (won === false) {
            if (this.won) return; // win already locked in
            this.recordPop();
            this.showMessage('Time\'s up! Game over!', 'lose', { sticky: true });
            this.playLoseEffect();
            // Play ending sound for losing
            if (this.endingSound) {
                this.endingSound.currentTime = 0;
                this.endingSound.play().catch(() => {});
            }
        }
    }

    playLoseEffect() {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        // Visual effect for losing
        document.body.style.animation = 'shake 0.5s ease-in-out';
        this.later(() => {
            document.body.style.animation = '';
        }, 500);

        // Spill over effect for all placed tiles (animate the real tiles)
        const placedTiles = this.gameBoard.querySelectorAll('.placed');
        placedTiles.forEach((tile) => {
            // Get the tile's current position relative to the viewport
            const rect = tile.getBoundingClientRect();
            // Convert to fixed position on the page
            tile.style.position = 'fixed';
            tile.style.left = `${rect.left}px`;
            tile.style.top = `${rect.top}px`;
            tile.style.width = `${rect.width}px`;
            tile.style.height = `${rect.height}px`;
            tile.style.margin = '0';
            tile.style.zIndex = 2000;
            tile.style.pointerEvents = 'none';
            tile.classList.add('spilled-tile');

            // Animate: pop out, then scatter
            const angle = Math.random() * 2 * Math.PI;
            const distance = 220 + Math.random() * 220; // px
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            const rotate = (Math.random() - 0.5) * 1080; // -540 to 540 deg
            const scale = 1.5 + Math.random() * 0.7;

            // Pop out (scale up quickly)
            tile.style.transition = 'transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)';
            tile.style.transform = 'scale(1.25)';
            const scatterId = setTimeout(() => {
                // Scatter with rotation and fade
                tile.style.transition = 'transform 1.2s cubic-bezier(0.22, 1, 0.36, 1), opacity 1.2s';
                tile.style.transform = `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${scale})`;
                tile.style.opacity = '0.7';
            }, 180);
            this.timeouts.add(scatterId);

            // Optionally remove after animation
            const removeId = setTimeout(() => {
                tile.remove();
            }, 1800);
            this.timeouts.add(removeId);
        });
    }

    checkWinCondition() {
        if (this.placedShapes === this.totalShapes) {
            // Stop the clock immediately so a win on the last second
            // can't be overwritten by the lose timer.
            this.won = true;
            this.gameActive = false;
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
            if (this.timerSound) {
                this.timerSound.pause();
            }
            // Show the win image (5×5 only: the win art shows all 25
            // holes filled, which would be a lie in 3×3 easy mode —
            // there the placed stickers on the empty board ARE the win).
            if (this.rows === 5 && this.cols === 5) {
                this.gameBoard.classList.remove('filled');
                this.gameBoard.classList.add('win');
            }

            // End the game after a short delay to show the win image
            this.winTimeoutId = setTimeout(() => {
                this.timeouts.delete(this.winTimeoutId);
                this.winTimeoutId = null;
                this.endGame(true);
            }, CONFIG.WIN_DELAY_MS);
            this.timeouts.add(this.winTimeoutId);
        }
    }

    updateTimer() {
        // Rotate the timer dial image
        const total = this.currentConfig().time;
        const percent = Math.max(0, this.timeLeft) / total;
        const rotation = (1 - percent) * 360; // 0 degrees at full, 360 at 0
        if (this.dialImg) {
            this.dialImg.style.transform = `rotate(${rotation}deg)`;
        }
        if (this.timerNumber) {
            this.timerNumber.textContent = Math.max(0, this.timeLeft);
            this.timerNumber.classList.toggle('low-time', this.timeLeft <= 10);
        }
    }

    updateProgress() {
        if (this.progressElement) {
            this.progressElement.textContent = `Placed ${this.placedShapes}/${this.totalShapes}`;
        }
    }

    bestKey() {
        return `perfection.best.${this.difficulty}`;
    }

    renderBest() {
        if (!this.bestElement) return;
        const raw = localStorage.getItem(this.bestKey());
        this.bestElement.textContent = raw ? `Best: ${raw}s left` : 'Best: —';
    }

    saveBest() {
        try {
            const key = this.bestKey();
            const prev = Number(localStorage.getItem(key) || '0');
            if (this.timeLeft > prev) {
                localStorage.setItem(key, String(this.timeLeft));
            }
            this.renderBest();
        } catch (e) { /* private mode */ }
    }

    loadScoreList(key) {
        try {
            const raw = JSON.parse(localStorage.getItem(key) || '[]');
            return Array.isArray(raw) ? raw : [];
        } catch (e) {
            return [];
        }
    }

    saveScoreList(key, list) {
        try {
            localStorage.setItem(key, JSON.stringify(list.slice(0, SCORE_LIMIT)));
        } catch (e) { /* private mode */ }
    }

    diffShort(name) {
        const d = DIFFICULTIES[name];
        if (!d) return name;
        return `${d.rows}×${d.cols} · ${d.time}s`;
    }

    formatDay(t) {
        try {
            return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        } catch (e) {
            return '';
        }
    }

    recordWin() {
        const limit = this.currentConfig().time;
        const list = this.loadScoreList(WINS_KEY);
        list.unshift({
            d: this.difficulty,
            used: limit - this.timeLeft,
            left: this.timeLeft,
            limit,
            t: Date.now(),
        });
        this.saveScoreList(WINS_KEY, list);
        this.renderScores();
    }

    recordPop() {
        const list = this.loadScoreList(POPS_KEY);
        list.unshift({
            d: this.difficulty,
            placed: this.placedShapes,
            total: this.totalShapes,
            limit: this.currentConfig().time,
            t: Date.now(),
        });
        this.saveScoreList(POPS_KEY, list);
        this.renderScores();
    }

    renderScores() {
        // --- Wins: fastest completion (least seconds used) is best ---
        if (this.winsBest && this.winsList) {
            const wins = this.loadScoreList(WINS_KEY);
            if (!wins.length) {
                this.winsBest.textContent = 'No wins yet';
                this.winsList.innerHTML = '';
            } else {
                const best = wins.reduce((a, b) => (b.used < a.used ? b : a), wins[0]);
                this.winsBest.textContent = `Best: ${best.used}s (${this.diffShort(best.d)})`;
                this.winsList.innerHTML = '';
                wins.slice(0, 8).forEach((w) => {
                    const li = document.createElement('li');
                    li.textContent = `${w.used}s · ${this.diffShort(w.d)} · ${this.formatDay(w.t)}`;
                    this.winsList.appendChild(li);
                });
            }
        }
        // --- Pops: most pieces placed is best ---
        if (this.popsBest && this.popsList) {
            const pops = this.loadScoreList(POPS_KEY);
            if (!pops.length) {
                this.popsBest.textContent = 'No pops yet';
                this.popsList.innerHTML = '';
            } else {
                const ratio = (p) => (p.total ? p.placed / p.total : 0);
                const best = pops.reduce((a, b) => {
                    const ra = ratio(a); const rb = ratio(b);
                    if (rb !== ra) return rb > ra ? b : a;
                    return b.placed > a.placed ? b : a;
                }, pops[0]);
                this.popsBest.textContent = `Best: ${best.placed}/${best.total} (${this.diffShort(best.d)})`;
                this.popsList.innerHTML = '';
                pops.slice(0, 8).forEach((p) => {
                    const li = document.createElement('li');
                    li.textContent = `${p.placed}/${p.total} · ${this.diffShort(p.d)} · ${this.formatDay(p.t)}`;
                    this.popsList.appendChild(li);
                });
            }
        }
    }

    showMessage(text, type = 'info', opts = {}) {
        const sticky = opts.sticky === true || type === 'win' || type === 'lose';
        this.messageElement.textContent = text;
        this.messageElement.className = `message ${type} show`;
        this.messageElement.setAttribute('role', (type === 'win' || type === 'lose') ? 'alert' : 'status');

        if (this.messageTimeoutId) {
            clearTimeout(this.messageTimeoutId);
            this.messageTimeoutId = null;
        }
        if (!sticky) {
            this.messageTimeoutId = setTimeout(() => {
                this.messageElement.classList.remove('show');
                this.messageTimeoutId = null;
            }, CONFIG.MESSAGE_HIDE_MS);
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new PerfectionGame();
});
