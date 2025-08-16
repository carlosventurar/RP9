import PricingSection from "@/components/pricing/PricingSection";
import { PlanCard } from "@/components/billing/PlanCard";

// Feature flag para mostrar la nueva sección de precios
const SHOW_NEW_PRICING = true;

// Componente legacy de pricing (placeholder)
function LegacyPricing() {
  const legacyPlans = [
    {
      key: "starter",
      name: "Starter",
      price: 99,
      features: [
        "5 workflows activos",
        "1,000 ejecuciones/mes",
        "Soporte email",
        "Templates básicos"
      ]
    },
    {
      key: "pro", 
      name: "Pro",
      price: 299,
      features: [
        "20 workflows activos",
        "10,000 ejecuciones/mes",
        "Soporte prioritario",
        "Templates premium"
      ]
    }
  ];

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Planes Legacy</h1>
        <p className="text-muted-foreground">Planes anteriores del sistema</p>
      </div>
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {legacyPlans.map((plan) => (
          <PlanCard
            key={plan.key}
            plan={plan}
            onUpgrade={() => {}}
            onBuyAddons={() => {}}
          />
        ))}
      </div>
    </div>
  );
}

export default function PreciosPage() {
  return SHOW_NEW_PRICING ? <PricingSection /> : <LegacyPricing />;
}
