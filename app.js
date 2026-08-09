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

// தமிழ் எண்களையும் பேச்சுகளையும் சரியாக எண்களாக மாற்றும் லோஜிக்
function parseTamilNumbers(text) {
  let str = text.replace(/,/g, '');
  
  // லட்சங்கள்
  str = str.replace(/(இரண்டு|ரெண்டு|2)\s*(லட்சம்|லக்ஷம்)/g, '200000');
  str = str.replace(/(மூன்று|மூணு|3)\s*(லட்சம்|லக்ஷம்)/g, '300000');
  str = str.replace(/(நான்கு|நாலு|4)\s*(லட்சம்|லக்ஷம்)/g, '400000');
  str = str.replace(/(ஐந்து|அஞ்சு|5)\s*(லட்சம்|லக்ஷம்)/g, '500000');
  str = str.replace(/(\d+)\s*(லட்சம்|லக்ஷம்)/g, (m, p1) => parseInt(p1) * 100000);
  str = str.replace(/(ஒரு லட்சம்|ஒரு லக்ஷம்|லட்சம்|லக்ஷம்)/g, '100000');

  // ஆயிரங்கள்
  str = str.replace(/(இருபதாயிரம்|இருபது ஆயிரம்)/g, '20000');
  str = str.replace(/(முப்பதாயிரம்|முப்பது ஆயிரம்)/g, '30000');
  str = str.replace(/(நாற்பதாயிரம்|நாற்பது ஆயிரம்)/g, '40000');
  str = str.replace(/(ஐம்பதாயிரம்|ஐம்பது ஆயிரம்)/g, '50000');
  str = str.replace(/(\d+)\s*ஆயிரம்/g, (m, p1) => parseInt(p1) * 1000);
  str = str.replace(/(ஒரு ஆயிரம்|ஆயிரம்)/g, '1000');

  const words = [
    { w: /ஒரு நூறு|நூறு/g, v: 100 },
    { w: /இருநூறு|இரண்டு நூறு/g, v: 200 },
    { w: /முந்நூறு/g, v: 300 },
    { w: /நானூறு/g, v: 400 },
    { w: /ஐந்நூறு/g, v: 500 },
    { w: /அறுநூறு/g, v: 600 },
    { w: /எழுநூறு/g, v: 700 },
    { w: /எண்ணூறு/g, v: 800 },
    { w: /தொள்ளாயிரம்/g, v: 900 }
  ];

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

// எடிட் செய்யும் வசதி
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

// தொடக்க தேதியை வைத்து மாதங்கள் + நாட்களை கணக்கிடுதல்
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
      `<div class="history-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #e2e8f0;">
        <span>${i.desc} <br><small style="color:gray;">${i.datetime}</small></span>
        <div>
          <span class="${i.type}" style="font-weight:bold; margin-right:8px; color:${i.type==='in'?'#16a34a':'#dc2626'};">₹${i.amt}</span> 
          <button style="background:#e2e8f0; border:none; padding:5px 8px; border-radius:6px; cursor:pointer;" onclick="editItem('salary', ${idx})">✏️</button> 
          <button style="background:#fee2e2; color:#dc2626; border:none; padding:5px 8px; border-radius:6px; cursor:pointer;" onclick="deleteItem('salary', ${idx})">🗑️</button>
        </div>
      </div>`
    ).reverse().join('');
  }

  // 2. வீடு
  let homeBal = db.home.reduce((acc, item) => item.type === 'in' ? acc + item.amt : acc - item.amt, 0);
  if(document.getElementById('bal-home')) document.getElementById('bal-home').innerText = homeBal;
  if(document.getElementById('hist-home')) {
    document.getElementById('hist-home').innerHTML = db.home.map((i, idx) => 
      `<div class="history-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #e2e8f0;">
        <span>${i.desc} <br><small style="color:gray;">${i.datetime}</small></span>
        <div>
          <span class="${i.type}" style="font-weight:bold; margin-right:8px; color:${i.type==='in'?'#16a34a':'#dc2626'};">₹${i.amt}</span> 
          <button style="background:#e2e8f0; border:none; padding:5px 8px; border-radius:6px; cursor:pointer;" onclick="editItem('home', ${idx})">✏️</button> 
          <button style="background:#fee2e2; color:#dc2626; border:none; padding:5px 8px; border-radius:6px; cursor:pointer;" onclick="deleteItem('home', ${idx})">🗑️</button>
        </div>
      </div>`
    ).reverse().join('');
  }

  // 3. கொள்ளை
  let kollaiTotal = db.kollai.reduce((acc, item) => acc + item.amt, 0);
  if(document.getElementById('total-kollai')) document.getElementById('total-kollai').innerText = kollaiTotal;
  if(document.getElementById('hist-kollai')) {
    document.getElementById('hist-kollai').innerHTML = db.kollai.map((i, idx) => 
      `<div class="history-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #e2e8f0;">
        <span>${i.desc} <br><small style="color:gray;">${i.datetime}</small></span>
        <div>
          <span class="out" style="font-weight:bold; margin-right:8px; color:#dc2626;">₹${i.amt}</span> 
          <button style="background:#e2e8f0; border:none; padding:5px 8px; border-radius:6px; cursor:pointer;" onclick="editItem('kollai', ${idx})">✏️</button> 
          <button style="background:#fee2e2; color:#dc2626; border:none; padding:5px 8px; border-radius:6px; cursor:pointer;" onclick="deleteItem('kollai', ${idx})">🗑️</button>
        </div>
      </div>`
    ).reverse().join('');
  }

  // 4. வட்டி
  renderVatti();

  // 5. நோட்பேட்
  if(document.getElementById('hist-notes')) {
    document.getElementById('hist-notes').innerHTML = db.notes.map((n, idx) => 
      `<div class="history-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #e2e8f0;">
        <span>${n.text} <br><small style="color:gray;">${n.datetime}</small></span>
        <button style="background:#fee2e2; color:#dc2626; border:none; padding:5px 8px; border-radius:6px; cursor:pointer;" onclick="deleteItem('notes', ${idx})">🗑️</button>
      </div>`
    ).reverse().join('');
  }
}

// வட்டி கார்டு டிசைன்
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
      <div class="vatti-card" style="background:#f8fafc; border:1.5px solid #cbd5e1; padding:14px; border-radius:14px; margin-bottom:12px; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
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
          <button style="background:#2563eb; color:white; border:none; padding:8px; border-radius:8px; font-weight:bold; flex:1; cursor:pointer;" onclick="editItem('vatti', ${idx})">✏️ எடிட்</button>
          <button style="background:#dc2626; color:white; border:none; padding:8px; border-radius:8px; font-weight:bold; flex:1; cursor:pointer;" onclick="deleteItem('vatti', ${idx})">🗑️ நீக்கு</button>
          <button style="background:#16a34a; color:white; border:none; padding:8px; border-radius:8px; font-weight:bold; flex:1; cursor:pointer;" onclick="downloadPersonPDF('${i.name}')">📄 PDF</button>
        </div>
      </div>`;
  });
}

// மேனுவல் பதிவுகள்
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

// வட்டி சேர் பட்டன்
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

// AI குரல் பதிவை அலசி ஆராயும்NLP லோஜிக்
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

  // 2. பழைய கணக்கில் சேர்ப்பதா / புதிய கணக்கா
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
    let words = rawText.split(' ');
    let name = words[0] && isNaN(words[0]) ? words[0] : "நபர்";

    // பேச்சில் வரும் தேதியைக் கண்டறிதல் (எ.கா: 3 6 2026 அல்லது 3/6/2026)
    let dateMatch = rawText.match(/\d{1,2}[\/\-.\s]\d{1,2}[\/\-.\s]\d{2,4}/);
    let todayStr = new Date().toLocaleDateString('en-GB');
    let entryDate = todayStr;

    if (dateMatch) {
      let rawDateParts = dateMatch[0].trim().split(/[\/\-.\s]+/);
      if (rawDateParts.length >= 3) {
        let d = rawDateParts[0].padStart(2, '0');
        let m = rawDateParts[1].padStart(2, '0');
        let y = rawDateParts[2].length === 2 ? '20' + rawDateParts[2] : rawDateParts[2];
        entryDate = `${d}/${m}/${y}`;
      }
    }

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

// UI பட்டன்களுக்கு இன்லைன் ஸ்டைல் சேர்ப்பது
document.addEventListener('DOMContentLoaded', () => {
  renderData();

  // அனுப்பு, பேசு, அழி பட்டன்களுக்கு அழகான ஸ்டைல்
  const btns = document.querySelectorAll('button');
  btns.forEach(btn => {
    if (btn.innerText.includes('அனுப்பு')) {
      btn.style.cssText = "background-color:#2563eb; color:white; border:none; padding:8px 14px; border-radius:8px; font-weight:bold; margin:2px; cursor:pointer;";
    } else if (btn.innerText.includes('பேசு')) {
      btn.style.cssText = "background-color:#16a34a; color:white; border:none; padding:8px 14px; border-radius:8px; font-weight:bold; margin:2px; cursor:pointer;";
    } else if (btn.innerText.includes('அழி')) {
      btn.style.cssText = "background-color:#dc2626; color:white; border:none; padding:8px 14px; border-radius:8px; font-weight:bold; margin:2px; cursor:pointer;";
    } else if (btn.innerText.includes('வட்டி சேர்')) {
      btn.style.cssText = "background-color:#10b981; color:white; border:none; padding:12px; border-radius:10px; font-weight:bold; font-size:16px; width:100%; margin-top:10px; cursor:pointer;";
    }
  });
});
