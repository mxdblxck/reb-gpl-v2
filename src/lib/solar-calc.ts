// Solar PV & Battery Sizing Calculation Engine
// UTE C15-712-2 compliant – REB GPL Line Project

export type SiteId = "BVS1" | "BVS2" | "TA";

export type SiteParams = {
  siteId: string;
  energyLoad: number; // Wh/day
  psh: number; // Peak Sun Hours (default 4.95 h – worst month REB)
  pr: number; // Performance Ratio (default 0.72)
  modulePower: number; // Wp per module (default 555 Wp Jinko)
  groups: number; // Number of parallel PV groups (1 for BVS1/BVS2, 2 for TA)
  autonomy: number; // Battery autonomy in days (default 5)
  dod: number; // Depth of Discharge (default 0.8 Ni-Cad)
  batteryEfficiency: number; // Battery charge/discharge efficiency (default 0.85)
  cellVoltage: number; // Single cell voltage V (default 1.2 V Ni-Cad)
  unitaryBatteryCapacity: number; // Single battery capacity Ah (default 1275 Ah)
  systemVoltage: number; // DC bus voltage V (default 48 V)
  margin: number; // Safety margin percentage (default 0.2 = 20%)
};

export type PVResult = {
  pvRequiredWp: number; // PV Required Power (Wp)
  nModules: number; // Number of modules (ceil)
  nModulesPerGroup: number; // Modules per group
  seriesPerGroup: number; // Modules in series per group (MPPT range 2)
  parallelStrings: number; // Parallel strings per group
  totalModules: number; // Total modules all groups
  configLabel: string; // e.g. "2G × 2S × 2P"
  actualPvPower: number; // Actual installed Wp
};

export type BatteryResult = {
  capacityAh: number; // Required capacity in Ah
  capacityWh: number; // Required capacity in Wh
  cellsInSeries: number; // Cells in series to reach V_BATT
  parallelBranches: number; // Parallel branches (ceil(cap_ah / CAP_UNITAIRE))
  totalCells: number;
  configLabel: string; // e.g. "40S × 2P"
  actualCapacityAh: number; // Actual installed capacity
  actualCapacityWh: number;
};

export type SiteResult = {
  siteId: string;
  params: SiteParams;
  pv: PVResult;
  battery: BatteryResult;
  simultaneityFactor: number; // 1.0 standard, 1.3 if simultaneity applied
  correctedEnergyLoad: number; // E × simultaneityFactor
};

/**
 * Calculate PV system sizing for a single site
 */
export function calculatePV(params: SiteParams): PVResult {
  const { energyLoad, psh, pr, modulePower, groups } = params;

  // Required PV power: P_PV = E / (PSH × PR)
  const pvRequiredWp = energyLoad / (psh * pr);

  // Modules per group
  const nModulesPerGroup = Math.ceil(pvRequiredWp / (modulePower * groups));

  // Series/Parallel configuration: 2S per MPPT input (standard MPPT range)
  const seriesPerGroup = 2;
  const parallelStrings = Math.ceil(nModulesPerGroup / seriesPerGroup);

  // Adjusted modules per group (must be multiple of series)
  const adjustedModulesPerGroup = seriesPerGroup * parallelStrings;
  const totalModules = adjustedModulesPerGroup * groups;
  const actualPvPower = totalModules * modulePower;

  const configLabel = `${groups}G × ${seriesPerGroup}S × ${parallelStrings}P`;

  return {
    pvRequiredWp,
    nModules: adjustedModulesPerGroup,
    nModulesPerGroup: adjustedModulesPerGroup,
    seriesPerGroup,
    parallelStrings,
    totalModules,
    configLabel,
    actualPvPower,
  };
}

/**
 * Calculate battery bank sizing for a single site
 */
export function calculateBattery(params: SiteParams): BatteryResult {
  const {
    energyLoad,
    autonomy,
    dod,
    batteryEfficiency,
    cellVoltage,
    unitaryBatteryCapacity,
    systemVoltage,
  } = params;

  // Required capacity: C = (E × Autonomy) / (DOD × η_batt × V_batt)
  const capacityAh = (energyLoad * autonomy) / (dod * batteryEfficiency * systemVoltage);
  const capacityWh = capacityAh * systemVoltage;

  // Cells in series: n_s = V_BATT / V_CELL
  const cellsInSeries = Math.round(systemVoltage / cellVoltage);

  // Parallel branches: n_p = ceil(C_req / C_unit)
  const parallelBranches = Math.ceil(capacityAh / unitaryBatteryCapacity);

  const totalCells = cellsInSeries * parallelBranches;
  const actualCapacityAh = parallelBranches * unitaryBatteryCapacity;
  const actualCapacityWh = actualCapacityAh * systemVoltage;

  const configLabel = `${cellsInSeries}S × ${parallelBranches}P`;

  return {
    capacityAh,
    capacityWh,
    cellsInSeries,
    parallelBranches,
    totalCells,
    configLabel,
    actualCapacityAh,
    actualCapacityWh,
  };
}

/**
 * Full site sizing calculation
 */
export function calculateSite(
  params: SiteParams,
  applySimultaneity = false
): SiteResult {
  const simultaneityFactor = applySimultaneity ? 1.3 : 1.0;
  const margin = params.margin || 0;
  // Apply margin and simultaneity factor to energy load
  const correctedEnergyLoad = params.energyLoad * simultaneityFactor * (1 + margin);

  const correctedParams: SiteParams = {
    ...params,
    energyLoad: correctedEnergyLoad,
  };

  const pv = calculatePV(correctedParams);
  const battery = calculateBattery(correctedParams);

  return {
    siteId: params.siteId,
    params,
    pv,
    battery,
    simultaneityFactor,
    correctedEnergyLoad,
  };
}

/**
 * Default site parameters for REB GPL Line
 * BVS1: 1275 Ah | BVS2 & TA: 1515 Ah
 */
export function getDefaultSiteParams(siteId: string): SiteParams {
  const groups = siteId === "TA" ? 2 : 1;
  // Site-specific unitary battery capacity
  const unitaryBatteryCapacity = siteId === "BVS1" ? 1275 : 1515;
  return {
    siteId,
    energyLoad: 0,
    psh: 5.2,
    pr: 0.72,
    modulePower: 555,
    groups,
    autonomy: 5,
    dod: 0.8,
    batteryEfficiency: 0.85,
    cellVoltage: 1.2,
    unitaryBatteryCapacity,
    systemVoltage: 48,
    margin: 0, // Default: no safety margin (user can add in detailed view)
  };
}

/** Human-readable site full name */
export function getSiteFullName(siteId: string): string {
  if (siteId === "TA") return "Terminal Arrival";
  return `Bloc Valve Station ${siteId.slice(-1)}`;
}

// ── Battery Recharge Time ─────────────────────────────────────────────────────
// Corrected formula (off-grid energy flux method):
//   P_pv_net  = P_installed × PR
//   E_recharge_j = (P_pv_net × PSH) − (P_load_avg × PSH)   [load only subtracted during sunshine hours]
//   T_charge  = E_autonomie_consommee / (E_recharge_j × η_batt)

export type RechargeScenario = {
  sunHours: number;
  ePvJ: number;           // Net PV energy during sun hours: P_pv_net × PSH  (Wh/day)
  eLoadDuringPSH: number; // Load energy during sun hours:   P_load_avg × PSH (Wh)
  eRechargeJ: number;     // Net recharge energy available:  ePvJ − eLoadDuringPSH (Wh/day)
  daysToRecharge: number | null; // null when no surplus
};

export type RechargeResult = {
  batteryEnergyWh: number;     // P_batt = U × C  (Wh)
  eAutonomieConsommee: number; // E_load × autonomy (Wh) — energy to restore
  pPvNet: number;              // P_installed × PR  (W)
  pLoadAvg: number;            // E_load / 24  (W)
  scenarios: RechargeScenario[];
};

/**
 * Battery recharge time — corrected off-grid energy flux method.
 * The load is only subtracted during PSH hours because outside those hours
 * the load is fed exclusively by the batteries.
 */
export function calculateRecharge(result: SiteResult): RechargeResult {
  const { pv, battery, params, correctedEnergyLoad } = result;

  // Total battery energy (P_batteries = U × C)
  const batteryEnergyWh = battery.actualCapacityAh * params.systemVoltage;

  // Total energy to restore after full autonomy discharge
  const eAutonomieConsommee = correctedEnergyLoad * params.autonomy;

  // Net PV power after Performance Ratio losses
  const pPvNet = pv.actualPvPower * params.pr;

  // Average load power over 24 h
  const pLoadAvg = correctedEnergyLoad / 24;

  const scenarios: RechargeScenario[] = [6, 7, 8].map((sunHours) => {
    // Net PV energy produced during PSH hours
    const ePvJ = pPvNet * sunHours;
    // Load energy consumed only during the sun-hours window
    const eLoadDuringPSH = pLoadAvg * sunHours;
    // Energy surplus available for battery charging each day
    const eRechargeJ = ePvJ - eLoadDuringPSH;
    // Days to fully recharge (η_batt = charging efficiency)
    const daysToRecharge =
      eRechargeJ > 0
        ? eAutonomieConsommee / (eRechargeJ * params.batteryEfficiency)
        : null;
    return { sunHours, ePvJ, eLoadDuringPSH, eRechargeJ, daysToRecharge };
  });

  return { batteryEnergyWh, eAutonomieConsommee, pPvNet, pLoadAvg, scenarios };
}

// ── Detail Study Reference Configurations ────────────────────────────────────
// Fixed configurations from the REB GPL Line engineering detail study.

export type DetailConfig = {
  siteId: string;
  pvLabel: string;       // e.g. "1G × 2S × 5P"
  pvTotalModules: number;
  pvInstalledWp: number;
  battLabel: string;     // e.g. "40S × 2P = 2550 Ah"
  battSeries: number;
  battParallel: number;
  battTotalAh: number;
};

export const SITE_DETAIL_CONFIGS: Record<string, DetailConfig> = {
  BVS1: {
    siteId: "BVS1",
    pvLabel: "1G × 2S × 5P",
    pvTotalModules: 10,
    pvInstalledWp: 10 * 555,   // 5 550 Wp
    battLabel: "40S × 2P = 2 550 Ah",
    battSeries: 40,
    battParallel: 2,
    battTotalAh: 2 * 1275,     // 2 550 Ah
  },
  BVS2: {
    siteId: "BVS2",
    pvLabel: "1G × 2S × 3P",
    pvTotalModules: 6,
    pvInstalledWp: 6 * 555,    // 3 330 Wp
    battLabel: "40S × 1P = 1 515 Ah",
    battSeries: 40,
    battParallel: 1,
    battTotalAh: 1 * 1515,     // 1 515 Ah
  },
  TA: {
    siteId: "TA",
    pvLabel: "2G × 2S × 4.5P avg",
    pvTotalModules: 18,        // 9 modules/group avg (4P + 5P)
    pvInstalledWp: 18 * 555,   // 9 990 Wp
    battLabel: "40S × 4P = 6 060 Ah",
    battSeries: 40,
    battParallel: 4,
    battTotalAh: 4 * 1515,     // 6 060 Ah
  },
};

export const SITES: SiteId[] = ["BVS1", "BVS2", "TA"];

export function formatWp(wp: number): string {
  return wp >= 1000
    ? `${(wp / 1000).toFixed(2)} kWp`
    : `${wp.toFixed(0)} Wp`;
}

export function formatWh(wh: number): string {
  return wh >= 1000
    ? `${(wh / 1000).toFixed(2)} kWh`
    : `${wh.toFixed(0)} Wh`;
}

export function formatAh(ah: number): string {
  return `${ah.toFixed(0)} Ah`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VÉRIFICATEUR SECTION CÂBLES PV — Conforme GATECH REV I (2024-DO-SE-DOC-06)
// Formule : S = (ρ × 2 × L × I) / (ε × U)
// ═══════════════════════════════════════════════════════════════════════════════

// Résistivité cuivre à température de service (80°C) — valeur GATECH
export const RHO_CU_80 = 0.02314; // Ω·mm²/m
export const RHO_AL_80 = 0.0377;  // Ω·mm²/m (aluminium)

// Sections commerciales normalisées (mm²)
export const COMMERCIAL_SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120] as const;

// Courant admissible Iz à 80°C en pose libre (câble PV, UTE C15-100 / IEC 60364)
// Valeurs conservatives pour environnement désertique (80°C ambiant)
const IZ_TABLE: Record<number, number> = {
  1.5: 13, 2.5: 18, 4: 24, 6: 31, 10: 43, 16: 57,
  25: 75, 35: 92, 50: 112, 70: 138, 95: 168, 120: 194,
};

export type CableCheckerInput = {
  conductorType: "copper" | "aluminum";
  cableLength: number;      // m (aller simple)
  iImp: number;             // A — courant au point de puissance max
  iIsc: number;             // A — courant court-circuit
  currentType: "imp" | "isc"; // courant utilisé pour le calcul de section
  systemVoltage: number;    // V (24 ou 48)
  ambientTemp: number;      // °C (défaut 80)
  maxVoltageDrop: number;   // % (défaut 3)
};

export type CableCheckerResult = {
  rho: number;              // Ω·mm²/m utilisé
  iCalc: number;            // Courant de calcul (Imp ou Isc)
  sectionMin: number;       // mm² — section minimale calculée
  sectionCommercial: number;// mm² — section commerciale recommandée
  deltaVReal: number;       // V — chute de tension réelle
  deltaVPercent: number;    // % — chute de tension réelle
  powerLoss: number;        // W — pertes résistives
  iz: number;               // A — courant admissible à 80°C
  izCheck: boolean;         // true si Iz ≥ 1.25 × Isc
  izStatus: "ok" | "danger";
  voltageDropStatus: "ok" | "acceptable" | "danger";
};

export function calculateCableSection(input: CableCheckerInput): CableCheckerResult {
  const { conductorType, cableLength, iImp, iIsc, currentType, systemVoltage, maxVoltageDrop } = input;

  const rho = conductorType === "copper" ? RHO_CU_80 : RHO_AL_80;
  const iCalc = currentType === "imp" ? iImp : iIsc;
  const epsilon = maxVoltageDrop / 100;

  // Formule GATECH : S = (ρ × 2 × L × I) / (ε × U)
  const sectionMin = (rho * 2 * cableLength * iCalc) / (epsilon * systemVoltage);

  // Section commerciale : première valeur ≥ sectionMin
  const sectionCommercial = COMMERCIAL_SECTIONS.find((s) => s > sectionMin) ?? 120;

  // Chute de tension réelle avec la section commerciale
  const deltaVReal = (rho * 2 * cableLength * iCalc) / sectionCommercial;
  const deltaVPercent = (deltaVReal / systemVoltage) * 100;

  // Pertes résistives : P = ρ × 2L × I² / S
  const powerLoss = (rho * 2 * cableLength * iCalc * iCalc) / sectionCommercial;

  // Courant admissible à 80°C
  const iz = IZ_TABLE[sectionCommercial] ?? 0;

  // Vérification Iz ≥ 1.25 × Isc (NF C 15-100 / IEC 60364-7-712)
  const izCheck = iz >= 1.25 * iIsc;
  const izStatus: CableCheckerResult["izStatus"] = izCheck ? "ok" : "danger";

  const voltageDropStatus: CableCheckerResult["voltageDropStatus"] =
    deltaVPercent <= 3 ? "ok" : deltaVPercent <= 5 ? "acceptable" : "danger";

  return {
    rho, iCalc, sectionMin, sectionCommercial,
    deltaVReal, deltaVPercent, powerLoss,
    iz, izCheck, izStatus, voltageDropStatus,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VÉRIFICATEUR MPPT GATECH — GS-MPPT-100M / GS-MPPT-80M (Morning Star)
// Conforme GATECH REV I (2024-DO-SE-DOC-06)
// ═══════════════════════════════════════════════════════════════════════════════

export type GatechMpptModel = "GS-MPPT-60" | "GS-MPPT-80M" | "GS-MPPT-100M";

export const GATECH_MPPT_SPECS: Record<GatechMpptModel, {
  vmaxInput: number;   // V — tension max entrée
  imaxInput: number;   // A — courant max entrée
  vmaxBatt: number;    // V — tension batterie max
  label: string;
}> = {
  "GS-MPPT-60":   { vmaxInput: 200, imaxInput: 60,  vmaxBatt: 60, label: "Morning Star GS-MPPT-60" },
  "GS-MPPT-80M":  { vmaxInput: 200, imaxInput: 80,  vmaxBatt: 60, label: "Morning Star GS-MPPT-80M" },
  "GS-MPPT-100M": { vmaxInput: 200, imaxInput: 100, vmaxBatt: 60, label: "Morning Star GS-MPPT-100M" },
};

export type GatechMpptInput = {
  model: GatechMpptModel;
  nSeries: number;       // Modules en série par chaîne
  nParallel: number;     // Chaînes en parallèle
  voc: number;           // V — Voc module (STC)
  isc: number;           // A — Isc module (STC)
  kVoc?: number;         // Coefficient sécurité tension (défaut 1.14 GATECH)
  kIsc?: number;         // Coefficient sécurité courant (défaut 1.25 GATECH)
};

export type GatechMpptResult = {
  vstringMax: number;    // V — Voc × kVoc × Ns
  itotalMax: number;     // A — Isc × kIsc × Np
  vmaxAllowed: number;
  imaxAllowed: number;
  voltageStatus: "ok" | "danger";
  currentStatus: "ok" | "danger";
  globalStatus: "ok" | "danger";
  maxSeriesAllowed: number;   // Ns max autorisé
  maxParallelAllowed: number; // Np max autorisé
  voltageMargin: number;      // % de marge restante
  currentMargin: number;      // % de marge restante
};

export function calculateGatechMppt(input: GatechMpptInput): GatechMpptResult {
  const { model, nSeries, nParallel, voc, isc, kVoc = 1.14, kIsc = 1.25 } = input;
  const specs = GATECH_MPPT_SPECS[model];

  // Tension max chaîne : Voc × kVoc × Ns
  const vstringMax = voc * kVoc * nSeries;
  // Courant total : Isc × kIsc × Np
  const itotalMax = isc * kIsc * nParallel;

  const voltageStatus: GatechMpptResult["voltageStatus"] = vstringMax <= specs.vmaxInput ? "ok" : "danger";
  const currentStatus: GatechMpptResult["currentStatus"] = itotalMax <= specs.imaxInput ? "ok" : "danger";
  const globalStatus: GatechMpptResult["globalStatus"] =
    voltageStatus === "ok" && currentStatus === "ok" ? "ok" : "danger";

  // Nombre max autorisé en série : floor(Vmax / (Voc × kVoc))
  const maxSeriesAllowed = Math.floor(specs.vmaxInput / (voc * kVoc));
  // Nombre max autorisé en parallèle : floor(Imax / (Isc × kIsc))
  const maxParallelAllowed = Math.floor(specs.imaxInput / (isc * kIsc));

  const voltageMargin = ((specs.vmaxInput - vstringMax) / specs.vmaxInput) * 100;
  const currentMargin = ((specs.imaxInput - itotalMax) / specs.imaxInput) * 100;

  return {
    vstringMax, itotalMax,
    vmaxAllowed: specs.vmaxInput,
    imaxAllowed: specs.imaxInput,
    voltageStatus, currentStatus, globalStatus,
    maxSeriesAllowed, maxParallelAllowed,
    voltageMargin, currentMargin,
  };
}
