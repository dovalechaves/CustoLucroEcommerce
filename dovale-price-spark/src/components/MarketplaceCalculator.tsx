import { useState, useMemo, useEffect } from "react";
import { fetchProduto, fetchTokenSalvo, authToken, simulate, type SimulateResults } from "@/lib/api";

type Marketplace = "" | "shopee" | "mercadolivre" | "shein";
type ListingType = "gold_pro" | "gold_special" | "free";
type RegimeTributario = "mei" | "simples" | "presumido";

const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  "": "Selecionar",
  shopee: "Shopee",
  mercadolivre: "Mercado Livre",
  shein: "Shein",
};

const LISTING_FEES: Record<ListingType, number> = {
  gold_pro: 19,
  gold_special: 14,
  free: 0,
};

const LISTING_LABELS: Record<ListingType, string> = {
  gold_pro: "Gold Pro (19%)",
  gold_special: "Gold (14%)",
  free: "Grátis (0%)",
};

const REGIME_TAXES: Record<RegimeTributario, number> = {
  mei: 3,
  simples: 6,
  presumido: 8,
};

const REGIME_LABELS: Record<RegimeTributario, string> = {
  mei: "MEI (3%)",
  simples: "Simples Nacional (6%)",
  presumido: "Lucro Presumido (8%)",
};

const inputClass =
  "w-full bg-secondary border-0 rounded-lg px-4 py-3.5 text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200";
const labelClass = "text-xs font-semibold uppercase tracking-widest text-muted-foreground";
const selectClass =
  "w-full appearance-none bg-secondary border-0 rounded-lg px-4 py-3.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200 cursor-pointer";

const ChevronIcon = () => (
  <svg
    className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ResultRow = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className={`text-sm font-semibold tabular-nums ${accent ? "text-primary" : "text-foreground"}`}>
      {value}
    </span>
  </div>
);

const MarketplaceCalculator = () => {
  // Form state
  const [marketplace, setMarketplace] = useState<Marketplace>("");
  const [codigoProduto, setCodigoProduto] = useState("");
  const [custoProduto, setCustoProduto] = useState("");
  const [acrescimo, setAcrescimo] = useState("");
  const [taxaPlataforma, setTaxaPlataforma] = useState("");
  const [impostos, setImpostos] = useState("");
  const [margemLucro, setMargemLucro] = useState(20);

  // ML-specific
  const [listingType, setListingType] = useState<ListingType>("gold_pro");
  const [regimeTributario, setRegimeTributario] = useState<RegimeTributario>("simples");
  const [pesoGramas, setPesoGramas] = useState("500");

  // Auth
  const [mlToken, setMlToken] = useState<string | null>(null);
  const [mlUser, setMlUser] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [isLoadingToken, setIsLoadingToken] = useState(false);

  // Product search
  const [isLoadingProduto, setIsLoadingProduto] = useState(false);
  const [produtoNome, setProdutoNome] = useState<string | null>(null);
  const [produtoErro, setProdutoErro] = useState<string | null>(null);

  // ML real simulation
  const [mlSim, setMlSim] = useState<SimulateResults | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simErro, setSimErro] = useState<string | null>(null);

  const isML = marketplace === "mercadolivre";
  const effectiveTaxa = isML ? LISTING_FEES[listingType] : parseFloat(taxaPlataforma) || 0;
  const effectiveImpostos = isML ? REGIME_TAXES[regimeTributario] : parseFloat(impostos) || 0;

  // Auto-load ML token on mount
  useEffect(() => {
    setIsLoadingToken(true);
    fetchTokenSalvo()
      .then(async ({ token }) => {
        try {
          const user = await authToken(token);
          setMlToken(token);
          setMlUser(user.nickname);
        } catch {}
      })
      .catch(() => {})
      .finally(() => setIsLoadingToken(false));
  }, []);

  // Reset simulation when inputs change
  useEffect(() => {
    setMlSim(null);
    setSimErro(null);
  }, [marketplace, custoProduto, acrescimo, listingType, regimeTributario, pesoGramas, margemLucro]);

  // Local calculation (always available)
  const results = useMemo(() => {
    const custo = parseFloat(custoProduto) || 0;
    const acresc = parseFloat(acrescimo) || 0;
    const custoTotal = custo + acresc;
    const totalPercentual = effectiveTaxa + effectiveImpostos + margemLucro;

    if (totalPercentual >= 100) return { valorFinal: 0, lucroPorVenda: 0 };

    const valorFinal = custoTotal / (1 - totalPercentual / 100);
    return {
      valorFinal: Math.max(0, valorFinal),
      lucroPorVenda: Math.max(0, valorFinal * (margemLucro / 100)),
    };
  }, [custoProduto, acrescimo, effectiveTaxa, effectiveImpostos, margemLucro]);

  const buscarProduto = async () => {
    if (!codigoProduto.trim()) return;
    setIsLoadingProduto(true);
    setProdutoErro(null);
    setProdutoNome(null);
    try {
      const data = await fetchProduto(codigoProduto);
      setCustoProduto(String(data.custo));
      if (data.peso) setPesoGramas(String(data.peso));
      setProdutoNome(data.resumo);
    } catch {
      setProdutoErro("Produto não encontrado");
    } finally {
      setIsLoadingProduto(false);
    }
  };

  const autenticarToken = async () => {
    if (!tokenInput.trim()) return;
    setIsLoadingToken(true);
    try {
      const user = await authToken(tokenInput);
      setMlToken(tokenInput);
      setMlUser(user.nickname);
      setTokenInput("");
    } catch {}
    finally {
      setIsLoadingToken(false);
    }
  };

  const simularML = async () => {
    setIsSimulating(true);
    setSimErro(null);
    try {
      const custo = (parseFloat(custoProduto) || 0) + (parseFloat(acrescimo) || 0);
      const data = await simulate(
        {
          price: Math.max(results.valorFinal, 1),
          cost: custo,
          listing_type_id: listingType,
          weight: parseInt(pesoGramas) || 500,
          tax_regime: regimeTributario,
          free_shipping: true,
        },
        mlToken || undefined
      );
      setMlSim(data.results);
    } catch {
      setSimErro("Erro ao simular. Verifique se o backend está rodando.");
    } finally {
      setIsSimulating(false);
    }
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 w-full max-w-5xl mx-auto">
      {/* Form */}
      <div className="animate-fade-up-delay-1">
        <div className="bg-card rounded-2xl p-8 shadow-[0_1px_3px_hsl(240_10%_80%/0.3),0_8px_32px_hsl(240_10%_80%/0.12)] transition-shadow duration-300 hover:shadow-[0_2px_6px_hsl(240_10%_80%/0.35),0_12px_40px_hsl(240_10%_80%/0.18)]">
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground mb-8 uppercase">
            Calculadora
          </h2>

          {/* Marketplace */}
          <div className="space-y-2 mb-6">
            <label className={labelClass}>Marketplace</label>
            <div className="relative">
              <select
                value={marketplace}
                onChange={(e) => setMarketplace(e.target.value as Marketplace)}
                className={selectClass}
              >
                {Object.entries(MARKETPLACE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <ChevronIcon />
            </div>
          </div>

          {/* Busca de Produto */}
          <div className="space-y-2 mb-6">
            <label className={labelClass}>Código do Produto</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={codigoProduto}
                onChange={(e) => setCodigoProduto(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscarProduto()}
                placeholder="Ex: 12345"
                className={`${inputClass} flex-1`}
              />
              <button
                onClick={buscarProduto}
                disabled={isLoadingProduto || !codigoProduto.trim()}
                className="px-4 py-3.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 whitespace-nowrap"
              >
                {isLoadingProduto ? "..." : "Buscar"}
              </button>
            </div>
            {produtoNome && (
              <p className="text-xs text-primary font-medium truncate">{produtoNome}</p>
            )}
            {produtoErro && (
              <p className="text-xs text-destructive font-medium">{produtoErro}</p>
            )}
          </div>

          {/* Custo do Produto */}
          <div className="space-y-2 mb-6">
            <label className={labelClass}>Custo do Produto (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={custoProduto}
              onChange={(e) => setCustoProduto(e.target.value)}
              placeholder="0,00"
              className={inputClass}
            />
          </div>

          {/* Acréscimo */}
          <div className="space-y-2 mb-6">
            <label className={labelClass}>Acréscimo (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={acrescimo}
              onChange={(e) => setAcrescimo(e.target.value)}
              placeholder="0,00"
              className={inputClass}
            />
          </div>

          {/* ML-specific OR campos manuais */}
          {isML ? (
            <>
              <div className="space-y-2 mb-6">
                <label className={labelClass}>Tipo de Anúncio</label>
                <div className="relative">
                  <select
                    value={listingType}
                    onChange={(e) => setListingType(e.target.value as ListingType)}
                    className={selectClass}
                  >
                    {Object.entries(LISTING_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <ChevronIcon />
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <label className={labelClass}>Regime Tributário</label>
                <div className="relative">
                  <select
                    value={regimeTributario}
                    onChange={(e) => setRegimeTributario(e.target.value as RegimeTributario)}
                    className={selectClass}
                  >
                    {Object.entries(REGIME_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <ChevronIcon />
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <label className={labelClass}>Peso do Produto (g)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={pesoGramas}
                  onChange={(e) => setPesoGramas(e.target.value)}
                  placeholder="500"
                  className={inputClass}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2 mb-6">
                <label className={labelClass}>Taxa da Plataforma (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={taxaPlataforma}
                  onChange={(e) => setTaxaPlataforma(e.target.value)}
                  placeholder="0,00"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2 mb-6">
                <label className={labelClass}>Impostos (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={impostos}
                  onChange={(e) => setImpostos(e.target.value)}
                  placeholder="0,00"
                  className={inputClass}
                />
              </div>
            </>
          )}

          {/* Margem de Lucro */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between">
              <label className={labelClass}>Margem de Lucro</label>
              <span className="text-sm font-bold text-primary tabular-nums">{margemLucro}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="60"
              step="1"
              value={margemLucro}
              onChange={(e) => setMargemLucro(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-secondary accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
              <span>0%</span>
              <span>60%</span>
            </div>
          </div>

          {/* ML Auth + Simular */}
          {isML && (
            <div className="border-t border-border pt-6 space-y-4">
              {/* Status de autenticação */}
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    mlToken ? "bg-green-500" : "bg-muted-foreground/40"
                  }`}
                />
                <span className="text-xs text-muted-foreground">
                  {isLoadingToken
                    ? "Carregando token..."
                    : mlToken
                    ? `ML conectado: ${mlUser}`
                    : "Não autenticado no Mercado Livre"}
                </span>
              </div>

              {/* Input manual de token (só se não autenticado) */}
              {!mlToken && !isLoadingToken && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && autenticarToken()}
                    placeholder="Token de acesso ML"
                    className={`${inputClass} flex-1 text-xs`}
                  />
                  <button
                    onClick={autenticarToken}
                    disabled={!tokenInput.trim() || isLoadingToken}
                    className="px-3 py-2 bg-secondary text-foreground rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity disabled:opacity-40"
                  >
                    Entrar
                  </button>
                </div>
              )}

              {/* Botão Simular */}
              {results.valorFinal > 0 && (
                <button
                  onClick={simularML}
                  disabled={isSimulating}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {isSimulating ? "Simulando..." : "Simular com dados reais do ML"}
                </button>
              )}

              {simErro && <p className="text-xs text-destructive">{simErro}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="animate-fade-up-delay-2">
        <div className="bg-card rounded-2xl p-8 shadow-[0_1px_3px_hsl(240_10%_80%/0.3),0_8px_32px_hsl(240_10%_80%/0.12)] transition-shadow duration-300 hover:shadow-[0_2px_6px_hsl(240_10%_80%/0.35),0_12px_40px_hsl(240_10%_80%/0.18)]">
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground mb-8 uppercase">
            Resultado
          </h2>

          <div className="space-y-5">
            <ResultRow label="Marketplace" value={marketplace ? MARKETPLACE_LABELS[marketplace] : "—"} />
            <ResultRow label="Custo do Produto" value={fmt(parseFloat(custoProduto) || 0)} />
            <ResultRow label="Acréscimo" value={fmt(parseFloat(acrescimo) || 0)} />

            {isML ? (
              <>
                <ResultRow label="Tipo de Anúncio" value={LISTING_LABELS[listingType]} />
                <ResultRow label="Regime Tributário" value={REGIME_LABELS[regimeTributario]} />
                <ResultRow label="Peso" value={`${pesoGramas}g`} />
              </>
            ) : (
              <>
                <ResultRow label="Taxa da Plataforma" value={`${effectiveTaxa}%`} />
                <ResultRow label="Impostos" value={`${effectiveImpostos}%`} />
              </>
            )}

            <ResultRow label="Margem de Lucro" value={`${margemLucro}%`} />

            {/* Detalhamento real do ML */}
            {mlSim && (
              <>
                <div className="h-px bg-border" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Dados reais do ML
                </p>
                <ResultRow
                  label="Taxa ML"
                  value={`${mlSim.ml_fee_percent.toFixed(1)}% (${fmt(mlSim.ml_fee_amount)})`}
                />
                <ResultRow label="Frete estimado" value={fmt(mlSim.shipping_cost)} />
                <ResultRow
                  label="Impostos"
                  value={`${mlSim.tax_rate_percent.toFixed(0)}% (${fmt(mlSim.tax_amount)})`}
                />
                <ResultRow
                  label="Margem real"
                  value={`${mlSim.margin_percent.toFixed(1)}%`}
                  accent={mlSim.margin_percent > 0}
                />
              </>
            )}

            <div className="h-px bg-border" />

            {/* Big results */}
            <div className="bg-primary rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-primary-foreground/70 uppercase tracking-wide">
                  Valor Final
                </span>
                <span className="text-2xl font-bold text-primary-foreground tabular-nums">
                  {fmt(mlSim ? mlSim.gross_revenue : results.valorFinal)}
                </span>
              </div>
              <div className="h-px bg-primary-foreground/15" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-primary-foreground/70 uppercase tracking-wide">
                  Lucro por Venda
                </span>
                <span className="text-2xl font-bold text-accent tabular-nums">
                  {fmt(mlSim ? mlSim.net_profit : results.lucroPorVenda)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketplaceCalculator;
