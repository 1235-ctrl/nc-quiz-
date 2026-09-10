const $ = (sel) => document.querySelector(sel);

const LS = {
  records: "nc_records",
  favorites: "nc_favorites",
  custom: "nc_custom_questions",
  banks: "nc_custom_banks",
};

const STATE = {
  banks: [],
  questions: [],
  route: "home",
  bankId: null,
  questionId: null,
  practice: null,
};

const TYPE_MAP = {
  judge: { name: "判断题", cls: "judge" },
  fill: { name: "填空题", cls: "fill" },
  single: { name: "单选题", cls: "single" },
  multiple: { name: "多选题", cls: "multiple" },
};

function getRecords() {
  try { return JSON.parse(localStorage.getItem(LS.records)) || {}; }
  catch { return {}; }
}
function saveRecords(r) { localStorage.setItem(LS.records, JSON.stringify(r)); }

function getFavorites() {
  try { return JSON.parse(localStorage.getItem(LS.favorites)) || []; }
  catch { return []; }
}
function saveFavorites(f) { localStorage.setItem(LS.favorites, JSON.stringify(f)); }

function getCustomQuestions() {
  try { return JSON.parse(localStorage.getItem(LS.custom)) || []; }
  catch { return []; }
}
function saveCustomQuestions(q) { localStorage.setItem(LS.custom, JSON.stringify(q)); }

function getCustomBanks() {
  try { return JSON.parse(localStorage.getItem(LS.banks)) || []; }
  catch { return []; }
}
function saveCustomBanks(b) { localStorage.setItem(LS.banks, JSON.stringify(b)); }

function getAllBanks() {
  return [...STATE.banks, ...getCustomBanks()];
}

function getAllQuestions() {
  return [...STATE.questions, ...getCustomQuestions()];
}

function getQuestion(qid) {
  return getAllQuestions().find(q => q.question_id === qid);
}

function normalizeAnswer(s) {
  if (s === null || s === undefined) return "";
  return String(s).trim().replace(/\s+/g, " ");
}

function judgeAnswer(question, userAnswer) {
  const qtype = question.type;
  const std = normalizeAnswer(question.standard_answer);
  const ua = normalizeAnswer(userAnswer);

  if (qtype === "judge") {
    const trueSet = new Set(["正确", "对", "是", "true", "t", "1", "√"]);
    const falseSet = new Set(["错误", "错", "否", "false", "f", "0", "×"]);
    const toBool = (x) => {
      const l = x.toLowerCase();
      if (trueSet.has(l)) return true;
      if (falseSet.has(l)) return false;
      return null;
    };
    const a = toBool(ua);
    const b = toBool(std);
    if (a === null || b === null) return false;
    return a === b;
  }

  if (qtype === "single") {
    return ua.toUpperCase() === std.toUpperCase();
  }

  if (qtype === "multiple") {
    const splitChoices = (x) => new Set((x.match(/[A-Za-z]/g) || []).map(c => c.toUpperCase()));
    const a = splitChoices(ua);
    const b = splitChoices(std);
    if (a.size !== b.size) return false;
    for (const c of a) if (!b.has(c)) return false;
    return true;
  }

  if (qtype === "fill") {
    const accepted = (question.accepted_answers || []).map(normalizeAnswer);
    if (std && !accepted.includes(std)) accepted.push(std);
    const uaLower = ua.toLowerCase();
    for (const a of accepted) {
      if (a && a.toLowerCase() === uaLower) return true;
    }
    return false;
  }
  return false;
}

function addRecord(questionId, answer, correct) {
  const records = getRecords();
  if (!records[questionId]) records[questionId] = [];
  records[questionId].push({ answer, correct, time: new Date().toISOString() });
  saveRecords(records);
}

function getQuestionStats(qid) {
  const records = getRecords()[qid] || [];
  const correct = records.filter(r => r.correct).length;
  const wrong = records.filter(r => !r.correct).length;
  const last = records.length ? records[records.length - 1].time : null;
  return {
    attempt_count: records.length,
    correct_count: correct,
    wrong_count: wrong,
    last_answered_at: last,
    last_wrong_answer: records.filter(r => !r.correct).slice(-1)[0]?.answer || "",
  };
}

function getWrongQuestions() {
  const records = getRecords();
  const wrongIds = new Set();
  for (const qid in records) {
    if (records[qid].some(r => !r.correct)) wrongIds.add(Number(qid));
  }
  return getAllQuestions()
    .filter(q => wrongIds.has(q.question_id))
    .map(q => ({ ...q, stats: getQuestionStats(q.question_id) }));
}

function getOverallStats() {
  const all = getAllQuestions();
  const records = getRecords();
  let totalRecords = 0, correctRecords = 0, todayRecords = 0, todayCorrect = 0;
  const wrongSet = new Set();
  const today = new Date().toISOString().slice(0, 10);
  for (const qid in records) {
    for (const r of records[qid]) {
      totalRecords++;
      if (r.correct) correctRecords++;
      else wrongSet.add(Number(qid));
      if (r.time.slice(0, 10) === today) {
        todayRecords++;
        if (r.correct) todayCorrect++;
      }
    }
  }
  return {
    total_questions: all.length,
    total_records: totalRecords,
    correct_records: correctRecords,
    wrong_questions: wrongSet.size,
    favorite_questions: getFavorites().length,
    today_records: todayRecords,
    today_correct: todayCorrect,
    accuracy: totalRecords ? Math.round(correctRecords / totalRecords * 1000) / 10 : 0,
    today_accuracy: todayRecords ? Math.round(todayCorrect / todayRecords * 1000) / 10 : 0,
  };
}

function isFavorite(qid) {
  return getFavorites().includes(qid);
}

function toggleFavorite(qid) {
  const favs = getFavorites();
  const idx = favs.indexOf(qid);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(qid);
  saveFavorites(favs);
  return favs.includes(qid);
}

function getDoneQuestionIds() {
  return new Set(Object.keys(getRecords()).map(Number));
}

function go(route, params = {}) {
  STATE.route = route;
  Object.assign(STATE, params);
  render();
  window.scrollTo(0, 0);
}

function navBar(title, right = "") {
  return `<div class="nav">
    <div class="title">${title}</div>
    ${right}
  </div>`;
}

function typeTag(t) {
  const m = TYPE_MAP[t] || { name: t, cls: "" };
  return `<span class="tag ${m.cls}">${m.name}</span>`;
}

function render() {
  const app = $("#app");
  switch (STATE.route) {
    case "home": renderHome(); break;
    case "bank": renderBank(); break;
    case "question-form": renderQuestionForm(); break;
    case "practice-setup": renderPracticeSetup(); break;
    case "practice": renderPractice(); break;
    case "practice-result": renderPracticeResult(); break;
    case "wrong": renderWrong(); break;
    case "favorite": renderFavorite(); break;
    case "question-detail": renderQuestionDetail(); break;
    case "ocr": renderOcr(); break;
    default: renderHome();
  }
  renderBottomNav();
}

function renderBottomNav() {
  const active = STATE.route;
  const items = [
    { k: "home", label: "首页", icon: "🏠" },
    { k: "wrong", label: "错题本", icon: "📕" },
    { k: "favorite", label: "收藏", icon: "⭐" },
  ];
  let html = `<div class="bottom-nav">`;
  for (const it of items) {
    const cls = active === it.k ? "active" : "";
    html += `<button class="${cls}" data-nav="${it.k}"><span class="ic">${it.icon}</span>${it.label}</button>`;
  }
  html += `</div>`;
  const old = $(".bottom-nav");
  if (old) old.remove();
  $("#app").insertAdjacentHTML("beforeend", html);
  document.querySelectorAll(".bottom-nav button").forEach(b => {
    b.onclick = () => go(b.dataset.nav);
  });
}

function renderHome() {
  const app = $("#app");
  app.innerHTML = navBar("数控考试刷题", `<button onclick="showCreateBank()">+ 题库</button>`);
  app.insertAdjacentHTML("beforeend", `<div class="page" id="body"></div>`);
  const body = $("#body");
  const stats = getOverallStats();
  const banks = getAllBanks();
  const allQ = getAllQuestions();

  let html = `<div class="grid">
    <div class="stat"><div class="num">${stats.total_questions}</div><div class="lbl">题目总数</div></div>
    <div class="stat"><div class="num">${stats.today_records}</div><div class="lbl">今日刷题</div></div>
    <div class="stat"><div class="num">${stats.accuracy}%</div><div class="lbl">总正确率</div></div>
    <div class="stat"><div class="num">${stats.wrong_questions}</div><div class="lbl">错题数</div></div>
  </div>`;
  html += `<h3 style="margin:18px 0 10px;">快捷功能</h3>
    <div class="grid">
      <button class="btn" onclick="go('ocr')">📷 拍照录题</button>
      <button class="btn secondary" onclick="go('wrong')">📕 错题本</button>
    </div>
    <h3 style="margin:18px 0 10px;">我的题库</h3>`;
  if (banks.length === 0) {
    html += `<div class="empty"><div class="big">📚</div>还没有题库，点击右上角创建</div>`;
  } else {
    for (const b of banks) {
      const qs = allQ.filter(q => q.bank_id === b.bank_id);
      const judge = qs.filter(q => q.type === "judge").length;
      const fill = qs.filter(q => q.type === "fill").length;
      html += `<div class="card bank-item">
        <div class="info" onclick="go('bank',{bankId:${b.bank_id}})">
          <div class="name">${b.name}</div>
          <div class="desc">共 ${qs.length} 题 · 判断 ${judge} · 填空 ${fill}</div>
        </div>
        <div class="row" style="flex:0 0 auto;gap:6px;">
          <button class="btn small" onclick="go('practice-setup',{bankId:${b.bank_id}})">刷题</button>
          <button class="btn small danger" onclick="delBank(${b.bank_id})">删</button>
        </div>
      </div>`;
    }
  }
  body.innerHTML = html;
}

function showCreateBank() {
  const name = prompt("请输入题库名称：");
  if (!name) return;
  const banks = getCustomBanks();
  const maxId = banks.length ? Math.max(...banks.map(b => b.bank_id)) : 1000;
  banks.push({
    bank_id: maxId + 1,
    name,
    description: "",
    created_at: new Date().toISOString(),
  });
  saveCustomBanks(banks);
  render();
}

function delBank(id) {
  if (!confirm("确定删除该题库及其所有题目？")) return;
  const banks = getCustomBanks().filter(b => b.bank_id !== id);
  saveCustomBanks(banks);
  const qs = getCustomQuestions().filter(q => q.bank_id !== id);
  saveCustomQuestions(qs);
  render();
}

function renderBank() {
  const app = $("#app");
  app.innerHTML = navBar("题库详情", `<button onclick="go('home')">返回</button>`);
  app.insertAdjacentHTML("beforeend", `<div class="page" id="body"></div>`);
  const body = $("#body");
  const questions = getAllQuestions().filter(q => q.bank_id === STATE.bankId);
  window._bankQuestions = questions;
  let html = `<div class="card">
      <div class="row">
        <button class="btn success block" onclick="go('question-form',{bankId:${STATE.bankId},questionId:null})">+ 添加题目</button>
        <button class="btn block" onclick="go('practice-setup',{bankId:${STATE.bankId}})">开始刷题</button>
      </div>
    </div>`;
  html += `<div class="card"><input placeholder="搜索题目内容、答案..." id="search" oninput="filterQ()"></div>`;
  html += `<div id="qlist"></div>`;
  body.innerHTML = html;
  drawQList(questions);
}

function filterQ() {
  const kw = ($("#search").value || "").trim();
  const list = window._bankQuestions || [];
  const filtered = kw ? list.filter(q =>
    q.content.includes(kw) || (q.standard_answer || "").includes(kw) || (q.explanation || "").includes(kw)
  ) : list;
  drawQList(filtered);
}

function drawQList(questions) {
  const box = $("#qlist");
  if (!box) return;
  if (questions.length === 0) {
    box.innerHTML = `<div class="empty">暂无题目</div>`;
    return;
  }
  let html = "";
  for (const q of questions) {
    html += `<div class="card">
      <div class="q-meta">${typeTag(q.type)} ${q.original_number ? "第" + q.original_number + "题" : ""}</div>
      <div class="q-content" style="font-size:15px;">${q.content.slice(0, 100)}${q.content.length > 100 ? "..." : ""}</div>
      <div class="row">
        <button class="btn small" onclick="go('question-form',{bankId:${q.bank_id},questionId:${q.question_id}})">编辑</button>
        <button class="btn small secondary" onclick="go('question-detail',{questionId:${q.question_id}})">详情</button>
        <button class="btn small danger" onclick="delQ(${q.question_id})">删除</button>
      </div>
    </div>`;
  }
  box.innerHTML = html;
}

function delQ(id) {
  if (!confirm("确定删除该题目？")) return;
  const qs = getCustomQuestions().filter(q => q.question_id !== id);
  saveCustomQuestions(qs);
  render();
}

function renderQuestionForm() {
  const app = $("#app");
  app.innerHTML = navBar(STATE.questionId ? "编辑题目" : "添加题目", `<button onclick="history.back()">返回</button>`);
  app.insertAdjacentHTML("beforeend", `<div class="page" id="body"></div>`);
  const body = $("#body");
  let q = { type: "judge", content: "", standard_answer: "", accepted_answers: [], explanation: "", original_number: "", options: [] };
  if (STATE.questionId) {
    const found = getQuestion(STATE.questionId);
    if (found) q = { ...q, ...found };
  }
  const acc = (q.accepted_answers || []).join("\n");
  const opts = (q.options || []).join("\n");
  body.innerHTML = `
    <div class="card">
      <label>题型</label>
      <select id="f_type">
        <option value="judge" ${q.type==='judge'?'selected':''}>判断题</option>
        <option value="fill" ${q.type==='fill'?'selected':''}>填空题</option>
        <option value="single" ${q.type==='single'?'selected':''}>单选题</option>
        <option value="multiple" ${q.type==='multiple'?'selected':''}>多选题</option>
      </select>
      <label>原始题号</label>
      <input id="f_num" value="${q.original_number||''}" placeholder="可选">
      <label>题目内容</label>
      <textarea id="f_content">${q.content}</textarea>
      <div id="f_options_area" style="${q.type==='single'||q.type==='multiple'?'':'display:none;'}">
        <label>选项（每行一个，前面可加 A. B. 等）</label>
        <textarea id="f_options">${opts}</textarea>
      </div>
      <label>标准答案</label>
      <input id="f_std" value="${q.standard_answer||''}" placeholder="判断题填 正确/错误；单选填 A；多选填 ABC；填空填主要答案">
      <div id="f_acc_area" style="${q.type==='fill'?'':'display:none;'}">
        <label>可接受答案（每行一个，填空用）</label>
        <textarea id="f_acc" placeholder="CNC&#10;CNC系统">${acc}</textarea>
      </div>
      <label>解析</label>
      <textarea id="f_exp">${q.explanation||''}</textarea>
      <div style="margin-top:14px;">
        <button class="btn block" onclick="saveQ()">保存</button>
      </div>
    </div>
  `;
  $("#f_type").onchange = (e) => {
    const t = e.target.value;
    $("#f_options_area").style.display = (t === "single" || t === "multiple") ? "" : "none";
    $("#f_acc_area").style.display = t === "fill" ? "" : "none";
  };
}

function saveQ() {
  const type = $("#f_type").value;
  const content = $("#f_content").value.trim();
  const std = $("#f_std").value.trim();
  if (!content) return alert("题目内容不能为空");
  if (!std) return alert("标准答案不能为空");
  const num = $("#f_num").value.trim();
  const optsRaw = $("#f_options").value.split("\n").map(s => s.trim()).filter(Boolean);
  const accRaw = $("#f_acc").value.split("\n").map(s => s.trim()).filter(Boolean);

  if (STATE.questionId) {
    const qs = getCustomQuestions();
    const idx = qs.findIndex(q => q.question_id === STATE.questionId);
    if (idx >= 0) {
      qs[idx] = {
        ...qs[idx],
        type, content, standard_answer: std,
        accepted_answers: accRaw,
        explanation: $("#f_exp").value,
        original_number: num ? parseInt(num) : null,
        options: optsRaw,
      };
      saveCustomQuestions(qs);
    }
    go("bank", { bankId: STATE.bankId });
  } else {
    const qs = getCustomQuestions();
    const maxId = qs.length ? Math.max(...qs.map(q => q.question_id)) : 10000;
    qs.push({
      question_id: maxId + 1,
      bank_id: STATE.bankId,
      type, content,
      standard_answer: std,
      accepted_answers: accRaw,
      explanation: $("#f_exp").value,
      original_number: num ? parseInt(num) : null,
      options: optsRaw,
      original_image: "",
      source_page: "",
      tags: [],
      created_at: new Date().toISOString(),
    });
    saveCustomQuestions(qs);
    go("bank", { bankId: STATE.bankId });
  }
}

function renderQuestionDetail() {
  const app = $("#app");
  app.innerHTML = navBar("题目详情", `<button onclick="history.back()">返回</button>`);
  app.insertAdjacentHTML("beforeend", `<div class="page" id="body"></div>`);
  const body = $("#body");
  const q = getQuestion(STATE.questionId);
  if (!q) { body.innerHTML = `<div class="empty">题目不存在</div>`; return; }
  const s = getQuestionStats(q.question_id);
  body.innerHTML = `<div class="card">
      <div class="q-meta">${typeTag(q.type)} 标准答案：<b>${q.standard_answer}</b></div>
      <div class="q-content">${q.content}</div>
      ${q.options && q.options.length ? `<div>${q.options.map(o => `<div>${o}</div>`).join("")}</div>` : ""}
      ${q.accepted_answers && q.accepted_answers.length ? `<div style="margin-top:10px;color:#666;">可接受答案：${q.accepted_answers.join(" / ")}</div>` : ""}
      ${q.explanation ? `<div style="margin-top:10px;"><b>解析：</b>${q.explanation}</div>` : ""}
      ${q.original_image ? `<img class="thumb" src="${q.original_image}">` : ""}
    </div>
    <div class="card">
      <div>答题次数：${s.attempt_count || 0} | 正确：${s.correct_count || 0} | 错误：${s.wrong_count || 0}</div>
      ${s.last_answered_at ? `<div style="color:#888;font-size:13px;margin-top:4px;">最近答题：${s.last_answered_at}</div>` : ""}
    </div>`;
}

function renderPracticeSetup() {
  const app = $("#app");
  app.innerHTML = navBar("刷题设置", `<button onclick="history.back()">返回</button>`);
  app.insertAdjacentHTML("beforeend", `<div class="page" id="body"></div>`);
  const body = $("#body");
  body.innerHTML = `
    <div class="card">
      <label>题型</label>
      <select id="s_type">
        <option value="">全部题型</option>
        <option value="judge">判断题</option>
        <option value="fill">填空题</option>
        <option value="single">单选题</option>
        <option value="multiple">多选题</option>
      </select>
      <label>题目数量（0 表示全部）</label>
      <input id="s_limit" type="number" value="0" min="0">
    </div>
    <div class="card">
      <h3>选择模式</h3>
      <div class="grid" style="margin-top:10px;">
        <button class="btn" onclick="startPractice('order')">顺序刷题</button>
        <button class="btn" onclick="startPractice('random')">随机刷题</button>
        <button class="btn warn" onclick="startPractice('wrong')">错题重刷</button>
        <button class="btn" onclick="startPractice('undone')">未做题</button>
        <button class="btn" onclick="startPractice('favorite')">收藏题</button>
      </div>
    </div>
  `;
}

function startPractice(mode) {
  const type = $("#s_type").value;
  const limit = parseInt($("#s_limit").value) || 0;
  let questions = getAllQuestions();
  if (STATE.bankId) questions = questions.filter(q => q.bank_id === STATE.bankId);
  if (type) questions = questions.filter(q => q.type === type);

  if (mode === "random") {
    questions = shuffle(questions);
  } else if (mode === "wrong") {
    const wrongIds = new Set(getWrongQuestions().map(q => q.question_id));
    questions = questions.filter(q => wrongIds.has(q.question_id));
    questions = shuffle(questions);
  } else if (mode === "favorite") {
    const favs = new Set(getFavorites());
    questions = questions.filter(q => favs.has(q.question_id));
    questions = shuffle(questions);
  } else if (mode === "undone") {
    const done = getDoneQuestionIds();
    questions = questions.filter(q => !done.has(q.question_id));
    questions = shuffle(questions);
  }

  if (limit > 0) questions = questions.slice(0, limit);
  if (questions.length === 0) {
    alert("没有符合条件的题目");
    return;
  }
  STATE.practice = {
    ids: questions.map(q => q.question_id),
    index: 0,
    answers: [],
    mode,
  };
  go("practice");
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderPractice() {
  const app = $("#app");
  const p = STATE.practice;
  const qid = p.ids[p.index];
  const q = getQuestion(qid);
  const fav = isFavorite(qid);
  app.innerHTML = navBar(`第 ${p.index + 1} / ${p.ids.length} 题`, `<button onclick="toggleFavInPractice(${qid})">${fav ? "★" : "☆"}</button>`);
  app.insertAdjacentHTML("beforeend", `<div class="page" id="body"></div>`);
  const body = $("#body");

  const saved = p.answers[p.index];
  let answerHtml = "";
  if (q.type === "judge") {
    answerHtml = `<div class="judge-btns">
      <button class="btn ${saved && saved.answer==='正确'?'success':'secondary'}" data-ans="正确">正确</button>
      <button class="btn ${saved && saved.answer==='错误'?'danger':'secondary'}" data-ans="错误">错误</button>
    </div>`;
  } else if (q.type === "fill") {
    answerHtml = `<input class="fill-input" id="fill_ans" placeholder="请输入答案" value="${saved ? saved.answer : ''}">`;
  } else if (q.type === "single") {
    answerHtml = (q.options || []).map((o, i) => {
      const letter = (o.match(/^([A-Z])[\.、\)]?\s*/) || [])[1] || String.fromCharCode(65 + i);
      return `<button class="option-btn ${saved && saved.answer===letter?'selected':''}" data-ans="${letter}">${o}</button>`;
    }).join("");
  } else if (q.type === "multiple") {
    const selected = saved ? (saved.answer || "").split("") : [];
    answerHtml = (q.options || []).map((o, i) => {
      const letter = (o.match(/^([A-Z])[\.、\)]?\s*/) || [])[1] || String.fromCharCode(65 + i);
      const sel = selected.includes(letter) ? "selected" : "";
      return `<button class="option-btn ${sel}" data-ans="${letter}">${o}</button>`;
    }).join("");
  }

  body.innerHTML = `
    <div class="card">
      <div class="q-meta">${typeTag(q.type)} ${q.original_number ? "第" + q.original_number + "题" : ""}</div>
      <div class="q-content">${q.content}</div>
      <div id="answer_area">${answerHtml}</div>
      ${q.original_image ? `<img class="thumb" src="${q.original_image}">` : ""}
    </div>
    <div id="result_area"></div>
  `;

  bindAnswerEvents(q.type);

  let toolbar = `<div class="toolbar">`;
  toolbar += `<button class="btn secondary" ${p.index === 0 ? "disabled" : ""} onclick="prevQ()">上一题</button>`;
  if (saved && saved.submitted) {
    toolbar += `<button class="btn" onclick="nextQ()">下一题</button>`;
  } else {
    toolbar += `<button class="btn success" onclick="submitAnswer()">提交</button>`;
  }
  toolbar += `</div>`;
  body.insertAdjacentHTML("beforeend", toolbar);

  if (saved && saved.submitted) showResult(saved);
}

function bindAnswerEvents(type) {
  const area = $("#answer_area");
  if (!area) return;
  if (type === "judge") {
    area.querySelectorAll("button").forEach(b => {
      b.onclick = () => {
        area.querySelectorAll("button").forEach(x => { x.classList.remove("success", "danger"); x.classList.add("secondary"); });
        b.classList.remove("secondary");
        b.classList.add(b.dataset.ans === "正确" ? "success" : "danger");
      };
    });
  } else if (type === "single") {
    area.querySelectorAll(".option-btn").forEach(b => {
      b.onclick = () => {
        area.querySelectorAll(".option-btn").forEach(x => x.classList.remove("selected"));
        b.classList.add("selected");
      };
    });
  } else if (type === "multiple") {
    area.querySelectorAll(".option-btn").forEach(b => {
      b.onclick = () => b.classList.toggle("selected");
    });
  }
}

function getSelectedAnswer(type) {
  const area = $("#answer_area");
  if (type === "judge") {
    const b = area.querySelector(".success, .danger");
    return b ? b.dataset.ans : "";
  }
  if (type === "fill") return $("#fill_ans").value;
  if (type === "single") {
    const b = area.querySelector(".option-btn.selected");
    return b ? b.dataset.ans : "";
  }
  if (type === "multiple") {
    return [...area.querySelectorAll(".option-btn.selected")].map(b => b.dataset.ans).sort().join("");
  }
  return "";
}

function submitAnswer() {
  const p = STATE.practice;
  const qid = p.ids[p.index];
  const q = getQuestion(qid);
  const ans = getSelectedAnswer(q.type);
  if (q.type === "fill" && !ans.trim()) return alert("请输入答案");
  if (q.type !== "fill" && !ans) return alert("请选择答案");
  const correct = judgeAnswer(q, ans);
  addRecord(qid, ans, correct);
  const record = {
    answer: ans,
    correct,
    standard_answer: q.standard_answer,
    accepted_answers: q.accepted_answers || [],
    explanation: q.explanation || "",
    submitted: true,
  };
  p.answers[p.index] = record;
  showResult(record);
  const tb = $(".toolbar");
  if (tb) {
    tb.innerHTML = `<button class="btn secondary" ${p.index === 0 ? "disabled" : ""} onclick="prevQ()">上一题</button>
      <button class="btn" onclick="nextQ()">下一题</button>`;
  }
}

function showResult(r) {
  const box = $("#result_area");
  if (!box) return;
  const cls = r.correct ? "correct" : "wrong";
  const title = r.correct ? "✓ 回答正确" : "✗ 回答错误";
  let html = `<div class="result-box ${cls}"><div class="row1">${title}</div>`;
  if (!r.correct) html += `<div>你的答案：${r.answer || "(空)"}</div>`;
  html += `<div>正确答案：${r.standard_answer}</div>`;
  if (r.accepted_answers && r.accepted_answers.length) {
    html += `<div>可接受答案：${r.accepted_answers.join(" / ")}</div>`;
  }
  if (r.explanation) html += `<div style="margin-top:8px;"><b>解析：</b>${r.explanation}</div>`;
  html += `</div>`;
  box.innerHTML = html;
}

function prevQ() {
  const p = STATE.practice;
  if (p.index > 0) { p.index--; render(); }
}

function nextQ() {
  const p = STATE.practice;
  if (p.index < p.ids.length - 1) { p.index++; render(); }
  else go("practice-result");
}

function toggleFavInPractice(qid) {
  toggleFavorite(qid);
  render();
}

function renderPracticeResult() {
  const p = STATE.practice;
  const answers = p.answers;
  const total = p.ids.length;
  const done = answers.filter(a => a && a.submitted).length;
  const correct = answers.filter(a => a && a.submitted && a.correct).length;
  const wrong = done - correct;
  const acc = done ? Math.round(correct / done * 100) : 0;
  const app = $("#app");
  app.innerHTML = navBar("练习结果", `<button onclick="go('home')">首页</button>`);
  app.insertAdjacentHTML("beforeend", `<div class="page" id="body"></div>`);
  const body = $("#body");
  body.innerHTML = `
    <div class="card summary">
      <div class="big">${acc}%</div>
      <div class="sub">正确率</div>
      <div class="grid" style="margin-top:16px;">
        <div class="stat"><div class="num">${total}</div><div class="lbl">总题数</div></div>
        <div class="stat"><div class="num">${correct}</div><div class="lbl">正确</div></div>
        <div class="stat"><div class="num">${wrong}</div><div class="lbl">错误</div></div>
      </div>
    </div>
    <div class="card">
      <div class="row">
        <button class="btn block" onclick="reviewWrong()">查看错题</button>
        <button class="btn success block" onclick="restartPractice()">重新练习</button>
      </div>
    </div>
    <div id="review_area"></div>
  `;
}

function reviewWrong() {
  const p = STATE.practice;
  const area = $("#review_area");
  let html = "";
  p.answers.forEach((a, i) => {
    if (a && a.submitted && !a.correct) {
      html += `<div class="card">
        <div class="q-meta">第 ${i + 1} 题</div>
        <div class="result-box wrong">
          <div>你的答案：${a.answer || "(空)"}</div>
          <div>正确答案：${a.standard_answer}</div>
          ${a.explanation ? `<div style="margin-top:6px;"><b>解析：</b>${a.explanation}</div>` : ""}
        </div>
      </div>`;
    }
  });
  area.innerHTML = html || `<div class="empty">没有错题 🎉</div>`;
}

function restartPractice() {
  const p = STATE.practice;
  p.index = 0;
  p.answers = [];
  go("practice");
}

function renderWrong() {
  const app = $("#app");
  app.innerHTML = navBar("错题本");
  app.insertAdjacentHTML("beforeend", `<div class="page" id="body"></div>`);
  const body = $("#body");
  const list = getWrongQuestions();
  if (list.length === 0) {
    body.innerHTML = `<div class="empty"><div class="big">🎉</div>暂无错题</div>`;
    return;
  }
  body.innerHTML = `
    <div class="card">
      <button class="btn block warn" onclick="go('practice-setup')">错题重刷</button>
    </div>
    <div id="wlist"></div>
  `;
  let html = "";
  for (const q of list) {
    html += `<div class="card">
      <div class="q-meta">${typeTag(q.type)} 答${q.stats.attempt_count}次 错${q.stats.wrong_count}次</div>
      <div class="q-content" style="font-size:15px;">${q.content}</div>
      <div class="result-box wrong" style="font-size:14px;">
        <div>最近错误答案：${q.stats.last_wrong_answer || "(空)"}</div>
        <div>正确答案：${q.standard_answer}</div>
      </div>
      <div class="row" style="margin-top:8px;">
        <button class="btn small" onclick="go('question-detail',{questionId:${q.question_id}})">详情</button>
        <button class="btn small" onclick="go('question-form',{bankId:${q.bank_id},questionId:${q.question_id}})">编辑</button>
      </div>
    </div>`;
  }
  $("#wlist").innerHTML = html;
}

function renderFavorite() {
  const app = $("#app");
  app.innerHTML = navBar("收藏题");
  app.insertAdjacentHTML("beforeend", `<div class="page" id="body"></div>`);
  const body = $("#body");
  const favIds = new Set(getFavorites());
  const list = getAllQuestions().filter(q => favIds.has(q.question_id));
  if (list.length === 0) {
    body.innerHTML = `<div class="empty"><div class="big">⭐</div>暂无收藏</div>`;
    return;
  }
  body.innerHTML = `<div class="card">
    <button class="btn block" onclick="go('practice-setup')">刷收藏题</button>
  </div><div id="flist"></div>`;
  let html = "";
  for (const q of list) {
    html += `<div class="card">
      <div class="q-meta">${typeTag(q.type)} 答案：${q.standard_answer}</div>
      <div class="q-content" style="font-size:15px;">${q.content}</div>
      <div class="row" style="margin-top:8px;">
        <button class="btn small" onclick="go('question-detail',{questionId:${q.question_id}})">详情</button>
        <button class="btn small danger" onclick="unfav(${q.question_id})">取消收藏</button>
      </div>
    </div>`;
  }
  $("#flist").innerHTML = html;
}

function unfav(id) {
  toggleFavorite(id);
  render();
}

async function renderOcr() {
  const app = $("#app");
  app.innerHTML = navBar("拍照录题", `<button onclick="go('home')">首页</button>`);
  app.insertAdjacentHTML("beforeend", `<div class="page" id="body"></div>`);
  const body = $("#body");
  const banks = getAllBanks();
  if (banks.length === 0) {
    body.innerHTML = `<div class="empty">请先创建题库</div>`;
    return;
  }
  const bankOpts = banks.map(b => `<option value="${b.bank_id}">${b.name}</option>`).join("");
  body.innerHTML = `
    <div class="card">
      <label>选择题库</label>
      <select id="ocr_bank">${bankOpts}</select>
      <label>题目图片</label>
      <div class="grid" style="grid-template-columns:1fr 1fr;">
        <button class="btn" onclick="document.getElementById('ocr_camera').click()">📷 拍照</button>
        <button class="btn" onclick="document.getElementById('ocr_album').click()">🖼️ 从相册选择</button>
      </div>
      <input type="file" id="ocr_camera" accept="image/*" capture="environment" style="display:none;">
      <input type="file" id="ocr_album" accept="image/*" style="display:none;">
      <div id="ocr_preview" style="margin-top:10px;"></div>
      <div style="margin-top:12px;">
        <button class="btn block" id="ocr_btn" onclick="startOcr()" disabled>开始识别</button>
      </div>
      <div id="ocr_progress" style="display:none;margin-top:10px;">
        <div class="progress"><div id="ocr_bar" style="width:0%"></div></div>
        <div id="ocr_status" style="font-size:13px;color:#666;text-align:center;margin-top:4px;"></div>
      </div>
      <p style="font-size:12px;color:#999;margin-top:8px;">说明：识别在浏览器本地完成，图片不会上传到任何服务器。题目保存在本地浏览器中。</p>
    </div>
    <div id="ocr_result"></div>
  `;
  const handleFile = (f) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      $("#ocr_preview").innerHTML = `<img class="thumb" src="${ev.target.result}" style="max-height:300px;">`;
      window._ocrDataUrl = ev.target.result;
      $("#ocr_btn").disabled = false;
    };
    reader.readAsDataURL(f);
  };
  $("#ocr_camera").onchange = (e) => handleFile(e.target.files[0]);
  $("#ocr_album").onchange = (e) => handleFile(e.target.files[0]);
}

async function startOcr() {
  if (!window._ocrDataUrl) return;
  $("#ocr_btn").disabled = true;
  $("#ocr_progress").style.display = "block";
  $("#ocr_status").textContent = "加载识别引擎...";
  try {
    const { data } = await Tesseract.recognize(window._ocrDataUrl, "chi_sim+eng", {
      logger: m => {
        if (m.status === "recognizing text") {
          const p = Math.round(m.progress * 100);
          $("#ocr_bar").style.width = p + "%";
          $("#ocr_status").textContent = `识别中... ${p}%`;
        } else {
          $("#ocr_status").textContent = m.status;
        }
      }
    });
    showOcrResult(data.text, window._ocrDataUrl);
  } catch (e) {
    $("#ocr_progress").style.display = "none";
    $("#ocr_btn").disabled = false;
    alert("识别失败：" + e.message);
  }
}

function showOcrResult(text, imgUrl) {
  const result = $("#ocr_result");
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const questions = splitQuestions(lines);
  window._ocrQuestions = questions;
  window._ocrImgUrl = imgUrl;

  let html = `<div class="card">
    <h3>识别结果（共 ${questions.length} 题）</h3>
    <p style="font-size:13px;color:#888;margin:6px 0;">请检查并修改每道题，确认后入库。</p>
  </div>`;

  questions.forEach((q, i) => {
    html += `<div class="card" id="qcard_${i}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <b>第 ${i + 1} 题</b>
        <button class="btn small danger" onclick="removeOcrQ(${i})">删除</button>
      </div>
      <label>题型</label>
      <select id="qtype_${i}">
        <option value="judge" ${q.type==='judge'?'selected':''}>判断题</option>
        <option value="fill" ${q.type==='fill'?'selected':''}>填空题</option>
        <option value="single" ${q.type==='single'?'selected':''}>单选题</option>
        <option value="multiple" ${q.type==='multiple'?'selected':''}>多选题</option>
      </select>
      <label>题目内容</label>
      <textarea id="qcontent_${i}" rows="3">${q.content}</textarea>
      <label>标准答案</label>
      <input id="qstd_${i}" value="${q.standard_answer}">
      <label>解析（可选）</label>
      <input id="qexp_${i}" value="${q.explanation||''}">
    </div>`;
  });

  html += `<div class="card">
    <button class="btn success block" onclick="saveOcrQuestions()">确认入库（${questions.length}题）</button>
  </div>`;
  result.innerHTML = html;
  $("#ocr_progress").style.display = "none";
  $("#ocr_btn").disabled = false;
}

function splitQuestions(lines) {
  const questions = [];
  let current = null;
  const qNumRegex = /^(\d+)[\.、\)）]\s*(.*)/;

  for (let line of lines) {
    const m = line.match(qNumRegex);
    if (m) {
      if (current) questions.push(current);
      const rest = m[2];
      let type = "judge";
      let std = "";
      const content = rest;
      const fillMark = rest.match(/_{2,}|____|（\s*）|\(\s*\)/);
      if (fillMark) type = "fill";
      const ansMatch = rest.match(/[（(]([^)）]+)[)）]/);
      if (ansMatch && ansMatch[1].trim()) {
        const a = ansMatch[1].trim();
        if (["正确", "错误", "对", "错", "是", "否", "√", "×", "T", "F", "true", "false"].includes(a)) {
          std = a;
        }
      }
      current = { type, content, standard_answer: std, explanation: "" };
    } else if (current) {
      current.content += "\n" + line;
      if (line.match(/^解析[:：]/)) {
        current.explanation = line.replace(/^解析[:：]\s*/, "");
      }
      if (line.match(/^答案[:：]/)) {
        current.standard_answer = line.replace(/^答案[:：]\s*/, "").trim();
      }
    }
  }
  if (current) questions.push(current);
  return questions;
}

function removeOcrQ(idx) {
  const el = document.getElementById("qcard_" + idx);
  if (el) el.remove();
  window._ocrQuestions[idx] = null;
}

function saveOcrQuestions() {
  const bankId = parseInt($("#ocr_bank").value);
  const qs = window._ocrQuestions;
  const custom = getCustomQuestions();
  let maxId = custom.length ? Math.max(...custom.map(q => q.question_id)) : 10000;
  let count = 0;
  for (let i = 0; i < qs.length; i++) {
    if (!qs[i]) continue;
    const type = document.getElementById("qtype_" + i).value;
    const content = document.getElementById("qcontent_" + i).value.trim();
    const std = document.getElementById("qstd_" + i).value.trim();
    const exp = document.getElementById("qexp_" + i).value.trim();
    if (!content) continue;
    maxId++;
    custom.push({
      question_id: maxId,
      bank_id: bankId,
      type,
      content,
      standard_answer: std || "（待补充）",
      accepted_answers: [],
      explanation: exp,
      original_image: window._ocrImgUrl || "",
      source_page: "",
      tags: [],
      options: [],
      created_at: new Date().toISOString(),
    });
    count++;
  }
  saveCustomQuestions(custom);
  alert(`成功入库 ${count} 道题！`);
  go("bank", { bankId });
}

window.go = go;
window.showCreateBank = showCreateBank;
window.delBank = delBank;
window.filterQ = filterQ;
window.delQ = delQ;
window.saveQ = saveQ;
window.startPractice = startPractice;
window.submitAnswer = submitAnswer;
window.prevQ = prevQ;
window.nextQ = nextQ;
window.toggleFavInPractice = toggleFavInPractice;
window.reviewWrong = reviewWrong;
window.restartPractice = restartPractice;
window.unfav = unfav;
window.startOcr = startOcr;
window.removeOcrQ = removeOcrQ;
window.saveOcrQuestions = saveOcrQuestions;

async function init() {
  const app = $("#app");
  app.innerHTML = `<div class="loading">加载中...</div>`;
  try {
    const res = await fetch("./questions.json");
    const data = await res.json();
    STATE.banks = data.banks || [];
    STATE.questions = data.questions || [];
    render();
  } catch (e) {
    app.innerHTML = `<div class="empty">题库加载失败：${e.message}<br>请使用 HTTP 服务器打开（不要直接双击文件）</div>`;
  }
}

init();