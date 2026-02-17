import React, { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";

export default function ImageUploader({ onUpload }) {
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState({}); // { fileKey: percent }

  // Clean up preview URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach((file) => URL.revokeObjectURL(file.preview));
    };
  }, [files]);

  const handleDrop = (acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      alert("Some files were rejected (invalid type or too large).");
    }

    // Add preview URLs
    const withPreview = acceptedFiles.map((file) => {
      const previewURL = URL.createObjectURL(file);
      return Object.assign(file, { preview: previewURL });
    });

    // Merge existing + new
    const merged = [...files, ...withPreview];

    // Remove duplicates (name + size)
    const unique = Array.from(
      new Map(merged.map((f) => [`${f.name}-${f.size}`, f])).values()
    );

    setFiles(unique);
    onUpload(unique);

    // Start progress only for newly added files
    simulateProgress(unique, withPreview);
  };

  const simulateProgress = (allFiles, newFiles) => {
    newFiles.forEach((file) => {
      const key = file.name + "-" + file.size;

      // If progress already exists (file was uploaded before), skip
      if (progress[key] >= 100) return;

      let percent = 0;
      const timer = setInterval(() => {
        percent += Math.random() * 15 + 5; // +5 to +20 per tick

        if (percent >= 100) {
          percent = 100;
          clearInterval(timer);
        }

        setProgress((prev) => ({ ...prev, [key]: percent }));
      }, 300);
    });
  };

  const removeFile = (fileToRemove) => {
    URL.revokeObjectURL(fileToRemove.preview);

    const updated = files.filter(
      (f) => !(f.name === fileToRemove.name && f.size === fileToRemove.size)
    );

    setFiles(updated);
    onUpload(updated);
  };

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      accept: { "image/*": [] },
      multiple: true,
      maxSize: 8 * 1024 * 1024, // 8MB
      onDrop: handleDrop,
    });

  const clearAll = () => {
    // revoke all preview URLs
    files.forEach((file) => URL.revokeObjectURL(file.preview));

    setFiles([]);
    setProgress({});

    // notify parent that nothing is uploaded anymore
    onUpload([]);
  };


  return (
    <div>
      {/* DROPZONE */}
      <div
        {...getRootProps()}
        style={{
          border: "2px dashed #888",
          padding: "20px",
          borderRadius: "12px",
          textAlign: "center",
          cursor: "pointer",
          background: isDragActive ? "#eef8ff" : "#fafafa",
          transition: ".2s ease",
        }}
      >
        <input {...getInputProps()} />

        {isDragReject ? (
          <p style={{ color: "red" }}>Only images are allowed.</p>
        ) : isDragActive ? (
          <p>Drop your images here...</p>
        ) : (
          <p>Drag & drop multiple images, or click to select</p>
        )}
      </div>
      {/* CLEAR ALL BUTTON */}
      {files.length > 0 && (
         <div style={{ marginTop: "15px", textAlign: "right" }}>
            <button
              onClick={clearAll}
              style={{ padding: "8px 16px", background: "#9e9e9e", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", }}
            >
              Clear All
            </button>
         </div>
      )}

      {/* PREVIEW LIST */}
      {files.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <strong>Images:</strong>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              marginTop: "10px",
            }}
          >
            {files.map((file) => {
              const key = file.name + "-" + file.size;

              return (
                <div
                  key={key}
                  style={{
                    width: "130px",
                    border: "1px solid #ccc",
                    borderRadius: "8px",
                    padding: "8px",
                    textAlign: "center",
                    background: "#fff",
                    position: "relative",
                  }}
                >
                  {/* REMOVE BUTTON */}
                  <button
                    onClick={() => removeFile(file)}
                    style={{
                      position: "absolute",
                      top: "-8px",
                      right: "-8px",
                      background: "#ff4d4f",
                      color: "white",
                      border: "none",
                      borderRadius: "50%",
                      width: "24px",
                      height: "24px",
                      cursor: "pointer",
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                    }}
                  >
                    ✕
                  </button>

                  <img
                    src={file.preview}
                    alt="preview"
                    style={{
                      width: "100%",
                      height: "90px",
                      objectFit: "cover",
                      borderRadius: "6px",
                    }}
                  />

                  <div
                    style={{
                      fontSize: "12px",
                      marginTop: "5px",
                      wordBreak: "break-word",
                    }}
                  >
                    {file.name}
                  </div>

                  {/* PROGRESS BAR */}
                  <div
                    style={{
                      marginTop: "6px",
                      height: "6px",
                      background: "#eee",
                      borderRadius: "4px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${progress[key] || 0}%`,
                        height: "100%",
                        background: "#4caf50",
                        transition: "width 0.3s",
                      }}
                    ></div>
                  </div>

                  <div style={{ fontSize: "10px", marginTop: "4px" }}>
                    {progress[key] ? Math.round(progress[key]) : 0}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
