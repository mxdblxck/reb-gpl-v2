/**
 * Vérificateur de Compatibilité MPPT — Morning Star GS-MPPT-100M / 80M
 * Conforme GATECH REV I — 2024-DO-SE-DOC-06
 * Vstring_max = Voc × 1.14 ≤ 200 V
 * Itotal = Isc × 1.25 × Np ≤ 100 A (100M) ou 80 A (80M)
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { CheckCircle2, XCircle, Cpu, FileText, Info } from "lucide-react";
import {
  calculateGatechMppt,
  GATECH_MPPT_SPECS,
  type GatechMpptModel,
  type GatechMpptInput,
} from "@/lib/solar-calc.ts";
import { generateMpptPDF } from "@/lib/pdf-export.ts";

// Paramètres Jinko 555 Wp Tiger Neo (STC)
const DEFAULTS: GatechMpptInput = {
  model: "GS-MPPT-100M",
  nSeries: 2,
  nParallel: 5,
  voc: 41.78,
  isc: 13.98,
  kVoc: 1.14,
  kIsc: 1.25,
};

export default function MpptCheckerTab() {
  const [form, setForm] = useState<GatechMpptInput>(DEFAULTS);

  const result = useMemo(() => calculateGatechMppt(form), [form]);

  const set = <K extends keyof GatechMpptInput>(k: K, v: GatechMpptInput[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const specs = GATECH_MPPT_SPECS[form.model];

  const vRatio = (result.vstringMax / result.vmaxAllowed) * 100;
  const iRatio = (result.itotalMax / result.imaxAllowed) * 100;

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 bg-primary/10 rounded-md flex items-center justify-center">
              <Cpu className="w-4 h-4 text-primary" />
            </div>
            Vérificateur Compatibilité MPPT — Morning Star
            <Badge className="ml-auto text-[10px] bg-amber-500/10 text-amber-700 border-amber-300">
              GATECH REV I
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
            <span>
              Critères GATECH (2024-DO-SE-DOC-06 REV I) :{" "}
              <span className="font-mono font-semibold text-foreground">
                V_string = Voc × {form.kVoc} × Ns ≤ {specs.vmaxInput} V
              </span>
              {" | "}
              <span className="font-mono font-semibold text-foreground">
                I_total = Isc × {form.kIsc} × Np ≤ {specs.imaxInput} A
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Sélection modèle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground">Modèle de régulateur MPPT</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.keys(GATECH_MPPT_SPECS) as GatechMpptModel[]).map((m) => {
              const s = GATECH_MPPT_SPECS[m];
              return (
                <button
                  key={m}
                  onClick={() => set("model", m)}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    form.model === m
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-foreground">{m}</span>
                    {form.model === m && (
                      <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
                        Sélectionné
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <div className="flex gap-3 mt-2 text-xs">
                    <span className="text-primary font-semibold">Vmax = {s.vmaxInput} V</span>
                    <span className="text-primary font-semibold">Imax = {s.imaxInput} A</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Paramètres module */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <NumInput label="Modules en série (Ns)" value={form.nSeries} min={1} step={1}
              onChange={(v) => set("nSeries", v)} />
            <NumInput label="Chaînes en parallèle (Np)" value={form.nParallel} min={1} step={1}
              onChange={(v) => set("nParallel", v)} />
            <NumInput label="Voc module (V)" value={form.voc} min={1} step={0.01}
              onChange={(v) => set("voc", v)} />
            <NumInput label="Isc module (A)" value={form.isc} min={0.1} step={0.01}
              onChange={(v) => set("isc", v)} />
            <NumInput label="Coeff. sécurité tension kVoc" value={form.kVoc ?? 1.14} min={1.0} max={1.5} step={0.01}
              onChange={(v) => set("kVoc", v)} />
            <NumInput label="Coeff. sécurité courant kIsc" value={form.kIsc ?? 1.25} min={1.0} max={1.5} step={0.01}
              onChange={(v) => set("kIsc", v)} />
          </div>
        </CardContent>
      </Card>

      {/* Résultat global */}
      <Card className={`border-2 ${result.globalStatus === "ok" ? "border-green-500/40" : "border-destructive/40"}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {result.globalStatus === "ok"
              ? <CheckCircle2 className="w-5 h-5 text-green-600" />
              : <XCircle className="w-5 h-5 text-destructive" />}
            <span className={result.globalStatus === "ok" ? "text-green-700" : "text-destructive"}>
              {result.globalStatus === "ok"
                ? `✅ COMPATIBLE — ${form.model}`
                : `❌ DANGER : INCOMPATIBLE — ${form.model}`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Vérification tension */}
          <CheckBlock
            label="Vérification Tension"
            formula={`Voc × kVoc × Ns = ${form.voc} × ${form.kVoc} × ${form.nSeries}`}
            calculated={result.vstringMax}
            limit={result.vmaxAllowed}
            unit="V"
            ratio={vRatio}
            status={result.voltageStatus}
            okMsg={`✅ OK — ${result.vstringMax.toFixed(1)} V ≤ ${result.vmaxAllowed} V`}
            dangerMsg={`❌ DANGER — ${result.vstringMax.toFixed(1)} V > ${result.vmaxAllowed} V — Réduire Ns`}
          />

          {/* Vérification courant */}
          <CheckBlock
            label="Vérification Courant"
            formula={`Isc × kIsc × Np = ${form.isc} × ${form.kIsc} × ${form.nParallel}`}
            calculated={result.itotalMax}
            limit={result.imaxAllowed}
            unit="A"
            ratio={iRatio}
            status={result.currentStatus}
            okMsg={`✅ OK — ${result.itotalMax.toFixed(1)} A ≤ ${result.imaxAllowed} A`}
            dangerMsg={`❌ DANGER — ${result.itotalMax.toFixed(1)} A > ${result.imaxAllowed} A — Réduire Np`}
          />

          {/* Limites maximales autorisées */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
              <p className="text-xs text-muted-foreground">Ns max autorisé</p>
              <p className="font-bold text-xl text-primary mt-0.5">{result.maxSeriesAllowed}</p>
              <p className="text-[10px] text-muted-foreground font-mono">
                floor({result.vmaxAllowed} / ({form.voc} × {form.kVoc}))
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
              <p className="text-xs text-muted-foreground">Np max autorisé</p>
              <p className="font-bold text-xl text-primary mt-0.5">{result.maxParallelAllowed}</p>
              <p className="text-[10px] text-muted-foreground font-mono">
                floor({result.imaxAllowed} / ({form.isc} × {form.kIsc}))
              </p>
            </div>
          </div>

          {/* Recommandation */}
          <div className={`rounded-xl border-2 px-4 py-3 ${
            result.globalStatus === "ok"
              ? "border-green-500/30 bg-green-50/30"
              : "border-destructive/30 bg-destructive/5"
          }`}>
            <p className="text-xs font-semibold text-foreground mb-1">Recommandation technique</p>
            {result.globalStatus === "ok" ? (
              <p className="text-sm text-green-700">
                La configuration {form.nSeries}S × {form.nParallel}P est compatible avec le régulateur {form.model}.
                Marge tension : {result.voltageMargin.toFixed(1)}% | Marge courant : {result.currentMargin.toFixed(1)}%.
              </p>
            ) : (
              <div className="space-y-1 text-sm text-destructive">
                {result.voltageStatus === "danger" && (
                  <p>• Réduire le nombre de modules en série à Ns ≤ {result.maxSeriesAllowed}.</p>
                )}
                {result.currentStatus === "danger" && (
                  <p>• Réduire le nombre de chaînes en parallèle à Np ≤ {result.maxParallelAllowed}.</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Ou utiliser un régulateur de capacité supérieure (ex: GS-MPPT-100M si vous utilisez le 80M).
                </p>
              </div>
            )}
          </div>

          {/* Tableau récapitulatif */}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Paramètre</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Calculé</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Limite</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Statut</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 text-xs text-muted-foreground">Tension chaîne Vstring</td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-bold text-foreground">{result.vstringMax.toFixed(2)} V</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">≤ {result.vmaxAllowed} V</td>
                  <td className="px-3 py-2 text-right">
                    <StatusBadge status={result.voltageStatus} />
                  </td>
                </tr>
                <tr className="border-t border-border bg-muted/10">
                  <td className="px-3 py-2 text-xs text-muted-foreground">Courant total Itotal</td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-bold text-foreground">{result.itotalMax.toFixed(2)} A</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">≤ {result.imaxAllowed} A</td>
                  <td className="px-3 py-2 text-right">
                    <StatusBadge status={result.currentStatus} />
                  </td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 text-xs text-muted-foreground">Ns max autorisé</td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-bold text-foreground">{form.nSeries}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">≤ {result.maxSeriesAllowed}</td>
                  <td className="px-3 py-2 text-right">
                    <StatusBadge status={form.nSeries <= result.maxSeriesAllowed ? "ok" : "danger"} />
                  </td>
                </tr>
                <tr className="border-t border-border bg-muted/10">
                  <td className="px-3 py-2 text-xs text-muted-foreground">Np max autorisé</td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-bold text-foreground">{form.nParallel}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">≤ {result.maxParallelAllowed}</td>
                  <td className="px-3 py-2 text-right">
                    <StatusBadge status={form.nParallel <= result.maxParallelAllowed ? "ok" : "danger"} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Export PDF */}
          <Button
            onClick={() => generateMpptPDF(form, result)}
            className="w-full gap-2 border border-border bg-transparent text-muted-foreground hover:bg-muted"
            size="sm"
          >
            <FileText className="w-4 h-4 text-red-500" />
            Exporter Rapport PDF — Vérificateur MPPT
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Composants utilitaires ────────────────────────────────────────────────────

function NumInput({ label, value, min, max, step, onChange }: {
  label: string; value: number; min?: number; max?: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-8 text-sm" />
    </div>
  );
}

function StatusBadge({ status }: { status: "ok" | "danger" }) {
  return status === "ok"
    ? <span className="text-[10px] font-bold text-green-600">✅ OK</span>
    : <span className="text-[10px] font-bold text-destructive">❌ DANGER</span>;
}

function CheckBlock({
  label, formula, calculated, limit, unit, ratio, status, okMsg, dangerMsg,
}: {
  label: string; formula: string; calculated: number; limit: number;
  unit: string; ratio: number; status: "ok" | "danger"; okMsg: string; dangerMsg: string;
}) {
  return (
    <div className={`rounded-lg border-2 px-4 py-3 space-y-2 ${
      status === "ok" ? "border-green-500/30 bg-green-50/20" : "border-destructive/30 bg-destructive/5"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status === "ok"
            ? <CheckCircle2 className="w-4 h-4 text-green-600" />
            : <XCircle className="w-4 h-4 text-destructive" />}
          <div>
            <p className="text-xs font-semibold text-foreground">{label}</p>
            <p className="text-[10px] font-mono text-muted-foreground">{formula}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`font-bold text-lg ${status === "ok" ? "text-green-600" : "text-destructive"}`}>
            {calculated.toFixed(2)} {unit}
          </p>
          <p className="text-[10px] text-muted-foreground">/ {limit} {unit} max</p>
        </div>
      </div>
      {/* Barre de progression */}
      <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${status === "ok" ? "bg-green-500" : "bg-destructive"}`}
          style={{ width: `${Math.min(ratio, 100)}%` }}
        />
      </div>
      <p className={`text-[11px] font-semibold ${status === "ok" ? "text-green-700" : "text-destructive"}`}>
        {ratio.toFixed(1)}% de la limite — {status === "ok" ? okMsg : dangerMsg}
      </p>
    </div>
  );
}
