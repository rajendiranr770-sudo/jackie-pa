// ========================================================
// 1. FIREBASE SETUP (இணைப்பு)
// ========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 🔑 உங்கள் Firebase Config சாவி (இங்கே உங்கள் சாவியை மட்டும் மாற்றிக் கொள்ளவும்)
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
// 3. SAVE STATE (LOCAL + FIREBASE CLOUD SYNC)
// ========================================================
function saveState() {
    // LocalStorage-ல் சேமித்தல்
    localStorage.setItem('my_app_txs', JSON.stringify(transactions));
    localStorage.setItem('my_app_vatti', JSON.stringify(vattiAccounts));
    
    // லாக்-இன் செய்திருந்தால் Firebase Cloud-ல் ஆன்லைனில் சேமித்தல்
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

// லாக்-இன் நிலையைக் கண்காணித்து ஆன்லைன் டேட்டாவை உடனுக்குடன் சின்க் செய்தல்
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
// 5. APP UI NAVIGATION FUNCTIONS
// ========================================================
function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    let activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.classList.add('active');
    if (btnElement) btnElement.classList.add('active');
}

function scrollToSection(elementId) {
    let element = document.getElementById(elementId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ========================================================
// 6. TAMIL NUMBERS PARSING & AI LOGIC
// ========================================================
function parseTamilAmount(text) {
    let t = text.toLowerCase().trim();

    let numMatch = t.match(/(\d[\d,]*)/);
    if (numMatch) {
        let baseNum = parseFloat(numMatch[1].replace(/,/g, ''));
        if (t.includes("ஆயிரம்") || t.includes("ayiram")) return baseNum * 1000;
        if (t.includes("லட்சம்") || t.includes("lakh")) return baseNum * 100000;
        return baseNum;
    }

    let wordMap = {
        "ஒரு": 1, "ஒன்னு": 1, "இரண்டு": 2, "ரெண்டு": 2, "மூன்று": 3, "மூணு": 3, "நான்கு": 4, "நாலு": 4,
        "ஐந்து": 5, "அஞ்சு": 5, "ஆறு": 6, "ஏழு": 7, "எட்டு": 8, "ஒன்பது": 9, "பத்து": 10,
        "நூறு": 100, "இருநூறு": 200, "முன்னூறு": 300, "நானூறு": 400, "ஐந்நூறு": 500,
        "ஆயிரம்": 1000, "இரண்டாயிரம்": 2000, "ரெண்டாயிரம்": 2000, "மூன்றாயிரம்": 3000, "மூணாயிரம்": 3000,
        "நாலாயிரம்": 4000, "ஐயாயிரம்": 5000, "ஆறாயிரம்": 6000, "ஏழாயிரம்": 7000, "எட்டாயிரம்": 8000, "ஒன்பதாயிரம்": 9000,
        "பத்தாயிரம்": 10000, "பதினைந்தாயிரம்": 15000, "இருபதாயிரம்": 20000, "முப்பதாயிரம்": 30000,
        "நாற்பதாயிரம்": 40000, "ஐம்பதாயிரம்": 50000, "அறுபதாயிரம்": 60000, "எழுபதாயிரம்": 70000, "எண்பதாயிரம்": 80000,
        "ஒரு லட்சம்": 100000, "லட்சம்": 100000
    };

    for (let word in wordMap) {
        if (t.includes(word)) return wordMap[word];
    }
    return 0;
}

function processNewTransaction(text) {
    let amount = parseTamilAmount(text);
    if (!amount) return alert("சரியான தொகையை உள்ளிடவும்.");

    let t = text.toLowerCase();
    let category = "வீடு"; 
    let source = null; 
    let isExpense = true;

    if (t.includes("சம்பள பணத்தில்") || t.includes("சம்பள பணம்") || t.includes("சம்பளம்")) {
        source = "சம்பளம்";
    } else if (t.includes("வீட்டு பணத்தில்") || t.includes("வீட்டு பணம்") || t.includes("வீடு")) {
        source = "வீடு";
    }

    if (t.includes("தந்தார்கள்") || t.includes("கொடுத்தார்கள்") || t.includes("வந்தது") || t.includes("வரவு") || t.includes("கிடைத்தது")) {
        isExpense = false;
        if (!source) source = "வீடு";
    } else if (t.includes("வட்டி") || t.includes("பைசா") || t.includes("கடன்")) {
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
    } else if (t.includes("கொல்லை") || t.includes("மருந்து") || t.includes("உரம்") || t.includes("கூலி")) {
        category = "கொல்லை";
    } else if (t.includes("mk") || t.includes("எம் கே")) {
        category = "MK செலவு";
    } else if (t.includes("sk") || t.includes("எஸ் கே")) {
        category = "SK செலவு";
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

function confirmSource(selectedSource) {
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
}

// ========================================================
// 7. MANUAL ENTRY & VATTI FORM LOGIC
// ========================================================
function addManualEntry(category, descId, amtId, typeId, dateId) {
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
}

function addExpenseManual(category, descId, amtId, sourceId, dateId) {
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
}

function addMoreLoanField() {
    let container = document.getElementById('vatti-inputs-container');
    let div = document.createElement('div');
    div.style.cssText = "display: flex; gap: 8px; margin-bottom: 8px;";
    div.innerHTML = `
        <input type="number" class="vatti-amt-input" placeholder="கூடுதல் அசல் தொகை (₹)" style="flex:1;">
        <input type="number" class="vatti-rate-input" placeholder="வட்டி %" style="flex:1;">
    `;
    container.appendChild(div);
}

function saveVattiAccount() {
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
}

function addSingleLoanForPerson(name) {
    document.getElementById('vatti-name').value = name;
    scrollToSection('vatti-form-box');
    let amtInput = document.querySelector('.vatti-amt-input');
    if (amtInput) amtInput.focus();
}

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
// 9. MODALS, EDIT & DELETE HANDLERS
// ========================================================
function openVattiEditModal(name, index) {
    editingVattiInfo = { name, index };
    let loan = vattiAccounts[name][index];
    document.getElementById('edit-vatti-amt').value = loan.amount;
    document.getElementById('edit-vatti-rate').value = loan.rate;
    document.getElementById('edit-vatti-date').value = loan.date;
    document.getElementById('vattiEditModal').style.display = 'flex';
}

function closeVattiEditModal() {
    document.getElementById('vattiEditModal').style.display = 'none';
}

function saveVattiEdit() {
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
    closeVattiEditModal();
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

function closeEditModal() { 
    document.getElementById('editModal').style.display = 'none'; 
}

function saveEdit() {
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
    closeEditModal();
}

function deleteTx(id) {
    transactions = transactions.filter(t => t.id !== id);
    saveState();
}

function handleManualInput() {
    let input = document.getElementById('userInput');
    if (input && input.value.trim() !== '') {
        processNewTransaction(input.value.trim());
        input.value = '';
    }
}

// ========================================================
// 10. VOICE RECOGNITION
// ========================================================
function startVoiceRecognition() {
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
}
