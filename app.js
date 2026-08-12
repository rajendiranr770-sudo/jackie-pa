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

function extractAmount(text) {
    let match = text.match(/(\d[\d,]*)/);
    return match ? parseFloat(match[1].replace(/,/g, '')) || 0 : 0;
}

// Fixed Transaction Process (Vatti is 100% SEPARATE)
function processNewTransaction(text) {
    let amount = extractAmount(text);
    if (!amount) return alert("தயவுசெய்து சரியான தொகையை உள்ளிடவும்.");

    let category = "வீடு";
    let source = "வீடு";

    if (text.includes("கொல்லை")) category = "கொல்லை";
    else if (text.includes("MK") || text.includes("எம் கே")) category = "MK செலவு";
    else if (text.includes("SK") || text.includes("எஸ் கே")) category = "SK செலவு";
    else if (text.includes("சம்பளம்")) { category = "சம்பளம்"; source = "சம்பளம்"; }

    let tx = { id: Date.now(), text: text, amount: amount, category: category, source: source, date: new Date().toLocaleString() };
    transactions.push(tx);
    saveState();
}

// Add Loan Input Row dynamically (+)
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

// Save Vatti Business Accounts
function saveVattiAccount() {
    let name = document.getElementById('vatti-name').value.trim();
    if (!name) return alert("தயவுசெய்து நபர் பெயரை உள்ளிடவும்.");

    let amounts = document.querySelectorAll('.vatti-amount');
    let rates = document.querySelectorAll('.vatti-rate');
    let loans = [];

    amounts.forEach((elem, idx) => {
        let amt = parseFloat(elem.value) || 0;
        let rate = parseFloat(rates[idx].value) || 0;
        if (amt > 0) {
            loans.push({ loanNo: idx + 1, amount: amt, rate: rate, interest: (amt * rate) / 100 });
        }
    });

    if (loans.length === 0) return alert("குறைந்தது ஒரு கடனாவது பதிவு செய்யவும்.");

    if (!vattiAccounts[name]) vattiAccounts[name] = [];
    vattiAccounts[name] = loans; // Updates or appends to existing person

    document.getElementById('vatti-name').value = '';
    document.getElementById('loans-container').innerHTML = `
        <div class="loan-input-row">
            <span>கடன் 1:</span>
            <input type="number" class="vatti-amount" placeholder="அசல் தொகை (₹)">
            <input type="number" class="vatti-rate" placeholder="வட்டி % / பைசா">
        </div>`;

    saveState();
}

// Update Top Dashboard Amounts
function updateDashboardUI() {
    let totals = { "சம்பளம்": 0, "வீடு": 0, "கொல்லை": 0, "MK செலவு": 0, "SK செலவு": 0, "வட்டி": 0 };

    transactions.forEach(t => {
        if (t.category === "சம்பளம்") totals["சம்பளம்"] += t.amount;
        else if (t.category === "வீடு") totals["வீடு"] += t.amount;
        else if (totals[t.category] !== undefined) totals[t.category] += t.amount;
    });

    // Total Vatti Business Balance (Independent)
    let totalVattiPrincipal = 0;
    for (let name in vattiAccounts) {
        vattiAccounts[name].forEach(l => totalVattiPrincipal += l.amount);
    }
    totals["வட்டி"] = totalVattiPrincipal;

    document.getElementById('salary-val').innerText = '₹' + totals["சம்பளம்"];
    document.getElementById('home-val').innerText = '₹' + totals["வீடு"];
    document.getElementById('kollai-val').innerText = '₹' + totals["கொல்லை"];
    document.getElementById('mk-val').innerText = '₹' + totals["MK செலவு"];
    document.getElementById('sk-val').innerText = '₹' + totals["SK செலவு"];
    document.getElementById('vatti-val').innerText = '₹' + totals["வட்டி"];
}

// Render Vatti Cards
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
            return `<div class="loan-box">
                <strong>கடன் ${l.loanNo}:</strong> அசல்: ₹${l.amount} | வட்டி: ₹${l.interest} (${l.rate}%)
            </div>`;
        }).join('');

        container.innerHTML += `
            <div class="person-vatti-card">
                <div class="person-title">👤 ${name} <button onclick="deleteVattiPerson('${name}')" style="float:right; border:none; background:none; cursor:pointer;">🗑️</button></div>
                ${loansHTML}
                <div class="total-loan-box">
                    மொத்த அசல்: ₹${totalPrincipal} | மொத்த வட்டி: ₹${totalInterest}
                </div>
            </div>`;
    }
}

// Edit & Delete Handlers
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

function renderAllLists() {
    let el = document.getElementById('ai-list');
    if (!el) return;
    el.innerHTML = transactions.map(t => `
        <div class="tx-card">
            <div class="tx-header"><span>${t.text}</span><span>₹${t.amount}</span></div>
            <div class="tx-details">
                <span>${t.date}</span>
                <div>
                    <button onclick="openEditModal(${t.id})" style="border:none; background:none; cursor:pointer;">✏️ எடிட்</button>
                    <button onclick="deleteTx(${t.id})" style="border:none; background:none; cursor:pointer;">🗑️ நீக்கு</button>
                </div>
            </div>
        </div>`).join('');
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

document.addEventListener("DOMContentLoaded", saveState);
