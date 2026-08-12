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
    if (event && event.target) {
        event.target.classList.add('active');
    }

    const chatBar = document.getElementById('chatBar');
    if (chatBar) {
        chatBar.style.display = (currentTab === 'ai') ? 'flex' : 'none';
    }

    renderContent();
}

function renderContent() {
    const container = document.getElementById('main-content');
    container.innerHTML = '';

    if (currentTab !== 'ai') {
        let sourceSelectHtml = '';
        if (['mk', 'sk', 'kollai'].includes(currentTab)) {
            sourceSelectHtml = `
                <label style="font-size:12px;">எந்த பணத்திலிருந்து எடுக்கப்பட்டது?:</label>
                <select id="manual-source">
                    <option value="home">வீட்டு பணம்</option>
                    <option value="salary">சம்பள பணம்</option>
                </select>
            `;
        }

        container.innerHTML += `
            <div class="manual-form">
                <h4>மேனுவல் பதிவு (${currentTab.toUpperCase()})</h4>
                <input type="text" id="manual-desc" placeholder="விவரம் அல்லது பெயர்">
                <input type="number" id="manual-amount" placeholder="தொகை (₹)">
                ${sourceSelectHtml}
                ${currentTab === 'vatti' ? '<input type="number" id="manual-rate" placeholder="வட்டி பர்சன்டேஜ் % (எ.கா: 3)">' : ''}
                <input type="datetime-local" id="manual-datetime">
                <button class="btn-submit" onclick="addManualEntry('${currentTab}')">சேர்</button>
            </div>
        `;
    }

    const filteredLogs = currentTab === 'ai' ? appData.logs : appData.logs.filter(l => l.category === currentTab);

    filteredLogs.forEach(log => {
        container.innerHTML += `
            <div class="card">
                <div class="card-info">
                    <strong>${log.text}</strong>
                    <small>${new Date(log.datetime).toLocaleString('ta-IN')}</small>
                    ${log.source ? `<small>பணம் எடுக்கப்பட்ட இடம்: ${log.source === 'salary' ? 'சம்பளம்' : 'வீடு'}</small>` : ''}
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
    const sourceElem = document.getElementById('manual-source');
    const source = sourceElem ? sourceElem.value : null;
    const datetime = document.getElementById('manual-datetime').value || new Date().toISOString();

    if (amount <= 0) return alert('சரியான தொகையை உள்ளிடவும்');

    const newLog = {
        id: Date.now(),
        category: category,
        source: source,
        text: desc,
        amount: amount,
        rate: rate,
        type: (category === 'salary' || category === 'home' || category === 'vatti') ? 'credit' : 'debit',
        datetime: datetime
    };

    appData.logs.push(newLog);
    recalculateTotals();
}

// AI Smart Parser
function processInputText(text) {
    const numbers = text.match(/\d+/g);
    if (!numbers) {
        alert('தயவுசெய்து தொகையை (எண்ணை) குறிப்பிட்டு டைப் செய்யவும்.');
        return;
    }
    const amount = parseFloat(numbers[0]);
    let category = 'home';
    let source = 'home'; //默认 வீட்டு பணம்

    if (text.includes('சம்பளம்') || text.includes('salary')) {
        source = 'salary';
    }

    if (text.includes('mk') || text.includes('எம் கே') || text.includes('எம்கே')) {
        category = 'mk';
    } else if (text.includes('sk') || text.includes('எஸ் கே') || text.includes('எஸ்கே')) {
        category = 'sk';
    } else if (text.includes('கொல்லை')) {
        category = 'kollai';
    } else if (text.includes('வட்டி')) {
        category = 'vatti';
        source = null;
    } else if (text.includes('சம்பளம்') || text.includes('salary')) {
        category = 'salary';
        source = null;
    } else if (text.includes('வீடு') || text.includes('வீட்டு')) {
        category = 'home';
        source = null;
    }

    const newLog = {
        id: Date.now(),
        category: category,
        source: source,
        text: text,
        amount: amount,
        type: (category === 'salary' || category === 'home' || category === 'vatti') ? 'credit' : 'debit',
        datetime: new Date().toISOString()
    };

    appData.logs.push(newLog);
    recalculateTotals();
}

function handleSend() {
    const input = document.getElementById('userInput');
    const val = input.value.trim();
    if (val !== '') {
        processInputText(val);
        input.value = '';
    }
}

function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('உங்கள் பிரவுசரில் குரல் பதிவு வசதி சப்போர்ட் செய்யவில்லை.');
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ta-IN';

    recognition.onstart = function() {
        document.querySelector('.btn-mic').innerText = '🎙️ கேட்கிறது...';
    };

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        document.getElementById('userInput').value = transcript;
        processInputText(transcript);
        document.querySelector('.btn-mic').innerText = '🎙️ பேசு';
    };

    recognition.onerror = function() {
        alert('குரலைப் புரிந்துகொள்ள முடியவில்லை, மீண்டும் முயற்சிக்கவும்.');
        document.querySelector('.btn-mic').innerText = '🎙️ பேசு';
    };

    recognition.onend = function() {
        document.querySelector('.btn-mic').innerText = '🎙️ பேசு';
    };

    recognition.start();
}

function recalculateTotals() {
    appData.salary = 0; appData.home = 0; appData.kollai = 0; appData.mk = 0; appData.sk = 0; appData.vatti = 0;
    
    appData.logs.forEach(log => {
        // வரவு கணக்குகள்
        if (log.category === 'salary') appData.salary += log.amount;
        if (log.category === 'home') appData.home += log.amount;
        if (log.category === 'vatti') appData.vatti += log.amount;

        // செலவு கணக்குகள் & மூலப் பணத்திலிருந்து கழித்தல்
        if (['mk', 'sk', 'kollai'].includes(log.category)) {
            if (log.category === 'mk') appData.mk += log.amount;
            if (log.category === 'sk') appData.sk += log.amount;
            if (log.category === 'kollai') appData.kollai += log.amount;

            // எந்த பணத்தில் இருந்து எடுக்கப்பட்டதோ அதில் கழித்தல்
            if (log.source === 'salary') appData.salary -= log.amount;
            else appData.home -= log.amount; // இயல்பாக வீட்டுப் பணத்தில் கழியும்
        }
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
