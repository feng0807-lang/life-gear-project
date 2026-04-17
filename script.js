// --- Firebase 配置 (替换为你自己的) ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// 1. 初始化齿轮图形
const teethGroup = document.getElementById('teeth');
for (let i = 0; i < 8; i++) {
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "46");
    rect.setAttribute("y", "6");
    rect.setAttribute("width", "8");
    rect.setAttribute("height", "14");
    rect.setAttribute("fill", "#00ff41");
    rect.setAttribute("transform", `rotate(${i * 45} 50 50)`);
    teethGroup.appendChild(rect);
}

// 2. 变量定义
let sessionTurns = 0;
let rotation = 0;
let isDragging = false;
let lastAngle = 0;
let lastMoveTime = Date.now();

const gearMesh = document.getElementById('gear-mesh');
const container = document.getElementById('gear-container');
const counterEl = document.getElementById('counter');
const statusEl = document.getElementById('status');

// 3. 交互逻辑
function getAngle(x, y) {
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
}

const startDrag = (e) => {
    isDragging = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    lastAngle = getAngle(clientX, clientY);
};

const moveDrag = (e) => {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const currentAngle = getAngle(clientX, clientY);
    
    let delta = currentAngle - lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    rotation += delta;
    gearMesh.setAttribute('transform', `rotate(${rotation} 50 50)`);
    
    const newTurns = Math.floor(Math.abs(rotation) / 360);
    if (newTurns > sessionTurns) {
        const diff = newTurns - sessionTurns;
        sessionTurns = newTurns;
        counterEl.innerText = sessionTurns;
        syncToFirebase(diff); // 提交增量数据
        if (window.navigator.vibrate) window.navigator.vibrate(10);
    }
    
    lastAngle = currentAngle;
    lastMoveTime = Date.now();
    statusEl.innerText = '[ACTIVE]';
    statusEl.style.color = '#00ff41';
};

const stopDrag = () => { isDragging = false; };

// 事件绑定
container.addEventListener('mousedown', startDrag);
window.addEventListener('mousemove', moveDrag);
window.addEventListener('mouseup', stopDrag);
container.addEventListener('touchstart', startDrag);
window.addEventListener('touchmove', moveDrag);
window.addEventListener('touchend', stopDrag);

// 4. 数据同步逻辑
function syncToFirebase(inc) {
    const state = document.getElementById('state-selector').value;
    const ref = db.ref('stats/' + state);
    ref.transaction((current) => (current || 0) + inc);
}

// 5. 实时监听排行榜
db.ref('stats').on('value', (snapshot) => {
    const val = snapshot.val() || {};
    const sorted = Object.entries(val).sort((a, b) => b[1] - a[1]);
    
    // 渲染州排行
    document.getElementById('state-list').innerHTML = sorted.map(([name, score], i) => `
        <div class="flex justify-between ${i === 0 ? 'text-[#00ff41] font-bold' : 'opacity-60'}">
            <span>${i + 1}. ${name}</span>
            <span>${score.toLocaleString()}</span>
        </div>
    `).join('');

    // 渲染国家总数
    const total = Object.values(val).reduce((a, b) => a + b, 0);
    document.getElementById('national-total').innerText = total.toLocaleString();
});

// 6. 定位与状态检测
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(p => {
        document.getElementById('coords').innerText = `LAT: ${p.coords.latitude.toFixed(2)} | LON: ${p.coords.longitude.toFixed(2)}`;
    }, () => {
        document.getElementById('coords').innerText = "LOCATION_ACCESS_DENIED";
    });
}

setInterval(() => {
    if (Date.now() - lastMoveTime > 2000) {
        statusEl.innerText = '[STAGNANT]';
        statusEl.style.color = '#ff4444';
    }
}, 1000);
