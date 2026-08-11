let db = JSON.parse(localStorage.getItem('jokky_db')) || {
  salary: [],
  home: [],
  kollai: [],
  vatti: [],
  notes: []
};

let pendingExpense = null;
let lastAction = null;

function saveData() {
  localStorage.setItem('jokky_db', JSON.stringify(db));
  renderAll();
}

function showSec(secId, btnElement) {
  const sections = document.querySelectorAll('.section');
  sections.forEach(sec => sec.classList.remove('active'));

  const targetSec = document.getElementById(secId);
  if (targetSec) targetSec.classList.add('active');

  const buttons = document.querySelectorAll('.nav-btn');
  buttons.forEach(btn => btn.classList.remove('active'));

  if (btnElement) btnElement.classList.add('active');
}

function getDateTime() {
  const now = new Date();
  return now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function parseTamilNumbers(text) {
  let parsed = text;
  parsed = parsed.replace(/ஆயிரத்து\s*(\d+)/gi, (match, p1) => (1000 + parseInt(p1)).toString());
  parsed = parsed.replace(/இருபதாயிரம்|20 ஆயிரம்/gi, '20000')
                .replace(/பத்தாயிரம்|10 ஆயிரம்/gi, '10000')
                .replace(/ஐம்பதாயிரம்|50 ஆயிரம்/gi, '50000')
                .replace(/ஐயாயிரம்|அஞ்சாயிரம்|5 ஆயிரம்/gi, '5000')
                .replace(/நாலாயிரம்|4 ஆயிரம்/gi, '4000')
                .replace(/மூன்றாயிரம்|3 ஆயிரம்/gi, '3000')
                .replace(/இரண்டாயிரம்|2 ஆயிரம்/gi, '2000')
                .replace(/ஆயிரம்|1 ஆயிரம்/gi, '1000');
  return parsed;
}

function extractAmount(text) {
  let cleanText = text.replace(/,/g, '');
  let matches = cleanText.match(/\d+/g);
  if (!matches) return null;
  let numbers = matches.map(Number);
  return Math.max(...numbers);
}

function addChat(msg, isUser = false) {
  const chatBox = document.getElementById('chatBox');
  if (!chatBox) return;
  const div = document.createElement('div');
  div.className = `msg ${isUser ? 'user' : 'bot'}`;
  div.innerText = msg;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function sendMsg() {
  const input = document.getElementById('userInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  addChat(text, true);
  input.value = '';
  processNLP(text);
}

function clearChat() {
  const chatBox = document.getElementById('chatBox');
  if (chatBox) {
    chatBox.innerHTML = '<div class="msg bot">வணக்கம் பாலாஜி சார்! என்ன கணக்கு பதிவு செய்ய வேண்டும்?</div>';
  }
}

function deleteLastEntry() {
  if (!lastAction || !lastAction.records || lastAction.records.length === 0) {
    addChat("பாலாஜி சார், நீக்குவதற்கு முந்தைய பதிவுகள் எதுவும் இல்லை!", false);
    return;
  }

  lastAction.records.forEach(rec => {
    if (db[rec.cat] && db[rec.cat].length > rec.index) {
      db[rec.cat].splice(rec.index, 1);
    }
  });

  saveData();
  addChat(`கடைசியாகப் பதிவு செய்த "${lastAction.desc}" கணக்கு நீக்கப்பட்டது! 🗑️`, false);
  lastAction = null;
}

function startVoice() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert("குரல் பதிவு வசதி உங்கள் உலாவியில் இல்லை.");
    return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'ta-IN';
  
  const status = document.getElementById('status');
  if (status) status.innerText = "🎤 கேட்கிறது... பேசுங்கள்...";

  recognition.onresult = function(event) {
    const text = event.results[0][0].transcript;
    const input = document.getElementById('userInput');
    if (input) input.value = text;
    if (status) status.innerText = "🎤 தயார் (தேவைப்பட்டால் திருத்தி 'அனுப்பு' அழுத்தவும்)";
  };

  recognition.onerror = function() {
    if (status) status.innerText = "🎤 தயார் (பிழை)";
  };

  recognition.start();
}

function processNLP(rawText) {
  if (/^(நீக்கு|முந்தைய பதிவை நீக்கு|கடைசி பதிவை நீக்கு|அழி)$/i.test(rawText.trim())) {
    deleteLastEntry();
    return;
  }

  const parsedText = parseTamilNumbers(rawText);
  const datetime = getDateTime();

  const isKollai = /(கொல்லை|கொல்லைக்கு|கொல்லைல|கொல்லையில்|கொல்லையில|கொல்லையிலிருந்து)/i.test(parsedText);
  const isSalary = /(சம்பளம்|சம்பளத்தில்|சம்பள பணத்தில்|சம்பளப் பணத்தில்|சம்பள பணத்துல|சம்பள குளத்தில்|சம்பளக் குளத்தில்)/i.test(parsedText);
  const isHome = /(வீடு|வீட்டில்|வீட்டு|வீட்டு பணத்தில்|வீட்டுப் பணத்தில்|வீட்டு பணத்துல|வீட்டுல)/i.test(parsedText);

  // 1. கேள்விக் கேட்டு பதில் வரும் நிலை
  if (pendingExpense) {
    let affectedRecords = [];
    if (isSalary || parsedText === '1' || /(சம்பளம்|சம்பளத்தில்|சம்பளப் பணம்)/i.test(parsedText)) {
      db.salary.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, type: 'out', datetime });
      affectedRecords.push({ cat: 'salary', index: db.salary.length - 1 });

      if (pendingExpense.isKollai) {
        db.kollai.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, datetime });
        affectedRecords.push({ cat: 'kollai', index: db.kollai.length - 1 });
      }

      lastAction = { desc: pendingExpense.desc, records: affectedRecords };
      addChat(`சரி பாலாஜி சார், ₹${pendingExpense.amt} சம்பளக் கணக்கில் மைனஸ் செய்யப்பட்டது! 💼`, false);
      pendingExpense = null;
      saveData();
      return;
    } else if (isHome || parsedText === '2' || /(வீடு|வீட்டுப் பணம்|வீட்டுல)/i.test(parsedText)) {
      db.home.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, type: 'out', datetime });
      affectedRecords.push({ cat: 'home', index: db.home.length - 1 });

      if (pendingExpense.isKollai) {
        db.kollai.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, datetime });
        affectedRecords.push({ cat: 'kollai', index: db.kollai.length - 1 });
      }

      lastAction = { desc: pendingExpense.desc, records: affectedRecords };
      addChat(`சரி பாலாஜி சார், ₹${pendingExpense.amt} வீட்டுக் கணக்கில் மைனஸ் செய்யப்பட்டது! 🏠`, false);
      pendingExpense = null;
      saveData();
      return;
    }
  }

  // 2. தொகை கண்டறிதல்
  let amt = extractAmount(parsedText);
  if (!amt) {
    db.notes.push({ text: rawText, datetime });
    lastAction = { desc: rawText, records: [{ cat: 'notes', index: db.notes.length - 1 }] };
    saveData();
    addChat(`நோட்பேடில் குறிப்பு எடுக்கப்பட்டது! 📝`, false);
    return;
  }

  // 3. கொல்லை + சம்பளம்/வீடு ஒன்றாகப் பேசப்பட்டால்
  let records = [];
  if (isKollai) {
    if (isSalary) {
      db.kollai.push({ desc: rawText, amt, datetime });
      records.push({ cat: 'kollai', index: db.kollai.length - 1 });
      db.salary.push({ desc: rawText, amt, type: 'out', datetime });
      records.push({ cat: 'salary', index: db.salary.length - 1 });
      addChat(`சரி பாலாஜி சார், ₹${amt} கொல்லைச் செலவாகப் பதிவாகி, சம்பளக் கணக்கில் மைனஸ் செய்யப்பட்டது! 💼🌱`, false);
      lastAction = { desc: rawText, records };
      saveData();
      return;
    } else if (isHome) {
      db.kollai.push({ desc: rawText, amt, datetime });
      records.push({ cat: 'kollai', index: db.kollai.length - 1 });
      db.home.push({ desc: rawText, amt, type: 'out', datetime });
      records.push({ cat: 'home', index: db.home.length - 1 });
      addChat(`சரி பாலாஜி சார், ₹${amt} கொல்லைச் செலவாகப் பதிவாகி, வீட்டுக் கணக்கில் மைனஸ் செய்யப்பட்டது! 🏠🌱`, false);
      lastAction = { desc: rawText, records };
      saveData();
      return;
    } else {
      // எதிலிருந்து கழிக்க வேண்டும் என்று கேட்கும் முன் எதிலும் பதியாது
      pendingExpense = { desc: rawText, amt, isKollai: true };
      addChat(`பாலாஜி சார், ₹${amt} கொல்லைச் செலவை "சம்பளப் பணம்"-இல் கழிக்கவா அல்லது "வீட்டுப் பணம்"-இல் கழிக்கவா?`, false);
      return;
    }
  }

  // 4. சாதாரண சம்பளம் / வீட்டு கணக்கு
  if (isHome) {
    db.home.push({ desc: rawText, amt, type: 'out', datetime });
    records.push({ cat: 'home', index: db.home.length - 1 });
    addChat(`சரி பாலாஜி சார், ₹${amt} வீட்டுக் கணக்கில் செலவாகப் பதிவு செய்யப்பட்டது! 🏠`, false);
  } else if (isSalary) {
    db.salary.push({ desc: rawText, amt, type: 'out', datetime });
    records.push({ cat: 'salary', index: db.salary.length - 1 });
    addChat(`சரி பாலாஜி சார், ₹${amt} சம்பளக் கணக்கில் செலவாகப் பதிவு செய்யப்பட்டது! 💼`, false);
  } else {
    pendingExpense = { desc: rawText, amt, isKollai: false };
    addChat(`பாலாஜி சார், ₹${amt} செலவை "சம்பளப் பணம்"-இல் கழிக்கவா அல்லது "வீட்டுப் பணம்"-இல் கழிக்கவா?`, false);
    return;
  }

  lastAction = { desc: rawText, records };
  saveData();
}

function deleteItem(cat, index) {
  db[cat].splice(index, 1);
  saveData();
}

function editItem(cat, index) {
  let item = db[cat][index];
  let currentText = cat === 'vatti' ? item.name : (cat === 'notes' ? item.text : item.desc);
  let currentAmt = item.amt || 0;

  let newText = prompt("விவரத்தை மாற்றவும்:", currentText);
  if (newText === null) return;

  if (cat === 'vatti') {
    item.name = newText;
    let newAmt = prompt("அசல் தொகையை மாற்றவும்:", currentAmt);
    if (newAmt !== null) item.amt = Number(newAmt);
  } else if (cat === 'notes') {
    item.text = newText;
  } else {
    item.desc = newText;
    let newAmt = prompt("தொகையை மாற்றவும்:", currentAmt);
    if (newAmt !== null) item.amt = Number(newAmt);
  }

  saveData();
}

function calculateInterest(amt, rate, dateStr) {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return { months: 0, days: 0, interest: 0, total: amt };

  const startDate = new Date(parts[2], parts[1] - 1, parts[0]);
  const today = new Date();
  const diffTime = Math.abs(today - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const months = Math.floor(diffDays / 30);
  const days = diffDays % 30;
  const monthlyInterest = (amt * rate) / 100;
  const dailyInterest = monthlyInterest / 30;
  const totalInterest = Math.round((months * monthlyInterest) + (days * dailyInterest));

  return { months, days, interest: totalInterest, total: amt + totalInterest };
}

function renderAll() {
  let balSal = 0, htmlSal = '';
  db.salary.forEach((item, i) => {
    if (item.type === 'in') balSal += item.amt;
    else balSal -= item.amt;
    htmlSal += `<div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:14px; background:#fff; padding:6px; border-radius:6px;">
      <span>${item.desc} <small style="color:gray;">(${item.datetime})</small></span>
      <span style="color:${item.type==='in'?'green':'red'}; font-weight:bold;">
        ${item.type==='in'?'+':'-'}₹${item.amt} 
        <button onclick="editItem('salary',${i})" style="border:none; background:none; cursor:pointer;">✏️</button>
        <button onclick="deleteItem('salary',${i})" style="border:none; background:none; color:gray; cursor:pointer;">❌</button>
      </span>
    </div>`;
  });
  if (document.getElementById('bal-salary')) document.getElementById('bal-salary').innerText = balSal;
  if (document.getElementById('hist-salary')) document.getElementById('hist-salary').innerHTML = htmlSal;

  let balHome = 0, htmlHome = '';
  db.home.forEach((item, i) => {
    if (item.type === 'in') balHome += item.amt;
    else balHome -= item.amt;
    htmlHome += `<div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:14px; background:#fff; padding:6px; border-radius:6px;">
      <span>${item.desc} <small style="color:gray;">(${item.datetime})</small></span>
      <span style="color:${item.type==='in'?'green':'red'}; font-weight:bold;">
        ${item.type==='in'?'+':'-'}₹${item.amt} 
        <button onclick="editItem('home',${i})" style="border:none; background:none; cursor:pointer;">✏️</button>
        <button onclick="deleteItem('home',${i})" style="border:none; background:none; color:gray; cursor:pointer;">❌</button>
      </span>
    </div>`;
  });
  if (document.getElementById('bal-home')) document.getElementById('bal-home').innerText = balHome;
  if (document.getElementById('hist-home')) document.getElementById('hist-home').innerHTML = htmlHome;

  let totalKollai = 0, htmlKollai = '';
  db.kollai.forEach((item, i) => {
    totalKollai += item.amt;
    htmlKollai += `<div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:14px; background:#fff; padding:6px; border-radius:6px;">
      <span>${item.desc} <small style="color:gray;">(${item.datetime})</small></span>
      <span style="color:red; font-weight:bold;">
        -₹${item.amt} 
        <button onclick="editItem('kollai',${i})" style="border:none; background:none; cursor:pointer;">✏️</button>
        <button onclick="deleteItem('kollai',${i})" style="border:none; background:none; color:gray; cursor:pointer;">❌</button>
      </span>
    </div>`;
  });
  if (document.getElementById('total-kollai')) document.getElementById('total-kollai').innerText = totalKollai;
  if (document.getElementById('hist-kollai')) document.getElementById('hist-kollai').innerHTML = htmlKollai;

  let htmlVatti = '';
  db.vatti.forEach((item, i) => {
    let calc = calculateInterest(item.amt, item.rate, item.date);
    htmlVatti += `<div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:10px; margin-bottom:8px;">
      <div style="font-weight:bold; display:flex; justify-content:space-between;">
        <span>${item.name}</span>
        <div>
          <button onclick="editItem('vatti',${i})" style="border:none; background:none; cursor:pointer;">✏️</button>
          <button onclick="deleteItem('vatti',${i})" style="border:none; background:none; color:gray; cursor:pointer;">❌</button>
        </div>
      </div>
      <div style="font-size:13px; color:#475569; margin-top:4px;">
        அசல்: ₹${item.amt} | வட்டி: ${item.rate}% | தேதி: ${item.date}<br>
        காலம்: ${calc.months} மாதம், ${calc.days} நாள் | வட்டி: ₹${calc.interest}
      </div>
      <div style="font-weight:bold; color:#15803d; margin-top:4px; font-size:14px;">
        மொத்தம்: ₹${calc.total}
      </div>
    </div>`;
  });
  if (document.getElementById('vattiList')) document.getElementById('vattiList').innerHTML = htmlVatti;

  let htmlNotes = '';
  db.notes.forEach((item, i) => {
    htmlNotes += `<div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:14px; background:#f8fafc; padding:8px; border-radius:8px;">
      <span>${item.text} <small style="color:gray;">(${item.datetime})</small></span>
      <div>
        <button onclick="editItem('notes',${i})" style="border:none; background:none; cursor:pointer;">✏️</button>
        <button onclick="deleteItem('notes',${i})" style="border:none; background:none; color:gray; cursor:pointer;">❌</button>
      </div>
    </div>`;
  });
  if (document.getElementById('hist-notes')) document.getElementById('hist-notes').innerHTML = htmlNotes;
}

window.onload = function() {
  renderAll();
};
