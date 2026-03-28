/**
 * Vérificateur de Section de Câbles PV
 * Conforme GATECH REV I — 2024-DO-SE-DOC-06
 * Formule : S = (ρ × 2 × L × I) / (ε × U)
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  CheckCircle2, XCircle, AlertTriangle, Cable, FileText, Info,
} from "lucide-react";
import {
  calculateCableSection,
  RHO_CU_80, RHO_AL_80,
  type CableCheckerInput,
  type CableCheckerResult,
} from "@/lib/solar-calc.ts";
import { generateCablePDF } from "@/lib/pdf-export.ts";

// ── Valeurs par défaut Jinko 555 Wp Tiger Neo ─────────────────────────────────
const DEFAULTS: CableCheckerInput = {
  conductorType: "copper",
  cableLength: 30,
  iImp: 13.16,
  iIsc: 13.98,
  currentType: "isc",
  systemVoltage: 48,
  ambientTemp: 80,
  maxVoltageDrop: 3,
};

export default function CableCheckerTab() {
  const [form, setForm] = useState<CableCheckerInput>(DEFAULTS);

  const result: CableCheckerResult = useMemo(
    () => calculateCableSection(form),
    [form]
  );

  const set = <K extends keyof CableCheckerInput>(k: K, v: CableCheckerInput[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const statusColor = {
    ok: "text-green-600",
    acceptable: "text-amber-600",
    danger: "text-destructive",
  };

  const statusBg = {
    ok: "border-green-500/30 bg-green-50/30",
    acceptable: "border-amber-400/30 bg-amber-50/30",
    danger: "border-destructive/30 bg-destructive/5",
  };

  const globalOk = result.izStatus === "ok" && result.voltageDropStatus !== "danger";

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 bg-primary/10 rounded-md flex items-center justify-center">
              <Cable className="w-4 h-4 text-primary" />
            </div>
            Vérificateur de Section de Câbles PV
            <Badge className="ml-auto text-[10px] bg-amber-500/10 text-amber-700 border-amber-300">
              GATECH REV I
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
            <span>
              Formule GATECH (2024-DO-SE-DOC-06 REV I) :{" "}
              <span className="font-mono font-semibold text-foreground">
                S = (ρ × 2 × L × I) / (ε × U)
              </span>
              {" "}— ρ cuivre 80°C = {RHO_CU_80} Ω·mm²/m | ρ alu 80°C = {RHO_AL_80} Ω·mm²/m
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Paramètres d'entrée */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground">Paramètres d'entrée</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Type conducteur */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Type de conducteur</Label>
            <div className="flex gap-2">
              {(["copper", "aluminum"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => set("conductorType", t)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    form.conductorType === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {t === "copper"
                    ? `Cuivre — ρ = ${RHO_CU_80} Ω·mm²/m`
                    : `Aluminium — ρ = ${RHO_AL_80} Ω·mm²/m`}
                </button>
              ))}
            </div>
          </div>

          {/* Courant de calcul */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Courant utilisé pour le calcul de section</Label>
            <div className="flex gap-2">
              {(["imp", "isc"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => set("currentType", t)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    form.currentType === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {t === "imp" ? "Imp (courant MPP)" : "Isc (courant court-circuit)"}
                </button>
              ))}
            </div>
          </div>

          {/* Grille des inputs numériques */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <NumInput label="Longueur câble (m)" value={form.cableLength} min={1} step={1}
              onChange={(v) => set("cableLength", v)} />
            <NumInput label="Courant Imp (A)" value={form.iImp} min={0.1} step={0.01}
              onChange={(v) => set("iImp", v)} />
            <NumInput label="Courant Isc (A)" value={form.iIsc} min={0.1} step={0.01}
              onChange={(v) => set("iIsc", v)} />
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tension système (V)</Label>
              <div className="flex gap-1">
                {[24, 48].map((v) => (
                  <button key={v} onClick={() => set("systemVoltage", v)}
                    className={`flex-1 h-8 rounded-lg border text-sm font-medium transition-colors ${
                      form.systemVoltage === v
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground"
                    }`}>
                    {v} V
                  </button>
                ))}
              </div>
            </div>
            <NumInput label="Température ambiante (°C)" value={form.ambientTemp} min={20} max={100} step={5}
              onChange={(v) => set("ambientTemp", v)} />
            <NumInput label="Chute de tension max (%)" value={form.maxVoltageDrop} min={1} max={10} step={0.5}
              onChange={(v) => set("maxVoltageDrop", v)} />
          </div>
        </CardContent>
      </Card>

      {/* Résultats */}
      <Card className={`border-2 ${globalOk ? "border-green-500/40" : "border-destructive/40"}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {globalOk
              ? <CheckCircle2 className="w-5 h-5 text-green-600" />
              : <XCircle className="w-5 h-5 text-destructive" />}
            <span className={globalOk ? "text-green-700" : "text-destructive"}>
              {globalOk ? "✅ Câblage Conforme" : "❌ Non Conforme — Revoir la section"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Résultats principaux */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <ResultBox
              label="Section minimale calculée"
              value={`${result.sectionMin.toFixed(2)} mm²`}
              sub={`ρ=${result.rho} | I=${result.iCalc.toFixed(2)}A`}
            />
            <ResultBox
              label="Section commerciale recommandée"
              value={`${result.sectionCommercial} mm²`}
              highlight
            />
            <ResultBox
              label="Pertes résistives"
              value={`${result.powerLoss.toFixed(2)} W`}
              sub="P = ρ × 2L × I² / S"
            />
          </div>

          {/* Chute de tension */}
          <div className={`rounded-lg border-2 px-4 py-3 flex items-center justify-between ${statusBg[result.voltageDropStatus]}`}>
            <div className="flex items-center gap-2">
              {result.voltageDropStatus === "ok"
                ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                : result.voltageDropStatus === "acceptable"
                  ? <AlertTriangle className="w-4 h-4 text-amber-600" />
                  : <XCircle className="w-4 h-4 text-destructive" />}
              <div>
                <p className="text-xs font-semibold text-foreground">Chute de tension réelle</p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  ΔV = ρ × 2 × {form.cableLength}m × {result.iCalc.toFixed(2)}A / {result.sectionCommercial}mm²
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-bold text-lg ${statusColor[result.voltageDropStatus]}`}>
                {result.deltaVReal.toFixed(3)} V ({result.deltaVPercent.toFixed(2)}%)
              </p>
              <p className={`text-[10px] font-semibold ${statusColor[result.voltageDropStatus]}`}>
                {result.voltageDropStatus === "ok"
                  ? "✅ Conforme (≤ 3%)"
                  : result.voltageDropStatus === "acceptable"
                    ? "⚠️ Acceptable (3–5%)"
                    : "❌ Non conforme (> 5%)"}
              </p>
            </div>
          </div>

          {/* Vérification Iz */}
          <div className={`rounded-lg border-2 px-4 py-3 flex items-center justify-between ${
            result.izStatus === "ok" ? statusBg.ok : statusBg.danger
          }`}>
            <div className="flex items-center gap-2">
              {result.izStatus === "ok"
                ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                : <XCircle className="w-4 h-4 text-destructive" />}
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Courant admissible Iz à {form.ambientTemp}°C
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Vérification : Iz ≥ 1.25 × Isc = 1.25 × {form.iIsc.toFixed(2)} = {(1.25 * form.iIsc).toFixed(2)} A
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-bold text-lg ${result.izStatus === "ok" ? "text-green-600" : "text-destructive"}`}>
                Iz = {result.iz} A
              </p>
              <p className={`text-[10px] font-semibold ${result.izStatus === "ok" ? "text-green-600" : "text-destructive"}`}>
                {result.izStatus === "ok"
                  ? `✅ OK — Iz (${result.iz}A) ≥ 1.25×Isc (${(1.25 * form.iIsc).toFixed(2)}A)`
                  : `❌ DANGER — Iz (${result.iz}A) < 1.25×Isc (${(1.25 * form.iIsc).toFixed(2)}A)`}
              </p>
            </div>
          </div>

          {/* Tableau récapitulatif */}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Paramètre</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Formule</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Valeur</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { p: "Résistivité ρ", f: `${form.conductorType === "copper" ? "Cuivre" : "Aluminium"} à ${form.ambientTemp}°C`, v: `${result.rho} Ω·mm²/m` },
                  { p: "Courant de calcul I", f: form.currentType === "imp" ? "Imp" : "Isc", v: `${result.iCalc.toFixed(2)} A` },
                  { p: "Section minimale S_min", f: `(ρ × 2 × ${form.cableLength} × ${result.iCalc.toFixed(2)}) / (${form.maxVoltageDrop/100} × ${form.systemVoltage})`, v: `${result.sectionMin.toFixed(3)} mm²` },
                  { p: "Section commerciale S", f: "Normalisée ≥ S_min", v: `${result.sectionCommercial} mm²` },
                  { p: "Chute de tension ΔV", f: `ρ × 2L × I / S`, v: `${result.deltaVReal.toFixed(3)} V` },
                  { p: "Chute de tension ΔV%", f: `(ΔV / ${form.systemVoltage}V) × 100`, v: `${result.deltaVPercent.toFixed(2)} %` },
                  { p: "Pertes résistives P", f: `ρ × 2L × I² / S`, v: `${result.powerLoss.toFixed(2)} W` },
                  { p: `Courant admissible Iz (${form.ambientTemp}°C)`, f: "Table UTE C15-100", v: `${result.iz} A` },
                  { p: "Vérification Iz ≥ 1.25×Isc", f: `${result.iz} ≥ ${(1.25 * form.iIsc).toFixed(2)}`, v: result.izCheck ? "✅ OK" : "❌ NON" },
                ].map((row, i) => (
                  <tr key={i} className={`border-t border-border ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="px-3 py-2 text-xs font-medium text-foreground">{row.p}</td>
                    <td className="px-3 py-2 text-[10px] font-mono text-muted-foreground">{row.f}</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-primary">{row.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bouton export PDF */}
          <Button
            onClick={() => generateCablePDF(form, result)}
            className="w-full gap-2 border border-border bg-transparent text-muted-foreground hover:bg-muted"
            size="sm"
          >
            <FileText className="w-4 h-4 text-red-500" />
            Exporter Rapport PDF — Vérificateur Câbles
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Composants utilitaires ────────────────────────────────────────────────────

function NumInput({
  label, value, min, max, step, onChange,
}: {
  label: string; value: number; min?: number; max?: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-8 text-sm"
      />
    </div>
  );
}

function ResultBox({ label, value, sub, highlight }: {
  label: string; value: string; sub?: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${highlight ? "border-primary/30 bg-primary/5" : "border-border bg-muted/10"}`}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`font-bold text-base mt-0.5 ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[10px] font-mono text-muted-foreground/70 mt-0.5">{sub}</p>}
    </div>
  );
}
