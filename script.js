let currentType = null;
let currentValue = null;
let history = []; 
let snapEnabled = false;
const coneColors = { 'red': '#ef4444', 'blue': '#3b82f6', 'yellow': '#facc15', 'orange': '#f97316', 'green': '#22c55e', 'white': '#ffffff' };
let counts = { blue: 0, yellow: 0, orange: 0, ball: 0, goal: 0, cone_red: 0, cone_blue: 0, cone_yellow: 0, cone_orange: 0, cone_green: 0, cone_white: 0 };
let isDragging = false;
let dragItem = null;
let isDrawing = false;
let currentPath = null;
let drawStartX = 0;
let drawStartY = 0;
let activeField = null;

function changeFieldsCount() {
    const val = document.getElementById('fields-count-select').value;
    document.getElementById('wrapper-2').style.display = (val >= 2) ? 'block' : 'none';
    document.getElementById('wrapper-3').style.display = (val >= 3) ? 'block' : 'none';
}

function autoResizeTextarea() {
    const el = document.getElementById('notes-area');
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight) + 2 + 'px';
}

function toggleSnap() {
    snapEnabled = !snapEnabled;
    const btn = document.getElementById('btn-snap');
    if (snapEnabled) {
        btn.innerText = 'Snap: Aan';
        btn.style.backgroundColor = '#10b981';
        btn.style.color = 'white';
    } else {
        btn.innerText = 'Snap: Uit';
        btn.style.backgroundColor = '';
        btn.style.color = '';
    }
}

function openInfo() { document.getElementById('info-modal').style.display = 'flex'; }
function closeInfo() { document.getElementById('info-modal').style.display = 'none'; }
window.onclick = function(event) {
    const modal = document.getElementById('info-modal');
    if (event.target === modal) modal.style.display = "none";
}

function selectItem(type, value, element) {
    currentType = type; currentValue = value;
    document.querySelectorAll('.toolbar button').forEach(btn => btn.classList.remove('active'));
    if(element && element.tagName === "BUTTON") {
        element.classList.add('active');
        document.getElementById('cone-select').selectedIndex = 0; 
    }
    if (type === 'eraser') document.body.classList.add('eraser-mode');
    else document.body.classList.remove('eraser-mode');
}

function selectCustomText(style) {
    currentType = 'custom-text';
    currentValue = style;
    document.querySelectorAll('.toolbar button').forEach(btn => btn.classList.remove('active'));
    document.body.classList.remove('eraser-mode');
}

function resizeCustomTextBox(textEl) {
    const measurement = resizeCustomTextBox.measurement || document.createElement('span');
    resizeCustomTextBox.measurement = measurement;
    const styles = getComputedStyle(textEl);
    measurement.style.position = 'absolute';
    measurement.style.visibility = 'hidden';
    measurement.style.whiteSpace = 'nowrap';
    measurement.style.font = styles.font;
    measurement.style.letterSpacing = styles.letterSpacing;
    measurement.style.padding = styles.padding;
    measurement.style.border = styles.border;
    measurement.textContent = textEl.value || ' ';
    if (!measurement.parentElement) document.body.appendChild(measurement);
    textEl.style.width = Math.ceil(measurement.getBoundingClientRect().width + 6) + 'px';
}

function placeCustomTextAt(percentX, percentY, fieldEl) {
    const textEl = document.createElement('input');
    textEl.type = 'text';
    textEl.className = 'custom-text-box';
    textEl.value = 'Nieuwe tekst';
    if (document.getElementById('custom-text-style').value === 'transparent') {
        textEl.classList.add('transparent-text-box');
    }
    textEl.style.left = percentX + '%';
    textEl.style.top = percentY + '%';

    textEl.addEventListener('mousedown', startDrag);
    textEl.addEventListener('touchstart', startDrag, {passive: false});
    textEl.addEventListener('input', () => resizeCustomTextBox(textEl));

    fieldEl.appendChild(textEl);
    resizeCustomTextBox(textEl);
    history.push({ element: textEl, category: null, isDraw: false });
    textEl.focus();
    textEl.select();
}

function getShirtSVG(color, label, textColor) {
    return `<svg viewBox="0 0 24 24" width="30" height="30" style="fill: ${color}; filter: drop-shadow(0px 3px 3px rgba(0,0,0,0.4)); pointer-events: none;">
            <path d="M20.5,6.5l-4-3.5C16.1,2.6,15.6,2.5,15,2.5H9c-0.6,0-1.1,0.1-1.5,0.5l-4,3.5c-0.5,0.4-0.6,1-0.3,1.5l1.5,2.5 c0.3,0.5,0.9,0.6,1.4,0.4l1.4-0.8V21c0,0.6,0.4,1,1,1h7c0.6,0,1-0.4,1-1V10.1l1.4,0.8c0.5,0.3,1.1,0.1,1.4-0.4l1.5-2.5 C21.1,7.5,21,6.9,20.5,6.5z" stroke="rgba(255,255,255,0.7)" stroke-width="1"/>
            <text x="12" y="14.5" font-size="5.5" font-family="Inter, sans-serif" font-weight="900" fill="${textColor}" text-anchor="middle" dominant-baseline="middle">${label}</text>
        </svg>`;
}

function createZigzagPath(x1, y1, x2, y2) {
    const dx = x2 - x1; const dy = y2 - y1;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const angle = Math.atan2(dy, dx);
    const zigzagSize = 12; 
    let path = `M ${x1},${y1} `;
    const steps = Math.floor(dist / zigzagSize);
    for(let i = 1; i <= steps; i++) {
        const d = i * zigzagSize;
        let offset = (i % 2 === 0) ? 6 : -6;
        if (i === steps) offset = 0; 
        let px = x1 + Math.cos(angle)*d - Math.sin(angle)*offset;
        let py = y1 + Math.sin(angle)*d + Math.cos(angle)*offset;
        path += `L ${px},${py} `;
    }
    path += `L ${x2},${y2}`;
    return path;
}

function deleteItem(el) {
    if (el.dataset.category) { counts[el.dataset.category]--; updateLegend(); }
    el.remove();
}

document.querySelectorAll('.field').forEach(field => {
    field.addEventListener('mousedown', (e) => handleFieldStart(e, field));
    field.addEventListener('touchstart', (e) => handleFieldStart(e, field), {passive: false});
});

function handleFieldStart(e, fieldEl) {
    if (e.button === 2) return;
    
    if (currentType === 'eraser') {
        if (e.target.tagName.toLowerCase() === 'path' && e.target.closest('.draw-layer')) {
            e.target.remove();
        }
        return; 
    }

    if (e.target.closest('.item') || e.target.closest('.custom-text-box') || e.target.closest('.trash-can')) return;
    if (!currentType) { alert("Selecteer eerst een item of tool uit het menu!"); return; }

    const rect = fieldEl.getBoundingClientRect();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    let percentX = ((clientX - rect.left) / rect.width) * 100;
    let percentY = ((clientY - rect.top) / rect.height) * 100;
    const svgX = ((clientX - rect.left) / rect.width) * 750;
    const svgY = ((clientY - rect.top) / rect.height) * 500;

    if (currentType.startsWith('draw-')) {
        isDrawing = true; activeField = fieldEl; drawStartX = svgX; drawStartY = svgY;
        currentPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        currentPath.setAttribute("stroke", "white");
        currentPath.setAttribute("stroke-width", "4");
        currentPath.setAttribute("fill", "none");
        let markerId = fieldEl.id === 'field-1' ? 'arrowhead-1' : (fieldEl.id === 'field-2' ? 'arrowhead-2' : 'arrowhead-3');
        currentPath.setAttribute("marker-end", `url(#${markerId})`);
        if (currentType === 'draw-run') currentPath.setAttribute("stroke-dasharray", "8,8");
        fieldEl.querySelector('.draw-layer').appendChild(currentPath);
    } else if (currentType === 'custom-text') {
        placeCustomTextAt(percentX, percentY, fieldEl);
        currentType = null;
        document.querySelectorAll('.toolbar button').forEach(btn => btn.classList.remove('active'));
    } else {
        if (snapEnabled) {
            let refX = (percentX / 100) * 750;
            let refY = (percentY / 100) * 500;
            refX = Math.round(refX / 25) * 25;
            refY = Math.round(refY / 25) * 25;
            percentX = (refX / 750) * 100;
            percentY = (refY / 500) * 100;
        }
        placeItemAt(percentX, percentY, fieldEl);
    }
}

function placeItemAt(percentX, percentY, fieldEl) {
    const el = document.createElement('div');
    el.className = 'item';
    el.style.left = percentX + '%';
    el.style.top = percentY + '%';
    let category = '';

    if (currentType === 'cone') {
        el.classList.add('cone'); el.style.backgroundColor = coneColors[currentValue]; 
        category = 'cone_' + currentValue; counts[category]++;
    } else if (currentType.startsWith('player-')) {
        let color, textColor, label;
        let customName = document.getElementById('player-name-input').value.trim();

        if (currentType === 'player-blue') { 
            counts.blue++; color = '#3b82f6'; textColor = '#ffffff'; label = 'B' + counts.blue; category = 'blue'; 
        }
        if (currentType === 'player-yellow') { 
            counts.yellow++; color = '#facc15'; textColor = '#000000'; label = 'G' + counts.yellow; category = 'yellow'; 
        }
        if (currentType === 'player-orange') { 
            counts.orange++; color = '#f97316'; textColor = '#ffffff'; label = 'O' + counts.orange; category = 'orange'; 
        }

        let innerHTML = getShirtSVG(color, label, textColor);
        if (customName !== "") {
            innerHTML += `<div class="player-tag">${customName}</div>`;
        }
        el.innerHTML = innerHTML;
    } else if (currentType === 'ball') {
        el.classList.add('emoji-item'); el.innerText = '⚽'; category = 'ball'; counts.ball++;
    } else if (currentType.startsWith('goal')) {
        el.classList.add('goal-shape');
        if (currentType === 'goal-small') el.classList.add('goal-small');
        if (currentType === 'goal-large') el.classList.add('goal-large');
        el.dataset.rotation = 0;
        el.addEventListener('contextmenu', rotateGoal);
        el.addEventListener('dblclick', rotateGoal);
        category = 'goal'; counts.goal++;
    }

    el.dataset.category = category;
    el.addEventListener('mousedown', startDrag);
    el.addEventListener('touchstart', startDrag, {passive: false});
    fieldEl.appendChild(el);
    history.push({ element: el, category: category, isDraw: false });
    updateLegend();
}

function rotateGoal(e) {
    e.preventDefault(); e.stopPropagation();
    let goal = e.currentTarget;
    let currentRotation = parseInt(goal.dataset.rotation || 0);
    currentRotation = (currentRotation + 45) % 360; 
    goal.dataset.rotation = currentRotation;
    goal.style.transform = `translate(-50%, -50%) rotate(${currentRotation}deg)`;
}

function startDrag(e) {
    if (e.button === 2) return;
    e.stopPropagation();
    dragItem = e.currentTarget; isDragging = false;
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    const fieldEl = dragItem.closest('.field');
    const rect = fieldEl.getBoundingClientRect();
    
    dragItem.dataset.startX = ((clientX - rect.left) / rect.width) * 100;
    dragItem.dataset.startY = ((clientY - rect.top) / rect.height) * 100;
    dragItem.dataset.startLeft = parseFloat(dragItem.style.left);
    dragItem.dataset.startTop = parseFloat(dragItem.style.top);
    dragItem.style.cursor = 'grabbing'; dragItem.style.zIndex = 100;
}

function handleMove(e) {
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    if (dragItem) {
        const fieldEl = dragItem.closest('.field');
        const rect = fieldEl.getBoundingClientRect();
        const percentX = ((clientX - rect.left) / rect.width) * 100;
        const percentY = ((clientY - rect.top) / rect.height) * 100;
        const dx = percentX - parseFloat(dragItem.dataset.startX);
        const dy = percentY - parseFloat(dragItem.dataset.startY);

        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
            isDragging = true; e.preventDefault(); 
            let targetX = parseFloat(dragItem.dataset.startLeft) + dx;
            let targetY = parseFloat(dragItem.dataset.startTop) + dy;
            if (snapEnabled && !dragItem.classList.contains('custom-text-box')) {
                let refX = (targetX / 100) * 750;
                let refY = (targetY / 100) * 500;
                refX = Math.round(refX / 25) * 25;
                refY = Math.round(refY / 25) * 25;
                targetX = (refX / 750) * 100;
                targetY = (refY / 500) * 100;
            }
            dragItem.style.left = targetX + '%';
            dragItem.style.top = targetY + '%';

            const trashCan = fieldEl.querySelector('.trash-can');
            const tRect = trashCan.getBoundingClientRect();
            if (clientX >= tRect.left && clientX <= tRect.right && clientY >= tRect.top && clientY <= tRect.bottom) {
                trashCan.classList.add('hover'); dragItem.dataset.inTrash = "true";
            } else {
                trashCan.classList.remove('hover'); dragItem.dataset.inTrash = "false";
            }
        }
    } else if (isDrawing && currentPath && activeField) {
        e.preventDefault(); 
        const rect = activeField.getBoundingClientRect();
        const svgX = ((clientX - rect.left) / rect.width) * 750;
        const svgY = ((clientY - rect.top) / rect.height) * 500;
        if (currentType === 'draw-pass' || currentType === 'draw-run') {
            currentPath.setAttribute("d", `M ${drawStartX},${drawStartY} L ${svgX},${svgY}`);
        } else if (currentType === 'draw-dribble') {
            currentPath.setAttribute("d", createZigzagPath(drawStartX, drawStartY, svgX, svgY));
        }
    }
}

function handleEnd(e) {
    if (dragItem) { 
        const fieldEl = dragItem.closest('.field');
        if (dragItem.dataset.inTrash === "true") {
            deleteItem(dragItem);
            fieldEl.querySelector('.trash-can').classList.remove('hover');
        } else {
            dragItem.style.cursor = 'grab'; dragItem.style.zIndex = 10; 
        }
        setTimeout(() => { isDragging = false; dragItem = null; }, 50); 
    }
    if (isDrawing) { isDrawing = false; activeField = null; if (currentPath) { history.push({ element: currentPath, category: 'draw', isDraw: true }); currentPath = null; } }
}

document.addEventListener('mousemove', handleMove);
document.addEventListener('touchmove', handleMove, {passive: false});
document.addEventListener('mouseup', handleEnd);
document.addEventListener('touchend', handleEnd);

function undo() {
    if (history.length === 0) return;
    let lastAction = history.pop(); 
    while (!document.body.contains(lastAction.element) && history.length > 0) { lastAction = history.pop(); }
    if (!document.body.contains(lastAction.element)) return;
    lastAction.element.remove();
    if (!lastAction.isDraw && lastAction.category) { counts[lastAction.category]--; updateLegend(); }
}

function resetField() {
    if(confirm("Weet je zeker dat je alle velden en opmerkingen leeg wilt maken?")) {
        document.querySelectorAll('.field').forEach(fieldEl => {
            fieldEl.querySelectorAll('.item').forEach(item => item.remove());
            fieldEl.querySelectorAll('.custom-text-box').forEach(tb => tb.remove());
            fieldEl.querySelectorAll('.draw-layer path:not(defs path)').forEach(p => p.remove());
        });
        document.getElementById('notes-area').value = '';
        document.getElementById('notes-area').style.height = '80px';
        document.getElementById('player-name-input').value = '';
        history = []; counts = { blue: 0, yellow: 0, orange: 0, ball: 0, goal: 0, cone_red: 0, cone_blue: 0, cone_yellow: 0, cone_orange: 0, cone_green: 0, cone_white: 0 };
        updateLegend();
    }
}

function updateLegend() {
    document.getElementById('count-blue').innerText = counts.blue; document.getElementById('count-yellow').innerText = counts.yellow; document.getElementById('count-orange').innerText = counts.orange;
    document.getElementById('count-ball').innerText = counts.ball; document.getElementById('count-goal').innerText = counts.goal;
    document.getElementById('count-cone_red').innerText = counts.cone_red; document.getElementById('count-cone_blue').innerText = counts.cone_blue; document.getElementById('count-cone_yellow').innerText = counts.cone_yellow;
    document.getElementById('count-cone_orange').innerText = counts.cone_orange; document.getElementById('count-cone_green').innerText = counts.cone_green; document.getElementById('count-cone_white').innerText = counts.cone_white;
}

async function exportToImage() {
    document.querySelectorAll('.trash-can').forEach(tc => tc.style.display = 'none');
    const exportArea = document.getElementById('export-container');
    const canvas = await html2canvas(exportArea, { scale: 3, backgroundColor: '#ffffff' });
    
    document.querySelectorAll('.trash-can').forEach(tc => tc.style.display = 'flex');
    document.querySelectorAll('.field').forEach(f => {
        f.style.backgroundImage = "repeating-linear-gradient(90deg, transparent, transparent 5.33%, rgba(0,0,0,0.06) 5.33%, rgba(0,0,0,0.06) 10.66%)";
    });

    const link = document.createElement('a'); link.download = 'trainingsvorm.png'; link.href = canvas.toDataURL('image/png'); link.click();
}

async function exportToPDF() {
    document.querySelectorAll('.trash-can').forEach(tc => tc.style.display = 'none');
    const exportArea = document.getElementById('export-container');
    const canvas = await html2canvas(exportArea, { scale: 3, backgroundColor: '#ffffff' });
    
    document.querySelectorAll('.trash-can').forEach(tc => tc.style.display = 'flex');
    document.querySelectorAll('.field').forEach(f => {
        f.style.backgroundImage = "repeating-linear-gradient(90deg, transparent, transparent 5.33%, rgba(0,0,0,0.06) 5.33%, rgba(0,0,0,0.06) 10.66%)";
    });

    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('portraits', 'mm', 'a4');
    const pdfWidth = 210; const pdfHeight = 297;
    const imgProps = pdf.getImageProperties(imgData);
    const imgRatio = imgProps.width / imgProps.height; const pdfRatio = pdfWidth / pdfHeight;
    let finalWidth, finalHeight;
    if (imgRatio > pdfRatio) { finalWidth = pdfWidth - 10; finalHeight = finalWidth / imgRatio; } else { finalHeight = pdfHeight - 10; finalWidth = finalHeight * imgRatio; }
    const x = (pdfWidth - finalWidth) / 2; const y = (pdfHeight - finalHeight) / 2;
    pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight); pdf.save("trainingsvorm.pdf");
}