import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import NavContextProvider from "./components/navigation/nav-provider";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <NavContextProvider>
      <App />
    </NavContextProvider>
  </React.StrictMode>,
);
