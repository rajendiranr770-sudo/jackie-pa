/**
 * Finance & Loan Master App - Auto Clear Form Enhancement
 * 
 * இந்த ஸ்கிரிப்ட் பதிவு சேர்த்த பிறகு தானாக பார்ம்(form) காலி செய்கிறது.
 * வெற்றிகரமாக பதிவு சேர்ந்தவுடன், input fields அனைத்தும் empty ஆகிவிடும்
 * மற்றும் மடல் மூடிவிடும்.
 */

// ============================================
// 1. MANUAL TRANSACTION FORM CLEAR
// ============================================
function clearManualTransactionForm() {
    // பொது பதிவு fields
    document.getElementById("m-title").value = "";
    document.getElementById("m-amount").value = "";
    document.getElementById("m-source").value = "சம்பளம்";
    document.getElementById("m-category").value = "பொது";
    document.getElementById("m-type").value = "expense";
    document.getElementById("m-date").value = getLocalDateString();
    document.getElementById("m-income-card").value = "";
    document.getElementById("m-income-card").style.display = "none";
    
    // விசிறி reset செய்யுங்கள்
    toggleCategoryOption();
}

// ============================================
// 2. VATTI LOAN FORM CLEAR
// ============================================
function clearVattiLoanForm() {
    document.getElementById("v-name").value = "";
    document.getElementById("v-principal").value = "";
    document.getElementById("v-rate").value = "";
    document.getElementById("v-date").value = getLocalDateString();
}

// ============================================
// 3. KAIMAATHU FORM CLEAR
// ============================================
function clearKaiMaathuForm() {
    document.getElementById("km-name").value = "";
    document.getElementById("km-amount").value = "";
    document.getElementById("km-type").value = "given";
    document.getElementById("km-date").value = getLocalDateString();
}

// ============================================
// 4. INCOME CARD FORM CLEAR
// ============================================
function clearIncomeCardForm() {
    document.getElementById("income-card-name").value = "";
}

// ============================================
// 5. MULTI-SOURCE FORM CLEAR
// ============================================
function clearMultiSourceForm() {
    document.getElementById("ms-title").value = "";
    document.getElementById("ms-date").value = getLocalDateString();
    document.getElementById("ms-rows").innerHTML = "";
    document.getElementById("ms-total").textContent = "₹0.00";
    // ஒரு வரிசை சேர்க்கவும் (ஸ்டார்ট் வித் ஒன் ரோ)
    addMultiSourceRow();
}

// ============================================
// 6. SPLIT CATEGORY EXPENSE FORM CLEAR
// ============================================
function clearSplitCategoryForm() {
    document.getElementById("sc-title").value = "";
    document.getElementById("sc-source").value = "சம்பளம்";
    document.getElementById("sc-date").value = getLocalDateString();
    document.getElementById("sc-time").value = "";
    document.getElementById("sc-rows").innerHTML = "";
    document.getElementById("sc-total").textContent = "₹0.00";
    // ஒரு வரிசை சேர்க்கவும்
    addSplitCategoryRow();
}

// ============================================
// 7. INSTALLMENT PURCHASE FORM CLEAR
// ============================================
function clearInstallmentPurchaseForm() {
    document.getElementById("ip-title").value = "";
    document.getElementById("ip-total").value = "";
    document.getElementById("ip-advance").value = "";
    document.getElementById("ip-advance-date").value = getLocalDateString();
    document.getElementById("ip-advance-source").value = "சம்பளம்";
    document.getElementById("ip-remaining").textContent = "₹0.00";
}

// ============================================
// 8. TRIP FORM CLEAR
// ============================================
function clearTripForm() {
    document.getElementById("trip-name-input").value = "";
    document.getElementById("trip-edit-name").value = "";
    document.getElementById("trip-link-mk").checked = false;
    document.getElementById("trip-link-sk").checked = false;
    document.getElementById("trip-link-other").checked = false;
    document.getElementById("trip-other-name").value = "";
    document.getElementById("trip-other-name").style.display = "none";
}

// ============================================
// 9. BATCH ENTRY FORM CLEAR
// ============================================
function clearBatchEntryForm() {
    document.getElementById("batch-rows").innerHTML = "";
    document.getElementById("batch-total").textContent = "வரவு: ₹0.00 | செலவு: ₹0.00";
    addBatchRow(); // ஒரு வரிசை சேர்க்கவும்
}

// ============================================
// 10. MODAL CLOSE WITH FORM CLEAR
// ============================================
function closeModalWithFormClear(modalId, formClearFunction) {
    // பார்ம் சுத்தம் செய்யுங்கள்
    if (typeof formClearFunction === 'function') {
        formClearFunction();
    }
    
    // மডல் மூடுங்கள்
    document.getElementById(modalId).style.display = "none";
}

// ============================================
// 11. EDIT MODAL CLOSE (பெரிய பதிவுக்கு)
// ============================================
function closeEditModalWithClear() {
    document.getElementById("edit-id").value = "";
    document.getElementById("edit-collection-type").value = "";
    document.getElementById("edit-title").value = "";
    document.getElementById("edit-amount").value = "";
    document.getElementById("edit-date").value = getLocalDateString();
    document.getElementById("edit-time").value = "";
    document.getElementById("edit-source").value = "சம்பளம்";
    document.getElementById("edit-category").value = "பொது";
    document.getElementById("edit-type").value = "expense";
    document.getElementById("edit-rate").value = "";
    document.getElementById("edit-split-group").style.display = "none";
    document.getElementById("edit-split-rows").innerHTML = "";
    document.getElementById("edit-modal").style.display = "none";
}

// ============================================
// 12. DELETE MODAL CLOSE WITH CLEAR
// ============================================
function closeDeleteModalWithClear() {
    document.getElementById("delete-id").value = "";
    document.getElementById("delete-collection-type").value = "";
    document.getElementById("delete-modal").style.display = "none";
}
