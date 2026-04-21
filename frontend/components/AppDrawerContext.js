import { createContext, useContext } from "react";

export const DrawerContext = createContext(null);

export function useDrawer() {
  const context = useContext(DrawerContext);
  if (!context) throw new Error("useDrawer must be used within AppDrawer");
  return context;
}

export function useOptionalDrawer() {
  return useContext(DrawerContext);
}
