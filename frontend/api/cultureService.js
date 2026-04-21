import { API_ENDPOINTS, apiFetch } from '@api/client';

class CultureService {
  // ── Cultures utilisateurs ────────────────────────────────────────────────
  async getAllCultures() {
    try {
      const response = await apiFetch(API_ENDPOINTS.cultures.base);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('CultureService.getAllCultures:', error.message);
      throw new Error('Impossible de récupérer les cultures. Veuillez réessayer.');
    }
  }

  async addCulture(cultureData) {
    try {
      const response = await apiFetch(API_ENDPOINTS.cultures.base, {
        method: 'POST',
        body: JSON.stringify(cultureData),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('CultureService.addCulture:', error.message, { cultureData });
      throw new Error('Impossible d\'ajouter la culture. Vérifiez les données saisies.');
    }
  }

  async deleteCulture(id) {
    try {
      const response = await apiFetch(API_ENDPOINTS.cultures.byId(id), {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('CultureService.deleteCulture:', error.message, { id });
      throw new Error('Impossible de supprimer la culture. Réessayez plus tard.');
    }
  }

  // ── Base Kc (KCReference) — admin ────────────────────────────────────────
  async getAllKcCultures() {
    try {
      const response = await apiFetch(API_ENDPOINTS.kc.search);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('CultureService.getAllKcCultures:', error.message);
      throw new Error('Impossible de récupérer la base Kc. Contactez l\'administrateur.');
    }
  }

  async addKcCulture(kcData) {
    try {
      const response = await apiFetch(API_ENDPOINTS.kc.add, {
        method: 'POST',
        body: JSON.stringify(kcData),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('CultureService.addKcCulture:', error.message, { kcData });
      throw new Error('Impossible d\'ajouter la référence Kc. Vérifiez les données.');
    }
  }

  async deleteKcCulture(id) {
    try {
      const response = await apiFetch(API_ENDPOINTS.kc.delete(id), {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('CultureService.deleteKcCulture:', error.message, { id });
      throw new Error('Impossible de supprimer la référence Kc. Réessayez plus tard.');
    }
  }
}

export default new CultureService();