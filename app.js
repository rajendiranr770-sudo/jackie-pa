let transactions = JSON.parse(localStorage.getItem('my_app_txs')) || [];
let vattiAccounts = JSON.parse(localStorage.getItem('my_app_vatti')) || {};
let editingTxId = null;
let pendingTxData = null; // Pop-up தேர்வுக்காக தற்காலிகமாக சேமிக்க

function saveState() {
    localStorage.setItem('my_app_txs', JSON.stringify(transactions));
    localStorage.setItem('my_app_vatti', JSON.stringify(vattiAccounts));
    updateDashboardUI();
    renderAllLists();
    renderVattiLists();
}

// ----------------------------------------------------
// 1. Tab Switch & Auto-Scroll Logic (புதிய வசதி)
// ----------------------------------------------------
function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    let activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.classList.add('active');
    if (btnElement) btnElement.classList.add('active');
}

function scrollToSection(elementId) {
    let element = document.getElementById(elementId);
    if (element) {
        element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }
}

// ----------------------------------------------------
// 2. Tamil Amount Parser
// ----------------------------------------------------
function parseTamilAmount(text) {
    let t = text.toLowerCase();
    let numMatch = t.match(/(\d[\d,]*)/);
    if (!numMatch) return 0;
    let baseNum = parseFloat(numMatch[1].replace(/,/g, ''));
    if (t.includes("ஆயிரம்") || t.includes("ayiram")) return baseNum * 1000;
    if (t.includes("லட்சம்") || t.includes("lakh")) return baseNum * 100000;
    return baseNum;
}

// ----------------------------------------------------
// 3. AI Voice & Text Processing Engine (Pop-up Modal இணைக்கப்பட்டது)
// ----------------------------------------------------
function processNewTransaction(text) {
    let amount = parseTamilAmount(text);
    if (!amount) return alert("சரியான தொகையை உள்ளிடவும்.");

    let t = text.toLowerCase();
    let category = "வீடு"; 
    let source = ""; 
    let isExpense = true;

    // 1. Detect Source (பணம் எதிலிருந்து எடுக்கப்பட்டது)
    if (t.includes("சம்பள பணத்தில்") || t.includes("சம்பள பணம்") || t.includes("சம்பளத்திலிருந்து") || t.includes("சம்பளம்")) {
        source = "சம்பளம்";
    } else if (t.includes("வீட்டு பணத்தில்") || t.includes("வீட்டு பணம்") || t.includes("வீட்டிலிருந்து") || t.includes("வீடு")) {
        source = "வீடு";
    }

    // 2. Detect Income vs Expense vs Vatti Business
    if (t.includes("வந்தது") || t.includes("வரவு") || t.includes("வாங்கிய") || t.includes("கிடைத்தது")) {
        isExpense = false;
        category = source || "வீடு";
    } else if (t.includes("வட்டி") || t.includes("பைசா") || t.includes("கடன்") || t.includes("கொடுத்துள்ளேன்") || t.includes("கொடுத்து இருக்கேன்")) {
        category = "வட்டி";
        isExpense = false; 

        let name = "பொது வட்டி";
        if (t.includes("சேகர்")) name = "சேகர்";
        else if (t.includes("ராஜா")) name = "ராஜா";

        let rate = 3; 
        if (t.includes("மூணு") || t.includes("3")) rate = 3;
        else if (t.includes("இரண்டு") || t.includes("2")) rate = 2;

        if (!vattiAccounts[name]) vattiAccounts[name] = [];
        vattiAccounts[name].push({
            loanNo: vattiAccounts[name].length + 1,
            amount: amount,
            rate: rate,
            date: new Date().toISOString()
        });

        saveState();
        return;
    } else if (t.includes("கொல்லை") || t.includes("தொல்லை") || t.includes("மருந்து") || t.includes("உரம்") || t.includes("கூலி") || t.includes("ஏறு")) {
        category = "கொல்லை";
    } else if (t.includes("mk") || t.includes("எம் கே") || t.includes("எம்கே")) {
        category = "MK செலவு";
    } else if (t.includes("sk") || t.includes("எஸ் கே") || t.includes("எஸ்கே")) {
        category = "SK செலவு";
    } else {
        category = source || "வீடு"; 
    }

    // மூலம் (Source) குறிப்பிடப்படவில்லை எனில் Pop-up பெட்டி தோன்றும்
    if (!source && category !== "வட்டி") {
        pendingTxData = { text, amount, category, isExpense, date: new Date().toLocaleString() };
        let modal = document.getElementById('sourceModal');
        if (modal) modal.style.display = 'flex';
        return;
    }

    saveFinalTransaction({ text, amount, category, source, isExpense, date: new Date().toLocaleString() });
}

// Pop-up தொடு பட்டன் தேர்வு
function selectSource(selectedSource) {
    if (pendingTxData) {
        pendingTxData.source = selectedSource;
        if (pendingTxData.category === "வீடு" || pendingTxData.category === "சம்பளம்") {
            pendingTxData.category = selectedSource;
        }
        saveFinalTransaction(pendingTxData);
        pendingTxData = null;
    }
    let modal = document.getElementById('sourceModal');
    if (modal) modal.style.display = 'none';
}

function saveFinalTransaction(txData) {
    txData.id = Date.now();
    transactions.push(txData);
    saveState();
}

// ----------------------------------------------------
// 4. Manual Entry Logic
// ----------------------------------------------------
function addManualEntry(category, descId, amtId, typeId, dateId) {
    let desc = document.getElementById(descId).value.trim();
    let amt = parseFloat(document.getElementById(amtId).value) || 0;
    let type = document.getElementById(typeId).value;
    let customDate = document.getElementById(dateId) ? document.getElementById(dateId).value : '';

    if (!desc || amt <= 0) return alert("விவரம் மற்றும் தொகையை சரிபார்க்கவும்.");

    let isExpense = (type === 'expense');
    let formattedDate = customDate ? new Date(customDate).toLocaleString() : new Date().toLocaleString();

    let source = category;
    if (category === "கொல்லை" || category === "MK செலவு" || category === "SK செலவு") {
        source = desc.includes("சம்பளம்") ? "சம்பளம்" : "வீடு";
    }

    let tx = {
        id: Date.now(),
        text: desc,
        amount: amt,
        category: category,
        source: source,
        isExpense: isExpense,
        date: formattedDate
    };

    transactions.push(tx);
    document.getElementById(descId).value = '';
    document.getElementById(amtId).value = '';
    saveState();
}

function addExpenseManual(category, descId, amtId, sourceId, dateId) {
    let desc = document.getElementById(descId).value.trim();
    let amt = parseFloat(document.getElementById(amtId).value) || 0;
    let source = document.getElementById(sourceId).value;
    let customDate = document.getElementById(dateId) ? document.getElementById(dateId).value : '';

    if (!desc || amt <= 0) return alert("விவரம் மற்றும் தொகையை சரிபார்க்கவும்.");

    let formattedDate = customDate ? new Date(customDate).toLocaleString() : new Date().toLocaleString();

    let tx = {
        id: Date.now(),
        text: desc,
        amount: amt,
        category: category,
        source: source,
        isExpense: true,
        date: formattedDate
    };

    transactions.push(tx);
    document.getElementById(descId).value = '';
    document.getElementById(amtId).value = '';
    saveState();
}

// ----------------------------------------------------
// 5. Vatti Functions
// ----------------------------------------------------
function saveVattiAccount() {
    let nameElem = document.getElementById('vatti-name') || document.querySelector('#vatti-tab input[type="text"]');
    let name = nameElem ? nameElem.value.trim() : '';

    if (!name) name = "பொது வட்டி";

    let inputs = document.querySelectorAll('#vatti-tab input[type="number"]');
    let amt = inputs[0] ? parseFloat(inputs[0].value) || 0 : 0;
    let rate = inputs[1] ? parseFloat(inputs[1].value) || 0 : 3;
    let dateElem = document.querySelector('#vatti-tab input[type="datetime-local"]');
    let customDate = dateElem && dateElem.value ? new Date(dateElem.value).toISOString() : new Date().toISOString();

    if (amt <= 0) return alert("சரியான தொகையை உள்ளிடவும்.");

    if (!vattiAccounts[name]) vattiAccounts[name] = [];

    vattiAccounts[name].push({
        loanNo: vattiAccounts[name].length + 1,
        amount: amt,
        rate: rate,
        date: customDate
    });

    if (nameElem) nameElem.value = '';
    inputs.forEach(input => input.value = '');
    saveState();
}

function calculateDaysAndInterest(startDateStr, principal, monthlyRate) {
    let start = new Date(startDateStr);
    let now = new Date();
    let diffTime = Math.abs(now - start);
    let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    let months = Math.floor(diffDays / 30);
    let remainingDays = diffDays % 30;

    let monthlyInterest = (principal * monthlyRate) / 100;
    let dailyInterest = monthlyInterest / 30;
    let totalInterest = Math.round((months * monthlyInterest) + (remainingDays * dailyInterest));

    return { days: diffDays, months: months, remDays: remainingDays, interest: totalInterest };
}

// ----------------------------------------------------
// 6. Dashboard & List Rendering
// ----------------------------------------------------
function updateDashboardUI() {
    let totals = { "சம்பளம்": 0, "வீடு": 0, "கொல்லை": 0, "MK செலவு": 0, "SK செலவு": 0, "வட்டி": 0 };

    transactions.forEach(t => {
        if (!t.isExpense && t.category !== "வட்டி") {
            if (t.source === "சம்பளம்") totals["சம்பளம்"] += t.amount;
            else totals["வீடு"] += t.amount;
        } else if (t.isExpense) {
            if (t.source === "சம்பளம்") totals["சம்பளம்"] -= t.amount;
            else totals["வீடு"] -= t.amount;

            if (t.category === "கொல்லை") totals["கொல்லை"] += t.amount;
            if (t.category === "MK செலவு") totals["MK செலவு"] += t.amount;
            if (t.category === "SK செலவு") totals["SK செலவு"] += t.amount;
        }
    });

    let totalVattiOut = 0;
    for (let name in vattiAccounts) {
        vattiAccounts[name].forEach(l => {
            let calc = calculateDaysAndInterest(l.date, l.amount, l.rate);
            totalVattiOut += (l.amount + calc.interest);
        });
    }
    totals["வட்டி"] = totalVattiOut;

    let setVal = (id, val) => {
        let el = document.getElementById(id);
        if (el) el.innerText = '₹' + val;
    };

    setVal('salary-val', totals["சம்பளம்"]);
    setVal('home-val', totals["வீடு"]);
    setVal('kollai-val', totals["கொல்லை"]);
    setVal('mk-val', totals["MK செலவு"]);
    setVal('sk-val', totals["SK செலவு"]);
    setVal('vatti-val', totals["வட்டி"]);
}

function renderAllLists() {
    const filterMap = {
        'ai-list': () => transactions,
        'salary-list': () => transactions.filter(t => t.source === 'சம்பளம்'),
        'home-list': () => transactions.filter(t => t.source === 'வீடு'),
        'kollai-list': () => transactions.filter(t => t.category === 'கொல்லை'),
        'mk-list': () => transactions.filter(t => t.category === 'MK செலவு'),
        'sk-list': () => transactions.filter(t => t.category === 'SK செலவு')
    };

    for (let id in filterMap) {
        let el = document.getElementById(id);
        if (el) {
            let list = filterMap[id]();
            el.innerHTML = list.map(t => {
                let isExp = t.isExpense;
                let color = isExp ? "#dc2626" : "#16a34a";
                let prefix = isExp ? "-₹" : "+₹";

                return `
                <div class="card-box">
                    <div class="card-header">
                        <span class="card-text">${t.text}</span>
                        <span class="card-amount" style="color: ${color}; font-weight: bold;">${prefix}${t.amount}</span>
                    </div>
                    <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #666; margin-top: 5px;">
                        <span>${t.date} | ${t.category} (${t.source})</span>
                        <div class="action-btns">
                            <button onclick="openEditModal(${t.id})">✏️</button>
                            <button onclick="deleteTx(${t.id})">🗑️</button>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
    }
}

function renderVattiLists() {
    let container = document.getElementById('vatti-person-list');
    if (!container) return;
    container.innerHTML = '';

    for (let name in vattiAccounts) {
        let loans = vattiAccounts[name];
        let totalPrincipal = 0;
        let totalInterest = 0;

        let loansHTML = loans.map((l, idx) => {
            let calc = calculateDaysAndInterest(l.date, l.amount, l.rate);
            totalPrincipal += l.amount;
            totalInterest += calc.interest;

            return `
            <div class="vatti-item" style="padding: 8px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;">
                <div>
                    <strong>கடன் ${l.loanNo}:</strong> அசல்: ₹${l.amount} | வட்டி: ${l.rate}%
                    <br><small>தேதி: ${new Date(l.date).toLocaleDateString()} (${calc.days} நாட்கள் / ${calc.months} மாதம் ${calc.remDays} நாள்)</small>
                    <br><span style="color:#d97706; font-weight:bold;">வட்டி தொகை: ₹${calc.interest}</span>
                </div>
                <div>
                    <button onclick="deleteVattiLoan('${name}', ${idx})">🗑️</button>
                </div>
            </div>`;
        }).join('');

        container.innerHTML += `
        <div class="card-box" style="margin-bottom: 15px; border: 1px solid #ddd; padding: 10px; border-radius: 8px;">
            <div class="card-header" style="display: flex; justify-content: space-between;">
                <strong>👤 ${name}</strong>
                <button onclick="deleteVattiPerson('${name}')">🗑️</button>
            </div>
            ${loansHTML}
            <div style="margin-top: 8px; font-size: 14px; background: #f8fafc; padding: 6px;">
                மொத்த அசல்: ₹${totalPrincipal} | மொத்த வட்டி: ₹${totalInterest}
                <br><strong style="color:#16a34a;">மொத்த பாக்கி: ₹${totalPrincipal + totalInterest}</strong>
            </div>
        </div>`;
    }
}

function deleteVattiLoan(name, index) {
    vattiAccounts[name].splice(index, 1);
    if (vattiAccounts[name].length === 0) delete vattiAccounts[name];
    saveState();
}

function deleteVattiPerson(name) {
    delete vattiAccounts[name];
    saveState();
}

// ----------------------------------------------------
// 7. Edit Modal Engine
// ----------------------------------------------------
function openEditModal(id) {
    let tx = transactions.find(t => t.id === id);
    if (!tx) return;
    editingTxId = id;
    
    let textElem = document.getElementById('edit-text');
    let amtElem = document.getElementById('edit-amount');
    let sourceElem = document.getElementById('edit-source');

    if (textElem) textElem.value = tx.text;
    if (amtElem) amtElem.value = tx.amount;
    if (sourceElem) sourceElem.value = tx.source;

    let modal = document.getElementById('editModal');
    if (modal) modal.style.display = 'flex';
}

function closeEditModal() { 
    let modal = document.getElementById('editModal');
    if (modal) modal.style.display = 'none'; 
}

function saveEdit() {
    let tx = transactions.find(t => t.id === editingTxId);
    if (tx) {
        let textElem = document.getElementById('edit-text');
        let amtElem = document.getElementById('edit-amount');
        let sourceElem = document.getElementById('edit-source');

        if (textElem) tx.text = textElem.value;
        if (amtElem) tx.amount = parseFloat(amtElem.value) || tx.amount;
        if (sourceElem) tx.source = sourceElem.value;

        saveState();
    }
    closeEditModal();
}

function deleteTx(id) {
    transactions = transactions.filter(t => t.id !== id);
    saveState();
}

// ----------------------------------------------------
// 8. Event Handlers
// ----------------------------------------------------
function handleManualInput() {
    let input = document.getElementById('userInput');
    if (input && input.value.trim() !== '') {
        processNewTransaction(input.value.trim());
        input.value = '';
    }
}

function startVoiceRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'ta-IN';
        recognition.onresult = function(event) {
            let transcript = event.results[0][0].transcript;
            let input = document.getElementById('userInput');
            if (input) input.value = transcript;
            processNewTransaction(transcript);
        };
        recognition.start();
    } else {
        alert("குரல் வசதி இந்த பிரவுசரில் இல்லை.");
    }
}

document.addEventListener("DOMContentLoaded", saveState);
