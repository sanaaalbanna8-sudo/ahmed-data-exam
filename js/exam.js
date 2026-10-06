(() => {
  const bank = window.QUESTION_BANK;
  const labels = window.TOPIC_LABELS;
  const letters = ["أ", "ب", "ج"];
  const intro = document.getElementById("intro");
  const quiz = document.getElementById("quiz");
  const result = document.getElementById("result");
  const nameInput = document.getElementById("student-name");
  const classInput = document.getElementById("student-class");
  const hint = document.getElementById("name-hint");
  const choicesBox = document.getElementById("choices");
  const feedback = document.getElementById("feedback");
  const nextBtn = document.getElementById("next-btn");
  const themeBtn = document.getElementById("theme-toggle");

  let deck = [];
  let index = 0;
  let locked = false;
  let studentName = "";
  let studentClass = "";
  let startedAt = 0;

  function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function show(section) {
    [intro, quiz, result].forEach((node) => node.classList.add("hidden"));
    section.classList.remove("hidden");
    section.classList.remove("rise");
    void section.offsetWidth;
    section.classList.add("rise");
  }

  function syncTheme() {
    const dark = document.documentElement.classList.contains("dark");
    themeBtn.textContent = dark ? "المظهر الفاتح" : "المظهر الداكن";
    themeBtn.setAttribute("aria-pressed", String(dark));
  }

  function fillTopics() {
    const list = document.getElementById("topic-list");
    Object.keys(labels).forEach((key) => {
      const count = bank.filter((item) => item.topic === key).length;
      const li = document.createElement("li");
      li.className = "rounded-2xl border border-stone-200 bg-white px-4 py-3 font-bold dark:border-slate-800 dark:bg-slate-900";
      li.textContent = `${labels[key]}: ${count} أسئلة`;
      list.appendChild(li);
    });
  }

  function buildDeck() {
    return shuffle(bank).map((item) => {
      const order = shuffle(item.choices.map((_, choiceIndex) => choiceIndex));
      return {
        ...item,
        order,
        answerAt: order.indexOf(item.answer),
        pick: null
      };
    });
  }

  function renderQuestion() {
    const question = deck[index];
    locked = false;
    document.getElementById("progress-label").textContent = `السؤال ${index + 1} من ${deck.length}`;
    document.getElementById("topic-label").textContent = labels[question.topic];
    document.getElementById("progress").setAttribute("aria-valuemax", String(deck.length));
    document.getElementById("progress").setAttribute("aria-valuenow", String(index + 1));
    document.getElementById("progress-bar").style.width = `${((index + 1) / deck.length) * 100}%`;
    document.getElementById("stem").textContent = question.stem;
    choicesBox.replaceChildren();
    feedback.className = "feedback mt-4 hidden";
    feedback.replaceChildren();
    nextBtn.classList.add("hidden");
    nextBtn.textContent = index === deck.length - 1 ? "إنهاء الامتحان" : "السؤال التالي";

    question.order.forEach((sourceIndex, position) => {
      const label = document.createElement("label");
      label.className = "opt";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "choice";
      input.value = String(position);
      const mark = document.createElement("span");
      mark.className = "mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-extrabold";
      mark.textContent = letters[position];
      const text = document.createElement("span");
      text.textContent = question.choices[sourceIndex];
      label.append(input, mark, text);
      input.addEventListener("change", () => choose(position));
      choicesBox.appendChild(label);
    });
  }

  function choose(position) {
    if (locked) return;
    locked = true;
    const question = deck[index];
    question.pick = position;
    const ok = position === question.answerAt;
    [...choicesBox.querySelectorAll(".opt")].forEach((label, optionIndex) => {
      const input = label.querySelector("input");
      input.disabled = true;
      label.classList.add("is-locked");
      if (optionIndex === question.answerAt) label.classList.add("is-right");
      if (optionIndex === position && !ok) label.classList.add("is-wrong");
    });
    feedback.classList.remove("hidden");
    feedback.classList.add(ok ? "is-ok" : "is-bad");
    const title = document.createElement("p");
    title.className = "font-extrabold";
    title.textContent = ok ? "إجابة صحيحة" : "إجابة خاطئة";
    const why = document.createElement("p");
    why.className = "mt-1";
    why.textContent = question.why;
    feedback.append(title, why);
    if (!ok) {
      const right = document.createElement("p");
      right.className = "mt-2 font-bold";
      right.textContent = `الإجابة المناسبة: ${question.choices[question.order[question.answerAt]]}`;
      feedback.appendChild(right);
    }
    nextBtn.classList.remove("hidden");
  }

  function clock(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function topicScores() {
    const map = {};
    Object.keys(labels).forEach((key) => {
      const rows = deck.filter((item) => item.topic === key);
      const ok = rows.filter((item) => item.pick === item.answerAt).length;
      map[key] = `${ok}/${rows.length}`;
    });
    return map;
  }

  function xml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sheetXml(name, rows) {
    const body = rows.map((row) => {
      const cells = row.map((cell) => `<Cell><Data ss:Type="String">${xml(cell)}</Data></Cell>`).join("");
      return `<Row>${cells}</Row>`;
    }).join("");
    return `<Worksheet ss:Name="${xml(name)}"><Table>${body}</Table></Worksheet>`;
  }

  function downloadExcel(payload) {
    const summary = [[
      "الاسم", "الشعبة", "وقت البدء", "وقت التسليم", "المدة",
      "صحيحة", "خاطئة", "عدد الأسئلة", "النسبة %",
      "البيانات والمعلومات", "الأولية والثانوية", "القرارات والأخطاء", "البنية التحتية والبيانات"
    ], [
      payload.name, payload.klass, payload.startedAt, payload.finishedAt, payload.durationText,
      payload.correct, payload.wrong, payload.total, payload.percent,
      payload.topics.dataInfo, payload.topics.source, payload.topics.decision, payload.topics.infra
    ]];
    const details = [[
      "الاسم", "الشعبة", "رقم السؤال", "المحور", "السؤال",
      "إجابة الطالبة", "الإجابة الصحيحة", "النتيجة", "التفسير"
    ]];
    payload.details.forEach((row) => {
      details.push([
        payload.name, payload.klass, row.num, row.topic, row.stem,
        row.chosen, row.correctText, row.result, row.why
      ]);
    });
    const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${sheetXml("ملخص", summary)}
${sheetXml("تفاصيل", details)}
</Workbook>`;
    const blob = new Blob([workbook], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    const safe = payload.name.replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 40) || "نتيجة";
    link.href = URL.createObjectURL(blob);
    link.download = `نتيجة-${safe}.xls`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function sendToSheet(payload) {
    const status = document.getElementById("save-status");
    const url = window.EXAM_CLOUD && window.EXAM_CLOUD.sheetsUrl;
    downloadExcel(payload);
    if (!url) {
      status.textContent = "نُزّل ملف الإكسل على الجهاز. لجمع كل الطالبات في صفحة واحدة، اربطي رابط الجدول في ملف الإعداد.";
      return;
    }
    status.textContent = "جاري إرسال النتيجة إلى صفحة الإكسل…";
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).then(() => {
      status.textContent = "حُفظت النتيجة في صفحة الإكسل، ونُزّل ملف هذه المحاولة أيضاً.";
    }).catch(() => {
      status.textContent = "تعذّر الوصول إلى الصفحة المشتركة. ملف الإكسل نُزّل على الجهاز.";
    });
  }

  function finish() {
    const correct = deck.filter((item) => item.pick === item.answerAt).length;
    const total = deck.length;
    const percent = Math.round((correct / total) * 100);
    const topics = topicScores();
    const finished = new Date();
    let title = "راجعي الفروق بهدوء";
    let message = "عودي إلى الفرق بين البيان والمعلومة، وبين المصدر الأولي والثانوي، وبين القرار الذي يوافق المعطيات والقرار الذي يخالفها.";
    if (percent >= 90) {
      title = "الفهم واضح";
      message = "ميّزتِ البيانات من المعلومات، والمصدر الأولي من الثانوي، والقرار السليم من الخطأ، وقدّمتِ البيانات على مظهر الأجهزة.";
    } else if (percent >= 75) {
      title = "أساس جيد";
      message = "راجعي الأسئلة الخاطئة تحت. أغلب الفروق مستقرة.";
    } else if (percent >= 50) {
      title = "ثبّتي الفروق";
      message = "الدرجة تظهر أن بعض الفروق ما زالت تختلط، خصوصاً حيث تُختار السرعة أو السعر أو الجهاز على حساب البيانات.";
    }
    document.getElementById("result-title").textContent = title;
    document.getElementById("result-score").textContent = `${correct} صحيحة من ${total}، بنسبة ${percent} في المئة.`;
    document.getElementById("result-msg").textContent = `${studentName}: ${message}`;
    const box = document.getElementById("breakdown");
    box.replaceChildren();
    Object.keys(labels).forEach((key) => {
      const card = document.createElement("article");
      card.className = "rounded-2xl border border-stone-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900";
      const heading = document.createElement("h3");
      heading.className = "font-bold";
      heading.textContent = labels[key];
      const score = document.createElement("p");
      score.className = "mt-1 text-xl font-extrabold";
      score.textContent = topics[key];
      card.append(heading, score);
      box.appendChild(card);
    });
    const mistakes = document.getElementById("mistakes");
    mistakes.replaceChildren();
    const wrong = deck.filter((item) => item.pick !== item.answerAt);
    if (!wrong.length) {
      const empty = document.createElement("p");
      empty.textContent = "لا أخطاء في هذا التسليم.";
      mistakes.appendChild(empty);
    } else {
      wrong.forEach((item, order) => {
        const card = document.createElement("article");
        card.className = "rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-50";
        const heading = document.createElement("h3");
        heading.className = "font-bold";
        heading.textContent = `${labels[item.topic]}`;
        const stem = document.createElement("p");
        stem.className = "mt-1";
        stem.textContent = item.stem;
        const chosen = document.createElement("p");
        chosen.className = "mt-2";
        chosen.textContent = `اختيارك: ${item.choices[item.order[item.pick]]}`;
        const right = document.createElement("p");
        right.className = "font-bold";
        right.textContent = `المناسب: ${item.choices[item.answer]}`;
        card.append(heading, stem, chosen, right);
        mistakes.appendChild(card);
        void order;
      });
    }
    show(result);
    const details = deck.map((item, itemIndex) => ({
      num: itemIndex + 1,
      topic: labels[item.topic],
      stem: item.stem,
      chosen: item.choices[item.order[item.pick]],
      correctText: item.choices[item.answer],
      result: item.pick === item.answerAt ? "صحيحة" : "خاطئة",
      why: item.why
    }));
    sendToSheet({
      kind: "dataExam",
      name: studentName,
      klass: studentClass,
      startedAt: new Date(startedAt).toLocaleString("ar-JO", { hour12: false }),
      finishedAt: finished.toLocaleString("ar-JO", { hour12: false }),
      durationText: clock(finished.getTime() - startedAt),
      correct,
      wrong: total - correct,
      total,
      percent,
      topics,
      details
    });
  }

  document.getElementById("start-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const klass = classInput.value.trim();
    if (name.length < 2 || klass.length < 1) {
      hint.textContent = "اكتبي الاسم والشعبة قبل البدء.";
      return;
    }
    studentName = name;
    studentClass = klass;
    startedAt = Date.now();
    deck = buildDeck();
    index = 0;
    show(quiz);
    renderQuestion();
  });

  nextBtn.addEventListener("click", () => {
    if (!locked) return;
    if (index === deck.length - 1) finish();
    else {
      index += 1;
      renderQuestion();
    }
  });

  document.getElementById("again").addEventListener("click", () => {
    deck = [];
    index = 0;
    show(intro);
  });

  themeBtn.addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
    const dark = document.documentElement.classList.contains("dark");
    try { localStorage.setItem("ahmed-exam-theme", dark ? "dark" : "light"); } catch (err) {}
    syncTheme();
  });

  fillTopics();
  syncTheme();
})();
