import { api } from "./services.js";

function flattenSections(nodes, depth = 0, result = []) {
  nodes.forEach((node) => {
    result.push({
      id: node.id,
      name: `${"  ".repeat(depth)}${node.name}`,
      isActive: node.isActive
    });
    flattenSections(node.children || [], depth + 1, result);
  });
  return result;
}

export function renderTeacherView(user) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div class="card">
      <h2>Hi, ${user.nickname || user.email}! Let's do some English practice 🙂</h2>
      <p class="tag">Роль: преподаватель</p>
    </div>
    <div class="card">
      <h3>Добавить упражнение</h3>
      <select class="input" id="sectionSelect"></select>
      <select class="input" id="exerciseType">
        <option value="multiple_choice">multiple_choice</option>
        <option value="text_input">text_input</option>
        <option value="sentence_builder">sentence_builder</option>
      </select>
      <input class="input" id="sentence" placeholder="Текст упражнения" />
      <div id="multipleChoiceFields">
        <input class="input" id="opt1" placeholder="Вариант 1" />
        <input class="input" id="opt2" placeholder="Вариант 2" />
        <input class="input" id="opt3" placeholder="Вариант 3" />
        <input class="input" id="opt4" placeholder="Вариант 4" />
        <input class="input" id="correct" type="number" min="1" max="4" placeholder="Номер правильного варианта (1-4)" />
      </div>
      <button class="button" id="add">Сохранить</button>
      <div id="addMessage"></div>
    </div>
    <div class="card">
      <h3>Результаты учеников</h3>
      <div id="results"></div>
    </div>
  `;

  const sectionSelect = wrapper.querySelector("#sectionSelect");
  const exerciseType = wrapper.querySelector("#exerciseType");
  const sentence = wrapper.querySelector("#sentence");
  const opt1 = wrapper.querySelector("#opt1");
  const opt2 = wrapper.querySelector("#opt2");
  const opt3 = wrapper.querySelector("#opt3");
  const opt4 = wrapper.querySelector("#opt4");
  const correct = wrapper.querySelector("#correct");
  const multipleChoiceFields = wrapper.querySelector("#multipleChoiceFields");
  const addMessage = wrapper.querySelector("#addMessage");
  const resultsContainer = wrapper.querySelector("#results");

  function renderSectionOptions(nodes) {
    const flat = flattenSections(nodes);
    if (flat.length === 0) {
      sectionSelect.innerHTML = '<option value="">Разделы не найдены</option>';
      return;
    }

    sectionSelect.innerHTML = flat
      .map((item) => {
        const suffix = item.isActive ? "" : " (off)";
        return `<option value="${item.id}">${item.name}${suffix}</option>`;
      })
      .join("");
  }

  function toggleExerciseTypeFields() {
    const isMultipleChoice = exerciseType.value === "multiple_choice";
    multipleChoiceFields.style.display = isMultipleChoice ? "block" : "none";
  }

  async function loadSections() {
    const tree = await api.getSectionsTree(true);
    renderSectionOptions(tree);
  }

  async function loadResults() {
    const results = await api.getResults();
    if (results.length === 0) {
      resultsContainer.innerHTML = "<p>Результатов пока нет.</p>";
      return;
    }

    resultsContainer.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Ученик</th>
            <th>Предложение</th>
            <th>Ответ</th>
            <th>Дата</th>
          </tr>
        </thead>
        <tbody>
          ${results
            .map(
              (row) => `
              <tr>
                <td>${row.student_email}</td>
                <td>${row.sentence}</td>
                <td>${row.is_correct ? "Верно" : "Неверно"}</td>
                <td>${new Date(row.created_at).toLocaleString("ru-RU")}</td>
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  exerciseType.addEventListener("change", toggleExerciseTypeFields);

  wrapper.querySelector("#add").addEventListener("click", async () => {
    addMessage.textContent = "";
    addMessage.className = "";

    const selectedSectionId = Number.parseInt(sectionSelect.value, 10);
    const selectedExerciseType = exerciseType.value;

    if (Number.isNaN(selectedSectionId)) {
      addMessage.textContent = "Выберите раздел.";
      addMessage.className = "notice error";
      return;
    }

    if (!sentence.value.trim()) {
      addMessage.textContent = "Введите текст упражнения.";
      addMessage.className = "notice error";
      return;
    }

    const payload = {
      sentence: sentence.value.trim(),
      section_id: selectedSectionId,
      exercise_type: selectedExerciseType
    };

    if (selectedExerciseType === "multiple_choice") {
      const options = [opt1.value, opt2.value, opt3.value, opt4.value].map((v) => v.trim());
      const correctIndex = Number.parseInt(correct.value, 10) - 1;

      if (options.some((v) => !v)) {
        addMessage.textContent = "Заполните все 4 варианта ответа.";
        addMessage.className = "notice error";
        return;
      }

      if (Number.isNaN(correctIndex) || correctIndex < 0 || correctIndex > 3) {
        addMessage.textContent = "Правильный ответ должен быть от 1 до 4.";
        addMessage.className = "notice error";
        return;
      }

      payload.options = options;
      payload.correctIndex = correctIndex;
    }

    try {
      await api.addExercise(payload);

      sentence.value = "";
      opt1.value = "";
      opt2.value = "";
      opt3.value = "";
      opt4.value = "";
      correct.value = "";

      addMessage.textContent = "Упражнение добавлено.";
      addMessage.className = "notice success";
    } catch (err) {
      addMessage.textContent = err.message;
      addMessage.className = "notice error";
    }
  });

  toggleExerciseTypeFields();
  loadSections();
  loadResults();
  return wrapper;
}
