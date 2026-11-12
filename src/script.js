// Wild Bounty Showdown - Full Slot Engine (3-4-5-5-4-3 Grid, 3600 Ways, Gold Frames & x1024 Multiplier)

const REEL_SIZES = [3, 4, 5, 5, 4, 3];
const MULTIPLIERS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];

// Exact Paytable from PG Soft Wild Bounty Showdown
const SYMBOLS = {
    WILD:    { id: 'WILD',    icon: '🤠', label: 'WILD',    pays: {}, weight: 0 },
    SCATTER: { id: 'SCATTER', icon: '🪙', label: 'SCATTER', pays: {}, weight: 3 },
    OUTLAW:  { id: 'OUTLAW',  icon: '🥷', label: '',        pays: { 3: 10, 4: 20, 5: 30, 6: 50 }, weight: 7 },
    GUN:     { id: 'GUN',     icon: '🔫', label: '',        pays: { 3: 8,  4: 15, 5: 20, 6: 30 }, weight: 9 },
    HAT:     { id: 'HAT',     icon: '🎩', label: '',        pays: { 3: 5,  4: 10, 5: 15, 6: 20 }, weight: 12 },
    BOTTLE:  { id: 'BOTTLE',  icon: '🥃', label: '',        pays: { 3: 5,  4: 10, 5: 15, 6: 20 }, weight: 12 },
    A:       { id: 'A',       icon: 'A',  label: '',        pays: { 3: 2,  4: 4,  5: 6,  6: 10 }, weight: 18 },
    K:       { id: 'K',       icon: 'K',  label: '',        pays: { 3: 2,  4: 4,  5: 6,  6: 10 }, weight: 18 },
    Q:       { id: 'Q',       icon: 'Q',  label: '',        pays: { 3: 1,  4: 2,  5: 3,  6: 5  }, weight: 22 },
    J:       { id: 'J',       icon: 'J',  label: '',        pays: { 3: 1,  4: 2,  5: 3,  6: 5  }, weight: 22 }
};

const BET_OPTIONS = [10, 20, 40, 60, 100, 200, 500];

// Game State
let balance = 10000.00;
let betIndex = 1; // Default Tk20.00
let currentSpinWin = 0.00;
let multIndex = 0; // Index in MULTIPLIERS
let isSpinning = false;
let isTurbo = false;
let isAuto = false;
let freeSpinsRemaining = 0;
let inFreeSpins = false;
let grid = []; // 6 columns of cells: { sym, goldFrame, winning }

// Web Audio Synthesizer for Sound Effects
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function playTone(freq, type = 'sine', duration = 0.12, vol = 0.12) {
    try {
        if (!audioCtx) audioCtx = new AudioCtx();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
}

function playGunshotSound() {
    playTone(140, 'sawtooth', 0.18, 0.2);
    setTimeout(() => playTone(90, 'triangle', 0.22, 0.18), 50);
}

function playWinChime(step = 1) {
    const base = 380 + step * 70;
    playTone(base, 'triangle', 0.18, 0.15);
    setTimeout(() => playTone(base * 1.25, 'sine', 0.25, 0.18), 90);
}

// DOM Elements
const slotGridEl = document.getElementById('slot-grid');
const balanceEl = document.getElementById('balance-display');
const betEl = document.getElementById('bet-display');
const winEl = document.getElementById('win-display');
const bannerWinEl = document.getElementById('banner-win-val');
const spinBtn = document.getElementById('spin-btn');
const currentMultEl = document.getElementById('current-mult');
const nextMult1El = document.getElementById('next-mult-1');
const nextMult2El = document.getElementById('next-mult-2');
const centerMultPop = document.getElementById('center-mult-pop');
const fsBanner = document.getElementById('fs-banner');
const fsCountEl = document.getElementById('fs-count');

// Initialize Splash Screen & Board
window.addEventListener('DOMContentLoaded', () => {
    let progress = 0;
    const bar = document.getElementById('loading-bar');
    const txt = document.getElementById('loading-text');
    const startBtn = document.getElementById('start-game-btn');

    const interval = setInterval(() => {
        progress += 20;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            txt.style.display = 'none';
            startBtn.style.display = 'inline-block';
        }
        bar.style.width = progress + '%';
        txt.textContent = `Loading [${progress}%]`;
    }, 180);

    startBtn.addEventListener('click', () => {
        document.getElementById('splash-screen').style.display = 'none';
        playGunshotSound();
    });

    initBoard();
    updateUI();
});

function getRandomSymbol(colIndex) {
    const pool = [];
    Object.values(SYMBOLS).forEach(sym => {
        // Wild only spawns naturally on reels 2,3,4,5 occasionally or via Gold Frames
        if (sym.id === 'WILD') {
            if (colIndex >= 1 && colIndex <= 4) {
                pool.push({ id: 'WILD', weight: 2 });
            }
        } else {
            pool.push({ id: sym.id, weight: sym.weight });
        }
    });

    const totalWeight = pool.reduce((acc, item) => acc + item.weight, 0);
    let rand = Math.random() * totalWeight;
    for (const item of pool) {
        if (rand < item.weight) return item.id;
        rand -= item.weight;
    }
    return 'J';
}

function createCell(colIndex) {
    const symId = getRandomSymbol(colIndex);
    // Gold Framed symbols appear on reels 3 and 4 only (colIndex 2 and 3), excluding WILD and SCATTER
    let goldFrame = false;
    if ((colIndex === 2 || colIndex === 3) && symId !== 'WILD' && symId !== 'SCATTER') {
        goldFrame = Math.random() < 0.28; // 28% chance for Gold Frame on middle reels
    }
    return {
        sym: symId,
        goldFrame: goldFrame,
        winning: false
    };
}

function initBoard() {
    grid = [];
    for (let c = 0; c < 6; c++) {
        const col = [];
        for (let r = 0; r < REEL_SIZES[c]; r++) {
            col.push(createCell(c));
        }
        grid.push(col);
    }
    renderGrid(false);
}

function renderGrid(animateDrop = true) {
    slotGridEl.innerHTML = '';
    for (let c = 0; c < 6; c++) {
        const colDiv = document.createElement('div');
        colDiv.className = 'reel-col';
        for (let r = 0; r < REEL_SIZES[c]; r++) {
            const cell = grid[c][r];
            const symData = SYMBOLS[cell.sym];
            const cellDiv = document.createElement('div');
            cellDiv.className = `symbol-cell sym-${cell.sym}`;
            if (cell.goldFrame) cellDiv.classList.add('gold-frame');
            if (cell.winning) cellDiv.classList.add('win-glow');
            if (animateDrop) cellDiv.classList.add('drop-in');

            const iconSpan = document.createElement('span');
            iconSpan.className = 'sym-icon';
            iconSpan.textContent = symData.icon;
            cellDiv.appendChild(iconSpan);

            if (symData.label) {
                const labelSpan = document.createElement('span');
                labelSpan.className = 'sym-label';
                labelSpan.textContent = symData.label;
                cellDiv.appendChild(labelSpan);
            }

            colDiv.appendChild(cellDiv);
        }
        slotGridEl.appendChild(colDiv);
    }
}

function updateMultiplierUI() {
    const activeVal = MULTIPLIERS[multIndex];
    const next1 = MULTIPLIERS[Math.min(multIndex + 1, MULTIPLIERS.length - 1)];
    const next2 = MULTIPLIERS[Math.min(multIndex + 2, MULTIPLIERS.length - 1)];
    currentMultEl.textContent = 'x' + activeVal;
    nextMult1El.textContent = 'x' + next1;
    nextMult2El.textContent = 'x' + next2;
}

function updateUI() {
    const betAmt = BET_OPTIONS[betIndex];
    balanceEl.textContent = 'Tk' + balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    betEl.textContent = 'Tk' + betAmt.toFixed(2);
    winEl.textContent = 'Tk' + currentSpinWin.toFixed(2);
    bannerWinEl.textContent = currentSpinWin.toFixed(2);
    updateMultiplierUI();

    if (inFreeSpins) {
        fsBanner.style.display = 'block';
        fsCountEl.textContent = freeSpinsRemaining;
    } else {
        fsBanner.style.display = 'none';
    }
}

function sleep(ms) {
    const factor = isTurbo ? 0.45 : 1;
    return new Promise(resolve => setTimeout(resolve, ms * factor));
}

// Evaluate 3,600 Ways from leftmost reel to right
function evaluateWays() {
    let totalBaseWin = 0;
    const winningPositions = Array.from({ length: 6 }, () => new Set());

    // Check every paying symbol (excluding WILD and SCATTER)
    Object.keys(SYMBOLS).forEach(symId => {
        if (symId === 'WILD' || symId === 'SCATTER') return;

        let consecutiveReels = 0;
        let waysCount = 1;
        const matchedPerReel = [];

        for (let c = 0; c < 6; c++) {
            const matchingRows = [];
            for (let r = 0; r < REEL_SIZES[c]; r++) {
                const cellSym = grid[c][r].sym;
                if (cellSym === symId || cellSym === 'WILD') {
                    matchingRows.push(r);
                }
            }

            if (matchingRows.length > 0) {
                consecutiveReels++;
                waysCount *= matchingRows.length;
                matchedPerReel.push({ col: c, rows: matchingRows });
            } else {
                break;
            }
        }

        if (consecutiveReels >= 3) {
            const payVal = SYMBOLS[symId].pays[consecutiveReels] || 0;
            const betScale = BET_OPTIONS[betIndex] / 20; // Base bet 20
            const symWin = payVal * waysCount * betScale;
            totalBaseWin += symWin;

            matchedPerReel.forEach(item => {
                item.rows.forEach(r => winningPositions[item.col].add(r));
            });
        }
    });

    return { totalBaseWin, winningPositions };
}

function countScatters() {
    let count = 0;
    for (let c = 0; c < 6; c++) {
        for (let r = 0; r < REEL_SIZES[c]; r++) {
            if (grid[c][r].sym === 'SCATTER') count++;
        }
    }
    return count;
}

async function showCenterMultPopup(multVal) {
    centerMultPop.textContent = 'x' + multVal;
    centerMultPop.classList.add('show');
    await sleep(420);
    centerMultPop.classList.remove('show');
}

async function playSpin() {
    if (isSpinning) return;

    const betAmt = BET_OPTIONS[betIndex];
    if (!inFreeSpins && balance < betAmt) {
        alert("Insufficient Balance!");
        isAuto = false;
        document.getElementById('auto-btn').classList.remove('active');
        return;
    }

    isSpinning = true;
    spinBtn.classList.add('spinning');
    currentSpinWin = 0;

    if (!inFreeSpins) {
        balance -= betAmt;
        multIndex = 0; // Reset to x1 in normal mode
    } else {
        freeSpinsRemaining--;
        multIndex = 3; // Free Spins start at x8 (index 3)
    }

    updateUI();
    playTone(220, 'sine', 0.15, 0.1);

    // Generate fresh board
    initBoard();
    renderGrid(true);
    await sleep(320);

    // Cascade Loop
    let cascadeStep = 0;
    while (true) {
        const { totalBaseWin, winningPositions } = evaluateWays();
        if (totalBaseWin <= 0) break;

        cascadeStep++;
        const activeMult = MULTIPLIERS[multIndex];
        const stepWin = totalBaseWin * activeMult;
        currentSpinWin += stepWin;

        // Mark winning cells
        for (let c = 0; c < 6; c++) {
            winningPositions[c].forEach(r => {
                grid[c][r].winning = true;
            });
        }

        renderGrid(false);
        playWinChime(cascadeStep);
        if (activeMult > 1) {
            await showCenterMultPopup(activeMult);
        }
        updateUI();
        await sleep(550);

        // Cascade Removal & Gold Frame Transformation to WILD
        for (let c = 0; c < 6; c++) {
            const newCol = [];
            for (let r = 0; r < REEL_SIZES[c]; r++) {
                const cell = grid[c][r];
                if (cell.winning) {
                    // Gold Framed symbols transform into WILD instead of disappearing!
                    if (cell.goldFrame) {
                        newCol.push({
                            sym: 'WILD',
                            goldFrame: false,
                            winning: false
                        });
                    }
                } else {
                    newCol.push(cell);
                }
            }
            // Fill missing top cells with new falling symbols
            while (newCol.length < REEL_SIZES[c]) {
                newCol.unshift(createCell(c));
            }
            grid[c] = newCol;
        }

        // Double the multiplier for the next cascade (up to x1024)
        if (multIndex < MULTIPLIERS.length - 1) {
            multIndex++;
        }

        updateUI();
        renderGrid(true);
        await sleep(380);
    }

    // Add total spin win to balance
    if (currentSpinWin > 0) {
        balance += currentSpinWin;
        updateUI();

        // Check for Big Win (15x+ bet)
        if (currentSpinWin >= betAmt * 15) {
            await triggerBigWinModal(currentSpinWin, betAmt);
        }
    }

    // Check Scatter Trigger for Free Spins
    const scatters = countScatters();
    if (scatters >= 3) {
        const awardedSpins = 10 + (scatters - 3) * 2;
        freeSpinsRemaining += awardedSpins;
        inFreeSpins = true;
        playGunshotSound();
        alert(`🎉 SCATTER TRIGGERED! ${awardedSpins} Free Spins Awarded (Starting Multiplier x8)!`);
        updateUI();
    }

    if (inFreeSpins && freeSpinsRemaining <= 0) {
        inFreeSpins = false;
        alert("🤠 Free Spins Feature Complete!");
        updateUI();
    }

    isSpinning = false;
    spinBtn.classList.remove('spinning');

    if (isAuto || inFreeSpins) {
        await sleep(450);
        playSpin();
    }
}

function triggerBigWinModal(amount, betAmt) {
    return new Promise(resolve => {
        const modal = document.getElementById('big-win-modal');
        const titleEl = document.getElementById('big-win-title');
        const amtEl = document.getElementById('big-win-amount');

        if (amount >= betAmt * 50) titleEl.textContent = "SUPER MEGA WIN";
        else if (amount >= betAmt * 30) titleEl.textContent = "MEGA WIN";
        else titleEl.textContent = "BIG WIN";

        amtEl.textContent = amount.toFixed(2);
        modal.style.display = 'flex';
        playGunshotSound();

        const closeHandler = () => {
            modal.style.display = 'none';
            modal.removeEventListener('click', closeHandler);
            resolve();
        };
        modal.addEventListener('click', closeHandler);
    });
}

// Event Listeners
spinBtn.addEventListener('click', () => {
    playSpin();
});

document.getElementById('bet-minus-btn').addEventListener('click', () => {
    if (isSpinning || inFreeSpins) return;
    if (betIndex > 0) {
        betIndex--;
        updateUI();
    }
});

document.getElementById('bet-plus-btn').addEventListener('click', () => {
    if (isSpinning || inFreeSpins) return;
    if (betIndex < BET_OPTIONS.length - 1) {
        betIndex++;
        updateUI();
    }
});

document.getElementById('turbo-btn').addEventListener('click', (e) => {
    isTurbo = !isTurbo;
    e.currentTarget.classList.toggle('active', isTurbo);
});

document.getElementById('auto-btn').addEventListener('click', (e) => {
    isAuto = !isAuto;
    e.currentTarget.classList.toggle('active', isAuto);
    if (isAuto && !isSpinning) playSpin();
});

// Feature Buy Modal
const featureModal = document.getElementById('feature-modal');
document.getElementById('feature-buy-btn').addEventListener('click', () => {
    if (isSpinning || inFreeSpins) return;
    const cost = BET_OPTIONS[betIndex] * 75;
    document.getElementById('feature-cost-val').textContent = 'Tk' + cost.toFixed(2);
    featureModal.style.display = 'flex';
});

document.getElementById('cancel-buy-btn').addEventListener('click', () => {
    featureModal.style.display = 'none';
});

document.getElementById('confirm-buy-btn').addEventListener('click', () => {
    const cost = BET_OPTIONS[betIndex] * 75;
    if (balance < cost) {
        alert("Insufficient balance for Feature Buy!");
        return;
    }
    balance -= cost;
    featureModal.style.display = 'none';
    inFreeSpins = true;
    freeSpinsRemaining = 10;
    updateUI();
    playGunshotSound();
    playSpin();
});

// Paytable & Rules Modal
const infoModal = document.getElementById('info-modal');
document.getElementById('menu-btn').addEventListener('click', () => {
    infoModal.style.display = 'flex';
});

document.getElementById('close-info-btn').addEventListener('click', () => {
    infoModal.style.display = 'none';
});
