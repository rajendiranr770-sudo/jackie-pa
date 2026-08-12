let appData = JSON.parse(localStorage.getItem('appData')) || {
    salary: 0, home: 0, kollai: 0, mk: 0, sk: 0, vatti: 0,
    logs: []
};

let currentTab = 'ai';

function saveData() {
    localStorage.setItem('appData', JSON.stringify(appData));
    updateDashboard();
    renderContent();
}

function updateDashboard() {
    document.getElementById('dash-salary').innerText = `₹${appData.salary}`;
    document.getElementById('dash-home').innerText = `₹${appData.home}`;
    document.getElementById('dash-kollai').innerText = `₹${appData.kollai}`;
    document.getElementById('dash-mk').innerText = `₹${appData.mk}`;
    document.getElementById('dash-sk').innerText = `₹${appData.sk}`;
    document.getElementById('dash-vatti').innerText = `₹${appData.vatti}`;
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderContent();
}

function renderContent() {
    const container = document.getElementById('main-content');
    container.innerHTML = '';

    // Render Manual Entry Form for Tab
    if (currentTab !== 'ai') {
        container.innerHTML += `
            <div class="manual-form">
                <h4>மேனுவல் பதிவு (${currentTab.toUpperCase()})</h4>
                <input type="text" id="manual-desc" placeholder="விவரம் அல்லது பெயர்">
                <input type="number" id="manual-amount" placeholder="தொகை (₹)">
                ${currentTab === 'vatti' ? '<input type="number" id="manual-rate" placeholder="வட்டி பர்சன்டேஜ் % (எ.கா: 3)">' : ''}
                <input type="datetime-local" id="manual-datetime">
                <button class="btn-submit" onclick="addManualEntry('${currentTab}')">சேர்</button>
            </div>
        `;
    }

    // Filter Logs
    const filteredLogs = currentTab === 'ai' ? appData.logs : appData.logs.filter(l => l.category === currentTab);

    filteredLogs.forEach(log => {
        container.innerHTML += `
            <div class="card">
                <div class="card-info">
                    <strong>${log.text}</strong>
                    <small>${new Date(log.datetime).toLocaleString('ta-IN')}</small>
                    ${log.rate ? `<small>வட்டி: ${log.rate}%</small>` : ''}
                </div>
                <div>
                    <span class="card-amount ${log.type === 'credit' ? 'credit' : 'debit'}">
                        ${log.type === 'credit' ? '+' : '-'}₹${log.amount}
                    </span>
                    <button class="actions-btn" onclick="openEditModal(${log.id})">✏️</button>
                    <button class="actions-btn" onclick="deleteEntry(${log.id})">🗑️</button>
                </div>
            </div>
        `;
    });
}

function addManualEntry(category) {
    const desc = document.getElementById('manual-desc').value || category;
    const amount = parseFloat(document.getElementById('manual-amount').value) || 0;
    const rate = document.getElementById('manual-rate') ? parseFloat(document.getElementById('manual-rate').value) : null;
    const datetime = document.getElementById('manual-datetime').value || new Date().toISOString();

    if (amount <= 0) return alert('சரியான தொகையை உள்ளிடவும்');

    const newLog = {
        id: Date.now(),
        category: category,
        text: desc,
        amount: amount,
        rate: rate,
        type: (category === 'salary' || category === 'home' || category === 'vatti') ? 'credit' : 'debit',
        datetime: datetime
    };

    appData.logs.push(newLog);
    recalculateTotals();
}

function recalculateTotals() {
    appData.salary = 0; appData.home = 0; appData.kollai = 0; appData.mk = 0; appData.sk = 0; appData.vatti = 0;
    
    appData.logs.forEach(log => {
        if (log.category === 'salary') appData.salary += log.amount;
        if (log.category === 'home') appData.home += (log.type === 'credit' ? log.amount : -log.amount);
        if (log.category === 'kollai') appData.kollai += log.amount;
        if (log.category === 'mk') appData.mk += log.amount;
        if (log.category === 'sk') appData.sk += log.amount;
        if (log.category === 'vatti') appData.vatti += log.amount;
    });

    saveData();
}

function openEditModal(id) {
    const log = appData.logs.find(l => l.id === id);
    if (!log) return;

    document.getElementById('edit-id').value = log.id;
    document.getElementById('edit-text').value = log.text;
    document.getElementById('edit-amount').value = log.amount;
    document.getElementById('edit-rate').value = log.rate || '';
    document.getElementById('edit-datetime').value = log.datetime.slice(0, 16);

    document.getElementById('editModal').style.display = 'flex';
}

function saveEdit() {
    const id = parseInt(document.getElementById('edit-id').value);
    const log = appData.logs.find(l => l.id === id);

    if (log) {
        log.text = document.getElementById('edit-text').value;
        log.amount = parseFloat(document.getElementById('edit-amount').value) || 0;
        log.rate = parseFloat(document.getElementById('edit-rate').value) || null;
        log.datetime = document.getElementById('edit-datetime').value;
        
        recalculateTotals();
        closeModal();
    }
}

function deleteEntry(id) {
    if (confirm('இந்தப் பதிவை நீக்க வேண்டுமா?')) {
        appData.logs = appData.logs.filter(l => l.id !== id);
        recalculateTotals();
    }
}

function closeModal() {
    document.getElementById('editModal').style.display = 'none';
}

// Initial Load
updateDashboard();
renderContent();
