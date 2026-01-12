import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import OCRProcessor from "./components/OCRProcessor.js";
import PdfToImageDownloader from "./components/pdfConverter.js";

function App() {
  return (
    <div className="App" style={{ padding: 20 }}>
      <h1>Image-to-Excel Converter</h1>

      {/* Navigation Links */}
      <nav style={{ marginBottom: 20 }}>
        <Link to="/" style={{ marginRight: 10 }}>OCR Processor</Link>
        <Link to="/pdfImages">PDF → Images</Link>
      </nav>

      {/* Routes */}
      <Routes>
        <Route path="/" element={<OCRProcessor />} />
        <Route path="/pdfImages" element={<PdfToImageDownloader />} />
      </Routes>
    </div>
  );
}

export default App;
