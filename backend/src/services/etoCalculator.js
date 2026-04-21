/**
 * Calculateur d'Évapotranspiration de référence (ET₀)
 * Basé sur la méthode FAO-56 Penman-Monteith
 */

class EToCalculator {
  /**
   * Calcule ET₀ avec la méthode Penman-Monteith
   * @param {Object} params - Paramètres météo
   * @returns {number} ET₀ en mm/jour
   */
  calculatePenmanMonteith(params) {
    const {
      tmax, tmin, // Températures max et min (°C)
      hrmax, hrmin, // Humidités relatives max et min (%)
      windSpeed, // Vitesse du vent à 2m (m/s)
      solarRadiation, // Rayonnement solaire Rs (MJ/m²/j)
      altitude = 0 // Altitude (m)
    } = params;

    // Constantes
    const G = 0; // Flux de chaleur du sol (négligeable pour calcul journalier)
    const albedo = 0.23; // Albédo de référence
    const sigma = 4.903e-9; // Constante de Stefan-Boltzmann (MJ/K⁴/m²/j)
    const Tk = 273.16; // Zéro absolu en Kelvin

    // Température moyenne
    const tmean = (tmax + tmin) / 2;

    // Pression atmosphérique (kPa)
    const P = 101.3 * Math.pow((293 - 0.0065 * altitude) / 293, 5.26);

    // Constante psychrométrique (kPa/°C)
    const gamma = 0.000665 * P;

    // Pression de vapeur saturante (kPa)
    const es_tmax = 0.6108 * Math.exp((17.27 * tmax) / (tmax + 237.3));
    const es_tmin = 0.6108 * Math.exp((17.27 * tmin) / (tmin + 237.3));
    const es = (es_tmax + es_tmin) / 2;

    // Pression de vapeur actuelle (kPa)
    const ea = (es_tmin * (hrmax / 100) + es_tmax * (hrmin / 100)) / 2;

    // Pente de la courbe de pression de vapeur (kPa/°C)
    const delta = (4098 * es) / Math.pow(tmean + 237.3, 2);

    // Rayonnement extraterrestre (MJ/m²/j) - calcul approximatif
    // Pour un calcul précis, il faudrait la latitude et le jour de l'année
    const Ra = this.calculateExtraterrestrialRadiation(params.latitude, params.dayOfYear);

    // Rayonnement solaire (Rs) fourni ou estimé
    const Rs = solarRadiation || this.estimateSolarRadiation(Ra, params.cloudCover);

    // Rayonnement de courtes longueurs d'onde net (MJ/m²/j)
    const Rns = (1 - albedo) * Rs;

    // Rayonnement de grandes longueurs d'onde net (MJ/m²/j)
    const Rnl = sigma * (Math.pow(tmax + Tk, 4) + Math.pow(tmin + Tk, 4)) / 2 *
                (0.34 - 0.14 * Math.sqrt(ea)) * (1.35 * Rs / Ra - 0.35);

    // Rayonnement net (MJ/m²/j)
    const Rn = Rns - Rnl;

    // Terme radiatif
    const radiativeTerm = (0.408 * delta * (Rn - G)) / (delta + gamma * (1 + 0.34 * windSpeed));

    // Terme aérodynamique
    const aerodynamicTerm = (gamma * (900 / (tmean + 273)) * windSpeed * (es - ea)) / 
                           (delta + gamma * (1 + 0.34 * windSpeed));

    // ET₀ final (mm/jour)
    const et0 = radiativeTerm + aerodynamicTerm;

    return Math.max(0, parseFloat(et0.toFixed(2)));
  }

  /**
   * Calcule le rayonnement extraterrestre
   */
  calculateExtraterrestrialRadiation(latitude, dayOfYear) {
    // Constante solaire (MJ/m²/min)
    const Gsc = 0.0820;
    
    // Conversion latitude en radians
    const phi = latitude * Math.PI / 180;
    
    // Déclinaison solaire (radians)
    const delta = 0.409 * Math.sin((2 * Math.PI / 365) * dayOfYear - 1.39);
    
    // Distance relative Terre-Soleil
    const dr = 1 + 0.033 * Math.cos((2 * Math.PI / 365) * dayOfYear);
    
    // Angle horaire au coucher du soleil (radians)
    const ws = Math.acos(-Math.tan(phi) * Math.tan(delta));
    
    // Rayonnement extraterrestre (MJ/m²/j)
    const Ra = (24 * 60 / Math.PI) * Gsc * dr * (
      ws * Math.sin(phi) * Math.sin(delta) + 
      Math.cos(phi) * Math.cos(delta) * Math.sin(ws)
    );
    
    return Ra;
  }

  /**
   * Estime le rayonnement solaire à partir de la couverture nuageuse
   */
  estimateSolarRadiation(Ra, cloudCover) {
    // Formule simplifiée
    const as = 0.25;
    const bs = 0.5;
    const nN = 1 - cloudCover / 100; // Fraction d'insolation
    
    return Ra * (as + bs * nN);
  }

  /**
   * Calcule ETc (besoin réel de la culture)
   * @param {number} et0 - Évapotranspiration de référence
   * @param {number} kc - Coefficient cultural
   * @returns {number} ETc en mm/jour
   */
  calculateETc(et0, kc) {
    return parseFloat((et0 * kc).toFixed(2));
  }

  /**
   * Convertit ETc en volume d'irrigation
   * @param {number} etc - ETc en mm/jour
   * @param {number} surface - Surface en m²
   * @param {number} efficacite - Efficacité d'irrigation (0-1)
   * @returns {Object} Volumes en différentes unités
   */
  convertToVolume(etc, surface, efficacite = 0.9) {
    // 1 mm = 1 L/m² = 10 m³/ha
    const volumeTotal = etc * surface; // Litres
    const volumeM3 = volumeTotal / 1000; // m³
    const volumeHa = etc * 10; // m³/ha
    
    // Ajustement pour efficacité
    const volumeReelM3 = volumeM3 / efficacite;
    const volumeReelHa = volumeHa / efficacite;
    
    return {
      mm: etc,
      litresParM2: etc,
      litresTotal: volumeTotal,
      m3Total: volumeM3,
      m3ParHa: volumeHa,
      m3ReelTotal: volumeReelM3,
      m3ReelParHa: volumeReelHa,
      efficacite: efficacite
    };
  }
}

module.exports = new EToCalculator();