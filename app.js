// தரவுத்தளம் (LocalStorage) Initialization
let db = JSON.parse(localStorage.getItem('jokky_db')) || {
  salary: [],
  home: [],
  kollai: [],
  vatti: [],
  notes: []
};

let pendingExpense = null;

// தரவைச் சேமிக்க
function saveData() {
  localStorage.setItem('jokky_db', JSON.stringify(db));
  renderAll();
}

// திரைகளை மாற்றுவதற்கான Function (Fix)
function showSec(secId, btnElement) {
  const sections = document.querySelectorAll('.section');
  sections.forEach(sec => sec.classList.remove('active'));

  const targetSec = document.getElementById(secId);
  if (targetSec) {
    targetSec.classList.add('active');
  }

  const buttons = document.querySelectorAll('.nav-btn');
  buttons.forEach(btn => btn.classList.remove('active'));

  if (btnElement) {
    btnElement.classList.add('active');
  }
}

// தேதியும் நேரமும் பெற
function getDateTime() {
  const now = new Date();
  return now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// தமிழ் எண்களை ஆங்கில எண்களாக மாற்ற
function parseTamilNumbers(text) {
  const tamilNums = { 'ஒன்று': 1, 'இரண்டு': 2, 'மூன்று': 3, 'நான்கு': 4, 'ஐந்து': 5, 'ஆறு': 6, 'ஏழு': 7, 'எட்டு': 8, 'ஒன்பது': 9, 'பத்து': 10, 'ஆயிரம்': 1000, 'ஐந்தாயிரம்': 5000, 'பத்தாயிரம்': 10000 };
  let parsed = text;
  for (let key in tamilNums) {
    parsed = parsed.replace(new RegExp(key, 'g'), tamilNums[key]);
  }
  return parsed;
}

// சாட்டில் மெசேஜ் சேர்க்க
function addChat(msg, isUser = false) {
  const chatBox = document.getElementById('chatBox');
  const div = document.createElement('div');
  div.className = `msg ${isUser ? 'user' : 'bot'}`;
  div.innerText = msg;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// அனுப்பு பட்டன்
function sendMsg() {
  const input = document.getElementById('userInput');
  const text = input.value.trim();
  if (!text) return;

  addChat(text, true);
  input.value = '';
  processNLP(text);
}

// சாட் நீக்க
function clearChat() {
  document.getElementById('chatBox').innerHTML = '<div class="msg bot">வணக்கம் பாலாஜி சார்! என்ன கணக்கு பதிவு செய்ய வேண்டும்?</div>';
}

// குரல் பதிவு (Voice Search)
function startVoice() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert("உங்கள் உலாவியில் குரல் பதிவு வசதி இல்லை.");
    return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'ta-IN';
  
  const status = document.getElementById('status');
  status.innerText = "🎤 கேட்கிறது... பேசுங்கள்...";

  recognition.onresult = function(event) {
    const text = event.results[0][0].transcript;
    document.getElementById('userInput').value = text;
    status.innerText = "🎤 தயார்";
    sendMsg();
  };

  recognition.onerror = function() {
    status.innerText = "🎤 தயார் (பிழை ஏற்பட்டது)";
  };

  recognition.start();
}

// AI NLP பகுப்பாய்வு (NLP Logic Fixes)
function processNLP(rawText) {
  const parsedText = parseTamilNumbers(rawText);
  const datetime = getDateTime();

  // நிலுவையில் உள்ள செலவுத் தேர்வு (Pending Selection)
  if (pendingExpense) {
    if (/(சம்பளம்|சம்பளத்தில்|1)/.test(parsedText)) {
      db.salary.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, type: 'out', datetime });
      addChat(`சரி பாலாஜி சார், ₹${pendingExpense.amt} சம்பளக் கணக்கில் செலவாகச் சேர்க்கப்பட்டது! 💼`, false);
      pendingExpense = null;
      saveData();
      return;
    } else if (/(வீடு|வீட்டில்|2)/.test(parsedText)) {
      db.home.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, type: 'out', datetime });
      addChat(`சரி பாலாஜி சார், ₹${pendingExpense.amt} வீட்டுக் கணக்கில் செலவாகச் சேர்க்கப்பட்டது! 🏠`, false);
      pendingExpense = null;
      saveData();
      return;
    }
  }

  // 1. கேள்விகள் மற்றும் பட்டியல்கள் (Questions & List Requests)
  if (/(காட்டு|பட்டியல்|யாரெல்லாம்|எவ்வளவு|யாருக்கெல்லாம்)/.test(parsedText) && parsedText.includes('வட்டி')) {
    if (db.vatti.length === 0) {
      addChat(`பாலாஜி சார், வட்டி கணக்கில் பதிவுகள் எதுவும் இல்லை.`, false);
    } else {
      let listStr = db.vatti.map(v => `• ${v.name}: ₹${v.amt} (${v.rate}%)`).join('\n');
      addChat(`பாலாஜி சார்! வட்டிக்குக் கொடுத்தவர்கள் பட்டியல்:\n${listStr}`, false);
    }
    return;
  }

  // 2. வட்டி கணக்குகள் (Vatti Entry Fix)
  if (parsedText.includes('வட்டி') || parsedText.includes('பைசா')) {
    let amtMatch = parsedText.match(/\d+/g);
    let amt = null;
    if (amtMatch) {
      // பெரிய தொகையை அசலாக எடுக்க
      amt = Math.max(...amtMatch.map(Number));
    }

    // பெயரைக் கண்டறிதல்
    let name = "நபர்";
    let words = rawText.split(' ');
    for (let w of words) {
      if (!/(மூணு|ஒரு|இரண்டு|வட்டி|பைசா|பணம்|கொடுத்து|இருக்கேன்|சேகருக்கு|க்கு)/.test(w) && w.length > 2) {
        name = w;
        break;
      } else if (w.includes('க்கு')) {
        name = w.replace('க்கு', '');
        break;
      }
    }

    let rateMatch = parsedText.match(/(\d+)\s*(பைசா|வட்டி|%)/);
    let rate = rateMatch ? parseInt(rateMatch[1]) : 3;
    let todayStr = new Date().toLocaleDateString('en-GB');

    if (amt && amt >= 100) {
      db.vatti.push({ name, amt, rate, date: todayStr, datetime });
      saveData();
      addChat(`சரி பாலாஜி சார்! ${name} வட்டி கணக்கில் சேர்க்கப்பட்டார்.\n• அசல்: ₹${amt}\n• வட்டி: ${rate}%\n• கடன் தேதி: ${todayStr}`, false);
      return;
    }
  }

  // 3. கொள்ளை செலவு
  if (parsedText.includes('கொள்ளை')) {
    let amtMatch = parsedText.match(/\d+/);
    if (amtMatch) {
      let amt = parseInt(amtMatch[0]);
      db.kollai.push({ desc: rawText, amt, datetime });
      saveData();
      addChat(`சரி பாலாஜி சார், ₹${amt} கொள்ளை செலவுக் கணக்கில் சேர்க்கப்பட்டது! 🌱`, false);
      return;
    }
  }

  // எண்கள் இல்லை என்றால் நோட்பேட்
  const numMatch = parsedText.match(/\d+/);
  if (!numMatch) {
    db.notes.push({ text: rawText, datetime });
    saveData();
    addChat(`நோட்பேடில் குறிப்பு எடுக்கப்பட்டது! 📝`, false);
    return;
  }

  const amt = parseInt(numMatch[0]);
  const isIncome = /(வந்தது|வந்திருக்கு|கொடுத்தாங்க|கிடைத்தது|சேர்ந்தது|வரவு)/.test(parsedText);

  // 4. வரவு கணக்குகள் (Income Logic Fix)
  if (isIncome) {
    if (/(வீடு|வீட்டில்|வீட்டு)/.test(parsedText)) {
      db.home.push({ desc: rawText, amt, type: 'in', datetime });
      saveData();
      addChat(`சரி பாலாஜி சார், ₹${amt} வீட்டுக் கணக்கில் வரவாகச் சேர்க்கப்பட்டது! 🏠`, false);
    } else {
      db.salary.push({ desc: rawText, amt, type: 'in', datetime });
      saveData();
      addChat(`சரி பாலாஜி சார், ₹${amt} சம்பளக் கணக்கில் வரவாகச் சேர்க்கப்பட்டது! 💼`, false);
    }
  } 
  // 5. செலவு கணக்குகள் (Expense Logic)
  else {
    if (/(சம்பளம்|சம்பளத்தில்)/.test(parsedText)) {
      db.salary.push({ desc: rawText, amt, type: 'out', datetime });
      saveData();
      addChat(`சரி பாலாஜி சார், ₹${amt} சம்பளக் கணக்கில் செலவாகப் பதிவு செய்யப்பட்டது! 💼`, false);
    } else if (/(வீடு|வீட்டு)/.test(parsedText)) {
      db.home.push({ desc: rawText, amt, type: 'out', datetime });
      saveData();
      addChat(`சரி பாலாஜி சார், ₹${amt} வீட்டுக் கணக்கில் செலவாகப் பதிவு செய்யப்பட்டது! 🏠`, false);
    } else {
      pendingExpense = { desc: rawText, amt };
      addChat(`பாலாஜி சார், ₹${amt} செலவை "சம்பளப் பணம்"-இல் கழிக்கவா அல்லது "வீட்டுப் பணம்"-இல் கழிக்கவா?`, false);
    }
  }
}

// மேனுவல் சேர்ப்பு மற்றும் கணக்கீடுகள் (Manual Functions)
function addManual(cat, type) {
  const desc = document.getElementById(`m-${cat}-desc`).value.trim();
  const amt = parseFloat(document.getElementById(`m-${cat}-amt`).value);
  if (!desc || isNaN(amt)) return alert('தயவுசெய்து விவரம் மற்றும் தொகையை உள்ளிடவும்');

  db[cat].push({ desc, amt, type, datetime: getDateTime() });
  document.getElementById(`m-${cat}-desc`).value = '';
  document.getElementById(`m-${cat}-amt`).value = '';
  saveData();
}

function addManualKollai() {
  const desc = document.getElementById('m-kollai-desc').value.trim();
  const amt = parseFloat(document.getElementById('m-kollai-amt').value);
  if (!desc || isNaN(amt)) return alert('தயவுசெய்து விவரம் மற்றும் தொகையை உள்ளிடவும்');

  db.kollai.push({ desc, amt, datetime: getDateTime() });
  document.getElementById('m-kollai-desc').value = '';
  document.getElementById('m-kollai-amt').value = '';
  saveData();
}

function addManualVatti() {
  const name = document.getElementById('vName').value.trim();
  const amt = parseFloat(document.getElementById('vAmt').value);
  const rate = parseFloat(document.getElementById('vRate').value) || 3;
  const date = document.getElementById('vDate').value.trim() || new Date().toLocaleDateString('en-GB');

  if (!name || isNaN(amt)) return alert('பெயர் மற்றும் அசல் தொகையை உள்ளிடவும்');

  db.vatti.push({ name, amt, rate, date, datetime: getDateTime() });
  document.getElementById('vName').value = '';
  document.getElementById('vAmt').value = '';
  document.getElementById('vRate').value = '';
  document.getElementById('vDate').value = '';
  saveData();
}

function addManualNote() {
  const text = document.getElementById('m-note-text').value.trim();
  if (!text) return alert('குறிப்பு எழுதவும்');

  db.notes.push({ text, datetime: getDateTime() });
  document.getElementById('m-note-text').value = '';
  saveData();
}

function deleteItem(cat, index) {
  db[cat].splice(index, 1);
  saveData();
}

// வட்டி கணக்கீடு
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

// UI-இல் அனைத்துப் பட்டியல்களையும் காட்ட
function renderAll() {
  // 1. சம்பளம்
  let balSal = 0;
  let htmlSal = '';
  db.salary.forEach((item, i) => {
    if (item.type === 'in') balSal += item.amt;
    else balSal -= item.amt;
    htmlSal += `<div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:14px;">
      <span>${item.desc} (${item.datetime})</span>
      <span style="color:${item.type==='in'?'green':'red'}; font-weight:bold;">${item.type==='in'?'+':'-'}₹${item.amt} <button onclick="deleteItem('salary',${i})" style="border:none; background:none; color:gray; cursor:pointer;">❌</button></span>
    </div>`;
  });
  document.getElementById('bal-salary').innerText = balSal;
  document.getElementById('hist-salary').innerHTML = htmlSal;

  // 2. வீடு
  let balHome = 0;
  let htmlHome = '';
  db.home.forEach((item, i) => {
    if (item.type === 'in') balHome += item.amt;
    else balHome -= item.amt;
    htmlHome += `<div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:14px;">
      <span>${item.desc} (${item.datetime})</span>
      <span style="color:${item.type==='in'?'green':'red'}; font-weight:bold;">${item.type==='in'?'+':'-'}₹${item.amt} <button onclick="deleteItem('home',${i})" style="border:none; background:none; color:gray; cursor:pointer;">❌</button></span>
    </div>`;
  });
  document.getElementById('bal-home').innerText = balHome;
  document.getElementById('hist-home').innerHTML = htmlHome;

  // 3. கொள்ளை
  let totalKollai = 0;
  let htmlKollai = '';
  db.kollai.forEach((item, i) => {
    totalKollai += item.amt;
    htmlKollai += `<div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:14px;">
      <span>${item.desc} (${item.datetime})</span>
      <span style="color:red; font-weight:bold;">-₹${item.amt} <button onclick="deleteItem('kollai',${i})" style="border:none; background:none; color:gray; cursor:pointer;">❌</button></span>
    </div>`;
  });
  document.getElementById('total-kollai').innerText = totalKollai;
  document.getElementById('hist-kollai').innerHTML = htmlKollai;

  // 4. வட்டி
  let htmlVatti = '';
  db.vatti.forEach((item, i) => {
    let calc = calculateInterest(item.amt, item.rate, item.date);
    htmlVatti += `<div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:10px; margin-bottom:8px;">
      <div style="font-weight:bold; display:flex; justify-content:space-between;">
        <span>${item.name}</span>
        <button onclick="deleteItem('vatti',${i})" style="border:none; background:none; color:gray; cursor:pointer;">❌</button>
      </div>
      <div style="font-size:13px; color:#475569; margin-top:4px;">
        அசல்: ₹${item.amt} | வட்டி: ${item.rate}% | தேதி: ${item.date}<br>
        காலம்: ${calc.months} மாதம், ${calc.days} நாள்<br>
        வட்டித் தொகை: ₹${calc.interest}
      </div>
      <div style="font-weight:bold; color:#15803d; margin-top:4px; font-size:14px;">
        மொத்தம் தர வேண்டியது: ₹${calc.total}
      </div>
    </div>`;
  });
  document.getElementById('vattiList').innerHTML = htmlVatti;

  // 5. நோட்பேட்
  let htmlNotes = '';
  db.notes.forEach((item, i) => {
    htmlNotes += `<div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:14px; background:#f8fafc; padding:8px; border-radius:8px;">
      <span>${item.text} <small style="color:gray;">(${item.datetime})</small></span>
      <button onclick="deleteItem('notes',${i})" style="border:none; background:none; color:gray; cursor:pointer;">❌</button>
    </div>`;
  });
  document.getElementById('hist-notes').innerHTML = htmlNotes;
}

// தொடக்கத்தில் ரன் செய்ய
renderAll();
