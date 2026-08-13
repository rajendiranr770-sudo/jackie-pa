let transactions = JSON.parse(localStorage.getItem('my_app_txs')) || [];
let vattiAccounts = JSON.parse(localStorage.getItem('my_app_vatti')) || {};
let editingTxId = null;

function saveState() {
    localStorage.setItem('my_app_txs', JSON.stringify(transactions));
    localStorage.setItem('my_app_vatti', JSON.stringify(vattiAccounts));
    updateDashboardUI();
    renderAllLists();
    renderVattiLists();
}

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
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function parseTamilAmount(text) {
    let t = text.toLowerCase();
    let numMatch = t.match(/(\d[\d,]*)/);
    if (!numMatch) return 0;
    let baseNum = parseFloat(numMatch[1].replace(/,/g, ''));
    if (t.includes("ஆயிரம்") || t.includes("ayiram")) return baseNum * 1000;
    if (t.includes("லட்சம்") || t.includes("lakh")) return baseNum * 100000;
    return baseNum;
}

// AI Engine - Auto Logic without Pop-up
function processNewTransaction(text) {
    let amount = parseTamilAmount(text);
    if (!amount) return alert("சரியான தொகையை உள்ளிடவும்.");

    let t = text.toLowerCase();
    let category = "வீடு"; 
    let source = "வீடு"; 
    let isExpense = true;

    if (t.includes("சம்பள") || t.includes("சம்பளம்")) {
        source = "சம்பளம்";
        category = "சம்பளம்";
    }

    if (t.includes("வந்தது") || t.includes("வரவு") || t.includes("கிடைத்தது")) {
        isExpense = false;
    } else if (t.includes("வட்டி") || t.includes("பைசா") || t.includes("கடன்")) {
        category = "வட்டி";
        isExpense = false;

        let name = "பொது வட்டி";
        let words = text.split(" ");
        for (let word of words) {
            let cleanWord = word.replace(/(க்கு|ரிடம்|விடம்|இடம்|கிட்ட|க்குச்)$/g, "").trim();
            if (cleanWord.length > 2 && !["வட்டி", "பைசா", "கடன்", "மூணு", "இரண்டு"].includes(cleanWord)) {
                name = cleanWord;
                break;
            }
        }

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
    } else if (t.includes("கொல்லை") || t.includes("மருந்து") || t.includes("உரம்") || t.includes("கூலி")) {
        category = "கொல்லை";
    } else if (t.includes("mk") || t.includes("எம் கே")) {
        category = "MK செலவு";
    } else if (t.includes("sk") || t.includes("எஸ் கே")) {
        category = "SK செலவு";
    }

    let tx = {
        id: Date.now(),
        text: text,
        amount: amount,
        category: category,
        source: source,
        isExpense: isExpense,
        date: new Date().toLocaleString()
    };

    transactions.push(tx);
    saveState();
}

function addManualEntry(category, descId, amtId, typeId, dateId) {
    let desc = document.getElementById(descId).value.trim();
    let amt = parseFloat(document.getElementById(amtId).value) || 0;
    let type = document.getElementById(typeId).value;
    let customDate = document.getElementById(dateId) ? document.getElementById(dateId).value : '';

    if (!desc || amt <= 0) return alert("விவரம் மற்றும் தொகையை சரிபார்க்கவும்.");

    let formattedDate = customDate ? new Date(customDate).toLocaleString() : new Date().toLocaleString();
    transactions.push({ id: Date.now(), text: desc, amount: amt, category: category, source: category, isExpense: (type === 'expense'), date: formattedDate });
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
    transactions.push({ id: Date.now(), text: desc, amount: amt, category: category, source: source, isExpense: true, date: formattedDate });
    document.getElementById(descId).value = '';
    document.getElementById(amtId).value = '';
    saveState();
}

// Vatti Account Functions
function addMoreLoanField() {
    let container = document.getElementById('vatti-inputs-container');
    let div = document.createElement('div');
    div.style.cssText = "display: flex; gap: 8px; margin-bottom: 8px;";
    div.innerHTML = `
        <input type="number" class="vatti-amt-input" placeholder="கூடுதல் அசல் தொகை (₹)" style="flex:1;">
        <input type="number" class="vatti-rate-input" placeholder="வட்டி %" style="flex:1;">
    `;
    container.appendChild(div);
}

function saveVattiAccount() {
    let name = document.getElementById('vatti-name').value.trim() || "பொது வட்டி";
    let amtInputs = document.querySelectorAll('.vatti-amt-input');
    let rateInputs = document.querySelectorAll('.vatti-rate-input');

    if (!vattiAccounts[name]) vattiAccounts[name] = [];

    amtInputs.forEach((input, i) => {
        let amt = parseFloat(input.value) || 0;
        let rate = parseFloat(rateInputs[i]?.value) || 3;
        if (amt > 0) {
            vattiAccounts[name].push({
                loanNo: vattiAccounts[name].length + 1,
                amount: amt,
                rate: rate,
                date: new Date().toISOString()
            });
        }
    });

    document.getElementById('vatti-name').value = '';
    document.getElementById('vatti-inputs-container').innerHTML = `
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <input type="number" class="vatti-amt-input" placeholder="அசல் தொகை (₹)" style="flex:1;">
            <input type="number" class="vatti-rate-input" placeholder="வட்டி % / பைசா" style="flex:1;">
        </div>
    `;
    saveState();
}

function addSingleLoanForPerson(name) {
    let amt = prompt(`${name} அவர்களுக்கு கூடுதல் கடன் தொகை (₹):`);
    if (!amt || parseFloat(amt) <= 0) return;
    let rate = prompt(`வட்டி விகிதம் (%):`, "3");

    vattiAccounts[name].push({
        loanNo: vattiAccounts[name].length + 1,
        amount: parseFloat(amt),
        rate: parseFloat(rate) || 3,
        date: new Date().toISOString()
    });
    saveState();
}

function calculateInterest(amount, rate) {
    return Math.round((amount * rate) / 100);
}

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
            totalVattiOut += l.amount;
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
                let prefix = isExp ? "- " : "+ ";

                return `
                <div class="card-box" style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong style="font-size:15px; color:#1e293b;">${t.text}</strong>
                        <span style="color:${color}; font-weight:bold; font-size:16px;">${prefix}₹${t.amount}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#64748b; margin-top:6px;">
                        <span>${t.date} | ${t.category} (${t.source})</span>
                        <div>
                            <button onclick="openEditModal(${t.id})" style="background:none; border:none; cursor:pointer;">✏️</button>
                            <button onclick="deleteTx(${t.id})" style="background:none; border:none; cursor:pointer;">🗑️</button>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
    }
}

// Vatti Render - Matches Screenshot 2 Exactly
function renderVattiLists() {
    let container = document.getElementById('vatti-person-list');
    if (!container) return;
    container.innerHTML = '';

    for (let name in vattiAccounts) {
        let loans = vattiAccounts[name];
        let totalPrincipal = 0;
        let totalInterest = 0;

        let loansHTML = loans.map((l, idx) => {
            let interest = calculateInterest(l.amount, l.rate);
            totalPrincipal += l.amount;
            totalInterest += interest;

            return `
            <div style="background:#f8fafc; padding:8px 12px; border-radius:6px; margin-bottom:6px; display:flex; justify-content:space-between; font-size:14px;">
                <span><strong>கடன் ${idx+1}:</strong> அசல்: ₹${l.amount} | வட்டி: ₹${interest} (${l.rate}%)</span>
                <button onclick="deleteVattiLoan('${name}', ${idx})" style="background:none; border:none; cursor:pointer; font-size:12px;">🗑️</button>
            </div>`;
        }).join('');

        container.innerHTML += `
        <div style="background:#fff; border:2px solid #2563eb; border-radius:10px; padding:12px; margin-bottom:15px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-size:16px; font-weight:bold; color:#1e293b;">👤 ${name}</span>
                <div>
                    <button onclick="addSingleLoanForPerson('${name}')" style="background:#2563eb; color:white; border:none; padding:5px 10px; border-radius:6px; font-weight:bold; font-size:12px; cursor:pointer;">➕ கடன் சேர்க்க</button>
                    <button onclick="deleteVattiPerson('${name}')" style="background:none; border:none; cursor:pointer; font-size:14px; margin-left:5px;">🗑️</button>
                </div>
            </div>
            ${loansHTML}
            <div style="background:#0f172a; color:white; padding:10px; border-radius:8px; margin-top:10px; font-size:13px;">
                <div>மொத்த அசல்: ₹${totalPrincipal} | மொத்த வட்டி: ₹${totalInterest}</div>
                <div style="color:#4ade80; font-weight:bold; font-size:14px; margin-top:4px;">👉 மொத்தமாகத் தர வேண்டிய தொகை: ₹${totalPrincipal + totalInterest}</div>
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

function openEditModal(id) {
    let tx = transactions.find(t => t.id === id);
    if (!tx) return;
    editingTxId = id;
    document.getElementById('edit-text').value = tx.text;
    document.getElementById('edit-amount').value = tx.amount;
    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() { 
    document.getElementById('editModal').style.display = 'none'; 
}

function saveEdit() {
    let tx = transactions.find(t => t.id === editingTxId);
    if (tx) {
        tx.text = document.getElementById('edit-text').value;
        tx.amount = parseFloat(document.getElementById('edit-amount').value) || tx.amount;
        saveState();
    }
    closeEditModal();
}

function deleteTx(id) {
    transactions = transactions.filter(t => t.id !== id);
    saveState();
}

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
