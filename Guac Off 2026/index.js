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

const BILLBOARD_CATEGORIES = {
    INFO_PRIMARY: {
        bgColor: '#ff007f',      // Neon Pink
        borderColor: '#00ffff',  // Cyan
        textColor: '#ffffff',
        fontFamily: "'VT323', monospace",
        weight: 'bold',
        scale: 1.5,
        titleSize: 24,
        detailsSize: 16
    },
    INFO_SECONDARY: {
        bgColor: '#3d2b1f',      // Highway Brown
        borderColor: '#ffffff',
        textColor: '#ffffff',
        fontFamily: "Arial, sans-serif",
        weight: 'bold',
        scale: 1.2,
        titleSize: 20,
        detailsSize: 12
    },
    INFO_PLAYFUL: {
        bgColor: '#1b4d3e',      // Park Green
        borderColor: '#ebd2b4',  // Cream
        textColor: '#ebd2b4',
        fontFamily: "cursive, sans-serif",
        weight: 'normal',
        scale: 1.0,
        titleSize: 16,
        detailsSize: 10
    }
};

const billboards = [
    { z: 2000, text: 'CLICK ANYWHERE TO START', details: 'Mobile: Tap anywhere', side: 'right', type: 'INFO_PLAYFUL' },
    { z: 10000, text: 'SF GUAC OFF 2026', details: 'The Ultimate Guac Showdown', side: 'left', type: 'INFO_PRIMARY' },
    { z: 15000, text: 'RIDER SIGNUP', details: 'Register now!', side: 'right', type: 'INFO_SECONDARY' },
    { z: 30000, text: 'WHEN: SEPT 13, 2026', details: '1PM.', side: 'right', type: 'INFO_PRIMARY' },
    { z: 50000, text: 'WHERE: ????', details: 'Location revealed soon.', side: 'left', type: 'INFO_PLAYFUL' },
    { z: 70000, text: 'NO DOUBLE DIPPING', details: '', side: 'right', type: 'INFO_SECONDARY' },
    { z: 90000, text: 'BYOF', details: 'Bring Your Old Friends', side: 'right', type: 'INFO_SECONDARY' },
    { z: 110000, text: 'BYOB', details: 'Bring Your Own Bowl', side: 'left', type: 'INFO_PLAYFUL' },
    { z: 130000, text: 'BE THERE!', details: 'Guac on.', side: 'right', type: 'INFO_SECONDARY' },
    { z: 150000, text: 'SITE UNDER CONSTRUCTION', details: 'Watch your step.', side: 'left', type: 'INFO_PLAYFUL' },
    { z: 170000, text: 'DIGGING IN PROGRESS', details: 'Guac is hard work.', side: 'right', type: 'INFO_SECONDARY' },
    { z: 190000, text: 'COMING SOON', details: 'Full site loading.', side: 'left', type: 'INFO_PLAYFUL' },
    { z: 210000, text: 'KEEP GOING!', details: 'You are flying.', side: 'right', type: 'INFO_SECONDARY' },
    { z: 230000, text: 'GUAC FACT', details: 'Avocados are berries.', side: 'left', type: 'INFO_PLAYFUL' },
    { z: 250000, text: 'ALMOST THERE?', details: 'Halfway mark.', side: 'right', type: 'INFO_SECONDARY' },
    { z: 270000, text: 'SPEED LIMIT?', details: 'No limit here.', side: 'left' },
    { z: 290000, text: 'GUAC ON', details: 'Keep pedaling.', side: 'right' },
    { z: 310000, text: 'FINAL STRETCH', details: 'Push it.', side: 'left' },
    { z: 330000, text: 'WINNER SOON', details: 'The crown awaits.', side: 'right' },
    { z: 350000, text: 'GUAC OFF 2026', details: 'Don\'t miss it.', side: 'left' },
    { z: 370000, text: 'THE END IS NEAR', details: 'Or is it?', side: 'right' },
    { z: 390000, text: 'FINISH LINE', details: 'Enjoy the guac.', side: 'left' }
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
let lastAutoScrollTime = 0;
let paused = true; // Start paused for menu
let gameStarted = false;
let playerX = 0; // -1 to 1
let targetPlayerX = 0;
let roadWidth = 500;
const segmentLength = 200;
const cameraDepth = 0.84;
const cameraHeight = 1500;
let cameraOffsetX = 0;
const drawDistance = 200;

let currentVehicle = 'bike';
let currentRoad = 'mttam';

// Road Segments
const segments = [];

// Billboards moved to top configuration

// Generate Road
function createRoad() {
    segments.length = 0; // Clear existing segments
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

    p.screenX = (width / 2 + cameraOffsetX) + (p.x + curveOffsetX - playerX * roadWidth) * sp * (width / 2);
    // Adjust Y projection for hills
    p.screenY = (height / 2) + (cameraHeight - p.y) * sp * (height / 2);
    p.screenWidth = roadWidth * sp * (width / 2);
}
function handleScroll() {
    if (Date.now() - lastAutoScrollTime < 100) return; // Ignore events triggered by auto-scroll
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

// Render
function render() {
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
    
    // HUD Billboard for upcoming sign!
    const upcomingBillboard = billboards.find(b => b.z > position);
    let hud = document.getElementById('hud-billboard');
    if (!hud) {
        hud = document.createElement('div');
        hud.id = 'hud-billboard';
        document.body.appendChild(hud);
    }
    
    if (upcomingBillboard) {
        hud.style.display = 'block';
        hud.style.position = 'fixed';
        hud.style.top = '60px'; // Move lower!
        hud.style.left = '50%';
        hud.style.transform = 'translateX(-50%)';
        hud.style.zIndex = '100000';
        hud.style.padding = '15px';
        hud.style.pointerEvents = 'none';
        hud.style.textAlign = 'center';
        hud.style.minWidth = '200px';
        
        hud.innerHTML = `<h3 style="margin:0; font-size:1.2rem;">${upcomingBillboard.text}</h3><p style="margin:5px 0 0 0; font-size:0.9rem;">${upcomingBillboard.details}</p>`;
        
        const cat = BILLBOARD_CATEGORIES[upcomingBillboard.type] || BILLBOARD_CATEGORIES.INFO_PLAYFUL;
        hud.style.background = cat.bgColor;
        hud.style.color = cat.textColor;
        hud.style.border = `2px solid ${cat.borderColor}`;
        hud.style.fontFamily = cat.fontFamily;
        if (upcomingBillboard.type === 'INFO_PRIMARY') {
            hud.style.borderRadius = '0';
            hud.style.clipPath = 'polygon(5% 0%, 100% 0%, 95% 100%, 0% 100%)';
        } else if (upcomingBillboard.type === 'INFO_PLAYFUL') {
            hud.style.borderRadius = '0';
            hud.style.clipPath = 'polygon(0% 0%, 100% 5%, 100% 100%, 0% 95%)';
        } else {
            hud.style.borderRadius = '10px';
            hud.style.clipPath = 'none';
        }
    } else {
        hud.style.display = 'none';
    }
    
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
            ctx.fillStyle = segment.isBridge ? segment.color : (Math.floor(n / 3) % 2 ? '#2c2c2c' : '#1e1e1e');
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
            

        }
    }
    
    // Draw Billboards on Canvas!
    billboards.forEach(b => {
        if (b.z <= position) return; // Behind camera
        
        const segIndex = Math.floor(b.z / segmentLength);
        const startIndex = Math.floor(position / segmentLength);
        const drawDistance = isMobile ? 50 : 150;
        const maxSegments = Math.min(segments.length, startIndex + drawDistance);
        
        if (segIndex >= startIndex && segIndex < maxSegments) {
            const segment = segments[segIndex];
            const p1 = segment.p1;
            
            const scale = p1.screenWidth / roadWidth;
            const cat = BILLBOARD_CATEGORIES[b.type] || BILLBOARD_CATEGORIES.INFO_PLAYFUL;
            
            const w = (isMobile ? 250 : 300) * scale * 2 * cat.scale;
            const h = (isMobile ? 80 : 100) * scale * 2 * cat.scale;
            
            const offset = isMobile ? w * 0.5 : w;
            const x = b.side === 'left' 
                ? p1.screenX - p1.screenWidth - offset - 10 * scale
                : p1.screenX + p1.screenWidth + (isMobile ? 0 : 10 * scale);
            
            const billboardY = 1000;
            const sp = cameraDepth / (b.z - position);
            const billboardScreenY = (height / 2) + (cameraHeight - billboardY) * sp * (height / 2);
            const y = billboardScreenY - h;
            
            // Draw on canvas!
            ctx.save();
            
            // Draw background
            ctx.fillStyle = cat.bgColor;
            if (b.type === 'INFO_PRIMARY') {
                // Draw slanted rect!
                ctx.beginPath();
                ctx.moveTo(x + w * 0.05, y);
                ctx.lineTo(x + w, y);
                ctx.lineTo(x + w * 0.95, y + h);
                ctx.lineTo(x, y + h);
                ctx.closePath();
                ctx.fill();
            } else if (b.type === 'INFO_PLAYFUL') {
                // Draw slightly slanted top/bottom
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + w, y + h * 0.05);
                ctx.lineTo(x + w, y + h);
                ctx.lineTo(x, y + h * 0.95);
                ctx.closePath();
                ctx.fill();
            } else {
                ctx.fillRect(x, y, w, h);
            }
            
            // Draw border
            ctx.strokeStyle = cat.borderColor;
            ctx.lineWidth = 2 * scale * 2;
            if (b.type === 'INFO_PRIMARY' || b.type === 'INFO_PLAYFUL') {
                ctx.stroke();
            } else {
                ctx.strokeRect(x, y, w, h);
            }
            
            // Draw text
            ctx.fillStyle = cat.textColor;
            ctx.font = `${cat.weight} ${Math.floor(cat.titleSize * scale * 2)}px ${cat.fontFamily}`;
            ctx.fillText(b.text, x + 10 * scale * 2, y + 30 * scale * 2);
            ctx.font = `${Math.floor(cat.detailsSize * scale * 2)}px ${cat.fontFamily}`;
            ctx.fillText(b.details, x + 10 * scale * 2, y + 60 * scale * 2);
            
            // Draw Exit tab for secondary (highway) if needed!
            if (b.type === 'INFO_SECONDARY') {
                const tabW = w * 0.3;
                const tabH = h * 0.3;
                const tabX = x + w * 0.6;
                const tabY = y - tabH;
                
                ctx.fillStyle = cat.bgColor;
                ctx.fillRect(tabX, tabY, tabW, tabH);
                ctx.strokeRect(tabX, tabY, tabW, tabH);
                
                ctx.fillStyle = cat.textColor;
                ctx.font = `${Math.floor(12 * scale * 2)}px ${cat.fontFamily}`;
                ctx.fillText('EXIT 178', tabX + 5 * scale * 2, tabY + 15 * scale * 2);
            }
            
            ctx.restore();
        }
    });
    
    // Draw Vehicle (center bottom)
    playerX += (targetPlayerX - playerX) * 0.1;
    
    const bikeW = isMobile ? 225 : 400;
    const bikeH = isMobile ? 225 : 400;
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
}

function drawBillboard(ctx, segment, billboard) {
    const scale = segment.p1.screenWidth / roadWidth;
    // Massive size increase
    const w = 1200 * scale * 2;
    const h = 400 * scale * 2;
    
    const isMobile = width < 600;
    const offset = isMobile ? w * 0.5 : w;
    const x = side === 'left' 
        ? segment.p1.screenX - segment.p1.screenWidth - offset - 10 * scale
        : segment.p1.screenX + segment.p1.screenWidth + (isMobile ? 0 : 10 * scale);
        
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
    const isMobile = window.innerWidth < 600;
    roadWidth = 1000;
    
    if (!paused) {
        // Auto drive
        position += 40; // Speed (was 100)
        if (position >= segments.length * segmentLength) {
            position = 0;
        }
        
        // Sync scrollbar
        lastAutoScrollTime = Date.now();
        window.scrollTo(0, position / 10);
    }
    
    
    render();
    
    const debugDiv = document.getElementById('debug-overlay');
    if (debugDiv) {
        debugDiv.textContent = `Paused: ${paused} | Pos: ${position} | Segments: ${segments.length} | PlayerX: ${playerX.toFixed(2)}`;
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
    paused = true; // Stay paused until click anywhere
    gameStarted = true;
    init();
    playMusic();
});



document.addEventListener('click', (e) => {
    console.log(`Document click: paused=${paused}, gameStarted=${gameStarted}, target=${e.target.id}`);
    if (gameStarted && 
        e.target.id !== 'music-toggle' && e.target.id !== 'restart-btn') {
        paused = !paused;
    }
});

window.addEventListener('touchstart', (e) => {
    if (paused && gameStarted && 
        e.target.id !== 'music-toggle' && e.target.id !== 'restart-btn') {
        paused = false;
    }
});

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
