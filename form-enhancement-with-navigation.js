/**
 * ========================================
 * Finance & Loan Master App - Enhanced Features
 * ========================================
 * 
 * Features:
 * 1. Time field support in all entry forms
 * 2. Auto-update search box after entry
 * 3. Income card navigation persistence (back button returns to same card)
 * 4. Draft/incomplete entry preservation across app reloads
 * 
 * Tamil User Experience Optimized
 */

// ============================================
// STORAGE KEYS FOR NAVIGATION & DRAFT STATE
// ============================================
const STORAGE_KEYS = {
    ACTIVE_INCOME_CARD: "finance_active_income_card",
    DRAFT_TRANSACTION: "finance_draft_transaction",
    DRAFT_VATTI: "finance_draft_vatti",
    DRAFT_KAIMAATHU: "finance_draft_kaimaathu",
    DRAFT_INCOME_CARD: "finance_draft_income_card",
    NAVIGATION_STACK: "finance_navigation_stack"
};

// ============================================
// 1. INCOME CARD NAVIGATION TRACKING
// ============================================

function setActiveIncomeCard(cardName) {
    if (cardName) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_INCOME_CARD, cardName);
    }
}

function getActiveIncomeCard() {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_INCOME_CARD);
}

function clearActiveIncomeCard() {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_INCOME_CARD);
}

// Income card clicked → store it in navigation
function onIncomeCardClick(cardName) {
    setActiveIncomeCard(cardName);
}

// ============================================
// 2. DRAFT TRANSACTION SAVE & RESTORE
// ============================================

function saveDraftTransaction() {
    const draft = {
        title: document.getElementById("m-title").value,
        amount: document.getElementById("m-amount").value,
        source: document.getElementById("m-source").value,
        category: document.getElementById("m-category").value,
        type: document.getElementById("m-type").value,
        date: document.getElementById("m-date").value,
        time: document.getElementById("m-time") ? document.getElementById("m-time").value : "",
        incomeCard: document.getElementById("m-income-card").value,
        timestamp: Date.now()
    };
    
    if (draft.title || draft.amount) {
        localStorage.setItem(STORAGE_KEYS.DRAFT_TRANSACTION, JSON.stringify(draft));
    }
}

function restoreDraftTransaction() {
    const saved = localStorage.getItem(STORAGE_KEYS.DRAFT_TRANSACTION);
    if (saved) {
        try {
            const draft = JSON.parse(saved);
            document.getElementById("m-title").value = draft.title || "";
            document.getElementById("m-amount").value = draft.amount || "";
            document.getElementById("m-source").value = draft.source || "சம்பளம்";
            document.getElementById("m-category").value = draft.category || "பொது";
            document.getElementById("m-type").value = draft.type || "expense";
            document.getElementById("m-date").value = draft.date || getLocalDateString();
            
            // Time field restore
            if (document.getElementById("m-time")) {
                document.getElementById("m-time").value = draft.time || "";
            }
            
            document.getElementById("m-income-card").value = draft.incomeCard || "";
            toggleCategoryOption();
        } catch (e) {
            console.warn("Draft restore failed:", e);
        }
    }
}

function clearDraftTransaction() {
    localStorage.removeItem(STORAGE_KEYS.DRAFT_TRANSACTION);
}

// ============================================
// 3. DRAFT VATTI LOAN SAVE & RESTORE
// ============================================

function saveDraftVatti() {
    const draft = {
        name: document.getElementById("v-name").value,
        principal: document.getElementById("v-principal").value,
        rate: document.getElementById("v-rate").value,
        date: document.getElementById("v-date").value,
        timestamp: Date.now()
    };
    
    if (draft.name || draft.principal) {
        localStorage.setItem(STORAGE_KEYS.DRAFT_VATTI, JSON.stringify(draft));
    }
}

function restoreDraftVatti() {
    const saved = localStorage.getItem(STORAGE_KEYS.DRAFT_VATTI);
    if (saved) {
        try {
            const draft = JSON.parse(saved);
            document.getElementById("v-name").value = draft.name || "";
            document.getElementById("v-principal").value = draft.principal || "";
            document.getElementById("v-rate").value = draft.rate || "";
            document.getElementById("v-date").value = draft.date || getLocalDateString();
        } catch (e) {
            console.warn("Vatti draft restore failed:", e);
        }
    }
}

function clearDraftVatti() {
    localStorage.removeItem(STORAGE_KEYS.DRAFT_VATTI);
}

// ============================================
// 4. DRAFT KAIMAATHU SAVE & RESTORE
// ============================================

function saveDraftKaiMaathu() {
    const draft = {
        name: document.getElementById("km-name").value,
        amount: document.getElementById("km-amount").value,
        type: document.getElementById("km-type").value,
        date: document.getElementById("km-date").value,
        timestamp: Date.now()
    };
    
    if (draft.name || draft.amount) {
        localStorage.setItem(STORAGE_KEYS.DRAFT_KAIMAATHU, JSON.stringify(draft));
    }
}

function restoreDraftKaiMaathu() {
    const saved = localStorage.getItem(STORAGE_KEYS.DRAFT_KAIMAATHU);
    if (saved) {
        try {
            const draft = JSON.parse(saved);
            document.getElementById("km-name").value = draft.name || "";
            document.getElementById("km-amount").value = draft.amount || "";
            document.getElementById("km-type").value = draft.type || "given";
            document.getElementById("km-date").value = draft.date || getLocalDateString();
        } catch (e) {
            console.warn("KaiMaathu draft restore failed:", e);
        }
    }
}

function clearDraftKaiMaathu() {
    localStorage.removeItem(STORAGE_KEYS.DRAFT_KAIMAATHU);
}

// ============================================
// 5. DRAFT INCOME CARD SAVE & RESTORE
// ============================================

function saveDraftIncomeCard() {
    const draft = {
        name: document.getElementById("income-card-name").value,
        timestamp: Date.now()
    };
    
    if (draft.name) {
        localStorage.setItem(STORAGE_KEYS.DRAFT_INCOME_CARD, JSON.stringify(draft));
    }
}

function restoreDraftIncomeCard() {
    const saved = localStorage.getItem(STORAGE_KEYS.DRAFT_INCOME_CARD);
    if (saved) {
        try {
            const draft = JSON.parse(saved);
            document.getElementById("income-card-name").value = draft.name || "";
        } catch (e) {
            console.warn("Income card draft restore failed:", e);
        }
    }
}

function clearDraftIncomeCard() {
    localStorage.removeItem(STORAGE_KEYS.DRAFT_INCOME_CARD);
}

// ============================================
// 6. AUTO-SAVE DRAFTS ON INPUT CHANGE
// ============================================

function initializeDraftAutoSave() {
    // Manual transaction form
    const manualFormFields = ["m-title", "m-amount", "m-source", "m-category", "m-type", "m-date", "m-time"];
    manualFormFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("change", saveDraftTransaction);
            el.addEventListener("blur", saveDraftTransaction);
        }
    });
    
    // Vatti form
    const vattiFormFields = ["v-name", "v-principal", "v-rate", "v-date"];
    vattiFormFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("change", saveDraftVatti);
            el.addEventListener("blur", saveDraftVatti);
        }
    });
    
    // KaiMaathu form
    const kmFormFields = ["km-name", "km-amount", "km-type", "km-date"];
    kmFormFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("change", saveDraftKaiMaathu);
            el.addEventListener("blur", saveDraftKaiMaathu);
        }
    });
    
    // Income card form
    const incomeCardEl = document.getElementById("income-card-name");
    if (incomeCardEl) {
        incomeCardEl.addEventListener("change", saveDraftIncomeCard);
        incomeCardEl.addEventListener("blur", saveDraftIncomeCard);
    }
}

// ============================================
// 7. CLEAR FORM + AUTO-SEARCH UPDATE
// ============================================

function clearManualTransactionFormWithSearchUpdate() {
    // பார்ம் சுத்தம்
    document.getElementById("m-title").value = "";
    document.getElementById("m-amount").value = "";
    document.getElementById("m-source").value = "சம்பளம்";
    document.getElementById("m-category").value = "பொது";
    document.getElementById("m-type").value = "expense";
    document.getElementById("m-date").value = getLocalDateString();
    
    // Time field clear
    if (document.getElementById("m-time")) {
        document.getElementById("m-time").value = "";
    }
    
    document.getElementById("m-income-card").value = "";
    document.getElementById("m-income-card").style.display = "none";
    toggleCategoryOption();
    
    // Draft clear
    clearDraftTransaction();
    
    // Search box update (refresh results)
    setTimeout(() => {
        executeSearch();
    }, 100);
    
    // Focus back to title
    document.getElementById("m-title").focus();
}

function clearVattiLoanFormWithSearchUpdate() {
    document.getElementById("v-name").value = "";
    document.getElementById("v-principal").value = "";
    document.getElementById("v-rate").value = "";
    document.getElementById("v-date").value = getLocalDateString();
    clearDraftVatti();
    
    setTimeout(() => {
        executeSearch();
    }, 100);
    
    document.getElementById("v-name").focus();
}

function clearKaiMaathuFormWithSearchUpdate() {
    document.getElementById("km-name").value = "";
    document.getElementById("km-amount").value = "";
    document.getElementById("km-type").value = "given";
    document.getElementById("km-date").value = getLocalDateString();
    clearDraftKaiMaathu();
    
    setTimeout(() => {
        executeSearch();
    }, 100);
    
    document.getElementById("km-name").focus();
}

// ============================================
// 8. HANDLE BACK BUTTON FOR INCOME CARDS
// ============================================

function handleMobileBackButton() {
    const activeCard = getActiveIncomeCard();
    
    if (activeCard && document.getElementById("income-card-modal").style.display === "block") {
        // Back button clicked while income card modal is open
        // Close modal and return to the same income card view
        closeIncomeCardModal();
        
        // Scroll to the active income card
        setTimeout(() => {
            const cardElement = document.querySelector(`[data-income-card="${activeCard}"]`);
            if (cardElement) {
                cardElement.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }, 300);
    } else if (activeCard) {
        // Clear the navigation if fully exiting
        clearActiveIncomeCard();
    }
}

// Listen to back button (for PWA/browser)
window.addEventListener("popstate", handleMobileBackButton);

// ============================================
// 9. APP INITIALIZATION - RESTORE STATE
// ============================================

function initializeFormStateOnAppLoad() {
    console.log("📋 Initializing form state on app load...");
    
    // Restore any incomplete drafts
    restoreDraftTransaction();
    restoreDraftVatti();
    restoreDraftKaiMaathu();
    restoreDraftIncomeCard();
    
    // Initialize auto-save listeners
    initializeDraftAutoSave();
    
    // Restore last active income card view (if any)
    const activeCard = getActiveIncomeCard();
    if (activeCard) {
        console.log("🎯 Restoring active income card:", activeCard);
        // Scroll to it if exists
        const cardElement = document.querySelector(`[data-income-card="${activeCard}"]`);
        if (cardElement) {
            setTimeout(() => {
                cardElement.scrollIntoView({ behavior: "smooth" });
            }, 500);
        }
    }
}

// ============================================
// 10. SUCCESSFUL ENTRY HANDLER
// ============================================

function onEntrySuccessful(entryType) {
    console.log("✅ Entry successful:", entryType);
    
    switch (entryType) {
        case "transaction":
            clearManualTransactionFormWithSearchUpdate();
            break;
        case "vatti":
            clearVattiLoanFormWithSearchUpdate();
            break;
        case "kaimaathu":
            clearKaiMaathuFormWithSearchUpdate();
            break;
        case "income_card":
            clearDraftIncomeCard();
            document.getElementById("income-card-name").value = "";
            break;
    }
}

// ============================================
// 11. EXPORT FOR USE IN INDEX.HTML
// ============================================

// இந்த functions இவை already call செய்ய வேண்டும்:
// 1. On app load: initializeFormStateOnAppLoad()
// 2. After successful transaction: onEntrySuccessful("transaction")
// 3. After successful vatti: onEntrySuccessful("vatti")
// 4. After successful kaimaathu: onEntrySuccessful("kaimaathu")
// 5. When income card clicked: onIncomeCardClick(cardName)
// 6. On back button: handleMobileBackButton()
