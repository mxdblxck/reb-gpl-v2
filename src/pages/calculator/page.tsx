import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Sun, Save, FileSpreadsheet, FileText, Info, AlertCircle, Shield } from "lucide-react";
import SiteParamsForm from "@/pages/calculator/_components/SiteParamsForm.tsx";
import SiteResultCard from "@/pages/calculator/_components/SiteResultCard.tsx";
import EnergyCharts from "@/pages/calculator/_components/EnergyCharts.tsx";
import EnergyLoadInput from "@/pages/calculator/_components/EnergyLoadInput.tsx";
import type { SiteParams, SiteResult } from "@/lib/solar-calc.ts";
import { SITES, getDefaultSiteParams, calculateSite, getSiteFullName } from "@/lib/solar-calc.ts";
import { generateSizingPDF, generateExcel } from "@/lib/pdf-export.ts";

// Local storage types
interface LocalProject {
  id: string;
  name: string;
  description?: string;
  notes?: string;
  sites: SiteParams[];
  updatedAt: string;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function loadProjects(): LocalProject[] {
  try {
    const stored = localStorage.getItem("solar_projects");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveProjects(projects: LocalProject[]): void {
  localStorage.setItem("solar_projects", JSON.stringify(projects));
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Use local storage instead of Convex
  const [projects, setProjects] = useState<LocalProject[]>(() => loadProjects());
  
  // Find current project by ID
  const project = id ? projects.find(p => p.id === id) : null;
  
  const [activeTab, setActiveTab] = useState("BVS1");
  const [applySimultaneity, setApplySimultaneity] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [siteParams, setSiteParams] = useState<Record<string, SiteParams>>(
    () => Object.fromEntries(SITES.map((sid) => [sid, getDefaultSiteParams(sid)]))
  );
  const [initialized, setInitialized] = useState(false);

  // Charger les données du projet une seule fois
  useEffect(() => {
    // If we have a project, load its data
    if (project && !initialized) {
      const map: Record<string, SiteParams> = Object.fromEntries(
        SITES.map((sid) => [sid, getDefaultSiteParams(sid)])
      );
      project.sites.forEach((s) => {
        map[s.siteId] = s;
      });
      setSiteParams(map);
      setInitialized(true);
    }
    // If no project (new project), just mark as initialized
    else if (!id && !initialized) {
      setInitialized(true);
    }
  }, [project, initialized, id]);

  const results: SiteResult[] = SITES.map((sid) =>
    calculateSite(siteParams[sid], applySimultaneity)
  ).filter((r) => r.params.energyLoad > 0);

  const handleEnergyChange = (siteId: string, wh: number) => {
    setSiteParams((prev) => ({
      ...prev,
      [siteId]: { ...prev[siteId], energyLoad: wh },
    }));
  };

  const handleParamsChange = (siteId: string, updated: SiteParams) => {
    setSiteParams((prev) => ({ ...prev, [siteId]: updated }));
  };

  const handleSave = () => {
    setIsSaving(true);
    try {
      const siteData = SITES.map((sid) => siteParams[sid]);
      
      if (id) {
        // Update existing project
        const updatedProjects = projects.map(p => 
          p.id === id 
            ? { ...p, sites: siteData, updatedAt: new Date().toISOString() }
            : p
        );
        setProjects(updatedProjects);
        saveProjects(updatedProjects);
        toast.success("Projet mis à jour.");
      } else {
        // Create new project
        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
        const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const newProject: LocalProject = {
          id: generateId(),
          name: `Nouvel Essai - ${dateStr} ${timeStr}`,
          sites: siteData,
          updatedAt: now.toISOString(),
        };
        const updatedProjects = [...projects, newProject];
        setProjects(updatedProjects);
        saveProjects(updatedProjects);
        toast.success("Essai créé!");
        // Navigate to dashboard
        navigate("/dashboard");
      }
    } catch {
      toast.error("Échec de la sauvegarde.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPDF = () => {
    if (results.length === 0) {
      toast.error("Veuillez saisir au moins une charge énergétique pour exporter.");
      return;
    }
    try {
      generateSizingPDF(results, project?.name);
      toast.success("Rapport PDF généré.");
    } catch {
      toast.error("Échec de la génération du PDF.");
    }
  };

  // Project not found (only when we have an ID but not in local storage)
  if (id && !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Projet introuvable.</p>
        <Button onClick={() => navigate("/calculator")} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Nouveau Projet
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* En-tête */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-2 sm:px-4 h-14 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="border border-border bg-transparent text-muted-foreground hover:bg-muted h-8 px-1.5 sm:px-2 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-primary rounded flex items-center justify-center shrink-0">
                  <Sun className="w-3 h-3 text-white" />
                </div>
                <span className="font-semibold text-sm text-foreground truncate max-w-[120px] sm:max-w-none">
                  {project ? project.name : "Nouvel Essai"}
                </span>
              </div>
              {project?.description && (
                <p className="text-[10px] text-muted-foreground truncate max-w-[120px] sm:max-w-none">
                  {project.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Button
              size="sm"
              onClick={handleExportPDF}
              className="h-8 gap-1 border border-border bg-transparent text-muted-foreground hover:bg-muted text-xs px-1.5 sm:px-2"
            >
              <FileText className="w-3.5 h-3.5 text-red-500" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (results.length === 0) {
                  toast.error("Veuillez saisir au moins une charge énergétique pour exporter.");
                  return;
                }
                try {
                  generateExcel(results, project?.name);
                  toast.success("Fichier Excel généré.");
                } catch {
                  toast.error("Échec de la génération du fichier Excel.");
                }
              }}
              className="h-8 gap-1 border border-border bg-transparent text-muted-foreground hover:bg-muted text-xs px-1.5 sm:px-2"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="h-8 gap-1 text-xs"
            >
              <Save className="w-3 h-3" />
              {isSaving ? "Sauvegarde..." : "Enregistrer"}
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-6">
        {/* Facteur de simultanéité */}
        <Card>
          <CardContent className="py-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div className="flex items-start gap-3">
                <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Facteur de simultanéité
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {applySimultaneity ? "x1.3 appliqué" : "x1.0"}
                </span>
                <Switch
                  checked={applySimultaneity}
                  onCheckedChange={setApplySimultaneity}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full flex-wrap h-9">
            {SITES.map((sid) => {
              const hasLoad = siteParams[sid].energyLoad > 0;
              return (
                <TabsTrigger key={sid} value={sid} className="flex-1 min-w-[70px]">
                  {sid}
                  {hasLoad && <span className="w-1.5 h-1.5 rounded-full bg-primary ml-1" />}
                </TabsTrigger>
              );
            })}
            <TabsTrigger value="comparison" className="flex-1 min-w-[70px]">
              Comparaison
            </TabsTrigger>
          </TabsList>

          {SITES.map((sid) => (
            <TabsContent key={sid} value={sid} className="mt-4 space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-white text-[10px] font-bold">{sid}</span>
                      </div>
                      <div>
                        <div className="font-semibold">{sid}</div>
                        <div className="text-xs font-normal text-muted-foreground">
                          {getSiteFullName(sid)}
                        </div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <EnergyLoadInput
                      siteId={sid}
                      totalWh={siteParams[sid].energyLoad}
                      onTotalChange={(wh) => handleEnergyChange(sid, wh)}
                      marginPercent={(siteParams[sid].margin || 0) * 100}
                      onModeChange={(mode) => {
                        // Set default margin: 0 for simple, 20% for detailed
                        const newMargin = mode === "detailed" ? 0.2 : 0;
                        setSiteParams(prev => ({
                          ...prev,
                          [sid]: { ...prev[sid], margin: newMargin }
                        }));
                      }}
                    />
                    
                    {/* Marge appliquée info - inside site card */}
                    {siteParams[sid].margin > 0 && siteParams[sid].energyLoad > 0 && (
                      <div className="flex items-center justify-between text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-md">
                        <span className="font-medium">Marge appliquée:</span>
                        <span className="font-bold">
                          +{(siteParams[sid].margin * 100).toFixed(0)}% = {(siteParams[sid].energyLoad * (1 + siteParams[sid].margin)).toFixed(0)} Wh/j
                        </span>
                      </div>
                    )}
                    
                    {/* Marge de sécurité - inside site card */}
                    <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
                      <CardContent className="py-2 px-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium text-foreground">
                              Marge de sécurité
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0 text-sm font-bold border-primary/30 text-primary hover:bg-primary/10"
                              onClick={() => {
                                const current = siteParams[sid].margin || 0;
                                const newMargin = Math.max(0, current - 0.05);
                                setSiteParams(prev => ({
                                  ...prev,
                                  [sid]: { ...prev[sid], margin: newMargin }
                                }));
                              }}
                            >
                              -
                            </Button>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={5}
                              value={Math.round((siteParams[sid].margin || 0) * 100)}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setSiteParams(prev => ({
                                  ...prev,
                                  [sid]: { ...prev[sid], margin: val / 100 }
                                }));
                              }}
                              className="h-7 w-14 text-sm text-center no-spinner border-primary/30"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0 text-sm font-bold border-primary/30 text-primary hover:bg-primary/10"
                              onClick={() => {
                                const current = siteParams[sid].margin || 0;
                                const newMargin = Math.min(1, current + 0.05);
                                setSiteParams(prev => ({
                                  ...prev,
                                  [sid]: { ...prev[sid], margin: newMargin }
                                }));
                              }}
                            >
                              +
                            </Button>
                            <span className="text-sm font-bold text-primary">
                              %
                            </span>
                            {siteParams[sid].margin > 0 && siteParams[sid].energyLoad > 0 && (
                              <span className="text-xs text-primary ml-2">
                                → E = {(siteParams[sid].energyLoad * (1 + siteParams[sid].margin)).toFixed(0)} Wh/j
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <SiteParamsForm
                      params={siteParams[sid]}
                      onChange={(updated) => handleParamsChange(sid, updated)}
                    />
                  </CardContent>
                </Card>

                {siteParams[sid].energyLoad > 0 ? (
                  <>
                    <SiteResultCard
                      result={calculateSite(siteParams[sid], applySimultaneity)}
                    />
                  </>
                ) : (
                  <Card className="border-dashed border-border">
                    <CardContent className="py-10 flex flex-col items-center text-center gap-2">
                      <AlertCircle className="w-8 h-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        Saisir la charge énergétique journalière ci-dessus pour calculer le dimensionnement
                      </p>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            </TabsContent>
          ))}


          {/* Onglet Comparaison */}
          <TabsContent value="comparison" className="mt-4">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Comparaison des Sites
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Paramètre</th>
                          {SITES.map(sid => (
                            <th key={sid} className="text-center py-3 px-4 font-semibold bg-primary/5">
                              {sid}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: "Énergie (Wh/j)", fn: (r: SiteResult) => r.correctedEnergyLoad.toFixed(0) },
                          { label: "Puissance PV (Wp)", fn: (r: SiteResult) => r.pv.actualPvPower.toLocaleString() },
                          { label: "Modules PV", fn: (r: SiteResult) => String(r.pv.totalModules) },
                          { label: "Config PV", fn: (r: SiteResult) => r.pv.configLabel },
                          { label: "Capacité Batterie (Ah)", fn: (r: SiteResult) => r.battery.actualCapacityAh.toLocaleString() },
                          { label: "Énergie Batterie (Wh)", fn: (r: SiteResult) => r.battery.actualCapacityWh.toLocaleString() },
                          { label: "Config Batterie", fn: (r: SiteResult) => r.battery.configLabel },
                          { label: "Total Cellules", fn: (r: SiteResult) => r.battery.totalCells.toLocaleString() },
                        ].map(({ label, fn }) => (
                          <tr key={label} className="border-b">
                            <td className="py-3 px-4 text-muted-foreground">{label}</td>
                            {SITES.map(sid => {
                              const r = results.find(r => r.siteId === sid);
                              return (
                                <td key={sid} className="text-center py-3 px-4 font-medium">
                                  {r ? fn(r) : "—"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {results.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Aucune donnée à comparer. Saisissez des charges énergétiques pour voir la comparaison.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>

        {results.length > 0 && <EnergyCharts results={results} />}

        {results.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Récapitulatif de Tous les Sites</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Site</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">E (Wh/j)</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Puissance PV</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Modules</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Config. PV</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Cap. Batterie</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Config. Batt.</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={r.siteId} className={`border-b border-border ${i % 2 === 0 ? "bg-muted/10" : ""}`}>
                      <td className="px-4 py-3 font-semibold text-primary">{r.siteId}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{r.correctedEnergyLoad.toFixed(0)}</td>
                      <td className="px-4 py-3 text-right font-medium">{(r.pv.actualPvPower / 1000).toFixed(2)} kWp</td>
                      <td className="px-4 py-3 text-right">{r.pv.totalModules}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{r.pv.configLabel}</td>
                      <td className="px-4 py-3 text-right font-medium">{r.battery.actualCapacityAh.toFixed(0)} Ah</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{r.battery.configLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {project?.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Notes d'Ingénierie</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground whitespace-pre-wrap">{project.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
