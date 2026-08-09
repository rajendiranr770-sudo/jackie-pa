let db = JSON.parse(localStorage.getItem('smartpa_db_v5')) || { 
  salary: [], 
  home: [], 
  vatti: [], 
  kollai: [], 
  notes: [], 
  reminders: [] 
};
let pendingExpense = null;
let pendingVatti = null;

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
    { w: /இருபதாயிரம்|இருபது ஆயிரம்/g, v: 20000 },
    { w: /முப்பதாயிரம்|முப்பது ஆயிரம்/g, v: 30000 },
    { w: /நாற்பதாயிரம்|நாற்பது ஆயிரம்/g, v: 40000 },
    { w: /ஐம்பதாயிரம்|ஐம்பது ஆயிரம்/g, v: 50000 },
    { w: /பத்தாயிரம்|பத்து ஆயிரம்/g, v: 10000 },
    { w: /ஒரு ஆயிரம்|ஆயிரம்/g, v: 1000 },
    { w: /ஒரு லட்சம்|ஒரு லக்ஷம்|லட்சம்|லக்ஷம்/g, v: 100000 }
  ];

  str = str.replace(/(\d+)\s*ஆயிரம்/g, (m, p1) => parseInt(p1) * 1000);
  str = str.replace(/(\d+)\s*லட்சம்/g, (m, p1) => parseInt(p1) * 100000);

  words.forEach(item => { str = str.replace(item.w, item.v); });
  return str;
}

function getDateTime() {
  const now = new Date();
  return now.toLocaleDateString('ta-IN') + ' ' + now.toLocaleTimeString('ta-IN', { hour: '2-digit', minute: '2-digit' });
}

function saveData() {
  localStorage.setItem('smartpa_db_v5', JSON.stringify(db));
  renderData();
}

function deleteItem(cat, idx) {
  db[cat].splice(idx, 1);
  saveData();
}

// எடிட் செய்யும் வசதி (Edit Feature)
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

// தொடக்க தேதியை வைத்து மாதங்கள் + நாட்களை துல்லியமாக கணக்கிடுதல்
function calculateInterest(amt, rate, startDateStr) {
  let parts = (startDateStr || '').split(/[\/\-.]/);
  let start = (parts.length === 3) ? new Date(parts[2], parts[1] - 1, parts[0]) : new Date();
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
      `<div class="history-item"><span>${i.desc} <br><small style="color:gray;">${i.datetime}</small></span><div><span class="${i.type}">₹${i.amt}</span> <button onclick="editItem('salary', ${idx})">✏️</button> <button class="btn-del" onclick="deleteItem('salary', ${idx})">🗑️</button></div></div>`
    ).reverse().join('');
  }

  // 2. வீடு
  let homeBal = db.home.reduce((acc, item) => item.type === 'in' ? acc + item.amt : acc - item.amt, 0);
  if(document.getElementById('bal-home')) document.getElementById('bal-home').innerText = homeBal;
  if(document.getElementById('hist-home')) {
    document.getElementById('hist-home').innerHTML = db.home.map((i, idx) => 
      `<div class="history-item"><span>${i.desc} <br><small style="color:gray;">${i.datetime}</small></span><div><span class="${i.type}">₹${i.amt}</span> <button onclick="editItem('home', ${idx})">✏️</button> <button class="btn-del" onclick="deleteItem('home', ${idx})">🗑️</button></div></div>`
    ).reverse().join('');
  }

  // 3. கொள்ளை
  let kollaiTotal = db.kollai.reduce((acc, item) => acc + item.amt, 0);
  if(document.getElementById('total-kollai')) document.getElementById('total-kollai').innerText = kollaiTotal;
  if(document.getElementById('hist-kollai')) {
    document.getElementById('hist-kollai').innerHTML = db.kollai.map((i, idx) => 
      `<div class="history-item"><span>${i.desc} <br><small style="color:gray;">${i.datetime}</small></span><div><span class="out">₹${i.amt}</span> <button onclick="editItem('kollai', ${idx})">✏️</button> <button class="btn-del" onclick="deleteItem('kollai', ${idx})">🗑️</button></div></div>`
    ).reverse().join('');
  }

  // 4. வட்டி (தேதி அடிப்படையிலான கணக்கீடு)
  renderVatti();

  // 5. நோட்பேட்
  if(document.getElementById('hist-notes')) {
    document.getElementById('hist-notes').innerHTML = db.notes.map((n, idx) => 
      `<div class="history-item"><span>${n.text} <br><small style="color:gray;">${n.datetime}</small></span><button class="btn-del" onclick="deleteItem('notes', ${idx})">🗑️</button></div>`
    ).reverse().join('');
  }
}

// வட்டி லிஸ்ட்டை துல்லியமாகக் காட்டும் ஃபங்க்ஷன் (உங்களின் புதிய UI -க்கு ஏற்றவாறு)
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
      <div class="vatti-card" style="background:#f8fafc; border:1.5px solid #cbd5e1; padding:14px; border-radius:14px; margin-bottom:12px;">
        <div style="width:100%; display:flex; justify-content:space-between; font-weight:bold; color:#1e3a8a;">
          <span>👤 ${i.name}</span>
          <span style="font-size:13px; color:#64748b;">📅 ${i.date || 'N/A'}</span>
        </div>
        <div style="margin-top:8px; font-size:14px; color:#334155; line-height:1.6;">
          • அசல்: <b>₹${i.amt}</b> | வட்டி: <b>${i.rate}%</b> (மாத வட்டி ₹${calc.monthlyInterest})<br>
          • கழிந்த காலம்: <b>${calc.totalMonths} மாதம், ${calc.days} நாட்கள்</b><br>
          • சேர்ந்த வட்டி: <b style="color:#d97706;">₹${calc.totalInterest}</b>
        </div>
        <div style="color:#15803d; font-weight:bold; margin-top:8px; font-size:16px; background:#e0f2fe; padding:8px; border-radius:8px; text-align:center;">
          💰 மொத்தம் தர வேண்டியது: ₹${calc.grandTotal}
        </div>
        <div style="margin-top:10px; display:flex; gap:8px;">
          <button class="btn btn-blue" style="padding:6px; font-size:12px; flex:1;" onclick="editItem('vatti', ${idx})">✏️ எடிட்</button>
          <button class="btn btn-red" style="padding:6px; font-size:12px; flex:1;" onclick="deleteItem('vatti', ${idx})">🗑️ நீக்கு</button>
          <button class="btn btn-green" style="padding:6px; font-size:12px; flex:1;" onclick="downloadPersonPDF('${i.name}')">📄 PDF</button>
        </div>
      </div>`;
  });
}

// மேனுவல் பதிவுகள் (Manual Functions)
function addManual(cat, type) {
  let desc = document.getElementById(`m-${cat}-desc`).value;
  let amt = parseFloat(document.getElementById(`m-${cat}-amt`).value);
  if(desc && amt) {
    db[cat].push({ desc, amt, type, datetime: getDateTime() });
    saveData();
    document.getElementById(`m-${cat}-desc`).value = '';
    document.getElementById(`m-${cat}-amt`).value = '';
  }
}

function addManualKollai() {
  let desc = document.getElementById('m-kollai-desc').value;
  let amt = parseFloat(document.getElementById('m-kollai-amt').value);
  if(desc && amt) {
    db.kollai.push({ desc, amt, datetime: getDateTime() });
    saveData();
    document.getElementById('m-kollai-desc').value = '';
    document.getElementById('m-kollai-amt').value = '';
  }
}

// வட்டி சேர் பட்டன் வேலை செய்வதற்கான துல்லியமான ஃபங்க்ஷன்
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

function addManualNote() {
  let text = document.getElementById('m-note-text').value;
  if(text) {
    db.notes.push({ text, datetime: getDateTime() });
    saveData();
    document.getElementById('m-note-text').value = '';
  }
}

function showSec(id, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(n => n.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if(el) el.classList.add('active');
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

// தனிநபர் வட்டி அறிக்கை டவுன்லோட் ஃபங்க்ஷன்
function downloadPersonPDF(name) {
  const personData = db.vatti.filter(v => v.name.toLowerCase() === name.toLowerCase());
  if (personData.length === 0) { alert('கணக்கு எதுவும் இல்லை!'); return; }

  let details = personData.map(v => {
    let calc = calculateInterest(v.amt, v.rate, v.date);
    let durationText = `${calc.totalMonths} மாதம், ${calc.days} நாட்கள்`;
    return `நபர்: ${v.name}\nகடன் தேதி: ${v.date || 'N/A'}\nஅசல் தொகை: ₹${v.amt}\nவட்டி விகிதம்: ${v.rate}%\nகால அளவு: ${durationText}\nஇன்றைய நாள் வரை வட்டி: ₹${calc.totalInterest}\nமொத்தம் தர வேண்டியது: ₹${calc.grandTotal}\n------------------------`;
  }).join('\n\n');

  let blob = new Blob([`*** பாலாஜி ஜோக்கி வட்டி கணக்கு அறிக்கை ***\n\n${details}`], { type: "text/plain;charset=utf-8" });
  let a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}_Vatti_Kanakku.txt`;
  a.click();
}

function downloadPDF() {
  const element = document.getElementById('vatti-pdf-area') || document.body;
  html2pdf().from(element).save('Vatti_Kanakku.pdf');
}

function processNLP(rawText) {
  const text = parseTamilNumbers(rawText);
  const datetime = getDateTime();

  // 1. "ராஜாவின் வட்டி கணக்கை காட்டு" எனப் பேசினால்
  if (/(காட்டு|எவ்வளவு|கணக்கு|விவரம்)/.test(text) && (text.includes('வட்டி') || text.includes('கணக்கு'))) {
    let cleanName = rawText.replace(/(வா|வட்டி|கணக்கை|கணக்கு|காட்டு|எவ்வளவு|விவரம்|இன்|உடைய)/g, '').trim();
    let person = db.vatti.find(v => v.name.toLowerCase().includes(cleanName.toLowerCase()));

    if (person) {
      let calc = calculateInterest(person.amt, person.rate, person.date);
      addChat(`📊 **${person.name} வட்டி விவரம்:**\n• அசல்: ₹${person.amt}\n• வட்டி %: ${person.rate}%\n• கடன் தேதி: ${person.date || 'N/A'}\n• கழிந்த காலம்: ${calc.totalMonths} மாதம், ${calc.days} நாட்கள்\n• வட்டி தொகை: ₹${calc.totalInterest}\n💰 **மொத்தம் தர வேண்டியது: ₹${calc.grandTotal}**`, false);
      return;
    }
  }

  // 2. பழைய கணக்கில் சேர்ப்பதா / புதிய கணக்கா என உறுதியளித்தல்
  if (pendingVatti) {
    if (/(ஆமாம்|ஆமா|சேர்|சேர்க்கவும்|அவரிடம்|பழைய)/.test(text)) {
      let target = pendingVatti.existing[0];
      target.amt += pendingVatti.amt;
      target.rate = pendingVatti.rate;
      saveData();
      addChat(`சரி பாலாஜி சார்! ${target.name} கணக்கில் ₹${pendingVatti.amt} சேர்க்கப்பட்டது. தற்போதைய மொத்த அசல்: ₹${target.amt} 💰`, false);
      pendingVatti = null;
      return;
    } else if (/(புதிய|புதிதாக|தனி|வேற)/.test(text)) {
      let count = pendingVatti.existing.length + 1;
      let newName = `${pendingVatti.name} ${count}`;
      db.vatti.push({ name: newName, amt: pendingVatti.amt, rate: pendingVatti.rate, date: pendingVatti.date, datetime });
      saveData();
      addChat(`சரி பாலாஜி சார்! புதிய நபராக "${newName}" வட்டி கணக்கில் சேர்க்கப்பட்டார். அசல்: ₹${pendingVatti.amt}, வட்டி: ${pendingVatti.rate}%, தேதி: ${pendingVatti.date} 💰`, false);
      pendingVatti = null;
      return;
    }
  }

  // 3. புதிய வட்டி கணக்கை பதிவு செய்தல்
  if (text.includes('வட்டி') || text.includes('பைசா')) {
    let numbers = text.match(/\d+/g);
    let cleanText = rawText.replace(/(என்பவர்|என்பவருக்கு|என்பவரிடம்|வாங்கியுள்ளார்|வாங்கி|உள்ளார)/g, '').trim();
    let words = cleanText.split(' ');
    let name = words[0] && isNaN(words[0]) ? words[0] : "நபர்";

    let dateMatch = rawText.match(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/);
    let todayStr = new Date().toLocaleDateString('en-GB');
    let entryDate = dateMatch ? dateMatch[0].replace(/\./g, '/') : todayStr;

    if (numbers && numbers.length >= 2) {
      let amt = parseInt(numbers[0]);
      let rate = parseInt(numbers[1]);

      let existingPersons = db.vatti.filter(v => v.name.toLowerCase() === name.toLowerCase());

      if (existingPersons.length > 0) {
        pendingVatti = { name, amt, rate, date: entryDate, existing: existingPersons };
        addChat(`பாலாஜி சார்! ஏற்கனவே "${name}" பெயரில் கணக்கு உள்ளது. ₹${amt} தொகையை பழைய ${name} கணக்கிலேயே சேர்க்கவா? அல்லது "புதிய நபர்" எனத் தனி கணக்காகப் பதியவா?`, false);
        return;
      } else {
        db.vatti.push({ name, amt, rate, date: entryDate, datetime });
        saveData();
        let calc = calculateInterest(amt, rate, entryDate);
        addChat(`சரி பாலாஜி சார்! ${name} வட்டி கணக்கில் சேர்க்கப்பட்டார். அசல்: ₹${amt}, வட்டி: ${rate}%, கடன் தேதி: ${entryDate}.\n(${calc.totalMonths} மாதம், ${calc.days} நாட்களுக்கு மொத்தம் தர வேண்டியது: ₹${calc.grandTotal}) 💰`, false);
        return;
      }
    }
  }

  // 4. சம்பளம் / வீடு செலவுகள்
  if (pendingExpense) {
    if (/(சம்பளம்|சம்பள)/.test(text)) {
      db.salary.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, type: 'out', datetime });
      if (pendingExpense.isKollai) db.kollai.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, datetime });
      saveData();
      addChat(`சரி பாலாஜி சார்! ₹${pendingExpense.amt} சம்பளக் கணக்கில் கழிக்கப்பட்டது! 💼`, false);
      pendingExpense = null;
      return;
    } else if (/(வீடு|வீட்டு)/.test(text)) {
      db.home.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, type: 'out', datetime });
      if (pendingExpense.isKollai) db.kollai.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, datetime });
      saveData();
      addChat(`சரி பாலாஜி சார்! ₹${pendingExpense.amt} வீட்டுக் கணக்கில் கழிக்கப்பட்டது! 🏠`, false);
      pendingExpense = null;
      return;
    }
  }

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
    if (/(வீடு|வீட்டில்|வீட்டிலிருந்து)/.test(text)) {
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

    if (/(சம்பளம்|சம்பளத்தில்|சம்பளப்|சம்பள)/.test(text)) {
      db.salary.push({ desc: rawText, amt, type: 'out', datetime });
      saveData();
      addChat(`சரி பாலாஜி சார், ₹${amt} சம்பளக் கணக்கில் செலவாகப் பதிவு செய்யப்பட்டது! 💼`, false);
    } else if (/(வீடு|வீட்டு|வீட்டில்|வீட்டுப்)/.test(text)) {
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
