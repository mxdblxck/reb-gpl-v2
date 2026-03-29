import { useState, useId, useEffect } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Plus,
  Trash2,
  Zap,
  Table2,
  Hash,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type LoadItem = {
  id: string;
  name: string;
  power: number; // Watts
  hours: number; // h/j
  quantity: number;
};

type Props = {
  siteId: string;
  totalWh: number; // valeur contrôlée pour le mode simple
  onTotalChange: (wh: number) => void;
  marginPercent?: number; // Current margin percentage (0-100) - for display only
  onModeChange?: (mode: "simple" | "detailed") => void; // Callback when mode changes
};

// ── Charges prédéfinies par site ───────────────────────────────────────────────

// Charges spécifiques par site (issues des études de détails REB GPL)
const SITE_PRESETS: Record<string, { name: string; power: number; hours: number; quantity: number }[]> = {
  BVS1: [
    { name: "RTU cab – Alim. cont.", power: 136.8, hours: 24, quantity: 1 },
    { name: "RTU cab – Charge laptop", power: 150, hours: 1, quantity: 1 },
    { name: "TELECOM cab – Equip. 24h", power: 106.17, hours: 24, quantity: 1 },
    { name: "TELECOM cab – Ventilation", power: 60, hours: 6, quantity: 1 },
    { name: "TELECOM cab – Éclairage", power: 11, hours: 1, quantity: 1 },
    { name: "SDV-01 – Moteur", power: 392, hours: 0.1, quantity: 1 },
    { name: "SDV-01 – Électronique", power: 70, hours: 24, quantity: 1 },
    { name: "CPCU – Protec. cathodique", power: 240, hours: 24, quantity: 1 },
    { name: "L.BATT & AUX – Extract. + Écl.", power: 200, hours: 1, quantity: 1 },
  ],
  BVS2: [
    { name: "RTU cab – Alim. cont.", power: 136.8, hours: 24, quantity: 1 },
    { name: "RTU cab – Charge laptop", power: 150, hours: 1, quantity: 1 },
    { name: "TELECOM cab – Equip. 24h", power: 106.17, hours: 24, quantity: 1 },
    { name: "TELECOM cab – Ventilation", power: 60, hours: 6, quantity: 1 },
    { name: "TELECOM cab – Éclairage", power: 11, hours: 1, quantity: 1 },
    { name: "SDV-02 – Moteur", power: 392, hours: 0.1, quantity: 1 },
    { name: "SDV-02 – Électronique", power: 70, hours: 24, quantity: 1 },
    { name: "L.BATT & AUX – Extract. + Écl.", power: 200, hours: 1, quantity: 1 },
  ],
  TA: [
    { name: "RTU cab – Alim. cont.", power: 178.9, hours: 24, quantity: 1 },
    { name: "RTU cab – Charge laptop", power: 150, hours: 1, quantity: 1 },
    { name: "TELECOM cab – Equip. 24h", power: 114.99, hours: 24, quantity: 1 },
    { name: "TELECOM cab – Ventilation", power: 60, hours: 6, quantity: 1 },
    { name: "TELECOM cab – Éclairage", power: 11, hours: 1, quantity: 1 },
    { name: "CPCU – Protec. cathodique", power: 240, hours: 24, quantity: 1 },
    { name: "SDV-02 – Moteur", power: 392, hours: 0.1, quantity: 1 },
    { name: "SDV-02 – Électronique", power: 70, hours: 24, quantity: 1 },
    { name: "SDV-03 – Moteur", power: 392, hours: 0.1, quantity: 1 },
    { name: "SDV-03 – Électronique", power: 70, hours: 24, quantity: 1 },
    { name: "SDV-04 – Moteur", power: 414, hours: 0.1, quantity: 1 },
    { name: "SDV-04 – Électronique", power: 70, hours: 24, quantity: 1 },
    { name: "SDV-05 – Moteur", power: 414, hours: 0.1, quantity: 1 },
    { name: "SDV-05 – Électronique", power: 70, hours: 24, quantity: 1 },
    { name: "SKID-COMP – Comptage", power: 196.81, hours: 24, quantity: 1 },
    { name: "D-M – Filtration + Débitm.", power: 18, hours: 24, quantity: 1 },
    { name: "L.BATT & AUX – Extract. + Écl.", power: 200, hours: 1, quantity: 1 },
  ],
};

// Obtenir les charges prédéfinies pour un site
function getPresetsForSite(siteId: string) {
  return SITE_PRESETS[siteId] || [];
}

function newItem(): LoadItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    power: 0,
    hours: 24,
    quantity: 1,
  };
}

function calcEnergy(item: LoadItem): number {
  return item.power * item.hours * item.quantity;
}

// ── Composant Principal ────────────────────────────────────────────────────────

export default function EnergyLoadInput({ 
  siteId, 
  totalWh, 
  onTotalChange,
  marginPercent: marginPercentProp = 0,
  onModeChange,
}: Props) {
  const [mode, setMode] = useState<"simple" | "detailed">("simple");
  const [items, setItems] = useState<LoadItem[]>([newItem()]);
  const [showPresets, setShowPresets] = useState(false);
  const [marginInputValue, setMarginInputValue] = useState<string>(marginPercentProp.toString());
  const labelId = useId();

  // Get margin from props (controlled by parent)
  const marginPercent = marginPercentProp;

  // Sync margin input value when prop changes
  useEffect(() => {
    setMarginInputValue(marginPercentProp.toString());
  }, [marginPercentProp]);

  // Total mode détaillé (base without margin)
  const detailedTotal = items.reduce((sum, it) => sum + calcEnergy(it), 0);
  
  // Report base total to parent (without margin) - let solar-calc handle margin
  useEffect(() => {
    if (detailedTotal > 0) {
      onTotalChange(detailedTotal);
    }
  }, [detailedTotal]);

  // Lors du passage en mode simple depuis le mode détaillé, synchroniser le total
  const handleModeChange = (v: string) => {
    const next = v as "simple" | "detailed";
    setMode(next);
    // Notify parent of mode change
    if (onModeChange) {
      onModeChange(next);
    }
  };

  // Mettre à jour un champ d'une ligne de charge
  const updateItem = (id: string, field: keyof LoadItem, value: string | number) => {
    setItems((prev) => {
      const updated = prev.map((it) => {
        if (it.id !== id) return it;
        if (field === "name") return { ...it, name: value as string };
        const num = typeof value === "number" ? value : parseFloat(value as string);
        return { ...it, [field]: isNaN(num) ? 0 : num };
      });
      // Don't call onTotalChange here - the useEffect will handle it
      return updated;
    });
  };

  const addItem = () => setItems((prev) => [...prev, newItem()]);

  const removeItem = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((it) => it.id !== id);
      // Don't call onTotalChange here - the useEffect will handle it
      return next.length === 0 ? [newItem()] : next;
    });
  };

  const addPreset = (preset: { name: string; power: number; hours: number; quantity: number }) => {
    const item: LoadItem = {
      id: crypto.randomUUID(),
      ...preset,
    };
    setItems((prev) => {
      // Supprimer le placeholder vide s'il n'y a qu'une seule ligne vide
      const cleaned =
        prev.length === 1 && prev[0].name === "" && prev[0].power === 0
          ? []
          : prev;
      const next = [...cleaned, item];
      const total = next.reduce((s, i) => s + calcEnergy(i), 0);
      onTotalChange(total);
      return next;
    });
    setShowPresets(false);
  };

  // Charger les charges prédéfinies du site
  const loadSitePresets = () => {
    const presets = getPresetsForSite(siteId);
    const newItems = presets.map(p => ({
      id: crypto.randomUUID(),
      name: p.name,
      power: p.power,
      hours: p.hours,
      quantity: p.quantity,
    }));
    setItems(newItems);
    const total = newItems.reduce((s, i) => s + calcEnergy(i), 0);
    onTotalChange(total);
  };

  // Obtenir les presets pour ce site
  const sitePresets = getPresetsForSite(siteId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label id={labelId} className="text-sm font-medium">
          Charge Énergétique Journalière —{" "}
          <span className="text-primary font-semibold">E (Wh/j)</span>
          <span className="text-destructive ml-1">*</span>
        </Label>
        {/* Sélecteur de mode */}
        <Tabs value={mode} onValueChange={handleModeChange}>
          <TabsList className="h-7 text-xs">
            <TabsTrigger value="simple" className="h-5 text-xs px-2 gap-1">
              <Hash className="w-3 h-3" />
              Simple
            </TabsTrigger>
            <TabsTrigger value="detailed" className="h-5 text-xs px-2 gap-1">
              <Table2 className="w-3 h-3" />
              Détaillé
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {mode === "simple" ? (
        /* ── Mode Simple ─────────────────────────────────────────────────────── */
        <div className="space-y-1.5">
          <div className="flex gap-3 items-center">
            <Input
              type="number"
              min={0}
              step={100}
              value={totalWh === 0 ? "" : totalWh}
              placeholder="ex. 12000"
              onChange={(e) => {
                const num = parseFloat(e.target.value);
                onTotalChange(isNaN(num) ? 0 : num);
              }}
              className="max-w-xs text-base font-semibold no-spinner"
              aria-labelledby={labelId}
            />
            <span className="text-sm text-muted-foreground">Wh/j</span>
          </div>
          {totalWh > 0 && (
            <p className="text-xs text-muted-foreground">
              ≈ {(totalWh / 1000).toFixed(3)} kWh/j
            </p>
          )}
        </div>
      ) : (
        /* ── Mode Détaillé ──────────────────────────────────────────────────── */
        <div className="space-y-3">
          {/* Présélections par site et boutons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={loadSitePresets}
              className="h-8 text-xs gap-1.5 bg-primary text-white hover:bg-primary/90 shadow-sm"
            >
              <Plus className="w-3 h-3" />
              ⚡ Charger charges {siteId}
            </Button>
            <Button
              size="sm"
              onClick={() => setShowPresets((v) => !v)}
              className="h-8 text-xs gap-1.5 border border-border bg-background text-foreground hover:bg-muted hover:border-primary/50"
            >
              <Plus className="w-3 h-3" />
              + Ajouter équipement
            </Button>
            <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">
              ou remplissez le tableau ci-dessous
            </span>
          </div>

          {showPresets && (
            <div className="flex flex-wrap gap-1.5 p-3 bg-muted/20 rounded-lg border border-border">
              {sitePresets.map((p) => (
                <Button
                  key={p.name}
                  size="sm"
                  onClick={() => addPreset(p)}
                  className="h-6 text-[11px] px-2 border border-border bg-background text-foreground hover:bg-primary/5 hover:border-primary/30"
                >
                  {p.name}
                </Button>
              ))}
            </div>
          )}

          {/* Tableau */}
          <div className="rounded-lg border border-border shadow-sm -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-2 py-2.5 text-xs font-semibold text-muted-foreground">
                    Charge / Équipement
                  </th>
                  <th className="text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground">
                    Puissance (W)
                  </th>
                  <th className="text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground">
                    Heures/j
                  </th>
                  <th className="text-right px-2 py-2.5 text-xs font-semibold text-primary">
                    Wh/j
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const energy = calcEnergy(item);
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-border last:border-0 hover:bg-primary/5 transition-colors ${i % 2 === 0 ? "" : "bg-muted/5"}`}
                    >
                      <td className="px-2 py-2">
                        <Input
                          value={item.name}
                          onChange={(e) => updateItem(item.id, "name", e.target.value)}
                          placeholder="Cliquez pour nommer..."
                          className="h-8 text-xs border border-border/50 bg-background focus:bg-background focus:border-primary rounded-md px-2 transition-all"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={item.power === 0 ? "" : item.power}
                          placeholder="0"
                          onChange={(e) => updateItem(item.id, "power", e.target.value)}
                          className="h-8 text-xs text-center border border-border/50 bg-background focus:bg-background focus:border-primary rounded-md no-spinner"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min={0}
                          max={24}
                          step={0.5}
                          value={item.hours}
                          onChange={(e) => updateItem(item.id, "hours", e.target.value)}
                          className="h-8 text-xs text-center border border-border/50 bg-background focus:bg-background focus:border-primary rounded-md no-spinner"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={`font-semibold text-xs px-2 py-1 rounded-md ${energy > 0 ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                        >
                          {energy > 0 ? energy.toFixed(0) : "—"}
                        </span>
                      </td>
                      <td className="px-1 py-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeItem(item.id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                          title="Supprimer cette charge"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Ligne total */}
              <tfoot>
                <tr className="bg-primary/5 border-t-2 border-primary/20">
                  <td
                    colSpan={3}
                    className="px-3 py-3 font-semibold text-sm text-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      Charge Énergétique Journalière Totale
                      {marginPercent > 0 && (
                        <span className="ml-1 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                          +{Math.round(marginPercent)}%
                        </span>
                      )}
                    </div>
                    {marginPercent > 0 && detailedTotal > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Base: {Math.round(detailedTotal)} Wh/j → Avec marge: {Math.round(detailedTotal * (1 + marginPercent / 100))} Wh/j
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-bold text-primary text-base">
                      {Math.round(detailedTotal)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      Wh/j
                    </span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Bouton d'ajout de ligne */}
          <Button
            size="sm"
            onClick={addItem}
            className="h-7 text-xs gap-1 border border-dashed border-primary/40 bg-transparent text-primary hover:bg-primary/5"
          >
            <Plus className="w-3 h-3" />
            Ajouter une ligne
          </Button>

          {/* Indication de synchronisation */}
          {detailedTotal > 0 && (
            <div className="mt-2 p-2 bg-muted/50 rounded-md">
              <p className="text-xs text-muted-foreground">
                Dimensionnement calculé avec{" "}
                <strong className="text-primary">{detailedTotal.toFixed(0)} Wh/j</strong>{" "}
                issu du tableau ci-dessus
              </p>
              {marginPercent > 0 && (
                <p className="text-xs text-primary font-medium mt-1">
                  +{Math.round(marginPercent)}% = <strong>{Math.round(detailedTotal * (1 + marginPercent / 100))} Wh/j</strong>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
