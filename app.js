// ========================================================
// 1. FIREBASE SETUP
// ========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 🔑 உங்கள் Firebase Config சாவியை இங்கே மாற்றவும்
const firebaseConfig = {
    apiKey: "AIzaSyCXRVuNCiWh1AhuVHInbKcfUAmgyAwzVHk",
    authDomain: "myfinanceapp-3f883.firebaseapp.com",
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

// ========================================================
// 2. STATE VARIABLES
// ========================================================
let transactions = JSON.parse(localStorage.getItem('my_app_txs')) || [];
let vattiAccounts = JSON.parse(localStorage.getItem('my_app_vatti')) || {};
let editingTxId = null;
let editingVattiInfo = null;
let pendingTxData = null;

// ========================================================
// 3. SAVE STATE (LOCAL + FIREBASE SYNC)
// ========================================================
function saveState() {
    localStorage.setItem('my_app_txs', JSON.stringify(transactions));
    localStorage.setItem('my_app_vatti', JSON.stringify(vattiAccounts));
    
    if (currentUser) {
        setDoc(doc(db, "users", currentUser.uid), {
            transactions: transactions,
            vattiAccounts: vattiAccounts,
            lastUpdated: new Date().toISOString()
        });
    }

    updateDashboardUI();
    renderAllLists();
    renderVattiLists();
}

// ========================================================
// 4. GOOGLE LOGIN / LOGOUT LOGIC
// ========================================================
window.loginWithGoogle = function() {
    signInWithPopup(auth, provider).catch(error => alert("Login Error: " + error.message));
};

window.logoutGoogle = function() {
    signOut(auth).then(() => {
        alert("Logged Out Successfully!");
        location.reload();
    });
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                let data = docSnap.data();
                transactions = data.transactions || [];
                vattiAccounts = data.vattiAccounts || {};
                
                localStorage.setItem('my_app_txs', JSON.stringify(transactions));
                localStorage.setItem('my_app_vatti', JSON.stringify(vattiAccounts));
                
                updateDashboardUI();
                renderAllLists();
                renderVattiLists();
            }
        });
    }
});

// ========================================================
// 5. NAVIGATION & UI FUNCTIONS (EXPOSED TO HTML)
// ========================================================
window.switchTab = function(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    let activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.classList.add('active');
    if (btnElement) btnElement.classList.add('active');
};

window.scrollToSection = function(elementId) {
    let element = document.getElementById(elementId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

// ========================================================
// 6. TAMIL PARSING & AI LOGIC (FIXED TAMIL NUMBERS & SK/MK)
// ========================================================
function parseTamilAmount(text) {
    let t = text.toLowerCase().trim();

    // 1. எண்களும் வார்த்தைகளும் கலந்திருந்தால் (எ.கா: "20 ஆயிரம்", "50 ஆயிரம்")
    let numMatch = t.match(/(\d[\d,]*)/);
    if (numMatch) {
        let baseNum = parseFloat(numMatch[1].replace(/,/g, ''));
        if (t.includes("லட்சம்") || t.includes("lakh")) return baseNum * 100000;
        if (t.includes("ஆயிரம்") || t.includes("ayiram")) return baseNum * 1000;
        return baseNum;
    }

    // 2. முழுவதும் தமிழ் வார்த்தைகளாக இருந்தால் (எ.கா: "இருபது ஆயிரம்", "ஐம்பதாயிரம்")
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
        { word: "ஆயிரம்", val: 1000 },
        
        { word: "தொண்ணூறு", val: 90 },
        { word: "எண்பது", val: 80 },
        { word: "எழுபது", val: 70 },
        { word: "அறுபது", val: 60 },
        { word: "ஐம்பது", val: 50 },
        { word: "நாற்பது", val: 40 },
        { word: "முப்பது", val: 30 },
        { word: "இருபது", val: 20 },
        { word: "பதினைந்து", val: 15 },
        { word: "பத்து", val: 10 },
        { word: "ஒன்பது", val: 9 },
        { word: "எட்டு", val: 8 },
        { word: "ஏழு", val: 7 },
        { word: "ஆறு", val: 6 },
        { word: "அஞ்சு", val: 5 },
        { word: "ஐந்து", val: 5 },
        { word: "நாலு", val: 4 },
        { word: "நான்கு", val: 4 },
        { word: "மூணு", val: 3 },
        { word: "மூன்று", val: 3 },
        { word: "ரெண்டு", val: 2 },
        { word: "இரண்டு", val: 2 },
        { word: "ஒன்னு", val: 1 },
        { word: "ஒரு", val: 1 }
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
    let category = null; 
    let source = null; 
    let isExpense = true;

    // 1. பணத்தின் ஆதாரம் (Source)
    if (t.includes("சம்பள பணத்தில்") || t.includes("சம்பள பணம்") || t.includes("சம்பளம்")) {
        source = "சம்பளம்";
    } else if (t.includes("வீட்டு பணத்தில்") || t.includes("வீட்டு பணம்") || t.includes("வீடு")) {
        source = "வீடு";
    }

    // 2. வரவு / கடன் / பிரிவுகள்
    if (t.includes("தந்தார்கள்") || t.includes("கொடுத்தார்கள்") || t.includes("வந்தது") || t.includes("வரவு") || t.includes("கிடைத்தது")) {
        isExpense = false;
        category = "வீடு";
        if (!source) source = "வீடு";
    } 
    else if (t.includes("வட்டி") || t.includes("பைசா") || t.includes("கடன்")) {
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
            date: new Date().toISOString().split('T')[0]
        });

        saveState();
        return;
    } 
    else if (t.includes("எஸ்கே") || t.includes("எஸ்கேவுக்கு") || t.includes("எஸ் கே") || t.includes("sk")) {
        category = "SK செலவு";
    } 
    else if (t.includes("எம்கே") || t.includes("எம்கேவுக்கு") || t.includes("எம் கே") || t.includes("mk")) {
        category = "MK செலவு";
    } 
    else if (t.includes("கொல்லை") || t.includes("மருந்து") || t.includes("உரம்") || t.includes("கூலி") || t.includes("கொல்லைக்கு")) {
        category = "கொல்லை";
    } 
    else {
        category = "வீடு";
    }

    let txData = {
        id: Date.now(),
        text: text,
        amount: amount,
        category: category,
        isExpense: isExpense,
        date: new Date().toLocaleString()
    };

    if (isExpense && !source) {
        pendingTxData = txData;
        document.getElementById('sourceModalText').innerText = `"${text}" - இதற்கான தொகையை எந்த பணத்திலிருந்து கழிக்க வேண்டும்?`;
        document.getElementById('sourceModal').style.display = 'flex';
    } else {
        txData.source = source || "வீடு";
        transactions.push(txData);
        saveState();
    }
}

window.confirmSource = function(selectedSource) {
    if (pendingTxData) {
        pendingTxData.source = selectedSource;
        if (pendingTxData.text.indexOf("பணத்தில்") === -1) {
            pendingTxData.text += ` ${selectedSource} பணத்தில்`;
        }
        transactions.push(pendingTxData);
        pendingTxData = null;
        saveState();
    }
    document.getElementById('sourceModal').style.display = 'none';
};

// ========================================================
// 7. MANUAL ENTRY & VATTI FORM LOGIC (EXPOSED TO HTML)
// ========================================================
window.addManualEntry = function(category, descId, amtId, typeId, dateId) {
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
};

window.addExpenseManual = function(category, descId, amtId, sourceId, dateId) {
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
};

window.addMoreLoanField = function() {
    let container = document.getElementById('vatti-inputs-container');
    let div = document.createElement('div');
    div.style.cssText = "display: flex; gap: 8px; margin-bottom: 8px;";
    div.innerHTML = `
        <input type="number" class="vatti-amt-input" placeholder="கூடுதல் அசல் தொகை (₹)" style="flex:1;">
        <input type="number" class="vatti-rate-input" placeholder="வட்டி %" style="flex:1;">
    `;
    container.appendChild(div);
};

window.saveVattiAccount = function() {
    let name = document.getElementById('vatti-name').value.trim() || "பொது வட்டி";
    let amtInputs = document.querySelectorAll('.vatti-amt-input');
    let rateInputs = document.querySelectorAll('.vatti-rate-input');
    let customDate = document.getElementById('vatti-date-input').value;
    let formattedDate = customDate ? customDate.split('T')[0] : new Date().toISOString().split('T')[0];

    if (!vattiAccounts[name]) vattiAccounts[name] = [];

    amtInputs.forEach((input, i) => {
        let amt = parseFloat(input.value) || 0;
        let rate = parseFloat(rateInputs[i]?.value) || 3;
        if (amt > 0) {
            vattiAccounts[name].push({
                loanNo: vattiAccounts[name].length + 1,
                amount: amt,
                rate: rate,
                date: formattedDate
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
};

window.addSingleLoanForPerson = function(name) {
    document.getElementById('vatti-name').value = name;
    window.scrollToSection('vatti-form-box');
    let amtInput = document.querySelector('.vatti-amt-input');
    if (amtInput) amtInput.focus();
};

// ========================================================
// 8. VATTI CALCULATOR & DASHBOARD UI
// ========================================================
function calculateAccruedInterest(loan) {
    let amount = loan.amount || 0;
    let rate = loan.rate || 3;
    
    let monthlyInterest = (amount * rate) / 100;
    let dailyInterest = monthlyInterest / 30;

    let loanDate = new Date(loan.date);
    let today = new Date();
    
    let diffTime = today.getTime() - loanDate.getTime();
    let diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
    if (diffDays < 0 || isNaN(diffDays)) diffDays = 0;

    let months = Math.floor(diffDays / 30);
    let remainingDays = diffDays % 30;

    let timeText = `${diffDays} நாட்கள் (${months} மாதம் ${remainingDays} நாள்)`;
    let totalInterestAccrued = Math.round(diffDays * dailyInterest);

    return {
        monthlyInterest: Math.round(monthlyInterest),
        diffDays,
        timeText,
        totalInterestAccrued,
        totalLoanAmount: amount + totalInterestAccrued
    };
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
                <div style="font-size:14px; font-weight:bold; color:#d97706; margin-top:4px;">
                    வட்டி தொகை: ₹${details.totalInterestAccrued} <span style="font-size:11px; font-weight:normal; color:#64748b;">(மாத வட்டி ₹${details.monthlyInterest})</span>
                </div>
                <div style="font-size:13px; font-weight:bold; color:#2563eb; margin-top:2px;">
                    மொத்தம் (அசல்+வட்டி): ₹${details.totalLoanAmount}
                </div>
            </div>`;
        }).join('');

        container.innerHTML += `
        <div style="background:#fff; border:1px solid #cbd5e1; border-radius:12px; padding:12px; margin-bottom:15px; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-size:16px; font-weight:bold; color:#1e293b;">👤 ${name}</span>
                <div>
                    <button onclick="addSingleLoanForPerson('${name}')" style="background:#2563eb; color:white; border:none; padding:6px 12px; border-radius:6px; font-weight:bold; font-size:12px; cursor:pointer;">➕ கடன் சேர்க்க</button>
                    <button onclick="deleteVattiPerson('${name}')" style="background:none; border:none; cursor:pointer; font-size:16px; margin-left:5px;">🗑️</button>
                </div>
            </div>
            ${loansHTML}
            <div style="background:#0f172a; color:white; padding:12px; border-radius:8px; margin-top:10px; font-size:13px;">
                <div>மொத்த அசல்: ₹${totalPrincipal} | மொத்த வட்டி: ₹${totalAccruedInterest}</div>
                <div style="color:#4ade80; font-weight:bold; font-size:14px; margin-top:4px;">👉 மொத்தமாகத் தர வேண்டிய தொகை: ₹${totalPrincipal + totalAccruedInterest}</div>
            </div>
        </div>`;
    }
}

// ========================================================
// 9. MODALS, EDIT & DELETE HANDLERS (EXPOSED TO HTML)
// ========================================================
window.openVattiEditModal = function(name, index) {
    editingVattiInfo = { name, index };
    let loan = vattiAccounts[name][index];
    document.getElementById('edit-vatti-amt').value = loan.amount;
    document.getElementById('edit-vatti-rate').value = loan.rate;
    document.getElementById('edit-vatti-date').value = loan.date;
    document.getElementById('vattiEditModal').style.display = 'flex';
};

window.closeVattiEditModal = function() {
    document.getElementById('vattiEditModal').style.display = 'none';
};

window.saveVattiEdit = function() {
    if (editingVattiInfo) {
        let { name, index } = editingVattiInfo;
        let loan = vattiAccounts[name][index];
        loan.amount = parseFloat(document.getElementById('edit-vatti-amt').value) || loan.amount;
        loan.rate = parseFloat(document.getElementById('edit-vatti-rate').value) || loan.rate;
        
        let newDate = document.getElementById('edit-vatti-date').value;
        if (newDate) {
            loan.date = newDate;
        }

        saveState();
    }
    window.closeVattiEditModal();
};

window.deleteVattiLoan = function(name, index) {
    vattiAccounts[name].splice(index, 1);
    if (vattiAccounts[name].length === 0) delete vattiAccounts[name];
    saveState();
};

window.deleteVattiPerson = function(name) {
    delete vattiAccounts[name];
    saveState();
};

window.openEditModal = function(id) {
    let tx = transactions.find(t => t.id === id);
    if (!tx) return;
    editingTxId = id;
    document.getElementById('edit-text').value = tx.text;
    document.getElementById('edit-amount').value = tx.amount;
    document.getElementById('editModal').style.display = 'flex';
};

window.closeEditModal = function() { 
    document.getElementById('editModal').style.display = 'none'; 
};

window.saveEdit = function() {
    let tx = transactions.find(t => t.id === editingTxId);
    if (tx) {
        tx.text = document.getElementById('edit-text').value;
        tx.amount = parseFloat(document.getElementById('edit-amount').value) || tx.amount;
        let newDate = document.getElementById('edit-date').value;
        if (newDate) {
            tx.date = new Date(newDate).toLocaleString();
        }
        saveState();
    }
    window.closeEditModal();
};

window.deleteTx = function(id) {
    transactions = transactions.filter(t => t.id !== id);
    saveState();
};

window.handleManualInput = function() {
    let input = document.getElementById('userInput');
    if (input && input.value.trim() !== '') {
        processNewTransaction(input.value.trim());
        input.value = '';
    }
};

// ========================================================
// 10. VOICE RECOGNITION (EXPOSED TO HTML)
// ========================================================
window.startVoiceRecognition = function() {
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
        alert("குரல் வசதி இந்த பிரவுசரில் இல்லை");
    }
};

// INITIAL RENDER
updateDashboardUI();
renderAllLists();
renderVattiLists();
