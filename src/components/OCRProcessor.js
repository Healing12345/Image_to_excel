import React, { useState } from "react";
import Tesseract from "tesseract.js";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import ImageUploader from "./ImageUploader";
import ExcelUploader from "./ExcelUploader";
import axios from "axios";

// Clean text function
const cleanText = (text) => {
  if (!text) return "";
  return text
    .replace(/\n+/g, " ")
    .replace(/[^a-zA-Z0-9\s.,-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

// Extract structured fields
const extractFields = (text) => {
  let company = "";
  let note_type = "";
  let reference_number = "";

  // Match company names more broadly
  const companyMatch = text.match(/[A-Z][A-Za-z &]+(?:Company|Ltd|Limited|PLC)/i);
  if (companyMatch) company = companyMatch[0].trim();

  const noteTypeMatch = text.match(/(transfer hire advice note)/i);
  if (noteTypeMatch) note_type = noteTypeMatch[1].toUpperCase();

  // Reference number: long grouped digits
  const refMatch = text.match(/\b\d[\d\s-]{5,}\b/);
  if (refMatch) reference_number = refMatch[0].replace(/\s+/g, " ").trim();

  return { company, note_type, reference_number };
};

export default function OCRProcessor() {
  const [images, setImages] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = (files) => {
    setImages(files);
    setResults([]);
  };

  // Generates and downloads Excel
  const saveExcelFile = (data) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "OCR Structured");

    const excelBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([excelBuffer]), "ocr_structured.xlsx");
  };

  const processImages = async () => {
    if (!images.length) return;
    setLoading(true);

    try {
      const output = [];

      for (const file of images) {
        const { data } = await Tesseract.recognize(file, "eng", {
          logger: (m) => console.log(file.name, m),
        });

        const cleaned = cleanText(data.text);
        const fields = extractFields(cleaned);

        output.push({
          filename: file.name,
          ...fields,
          raw_text: cleaned,
        });
      }

      setResults(output);

      // Save to backend
      await axios.post("http://localhost:5000/save-excel", { results: output });

      // Auto-download locally
      saveExcelFile(output);

    } catch (error) {
      console.error("OCR processing failed:", error);
      alert("An error occurred while processing images.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>Upload Images</h3>
      <ImageUploader onUpload={handleUpload} />
      <ExcelUploader onExcelUpload={(data) => console.log(data)} />
        
      {images.length > 0 && (
        <button onClick={processImages} disabled={loading}>
          {loading ? "Processing..." : "Save Excel"}
        </button>
      )}

      {loading && <p>Processing images... please wait...</p>}

      {results.length > 0 && (
        <>
          <h3>OCR Results Preview (Structured)</h3>
          <pre>{JSON.stringify(results, null, 2)}</pre>
        </>
      )}
    </div>
  );
}
