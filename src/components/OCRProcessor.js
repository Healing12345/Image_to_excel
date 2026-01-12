import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import ImageUploader from "./ImageUploader.js";
import ExcelUploader from "./ExcelUploader.jsx";
import Tesseract from "tesseract.js";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import ModalForm from "./ModalForm.jsx";
import SupplierExcelUploader from "./SupplierExcelUploader.jsx";

// CLEAN TEXT
const cleanText = (text) => {
  if (!text) return "";
  return text
    .replace(/\n+/g, " ")
    .replace(/[^a-zA-Z0-9\s.,/-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

// NOTE TYPE DETECTION
const extractNoteType = (text) => {
  const lower = text.toLowerCase();
  if (lower.includes("transfer") && lower.includes("advice") && lower.includes("note"))
    return "TRANSFER HIRE ADVICE NOTE";
  if (lower.includes("shipment") && lower.includes("date")) return "TRANSFER OUT";
  if (lower.includes("pallet") && lower.includes("control") && lower.includes("note"))
    return "PALLET CONTROL NOTE";
  if (lower.includes("issue") && lower.includes("note")) return "ISSUE NOTE";
  if (lower.includes("transfer") && lower.includes("note")) return "TRANSFER NOTE";
  if (lower.includes("notes(hand written)")) return "TRANSFER OUT";
  return "";
};

// UNIVERSAL REFERENCE EXTRACTION
const extractReferenceNumber = (text) => {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, " ");
  const redRef = cleaned.match(/\b(\d{3})[-\s]?(\d{6,7})\b/);
  if (redRef) return redRef[1] + redRef[2];
  const labelRef = cleaned.match(/reference[:\s]+([A-Za-z0-9-]+)/i);
  if (labelRef) return labelRef[1];
  const barcodes = cleaned.match(/\b\d{9,12}\b/g);
  if (barcodes && barcodes.length > 0) return barcodes.sort((a, b) => b.length - a.length)[0];
  const tnRef = cleaned.match(/\bTN\s?(\d{4,6})\b/i);
  if (tnRef) return `TN${tnRef[1]}`;
  const tirRef = cleaned.match(/\bTIR\d{7,12}\b/i);
  if (tirRef) return tirRef[0];
  return "";
};

// FIELD extraction
const extractFields = (text) => {
  const Type = extractNoteType(text);
  const reference_number = extractReferenceNumber(text);
  const Supplier_Name = "";
  const PO_Number = "";
  const Ref_1 = "";
  const Ref_2 = "";
  const Qnty = "";
  return { Type, Date: "", reference_number, Supplier_Name, PO_Number, Ref_1, Ref_2, Qnty };
};

export default function OCRProcessor() {
  const [images, setImages] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [excelMatches, setExcelMatches] = useState(null);

  // SEARCH
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState(null);

  // MODAL
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalFields, setModalFields] = useState({});
  const [modalCallback, setModalCallback] = useState(() => {});

  // IMAGE UPLOAD
  const handleUpload = (files) => {
    setImages(files);
    setResults([]);
  };

  // SAVE EXCEL
  const saveExcelFile = (data) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "OCR Structured");
    const excelBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([excelBuffer]), "ocr_structured.xlsx");
  };

  // OCR PROCESS
  const processImages = async () => {
    if (!images.length) return;
    setLoading(true);
    try {
      const output = await Promise.all(
        images.map(async (file) => {
          const { data } = await Tesseract.recognize(file, "eng", { logger: (m) => console.log(file.name, m) });
          const cleaned = cleanText(data.text);
          const fields = extractFields(cleaned);
          return { filename: file.name, ...fields };
        })
      );
      setResults(output);
      await axios.post("http://localhost:5000/save-excel", { results: output });
      saveExcelFile(output);
    } catch (error) {
      console.error("OCR failed:", error);
      alert("An error occurred while processing images.");
    } finally {
      setLoading(false);
    }
  };

  // EXCEL UPLOAD → MATCHES
  const handleExcelUpload = async (excelData) => {
    if (!excelData) return setExcelMatches(null);
    try {
      const response = await axios.post("http://localhost:5000/find-matching-references", { data: excelData });
      setExcelMatches(response.data);

      // 🔽 AUTO DOWNLOAD EXCEL
      if (response.data.download_url) {
         const link = document.createElement("a");
         link.href = response.data.download_url;
         link.download = ""; // browser uses backend filename
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
    }

    } catch (error) {
      console.error(error.response?.data || error.message);
      alert("Error searching for matching reference numbers.");
    }
  };

   /* ================= SUPPLIER UPLOAD ================= */
  const handleSupplierExcelUpload = async (supplierData) => {
    try {
      await axios.post("http://localhost:5000/upload-supplier-excel", {
        data: supplierData,
      });
      alert("Supplier Excel uploaded successfully");
    } catch {
      alert("Supplier upload failed");
    }
  };

  // SEARCH
 const handleSearch = async () => {
  if (!searchQuery.trim()) return;

  // Split by comma, space, or new line
  const references = searchQuery
    .split(/[\s,]+/)
    .map(r => r.trim())
    .filter(Boolean);

  try {
    const res = await axios.post("http://localhost:5000/search", {
      references
    });
    setSearchResult(res.data);
  } catch (err) {
    console.error(err);
    alert("Search failed.");
  }
};

  // ADD ROW (Modal)
  const handleAdd = (item) => {
    setModalTitle("Add New Excel Row");
    setModalFields({ Date: "", reference_number: "", Supplier_Name: "", PO_Number: "", Ref_1: "", Ref_2: "", quantity: "" });

    setModalCallback(() => async (fieldsFromModal) => {
      try {
        await axios.post("http://localhost:5000/add-excel-row", { file: item.file, new_row: fieldsFromModal });
        alert("Row added.");
        setModalVisible(false);
        handleSearch();
      } catch (error) {
        console.error("ADD ERROR:", error.response?.data || error);
        alert("Add failed.");
      }
    });

    setModalVisible(true);
  };

  // UPDATE ROW (Modal)
  const handleUpdate = (item) => {
    setModalTitle("Update Excel Row");
    setModalFields({
      Date: item.data.Date || "",
      docket_number: item.data.docket_number || "",
      Supplier_Name: item.data.Supplier_Name || "",
      PO_Number: item.data.PO_Number || "",
      Ref_1: item.data.Ref_1 || "",
      Ref_2: item.data.Ref_2 || "",
      quantity: item.data.quantity || "",
    });

    setModalCallback(() => async (fieldsFromModal) => {
      try {
        await axios.post("http://localhost:5000/update-excel-row", {
          file: item.file,
          reference_number: item.data.reference_number,
          updates: fieldsFromModal,
        });
        alert("Row updated.");
        setModalVisible(false);
        handleSearch();
      } catch (error) {
        console.error(error.response?.data || error);
        alert("Update failed.");
      }
    });

    setModalVisible(true);
  };

  // DELETE ROW
  const handleDelete = async (item) => {
    if (!window.confirm("Delete this row?")) return;
    try {
      await axios.post("http://localhost:5000/delete-excel-row", { file: item.file, reference_number: item.data.reference_number });
      alert("Row deleted.");
      handleSearch();
    } catch (error) {
      console.error(error.response?.data || error);
      alert("Delete failed.");
    }
  };

  return (
    <div style={{ padding: "20px" }}>

      <h2>OCR Processor</h2>

      <h3>Upload Images</h3>
      <ImageUploader onUpload={handleUpload} />

      {/* 🔹 Excel Upload Buttons */}
      <div style={{ display: "flex", gap: "15px", marginTop: "15px" }}>
        <ExcelUploader onExcelUpload={handleExcelUpload} />
        <SupplierExcelUploader onSupplierUpload={handleSupplierExcelUpload} />
      </div>

      <div style={{ marginTop: "25px", marginBottom: "15px" }}>
        <h3>Search Saved OCR Results</h3>
        <input
          type="text"
          value={searchQuery}
          placeholder="Enter one or multiple docket / reference numbers (comma or space separated)"
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ padding: "10px", width: "300px", marginRight: "10px", borderRadius: "6px", border: "1px solid #ccc" }}
        />
        <button
          onClick={handleSearch}
          style={{ padding: "10px 20px", background: "#2196f3", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}
        >
          Search
        </button>
      </div>

      {searchResult && (
        <div style={{ marginTop: "20px" }}>
          <h4>Search Results:</h4>
          <p><strong>Found:</strong> {searchResult.count}</p>
          {searchResult.count > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fafafa", borderRadius: "8px", overflow: "hidden" }}>
              <thead style={{ background: "#1976d2", color: "white" }}>
                <tr>
                  <th style={{ padding: "10px", border: "1px solid #ddd" }}>Date</th>
                  <th style={{ padding: "10px", border: "1px solid #ddd" }}>Docket</th>
                  <th style={{ padding: "10px", border: "1px solid #ddd" }}>Supplier Name </th>
                  <th style={{ padding: "10px", border: "1px solid #ddd" }}>PO Number</th>
                  <th style={{ padding: "10px", border: "1px solid #ddd" }}>Ref 1</th>
                  <th style={{ padding: "10px", border: "1px solid #ddd" }}>Ref 2</th>
                  <th style={{ padding: "10px", border: "1px solid #ddd" }}>Qnty</th>
                  <th style={{ padding: "10px", border: "1px solid #ddd" }}>File</th>
                  <th style={{ padding: "10px", border: "1px solid #ddd" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {searchResult.results.map((item, idx) => {
                  const row = item.data;
                  return (
                    <tr key={idx}>
                      <td style={{ padding: "10px", border: "1px solid #ddd" }}>{row.Date || "-"}</td>
                      <td style={{ padding: "10px", border: "1px solid #ddd" }}>{row.reference_number || "-"}</td>
                      <td style={{ padding: "10px", border: "1px solid #ddd" }}>{row.Supplier_Name || "-"}</td>
                      <td style={{ padding: "10px", border: "1px solid #ddd" }}>{row.PO_Number || "-"}</td>
                      <td style={{ padding: "10px", border: "1px solid #ddd" }}>{row.Ref_1 || "-"}</td>
                      <td style={{ padding: "10px", border: "1px solid #ddd" }}>{row.Ref_2 || "-"}</td>
                      <td style={{ padding: "10px", border: "1px solid #ddd" }}>{row.quantity || "-"}</td>
                      <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                        <a href={item.file_url} target="_blank" rel="noreferrer">{item.file}</a>
                      </td>
                      <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                        <button onClick={() => handleAdd(item)} style={{ marginRight: "5px", background: "#4caf50", color: "white", padding: "6px 10px", border: "none", borderRadius: "4px", cursor: "pointer" }}>Add</button>
                        <button onClick={() => handleUpdate(item)} style={{ marginRight: "5px", background: "#f9a825", color: "white", padding: "6px 10px", border: "none", borderRadius: "4px", cursor: "pointer" }}>Update</button>
                        <button onClick={() => handleDelete(item)} style={{ background: "#e53935", color: "white", padding: "6px 10px", border: "none", borderRadius: "4px", cursor: "pointer" }}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {images.length > 0 && (
        <button
          onClick={processImages}
          disabled={loading}
          style={{ marginTop: "15px", padding: "10px 20px", background: "#4caf50", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}
        >
          {loading ? "Processing..." : "Process & Save Excel"}
        </button>
      )}

      <ModalForm
        visible={modalVisible}
        title={modalTitle}
        fields={modalFields}
        setFields={setModalFields}
        onSave={modalCallback}
        onClose={() => setModalVisible(false)}
      />
    </div>
  );
}
