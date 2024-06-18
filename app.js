const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = 3000;
const dbPath = path.join(__dirname, "todos.db");

app.use(cors());
app.use(bodyParser.json());

// Initialize the database and server
const initializeDBAndServer = async () => {
  try {
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        completed BOOLEAN NOT NULL DEFAULT FALSE
      );
    `);

    app.listen(PORT, () => {
      console.log(`Server Running at http://localhost:${PORT}/`);
    });

    app.use((req, res, next) => {
      req.db = db;
      next();
    });

    app.get("/tasks", async (req, res) => {
      try {
        const tasks = await req.db.all("SELECT * FROM tasks");
        res.json(tasks);
      } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
      }
    });

    app.post("/tasks/:id", async (req, res) => {
      const { description } = req.body;
      try {
        const result = await req.db.run(
          "INSERT INTO tasks (description) VALUES (?)",
          [description]
        );
        const newTask = await req.db.get("SELECT * FROM tasks WHERE id = ?", [
          result.lastID,
        ]);
        res.json(newTask);
      } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
      }
    });

    app.put("/tasks/:id", async (req, res) => {
      const { id } = req.params;
      const { completed } = req.body;
      try {
        await req.db.run("UPDATE tasks SET completed = ? WHERE id = ?", [
          completed,
          id,
        ]);
        res.sendStatus(200);
      } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
      }
    });

    app.delete("/tasks/:id", async (req, res) => {
      const { id } = req.params;
      try {
        await req.db.run("DELETE FROM tasks WHERE id = ?", [id]);
        res.sendStatus(200);
      } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
      }
    });
  } catch (e) {
    console.error(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();
