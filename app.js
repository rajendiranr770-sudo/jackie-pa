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
let transactions = JSON.parse(localStorage.getItem('my_app_txs')) || [];
let vattiAccounts = JSON.parse(localStorage.getItem('my_app_vatti')) || {};
let searchQuery = "";
let selectedMonthFilter = "ALL";

// STATE SAVE & SYNC
function saveState() {
    localStorage.setItem('my_app_txs', JSON.stringify(transactions));
    localStorage.setItem('my_app_vatti', JSON.stringify(vattiAccounts));

    if (currentUser) {
        setDoc(doc(db, "users", currentUser.uid), {
            transactions: transactions,
            vattiAccounts: vattiAccounts,
            lastUpdated: new Date().toISOString()
        }, { merge: true });
    }

    populateMonthDropdown();
    updateDashboardUI();
    renderAllLists();
    renderVattiAccounts();
}

// AUTH setup
document.getElementById('login-btn')?.addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('logout-btn')?.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        document.getElementById('user-display-name').textContent = user.displayName || user.email;

        onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                let data = docSnap.data();
                if (data.transactions) transactions = data.transactions;
                if (data.vattiAccounts) vattiAccounts = data.vattiAccounts;
                saveState();
            }
        });
    } else {
        currentUser = null;
        document.getElementById('auth-container').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }
});

// SCROLL TO VATTI
window.scrollToVatti = function() {
    document.getElementById('vatti-section')?.scrollIntoView({ behavior: 'smooth' });
};

// MONTH FILTER
function populateMonthDropdown() {
    let selectEl = document.getElementById('month-filter-select');
    if (!selectEl) return;

    let months = new Set();
    transactions.forEach(t => {
        if (t.date) {
            let d = new Date(t.date);
            if (!isNaN(d)) months.add(d.toLocaleString('en-US', { month: 'short', year: 'numeric' }));
        }
    });

    let curr = selectEl.value || "ALL";
    selectEl.innerHTML = `<option value="ALL">எல்லா மாதங்களும் (All)</option>`;
    months.forEach(m => selectEl.innerHTML += `<option value="${m}">${m}</option>`);
    selectEl.value = curr;

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
        return d.toLocaleString('en-US', { month: 'short', year: 'numeric' }) === selectedMonthFilter;
    });
}

// TRANSACTION PROCESSING
window.processVoiceOrText = function() {
    let input = document.getElementById('voice-text-input');
    if (!input || !input.value.trim()) return;

    let text = input.value.trim();
    let numMatch = text.match(/(\d[\d,]*(\.\d+)?)/);
    let amount = numMatch ? parseFloat(numMatch[1].replace(/,/g, '')) : 0;

    if (!amount) return alert("சரியான தொகையைக் குறிப்பிடவும்.");

    let category = "பொதுச் செலவு";
    let isExpense = true;
    let source = "வீடு";

    if (text.includes("சம்பளம்")) source = "சம்பளம்";
    if (text.includes("எம்கே") || text.includes("mk")) category = "MK செலவு";
    else if (text.includes("எஸ்கே") || text.includes("sk")) category = "SK செலவு";
    else if (text.includes("கொல்லை")) category = "கொல்லை";

    if (text.includes("வரவு") || text.includes("தந்தார்கள்")) { isExpense = false; category = "வரவு"; }

    transactions.unshift({
        id: Date.now(),
        text: text,
        amount: amount,
        category: category,
        source: source,
        isExpense: isExpense,
        date: new Date().toLocaleString()
    });

    input.value = '';
    saveState();
};

// EDIT TRANSACTION (✏️ வசதி)
window.editTx = function(id) {
    let t = transactions.find(x => x.id === id);
    if (!t) return;

    let newText = prompt("பதிவை மாற்று:", t.text);
    if (newText === null) return;
    let newAmount = prompt("தொகையை மாற்று (₹):", t.amount);
    if (newAmount === null) return;

    t.text = newText.trim() || t.text;
    t.amount = parseFloat(newAmount) || t.amount;
    saveState();
};

// DELETE TRANSACTION (🗑️ வசதி)
window.deleteTx = function(id) {
    if (confirm("இந்த பதிவை நீக்க விரும்புகிறீர்களா?")) {
        transactions = transactions.filter(t => t.id !== id);
        saveState();
    }
};

// DASHBOARD CALCULATIONS
function updateDashboardUI() {
    let totals = { "சம்பளம்": 0, "வீடு": 0, "கொல்லை": 0, "MK செலவு": 0, "SK செலவு": 0, "வட்டி": 0 };
    let filtered = filterByMonth(transactions);

    filtered.forEach(t => {
        let src = t.source || "வீடு";
        if (!t.isExpense) totals[src] += t.amount;
        else {
            totals[src] -= t.amount;
            if (totals[t.category] !== undefined) totals[t.category] += t.amount;
        }
    });

    let totalVatti = 0;
    for (let name in vattiAccounts) {
        if (Array.isArray(vattiAccounts[name])) {
            vattiAccounts[name].forEach(l => totalVatti += (l.amount || 0));
        }
    }
    totals["வட்டி"] = totalVatti;

    document.getElementById('salary-val').innerText = '₹' + Math.round(totals["சம்பளம்"]);
    document.getElementById('home-val').innerText = '₹' + Math.round(totals["வீடு"]);
    document.getElementById('kollai-val').innerText = '₹' + Math.round(totals["கொல்லை"]);
    document.getElementById('mk-val').innerText = '₹' + Math.round(totals["MK செலவு"]);
    document.getElementById('sk-val').innerText = '₹' + Math.round(totals["SK செலவு"]);
    document.getElementById('vatti-val').innerText = '₹' + Math.round(totals["வட்டி"]);
}

// SEARCH & DYNAMIC TOTAL BOX
window.processSearch = function() {
    let input = document.getElementById('search-query-input');
    searchQuery = input ? input.value.trim() : "";
    let box = document.getElementById('search-result-box');

    if (!searchQuery) {
        if (box) box.style.display = "none";
        renderAllLists();
        return;
    }

    let cleanQ = searchQuery.toLowerCase();
    let totalExpense = 0, totalIncome = 0, count = 0;

    transactions.forEach(t => {
        let fullText = `${t.text} ${t.category} ${t.source}`.toLowerCase();
        if (fullText.includes(cleanQ)) {
            if (t.isExpense) totalExpense += t.amount;
            else totalIncome += t.amount;
            count++;
        }
    });

    if (box) {
        box.style.display = "block";
        let displayTotal = totalIncome > 0 ? (totalIncome - totalExpense) : totalExpense;
        let label = totalIncome > 0 ? `மொத்த மீதி: ₹${displayTotal}` : `மொத்த செலவு: -₹${displayTotal}`;
        box.innerHTML = `
        <div style="background:#0284c7; color:white; padding:12px; border-radius:10px; text-align:center; font-weight:bold;">
            🔍 "${searchQuery}" - (${count} பதிவுகள்) <br> <span style="font-size:18px;">${label}</span>
        </div>`;
    }

    renderAllLists();
};

function renderAllLists() {
    let el = document.getElementById('all-list');
    if (!el) return;

    let list = filterByMonth(transactions);
    if (searchQuery) {
        let q = searchQuery.toLowerCase();
        list = list.filter(t => `${t.text} ${t.category} ${t.source}`.toLowerCase().includes(q));
    }

    if (list.length === 0) {
        el.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:15px;">பதிவுகள் எதுவுமில்லை</div>`;
        return;
    }

    el.innerHTML = list.map(t => `
    <div class="card-box" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
            <strong style="font-size:15px;">${t.text}</strong>
            <div style="font-size:12px; color:#64748b; margin-top:4px;">${t.date} | ${t.category} (${t.source || 'வீடு'})</div>
        </div>
        <div style="text-align:right;">
            <div style="color:${t.isExpense ? '#dc2626' : '#16a34a'}; font-weight:bold; font-size:16px;">
                ${t.isExpense ? '-' : '+'}₹${t.amount}
            </div>
            <div style="margin-top:4px;">
                <button onclick="editTx(${t.id})" style="background:none; border:none; cursor:pointer;">✏️</button>
                <button onclick="deleteTx(${t.id})" style="background:none; border:none; cursor:pointer;">🗑️</button>
            </div>
        </div>
    </div>`).join('');
}

// VATTI LOAN BUSINESS MANAGEMENT
window.addVattiLoan = function() {
    let name = document.getElementById('vatti-name').value.trim();
    let amount = parseFloat(document.getElementById('vatti-principal').value);
    let rate = parseFloat(document.getElementById('vatti-rate').value);
    let date = document.getElementById('vatti-date').value || new Date().toISOString().split('T')[0];

    if (!name || !amount || !rate) return alert("அனைத்து விவரங்களையும் நிரப்பவும்.");

    if (!vattiAccounts[name]) vattiAccounts[name] = [];
    vattiAccounts[name].push({ id: Date.now(), amount, rate, date });

    document.getElementById('vatti-name').value = '';
    document.getElementById('vatti-principal').value = '';
    document.getElementById('vatti-rate').value = '';

    saveState();
};

function renderVattiAccounts() {
    let el = document.getElementById('vatti-accounts-list');
    if (!el) return;

    let html = '';
    for (let name in vattiAccounts) {
        let loans = vattiAccounts[name];
        if (!loans || loans.length === 0) continue;

        let totP = 0, totI = 0;
        let loansHtml = loans.map((l, idx) => {
            totP += l.amount;
            let mInterest = (l.amount * l.rate) / 100;
            totI += mInterest;
            return `
            <div style="border-top:1px solid #e2e8f0; padding-top:8px; margin-top:8px; font-size:13px;">
                <strong>கடன் ${idx + 1}:</strong> அசல்: ₹${l.amount} | வட்டி: ${l.rate}% 
                <button onclick="deleteVattiLoan('${name}', ${l.id})" style="float:right; background:none; border:none; cursor:pointer;">🗑️</button>
                <div style="color:#0284c7; margin-top:2px;">மாத வட்டி: ₹${mInterest} (தேதி: ${l.date})</div>
            </div>`;
        }).join('');

        html += `
        <div id="vatti-card-${name.replace(/\s+/g, '-')}" class="card-box" style="border:1px solid #bfdbfe; background:#f0f9ff;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h4 style="margin:0; color:#1e40af; font-size:16px;">👤 ${name}</h4>
                <button onclick="downloadSingleVattiPDF('${name}')" style="background:#0284c7; color:white; border:none; padding:4px 10px; border-radius:6px; font-weight:bold; cursor:pointer;">📄 PDF</button>
            </div>
            ${loansHtml}
            <div style="background:#0f172a; color:white; padding:8px 12px; border-radius:8px; margin-top:10px; font-weight:bold; font-size:13px;">
                மொத்த அசல்: ₹${totP} | மாத வட்டி: ₹${totI}
            </div>
        </div>`;
    }

    el.innerHTML = html;
}

window.deleteVattiLoan = function(name, loanId) {
    if (confirm("இந்தக் கடனை நீக்கவா?")) {
        vattiAccounts[name] = vattiAccounts[name].filter(l => l.id !== loanId);
        if (vattiAccounts[name].length === 0) delete vattiAccounts[name];
        saveState();
    }
};

// PDF DOWNLOADS
window.downloadOverallPDF = function() {
    let element = document.getElementById('main-app');
    let opt = { margin: 10, filename: 'Overall_Finance_Report.pdf', html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
    html2pdf().set(opt).from(element).save();
};

window.downloadSingleVattiPDF = function(name) {
    let cardId = `vatti-card-${name.replace(/\s+/g, '-')}`;
    let element = document.getElementById(cardId);
    if (!element) return;
    let opt = { margin: 10, filename: `${name}_Vatti_Report.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
    html2pdf().set(opt).from(element).save();
};

// VOICE SPEECH RECOGNITION
window.startVoiceRecognition = function() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'ta-IN';
        recognition.onresult = function(event) {
            let text = event.results[0][0].transcript;
            let input = document.getElementById('voice-text-input');
            if (input) input.value = text;
            window.processVoiceOrText();
        };
        recognition.start();
    } else alert("பிரவுசரில் குரல் வசதி இல்லை.");
};
