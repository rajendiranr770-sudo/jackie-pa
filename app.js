// LocalStorage Initialization
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

function parseTamilNumbers(text) {
  let parsed = text;
  parsed = parsed.replace(/இருபதாயிரம்|20 ஆயிரம்/g, '20000')
                .replace(/பத்தாயிரம்|10 ஆயிரம்/g, '10000')
                .replace(/ஐயாயிரம்|அஞ்சாயிரம்|5 ஆயிரம்/g, '5000')
                .replace(/நாலாயிரம்|4 ஆயிரம்/g, '4000')
                .replace(/மூன்றாயிரம்|3 ஆயிரம்/g, '3000')
                .replace(/இரண்டாயிரம்|2 ஆயிரம்/g, '2000')
                .replace(/ஆயிரம்|1 ஆயிரம்/g, '1000');
  return parsed;
}

function getDateTime() {
  const now = new Date();
  return now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addChat(msg, isUser = false) {
  const chatBox = document.getElementById('chatBox');
  const div = document.createElement('div');
  div.className = `msg ${isUser ? 'user' : 'bot'}`;
  div.innerText = msg;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
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
  const parsedText = parseTamilNumbers(rawText);
  const datetime = getDateTime();

  // 1. நிலுவையில் உள்ள கேள்விக்கு பதில் அளித்திருந்தால் (Pending Expense / Kollai Response)
  if (pendingExpense) {
    if (/(சம்பளம்|சம்பளத்தில்|சம்பள பணத்தில்|1)/.test(parsedText)) {
      // சம்பளக் கணக்கிலிருந்து மைனஸ் செய்ய
      db.salary.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, type: 'out', datetime });
      
      // கொல்லை செலவாக இருந்தால் கொல்லைப் பட்டியலிலும் சேர்க்கப்படும்
      if (pendingExpense.isKollai) {
        db.kollai.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, datetime });
        addChat(`சரி பாலாஜி சார், ₹${pendingExpense.amt} கொல்லைச் செலவாகப் பதிவாகி, சம்பளக் கணக்கில் மைனஸ் செய்யப்பட்டது! 💼🌱`, false);
      } else {
        addChat(`சரி பாலாஜி சார், ₹${pendingExpense.amt} சம்பளக் கணக்கில் செலவாகச் சேர்க்கப்பட்டது! 💼`, false);
      }
      
      pendingExpense = null;
      saveData();
      return;
    } else if (/(வீடு|வீட்டில்|வீட்டு பணத்தில்|2)/.test(parsedText)) {
      // வீட்டுக் கணக்கிலிருந்து மைனஸ் செய்ய
      db.home.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, type: 'out', datetime });
      
      // கொல்லை செலவாக இருந்தால் கொல்லைப் பட்டியலிலும் சேர்க்கப்படும்
      if (pendingExpense.isKollai) {
        db.kollai.push({ desc: pendingExpense.desc, amt: pendingExpense.amt, datetime });
        addChat(`சரி பாலாஜி சார், ₹${pendingExpense.amt} கொல்லைச் செலவாகப் பதிவாகி, வீட்டுக் கணக்கில் மைனஸ் செய்யப்பட்டது! 🏠🌱`, false);
      } else {
        addChat(`சரி பாலாஜி சார், ₹${pendingExpense.amt} வீட்டுக் கணக்கில் செலவாகச் சேர்க்கப்பட்டது! 🏠`, false);
      }
      
      pendingExpense = null;
      saveData();
      return;
    }
  }

  // 2. தொகையைக் கண்டறிதல்
  let cleanTextForNum = parsedText.replace(/,/g, '');
  let numMatch = cleanTextForNum.match(/\d+/);
  let amt = numMatch ? parseInt(numMatch[0]) : null;

  // 3. கொல்லை செலவு கண்டறிதல் (Kollai Expense Logic)
  if (parsedText.includes('கொல்லை')) {
    if (amt) {
      pendingExpense = { desc: rawText, amt: amt, isKollai: true };
      addChat(`பாலாஜி சார், ₹${amt} கொல்லைச் செலவை "சம்பளப் பணம்"-இல் கழிக்கவா அல்லது "வீட்டுப் பணம்"-இல் கழிக்கவா?`, false);
    } else {
      db.notes.push({ text: rawText, datetime });
      saveData();
      addChat(`நோட்பேடில் குறிப்பு எடுக்கப்பட்டது! 📝`, false);
    }
    return;
  }

  // 4. வட்டி கணக்கு (Vatti Detection)
  if (parsedText.includes('வட்டி') || parsedText.includes('பைசா')) {
    let numbers = cleanTextForNum.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      let nums = numbers.map(Number);
      let vattiAmt = Math.max(...nums);
      let rate = nums.length > 1 ? Math.min(...nums) : 3;

      let name = "நபர்";
      let match = rawText.match(/([a-zA-Aஅ-ஹ்]+)(க்கு|விடம்|இடம்)/);
      if (match && !/(வட்டி|பைசா|பணம்)/.test(match[1])) {
        name = match[1];
      }

      let todayStr = new Date().toLocaleDateString('en-GB');
      db.vatti.push({ name, amt: vattiAmt, rate, date: todayStr, datetime });
      saveData();
      addChat(`சரி பாலாஜி சார்! ${name} வட்டி கணக்கில் சேர்க்கப்பட்டார்.\n• அசல்: ₹${vattiAmt}\n• வட்டி: ${rate}%\n• தேதி: ${todayStr}`, false);
      return;
    }
  }

  // எண்கள் எதுவும் இல்லை என்றால் நோட்பேடிற்குச் செல்ல
  if (!amt) {
    db.notes.push({ text: rawText, datetime });
    saveData();
    addChat(`நோட்பேடில் குறிப்பு எடுக்கப்பட்டது! 📝`, false);
    return;
  }

  // 5. வரவா / செலவா எனக் கண்டறிதல் (Income vs Expense)
  const isIncome = /(வந்தது|வந்திருக்கு|கொடுத்தாங்க|கொடுத்தார்கள்|கிடைத்தது|சேர்ந்தது|வரவு)/.test(parsedText);

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
  } else {
    // நேரடி செலவு
    if (/(சம்பளம்|சம்பளத்தில்|சம்பள பணத்தில்)/.test(parsedText)) {
      db.salary.push({ desc: rawText, amt, type: 'out', datetime });
      saveData();
      addChat(`சரி பாலாஜி சார், ₹${amt} சம்பளக் கணக்கில் செலவாகப் பதிவு செய்யப்பட்டது! 💼`, false);
    } else if (/(வீடு|வீட்டு|வீட்டு பணத்தில்)/.test(parsedText)) {
      db.home.push({ desc: rawText, amt, type: 'out', datetime });
      saveData();
      addChat(`சரி பாலாஜி சார், ₹${amt} வீட்டுக் கணக்கில் செலவாகப் பதிவு செய்யப்பட்டது! 🏠`, false);
    } else {
      pendingExpense = { desc: rawText, amt: amt, isKollai: false };
      addChat(`பாலாஜி சார், ₹${amt} செலவை "சம்பளப் பணம்"-இல் கழிக்கவா அல்லது "வீட்டுப் பணம்"-இல் கழிக்கவா?`, false);
    }
  }
}
