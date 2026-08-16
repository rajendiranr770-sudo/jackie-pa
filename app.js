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

// Service Worker Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log("SW Failed:", err));
}

// ========================================================
// 2. STATE VARIABLES
// ========================================================
let transactions = JSON.parse(localStorage.getItem('my_app_txs')) || [];
let vattiAccounts = JSON.parse(localStorage.getItem('my_app_vatti')) || {};
let searchQuery = "";
let selectedMonthFilter = "ALL";
let pendingVoiceTxData = null;

// ========================================================
// 3. SAVE STATE & AUTO SYNC
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
}

window.addEventListener('online', () => {
    if (currentUser) saveState();
});

// ========================================================
// 4. AUTHENTICATION
// ========================================================
window.loginWithGoogle = function() {
    signInWithPopup(auth, provider).catch(error => alert("Login Error: " + error.message));
};

window.logoutGoogle = function() {
    signOut(auth).then(() => alert("வெற்றிகரமாக லாக்அவுட் செய்யப்பட்டது!")).catch(error => alert(error.message));
};

document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (loginBtn) loginBtn.addEventListener('click', window.loginWithGoogle);
    if (logoutBtn) logoutBtn.addEventListener('click', window.logoutGoogle);

    const searchInput = document.getElementById('search-query-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            window.searchExpenses();
        });
    }

    window.processSearch = function() {
        if (searchInput) searchQuery = searchInput.value.trim();
        window.searchExpenses();
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
                saveState();
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
// 6. PROCESS TRANSACTIONS & VOICE PARSER
// ========================================================
function processNewTransaction(text) {
    let t = text.toLowerCase().trim();
    let numMatch = t.match(/(\d[\d,]*(\.\d+)?)/);
    let amount = numMatch ? parseFloat(numMatch[1].replace(/,/g, '')) : 0;

    if (!amount) return alert("சரியான தொகையை உள்ளிடவும்.");

    let category = "பொதுச் செலவு";
    let isExpense = true;
    let explicitSource = null;

    if (t.includes("சம்பளம்") || t.includes("சம்பள")) explicitSource = "சம்பளம்";
    else if (t.includes("வீடு") || t.includes("வீட்டு") || t.includes("வீட்டிற்கு")) explicitSource = "வீடு";

    if (t.includes("தந்தார்கள்") || t.includes("கொடுத்தார்கள்") || t.includes("வந்தது") || t.includes("வரவு") || t.includes("கிடைத்தது")) {
        isExpense = false;
        category = "வரவு";
    } 
    else if (t.includes("எஸ்கே") || t.includes("sk")) category = "SK செலவு";
    else if (t.includes("எம்கே") || t.includes("mk")) category = "MK செலவு";
    else if (t.includes("கொல்லை")) category = "கொல்லை";
    else if (t.includes("கடன்")) category = "கடன் செலவு";

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
        transactions.unshift(tempTx);
        if (!isExpense) adjustPendingDebts(tempTx.source);
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
        transactions.unshift(pendingVoiceTxData);
        pendingVoiceTxData = null;
        saveState();
    }
    let modal = document.getElementById("sourceModal");
    if (modal) modal.style.display = "none";
};

function adjustPendingDebts(sourceName) {
    let pendingDebts = transactions.filter(t => t.category === "கடன் செலவு" && t.isExpense && !t.adjusted);
    pendingDebts.forEach(debt => {
        debt.source = sourceName;
        debt.adjusted = true;
    });
}

// ========================================================
// 7. DASHBOARD & BALANCE CALCULATION
// ========================================================
function updateDashboardUI() {
    let totals = { "சம்பளம்": 0, "வீடு": 0, "கொல்லை": 0, "MK செலவு": 0, "SK செலவு": 0, "வட்டி": 0 };
    let filteredTxs = filterByMonth(transactions);

    filteredTxs.forEach(t => {
        let src = t.source || "வீடு";
        if (!t.isExpense) {
            if (src === "சம்பளம்") totals["சம்பளம்"] += t.amount;
            else totals["வீடு"] += t.amount;
        } else {
            if (src === "சம்பளம்") totals["சம்பளம்"] -= t.amount;
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

// ========================================================
// 8. SEARCH & DYNAMIC TOTAL DISPLAY BOX (சர்ச் பாக்ஸ் கீழே வரும் மொத்த பாக்ஸ்)
// ========================================================
window.searchExpenses = function() {
    let input = document.getElementById('search-query-input');
    let rawVal = input ? input.value.trim() : searchQuery.trim();
    let box = document.getElementById('search-result-box');
    
    searchQuery = rawVal;

    if (rawVal === "") {
        if (box) { box.style.display = "none"; box.innerHTML = ""; }
        renderAllLists();
        return;
    }

    let cleanQ = rawVal.toLowerCase();
    let keywords = cleanQ.split(/\s+/);

    let totalIncome = 0;
    let totalExpense = 0;
    let count = 0;

    transactions.forEach(t => {
        let fullText = `${t.text || ''} ${t.category || ''} ${t.source || ''}`.toLowerCase();
        
        let matchesAll = keywords.every(kw => {
            if (kw === "வரவு") return !t.isExpense || fullText.includes("வரவு");
            if (kw === "செலவு") return t.isExpense;
            if (kw === "மொத்த") return true;
            return fullText.includes(kw);
        });

        if (matchesAll) {
            if (t.isExpense) totalExpense += t.amount;
            else totalIncome += t.amount;
            count++;
        }
    });

    // சர்ச் பாக்ஸ்க்கு கீழே வரும் பிரத்யேக மொத்த தொகை பாக்ஸ்
    if (box) {
        box.style.display = "block";
        let displayTotal = 0;
        let totalLabel = "";

        if (totalIncome > 0 && totalExpense > 0) {
            displayTotal = totalIncome - totalExpense;
            totalLabel = `மொத்த மீதி தொகை: ₹${displayTotal}`;
        } else if (totalIncome > 0) {
            displayTotal = totalIncome;
            totalLabel = `மொத்த வரவு தொகை: +₹${displayTotal}`;
        } else {
            displayTotal = totalExpense;
            totalLabel = `மொத்த செலவு தொகை: -₹${displayTotal}`;
        }

        box.innerHTML = `
        <div style="background:#0284c7; color:#ffffff; border-radius:12px; padding:14px; text-align:center; box-shadow:0 4px 10px rgba(2, 132, 199, 0.3); margin-top:10px;">
            <div style="font-size:13px; opacity:0.9; font-weight:600;">🔍 "${rawVal}" - தேடல் முடிவுகள் (${count} பதிவுகள்)</div>
            <div style="font-size:22px; font-weight:900; margin-top:4px; letter-spacing:0.5px;">${totalLabel}</div>
        </div>`;
    }

    renderAllLists();
};

function renderAllLists() {
    let el = document.getElementById('all-list');
    if (!el) return;

    let list = filterByMonth(transactions);
    let q = searchQuery.toLowerCase().trim();

    if (q !== "") {
        let keywords = q.split(/\s+/);
        list = list.filter(t => {
            let fullText = `${t.text || ''} ${t.category || ''} ${t.source || ''}`.toLowerCase();
            return keywords.every(kw => {
                if (kw === "வரவு") return !t.isExpense || fullText.includes("வரவு");
                if (kw === "செலவு") return t.isExpense;
                if (kw === "மொத்த") return true;
                return fullText.includes(kw);
            });
        });
    }

    if (list.length === 0) {
        el.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:15px;">பதிவுகள் எதுவும் இல்லை</div>`;
        return;
    }

    list.sort((a, b) => b.id - a.id);

    el.innerHTML = list.map(t => {
        let color = t.isExpense ? "#dc2626" : "#16a34a";
        let prefix = t.isExpense ? "- " : "+ ";

        return `
        <div class="card-box" style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:15px; color:#1e293b;">${t.text}</strong>
                <span style="color:${color}; font-weight:bold; font-size:16px;">${prefix}₹${t.amount}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#64748b; margin-top:6px;">
                <span>${t.date} | ${t.category} (${t.source || 'வீடு'})</span>
                <button onclick="deleteTx(${t.id})" style="background:none; border:none; cursor:pointer;">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

// PDF டவுன்லோட்
window.downloadFilteredPDF = function() {
    let element = document.getElementById('pdf-printable-area');
    let title = document.getElementById('pdf-header-title');
    
    if (title) title.style.display = "block";

    let opt = {
        margin:       0.5,
        filename:     `Finance_Report_${new Date().toISOString().split('T')[0]}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        if (title) title.style.display = "none";
    });
};

window.deleteTx = function(id) {
    if (confirm("இந்த பதிவை நீக்க விரும்புகிறீர்களா?")) {
        transactions = transactions.filter(t => t.id !== id);
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

// INITIAL LOAD
updateDashboardUI();
renderAllLists();
