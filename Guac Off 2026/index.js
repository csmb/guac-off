const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// ==========================================
// CONFIGURATION (Edit this easily!)
// ==========================================
const billboardStyles = {
    bgColor: '#39ff14',      // Background color of the sign
    borderColor: '#000000',  // Border color
    textColor: '#000000',     // Text color
    titleSize: 100,          // Font size for title
    detailsSize: 60          // Font size for details
};

const billboards = [
    { z: 4000, text: 'SF GUAC OFF 2026', details: 'The Ultimate Guac Showdown', side: 'left' },
    { z: 12000, text: 'WHEN: SATURDAY NIGHT', details: 'Bring your best chips.', side: 'right' },
    { z: 20000, text: 'WHERE: SECRET MISSION', details: 'Location revealed soon.', side: 'left' },
    { z: 28000, text: 'NO DOUBLE DIPPING', details: 'Strict rules apply.', side: 'right' },
    { z: 36000, text: 'BYOB', details: 'Bring Your Own Bowl', side: 'left' },
    { z: 44000, text: 'BE THERE!', details: 'Guac on.', side: 'right' }
];

// Golden Gate Bridge Position
const bridgeConfig = {
    startZ: 16000,
    endZ: 26000,
    towers: [18000, 24000],
    color: '#c0362c' // International Orange
};
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
const bikeImg = new Image();
bikeImg.src = 'assets/bike.png';
const bgImg = new Image();
bgImg.src = 'assets/bg.png';

let assetsLoaded = 0;
const totalAssets = 2;

function assetLoaded() {
    assetsLoaded++;
    if (assetsLoaded === totalAssets) {
        init();
    }
}

bikeImg.onload = assetLoaded;
bgImg.onload = assetLoaded;

// Game State
let position = 0;
let playerX = 0; // -1 to 1
let targetPlayerX = 0;
const roadWidth = 2000;
const segmentLength = 200;
const cameraDepth = 0.84;
const cameraHeight = 1500;
const drawDistance = 200;

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
        const isBridge = (z >= bridgeConfig.startZ && z <= bridgeConfig.endZ);
        
        if (n > curveLength && !isBridge) {
            currentCurve = (Math.random() - 0.5) * 6;
            curveLength = n + Math.floor(Math.random() * 50) + 20;
        }
        
        let nextY;
        if (isBridge) {
            currentCurve = 0; // Straight on bridge
            nextY = 0; // Flat on bridge
        } else {
            nextY = Math.sin(n / 20) * 800 + Math.sin(n / 5) * 200;
        }
        
        segments.push({
            p1: { x: 0, y: y, z: z },
            p2: { x: 0, y: nextY, z: (n + 1) * segmentLength },
            curve: currentCurve,
            color: Math.floor(n / 3) % 2 ? '#1a1a1a' : '#111111',
            rumble: isBridge ? bridgeConfig.color : (Math.floor(n / 3) % 2 ? '#ff007f' : '#00ffff'),
            isBridge: isBridge
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
    window.addEventListener('scroll', () => {
        position = window.scrollY * 10;
        if (position > (segments.length - drawDistance) * segmentLength) {
            position = (segments.length - drawDistance) * segmentLength;
        }
    });

    requestAnimationFrame(gameLoop);
}

// Render
function render() {
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw Background (Static for now to handle hills better, or parallax)
    ctx.drawImage(bgImg, 0, 0, width, height);
    
    const startIndex = Math.floor(position / segmentLength);
    const maxSegments = Math.min(segments.length, startIndex + drawDistance);
    
    // Draw road back to front
    for (let n = maxSegments - 1; n >= startIndex; n--) {
        const segment = segments[n];
        
        project(segment.p1, width, height);
        project(segment.p2, width, height);
        
        if (segment.p1.screenY > segment.p2.screenY && segment.p1.screenY < height) {
            // Draw road
            ctx.fillStyle = segment.color;
            ctx.beginPath();
            ctx.moveTo(segment.p1.screenX - segment.p1.screenWidth, segment.p1.screenY);
            ctx.lineTo(segment.p1.screenX + segment.p1.screenWidth, segment.p1.screenY);
            ctx.lineTo(segment.p2.screenX + segment.p2.screenWidth, segment.p2.screenY);
            ctx.lineTo(segment.p2.screenX - segment.p2.screenWidth, segment.p2.screenY);
            ctx.fill();
            
            // Draw rumble strips
            ctx.fillStyle = segment.rumble;
            const rumble1 = segment.p1.screenWidth * 0.1;
            const rumble2 = segment.p2.screenWidth * 0.1;
            
            ctx.beginPath();
            ctx.moveTo(segment.p1.screenX - segment.p1.screenWidth, segment.p1.screenY);
            ctx.lineTo(segment.p1.screenX - segment.p1.screenWidth + rumble1, segment.p1.screenY);
            ctx.lineTo(segment.p2.screenX - segment.p2.screenWidth + rumble2, segment.p2.screenY);
            ctx.lineTo(segment.p2.screenX - segment.p2.screenWidth, segment.p2.screenY);
            ctx.fill();
            
            ctx.beginPath();
            ctx.moveTo(segment.p1.screenX + segment.p1.screenWidth, segment.p1.screenY);
            ctx.lineTo(segment.p1.screenX + segment.p1.screenWidth - rumble1, segment.p1.screenY);
            ctx.lineTo(segment.p2.screenX + segment.p2.screenWidth - rumble2, segment.p2.screenY);
            ctx.lineTo(segment.p2.screenX + segment.p2.screenWidth, segment.p2.screenY);
            ctx.fill();
            
            // Check for billboards at this segment
            const billboard = billboards.find(b => Math.floor(b.z / segmentLength) === n);
            if (billboard) {
                drawBillboard(ctx, segment, billboard);
            }
            
            // Check for bridge towers
            if (bridgeConfig.towers.includes(segment.p1.z)) {
                drawBridgeTower(ctx, segment);
            }
        }
    }
    
    // Draw Bike (center bottom)
    playerX += (targetPlayerX - playerX) * 0.1;
    
    const bikeW = 200;
    const bikeH = 200;
    const bikeX = (width / 2) - (bikeW / 2) + (playerX * 100);
    const bikeY = height - bikeH - 20;
    
    ctx.drawImage(bikeImg, bikeX, bikeY, bikeW, bikeH);
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
    ctx.fillStyle = '#ff007f'; // Keep neon pink pole
    ctx.fillRect(x + w/2 - 15*scale, y + h, 30*scale, segment.p1.screenY - y - h);
    
    // Draw text
    ctx.fillStyle = billboardStyles.textColor;
    ctx.font = `bold ${Math.floor(billboardStyles.titleSize * scale * 2)}px 'VT323'`;
    ctx.fillText(billboard.text, x + 30*scale, y + 120*scale);
    
    ctx.font = `bold ${Math.floor(60 * scale * 2)}px 'VT323'`;
    ctx.fillText(billboard.details, x + 30*scale, y + 250*scale);
}

function drawBridgeTower(ctx, segment) {
    const scale = segment.p1.screenWidth / roadWidth;
    const towerH = 5000 * scale; // Massive height
    const towerW = 300 * scale;
    
    // Position legs on the edges of the road
    const leftX = segment.p1.screenX - segment.p1.screenWidth - towerW;
    const rightX = segment.p1.screenX + segment.p1.screenWidth;
    
    const y = segment.p1.screenY - towerH;
    
    // Draw left leg
    ctx.fillStyle = bridgeConfig.color;
    ctx.fillRect(leftX, y, towerW, towerH);
    
    // Draw right leg
    ctx.fillRect(rightX, y, towerW, towerH);
    
    // Draw crossbeams
    const beamH = 150 * scale;
    // Top beam
    ctx.fillRect(leftX, y + towerH * 0.1, rightX - leftX + towerW, beamH);
    // Middle beam
    ctx.fillRect(leftX, y + towerH * 0.4, rightX - leftX + towerW, beamH);
    // Bottom beam (above road)
    ctx.fillRect(leftX, y + towerH * 0.7, rightX - leftX + towerW, beamH);
    
    // Add thin cross braces (X shape) between beams for detail
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 5 * scale;
    
    // Simple X between top and middle
    ctx.beginPath();
    ctx.moveTo(leftX + towerW, y + towerH * 0.1 + beamH);
    ctx.lineTo(rightX, y + towerH * 0.4);
    ctx.moveTo(rightX, y + towerH * 0.1 + beamH);
    ctx.lineTo(leftX + towerW, y + towerH * 0.4);
    ctx.stroke();
    
    // Simple X between middle and bottom
    ctx.beginPath();
    ctx.moveTo(leftX + towerW, y + towerH * 0.4 + beamH);
    ctx.lineTo(rightX, y + towerH * 0.7);
    ctx.moveTo(rightX, y + towerH * 0.4 + beamH);
    ctx.lineTo(leftX + towerW, y + towerH * 0.7);
    ctx.stroke();
}

function gameLoop() {
    render();
    requestAnimationFrame(gameLoop);
}
