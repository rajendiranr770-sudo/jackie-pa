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
let selectedCategoryTab = "ALL";

// Global Window functions for inline click events
window.editTx = editTx;
window.deleteTx = deleteTx;
window.deleteVattiLoan = deleteVattiLoan;
window.downloadSingleVattiPDF = downloadSingleVattiPDF;

// Attach click events on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
    // Event listener for tab buttons
    document.querySelectorAll('.filter-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            let cat = btn.getAttribute('data-category');
            selectCategoryTab(cat);
        });
    });

    // Event listener for top stat cards
    const categories = ['சம்பளம்', 'வீடு', 'கொல்லை', 'MK செலவு', 'SK செலவு', 'வட்டி பிசினஸ்'];
    categories.forEach(cat => {
        let card = document.getElementById(`card-${cat}`);
        if (card) {
            card.addEventListener('click', () => {
                selectCategoryTab(cat);
            });
        }
    });

    // Action buttons
    document.getElementById('login-btn')?.addEventListener('click', () => signInWithPopup(auth, provider));
    document.getElementById('logout-btn')?.addEventListener('click', () => signOut(auth));
    document.getElementById('btn-pdf-download')?.addEventListener('click', downloadOverallPDF);
    document.getElementById('btn-search')?.addEventListener('click', processSearch);
    document.getElementById('btn-add-vatti')?.addEventListener('click', addVattiLoan);
    document.getElementById('btn-send-tx')?.addEventListener('click', processVoiceOrText);
    document.getElementById('btn-mic-speech')?.addEventListener('click', startVoiceRecognition);
});

// CATEGORY TAB SWITCHER FUNCTION
function selectCategoryTab(category) {
    selectedCategoryTab = category;
    
    // 1. Tab active toggle
    document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
    let activeTab = document.getElementById(`tab-${category}`);
    if (activeTab) {
        activeTab.classList.add('active');
        // Smooth scroll tab into view
        activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    // 2. Heading label change
    let heading = document.getElementById('list-heading');
    if (heading) {
        heading.textContent = category === "ALL" ? "அனைத்துப் பதிவுகள்" : `${category} பதிவுகள்`;
    }

    // 3. View switch
    let genView = document.getElementById('general-view');
    let vattiView = document.getElementById('vatti-view');

    if (category === "வட்டி பிசினஸ்") {
        genView.style.display = "none";
        vattiView.style.display = "block";
        renderVattiAccounts();
    } else {
        genView.style.display = "block";
        vattiView.style.display = "none";
        renderAllLists();
    }
}

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

// AUTH
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

function filterByMonthAndTab(list) {
    let result = list;

    if (selectedMonthFilter !== "ALL") {
        result = result.filter(t => {
            if (!t.date) return false;
            let d = new Date(t.date);
            return d.toLocaleString('en-US', { month: 'short', year: 'numeric' }) === selectedMonthFilter;
        });
    }

    if (selectedCategoryTab !== "ALL" && selectedCategoryTab !== "வட்டி பிசினஸ்") {
        result = result.filter(t => t.category === selectedCategoryTab || t.source === selectedCategoryTab);
    }

    return result;
}

// ADD TRANSACTIONS
function processVoiceOrText() {
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

    if (text.includes("வரவு") || text.includes("தந்தார்கள்") || text.includes("வந்தது")) { isExpense = false; category = "வரவு"; }

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
}

function editTx(id) {
    let t = transactions.find(x => x.id === id);
    if (!t) return;

    let newText = prompt("பதிவை மாற்று:", t.text);
    if (newText === null) return;
    let newAmount = prompt("தொகையை மாற்று (₹):", t.amount);
    if (newAmount === null) return;

    t.text = newText.trim() || t.text;
    t.amount = parseFloat(newAmount) || t.amount;
    saveState();
}

function deleteTx(id) {
    if (confirm("இந்த பதிவை நீக்க விரும்புகிறீர்களா?")) {
        transactions = transactions.filter(t => t.id !== id);
        saveState();
    }
}

// DASHBOARD CALCULATIONS
function updateDashboardUI() {
    let totals = { "சம்பளம்": 0, "வீடு": 0, "கொல்லை": 0, "MK செலவு": 0, "SK செலவு": 0, "வட்டி": 0 };
    
    // Compute category totals
    transactions.forEach(t => {
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

// SEARCH
function processSearch() {
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
        <div style="background:#0284c7; color:white; padding:10px; border-radius:10px; text-align:center; font-weight:bold; margin-top:8px;">
            🔍 "${searchQuery}" - (${count} பதிவுகள்) <br> <span style="font-size:16px;">${label}</span>
        </div>`;
    }

    renderAllLists();
}

function renderAllLists() {
    let el = document.getElementById('all-list');
    if (!el) return;

    let list = filterByMonthAndTab(transactions);
    if (searchQuery) {
        let q = searchQuery.toLowerCase();
        list = list.filter(t => `${t.text} ${t.category} ${t.source}`.toLowerCase().includes(q));
    }

    if (list.length === 0) {
        el.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:15px;">பதிவுகள் எதுவும் இல்லை</div>`;
        return;
    }

    el.innerHTML = list.map(t => `
    <div class="card-box" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
            <strong style="font-size:14px;">${t.text}</strong>
            <div style="font-size:11px; color:#64748b; margin-top:2px;">${t.date} | ${t.category} (${t.source || 'வீடு'})</div>
        </div>
        <div style="text-align:right;">
            <div style="color:${t.isExpense ? '#dc2626' : '#16a34a'}; font-weight:bold; font-size:15px;">
                ${t.isExpense ? '-' : '+'}₹${t.amount}
            </div>
            <div style="margin-top:2px;">
                <button onclick="editTx(${t.id})" style="background:none; border:none; cursor:pointer;">✏️</button>
                <button onclick="deleteTx(${t.id})" style="background:none; border:none; cursor:pointer;">🗑️</button>
            </div>
        </div>
    </div>`).join('');
}

// VATTI MANAGEMENT
function addVattiLoan() {
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
}

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
            <div style="border-top:1px solid #cbd5e1; padding-top:6px; margin-top:6px; font-size:12px;">
                <strong>கடன் ${idx + 1}:</strong> அசல்: ₹${l.amount} | வட்டி: ${l.rate}% 
                <button onclick="deleteVattiLoan('${name}', ${l.id})" style="float:right; background:none; border:none; cursor:pointer;">🗑️</button>
                <div style="color:#0284c7; margin-top:2px;">மாத வட்டி: ₹${mInterest} (தேதி: ${l.date})</div>
            </div>`;
        }).join('');

        html += `
        <div id="vatti-card-${name.replace(/\s+/g, '-')}" class="card-box" style="border:1px solid #bfdbfe; background:#f0f9ff;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h4 style="margin:0; color:#1e40af; font-size:15px;">👤 ${name}</h4>
                <button onclick="downloadSingleVattiPDF('${name}')" style="background:#0284c7; color:white; border:none; padding:4px 8px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px;">📄 PDF</button>
            </div>
            ${loansHtml}
            <div style="background:#0f172a; color:white; padding:6px 10px; border-radius:8px; margin-top:8px; font-weight:bold; font-size:12px;">
                மொத்த அசல்: ₹${totP} | மாத வட்டி: ₹${totI}
            </div>
        </div>`;
    }

    el.innerHTML = html;
}

function deleteVattiLoan(name, loanId) {
    if (confirm("இந்தக் கடனை நீக்கவா?")) {
        vattiAccounts[name] = vattiAccounts[name].filter(l => l.id !== loanId);
        if (vattiAccounts[name].length === 0) delete vattiAccounts[name];
        saveState();
    }
}

// PDF DOWNLOADS
function downloadOverallPDF() {
    let element = document.getElementById('general-view');
    let opt = { margin: 10, filename: 'Overall_Finance_Report.pdf', html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
    html2pdf().set(opt).from(element).save();
}

function downloadSingleVattiPDF(name) {
    let cardId = `vatti-card-${name.replace(/\s+/g, '-')}`;
    let element = document.getElementById(cardId);
    if (!element) return;
    let opt = { margin: 10, filename: `${name}_Vatti_Report.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
    html2pdf().set(opt).from(element).save();
}

// VOICE SPEECH RECOGNITION
function startVoiceRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'ta-IN';
        recognition.onresult = function(event) {
            let text = event.results[0][0].transcript;
            let input = document.getElementById('voice-text-input');
            if (input) input.value = text;
            processVoiceOrText();
        };
        recognition.start();
    } else alert("பிரவுசரில் குரல் வசதி இல்லை.");
}
