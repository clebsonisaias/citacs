"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface NavContextType {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
}

const NavContext = createContext<NavContextType | undefined>(undefined);

export function NavProvider({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setMobileMenuOpen((prev) => !prev);

  return (
    <NavContext.Provider value={{ mobileMenuOpen, setMobileMenuOpen, toggleMobileMenu }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  const context = useContext(NavContext);
  if (!context) {
    return {
      mobileMenuOpen: false,
      setMobileMenuOpen: () => {},
      toggleMobileMenu: () => {},
    };
  }
  return context;
}
