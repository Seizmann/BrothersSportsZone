import { createRoot } from "react-dom/client";
import { App } from "./routes/router";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
