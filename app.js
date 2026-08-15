import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Firebase Configuration (உங்கள் Firebase விவரங்களை இங்கு பயன்படுத்தவும்)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Global Variables
let currentEditCategory = null;
let currentEditIndex = null;
let selectedSource = null;
let pendingExpenseEntry = null;

// TAB SWITCHING
window.switchTab = function(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    if (btn) btn.classList.add('active');
};

// INITIAL LOAD & REALTIME LISTENERS
window.addEventListener('DOMContentLoaded', () => {
    listenToTransactions();
    listenToVattiData();
});

// 1. வரவு / செலவு பதிவு (சம்பளம், வீடு)
window.addManualEntry = function(category, descId, amtId, typeId, dateId) {
    const desc = document.getElementById(descId).value.trim();
    const amt = parseFloat(document.getElementById(amtId).value);
    const type = document.getElementById(typeId).value;
    const customDate = document.getElementById(dateId) ? document.getElementById(dateId).value : null;

    if (!desc || isNaN(amt)) {
        alert("தயவுசெய்து விவரம் மற்றும் தொகையை சரியாக உள்ளிடவும்.");
        return;
    }

    const entryDate = customDate ? new Date(customDate).toLocaleString() : new Date().toLocaleString();
    const timestamp = customDate ? new Date(customDate).getTime() : Date.now();

    const entry = {
        category: category,
        description: desc,
        amount: amt,
        type: type,
        date: entryDate,
        timestamp: timestamp
    };

    saveTransaction(entry);

    document.getElementById(descId).value = '';
    document.getElementById(amtId).value = '';
    if (document.getElementById(dateId)) document.getElementById(dateId).value = '';
};

// 2. செலவு பதிவு (கொல்லை, MK, SK)
window.addExpenseManual = function(category, descId, amtId, sourceId, dateId) {
    const desc = document.getElementById(descId).value.trim();
    const amt = parseFloat(document.getElementById(amtId).value);
    const source = document.getElementById(sourceId).value;
    const customDate = document.getElementById(dateId) ? document.getElementById(dateId).value : null;

    if (!desc || isNaN(amt)) {
        alert("தயவுசெய்து விவரம் மற்றும் தொகையை சரியாக உள்ளிடவும்.");
        return;
    }

    const entryDate = customDate ? new Date(customDate).toLocaleString() : new Date().toLocaleString();
    const timestamp = customDate ? new Date(customDate).getTime() : Date.now();

    const entry = {
        category: category,
        description: desc,
        amount: amt,
        type: 'expense',
        source: source,
        date: entryDate,
        timestamp: timestamp
    };

    saveTransaction(entry);

    document.getElementById(descId).value = '';
    document.getElementById(amtId).value = '';
    if (document.getElementById(dateId)) document.getElementById(dateId).value = '';
};

// SAVE TRANSACTION TO FIREBASE
function saveTransaction(entry) {
    const transactionsRef = ref(db, 'transactions');
    push(transactionsRef, entry);
}

// LISTEN TO TRANSACTIONS AND UPDATE DASHBOARD
function listenToTransactions() {
    const transactionsRef = ref(db, 'transactions');
    onValue(transactionsRef, (snapshot) => {
        const data = snapshot.val();
        renderTransactions(data);
    });
}

function renderTransactions(data) {
    let totals = { சம்பளம்: 0, வீடு: 0, கொல்லை: 0, MK: 0, SK: 0 };
    let lists = { சம்பளம்: '', வீடு: '', கொல்லை: '', MK: '', SK: '' };

    if (data) {
        Object.keys(data).forEach(key => {
            const item = data[key];
            const amt = item.type === 'income' ? item.amount : -item.amount;
            
            if (totals[item.category] !== undefined) {
                totals[item.category] += amt;
            }

            const html = `
                <div class="transaction-card">
                    <div>
                        <b>${item.description}</b> 
                        <span class="${item.type === 'income' ? 'text-green' : 'text-red'}">
                            ${item.type === 'income' ? '+' : '-'}₹${item.amount}
                        </span>
                        <br><small style="color:#64748b;">${item.date} | ${item.category} ${item.source ? '(' + item.source + ')' : ''}</small>
                    </div>
                    <div>
                        <button onclick="deleteTransaction('${key}')">🗑️</button>
                    </div>
                </div>
            `;

            if (item.category === 'சம்பளம்') lists['சம்பளம்'] += html;
            else if (item.category === 'வீடு') lists['வீடு'] += html;
            else if (item.category === 'கொல்லை') lists['கொல்லை'] += html;
            else if (item.category === 'MK செலவு') lists['MK'] += html;
            else if (item.category === 'SK செலவு') lists['SK'] += html;
        });
    }

    // Update Dashboard Cards
    if(document.getElementById('salary-val')) document.getElementById('salary-val').innerText = `₹${totals['சம்பளம்']}`;
    if(document.getElementById('home-val')) document.getElementById('home-val').innerText = `₹${totals['வீடு']}`;
    if(document.getElementById('kollai-val')) document.getElementById('kollai-val').innerText = `₹${totals['கொல்லை']}`;
    if(document.getElementById('mk-val')) document.getElementById('mk-val').innerText = `₹${totals['MK']}`;
    if(document.getElementById('sk-val')) document.getElementById('sk-val').innerText = `₹${totals['SK']}`;

    // Update Lists
    if(document.getElementById('salary-list')) document.getElementById('salary-list').innerHTML = lists['சம்பளம்'];
    if(document.getElementById('home-list')) document.getElementById('home-list').innerHTML = lists['வீடு'];
    if(document.getElementById('kollai-list')) document.getElementById('kollai-list').innerHTML = lists['கொல்லை'];
    if(document.getElementById('mk-list')) document.getElementById('mk-list').innerHTML = lists['MK'];
    if(document.getElementById('sk-list')) document.getElementById('sk-list').innerHTML = lists['SK'];
}

window.deleteTransaction = function(key) {
    if (confirm("இந்த பதிவை நீக்க விரும்புகிறீர்களா?")) {
        remove(ref(db, 'transactions/' + key));
    }
};

// ================= VATTI BUSINESS LOGIC (FIXED 0% BUG) =================

window.addMoreLoanField = function() {
    const container = document.getElementById('vatti-inputs-container');
    const div = document.createElement('div');
    div.style.cssText = "display: flex; gap: 8px;";
    div.innerHTML = `
        <input type="number" class="vatti-amt-input" placeholder="அசல் தொகை (₹)" style="flex:1;">
        <input type="number" class="vatti-rate-input" placeholder="வட்டி % / பைசா" style="flex:1;">
    `;
    container.appendChild(div);
};

window.saveVattiAccount = function() {
    const name = document.getElementById('vatti-name').value.trim();
    const amtInputs = document.querySelectorAll('.vatti-amt-input');
    const rateInputs = document.querySelectorAll('.vatti-rate-input');
    const dateVal = document.getElementById('vatti-date-input').value;

    if (!name) {
        alert("தயவுசெய்து நபர் பெயரை உள்ளிடவும்.");
        return;
    }

    let loans = [];
    amtInputs.forEach((amtElem, idx) => {
        const amt = parseFloat(amtElem.value);
        const rawRate = rateInputs[idx].value.trim();
        
        // BUG FIX: 0% போட்டால் 0 ஆக மட்டுமே எடுக்கும் (Empty-ஆக இருந்தால் மட்டுமே default 3%)
        const rate = (rawRate === "" || isNaN(parseFloat(rawRate))) ? 3 : parseFloat(rawRate);

        if (!isNaN(amt)) {
            loans.push({
                amount: amt,
                rate: rate,
                date: dateVal ? dateVal : new Date().toISOString().split('T')[0]
            });
        }
    });

    if (loans.length === 0) {
        alert("குறைந்தது ஒரு கடனுக்கான தொகையை உள்ளிடவும்.");
        return;
    }

    const vattiRef = ref(db, 'vatti/' + name);
    push(vattiRef, { loans: loans, createdAt: Date.now() });

    document.getElementById('vatti-name').value = '';
    document.getElementById('vatti-inputs-container').innerHTML = `
        <div style="display: flex; gap: 8px;">
            <input type="number" class="vatti-amt-input" placeholder="அசல் தொகை (₹)" style="flex:1;">
            <input type="number" class="vatti-rate-input" placeholder="வட்டி % / பைசா" style="flex:1;">
        </div>
    `;
    document.getElementById('vatti-date-input').value = '';
};

function listenToVattiData() {
    const vattiRef = ref(db, 'vatti');
    onValue(vattiRef, (snapshot) => {
        const data = snapshot.val();
        renderVattiList(data);
    });
}

function calculateDays(startDateStr) {
    const start = new Date(startDateStr);
    const today = new Date();
    const diffTime = Math.abs(today - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const months = Math.floor(diffDays / 30);
    const remainingDays = diffDays % 30;
    return { totalDays: diffDays, months: months, days: remainingDays };
}

function renderVattiList(data) {
    const container = document.getElementById('vatti-person-list');
    if (!container) return;

    let totalVattiBusinessAmt = 0;
    let html = '';

    if (data) {
        Object.keys(data).forEach(personKey => {
            const personGroup = data[personKey];
            let personTotalPrincipal = 0;
            let personTotalInterest = 0;

            let loansHtml = '';

            Object.keys(personGroup).forEach((loanKey, index) => {
                const item = personGroup[loanKey];
                if (item.loans) {
                    item.loans.forEach((loan, lIdx) => {
                        const dayData = calculateDays(loan.date);
                        
                        // 0% வட்டி கணக்கீடு
                        const monthlyInterest = loan.rate === 0 ? 0 : Math.round((loan.amount * loan.rate) / 100);
                        const totalInterest = loan.rate === 0 ? 0 : Math.round((monthlyInterest / 30) * dayData.totalDays);

                        personTotalPrincipal += loan.amount;
                        personTotalInterest += totalInterest;

                        loansHtml += `
                            <div style="background:#f8fafc; border-left:4px solid #2563eb; padding:10px; margin-bottom:10px; border-radius:6px;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <b>கடன் ${lIdx + 1}: அசல்: ₹${loan.amount} | வட்டி: ${loan.rate}%</b>
                                    <div>
                                        <button onclick="openVattiEditModal('${personKey}', '${loanKey}', ${lIdx}, ${loan.amount}, ${loan.rate}, '${loan.date}')" style="border:none; background:none; cursor:pointer;">✏️</button>
                                        <button onclick="deleteVattiLoan('${personKey}', '${loanKey}')" style="border:none; background:none; cursor:pointer;">🗑️</button>
                                    </div>
                                </div>
                                <div style="font-size:12px; color:#64748b; margin:4px 0;">
                                    📅 தேதி: ${loan.date} (${dayData.totalDays} நாட்கள் (${dayData.months} மாதம் ${dayData.days} நாள்))
                                </div>
                                <div style="color:#d97706; font-weight:bold;">
                                    வட்டி தொகை: ₹${totalInterest} <span style="font-weight:normal; font-size:12px; color:#64748b;">(மாத வட்டி ₹${monthlyInterest})</span>
                                </div>
                                <div style="color:#2563eb; font-weight:bold;">
                                    மொத்தம் (அசல்+வட்டி): ₹${loan.amount + totalInterest}
                                </div>
                            </div>
                        `;
                    });
                }
            });

            const grandTotalPerson = personTotalPrincipal + personTotalInterest;
            totalVattiBusinessAmt += personTotalPrincipal;

            html += `
                <div class="card" style="background:#fff; border-radius:12px; padding:15px; margin-bottom:15px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <h3 style="margin:0; color:#0f172a; display:flex; align-items:center; gap:6px;">👤 ${personKey}</h3>
                    </div>
                    ${loansHtml}
                    <div style="background:#0f172a; color:#fff; padding:12px; border-radius:8px; margin-top:10px;">
                        <div>மொத்த அசல்: ₹${personTotalPrincipal} | மொத்த வட்டி: ₹${personTotalInterest}</div>
                        <div style="color:#4ade80; font-weight:bold; font-size:16px; margin-top:4px;">
                            👉 மொத்தமாகத் தர வேண்டிய தொகை: ₹${grandTotalPerson}
                        </div>
                    </div>
                </div>
            `;
        });
    }

    container.innerHTML = html;
    if (document.getElementById('vatti-val')) {
        document.getElementById('vatti-val').innerText = `₹${totalVattiBusinessAmt}`;
    }
}

// VATTI EDIT MODAL LOGIC
window.openVattiEditModal = function(personKey, loanKey, lIdx, amt, rate, date) {
    const modal = document.getElementById('vattiEditModal');
    modal.dataset.personKey = personKey;
    modal.dataset.loanKey = loanKey;
    modal.dataset.lIdx = lIdx;

    document.getElementById('edit-vatti-amt').value = amt;
    document.getElementById('edit-vatti-rate').value = rate;
    document.getElementById('edit-vatti-date').value = date;

    modal.style.display = 'flex';
};

window.saveVattiEdit = function() {
    const modal = document.getElementById('vattiEditModal');
    const personKey = modal.dataset.personKey;
    const loanKey = modal.dataset.loanKey;
    const lIdx = modal.dataset.lIdx;

    const newAmt = parseFloat(document.getElementById('edit-vatti-amt').value);
    const rawRate = document.getElementById('edit-vatti-rate').value.trim();
    const newDate = document.getElementById('edit-vatti-date').value;

    if (isNaN(newAmt)) {
        alert("தொகையை சரியாக உள்ளிடவும்.");
        return;
    }

    // BUG FIX: 0% வட்டி பதிவு
    const newRate = (rawRate === "" || isNaN(parseFloat(rawRate))) ? 0 : parseFloat(rawRate);

    const loanRef = ref(db, `vatti/${personKey}/${loanKey}/loans/${lIdx}`);
    update(loanRef, {
        amount: newAmt,
        rate: newRate,
        date: newDate
    }).then(() => {
        closeVattiEditModal();
    });
};

window.closeVattiEditModal = function() {
    document.getElementById('vattiEditModal').style.display = 'none';
};

window.deleteVattiLoan = function(personKey, loanKey) {
    if (confirm("இந்த கடன் பதிவை நீக்க விரும்புகிறீர்களா?")) {
        remove(ref(db, `vatti/${personKey}/${loanKey}`));
    }
};
