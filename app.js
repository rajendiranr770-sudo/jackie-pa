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

let currentEditTxId = null;
let currentVattiEditTarget = null;
let isRemoteUpdate = false; 

window.editTx = openEditModal;
window.deleteTx = deleteTx;
window.editVattiLoan = openVattiEditModal;
window.deleteVattiLoan = deleteVattiLoan;
window.downloadSingleVattiPDF = downloadSingleVattiPDF;

document.addEventListener('DOMContentLoaded', () => {
    // Category Tabs click
    document.querySelectorAll('.filter-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            let cat = btn.getAttribute('data-category');
            selectCategoryTab(cat);
        });
    });

    // Top Stat Cards click
    const categories = ['சம்பளம்', 'வீடு', 'கொல்லை', 'MK செலவு', 'SK செலவு', 'வட்டி பிசினஸ்'];
    categories.forEach(cat => {
        let card = document.getElementById(`card-${cat}`);
        if (card) {
            card.addEventListener('click', () => selectCategoryTab(cat));
        }
    });

    // Action & Form Buttons
    document.getElementById('login-btn')?.addEventListener('click', () => signInWithPopup(auth, provider));
    document.getElementById('logout-btn')?.addEventListener('click', () => signOut(auth));
    document.getElementById('btn-pdf-download')?.addEventListener('click', downloadOverallPDF);
    document.getElementById('btn-search')?.addEventListener('click', processSearch);
    document.getElementById('btn-add-vatti')?.addEventListener('click', addVattiLoan);
    document.getElementById('btn-send-tx')?.addEventListener('click', processVoiceOrText);
    document.getElementById('btn-mic-speech')?.addEventListener('click', startVoiceRecognition);
    document.getElementById('btn-add-manual')?.addEventListener('click', addManualTransaction);

    // Edit Modal Buttons
    document.getElementById('btn-save-edit')?.addEventListener('click', saveTxEdit);
    document.getElementById('btn-close-edit')?.addEventListener('click', closeEditModal);
    document.getElementById('btn-vatti-save-edit')?.addEventListener('click', saveVattiLoanEdit);
    document.getElementById('btn-vatti-close-edit')?.addEventListener('click', closeVattiEditModal);
});

// REFRESH UI ONLY
function refreshUI() {
    populateMonthDropdown();
    updateDashboardUI();
    renderAllLists();
    renderVattiAccounts();
}

// SAVE & SYNC TO FIREBASE
function saveState() {
    localStorage.setItem('my_app_txs', JSON.stringify(transactions));
    localStorage.setItem('my_app_vatti', JSON.stringify(vattiAccounts));

    if (currentUser && !isRemoteUpdate) {
        setDoc(doc(db, "users", currentUser.uid), {
            transactions: transactions,
            vattiAccounts: vattiAccounts,
            lastUpdated: new Date().toISOString()
        }, { merge: true });
    }

    refreshUI();
}

// CATEGORY SWITCHER & MANUAL FORM TOGGLE
function selectCategoryTab(category) {
    selectedCategoryTab = category;
    
    document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
    let activeTab = document.getElementById(`tab-${category}`);
    if (activeTab) {
        activeTab.classList.add('active');
        activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    let heading = document.getElementById('list-heading');
    if (heading) {
        heading.textContent = category === "ALL" ? "அனைத்துப் பதிவுகள்" : `${category} பதிவுகள்`;
    }

    let genView = document.getElementById('general-view');
    let vattiView = document.getElementById('vatti-view');
    let manualCard = document.getElementById('manual-entry-card');
    let manualTitle = document.getElementById('manual-entry-title');

    if (category === "வட்டி பிசினஸ்") {
        if (genView) genView.style.display = "none";
        if (vattiView) vattiView.style.display = "block";
        renderVattiAccounts();
    } else {
        if (genView) genView.style.display = "block";
        if (vattiView) vattiView.style.display = "none";

        // Show/Hide Manual Entry Box based on selection
        if (category !== "ALL" && manualCard) {
            let iconMap = { "சம்பளம்": "💼", "வீடு": "🏠", "கொல்லை": "🌱", "MK செலவு": "🛒", "SK செலவு": "🛍️" };
            if (manualTitle) manualTitle.textContent = `${iconMap[category] || '📝'} மேனுவல் பதிவு (${category})`;
            manualCard.style.display = "block";
        } else if (manualCard) {
            manualCard.style.display = "none";
        }

        renderAllLists();
    }
}

// MANUAL ENTRY ADD FUNCTION
function addManualTransaction() {
    let textInput = document.getElementById('manual-text');
    let amtInput = document.getElementById('manual-amount');
    let typeInput = document.getElementById('manual-type');

    let text = textInput ? textInput.value.trim() : "";
    let amount = amtInput ? parseFloat(amtInput.value) : 0;
    let type = typeInput ? typeInput.value : "income";

    if (!text || !amount) return alert("விவரம் மற்றும் தொகையை உள்ளிடவும்.");

    let isExpense = (type === "expense");
    let category = selectedCategoryTab;
    let source = selectedCategoryTab;

    transactions.unshift({
        id: Date.now(),
        text: text,
        amount: amount,
        category: category,
        source: source,
        isExpense: isExpense,
        date: new Date().toLocaleString()
    });

    if (textInput) textInput.value = "";
    if (amtInput) amtInput.value = "";

    saveState();
}

// AUTH LISTENERS
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        const authContainer = document.getElementById('auth-container');
        const mainApp = document.getElementById('main-app');
        const userDisplayName = document.getElementById('user-display-name');

        if (authContainer) authContainer.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        if (userDisplayName) userDisplayName.textContent = user.displayName || user.email;

        onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                let data = docSnap.data();
                isRemoteUpdate = true;
                if (data.transactions) transactions = data.transactions;
                if (data.vattiAccounts) vattiAccounts = data.vattiAccounts;
                localStorage.setItem('my_app_txs', JSON.stringify(transactions));
                localStorage.setItem('my_app_vatti', JSON.stringify(vattiAccounts));
                refreshUI();
                isRemoteUpdate = false;
            }
        });
    } else {
        currentUser = null;
        const authContainer = document.getElementById('auth-container');
        const mainApp = document.getElementById('main-app');
        if (authContainer) authContainer.style.display = 'flex';
        if (mainApp) mainApp.style.display = 'none';
    }
});

// MONTH FILTERING
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

// SMART VOICE & TEXT PARSER
function processVoiceOrText() {
    let input = document.getElementById('voice-text-input');
    if (!input || !input.value.trim()) return;

    let text = input.value.trim();
    let numMatch = text.match(/(\d[\d,]*(\.\d+)?)/);
    let amount = numMatch ? parseFloat(numMatch[1].replace(/,/g, '')) : 0;

    if (!amount) return alert("சரியான தொகையைக் குறிப்பிடவும்.");

    let category = "பொதுச் செலவு";
    let isExpense = true;
    let source = "சம்பளம்"; // Default

    // Source & Category Detection
    if (text.includes("வீடு") || text.includes("வீட்டில்")) {
        source = "வீடு";
        category = "வீடு";
    } else if (text.includes("கொல்லை") || text.includes("கொல்லையில்")) {
        source = "கொல்லை";
        category = "கொல்லை";
    } else if (text.includes("எம்கே") || text.includes("mk")) {
        category = "MK செலவு";
    } else if (text.includes("எஸ்கே") || text.includes("sk")) {
        category = "SK செலவு";
    } else if (text.includes("சம்பளம்")) {
        source = "சம்பளம்";
        category = "சம்பளம்";
    }

    // Income Detection
    if (text.includes("வரவு") || text.includes("தந்தார்கள்") || text.includes("வந்தது") || text.includes("வந்ததுன்னு")) { 
        isExpense = false; 
    }

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

// DASHBOARD CALCULATOR
function updateDashboardUI() {
    let totals = { "சம்பளம்": 0, "வீடு": 0, "கொல்லை": 0, "MK செலவு": 0, "SK செலவு": 0, "வட்டி": 0 };
    
    transactions.forEach(t => {
        let amount = parseFloat(t.amount) || 0;
        let src = t.source || "சம்பளம்";
        
        if (!t.isExpense) {
            // Income (+)
            if (totals[src] !== undefined) totals[src] += amount;
            else totals["சம்பளம்"] += amount;
        } else {
            // Expense (-)
            if (totals[src] !== undefined) totals[src] -= amount;
            if (totals[t.category] !== undefined && t.category !== src) {
                totals[t.category] += amount;
            }
        }
    });

    let totalVattiPrincipal = 0;
    for (let name in vattiAccounts) {
        if (Array.isArray(vattiAccounts[name])) {
            vattiAccounts[name].forEach(l => totalVattiPrincipal += (parseFloat(l.amount) || 0));
        }
    }
    totals["வட்டி"] = totalVattiPrincipal;

    const salEl = document.getElementById('salary-val');
    const homeEl = document.getElementById('home-val');
    const kolEl = document.getElementById('kollai-val');
    const mkEl = document.getElementById('mk-val');
    const skEl = document.getElementById('sk-val');
    const vatEl = document.getElementById('vatti-val');

    if (salEl) salEl.innerText = '₹' + Math.round(totals["சம்பளம்"]);
    if (homeEl) homeEl.innerText = '₹' + Math.round(totals["வீடு"]);
    if (kolEl) kolEl.innerText = '₹' + Math.round(totals["கொல்லை"]);
    if (mkEl) mkEl.innerText = '₹' + Math.round(totals["MK செலவு"]);
    if (skEl) skEl.innerText = '₹' + Math.round(totals["SK செலவு"]);
    if (vatEl) vatEl.innerText = '₹' + Math.round(totals["வட்டி"]);
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
            <div style="font-size:11px; color:#64748b; margin-top:2px;">${t.date} | ${t.isExpense ? 'செலவு' : 'வரவு'} (${t.source || 'சம்பளம்'})</div>
        </div>
        <div style="text-align:right;">
            <div style="color:${t.isExpense ? '#dc2626' : '#16a34a'}; font-weight:bold; font-size:15px;">
                ${t.isExpense ? '-' : '+'}₹${t.amount}
            </div>
            <div style="margin-top:2px;">
                <button onclick="editTx(${t.id})" style="background:none; border:none; cursor:pointer; font-size:15px;">✏️</button>
                <button onclick="deleteTx(${t.id})" style="background:none; border:none; cursor:pointer; font-size:15px;">🗑️</button>
            </div>
        </div>
    </div>`).join('');
}

// EDIT MODAL LOGIC
function openEditModal(id) {
    let t = transactions.find(x => x.id === id);
    if (!t) return;

    currentEditTxId = id;

    let titleEl = document.getElementById('edit-title');
    let amtEl = document.getElementById('edit-amount');
    let srcEl = document.getElementById('edit-source');
    let targetEl = document.getElementById('edit-target');
    let typeEl = document.getElementById('edit-type');
    let dateEl = document.getElementById('edit-date');

    if (titleEl) titleEl.value = t.text || '';
    if (amtEl) amtEl.value = t.amount || 0;
    if (srcEl) srcEl.value = t.source || 'சம்பளம்';
    if (targetEl) targetEl.value = t.category || 'சம்பளம்';
    if (typeEl) typeEl.value = t.isExpense ? 'expense' : 'income';
    if (dateEl) dateEl.value = t.date || new Date().toLocaleString();

    let overlay = document.getElementById('edit-modal-overlay');
    if (overlay) overlay.style.display = 'flex';
}

function closeEditModal() {
    let overlay = document.getElementById('edit-modal-overlay');
    if (overlay) overlay.style.display = 'none';
    currentEditTxId = null;
}

function saveTxEdit() {
    if (!currentEditTxId) return;

    let t = transactions.find(x => x.id === currentEditTxId);
    if (!t) return;

    let titleEl = document.getElementById('edit-title');
    let amtEl = document.getElementById('edit-amount');
    let srcEl = document.getElementById('edit-source');
    let targetEl = document.getElementById('edit-target');
    let typeEl = document.getElementById('edit-type');
    let dateEl = document.getElementById('edit-date');

    if (titleEl) t.text = titleEl.value.trim();
    if (amtEl) t.amount = parseFloat(amtEl.value) || 0;
    if (srcEl) t.source = srcEl.value;
    if (targetEl) t.category = targetEl.value;
    if (typeEl) t.isExpense = typeEl.value === 'expense';
    if (dateEl) t.date = dateEl.value;

    saveState();
    closeEditModal();
}

function deleteTx(id) {
    if (confirm("இந்த பதிவை நீக்க விரும்புகிறீர்களா?")) {
        transactions = transactions.filter(t => t.id !== id);
        saveState();
    }
}

// VATTI MANAGEMENT
function addVattiLoan() {
    let nameInput = document.getElementById('vatti-name');
    let amtInput = document.getElementById('vatti-principal');
    let rateInput = document.getElementById('vatti-rate');
    let dateInput = document.getElementById('vatti-date');

    let name = nameInput ? nameInput.value.trim() : "";
    let amount = amtInput ? parseFloat(amtInput.value) : 0;
    let rate = rateInput ? parseFloat(rateInput.value) : 0;
    let date = (dateInput && dateInput.value) ? dateInput.value : new Date().toISOString().split('T')[0];

    if (!name || !amount || !rate) return alert("அனைத்து விவரங்களையும் நிரப்பவும்.");

    if (!vattiAccounts[name]) vattiAccounts[name] = [];
    vattiAccounts[name].push({ id: Date.now(), amount, rate, date });

    if (nameInput) nameInput.value = '';
    if (amtInput) amtInput.value = '';
    if (rateInput) rateInput.value = '';

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
                <div style="float:right;">
                    <button onclick="editVattiLoan('${name}', ${l.id})" style="background:none; border:none; cursor:pointer; font-size:14px;">✏️</button>
                    <button onclick="deleteVattiLoan('${name}', ${l.id})" style="background:none; border:none; cursor:pointer; font-size:14px;">🗑️</button>
                </div>
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

// VATTI LOAN EDIT POPUP
function openVattiEditModal(name, loanId) {
    let loans = vattiAccounts[name];
    if (!loans) return;
    let l = loans.find(x => x.id === loanId);
    if (!l) return;

    currentVattiEditTarget = { name, loanId };
    
    let amtEl = document.getElementById('vatti-edit-principal');
    let rateEl = document.getElementById('vatti-edit-rate');
    let dateEl = document.getElementById('vatti-edit-date');

    if (amtEl) amtEl.value = l.amount || 0;
    if (rateEl) rateEl.value = l.rate || 0;
    if (dateEl) dateEl.value = l.date || '';

    let overlay = document.getElementById('vatti-edit-modal-overlay');
    if (overlay) overlay.style.display = 'flex';
}

function closeVattiEditModal() {
    let overlay = document.getElementById('vatti-edit-modal-overlay');
    if (overlay) overlay.style.display = 'none';
    currentVattiEditTarget = null;
}

function saveVattiLoanEdit() {
    if (!currentVattiEditTarget) return;

    let { name, loanId } = currentVattiEditTarget;
    let loans = vattiAccounts[name];
    if (!loans) return;
    let l = loans.find(x => x.id === loanId);
    if (!l) return;

    let amtEl = document.getElementById('vatti-edit-principal');
    let rateEl = document.getElementById('vatti-edit-rate');
    let dateEl = document.getElementById('vatti-edit-date');

    if (amtEl) l.amount = parseFloat(amtEl.value) || 0;
    if (rateEl) l.rate = parseFloat(rateEl.value) || 0;
    if (dateEl) l.date = dateEl.value;

    saveState();
    closeVattiEditModal();
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
    if (!element) return;
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
