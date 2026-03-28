// PDF & Excel Export utility for Solar Sizing Reports
// REB GPL Line Project — UTE C15-712-2

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { SiteResult } from "./solar-calc.ts";
import { formatWp, formatWh, formatAh, calculateRecharge, SITE_DETAIL_CONFIGS, getSiteFullName } from "./solar-calc.ts";

const BRAND_ORANGE = [255, 102, 0] as [number, number, number];
const BRAND_LIGHT = [255, 242, 230] as [number, number, number];
const DARK = [30, 20, 10] as [number, number, number];
const GRAY = [120, 100, 80] as [number, number, number];

export function generateSizingPDF(results: SiteResult[], projectName?: string): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const dateStr = new Date().toLocaleDateString('fr-FR', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // ── En-tête avec logo Sonatrach ────────────────────────────────────────────────
  doc.setFillColor(...BRAND_ORANGE);
  doc.rect(0, 0, pageW, 35, "F");

  // Sonatrach logo text
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("SONATRACH", margin, 15);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Direction Centrale - Engineering & Project Management", margin, 22);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Projet ligne d'expédition GPL 14\" - RHOURDE EL BAGUEL", margin, 29);

  // Right side - Report title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RAPPORT DE DIMENSIONNEMENT", pageW - margin, 15, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Système Photovoltaïque Autonome (Off-Grid)", pageW - margin, 21, { align: "right" });
  doc.setFontSize(8);
  doc.text("Conforme à la norme UTE C15-712-2", pageW - margin, 27, { align: "right" });

  let y = 45;

  // ── Titre du projet ─────────────────────────────────────────────────────────
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Projet: ${projectName || "Dimensionnement PV - REB GPL"}`, margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`Date: ${dateStr}`, margin, y);
  y += 12;

  // ── Base de calcul et paramètres ─────────────────────────────────────────────
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("1. BASE DE CALCUL ET PARAMÈTRES", margin, y);
  y += 7;

  doc.setDrawColor(...BRAND_ORANGE);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  const psh = results[0]?.params.psh ?? 4.95;
  const pr = results[0]?.params.pr ?? 0.72;
  const modulePower = results[0]?.params.modulePower ?? 555;
  const systemVoltage = results[0]?.params.systemVoltage ?? 48;
  const autonomy = results[0]?.params.autonomy ?? 5;
  const dod = results[0]?.params.dod ?? 0.8;
  const batteryEff = results[0]?.params.batteryEfficiency ?? 0.85;
  const unitaryCap = results[0]?.params.unitaryBatteryCapacity ?? 1275;
  
  // Dynamic PSH label - show (pire mois) for low values, (moyenne) for higher values
  const pshLabel = psh <= 5.0 ? "(pire mois)" : "(moyenne)";

  const basis = [
    ["Emplacement", "Rhourde El Baguel, Algérie (Désert du Sahara)"],
    ["Heures de Soleil Crête (PSH)", `${psh} h/jour ${pshLabel}`],
    ["Ratio de Performance (PR)", `${pr} (valeur conservative, pertes câblage/température)`],
    ["Module PV", `${modulePower} Wp — Jinko Solar (mono-PERC)`],
    ["Tension Système", `${systemVoltage} V DC`],
    ["Technologie Batterie", "Ni-Cad (Nickel-Cadmium), 1,2 V/cellule"],
    ["Autonomie Batterie", `${autonomy} jours`],
    ["Profondeur de Décharge (DOD)", `${dod * 100}%`],
    ["Rendement Batterie", `${batteryEff * 100}%`],
    ["Capacité Unitaire Batterie", `${unitaryCap} Ah`],
    ["Référence Normative", "IEC 61215, IEC 62259, IEEE 1115 et UTE C15-712-2"],
  ];

  autoTable(doc, {
    startY: y,
    body: basis,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55, textColor: [80, 80, 80] },
      1: { cellWidth: "auto", textColor: DARK },
    },
    margin: { left: margin, right: margin },
  });

  y = ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // ── Formules de dimensionnement ────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...DARK);
  doc.text("2. FORMULES DE DIMENSIONNEMENT", margin, y);
  y += 7;
  doc.setDrawColor(...BRAND_ORANGE);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const formulas = [
    ["Puissance PV Requise (Wp)", "P_req = E / (PSH x PR)"],
    ["Nombre de Modules", "N = ceil(P_req / P_module)"],
    ["Capacite Batterie Requise (Ah)", "C_req = (E x Autonomie) / (DOD x n_batt x V_sys)"],
    ["Cellules en Serie", "N_cells = V_sys / V_cellule"],
    ["Branches Paralleles", "N_branches = ceil(C_req / C_unitaire)"],
  ];
  
  formulas.forEach(([formula, calc]) => {
    doc.setTextColor(...DARK);
    doc.text(`-  ${formula}:`, margin, y);
    doc.setTextColor(...GRAY);
    doc.text(calc, margin + 75, y);
    y += 6;
  });
  y += 5;

  // ── Résultats par site ──────────────────────────────────────────────────────
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (y > 220) {
      doc.addPage();
      y = 20;
    }

    const { siteId, pv, battery, params, correctedEnergyLoad, simultaneityFactor } = result;
    const siteName = getSiteFullName(siteId);

    // En-tête du site
    doc.setFillColor(...BRAND_LIGHT);
    doc.rect(margin, y - 3, pageW - 2 * margin, 12, "F");
    doc.setFillColor(...BRAND_ORANGE);
    doc.rect(margin, y - 3, 4, 12, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...BRAND_ORANGE);
    doc.text(`SITE ${siteId}`, margin + 7, y + 4);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(siteName, margin + 35, y + 4);

    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(
      `E = ${correctedEnergyLoad.toFixed(0)} Wh/jour${simultaneityFactor > 1 ? ` (×${simultaneityFactor} simultanéité)` : ""}`,
      pageW - margin,
      y + 4,
      { align: "right" }
    );

    y += 16;

    // ── Système PV ─────────────────────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    doc.text(`3.${i + 1} Système Photovoltaïque - ${siteId}`, margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Paramètre", "Valeur", "Formule / Note"]],
      body: [
        ["Puissance PV Requise", formatWp(pv.pvRequiredWp), `E / (PSH * PR) = ${correctedEnergyLoad.toFixed(0)} / (${params.psh} * ${params.pr})`],
        ["Puissance PV Installée", formatWp(pv.actualPvPower), `${pv.totalModules} * ${params.modulePower} Wp`],
        ["Nombre Total de Modules", `${pv.totalModules} modules`, `${pv.nModulesPerGroup}/groupe * ${params.groups} groupe(s)`],
        ["Configuration", pv.configLabel, "Groupes * Série * Parallèle"],
        ["Modules en Série/String", `${pv.seriesPerGroup} modules`, "Plage tension MPPT"],
        ["Strings en Parallèle", `${pv.parallelStrings}`, "par groupe"],
      ],
      theme: "striped",
      headStyles: { fillColor: BRAND_ORANGE, textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: BRAND_LIGHT },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: "bold" },
        1: { cellWidth: 45, halign: "right" },
        2: { cellWidth: "auto", textColor: GRAY },
      },
      margin: { left: margin, right: margin },
    });
    y = ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

    // ── Batterie ────────────────────────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    doc.text(`3.${i + 2} Parc Batteries - ${siteId}`, margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Paramètre", "Valeur", "Formule / Note"]],
      body: [
        ["Capacité Requise", formatAh(battery.capacityAh), `(E * ${params.autonomy}j) / (${params.dod} * ${params.batteryEfficiency} * ${params.systemVoltage}V)`],
        ["Énergie Requise", formatWh(battery.capacityWh), `A ${params.systemVoltage} V nominal`],
        ["Capacité Installée", formatAh(battery.actualCapacityAh), `${battery.parallelBranches} branche(s) * ${params.unitaryBatteryCapacity} Ah`],
        ["Énergie Installée", formatWh(battery.actualCapacityWh), "Nominale à la tension système"],
        ["Cellules en Série", `${battery.cellsInSeries} cellules`, `${params.systemVoltage}V / ${params.cellVoltage}V/cellule`],
        ["Branches Parallèles", `${battery.parallelBranches}`, `ceil(${battery.capacityAh.toFixed(0)} / ${params.unitaryBatteryCapacity})`],
        ["Configuration", battery.configLabel, "Série * Parallèle (Ni-Cad)"],
        ["Total Cellules", `${battery.totalCells}`, `${battery.cellsInSeries}S * ${battery.parallelBranches}P`],
      ],
      theme: "striped",
      headStyles: { fillColor: [80, 60, 40], textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [250, 245, 240] },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: "bold" },
        1: { cellWidth: 45, halign: "right" },
        2: { cellWidth: "auto", textColor: GRAY },
      },
      margin: { left: margin, right: margin },
    });
    y = ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

    // ── Configuration détaillée suggérée ──────────────────────────────────────
    const detailConfig = SITE_DETAIL_CONFIGS[siteId];
    if (detailConfig) {
      if (y > 200) { doc.addPage(); y = 20; }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...DARK);
      doc.text(`3.${i + 3} Configuration Détaillée Suggérée - ${siteId}`, margin, y);
      y += 3;

      autoTable(doc, {
        startY: y,
        head: [["Paramètre", "Système PV", "Parc Batteries"]],
        body: [
          ["Configuration", detailConfig.pvLabel, detailConfig.battLabel],
          ["Nombre / Cellules", `${detailConfig.pvTotalModules} modules`, `${detailConfig.battSeries}S × ${detailConfig.battParallel}P`],
          ["Puissance / Capacité", formatWp(detailConfig.pvInstalledWp), formatAh(detailConfig.battTotalAh)],
        ],
        theme: "grid",
        headStyles: { fillColor: [180, 120, 0], textColor: [255, 255, 255], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 45, fontStyle: "bold" },
          1: { cellWidth: 60, halign: "center" },
          2: { cellWidth: "auto", halign: "center" },
        },
        margin: { left: margin, right: margin },
      });
      y = ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    // ── Temps de recharge ─────────────────────────────────────────────────────
    if (y > 180) { doc.addPage(); y = 20; }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    doc.text(`3.${i + 4} Temps de Recharge des Batteries - ${siteId}`, margin, y);
    y += 5;

    const recharge = calculateRecharge(result);
    const { pPvNet, pLoadAvg, scenarios } = recharge;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(
      `P_pv_net = P_inst x PR = ${pv.actualPvPower.toFixed(0)} x ${params.pr} = ${pPvNet.toFixed(0)} W    |    P_moyenne = E / 24 = ${pLoadAvg.toFixed(1)} W`,
      margin,
      y + 4
    );
    doc.text(
      `T_recharge = Energie_autonomie / (Surplus_quotidien x n_batt)`,
      margin,
      y + 9
    );
    y += 14;

    autoTable(doc, {
      startY: y,
      head: [["PSH (h/j)", "E_pv_net (Wh/j)", "E_charge (Wh)", "Surplus (Wh/j)", "T_recharge (jours)"]],
      body: scenarios.map((s) => [
        `${s.sunHours} h`,
        s.ePvJ.toFixed(0),
        s.eLoadDuringPSH.toFixed(0),
        s.eRechargeJ > 0 ? `+${s.eRechargeJ.toFixed(0)}` : s.eRechargeJ.toFixed(0),
        s.daysToRecharge !== null ? `${s.daysToRecharge.toFixed(2)} j` : "Pas de surplus",
      ]),
      theme: "striped",
      headStyles: { fillColor: [60, 120, 60], textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [240, 248, 240] },
      columnStyles: {
        0: { cellWidth: 20, fontStyle: "bold" },
        1: { cellWidth: 35, halign: "right" },
        2: { cellWidth: 35, halign: "right" },
        3: { cellWidth: 35, halign: "right" },
        4: { cellWidth: "auto", halign: "right", fontStyle: "bold" },
      },
      margin: { left: margin, right: margin },
    });
    y = ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  }

  // ── Récapitulatif de tous les sites ────────────────────────────────────────
  if (results.length > 1) {
    if (y > 180) {
      doc.addPage();
      y = 20;
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...DARK);
    doc.text("4. RÉCAPITULATIF GLOBAL", margin, y);
    y += 7;
    doc.setDrawColor(...BRAND_ORANGE);
    doc.line(margin, y, pageW - margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Site", "E (Wh/j)", "Puissance PV", "Modules", "Config PV", "Capacité Batt.", "Config Batt."]],
      body: results.map((r) => [
        r.siteId,
        r.correctedEnergyLoad.toFixed(0),
        formatWp(r.pv.actualPvPower),
        r.pv.totalModules.toString(),
        r.pv.configLabel,
        formatAh(r.battery.actualCapacityAh),
        r.battery.configLabel,
      ]),
      theme: "grid",
      headStyles: { fillColor: BRAND_ORANGE, textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: margin, right: margin },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 4: CABLES PV - VERIFICATION PAR SITE
  // ═══════════════════════════════════════════════════════════════════════════════
  if (y > 150) { doc.addPage(); y = 20; }
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...DARK);
  doc.text("5. VERIFICATION CABLES PV - PAR SITE", margin, y);
  y += 7;
  doc.setDrawColor(...BRAND_ORANGE);
  doc.line(margin, y, pageW - margin, y);
  y += 8;
  
  // Parametres fixes pour le calcul Cable (comme SiteCableChecker)
  const RHO_CU = 0.02314;
  const EPSILON = 0.03;
  const IMP = 13.33;
  const ISC = 14.07;
  const VMP = 41.64;
  const L1_DEF = 3;
  const L2_DEF = 30;
  const L3_DEF = 8;
  
  const SECS_CABLE = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
  const IZ_TABLE: Record<number, number> = {
    1.5: 20, 2.5: 27, 4: 36, 6: 47, 10: 66, 16: 88, 25: 117, 35: 146, 
    50: 177, 70: 226, 95: 274, 120: 318, 150: 363, 185: 415, 240: 489,
  };
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const { pv, params } = result;
    const siteId = result.siteId;
    
    if (y > 200) { doc.addPage(); y = 20; }
    
    // En-tete site cable
    doc.setFillColor(255, 242, 230);
    doc.rect(margin, y - 3, pageW - 2*margin, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND_ORANGE);
    doc.text(`Cables PV - ${siteId}`, margin + 3, y + 2);
    y += 12;
    
    const np = pv.parallelStrings * params.groups;
    const vMpp = VMP * pv.seriesPerGroup;
    const vSys = params.systemVoltage;
    
    // Courants de design
    const i1 = IMP;
    const i2 = IMP * np;
    const i3 = 100;
    
    // Segments
    const segs = [
      { name: "Module -> Boite Jonction", L: L1_DEF, I: i1, V: vMpp, Isc: ISC },
      { name: "Boite -> Armoire", L: L2_DEF, I: i2, V: vMpp, Isc: ISC * np },
      { name: "Batterie -> Armoire", L: L3_DEF, I: i3, V: vSys, Isc: ISC * np },
    ];
    
    const segData = segs.map(seg => {
      const sCalc = (RHO_CU * 2 * seg.L * seg.I) / (EPSILON * seg.V);
      const izReq = 1.25 * seg.Isc;
      const baseIdx = SECS_CABLE.findIndex((s) => s >= sCalc);
      const start = baseIdx === -1 ? SECS_CABLE.length - 1 : baseIdx;
      let chosen = SECS_CABLE[start];
      for (let j = start; j < SECS_CABLE.length; j++) {
        if ((IZ_TABLE[SECS_CABLE[j]] ?? 0) >= izReq) { chosen = SECS_CABLE[j]; break; }
      }
      const eps = ((RHO_CU * 2 * seg.L * seg.I) / (chosen * seg.V)) * 100;
      const dvV = (RHO_CU * 2 * seg.L * seg.I) / chosen;
      const pLoss = (RHO_CU * 2 * seg.L * seg.I * seg.I) / chosen;
      const iz = IZ_TABLE[chosen] ?? 0;
      const izOk = iz >= izReq;
      return { sCalc, chosen, eps, dvV, pLoss, iz, izReq, izOk };
    });
    
    const totalDv = segData[0].eps + segData[1].eps;
    
    autoTable(doc, {
      startY: y,
      head: [["Segment", "L (m)", "I (A)", "S_calc (mm2)", "S_choisie (mm2)", "Delta V (%)", "Iz (A)", "Iz OK", "Pertes (W)"]],
      body: segData.map((s, idx) => [
        segs[idx].name,
        segs[idx].L.toString(),
        segs[idx].I.toFixed(2),
        s.sCalc.toFixed(2),
        s.chosen.toString(),
        s.eps.toFixed(2) + (s.eps <= 3 ? "" : " ***"),
        s.iz.toString(),
        s.izOk ? "OK" : "NON",
        s.pLoss.toFixed(2),
      ]),
      theme: "striped",
      headStyles: { fillColor: [255, 102, 0], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [255, 242, 230] },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { halign: "center" },
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "center", fontStyle: "bold" },
        5: { halign: "center" },
        6: { halign: "center" },
        7: { halign: "center", fontStyle: "bold" },
        8: { halign: "center" },
      },
      margin: { left: margin, right: margin },
    });
    y = ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    
    // Total chute de tension
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text(`Chute de tension totale (Module -> Armoire): ${totalDv.toFixed(2)}%`, margin, y);
    y += 10;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 5: COMPATIBILITE MPPT - PAR SITE
  // ═══════════════════════════════════════════════════════════════════════════════
  if (y > 150) { doc.addPage(); y = 20; }
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...DARK);
  doc.text("6. COMPATIBILITE MPPT - PAR SITE", margin, y);
  y += 7;
  doc.setDrawColor(...BRAND_ORANGE);
  doc.line(margin, y, pageW - margin, y);
  y += 8;
  
  const VOC_DEF = 41.78;
  const ISC_DEF = 14.07;
  const K_VOC = 1.15;
  const K_ISC = 1.25;
  const V_MAX_MPPT = 200;
  
  const SITE_MPPT_MODEL: Record<string, string> = {
    BVS1: "GS-MPPT-100M", BVS2: "GS-MPPT-80M", TA: "GS-MPPT-100M",
  };
  
  const MPPT_SPECS: Record<string, { vmax: number; imax: number; label: string }> = {
    "GS-MPPT-100M": { vmax: 200, imax: 100, label: "Morning Star GS-MPPT-100M" },
    "GS-MPPT-80M":  { vmax: 200, imax: 80,  label: "Morning Star GS-MPPT-80M" },
  };
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const { pv, params } = result;
    const siteId = result.siteId;
    
    if (y > 200) { doc.addPage(); y = 20; }
    
    const ns = pv.seriesPerGroup;
    const np = pv.parallelStrings * params.groups;
    const model = SITE_MPPT_MODEL[siteId] ?? "GS-MPPT-100M";
    const specs = MPPT_SPECS[model];
    
    const vocMax = VOC_DEF * ns * K_VOC;
    const iscMax = ISC_DEF * np * K_ISC;
    const vocOk = vocMax <= V_MAX_MPPT;
    const iscOk = iscMax <= specs.imax;
    
    // En-tete MPPT
    doc.setFillColor(255, 242, 230);
    doc.rect(margin, y - 3, pageW - 2*margin, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND_ORANGE);
    doc.text(`MPPT - ${siteId} (${model})`, margin + 3, y + 2);
    y += 12;
    
    autoTable(doc, {
      startY: y,
      head: [["Parametre", "Valeur", "Limite", "Statut"]],
      body: [
        ["Modules en serie (Ns)", ns.toString(), "-", "-"],
        ["Chaines en parallele (Np)", np.toString(), "-", "-"],
        ["Voc max (Voc x Ns x " + K_VOC + ")", vocMax.toFixed(2) + " V", V_MAX_MPPT + " V", vocOk ? "CONFORME" : "DANGER"],
        ["Isc max (Isc x Np x " + K_ISC + ")", iscMax.toFixed(2) + " A", specs.imax + " A", iscOk ? "CONFORME" : "DANGER"],
      ],
      theme: "striped",
      headStyles: { fillColor: [255, 102, 0], textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [255, 242, 230] },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: "bold" },
        1: { halign: "center" },
        2: { halign: "center" },
        3: { halign: "center", fontStyle: "bold" },
      },
      margin: { left: margin, right: margin },
    });
    y = ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ── Pied de page sur toutes les pages ──────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(
      `SONATRACH DC-EPM — Projet REB GPL Ligne | Préparé par: Mohamed ADDA | Page ${i}/${pageCount}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 7,
      { align: "center" }
    );
  }

  // Add logo at the end - last page
  try {
    const logoPath = "public/icon/REB LIGNE GPL.svg";
    doc.addPage();
    const lastPageH = doc.internal.pageSize.getHeight();
    doc.setFillColor(...BRAND_ORANGE);
    doc.rect(0, lastPageH - 50, pageW, 50, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("SONATRACH", margin, lastPageH - 30);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Direction Centrale - Engineering & Project Management", margin, lastPageH - 22);
    doc.text("Projet ligne d'expédition GPL 14\" - RHOURDE EL BAGUEL", margin, lastPageH - 14);
  } catch (e) {
    console.log("Logo not added:", e);
  }

  // Nom du fichier avec date
  const fileName = projectName 
    ? `REB-GPL-PV-${projectName.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
    : `REB-GPL-PV-Dimensionnement-${new Date().toISOString().slice(0, 10)}.pdf`;
    
  doc.save(fileName);
}

// Excel Export function - Professional layout with brand colors
export function generateExcel(results: SiteResult[], projectName?: string): void {
  const wb = XLSX.utils.book_new();
  
  // Brand colors
  const ORANGE = { r: 255, g: 102, b: 0 };
  const WHITE = { r: 255, g: 255, b: 255 };
  const DARK = { r: 30, g: 20, b: 10 };
  const LIGHT_GRAY = { r: 243, g: 244, b: 246 };
  // Helper for styled cell
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sc = (v: any, bold: any = false, bg: any = null, fc: any = DARK) => ({
    v,
    s: {
      font: { bold, color: { rgb: fc === DARK ? '1E1414' : 'FFFFFF' } },
      fill: bg ? { fgColor: { rgb: bg === ORANGE ? 'FF6600' : 'F3F4F6' } } : undefined,
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { left: { style: 'thin', color: { rgb: 'E5E7EB' } }, right: { style: 'thin', color: { rgb: 'E5E7EB' } }, top: { style: 'thin', color: { rgb: 'E5E7EB' } }, bottom: { style: 'thin', color: { rgb: 'E5E7EB' } } },
    },
  });
  
  // ═══ FEUILLE 1: RÉSUMÉ ═══
  const r1: any[][] = [];
  r1.push([sc("SONATRACH", true, ORANGE, WHITE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE)]);
  r1.push([sc("Projet: REB GPL LIGNE - Rhourde El Baguel", true), sc(""), sc(""), sc(""), sc("")]);
  r1.push([sc(`Date: ${new Date().toLocaleDateString('fr-FR')}`, false), sc(""), sc(""), sc(""), sc("")]);
  r1.push([sc(""), sc(""), sc(""), sc(""), sc("")]);
  r1.push([sc("RÉSUMÉ DU DIMENSIONNEMENT", true, ORANGE, WHITE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE)]);
  r1.push([sc(""), sc(""), sc(""), sc(""), sc("")]);
  
  // Table header
  r1.push([sc("Site", true, LIGHT_GRAY), sc("Énergie (Wh/j)", true, LIGHT_GRAY), sc("Puissance PV (kWp)", true, LIGHT_GRAY), sc("Modules", true, LIGHT_GRAY), sc("Capacité Batt (Ah)", true, LIGHT_GRAY)]);
  
  // Data rows
  results.forEach((r, i) => {
    const bg = i % 2 === 0 ? null : LIGHT_GRAY;
    r1.push([sc(r.siteId, true, bg, ORANGE), sc(Math.round(r.correctedEnergyLoad), false, bg), sc((r.pv.actualPvPower / 1000).toFixed(2), false, bg), sc(r.pv.totalModules, false, bg), sc(Math.round(r.battery.actualCapacityAh), false, bg)]);
  });
  
  r1.push([sc(""), sc(""), sc(""), sc(""), sc("")]);
  
  // Parameters
  r1.push([sc("PARAMÈTRES", true, ORANGE, WHITE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE)]);
  if (results[0]) {
    const p = results[0].params;
    r1.push([sc("PSH", true), sc(`${p.psh} h/jour`), sc(""), sc(""), sc("")]);
    r1.push([sc("PR", true), sc(p.pr.toString()), sc(""), sc(""), sc("")]);
    r1.push([sc("Autonomie", true), sc(`${p.autonomy} jours`), sc(""), sc(""), sc("")]);
    r1.push([sc("DOD", true), sc(`${(p.dod * 100).toFixed(0)}%`), sc(""), sc(""), sc("")]);
    r1.push([sc("Tension", true), sc(`${p.systemVoltage}V DC`), sc(""), sc(""), sc("")]);
  }
  
  const ws1 = XLSX.utils.aoa_to_sheet(r1);
  ws1['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 18 }];
  ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } }, { s: { r: 4, c: 0 }, e: { r: 4, c: 4 } }, { s: { r: 10, c: 0 }, e: { r: 10, c: 4 } }];
  XLSX.utils.book_append_sheet(wb, ws1, "Résumé");
  
  // ═══ FEUILLE 2: SYSTÈME PV ═══
  const r2: any[][] = [];
  r2.push([sc("DÉTAIL SYSTÈME PHOTOVOLTAÏQUE", true, ORANGE, WHITE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE)]);
  r2.push([sc(""), sc(""), sc(""), sc(""), sc(""), sc("")]);
  r2.push([sc("Site", true, LIGHT_GRAY), sc("P_req (Wp)", true, LIGHT_GRAY), sc("P_inst (Wp)", true, LIGHT_GRAY), sc("Modules", true, LIGHT_GRAY), sc("Série", true, LIGHT_GRAY), sc("Parallèle", true, LIGHT_GRAY)]);
  
  results.forEach((r, i) => {
    const bg = i % 2 === 0 ? null : LIGHT_GRAY;
    r2.push([sc(r.siteId, true, bg, ORANGE), sc(Math.round(r.pv.pvRequiredWp), false, bg), sc(Math.round(r.pv.actualPvPower), false, bg), sc(r.pv.totalModules, false, bg), sc(r.pv.seriesPerGroup, false, bg), sc(r.pv.parallelStrings, false, bg)]);
  });
  
  const ws2 = XLSX.utils.aoa_to_sheet(r2);
  ws2['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
  XLSX.utils.book_append_sheet(wb, ws2, "Système PV");
  
  // ═══ FEUILLE 3: BATTERIES ═══
  const r3: any[][] = [];
  r3.push([sc("DÉTAIL PARC BATTERIES", true, ORANGE, WHITE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE)]);
  r3.push([sc(""), sc(""), sc(""), sc(""), sc(""), sc(""), sc("")]);
  r3.push([sc("Site", true, LIGHT_GRAY), sc("Capacité (Ah)", true, LIGHT_GRAY), sc("Énergie (Wh)", true, LIGHT_GRAY), sc("Cellules Série", true, LIGHT_GRAY), sc("Branches", true, LIGHT_GRAY), sc("Total", true, LIGHT_GRAY), sc("Config", true, LIGHT_GRAY)]);
  
  results.forEach((r, i) => {
    const bg = i % 2 === 0 ? null : LIGHT_GRAY;
    r3.push([sc(r.siteId, true, bg, ORANGE), sc(Math.round(r.battery.actualCapacityAh), false, bg), sc(Math.round(r.battery.actualCapacityWh), false, bg), sc(r.battery.cellsInSeries, false, bg), sc(r.battery.parallelBranches, false, bg), sc(r.battery.totalCells, false, bg), sc(r.battery.configLabel, false, bg)]);
  });
  
  const ws3 = XLSX.utils.aoa_to_sheet(r3);
  ws3['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 20 }];
  ws3['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
  XLSX.utils.book_append_sheet(wb, ws3, "Batteries");
  
  // ═══ FEUILLE 4: BILAN DE PUISSANCE ═══
  const r4: any[][] = [];
  r4.push([sc("BILAN DE PUISSANCE", true, ORANGE, WHITE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE)]);
  r4.push([sc(""), sc(""), sc(""), sc(""), sc("")]);
  
  results.forEach((r) => {
    const pLoad = r.correctedEnergyLoad;
    const pLoadAvg = pLoad / 24;
    const pPvNet = r.pv.actualPvPower * r.params.pr;
    const daysToFull = r.battery.actualCapacityWh / pLoad;
    
    r4.push([sc(`Site: ${r.siteId}`, true, ORANGE, WHITE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE)]);
    r4.push([sc("Paramètre", true, LIGHT_GRAY), sc("Symbole", true, LIGHT_GRAY), sc("Valeur", true, LIGHT_GRAY), sc("Unité", true, LIGHT_GRAY), sc("Formule", true, LIGHT_GRAY)]);
    r4.push([sc("Énergie journalière", false, null), sc("E"), sc(Math.round(pLoad)), sc("Wh/j"), sc("")]);
    r4.push([sc("Puissance moyenne", false, null), sc("P_moy"), sc(pLoadAvg.toFixed(1)), sc("W"), sc("E / 24")]);
    r4.push([sc("Puissance PV installée", false, null), sc("P_pv"), sc(Math.round(r.pv.actualPvPower)), sc("Wp"), sc("")]);
    r4.push([sc("Puissance PV nette", false, null), sc("P_pv_net"), sc(Math.round(pPvNet)), sc("W"), sc("P_inst × PR")]);
    r4.push([sc("Capacité batterie", false, null), sc("C_batt"), sc(Math.round(r.battery.actualCapacityWh)), sc("Wh"), sc("")]);
    r4.push([sc("Jours autonomie", false, null), sc("N_jours"), sc(daysToFull.toFixed(1)), sc("jours"), sc("C / P_moy")]);
    r4.push([sc(""), sc(""), sc(""), sc(""), sc("")]);
  });
  
  const ws4 = XLSX.utils.aoa_to_sheet(r4);
  ws4['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws4, "Bilan Puissance");
  
  // ═══ FEUILLE 5: TEMPS DE RECHARGE ═══
  const r5: any[][] = [];
  r5.push([sc("TEMPS DE RECHARGE DES BATTERIES", true, ORANGE, WHITE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE)]);
  r5.push([sc(""), sc(""), sc(""), sc(""), sc("")]);
  
  results.forEach((r) => {
    r5.push([sc(`Site: ${r.siteId}`, true, ORANGE, WHITE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE)]);
    r5.push([sc("PSH (h/j)", true, LIGHT_GRAY), sc("E_pv (Wh/j)", true, LIGHT_GRAY), sc("Echarge (Wh)", true, LIGHT_GRAY), sc("Surplus", true, LIGHT_GRAY), sc("Jours", true, LIGHT_GRAY)]);
    
    const rech = calculateRecharge(r);
    rech.scenarios.forEach((s, i) => {
      const bg = i % 2 === 0 ? null : LIGHT_GRAY;
      r5.push([sc(s.sunHours, false, bg), sc(Math.round(s.ePvJ), false, bg), sc(Math.round(s.eLoadDuringPSH), false, bg), sc(s.eRechargeJ > 0 ? "+" + Math.round(s.eRechargeJ) : Math.round(s.eRechargeJ), false, bg), sc(s.daysToRecharge?.toFixed(2) || "N/A", true, bg, ORANGE)]);
    });
    r5.push([sc(""), sc(""), sc(""), sc(""), sc("")]);
  });
  
  const ws5 = XLSX.utils.aoa_to_sheet(r5);
  ws5['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws5, "Temps Recharge");
  
  // ═══ FEUILLE 6: PARAMÈTRES ═══
  const r6: any[][] = [];
  r6.push([sc("PARAMÈTRES D'ENTRÉE", true, ORANGE, WHITE), sc("", ORANGE), sc("", ORANGE), sc("", ORANGE)]);
  r6.push([sc(""), sc(""), sc(""), sc("")]);
  r6.push([sc("Paramètre", true, LIGHT_GRAY), sc("BVS1", true, LIGHT_GRAY), sc("BVS2", true, LIGHT_GRAY), sc("TA", true, LIGHT_GRAY)]);
  
  const paramRows = [
    ["Énergie (Wh/j)", "energyLoad"],
    ["PSH (h/j)", "psh"],
    ["PR", "pr"],
    ["Module (Wp)", "modulePower"],
    ["Groupes", "groups"],
    ["Autonomie (jours)", "autonomy"],
    ["DOD", "dod"],
    ["Tension (V)", "systemVoltage"],
    ["Capacité (Ah)", "unitaryBatteryCapacity"],
  ];
  
  paramRows.forEach((row, i) => {
    const bg = i % 2 === 0 ? null : LIGHT_GRAY;
    const key = row[1] as keyof typeof results[0]['params'];
    r6.push([
      sc(row[0], true, bg),
      sc(results[0] ? String(results[0].params[key] ?? "-") : "-", false, bg),
      sc(results[1] ? String(results[1].params[key] ?? "-") : "-", false, bg),
      sc(results[2] ? String(results[2].params[key] ?? "-") : "-", false, bg),
    ]);
  });
  
  const ws6 = XLSX.utils.aoa_to_sheet(r6);
  ws6['!cols'] = [{ wch: 22 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  ws6['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  XLSX.utils.book_append_sheet(wb, ws6, "Paramètres");

  // ═══ FEUILLE 7: CABLES PV ═══
  const RHOC = 0.02314, EPS = 0.03, IMP = 13.33, ISC = 14.07, VMP = 41.64;
  const SECS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
  const IZ: Record<number, number> = {1.5:20,2.5:27,4:36,6:47,10:66,16:88,25:117,35:146,50:177,70:226,95:274,120:318,150:363,185:415,240:489};
  const r7: any[][] = [];
  r7.push([sc("CABLES PV", true, ORANGE, WHITE), sc(""), sc(""), sc(""), sc(""), sc(""), sc(""), sc("")]);
  r7.push([sc(""), sc(""), sc(""), sc(""), sc(""), sc(""), sc(""), sc("")]);
  r7.push([sc("Site", true, LIGHT_GRAY), sc("Segment", true, LIGHT_GRAY), sc("L(m)", true, LIGHT_GRAY), sc("I(A)", true, LIGHT_GRAY), sc("S_calc", true, LIGHT_GRAY), sc("S_choisie", true, LIGHT_GRAY), sc("DV%", true, LIGHT_GRAY), sc("IzOK", true, LIGHT_GRAY)]);
  results.forEach(r => {
    const np = r.pv.parallelStrings * r.params.groups;
    const vM = VMP * r.pv.seriesPerGroup, vS = r.params.systemVoltage;
    const segs = [{n:"M->BJ",L:3,I:IMP,V:vM,Is:ISC},{n:"BJ->Arm",L:30,I:IMP*np,V:vM,Is:ISC*np},{n:"B->Arm",L:8,I:100,V:vS,Is:ISC*np}];
    segs.forEach(s => {
      const sCalc = (RHOC * 2 * s.L * s.I) / (EPS * s.V);
      const izr = 1.25 * s.Is;
      const bi = SECS.findIndex(x => x >= sCalc);
      const st = bi === -1 ? SECS.length - 1 : bi;
      let ch = SECS[st];
      for(let j=st;j<SECS.length;j++){ if((IZ[SECS[j]]??0)>=izr){ ch=SECS[j]; break; } }
      const dv = ((RHOC * 2 * s.L * s.I) / (ch * s.V)) * 100;
      const iz = IZ[ch] ?? 0;
      const ok = iz >= izr;
      r7.push([sc(r.siteId, true, null, ORANGE), sc(s.n), sc(s.L), sc(s.I.toFixed(2)), sc(sCalc.toFixed(2)), sc(ch.toString(),true), sc(dv.toFixed(2)), sc(ok?"OK":"NON",true)]);
    });
  });
  const ws7 = XLSX.utils.aoa_to_sheet(r7);
  ws7["!cols"] = [{wch:10},{wch:15},{wch:8},{wch:10},{wch:10},{wch:12},{wch:10},{wch:10}];
  XLSX.utils.book_append_sheet(wb, ws7, "Cables PV");

  // ═══ FEUILLE 8: MPPT ═══
  const VOC=41.78,KVO=1.15,VMAX=200;
  const MPTS: Record<string,string> = {BVS1:"GS-MPPT-100M",BVS2:"GS-MPPT-80M",TA:"GS-MPPT-100M"};
  const r8: any[][] = [];
  r8.push([sc("MPPT", true, ORANGE, WHITE), sc(""), sc(""), sc(""), sc(""), sc("")]);
  r8.push([sc(""), sc(""), sc(""), sc(""), sc(""), sc("")]);
  r8.push([sc("Site", true, LIGHT_GRAY), sc("Modele", true, LIGHT_GRAY), sc("Ns", true, LIGHT_GRAY), sc("Np", true, LIGHT_GRAY), sc("VocMax", true, LIGHT_GRAY), sc("Statut", true, LIGHT_GRAY)]);
  results.forEach(r => {
    const ns=r.pv.seriesPerGroup, np=r.pv.parallelStrings*r.params.groups;
    const m = MPTS[r.siteId] ?? "GS-MPPT-100M";
    const vocMax = VOC * ns * KVO;
    const ok = vocMax <= VMAX;
    r8.push([sc(r.siteId, true, null, ORANGE), sc(m), sc(ns), sc(np), sc(vocMax.toFixed(2)), sc(ok?"OK":"DANGER",true)]);
  });
  const ws8 = XLSX.utils.aoa_to_sheet(r8);
  ws8["!cols"] = [{wch:10},{wch:18},{wch:8},{wch:8},{wch:12},{wch:12}];
  XLSX.utils.book_append_sheet(wb, ws8, "MPPT");
  
  // Save
  const fileName = projectName 
    ? `REB-GPL-PV-${projectName.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`
    : `REB-GPL-PV-Dimensionnement-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PDF — Rapport Vérificateur Section Câbles PV (GATECH REV I)
// ═══════════════════════════════════════════════════════════════════════════════
import type { CableCheckerInput, CableCheckerResult, GatechMpptInput, GatechMpptResult } from "./solar-calc.ts";
import { GATECH_MPPT_SPECS } from "./solar-calc.ts";

export function generateCablePDF(input: CableCheckerInput, result: CableCheckerResult): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;

  // En-tête
  doc.setFillColor(...BRAND_ORANGE);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("SONATRACH — REB GPL LINE", margin, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Rapport Vérificateur Section Câbles PV — GATECH REV I (2024-DO-SE-DOC-06)", margin, 20);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" }), pageW - margin, 20, { align: "right" });

  let y = 40;

  // Titre
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("VÉRIFICATION DE SECTION DE CÂBLES PV", margin, y);
  y += 8;
  doc.setDrawColor(...BRAND_ORANGE);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Formule
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_ORANGE);
  doc.text("Formule GATECH : S = (ρ × 2 × L × I) / (ε × U)", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`ρ = ${result.rho} Ω·mm²/m (${input.conductorType === "copper" ? "Cuivre" : "Aluminium"} à ${input.ambientTemp}°C) | ε = ${input.maxVoltageDrop}% | L = ${input.cableLength} m | U = ${input.systemVoltage} V`, margin, y);
  y += 10;

  // Paramètres d'entrée
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text("1. PARAMÈTRES D'ENTRÉE", margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    body: [
      ["Type de conducteur", input.conductorType === "copper" ? "Cuivre" : "Aluminium"],
      ["Résistivité ρ", `${result.rho} Ω·mm²/m`],
      ["Longueur câble (aller)", `${input.cableLength} m`],
      ["Courant Imp", `${input.iImp} A`],
      ["Courant Isc", `${input.iIsc} A`],
      ["Courant de calcul utilisé", `${input.currentType === "imp" ? "Imp" : "Isc"} = ${result.iCalc.toFixed(2)} A`],
      ["Tension système", `${input.systemVoltage} V`],
      ["Température ambiante", `${input.ambientTemp} °C`],
      ["Chute de tension maximale", `${input.maxVoltageDrop} %`],
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 65, textColor: [80, 80, 80] },
      1: { textColor: DARK },
    },
    margin: { left: margin, right: margin },
  });
  y = ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Résultats
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text("2. RÉSULTATS DE CALCUL", margin, y);
  y += 4;

  const globalOk = result.izStatus === "ok" && result.voltageDropStatus !== "danger";

  autoTable(doc, {
    startY: y,
    head: [["Paramètre", "Formule", "Valeur", "Statut"]],
    body: [
      ["Section minimale S_min", `(${result.rho} × 2 × ${input.cableLength} × ${result.iCalc.toFixed(2)}) / (${input.maxVoltageDrop / 100} × ${input.systemVoltage})`, `${result.sectionMin.toFixed(3)} mm²`, "—"],
      ["Section commerciale recommandée", "Normalisée ≥ S_min", `${result.sectionCommercial} mm²`, "✅"],
      ["Chute de tension ΔV", `ρ × 2L × I / S`, `${result.deltaVReal.toFixed(3)} V`, "—"],
      ["Chute de tension ΔV%", `(ΔV / ${input.systemVoltage}) × 100`, `${result.deltaVPercent.toFixed(2)} %`, result.voltageDropStatus === "ok" ? "✅ OK" : result.voltageDropStatus === "acceptable" ? "⚠️ Acceptable" : "❌ NON"],
      ["Pertes résistives P", `ρ × 2L × I² / S`, `${result.powerLoss.toFixed(2)} W`, "—"],
      [`Courant admissible Iz (${input.ambientTemp}°C)`, "Table UTE C15-100", `${result.iz} A`, "—"],
      ["Vérification Iz ≥ 1.25 × Isc", `${result.iz} ≥ ${(1.25 * input.iIsc).toFixed(2)}`, `${result.izCheck ? "CONFORME" : "NON CONFORME"}`, result.izCheck ? "✅ OK" : "❌ DANGER"],
    ],
    theme: "striped",
    headStyles: { fillColor: BRAND_ORANGE, textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: BRAND_LIGHT },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: "bold" },
      1: { cellWidth: 55, textColor: GRAY, fontSize: 8 },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: "auto", halign: "center", fontStyle: "bold" },
    },
    margin: { left: margin, right: margin },
  });
  y = ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Verdict
  doc.setFillColor(globalOk ? 34 : 220, globalOk ? 197 : 38, globalOk ? 94 : 38);
  doc.rect(margin, y, pageW - 2 * margin, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(
    globalOk ? "✅ CÂBLAGE CONFORME — Section et courant admissible validés" : "❌ NON CONFORME — Revoir la section ou le type de câble",
    pageW / 2, y + 7.5, { align: "center" }
  );

  // Pied de page
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(
    "SONATRACH DC-EPM — Projet REB GPL Ligne | Conforme GATECH REV I (2024-DO-SE-DOC-06)",
    pageW / 2, doc.internal.pageSize.getHeight() - 7, { align: "center" }
  );

  doc.save(`REB-GPL-Cables-PV-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PDF — Rapport Vérificateur MPPT GATECH
// ═══════════════════════════════════════════════════════════════════════════════

export function generateMpptPDF(input: GatechMpptInput, result: GatechMpptResult): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const specs = GATECH_MPPT_SPECS[input.model];

  // En-tête
  doc.setFillColor(...BRAND_ORANGE);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("SONATRACH — REB GPL LINE", margin, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Rapport Vérificateur Compatibilité MPPT — GATECH REV I (2024-DO-SE-DOC-06)", margin, 20);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" }), pageW - margin, 20, { align: "right" });

  let y = 40;

  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`VÉRIFICATION COMPATIBILITÉ MPPT — ${input.model}`, margin, y);
  y += 8;
  doc.setDrawColor(...BRAND_ORANGE);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Critères
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_ORANGE);
  doc.text(`Critères GATECH : Vstring = Voc × ${input.kVoc} × Ns ≤ ${specs.vmaxInput} V  |  Itotal = Isc × ${input.kIsc} × Np ≤ ${specs.imaxInput} A`, margin, y);
  y += 10;

  // Paramètres
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text("1. PARAMÈTRES D'ENTRÉE", margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    body: [
      ["Modèle régulateur", specs.label],
      ["Tension max entrée", `${specs.vmaxInput} V`],
      ["Courant max entrée", `${specs.imaxInput} A`],
      ["Modules en série (Ns)", `${input.nSeries}`],
      ["Chaînes en parallèle (Np)", `${input.nParallel}`],
      ["Voc module (STC)", `${input.voc} V`],
      ["Isc module (STC)", `${input.isc} A`],
      ["Coefficient sécurité tension kVoc", `${input.kVoc}`],
      ["Coefficient sécurité courant kIsc", `${input.kIsc}`],
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 65, textColor: [80, 80, 80] },
      1: { textColor: DARK },
    },
    margin: { left: margin, right: margin },
  });
  y = ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Résultats
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text("2. RÉSULTATS DE VÉRIFICATION", margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Critère", "Formule", "Calculé", "Limite", "Statut"]],
    body: [
      [
        "Tension chaîne Vstring",
        `${input.voc} × ${input.kVoc} × ${input.nSeries}`,
        `${result.vstringMax.toFixed(2)} V`,
        `≤ ${result.vmaxAllowed} V`,
        result.voltageStatus === "ok" ? "✅ OK" : "❌ DANGER",
      ],
      [
        "Courant total Itotal",
        `${input.isc} × ${input.kIsc} × ${input.nParallel}`,
        `${result.itotalMax.toFixed(2)} A`,
        `≤ ${result.imaxAllowed} A`,
        result.currentStatus === "ok" ? "✅ OK" : "❌ DANGER",
      ],
      [
        "Ns max autorisé",
        `floor(${result.vmaxAllowed} / (${input.voc} × ${input.kVoc}))`,
        `${input.nSeries}`,
        `≤ ${result.maxSeriesAllowed}`,
        input.nSeries <= result.maxSeriesAllowed ? "✅ OK" : "❌ DANGER",
      ],
      [
        "Np max autorisé",
        `floor(${result.imaxAllowed} / (${input.isc} × ${input.kIsc}))`,
        `${input.nParallel}`,
        `≤ ${result.maxParallelAllowed}`,
        input.nParallel <= result.maxParallelAllowed ? "✅ OK" : "❌ DANGER",
      ],
      ["Marge tension", "—", `${result.voltageMargin.toFixed(1)} %`, "—", "—"],
      ["Marge courant", "—", `${result.currentMargin.toFixed(1)} %`, "—", "—"],
    ],
    theme: "striped",
    headStyles: { fillColor: BRAND_ORANGE, textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: BRAND_LIGHT },
    columnStyles: {
      0: { cellWidth: 45, fontStyle: "bold" },
      1: { cellWidth: 50, textColor: GRAY, fontSize: 8 },
      2: { cellWidth: 25, halign: "right" },
      3: { cellWidth: 25, halign: "center" },
      4: { cellWidth: "auto", halign: "center", fontStyle: "bold" },
    },
    margin: { left: margin, right: margin },
  });
  y = ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Verdict
  const ok = result.globalStatus === "ok";
  doc.setFillColor(ok ? 34 : 220, ok ? 197 : 38, ok ? 94 : 38);
  doc.rect(margin, y, pageW - 2 * margin, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(
    ok
      ? `✅ COMPATIBLE — Configuration ${input.nSeries}S × ${input.nParallel}P validée pour ${input.model}`
      : `❌ INCOMPATIBLE — Revoir la configuration (Ns ≤ ${result.maxSeriesAllowed}, Np ≤ ${result.maxParallelAllowed})`,
    pageW / 2, y + 8, { align: "center" }
  );

  // Pied de page
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(
    "SONATRACH DC-EPM — Projet REB GPL Ligne | Conforme GATECH REV I (2024-DO-SE-DOC-06)",
    pageW / 2, doc.internal.pageSize.getHeight() - 7, { align: "center" }
  );

  doc.save(`REB-GPL-MPPT-${input.model}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// COMBINED REPORT - Cables + MPPT + Excel
// ═══════════════════════════════════════════════════════════════════════════════

export function generateFullReport(
  cableInput: CableCheckerInput, 
  cableResult: CableCheckerResult
): void {
  // Generate combined PDF with both Cable and MPPT sections
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  
  // Header
  doc.setFillColor(...BRAND_ORANGE);
  doc.rect(0, 0, pageW, 35, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("SONATRACH", margin, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("REB GPL Line - Projet GPL 14", margin, 20);
  doc.setFontSize(11);
  doc.text("RAPPORT VERIFICATION COMPLET", pageW - margin, 12, { align: "right" });
  doc.text("Cables PV + MPPT", pageW - margin, 20, { align: "right" });
  doc.text(new Date().toLocaleDateString('fr-FR'), pageW - margin, 27, { align: "right" });
  
  let y = 45;
  
  // ===== SECTION 1: CABLES =====
  doc.setFillColor(...BRAND_LIGHT);
  doc.rect(margin, y - 3, pageW - 2*margin, 10, "F");
  doc.setFillColor(...BRAND_ORANGE);
  doc.rect(margin, y - 3, 4, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BRAND_ORANGE);
  doc.text("1. VERIFICATION CABLES PV", margin + 7, y + 3);
  
  y += 15;
  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  doc.text(`Section minimum: ${cableResult.sectionMin.toFixed(2)} mm²`, margin, y);
  y += 6;
  doc.text(`Section recommandee (juste au-dessus): ${cableResult.sectionCommercial} mm²`, margin, y);
  y += 6;
  doc.text(`Chute de tension: ${cableResult.deltaVPercent.toFixed(2)}% (${cableResult.deltaVReal.toFixed(3)} V)`, margin, y);
  y += 6;
  doc.text(`Pertes: ${cableResult.powerLoss.toFixed(2)} W`, margin, y);
  y += 6;
  doc.text(`Courant Iz: ${cableResult.iz} A @ ${cableInput.ambientTemp}°C`, margin, y);
  y += 6;
  
  const cableOk = cableResult.izStatus === "ok" && cableResult.voltageDropStatus !== "danger";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(cableOk ? 34 : 220, cableOk ? 197 : 38, cableOk ? 94 : 38);
  y += 6;
  doc.text(cableOk ? "CONFORME" : "NON CONFORME", margin, y);
  y += 15;
  
  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("SONATRACH DC-EPM | Conforme GATECH REV I", pageW/2, 285, { align: "center" });
  
  doc.save(`REB-GPL-Rapport-Complet-${new Date().toISOString().slice(0, 10)}.pdf`);
  
  // Also generate Excel
  generateCableExcel(cableInput, cableResult);
}

// Excel Export for Cable Report
export function generateCableExcel(
  cableInput: CableCheckerInput, 
  cableResult: CableCheckerResult
): void {
  const wb = XLSX.utils.book_new();
  
  const data = [
    ["RAPPORT VERIFICATION CABLES PV - GATECH REV I"],
    [""],
    ["PARAMETRES D'ENTREE"],
    ["Type conducteur", cableInput.conductorType],
    ["Longueur cable (m)", cableInput.cableLength],
    ["Courant Imp (A)", cableInput.iImp],
    ["Courant Isc (A)", cableInput.iIsc],
    ["Courant reference", cableInput.currentType],
    ["Tension systeme (V)", cableInput.systemVoltage],
    ["Temperature (°C)", cableInput.ambientTemp],
    ["Chute max (%)", cableInput.maxVoltageDrop],
    [""],
    ["RESULTATS"],
    ["Section minimum calculee (mm²)", cableResult.sectionMin.toFixed(2)],
    ["Section commerciale recommandee (mm²)", cableResult.sectionCommercial],
    ["Chute de tension (V)", cableResult.deltaVReal.toFixed(3)],
    ["Chute de tension (%)", cableResult.deltaVPercent.toFixed(2)],
    ["Pertes resistives (W)", cableResult.powerLoss.toFixed(2)],
    ["Courant admissible Iz (A)", cableResult.iz],
    ["Statut Iz", cableResult.izStatus],
    ["Statut chute tension", cableResult.voltageDropStatus],
    [""],
    ["VERIFICATION"],
    ["Iz >= 1.25 x Isc", cableResult.izCheck ? "CONFORME" : "NON CONFORME"],
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Cables PV");
  
  XLSX.writeFile(wb, `REB-GPL-Cables-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
