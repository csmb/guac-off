const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const hud = { scoreSize: 28, speedSize: 36, labelSize: 11, pad: 24 };

function resizeCanvas() {
    const hero = document.getElementById('game-hero') || canvas.parentElement;
    canvas.width = hero.clientWidth;
    canvas.height = hero.clientHeight;

    // Scale HUD font sizes off canvas height (baseline 600px)
    const k = Math.max(0.6, Math.min(1.3, canvas.height / 600));
    hud.scoreSize = Math.round(28 * k);
    hud.speedSize = Math.round(36 * k);
    hud.labelSize = Math.round(11 * k);
    hud.pad = Math.round(24 * k);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const width = canvas.width;
const height = canvas.height;

// Load assets
const bikePedalingLeftImg = new Image();
bikePedalingLeftImg.src = 'assets/bike_pedaling_left.png';
const bikePedalingRightImg = new Image();
bikePedalingRightImg.src = 'assets/bike_pedaling_right.png';
const bikeStoppedImg = new Image();
bikeStoppedImg.src = 'assets/bike_stopped.png';
const waymoImg = new Image();
waymoImg.src = 'assets/waymo.png';
const waymoStoppedImg = new Image();
waymoStoppedImg.src = 'assets/waymo_stopped.png';
const motorcycleImg = new Image();
motorcycleImg.src = 'assets/motorcycle.png';
const motorcycleStoppedImg = new Image();
motorcycleStoppedImg.src = 'assets/motorcycle_stopped.png';
const scooterImg = new Image();
scooterImg.src = 'assets/lime_scooter.png';
const scooterStoppedImg = new Image();
scooterStoppedImg.src = 'assets/scooter_stopped.png';

const bgMtTam = new Image();
bgMtTam.src = 'assets/bg.png';
const bgMission = new Image();
bgMission.src = 'assets/bg_mission.png';
const bgGGP = new Image();
bgGGP.src = 'assets/bg_ggp.png';
const bgMarketStreet = new Image();
bgMarketStreet.src = 'assets/bg_market_street.png';

let assetsLoaded = 0;
const totalAssets = 13;

function assetLoaded() {
    assetsLoaded++;
    if (assetsLoaded === totalAssets) {
        document.getElementById('menu-overlay').style.display = 'block';
        // Play menu music
        currentMusic = new Audio('assets/music_mission.mp3');
        currentMusic.loop = true;
        currentMusic.play().catch(e => console.log("Menu audio play failed:", e));
    }
}

bikePedalingLeftImg.onload = assetLoaded;
bikePedalingRightImg.onload = assetLoaded;
bikeStoppedImg.onload = assetLoaded;
waymoImg.onload = assetLoaded;
waymoStoppedImg.onload = assetLoaded;
motorcycleImg.onload = assetLoaded;
motorcycleStoppedImg.onload = assetLoaded;
scooterImg.onload = assetLoaded;
scooterStoppedImg.onload = assetLoaded;
bgMtTam.onload = assetLoaded;
bgMission.onload = assetLoaded;
bgGGP.onload = assetLoaded;
bgMarketStreet.onload = assetLoaded;

// Road Styles Config
const roadStyles = {
    mttam: {
        bg: bgMtTam,
        roadColor: '#42454a',
        grassColor1: '#4ca127',
        grassColor2: '#3d821e',
        rumbleColor1: '#ff0000',
        rumbleColor2: '#ffffff'
    },
    mission: {
        bg: bgMission,
        roadColor: '#2f2f2f',
        grassColor1: '#505050',
        grassColor2: '#404040',
        rumbleColor1: '#0055ff', // Blue
        rumbleColor2: '#ff2200'  // Red
    },
    ggp: {
        bg: bgGGP,
        roadColor: '#1a4a1a',
        grassColor1: '#00ff00',
        grassColor2: '#00cc00',
        rumbleColor1: '#a52a2a',
        rumbleColor2: '#ffffff'
    },
    market: {
        bg: bgMarketStreet,
        roadColor: '#555555',
        grassColor1: '#cccccc',
        grassColor2: '#aaaaaa',
        rumbleColor1: '#ffff00',
        rumbleColor2: '#ffffff'
    },
    custom: {
        bg: new Image(), // Set dynamically
        roadColor: '#42454a',
        grassColor1: '#4ca127',
        grassColor2: '#3d821e',
        rumbleColor1: '#ff0000',
        rumbleColor2: '#ffffff'
    }
};

// Game State
let position = 0;
let paused = true; // Start paused for menu
let gameStarted = false;

// Gameplay Variables
let score = 0;
let startTime = 0;
let elapsedTime = 0;
let raceFinished = false;
let countdown = 3;
let countdownActive = false;
let countdownStartTime = 0;
let countdownStepTime = 0;     // timestamp when current digit became active
let goFlashUntil = 0;          // timestamp until which GO! flash is visible
let currentSpeed = 0;
const VEHICLE_SPEEDS = {
    'bike': 40,
    'scooter': 50,
    'motorcycle': 80,
    'waymo': 60
};
const obstacles = []; // { z: number, x: number }
const pickups = [];    // { z: number, x: number, type: string }
const INGREDIENTS = ['avocado', 'jalapeno', 'onion', 'cilantro', 'lime', 'chip'];
let floatingTexts = [];
let flyingObjects = [];
let speedBonus = 0;
let screenShake = { frames: 0, magnitude: 0 };
let lastCountdown = 4;

const FOG_INTENSITY = { mttam: 1.0, mission: 0.0, ggp: 0.25, market: 0.0 };
const fogBanks = [
    { x: 0,    y: 0.55, w: 600, speed: 0.4, alpha: 0.55 },
    { x: -300, y: 0.62, w: 700, speed: 0.7, alpha: 0.45 },
    { x: 400,  y: 0.50, w: 500, speed: 0.3, alpha: 0.35 },
];
let winnersCircleActive = false;  // will be set by Task 9 — declared here so drawFog can reference it
let decelStartTime = 0;        // when the glide started
let decelStartSpeed = 0;       // currentSpeed at finish

const CONFETTI_COLORS = ['#1b4d3e', '#ebd2b4', '#ff5500', '#ffffff', '#ff007f', '#39ff14', '#00ffff'];
const confetti = []; // { x, y, vx, vy, color, size, rot, vr }

function seedConfetti() {
    confetti.length = 0;
    for (let i = 0; i < 80; i++) {
        confetti.push({
            x: Math.random() * (canvas.width || 800),
            y: -20 - Math.random() * 400,
            vx: (Math.random() - 0.5) * 1.5,
            vy: 1 + Math.random() * 3,
            color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
            size: 4 + Math.random() * 6,
            rot: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 0.2,
        });
    }
}

const ingredientImgs = {};
INGREDIENTS.forEach(ing => {
    ingredientImgs[ing] = new Image();
    ingredientImgs[ing].src = `assets/${ing}.png`;
});
const coneImg = new Image();
coneImg.src = 'assets/cone.png';
let playerX = 0; // -1 to 1
let targetPlayerX = 0;
let roadWidth = 500;
const segmentLength = 200;
const cameraDepth = 0.84;
const cameraHeight = 2500;
let cameraOffsetX = 0;
const drawDistance = 200;

// ===== SF emoji sprite roster =====
// Each entry: { id, emoji, category, baseSize, scenes: { mttam, mission, ggp, market } }
// `scenes` values are weights; 0 = never spawn on that scene.
const SPRITE_LIBRARY = [
    // Roadside props
    { id: 'cable-car',     emoji: '🚋', category: 'prop',   baseSize: 110, scenes: { mttam: 0, mission: 1, ggp: 0, market: 5 } },
    { id: 'bart',          emoji: '🚆', category: 'prop',   baseSize: 110, scenes: { mttam: 0, mission: 3, ggp: 0, market: 3 } },
    { id: 'caltrain',      emoji: '🚉', category: 'prop',   baseSize: 110, scenes: { mttam: 0, mission: 2, ggp: 3, market: 1 } },
    { id: 'f-line',        emoji: '🚊', category: 'prop',   baseSize: 110, scenes: { mttam: 0, mission: 1, ggp: 1, market: 4 } },
    { id: 'lime-scooter',  emoji: '🛴', category: 'prop',   baseSize:  70, scenes: { mttam: 1, mission: 3, ggp: 2, market: 3 } },
    { id: 'parked-bike',   emoji: '🚲', category: 'prop',   baseSize:  70, scenes: { mttam: 1, mission: 3, ggp: 4, market: 2 } },
    { id: 'hydrant',       emoji: '🚒', category: 'prop',   baseSize:  60, scenes: { mttam: 2, mission: 4, ggp: 3, market: 3 } },
    { id: 'palm',          emoji: '🌴', category: 'prop',   baseSize:  90, scenes: { mttam: 2, mission: 4, ggp: 1, market: 1 } },
    { id: 'muni-stop',     emoji: '🚏', category: 'prop',   baseSize:  70, scenes: { mttam: 0, mission: 2, ggp: 2, market: 4 } },
    { id: 'taqueria',      emoji: '🌮', category: 'prop',   baseSize:  80, scenes: { mttam: 0, mission: 5, ggp: 1, market: 2 } },
    { id: 'recology',      emoji: '🗑️', category: 'prop',   baseSize:  60, scenes: { mttam: 1, mission: 3, ggp: 2, market: 3 } },
    { id: 'meter',         emoji: '🅿️', category: 'prop',   baseSize:  60, scenes: { mttam: 0, mission: 3, ggp: 2, market: 4 } },
    // People & creatures
    { id: 'skater',        emoji: '🛹', category: 'person', baseSize:  70, scenes: { mttam: 3, mission: 3, ggp: 1, market: 1 } },
    { id: 'dog-walker',    emoji: '🐕', category: 'person', baseSize:  70, scenes: { mttam: 2, mission: 1, ggp: 4, market: 1 } },
    { id: 'mariachi',      emoji: '🎺', category: 'person', baseSize:  70, scenes: { mttam: 0, mission: 4, ggp: 1, market: 1 } },
    { id: 'cyclist',       emoji: '🚴', category: 'person', baseSize:  70, scenes: { mttam: 1, mission: 1, ggp: 4, market: 3 } },
    { id: 'seagull',       emoji: '🐦', category: 'creature', baseSize: 60, scenes: { mttam: 4, mission: 0, ggp: 3, market: 0 } },
    { id: 'sea-lion',      emoji: '🦭', category: 'creature', baseSize: 80, scenes: { mttam: 3, mission: 0, ggp: 2, market: 0 } },
];

const LANDMARK_LIBRARY = [
    { id: 'golden-gate',    emoji: '🌉', baseSize: 220, scenes: { mttam: 5, mission: 0, ggp: 4, market: 0 } },
    { id: 'transamerica',   emoji: '🏛️', baseSize: 200, scenes: { mttam: 0, mission: 3, ggp: 0, market: 5 } },
    { id: 'sutro',          emoji: '📡', baseSize: 200, scenes: { mttam: 5, mission: 1, ggp: 4, market: 1 } },
    { id: 'painted-ladies', emoji: '🏘️', baseSize: 200, scenes: { mttam: 0, mission: 0, ggp: 5, market: 0 } },
];

// Spawned items: { z, x, side: 'left'|'right'|'horizon', sprite }
const roadside = [];

function pickSpriteForScene(scene, category) {
    const pool = SPRITE_LIBRARY.filter(s => s.category === category && (s.scenes[scene] || 0) > 0);
    if (pool.length === 0) return null;
    const totalWeight = pool.reduce((sum, s) => sum + s.scenes[scene], 0);
    let r = Math.random() * totalWeight;
    for (const s of pool) {
        r -= s.scenes[scene];
        if (r <= 0) return s;
    }
    return pool[pool.length - 1];
}

function pickLandmarkForScene(scene) {
    const pool = LANDMARK_LIBRARY.filter(l => (l.scenes[scene] || 0) > 0);
    if (pool.length === 0) return null;
    const totalWeight = pool.reduce((sum, l) => sum + l.scenes[scene], 0);
    let r = Math.random() * totalWeight;
    for (const l of pool) {
        r -= l.scenes[scene];
        if (r <= 0) return l;
    }
    return pool[pool.length - 1];
}

let currentVehicle = 'bike';
let currentRoad = 'mttam';

// Road Segments
const segments = [];

// Billboards moved to top configuration

function playSound(type) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'ding') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, ctx.currentTime);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'chomp') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'coin') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'beep_low') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'beep_high') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'fanfare') {
        // Placeholder for MP3s!
        console.log("Playing fanfare placeholder...");
        const fanfare = new Audio('assets/fanfare.mp3');
        fanfare.play().catch(e => console.log("Fanfare file missing, using fallback beep!"));
        fanfare.onended = () => {
            const afterSong = new Audio('assets/after_party.mp3');
            if (currentMusic) currentMusic.pause(); // Stop race music
            afterSong.play().catch(e => console.log("After party file missing!"));
        };
    } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, ctx.currentTime);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    }
}

function addFloatingText(text, x, y, color) {
    floatingTexts.push({ text, x, y, color, life: 1.0 });
}

// Generate Road
function createRoad() {
    segments.length = 0; // Clear existing segments
    let currentCurve = 0;
    let curveLength = 0;
    let y = 0;
    
    // Clear gameplay objects
    obstacles.length = 0;
    pickups.length = 0;
    roadside.length = 0;
    
    const isMission = currentRoad === 'mission';
    
    for (let n = 0; n < 250; n++) {
        const z = n * segmentLength;
        
        if (!isMission && n > curveLength) {
            currentCurve = (Math.random() - 0.5) * 6;
            curveLength = n + Math.floor(Math.random() * 50) + 20;
        }
        
        const nextY = isMission ? 0 : (Math.sin(n / 20) * 800 + Math.sin(n / 5) * 200);
        
        segments.push({
            p1: { x: 0, y: y, z: z },
            p2: { x: 0, y: nextY, z: (n + 1) * segmentLength },
            curve: isMission ? 0 : currentCurve,
            color: Math.floor(n / 3) % 2 ? '#1a1a1a' : '#111111',
            rumble: Math.floor(n / 3) % 2 ? '#ff007f' : '#00ffff',
            isBridge: false
        });
        
        y = nextY;
        
        // Spawn obstacles and pickups
        if (n > 12 && n < 225) { // Don't spawn right at start or end (length 250)
            if (Math.random() < 0.02) { // 2% chance per segment
                obstacles.push({ z: z, x: (Math.random() - 0.5) * 1.5 }); // x is -0.75 to 0.75
            }
            if (Math.random() < 0.01) { // 1% chance per segment
                const type = INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)];
                pickups.push({ z: z, x: (Math.random() - 0.5) * 1.5, type: type });
            }
            // Spawn roadside props (left and right)
            const ROADSIDE_RATE = 0.06;
            const PERSON_RATE = 0.02;
            for (const side of ['left', 'right']) {
                if (Math.random() < ROADSIDE_RATE) {
                    const sprite = pickSpriteForScene(currentRoad, 'prop');
                    if (sprite) {
                        const x = side === 'left' ? -1.05 - Math.random() * 0.2 : 1.05 + Math.random() * 0.2;
                        roadside.push({ z, x, side, sprite });
                    }
                }
                if (Math.random() < PERSON_RATE) {
                    const sprite = pickSpriteForScene(currentRoad, Math.random() < 0.5 ? 'person' : 'creature');
                    if (sprite) {
                        const x = side === 'left' ? -1.0 - Math.random() * 0.2 : 1.0 + Math.random() * 0.2;
                        roadside.push({ z, x, side, sprite });
                    }
                }
            }
        }
    }
    // Fixed-position landmarks (parallax horizon)
    const LANDMARK_POSITIONS = [12000, 28000, 42000];
    LANDMARK_POSITIONS.forEach((z, i) => {
        const sprite = pickLandmarkForScene(currentRoad);
        if (sprite) {
            roadside.push({ z, x: (i % 2 === 0 ? -0.3 : 0.3), side: 'horizon', sprite });
        }
    });
}

// Linear interpolate between two #rrggbb colors. t in [0,1].
function lerpColor(c1, c2, t) {
    const r1 = parseInt(c1.slice(1, 3), 16);
    const g1 = parseInt(c1.slice(3, 5), 16);
    const b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16);
    const g2 = parseInt(c2.slice(3, 5), 16);
    const b2 = parseInt(c2.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r},${g},${b})`;
}

// Project 3D to 2D
function project(p, width, height) {
    const sp = cameraDepth / Math.max(1, p.z - position);
    
    // Apply curve
    let curveOffsetX = 0;
    let segIndex = Math.floor(p.z / segmentLength);
    const startIndex = Math.floor(position / segmentLength);
    
    for(let i = startIndex; i < segIndex; i++) {
        if(segments[i]) curveOffsetX += segments[i].curve * 20;
    }

    p.screenX = (width / 2 + cameraOffsetX) + (p.x + curveOffsetX - playerX * roadWidth) * sp * 600;
    // Adjust Y projection for hills
    p.screenY = (height / 2) + (cameraHeight - p.y) * sp * (height / 2);
    p.screenWidth = roadWidth * sp * 600;
}
// Init
function init() {
    createRoad();

    // Reset scroll position to start on refresh
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
    position = 0;
    
    // Mouse interaction for swerving
    window.addEventListener('mousemove', (e) => {
        // Map mouse X to -1 to 1
        targetPlayerX = (e.clientX / window.innerWidth) * 2 - 1;
    });

    // Gyroscope steering (tilt phone left/right)
    function handleOrientation(e) {
        if (e.gamma === null) return;
        // gamma: -90 (left) to 90 (right). Clamp to ±30° for full steering range.
        targetPlayerX = Math.max(-1, Math.min(1, e.gamma / 30));
    }
    if (typeof DeviceOrientationEvent !== 'undefined') {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            // iOS 13+ requires explicit permission
            DeviceOrientationEvent.requestPermission()
                .then(state => {
                    if (state === 'granted') {
                        window.addEventListener('deviceorientation', handleOrientation);
                    }
                })
                .catch(console.error);
        } else {
            window.addEventListener('deviceorientation', handleOrientation);
        }
    }
    
    // Pause interaction
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            paused = !paused;
            e.preventDefault(); // Prevent page scroll
        } else if (e.code === 'ArrowLeft') {
            targetPlayerX = Math.max(-1, targetPlayerX - 0.2);
            e.preventDefault();
        } else if (e.code === 'ArrowRight') {
            targetPlayerX = Math.min(1, targetPlayerX + 0.2);
            e.preventDefault();
        }
    });



    requestAnimationFrame(gameLoop);
}

function drawSpeedLines() {
    const speed = currentSpeed + speedBonus;
    if (speed < 50) return;
    const alpha = Math.min(0.6, (speed - 50) / 40 * 0.6);
    const vx = canvas.width / 2, vy = canvas.height / 2;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 2;
    const n = 10;
    for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2 + Math.random() * 0.3;
        const r1 = 60 + Math.random() * 40;
        const r2 = Math.max(canvas.width, canvas.height) * 0.7;
        ctx.beginPath();
        ctx.moveTo(vx + Math.cos(angle) * r1, vy + Math.sin(angle) * r1);
        ctx.lineTo(vx + Math.cos(angle) * r2, vy + Math.sin(angle) * r2);
        ctx.stroke();
    }
    ctx.restore();
}

function drawRoadside() {
    // Pick visible sprites and draw back-to-front so closer overlap farther.
    const visible = [];
    for (const item of roadside) {
        if (item.z > position && item.z < position + drawDistance * segmentLength) {
            visible.push(item);
        }
    }
    visible.sort((a, b) => b.z - a.z);

    for (const item of visible) {
        if (item.side === 'horizon') continue; // landmarks rendered separately in Task 7
        drawWorldEmoji(item);
    }
}

function drawWorldEmoji(item) {
    // Project the item's world position to screen using the same math obstacles use
    const segIndex = Math.floor(item.z / segmentLength);
    const seg = segments[segIndex];
    if (!seg) return;

    const p = { x: item.x * roadWidth, y: seg.p1.y, z: item.z };
    project(p, canvas.width, canvas.height);
    if (p.screenY > canvas.height || p.screenY < 0) return;

    const scale = p.screenWidth / roadWidth;
    const size = Math.max(6, item.sprite.baseSize * scale);
    if (size < 6) return;

    // Light animations: sea-lion bobs vertically, seagull drifts horizontally
    let dx = 0, dy = 0;
    if (item.sprite.id === 'sea-lion') dy = Math.sin(Date.now() / 400 + item.z * 0.001) * 4 * scale;
    if (item.sprite.id === 'seagull')  dx = Math.sin(Date.now() / 200 + item.z * 0.001) * 30 * scale;

    ctx.textBaseline = 'bottom';
    ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillText(item.sprite.emoji, p.screenX - size / 2 + dx, p.screenY + dy);
    ctx.textBaseline = 'alphabetic';
}

function drawLandmarks() {
    for (const item of roadside) {
        if (item.side !== 'horizon') continue;
        const dz = item.z - position;
        if (dz < -2000) continue;          // already passed
        if (dz > drawDistance * segmentLength * 1.5) continue; // too far still

        // Parallax: appear small far away, larger as the player approaches
        const t = Math.max(0, Math.min(1, 1 - dz / (drawDistance * segmentLength)));
        const size = Math.max(40, item.sprite.baseSize * (0.3 + t * 0.9));

        // Anchor on the horizon line, offset by item.x for left/right placement
        const horizonY = canvas.height * 0.42;
        const sx = canvas.width * 0.5 + item.x * canvas.width * 0.35;

        ctx.textBaseline = 'bottom';
        ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        ctx.globalAlpha = 0.85;
        ctx.fillText(item.sprite.emoji, sx - size / 2, horizonY);
        ctx.globalAlpha = 1.0;
        ctx.textBaseline = 'alphabetic';
    }
}

function drawFog() {
    if (winnersCircleActive) return; // suppressed during winners circle
    const intensity = FOG_INTENSITY[currentRoad] || 0;
    if (intensity <= 0) return;

    for (const bank of fogBanks) {
        bank.x += bank.speed; // drift
        if (bank.x > canvas.width + bank.w) bank.x = -bank.w;

        const y = canvas.height * bank.y;
        const grad = ctx.createLinearGradient(bank.x, y, bank.x + bank.w, y);
        grad.addColorStop(0,   `rgba(220,225,230,0)`);
        grad.addColorStop(0.5, `rgba(220,225,230,${bank.alpha * intensity})`);
        grad.addColorStop(1,   `rgba(220,225,230,0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(bank.x, y - 40, bank.w, 80);
    }
}

function drawParty() {
    if (!winnersCircleActive) return;

    // Dim the road behind the party
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Confetti
    for (const c of confetti) {
        c.x += c.vx + Math.sin(Date.now() / 600 + c.y * 0.01) * 0.3;
        c.y += c.vy;
        c.rot += c.vr;
        if (c.y > canvas.height + 20) {
            c.y = -20;
            c.x = Math.random() * canvas.width;
        }
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size);
        ctx.restore();
    }

    // Banner — "🎉 WELCOME TO THE GUAC OFF 🎉" with subtle bob
    const bob = Math.sin(Date.now() / 400) * 4;
    ctx.textAlign = 'center';
    const bannerSize = Math.round(28 * (canvas.height / 600));
    ctx.font = `${bannerSize}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#000000';
    ctx.fillText('🎉 WELCOME TO THE GUAC OFF 🎉', canvas.width / 2 + 3, canvas.height * 0.18 + bob + 3);
    ctx.fillStyle = '#ebd2b4';
    ctx.fillText('🎉 WELCOME TO THE GUAC OFF 🎉', canvas.width / 2, canvas.height * 0.18 + bob);

    // Party crowd row near the bottom — each emoji bobs independently
    const crowd = ['🥳', '💃', '🕺', '🍻', '🥑', '🎺', '🌮', '🥑'];
    const crowdSize = Math.round(60 * (canvas.height / 600));
    ctx.font = `${crowdSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textBaseline = 'bottom';
    const gap = canvas.width / (crowd.length + 1);
    for (let i = 0; i < crowd.length; i++) {
        const cb = Math.sin(Date.now() / 300 + i) * 6;
        ctx.fillText(crowd[i], (i + 1) * gap, canvas.height * 0.85 + cb);
    }
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
}

// Render
function render() {
    let shakeX = 0, shakeY = 0;
    if (screenShake.frames > 0) {
        shakeX = (Math.random() - 0.5) * 2 * screenShake.magnitude;
        shakeY = (Math.random() - 0.5) * 2 * screenShake.magnitude;
        ctx.save();
        ctx.translate(shakeX, shakeY);
        screenShake.frames--;
        screenShake.magnitude *= 0.85; // decay
    }

    const width = canvas.width;
    const height = canvas.height;
    
    // Calculate camera offset when menu is open
    let targetCameraOffsetX = 0;
    const isMobile = width < 600;
    if (!gameStarted && !isMobile) {
        const menuOverlay = document.getElementById('menu-overlay');
        const menuWidth = menuOverlay ? menuOverlay.offsetWidth : 700;
        targetCameraOffsetX = menuWidth / 2;
    }
    // Smooth transition
    cameraOffsetX += (targetCameraOffsetX - cameraOffsetX) * 0.1;
    
    ctx.clearRect(0, 0, width, height);

    // Draw Background (Static for now to handle hills better, or parallax)
    const style = roadStyles[currentRoad];
    if (style.bg && style.bg.complete) {
        const bg = style.bg;
        const bgAspect = bg.width / bg.height;
        const canvasAspect = width / height;
        
        let sx, sy, sw, sh;
        if (bgAspect > canvasAspect) {
            // Image is wider than canvas!
            sh = bg.height;
            sw = sh * canvasAspect;
            sx = (bg.width - sw) / 2;
            sy = 0;
        } else {
            // Image is taller than canvas!
            sw = bg.width;
            sh = sw / canvasAspect;
            sx = 0;
            sy = (bg.height - sh) / 2;
        }
        
        ctx.drawImage(bg, sx, sy, sw, sh, 0, 0, width, height);
    } else {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
    }

    drawLandmarks();

    const startIndex = Math.floor(position / segmentLength);
    const maxSegments = Math.min(segments.length, startIndex + drawDistance);
    
    // Pass 1: Draw grass from back to front
    for (let n = maxSegments - 1; n >= startIndex; n--) {
        const segment = segments[n];
        if (segment.isBridge) continue;
        
        let p1 = segment.p1;
        let p2 = segment.p2;
        
        if (n === startIndex) {
            p1 = Object.assign({}, segment.p1);
            p1.z = position + 1;
            const t = (p1.z - segment.p1.z) / (segment.p2.z - segment.p1.z);
            p1.y = segment.p1.y + (segment.p2.y - segment.p1.y) * t;
        }
        
        project(p1, width, height);
        project(p2, width, height);
        
        if (p2.z > position) {
            ctx.fillStyle = lerpColor(style.grassColor1, style.grassColor2, n / (segments.length - 1));
            
            // Left grass
            ctx.beginPath();
            ctx.moveTo(0, p1.screenY);
            ctx.lineTo(p1.screenX - p1.screenWidth, p1.screenY);
            ctx.lineTo(p2.screenX - p2.screenWidth, p2.screenY - 1);
            ctx.lineTo(0, p2.screenY - 1);
            ctx.fill();
            
            // Right grass
            ctx.beginPath();
            ctx.moveTo(p1.screenX + p1.screenWidth, p1.screenY);
            ctx.lineTo(width, p1.screenY);
            ctx.lineTo(width, p2.screenY - 1);
            ctx.lineTo(p2.screenX + p2.screenWidth, p2.screenY - 1);
            ctx.fill();
        }
    }

    // Pass 2: Draw road and rumble from back to front
    for (let n = maxSegments - 1; n >= startIndex; n--) {
        const segment = segments[n];
        
        let p1 = segment.p1;
        let p2 = segment.p2;
        
        if (n === startIndex) {
            p1 = Object.assign({}, segment.p1);
            p1.z = position + 1;
            const t = (p1.z - segment.p1.z) / (segment.p2.z - segment.p1.z);
            p1.y = segment.p1.y + (segment.p2.y - segment.p1.y) * t;
        }
        
        project(p1, width, height);
        project(p2, width, height);
        
        if (p2.z > position) {
            if (p2.screenY > height) continue; // Entirely off-screen bottom
            
            // Clip at bottom of screen
            if (p1.screenY > height) {
                const t = (height - p2.screenY) / (p1.screenY - p2.screenY);
                p1.screenX = p2.screenX + (p1.screenX - p2.screenX) * t;
                p1.screenWidth = p2.screenWidth + (p1.screenWidth - p2.screenWidth) * t;
                p1.screenY = height;
            }
            
            // Draw road
            ctx.fillStyle = segment.isBridge ? segment.color : lerpColor('#2c2c2c', '#1e1e1e', n / (segments.length - 1));
            ctx.beginPath();
            ctx.moveTo(p1.screenX - p1.screenWidth, p1.screenY);
            ctx.lineTo(p1.screenX + p1.screenWidth, p1.screenY);
            ctx.lineTo(p2.screenX + p2.screenWidth, p2.screenY - 1);
            ctx.lineTo(p2.screenX - p2.screenWidth, p2.screenY - 1);
            ctx.fill();
            
            // Draw Start Line
            if (n === 0) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(p1.screenX - p1.screenWidth, p1.screenY - 10, p1.screenWidth * 2, 20);
            }
            // Draw Finish Line
            if (n === segments.length - 1) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(p1.screenX - p1.screenWidth, p1.screenY - 10, p1.screenWidth * 2, 20);
                // Checkered pattern
                ctx.fillStyle = '#000000';
                const squareSize = p1.screenWidth * 2 / 10;
                for (let i = 0; i < 10; i += 2) {
                    ctx.fillRect(p1.screenX - p1.screenWidth + i * squareSize, p1.screenY - 10, squareSize, 20);
                }
            }
            
            // Draw rumble strips
            ctx.fillStyle = segment.isBridge ? segment.rumble : style.rumbleColor2;
            const rumble1 = p1.screenWidth * 0.1;
            const rumble2 = p2.screenWidth * 0.1;
            
            ctx.beginPath();
            ctx.moveTo(p1.screenX - p1.screenWidth, p1.screenY);
            ctx.lineTo(p1.screenX - p1.screenWidth + rumble1, p1.screenY);
            ctx.lineTo(p2.screenX - p2.screenWidth + rumble2, p2.screenY - 1);
            ctx.lineTo(p2.screenX - p2.screenWidth, p2.screenY - 1);
            ctx.fill();
            
            ctx.beginPath();
            ctx.moveTo(p1.screenX + p1.screenWidth, p1.screenY);
            ctx.lineTo(p1.screenX + p1.screenWidth - rumble1, p1.screenY);
            ctx.lineTo(p2.screenX + p2.screenWidth - rumble2, p2.screenY - 1);
            ctx.lineTo(p2.screenX + p2.screenWidth, p2.screenY - 1);
            ctx.fill();
            

        }
    }
    
    drawRoadside();

    // Draw Obstacles (Cones)
    obstacles.forEach(o => {
        if (o.z <= position) return; // Behind camera
        const segIndex = Math.floor(o.z / segmentLength);
        const startIndex = Math.floor(position / segmentLength);
        const drawDistance = isMobile ? 50 : 150;
        const maxSegments = Math.min(segments.length, startIndex + drawDistance);
        
        if (segIndex >= startIndex && segIndex < maxSegments) {
            const segment = segments[segIndex];
            const p = { x: o.x * roadWidth, y: segment.p1.y, z: o.z };
            project(p, width, height);
            
            const scale = p.screenWidth / roadWidth;
            const w = 300 * scale; // Tripled
            const h = 480 * scale; // Tripled
            
            if (coneImg.complete) {
                ctx.drawImage(coneImg, p.screenX - w/2, p.screenY - h, w, h);
            } else {
                ctx.fillStyle = '#ff5500'; // Orange cone!
                ctx.beginPath();
                ctx.moveTo(p.screenX - w/2, p.screenY);
                ctx.lineTo(p.screenX + w/2, p.screenY);
                ctx.lineTo(p.screenX + w/4, p.screenY - h);
                ctx.lineTo(p.screenX - w/4, p.screenY - h);
                ctx.fill();
                
                // Stripe
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(p.screenX - w/3, p.screenY - h/2, w*2/3, h/4);
            }
        }
    });

    // Draw Pickups (Ingredients)
    try {
        pickups.forEach(p => {
            if (p.z <= position) return; // Behind camera
            const segIndex = Math.floor(p.z / segmentLength);
            const startIndex = Math.floor(position / segmentLength);
            const drawDistance = isMobile ? 50 : 150;
            const maxSegments = Math.min(segments.length, startIndex + drawDistance);
            
            if (segIndex >= startIndex && segIndex < maxSegments) {
                const segment = segments[segIndex];
                const pt = { x: p.x * roadWidth, y: segment.p1.y, z: p.z };
                project(pt, width, height);
                
                const scale = pt.screenWidth / roadWidth;
                const size = 300 * scale;
                
                const img = ingredientImgs[p.type];
                if (img && img.complete) {
                    ctx.drawImage(img, pt.screenX - size, pt.screenY - size*2, size*2, size*2);
                } else {
                    ctx.fillStyle = p.type === 'avocado' ? '#556b2f' : '#ff0000'; // Green for avo, red for others for now!
                    ctx.beginPath();
                    ctx.arc(pt.screenX, pt.screenY - size, size, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Text label
                    ctx.fillStyle = '#ffffff';
                    ctx.font = `${Math.floor(12 * scale * 2)}px Arial`;
                    ctx.fillText(p.type, pt.screenX - size, pt.screenY - size*2);
                }
            }
        });
    } catch (e) {
        console.error("Error drawing pickups:", e);
    }

    // Draw Flying Objects
    try {
        for (let i = flyingObjects.length - 1; i >= 0; i--) {
            const fo = flyingObjects[i];
            fo.x += fo.vx;
            fo.y += fo.vy;
            fo.z += fo.vz;
            fo.vy -= 1; // Gravity pulling down (decreasing Y)
            fo.life--;
            
            const pt = { x: fo.x * roadWidth, y: fo.y, z: fo.z };
            project(pt, width, height);
            
            const scale = pt.screenWidth / roadWidth;
            const w = 300 * scale; // Tripled
            const h = 480 * scale; // Tripled
            
            if (fo.type === 'cone') {
                if (coneImg.complete) {
                    ctx.drawImage(coneImg, pt.screenX - w/2, pt.screenY - h, w, h);
                } else {
                    ctx.fillStyle = '#ff5500';
                    ctx.beginPath();
                    ctx.moveTo(pt.screenX - w/2, pt.screenY);
                    ctx.lineTo(pt.screenX + w/2, pt.screenY);
                    ctx.lineTo(pt.screenX + w/4, pt.screenY - h);
                    ctx.lineTo(pt.screenX - w/4, pt.screenY - h);
                    ctx.fill();
                }
            }
            
            // Remove if life expires
            if (fo.life <= 0) {
                flyingObjects.splice(i, 1);
            }
        }
    } catch (e) {
        console.error("Error drawing flying objects:", e);
    }

    // Draw Vehicle (center bottom)
    playerX += (targetPlayerX - playerX) * 0.1;
    
    const bikeW = isMobile ? 170 : 300;
    const bikeH = isMobile ? 170 : 300;
    const bikeX = (width / 2 + cameraOffsetX) - (bikeW / 2) + (playerX * 100);
    const bikeY = height - bikeH - 20;
    
    // Calculate lean angle based on turning steering delta
    const leanAngle = (targetPlayerX - playerX) * 0.3;
    
    ctx.save();
    ctx.translate(bikeX + bikeW / 2, bikeY + bikeH); // Pivot from bottom center (wheels)
    ctx.rotate(leanAngle);
    
    let vImg = bikePedalingLeftImg;
    if (currentVehicle === 'bike') {
        if (paused) {
            vImg = bikeStoppedImg;
        } else {
            vImg = (Math.floor(Date.now() / 1000) % 2 === 0) ? bikePedalingLeftImg : bikePedalingRightImg;
        }
    } else if (currentVehicle === 'waymo') {
        vImg = paused ? waymoStoppedImg : waymoImg;
    } else if (currentVehicle === 'motorcycle') {
        vImg = paused ? motorcycleStoppedImg : motorcycleImg;
    } else if (currentVehicle === 'scooter') {
        vImg = paused ? scooterStoppedImg : scooterImg;
    }
    
    ctx.drawImage(vImg, -bikeW / 2, -bikeH, bikeW, bikeH);
    ctx.restore();

    // Update and Draw Floating Texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.life -= 0.01; // Stay longer!
        ft.y -= 2; // Float up!
        if (ft.life <= 0) {
            floatingTexts.splice(i, 1);
        } else {
            ctx.fillStyle = ft.color;
            ctx.font = `bold ${Math.floor(40 + ft.life*20)}px Arial`; // Bigger font!
            ctx.globalAlpha = ft.life;
            
            // Fun effect: Glow/Drop Shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;
            
            ctx.fillText(ft.text, ft.x, ft.y);
            
            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            ctx.globalAlpha = 1.0;
        }
    }

    drawFog();
    drawParty();
    drawSpeedLines();

    if (shakeX !== 0 || shakeY !== 0) {
        ctx.restore();
    }
}


function gameLoop() {
    const isMobile = window.innerWidth < 600;
    roadWidth = 2000;
    
    if (countdownActive) {
        const elapsed = (Date.now() - countdownStartTime) / 1000;
        countdown = 3 - Math.floor(elapsed);
        
        if (countdown !== lastCountdown) {
            if (countdown > 0) playSound('beep_low');
            else if (countdown === 0) playSound('beep_high');
            lastCountdown = countdown;
            countdownStepTime = Date.now();
            if (countdown === 0) goFlashUntil = Date.now() + 400;
        }
        
        if (countdown <= 0) {
            countdownActive = false;
            startTime = Date.now();
        }
    }
    
    if (!paused && !countdownActive && !raceFinished) {
        // Auto drive
        let maxSpeed = VEHICLE_SPEEDS[currentVehicle] || 40;
        let targetSpeed = maxSpeed + speedBonus;
        if (Math.abs(playerX) > 0.8) {
            targetSpeed = (maxSpeed + speedBonus) * 0.5; // Slow down on curb!
        }
        currentSpeed += (targetSpeed - currentSpeed) * 0.1; // Smooth transition
        position += currentSpeed;
        
        if (position >= segments.length * segmentLength && !raceFinished) {
            raceFinished = true;
            decelStartTime = Date.now();
            decelStartSpeed = currentSpeed;
            document.getElementById('see-details-btn').hidden = false;
            elapsedTime = (Date.now() - startTime) / 1000;
            playSound('fanfare');
        }
        
        // Collision Detection
        const currentSegIndex = Math.floor(position / segmentLength);
        
        // Collision Detection
        const riderZ = position + 3000; // Rider is approx 3000 units in front of camera
        
        // Check obstacles
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const o = obstacles[i];
            if (Math.abs(o.z - riderZ) < 200) {
                if (Math.abs(playerX - o.x) < 0.1) { // Tightened collision radius!
                    score -= 50;
                    speedBonus = Math.max(speedBonus - 10, 0); // Lose bonus!
                    currentSpeed = Math.max(currentSpeed - 20, 10); // Sudden jolt!
                    playSound('error');
                    addFloatingText('-50', width / 2, height / 2, '#ff0000');
                    
                    // Make cone fly off
                    flyingObjects.push({
                        x: o.x,
                        y: 0,
                        z: o.z,
                        vx: (Math.random() < 0.5 ? -1 : 1) * 2, // Fly left or right
                        vy: 20, // Jump UP in our Y-up system
                        vz: 10,  // Move forward
                        type: 'cone',
                        life: 60 // 60 frames life
                    });
                    
                    screenShake = { frames: 6, magnitude: 8 };
                    obstacles.splice(i, 1); // Remove it
                }
            }
        }
        
        // Check pickups
        for (let i = pickups.length - 1; i >= 0; i--) {
            const p = pickups[i];
            if (Math.abs(p.z - riderZ) < 200) {
                if (Math.abs(playerX - p.x) < 0.1) { // Tightened collision radius!
                    score += 25;
                    speedBonus = Math.min(speedBonus + 5, 40); // Max +40 speed
                    if (p.type === 'avocado') playSound('ding');
                    else if (p.type === 'chip') playSound('chomp');
                    else playSound('coin');
                    addFloatingText('+25', width / 2, height / 2, '#00ff00');
                    pickups.splice(i, 1); // Remove it
                }
            }
        }

    }

    // Deceleration glide: race finished but winners circle not yet started
    if (raceFinished && !winnersCircleActive) {
        const elapsed = Date.now() - decelStartTime;
        const t = Math.min(1, elapsed / 2000);
        currentSpeed = decelStartSpeed * (1 - t);
        position += currentSpeed;
        if (t >= 1) {
            winnersCircleActive = true;
            currentSpeed = 0;
            seedConfetti();
        }
    }

    render();

    // Pixel HUD — top-left SCORE+TIME, top-right SPEED
    const displayTime = raceFinished ? elapsedTime : (gameStarted && !countdownActive ? ((Date.now() - startTime) / 1000) : 0);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // SCORE (top-left)
    ctx.font = `${hud.labelSize}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#00ffff';
    ctx.fillText('SCORE', hud.pad, hud.pad);
    ctx.font = `${hud.scoreSize}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#000000';
    ctx.fillText(String(score).padStart(6, '0'), hud.pad + 2, hud.pad + hud.labelSize + 4 + 2); // shadow
    ctx.fillStyle = '#ff007f';
    ctx.fillText(String(score).padStart(6, '0'), hud.pad, hud.pad + hud.labelSize + 4);

    // TIME (below SCORE)
    const min = Math.floor(displayTime / 60);
    const sec = (displayTime - min * 60).toFixed(1).padStart(4, '0');
    const timeStr = `${String(min).padStart(2, '0')}:${sec}`;
    const timeY = hud.pad + hud.labelSize + 4 + hud.scoreSize + 16;
    ctx.font = `${hud.labelSize}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#00ffff';
    ctx.fillText('TIME', hud.pad, timeY);
    ctx.font = `${Math.round(hud.scoreSize * 0.7)}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#000000';
    ctx.fillText(timeStr, hud.pad + 2, timeY + hud.labelSize + 4 + 2);
    ctx.fillStyle = '#39ff14';
    ctx.fillText(timeStr, hud.pad, timeY + hud.labelSize + 4);

    // SPEED (top-right)
    const w = canvas.width;
    const speedStr = String(Math.floor(currentSpeed)).padStart(3, '0');
    ctx.textAlign = 'right';
    ctx.font = `${hud.labelSize}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#00ffff';
    ctx.fillText('SPEED MPH', w - hud.pad, hud.pad);
    ctx.font = `${hud.speedSize}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#000000';
    ctx.fillText(speedStr, w - hud.pad + 2, hud.pad + hud.labelSize + 4 + 2);
    ctx.fillStyle = '#39ff14';
    ctx.fillText(speedStr, w - hud.pad, hud.pad + hud.labelSize + 4);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    
    // Start Message and Countdown (with Scrim)
    if (countdownActive) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#00ffff';
        ctx.font = `${Math.round(20 * (canvas.height / 600))}px "Press Start 2P", monospace`;
        ctx.fillText("THE GUAC OFF IS STARTING", canvas.width / 2, canvas.height / 2 - 150);
        ctx.font = `${Math.round(11 * (canvas.height / 600))}px "Press Start 2P", monospace`;
        ctx.fillStyle = '#ebd2b4';
        ctx.fillText("collect ingredients · reach the party", canvas.width / 2, canvas.height / 2 - 110);

        // Scale-in animation: start at 50%, ease to 100% over 200ms since this digit became active
        const elapsed = Date.now() - countdownStepTime;
        const scale = elapsed < 200 ? 0.5 + (elapsed / 200) * 0.5 : 1.0;
        const baseSize = Math.round(110 * (canvas.height / 600));
        const size = Math.round(baseSize * scale);

        let digitColor = '#ff00ff';
        if (countdown === 3) digitColor = '#ff007f';
        else if (countdown === 2) digitColor = '#ffff00';
        else if (countdown === 1) digitColor = '#39ff14';

        ctx.font = `${size}px "Press Start 2P", monospace`;
        ctx.fillStyle = '#000000';
        ctx.fillText(countdown.toString(), canvas.width / 2 + 3, canvas.height / 2 + 50 + 3);
        ctx.fillStyle = digitColor;
        ctx.fillText(countdown.toString(), canvas.width / 2, canvas.height / 2 + 50);

        ctx.textAlign = 'left';
    }

    // GO! flash — fires when countdown hits 0 and lingers ~400ms
    if (Date.now() < goFlashUntil) {
        const remain = (goFlashUntil - Date.now()) / 400;
        ctx.fillStyle = `rgba(255,255,255,${remain * 0.6})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = 'center';
        ctx.font = `${Math.round(140 * (canvas.height / 600))}px "Press Start 2P", monospace`;
        ctx.fillStyle = '#000000';
        ctx.fillText('GO!', canvas.width / 2 + 4, canvas.height / 2 + 50 + 4);
        ctx.fillStyle = '#00ffff';
        ctx.fillText('GO!', canvas.width / 2, canvas.height / 2 + 50);
        ctx.textAlign = 'left';
    }
    
    const debugDiv = document.getElementById('debug-overlay');
    if (debugDiv) {
        debugDiv.textContent = `Paused: ${paused} | Pos: ${position} | Segments: ${segments.length} | PlayerX: ${playerX.toFixed(2)}${raceFinished ? ' | FINISHED!' : ''}`;
    }
}

// Menu Listeners
// Menu Listeners
function setStep(step) {
    if (window.innerWidth <= 600) {
        document.querySelectorAll('.menu-step').forEach(s => s.classList.remove('active'));
        const el = document.getElementById(`step-${step}`);
        if(el) el.classList.add('active');
    }
}
setStep(1);

document.querySelectorAll('#vehicle-grid .grid-item').forEach(item => {
    item.addEventListener('click', (e) => {
        const el = e.currentTarget;
        document.querySelectorAll('#vehicle-grid .grid-item').forEach(i => i.classList.remove('selected'));
        el.classList.add('selected');
        currentVehicle = el.dataset.value;
        setStep(2);
    });
});

document.querySelectorAll('#road-grid .grid-item').forEach(item => {
    item.addEventListener('click', (e) => {
        const el = e.currentTarget;
        if (el.dataset.value === 'custom') {
            document.getElementById('bg-upload').click();
            return;
        }
        document.querySelectorAll('#road-grid .grid-item').forEach(i => i.classList.remove('selected'));
        el.classList.add('selected');
        currentRoad = el.dataset.value;
        createRoad(); // Regenerate road!
    });
});

document.getElementById('bg-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                roadStyles.custom.bg = img;
                document.querySelectorAll('#road-grid .grid-item').forEach(i => i.classList.remove('selected'));
                document.getElementById('upload-item').classList.add('selected');
                currentRoad = 'custom';
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

let currentMusic = null;
function playMusic() {
    if (currentMusic) currentMusic.pause();
    
    let track = 'assets/music_default.mp3';
    if (currentRoad === 'mttam') track = 'assets/music_mttam.mp3';
    else if (currentRoad === 'mission') track = 'assets/music_mission.mp3';
    else if (currentRoad === 'ggp') track = 'assets/music_ggp.mp3';
    else if (currentRoad === 'market') track = 'assets/music_market.mp3';
    
    currentMusic = new Audio(track);
    currentMusic.loop = true;
    currentMusic.play().catch(e => console.log("Audio play failed:", e));
    document.getElementById('music-toggle').innerText = '🎵 Music: ON';
}

document.getElementById('start-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('menu-overlay');
    menu.style.display = 'none';
    menu.style.opacity = '0';
    menu.style.pointerEvents = 'none';
    paused = false; // Start game loop for countdown!
    gameStarted = true;
    countdownActive = true;
    countdownStartTime = Date.now();
    raceFinished = false; // Reset race!
    decelStartTime = 0;
    winnersCircleActive = false;
    document.getElementById('see-details-btn').hidden = true;
    score = 0; // Reset score!
    init();
    playMusic();
});



document.addEventListener('click', (e) => {
    console.log(`Document click: paused=${paused}, gameStarted=${gameStarted}, target=${e.target.id}`);

    // Ignore clicks outside the game hero (e.g., in the info section below)
    if (!e.target.closest('#game-hero')) return;

    if (raceFinished) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Button area: width / 2 - 100, height / 2 + 100, 200, 50
        if (x > width / 2 - 100 && x < width / 2 + 100 &&
            y > height / 2 + 100 && y < height / 2 + 150) {
            // Restart game!
            score = 0;
            raceFinished = false;
            decelStartTime = 0;
            winnersCircleActive = false;
            document.getElementById('see-details-btn').hidden = true;
            gameStarted = true;
            countdownActive = true;
            countdownStartTime = Date.now();
            lastCountdown = 4;
            init();
            playMusic();
            return;
        }
    }
    
    if (gameStarted && 
        e.target.id !== 'music-toggle' && e.target.id !== 'restart-btn') {
        paused = !paused;
    }
});

document.getElementById('scroll-hint').addEventListener('click', (e) => {
    e.stopPropagation(); // don't trigger the global pause-on-click
    document.getElementById('info').scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('see-details-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('info').scrollIntoView({ behavior: 'smooth' });
});

window.addEventListener('touchstart', (e) => {
    // Don't preventDefault on info-section content — users need to scroll/tap there
    const inGameHero = e.target.closest && e.target.closest('#game-hero');
    if (inGameHero && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') {
        e.preventDefault(); // Prevent selection on canvas/body!
    }
    if (paused && gameStarted && inGameHero &&
        e.target.id !== 'music-toggle' && e.target.id !== 'restart-btn') {
        paused = false;
    }
}, { passive: false });

document.getElementById('dice-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const vehicles = ['bike', 'waymo', 'motorcycle', 'scooter'];
    const roads = ['mttam', 'mission', 'ggp', 'market'];
    
    currentVehicle = vehicles[Math.floor(Math.random() * vehicles.length)];
    currentRoad = roads[Math.floor(Math.random() * roads.length)];
    
    const menu = document.getElementById('menu-overlay');
    menu.style.display = 'none';
    menu.style.opacity = '0';
    menu.style.pointerEvents = 'none';
    paused = true; // Stay paused until click anywhere
    gameStarted = true;
    init();
    playMusic();
});

document.getElementById('music-toggle').addEventListener('click', () => {
    if (currentMusic) {
        if (currentMusic.paused) {
            currentMusic.play().catch(e => console.log("Audio play failed:", e));
            document.getElementById('music-toggle').innerText = '🎵 Music: ON';
        } else {
            currentMusic.pause();
            document.getElementById('music-toggle').innerText = '🎵 Music: OFF';
        }
    }
});

document.getElementById('restart-btn').addEventListener('click', () => {
    position = 0;
    paused = true;
    const menu = document.getElementById('menu-overlay');
    menu.style.display = 'block';
    menu.style.opacity = '1';
    menu.style.pointerEvents = 'auto';
    setStep(1); // Reset step!
    if (currentMusic) {
        currentMusic.pause();
        currentMusic.currentTime = 0;
    }
});



document.addEventListener('DOMContentLoaded', () => {
    createRoad(); // Populate road on load
    setInterval(gameLoop, 1000 / 60); // Start game loop on load
});
