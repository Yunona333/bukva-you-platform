import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import bcrypt from "bcryptjs";

const DEFAULT_DB_PATH = path.join(process.cwd(), "server", "data", "app.db");
const DB_PATH =
  process.env.DB_PATH ||
  (process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "app.db")
    : DEFAULT_DB_PATH);
const EXERCISES_PATH = path.join(process.cwd(), "exercises.json");

sqlite3.verbose();

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

async function addColumnIfMissing(table, column, definition) {
  const rows = await all(`PRAGMA table_info(${table})`);
  const exists = rows.some((row) => row.name === column);
  if (!exists) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function ensureSection(name, parentId, orderIndex) {
  const now = new Date().toISOString();
  const existing = await get(
    `SELECT id FROM sections
     WHERE name = ?
     AND ((parent_id IS NULL AND ? IS NULL) OR parent_id = ?)
     LIMIT 1`,
    [name, parentId, parentId]
  );

  if (existing) {
    await run(
      "UPDATE sections SET order_index = ?, is_active = 1, updated_at = ? WHERE id = ?",
      [orderIndex, now, existing.id]
    );
    return existing.id;
  }

  const insert = await run(
    "INSERT INTO sections (name, parent_id, order_index, is_active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
    [name, parentId, orderIndex, now, now]
  );
  return insert.lastID;
}

async function ensureExercise(sectionId, exercise) {
  const existing = await get(
    "SELECT id FROM exercises WHERE section_id = ? AND sentence = ? LIMIT 1",
    [sectionId, exercise.sentence]
  );
  if (existing) {
    await run(
      "UPDATE exercises SET options_json = ?, correct_index = ?, exercise_type = 'multiple_choice' WHERE id = ?",
      [JSON.stringify(exercise.options), exercise.correctIndex, existing.id]
    );
    return existing.id;
  }

  const insert = await run(
    "INSERT INTO exercises (sentence, options_json, correct_index, section_id, exercise_type) VALUES (?, ?, ?, ?, ?)",
    [
      exercise.sentence,
      JSON.stringify(exercise.options),
      exercise.correctIndex,
      sectionId,
      "multiple_choice"
    ]
  );
  return insert.lastID;
}

async function seedSections() {
  const grammarId = await ensureSection("Grammar", null, 0);
  await ensureSection("Vocabulary", null, 1);
  await ensureSection("Listening", null, 2);
  const checkYourLevelId = await ensureSection("Check your level", null, 3);

  const presentTensesId = await ensureSection("Present Tenses", grammarId, 0);
  await ensureSection("Past Tenses", grammarId, 1);
  await ensureSection("Future Tenses", grammarId, 2);
  await ensureSection("All Tenses", grammarId, 3);
  await ensureSection("Modals", grammarId, 4);

  const presentSimpleId = await ensureSection("Present Simple", presentTensesId, 0);
  await ensureSection("Present Simple and Progressive", presentTensesId, 1);
  await ensureSection("Present Perfect", presentTensesId, 2);

  const a1a2Id = await ensureSection("A1-A2", checkYourLevelId, 0);
  const a1a2PlacementId = await ensureSection("A1-A2 Placement Test", a1a2Id, 0);

  return {
    presentSimpleId,
    a1a2PlacementId
  };
}

async function seedUsers() {
  const row = await get("SELECT COUNT(*) as count FROM users");
  if (row.count > 0) {
    return;
  }

  const adminHash = bcrypt.hashSync("admin123", 10);
  const studentHash = bcrypt.hashSync("student123", 10);
  const createdAt = new Date().toISOString();

  await run(
    "INSERT INTO users (email, email_verified, password_hash, nickname, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ["admin@example.com", 1, adminHash, "admin", "teacher", createdAt]
  );
  await run(
    "INSERT INTO users (email, email_verified, password_hash, nickname, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ["student@example.com", 1, studentHash, "student", "student", createdAt]
  );
}

async function seedExercises(defaultSectionId) {
  const row = await get("SELECT COUNT(*) as count FROM exercises");
  if (row.count > 0 || !fs.existsSync(EXERCISES_PATH)) {
    return;
  }

  const raw = fs.readFileSync(EXERCISES_PATH, "utf-8");
  const items = JSON.parse(raw);

  for (const item of items) {
    const correctIndex =
      typeof item.correctIndex === "number" ? item.correctIndex : item.correct_index;
    await run(
      "INSERT INTO exercises (sentence, options_json, correct_index, section_id, exercise_type) VALUES (?, ?, ?, ?, ?)",
      [item.sentence, JSON.stringify(item.options), correctIndex, defaultSectionId, "multiple_choice"]
    );
  }
}

async function migrateExercises(defaultSectionId) {
  await run("UPDATE exercises SET section_id = ? WHERE section_id IS NULL", [defaultSectionId]);
  await run(
    "UPDATE exercises SET exercise_type = 'multiple_choice' WHERE exercise_type IS NULL OR exercise_type = ''"
  );
}

async function seedA1A2PlacementExercises(sectionId) {
  const exercises = [
    {
      sentence: "My name ______ Anna. I ______ from Italy.",
      options: ["are / is", "is / am", "am / is", "is / are"],
      correctIndex: 1
    },
    {
      sentence: "We have ______ nice house. ______ house is in London.",
      options: ["a / The", "an / The", "the / A", "a / A"],
      correctIndex: 0
    },
    {
      sentence: "______ any children in the park yesterday?",
      options: ["Was there", "There were", "Were there", "There was"],
      correctIndex: 2
    },
    {
      sentence: "She ______ to work by car, but usually she ______ the bus.",
      options: ["go / take", "goes / takes", "is going / is taking", "went / took"],
      correctIndex: 1
    },
    {
      sentence: "I'm hungry! I want ______ a sandwich.",
      options: ["eat", "eating", "to eat", "eats"],
      correctIndex: 2
    },
    {
      sentence: "Listen! My little sister ______ in her room.",
      options: ["sings", "is singing", "sing", "sang"],
      correctIndex: 1
    },
    {
      sentence: "My father is ______ engineer. He works very hard.",
      options: ["a", "an", "the", "-"],
      correctIndex: 1
    },
    {
      sentence: "______ you like to play tennis with me? - Sorry, I can't. I'm busy.",
      options: ["Does", "Are", "Would", "Do"],
      correctIndex: 2
    },
    {
      sentence: "This bag isn't ______ . It's ______ .",
      options: ["my / her", "mine / hers", "mine / her", "my / hers"],
      correctIndex: 1
    },
    {
      sentence: "I was very tired, so I went ______ bed early.",
      options: ["at", "in", "to", "into"],
      correctIndex: 2
    },
    {
      sentence: "Tom ______ his leg last weekend when he played football.",
      options: ["break", "breaks", "broke", "broken"],
      correctIndex: 2
    },
    {
      sentence: "______ water is there in the bottle? - Only a little.",
      options: ["How many", "How much", "What", "Which"],
      correctIndex: 1
    },
    {
      sentence: "It's very hot in this room. ______ open the window, please?",
      options: ["Do you", "Can you", "Are you", "Have you"],
      correctIndex: 1
    },
    {
      sentence: "London is a big city, but Tokyo is ______ .",
      options: ["bigger", "the bigger", "more big", "the biggest"],
      correctIndex: 0
    },
    {
      sentence: "If it ______ tomorrow, we will stay at home.",
      options: ["rain", "raining", "will rain", "rains"],
      correctIndex: 3
    },
    {
      sentence: "My brother is a musician. ______ plays the guitar very well.",
      options: ["He", "Him", "His", "Her"],
      correctIndex: 0
    },
    {
      sentence: "We usually ______ early on weekdays because we have to go to school.",
      options: ["get up", "gets up", "are getting up", "got up"],
      correctIndex: 0
    },
    {
      sentence: "You look tired. You ______ work so hard. You should rest.",
      options: ["don't must", "mustn't", "don't have to", "can't"],
      correctIndex: 1
    },
    {
      sentence: "Look at ______ clouds! It's going to rain soon.",
      options: ["this", "that", "these", "it"],
      correctIndex: 2
    },
    {
      sentence: "Whose phone is this? - It's my ______ phone.",
      options: ["parent", "parents", "parents's", "parents'"],
      correctIndex: 3
    }
  ];

  for (const exercise of exercises) {
    await ensureExercise(sectionId, exercise);
  }
}

export function initDb() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      (async () => {
        try {
          await run("PRAGMA foreign_keys = ON");

          await run(
            `CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              email TEXT UNIQUE NOT NULL,
              password_hash TEXT NOT NULL,
              role TEXT NOT NULL
            )`
          );

          await run(
            `CREATE TABLE IF NOT EXISTS sections (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              parent_id INTEGER NULL,
              order_index INTEGER DEFAULT 0,
              is_active INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY (parent_id) REFERENCES sections(id) ON DELETE SET NULL
            )`
          );

          await run(
            `CREATE TABLE IF NOT EXISTS exercises (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              sentence TEXT NOT NULL,
              options_json TEXT NOT NULL,
              correct_index INTEGER NOT NULL
            )`
          );

          await run(
            `CREATE TABLE IF NOT EXISTS results (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              exercise_id INTEGER NOT NULL,
              answer_index INTEGER NOT NULL,
              is_correct INTEGER NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id),
              FOREIGN KEY (exercise_id) REFERENCES exercises(id)
            )`
          );

          await run(
            `CREATE TABLE IF NOT EXISTS verification_tokens (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              token TEXT UNIQUE NOT NULL,
              expires_at TEXT NOT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id)
            )`
          );

          await Promise.all([
            addColumnIfMissing("users", "email_verified", "INTEGER NOT NULL DEFAULT 0"),
            addColumnIfMissing("users", "nickname", "TEXT"),
            addColumnIfMissing("users", "created_at", "TEXT"),
            addColumnIfMissing("exercises", "section_id", "INTEGER"),
            addColumnIfMissing(
              "exercises",
              "exercise_type",
              "TEXT NOT NULL DEFAULT 'multiple_choice'"
            )
          ]);

          await run("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname)");
          await run("CREATE INDEX IF NOT EXISTS idx_sections_parent_id ON sections(parent_id)");
          await run("CREATE INDEX IF NOT EXISTS idx_exercises_section_id ON exercises(section_id)");

          await seedUsers();
          const sectionIds = await seedSections();
          await seedExercises(sectionIds.presentSimpleId);
          await migrateExercises(sectionIds.presentSimpleId);
          await seedA1A2PlacementExercises(sectionIds.a1a2PlacementId);

          resolve();
        } catch (err) {
          reject(err);
        }
      })();
    });
  });
}
