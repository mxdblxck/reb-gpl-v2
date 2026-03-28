import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Sun, Battery, Zap, Clock, BookOpen } from "lucide-react";
import type { SiteResult } from "@/lib/solar-calc.ts";
import {
  formatWp,
  formatWh,
  formatAh,
  calculateRecharge,
  SITE_DETAIL_CONFIGS,
} from "@/lib/solar-calc.ts";
import SiteCableChecker from "./SiteCableChecker.tsx";
import SiteMpptChecker from "./SiteMpptChecker.tsx";

type Props = {
  result: SiteResult;
};

type RowDef = {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
};

export default function SiteResultCard({ result }: Props) {
  const { pv, battery, params, simultaneityFactor, correctedEnergyLoad } = result;

  const pvRows: RowDef[] = [
    {
      label: "Puissance PV Requise",
      value: formatWp(pv.pvRequiredWp),
      sub: `E / (PSH * PR) = ${correctedEnergyLoad.toFixed(0)} / (${params.psh} * ${params.pr})`,
    },
    {
      label: "Puissance PV Installée",
      value: formatWp(pv.actualPvPower),
      highlight: true,
      sub: `${pv.totalModules} * ${params.modulePower} Wp`,
    },
    {
      label: "Nombre de Modules",
      value: `${pv.totalModules} modules`,
      sub: `${pv.nModulesPerGroup} par groupe * ${params.groups} groupe(s)`,
    },
    {
      label: "Configuration",
      value: pv.configLabel,
      highlight: true,
      sub: "Groupes * Série * Parallèle",
    },
    {
      label: "Modules en Série par String",
      value: `${pv.seriesPerGroup} modules`,
      sub: "Plage de tension MPPT",
    },
    {
      label: "Strings en Parallèle",
      value: `${pv.parallelStrings} string(s)`,
      sub: "par groupe",
    },
  ];

  const battRows: RowDef[] = [
    {
      label: "Capacité Requise",
      value: formatAh(battery.capacityAh),
      sub: `(E * ${params.autonomy}j) / (${params.dod} * ${params.batteryEfficiency} * ${params.systemVoltage}V)`,
    },
    {
      label: "Énergie Requise",
      value: formatWh(battery.capacityWh),
      sub: `À ${params.systemVoltage} V nominal`,
    },
    {
      label: "Capacité Installée",
      value: formatAh(battery.actualCapacityAh),
      highlight: true,
      sub: `${battery.parallelBranches} branche(s) * ${params.unitaryBatteryCapacity} Ah`,
    },
    {
      label: "Énergie Installée",
      value: formatWh(battery.actualCapacityWh),
      highlight: true,
      sub: "Utilisable avec DOD",
    },
    {
      label: "Cellules en Série",
      value: `${battery.cellsInSeries} cellules`,
      sub: `${params.systemVoltage}V / ${params.cellVoltage}V`,
    },
    {
      label: "Configuration",
      value: battery.configLabel,
      highlight: true,
      sub: "Série * Parallèle (Ni-Cad)",
    },
    {
      label: "Total Cellules",
      value: `${battery.totalCells} cellules`,
      sub: `${battery.cellsInSeries}S * ${battery.parallelBranches}P`,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Résumé des données d'entrée */}
      <div className="flex flex-wrap gap-2">
        <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">
          <Zap className="w-3 h-3 mr-1" />
          E = {correctedEnergyLoad.toFixed(0)} Wh/j
        </Badge>
        {simultaneityFactor > 1 && (
          <Badge className="bg-amber-500/10 text-amber-700 border-amber-300">
            Simultanéité x{simultaneityFactor}
          </Badge>
        )}
        <Badge className="bg-muted text-muted-foreground border-border">
          PSH = {params.psh} h | PR = {params.pr}
        </Badge>
        <Badge className="bg-muted text-muted-foreground border-border">
          {params.systemVoltage} V | {params.autonomy}j d'autonomie
        </Badge>
      </div>

      {/* ── Dimensionnement PV & Batterie Calculé ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Carte PV */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 bg-primary/10 rounded-md flex items-center justify-center">
                <Sun className="w-4 h-4 text-primary" />
              </div>
              Dimensionnement Système PV
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody>
                {pvRows.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-t border-border ${row.highlight ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-4 py-2.5 text-muted-foreground">
                      <div>{row.label}</div>
                      {row.sub && (
                        <div className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                          {row.sub}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={
                          row.highlight
                            ? "font-bold text-primary"
                            : "font-medium text-foreground"
                        }
                      >
                        {row.value}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Carte Batterie */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 bg-primary/10 rounded-md flex items-center justify-center">
                <Battery className="w-4 h-4 text-primary" />
              </div>
              Dimensionnement Banc de Batteries
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody>
                {battRows.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-t border-border ${row.highlight ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-4 py-2.5 text-muted-foreground">
                      <div>{row.label}</div>
                      {row.sub && (
                        <div className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                          {row.sub}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={
                          row.highlight
                            ? "font-bold text-primary"
                            : "font-medium text-foreground"
                        }
                      >
                        {row.value}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* ── Étude de Détails Suggérée ── */}
      <DetailStudyCard siteId={result.siteId} />

      {/* ── Temps de Recharge des Batteries ── */}
      <RechargeTimeCard result={result} />

      {/* ── Vérification Câbles PV ── */}
      <SiteCableChecker result={result} />

      {/* ── Compatibilité MPPT ── */}
      <SiteMpptChecker result={result} />
    </div>
  );
}

// ── Étude de Détails Suggérée ─────────────────────────────────────────────────

function DetailStudyCard({ siteId }: { siteId: string }) {
  const config = SITE_DETAIL_CONFIGS[siteId];
  if (!config) return null;

  return (
    <Card className="border-amber-400/40 bg-amber-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="w-7 h-7 bg-amber-500/15 rounded-md flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-amber-800">Étude de Détails Suggérée</span>
          <Badge className="ml-auto text-[10px] bg-amber-500/10 text-amber-700 border-amber-300">
            Référence
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Config PV */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">
              Système Photovoltaïque
            </p>
            <div className="rounded-lg border border-amber-300/50 bg-background p-3 space-y-1.5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Configuration</span>
                <span className="font-bold text-primary">{config.pvLabel}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Nbre modules</span>
                <span className="font-medium text-foreground">{config.pvTotalModules} modules</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Puissance installée</span>
                <span className="font-medium text-foreground">{formatWp(config.pvInstalledWp)}</span>
              </div>
            </div>
          </div>

          {/* Config Batterie */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">
              Banc de Batteries Ni-Cad
            </p>
            <div className="rounded-lg border border-amber-300/50 bg-background p-3 space-y-1.5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Configuration</span>
                <span className="font-bold text-primary">{config.battLabel}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Cellules en série</span>
                <span className="font-medium text-foreground">{config.battSeries} cellules (48V)</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Branches parallèles</span>
                <span className="font-medium text-foreground">{config.battParallel}P</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Capacité totale</span>
                <span className="font-semibold text-primary">{formatAh(config.battTotalAh)}</span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-amber-700/70 mt-3">
          Configuration issue de l'étude de détails REB GPL Line — à valider avec les charges réelles de chaque site.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Temps de Recharge des Batteries ──────────────────────────────────────────

function RechargeTimeCard({ result }: { result: SiteResult }) {
  const recharge = calculateRecharge(result);
  const { batteryEnergyWh, eAutonomieConsommee, pPvNet, pLoadAvg, scenarios } = recharge;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="w-7 h-7 bg-primary/10 rounded-md flex items-center justify-center">
            <Clock className="w-4 h-4 text-primary" />
          </div>
          Temps de Recharge des Batteries
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Formules et valeurs intermédiaires */}
        <div className="rounded-lg bg-muted/30 border border-border px-4 py-3 text-xs text-muted-foreground space-y-1.5 font-mono">
          <p className="font-sans font-semibold text-foreground text-[11px] mb-1">
            Méthode flux d'énergie nette (Off-Grid)
          </p>
          <p>
            <span className="text-primary font-semibold">P_pv_net</span>
            {" = P_installée * PR = "}
            {result.pv.actualPvPower.toFixed(0)} * {result.params.pr}
            {" = "}
            <strong className="text-foreground">{pPvNet.toFixed(0)} W</strong>
          </p>
          <p>
            <span className="text-primary font-semibold">P_charge_moy</span>
            {" = E_charge / 24 = "}
            {result.correctedEnergyLoad.toFixed(0)} / 24
            {" = "}
            <strong className="text-foreground">{pLoadAvg.toFixed(1)} W</strong>
          </p>
          <p>
            <span className="text-primary font-semibold">E_recharge_j</span>
            {" = (P_pv_net − P_charge_moy) * PSH"}
          </p>
          <p>
            <span className="text-primary font-semibold">T_charge</span>
            {" = E_autonomie / (E_recharge_j * η_batt)"}
          </p>
          <div className="border-t border-border/50 pt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
            <span>
              E_autonomie = {result.correctedEnergyLoad.toFixed(0)} * {result.params.autonomy}j
              {" = "}
              <strong className="text-foreground">{formatWh(eAutonomieConsommee)}</strong>
            </span>
            <span>
              E_batt = {result.params.systemVoltage}V * {result.battery.actualCapacityAh}Ah
              {" = "}
              <strong className="text-foreground">{formatWh(batteryEnergyWh)}</strong>
            </span>
            <span>η_batt = {result.params.batteryEfficiency}</span>
          </div>
        </div>

        {/* Tableau des scénarios */}
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">
                  PSH (h/j)
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">
                  E_pv_net (Wh/j)
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">
                  E_charge_psh (Wh)
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">
                  E_recharge_j (Wh/j)
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-primary">
                  T_charge (jours)
                </th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s, i) => (
                <tr
                  key={s.sunHours}
                  className={`border-t border-border ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                >
                  <td className="px-3 py-2.5 font-semibold text-foreground">
                    {s.sunHours} h
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground font-mono text-xs">
                    {s.ePvJ.toFixed(0)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground font-mono text-xs">
                    {s.eLoadDuringPSH.toFixed(0)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs">
                    <span
                      className={
                        s.eRechargeJ > 0
                          ? "text-green-600 font-semibold"
                          : "text-destructive font-semibold"
                      }
                    >
                      {s.eRechargeJ > 0 ? "+" : ""}
                      {s.eRechargeJ.toFixed(0)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {s.daysToRecharge !== null ? (
                      <span className="font-bold text-primary">
                        {s.daysToRecharge.toFixed(2)} j
                      </span>
                    ) : (
                      <span className="text-destructive text-xs italic">
                        Pas de surplus
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground">
          E_autonomie consommée sur {result.params.autonomy} jours = {formatWh(eAutonomieConsommee)}.
          La charge est soustraite uniquement pendant PSH (hors PSH = alimentation batterie seule).
        </p>
      </CardContent>
    </Card>
  );
}
