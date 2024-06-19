const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, "todos.db");

app.use(cors());
app.use(bodyParser.json());
const upload = multer({ storage: multer.memoryStorage() });

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
        completed BOOLEAN NOT NULL DEFAULT 1
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS pdfs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pdf BLOB
      );
    `);

    app.listen(PORT, () => {
      console.log(`Server Running at http://localhost:${PORT}/`);
    });

    // Middleware to attach db to req object
    app.use((req, res, next) => {
      req.db = db;
      next();
    });

    // Define routes
    app.get("/tasks", async (req, res) => {
      try {
        const tasks = await req.db.all("SELECT * FROM tasks");
        res.json(tasks);
      } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
      }
    });

    app.post("/tasks", async (req, res) => {
      const { description, completed } = req.body;

      // Validate that 'description' and 'completed' are provided
      if (description === undefined || completed === undefined) {
        return res
          .status(400)
          .json({ error: "Description and completed are required" });
      }

      try {
        const result = await req.db.run(
          "INSERT INTO tasks (description, completed) VALUES (?, ?)",
          [description, completed ? 1 : 0]
        );

        const newTask = await req.db.get("SELECT * FROM tasks WHERE id = ?", [
          result.lastID,
        ]);
        res.status(201).json(newTask);
      } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
      }
    });

    app.put("/tasks/:id", async (req, res) => {
      const { id } = req.params;
      const { completed } = req.body;
      const completedValue = completed ? 1 : 0;
      try {
        await req.db.run("UPDATE tasks SET completed = ? WHERE id = ?", [
          completedValue,
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

  app.post("/upload-pdf", upload.single("pdf"), async (req, res) => {
    const pdfBuffer = req.file.buffer;

    try {
      const result = await req.db.run("INSERT INTO pdfs (pdf) VALUES (?)", [
        pdfBuffer,
      ]);
      res.status(201).json({ id: result.lastID });
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  });
};

initializeDBAndServer();
