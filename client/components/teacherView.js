import { api } from "./services.js";

export function renderTeacherView(user) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div class="card">
      <h2>Hi, ${user.nickname || user.email}! Let's do some English practice 🙂</h2>
      <p class="tag">Роль: преподаватель</p>
    </div>
    <div class="card">
      <h3>Добавить упражнение</h3>
      <input class="input" id="sentence" placeholder="Предложение с пропуском" />
      <input class="input" id="opt1" placeholder="Вариант 1" />
      <input class="input" id="opt2" placeholder="Вариант 2" />
      <input class="input" id="opt3" placeholder="Вариант 3" />
      <input class="input" id="opt4" placeholder="Вариант 4" />
      <input class="input" id="correct" type="number" min="1" max="4" placeholder="Номер правильного варианта (1-4)" />
      <button class="button" id="add">Сохранить</button>
      <div id="addMessage"></div>
    </div>
    <div class="card">
      <h3>Результаты учеников</h3>
      <div id="results"></div>
    </div>
  `;

  const sentence = wrapper.querySelector("#sentence");
  const opt1 = wrapper.querySelector("#opt1");
  const opt2 = wrapper.querySelector("#opt2");
  const opt3 = wrapper.querySelector("#opt3");
  const opt4 = wrapper.querySelector("#opt4");
  const correct = wrapper.querySelector("#correct");
  const addMessage = wrapper.querySelector("#addMessage");
  const resultsContainer = wrapper.querySelector("#results");

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

  wrapper.querySelector("#add").addEventListener("click", async () => {
    addMessage.textContent = "";
    addMessage.className = "";

    const options = [opt1.value, opt2.value, opt3.value, opt4.value].map((v) => v.trim());
    const correctIndex = Number.parseInt(correct.value, 10) - 1;

    if (!sentence.value.trim() || options.some((v) => !v)) {
      addMessage.textContent = "Заполните все поля.";
      addMessage.className = "notice error";
      return;
    }

    if (Number.isNaN(correctIndex) || correctIndex < 0 || correctIndex > 3) {
      addMessage.textContent = "Правильный ответ должен быть от 1 до 4.";
      addMessage.className = "notice error";
      return;
    }

    try {
      await api.addExercise({
        sentence: sentence.value.trim(),
        options,
        correctIndex
      });

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

  loadResults();
  return wrapper;
}
