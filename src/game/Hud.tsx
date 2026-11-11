import { useEffect, useMemo, useState } from "react";
import { Volume2, VolumeX, Sparkles as SparkIcon, Settings, RotateCcw, Coins, Home, Mountain, PawPrint, Shovel, Trees, Droplets, Axe, Package } from "lucide-react";
import { dismissCelebration, toggleSound, resetGame, resetPrices, setPrice, DEFAULT_PRICES, type Buildable, levelFromXp, loadSnapshot, setTool, snapshot, tickIncome, useGame, type Tool } from "./store";
import { localAdapter } from "./persistence";

const TOOLS: { id: Exclude<Tool, null>; label: string; icon: typeof Trees; hint: string }[] = [
  { id: "tree", label: "Árvore", icon: Trees, hint: "Clique na grama para plantar" },
  { id: "rock", label: "Pedra", icon: Mountain, hint: "Clique para posicionar uma rocha" },
  { id: "house", label: "Casa", icon: Home, hint: "Construa em terreno livre" },
  { id: "lake", label: "Lago", icon: Droplets, hint: "Escave em solo elevado" },
  { id: "animal", label: "Animal", icon: PawPrint, hint: "Solte um animal na ilha" },
  { id: "remove", label: "Remover", icon: Axe, hint: "Clique num objeto para recuperar moedas" },
];


export function Hud() {
  const objects = useGame((s) => s.objects);
  const lakes = useGame((s) => s.lakes);
  const res = useGame((s) => s.resources);
  const xp = useGame((s) => s.xp);
  const tool = useGame((s) => s.tool);
  const message = useGame((s) => s.message);
  const lvl = levelFromXp(xp);
  const celebration = useGame((s) => s.celebration);
  const sound = useGame((s) => s.sound);
  const prices = useGame((s) => s.prices);
  const [panel, setPanel] = useState(false);
  useEffect(() => {
    if (celebration && sound) playChime();
  }, [celebration, sound]);

  const counts = useMemo(() => {
    const c = { trees: 0, animals: 0, houses: 0, rocks: 0 };
    for (const o of objects) {
      if (o.kind === "tree" || o.kind === "palm") c.trees++;
      else if (o.kind === "animal") c.animals++;
      else if (o.kind === "house") c.houses++;
      else c.rocks++;
    }
    return c;
  }, [objects]);

  // Load once, then income + autosave.
  useEffect(() => {
    localAdapter.load().then((s) => s && loadSnapshot(s));
    const inc = setInterval(tickIncome, 3000);
    const save = setInterval(() => localAdapter.save(snapshot()), 5000);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setTool(null);
    window.addEventListener("keydown", esc);
    return () => (clearInterval(inc), clearInterval(save), window.removeEventListener("keydown", esc));
  }, []);

  const active = TOOLS.find((t) => t.id === tool);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 md:p-6">
      {/* Top */}
      <header className="hud-panel pointer-events-auto mx-auto flex w-full max-w-xl items-center gap-5 px-5 py-3">
        <h1 className="font-display text-2xl tracking-tight text-foreground">
          Ilha <span className="text-primary">Viva</span>
        </h1>
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-xs font-semibold text-muted-foreground">
            <span>Nível {lvl.level}</span>
            <span>
              {lvl.into}/{lvl.need} XP
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="hud-progress h-full rounded-full transition-all duration-500" style={{ width: `${lvl.progress * 100}%` }} />
          </div>
        </div>
        <button onClick={toggleSound} aria-label={sound ? "Desligar som" : "Ligar som"} className="text-muted-foreground hover:text-foreground">
          {sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </button>
      </header>

      {panel && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-foreground/20" onClick={() => setPanel(false)}>
          <div className="hud-panel w-72 p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-2xl text-foreground">Preços</h2>
            <p className="mb-3 text-xs text-muted-foreground">Em moedas. Remover devolve metade do preço.</p>
            {TOOLS.filter((t) => t.id !== "remove").map((t) => (
              <label key={t.id} className="flex items-center gap-2 py-1 text-sm">
                <t.icon className="h-4 w-4 text-primary" />
                <span className="flex-1 text-foreground">{t.label}</span>
                <input
                  type="number"
                  min={0}
                  value={prices[t.id as Buildable]}
                  onChange={(e) => setPrice(t.id as Buildable, Number(e.target.value))}
                  className="w-20 rounded-md border border-border bg-background px-2 py-1 text-right tabular-nums text-foreground"
                />
              </label>
            ))}
            <div className="mt-4 flex gap-2">
              <button onClick={resetPrices} className="hud-tool flex-1 py-2"><span className="text-xs font-semibold">Padrão</span></button>
              <button onClick={() => setPanel(false)} className="hud-tool flex-1 py-2" data-active><span className="text-xs font-semibold">Fechar</span></button>
            </div>
          </div>
        </div>
      )}

      {celebration && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center">
          <div className="hud-panel max-w-sm p-6 text-center">
            <SparkIcon className="mx-auto mb-2 h-8 w-8 text-primary" />
            <h2 className="font-display text-3xl text-foreground">Sua ilha cresceu!</h2>
            <p className="mt-1 text-sm text-muted-foreground">{celebration.title} — nível {celebration.level}</p>
            <ul className="mt-4 space-y-1 text-sm text-foreground">
              {celebration.features.map((f) => (
                <li key={f}>✦ {f}</li>
              ))}
            </ul>
            <button onClick={dismissCelebration} className="hud-tool mx-auto mt-5 px-6" data-active>
              <span className="text-sm font-semibold">Explorar</span>
            </button>
          </div>
        </div>
      )}

      {/* Side */}
      <aside className="hud-panel pointer-events-auto absolute left-4 top-1/2 hidden w-52 -translate-y-1/2 p-4 md:block">
        <p className="hud-label">Ilha</p>
        <Stat icon={Trees} label="Árvores" value={counts.trees} />
        <Stat icon={PawPrint} label="Animais" value={counts.animals} />
        <Stat icon={Home} label="Construções" value={counts.houses} />
        <Stat icon={Droplets} label="Lagos" value={lakes.length} />
        <div className="my-3 h-px bg-border" />
        <p className="hud-label">Recursos</p>
        <Stat icon={Coins} label="Moedas" value={res.coins} accent />
        <div className="mt-3 flex gap-2">
          <button onClick={() => setPanel(true)} className="hud-tool flex-1 !flex-row gap-1.5 py-2">
            <Settings className="h-4 w-4" />
            <span className="text-xs font-semibold">Preços</span>
          </button>
          <button
            onClick={() => {
              if (confirm("Começar uma ilha nova? Todo o progresso será perdido.")) {
                resetGame();
                localAdapter.save(snapshot());
              }
            }}
            className="hud-tool flex-1 !flex-row gap-1.5 py-2"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="text-xs font-semibold">Resetar</span>
          </button>
        </div>
      </aside>

      {/* Bottom */}
      <div className="flex flex-col items-center gap-3">
        {(message || active) && (
          <div className="hud-panel px-4 py-1.5 text-sm font-medium text-foreground">
            {message ?? active?.hint}
          </div>
        )}
        <nav className="hud-panel pointer-events-auto flex gap-1.5 p-2">
          {TOOLS.map((t) => {
            const cost = t.id !== "remove" ? prices[t.id] : null;
            return (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                className="hud-tool"
                data-active={tool === t.id}
                aria-pressed={tool === t.id}
              >
                <t.icon className="h-5 w-5" />
                <span className="text-xs font-semibold">{t.label}</span>
                <span className="text-[10px] opacity-70">
                  {cost !== null ? `${cost} moedas` : "+ moedas"}
                </span>
              </button>
            );
          })}
          <button onClick={() => setTool(null)} className="hud-tool" data-active={tool === null} aria-label="Explorar">
            <Shovel className="h-5 w-5 rotate-180" />
            <span className="text-xs font-semibold">Explorar</span>
            <span className="text-[10px] opacity-70">Esc</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: typeof Trees; label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1 text-sm">
      <Icon className={accent ? "h-4 w-4 text-accent-foreground" : "h-4 w-4 text-primary"} />
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

/** Short synthesized achievement chime (C-E-G-C arpeggio). */
function playChime() {
  try {
    const ctx = new AudioContext();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.65);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {
    /* audio unavailable */
  }
}
