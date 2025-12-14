// 1 = Active Slot, 0 = Empty Gap
const HEART_SHAPE = [
  [0, 1, 1, 0, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 0, 0, 0],
];

const ROWS = HEART_SHAPE.length;
const COLS = HEART_SHAPE[0].length;

const TYPE_STRAIGHT = 0;
const TYPE_CURVE = 1;

let gridData = [];
let currentLevel = 1;
let hearts = 3;
let isAnimating = false;

// Coordinates: 0:Up, 1:Right, 2:Down, 3:Left
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

let gridEl, levelDisplay, heartsDisplay, winModal, loseModal;

// --- ICONS ---
// Straight arrow pointing UP
const SVG_STRAIGHT = `
<svg viewBox="0 0 100 100" class="arrow-svg type-straight">
    <path d="M40 90 L40 35 L20 35 L50 5 L80 35 L60 35 L60 90 Z" />
</svg>`;

// Curved arrow: Starts UP, Curves RIGHT (Exit is Right)
const SVG_CURVE = `
<svg viewBox="0 0 100 100" class="arrow-svg type-curve">
    <path d="M40 95 L40 55 Q40 30 65 30 L65 45 L95 20 L65 -5 L65 10 Q20 10 20 55 L20 95 Z" />
</svg>`;

function initGame() {
  // Ensure DOM elements are available
  gridEl = document.getElementById("grid");
  levelDisplay = document.getElementById("level-display");
  heartsDisplay = document.querySelector(".hearts");
  winModal = document.getElementById("win-modal");
  loseModal = document.getElementById("gameover-modal");

  if (!gridEl || !levelDisplay || !heartsDisplay || !winModal || !loseModal) {
    console.error("Required DOM elements not found");
    return;
  }

  createGridDOM();
  startLevel(1);
}

function createGridDOM() {
  gridEl.innerHTML = "";
  gridEl.style.gridTemplateColumns = `repeat(${COLS}, var(--tile-size))`;
  gridEl.style.gridTemplateRows = `repeat(${ROWS}, var(--tile-size))`;

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      if (HEART_SHAPE[y][x] === 0) cell.classList.add("empty");
      gridEl.appendChild(cell);
    }
  }
}

function startLevel(lvl) {
  currentLevel = lvl;
  levelDisplay.innerText = lvl;
  hearts = 3;
  updateHearts();
  winModal.classList.remove("active");
  loseModal.classList.remove("active");
  isAnimating = false;

  // Retry generation until we find a layout that FILLS the board
  // and is mathematically solvable.
  // Add safety limit to prevent infinite loops
  let success = false;
  let retries = 0;
  const MAX_RETRIES = 100;

  while (!success && retries < MAX_RETRIES) {
    success = generateFullBoard();
    retries++;
  }

  if (!success) {
    // If we couldn't generate a valid board after many attempts,
    // generate a simpler board that might not be fully filled
    console.warn("Could not generate full board, using partial board");
    generatePartialBoard();
  }

  renderBoard();
}

function updateHearts() {
  let hStr = "";
  for (let i = 0; i < hearts; i++) hStr += "❤️";
  heartsDisplay.innerText = hStr || "💔";
}

// Attempts to fill every single slot in the heart
function generateFullBoard() {
  gridData = Array(ROWS)
    .fill(null)
    .map(() => Array(COLS).fill(null));

  let validSpots = 0;
  HEART_SHAPE.forEach((row) =>
    row.forEach((val) => {
      if (val === 1) validSpots++;
    })
  );

  let placedCount = 0;
  let attempts = 0;
  const MAX_ATTEMPTS = 3000; // Reduced from 5000 for better performance

  // Get all valid positions upfront to avoid repeated random checks
  let validPositions = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (HEART_SHAPE[y][x] === 1) {
        validPositions.push({ x, y });
      }
    }
  }

  // Shuffle valid positions for randomness
  for (let i = validPositions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [validPositions[i], validPositions[j]] = [
      validPositions[j],
      validPositions[i],
    ];
  }

  let positionIndex = 0;

  while (placedCount < validSpots && attempts < MAX_ATTEMPTS) {
    attempts++;

    // Try positions in shuffled order, then fall back to random
    let x, y;
    if (positionIndex < validPositions.length) {
      ({ x, y } = validPositions[positionIndex]);
      positionIndex++;
    } else {
      x = Math.floor(Math.random() * COLS);
      y = Math.floor(Math.random() * ROWS);
    }

    // Can only place on valid heart cells that are currently empty
    if (HEART_SHAPE[y][x] === 0 || gridData[y][x] !== null) continue;

    // Randomize Type: Higher levels have more curves
    let type =
      Math.random() < 0.2 + currentLevel * 0.05 ? TYPE_CURVE : TYPE_STRAIGHT;
    let dir = Math.floor(Math.random() * 4);

    // Check if path is clear (Reverse Logic)
    if (checkPath(x, y, dir, type, true)) {
      gridData[y][x] = { dir: dir, type: type };
      placedCount++;
    }
  }

  return placedCount === validSpots;
}

// Fallback: Generate a partial board if full board generation fails
function generatePartialBoard() {
  gridData = Array(ROWS)
    .fill(null)
    .map(() => Array(COLS).fill(null));

  let validSpots = 0;
  HEART_SHAPE.forEach((row) =>
    row.forEach((val) => {
      if (val === 1) validSpots++;
    })
  );

  // Try to place at least 80% of the spots
  let targetSpots = Math.floor(validSpots * 0.8);
  let placedCount = 0;
  let attempts = 0;
  const MAX_ATTEMPTS = 2000;

  let validPositions = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (HEART_SHAPE[y][x] === 1) {
        validPositions.push({ x, y });
      }
    }
  }

  // Shuffle
  for (let i = validPositions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [validPositions[i], validPositions[j]] = [
      validPositions[j],
      validPositions[i],
    ];
  }

  for (let pos of validPositions) {
    if (placedCount >= targetSpots || attempts >= MAX_ATTEMPTS) break;

    let { x, y } = pos;
    if (gridData[y][x] !== null) continue;

    // Try all directions and types
    for (let type of [TYPE_STRAIGHT, TYPE_CURVE]) {
      for (let dir = 0; dir < 4; dir++) {
        attempts++;
        if (checkPath(x, y, dir, type, true)) {
          gridData[y][x] = { dir: dir, type: type };
          placedCount++;
          break;
        }
      }
      if (gridData[y][x] !== null) break;
    }
  }
}

/**
 * PATH FINDER
 * Straight: Checks vector 'dir'
 * Curve: Checks 1 step 'dir', then turns 90deg clockwise, then checks new vector
 */
/**
 * PATH FINDER - UPDATED
 * Straight: Checks vector 'dir'
 * Curve: Checks vector 'dir + 1' (The immediate exit face)
 */
function checkPath(startX, startY, dir, type, isGeneration) {
  let cx = startX;
  let cy = startY;

  // Determine the direction of movement/checking
  // Straight moves in 'dir', Curve moves in 'dir + 1' (90deg clockwise)
  let checkDir = dir;
  if (type === TYPE_CURVE) {
    checkDir = (dir + 1) % 4;
  }

  // Move first step in the actual Exit Direction
  cx += DX[checkDir];
  cy += DY[checkDir];

  // Continue in that direction until out of bounds or blocked
  while (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS) {
    if (isValidAndBlocked(cx, cy, isGeneration)) return false;
    cx += DX[checkDir];
    cy += DY[checkDir];
  }

  return true;
}

function isValidAndBlocked(x, y, isGeneration) {
  // Out of bounds is never blocked (it's freedom!)
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;

  // Empty gap in heart is effectively out of bounds (freedom)
  if (HEART_SHAPE[y][x] === 0) return false;

  // Collision check
  if (gridData[y][x] !== null) return true;

  return false;
}

function renderBoard() {
  const cells = document.querySelectorAll(".cell");

  // Clear functional cells
  cells.forEach((c) => {
    if (!c.classList.contains("empty")) c.innerHTML = "";
  });

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (gridData[y][x]) {
        const arrow = document.createElement("div");
        arrow.className = "arrow-container";
        arrow.dataset.dir = gridData[y][x].dir;
        arrow.dataset.type = gridData[y][x].type;

        // --- FIX: ROTATION OFFSET ---
        // Logic 1 (Right) needs to look like 0deg (Up)
        // Logic 3 (Left) needs to look like 180deg (Down)
        // Formula: (LogicDir * 90) - 90
        let rot = gridData[y][x].dir * 90 - 90;

        arrow.style.setProperty("--rotation", `rotate(${rot}deg)`);

        // Insert SVG based on type
        // Ensure we're comparing numbers correctly
        const arrowType = Number(gridData[y][x].type);
        arrow.innerHTML = arrowType === TYPE_CURVE ? SVG_CURVE : SVG_STRAIGHT;
        arrow.onclick = () => handleArrowClick(x, y, arrow);

        let index = y * COLS + x;
        cells[index].appendChild(arrow);
        gridData[y][x].el = arrow;
      }
    }
  }
}

function handleArrowClick(x, y, element) {
  if (isAnimating || gridData[y][x] === null) return;

  const obj = gridData[y][x];

  // Validate Move using the LOGICAL direction (which is Right/Left)
  if (checkPath(x, y, obj.dir, obj.type, false)) {
    isAnimating = true;

    // --- MOVEMENT LOGIC ---
    // Straight: Moves in 'obj.dir' (Right/Left)
    // Curve: Moves in 'obj.dir + 1' (Down/Up)
    let exitDir = obj.dir;

    // Ensure we're comparing numbers correctly
    const arrowType = Number(obj.type);
    if (arrowType === TYPE_CURVE) {
      exitDir = (obj.dir + 1) % 4;
    }

    // Calculate travel distance
    let dist = 800;
    let tx = DX[exitDir] * dist;
    let ty = DY[exitDir] * dist;

    element.classList.add("flying");

    // --- FIX: MATCH RENDER ROTATION ---
    // Ensure the flying arrow keeps the visual rotation we set in renderBoard
    let rot = obj.dir * 90 - 90;

    // Apply Translation
    element.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;

    // Remove from logical grid immediately
    gridData[y][x] = null;

    setTimeout(() => {
      if (element.parentNode) element.parentNode.removeChild(element);
      isAnimating = false;
      checkWin();
    }, 500);
  } else {
    // --- ERROR LOGIC ---
    hearts--;
    updateHearts();
    element.classList.remove("shake");
    void element.offsetWidth; // Force Reflow
    element.classList.add("shake");

    if (hearts <= 0) {
      setTimeout(() => loseModal.classList.add("active"), 500);
    }
  }
}

function checkWin() {
  let remaining = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (gridData[y][x] !== null) remaining++;
    }
  }
  if (remaining === 0) {
    setTimeout(() => winModal.classList.add("active"), 300);
  }
}

function nextLevel() {
  startLevel(currentLevel + 1);
}
function restartLevel() {
  startLevel(currentLevel);
}

// Wait for DOM to be ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGame);
} else {
  initGame();
}
