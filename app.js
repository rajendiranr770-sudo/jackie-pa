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

// Smart Tamil Amount Converter (20 ஆயிரம் -> 20000)
function parseTamilAmount(text) {
    let t = text.toLowerCase();
    let numMatch = t.match(/(\d+)/);
    if (!numMatch) return 0;
    
    let baseNum = parseFloat(numMatch[1]);

    if (t.includes("ஆயிரம்") || t.includes("ayiram")) {
        return baseNum * 1000;
    } else if (t.includes("லட்சம்") || t.includes("lakh")) {
        return baseNum * 100000;
    }
    
    return baseNum;
}

// Process AI / Voice Text Inputs
function processNewTransaction(text) {
    let amount = parseTamilAmount(text);
    if (!amount) return alert("தயவுசெய்து சரியான தொகையை உள்ளிடவும்.");

    let category = "வீடு"; 
    let source = "வீடு";
    let t = text.toLowerCase();

    // Classification Rules
    if (t.includes("சம்பளம்") || t.includes("சம்பளப்")) {
        category = "சம்பளம்";
        source = "சம்பளம்";
    } else if (t.includes("கொல்லை") || t.includes("கூலி") || t.includes("மருந்து") || 
               t.includes("களை") || t.includes("வண்டி") || t.includes("ஆள்") || t.includes("தெளிச்ச")) {
        category = "கொல்லை";
    } else if (t.includes("mk") || t.includes("எம் கே") || t.includes("எம்கே")) {
        category = "MK செலவு";
    } else if (t.includes("sk") || t.includes("எஸ் கே") || t.includes("எஸ்கே")) {
        category = "SK செலவு";
    }

    if (t.includes("சம்பளப் பணம்") || t.includes("சம்பளத்தில்")) {
        source = "சம்பளம்";
    }

    let tx = { 
        id: Date.now(), 
        text: text, 
        amount: amount, 
        category: category, 
        source: source, 
        date: new Date().toLocaleString() 
    };

    transactions.push(tx);
    saveState();
}

// Add Extra Input Row for Loans
function addLoanInputRow() {
    let container = document.getElementById('loans-container');
    let count = container.children.length + 1;
    let div = document.createElement('div');
    div.className = 'loan-input-row';
    div.innerHTML = `<span>கடன் ${count}:</span>
                     <input type="number" class="vatti-amount" placeholder="அசல் தொகை (₹)">
                     <input type="number" class="vatti-rate" placeholder="வட்டி % / பைசா">`;
    container.appendChild(div);
}

// Add Loan Directly to Existing Person
function selectPersonForNewLoan(name) {
    document.getElementById('vatti-name').value = name;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Save Vatti Business Accounts (Appends Loans Automatically)
function saveVattiAccount() {
    let name = document.getElementById('vatti-name').value.trim();
    if (!name) return alert("தயவுசெய்து நபர் பெயரை உள்ளிடவும்.");

    let amounts = document.querySelectorAll('.vatti-amount');
    let rates = document.querySelectorAll('.vatti-rate');
    
    // Existing loans list or new list
    let existingLoans = vattiAccounts[name] || [];
    let startNo = existingLoans.length + 1;

    amounts.forEach((elem, idx) => {
        let amt = parseFloat(elem.value) || 0;
        let rate = parseFloat(rates[idx].value) || 0;
        if (amt > 0) {
            existingLoans.push({ 
                loanNo: startNo++, 
                amount: amt, 
                rate: rate, 
                interest: (amt * rate) / 100 
            });
        }
    });

    if (existingLoans.length === 0) return alert("குறைந்தது ஒரு கடனாவது பதிவு செய்யவும்.");

    vattiAccounts[name] = existingLoans; 

    // Reset Form
    document.getElementById('vatti-name').value = '';
    document.getElementById('loans-container').innerHTML = `
        <div class="loan-input-row">
            <span>கடன் 1:</span>
            <input type="number" class="vatti-amount" placeholder="அசல் தொகை (₹)">
            <input type="number" class="vatti-rate" placeholder="வட்டி % / பைசா">
        </div>`;

    saveState();
}

// Update Dashboard Totals
function updateDashboardUI() {
    let totals = { "சம்பளம்": 0, "வீடு": 0, "கொல்லை": 0, "MK செலவு": 0, "SK செலவு": 0, "வட்டி": 0 };

    transactions.forEach(t => {
        let isExpense = ["கொல்லை", "MK செலவு", "SK செலவு"].includes(t.category) || t.text.includes("செலவு") || t.text.includes("கூலி");

        if (t.category === "சம்பளம்" && !isExpense) {
            totals["சம்பளம்"] += t.amount;
        } else if (t.category === "வீடு" && !isExpense) {
            totals["வீடு"] += t.amount;
        }

        if (isExpense) {
            if (totals[t.category] !== undefined) totals[t.category] += t.amount;
            if (t.source === "சம்பளம்") totals["சம்பளம்"] -= t.amount;
            else totals["வீடு"] -= t.amount;
        }
    });

    let totalVattiPrincipal = 0;
    for (let name in vattiAccounts) {
        vattiAccounts[name].forEach(l => totalVattiPrincipal += l.amount);
    }
    totals["வட்டி"] = totalVattiPrincipal;

    if(document.getElementById('salary-val')) document.getElementById('salary-val').innerText = '₹' + totals["சம்பளம்"];
    if(document.getElementById('home-val')) document.getElementById('home-val').innerText = '₹' + totals["வீடு"];
    if(document.getElementById('kollai-val')) document.getElementById('kollai-val').innerText = '₹' + totals["கொல்லை"];
    if(document.getElementById('mk-val')) document.getElementById('mk-val').innerText = '₹' + totals["MK செலவு"];
    if(document.getElementById('sk-val')) document.getElementById('sk-val').innerText = '₹' + totals["SK செலவு"];
    if(document.getElementById('vatti-val')) document.getElementById('vatti-val').innerText = '₹' + totals["வட்டி"];
}

// Render Tab Lists
function renderAllLists() {
    const filterMap = {
        'ai-list': () => transactions,
        'salary-list': () => transactions.filter(t => t.category === 'சம்பளம்'),
        'home-list': () => transactions.filter(t => t.category === 'வீடு'),
        'kollai-list': () => transactions.filter(t => t.category === 'கொல்லை'),
        'mk-list': () => transactions.filter(t => t.category === 'MK செலவு'),
        'sk-list': () => transactions.filter(t => t.category === 'SK செலவு')
    };

    for (let id in filterMap) {
        let el = document.getElementById(id);
        if (el) {
            let list = filterMap[id]();
            el.innerHTML = list.map(t => {
                let isExpense = ["கொல்லை", "MK செலவு", "SK செலவு"].includes(t.category) || t.text.includes("செலவு") || t.text.includes("கூலி");
                let color = isExpense ? "color: red;" : "color: green;";
                let prefix = isExpense ? "-₹" : "+₹";

                return `
                <div class="tx-card">
                    <div class="tx-header">
                        <span>${t.text}</span>
                        <span style="${color}">${prefix}${t.amount}</span>
                    </div>
                    <div class="tx-details">
                        <span>${t.date} | ${t.source}</span>
                        <div>
                            <button onclick="openEditModal(${t.id})" style="border:none; background:none; cursor:pointer;">✏️</button>
                            <button onclick="deleteTx(${t.id})" style="border:none; background:none; cursor:pointer;">🗑️</button>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
    }
}

// Render Vatti Cards with Total Loan + Interest Sums
function renderVattiLists() {
    let container = document.getElementById('vatti-person-list');
    if (!container) return;
    container.innerHTML = '';

    for (let name in vattiAccounts) {
        let loans = vattiAccounts[name];
        let totalPrincipal = 0;
        let totalInterest = 0;

        let loansHTML = loans.map(l => {
            totalPrincipal += l.amount;
            totalInterest += l.interest;
            return `<div class="loan-box" style="background:#f1f5f9; padding:6px; margin:4px 0; border-radius:4px;">
                <strong>கடன் ${l.loanNo}:</strong> அசல்: ₹${l.amount} | வட்டி: ₹${l.interest} (${l.rate}%)
            </div>`;
        }).join('');

        let grandTotal = totalPrincipal + totalInterest;

        container.innerHTML += `
            <div class="person-vatti-card" style="border:2px solid #007bff; margin-top:15px; padding:12px; border-radius:8px;">
                <div class="person-title" style="font-weight:bold; font-size:16px;">
                    👤 ${name}
                    <button onclick="selectPersonForNewLoan('${name}')" style="background:#007bff; color:white; border:none; padding:4px 8px; border-radius:4px; margin-left:10px; cursor:pointer;">➕ கடன் சேர்க்க</button>
                    <button onclick="deleteVattiPerson('${name}')" style="float:right; border:none; background:none; cursor:pointer;">🗑️</button>
                </div>
                ${loansHTML}
                <div style="background:#1e293b; color:white; padding:8px; border-radius:6px; margin-top:8px;">
                    <div>மொத்த அசல்: ₹${totalPrincipal} | மொத்த வட்டி: ₹${totalInterest}</div>
                    <div style="color:#4ade80; font-weight:bold; font-size:15px; margin-top:4px;">👉 மொத்தமாகத் தர வேண்டிய தொகை: ₹${grandTotal}</div>
                </div>
            </div>`;
    }
}

// Edit Modal Handling
function openEditModal(id) {
    let tx = transactions.find(t => t.id === id);
    if (!tx) return;
    editingTxId = id;
    document.getElementById('edit-text').value = tx.text;
    document.getElementById('edit-amount').value = tx.amount;
    document.getElementById('edit-date').value = tx.date;
    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() { document.getElementById('editModal').style.display = 'none'; }

function saveEdit() {
    let tx = transactions.find(t => t.id === editingTxId);
    if (tx) {
        tx.text = document.getElementById('edit-text').value;
        tx.amount = parseFloat(document.getElementById('edit-amount').value) || tx.amount;
        tx.date = document.getElementById('edit-date').value;
        saveState();
    }
    closeEditModal();
}

function deleteTx(id) {
    transactions = transactions.filter(t => t.id !== id);
    saveState();
}

function deleteVattiPerson(name) {
    delete vattiAccounts[name];
    saveState();
}

function switchTab(tabId, element) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    element.classList.add('active');
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
            const transcript = event.results[0][0].transcript;
            document.getElementById('userInput').value = transcript;
            processNewTransaction(transcript);
        };
        recognition.start();
    } else {
        alert("குரல் வசதி இந்த பிரவுசரில் இல்லை.");
    }
}

document.addEventListener("DOMContentLoaded", saveState);
