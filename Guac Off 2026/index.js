const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// ==========================================
// CONFIGURATION (Edit this easily!)
// ==========================================
const billboardStyles = {
    bgColor: '#4a2c11',      // Dark brown wood
    borderColor: '#2d1a0a',  // Darker brown wood
    textColor: '#ffd700',     // Yellow text
    titleSize: 100,          // Font size for title
    detailsSize: 60          // Font size for details
};

const billboards = [
    { z: 10000, text: 'SF GUAC OFF 2026', details: 'The Ultimate Guac Showdown', side: 'left' },
    { z: 30000, text: 'WHEN: SEPT 13, 2026', details: '1PM.', side: 'right' },
    { z: 50000, text: 'WHERE: ????', details: 'Location revealed soon.', side: 'left' },
    { z: 70000, text: 'NO DOUBLE DIPPING', details: '', side: 'right' },
    { z: 90000, text: 'BYOF', details: 'Bring Your Old Friends', side: 'right' },
    { z: 110000, text: 'BYOB', details: 'Bring Your Own Bowl', side: 'left' },
    { z: 130000, text: 'BE THERE!', details: 'Guac on.', side: 'right' },
    { z: 150000, text: 'SITE UNDER CONSTRUCTION', details: 'Watch your step.', side: 'left' },
    { z: 170000, text: 'DIGGING IN PROGRESS', details: 'Guac is hard work.', side: 'right' },
    { z: 190000, text: 'COMING SOON', details: 'Full site loading.', side: 'left' }
];

// ==========================================

// Set canvas to full screen
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
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
        rumbleColor1: '#ffe600',
        rumbleColor2: '#ffffff'
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
let playerX = 0; // -1 to 1
let targetPlayerX = 0;
const roadWidth = 2000;
const segmentLength = 200;
const cameraDepth = 0.84;
const cameraHeight = 1500;
const drawDistance = 200;

let currentVehicle = 'bike';
let currentRoad = 'mttam';

// Road Segments
const segments = [];

// Billboards moved to top configuration

// Generate Road
function createRoad() {
    let currentCurve = 0;
    let curveLength = 0;
    let y = 0;
    
    for (let n = 0; n < 2000; n++) {
        const z = n * segmentLength;
        
        if (n > curveLength) {
            currentCurve = (Math.random() - 0.5) * 6;
            curveLength = n + Math.floor(Math.random() * 50) + 20;
        }
        
        const nextY = Math.sin(n / 20) * 800 + Math.sin(n / 5) * 200;
        
        segments.push({
            p1: { x: 0, y: y, z: z },
            p2: { x: 0, y: nextY, z: (n + 1) * segmentLength },
            curve: currentCurve,
            color: Math.floor(n / 3) % 2 ? '#1a1a1a' : '#111111',
            rumble: Math.floor(n / 3) % 2 ? '#ff007f' : '#00ffff',
            isBridge: false
        });
        
        y = nextY;
    }
}

// Project 3D to 2D
function project(p, width, height) {
    const sp = cameraDepth / (p.z - position);
    
    // Apply curve
    let curveOffsetX = 0;
    let segIndex = Math.floor(p.z / segmentLength);
    const startIndex = Math.floor(position / segmentLength);
    
    for(let i = startIndex; i < segIndex; i++) {
        if(segments[i]) curveOffsetX += segments[i].curve * 20;
    }

    p.screenX = (width / 2) + (p.x + curveOffsetX - playerX * roadWidth) * sp * (width / 2);
    // Adjust Y projection for hills
    p.screenY = (height / 2) + (cameraHeight - p.y) * sp * (height / 2);
    p.screenWidth = roadWidth * sp * (width / 2);
}
function handleScroll() {
    position = window.scrollY * 10;
    if (position > (segments.length - drawDistance) * segmentLength) {
        position = (segments.length - drawDistance) * segmentLength;
    }
}

// Init
function init() {
    createRoad();
    
    // Set scroll height based on road length
    document.body.style.height = (segments.length * segmentLength / 10) + 'px';
    
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
    
    // Scroll interaction for progression
    window.addEventListener('scroll', handleScroll);
    
    // Pause interaction
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            paused = !paused;
            e.preventDefault(); // Prevent page scroll
        }
    });

    window.addEventListener('click', () => {
        paused = !paused;
    });

    requestAnimationFrame(gameLoop);
}

// Render
function render() {
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw Background (Static for now to handle hills better, or parallax)
    const style = roadStyles[currentRoad];
    if (style.bg && style.bg.complete) {
        ctx.drawImage(style.bg, 0, 0, width, height);
    } else {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
    }
    
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
        
        if (p2.screenY < height) {
            ctx.fillStyle = Math.floor(n / 3) % 2 ? style.grassColor1 : style.grassColor2;
            
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

    // Pass 2: Draw road, rumble, billboards from back to front
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
        
        if (p2.screenY < height) {
            // Draw road
            ctx.fillStyle = segment.isBridge ? segment.color : (Math.floor(n / 3) % 2 ? style.roadColor : '#111111');
            ctx.beginPath();
            ctx.moveTo(p1.screenX - p1.screenWidth, p1.screenY);
            ctx.lineTo(p1.screenX + p1.screenWidth, p1.screenY);
            ctx.lineTo(p2.screenX + p2.screenWidth, p2.screenY - 1);
            ctx.lineTo(p2.screenX - p2.screenWidth, p2.screenY - 1);
            ctx.fill();
            
            // Draw rumble strips
            ctx.fillStyle = segment.isBridge ? segment.rumble : (Math.floor(n / 3) % 2 ? style.rumbleColor1 : style.rumbleColor2);
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
            
            // Check for billboards at this segment
            const billboard = billboards.find(b => Math.floor(b.z / segmentLength) === n);
            if (billboard) {
                drawBillboard(ctx, segment, billboard);
            }
        }
    }
    
    // Draw Vehicle (center bottom)
    playerX += (targetPlayerX - playerX) * 0.1;
    
    const bikeW = 400;
    const bikeH = 400;
    const bikeX = (width / 2) - (bikeW / 2) + (playerX * 100);
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
}

function drawBillboard(ctx, segment, billboard) {
    const scale = segment.p1.screenWidth / roadWidth;
    // Massive size increase
    const w = 1200 * scale * 2;
    const h = 400 * scale * 2;
    
    // Place billboard on left or right
    const side = billboard.side || 'left';
    const x = side === 'left' 
        ? segment.p1.screenX - segment.p1.screenWidth - w - 10 * scale
        : segment.p1.screenX + segment.p1.screenWidth + 10 * scale;
        
    const y = segment.p1.screenY - h - 50 * scale;
    
    // Draw sign
    ctx.fillStyle = billboardStyles.bgColor;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = billboardStyles.borderColor;
    ctx.lineWidth = 10 * scale;
    ctx.strokeRect(x, y, w, h);
    
    // Draw pole
    ctx.fillStyle = '#2d1a0a'; // Dark wood pole
    ctx.fillRect(x + w/2 - 15*scale, y + h, 30*scale, segment.p1.screenY - y - h);
    
    // Draw text
    ctx.fillStyle = billboardStyles.textColor;
    ctx.font = `bold ${Math.floor(billboardStyles.titleSize * scale * 2)}px 'VT323'`;
    ctx.fillText(billboard.text, x + 30*scale, y + 120*scale);
    
    ctx.font = `bold ${Math.floor(60 * scale * 2)}px 'VT323'`;
    ctx.fillText(billboard.details, x + 30*scale, y + 250*scale);
}



function gameLoop() {
    if (!paused) {
        // Auto drive
        position += 40; // Speed (was 100)
        if (position >= segments.length * segmentLength) {
            position = 0;
        }
        
        // Sync scrollbar without triggering event
        window.removeEventListener('scroll', handleScroll);
        window.scrollTo(0, position / 10);
        window.addEventListener('scroll', handleScroll);
    }
    
    render();
    requestAnimationFrame(gameLoop);
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

document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('menu-overlay').style.display = 'none';
    paused = false;
    init();
    playMusic();
});

document.getElementById('dice-btn').addEventListener('click', () => {
    const vehicles = ['bike', 'waymo', 'motorcycle', 'scooter'];
    const roads = ['mttam', 'mission', 'ggp', 'market'];
    
    currentVehicle = vehicles[Math.floor(Math.random() * vehicles.length)];
    currentRoad = roads[Math.floor(Math.random() * roads.length)];
    
    document.getElementById('menu-overlay').style.display = 'none';
    paused = false;
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
    document.getElementById('menu-overlay').style.display = 'block';
    setStep(1); // Reset step!
    if (currentMusic) {
        currentMusic.pause();
        currentMusic.currentTime = 0;
    }
});
