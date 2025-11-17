import React, { useState } from "react";
import * as XLSX from "xlsx";

export default function ExcelUploader({ onExcelUpload }) {
  const [excelFile, setExcelFile] = useState(null);
  const [excelData, setExcelData] = useState(null);

  const allowedTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
  ];

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!allowedTypes.includes(file.type)) {
      alert("Only Excel (.xlsx / .xls) or CSV files are allowed.");
      return;
    }

    setExcelFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const workbook = XLSX.read(event.target.result, { type: "array" });

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      setExcelData(data);

      onExcelUpload(data);
    };

    reader.readAsArrayBuffer(file);
  };

  const removeFile = () => {
    setExcelFile(null);
    setExcelData(null);

    // tell parent that excel was removed
    onExcelUpload(null);

    // clear input element
    document.getElementById("excel-input").value = "";
  };

  return (
    <div style={{ marginTop: "30px" }}>
      <h3>Upload Excel File</h3>

      <input
        id="excel-input"
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileChange}
        style={{
          padding: "10px",
          border: "1px solid #ccc",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      />

      {/* Selected file + remove button */}
      {excelFile && (
        <div
          style={{
            marginTop: "10px",
            padding: "10px",
            background: "#fafafa",
            border: "1px solid #ddd",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            maxWidth: "350px",
          }}
        >
          <span style={{ fontSize: "14px" }}>
            <strong>Selected:</strong> {excelFile.name}
          </span>

          <button
            onClick={removeFile}
            style={{
              marginLeft: "10px",
              background: "#ff4d4f",
              color: "white",
              border: "none",
              padding: "6px 10px",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Remove
          </button>
        </div>
      )}

      {/* Excel Preview */}
      {excelData && (
        <div style={{ marginTop: "20px" }}>
          <h4>Excel Preview (JSON)</h4>
          <div
            style={{
              background: "#f5f5f5",
              padding: "10px",
              borderRadius: "8px",
              maxHeight: "250px",
              overflow: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            <pre>{JSON.stringify(excelData, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
