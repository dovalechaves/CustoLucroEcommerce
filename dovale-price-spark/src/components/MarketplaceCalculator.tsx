import { useState, useMemo, useEffect, useCallback } from "react";
import { fetchProduto, fetchTokenSalvo, authToken, simulate, fetchMyItems, type SimulateResults } from "@/lib/api";

type Marketplace = "" | "shopee" | "mercadolivre";
type ListingType = "gold_pro" | "gold_special" | "free";

const TAX_RATE = 0.21; // 21% fixo

const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  "": "Selecionar",
  shopee: "Shopee",
  mercadolivre: "Mercado Livre",
};

const LISTING_FEES: Record<ListingType, number> = {
  gold_pro: 16.5,
  gold_special: 14,
  free: 0,
};

const LISTING_LABELS: Record<ListingType, string> = {
  gold_pro: "Premium (16.5%)",
  gold_special: "Clássico (14%)",
  free: "Grátis (0%)",
};


const SHIPPING_TABLE_GREEN = [
  { max_weight: 0.3, costs: [5.65, 6.55, 7.75, 12.35, 14.35, 16.45, 18.45, 20.95] },
  { max_weight: 0.5, costs: [5.95, 6.65, 7.85, 13.25, 15.45, 17.65, 19.85, 22.55] },
  { max_weight: 1.0, costs: [6.05, 6.75, 7.95, 13.85, 16.15, 18.45, 20.75, 23.65] },
  { max_weight: 1.5, costs: [6.15, 6.85, 8.05, 14.15, 16.45, 18.85, 21.15, 24.65] },
  { max_weight: 2.0, costs: [6.25, 6.95, 8.15, 14.45, 16.85, 19.25, 21.65, 24.65] },
  { max_weight: 3.0, costs: [6.35, 7.15, 8.35, 15.75, 18.35, 21.05, 23.65, 26.25] },
  { max_weight: 4.0, costs: [6.45, 7.35, 8.55, 17.05, 19.85, 22.75, 25.65, 28.35] },
  { max_weight: 5.0, costs: [6.55, 7.55, 8.75, 18.45, 21.55, 24.65, 27.75, 30.75] },
  { max_weight: 9.0, costs: [6.85, 7.95, 9.15, 25.45, 28.55, 32.65, 35.75, 39.75] },
  { max_weight: 13.0, costs: [8.35, 9.65, 11.25, 41.25, 46.25, 52.95, 57.95, 64.35] },
  { max_weight: 17.0, costs: [8.35, 9.65, 11.25, 45.95, 51.55, 58.95, 64.55, 71.65] },
  { max_weight: 30.0, costs: [8.35, 9.65, 11.25, 49.45, 55.45, 63.45, 69.45, 77.15] }
];

function estimateShipping(price: number, weightGrams: number) {
  const weightKg = weightGrams / 1000.0;
  const row = SHIPPING_TABLE_GREEN.find(r => weightKg <= r.max_weight) || SHIPPING_TABLE_GREEN[SHIPPING_TABLE_GREEN.length - 1];
  if (price < 19) return row.costs[0];
  if (price < 49) return row.costs[1];
  if (price < 79) return row.costs[2];
  if (price < 100) return row.costs[3];
  if (price < 120) return row.costs[4];
  if (price < 150) return row.costs[5];
  if (price < 200) return row.costs[6];
  return row.costs[7];
}

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
  const [taxaPlataforma, setTaxaPlataforma] = useState("");
  
  // New calculation states
  const [margemLucro, setMargemLucro] = useState(20);
  const [precoVenda, setPrecoVenda] = useState("");
  const [lastEdited, setLastEdited] = useState<"margin" | "price">("margin");
  const [quantidade, setQuantidade] = useState(1);

  // Specific items / attributes
  const [categoriaId, setCategoriaId] = useState("");
  const [itemId, setItemId] = useState("");
  const [myItemsList, setMyItemsList] = useState<any[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [selectedMyItem, setSelectedMyItem] = useState("");

  // ML-specific
  const [listingType, setListingType] = useState<ListingType>("gold_pro");
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

  // Local 2-way binding Math Sync
  const syncValues = useCallback((source: "margin" | "price", value: number) => {
    const cost = parseFloat(custoProduto) || 0;
    const weight = parseInt(pesoGramas) || 0;

    if (source === "margin") {
      const margin = value / 100;
      if (cost > 0 && margin < 1) {
        if (isML) {
          const taxRate = TAX_RATE;
          const feeRate = LISTING_FEES[listingType] / 100;
          const denominator = 1 - margin - feeRate - taxRate;
          if (denominator > 0) {
            const priceNoShipping = cost / denominator;

            let priceWithShipping = Math.max(79, cost / denominator);
            for (let i = 0; i < 4; i++) {
              let ship = estimateShipping(priceWithShipping, weight);
              priceWithShipping = (cost + ship) / denominator;
            }

            const validNo = priceNoShipping < 79;
            const validWith = priceWithShipping >= 79;
            const currentPrice = parseFloat(precoVenda) || 0;

            let finalPrice = priceNoShipping;
            if (validNo && validWith) {
              finalPrice = currentPrice >= 79 ? priceWithShipping : priceNoShipping;
            } else if (validWith) {
              finalPrice = priceWithShipping;
            }

            setPrecoVenda(finalPrice.toFixed(2));
          }
        } else {
          const taxRate = (parseFloat(taxaPlataforma) || 0) / 100;
          const denominator = 1 - margin - taxRate - TAX_RATE;
          if (denominator > 0) setPrecoVenda((cost / denominator).toFixed(2));
        }
      }
    } else {
      const price = value;
      if (price > 0 && cost > 0) {
        if (isML) {
          const taxRate = TAX_RATE;
          const feeRate = LISTING_FEES[listingType] / 100;
          let shipping = 0;
          if (price >= 79) shipping = estimateShipping(price, weight);
          const profit = price - cost - shipping - (price * feeRate) - (price * taxRate);
          setMargemLucro(Number(((profit / price) * 100).toFixed(2)));
        } else {
          const taxRate = (parseFloat(taxaPlataforma) || 0) / 100;
          const profit = price - cost - (price * taxRate) - (price * TAX_RATE);
          setMargemLucro(Number(((profit / price) * 100).toFixed(2)));
        }
      }
    }
  }, [custoProduto, isML, listingType, pesoGramas, taxaPlataforma]);

  // Keep values in sync when dependencies change
  useEffect(() => {
    syncValues(lastEdited, lastEdited === "margin" ? margemLucro : parseFloat(precoVenda) || 0);
  }, [syncValues, lastEdited, margemLucro, precoVenda, custoProduto, pesoGramas, isML, listingType, taxaPlataforma]);

  // Reset simulation when inputs change
  useEffect(() => {
    setMlSim(null);
    setSimErro(null);
  }, [marketplace, custoProduto, listingType, pesoGramas, margemLucro, precoVenda, quantidade]);

  // Local calculation (always available)
  const results = useMemo(() => {
    const cost = parseFloat(custoProduto) || 0;
    const price = parseFloat(precoVenda) || 0;
    let profit = 0;
    let shipping = 0;

    if (isML) {
      const taxRate = TAX_RATE;
      const feeRate = LISTING_FEES[listingType] / 100;
      if (price >= 79) {
        shipping = estimateShipping(price, parseInt(pesoGramas) || 0);
      }
      profit = price - cost - shipping - (price * feeRate) - (price * taxRate);
    } else {
      const taxRate = (parseFloat(taxaPlataforma) || 0) / 100;
      profit = price - cost - (price * taxRate) - (price * TAX_RATE);
    }

    return {
      valorFinal: price,
      lucroPorVenda: profit,
      frete: shipping,
    };
  }, [precoVenda, custoProduto, taxaPlataforma, isML, listingType, pesoGramas]);

  const buscarProduto = async () => {
    if (!codigoProduto.trim()) return;
    setIsLoadingProduto(true);
    setProdutoErro(null);
    setProdutoNome(null);
    try {
      const data = await fetchProduto(codigoProduto);
      const custoFmt = Number(data.custo).toFixed(2);
      setCustoProduto(custoFmt);
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

  const carregarMeusAnuncios = async () => {
    if (!mlToken) return;
    setIsLoadingItems(true);
    try {
      const sellerId = localStorage.getItem("ml_seller_id") || "";
      const items = await fetchMyItems(sellerId, mlToken);
      setMyItemsList(items);
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar anúncios");
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleSelectMyItem = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedMyItem(id);
    if (!id) return;
    const item = myItemsList.find(i => i.id === id);
    if (item) {
      setItemId(item.id);
      setCategoriaId(item.category_id || "");
      setPrecoVenda(String(item.price || 0));
      setLastEdited("price");
      syncValues("price", item.price || 0);

      if (item.listing_type_id === "gold_pro" || item.listing_type_id === "gold_special" || item.listing_type_id === "free") {
        setListingType(item.listing_type_id as ListingType);
      }
    }
  };

  const simularML = async () => {
    setIsSimulating(true);
    setSimErro(null);
    try {
      const custo = parseFloat(custoProduto) || 0;
      const payload: any = {
        price: parseFloat(precoVenda) || 0,
        cost: custo,
        quantity: quantidade,
        listing_type_id: listingType,
        weight: parseInt(pesoGramas) || 500,
        tax_rate: 21,
        free_shipping: (parseFloat(precoVenda) || 0) >= 79,
      };

      if (categoriaId) payload.category_id = categoriaId;
      if (itemId) payload.item_id = itemId;
      if (mlToken) {
        const savedSellerId = localStorage.getItem("ml_seller_id");
        if (savedSellerId) payload.seller_id = savedSellerId;
      }

      const data = await simulate(payload, mlToken || undefined);
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

          {/* Tipo de Anúncio e Regime Tributário (ML) ou Taxas (Outros) */}
          {isML ? (
            <>
              <div className="space-y-2 mb-6">
                <label className={labelClass}>Tipo de Anúncio</label>
                <div className="relative mt-2">
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

            </>
          ) : marketplace !== "" ? (
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

            </>
          ) : null}

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
            readOnly
              placeholder="0,00"
            className={`${inputClass} opacity-70 cursor-not-allowed`}
            />
            {custoProduto !== "" && (
              <p className="text-xs text-[#00A650] font-medium mt-1">✅ Custo importado do sistema</p>
            )}
          </div>

          <div className="space-y-2 mb-6">
            <label className={labelClass}>Peso do Produto (g)</label>
            <input
              type="number"
              min="1"
              step="1"
              value={pesoGramas}
              readOnly
              placeholder="500"
              className={`${inputClass} opacity-70 cursor-not-allowed`}
            />
            {custoProduto !== "" && (
              <p className="text-xs text-[#00A650] font-medium mt-1">✅ Peso importado do sistema</p>
            )}
          </div>


          {/* Preço de Venda */}
          <div className="space-y-2 mb-6">
            <label className={labelClass}>Preço de Venda (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={precoVenda}
              onChange={(e) => {
                setPrecoVenda(e.target.value);
                setLastEdited("price");
              }}
              placeholder="0,00"
              className={inputClass}
            />
          </div>

          {/* Margem de Lucro */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between">
              <label className={labelClass}>Margem de Lucro</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="-100"
                  max="100"
                step="0.01"
                  value={margemLucro}
                  onChange={(e) => {
                    setMargemLucro(Number(e.target.value));
                    setLastEdited("margin");
                  }}
                  className="w-20 bg-secondary border-0 rounded-lg px-2 py-1 text-sm font-medium text-right focus:ring-2 focus:ring-primary outline-none"
                />
                <span className="text-sm font-bold text-primary tabular-nums">%</span>
              </div>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              step="0.01"
              value={margemLucro}
              onChange={(e) => {
                setMargemLucro(Number(e.target.value));
                setLastEdited("margin");
              }}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-secondary accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
              <span>-100%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Quantidade */}
          <div className="space-y-2 mb-6">
            <label className={labelClass}>Quantidade</label>
            <input
              type="number"
              min="1"
              step="1"
              value={quantidade}
              onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
              className={inputClass}
            />
          </div>

          {/* Importar Meus Anúncios */}
          {isML && mlToken && (
            <div className="space-y-2 mb-6">
              <button
                onClick={carregarMeusAnuncios}
                disabled={isLoadingItems}
                className="w-full py-3 bg-secondary text-foreground rounded-lg text-sm font-semibold hover:opacity-80 transition-opacity"
              >
                {isLoadingItems ? "Carregando anúncios..." : "☁️ Importar Meus Anúncios do Mercado Livre"}
              </button>
              {myItemsList.length > 0 && (
                <div className="relative mt-2">
                  <select value={selectedMyItem} onChange={handleSelectMyItem} className={selectClass}>
                    <option value="">Selecione um anúncio...</option>
                    {myItemsList.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.id} - {item.title} (R$ {item.price})
                      </option>
                    ))}
                  </select>
                  <ChevronIcon />
                </div>
              )}
            </div>
          )}

          {/* O Resto: Frete, Categoria, Item ID */}
          {isML && (
            <>
              <div className="space-y-2 mb-6">
                <label className={labelClass}>Categoria (Produto Inédito)</label>
                <input
                  type="text"
                  value={categoriaId}
                  readOnly
                  placeholder="MLB1055"
                  className={`${inputClass} opacity-70 cursor-not-allowed`}
                />
              </div>

              <div className="space-y-2 mb-6">
                <label className={labelClass}>Item ID ML (opcional)</label>
                <input type="text" value={itemId} readOnly placeholder="MLB123456789" className={`${inputClass} opacity-70 cursor-not-allowed`} />
              </div>
            </>
          )}

          {/* ML Auth + Simular */}
          {isML && simErro && (
            <div className="border-t border-border pt-6 space-y-4">
              <p className="text-xs text-destructive">{simErro}</p>
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
            <ResultRow label="Quantidade" value={String(quantidade)} />

            {isML ? (
              <>
                <ResultRow label="Tipo de Anúncio" value={LISTING_LABELS[listingType]} />
                <ResultRow label="Imposto" value="21%" />
                <ResultRow label="Peso" value={`${pesoGramas}g`} />
                <ResultRow label="Custo de Frete (Estimado)" value={fmt(results.frete)} />
              </>
            ) : (
              <>
                <ResultRow label="Taxa da Plataforma" value={`${effectiveTaxa}%`} />
                <ResultRow label="Imposto" value="21%" />
              </>
            )}

            <ResultRow label="Margem de Lucro" value={`${margemLucro}%`} />

            {/* Detalhamento real do ML */}
            {mlSim && (
              <>
                <div className="h-px bg-border" />
                <h3 className="font-bold text-foreground mb-4">📊 Detalhamento Real do ML</h3>

                <div className="flex h-4 w-full rounded-full overflow-hidden mb-4 bg-secondary">
                  <div style={{ width: `${Math.max(0, (mlSim.ml_fee_amount / mlSim.gross_revenue) * 100)}%`, backgroundColor: '#FF7733' }} />
                  <div style={{ width: `${Math.max(0, (mlSim.shipping_cost / mlSim.gross_revenue) * 100)}%`, backgroundColor: '#7B61FF' }} />
                  <div style={{ width: `${Math.max(0, (mlSim.tax_amount / mlSim.gross_revenue) * 100)}%`, backgroundColor: '#FFB800' }} />
                  <div style={{ width: `${Math.max(0, (mlSim.product_cost / mlSim.gross_revenue) * 100)}%`, backgroundColor: '#E02020' }} />
                  <div style={{ width: `${Math.max(0, (Math.max(mlSim.net_profit, 0) / mlSim.gross_revenue) * 100)}%`, backgroundColor: '#00A650' }} />
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-foreground" /> <span>Receita Bruta</span></div>
                    <span className="font-bold text-foreground">{fmt(mlSim.gross_revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: '#FF7733'}} /> <span>Taxa ML ({mlSim.ml_fee_percent.toFixed(1)}%)</span></div>
                    <span className="text-destructive">− {fmt(mlSim.ml_fee_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: '#7B61FF'}} /> <span>Frete</span></div>
                    <span className="text-destructive">− {fmt(mlSim.shipping_cost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: '#FFB800'}} /> <span>Imposto ({mlSim.tax_rate_percent.toFixed(0)}%)</span></div>
                    <span className="text-destructive">− {fmt(mlSim.tax_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: '#E02020'}} /> <span>Custo do Produto</span></div>
                    <span className="text-destructive">− {fmt(mlSim.product_cost)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border mt-2">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: '#00A650'}} /> <span className="font-bold">Lucro Líquido</span></div>
                    <span className={`font-bold ${mlSim.net_profit >= 0 ? "text-[#00A650]" : "text-destructive"}`}>{fmt(mlSim.net_profit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-muted-foreground ml-5">Margem</span>
                    <span className={`font-bold ${mlSim.margin_percent >= 0 ? "text-[#00A650]" : "text-destructive"}`}>{mlSim.margin_percent.toFixed(1)}%</span>
                  </div>
                </div>
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
                  {fmt(results.valorFinal)}
                </span>
              </div>
              <div className="h-px bg-primary-foreground/15" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-primary-foreground/70 uppercase tracking-wide">
                  Lucro por Venda
                </span>
                <span className="text-2xl font-bold text-accent tabular-nums">
                  {fmt(results.lucroPorVenda)}
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
