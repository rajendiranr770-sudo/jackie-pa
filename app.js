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

function parseTamilAmount(text) {
    let t = text.toLowerCase();
    let numMatch = t.match(/(\d+)/);
    if (!numMatch) return 0;
    let baseNum = parseFloat(numMatch[1]);
    if (t.includes("ஆயிரம்") || t.includes("ayiram")) return baseNum * 1000;
    if (t.includes("லட்சம்") || t.includes("lakh")) return baseNum * 100000;
    return baseNum;
}

// Income / Expense Manual Add (For Salary & Home)
function addManualEntry(category, descId, amtId, typeId, dateId) {
    let desc = document.getElementById(descId).value.trim();
    let amt = parseFloat(document.getElementById(amtId).value) || 0;
    let type = document.getElementById(typeId).value;
    let customDate = document.getElementById(dateId).value;

    if (!desc || amt <= 0) return alert("விவரம் மற்றும் தொகையை சரிபார்க்கவும்.");

    let isExpense = type === 'expense';
    let formattedDate = customDate ? new Date(customDate).toLocaleString() : new Date().toLocaleString();

    let tx = {
        id: Date.now(),
        text: desc,
        amount: amt,
        category: category,
        source: category,
        isExpense: isExpense,
        date: formattedDate
    };

    transactions.push(tx);
    document.getElementById(descId).value = '';
    document.getElementById(amtId).value = '';
    saveState();
}

// Expense Manual Add (For Kollai, MK, SK)
function addExpenseManual(category, descId, amtId, sourceId, dateId) {
    let desc = document.getElementById(descId).value.trim();
    let amt = parseFloat(document.getElementById(amtId).value) || 0;
    let source = document.getElementById(sourceId).value;
    let customDate = document.getElementById(dateId).value;

    if (!desc || amt <= 0) return alert("விவரம் மற்றும் தொகையை சரிபார்க்கவும்.");

    let formattedDate = customDate ? new Date(customDate).toLocaleString() : new Date().toLocaleString();

    let tx = {
        id: Date.now(),
        text: `${desc} ${amt} ${source} பணத்தில்`,
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

// Fixed AI Text Processing logic
function processNewTransaction(text) {
    let amount = parseTamilAmount(text);
    if (!amount) return alert("சரியான தொகையை உள்ளிடவும்.");

    let category = "வீடு"; 
    let source = "வீடு";
    let isExpense = true;
    let t = text.toLowerCase();

    // Fix: Strict Salary vs Home Check
    if (t.includes("சம்பளம்") || t.includes("சம்பள")) {
        category = "சம்பளம்";
        source = "சம்பளம்";
        if (t.includes("வந்தது") || t.includes("வாங்கிய") || t.includes("வரவு")) {
            isExpense = false;
        }
    } else if (t.includes("கொல்லை") || t.includes("மருந்து") || t.includes("உரம்")) {
        category = "கொல்லை";
    } else if (t.includes("mk") || t.includes("எம் கே")) {
        category = "MK செலவு";
    } else if (t.includes("sk") || t.includes("எஸ் கே")) {
        category = "SK செலவு";
    } else if (t.includes("வந்தது") || t.includes("வரவு")) {
        isExpense = false;
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

// Loan / Vatti Logic
function addLoanInputRow() {
    let container = document.getElementById('loans-container');
    let div = document.createElement('div');
    div.className = 'loan-input-row';
    div.innerHTML = `
        <input type="number" class="vatti-amount" placeholder="அசல் தொகை (₹)">
        <input type="number" class="vatti-rate" placeholder="வட்டி % / பைசா">
        <input type="datetime-local" class="vatti-date">`;
    container.appendChild(div);
}

function saveVattiAccount() {
    let name = document.getElementById('vatti-name').value.trim();
    if (!name) return alert("நபர் பெயரை உள்ளிடவும்.");

    let amounts = document.querySelectorAll('.vatti-amount');
    let rates = document.querySelectorAll('.vatti-rate');
    let dates = document.querySelectorAll('.vatti-date');

    let existingLoans = vattiAccounts[name] || [];
    let startNo = existingLoans.length + 1;

    amounts.forEach((elem, idx) => {
        let amt = parseFloat(elem.value) || 0;
        let rate = parseFloat(rates[idx].value) || 0;
        let customDate = dates[idx].value ? new Date(dates[idx].value).toLocaleString() : new Date().toLocaleString();

        if (amt > 0) {
            existingLoans.push({
                loanNo: startNo++,
                amount: amt,
                rate: rate,
                interest: (amt * rate) / 100,
                date: customDate
            });
        }
    });

    vattiAccounts[name] = existingLoans;
    document.getElementById('vatti-name').value = '';
    saveState();
}

function updateDashboardUI() {
    let totals = { "சம்பளம்": 0, "வீடு": 0, "கொல்லை": 0, "MK செலவு": 0, "SK செலவு": 0, "வட்டி": 0 };

    transactions.forEach(t => {
        if (!t.isExpense) {
            if (t.category === "சம்பளம்") totals["சம்பளம்"] += t.amount;
            else totals["வீடு"] += t.amount;
        } else {
            totals[t.category] += t.amount;
            if (t.source === "சம்பளம்") totals["சம்பளம்"] -= t.amount;
            else totals["வீடு"] -= t.amount;
        }
    });

    let totalVattiOut = 0;
    for (let name in vattiAccounts) {
        vattiAccounts[name].forEach(l => totalVattiOut += (l.amount + l.interest));
    }
    totals["வட்டி"] = totalVattiOut;

    document.getElementById('salary-val').innerText = '₹' + totals["சம்பளம்"];
    document.getElementById('home-val').innerText = '₹' + totals["வீடு"];
    document.getElementById('kollai-val').innerText = '₹' + totals["கொல்லை"];
    document.getElementById('mk-val').innerText = '₹' + totals["MK செலவு"];
    document.getElementById('sk-val').innerText = '₹' + totals["SK செலவு"];
    document.getElementById('vatti-val').innerText = '₹' + totals["வட்டி"];
}

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
                let isExp = t.isExpense;
                let color = isExp ? "#dc2626" : "#16a34a";
                let prefix = isExp ? "-₹" : "+₹";

                return `
                <div class="card-box">
                    <div class="card-header">
                        <span class="card-text">${t.text}</span>
                        <span class="card-amount" style="color: ${color};">${prefix}${t.amount}</span>
                    </div>
                    <div class="card-footer">
                        <span>${t.date} | ${t.category}</span>
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
            totalPrincipal += l.amount;
            totalInterest += l.interest;
            return `
            <div class="vatti-item">
                <span><strong>கடன் ${l.loanNo}:</strong> ₹${l.amount} (வட்டி: ₹${l.interest})</span>
                <div>
                    <button onclick="editVattiLoan('${name}', ${idx})">✏️</button>
                    <button onclick="deleteVattiLoan('${name}', ${idx})">🗑️</button>
                </div>
            </div>`;
        }).join('');

        container.innerHTML += `
        <div class="card-box">
            <div class="card-header">
                <strong>👤 ${name}</strong>
                <button onclick="deleteVattiPerson('${name}')">🗑️</button>
            </div>
            ${loansHTML}
            <div class="vatti-summary">
                மொத்த அசல்: ₹${totalPrincipal} | வட்டி: ₹${totalInterest}
                <br><strong>மொத்தம்: ₹${totalPrincipal + totalInterest}</strong>
            </div>
        </div>`;
    }
}

function editVattiLoan(name, index) {
    let loan = vattiAccounts[name][index];
    let newAmt = prompt("புதிய அசல் தொகை:", loan.amount);
    let newRate = prompt("புதிய வட்டி %:", loan.rate);
    if (newAmt !== null && newRate !== null) {
        loan.amount = parseFloat(newAmt) || loan.amount;
        loan.rate = parseFloat(newRate) || loan.rate;
        loan.interest = (loan.amount * loan.rate) / 100;
        saveState();
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

function closeEditModal() { document.getElementById('editModal').style.display = 'none'; }

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
            let transcript = event.results[0][0].transcript;
            document.getElementById('userInput').value = transcript;
            processNewTransaction(transcript);
        };
        recognition.start();
    } else {
        alert("குரல் வசதி இந்த பிரவுசரில் இல்லை.");
    }
}

document.addEventListener("DOMContentLoaded", saveState);
