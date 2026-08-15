import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCXRVuNCiWh1AhuVHInbKcfUAmgyAwzVHk",
    authDomain: "myfinanceapp-3f883.firebaseapp.com",
    databaseURL: "https://myfinanceapp-3f883-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "myfinanceapp-3f883",
    storageBucket: "myfinanceapp-3f883.appspot.com",
    messagingSenderId: "698658153791",
    appId: "1:698658153791:web:08ea0171d24a9b0da51f8a"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let globalTransactionsData = null;
let currentEditingKey = null;

// AUTHENTICATION
onAuthStateChanged(auth, (user) => {
    const authContainer = document.getElementById('auth-container');
    const mainApp = document.getElementById('main-app');

    if (user) {
        if (authContainer) authContainer.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        if (document.getElementById('user-display-name')) {
            document.getElementById('user-display-name').innerText = user.displayName || 'User';
        }
        listenToTransactions();
        listenToVattiData();
    } else {
        if (authContainer) authContainer.style.display = 'flex';
        if (mainApp) mainApp.style.display = 'none';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            signInWithPopup(auth, provider).catch(error => alert("Login Error: " + error.message));
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => signOut(auth));
    }
});

// TAB SWITCHING
window.switchTab = function(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.add('active');
    if (btn) btn.classList.add('active');
};

// 1. MANUAL ENTRY (சம்பளம் / வீடு)
window.addManualEntry = function(category, descId, amtId, typeId, dateId) {
    const desc = document.getElementById(descId)?.value.trim();
    const amt = parseFloat(document.getElementById(amtId)?.value);
    const type = document.getElementById(typeId)?.value || 'income';
    const customDate = document.getElementById(dateId)?.value;

    if (!desc || isNaN(amt)) {
        alert("தயவுசெய்து விவரம் மற்றும் தொகையை சரியாக உள்ளிடவும்.");
        return;
    }

    const entryDate = customDate ? new Date(customDate).toLocaleString() : new Date().toLocaleString();

    saveTransaction({
        category: category,
        description: desc,
        amount: amt,
        type: type,
        date: entryDate,
        timestamp: Date.now()
    });

    document.getElementById(descId).value = '';
    document.getElementById(amtId).value = '';
};

// 2. EXPENSE MANUAL (கொல்லை, MK, SK) - சம்பளத்தில் தானாகக் குறையும் & அந்த கார்டில் ஏறும்
window.addExpenseManual = function(category, descId, amtId, sourceId, dateId) {
    const desc = document.getElementById(descId)?.value.trim();
    const amt = parseFloat(document.getElementById(amtId)?.value);
    const source = document.getElementById(sourceId)?.value || 'சம்பளம் பணத்தில்';
    const customDate = document.getElementById(dateId)?.value;

    if (!desc || isNaN(amt)) {
        alert("தயவுசெய்து விவரம் மற்றும் தொகையை சரியாக உள்ளிடவும்.");
        return;
    }

    const entryDate = customDate ? new Date(customDate).toLocaleString() : new Date().toLocaleString();

    // 1. செலவு கார்டில் பதிவு
    saveTransaction({
        category: category,
        description: desc,
        amount: amt,
        type: 'expense',
        source: source,
        date: entryDate,
        timestamp: Date.now()
    });

    // 2. சம்பளப் பணத்திலிருந்து எடுக்கப்பட்டால், சம்பளத்தில் தானாகவே செலவாகக் கழித்தல்
    if (source === 'சம்பளம் பணத்தில்') {
        saveTransaction({
            category: 'சம்பளம்',
            description: `${category}க்காக எடுத்தது (${desc})`,
            amount: amt,
            type: 'expense',
            date: entryDate,
            timestamp: Date.now()
        });
    }

    document.getElementById(descId).value = '';
    document.getElementById(amtId).value = '';
};

function saveTransaction(entry) {
    push(ref(db, 'transactions'), entry);
}

function listenToTransactions() {
    onValue(ref(db, 'transactions'), (snapshot) => {
        globalTransactionsData = snapshot.val();
        renderTransactions(globalTransactionsData);
    });
}

function renderTransactions(data) {
    let totals = { "சம்பளம்": 0, "வீடு": 0, "கொல்லை": 0, "MK செலவு": 0, "SK செலவு": 0 };
    let lists = { "All": "", "சம்பளம்": "", "வீடு": "", "கொல்லை": "", "MK செலவு": "", "SK செலவு": "" };

    if (data) {
        Object.keys(data).forEach(key => {
            const item = data[key];
            const amt = item.type === 'income' ? item.amount : -item.amount;
            
            if (totals[item.category] !== undefined) {
                totals[item.category] += amt;
            }

            const html = `
                <div style="background:#fff; padding:12px; margin-bottom:8px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                    <div>
                        <b>${item.description}</b> 
                        <span style="color:${item.type === 'income' ? '#16a34a' : '#dc2626'}; font-weight:bold;">
                            ${item.type === 'income' ? '+' : '-'}₹${item.amount}
                        </span>
                        <br><small style="color:#64748b;">${item.date} | ${item.category}</small>
                    </div>
                    <div>
                        <button onclick="openTxEditModal('${key}')" style="border:none; background:none; cursor:pointer; font-size:16px;">✏️</button>
                        <button onclick="deleteTransaction('${key}')" style="border:none; background:none; cursor:pointer; font-size:16px;">🗑️</button>
                    </div>
                </div>
            `;

            lists["All"] += html;
            if (lists[item.category] !== undefined) lists[item.category] += html;
        });
    }

    // DASHBOARD UPDATE
    if(document.getElementById('salary-val')) document.getElementById('salary-val').innerText = `₹${totals['சம்பளம்']}`;
    if(document.getElementById('home-val')) document.getElementById('home-val').innerText = `₹${totals['வீடு']}`;
    if(document.getElementById('kollai-val')) document.getElementById('kollai-val').innerText = `₹${totals['கொல்லை']}`;
    if(document.getElementById('mk-val')) document.getElementById('mk-val').innerText = `₹${totals['MK செலவு']}`;
    if(document.getElementById('sk-val')) document.getElementById('sk-val').innerText = `₹${totals['SK செலவு']}`;

    if(document.getElementById('salary-list')) document.getElementById('salary-list').innerHTML = lists['All'];
}

// ================= EDIT TRANSACTION LOGIC =================
window.openTxEditModal = function(key) {
    if (!globalTransactionsData || !globalTransactionsData[key]) return;
    const item = globalTransactionsData[key];
    currentEditingKey = key;

    document.getElementById('edit-tx-desc').value = item.description || '';
    document.getElementById('edit-tx-amt').value = item.amount || '';
    document.getElementById('edit-tx-cat').value = item.category || 'சம்பளம்';
    document.getElementById('edit-tx-type').value = item.type || 'income';
    document.getElementById('edit-tx-date').value = item.date || '';

    document.getElementById('txEditModal').style.display = 'flex';
};

window.saveTransactionEdit = function() {
    if (!currentEditingKey) return;

    const updatedData = {
        description: document.getElementById('edit-tx-desc').value.trim(),
        amount: parseFloat(document.getElementById('edit-tx-amt').value),
        category: document.getElementById('edit-tx-cat').value,
        type: document.getElementById('edit-tx-type').value,
        date: document.getElementById('edit-tx-date').value
    };

    if (!updatedData.description || isNaN(updatedData.amount)) {
        alert("விவரம் மற்றும் தொகையை சரியாக உள்ளிடவும்.");
        return;
    }

    update(ref(db, `transactions/${currentEditingKey}`), updatedData).then(() => {
        closeTxEditModal();
        alert("பதிவு வெற்றிகரமாக மாற்றப்பட்டது!");
    });
};

window.closeTxEditModal = function() {
    document.getElementById('txEditModal').style.display = 'none';
    currentEditingKey = null;
};

window.deleteTransaction = function(key) {
    if (confirm("இந்த பதிவை நீக்க விரும்புகிறீர்களா?")) {
        remove(ref(db, 'transactions/' + key));
    }
};

// SEARCH & VOICE CONTROL
window.searchExpenses = function() {
    const query = document.getElementById('search-query-input').value.toLowerCase().trim();
    const resultBox = document.getElementById('search-result-box');
    const filteredList = document.getElementById('search-filtered-list');

    if (!query || !globalTransactionsData) {
        resultBox.innerText = '';
        filteredList.innerHTML = '';
        return;
    }

    let totalMatchAmount = 0;
    let filteredHtml = '';

    Object.keys(globalTransactionsData).forEach(key => {
        const item = globalTransactionsData[key];
        const desc = (item.description || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();

        if (desc.includes(query) || cat.includes(query)) {
            totalMatchAmount += item.amount;
            filteredHtml += `
                <div style="background:#e0f2fe; padding:12px; margin-bottom:8px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <b>${item.description}</b> - <span style="color:#dc2626; font-weight:bold;">₹${item.amount}</span>
                        <br><small style="color:#64748b;">${item.date} | ${item.category}</small>
                    </div>
                </div>
            `;
        }
    });

    resultBox.innerText = `'${query}' தொடர்பான மொத்த செலவு: ₹${totalMatchAmount}`;
    filteredList.innerHTML = filteredHtml;
};

window.startVoiceRecognition = function() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert("Voice recognition is not supported in this browser.");
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ta-IN';

    recognition.onstart = () => alert("பேசலாம்...");
    recognition.onresult = (event) => {
        document.getElementById('voice-text-input').value = event.results[0][0].transcript;
        processVoiceOrText();
    };

    recognition.start();
};

window.processVoiceOrText = function() {
    const text = document.getElementById('voice-text-input').value.trim();
    if (!text) return;

    const amtMatch = text.match(/\d+/);
    if (!amtMatch) {
        alert("தொகையைக் கண்டுபிடிக்க முடியவில்லை.");
        return;
    }
    const amt = parseFloat(amtMatch[0]);

    let category = 'SK செலவு';
    if (text.includes('சம்பளம்')) category = 'சம்பளம்';
    else if (text.includes('வீடு')) category = 'வீடு';
    else if (text.includes('கொல்லை')) category = 'கொல்லை';
    else if (text.includes('எம் கே') || text.includes('MK')) category = 'MK செலவு';

    // SK / MK செலவாக இருந்தால் சம்பளத்திலும் கழியும் + SK கார்டிலும் ஏறும்
    if (category === 'SK செலவு' || category === 'MK செலவு' || category === 'கொல்லை') {
        saveTransaction({
            category: category,
            description: text,
            amount: amt,
            type: 'expense',
            date: new Date().toLocaleString(),
            timestamp: Date.now()
        });
        saveTransaction({
            category: 'சம்பளம்',
            description: `${category}க்கு எடுத்தது (${text})`,
            amount: amt,
            type: 'expense',
            date: new Date().toLocaleString(),
            timestamp: Date.now()
        });
    } else {
        saveTransaction({
            category: category,
            description: text,
            amount: amt,
            type: category === 'சம்பளம்' || category === 'வீடு' ? 'income' : 'expense',
            date: new Date().toLocaleString(),
            timestamp: Date.now()
        });
    }

    document.getElementById('voice-text-input').value = '';
    alert("வெற்றிகரமாகப் பதிவு செய்யப்பட்டது!");
};

// VATTI FUNCTIONS
function listenToVattiData() {
    onValue(ref(db, 'vatti'), (snapshot) => {
        renderVattiList(snapshot.val());
    });
}

function calculateDays(startDateStr) {
    const start = new Date(startDateStr);
    const today = new Date();
    const diffTime = Math.abs(today - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return { totalDays: isNaN(diffDays) ? 0 : diffDays, months: Math.floor(diffDays / 30), days: diffDays % 30 };
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

            Object.keys(personGroup).forEach((loanKey) => {
                const item = personGroup[loanKey];
                if (item.loans) {
                    item.loans.forEach((loan, lIdx) => {
                        const dayData = calculateDays(loan.date);
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
                                <div style="font-size:12px; color:#64748b; margin:4px 0;">📅 தேதி: ${loan.date} (${dayData.totalDays} நாட்கள்)</div>
                                <div style="color:#d97706; font-weight:bold;">வட்டி தொகை: ₹${totalInterest}</div>
                            </div>
                        `;
                    });
                }
            });

            totalVattiBusinessAmt += personTotalPrincipal;
            html += `
                <div style="background:#fff; border-radius:12px; padding:15px; margin-bottom:15px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                    <h3>👤 ${personKey}</h3>
                    ${loansHtml}
                    <div style="background:#0f172a; color:#fff; padding:10px; border-radius:8px;">
                        அசல்: ₹${personTotalPrincipal} | வட்டி: ₹${personTotalInterest}
                    </div>
                </div>
            `;
        });
    }

    container.innerHTML = html;
    if (document.getElementById('vatti-val')) document.getElementById('vatti-val').innerText = `₹${totalVattiBusinessAmt}`;
}
