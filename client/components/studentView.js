import { api } from "./services.js";

export function renderStudentView(user) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div class="card">
      <h2>Hi, ${user.nickname || user.email}! Let's do some English practice 🙂</h2>
      <p class="tag">Роль: студент</p>
      <div id="studentContent"></div>
    </div>
  `;

  const studentContent = wrapper.querySelector("#studentContent");
  const sectionPath = [];

  function renderPath() {
    if (sectionPath.length === 0) {
      return '<p class="tag">Level 1</p>';
    }

    const crumbs = sectionPath
      .map((section, index) => `<button class="crumb" data-index="${index}">${section.name}</button>`)
      .join("<span>/</span>");
    return `<div class="breadcrumbs">${crumbs}</div>`;
  }

  function bindBreadcrumbs() {
    studentContent.querySelectorAll(".crumb").forEach((crumb) => {
      crumb.addEventListener("click", (event) => {
        const index = Number.parseInt(event.target.dataset.index, 10);
        sectionPath.splice(index + 1);
        const current = sectionPath.length > 0 ? sectionPath[sectionPath.length - 1].id : null;
        showSections(current);
      });
    });
  }

  async function showSections(parentId = null) {
    const sections = await api.getSections(parentId);

    if (sections.length === 0 && parentId != null) {
      await showExercises(sectionPath[sectionPath.length - 1]);
      return;
    }

    studentContent.innerHTML = `
      ${renderPath()}
      <div class="section-list" id="sectionList"></div>
      <div id="sectionActions"></div>
    `;

    const sectionList = studentContent.querySelector("#sectionList");
    const actions = studentContent.querySelector("#sectionActions");

    if (sectionPath.length > 0) {
      actions.innerHTML = '<button class="button secondary" id="backBtn">Назад</button>';
      actions.querySelector("#backBtn").addEventListener("click", () => {
        sectionPath.pop();
        const prev = sectionPath.length > 0 ? sectionPath[sectionPath.length - 1].id : null;
        showSections(prev);
      });
    }

    if (sections.length === 0) {
      sectionList.innerHTML = "<p>Разделы отсутствуют.</p>";
      return;
    }

    sections.forEach((section) => {
      const button = document.createElement("button");
      button.className = "button secondary section-item";
      button.textContent = section.name;
      button.addEventListener("click", () => {
        sectionPath.push({ id: section.id, name: section.name });
        showSections(section.id);
      });
      sectionList.appendChild(button);
    });

    bindBreadcrumbs();
  }

  async function showExercises(section) {
    const exercises = await api.getExercises(section.id);
    let currentIndex = 0;

    function backToSections() {
      sectionPath.pop();
      const parentSectionId = sectionPath.length > 0 ? sectionPath[sectionPath.length - 1].id : null;
      showSections(parentSectionId);
    }

    if (exercises.length === 0) {
      studentContent.innerHTML = `
        ${renderPath()}
        <p>В этом разделе пока нет упражнений.</p>
        <button class="button secondary" id="backToSections">Назад к разделам</button>
      `;
      studentContent.querySelector("#backToSections").addEventListener("click", backToSections);
      bindBreadcrumbs();
      return;
    }

    function renderExercise() {
      const exercise = exercises[currentIndex];
      const isMultipleChoice = exercise.exerciseType === "multiple_choice";

      studentContent.innerHTML = `
        ${renderPath()}
        <p><strong>Упражнение ${currentIndex + 1} из ${exercises.length}</strong></p>
        <p>${exercise.sentence}</p>
        <p class="tag">Тип: ${exercise.exerciseType}</p>
        <div class="options" id="options"></div>
        <div id="feedback"></div>
        <button class="button secondary" id="next" style="margin-top: 12px;">Следующее</button>
        <button class="button secondary" id="backToSections" style="margin-top: 12px; margin-left: 8px;">К разделам</button>
      `;

      const optionsWrap = studentContent.querySelector("#options");
      const feedback = studentContent.querySelector("#feedback");
      const nextBtn = studentContent.querySelector("#next");

      if (isMultipleChoice) {
        nextBtn.disabled = true;
        exercise.options.forEach((option, index) => {
          const btn = document.createElement("button");
          btn.className = "button secondary";
          btn.textContent = option;
          btn.addEventListener("click", async () => {
            const isCorrect = index === exercise.correctIndex;

            feedback.textContent = isCorrect ? "Верно!" : "Неправильно.";
            feedback.className = isCorrect ? "notice success" : "notice error";

            btn.classList.remove("answer-correct", "answer-incorrect");
            btn.classList.add(isCorrect ? "answer-correct" : "answer-incorrect");

            if (isCorrect) {
              nextBtn.disabled = false;
              const allOptionButtons = optionsWrap.querySelectorAll("button");
              allOptionButtons.forEach((item) => {
                item.disabled = true;
              });
            }

            await api.saveResult(exercise.id, index, isCorrect);
          });
          optionsWrap.appendChild(btn);
        });
      } else {
        nextBtn.disabled = false;
        optionsWrap.innerHTML =
          '<p class="notice">Этот тип упражнения будет добавлен на следующем этапе интерфейса.</p>';
      }

      nextBtn.addEventListener("click", () => {
        currentIndex = (currentIndex + 1) % exercises.length;
        renderExercise();
      });

      studentContent.querySelector("#backToSections").addEventListener("click", backToSections);
      bindBreadcrumbs();
    }

    renderExercise();
  }

  showSections(null);
  return wrapper;
}
