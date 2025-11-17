// server.js
import express from "express";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";

// Fix __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json({ limit: "50mb" }));

// Folder where Excel files will be saved
const SAVE_DIR = path.join(__dirname, "saved_excels");

// Ensure folder exists
if (!fs.existsSync(SAVE_DIR)) {
  fs.mkdirSync(SAVE_DIR, { recursive: true });  // <-- automatic folder creation
  console.log("Created folder:", SAVE_DIR);
}

app.post("/save-excel", (req, res) => {
  const data = req.body.results;

  if (!data || !Array.isArray(data)) {
    return res.status(400).send("No data provided");
  }

  // Create workbook
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, "OCR Structured");

  // Create timestamped filename
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);

  const filename = `ocr_structured_${timestamp}.xlsx`;
  const savePath = path.join(SAVE_DIR, filename);

  // Write Excel file
  XLSX.writeFile(workbook, savePath);

  res.json({
    message: "Excel saved successfully",
    folder: SAVE_DIR,
    file: filename,
    full_path: savePath,
  });
});

app.listen(5000, () => console.log("Server running on port 5000"));
