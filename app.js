let db = JSON.parse(localStorage.getItem('jokky_db')) || {
  salary: [],
  home: [],
  kollai: [],
  vatti: [],
  notes: []
};

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

// மேனுவல் பதிவுகள்
function addManual(type, inOut) {
  const descInput = document.getElementById(type === 'salary' ? 'salDesc' : 'homeDesc');
  const amtInput = document.getElementById(type === 'salary' ? 'salAmt' : 'homeAmt');

  const desc = descInput.value.trim();
  const amt = Number(amtInput.value);

  if (!desc || !amt) {
    alert("தயவுசெய்து விவரம் மற்றும் தொகையை உள்ளிடவும்!");
    return;
  }

  db[type].push({ desc, amt, type: inOut, datetime: getDateTime() });
  saveData();

  descInput.value = '';
  amtInput.value = '';
}

function addManualKollai() {
  const descInput = document.getElementById('kollaiDesc');
  const amtInput = document.getElementById('kollaiAmt');

  const desc = descInput.value.trim();
  const amt = Number(amtInput.value);

  if (!desc || !amt) {
    alert("தயவுசெய்து விவரம் மற்றும் தொகையை உள்ளிடவும்!");
    return;
  }

  db.kollai.push({ desc, amt, datetime: getDateTime() });
  saveData();

  descInput.value = '';
  amtInput.value = '';
}

function addManualVatti() {
  const name = document.getElementById('vattiName').value.trim();
  const amt = Number(document.getElementById('vattiAmt').value);
  const rate = Number(document.getElementById('vattiRate').value) || 2;
  const dateInput = document.getElementById('vattiDate').value;

  if (!name || !amt) {
    alert("தயவுசெய்து பெயர் மற்றும் தொகையை உள்ளிடவும்!");
    return;
  }

  let formattedDate = new Date().toLocaleDateString('en-GB');
  if (dateInput) {
    const parts = dateInput.split('-');
    formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  db.vatti.push({ name, amt, rate, date: formattedDate });
  saveData();

  document.getElementById('vattiName').value = '';
  document.getElementById('vattiAmt').value = '';
  document.getElementById('vattiRate').value = '';
  document.getElementById('vattiDate').value = '';
}

function addManualNote() {
  const noteInput = document.getElementById('noteText');
  const text = noteInput.value.trim();

  if (!text) {
    alert("தயவுசெய்து குறிப்பை டைப் செய்யவும்!");
    return;
  }

  db.notes.push({ text, datetime: getDateTime() });
  saveData();
  noteInput.value = '';
}

// தமிழ் வார்த்தைகளை துல்லியமாக எண்களாக மாற்றும் வசதி
function parseTamilNumbers(text) {
  let str = text.toLowerCase();
  
  //複合 எண்கள் (Compound numbers)
  str = str.replace(/ஒரு லட்ச|ஒரு லட்சம்|1 லட்சம்/gi, '100000');
  str = str.replace(/ஐம்பதாயிரம்|50 ஆயிரம்/gi, '50000');
  str = str.replace(/நாற்பதாயிரம்|40 ஆயிரம்/gi, '40000');
  str = str.replace(/முப்பத்தாயிரம்|30 ஆயிரம்/gi, '30000');
  str = str.replace(/இருபத்தைந்தாயிரம்|25 ஆயிரம்/gi, '25000');
  str = str.replace(/இருபதாயிரம்|20 ஆயிரம்/gi, '20000');
  str = str.replace(/பதினைந்தாயிரம்|15 ஆயிரம்/gi, '15000');
  str = str.replace(/பத்தாயிரம்|10 ஆயிரம்/gi, '10000');
  str = str.replace(/ஐயாயிரம்|5 ஆயிரம்/gi, '5000');
  str = str.replace(/நாலாயிரம்|4 ஆயிரம்/gi, '4000');
  str = str.replace(/மூன்றாயிரம்|3 ஆயிரம்/gi, '3000');
  str = str.replace(/இரண்டாயிரம்|2 ஆயிரம்/gi, '2000');
  str = str.replace(/ஆயிரம்|1 ஆயிரம்/gi, '1000');
  
  return str;
}

function extractAmount(text) {
  let parsed = parseTamilNumbers(text);
  let matches = parsed.match(/\d+/g);
  if (!matches) return null;
  return Math.max(...matches.map(Number));
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
  if (chatBox) chatBox.innerHTML = '<div class="msg bot">வணக்கம் பாலாஜி சார்! என்ன கணக்கு பதிவு செய்ய வேண்டும்?</div>';
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
    if (input) {
      input.value = text;
      setTimeout(() => {
        sendMsg();
        if (status) status.innerText = "🎤 தயார்";
      }, 400);
    }
  };
  recognition.start();
}

function processNLP(rawText) {
  const datetime = getDateTime();
  const amt = extractAmount(rawText);

  // 1. வட்டிக் கணக்கு
  if (/வட்டி|வட்டிக்கு/i.test(rawText)) {
    let rate = 2;
    if (rawText.includes('மூணு') || rawText.includes('3')) rate = 3;
    else if (rawText.includes('ஒன்னு') || rawText.includes('1')) rate = 1;

    let name = rawText.replace(/வாங்கி இருக்கான்|வாங்கியிருக்கான்|வட்டிக்கு/gi, '').trim();
    db.vatti.push({ name: name || rawText, amt: amt || 0, rate, date: new Date().toLocaleDateString('en-GB') });
    saveData();
    addChat(`சரி பாலாஜி சார், வட்டிக் கணக்கில் சேர்க்கப்பட்டது! 🪙`, false);
    return;
  }

  const isKollai = /(கொல்லை)/i.test(rawText);
  const isSalary = /(சம்பளம்|சம்பள)/i.test(rawText);
  const isHome = /(வீடு|வீட்டு|வீட்டுப்)/i.test(rawText);
  const isIncome = /(வந்தது|வரவு|வந்தது)/i.test(rawText);

  if (!amt) {
    db.notes.push({ text: rawText, datetime });
    saveData();
    addChat(`குறிப்பில் சேர்க்கப்பட்டது! 📝`, false);
    return;
  }

  // 2. வரவு கணக்கு (வீடு அல்லது சம்பளம் சரியாகப் பிரித்தல்)
  if (isIncome) {
    if (isHome) {
      db.home.push({ desc: rawText, amt, type: 'in', datetime });
      addChat(`சரி பாலாஜி சார், வீட்டுக் கணக்கில் ₹${amt} வரவாகச் சேர்க்கப்பட்டது! 🏠`, false);
    } else {
      db.salary.push({ desc: rawText, amt, type: 'in', datetime });
      addChat(`சரி பாலாஜி சார், சம்பளக் கணக்கில் ₹${amt} வரவாகச் சேர்க்கப்பட்டது! 💼`, false);
    }
    saveData();
    return;
  }

  // 3. செலவு கணக்கு
  if (isKollai) {
    db.kollai.push({ desc: rawText, amt, datetime });
    if (isHome) db.home.push({ desc: rawText, amt, type: 'out', datetime });
    else db.salary.push({ desc: rawText, amt, type: 'out', datetime });
    addChat(`சரி பாலாஜி சார், ₹${amt} கொல்லை செலவாகப் பதிவு செய்யப்பட்டது!`, false);
  } else if (isHome) {
    db.home.push({ desc: rawText, amt, type: 'out', datetime });
    addChat(`சரி பாலாஜி சார், ₹${amt} வீட்டுக் கணக்கில் கழிக்கப்பட்டது! 🏠`, false);
  } else {
    db.salary.push({ desc: rawText, amt, type: 'out', datetime });
    addChat(`சரி பாலாஜி சார், ₹${amt} சம்பளக் கணக்கில் கழிக்கப்பட்டது! 💼`, false);
  }
  saveData();
}

function deleteItem(cat, index) {
  db[cat].splice(index, 1);
  saveData();
}

function editItem(cat, index) {
  let item = db[cat][index];
  let currentText = cat === 'vatti' ? item.name : (cat === 'notes' ? item.text : item.desc);
  let newText = prompt("மாற்றவும்:", currentText);
  if (newText !== null) {
    if (cat === 'vatti') item.name = newText;
    else if (cat === 'notes') item.text = newText;
    else item.desc = newText;
    saveData();
  }
}

function calculateInterest(amt, rate, dateStr) {
  if (!dateStr) return { months: 0, days: 0, interest: 0, total: amt };
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
    if (item.type === 'in') balSal += item.amt; else balSal -= item.amt;
    htmlSal += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; background:#fff; padding:10px; border-radius:8px; border:1px solid #e5e7eb;">
      <span>${item.desc} <br><small style="color:gray;">(${item.datetime})</small></span>
      <span style="color:${item.type==='in'?'#16a34a':'#dc2626'}; font-weight:bold;">
        ${item.type==='in'?'+':'-'}₹${item.amt}
        <button onclick="editItem('salary',${i})" style="border:none; background:none;">✏️</button>
        <button onclick="deleteItem('salary',${i})" style="border:none; background:none;">❌</button>
      </span>
    </div>`;
  });
  if (document.getElementById('bal-salary')) document.getElementById('bal-salary').innerText = balSal;
  if (document.getElementById('hist-salary')) document.getElementById('hist-salary').innerHTML = htmlSal;

  let balHome = 0, htmlHome = '';
  db.home.forEach((item, i) => {
    if (item.type === 'in') balHome += item.amt; else balHome -= item.amt;
    htmlHome += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; background:#fff; padding:10px; border-radius:8px; border:1px solid #e5e7eb;">
      <span>${item.desc} <br><small style="color:gray;">(${item.datetime})</small></span>
      <span style="color:${item.type==='in'?'#16a34a':'#dc2626'}; font-weight:bold;">
        ${item.type==='in'?'+':'-'}₹${item.amt}
        <button onclick="editItem('home',${i})" style="border:none; background:none;">✏️</button>
        <button onclick="deleteItem('home',${i})" style="border:none; background:none;">❌</button>
      </span>
    </div>`;
  });
  if (document.getElementById('bal-home')) document.getElementById('bal-home').innerText = balHome;
  if (document.getElementById('hist-home')) document.getElementById('hist-home').innerHTML = htmlHome;

  let totalKollai = 0, htmlKollai = '';
  db.kollai.forEach((item, i) => {
    totalKollai += item.amt;
    htmlKollai += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; background:#fff; padding:10px; border-radius:8px; border:1px solid #e5e7eb;">
      <span>${item.desc} <br><small style="color:gray;">(${item.datetime})</small></span>
      <span style="color:#dc2626; font-weight:bold;">-₹${item.amt} 
        <button onclick="editItem('kollai',${i})" style="border:none; background:none;">✏️</button>
        <button onclick="deleteItem('kollai',${i})" style="border:none; background:none;">❌</button>
      </span>
    </div>`;
  });
  if (document.getElementById('total-kollai')) document.getElementById('total-kollai').innerText = totalKollai;
  if (document.getElementById('hist-kollai')) document.getElementById('hist-kollai').innerHTML = htmlKollai;

  let htmlVatti = '';
  db.vatti.forEach((item, i) => {
    let calc = calculateInterest(item.amt, item.rate, item.date);
    htmlVatti += `<div style="background:#fff; border:1px solid #e5e7eb; padding:12px; border-radius:10px; margin-bottom:8px;">
      <div style="font-weight:bold; display:flex; justify-content:space-between;">
        <span>${item.name}</span>
        <div>
          <button onclick="editItem('vatti',${i})" style="border:none; background:none;">✏️</button>
          <button onclick="deleteItem('vatti',${i})" style="border:none; background:none;">❌</button>
        </div>
      </div>
      <div style="font-size:13px; color:#4b5563; margin-top:4px;">
        அசல்: ₹${item.amt} | வட்டி: ${item.rate}% | தேதி: ${item.date}<br>
        காலம்: ${calc.months} மாதம், ${calc.days} நாள் | வட்டி: ₹${calc.interest}
      </div>
      <div style="font-weight:bold; color:#16a34a; margin-top:4px;">மொத்தம்: ₹${calc.total}</div>
    </div>`;
  });
  if (document.getElementById('vattiList')) document.getElementById('vattiList').innerHTML = htmlVatti;

  let htmlNotes = '';
  db.notes.forEach((item, i) => {
    htmlNotes += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; background:#fff; padding:10px; border-radius:8px; border:1px solid #e5e7eb;">
      <span>${item.text} <br><small style="color:gray;">(${item.datetime})</small></span>
      <div>
        <button onclick="editItem('notes',${i})" style="border:none; background:none;">✏️</button>
        <button onclick="deleteItem('notes',${i})" style="border:none; background:none;">❌</button>
      </div>
    </div>`;
  });
  if (document.getElementById('hist-notes')) document.getElementById('hist-notes').innerHTML = htmlNotes;
}

window.onload = function() {
  renderAll();
};
