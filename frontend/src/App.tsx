import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Strains from "./pages/Strains";
import StrainDetail from "./pages/StrainDetail";
import Seeds from "./pages/Seeds";
import Grows from "./pages/Grows";
import GrowDetail from "./pages/GrowDetail";
import Profile from "./pages/Profile";
import { type ReactNode } from "react";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  if (loading) return <p>{t("common.loading")}</p>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="strains" element={<Strains />} />
        <Route path="strains/:id" element={<StrainDetail />} />
        <Route path="seeds" element={<Seeds />} />
        <Route path="grows" element={<Grows />} />
        <Route path="grows/:id" element={<GrowDetail />} />
        <Route path="profile" element={<Profile />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
