import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

function fmtDate(d) {
  try { return new Date(d).toLocaleDateString("fr-FR"); } catch { return "—"; }
}

function buildHtml({ irrigations = [], fertilisations = [], cultureName = "" }) {
  const month = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const totalLitres = irrigations.reduce((s, i) => s + (parseFloat(i.volume) || 0), 0);
  const totalM3 = (totalLitres / 1000).toFixed(1);

  const irrigRows = irrigations.slice(0, 50).map((i) => `
    <tr>
      <td>${fmtDate(i.date)}</td>
      <td>${i.nom || i.cultureId?.nom || "—"}</td>
      <td>${i.mode || "—"}</td>
      <td>${i.volume ? `${(i.volume / 1000).toFixed(3)} m³` : "—"}</td>
      <td>${i.duree || i.temps || "—"} min</td>
      <td>${i.et0 != null ? Number(i.et0).toFixed(2) : "—"}</td>
      <td>${i.etc != null ? Number(i.etc).toFixed(2) : "—"}</td>
      <td>${i.kc != null ? Number(i.kc).toFixed(2) : "—"}</td>
    </tr>
  `).join("");

  const fertRows = fertilisations.slice(0, 30).map((f) => `
    <tr>
      <td>${fmtDate(f.date)}</td>
      <td>${f.cultureId?.nom || f.nom || "—"}</td>
      <td>${f.produit || "—"}</td>
      <td>${f.typeProduit || "—"}</td>
      <td>${f.dose != null ? `${f.dose} ${f.uniteDose || ""}`.trim() : "—"}</td>
      <td>${f.modeApplication || "—"}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; background: #fff; padding: 32px; font-size: 13px; }
  .header { background: linear-gradient(135deg, #15803d 0%, #16a34a 100%); color: #fff; padding: 24px 28px; border-radius: 14px; margin-bottom: 24px; }
  .header h1 { font-size: 22px; margin-bottom: 6px; }
  .header p { opacity: 0.85; font-size: 12px; }
  .stats { display: flex; gap: 14px; margin-bottom: 28px; }
  .stat { flex: 1; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; text-align: center; }
  .stat .val { font-size: 26px; font-weight: 700; color: #15803d; line-height: 1; margin-bottom: 4px; }
  .stat .lbl { font-size: 11px; color: #6b7280; }
  h2 { color: #15803d; border-bottom: 2px solid #bbf7d0; padding-bottom: 6px; margin: 28px 0 14px; font-size: 15px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f0fdf4; color: #15803d; padding: 8px 10px; text-align: left; border-bottom: 2px solid #bbf7d0; font-size: 11px; font-weight: 700; }
  td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; font-size: 11px; }
  tr:nth-child(even) td { background: #fafafa; }
  .empty { color: #9ca3af; font-style: italic; padding: 12px 0; }
  .footer { margin-top: 36px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 14px; }
</style></head>
<body>
  <div class="header">
    <h1>📊 Rapport mensuel — SmartIrrig</h1>
    <p>${month}${cultureName ? ` · Culture : ${cultureName}` : ""} · Généré le ${fmtDate(new Date())}</p>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="val">${irrigations.length}</div>
      <div class="lbl">Irrigations</div>
    </div>
    <div class="stat">
      <div class="val">${totalM3} m³</div>
      <div class="lbl">Volume total</div>
    </div>
    <div class="stat">
      <div class="val">${fertilisations.length}</div>
      <div class="lbl">Fertilisations</div>
    </div>
    <div class="stat">
      <div class="val">${irrigations.length > 0 ? (totalLitres / irrigations.length / 1000).toFixed(3) : 0} m³</div>
      <div class="lbl">Moy./irrigation</div>
    </div>
  </div>

  <h2>💧 Historique d'irrigation</h2>
  ${irrigations.length === 0
    ? `<p class="empty">Aucune irrigation enregistrée.</p>`
    : `<table>
      <thead>
        <tr><th>Date</th><th>Culture</th><th>Mode</th><th>Volume</th><th>Durée</th><th>ET₀</th><th>ETc</th><th>Kc</th></tr>
      </thead>
      <tbody>${irrigRows}</tbody>
    </table>`}

  <h2>🌿 Historique de fertilisation</h2>
  ${fertilisations.length === 0
    ? `<p class="empty">Aucune fertilisation enregistrée.</p>`
    : `<table>
      <thead>
        <tr><th>Date</th><th>Culture</th><th>Produit</th><th>Type</th><th>Dose</th><th>Mode</th></tr>
      </thead>
      <tbody>${fertRows}</tbody>
    </table>`}

  <div class="footer">SmartIrrig — Agriculture intelligente · PFE ${new Date().getFullYear()} · Données FAO-56</div>
</body></html>`;
}

export async function exportPDFReport({ irrigations = [], fertilisations = [], cultureName = "" }) {
  const html = buildHtml({ irrigations, fertilisations, cultureName });

  if (Platform.OS === "web") {
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 500);
    }
    return null;
  }

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Exporter le rapport PDF mensuel",
      UTI: "com.adobe.pdf",
    });
  }
  return uri;
}
