import React, { useState } from "react";
import * as XLSX from "xlsx";
import axios from "axios";

export default function SupplierExcelUploader({ onSupplierUpload }) {
  const [excelData, setExcelData] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);

  // Read Excel file: Row 6 = headers, Row 7+ = data
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.match(/\.(xls|xlsx)$/)) {
      alert("Only Excel files are allowed");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const HEADER_ROW = 6; // Excel row 6 = headers (1-based)

      // 🔹 Extract headers from row 6
      const range = XLSX.utils.decode_range(sheet["!ref"]);
      const headers = [];

      for (let C = range.s.c; C <= range.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({
          r: HEADER_ROW - 1, // zero-based index
          c: C,
        });
        const cell = sheet[cellAddress];
        headers.push(cell ? cell.v.toString().trim() : `EMPTY_${C}`);
      }

      // 🔹 Extract data from row 7 onwards
      const jsonData = XLSX.utils.sheet_to_json(sheet, {
        header: headers,
        range: HEADER_ROW, // start AFTER header row
        defval: "",
      });

      if (!jsonData.length) {
        alert("No data rows found after header row");
        return;
      }

      setExcelData(jsonData);
      setFileName(file.name);
    } catch (err) {
      console.error("Excel read error:", err);
      alert("Failed to read Excel file");
    }
  };

  // Upload all data to backend
  const handleUpload = async () => {
    if (!excelData.length) {
      alert("No data to upload");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        "http://localhost:5000/upload-supplier-excel",
        { data: excelData }
      );

      alert(
        `Upload successful!\nAdded: ${response.data.added_rows}, Updated: ${response.data.updated_rows}`
      );

      onSupplierUpload?.(excelData);

      // Reset state
      setExcelData([]);
      setFileName("");
    } catch (err) {
      console.error("Upload failed:", err.response?.data || err.message);
      alert("Supplier Excel upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: "10px" }}>
      <label
        style={{
          display: "inline-block",
          padding: "10px 20px",
          background: "#ff9800",
          color: "white",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        Upload Supplier Excel
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </label>

      {fileName && (
        <div style={{ marginTop: "10px" }}>
          <p>
            <strong>Selected file:</strong> {fileName}
          </p>

          <button
            onClick={handleUpload}
            disabled={loading}
            style={{
              padding: "8px 20px",
              background: loading ? "#9e9e9e" : "#4caf50",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Uploading..." : "Confirm Upload"}
          </button>
        </div>
      )}
    </div>
  );
}
