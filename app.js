let db = JSON.parse(localStorage.getItem('smartpa_db_v4')) || { 
  salary: [], 
  home: [], 
  vatti: [], 
  kollai: [], 
  notes: [], 
  reminders: [] 
};
let pendingExpense = null;

// தமிழ் எண்களை துல்லியமாக மாற்றுதல்
function parseTamilNumbers(text) {
  let str = text.replace(/,/g, '');
  const words = [
    { w: /ஒரு நூறு|நூறு/g, v: 100 },
    { w: /இருநூறு|இரண்டு நூறு/g, v: 200 },
    { w: /முந்நூறு/g, v: 300 },
    { w: /நானூறு/g, v: 400 },
    { w: /ஐந்நூறு/g, v: 500 },
    { w: /அறுநூறு/g, v: 600 },
    { w: /எழுநூறு/g, v: 700 },
    { w: /எண்ணூறு/g, v: 800 },
    { w: /தொள்ளாயிரம்/g, v: 900 },
    { w: /இருபதாயிரம்|இருபது ஆயிரம்|இருபதுஆயிரம்/g, v: 20000 },
    { w: /முப்பதாயிரம்|முப்பது ஆயிரம்/g, v: 30000 },
    { w: /நாற்பதாயிரம்|நாற்பது ஆயிரம்/g, v: 40000 },
    { w: /ஐம்பதாயிரம்|ஐம்பது ஆயிரம்/g, v: 50000 },
    { w: /பத்தாயிரம்|பத்து ஆயிரம்/g, v: 10000 },
    { w: /ஒரு ஆயிரம்|ஆயிரம்/g, v: 1000 },
    { w: /ஒரு லட்சம்|ஒரு லக்ஷம்|லட்சம்|லக்ஷம்/g, v: 100000 }
  ];

  str = str.replace(/(\d+)\s*ஆயிரம்/g, (m, p1) => parseInt(p1) * 1000);
  str = str.replace(/(\d+)\s*லட்சம்/g, (m, p1) => parseInt(p1) * 100000);
  str = str.replace(/(\d+)\s*நூறு/g, (m, p1) => parseInt(p1) * 100);

  words.forEach(item => { str = str.replace(item.w, item.v); });
  return str;
}

function getDateTime() {
  const now = new Date();
  return now.toLocaleDateString('ta-IN') + ' ' + now.toLocaleTimeString('ta-IN', { hour: '2-digit', minute: '2-digit' });
}

function saveData() {
  localStorage.setItem('smartpa_db_v4', JSON.stringify(db));
  renderData();
}

function deleteItem(cat, idx) {
  db[cat].splice(idx, 1);
  saveData();
}

// குரல் மூலம் பேசுதல் (Voice Alarm)
function speak(text) {
  if ('speechSynthesis' in window) {
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'ta-IN';
    window.speechSynthesis.speak(msg);
  }
}

function renderData() {
  // 1. சம்பளம்
  let salBal = db.salary.reduce((acc, item) => item.type === 'in' ? acc + item.amt : acc - item.amt, 0);
  if(document.getElementById('bal-salary')) document.getElementById('bal-salary').innerText = salBal;
  if(document.getElementById('hist-salary')) {
    document.getElementById('hist-salary').innerHTML = db.salary.map((i, idx) => 
      `<div class="history-item"><span>${i.desc} <br><small style="color:gray;">${i.datetime}</small></span><div><span class="${i.type}">₹${i.amt}</span> <button class="btn-del" onclick="deleteItem('salary', ${idx})">🗑️</button></div></div>`
    ).reverse().join('');
  }

  // 2. வீடு
  let homeBal = db.home.reduce((acc, item) => item.type === 'in' ? acc + item.amt : acc - item.amt, 0);
  if(document.getElementById('bal-home')) document.getElementById('bal-home').innerText = homeBal;
  if(document.getElementById('hist-home')) {
    document.getElementById('hist-home').innerHTML = db.home.map((i, idx) => 
      `<div class="history-item"><span>${i.desc} <br><small style="color:gray;">${i.datetime}</small></span><div><span class="${i.type}">₹${i.amt}</span> <button class="btn-del" onclick="deleteItem('home', ${idx})">🗑️</button></div></div>`
    ).reverse().join('');
  }

  // 3. கொள்ளை
  let kollaiTotal = db.kollai.reduce((acc, item) => acc + item.amt, 0);
  if(document.getElementById('total-kollai')) document.getElementById('total-kollai').innerText = kollaiTotal;
  if(document.getElementById('hist-kollai')) {
    document.getElementById('hist-kollai').innerHTML = db.kollai.map((i, idx) => 
      `<div class="history-item"><span>${i.desc} <br><small style="color:gray;">${i.datetime}</small></span><div><span class="out">₹${i.amt}</span> <button class="btn-del" onclick="deleteItem('kollai', ${idx})">🗑️</button></div></div>`
    ).reverse().join('');
  }

  // 4. வட்டி கணக்கு
  if(document.getElementById('hist-vatti')) {
    document.getElementById('hist-vatti').innerHTML = db.vatti.map((i, idx) => {
      let monthlyVatti = (i.amt * i.rate) / 100;
      let totalVatti = monthlyVatti * i.months;
      let paidVatti = i.paidVatti || 0;
      let pendingVatti = totalVatti - paidVatti;
      let grandTotal = i.amt + pendingVatti;
      return `<div class="history-item" style="flex-direction:column; align-items:flex-start; gap:4px; border-bottom:1px solid #ccc; padding:8px 0;">
        <div style="width:100%; display:flex; justify-content:space-between;">
          <strong>👤 ${i.name} (${i.datetime})</strong>
          <button class="btn-del" onclick="deleteItem('vatti', ${idx})">🗑️</button>
        </div>
        <div>அசல்: ₹${i.amt} | வட்டி விகிதம்: ${i.rate}% (மாத வட்டி ₹${monthlyVatti})</div>
        <div>காலம்: ${i.months} மாதம் | மொத்த வட்டி: ₹${totalVatti}</div>
        <div>இதுவரை கொடுத்த வட்டி: ₹${paidVatti} | மீதி வட்டி: ₹${pendingVatti}</div>
        <div style="color:green; font-weight:bold;">மொத்தம் தர வேண்டியது: ₹${grandTotal}</div>
      </div>`;
    }).reverse().join('');
  }

  // 5. நோட்பேட் & நினைவூட்டல்
  if(document.getElementById('hist-notes')) {
    document.getElementById('hist-notes').innerHTML = db.notes.map((n, idx) => 
      `<div class="history-item"><span>${n.text} <br><small style="color:gray;">${n.datetime}</small></span><button class="btn-del" onclick="deleteItem('notes', ${idx})">🗑️</button></div>`
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

function downloadPDF() {
  const element = document.getElementById('vatti-pdf-area');
  html2pdf().from(element).save('Vatti_Kanakku.pdf');
}

function processNLP(rawText) {
  const text = parseTamilNumbers(rawText);
  const datetime = getDateTime();

  // 1. PDF டவுன்லோட் கோரிக்கை
  if (text.includes('பிடிஎஃப்') || text.includes('PDF') || text.includes('pdf')) {
    downloadPDF();
    addChat('பாலாஜி சார், வட்டி கணக்கு PDF ஆகப் பதிவிறக்கம் செய்யப்படுகிறது! 📄', false);
    return;
  }

  // 2. குறிப்பிட்ட நபர் கணக்கு விபரம் (எ.கா: கார்த்தி கணக்கை காட்டு)
  if (text.includes('கணக்கை காட்டு') || text.includes('கணக்கு காட்டு')) {
    let nameMatch = rawText.match(/^([a-zA-A-ழ-ஹ]+)/);
    let name = nameMatch ? nameMatch[0] : "";
    let person = db.vatti.find(item => item.name.toLowerCase().includes(name.toLowerCase()));
    
    if (person) {
      let monthlyVatti = (person.amt * person.rate) / 100;
      let totalVatti = monthlyVatti * person.months;
      let paidVatti = person.paidVatti || 0;
      let pendingVatti = totalVatti - paidVatti;
      let grandTotal = person.amt + pendingVatti;

      let reply = `👤 ${person.name} கணக்கு விவரம்:\n- அசல்: ₹${person.amt}\n- மாத வட்டி (${person.rate}%): ₹${monthlyVatti}\n- காலம்: ${person.months} மாதம்\n- இதுவரை கொடுத்த வட்டி: ₹${paidVatti}\n- மீதி வட்டி: ₹${pendingVatti}\n- மொத்தம் தர வேண்டியது: ₹${grandTotal}`;
      addChat(reply, false);
    } else {
      addChat(`மன்னிக்கவும் பாலாஜி சார், ${name} என்பவரின் கணக்கு விவரம் கிடைக்கவில்லை.`, false);
    }
    return;
  }

  // 3. நினைவூட்டல் / அலாரம் (எ.கா: கார்த்திக் என்பவரை பார்க்க வேண்டும் ஞாபகப்படுத்து)
  if (text.includes('ஞாபகப்படுத்து') || text.includes('நினைவூட்டு')) {
    db.notes.push({ text: rawText, datetime });
    saveData();
    addChat(`சரி பாலாஜி சார்! "${rawText}" என்று நினைவூட்டல் பதிவு செய்யப்பட்டது. குறிப்பிட்ட நேரத்தில் குரல் மூலம் அலாரம் செய்யப்படும்! 🔔`, false);
    return;
  }

  // 4. வட்டி கணக்கு பதிவு
  if (text.includes('வட்டி') || text.includes('பைசா')) {
    let nameMatch = rawText.match(/^([a-zA-A-ழ-ஹ]+)/);
    let name = nameMatch ? nameMatch[0] : "நபர்";
    let numbers = text.match(/\d+/g);
    
    if (numbers && numbers.length >= 2) {
      let amt = parseInt(numbers[0]);
      let rate = parseInt(numbers[1]);
      let months = numbers[2] ? parseInt(numbers[2]) : 1;

      db.vatti.push({ name, amt, rate, months, paidVatti: 0, datetime });
      saveData();
      addChat(`சரி பாலாஜி சார்! ${name} வட்டி கணக்கு சேர்க்கப்பட்டது. அசல்: ₹${amt}, வட்டி: ${rate}%. 💰`, false);
      return;
    }
  }

  // 5. வரவு / செலவு
  const numMatch = text.match(/\d+/);
  if (!numMatch) {
    db.notes.push({ text: rawText, datetime });
    saveData();
    addChat(`நோட்பேடில் குறிப்பு எடுக்கப்பட்டது! 📝`, false);
    return;
  }

  const amt = parseInt(numMatch[0]);
  const isIncome = /(வந்தது|கொடுத்தார்கள்|அனுப்பினார்கள்|கிடைத்தது|சேர்ந்தது|வரவு)/.test(text);
  const isKollai = text.includes('கொல்லை') || text.includes('கொல்லைக்கு');

  if (isIncome) {
    if (/(வீடு|வீட்டில்|வீட்டிலிருந்து|விட்டு)/.test(text)) {
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

    if (/(சம்பளம்|சம்பளத்தில்|சம்பளப்)/.test(text)) {
      db.salary.push({ desc: rawText, amt, type: 'out', datetime });
      saveData();
      addChat(`சரி பாலாஜி சார், ₹${amt} சம்பளக் கணக்கில் செலவாகப் பதிவு செய்யப்பட்டது! 💼`, false);
    } else if (/(வீடு|வீட்டு|வீட்டில்|விட்டு|வீட்டுப்)/.test(text)) {
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
