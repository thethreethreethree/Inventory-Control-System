import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ActingUserProvider } from "./lib/actingUser";
import { App } from "./App";
import { Dashboard } from "./pages/Dashboard";
import { Items } from "./pages/Items";
import { Movements } from "./pages/Movements";
import { Transfers } from "./pages/Transfers";
import { Counts } from "./pages/Counts";
import { Adjustments } from "./pages/Adjustments";
import { Purchasing } from "./pages/Purchasing";
import { Recipes } from "./pages/Recipes";
import { Periods } from "./pages/Periods";
import { Reports } from "./pages/Reports";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <ActingUserProvider>
        <Routes>
          <Route element={<App />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/items" element={<Items />} />
          <Route path="/movements" element={<Movements />} />
          <Route path="/transfers" element={<Transfers />} />
          <Route path="/counts" element={<Counts />} />
          <Route path="/adjustments" element={<Adjustments />} />
          <Route path="/purchasing" element={<Purchasing />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/periods" element={<Periods />} />
          <Route path="/reports" element={<Reports />} />
          </Route>
        </Routes>
      </ActingUserProvider>
    </BrowserRouter>
  </StrictMode>,
);
