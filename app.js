let db = JSON.parse(localStorage.getItem('smartpa_db_v6')) || { 
  salary: [], 
  home: [], 
  vatti: [], 
  kollai: [], 
  notes: [], 
  reminders: [] 
};
let pendingExpense = null;
let pendingVatti = null;

// தமிழ் எண்களையும் வார்த்தைகளையும் துல்லியமாக மாற்றும் லோஜிக்
function parseTamilNumbers(text) {
  let str = text.replace(/,/g, '');
  
  // லட்சங்கள்
  str = str.replace(/(இரண்டு|ரெண்டு|2)\s*(லட்சம்|லக்ஷம்|லட்ச|லக்ஷ)/g, '200000');
  str = str.replace(/(மூன்று|மூணு|3)\s*(லட்சம்|லக்ஷம்|லட்ச|லக்ஷ)/g, '300000');
  str = str.replace(/(நான்கு|நாலு|4)\s*(லட்சம்|லக்ஷம்|லட்ச|லக்ஷ)/g, '400000');
  str = str.replace(/(ஐந்து|அஞ்சு|5)\s*(லட்சம்|லக்ஷம்|லட்ச|லக்ஷ)/g, '500000');
  str = str.replace(/(\d+)\s*(லட்சம்|லக்ஷம்|லட்ச|லக்ஷ)/g, (m, p1) => parseInt(p1) * 100000);
  str = str.replace(/(ஒரு லட்சம்|ஒரு லக்ஷம்|லட்சம்|லக்ஷம்)/g, '100000');

  // ஆயிரங்கள்
  str = str.replace(/(இருபதாயிரம்|இருபது ஆயிரம்)/g, '20000');
  str = str.replace(/(முப்பதாயிரம்|முப்பது ஆயிரம்)/g, '30000');
  str = str.replace(/(நாற்பதாயிரம்|நாற்பது ஆயிரம்)/g, '40000');
  str = str.replace(/(ஐம்பதாயிரம்|ஐம்பது ஆயிரம்)/g, '50000');
  str = str.replace(/(\d+)\s*ஆயிரம்/g, (m, p1) => parseInt(p1) * 1000);
  str = str.replace(/(ஒரு ஆயிரம்|ஆயிரம்)/g, '1000');

  // மாதங்களின் பெயர்கள் / எண்கள்
  str = str.replace(/ஒன்னு|ஒன்று/g, '1');
  str = str.replace(/இரண்டு|ரெண்டு/g, '2');
  str = str.replace(/மூன்று|மூணு/g, '3');
  str = str.replace(/நான்கு|நாலு/g, '4');
  str = str.replace(/ஐந்து|அஞ்சு/g, '5');
  str = str.replace(/ஆறு/g, '6');
  str = str.replace(/ஏழு/g, '7');
  str = str.replace(/எட்டு/g, '8');
  str = str.replace(/ஒன்பது/g, '9');
  str = str.replace(/பத்து/g, '10');

  return str;
}

function getDateTime() {
  const now = new Date();
  return now.toLocaleDateString('ta-IN') + ' ' + now.toLocaleTimeString('ta-IN', { hour: '2-digit', minute: '2-digit' });
}

function saveData() {
  localStorage.setItem('smartpa_db_v6', JSON.stringify(db));
  renderData();
}

function deleteItem(cat, idx) {
  db[cat].splice(idx, 1);
  saveData();
}

function editItem(cat, idx) {
  let item = db[cat][idx];
  if (cat === 'salary' || cat === 'home' || cat === 'kollai') {
    let newDesc = prompt("புதிய விவரம்:", item.desc);
    let newAmt = prompt("புதிய தொகை (₹):", item.amt);
    if (newDesc && newAmt) {
      item.desc = newDesc;
      item.amt = parseFloat(newAmt);
      saveData();
    }
  } else if (cat === 'vatti') {
    let newName = prompt("பெயர்:", item.name);
    let newAmt = prompt("அசல்:", item.amt);
    let newRate = prompt("வட்டி %:", item.rate);
    let newDate = prompt("தேதி (DD/MM/YYYY):", item.date || '');
    if (newName && newAmt && newRate) {
      item.name = newName;
      item.amt = parseFloat(newAmt);
      item.rate = parseFloat(newRate);
      if (newDate) item.date = newDate;
      saveData();
    }
  }
}

function speak(text) {
  if ('speechSynthesis' in window) {
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'ta-IN';
    window.speechSynthesis.speak(msg);
  }
}

function calculateInterest(amt, rate, startDateStr) {
  let parts = (startDateStr || '').split(/[\/\-\s.]/);
  let start;
  if (parts.length >= 3) {
    let day = parseInt(parts[0]);
    let month = parseInt(parts[1]) - 1;
    let year = parseInt(parts[2]);
    if (year < 100) year += 2000;
    start = new Date(year, month, day);
  } else {
    start = new Date();
  }
  
  let today = new Date();

  let years = today.getFullYear() - start.getFullYear();
  let months = today.getMonth() - start.getMonth();
  let days = today.getDate() - start.getDate();

  if (days < 0) {
    months--;
    let prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  let totalMonths = (years * 12) + months;
  let monthlyInterest = (amt * rate) / 100;
  let dailyInterest = monthlyInterest / 30;

  let totalInterest = Math.round((totalMonths * monthlyInterest) + (days * dailyInterest));
  let grandTotal = amt + totalInterest;

  return { totalMonths, days, monthlyInterest: Math.round(monthlyInterest), totalInterest, grandTotal };
}

function renderData() {
  // 1. சம்பளம்
  let salBal = db.salary.reduce((acc, item) => item.type === 'in' ? acc + item.amt : acc - item.amt, 0);
  if(document.getElementById('bal-salary')) document.getElementById('bal-salary').innerText = salBal;
  if(document.getElementById('hist-salary')) {
    document.getElementById('hist-salary').innerHTML = db.salary.map((i, idx) => 
      `<div style="display:flex; justify-content:space-between; align-items:center; padding:12px; margin-bottom:8px; background:#f8fafc; border-radius:10px; border-left:4px solid ${i.type==='in'?'#16a34a':'#dc2626'};">
        <span><b>${i.desc}</b><br><small style="color:#64748b;">${i.datetime}</small></span>
        <div>
          <span style="font-weight:bold; margin-right:8px; font-size:16px; color:${i.type==='in'?'#16a34a':'#dc2626'};">₹${i.amt}</span> 
          <button style="background:#e2e8f0; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;" onclick="editItem('salary', ${idx})">✏️</button> 
          <button style="background:#fee2e2; color:#dc2626; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;" onclick="deleteItem('salary', ${idx})">🗑️</button>
        </div>
      </div>`
    ).reverse().join('');
  }

  // 2. வீடு
  let homeBal = db.home.reduce((acc, item) => item.type === 'in' ? acc + item.amt : acc - item.amt, 0);
  if(document.getElementById('bal-home')) document.getElementById('bal-home').innerText = homeBal;
  if(document.getElementById('hist-home')) {
    document.getElementById('hist-home').innerHTML = db.home.map((i, idx) => 
      `<div style="display:flex; justify-content:space-between; align-items:center; padding:12px; margin-bottom:8px; background:#f8fafc; border-radius:10px; border-left:4px solid ${i.type==='in'?'#16a34a':'#dc2626'};">
        <span><b>${i.desc}</b><br><small style="color:#64748b;">${i.datetime}</small></span>
        <div>
          <span style="font-weight:bold; margin-right:8px; font-size:16px; color:${i.type==='in'?'#16a34a':'#dc2626'};">₹${i.amt}</span> 
          <button style="background:#e2e8f0; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;" onclick="editItem('home', ${idx})">✏️</button> 
          <button style="background:#fee2e2; color:#dc2626; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;" onclick="deleteItem('home', ${idx})">🗑️</button>
        </div>
      </div>`
    ).reverse().join('');
  }

  // 3. கொள்ளை
  let kollaiTotal = db.kollai.reduce((acc, item) => acc + item.amt, 0);
  if(document.getElementById('total-kollai')) document.getElementById('total-kollai').innerText = kollaiTotal;
  if(document.getElementById('hist-kollai')) {
    document.getElementById('hist-kollai').innerHTML = db.kollai.map((i, idx) => 
      `<div style="display:flex; justify-content:space-between; align-items:center; padding:12px; margin-bottom:8px; background:#f8fafc; border-radius:10px; border-left:4px solid #dc2626;">
        <span><b>${i.desc}</b><br><small style="color:#64748b;">${i.datetime}</small></span>
        <div>
          <span style="font-weight:bold; margin-right:8px; font-size:16px; color:#dc2626;">₹${i.amt}</span> 
          <button style="background:#e2e8f0; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;" onclick="editItem('kollai', ${idx})">✏️</button> 
          <button style="background:#fee2e2; color:#dc2626; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;" onclick="deleteItem('kollai', ${idx})">🗑️</button>
        </div>
      </div>`
    ).reverse().join('');
  }

  // 4. வட்டி
  renderVatti();

  // 5. நோட்பேட்
  if(document.getElementById('hist-notes')) {
    document.getElementById('hist-notes').innerHTML = db.notes.map((n, idx) => 
      `<div style="display:flex; justify-content:space-between; align-items:center; padding:12px; margin-bottom:8px; background:#f8fafc; border-radius:10px; border-left:4px solid #6366f1;">
        <span><b>${n.text}</b><br><small style="color:#64748b;">${n.datetime}</small></span>
        <button style="background:#fee2e2; color:#dc2626; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;" onclick="deleteItem('notes', ${idx})">🗑️</button>
      </div>`
    ).reverse().join('');
  }
}

function renderVatti() {
  let list = document.getElementById('vattiList') || document.getElementById('hist-vatti');
  if (!list) return;
  list.innerHTML = '';

  if (db.vatti.length === 0) {
    list.innerHTML = '<div style="text-align:center; color:gray; padding:10px;">பதிவுகள் எதுவும் இல்லை</div>';
    return;
  }

  db.vatti.forEach((i, idx) => {
    let calc = calculateInterest(i.amt, i.rate, i.date);
    list.innerHTML += `
      <div style="background:#ffffff; border:1px solid #e2e8f0; padding:16px; border-radius:16px; margin-bottom:14px; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
        <div style="width:100%; display:flex; justify-content:space-between; font-weight:bold; color:#1e293b; font-size:16px;">
          <span>👤 ${i.name}</span>
          <span style="font-size:13px; color:#64748b; background:#f1f5f9; padding:4px 8px; border-radius:6px;">📅 ${i.date || 'N/A'}</span>
        </div>
        <div style="margin-top:10px; font-size:14px; color:#475569; line-height:1.6;">
          • அசல்: <b style="color:#0f172a;">₹${i.amt}</b> | வட்டி: <b style="color:#0f172a;">${i.rate}%</b> (மாத வட்டி ₹${calc.monthlyInterest})<br>
          • கழிந்த காலம்: <b>${calc.totalMonths} மாதம், ${calc.days} நாட்கள்</b><br>
          • சேர்ந்த வட்டி: <b style="color:#d97706;">₹${calc.totalInterest}</b>
        </div>
        <div style="color:#15803d; font-weight:bold; margin-top:10px; font-size:16px; background:#f0fdf4; border:1px solid #bbf7d0; padding:10px; border-radius:10px; text-align:center;">
          💰 மொத்தம் தர வேண்டியது: ₹${calc.grandTotal}
        </div>
        <div style="margin-top:12px; display:flex; gap:8px;">
          <button style="background:#3b82f6; color:white; border:none; padding:8px; border-radius:8px; font-weight:bold; flex:1; cursor:pointer;" onclick="editItem('vatti', ${idx})">✏️ எடிட்</button>
          <button style="background:#ef4444; color:white; border:none; padding:8px; border-radius:8px; font-weight:bold; flex:1; cursor:pointer;" onclick="deleteItem('vatti', ${idx})">🗑️ நீக்கு</button>
          <button style="background:#10b981; color:white; border:none; padding:8px; border-radius:8px; font-weight:bold; flex:1; cursor:pointer;" onclick="downloadPersonPDF('${i.name}')">📄 PDF</button>
        </div>
      </div>`;
  });
}

function addManualVatti() {
  let nameEl = document.getElementById('vName') || document.getElementById('m-vatti-name');
  let amtEl = document.getElementById('vAmt') || document.getElementById('m-vatti-amt');
  let rateEl = document.getElementById('vRate') || document.getElementById('m-vatti-rate');
  let dateEl = document.getElementById('vDate') || document.getElementById('m-vatti-date');

  let name = nameEl ? nameEl.value.trim() : '';
  let amt = amtEl ? parseFloat(amtEl.value) : NaN;
  let rate = rateEl ? parseFloat(rateEl.value) : NaN;
  let dateInput = dateEl ? dateEl.value.trim() : '';

  let todayStr = new Date().toLocaleDateString('en-GB');
  let entryDate = dateInput ? dateInput : todayStr;

  if (!name || isNaN(amt) || isNaN(rate)) {
    alert('தயவுசெய்து நபர் பெயர், அசல் தொகை மற்றும் வட்டி % ஆகியவற்றைச் சரியாக உள்ளிடவும்!');
    return;
  }

  db.vatti.push({ name, amt, rate, date: entryDate, datetime: getDateTime() });
  saveData();

  if (nameEl) nameEl.value = '';
  if (amtEl) amtEl.value = '';
  if (rateEl) rateEl.value = '';
  if (dateEl) dateEl.value = '';

  alert(`சரி பாலாஜி சார்! ${name} வட்டி கணக்கு வெற்றிகரமாகச் சேர்க்கப்பட்டது! 💰`);
}

function addChat(text, isUser) {
  const box = document.getElementById('chatBox');
  if(!box) return;
  const div = document.createElement('div');
  div.className = `msg ${isUser ? 'user' : 'bot'}`;
  div.innerText = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  if (!isUser) speak(text);
}

function sendMsg() {
  const input = document.getElementById('userInput');
  const text = input.value.trim();
  if (!text) return;

  addChat(text, true);
  input.value = '';
  processNLP(text);
}

// AI குரல் பதிவை அலசி ஆராயும்NLP புதுப்பிக்கப்பட்ட லோஜிக்
function processNLP(rawText) {
  const parsedText = parseTamilNumbers(rawText);
  const datetime = getDateTime();

  // 1. வட்டி கணக்கு புதுப்பிப்பு
  if (parsedText.includes('வட்டி') || parsedText.includes('பைசா')) {
    let words = rawText.split(' ');
    let name = words[0] && isNaN(words[0]) ? words[0].replace(/(க்கு|விடம்|இடம்)/g, '') : "நபர்";

    // அசல் தொகை (எ.கா: 300000)
    let amtMatch = parsedText.match(/\d{4,10}/);
    let amt = amtMatch ? parseInt(amtMatch[0]) : null;

    // வட்டி % (எ.கா: 3 பைசா வட்டி -> 3)
    let rateMatch = parsedText.match(/(\d+)\s*(பைசா|வட்டி|%)/);
    let rate = rateMatch ? parseInt(rateMatch[1]) : 3; // Default 3%

    // கடன் தேதி (எ.கா: 2 6 2026 அல்லது 02/06/2026)
    let dateMatch = parsedText.match(/(\d{1,2})\s*[\/\-.\s]\s*(\d{1,2})\s*[\/\-.\s]\s*(\d{2,4})/);
    let todayStr = new Date().toLocaleDateString('en-GB');
    let entryDate = todayStr;

    if (dateMatch) {
      let d = dateMatch[1].padStart(2, '0');
      let m = dateMatch[2].padStart(2, '0');
      let y = dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3];
      entryDate = `${d}/${m}/${y}`;
    }

    if (amt) {
      let existingPersons = db.vatti.filter(v => v.name.toLowerCase() === name.toLowerCase());

      if (existingPersons.length > 0) {
        pendingVatti = { name, amt, rate, date: entryDate, existing: existingPersons };
        addChat(`பாலாஜி சார்! ஏற்கனவே "${name}" பெயரில் கணக்கு உள்ளது. ₹${amt} தொகையை பழைய ${name} கணக்கிலேயே சேர்க்கவா? அல்லது "புதிய நபர்" எனத் தனி கணக்காகப் பதியவா?`, false);
        return;
      } else {
        db.vatti.push({ name, amt, rate, date: entryDate, datetime });
        saveData();
        let calc = calculateInterest(amt, rate, entryDate);
        addChat(`சரி பாலாஜி சார்! ${name} வட்டி கணக்கில் சேர்க்கப்பட்டார்.\n• அசல்: ₹${amt}\n• வட்டி: ${rate}%\n• கடன் தேதி: ${entryDate}\n(${calc.totalMonths} மாதம், ${calc.days} நாட்களுக்கு மொத்தம் தர வேண்டியது: ₹${calc.grandTotal}) 💰`, false);
        return;
      }
    }
  }

  // 2. குறிப்பு எடுப்பது
  const numMatch = parsedText.match(/\d+/);
  if (!numMatch) {
    db.notes.push({ text: rawText, datetime });
    saveData();
    addChat(`நோட்பேடில் குறிப்பு எடுக்கப்பட்டது! 📝`, false);
    return;
  }

  // 3. சம்பளம் / வீட்டு வரவு செலவு
  const amt = parseInt(numMatch[0]);
  const isIncome = /(வந்தது|கொடுத்தார்கள்|அனுப்பினார்கள்|கிடைத்தது|சேர்ந்தது|வரவு)/.test(parsedText);
  const isKollai = parsedText.includes('கொல்லை');

  if (isIncome) {
    if (/(வீடு|வீட்டில்)/.test(parsedText)) {
      db.home.push({ desc: rawText, amt, type: 'in', datetime });
      saveData();
      addChat(`சரி பாலாஜி சார், ₹${amt} வீட்டுக் கணக்கில் வரவாகச் சேர்க்கப்பட்டது! 🏠`, false);
    } else {
      db.salary.push({ desc: rawText, amt, type: 'in', datetime });
      saveData();
      addChat(`சரி பாலாஜி சார், ₹${amt} சம்பளக் கணக்கில் வரவாகச் சேர்க்கப்பட்டது! 💼`, false);
    }
  } else {
    if (isKollai) db.kollai.push({ desc: rawText, amt, datetime });

    if (/(சம்பளம்|சம்பளத்தில்)/.test(parsedText)) {
      db.salary.push({ desc: rawText, amt, type: 'out', datetime });
      saveData();
      addChat(`சரி பாலாஜி சார், ₹${amt} சம்பளக் கணக்கில் செலவாகப் பதிவு செய்யப்பட்டது! 💼`, false);
    } else if (/(வீடு|வீட்டு)/.test(parsedText)) {
      db.home.push({ desc: rawText, amt, type: 'out', datetime });
      saveData();
      addChat(`சரி பாலாஜி சார், ₹${amt} வீட்டுக் கணக்கில் செலவாகப் பதிவு செய்யப்பட்டது! 🏠`, false);
    } else {
      pendingExpense = { desc: rawText, amt, isKollai };
      addChat(`பாலாஜி சார், ₹${amt} செலவை "சம்பளப் பணம்"-இல் கழிக்கவா அல்லது "வீட்டுப் பணம்"-இல் கழிக்கவா?`, false);
    }
  }
}

function clearChat() {
  pendingExpense = null;
  pendingVatti = null;
  if(document.getElementById('chatBox')) {
    document.getElementById('chatBox').innerHTML = '<div class="msg bot">வணக்கம் பாலாஜி சார்! என்ன கணக்கு பதிவு செய்ய வேண்டும்?</div>';
  }
}

function startVoice() {
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Speech) { alert('குரல் பதிவு வசதி இல்லை.'); return; }
  const rec = new Speech();
  rec.lang = 'ta-IN';
  if(document.getElementById('status')) document.getElementById('status').innerText = '🎤 கேட்கிறது... பேசுங்கள்...';
  rec.start();

  rec.onresult = (e) => {
    if(document.getElementById('userInput')) document.getElementById('userInput').value = e.results[0][0].transcript;
    if(document.getElementById('status')) document.getElementById('status').innerText = '🎤 தயார்';
    sendMsg();
  };
}

document.addEventListener('DOMContentLoaded', () => {
  renderData();
});
