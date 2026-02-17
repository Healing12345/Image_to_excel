// server.js
import express from "express";
import XLSX from "xlsx";
import * as fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import multer from "multer";
import os from "os";
import { Console } from "console";

// Fix __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Folder where Excel files will be saved
const SAVE_DIR = path.join(__dirname, "saved_excels");

// Ensure folder exists
if (!fs.existsSync(SAVE_DIR)) {
  fs.mkdirSync(SAVE_DIR, { recursive: true });
  console.log("Created folder:", SAVE_DIR);
}

// Serve saved Excel files
app.use(
  "/saved_excels",
  express.static(SAVE_DIR, {
    setHeaders: (res) => {
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    },
  })
);

/* ============================================================
   HELPER: Normalize input
   ============================================================ */
const normalize = (val) =>
  val?.toString().replace(/[\s\W]/g, "").replace(/^0+/, "").trim().toUpperCase() || "";

/* ============================================================
   SAVE OCR RESULT INTO NEW EXCEL
   ============================================================ */
app.post("/save-excel", (req, res) => {
  try {
    const data = req.body.results;
    if (!data || !Array.isArray(data)) {
      return res.status(400).send("No data provided");
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, "OCR Structured");

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `ocr_structured_${timestamp}.xlsx`;
    const savePath = path.join(SAVE_DIR, filename);

    XLSX.writeFile(workbook, savePath);

    res.json({
      message: "Excel saved successfully",
      file: filename,
      url: `http://localhost:5000/saved_excels/${filename}`,
    });
  } catch (error) {
    console.error("SAVE EXCEL ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ============================================================
   MATCH Original Docket Number TO reference_number
   ============================================================ */
app.post("/find-matching-references", (req, res) => {
  try {
    const uploadedData = req.body.data;
    if (!Array.isArray(uploadedData)) {
      return res.status(400).json({ error: "Invalid upload data" });
    }

    const excelFiles = fs.readdirSync(SAVE_DIR).filter(f => f.endsWith(".xlsx"));

    // Load ALL saved rows once (performance)
    const savedRows = [];
    excelFiles.forEach(file => {
      const wb = XLSX.readFile(path.join(SAVE_DIR, file));
      const sheet = wb.Sheets[wb.SheetNames[0]];
      savedRows.push(...XLSX.utils.sheet_to_json(sheet, { defval: "" }));
      console.log("Saved row sample:", savedRows[0]);
    });

    let totalUnmatched = 0;

    const updatedExcel = uploadedData.map(row => {
      const uploadedDock = normalize(row.original_docket_number);
      const uploadedQty = Math.abs(Number(row.Quantity));
      const reference = normalize(row["Reference"]);
      const otherRef = normalize(row["Other Ref"]);
    
      let matchedQty = 0;
      let unmatchedQty = uploadedQty;
      let qra = 0;
      let status = "Unmatched";
      let matchedRow = null;

      for (const sRow of savedRows) {
        if (normalize(sRow.reference_number) === uploadedDock) {
          matchedRow = sRow;
          const savedQty = Number(sRow.quantity);
          
          if (uploadedQty === savedQty) {
            matchedQty = savedQty;
            unmatchedQty = 0;
            status = "Matched";
          } else {
            matchedQty = uploadedQty;
            unmatchedQty = 0;
            qra = Math.abs(uploadedQty - savedQty);
            status = "QRA";
          }
          break;
        }
      }

      totalUnmatched += unmatchedQty;

      return {
        date: matchedRow?.Date || "",  
        original_docket_number: row.original_docket_number || "",
        supplier: row.Location || "",
        po_number: matchedRow?.po_number || "",
        ref_1: matchedRow?.Ref_1 || "", 
        ref_2: matchedRow?.Ref_2 || "", 
        matched_quantity: matchedQty || 0,
        unmatched_qnty: unmatchedQty || 0,
        qra: qra || 0,
        status: status || ""
      };
    });

    updatedExcel.push({
       date: "TOTAL",
       original_docket_number: "",
       supplier: "",
       po_number: "",
       ref_1: "",
       ref_2: "",
       matched_quantity: "",
       unmatched_qnty: totalUnmatched,
       qra: "",
       status: ""
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(updatedExcel), "Matched Results");

    const filename = `matched_results_${Date.now()}.xlsx`;
    XLSX.writeFile(wb, path.join(SAVE_DIR, filename));

    res.json({
      message: "Matching completed",
      total_unmatched: totalUnmatched,
      download_url: `http://localhost:5000/saved_excels/${filename}`,
      rows: updatedExcel
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});



/* ============================================================
   SEARCH: Find row by reference OR docket number
   ============================================================ */
app.post("/search", (req, res) => {
  const { references } = req.body;

  if (!Array.isArray(references) || references.length === 0) {
    return res.status(400).json({ error: "No references provided" });
  }

  const results = [];
  let count = 0;

  // 🔹 Use SAVE_DIR here
  const files = fs.readdirSync(SAVE_DIR);

  files.forEach(file => {
    const filePath = path.join(SAVE_DIR, file);
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    rows.forEach(row => {
      if (references.includes(String(row.reference_number))) {
        results.push({
          file,
          file_url: `http://localhost:5000/saved_excels/${file}`, // fixed URL too
          data: row
        });
        count++;
      }
    });
  });

  res.json({ count, results });
});

// Updating Excel file
app.post("/update-excel-row", (req, res) => {
  try {
    const { file, reference_number, updates } = req.body;

    if (!file || !reference_number) {
      return res.status(400).json({ error: "Missing file or reference_number" });
    }

    const filePath = path.join(SAVE_DIR, file);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    let updated = false;

    const normalizedRef = reference_number.toString().trim().toUpperCase();

    const updatedRows = rows.map((row) => {
      const rowRef = (row.reference_number || "").toString().trim().toUpperCase();
      if (rowRef === normalizedRef) {
        updated = true;
        return { ...row, ...updates };
      }
      return row;
    });

    if (!updated) {
      return res.status(404).json({ error: "Reference number not found in file" });
    }

    const newSheet = XLSX.utils.json_to_sheet(updatedRows);
    workbook.Sheets[workbook.SheetNames[0]] = newSheet;
    XLSX.writeFile(workbook, filePath);

    res.json({ message: "Row updated successfully!" });
  } catch (error) {
    console.error("UPDATE ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ============================================================
   ADD: Insert a new row into an existing Excel file
   ============================================================ */
app.post("/add-excel-row", (req, res) => {
  try {
    const { file, new_row } = req.body;

    if (!file || !new_row) {
      return res.status(400).json({ error: "Missing file or new_row data" });
    }

    const filePath = path.join(SAVE_DIR, file);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    // Append the new row
    rows.push(new_row);

    const newSheet = XLSX.utils.json_to_sheet(rows);
    workbook.Sheets[sheetName] = newSheet;
    XLSX.writeFile(workbook, filePath);

    res.json({ message: "Row added successfully!", new_row });
  } catch (error) {
    console.error("ADD ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/delete-excel-row", (req, res) => {
  try {
    const { file, reference_number } = req.body;

    if (!file || !reference_number) {
      return res.status(400).json({ error: "Missing file or reference_number" });
    }

    const filePath = path.join(SAVE_DIR, file);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    // Filter OUT the row we want to delete
    const filteredRows = rows.filter(
      (r) => r.reference_number != reference_number
    );

    if (filteredRows.length === rows.length) {
      return res.status(404).json({ error: "Reference not found in file" });
    }

    const newSheet = XLSX.utils.json_to_sheet(filteredRows);
    workbook.Sheets[sheetName] = newSheet;

    XLSX.writeFile(workbook, filePath);

    res.json({ message: "Row deleted successfully", deleted: reference_number });
  } catch (error) {
    console.error("DELETE ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

//PDF UPLOAD
// Folder to save uploaded PDFs
const PDF_UPLOAD_DIR = path.join(__dirname, "uploads");
const IMAGE_UPLOAD_DIR = path.join(__dirname, "Images");

[PDF_UPLOAD_DIR, IMAGE_UPLOAD_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log("Created folder:", dir);
  }
});

// Multer storage    (PDF)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PDF_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    cb(null, `${timestamp}-${file.originalname}`);
  },
});

const upload = multer({ storage });   //PDF

// Multer storage    (IMAGES)
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, IMAGE_UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, file.originalname),
});

const uploadImage = multer({ storage: imageStorage });  //IMAGES

// Upload PDFs
app.post("/upload-pdf", upload.array("pdfs"), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No PDF files uploaded" });
  }

  const files = req.files.map((f) => ({
    originalName: f.originalname,
    savedName: f.filename,
    url: `http://localhost:5000/uploads/${f.filename}`,
  }));

  res.json({ message: "PDFs uploaded successfully", files });
});

// Upload IMAGEs
app.post("/upload-image", uploadImage.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });
  
  res.json({
    originalName: req.file.originalname,
    savedName: req.file.filename,
    url: `http://localhost:5000/images/${req.file.filename}`,
  });
});

// Serve uploaded PDFs
app.use("/uploads", express.static(PDF_UPLOAD_DIR));
// Serve uploaded IMAGEs
app.use("/Images", express.static(IMAGE_UPLOAD_DIR));

/* ============================================================
   UPLOAD SUPPLIER EXCEL → UPDATE SAVED OCR FILES
   ============================================================ */

// Folder where Supplier Excel files will be saved
const SUPPLIER_DIR = path.join(__dirname, "supplier_excels");
app.use("/supplier_excels", express.static(SUPPLIER_DIR));

// Ensure supplier folder exists
if (!fs.existsSync(SUPPLIER_DIR)) {
  fs.mkdirSync(SUPPLIER_DIR, { recursive: true });
  console.log("Created supplier folder:", SUPPLIER_DIR);
}

app.post("/upload-supplier-excel", (req, res) => {
  try {
    const supplierFilePath = req.body.filePath;
    const supplierData = req.body.data;

    if (!Array.isArray(supplierData) && !supplierFilePath) {
      return res.status(400).json({ error: "No supplier data provided" });
    }

    let jsonData = [];

    // ---------- 1️⃣ Read supplier Excel or JSON ----------
    if (supplierFilePath) {
      const workbook = XLSX.readFile(supplierFilePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const headerRowNumber = 6;
      const range = XLSX.utils.decode_range(sheet["!ref"]);

      const headers = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: headerRowNumber - 1, c: C });
        const cell = sheet[cellAddress];
        headers.push(cell ? cell.v.toString().trim() : `EMPTY_${C}`);
      }

      jsonData = XLSX.utils.sheet_to_json(sheet, {
        header: headers,
        range: headerRowNumber,
        defval: "",
        cellDates: true
      });
    } else {
      jsonData = supplierData;
    }

    // ---------- 2️⃣ Normalize helpers ----------
    const normalizeKey = (key) =>
      key?.toString().trim().toUpperCase().replace(/\s+/g, "_") || "";

    const normalize = (val) =>
      val?.toString().trim().toUpperCase() || "";

    const supplierDataNormalized = jsonData.map(row => {
      const newRow = {};
      Object.entries(row).forEach(([key, val]) => {
        newRow[normalizeKey(key)] = val;
      });
      return newRow;
    });

    // ---------- 3️⃣ Read saved_excels reference numbers ----------
    const savedFiles = fs.readdirSync(SAVE_DIR).filter(f => f.endsWith(".xlsx"));
    const savedReferences = new Set();

    savedFiles.forEach(file => {
      const filePath = path.join(SAVE_DIR, file);
      const wb = XLSX.readFile(filePath);
      const sheetName = wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });

      rows.forEach(row => {
        if (row.reference_number) {
          savedReferences.add(normalize(row.reference_number));
        }
      });
    });

    // ---------- 4️⃣ Build match / unmatched report ----------

    const excelDateToJS = (value) => {
       if (!value) return "";

       // Already a JS Date
       if (value instanceof Date) return value;

       // Excel serial number
       if (typeof value === "number") {
          return new Date(Math.round((value - 25569) * 86400 * 1000));
       }

       return value;
};

    const matchResultRows = supplierDataNormalized.map(supplierRow => {
      const ref = normalize(
        supplierRow["CHEP_THAN_NUMBER"] ||
        supplierRow["GLS_DOC._UMBER"]
      );

      return {
        Date: excelDateToJS(supplierRow["DATE"] || ""),
        reference_number: ref,
        Supplier_Name: supplierRow["SUPPLIER_NAME"] || "",
        PO_Number: supplierRow["PO_NUMBER"] || "",
        Quantity: supplierRow["CHEP_PALLET_QTY"] ?? supplierRow["GLS_PALLET_QTY"] ?? 0,
        Ref_1: "",
        Ref_2: "",
        Ref_3: "",
        Ref_4: "",
        Status: savedReferences.has(ref) ? "matched" : "unmatched"
      };
    });

    // ---------- 5️⃣ Create result spreadsheet ----------
    const matchWorkbook = XLSX.utils.book_new();
    const matchSheet = XLSX.utils.json_to_sheet(matchResultRows, {
      header: [
        "Date",
        "reference_number",
        "Supplier_Name",
        "PO_Number",
        "Quantity",
        "Ref_1",
        "Ref_2",
        "Ref_3",
        "Ref_4",
        "Status"
      ]
    });

    XLSX.utils.book_append_sheet(matchWorkbook, matchSheet, "Match Result");

    const matchFileName = `supplier_match_result_${Date.now()}.xlsx`;
    const matchFilePath = path.join(SAVE_DIR, matchFileName);

    XLSX.writeFile(matchWorkbook, matchFilePath);

    if (!fs.existsSync(matchFilePath)) {
        throw new Error("Match result file was not created");
    }

    // ---------- 6️⃣ Response ----------
    res.json({
      message: "Supplier Excel processed successfully",
      match_result_file: `http://localhost:5000/saved_excels/${matchFileName}`,
      download_url: `http://localhost:5000/saved_excels/${matchFileName}`
    });

  } catch (error) {
    console.error("SUPPLIER MATCH ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});
//DOWNLOADING FILENAME PATH
app.get(/^\/check-file\/(.+)$/, async (req, res) => {
  try {
    const rawPath = decodeURIComponent(req.params[0]);
    const filename = path.basename(rawPath);

    const filePath = path.join(os.homedir(), "Downloads", filename);

    await fs.promises.access(filePath, fs.constants.F_OK);

    res.json({
      success: true,
      message: "File exists",
    });
  } catch {
    res.status(404).json({
      success: false,
      message: "File not found",
    });
  }
});


/**
 * Open / download a file
 */
app.get(/^\/open-file\/(.+)$/, async (req, res) => {
  try {
    const rawPath = decodeURIComponent(req.params[0]);
    const filename = path.basename(rawPath);

    const filePath = path.join(os.homedir(), "Downloads", filename);

    await fs.promises.access(filePath, fs.constants.F_OK);

    res.sendFile(filePath);
  } catch {
    res.status(404).send("File not found");
  }
});













/* ============================================================
   START SERVER
   ============================================================ */
app.listen(5000, () => console.log("Server running on port 5000"));