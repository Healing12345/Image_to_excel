import React, { useState } from "react";
import * as pdfjsLib from "pdfjs-dist/build/pdf.js";
import axios from "axios";

pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.js`;

const PdfToImageDownloader = () => {
  const [images, setImages] = useState([]);
  const [serverPDFs, setServerPDFs] = useState([]);

  // Upload local PDFs to server
  const uploadFiles = async (files) => {
    if (!files || !files.length) return;

    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("pdfs", file));

    try {
      const res = await axios.post("http://localhost:5000/upload-pdf", formData);
      setServerPDFs(res.data.files);
      alert("PDF(s) uploaded to server successfully!");
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    }
  };

  // Convert PDF (local file or server URL) to images and upload to VPS
  const convertPDFToImages = async (pdfSource, fileName) => {
    let arrayBuffer;

    if (typeof pdfSource === "string") {
      const res = await fetch(pdfSource);
      arrayBuffer = await res.arrayBuffer();
    } else {
      arrayBuffer = await pdfSource.arrayBuffer();
    }

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const allImages = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2 });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport }).promise;

      const imgData = canvas.toDataURL("image/png");
      const pageFileName = `${fileName}-page-${pageNum}.png`;
      allImages.push({ src: imgData, fileName: pageFileName });

      // Download locally
      canvas.toBlob(async (blob) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = pageFileName;
        link.click();
        URL.revokeObjectURL(link.href);

        // Upload to server
        const formData = new FormData();
        formData.append("image", new File([blob], pageFileName, { type: "image/png" }));

        try {
           const res = await axios.post("http://localhost:5000/upload-image", formData);
           console.log("Uploaded image:", res.data.url);
        } catch (err) {
          console.error("Image upload failed:", err.response?.data || err);
        }
      }, "image/png");
    }

    setImages((prev) => [...prev, ...allImages]);
  };

  const handleLocalFiles = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    await uploadFiles(files);

    for (const file of files) {
      await convertPDFToImages(file, file.name);
    }
  };

  const handleServerPDFClick = async (pdf) => {
    await convertPDFToImages(pdf.url, pdf.originalName);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>PDF → Images → Download</h2>
      <input type="file" accept="application/pdf" multiple onChange={handleLocalFiles} />

      {serverPDFs.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4>Server PDFs:</h4>
          <ul>
            {serverPDFs.map((pdf, idx) => (
              <li key={idx}>
                <button onClick={() => handleServerPDFClick(pdf)}>
                  Convert & Download {pdf.originalName}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {images.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4>Preview:</h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {images.map((img, idx) => (
              <img
                key={idx}
                src={img.src}
                alt={img.fileName}
                style={{ width: 200, border: "1px solid #ccc", padding: 4 }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PdfToImageDownloader;
