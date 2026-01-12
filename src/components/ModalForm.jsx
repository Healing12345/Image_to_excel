import React from "react";

export default function ModalForm({ visible, onClose, onSave, title, fields, setFields }) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "8px",
          width: "350px",
          boxShadow: "0px 4px 10px rgba(0,0,0,0.2)",
        }}
      >
        <h3>{title}</h3>

        {Object.keys(fields).map((key) => (
          <div key={key} style={{ marginBottom: "10px" }}>
            <label style={{ fontWeight: "bold" }}>{key}</label>
            <input
              type="text"
              value={fields[key]}
              onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                marginTop: "5px",
              }}
            />
          </div>
        ))}

        <div style={{ marginTop: "20px", textAlign: "right" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 12px",
              background: "#ccc",
              border: "none",
              borderRadius: "6px",
              marginRight: "10px",
            }}
          >
            Cancel
          </button>

          <button
            onClick={() => onSave(fields)}
            style={{
              padding: "8px 12px",
              background: "#4caf50",
              border: "none",
              color: "white",
              borderRadius: "6px",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
