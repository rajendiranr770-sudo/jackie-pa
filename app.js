import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    deleteDoc, 
    doc, 
    updateDoc, 
    query, 
    where, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCXRVuNCiWh1AhuVHInbKcfUAmgyAwzVHk",
    authDomain: "myfinanceapp-3f883.firebaseapp.com",
    projectId: "myfinanceapp-3f883",
    storageBucket: "myfinanceapp-3f883.firebasestorage.app",
    messagingSenderId: "698658153791",
    appId: "1:698658153791:web:08ea0171d24a9b0da51f8a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// State Variables
let currentUser = null;
let currentCategory = "ALL";
let currentMonth = "ALL";

let allTransactions = [];
let vattiAccounts = [];

let editingTxId = null;
let editingVattiId = null;
let editingVattiLoanIndex = null;

// Tamil Text Numbers to Numeric Values
function convertTamilTextToNumbers(text) {
    if (!text) return text;
    let str = text.toLowerCase();
    
    // Convert Tamil Numeric Digits
    const tamilDigits = {'௦':'0','௧':'1','௨':'2','௩':'3','௪':'4','௫':'5','௬':'6','௭':'7','௮':'8','௯':'9'};
    str = str.replace(/[௦-௯]/g, m => tamilDigits[m]);

    // Words Map
    const wordMap = [
        { w: "ஒரு லட்சம்", v: 100000 }, { w: "லட்சம்", v: 100000 },
        { w: "அம்பதாயிரம்", v: 50000 }, { w: "ஐம்பதாயிரம்", v: 50000 },
        { w: "நாற்பதாயிரம்", v: 40000 }, { w: "முப்பதாயிரம்", v: 30000 },
        { w: "இருபதாயிரம்", v: 20000 }, { w: "பத்தாயிரம்", v: 10000 },
        { w: "ஒன்பதாயிரம்", v: 9000 }, { w: "எட்டாயிரம்", v: 8000 },
        { w: "ஏழாயிரம்", v: 7000 }, { w: "ஆறாயிரம்", v: 6000 },
        { w: "ஐயாயிரம்", v: 5000 }, { w: "நாலாயிரம்", v: 4000 },
        { w: "மூன்றாயிரம்", v: 3000 }, { w: "இரண்டாயிரம்", v: 2000 },
        { w: "ஆயிரம்", v: 1000 },
        { w: "நூறு", v: 100 }, { w: "இருநூறு", v: 200 }, { w: "முந்நூறு", v: 300 },
        { w: "நானூறு", v: 400 }, { w: "ஐநூறு", v: 500 }, { w: "அறுநூறு", v: 600 },
        { w: "எழுநூறு", v: 700 }, { w: "எண்ணூறு", v: 800 }, { w: "தொள்ளாயிரம்", v: 900 }
    ];

    wordMap.forEach(item => {
        if (str.includes(item.w)) {
            str = str.replace(new RegExp(item.w, 'g'), ` ${item.v} `);
        }
    });

    return str;
}

// DOM Elements Initialization
document.addEventListener("DOMContentLoaded", () => {
    // Auth elements
    const loginBtn = document.getElementById("login-btn");
    const logoutBtn = document.getElementById("logout-btn");
    
    if (loginBtn) {
        loginBtn.addEventListener("click", () => {
            signInWithPopup(auth, provider).catch(err => alert("Login Error: " + err.message));
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            signOut(auth);
        });
    }

    // Category Tabs & Cards Event Listener
    document.querySelectorAll(".filter-tab, .stat-card").forEach(elem => {
        elem.addEventListener("click", (e) => {
            let cat = elem.getAttribute("data-category") || elem.id.replace("card-", "");
            if (cat) switchCategoryTab(cat);
        });
    });

    // Inputs & Action Buttons
    const btnSendTx = document.getElementById("btn-send-tx");
    if (btnSendTx) btnSendTx.addEventListener("click", processBottomInput);

    const btnMicSpeech = document.getElementById("btn-mic-speech");
    if (btnMicSpeech) btnMicSpeech.addEventListener("click", startVoiceRecognition);

    const btnAddManual = document.getElementById("btn-add-manual");
    if (btnAddManual) btnAddManual.addEventListener("click", handleAddManual);

    const btnAddVatti = document.getElementById("btn-add-vatti");
    if (btnAddVatti) btnAddVatti.addEventListener("click", handleAddVattiLoan);

    const monthSelect = document.getElementById("month-filter-select");
    if (monthSelect) monthSelect.addEventListener("change", (e) => {
        currentMonth = e.target.value;
        renderGeneralTransactions();
    });

    const btnSearch = document.getElementById("btn-search");
    if (btnSearch) btnSearch.addEventListener("click", handleExpenseSearch);

    const btnPdf = document.getElementById("btn-pdf-download");
    if (btnPdf) btnPdf.addEventListener("click", downloadPDF);

    // Edit Modal Buttons
    const btnSaveEdit = document.getElementById("btn-save-edit");
    if (btnSaveEdit) btnSaveEdit.addEventListener("click", saveTransactionEdit);
    
    const btnCloseEdit = document.getElementById("btn-close-edit");
    if (btnCloseEdit) btnCloseEdit.addEventListener("click", () => {
        document.getElementById("edit-modal-overlay").style.display = "none";
    });

    // Vatti Edit Modal Buttons
    const btnVattiSaveEdit = document.getElementById("btn-vatti-save-edit");
    if (btnVattiSaveEdit) btnVattiSaveEdit.addEventListener("click", saveVattiLoanEdit);

    const btnVattiCloseEdit = document.getElementById("btn-vatti-close-edit");
    if (btnVattiCloseEdit) btnVattiCloseEdit.addEventListener("click", () => {
        document.getElementById("vatti-edit-modal-overlay").style.display = "none";
    });
});

// Authentication Observer
onAuthStateChanged(auth, (user) => {
    const authContainer = document.getElementById("auth-container");
    const mainApp = document.getElementById("main-app");

    if (user) {
        currentUser = user;
        if (authContainer) authContainer.style.display = "none";
        if (mainApp) mainApp.style.display = "block";

        const userNameElem = document.getElementById("user-display-name");
        if (userNameElem) userNameElem.innerText = user.displayName || user.email.split("@")[0];

        listenToData();
    } else {
        currentUser = null;
        if (authContainer) authContainer.style.display = "flex";
        if (mainApp) mainApp.style.display = "none";
    }
});

// Realtime Firestore Listener
function listenToData() {
    if (!currentUser) return;

    // Listen General Transactions
    const qTx = query(
        collection(db, "users", currentUser.uid, "transactions"),
        orderBy("timestamp", "desc")
    );
    onSnapshot(qTx, (snapshot) => {
        allTransactions = [];
        snapshot.forEach(docSnap => {
            allTransactions.push({ id: docSnap.id, ...docSnap.data() });
        });
        updateTotalsAndMonths();
        renderGeneralTransactions();
    });

    // Listen Vatti Accounts
    const qVatti = query(
        collection(db, "users", currentUser.uid, "vatti_accounts"),
        orderBy("createdAt", "desc")
    );
    onSnapshot(qVatti, (snapshot) => {
        vattiAccounts = [];
        snapshot.forEach(docSnap => {
            vattiAccounts.push({ id: docSnap.id, ...docSnap.data() });
        });
        updateVattiTotal();
        renderVattiAccounts();
    });
}

// Category Tab Switcher
function switchCategoryTab(cat) {
    currentCategory = cat;

    document.querySelectorAll(".filter-tab").forEach(tab => {
        if (tab.getAttribute("data-category") === cat) tab.classList.add("active");
        else tab.classList.remove("active");
    });

    const generalView = document.getElementById("general-view");
    const vattiView = document.getElementById("vatti-view");
    const manualCard = document.getElementById("manual-entry-card");

    if (cat === "வட்டி பிசினஸ்") {
        if (generalView) generalView.style.display = "none";
        if (vattiView) vattiView.style.display = "block";
    } else {
        if (vattiView) vattiView.style.display = "none";
        if (generalView) generalView.style.display = "block";

        if (cat === "ALL") {
            if (manualCard) manualCard.style.display = "none";
            document.getElementById("list-heading").innerText = "அனைத்துப் பதிவுகள்";
        } else {
            if (manualCard) manualCard.style.display = "block";
            document.getElementById("manual-entry-title").innerText = `🏡 மேனுவல் பதிவு - ${cat}`;
            document.getElementById("list-heading").innerText = `${cat} - பதிவுகள்`;
        }
        renderGeneralTransactions();
    }
}

// Parse Text/Voice and Extract Smart Intent
function processBottomInput() {
    const inputField = document.getElementById("voice-text-input");
    let rawText = inputField.value.trim();
    if (!rawText) return;

    let processedText = convertTamilTextToNumbers(rawText);

    // Regex for Amount Extraction
    const amtMatch = processedText.match(/\d+/);
    if (!amtMatch) {
        alert("தொகையை சரியாக குறிப்பிடவும்!");
        return;
    }

    const amount = parseFloat(amtMatch[0]);

    // Enhanced Category Parsing
    let targetCategory = "பொதுச் செலவு";
    let type = "expense";
    let sourceCategory = "சம்பளம்";

    let lowerText = processedText.toLowerCase();

    if (lowerText.includes("சம்பளம்") || lowerText.includes("சம்பளம் வந்தது") || lowerText.includes("salary")) {
        targetCategory = "சம்பளம்";
        type = "income";
        sourceCategory = "சம்பளம்";
    } else if (lowerText.includes("வீடு") || lowerText.includes("வீட்டிலிருந்து") || lowerText.includes("வீட்டு")) {
        targetCategory = "வீடு";
        if (lowerText.includes("வந்தது") || lowerText.includes("வரவு") || lowerText.includes("பணம் வந்தது")) {
            type = "income";
        }
        sourceCategory = "வீடு";
    } else if (lowerText.includes("கொல்லை") || lowerText.includes("தோட்டம்")) {
        targetCategory = "கொல்லை";
        if (lowerText.includes("வந்தது") || lowerText.includes("வரவு")) {
            type = "income";
        }
        sourceCategory = "கொல்லை";
    } else if (lowerText.includes("எம் கே") || lowerText.includes("mk")) {
        targetCategory = "MK செலவு";
        sourceCategory = "MK செலவு";
    } else if (lowerText.includes("எஸ் கே") || lowerText.includes("sk")) {
        targetCategory = "SK செலவு";
        sourceCategory = "SK செலவு";
    }

    const now = new Date();
    const formattedDate = now.toLocaleString("en-US", { 
        month: "numeric", day: "numeric", year: "numeric", 
        hour: "numeric", minute: "numeric", second: "numeric", hour12: true 
    });

    const newTx = {
        title: rawText,
        amount: amount,
        type: type,
        source: sourceCategory,
        targetCategory: targetCategory,
        dateStr: formattedDate,
        timestamp: Date.now()
    };

    addDoc(collection(db, "users", currentUser.uid, "transactions"), newTx)
        .then(() => {
            inputField.value = "";
        })
        .catch(err => alert("Error: " + err.message));
}

// Voice Recognition setup
function startVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("உங்கள் பிரவுசரில் Voice Recognition இயங்காது.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ta-IN';
    recognition.start();

    const micBtn = document.getElementById("btn-mic-speech");
    micBtn.innerText = "🎙️ கேட்கிறது...";

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById("voice-text-input").value = transcript;
        micBtn.innerText = "🎙️ பேசு";
        processBottomInput();
    };

    recognition.onerror = () => {
        micBtn.innerText = "🎙️ பேசு";
    };

    recognition.onend = () => {
        micBtn.innerText = "🎙️ பேசு";
    };
}

// Handle Add Manual Entry
function handleAddManual() {
    const text = document.getElementById("manual-text").value.trim();
    const amount = parseFloat(document.getElementById("manual-amount").value);
    const type = document.getElementById("manual-type").value;

    if (!text || isNaN(amount)) {
        alert("விவரம் மற்றும் தொகையைச் சரியாக உள்ளிடவும்!");
        return;
    }

    const now = new Date();
    const formattedDate = now.toLocaleString("en-US", { 
        month: "numeric", day: "numeric", year: "numeric", 
        hour: "numeric", minute: "numeric", second: "numeric", hour12: true 
    });

    const newTx = {
        title: text,
        amount: amount,
        type: type,
        source: currentCategory,
        targetCategory: currentCategory,
        dateStr: formattedDate,
        timestamp: Date.now()
    };

    addDoc(collection(db, "users", currentUser.uid, "transactions"), newTx)
        .then(() => {
            document.getElementById("manual-text").value = "";
            document.getElementById("manual-amount").value = "";
        });
}

// Calculate Date Differences & Interests Accurate Logic
function calculateLoanDetails(principal, rate, startDateStr) {
    const startDate = new Date(startDateStr);
    const today = new Date();
    
    // Time difference in Days
    const timeDiff = today.getTime() - startDate.getTime();
    let totalDays = Math.floor(timeDiff / (1000 * 3600 * 24));
    if (totalDays < 0) totalDays = 0;

    const months = Math.floor(totalDays / 30);
    const remDays = totalDays % 30;

    // Monthly Interest amount
    const monthlyInterest = (principal * rate) / 100;
    
    // Per day Interest amount
    const dailyInterest = monthlyInterest / 30;

    // Total calculated interest
    const totalInterest = Math.round((totalDays * dailyInterest));

    return {
        totalDays,
        months,
        remDays,
        monthlyInterest,
        totalInterest
    };
}

// Add Vatti Loan (Supports Multiple Loans under Same Name)
// வட்டி கடன் சேர்க்கும் புதிய பங்க்ஷன் (பழைய / புதிய கணக்கு இரண்டிற்கும்)
window.handleAddLoan = function(isNewAccount) {
    const nameInput = document.getElementById("vatti-name");
    const principalInput = document.getElementById("vatti-principal");
    const rateInput = document.getElementById("vatti-rate");
    const dateInput = document.getElementById("vatti-date");

    const name = nameInput.value.trim();
    const principal = parseFloat(principalInput.value);
    const rate = parseFloat(rateInput.value);
    const date = dateInput.value;

    if (!name || isNaN(principal) || isNaN(rate) || !date) {
        alert("எல்லா விவரங்களையும் சரியாக நிரப்பவும்!");
        return;
    }

    const newLoanItem = { principal, rate, date };

    // isNewAccount 'false' ஆக இருந்தால் மட்டுமே பழைய சுரேஷ் கணக்கை தேடும்
    const existingAccount = isNewAccount ? null : vattiAccounts.find(acc => acc.name.toLowerCase() === name.toLowerCase());

    if (existingAccount) {
        // 1. பழைய கணக்கில் 'கடன் 2' ஆக சேர்க்கிறது
        const updatedLoans = [...(existingAccount.loans || []), newLoanItem];
        updateDoc(doc(db, "users", currentUser.uid, "vatti_accounts", existingAccount.id), {
            loans: updatedLoans
        }).then(() => {
            resetVattiForm();
        });
    } else {
        // 2. 'புதிய கணக்கு' பட்டன் அழுத்தினால் அதே பெயரில் புது கார்டு ஓபன் பண்ணுகிறது
        const newAcc = {
            name: name,
            loans: [newLoanItem],
            createdAt: Date.now()
        };
        addDoc(collection(db, "users", currentUser.uid, "vatti_accounts"), newAcc)
            .then(() => {
                resetVattiForm();
            });
    }
};

// ஃபார்மை ரீசெட் செய்யும் உதவி பங்க்ஷன்
function resetVattiForm() {
    document.getElementById("vatti-name").value = "";
    document.getElementById("vatti-principal").value = "";
    document.getElementById("vatti-rate").value = "";
    document.getElementById("vatti-date").value = "";
}

function resetVattiForm() {
    document.getElementById("vatti-name").value = "";
    document.getElementById("vatti-principal").value = "";
    document.getElementById("vatti-rate").value = "";
    document.getElementById("vatti-date").value = "";
}

// Render Vatti Accounts View
function renderVattiAccounts() {
    const listContainer = document.getElementById("vatti-accounts-list");
    if (!listContainer) return;

    listContainer.innerHTML = "";

    if (vattiAccounts.length === 0) {
        listContainer.innerHTML = "<p style='text-align:center; color:#64748b; padding:15px;'>வட்டி கடன்கள் எதுவும் இல்லை.</p>";
        return;
    }

    vattiAccounts.forEach(acc => {
        let totalAccPrincipal = 0;
        let totalAccInterest = 0;

        let loansHTML = "";

        (acc.loans || []).forEach((loan, idx) => {
            const calc = calculateLoanDetails(loan.principal, loan.rate, loan.date);
            totalAccPrincipal += loan.principal;
            totalAccInterest += calc.totalInterest;

            loansHTML += `
                <div style="border-left:3px solid #2563eb; background:#f8fafc; padding:8px 10px; margin-bottom:8px; border-radius:0 8px 8px 0; position:relative;">
                    <div style="font-weight:bold; color:#1e293b; font-size:13px; display:flex; justify-content:space-between; align-items:center;">
                        <span>கடன் ${idx + 1}: அசல்: ₹${loan.principal} | வட்டி: ${loan.rate}%</span>
                        <div>
                            <span style="cursor:pointer; margin-right:8px;" onclick="openEditVattiModal('${acc.id}', ${idx})">✏️</span>
                            <span style="cursor:pointer;" onclick="deleteVattiLoan('${acc.id}', ${idx})">🗑️</span>
                        </div>
                    </div>
                    <div style="font-size:11px; color:#64748b; margin-top:3px;">
                        📅 தேதி: ${loan.date} (${calc.totalDays} நாட்கள் (${calc.months} மாதம் ${calc.remDays} நாள்))
                    </div>
                    <div style="font-size:12px; font-weight:bold; color:#d97706; margin-top:3px;">
                        வட்டி தொகை: ₹${calc.totalInterest} (மாத வட்டி ₹${calc.monthlyInterest})
                    </div>
                </div>
            `;
        });

        const grandTotal = totalAccPrincipal + totalAccInterest;

        const card = document.createElement("div");
        card.className = "card-box";
        card.style.border = "1px solid #e2e8f0";
        card.style.marginBottom = "15px";

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; cursor:pointer;" onclick="selectVattiNameForForm('${acc.name}')">
                <h3 style="margin:0; color:#1e40af; font-size:16px;">👤 ${acc.name}</h3>
                <span style="font-size:11px; background:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:12px; font-weight:bold;">+ கடன் சேர்</span>
            </div>
            ${loansHTML}
            <div style="background:#0f172a; color:white; padding:10px; border-radius:8px; margin-top:8px; font-size:13px;">
                <div>மொத்த அசல்: ₹${totalAccPrincipal} | மொத்த வட்டி: ₹${totalAccInterest}</div>
                <div style="font-size:15px; font-weight:bold; color:#4ade80; margin-top:4px;">மொத்தம்: ₹${grandTotal}</div>
            </div>
        `;

        listContainer.appendChild(card);
    });
}

// Click Name to Auto Fill Form for Second Loan
window.selectVattiNameForForm = function(name) {
    document.getElementById("vatti-name").value = name;
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Delete Single Vatti Loan
window.deleteVattiLoan = function(accId, loanIdx) {
    if (!confirm("இந்தக் கடனை நீக்கவா?")) return;

    const acc = vattiAccounts.find(a => a.id === accId);
    if (!acc) return;

    const updatedLoans = [...acc.loans];
    updatedLoans.splice(loanIdx, 1);

    if (updatedLoans.length === 0) {
        deleteDoc(doc(db, "users", currentUser.uid, "vatti_accounts", accId));
    } else {
        updateDoc(doc(db, "users", currentUser.uid, "vatti_accounts", accId), {
            loans: updatedLoans
        });
    }
};

// Open Vatti Edit Modal
window.openEditVattiModal = function(accId, loanIdx) {
    const acc = vattiAccounts.find(a => a.id === accId);
    if (!acc || !acc.loans[loanIdx]) return;

    editingVattiId = accId;
    editingVattiLoanIndex = loanIdx;

    const loan = acc.loans[loanIdx];
    document.getElementById("vatti-edit-principal").value = loan.principal;
    document.getElementById("vatti-edit-rate").value = loan.rate;
    document.getElementById("vatti-edit-date").value = loan.date;

    document.getElementById("vatti-edit-modal-overlay").style.display = "flex";
};

// Save Vatti Edit
function saveVattiLoanEdit() {
    if (!editingVattiId || editingVattiLoanIndex === null) return;

    const principal = parseFloat(document.getElementById("vatti-edit-principal").value);
    const rate = parseFloat(document.getElementById("vatti-edit-rate").value);
    const date = document.getElementById("vatti-edit-date").value;

    const acc = vattiAccounts.find(a => a.id === editingVattiId);
    if (!acc) return;

    const updatedLoans = [...acc.loans];
    updatedLoans[editingVattiLoanIndex] = { principal, rate, date };

    updateDoc(doc(db, "users", currentUser.uid, "vatti_accounts", editingVattiId), {
        loans: updatedLoans
    }).then(() => {
        document.getElementById("vatti-edit-modal-overlay").style.display = "none";
        editingVattiId = null;
        editingVattiLoanIndex = null;
    });
}

// Totals Calculation
function updateTotalsAndMonths() {
    let totals = { "சம்பளம்": 0, "வீடு": 0, "கொல்லை": 0, "MK செலவு": 0, "SK செலவு": 0 };
    let monthsSet = new Set();

    allTransactions.forEach(tx => {
        if (tx.dateStr) {
            let mStr = tx.dateStr.split(",")[0].split("/")[0] + "/" + tx.dateStr.split(",")[0].split("/")[2];
            monthsSet.add(mStr);
        }

        let cat = tx.targetCategory || tx.source || "பொதுச் செலவு";
        let val = tx.amount || 0;

        if (totals.hasOwnProperty(cat)) {
            if (tx.type === "income") totals[cat] += val;
            else totals[cat] -= val;
        }
    });

    document.getElementById("salary-val").innerText = `₹${totals["சம்பளம்"]}`;
    document.getElementById("home-val").innerText = `₹${totals["வீடு"]}`;
    document.getElementById("kollai-val").innerText = `₹${totals["கொல்லை"]}`;
    document.getElementById("mk-val").innerText = `₹${totals["MK செலவு"]}`;
    document.getElementById("sk-val").innerText = `₹${totals["SK செலவு"]}`;

    // Populate Months Select
    const select = document.getElementById("month-filter-select");
    if (select) {
        let optionsHTML = `<option value="ALL">எல்லா மாதங்களும் (All)</option>`;
        monthsSet.forEach(m => {
            optionsHTML += `<option value="${m}" ${currentMonth === m ? 'selected' : ''}>மாதம்: ${m}</option>`;
        });
        select.innerHTML = optionsHTML;
    }
}

function updateVattiTotal() {
    let grandVatti = 0;
    vattiAccounts.forEach(acc => {
        (acc.loans || []).forEach(loan => {
            grandVatti += loan.principal;
        });
    });
    const elem = document.getElementById("vatti-val");
    if (elem) elem.innerText = `₹${grandVatti}`;
}

// Render Transactions List
function renderGeneralTransactions() {
    const listElem = document.getElementById("all-list");
    if (!listElem) return;

    listElem.innerHTML = "";

    let filtered = allTransactions.filter(tx => {
        let matchCat = (currentCategory === "ALL") || 
                       (tx.targetCategory === currentCategory || tx.source === currentCategory);
        let matchMonth = true;
        if (currentMonth !== "ALL" && tx.dateStr) {
            let mStr = tx.dateStr.split(",")[0].split("/")[0] + "/" + tx.dateStr.split(",")[0].split("/")[2];
            matchMonth = (mStr === currentMonth);
        }
        return matchCat && matchMonth;
    });

    if (filtered.length === 0) {
        listElem.innerHTML = "<p style='text-align:center; color:#64748b; padding:15px;'>பதிவுகள் இல்லை.</p>";
        return;
    }

    filtered.forEach(tx => {
        const item = document.createElement("div");
        item.className = "card-box";
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";

        const isIncome = tx.type === "income";
        const amtColor = isIncome ? "#16a34a" : "#dc2626";
        const amtSign = isIncome ? "+" : "-";

        item.innerHTML = `
            <div>
                <div style="font-weight:bold; font-size:14px; color:#0f172a;">${tx.title}</div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">
                    ${tx.dateStr || ''} | ${isIncome ? 'வரவு' : 'செலவு'} (${tx.targetCategory || tx.source})
                </div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:15px; font-weight:bold; color:${amtColor};">${amtSign}₹${tx.amount}</div>
                <div style="margin-top:4px;">
                    <span style="cursor:pointer; margin-right:6px;" onclick="openEditTxModal('${tx.id}')">✏️</span>
                    <span style="cursor:pointer;" onclick="deleteTransaction('${tx.id}')">🗑️</span>
                </div>
            </div>
        `;
        listElem.appendChild(item);
    });
}

// Delete General Transaction
window.deleteTransaction = function(id) {
    if (confirm("இந்தப் பதிவை நீக்க விரும்புகிறீர்களா?")) {
        deleteDoc(doc(db, "users", currentUser.uid, "transactions", id));
    }
};

// Edit General Transaction Modal
window.openEditTxModal = function(id) {
    const tx = allTransactions.find(t => t.id === id);
    if (!tx) return;

    editingTxId = id;

    document.getElementById("edit-title").value = tx.title || '';
    document.getElementById("edit-amount").value = tx.amount || 0;
    document.getElementById("edit-source").value = tx.source || 'சம்பளம்';
    document.getElementById("edit-target").value = tx.targetCategory || 'பொதுச் செலவு';
    document.getElementById("edit-type").value = tx.type || 'expense';
    document.getElementById("edit-date").value = tx.dateStr || '';

    document.getElementById("edit-modal-overlay").style.display = "flex";
};

function saveTransactionEdit() {
    if (!editingTxId) return;

    const updatedData = {
        title: document.getElementById("edit-title").value.trim(),
        amount: parseFloat(document.getElementById("edit-amount").value),
        source: document.getElementById("edit-source").value,
        targetCategory: document.getElementById("edit-target").value,
        type: document.getElementById("edit-type").value,
        dateStr: document.getElementById("edit-date").value
    };

    updateDoc(doc(db, "users", currentUser.uid, "transactions", editingTxId), updatedData)
        .then(() => {
            document.getElementById("edit-modal-overlay").style.display = "none";
            editingTxId = null;
        });
}

// Search Expense Logic
function handleExpenseSearch() {
    const queryStr = document.getElementById("search-query-input").value.trim().toLowerCase();
    const resultBox = document.getElementById("search-result-box");

    if (!queryStr) {
        resultBox.style.display = "none";
        return;
    }

    let filtered = allTransactions.filter(tx => 
        (tx.title && tx.title.toLowerCase().includes(queryStr)) ||
        (tx.targetCategory && tx.targetCategory.toLowerCase().includes(queryStr))
    );

    let totalAmt = filtered.reduce((acc, t) => acc + (t.amount || 0), 0);

    resultBox.style.display = "block";
    resultBox.innerHTML = `
        <div style="font-weight:bold; color:#0369a1; font-size:13px; margin-top:8px;">
            🔍 '${queryStr}' தேடல் முடிவுகள் (${filtered.length} பதிவுகள்):
        </div>
        <div style="font-size:14px; font-weight:bold; color:#0284c7; margin-top:4px;">
            மொத்தத் தொகை: ₹${totalAmt}
        </div>
    `;
}

// PDF Download Function
function downloadPDF() {
    const element = document.getElementById("general-view");
    const opt = {
        margin:       0.5,
        filename:     `Finance_Report_${new Date().toLocaleDateString()}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}
