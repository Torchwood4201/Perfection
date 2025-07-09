class PerfectionGame {
    constructor() {
        this.gameBoard = document.getElementById('gameBoard');
        this.shapeTray = document.getElementById('shapeTray');
        this.timerElement = document.getElementById('timer');
        this.switchInput = document.getElementById('gameSwitch');
        this.switchLabel = document.getElementById('switchLabel');
        this.messageElement = document.getElementById('message');
        
        this.timeLeft = 60;
        this.timerInterval = null;
        this.gameActive = false;
        this.shapes = [];
        this.slots = [];
        this.draggedShape = null;
        this.placedShapes = 0;
        this.currentDragTarget = null;
        
        // Initialize sound effects
        this.timerSound = new Audio('assets/sounds/timer.mp3');
        this.endingSound = new Audio('assets/sounds/ending pop.mp3');
        this.timerSound.loop = true; // Timer sound should loop
        
        // Define the 25 shape types with their corresponding sprite images
        this.shapeTypes = [
            { name: 'shape0', sprite: 'assets/shapes/tile000.png' },
            { name: 'shape1', sprite: 'assets/shapes/tile001.png' },
            { name: 'shape2', sprite: 'assets/shapes/tile002.png' },
            { name: 'shape3', sprite: 'assets/shapes/tile003.png' },
            { name: 'shape4', sprite: 'assets/shapes/tile004.png' },
            { name: 'shape5', sprite: 'assets/shapes/tile005.png' },
            { name: 'shape6', sprite: 'assets/shapes/tile006.png' },
            { name: 'shape7', sprite: 'assets/shapes/tile007.png' },
            { name: 'shape8', sprite: 'assets/shapes/tile008.png' },
            { name: 'shape9', sprite: 'assets/shapes/tile009.png' },
            { name: 'shape10', sprite: 'assets/shapes/tile010.png' },
            { name: 'shape11', sprite: 'assets/shapes/tile011.png' },
            { name: 'shape12', sprite: 'assets/shapes/tile012.png' },
            { name: 'shape13', sprite: 'assets/shapes/tile013.png' },
            { name: 'shape14', sprite: 'assets/shapes/tile014.png' },
            { name: 'shape15', sprite: 'assets/shapes/tile015.png' },
            { name: 'shape16', sprite: 'assets/shapes/tile016.png' },
            { name: 'shape17', sprite: 'assets/shapes/tile017.png' },
            { name: 'shape18', sprite: 'assets/shapes/tile018.png' },
            { name: 'shape19', sprite: 'assets/shapes/tile019.png' },
            { name: 'shape20', sprite: 'assets/shapes/tile020.png' },
            { name: 'shape21', sprite: 'assets/shapes/tile021.png' },
            { name: 'shape22', sprite: 'assets/shapes/tile022.png' },
            { name: 'shape23', sprite: 'assets/shapes/tile023.png' },
            { name: 'shape24', sprite: 'assets/shapes/tile024.png' }
        ];
        
        this.init();
    }
    
    init() {
        this.createGameBoard();
        this.createShapes();
        this.setupEventListeners();
        this.updateTimer();
    }
    
    createGameBoard() {
        this.gameBoard.innerHTML = '';
        this.slots = [];
        this.placedShapes = 0;
        this.gameBoard.classList.remove('filled', 'win');
        
        // Create 5x5 grid of slots
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                const index = row * 5 + col;
                const slot = document.createElement('div');
                slot.className = 'slot';
                slot.dataset.index = index;
                slot.dataset.row = row;
                slot.dataset.col = col;
                slot.dataset.expectedShape = this.shapeTypes[index].name;
                
                this.gameBoard.appendChild(slot);
                this.slots.push(slot);
            }
        }
    }
    
    createShapes() {
        this.shapeTray.innerHTML = '';
        this.shapes = [];
        
        // Shuffle the shape types
        const shuffledShapes = [...this.shapeTypes].sort(() => Math.random() - 0.5);
        
        shuffledShapes.forEach((shapeType, index) => {
            const shape = document.createElement('div');
            shape.className = 'shape';
            shape.dataset.shapeType = shapeType.name;
            shape.dataset.originalIndex = index;
            
            // Create image element for the sprite
            const img = document.createElement('img');
            img.src = shapeType.sprite;
            img.alt = shapeType.name;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            
            shape.appendChild(img);
            this.shapeTray.appendChild(shape);
            this.shapes.push(shape);
        });
    }
    
    setupEventListeners() {
        if (this.switchInput) {
            this.switchInput.addEventListener('change', () => {
                if (this.switchInput.checked) {
                    this.startGame();
                    this.switchLabel.textContent = 'Reset';
                } else {
                    this.resetGame();
                    this.switchLabel.textContent = 'Start';
                }
            });
        }
        
        // Shape drag events
        this.shapes.forEach(shape => {
            shape.addEventListener('dragstart', (e) => this.handleDragStart(e, shape));
            shape.addEventListener('dragend', (e) => this.handleDragEnd(e, shape));
            shape.draggable = true;
        });
        
        // Slot drop events
        this.slots.forEach(slot => {
            slot.addEventListener('dragover', (e) => this.handleDragOver(e, slot));
            slot.addEventListener('dragenter', (e) => this.handleDragEnter(e, slot));
            slot.addEventListener('dragleave', (e) => this.handleDragLeave(e, slot));
            slot.addEventListener('drop', (e) => this.handleDrop(e, slot));
        });
        
        // Prevent default drag behaviors
        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => e.preventDefault());
    }
    
    handleDragStart(e, shape) {
        if (!this.gameActive) {
            e.preventDefault();
            return;
        }
        
        this.draggedShape = shape;
        shape.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', shape.outerHTML);
        
        // Add a small delay to make the drag ghost visible
        setTimeout(() => {
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
        if (!this.gameActive || !this.draggedShape) return;
        
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
        if (!this.gameActive) return;
        
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        // Only show drag-over effect for valid targets
        if (this.currentDragTarget === slot) {
            slot.classList.add('drag-over');
        }
    }
    
    handleDragLeave(e, slot) {
        // Only remove classes if we're actually leaving the slot
        if (!slot.contains(e.relatedTarget)) {
            slot.classList.remove('drag-over', 'valid-drop', 'invalid-drop');
            if (this.currentDragTarget === slot) {
                this.currentDragTarget = null;
            }
        }
    }
    
    handleDrop(e, slot) {
        if (!this.gameActive || !this.draggedShape) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        // Clear drag states
        this.clearDragStates();
        
        const expectedShape = slot.dataset.expectedShape;
        const droppedShape = this.draggedShape.dataset.shapeType;
        
        if (expectedShape === droppedShape) {
            this.placeShape(slot, this.draggedShape);
            this.checkWinCondition();
        } else {
            this.showMessage('Wrong shape! Try again.', 'error');
            // Return the shape to its original position with a bounce effect
            this.bounceShapeBack();
        }
    }
    
    clearDragStates() {
        this.slots.forEach(slot => {
            slot.classList.remove('drag-over', 'valid-drop', 'invalid-drop');
        });
        this.currentDragTarget = null;
    }
    
    bounceShapeBack() {
        if (this.draggedShape) {
            const shape = this.draggedShape; // Store reference
            shape.style.animation = 'shake 0.5s ease-in-out';
            setTimeout(() => {
                if (shape && shape.style) {
                    shape.style.animation = '';
                }
            }, 500);
        }
    }
    
    placeShape(slot, shape) {
        // Remove shape from tray
        shape.remove();
        
        // Create a copy for the slot
        const placedShape = shape.cloneNode(true);
        placedShape.classList.add('placed');
        placedShape.draggable = false;
        placedShape.style.opacity = '1';
        
        // Clear any existing content in the slot
        slot.innerHTML = '';
        slot.appendChild(placedShape);
        
        this.placedShapes++;
        
        // Update board appearance when all shapes are placed
        if (this.placedShapes === 25) {
            this.gameBoard.classList.add('filled');
        }
        
        this.showMessage('Correct!', 'success');
        
        // Play placement sound effect (visual feedback)
        this.playPlacementEffect();
        
        // Add a subtle grid alignment effect
        this.showGridAlignment();
    }
    
    showGridAlignment() {
        // Create a temporary grid highlight effect
        const gridHighlight = document.createElement('div');
        gridHighlight.style.cssText = `
            position: absolute;
            top: 20px;
            left: 20px;
            right: 20px;
            bottom: 20px;
            border: 2px solid #28a745;
            border-radius: 8px;
            pointer-events: none;
            z-index: 10;
            animation: gridPulse 0.6s ease-out forwards;
        `;
        
        this.gameBoard.appendChild(gridHighlight);
        
        setTimeout(() => {
            gridHighlight.remove();
        }, 600);
    }
    
    playPlacementEffect() {
        // Visual feedback for placement
        const effect = document.createElement('div');
        effect.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 2rem;
            color: #28a745;
            pointer-events: none;
            z-index: 1000;
            animation: fadeOut 1s ease-out forwards;
        `;
        effect.textContent = '✓';
        document.body.appendChild(effect);
        
        setTimeout(() => effect.remove(), 1000);
    }
    
    startGame() {
        if (this.gameActive) return;
        this.gameActive = true;
        this.timeLeft = 60;
        if (this.switchLabel) this.switchLabel.textContent = 'Reset';
        
        // Start timer sound
        this.timerSound.currentTime = 0;
        this.timerSound.play().catch(e => console.log('Timer sound failed to play:', e));
        
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateTimer();
            if (this.timeLeft <= 0) {
                this.endGame(false);
            }
        }, 1000);
        this.showMessage('Game started! Place all shapes correctly before time runs out!', 'info');
    }

    resetGame() {
        this.endGame();
        this.createGameBoard();
        this.createShapes();
        this.setupEventListeners();
        this.timeLeft = 60;
        this.updateTimer();
        if (this.switchInput) this.switchInput.checked = false;
        if (this.switchLabel) this.switchLabel.textContent = 'Start';
        
        // Ensure timer sound is stopped on reset
        this.timerSound.pause();
        this.timerSound.currentTime = 0;
        
        this.showMessage('Game reset! Click Start to begin.', 'info');
    }

    endGame(won = null) {
        this.gameActive = false;
        if (this.switchLabel) this.switchLabel.textContent = 'Start';
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        // Stop timer sound
        this.timerSound.pause();
        this.timerSound.currentTime = 0;
        
        if (won === true) {
            this.showMessage(`Congratulations! You won with ${this.timeLeft} seconds remaining!`, 'win');
        } else if (won === false) {
            this.showMessage('Time\'s up! Game over!', 'lose');
            this.playLoseEffect();
            // Play ending sound for losing
            this.endingSound.currentTime = 0;
            this.endingSound.play().catch(e => console.log('Ending sound failed to play:', e));
        }
    }
    
    playLoseEffect() {
        // Visual effect for losing
        document.body.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            document.body.style.animation = '';
        }, 500);

        // Spill over effect for all placed tiles (animate the real tiles)
        const placedTiles = this.gameBoard.querySelectorAll('.shape.placed');
        placedTiles.forEach(tile => {
            // Get the tile's current position relative to the viewport
            const rect = tile.getBoundingClientRect();
            // Convert to fixed position on the page
            tile.style.position = 'fixed';
            tile.style.left = rect.left + 'px';
            tile.style.top = rect.top + 'px';
            tile.style.width = rect.width + 'px';
            tile.style.height = rect.height + 'px';
            tile.style.margin = '0';
            tile.style.zIndex = 2000;
            tile.style.pointerEvents = 'none';
            tile.classList.add('spilled-tile');

            // Remove from the board so it doesn't affect layout
            // (But since it's fixed, it stays visually in place)
            // No need to append to body, just let it float

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
            setTimeout(() => {
                // Scatter with rotation and fade
                tile.style.transition = 'transform 1.2s cubic-bezier(0.22, 1, 0.36, 1), opacity 1.2s';
                tile.style.transform = `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${scale})`;
                tile.style.opacity = '0.7';
            }, 180);

            // Optionally remove after animation
            setTimeout(() => {
                tile.remove();
            }, 1800);
        });
    }
    
    checkWinCondition() {
        if (this.placedShapes === 25) {
            // Show the win image
            this.gameBoard.classList.remove('filled');
            this.gameBoard.classList.add('win');
            
            // End the game after a short delay to show the win image
            setTimeout(() => {
                this.endGame(true);
            }, 1000);
        }
    }
    
    updateTimer() {
        // Rotate the timer dial image
        const dialImg = this.timerElement.querySelector('.timer-dial-img');
        const total = 60;
        const percent = Math.max(0, this.timeLeft) / total;
        const rotation = (1 - percent) * 360; // 0 degrees at 60s, 360 degrees at 0s
        if (dialImg) {
            dialImg.style.transform = `rotate(${rotation}deg)`;
        }
    }
    
    showMessage(text, type = 'info') {
        this.messageElement.textContent = text;
        this.messageElement.className = `message ${type} show`;
        
        setTimeout(() => {
            this.messageElement.classList.remove('show');
        }, 3000);
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new PerfectionGame();
});

// Add CSS for additional animations
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
    }
    
    @keyframes fadeOut {
        0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(1.5); }
    }
    
    @keyframes gridPulse {
        0% { opacity: 0.8; transform: scale(0.95); }
        50% { opacity: 1; transform: scale(1.02); }
        100% { opacity: 0; transform: scale(1); }
    }
    
    .message.info {
        background: #d1ecf1;
        color: #0c5460;
        border: 2px solid #bee5eb;
    }
    
    .message.error {
        background: #f8d7da;
        color: #721c24;
        border: 2px solid #f5c6cb;
    }
    
    .message.success {
        background: #d4edda;
        color: #155724;
        border: 2px solid #c3e6cb;
    }
`;
document.head.appendChild(style); 