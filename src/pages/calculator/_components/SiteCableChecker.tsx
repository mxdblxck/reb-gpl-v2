/**
 * Vérificateur Câbles PV — Logique déterministe GATECH
 * S = (ρ × 2L × I) / (ε × U) | ρ=0.02314 | ε=0.03
 *
 * Séquence stricte par segment :
 *  A. S_calc = formule exacte
 *  B. S_sugg = section commerciale sup à S_calc, puis vérif Iz ≥ 1.25×Isc
 *  C. ε_réelle = ρ×2L×I / (S_choisie × U)
 *  D. Cascade S1+S2 : si total > 3%, monter S2 d'un cran
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { CheckCircle2, XCircle, AlertTriangle, Cable, RefreshCw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import type { SiteResult } from "@/lib/solar-calc.ts";

// ── Constantes ────────────────────────────────────────────────────────────────
const RHO = 0.02314;
const EPS = 0.03;
const IMP = 13.33;
const ISC = 14.07;
const VMP = 41.64;

const L1_DEF = 3;
const L2_DEF = 30;
const L3_DEF = 8;

// Sections commerciales PV (mm²) — liste stricte, pas de valeurs absurdes
const SECS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240] as const;
type Sec = (typeof SECS)[number];

// Iz à 80°C — Pose B1, deux câbles adjacents sur paroi
const IZ: Record<number, number> = {
  1.5: 20, 2.5: 27, 4: 36,  6: 47,  10: 66,
  16: 88, 25: 117, 35: 146, 50: 177, 70: 226, 95: 274, 120: 318, 150: 363, 185: 415, 240: 489,
};

// ── Moteur de calcul ──────────────────────────────────────────────────────────

/** Section théorique exacte */
function calcS(L: number, I: number, U: number): number {
  return (RHO * 2 * L * I) / (EPS * U);
}

/** Chute de tension réelle avec une section donnée */
function calcEps(L: number, I: number, U: number, S: number): number {
  return ((RHO * 2 * L * I) / (S * U)) * 100; // en %
}

/**
 * Sélection de la section commerciale :
 * 1. Trouver la plus petite section >= S_min (formula exacte)
 * 2. Vérifier Iz >= 1.25×Isc
 * 3. Si OK → retourne cette section
 *    Si non → passer à la section suivante et recommencer
 */
function pickSugg(sMin: number, iSc: number): Sec {
  const izReq = 1.25 * iSc;
  
  // Trouver la première section commerciale >= S_min
  const startIdx = SECS.findIndex((s) => s >= sMin);
  const start = startIdx === -1 ? SECS.length - 1 : startIdx;
  
  // Chercher la section qui satisfait Iz >= 1.25 * Isc
  for (let i = start; i < SECS.length; i++) {
    const s = SECS[i];
    const iz = IZ[s] ?? 0;
    if (iz >= izReq) {
      return s;
    }
  }
  
  // Si aucune section ne satisfait Iz, retourner la plus grande
  return SECS[SECS.length - 1];
}

/**
 * Cascade S1 + S2 : si ε_S1 + ε_S2 > 3%, augmenter S1 d'un cran
 * jusqu'à ce que la somme des chutes soit <= 3%
 * Retourne la nouvelle section S1 aprè cascade
 */
function cascadeS1(
  l1: number, i1: number, u1: number, s1Init: Sec,
  l2: number, i2: number, u2: number, s2: Sec,
): Sec {
  let s1 = s1Init;
  const startIdx = SECS.indexOf(s1Init);
  
  for (let i = startIdx; i < SECS.length; i++) {
    s1 = SECS[i];
    const eps1 = calcEps(l1, i1, u1, s1);
    const eps2 = calcEps(l2, i2, u2, s2);
    if (eps1 + eps2 <= 3) break;
  }
  return s1;
}

/** Évaluation complète d'un segment avec la section choisie */
function evalSeg(L: number, I: number, iSc: number, U: number, chosen: Sec, dvOtherPct: number) {
  const sc     = calcS(L, I, U);
  const sugg   = pickSugg(sc, iSc);
  const eps    = calcEps(L, I, U, chosen);
  const epsTotal = eps + dvOtherPct;
  const dvV    = (RHO * 2 * L * I) / chosen;
  const pLoss  = (RHO * 2 * L * I * I) / chosen;
  const iz     = IZ[chosen] ?? 0;
  const izReq  = 1.25 * iSc;
  const izOk   = iz >= izReq;
  const dvOk   = eps <= 3;
  const totOk  = epsTotal <= 3;

  // Alerte absurde : section > 120 mm² pour courant < 100 A
  const absurd = chosen > 120 && I < 100;

  const status: "ok" | "warning" | "danger" =
    absurd || !izOk || !dvOk || !totOk ? "danger"
    : eps > 2.5 || epsTotal > 2.5 ? "warning"
    : "ok";

  return { sc, sugg, eps, epsTotal, dvV, pLoss, iz, izReq, izOk, dvOk, totOk, absurd, status };
}

type SegData = ReturnType<typeof evalSeg>;

// ── Composant principal ───────────────────────────────────────────────────────
export default function SiteCableChecker({ result }: { result: SiteResult }) {
  const { pv, params } = result;
  const np   = pv.parallelStrings * params.groups;
  const vMpp = VMP * pv.seriesPerGroup;   // U pour S1 et S2
  const vSys = params.systemVoltage;      // U pour S3

  // Courants de design
  const i1Def = IMP;
  const i2Def = IMP * np;
  const i3Def = 100; // A — cas défavorable décharge batterie

  const [l1, setL1] = useState(L1_DEF);
  const [l2, setL2] = useState(L2_DEF);
  const [l3, setL3] = useState(L3_DEF);
  const [i1, setI1] = useState(i1Def);
  const [i2, setI2] = useState(i2Def);
  const [i3, setI3] = useState(i3Def);

  // Sections choisies (null = auto)
  const [s1User, setS1User] = useState<Sec | null>(null);
  const [s2User, setS2User] = useState<Sec | null>(null);
  const [s3User, setS3User] = useState<Sec | null>(null);

  // ── Calcul auto S1 et S2 avec cascade ──────────────────────────────────────
  const s1Sugg = useMemo(() => pickSugg(calcS(l1, i1, vMpp), ISC),        [l1, i1, vMpp]);
  const s2Sugg = useMemo(() => pickSugg(calcS(l2, i2, vMpp), ISC * np),   [l2, i2, vMpp, np]);
  const s3Sugg = useMemo(() => pickSugg(calcS(l3, i3, vSys), ISC * np),   [l3, i3, vSys, np]);

  // Cascade : si S1_sugg + S2_sugg > 3%, monter S2
  const s2Auto = useMemo(
    () => cascadeS1(l1, i1, vMpp, s1Sugg, l2, i2, vMpp, s2Sugg),
    [l1, i1, vMpp, s1Sugg, l2, i2, s2Sugg],
  );

  // S_choisie = S_suggérée par défaut (user peut modifier via select)
  // Cascade: si ε_S1 + ε_S2 > 3%, S1 monte d'un cran
  const s1 = s1User ?? s1Sugg;
  const s2 = s2User ?? s2Sugg;  // Default: S_suggérée
  const s3 = s3User ?? s3Sugg;

  // S1 optimisé si cascade nécessaire (affiché mais pas utilisé par défaut)
  const s1Optimized = s1User ? s1 : cascadeS1(l1, i1, vMpp, s1Sugg, l2, i2, vMpp, s2);

  // ε S2 pour passer à S1 comme contexte
  const eps2 = useMemo(() => calcEps(l2, i2, vMpp, s2), [l2, i2, vMpp, s2]);

  const seg1 = useMemo(() => evalSeg(l1, i1, ISC,      vMpp, s1, eps2),  [l1, i1, vMpp, s1, eps2]);
  const seg2 = useMemo(() => evalSeg(l2, i2, ISC * np, vMpp, s2, 0),     [l2, i2, np, vMpp, s2]);
  const seg3 = useMemo(() => evalSeg(l3, i3, ISC * np, vSys, s3, 0),     [l3, i3, np, vSys, s3]);

  const dvTotal   = seg1.eps + seg2.eps;
  const circuitOk = dvTotal <= 3;

  const allOk     = [seg1, seg2, seg3].every((s) => s.status === "ok") && circuitOk;
  const anyDanger = [seg1, seg2, seg3].some((s) => s.status === "danger") || !circuitOk;

  const autoOptimize = () => {
    setS1User(null); setS2User(null); setS3User(null);
    setL1(L1_DEF); setL2(L2_DEF); setL3(L3_DEF);
    setI1(i1Def);  setI2(i2Def);  setI3(i3Def);
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="w-7 h-7 bg-primary/10 rounded-md flex items-center justify-center">
            <Cable className="w-4 h-4 text-primary" />
          </div>
          Vérification Câbles PV — {result.siteId}
          <Badge className={`ml-auto text-[10px] font-bold ${
            allOk ? "bg-green-500/10 text-green-700 border-green-300"
            : anyDanger ? "bg-destructive/10 text-destructive border-destructive/30"
            : "bg-amber-500/10 text-amber-700 border-amber-300"
          }`}>
            {allOk ? "✅ CONFORME" : anyDanger ? "❌ NON CONFORME" : "⚠️ ATTENTION"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Config */}
        <div className="rounded-lg bg-muted/30 border border-border px-3 py-2 space-y-0.5">
          <div className="flex flex-wrap gap-x-5 text-[10px] font-mono text-muted-foreground">
            <span>Ns={pv.seriesPerGroup} | Np={np} | Impp={IMP}A | Isc={ISC}A</span>
            <span>U_S1S2 = Ns×Vmpp = {vMpp.toFixed(2)}V | U_S3 = {vSys}V</span>
          </div>
          <p className="text-[10px] font-mono text-primary">
            S=(ρ×2L×I)/(ε×U) | ρ={RHO} | ε={EPS} | Iz≥1.25×Isc
          </p>
        </div>

        {/* Bilan chute totale S1+S2 */}
        <div className={`rounded-xl border-2 px-4 py-3 flex items-center justify-between ${
          circuitOk ? "border-green-500/40 bg-green-50/20" : "border-destructive/50 bg-destructive/10"
        }`}>
          <div className="flex items-center gap-2">
            {circuitOk
              ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              : <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />}
            <div>
              <p className="text-xs font-semibold text-foreground">Chute totale circuit PV (S1 + S2)</p>
              <p className="text-[10px] font-mono text-muted-foreground">
                ε_S1({seg1.eps.toFixed(3)}%) + ε_S2({seg2.eps.toFixed(3)}%) = {dvTotal.toFixed(3)}%
              </p>
              {!circuitOk && (
                <p className="text-xs font-bold text-destructive mt-0.5">
                  NON CONFORME — AUGMENTER S2
                </p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0 ml-3">
            <p className={`font-bold text-xl ${circuitOk ? "text-green-600" : "text-destructive"}`}>
              {dvTotal.toFixed(3)}%
            </p>
            <p className={`text-[10px] font-semibold ${circuitOk ? "text-green-600" : "text-destructive"}`}>
              {circuitOk ? "✅ ≤ 3%" : "❌ > 3%"}
            </p>
          </div>
        </div>

        {/* Boutons */}
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={autoOptimize}
            className="h-8 gap-1.5 text-xs border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10">
            <Wand2 className="w-3.5 h-3.5" />
            Optimisation Automatique
          </Button>
          <Button size="sm" onClick={() => { setL1(L1_DEF); setL2(L2_DEF); setL3(L3_DEF); setI1(i1Def); setI2(i2Def); setI3(i3Def); }}
            className="h-8 gap-1.5 text-xs border border-border bg-transparent text-muted-foreground hover:bg-muted">
            <RefreshCw className="w-3.5 h-3.5" />
            Synchroniser
          </Button>
        </div>

        {/* Tableau comparatif */}
        <CompareTable rows={[
          { id: "S1", label: "S1 — Module → BJ",        sc: seg1.sc, sugg: s1Sugg, chosen: s1, setChosen: setS1User, isUser: s1User !== null },
          { id: "S2", label: "S2 — BJ → Armoire",        sc: seg2.sc, sugg: s2Sugg,   chosen: s2, setChosen: setS2User, isUser: s2User !== null },
          { id: "S3", label: "S3 — Batteries → Armoire", sc: seg3.sc, sugg: s3Sugg, chosen: s3, setChosen: setS3User, isUser: s3User !== null },
        ]} />

        {/* 3 segments */}
        <div className="space-y-3">
          <SegCard id="S1" label="S1 — Module / Chaîne → Boîte de Jonction"
            L={l1} setL={setL1} I={i1} setI={setI1} U={vMpp}
            iHint={`I = 1×Impp = ${IMP} A`}
            uHint={`U = Ns×Vmpp = ${vMpp.toFixed(2)} V`}
            iSc={ISC} chosen={s1} setChosen={setS1User} seg={seg1} />

          <SegCard id="S2" label="S2 — Boîte de Jonction → Armoire Distribution"
            L={l2} setL={setL2} I={i2} setI={setI2} U={vMpp}
            iHint={`I = Np×Impp = ${np}×${IMP} = ${i2Def.toFixed(2)} A`}
            uHint={`U = Ns×Vmpp = ${vMpp.toFixed(2)} V`}
            iSc={ISC * np} chosen={s2} setChosen={setS2User} seg={seg2} />

          <SegCard id="S3" label="S3 — Parc Batteries → Armoire Distribution"
            L={l3} setL={setL3} I={i3} setI={setI3} U={vSys}
            iHint="I = 100 A (cas défavorable décharge max)"
            uHint={`U = ${vSys} V (nominal)`}
            iSc={ISC * np} chosen={s3} setChosen={setS3User} seg={seg3} />
        </div>

        <p className="text-[10px] text-muted-foreground border-t border-border pt-2">
          Iz : Pose B1 (paroi), 80°C — Cascade : si ε_S1+ε_S2 {">"}3%, S2 monte d'un cran commercial
        </p>
      </CardContent>
    </Card>
  );
}

// ── Tableau comparatif ────────────────────────────────────────────────────────
function CompareTable({ rows }: {
  rows: { id: string; label: string; sc: number; sugg: Sec; chosen: Sec; setChosen: (s: Sec | null) => void; isUser: boolean }[];
}) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 border-b border-border">
          <tr>
            <th className="text-left px-3 py-2 text-muted-foreground font-semibold">Segment</th>
            <th className="text-center px-2 py-2 text-muted-foreground font-semibold">S_calc (mm²)</th>
            <th className="text-center px-2 py-2 text-primary font-semibold">S_suggérée</th>
            <th className="text-center px-2 py-2 text-muted-foreground font-semibold">S_choisie</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className={`border-t border-border ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
              <td className="px-3 py-2 font-medium text-foreground text-[11px]">{r.label}</td>
              <td className="px-2 py-2 text-center font-mono text-muted-foreground">{r.sc.toFixed(3)}</td>
              <td className="px-2 py-2 text-center font-bold text-primary">{r.sugg} mm²</td>
              <td className="px-2 py-2 text-center">
                <div className="flex items-center justify-center gap-1">
                  <select value={r.chosen}
                    onChange={(e) => r.setChosen(parseFloat(e.target.value) as Sec)}
                    className={`h-6 text-xs rounded border px-1 font-bold ${
                      r.isUser ? "border-amber-400 bg-amber-50 text-amber-700" : "border-primary/30 bg-primary/5 text-primary"
                    }`}>
                    {SECS.map((s) => <option key={s} value={s}>{s} mm²</option>)}
                  </select>
                  {r.isUser && (
                    <button onClick={() => r.setChosen(null)}
                      className="text-[9px] text-muted-foreground hover:text-destructive" title="Réinitialiser">✕</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Carte segment ─────────────────────────────────────────────────────────────
function SegCard({
  id, label, L, setL, I, setI, U, iHint, uHint, iSc, chosen, setChosen, seg,
}: {
  id: string; label: string;
  L: number; setL: (v: number) => void;
  I: number; setI: (v: number) => void;
  U: number; iHint: string; uHint: string; iSc: number;
  chosen: Sec; setChosen: (s: Sec | null) => void;
  seg: SegData;
}) {
  const isOk   = seg.status === "ok";
  const isWarn = seg.status === "warning";

  return (
    <div className={`rounded-xl border-2 p-3 space-y-3 ${
      isOk ? "border-green-500/40 bg-green-50/10"
      : isWarn ? "border-amber-400/40 bg-amber-50/10"
      : "border-destructive/50 bg-destructive/5"
    }`}>
      {/* En-tête */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-foreground">{label}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{iHint} &nbsp;|&nbsp; {uHint}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isOk ? <CheckCircle2 className="w-4 h-4 text-green-600" />
            : isWarn ? <AlertTriangle className="w-4 h-4 text-amber-600" />
            : <XCircle className="w-4 h-4 text-destructive" />}
          <Badge className={`text-[10px] font-bold ${
            isOk ? "bg-green-500/10 text-green-700 border-green-300"
            : isWarn ? "bg-amber-500/10 text-amber-700 border-amber-300"
            : "bg-destructive/10 text-destructive border-destructive/30"
          }`}>
            {isOk ? "CONFORME" : isWarn ? "ATTENTION" : "NON CONFORME"}
          </Badge>
        </div>
      </div>

      {/* Alerte absurde */}
      {seg.absurd && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2">
          <p className="text-xs font-bold text-destructive">
            ⚠️ ERREUR LOGIQUE — Section {chosen} mm² pour I={I.toFixed(1)}A {"<"} 100A est incohérente. Vérifier les paramètres.
          </p>
        </div>
      )}

      {/* Inputs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Longueur L (m)</Label>
          <Input type="number" min={0.5} step={0.5} value={L}
            onChange={(e) => setL(Math.max(0.5, parseFloat(e.target.value) || 0.5))}
            className="h-7 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">I_design (A)</Label>
          <Input type="number" min={0.1} step={0.01} value={parseFloat(I.toFixed(3))}
            onChange={(e) => setI(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
            className="h-7 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Section {id}</Label>
          <select value={chosen}
            onChange={(e) => setChosen(parseFloat(e.target.value) as Sec)}
            className="h-7 w-full text-xs rounded-md border border-input bg-background px-2 font-semibold text-primary">
            {SECS.map((s) => <option key={s} value={s}>{s} mm²</option>)}
          </select>
        </div>
        <div className="flex items-end pb-0.5">
          <p className="text-[10px] font-mono text-muted-foreground leading-tight">
            S_calc=<span className="font-semibold text-foreground">{seg.sc.toFixed(3)}</span>
            {" "}→ sugg=<span className="font-bold text-primary">{seg.sugg}</span>
            {" "}→ choisi=<span className="font-bold text-foreground">{chosen} mm²</span>
          </p>
        </div>
      </div>

      {/* Résultats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <RBox label="S_calc (mm²)"      value={seg.sc.toFixed(3)} />
        <RBox label="S_suggérée"        value={`${seg.sugg} mm²`} highlight />
        <RBox label="Pertes (W)"        value={seg.pLoss.toFixed(2)} />
        <RBox label="Iz à 80°C (A)"     value={String(seg.iz)} />
      </div>

      {/* Statuts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <StatBox label="Vérif. Iz"
          detail={`Iz ≥ 1.25×${iSc.toFixed(2)} = ${seg.izReq.toFixed(2)} A`}
          value={`${seg.iz} A`} ok={seg.izOk}
          msg={seg.izOk ? `✅ ${seg.iz} ≥ ${seg.izReq.toFixed(2)} A` : `❌ ${seg.iz} < ${seg.izReq.toFixed(2)} A`} />
        <StatBox label="ε segment"
          detail={`ρ×2×${L}×${I.toFixed(2)}/(${chosen}×${U.toFixed(2)})`}
          value={`${seg.dvV.toFixed(3)} V`} pct={seg.eps} ok={seg.dvOk}
          msg={seg.dvOk ? "✅ ≤ 3%" : "❌ > 3%"} />
        <StatBox label="ε total (cumul)"
          detail="ε_seg + ε_autres"
          value={`${seg.epsTotal.toFixed(3)}%`} ok={seg.totOk}
          msg={seg.totOk ? "✅ ≤ 3%" : "❌ > 3% — AUGMENTER S2"} />
      </div>
    </div>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────────────
function RBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${highlight ? "border-primary/40 bg-primary/5" : "border-border bg-background/60"}`}>
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className={`font-bold text-xs mt-0.5 ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function StatBox({ label, detail, value, pct, ok, msg }: {
  label: string; detail: string; value: string; pct?: number; ok: boolean; msg: string;
}) {
  return (
    <div className={`rounded-lg border px-3 py-2 space-y-0.5 ${ok ? "border-green-500/30 bg-green-50/10" : "border-destructive/30 bg-destructive/5"}`}>
      <div className="flex justify-between items-center gap-1">
        <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
        <span className={`font-bold text-sm shrink-0 ${ok ? "text-green-600" : "text-destructive"}`}>{value}</span>
      </div>
      {pct !== undefined && (
        <div className="flex justify-between items-center gap-1">
          <p className="text-[9px] font-mono text-muted-foreground truncate">{detail}</p>
          <span className={`font-bold text-sm shrink-0 ${ok ? "text-green-600" : "text-destructive"}`}>{pct.toFixed(3)}%</span>
        </div>
      )}
      {pct === undefined && <p className="text-[9px] font-mono text-muted-foreground">{detail}</p>}
      <p className={`text-[10px] font-semibold ${ok ? "text-green-600" : "text-destructive"}`}>{msg}</p>
    </div>
  );
}
