let db = JSON.parse(localStorage.getItem('jokky_db')) || {
  salary: [],
  home: [],
  kollai: [],
  vatti: [],
  notes: []
};

let pendingExpense = null;

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
  let str = text;
  str = str.replace(/இருபதாயிரம்|இருபது ஆயிரம்|20 ஆயிரம்/gi, '20000');
  str = str.replace(/முப்பத்தாயிரம்|முப்பது ஆயிரம்|30 ஆயிரம்/gi, '30000');
  str = str.replace(/நாற்பதாயிரம்|நாற்பது ஆயிரம்|40 ஆயிரம்/gi, '40000');
  str = str.replace(/ஐம்பதாயிரம்|ஐம்பது ஆயிரம்|50 ஆயிரம்/gi, '50000');
  str = str.replace(/பத்தாயிரம்|பத்து ஆயிரம்|10 ஆயிரம்/gi, '10000');
  str = str.replace(/ஐயாயிரம்|அஞ்சாயிரம்|5 ஆயிரம்/gi, '5000');
  str = str.replace(/நாலாயிரம்|4 ஆயிரம்/gi, '4000');
  str = str.replace(/மூன்றாயிரம்|3 ஆயிரம்/gi, '3000');
  str = str.replace(/இரண்டாயிரம்|ரெண்டாயிரம்|2 ஆயிரம்/gi, '2000');
  str = str.replace(/ஆயிரம்|1 ஆயிரம்/gi, '1000');
  str = str.replace(/ஐந்நூறு|அந்நூறு|500/gi, '500');
  str = str.replace(/நூறு|100/gi, '100');
  return str;
}

function extractAmount(text) {
  let cleanText = parseTamilNumbers(text);
  cleanText = cleanText.replace(/,/g, '');
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
      if (status) status.innerText = "🎤 பதிவு செய்யப்பட்டது...";
      setTimeout(() => {
        sendMsg();
        if (status) status.innerText = "🎤 தயார்";
      }, 400);
    }
  };

  recognition.onerror = function() {
    if (status) status.innerText = "🎤 தயார்";
  };

  recognition.start();
}

function processNLP(rawText) {
  const datetime = getDateTime();
  const amt = extractAmount(rawText);

  // 1. வட்டி கணக்கு எனில்
  if (/வட்டி|வட்டிக்கு/i.test(rawText)) {
    let rateMatch = rawText.match(/(\d+|\bமூணு\b|\bஇரண்டு\b|\bஒன்னு\b)\s*(பைசா|ரூபாய்|%)/i);
    let rate = 2; // Default rate
    if (rawText.includes('மூணு')) rate = 3;
    else if (rawText.includes('ரெண்டு') || rawText.includes('இரண்டு')) rate = 2;
    else if (rawText.includes('ஒன்னு')) rate = 1;

    let name = rawText.replace(/வாங்கி இருக்கான்|வாங்கியிருக்கான்|வாங்கி இருக்கேன்|வட்டிக்கு/gi, '').trim();

    db.vatti.push({
      name: name || rawText,
      amt: amt || 0,
      rate: rate,
      date: new Date().toLocaleDateString('en-GB')
    });
    saveData();
    addChat(`சரி பாலாஜி சார், வட்டிக் கணக்கில் சேர்க்கப்பட்டது! 🪙 (அசல்: ₹${amt || 0})`, false);
    return;
  }

  const isKollai = /(கொல்லை|கொல்லைக்கு|கொல்லைல|கொல்லையில்)/i.test(rawText);
  const isSalary = /(சம்பளம்|சம்பளத்தில்|சம்பள பணம்)/i.test(rawText);
  const isHome = /(வீடு|வீட்டில்|வீட்டு|வீட்டு பணம்)/i.test(rawText);
  const isIncome = /(வந்தது|வந்திருக்கு|கொடுத்தாங்க|கிடைத்தது|வரவு)/i.test(rawText);

  if (pendingExpense) {
    if (isSalary || rawText === '1' || /சம்பளம்/i.test(rawText)) {
      db.salary.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, type: 'out', datetime });
      if (pendingExpense.isKollai) db.kollai.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, datetime });
      addChat(`சரி பாலாஜி சார், ₹${pendingExpense.amt} சம்பளக் கணக்கில் கழிக்கப்பட்டது! 💼`, false);
      pendingExpense = null;
      saveData();
      return;
    } else if (isHome || rawText === '2' || /வீடு/i.test(rawText)) {
      db.home.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, type: 'out', datetime });
      if (pendingExpense.isKollai) db.kollai.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, datetime });
      addChat(`சரி பாலாஜி சார், ₹${pendingExpense.amt} வீட்டுக் கணக்கில் கழிக்கப்பட்டது! 🏠`, false);
      pendingExpense = null;
      saveData();
      return;
    }
  }

  if (!amt) {
    db.notes.push({ text: rawText, datetime });
    saveData();
    addChat(`குறிப்பில் சேர்க்கப்பட்டது! 📝`, false);
    return;
  }

  if (isIncome) {
    if (isHome) {
      db.home.push({ desc: rawText, amt, type: 'in', datetime });
      addChat(`சரி பாலாஜி சார், ₹${amt} வீட்டுக் கணக்கில் வரவாகச் சேர்க்கப்பட்டது! 🏠`, false);
    } else {
      db.salary.push({ desc: rawText, amt, type: 'in', datetime });
      addChat(`சரி பாலாஜி சார், ₹${amt} சம்பளக் கணக்கில் வரவாகச் சேர்க்கப்பட்டது! 💼`, false);
    }
    saveData();
    return;
  }

  if (isKollai) {
    if (isSalary) {
      db.kollai.push({ desc: rawText, amt, datetime });
      db.salary.push({ desc: rawText, amt, type: 'out', datetime });
      addChat(`சரி பாலாஜி சார், ₹${amt} கொல்லை செலவு சம்பளத்தில் கழிக்கப்பட்டது! 💼🌱`, false);
    } else if (isHome) {
      db.kollai.push({ desc: rawText, amt, datetime });
      db.home.push({ desc: rawText, amt, type: 'out', datetime });
      addChat(`சரி பாலாஜி சார், ₹${amt} கொல்லை செலவு வீட்டுக் கணக்கில் கழிக்கப்பட்டது! 🏠🌱`, false);
    } else {
      pendingExpense = { desc: rawText, amt, isKollai: true };
      addChat(`பாலாஜி சார், ₹${amt} செலவை "சம்பளம்"-இல் கழிக்கவா அல்லது "வீடு"-இல் கழிக்கவா?`, false);
      return;
    }
  } else if (isHome) {
    db.home.push({ desc: rawText, amt, type: 'out', datetime });
    addChat(`சரி பாலாஜி சார், ₹${amt} வீட்டுக் கணக்கில் கழிக்கப்பட்டது! 🏠`, false);
  } else if (isSalary) {
    db.salary.push({ desc: rawText, amt, type: 'out', datetime });
    addChat(`சரி பாலாஜி சார், ₹${amt} சம்பளக் கணக்கில் கழிக்கப்பட்டது! 💼`, false);
  } else {
    pendingExpense = { desc: rawText, amt, isKollai: false };
    addChat(`பாலாஜி சார், ₹${amt} செலவை "சம்பளப் பணம்"-இல் கழிக்கவா அல்லது "வீட்டுப் பணம்"-இல் கழிக்கவா?`, false);
    return;
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
  let currentAmt = item.amt || 0;

  let newText = prompt("விவரத்தை மாற்றவும்:", currentText);
  if (newText === null) return;

  if (cat === 'vatti') {
    item.name = newText;
    let newAmt = prompt("தொகை:", currentAmt);
    if (newAmt !== null) item.amt = Number(newAmt);
  } else if (cat === 'notes') {
    item.text = newText;
  } else {
    item.desc = newText;
    let newAmt = prompt("தொகை:", currentAmt);
    if (newAmt !== null) item.amt = Number(newAmt);
  }
  saveData();
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
    if (item.type === 'in') balSal += item.amt;
    else balSal -= item.amt;
    htmlSal += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:15px; background:#fff; padding:10px; border-radius:8px; border:1px solid #e5e7eb;">
      <span>${item.desc} <br><small style="color:gray;">(${item.datetime})</small></span>
      <span style="color:${item.type==='in'?'#16a34a':'#dc2626'}; font-weight:bold;">
        ${item.type==='in'?'+':'-'}₹${item.amt} 
        <button onclick="editItem('salary',${i})" style="border:none; background:none; cursor:pointer;">✏️</button>
        <button onclick="deleteItem('salary',${i})" style="border:none; background:none; cursor:pointer;">❌</button>
      </span>
    </div>`;
  });
  if (document.getElementById('bal-salary')) document.getElementById('bal-salary').innerText = balSal;
  if (document.getElementById('hist-salary')) document.getElementById('hist-salary').innerHTML = htmlSal;

  let balHome = 0, htmlHome = '';
  db.home.forEach((item, i) => {
    if (item.type === 'in') balHome += item.amt;
    else balHome -= item.amt;
    htmlHome += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:15px; background:#fff; padding:10px; border-radius:8px; border:1px solid #e5e7eb;">
      <span>${item.desc} <br><small style="color:gray;">(${item.datetime})</small></span>
      <span style="color:${item.type==='in'?'#16a34a':'#dc2626'}; font-weight:bold;">
        ${item.type==='in'?'+':'-'}₹${item.amt} 
        <button onclick="editItem('home',${i})" style="border:none; background:none; cursor:pointer;">✏️</button>
        <button onclick="deleteItem('home',${i})" style="border:none; background:none; cursor:pointer;">❌</button>
      </span>
    </div>`;
  });
  if (document.getElementById('bal-home')) document.getElementById('bal-home').innerText = balHome;
  if (document.getElementById('hist-home')) document.getElementById('hist-home').innerHTML = htmlHome;

  let totalKollai = 0, htmlKollai = '';
  db.kollai.forEach((item, i) => {
    totalKollai += item.amt;
    htmlKollai += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:15px; background:#fff; padding:10px; border-radius:8px; border:1px solid #e5e7eb;">
      <span>${item.desc} <br><small style="color:gray;">(${item.datetime})</small></span>
      <span style="color:#dc2626; font-weight:bold;">
        -₹${item.amt} 
        <button onclick="editItem('kollai',${i})" style="border:none; background:none; cursor:pointer;">✏️</button>
        <button onclick="deleteItem('kollai',${i})" style="border:none; background:none; cursor:pointer;">❌</button>
      </span>
    </div>`;
  });
  if (document.getElementById('total-kollai')) document.getElementById('total-kollai').innerText = totalKollai;
  if (document.getElementById('hist-kollai')) document.getElementById('hist-kollai').innerHTML = htmlKollai;

  let htmlVatti = '';
  db.vatti.forEach((item, i) => {
    let calc = calculateInterest(item.amt, item.rate, item.date);
    htmlVatti += `<div style="background:#fff; border:1px solid #e5e7eb; padding:12px; border-radius:10px; margin-bottom:8px;">
      <div style="font-weight:bold; display:flex; justify-content:space-between; font-size:16px;">
        <span>${item.name}</span>
        <div>
          <button onclick="editItem('vatti',${i})" style="border:none; background:none; cursor:pointer;">✏️</button>
          <button onclick="deleteItem('vatti',${i})" style="border:none; background:none; cursor:pointer;">❌</button>
        </div>
      </div>
      <div style="font-size:14px; color:#4b5563; margin-top:4px;">
        அசல்: ₹${item.amt} | வட்டி: ${item.rate}% | தேதி: ${item.date}<br>
        காலம்: ${calc.months} மாதம், ${calc.days} நாள் | வட்டி: ₹${calc.interest}
      </div>
      <div style="font-weight:bold; color:#16a34a; margin-top:4px; font-size:15px;">
        மொத்தம்: ₹${calc.total}
      </div>
    </div>`;
  });
  if (document.getElementById('vattiList')) document.getElementById('vattiList').innerHTML = htmlVatti;

  let htmlNotes = '';
  db.notes.forEach((item, i) => {
    htmlNotes += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:15px; background:#fff; padding:10px; border-radius:8px; border:1px solid #e5e7eb;">
      <span>${item.text} <br><small style="color:gray;">(${item.datetime})</small></span>
      <div>
        <button onclick="editItem('notes',${i})" style="border:none; background:none; cursor:pointer;">✏️</button>
        <button onclick="deleteItem('notes',${i})" style="border:none; background:none; cursor:pointer;">❌</button>
      </div>
    </div>`;
  });
  if (document.getElementById('hist-notes')) document.getElementById('hist-notes').innerHTML = htmlNotes;
}

window.onload = function() {
  renderAll();
};
    
