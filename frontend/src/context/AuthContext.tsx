import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { User } from "../types";
import { getMe } from "../api/auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  setUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { i18n } = useTranslation();

  const syncLanguage = useCallback(
    (u: User | null) => {
      if (u?.language && u.language !== i18n.language) {
        i18n.changeLanguage(u.language);
      }
    },
    [i18n]
  );

  const handleSetUser = useCallback(
    (u: User | null) => {
      setUser(u);
      syncLanguage(u);
    },
    [syncLanguage]
  );

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then((u) => {
        setUser(u);
        syncLanguage(u);
      })
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, [syncLanguage]);

  return (
    <AuthContext.Provider value={{ user, loading, setUser: handleSetUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
