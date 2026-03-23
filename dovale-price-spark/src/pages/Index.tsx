import dovaleLogo from "@/assets/dovale-logo.png";
import MarketplaceCalculator from "@/components/MarketplaceCalculator";

const Index = () => {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background blobs - Norris-inspired organic shapes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-primary/[0.04] animate-float"
        />
        <div
          className="absolute top-1/3 -right-48 w-[600px] h-[600px] rounded-full bg-primary/[0.03] animate-float-delayed"
        />
        <div
          className="absolute -bottom-24 left-1/4 w-[400px] h-[400px] rounded-full bg-accent/[0.06] animate-float"
        />
        {/* Subtle outline circles */}
        <svg className="absolute top-20 right-1/4 w-[300px] h-[300px] opacity-[0.06]" viewBox="0 0 300 300">
          <circle cx="150" cy="150" r="140" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" />
        </svg>
        <svg className="absolute bottom-32 left-10 w-[200px] h-[200px] opacity-[0.05]" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" />
        </svg>
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6 animate-fade-up">
        <img src={dovaleLogo} alt="DOVALE" className="h-8 md:h-10" />
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Calculadora de Preços
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 md:px-12 pt-12 md:pt-20 pb-16 md:pb-24">
        <div className="max-w-5xl mx-auto text-center mb-16 md:mb-20">
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground leading-[0.95] text-balance animate-fade-up">
            Calculadora de Preços
            <br />
            <span className="text-primary/40">para Marketplaces</span>
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-xl mx-auto animate-fade-up-delay-1 leading-relaxed">
            Descubra suas taxas, custos e lucros de forma rápida e prática.
            Ferramenta exclusiva <strong className="text-foreground font-semibold">DOVALE</strong>.
          </p>
        </div>

        <MarketplaceCalculator />
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-6 md:px-12 border-t border-border/50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <img src={dovaleLogo} alt="DOVALE" className="h-5 opacity-40" />
          <span className="text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} DOVALE
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
