// ========================================================
// 1. FIREBASE SETUP
// ========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCXRVuNCiWh1AhuVHInbKcfUAmgyAwzVHk",
    authDomain: "myfinanceapp-3f883.firebaseapp.com",
    databaseURL: "https://myfinanceapp-3f883-default-rtdb.firebaseio.com",
    projectId: "myfinanceapp-3f883",
    storageBucket: "myfinanceapp-3f883.firebasestorage.app",
    messagingSenderId: "698658153791",
    appId: "1:698658153791:web:08ea0171d24a9b0da51f8a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let currentUser = null;

// PWA Service Worker Register (Offline-ல் இயங்க)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(() => console.log("Service Worker Registered!"))
        .catch(err => console.log("SW Registration Failed:", err));
}

// ========================================================
// 2. STATE VARIABLES
// ========================================================
let transactions = JSON.parse(localStorage.getItem('my_app_txs')) || [];
let vattiAccounts = JSON.parse(localStorage.getItem('my_app_vatti')) || {};
let editingTxId = null;
let editingVattiInfo = null;
let searchQuery = "";
let selectedMonthFilter = "ALL";
let pendingVoiceTxData = null;

// ========================================================
// 3. SAVE STATE (LOCAL + FIREBASE SYNC)
// ========================================================
function saveState() {
    localStorage.setItem('my_app_txs', JSON.stringify(transactions));
    localStorage.setItem('my_app_vatti', JSON.stringify(vattiAccounts));
    
    if (currentUser && navigator.onLine) {
        setDoc(doc(db, "users", currentUser.uid), {
            transactions: transactions,
            vattiAccounts: vattiAccounts,
            lastUpdated: new Date().toISOString()
        });
    }

    populateMonthDropdown();
    updateDashboardUI();
    renderAllLists();
    renderVattiLists();
}

// Net வந்தவுடன் Auto-Sync செய்ய
window.addEventListener('online', () => {
    if (currentUser) saveState();
});

// ========================================================
// 4. GOOGLE LOGIN / LOGOUT
// ========================================================
window.loginWithGoogle = function() {
    signInWithPopup(auth, provider).catch(error => alert("Login Error: " + error.message));
};

window.logoutGoogle = function() {
    signOut(auth).then(() => {
        alert("வெற்றிகரமாக லாக்அவுட் செய்யப்பட்டது!");
    }).catch(error => alert("Logout Error: " + error.message));
};

document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (loginBtn) loginBtn.addEventListener('click', window.loginWithGoogle);
    if (logoutBtn) logoutBtn.addEventListener('click', window.logoutGoogle);

    // Search Input Real-time Event Listener
    const searchInput = document.getElementById('search-query-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            window.searchExpenses();
        });
    }

    window.processSearch = function() {
        if (searchInput) {
            searchQuery = searchInput.value.toLowerCase().trim();
            window.searchExpenses();
        }
    };

    populateMonthDropdown();
});

onAuthStateChanged(auth, (user) => {
    const authContainer = document.getElementById('auth-container');
    const mainApp = document.getElementById('main-app');
    const userNameSpan = document.getElementById('user-display-name');

    if (user) {
        currentUser = user;
        if (authContainer) authContainer.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        if (userNameSpan) userNameSpan.textContent = user.displayName || user.email;

        onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                let data = docSnap.data();
                transactions = data.transactions || [];
                vattiAccounts = data.vattiAccounts || {};
                
                localStorage.setItem('my_app_txs', JSON.stringify(transactions));
                localStorage.setItem('my_app_vatti', JSON.stringify(vattiAccounts));
                
                populateMonthDropdown();
                updateDashboardUI();
                renderAllLists();
                renderVattiLists();
            }
        });
    } else {
        currentUser = null;
        if (authContainer) authContainer.style.display = 'flex';
        if (mainApp) mainApp.style.display = 'none';
    }
});

// ========================================================
// 5. MONTHLY FILTER LOGIC
// ========================================================
function populateMonthDropdown() {
    let selectEl = document.getElementById('month-filter-select');
    if (!selectEl) return;

    let months = new Set();
    transactions.forEach(t => {
        if (t.date) {
            let d = new Date(t.date);
            if (!isNaN(d)) {
                let monthYear = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
                months.add(monthYear);
            }
        }
    });

    let currentSelection = selectEl.value || "ALL";
    selectEl.innerHTML = `<option value="ALL">எல்லா மாதங்களும் (All)</option>`;
    
    months.forEach(m => {
        selectEl.innerHTML += `<option value="${m}">${m}</option>`;
    });

    selectEl.value = currentSelection;
    selectEl.onchange = (e) => {
        selectedMonthFilter = e.target.value;
        renderAllLists();
        updateDashboardUI();
    };
}

function filterByMonth(list) {
    if (selectedMonthFilter === "ALL") return list;
    return list.filter(t => {
        if (!t.date) return false;
        let d = new Date(t.date);
        let monthYear = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
        return monthYear === selectedMonthFilter;
    });
}

// ========================================================
// 6. NAVIGATION
// ========================================================
window.switchTab = function(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    let activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.classList.add('active');
    if (btnElement) btnElement.classList.add('active');
};

// ========================================================
// 7. TAMIL PARSING & VOICE PROCESSING
// ========================================================
function parseTamilAmount(text) {
    let t = text.toLowerCase().trim();
    let numMatch = t.match(/(\d[\d,]*(\.\d+)?)/);
    if (numMatch) {
        let baseNum = parseFloat(numMatch[1].replace(/,/g, ''));
        if (t.includes("லட்சம்") || t.includes("lakh")) return baseNum * 100000;
        if (t.includes("ஆயிரம்") || t.includes("ayiram")) return baseNum * 1000;
        return baseNum;
    }

    let multiplier = 1;
    if (t.includes("லட்சம்")) multiplier = 100000;
    else if (t.includes("ஆயிரம்")) multiplier = 1000;

    let numbersMap = [
        { word: "ஒரு லட்சம்", val: 100000 },
        { word: "தொண்ணூறாயிரம்", val: 90000 },
        { word: "எண்பதாயிரம்", val: 80000 },
        { word: "எழுபதாயிரம்", val: 70000 },
        { word: "அறுபதாயிரம்", val: 60000 },
        { word: "ஐம்பதாயிரம்", val: 50000 },
        { word: "நாற்பதாயிரம்", val: 40000 },
        { word: "முப்பதாயிரம்", val: 30000 },
        { word: "இருபதாயிரம்", val: 20000 },
        { word: "பதினைந்தாயிரம்", val: 15000 },
        { word: "பத்தாயிரம்", val: 10000 },
        { word: "ஒன்பதாயிரம்", val: 9000 },
        { word: "எட்டாயிரம்", val: 8000 },
        { word: "ஏழாயிரம்", val: 7000 },
        { word: "ஆறாயிரம்", val: 6000 },
        { word: "ஐயாயிரம்", val: 5000 },
        { word: "நாலாயிரம்", val: 4000 },
        { word: "மூணாயிரம்", val: 3000 },
        { word: "மூன்றாயிரம்", val: 3000 },
        { word: "ரெண்டாயிரம்", val: 2000 },
        { word: "இரண்டாயிரம்", val: 2000 },
        { word: "ஆயிரம்", val: 1000 }
    ];

    for (let item of numbersMap) {
        if (t.includes(item.word)) {
            if (item.val >= 1000) return item.val;
            return item.val * multiplier;
        }
    }
    return 0;
}

function processNewTransaction(text) {
    let amount = parseTamilAmount(text);
    if (!amount) return alert("சரியான தொகையை உள்ளிடவும்.");

    let t = text.toLowerCase().trim();
    let category = "பொதுச் செலவு"; 
    let isExpense = true;
    let explicitSource = null;

    if (t.includes("சம்பள பணத்தில்") || t.includes("சம்பள பணம்")) explicitSource = "சம்பளம்";
    else if (t.includes("வீட்டு பணத்தில்") || t.includes("வீட்டு பணம்")) explicitSource = "வீடு";

    if (t.includes("தந்தார்கள்") || t.includes("கொடுத்தார்கள்") || t.includes("வந்தது") || t.includes("வரவு") || t.includes("கிடைத்தது")) {
        isExpense = false;
        category = "வரவு";
    } 
    else if (t.includes("எஸ்கே") || t.includes("எஸ் கே") || t.includes("sk")) category = "SK செலவு";
    else if (t.includes("எம்கே") || t.includes("எம் கே") || t.includes("mk")) category = "MK செலவு";
    else if (t.includes("கொல்லை") || t.includes("மருந்து") || t.includes("உரம்") || t.includes("கூலி")) category = "கொல்லை";

    let tempTx = {
        id: Date.now(),
        text: text,
        amount: amount,
        category: category,
        isExpense: isExpense,
        date: new Date().toLocaleString()
    };

    if (explicitSource) {
        tempTx.source = explicitSource;
        transactions.push(tempTx);
        saveState();
    } else {
        pendingVoiceTxData = tempTx;
        let modalText = document.getElementById("sourceModalText");
        if (modalText) modalText.innerText = `"${text}" - ₹${amount}`;
        let modal = document.getElementById("sourceModal");
        if (modal) modal.style.display = "flex";
    }
}

window.confirmSource = function(selectedSource) {
    if (pendingVoiceTxData) {
        pendingVoiceTxData.source = selectedSource;
        transactions.push(pendingVoiceTxData);
        pendingVoiceTxData = null;
        saveState();
    }
    let modal = document.getElementById("sourceModal");
    if (modal) modal.style.display = "none";
};

// ========================================================
// 8. MANUAL ENTRIES & VATTI FORM
// ========================================================
window.addManualEntry = function(category, descId, amtId, typeId, dateId) {
    let desc = document.getElementById(descId).value.trim();
    let amt = parseFloat(document.getElementById(amtId).value) || 0;
    let type = document.getElementById(typeId).value;
    let customDate = document.getElementById(dateId) ? document.getElementById(dateId).value : '';

    if (!desc || amt <= 0) return alert("விவரம் மற்றும் தொகையை சரிபார்க்கவும்.");

    let formattedDate = customDate ? new Date(customDate).toLocaleString() : new Date().toLocaleString();
    let isExpense = (type === 'expense');

    transactions.push({
        id: Date.now(),
        text: desc,
        amount: amt,
        category: category,
        source: category,
        isExpense: isExpense,
        date: formattedDate
    });

    saveState();
    document.getElementById(descId).value = '';
    document.getElementById(amtId).value = '';
};

window.addExpenseManual = function(category, descId, amtId, sourceId, dateId) {
    let desc = document.getElementById(descId).value.trim();
    let amt = parseFloat(document.getElementById(amtId).value) || 0;
    let sourceVal = document.getElementById(sourceId) ? document.getElementById(sourceId).value : 'சம்பளம் பணத்தில்';
    let customDate = document.getElementById(dateId) ? document.getElementById(dateId).value : '';

    if (!desc || amt <= 0) return alert("விவரம் மற்றும் தொகையை சரிபார்க்கவும்.");

    let source = sourceVal.includes("சம்பளம்") ? "சம்பளம்" : "வீடு";
    let formattedDate = customDate ? new Date(customDate).toLocaleString() : new Date().toLocaleString();

    transactions.push({
        id: Date.now(),
        text: desc,
        amount: amt,
        category: category,
        source: source,
        isExpense: true,
        date: formattedDate
    });

    saveState();
    document.getElementById(descId).value = '';
    document.getElementById(amtId).value = '';
};

window.addMoreLoanField = function() {
    let container = document.getElementById('vatti-inputs-container');
    if (!container) return;
    let newDiv = document.createElement('div');
    newDiv.style.display = 'flex';
    newDiv.style.gap = '8px';
    newDiv.innerHTML = `
        <input type="number" class="vatti-amt-input" placeholder="அசல் தொகை (₹)" style="flex:1;">
        <input type="number" class="vatti-rate-input" placeholder="வட்டி % / பைசா" style="flex:1;">
    `;
    container.appendChild(newDiv);
};

window.saveVattiAccount = function() {
    let nameInput = document.getElementById('vatti-name');
    let name = nameInput ? nameInput.value.trim() || "பொது வட்டி" : "பொது வட்டி";
    let amtInputs = document.querySelectorAll('.vatti-amt-input');
    let rateInputs = document.querySelectorAll('.vatti-rate-input');
    let dateInput = document.getElementById('vatti-date-input');
    let customDate = dateInput ? dateInput.value : '';
    let formattedDate = customDate ? customDate : new Date().toISOString().split('T')[0];

    if (!vattiAccounts[name]) vattiAccounts[name] = [];

    amtInputs.forEach((input, i) => {
        let amt = parseFloat(input.value) || 0;
        let rateVal = rateInputs[i]?.value;
        let rate = (rateVal !== "" && !isNaN(rateVal)) ? parseFloat(rateVal) : 3;

        if (amt > 0) {
            vattiAccounts[name].push({
                loanNo: vattiAccounts[name].length + 1,
                amount: amt,
                rate: rate,
                date: formattedDate
            });
        }
    });

    if (nameInput) nameInput.value = '';
    saveState();
};

// ========================================================
// 9. DASHBOARD & RENDER LISTS
// ========================================================
function calculateAccruedInterest(loan) {
    let amount = loan.amount || 0;
    let rate = (loan.rate !== undefined && loan.rate !== null) ? loan.rate : 3;
    let monthlyInterest = (rate === 0) ? 0 : (amount * rate) / 100;
    let dailyInterest = monthlyInterest / 30;

    let loanDate = new Date(loan.date);
    let today = new Date();
    let diffDays = Math.floor((today - loanDate) / (1000 * 3600 * 24));
    if (diffDays < 0 || isNaN(diffDays)) diffDays = 0;

    let months = Math.floor(diffDays / 30);
    let remainingDays = diffDays % 30;
    let totalInterestAccrued = (rate === 0) ? 0 : Math.round(diffDays * dailyInterest);

    return {
        monthlyInterest: Math.round(monthlyInterest),
        timeText: `${diffDays} நாட்கள் (${months} மாதம் ${remainingDays} நாள்)`,
        totalInterestAccrued,
        totalLoanAmount: amount + totalInterestAccrued
    };
}

function updateDashboardUI() {
    let totals = { "சம்பளம்": 0, "வீடு": 0, "கொல்லை": 0, "MK செலவு": 0, "SK செலவு": 0, "வட்டி": 0 };
    let filteredTxs = filterByMonth(transactions);

    filteredTxs.forEach(t => {
        if (!t.isExpense) {
            if (t.source === "சம்பளம்") totals["சம்பளம்"] += t.amount;
            else totals["வீடு"] += t.amount;
        } else {
            if (t.source === "சம்பளம்") totals["சம்பளம்"] -= t.amount;
            else totals["வீடு"] -= t.amount;

            if (t.category === "கொல்லை") totals["கொல்லை"] += t.amount;
            if (t.category === "MK செலவு") totals["MK செலவு"] += t.amount;
            if (t.category === "SK செலவு") totals["SK செலவு"] += t.amount;
        }
    });

    let totalVattiOut = 0;
    for (let name in vattiAccounts) {
        vattiAccounts[name].forEach(l => { totalVattiOut += l.amount; });
    }
    totals["வட்டி"] = totalVattiOut;

    let setVal = (id, val) => {
        let el = document.getElementById(id);
        if (el) el.innerText = '₹' + Math.round(val);
    };

    setVal('salary-val', totals["சம்பளம்"]);
    setVal('home-val', totals["வீடு"]);
    setVal('kollai-val', totals["கொல்லை"]);
    setVal('mk-val', totals["MK செலவு"]);
    setVal('sk-val', totals["SK செலவு"]);
    setVal('vatti-val', totals["வட்டி"]);
}

window.searchExpenses = function() {
    let input = document.getElementById('search-query-input');
    let q = input ? input.value.trim() : searchQuery;
    let box = document.getElementById('search-result-box');
    
    if (!box) return;

    if (q === "") {
        box.innerHTML = "";
        renderAllLists();
        return;
    }

    let cleanQ = q.toLowerCase().replace(/[ாடடிடீடுடூடெடேடைடொடோடௌட்]/g, 'ட');
    let totalAmt = 0;
    let count = 0;

    transactions.forEach(t => {
        let textClean = t.text.toLowerCase().replace(/[ாடடிடீடுடூடெடேடைடொடோடௌட்]/g, 'ட');
        let catClean = (t.category || '').toLowerCase().replace(/[ாடடிடீடுடூடெடேடைடொடோடௌட்]/g, 'ட');

        let match = textClean.includes(cleanQ) || 
                    t.text.toLowerCase().includes(q.toLowerCase()) || 
                    t.amount.toString().includes(q) ||
                    catClean.includes(cleanQ);

        if (match) {
            totalAmt += (t.isExpense ? Number(t.amount) : -Number(t.amount));
            count++;
        }
    });

    if (count > 0) {
        box.innerHTML = `
        <div style="background:#fff; border:2px solid #0284c7; border-radius:10px; padding:12px; text-align:center; margin-top:10px;">
            <div style="font-size:14px; color:#0369a1; font-weight:bold;">🔍 "${q}" மொத்த செலவு (${count} பதிவுகள்)</div>
            <div style="font-size:24px; color:#dc2626; font-weight:800; margin-top:4px;">₹${totalAmt}</div>
        </div>`;
    } else {
        box.innerHTML = `
        <div style="background:#fff; border:1px solid #94a3b8; border-radius:10px; padding:10px; text-align:center; color:#64748b; margin-top:10px;">
            🔍 "${q}" என்ற பெயரில் பதிவுகள் எதுவும் இல்லை!
        </div>`;
    }

    renderAllLists();
};

function renderAllLists() {
    const filterMap = {
        'all-list': () => transactions,
        'salary-list': () => transactions.filter(t => t.source === 'சம்பளம்'),
        'home-list': () => transactions.filter(t => t.source === 'வீடு'),
        'kollai-list': () => transactions.filter(t => t.category === 'கொல்லை'),
        'mk-list': () => transactions.filter(t => t.category === 'MK செலவு'),
        'sk-list': () => transactions.filter(t => t.category === 'SK செலவு')
    };

    let searchInputEl = document.getElementById('search-query-input');
    let q = searchInputEl ? searchInputEl.value.toLowerCase().trim() : searchQuery.toLowerCase().trim();

    for (let id in filterMap) {
        let el = document.getElementById(id);
        if (el) {
            let list = filterByMonth(filterMap[id]());

            if (q !== "") {
                let cleanQ = q.replace(/[ாடடிடீடுடூடெடேடைடொடோடௌட்]/g, 'ட');
                list = list.filter(t => {
                    let textClean = t.text.toLowerCase().replace(/[ாடடிடீடுடூடெடேடைடொடோடௌட்]/g, 'ட');
                    let catClean = (t.category || '').toLowerCase().replace(/[ாடடிடீடுடூடெடேடைடொடோடௌட்]/g, 'ட');
                    
                    return textClean.includes(cleanQ) || 
                           t.text.toLowerCase().includes(q) || 
                           t.amount.toString().includes(q) ||
                           catClean.includes(cleanQ);
                });
            }

            if (list.length === 0) {
                el.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:15px;">பதிவுகள் எதுவும் இல்லை</div>`;
                continue;
            }

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
                        <span>${t.date} | ${t.category} (${t.source || 'வீடு'})</span>
                        <div>
                            <button onclick="openTxEditModal(${t.id})" style="background:none; border:none; cursor:pointer; font-size:15px; margin-right:8px;">✏️</button>
                            <button onclick="deleteTx(${t.id})" style="background:none; border:none; cursor:pointer; font-size:15px;">🗑️</button>
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
        let totalAccruedInterest = 0;

        let loansHTML = loans.map((l, idx) => {
            let details = calculateAccruedInterest(l);
            totalPrincipal += l.amount;
            totalAccruedInterest += details.totalInterestAccrued;

            return `
            <div style="background:#f8fafc; border-left:4px solid #2563eb; padding:10px 12px; border-radius:6px; margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:14px; color:#1e293b;">
                        <strong>கடன் ${idx+1}:</strong> அசல்: ₹${l.amount} | வட்டி: ${l.rate}%
                    </span>
                    <div>
                        <button onclick="openVattiEditModal('${name}', ${idx})" style="background:none; border:none; cursor:pointer; font-size:14px;">✏️</button>
                        <button onclick="deleteVattiLoan('${name}', ${idx})" style="background:none; border:none; cursor:pointer; font-size:14px;">🗑️</button>
                    </div>
                </div>
                <div style="font-size:12px; color:#64748b; margin-top:4px;">
                    📅 தேதி: ${l.date} (${details.timeText})
                </div>
                <div style="font-size:13px; font-weight:bold; color:#d97706; margin-top:4px;">
                    வட்டி தொகை: ₹${details.totalInterestAccrued} (மாத வட்டி ₹${details.monthlyInterest})
                </div>
            </div>`;
        }).join('');

        container.innerHTML += `
        <div style="background:#fff; border:1px solid #cbd5e1; border-radius:12px; padding:12px; margin-bottom:15px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-size:16px; font-weight:bold; color:#1e293b;">👤 ${name}</span>
            </div>
            ${loansHTML}
            <div style="background:#0f172a; color:white; padding:10px; border-radius:8px; margin-top:10px; font-size:13px;">
                <div>மொத்த அசல்: ₹${totalPrincipal} | மொத்த வட்டி: ₹${totalAccruedInterest}</div>
                <div style="color:#4ade80; font-weight:bold; font-size:14px; margin-top:4px;">மொத்தம்: ₹${totalPrincipal + totalAccruedInterest}</div>
            </div>
        </div>`;
    }
}

// ========================================================
// 10. MODALS, EDIT, DELETE & VOICE
// ========================================================
window.openTxEditModal = function(id) {
    let tx = transactions.find(t => t.id === id);
    if (!tx) return;
    editingTxId = id;

    if (document.getElementById('edit-tx-desc')) document.getElementById('edit-tx-desc').value = tx.text;
    if (document.getElementById('edit-tx-amt')) document.getElementById('edit-tx-amt').value = tx.amount;
    if (document.getElementById('edit-tx-source')) document.getElementById('edit-tx-source').value = tx.source || 'வீடு';
    if (document.getElementById('edit-tx-cat')) document.getElementById('edit-tx-cat').value = tx.category || 'பொதுச் செலவு';
    if (document.getElementById('edit-tx-type')) document.getElementById('edit-tx-type').value = tx.isExpense ? 'expense' : 'income';
    if (document.getElementById('edit-tx-date')) document.getElementById('edit-tx-date').value = tx.date;

    let modal = document.getElementById('txEditModal');
    if (modal) modal.style.display = 'flex';
};

window.closeTxEditModal = function() { 
    let modal = document.getElementById('txEditModal');
    if (modal) modal.style.display = 'none'; 
};

window.saveTransactionEdit = function() {
    let tx = transactions.find(t => t.id === editingTxId);
    if (tx) {
        tx.text = document.getElementById('edit-tx-desc').value || tx.text;
        tx.amount = parseFloat(document.getElementById('edit-tx-amt').value) || tx.amount;
        tx.source = document.getElementById('edit-tx-source') ? document.getElementById('edit-tx-source').value : tx.source;
        tx.category = document.getElementById('edit-tx-cat').value;
        tx.isExpense = (document.getElementById('edit-tx-type').value === 'expense');
        let date = document.getElementById('edit-tx-date').value;
        if (date) tx.date = date;

        saveState();
    }
    window.closeTxEditModal();
};

window.deleteTx = function(id) {
    if (confirm("இந்த பதிவை நீக்க விரும்புகிறீர்களா?")) {
        transactions = transactions.filter(t => t.id !== id);
        saveState();
    }
};

window.openVattiEditModal = function(name, index) {
    if (!vattiAccounts[name] || !vattiAccounts[name][index]) return;
    editingVattiInfo = { name, index };
    let loan = vattiAccounts[name][index];

    if (document.getElementById('edit-vatti-amt')) document.getElementById('edit-vatti-amt').value = loan.amount;
    if (document.getElementById('edit-vatti-rate')) document.getElementById('edit-vatti-rate').value = loan.rate;
    if (document.getElementById('edit-vatti-date')) document.getElementById('edit-vatti-date').value = loan.date;

    let modal = document.getElementById('vattiEditModal');
    if (modal) modal.style.display = 'flex';
};

window.closeVattiEditModal = function() {
    let modal = document.getElementById('vattiEditModal');
    if (modal) modal.style.display = 'none';
};

window.saveVattiEdit = function() {
    if (!editingVattiInfo) return;
    let { name, index } = editingVattiInfo;
    let loan = vattiAccounts[name][index];
    if (loan) {
        loan.amount = parseFloat(document.getElementById('edit-vatti-amt').value) || loan.amount;
        loan.rate = parseFloat(document.getElementById('edit-vatti-rate').value);
        let date = document.getElementById('edit-vatti-date').value;
        if (date) loan.date = date;

        saveState();
    }
    window.closeVattiEditModal();
};

window.deleteVattiLoan = function(name, index) {
    if (confirm("இந்த வட்டி பதிவை நீக்க விரும்புகிறீர்களா?")) {
        vattiAccounts[name].splice(index, 1);
        if (vattiAccounts[name].length === 0) delete vattiAccounts[name];
        saveState();
    }
};

window.processVoiceOrText = function() {
    let input = document.getElementById('voice-text-input');
    if (input && input.value.trim() !== '') {
        processNewTransaction(input.value.trim());
        input.value = '';
    }
};

window.startVoiceRecognition = function() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'ta-IN';
        recognition.onresult = function(event) {
            let transcript = event.results[0][0].transcript;
            let input = document.getElementById('voice-text-input');
            if (input) input.value = transcript;
            processNewTransaction(transcript);
        };
        recognition.start();
    } else {
        alert("குரல் வசதி இந்த பிரவுசரில் இல்லை");
    }
};

// INITIAL RENDER
updateDashboardUI();
renderAllLists();
renderVattiLists();
