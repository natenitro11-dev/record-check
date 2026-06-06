import "./index.css";
import { useState } from "react";

export default function App() {
  return (
    <div style={{background:"#0a0f1e",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"1rem"}}>
      <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:"3rem",color:"#F0D060",letterSpacing:"0.1em"}}>THE RECORD CHECK</div>
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:"0.6rem",color:"#2a3d6e",letterSpacing:"0.2em"}}>@therecordcheck</div>
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:"0.5rem",color:"#2E8B57",marginTop:"1rem"}}>BUILD SUCCESSFUL — Full app loading...</div>
    </div>
  );
}
