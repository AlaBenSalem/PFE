// DepletionCurveChart.jsx — FAO-56 soil water depletion curve (professional)
// Zones colorées + courbe passé/futur + repères internationaux
import React, { useState, useMemo } from "react";
import { View, Text } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
//  Geometry constants
// ─────────────────────────────────────────────────────────────────────────────
const CHART_H    = 200;
const PAD_LEFT   = 52;   // room for Y labels
const PAD_RIGHT  = 10;
const PAD_TOP    = 18;
const PAD_BOTTOM = 30;
const INNER_H    = CHART_H - PAD_TOP - PAD_BOTTOM;

// ─────────────────────────────────────────────────────────────────────────────
//  Drawing primitives (pure React Native, no SVG)
// ─────────────────────────────────────────────────────────────────────────────

/** Solid line segment between two pixel points */
function Seg({ x1, y1, x2, y2, color, w = 2.5 }) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.5) return null;
  return (
    <View
      style={{
        position: "absolute",
        left: (x1 + x2) / 2 - len / 2,
        top:  (y1 + y2) / 2 - w / 2,
        width: len, height: w,
        backgroundColor: color,
        transform: [{ rotate: `${Math.atan2(dy, dx) * (180 / Math.PI)}deg` }],
      }}
    />
  );
}

/** Dashed line — draws alternating solid mini-segments */
function DashLine({ x1, y1, x2, y2, color, w = 2, dashLen = 6, gapLen = 5 }) {
  const dx = x2 - x1, dy = y2 - y1;
  const total = Math.sqrt(dx * dx + dy * dy);
  if (total < 0.5) return null;
  const cos = dx / total, sin = dy / total;
  const out = [];
  for (let pos = 0; pos < total; pos += dashLen + gapLen) {
    const d = Math.min(dashLen, total - pos);
    out.push(
      <Seg key={pos}
        x1={x1 + cos * pos}       y1={y1 + sin * pos}
        x2={x1 + cos * (pos + d)} y2={y1 + sin * (pos + d)}
        color={color} w={w}
      />
    );
  }
  return <>{out}</>;
}

/** Horizontal reference line — solid or dashed */
function HLine({ y, color, width, dashed = false, w = 1.5 }) {
  if (!dashed) {
    return (
      <View style={{
        position: "absolute", left: 0, top: Math.round(y) - w / 2,
        width, height: w, backgroundColor: color,
      }} />
    );
  }
  const dash = 7, gap = 5;
  return (
    <>
      {Array.from({ length: Math.ceil(width / (dash + gap)) }).map((_, i) => (
        <View key={i} style={{
          position: "absolute",
          left: i * (dash + gap), top: Math.round(y) - w / 2,
          width: Math.min(dash, width - i * (dash + gap)),
          height: w, backgroundColor: color,
        }} />
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main chart
// ─────────────────────────────────────────────────────────────────────────────
export default function DepletionCurveChart({ besoins, historyItems = [], selectedCulture }) {
  const [containerWidth, setContainerWidth] = useState(320);
  const innerW = Math.max(60, containerWidth - PAD_LEFT - PAD_RIGHT);

  // ── Build simulation data ──────────────────────────────────────────────────
  const data = useMemo(() => {
    if (!besoins || !selectedCulture || besoins.W_cc == null) return null;

    const {
      W_cc, W_seuil, W_pf_mm, W_current,
      frequenceJours = 7, joursSinceIrrig = 0,
    } = besoins;
    const etcDay = Math.max(0.1, parseFloat(besoins.etc) || 4);

    // Culture irrigation history sorted asc
    const history = historyItems
      .filter(h => (h.cultureId?._id ?? h.cultureId)?.toString() === selectedCulture._id?.toString())
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const pastDays   = Math.min(Math.max(joursSinceIrrig, 4) + 2, 28);
    const futureDays = Math.max(frequenceJours + 2, 7);
    const totalDays  = pastDays + futureDays;

    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
    const startMs = todayMidnight.getTime() - pastDays * 86_400_000;

    // W at window start
    const beforeWin = history.filter(h => new Date(h.date).getTime() < startMs);
    let W;
    if (beforeWin.length > 0) {
      const lastMs  = new Date(beforeWin[beforeWin.length - 1].date).getTime();
      const elapsed = Math.max(0, (startMs - lastMs) / 86_400_000);
      W = Math.max(W_pf_mm, W_cc - etcDay * elapsed);
    } else {
      W = Math.max(W_pf_mm, W_cc - etcDay * pastDays);
    }

    // Build daily points for past + future
    const past   = []; // { d, W }
    const future = []; // { d, W }
    const irrigDays = new Set(); // day indices where irrigation occurred
    let projNextIrrig = null;   // day index of projected next irrigation

    for (let d = 0; d <= totalDays; d++) {
      const dayMs   = startMs + d * 86_400_000;
      const dayDate = new Date(dayMs); dayDate.setHours(0, 0, 0, 0);
      const isToday = dayDate.getTime() === todayMidnight.getTime();
      const isPast  = d <= pastDays;

      // Real irrigation event?
      const irrig = history.find(h => {
        const hd = new Date(h.date); hd.setHours(0, 0, 0, 0);
        return hd.getTime() === dayDate.getTime();
      });

      if (irrig && d > 0) {
        // Saw-tooth: add pre-irrig low then jump to W_cc
        const arr = isPast ? past : future;
        arr.push({ d, W: Math.max(W_pf_mm, W), isToday: false });
        W = W_cc;
        arr.push({ d, W, isToday: false });
        irrigDays.add(d);
      }

      if (isToday) W = W_current; // anchor to real value

      if (d <= pastDays) {
        past.push({ d, W: Math.max(W_pf_mm, W), isToday });
      } else {
        // Projected future: detect next irrigation crossing
        if (W <= W_seuil && projNextIrrig === null) {
          projNextIrrig = d;
          // After projected irrigation: jump to W_cc
          future.push({ d, W: Math.max(W_pf_mm, W), isToday: false });
          W = W_cc;
          future.push({ d, W, isToday: false });
        } else {
          future.push({ d, W: Math.max(W_pf_mm, W), isToday: false });
        }
      }

      W = Math.max(W_pf_mm, W - etcDay);
    }

    return {
      past, future, irrigDays, projNextIrrig,
      W_cc, W_seuil, W_pf_mm, totalDays, pastDays,
    };
  }, [besoins, historyItems, selectedCulture]);

  if (!data) return null;

  const { past, future, irrigDays, projNextIrrig, W_cc, W_seuil, W_pf_mm, totalDays, pastDays } = data;

  // ── Coordinate transforms ──────────────────────────────────────────────────
  const margin = (W_cc - W_pf_mm) * 0.06;
  const yMin   = Math.max(0, W_pf_mm - margin);
  const yMax   = W_cc + margin;
  const yRange = yMax - yMin;

  const toY = (W) => PAD_TOP + INNER_H - ((Math.max(yMin, Math.min(yMax, W)) - yMin) / yRange) * INNER_H;
  const toX = (d) => (d / totalDays) * innerW;

  const yFC  = toY(W_cc);
  const yRAW = toY(W_seuil);
  const yPWP = toY(W_pf_mm);
  const xNow = toX(pastDays);

  // ── Alert state ────────────────────────────────────────────────────────────
  const isWarn = besoins.stockAlert === "warning";
  const isCrit = besoins.stockAlert === "critical";
  const statusColor = isCrit ? "#dc2626" : isWarn ? "#ea580c" : "#0369a1";
  const statusBg    = isCrit ? "#fef2f2" : isWarn ? "#fff7ed" : "#eff6ff";
  const statusLabel = isCrit ? "Critique" : isWarn ? "Seuil RFU atteint" : "Réserve suffisante";

  // ── Current value (today's last point) ────────────────────────────────────
  const todayPt = past[past.length - 1];
  const pct     = besoins.stockPct ?? 0;

  // ── X-axis tick labels ─────────────────────────────────────────────────────
  const step = Math.max(1, Math.ceil(totalDays / 5));
  const xLabels = [];
  for (let d = 0; d <= totalDays; d += step) {
    xLabels.push({ d, label: d === pastDays ? "Auj." : `J${d - pastDays > 0 ? "+" : ""}${d - pastDays}` });
  }
  if (xLabels[xLabels.length - 1]?.d !== totalDays) {
    xLabels.push({ d: totalDays, label: `J+${totalDays - pastDays}` });
  }

  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 18,
        marginBottom: 14,
        overflow: "hidden",
        elevation: 3,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={{
        flexDirection: "row", alignItems: "center",
        paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#0f172a", letterSpacing: 0.2 }}>
            Réserve en eau du sol
          </Text>
          <Text style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>
            Évolution en temps réel — FAO-56
          </Text>
        </View>
        {/* Status badge */}
        <View style={{
          backgroundColor: statusBg,
          paddingHorizontal: 10, paddingVertical: 5,
          borderRadius: 99, borderWidth: 1,
          borderColor: isCrit ? "#fca5a5" : isWarn ? "#fed7aa" : "#bfdbfe",
        }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: statusColor }}>
            {besoins.W_current?.toFixed(1)} mm
          </Text>
          <Text style={{ fontSize: 9, color: statusColor, textAlign: "center", marginTop: 1 }}>
            {statusLabel}
          </Text>
        </View>
      </View>

      {/* ── Chart body ─────────────────────────────────────────────────────── */}
      <View
        style={{ paddingHorizontal: 10, paddingBottom: 12 }}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width - 20)}
      >
        <View style={{ flexDirection: "row", marginTop: 10 }}>

          {/* Y-axis labels */}
          <View style={{ width: PAD_LEFT - 4, height: CHART_H }}>
            {[
              { W: W_cc,    label: `${W_cc.toFixed(0)}`,    color: "#0369a1", tag: "FC"  },
              { W: W_seuil, label: `${W_seuil.toFixed(0)}`, color: "#d97706", tag: "RAW" },
              { W: W_pf_mm, label: `${W_pf_mm.toFixed(0)}`, color: "#dc2626", tag: "PWP" },
            ].map(({ W, label, color, tag }) => (
              <View key={tag} style={{ position: "absolute", right: 4, top: toY(W) - 8 }}>
                <Text style={{ fontSize: 8.5, fontWeight: "700", color, textAlign: "right" }}>
                  {label}
                </Text>
                <Text style={{ fontSize: 7, color, opacity: 0.7, textAlign: "right" }}>
                  {tag}
                </Text>
              </View>
            ))}
            <Text style={{
              position: "absolute", right: 0, top: PAD_TOP + INNER_H / 2 - 14,
              fontSize: 7.5, color: "#94a3b8", transform: [{ rotate: "-90deg" }],
              width: 40, textAlign: "center",
            }}>
              mm
            </Text>
          </View>

          {/* Inner chart area */}
          <View style={{ flex: 1, height: CHART_H, position: "relative" }}>

            {/* ── Colored zone backgrounds ────────────────────────────── */}
            {/* Zone verte : FC → RAW (réserve disponible) */}
            <View style={{
              position: "absolute", left: 0, right: 0,
              top: yFC, height: Math.max(1, yRAW - yFC),
              backgroundColor: "rgba(16,185,129,0.07)",
            }} />
            {/* Zone orange : RAW → PWP (stress hydrique) */}
            <View style={{
              position: "absolute", left: 0, right: 0,
              top: yRAW, height: Math.max(1, yPWP - yRAW),
              backgroundColor: "rgba(251,146,60,0.10)",
            }} />

            {/* ── Zone labels (right side, subtle) ───────────────────── */}
            <Text style={{
              position: "absolute", right: 3, top: yFC + (yRAW - yFC) / 2 - 6,
              fontSize: 7, color: "#10b981", opacity: 0.7, fontWeight: "600",
            }}>
              ● Optimal
            </Text>
            <Text style={{
              position: "absolute", right: 3, top: yRAW + (yPWP - yRAW) / 2 - 6,
              fontSize: 7, color: "#f97316", opacity: 0.7, fontWeight: "600",
            }}>
              ● Stress
            </Text>

            {/* ── Reference lines ─────────────────────────────────────── */}
            {/* FC — solid sky-blue */}
            <HLine y={yFC}  color="#0369a1" width={innerW} dashed={false} w={1.5} />
            {/* RAW — dashed amber */}
            <HLine y={yRAW} color="#d97706" width={innerW} dashed={true}  w={1.5} />
            {/* PWP — dashed red (thin) */}
            <HLine y={yPWP} color="#ef4444" width={innerW} dashed={true}  w={1} />

            {/* ── Past irrigation event markers ───────────────────────── */}
            {[...irrigDays].filter(d => d <= pastDays).map(d => (
              <React.Fragment key={`irrig-${d}`}>
                <View style={{
                  position: "absolute",
                  left: toX(d) - 0.75,
                  top: yFC,
                  width: 1.5,
                  height: yPWP - yFC,
                  backgroundColor: "#0ea5e9",
                  opacity: 0.35,
                }} />
                <View style={{
                  position: "absolute",
                  left: toX(d) - 5,
                  top: yFC - 8,
                  width: 10, height: 6,
                  backgroundColor: "#0ea5e9",
                  borderRadius: 2,
                  opacity: 0.7,
                }} />
              </React.Fragment>
            ))}

            {/* ── Today vertical marker ────────────────────────────────── */}
            <View style={{
              position: "absolute",
              left: xNow - 0.75,
              top: PAD_TOP - 10,
              width: 1.5,
              height: INNER_H + 12,
              backgroundColor: "#8b5cf6",
              opacity: 0.45,
            }} />

            {/* ── PAST curve (solid, colored by stress state) ──────────── */}
            {past.slice(0, -1).map((pt, i) => {
              const next = past[i + 1];
              const isJump = pt.d === next.d && next.W > pt.W;
              const segColor = isJump ? "#0ea5e9" : (
                pt.W <= W_seuil ? "#ef4444" :
                pt.W <= W_seuil + (W_cc - W_seuil) * 0.2 ? "#f97316" : "#0369a1"
              );
              return (
                <Seg key={i}
                  x1={toX(pt.d)} y1={toY(pt.W)}
                  x2={toX(next.d)} y2={toY(next.W)}
                  color={segColor} w={isJump ? 1.5 : 2.5}
                />
              );
            })}

            {/* ── FUTURE curve (dashed, gray) ──────────────────────────── */}
            {future.slice(0, -1).map((pt, i) => {
              const next = future[i + 1];
              const isJump = pt.d === next.d && next.W > pt.W;
              if (isJump) {
                return (
                  <Seg key={`f${i}`}
                    x1={toX(pt.d)} y1={toY(pt.W)}
                    x2={toX(next.d)} y2={toY(next.W)}
                    color="#0ea5e9" w={1.5}
                  />
                );
              }
              return (
                <DashLine key={`f${i}`}
                  x1={toX(pt.d)} y1={toY(pt.W)}
                  x2={toX(next.d)} y2={toY(next.W)}
                  color="#94a3b8" w={2}
                  dashLen={5} gapLen={4}
                />
              );
            })}

            {/* ── Projected next irrigation marker ────────────────────── */}
            {projNextIrrig !== null && (
              <>
                <View style={{
                  position: "absolute",
                  left: toX(projNextIrrig) - 0.75,
                  top: yFC,
                  width: 1.5,
                  height: yPWP - yFC,
                  backgroundColor: "#0ea5e9",
                  opacity: 0.3,
                }} />
                <View style={{
                  position: "absolute",
                  left: toX(projNextIrrig) - 12,
                  top: yFC + 2,
                  backgroundColor: "#e0f2fe",
                  paddingHorizontal: 3, paddingVertical: 1,
                  borderRadius: 4,
                  borderWidth: 1, borderColor: "#bae6fd",
                }}>
                  <Text style={{ fontSize: 7, color: "#0369a1", fontWeight: "700" }}>
                    Irrig. prev.
                  </Text>
                </View>
              </>
            )}

            {/* ── Today dot + callout ───────────────────────────────────── */}
            {todayPt && (() => {
              const cx = toX(todayPt.d);
              const cy = toY(todayPt.W);
              const dotColor = isCrit ? "#dc2626" : isWarn ? "#ea580c" : "#0369a1";
              // Show callout above or below depending on position
              const calloutAbove = cy > PAD_TOP + 40;
              return (
                <>
                  {/* Outer ring */}
                  <View style={{
                    position: "absolute",
                    left: cx - 8, top: cy - 8,
                    width: 16, height: 16, borderRadius: 8,
                    backgroundColor: dotColor, opacity: 0.18,
                  }} />
                  {/* Inner dot */}
                  <View style={{
                    position: "absolute",
                    left: cx - 5, top: cy - 5,
                    width: 10, height: 10, borderRadius: 5,
                    backgroundColor: dotColor,
                    borderWidth: 2, borderColor: "#fff",
                    elevation: 2,
                  }} />
                  {/* Value callout */}
                  <View style={{
                    position: "absolute",
                    left: cx - 22,
                    top: calloutAbove ? cy - 34 : cy + 12,
                    backgroundColor: dotColor,
                    paddingHorizontal: 6, paddingVertical: 3,
                    borderRadius: 6,
                    minWidth: 44,
                    alignItems: "center",
                  }}>
                    <Text style={{ fontSize: 9, fontWeight: "800", color: "#fff" }}>
                      {todayPt.W.toFixed(0)} mm
                    </Text>
                    <Text style={{ fontSize: 7.5, color: "rgba(255,255,255,0.85)", marginTop: 0.5 }}>
                      {pct}% RU
                    </Text>
                  </View>
                </>
              );
            })()}

            {/* ── X-axis tick marks ─────────────────────────────────────── */}
            {xLabels.map(({ d, label }) => {
              const x = toX(d);
              const isNow = label === "Auj.";
              return (
                <React.Fragment key={`x${d}`}>
                  <View style={{
                    position: "absolute",
                    left: x - 0.5, top: PAD_TOP + INNER_H,
                    width: 1, height: 4, backgroundColor: isNow ? "#8b5cf6" : "#cbd5e1",
                  }} />
                  <Text style={{
                    position: "absolute",
                    left: x - 14, top: PAD_TOP + INNER_H + 6,
                    width: 28, textAlign: "center",
                    fontSize: isNow ? 9 : 8,
                    fontWeight: isNow ? "700" : "400",
                    color: isNow ? "#8b5cf6" : "#94a3b8",
                  }}>
                    {label}
                  </Text>
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* ── Legend ─────────────────────────────────────────────────────── */}
        <View style={{
          flexDirection: "row", flexWrap: "wrap",
          gap: 12, marginTop: 14,
          paddingTop: 10,
          borderTopWidth: 1, borderTopColor: "#f1f5f9",
          paddingHorizontal: 4,
        }}>
          {[
            { color: "#0369a1", label: `FC = ${W_cc.toFixed(0)} mm`,    sub: "Capacité au champ", dash: false },
            { color: "#d97706", label: `RAW = ${W_seuil.toFixed(0)} mm`, sub: "Seuil d'irrigation", dash: true  },
            { color: "#ef4444", label: `PWP = ${W_pf_mm.toFixed(0)} mm`, sub: "Flétrissement",     dash: true  },
            { color: "#94a3b8", label: "Projection",                     sub: "Évol. prévue",      dash: true  },
          ].map((item) => (
            <View key={item.label} style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, minWidth: "44%" }}>
              <View style={{ marginTop: 4 }}>
                {item.dash ? (
                  <View style={{ flexDirection: "row", gap: 2, alignItems: "center" }}>
                    {[0, 1, 2].map(i => (
                      <View key={i} style={{ width: 5, height: 2, backgroundColor: item.color, borderRadius: 1 }} />
                    ))}
                  </View>
                ) : (
                  <View style={{ width: 16, height: 2, backgroundColor: item.color, borderRadius: 1 }} />
                )}
              </View>
              <View>
                <Text style={{ fontSize: 9.5, fontWeight: "700", color: "#374151" }}>{item.label}</Text>
                <Text style={{ fontSize: 8, color: "#9ca3af", marginTop: 0.5 }}>{item.sub}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
