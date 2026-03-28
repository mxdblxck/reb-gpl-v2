/**
 * Compatibilité MPPT — Morning Star GS-MPPT
 * Voc_max = Voc × Ns × 1.15 → si > 200V : DESTRUCTION MPPT IMMINENTE
 * Isc_max = Isc × Np × 1.25 → si > I_limit : SURCHARGE RÉGULATEUR
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { CheckCircle2, XCircle, AlertTriangle, Cpu, RefreshCw, Zap } from "lucide-react";
import type { SiteResult, GatechMpptModel } from "@/lib/solar-calc.ts";
import { GATECH_MPPT_SPECS } from "@/lib/solar-calc.ts";

// Paramètres Jinko 555 Wp Tiger Neo (STC)
const VOC_DEF = 41.78;
const ISC_DEF = 14.07;

// Coefficients de sécurité
const K_VOC = 1.15; // correction température froide (nuit désert)
const K_ISC = 1.25; // marge sécurité courant (IEC 62548)
const V_MAX_MPPT = 200; // V — limite absolue Morning Star

type Props = { result: SiteResult };

export default function SiteMpptChecker({ result }: Props) {
  const { pv, params } = result;

  const ns = pv.seriesPerGroup;
  const np = pv.parallelStrings * params.groups;

  const [model, setModel] = useState<GatechMpptModel>("GS-MPPT-60");
  const [voc, setVoc] = useState(VOC_DEF);
  const [isc, setIsc] = useState(ISC_DEF);

  const reset = () => { setVoc(VOC_DEF); setIsc(ISC_DEF); };

  const specs = GATECH_MPPT_SPECS[model];

  const vocMax = useMemo(() => voc * ns * K_VOC, [voc, ns]);
  const iscMax = useMemo(() => isc * np * K_ISC, [isc, np]);

  const vocOk = vocMax <= V_MAX_MPPT;
  const iscOk = iscMax <= specs.imaxInput;

  const vocPct = (vocMax / V_MAX_MPPT) * 100;
  const iscPct = (iscMax / specs.imaxInput) * 100;

  const globalOk = vocOk && iscOk;

  // Ns max et Np max autorisés
  const nsMax = Math.floor(V_MAX_MPPT / (voc * K_VOC));
  const npMax = Math.floor(specs.imaxInput / (isc * K_ISC));

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="w-7 h-7 bg-primary/10 rounded-md flex items-center justify-center">
            <Cpu className="w-4 h-4 text-primary" />
          </div>
          Compatibilité MPPT — {result.siteId}
          <Badge className={`ml-auto text-[10px] font-bold ${
            globalOk
              ? "bg-green-500/10 text-green-700 border-green-300"
              : "bg-destructive/10 text-destructive border-destructive/30"
          }`}>
            {globalOk ? "✅ COMPATIBLE" : "❌ INCOMPATIBLE"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Config récupérée */}
        <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5 space-y-1">
          <p className="text-[11px] font-semibold text-foreground">
            Configuration synchronisée — {result.siteId}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-0.5 text-[10px] font-mono text-muted-foreground">
            <span>Ns = {ns} modules/chaîne</span>
            <span>Np = {np} chaînes</span>
            <span>Voc = {voc} V | Isc = {isc} A</span>
          </div>
          <p className="text-[10px] font-mono text-primary">
            Voc_max = Voc × Ns × {K_VOC} &nbsp;|&nbsp; Isc_max = Isc × Np × {K_ISC}
          </p>
        </div>

        {/* Sélection modèle */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Régulateur MPPT</Label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(GATECH_MPPT_SPECS) as GatechMpptModel[]).map((m) => (
              <button key={m} onClick={() => setModel(m)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  model === m
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40"
                }`}>
                {m} — {GATECH_MPPT_SPECS[m].imaxInput}A / {GATECH_MPPT_SPECS[m].vmaxInput}V
              </button>
            ))}
          </div>
        </div>

        {/* Paramètres module */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Voc module (V)</Label>
            <Input type="number" min={1} step={0.01} value={voc}
              onChange={(e) => setVoc(parseFloat(e.target.value) || 1)}
              className="h-7 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Isc module (A)</Label>
            <Input type="number" min={0.1} step={0.01} value={isc}
              onChange={(e) => setIsc(parseFloat(e.target.value) || 0.1)}
              className="h-7 text-xs" />
          </div>
        </div>

        <Button size="sm" onClick={reset}
          className="h-7 gap-1.5 text-xs border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10">
          <RefreshCw className="w-3 h-3" />
          Synchroniser avec la configuration actuelle
        </Button>

        {/* Alerte tension */}
        <AlertCard
          label="Vérification Tension"
          formula={`Voc_max = ${voc} × ${ns} × ${K_VOC} = ${vocMax.toFixed(2)} V`}
          calculated={vocMax}
          limit={V_MAX_MPPT}
          unit="V"
          pct={vocPct}
          ok={vocOk}
          dangerMsg="🔴 DESTRUCTION MPPT IMMINENTE — Voc_max dépasse la limite absolue"
          okMsg={`✅ Tension compatible — marge ${(V_MAX_MPPT - vocMax).toFixed(1)} V`}
          nsMax={nsMax}
          showNsMax
        />

        {/* Alerte courant */}
        <AlertCard
          label="Vérification Courant"
          formula={`Isc_max = ${isc} × ${np} × ${K_ISC} = ${iscMax.toFixed(2)} A`}
          calculated={iscMax}
          limit={specs.imaxInput}
          unit="A"
          pct={iscPct}
          ok={iscOk}
          dangerMsg="🔴 SURCHARGE RÉGULATEUR — Isc_max dépasse la capacité du MPPT"
          okMsg={`✅ Courant compatible — marge ${(specs.imaxInput - iscMax).toFixed(1)} A`}
          npMax={npMax}
          showNpMax
        />

        {/* Résumé config */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border bg-muted/10 px-3 py-2">
            <p className="text-[10px] text-muted-foreground">Ns max autorisé</p>
            <p className={`font-bold text-lg ${ns <= nsMax ? "text-green-600" : "text-destructive"}`}>
              {nsMax}
            </p>
            <p className="text-[9px] font-mono text-muted-foreground">
              floor({V_MAX_MPPT} / ({voc} × {K_VOC}))
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/10 px-3 py-2">
            <p className="text-[10px] text-muted-foreground">Np max autorisé</p>
            <p className={`font-bold text-lg ${np <= npMax ? "text-green-600" : "text-destructive"}`}>
              {npMax}
            </p>
            <p className="text-[9px] font-mono text-muted-foreground">
              floor({specs.imaxInput} / ({isc} × {K_ISC}))
            </p>
          </div>
        </div>

        {/* Recommandation */}
        <div className={`rounded-xl border-2 px-4 py-3 ${
          globalOk
            ? "border-green-500/40 bg-green-50/20"
            : "border-destructive/50 bg-destructive/10"
        }`}>
          <div className="flex items-start gap-2">
            {globalOk
              ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              : <Zap className="w-4 h-4 text-destructive shrink-0 mt-0.5" />}
            <div>
              <p className={`text-xs font-bold ${globalOk ? "text-green-700" : "text-destructive"}`}>
                {globalOk
                  ? `Configuration ${ns}S × ${np}P compatible avec ${model}`
                  : "Configuration incompatible — risque de destruction matériel"}
              </p>
              {!globalOk && (
                <div className="text-xs text-destructive mt-1 space-y-0.5">
                  {!vocOk && <p>• Réduire Ns ≤ {nsMax} modules en série</p>}
                  {!iscOk && <p>• Réduire Np ≤ {npMax} chaînes en parallèle</p>}
                  <p className="text-muted-foreground text-[10px] mt-1">
                    Ou utiliser un régulateur de capacité supérieure.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Carte d'alerte ────────────────────────────────────────────────────────────
function AlertCard({
  label, formula, calculated, limit, unit, pct, ok,
  dangerMsg, okMsg, nsMax, npMax, showNsMax, showNpMax,
}: {
  label: string; formula: string;
  calculated: number; limit: number; unit: string; pct: number;
  ok: boolean; dangerMsg: string; okMsg: string;
  nsMax?: number; npMax?: number;
  showNsMax?: boolean; showNpMax?: boolean;
}) {
  return (
    <div className={`rounded-xl border-2 px-4 py-3 space-y-2 ${
      ok ? "border-green-500/40 bg-green-50/10" : "border-destructive/50 bg-destructive/10"
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {ok
            ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            : <XCircle className="w-4 h-4 text-destructive shrink-0" />}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">{label}</p>
            <p className="text-[9px] font-mono text-muted-foreground truncate">{formula}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`font-bold text-base ${ok ? "text-green-600" : "text-destructive"}`}>
            {calculated.toFixed(2)} {unit}
          </p>
          <p className="text-[10px] text-muted-foreground">/ {limit} {unit} max</p>
        </div>
      </div>

      {/* Barre de progression */}
      <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${ok ? "bg-green-500" : "bg-destructive"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className={`text-[10px] font-bold ${ok ? "text-green-700" : "text-destructive"}`}>
          {ok ? okMsg : dangerMsg}
        </p>
        <span className={`text-[10px] font-semibold ${ok ? "text-green-600" : "text-destructive"}`}>
          {pct.toFixed(1)}%
        </span>
      </div>

      {!ok && (showNsMax || showNpMax) && (
        <p className="text-[10px] text-destructive font-semibold">
          {showNsMax && nsMax !== undefined && `→ Ns max autorisé : ${nsMax}`}
          {showNpMax && npMax !== undefined && `→ Np max autorisé : ${npMax}`}
        </p>
      )}
    </div>
  );
}
