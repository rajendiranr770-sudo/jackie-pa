let db = JSON.parse(localStorage.getItem('smartpa_db_v2')) || { 
  salary: [], 
  home: [], 
  vatti: [], 
  kollai: [], 
  notes: [], 
  reminders: [] 
};
let pendingExpense = null;

function parseTamilNumbers(text) {
  let str = text;
  const words = [
    { w: /ஒரு நூறு|நூறு/g, v: 100 },
    { w: /இரண்டு நூறு|இருநூறு/g, v: 200 },
    { w: /முந்நூறு/g, v: 300 },
    { w: /நானூறு/g, v: 400 },
    { w: /ஐந்நூறு/g, v: 500 },
    { w: /அறுநூறு/g, v: 600 },
    { w: /எழுநூறு/g, v: 700 },
    { w: /எண்ணூறு/g, v: 800 },
    { w: /தொள்ளாயிரம்/g, v: 900 },
    { w: /ஆயிரம்/g, v: 1000 },
    { w: /பத்தாயிரம்/g, v: 10000 },
    { w: /இருபதாயிரம்|இருபது ஆயிரம்/g, v: 20000 },
    { w: /முப்பதாயிரம்|முப்பது ஆயிரம்/g, v: 30000 },
    { w: /நாற்பதாயிரம்|நாற்பது ஆயிரம்/g, v: 40000 },
    { w: /ஐம்பதாயிரம்|ஐம்பது ஆயிரம்/g, v: 50000 },
    { w: /லட்சம்|லக்ஷம்/g, v: 100000 }
  ];

  str = str.replace(/(\d+)\s*ஆயிரம்/g, (m, p1) => parseInt(p1) * 1000);
  str = str.replace(/(\d+)\s*லட்சம்/g, (m, p1) => parseInt(p1) * 100000);
  str = str.replace(/(\d+)\s*நூறு/g, (m, p1) => parseInt(p1) * 100);

  words.forEach(item => { str = str.replace(item.w, item.v); });
  return str;
}

function saveData() {
  localStorage.setItem('smartpa_db_v2', JSON.stringify(db));
  renderData();
}

function deleteItem(cat, idx) {
  db[cat].splice(idx, 1);
  saveData();
}

function renderData() {
  // 1. சம்பளம்
  let salBal = db.salary.reduce((acc, item) => item.type === 'in' ? acc + item.amt : acc - item.amt, 0);
  if(document.getElementById('bal-salary')) document.getElementById('bal-salary').innerText = salBal;
  if(document.getElementById('hist-salary')) {
    document.getElementById('hist-salary').innerHTML = db.salary.map((i, idx) => 
      `<div class="history-item">
        <span>${i.desc}</span>
        <div>
          <span class="${i.type}">₹${i.amt}</span>
          <button class="btn-del" onclick="deleteItem('salary', ${idx})">🗑️</button>
        </div>
      </div>`
    ).reverse().join('');
  }

  // 2. வீடு
  let homeBal = db.home.reduce((acc, item) => item.type === 'in' ? acc + item.amt : acc - item.amt, 0);
  if(document.getElementById('bal-home')) document.getElementById('bal-home').innerText = homeBal;
  if(document.getElementById('hist-home')) {
    document.getElementById('hist-home').innerHTML = db.home.map((i, idx) => 
      `<div class="history-item">
        <span>${i.desc}</span>
        <div>
          <span class="${i.type}">₹${i.amt}</span>
          <button class="btn-del" onclick="deleteItem('home', ${idx})">🗑️</button>
        </div>
      </div>`
    ).reverse().join('');
  }

  // 3. கொள்ளை
  let kollaiTotal = db.kollai.reduce((acc, item) => acc + item.amt, 0);
  if(document.getElementById('total-kollai')) document.getElementById('total-kollai').innerText = kollaiTotal;
  if(document.getElementById('hist-kollai')) {
    document.getElementById('hist-kollai').innerHTML = db.kollai.map((i, idx) => 
      `<div class="history-item">
        <span>${i.desc}</span>
        <div>
          <span class="out">₹${i.amt}</span>
          <button class="btn-del" onclick="deleteItem('kollai', ${idx})">🗑️</button>
        </div>
      </div>`
    ).reverse().join('');
  }

  // 4. வட்டி
  if(document.getElementById('hist-vatti')) {
    document.getElementById('hist-vatti').innerHTML = db.vatti.map((i, idx) => 
      `<div class="history-item">
        <span>${i.name} (₹${i.amt} @ ${i.rate}%)</span>
        <div>
          <span class="in">வட்டி: ₹${(i.amt * i.rate)/100}/மாதம்</span>
          <button class="btn-del" onclick="deleteItem('vatti', ${idx})">🗑️</button>
        </div>
      </div>`
    ).reverse().join('');
  }

  // 5. நோட்பேட்
  if(document.getElementById('hist-notes')) {
    document.getElementById('hist-notes').innerHTML = db.notes.map((n, idx) => 
      `<div class="history-item">
        <span>${n}</span>
        <button class="btn-del" onclick="deleteItem('notes', ${idx})">🗑️</button>
      </div>`
    ).reverse().join('');
  }
}

function showSec(id, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if(el) el.classList.add('active');
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

function processNLP(rawText) {
  const text = parseTamilNumbers(rawText.replace(/,/g, ''));
  const date = new Date().toLocaleDateString('ta-IN');

  // வாய்ஸ் டெலிட் கமாண்ட் (Voice Delete Controls)
  if (text.includes('நீக்கு') || text.includes('அழி')) {
    if (text.includes('அனைத்தையும்') || text.includes('எல்லாவற்றையும்')) {
      db = { salary: [], home: [], vatti: [], kollai: [], notes: [], reminders: [] };
      saveData();
      addChat('பாலாஜி சார், அனைத்துக் கணக்குகளும் அழிக்கப்பட்டுவிட்டன! 🧹', false);
      return;
    } else if (text.includes('சம்பளம்') || text.includes('சம்பள')) {
      db.salary.pop();
      saveData();
      addChat('சம்பளக் கணக்கின் கடைசிப் பதிவு நீக்கப்பட்டது! 🗑️', false);
      return;
    } else if (text.includes('வீடு') || text.includes('வீட்டு')) {
      db.home.pop();
      saveData();
      addChat('வீட்டுக் கணக்கின் கடைசிப் பதிவு நீக்கப்பட்டது! 🗑️', false);
      return;
    }
  }

  // நிலுவை பதில்
  if (pendingExpense) {
    if (/(சம்பளம்|சம்பள)/.test(text)) {
      db.salary.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, type: 'out', date });
      saveData();
      addChat(`சரி பாலாஜி சார்! ₹${pendingExpense.amt} (${pendingExpense.desc}) சம்பளக் கணக்கில் கழிக்கப்பட்டது. 💼`, false);
      pendingExpense = null;
      return;
    } else if (/(வீடு|வீட்டு)/.test(text)) {
      db.home.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, type: 'out', date });
      saveData();
      addChat(`சரி பாலாஜி சார்! ₹${pendingExpense.amt} (${pendingExpense.desc}) வீட்டுக் கணக்கில் கழிக்கப்பட்டது. 🏠`, false);
      pendingExpense = null;
      return;
    }
  }

  const numMatch = text.match(/\d+/);
  if (!numMatch) {
    if (text.includes('நோட்') || text.includes('குறிப்பு')) {
      db.notes.push(rawText);
      saveData();
      addChat(`சரி சார், நோட்பேடில் குறிப்பு எடுக்கப்பட்டது! 📝`, false);
      return;
    }
    addChat('மன்னிக்கவும் பாலாஜி சார், தொகையைச் சரியாகக் குறிப்பிடவும்.', false);
    return;
  }

  const amt = parseInt(numMatch[0]);
  const isIncome = /(வந்தது|கொடுத்தார்கள்|அனுப்பினார்கள்|கிடைத்தது|சேர்ந்தது|வரவு)/.test(text);

  if (text.includes('கொல்லை') || text.includes('கொல்லைக்கு')) {
    db.kollai.push({ desc: rawText, amt, date });
  }

  if (isIncome) {
    if (/(வீடு|வீட்டில்|வீட்டிலிருந்து|விட்டு)/.test(text)) {
      db.home.push({ desc: rawText, amt, type: 'in', date });
      saveData();
      addChat(`சரி பாலாஜி சார், ₹${amt} வீட்டுக் கணக்கில் வரவாகச் சேர்க்கப்பட்டது! 🏠`, false);
    } else {
      db.salary.push({ desc: rawText, amt, type: 'in', date });
      saveData();
      addChat(`சரி பாலாஜி சார், ₹${amt} சம்பளக் கணக்கில் வரவாகச் சேர்க்கப்பட்டது! 💼`, false);
    }
  } else {
    if (/(சம்பளம்|சம்பளத்தில்|சம்பளப்)/.test(text)) {
      db.salary.push({ desc: rawText, amt, type: 'out', date });
      saveData();
      addChat(`சரி பாலாஜி சார், ₹${amt} சம்பளக் கணக்கில் செலவாகப் பதிவு செய்யப்பட்டது! 💼`, false);
    } else if (/(வீடு|வீட்டு|வீட்டில்|விட்டு|வீட்டுப்)/.test(text)) {
      db.home.push({ desc: rawText, amt, type: 'out', date });
      saveData();
      addChat(`சரி பாலாஜி சார், ₹${amt} வீட்டுக் கணக்கில் செலவாகப் பதிவு செய்யப்பட்டது! 🏠`, false);
    } else {
      pendingExpense = { desc: rawText, amt };
      addChat(`பாலாஜி சார், ₹${amt} செலவை "சம்பளப் பணம்"-இல் கழிக்கவா அல்லது "வீட்டுப் பணம்"-இல் கழிக்கவா?`, false);
    }
  }
}

function addVatti() {
  const name = prompt("நபர் / விபரம்:");
  const amt = parseFloat(prompt("அசல் தொகை (₹):"));
  const rate = parseFloat(prompt("வட்டி விகிதம் (%):"));
  if (name && amt && rate) {
    db.vatti.push({ name, amt, rate });
    saveData();
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

document.addEventListener('DOMContentLoaded', () => {
  renderData();
});
