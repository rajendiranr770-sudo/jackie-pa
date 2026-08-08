let db = JSON.parse(localStorage.getItem('jackie_pa_v3')) || { salary: [], home: [] };
let pendingExpense = null;

function saveData() {
  localStorage.setItem('jackie_pa_v3', JSON.stringify(db));
  renderData();
}

function renderData() {
  // Salary
  let salBal = db.salary.reduce((acc, item) => item.type === 'in' ? acc + item.amt : acc - item.amt, 0);
  const salElem = document.getElementById('bal-salary');
  if (salElem) {
    salElem.innerText = salBal;
    salElem.className = salBal < 0 ? 'minus' : '';
  }

  const histSalary = document.getElementById('hist-salary');
  if (histSalary) {
    histSalary.innerHTML = db.salary.map(i => 
      `<div class="history-item"><span>${i.desc}</span><span class="${i.type}">₹${i.amt}</span></div>`
    ).join('');
  }

  // Home
  let homeBal = db.home.reduce((acc, item) => item.type === 'in' ? acc + item.amt : acc - item.amt, 0);
  const homeElem = document.getElementById('bal-home');
  if (homeElem) {
    homeElem.innerText = homeBal;
    homeElem.className = homeBal < 0 ? 'minus' : '';
  }

  const histHome = document.getElementById('hist-home');
  if (histHome) {
    histHome.innerHTML = db.home.map(i => 
      `<div class="history-item"><span>${i.desc}</span><span class="${i.type}">₹${i.amt}</span></div>`
    ).join('');
  }
}

function showSec(id, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  el.classList.add('active');
}

function addChat(text, isUser) {
  const box = document.getElementById('chatBox');
  const div = document.createElement('div');
  div.className = `msg ${isUser ? 'user' : 'bot'}`;
  div.innerText = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function sendMsg() {
  const input = document.getElementById('userInput');
  const text = input.value.trim();
  if (!text) return;

  addChat(text, true);
  input.value = '';
  processNLP(text);
}

function processNLP(text) {
  const cleanText = text.replace(/,/g, '');
  const date = new Date().toLocaleDateString('ta-IN');

  // 1. நிலுவையில் உள்ள செலவிற்குப் பதில் அளித்தால்
  if (pendingExpense) {
    if (cleanText.includes('சம்பளம்') || cleanText.includes('சம்பள')) {
      db.salary.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, type: 'out', date });
      saveData();
      addChat(`சரி பாலாஜி சார்! ₹${pendingExpense.amt} (${pendingExpense.desc}) சம்பளக் கணக்கில் செலவாகப் பதிவு செய்யப்பட்டது. 💼`, false);
      pendingExpense = null;
      return;
    } else if (cleanText.includes('வீடு') || cleanText.includes('வீட்டு')) {
      db.home.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, type: 'out', date });
      saveData();
      addChat(`சரி பாலாஜி சார்! ₹${pendingExpense.amt} (${pendingExpense.desc}) வீட்டுக் கணக்கில் செலவாகப் பதிவு செய்யப்பட்டது. 🏠`, false);
      pendingExpense = null;
      return;
    }
  }

  // 2. புதிய பதிவு
  const numMatch = cleanText.match(/\d+/);
  if (!numMatch) {
    addChat('மன்னிக்கவும் பாலாஜி சார், தொகையை (எண்) சரியாகக் குறிப்பிடவும்.', false);
    return;
  }

  const amt = parseInt(numMatch[0]);
  const isIncome = /(வந்தது|கொடுத்தார்கள்|அனுப்பினார்கள்|கிடைத்தது|சேர்ந்தது|வரவு)/.test(cleanText);

  if (isIncome) {
    if (cleanText.includes('வீடு') || cleanText.includes('வீட்டில்') || cleanText.includes('வீட்டிலிருந்து')) {
      db.home.push({ desc: cleanText, amt, type: 'in', date });
      saveData();
      addChat(`சரி பாலாஜி சார், ₹${amt} வீட்டுக் கணக்கில் வரவாகச் சேர்க்கப்பட்டது! 🏠`, false);
    } else {
      db.salary.push({ desc: cleanText, amt, type: 'in', date });
      saveData();
      addChat(`சரி பாலாஜி சார், ₹${amt} சம்பளக் கணக்கில் வரவாகச் சேர்க்கப்பட்டது! 💼`, false);
    }
  } else {
    if (cleanText.includes('சம்பளம்')) {
      db.salary.push({ desc: cleanText, amt, type: 'out', date });
      saveData();
      addChat(`சரி பாலாஜி சார், ₹${amt} சம்பளக் கணக்கில் செலவாகப் பதிவு செய்யப்பட்டது. 💼`, false);
    } else if (cleanText.includes('வீடு')) {
      db.home.push({ desc: cleanText, amt, type: 'out', date });
      saveData();
      addChat(`சரி பாலாஜி சார், ₹${amt} வீட்டுக் கணக்கில் செலவாகப் பதிவு செய்யப்பட்டது. 🏠`, false);
    } else {
      pendingExpense = { desc: cleanText, amt };
      addChat(`பாலாஜி சார், ₹${amt} (${cleanText}) செலவை "சம்பளப் பணம்"-இல் கழிக்கவா அல்லது "வீட்டுப் பணம்"-இல் கழிக்கவா?`, false);
    }
  }
}

function clearChat() {
  pendingExpense = null;
  document.getElementById('chatBox').innerHTML = '<div class="msg bot">வணக்கம் பாலாஜி சார்! என்ன கணக்கு பதிவு செய்ய வேண்டும்?</div>';
}

function startVoice() {
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Speech) { alert('குரல் பதிவு வசதி இல்லை.'); return; }
  const rec = new Speech();
  rec.lang = 'ta-IN';
  document.getElementById('status').innerText = '🎤 கேட்கிறது... பேசுங்கள்...';
  rec.start();

  rec.onresult = (e) => {
    document.getElementById('userInput').value = e.results[0][0].transcript;
    document.getElementById('status').innerText = '🎤 தயார்';
    sendMsg();
  };
}

// பக்கத்தை லோட் செய்யும் போது இயங்க
document.addEventListener('DOMContentLoaded', () => {
  renderData();
});
