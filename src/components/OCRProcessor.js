import React, { useState } from "react";
import Tesseract from "tesseract.js";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import ImageUploader from "./ImageUploader";

// Clean text function
const cleanText = (text) => {
  if (!text) return "";
  let cleaned = text.replace(/\n+/g, " ");
  cleaned = cleaned.replace(/[^a-zA-Z0-9\s.,-]/g, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
};

// Extract structured fields from cleaned text
const extractFields = (text) => {
  let company = "";
  let note_type = "";
  let reference_number = "";

  // Example regexes based on your sample text
  const companyMatch = text.match(/([A-Z][a-zA-Z\s]+Company)/);
  if (companyMatch) company = companyMatch[1];

  const noteTypeMatch = text.match(/(TRANSFER HIRE ADVICE NOTE)/i);
  if (noteTypeMatch) note_type = noteTypeMatch[1].toUpperCase();

  const refMatch = text.match(/(\d{3,}\s*\d{0,})/); // e.g., "421 0797455"
  if (refMatch) reference_number = refMatch[1].replace(/\s+/g, " ").trim();

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

  const processImages = async () => {
    if (images.length === 0) return;
    setLoading(true);
    const output = [];

    for (const file of images) {
      const text = await Tesseract.recognize(file, "eng", { logger: (m) => console.log(m) });

      const cleaned = cleanText(text.data.text);
      const fields = extractFields(cleaned);

      output.push({
        filename: file.name,
        company: fields.company,
        note_type: fields.note_type,
        reference_number: fields.reference_number,
        raw_text: cleaned,
      });
    }

    setResults(output);
    setLoading(false);
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(results);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "OCR Structured");

    const excelBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([excelBuffer]), "ocr_structured.xlsx");
  };

  return (
    <div>
      <h3>Upload Images</h3>
      <ImageUploader onUpload={handleUpload} />

      {images.length > 0 && <button onClick={processImages}>Start OCR</button>}

      {loading && <p>Processing images... please wait...</p>}

      {results.length > 0 && (
        <>
          <h3>OCR Results Preview (Structured)</h3>
          <pre>{JSON.stringify(results, null, 2)}</pre>
          <button onClick={exportToExcel}>Download Excel</button>
        </>
      )}
    </div>
  );
}
