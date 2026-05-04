// hooks/useSession.js — CORRIGÉ
// Fix : brancher setUnauthorizedCallback pour rediriger vers login si token expiré
import { useEffect, useMemo, useState, useCallback } from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authAPI } from "@api/auth";
import { setUnauthorizedCallback, apiFetch, API_ENDPOINTS } from "@api/client";
import { AUTH_ROUTES } from "@constants/routes";

export function useSession() {
  const [session, setSession] = useState({
    isLoading: true,
    role: null,
    admin: null,
    user: null,
  });

  // ✅ FIX : callback appelé par apiFetch quand le token expire (401)
  const handleUnauthorized = useCallback(async () => {
    await authAPI.logout();
    setSession({ isLoading: false, role: null, admin: null, user: null });
    try {
      router.replace(AUTH_ROUTES.login);
    } catch {}
  }, []);

  useEffect(() => {
    // Enregistrer le callback une seule fois au montage
    setUnauthorizedCallback(handleUnauthorized);

    let isMounted = true;

    async function loadSession() {
      try {
        const [adminToken, userToken, admin, cachedUser] = await Promise.all([
          authAPI.getAdminToken(),
          authAPI.getUserToken(),
          authAPI.getAdmin(),
          authAPI.getUser(),
        ]);

        let user = cachedUser;

        // Always fetch fresh profile from server so admin edits reflect immediately
        if (userToken) {
          try {
            const res = await apiFetch(API_ENDPOINTS.auth.profile, {
              headers: { Authorization: `Bearer ${userToken}` },
            });
            if (res.ok) {
              const data = await res.json();
              const fresh = data?.data || data?.user;
              if (fresh) {
                user = fresh;
                await AsyncStorage.setItem("userData", JSON.stringify(fresh));
                // Sync display name so admin edits propagate to the drawer
                const freshName = `${fresh.firstName || ""} ${fresh.lastName || ""}`.trim();
                if (freshName) {
                  await AsyncStorage.setItem("userDisplayName", freshName);
                }
              }
            }
          } catch {}
        }

        if (!isMounted) return;

        setSession({
          isLoading: false,
          role:  adminToken ? "admin" : userToken ? "user" : null,
          admin: adminToken ? admin : null,
          user:  userToken  ? user  : null,
        });
      } catch {
        if (!isMounted) return;
        setSession({ isLoading: false, role: null, admin: null, user: null });
      }
    }

    loadSession();

    return () => {
      isMounted = false;
    };
  }, [handleUnauthorized]);

  return useMemo(
    () => ({
      ...session,
      isAuthenticated: Boolean(session.role),
    }),
    [session],
  );
}
