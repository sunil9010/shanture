const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer"); // Import multer

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, "todos.db");

app.use(cors());
app.use(bodyParser.json());

// Multer storage configuration
const uploadDir = path.join(__dirname, "uploads");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // Use original filename; adjust as needed
  },
});
const upload = multer({ storage: storage });

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
        completed BOOLEAN NOT NULL DEFAULT 1
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

    // Route to handle file upload
    app.post("/upload", upload.single("pdf"), (req, res) => {
      res.send("File uploaded successfully.");
    });
  } catch (e) {
    console.error(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

app.get("/download/:filename", (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(uploadDir, filename);

  // Check if the file exists
  if (fs.existsSync(filePath)) {
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.setHeader("Content-Type", "application/pdf");
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } else {
    res.status(404).send("File not found");
  }
});

initializeDBAndServer();
