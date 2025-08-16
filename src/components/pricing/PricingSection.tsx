"use client";
import { useMemo, useState } from "react";

// PricingSection – Agente Virtual IA
// TailwindCSS-based, drop-in component for Next.js (App Router)
// - Planes: Core, Pro (destacado), Scale, Enterprise (contacto)
// - Toggle mensual/anual (-20%)
// - Micro-copy ROI + Add-ons + FAQs
// - CTAs: Iniciar Piloto 30 días (US$1,200 – descontable) & Hablar con un experto
//
// Cómo usar:
// 1) Copia este archivo a `components/pricing/PricingSection.tsx`.
// 2) En `app/precios/page.tsx` (o donde corresponda) importa y renderiza <PricingSection />.
// 3) Ajusta los href de los botones a tus rutas reales (checkout piloto, contacto, etc.).

export default function PricingSection() {
  const [annual, setAnnual] = useState(false);

  const plans = useMemo(() => {
    // precios base mensuales
    const monthly = {
      core: 699,
      pro: 1199,
      scale: 1999,
    } as const;
    const apply = (v: number) => (annual ? Math.round(v * 0.8) : v); // -20% anual

    return [
      {
        id: "core",
        name: "Core (Managed)",
        tagline: "Entrada seria para comenzar con 1–2 flujos",
        price: apply(monthly.core),
        original: monthly.core,
        features: [
          "6,000 ejecuciones/mes",
          "1 concurrencia",
          "Hasta 10 workflows activos",
          "3 h/mes de Automation Expert",
          "1 pack incluido (CC o Finanzas)",
          "Soporte email 8×5 • SLA 99.5%",
          "Seguridad: API Keys por flujo, Webhooks HMAC",
        ],
        overage: "$0.0025/ejec • Paquetes 10k=$25",
        popular: false,
        ctaPrimaryHref: "/checkout/piloto",
        ctaSecondaryHref: "/contacto",
      },
      {
        id: "pro",
        name: "Pro (Managed)",
        tagline: "El más popular: valor y escala con packs incluidos",
        price: apply(monthly.pro),
        original: monthly.pro,
        features: [
          "20,000 ejecuciones/mes",
          "2 concurrencias",
          "Hasta 40 workflows activos",
          "8 h/mes de Automation Expert",
          "2 packs incluidos (p.ej. CC + Finanzas)",
          "Soporte email+chat 8×5 • SLA 99.9%",
          "Dashboard ROI y Health alerts",
        ],
        overage: "$0.002/ejec • Paquetes 50k=$100",
        popular: true,
        ctaPrimaryHref: "/checkout/piloto",
        ctaSecondaryHref: "/contacto",
      },
      {
        id: "scale",
        name: "Scale (Managed)",
        tagline: "Para equipos exigentes y mayor volumen",
        price: apply(monthly.scale),
        original: monthly.scale,
        features: [
          "50,000 ejecuciones/mes",
          "4 concurrencias",
          "Hasta 120 workflows activos",
          "16 h/mes de Automation Expert",
          "2 packs + Performance Profiler",
          "Slack 24×5 • SLA 99.9%",
          "SSO básico + Auditoría avanzada",
        ],
        overage: "$0.0015/ejec • Paquetes 100k=$180",
        popular: false,
        ctaPrimaryHref: "/checkout/piloto",
        ctaSecondaryHref: "/contacto",
      },
    ];
  }, [annual]);

  return (
    <section className="w-full px-4 sm:px-6 lg:px-8 py-16 bg-gradient-to-b from-background to-muted/20 text-foreground">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="text-center mb-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Resultados en días, no meses — Horas de experto incluidas
          </p>
          <h1 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight">
            Planes Managed de Agente Virtual IA
          </h1>
          <p className="mt-3 text-muted-foreground">
            Sin plan gratis. Enfocados en operación real con ROI visible.
          </p>

          {/* Toggle billing */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <span className={`text-sm ${!annual ? "font-semibold" : "text-muted-foreground"}`}>
              Mensual
            </span>
            <button
              aria-label="Cambiar ciclo de facturación"
              onClick={() => setAnnual((v) => !v)}
              className="relative inline-flex h-7 w-13 items-center rounded-full bg-muted transition"
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-background transition ${
                  annual ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
            <span className={`text-sm ${annual ? "font-semibold" : "text-muted-foreground"}`}>
              Anual <span className="text-emerald-400">–20%</span>
            </span>
          </div>
        </header>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((p) => (
            <article
              key={p.id}
              className={`relative flex flex-col rounded-2xl border border-border bg-card p-6 shadow-lg ${
                p.popular ? "ring-2 ring-emerald-400" : ""
              }`}
            >
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-400 px-3 py-1 text-xs font-semibold text-black shadow">
                  Más popular
                </div>
              )}
              <h3 className="text-xl font-semibold text-card-foreground">{p.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>

              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-bold tracking-tight">
                  {typeof p.price === "number" ? `$${p.price}` : p.price}
                </span>
                {typeof p.price === "number" && (
                  <span className="mb-1 text-sm text-muted-foreground">/ mes</span>
                )}
              </div>
              {annual && (
                <p className="mt-1 text-xs text-emerald-600">
                  Ahorra 20% — antes ${p.original}/mes
                </p>
              )}

              <ul className="mt-6 space-y-2 text-sm">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400/90" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-xs text-muted-foreground">Overage blando: {p.overage}. Nunca se detiene tu operación; solo facturamos el extra.</p>

              <div className="mt-6 grid grid-cols-1 gap-3">
                <a
                  href={p.ctaPrimaryHref}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-black shadow transition hover:bg-emerald-300"
                >
                  Iniciar Piloto 30 días — US$1,200 (100% descontable)
                </a>
                <a
                  href={p.ctaSecondaryHref}
                  className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
                >
                  Hablar con un experto
                </a>
              </div>
            </article>
          ))}

          {/* Enterprise Card */}
          <article className="relative flex flex-col rounded-2xl border border-border bg-card p-6 shadow-lg md:col-span-3">
            <div className="md:flex md:items-start md:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-card-foreground">Enterprise Dedicado</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Instancia n8n aislada (dominio propio), data residency, MSA/DPA, SSO/SCIM, auditoría extendida.
                </p>
                <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-emerald-400/90" />Desde US$3,500/mes + Setup US$3k–8k</li>
                  <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-emerald-400/90" />100k+ ejecuciones incluidas • sobreuso $0.001/ejec</li>
                  <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-emerald-400/90" />20–40 h de implementación inicial + 8 h/mes continuas</li>
                  <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-emerald-400/90" />Soporte 24×7 P1 • SLA 99.9% con créditos</li>
                </ul>
              </div>
              <div className="mt-6 md:mt-0 md:text-right">
                <div className="text-3xl font-bold tracking-tight">Solicitar cotización</div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:justify-items-end">
                  <a href="/contacto" className="inline-flex items-center justify-center rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-black shadow transition hover:bg-emerald-300">
                    Hablar con Ventas Enterprise
                  </a>
                  <a href="/enterprise" className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted">
                    Ver capacidades Enterprise
                  </a>
                </div>
              </div>
            </div>
          </article>
        </div>

        {/* ROI Mini-calc */}
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h4 className="text-lg font-semibold text-card-foreground">Calcula tu ROI estimado</h4>
            <p className="mt-1 text-sm text-muted-foreground">Ingresa tus supuestos y estima ahorro mensual en horas y dinero.</p>
            <RoiCalc />
            <p className="mt-3 text-xs text-muted-foreground">*Cálculo referencial. Ajusta minutos y costo/hora a tu realidad. El dashboard del producto mostrará tu ROI real mes a mes.</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <h4 className="text-lg font-semibold text-card-foreground">Add-ons que impulsan tu operación</h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-emerald-400/90" />Packs verticales: CC Starter US$79–99/mes; Finanzas MX (CFDI/conciliación) US$99–129/mes; WhatsApp CSAT US$79/mes.</li>
              <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-emerald-400/90" />Paquetes de ejecuciones (90 días): 10k=$25 · 50k=$100 · 100k=$180.</li>
              <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-emerald-400/90" />Horas extra: 5h=$500 · 10h=$900 · 20h=$1,800.</li>
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">Horas incluidas no acumulables. Overage blando: sin cortes; se factura al cierre del periodo.</p>
          </div>
        </div>

        {/* Legal microcopy */}
        <p className="mt-10 text-center text-xs text-muted-foreground">
          Precios en USD. Descuento 20% aplicable en pago anual. Impuestos locales pueden aplicar.
        </p>
      </div>
    </section>
  );
}

function RoiCalc() {
  const [execs, setExecs] = useState(10000);
  const [mins, setMins] = useState(3);
  const [rate, setRate] = useState(12); // USD por hora

  const hoursSaved = useMemo(() => (execs * mins) / 60, [execs, mins]);
  const moneySaved = useMemo(() => Math.round(hoursSaved * rate), [hoursSaved, rate]);

  return (
    <div className="mt-4 grid gap-3">
      <div className="grid grid-cols-3 items-center gap-2">
        <label className="text-sm text-muted-foreground">Ejecuciones/mes</label>
        <input
          type="range"
          min={1000}
          max={100000}
          step={1000}
          value={execs}
          onChange={(e) => setExecs(parseInt(e.target.value))}
          className="col-span-2 accent-emerald-400"
        />
        <div className="col-span-3 text-right text-xs text-muted-foreground">{execs.toLocaleString()} ejec/mes</div>
      </div>
      <div className="grid grid-cols-3 items-center gap-2">
        <label className="text-sm text-muted-foreground">Minutos manuales por tarea</label>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={mins}
          onChange={(e) => setMins(parseInt(e.target.value))}
          className="col-span-2 accent-emerald-400"
        />
        <div className="col-span-3 text-right text-xs text-muted-foreground">{mins} min</div>
      </div>
      <div className="grid grid-cols-3 items-center gap-2">
        <label className="text-sm text-muted-foreground">Costo hora (USD)</label>
        <input
          type="range"
          min={8}
          max={40}
          step={1}
          value={rate}
          onChange={(e) => setRate(parseInt(e.target.value))}
          className="col-span-2 accent-emerald-400"
        />
        <div className="col-span-3 text-right text-xs text-muted-foreground">US${rate}/h</div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-background p-4 text-center">
          <div className="text-xs text-muted-foreground">Horas ahorradas/mes</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{Math.round(hoursSaved).toLocaleString()} h</div>
        </div>
        <div className="rounded-xl border border-border bg-background p-4 text-center">
          <div className="text-xs text-muted-foreground">Valor estimado</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">US${moneySaved.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}
