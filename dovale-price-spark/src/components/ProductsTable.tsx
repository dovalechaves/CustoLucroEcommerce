import { useState, useMemo, useCallback, useEffect } from "react";
import { fetchProdutos } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Product {
  codigo: string;
  descricao: string;
  percentualDesconto: number;
  precoFinal: number;
  custo: number;
  peso: number;
}

type Marketplace = "mercadolivre" | "amazon" | "shopee";
type ListingType = "gold_pro" | "gold_special" | "free";
type RegimeTributario = "mei" | "simples" | "presumido";

const LISTING_FEES: Record<ListingType, number> = {
  gold_pro: 16.5,
  gold_special: 14,
  free: 0,
};

const LISTING_LABELS: Record<ListingType, string> = {
  gold_pro: "Premium (16,5%)",
  gold_special: "Clássico (14%)",
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

const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  mercadolivre: "Mercado Livre",
  amazon: "Amazon",
  shopee: "Shopee",
};

const MARKETPLACE_FEES: Record<Marketplace, number> = {
  mercadolivre: 16.5, // sobrescrito pelo listingType quando ML
  amazon: 15,
  shopee: 5,
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
  { max_weight: 30.0, costs: [8.35, 9.65, 11.25, 49.45, 55.45, 63.45, 69.45, 77.15] },
];

function estimateShipping(price: number, weightGrams: number) {
  const weightKg = weightGrams / 1000.0;
  const row =
    SHIPPING_TABLE_GREEN.find((r) => weightKg <= r.max_weight) ||
    SHIPPING_TABLE_GREEN[SHIPPING_TABLE_GREEN.length - 1];
  if (price < 19) return row.costs[0];
  if (price < 49) return row.costs[1];
  if (price < 79) return row.costs[2];
  if (price < 100) return row.costs[3];
  if (price < 120) return row.costs[4];
  if (price < 150) return row.costs[5];
  if (price < 200) return row.costs[6];
  return row.costs[7];
}

const selectClass =
  "appearance-none bg-secondary border-0 rounded-lg px-4 py-3.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200 cursor-pointer w-full";
const labelClass = "text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 block";

const ChevronIcon = () => (
  <svg
    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ProductsTable = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetchProdutos()
      .then((data) => {
        setProducts(
          data.map((p) => ({
            codigo: String(p.pro_codigo),
            descricao: p.resumo,
            percentualDesconto: 0,
            precoFinal: p.preco ?? 0,
            custo: p.custo ?? 0,
            peso: p.peso ?? 0,
          }))
        );
      })
      .catch(() => setLoadError("Não foi possível carregar os produtos. Verifique se o backend está rodando."))
      .finally(() => setIsLoading(false));
  }, []);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [marginFilter, setMarginFilter] = useState<[number, number]>([0, 100]);

  // Marketplace filter
  const [marketplace, setMarketplace] = useState<Marketplace>("mercadolivre");
  const [listingType, setListingType] = useState<ListingType>("gold_pro");
  const [regimeTributario, setRegimeTributario] = useState<RegimeTributario>("presumido");

  // Effective fee based on marketplace
  const effectiveFeeRate = useMemo(() => {
    if (marketplace === "mercadolivre") return LISTING_FEES[listingType] / 100;
    return MARKETPLACE_FEES[marketplace] / 100;
  }, [marketplace, listingType]);

  const taxRate = REGIME_TAXES[regimeTributario] / 100;

  const getCalculatedValues = useCallback(
    (product: Product) => {
      const recebimento = product.precoFinal * (1 - product.percentualDesconto / 100);
      const taxa = recebimento * effectiveFeeRate;

      const frete =
        marketplace === "mercadolivre" && recebimento >= 79
          ? estimateShipping(recebimento, product.peso)
          : 0;

      const imposto = recebimento * taxRate;
      const recebimentoTotal = recebimento - taxa - frete;
      const margem = recebimento > 0 ? ((recebimentoTotal - product.custo) / recebimento) * 100 : 0;
      const margemComImposto =
        recebimento > 0 ? ((recebimentoTotal - product.custo - imposto) / recebimento) * 100 : 0;

      return { recebimento, taxa, frete, imposto, recebimentoTotal, margem, margemComImposto };
    },
    [effectiveFeeRate, taxRate, marketplace]
  );

  const updateProduct = useCallback((index: number, updates: Partial<Product>) => {
    setProducts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.descricao.toLowerCase().includes(searchQuery.toLowerCase());

      const { margemComImposto } = getCalculatedValues(product);
      const matchesMargin =
        margemComImposto >= marginFilter[0] && margemComImposto <= marginFilter[1];

      return matchesSearch && matchesMargin;
    });
  }, [products, searchQuery, marginFilter, getCalculatedValues]);

  const getMarginBadge = (margem: number) => {
    if (margem > 40) return <Badge className="bg-green-100 text-green-800">{margem.toFixed(1)}%</Badge>;
    if (margem >= 20) return <Badge className="bg-yellow-100 text-yellow-800">{margem.toFixed(1)}%</Badge>;
    return <Badge className="bg-red-100 text-red-800">{margem.toFixed(1)}%</Badge>;
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const taxaLabel =
    marketplace === "mercadolivre"
      ? `ML (${LISTING_FEES[listingType]}%)`
      : marketplace === "amazon"
        ? "Amazon (15%)"
        : "Shopee (5%)";

  return (
    <div className="w-full max-w-full mx-auto animate-fade-up-delay-1">
      <div className="bg-card rounded-2xl p-8 shadow-[0_1px_3px_hsl(240_10%_80%/0.3),0_8px_32px_hsl(240_10%_80%/0.12)] transition-shadow duration-300 hover:shadow-[0_2px_6px_hsl(240_10%_80%/0.35),0_12px_40px_hsl(240_10%_80%/0.18)]">
        <h2 className="font-display text-xl font-bold tracking-tight text-foreground mb-8 uppercase">
          Tabela de Produtos
        </h2>

        {/* Filters — linha 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Busca */}
          <div>
            <label className={labelClass}>Buscar</label>
            <Input
              type="text"
              placeholder="Código ou descrição..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-secondary border-0 rounded-lg px-4 py-3.5 text-sm"
            />
          </div>

          {/* Marketplace */}
          <div>
            <label className={labelClass}>Marketplace</label>
            <div className="relative">
              <select
                value={marketplace}
                onChange={(e) => setMarketplace(e.target.value as Marketplace)}
                className={selectClass}
              >
                {Object.entries(MARKETPLACE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <ChevronIcon />
            </div>
          </div>

          {/* Slicer Margem c/ Imposto */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass}>Margem c/ Imposto</label>
              <span className="text-sm font-bold text-primary tabular-nums">
                {marginFilter[0]}% — {marginFilter[1]}%
              </span>
            </div>
            <div className="relative h-6 flex items-center">
              <div className="absolute w-full h-2 bg-secondary rounded-full" />
              <div
                className="absolute h-2 bg-primary rounded-full"
                style={{
                  left: `${marginFilter[0]}%`,
                  right: `${100 - marginFilter[1]}%`,
                }}
              />
              <input
                type="range" min="0" max="100" step="1"
                value={marginFilter[0]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v <= marginFilter[1]) setMarginFilter([v, marginFilter[1]]);
                }}
                className="absolute w-full h-2 appearance-none bg-transparent cursor-pointer accent-primary [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md"
              />
              <input
                type="range" min="0" max="100" step="1"
                value={marginFilter[1]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v >= marginFilter[0]) setMarginFilter([marginFilter[0], v]);
                }}
                className="absolute w-full h-2 appearance-none bg-transparent cursor-pointer accent-primary [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md"
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground font-medium mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>



        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary/10">
                <th className="px-4 py-3 text-left font-semibold text-foreground text-xs uppercase tracking-wider">Código</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground text-xs uppercase tracking-wider">Descrição</th>
                <th className="px-4 py-3 text-center font-semibold text-foreground text-xs uppercase tracking-wider">%</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground text-xs uppercase tracking-wider">Preço Final</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">Recebimento</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">{taxaLabel}</th>
                {marketplace === "mercadolivre" && (
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">Frete (est.)</th>
                )}
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">Imposto</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">Custo</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground text-xs uppercase tracking-wider font-bold">Rec. Total</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">Margem</th>
                <th className="px-4 py-3 text-right font-semibold text-primary text-xs uppercase tracking-wider">Margem c/ Imp.</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground text-xs uppercase tracking-wider">Peso</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const values = getCalculatedValues(product);
                const actualIndex = products.findIndex((p) => p.codigo === product.codigo);

                return (
                  <tr key={product.codigo} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                    <td className="px-4 py-3 text-foreground font-medium">{product.codigo}</td>
                    <td className="px-4 py-3 text-foreground text-sm max-w-xs truncate">{product.descricao}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={product.percentualDesconto}
                        onChange={(e) => updateProduct(actualIndex, { percentualDesconto: parseFloat(e.target.value) || 0 })}
                        className="w-16 bg-secondary border-0 rounded px-2 py-1 text-sm text-center text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={product.precoFinal}
                        onChange={(e) => updateProduct(actualIndex, { precoFinal: parseFloat(e.target.value) || 0 })}
                        className="w-24 bg-secondary border-0 rounded px-2 py-1 text-sm text-right text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmt(values.recebimento)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmt(values.taxa)}</td>
                    {marketplace === "mercadolivre" && (
                      <td className="px-4 py-3 text-right text-muted-foreground">{fmt(values.frete)}</td>
                    )}
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmt(values.imposto)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmt(product.custo)}</td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">{fmt(values.recebimentoTotal)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{values.margem.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right">{getMarginBadge(values.margemComImposto)}</td>
                    <td className="px-4 py-3 text-right text-foreground">{(product.peso / 1000).toFixed(2)} kg</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {isLoading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando produtos...</p>
          </div>
        )}
        {loadError && !isLoading && (
          <div className="text-center py-12">
            <p className="text-destructive text-sm">{loadError}</p>
          </div>
        )}
        {!isLoading && !loadError && filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum produto encontrado com os filtros aplicados</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-4">
          {filteredProducts.length} produto{filteredProducts.length !== 1 ? "s" : ""} exibido{filteredProducts.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
};

export default ProductsTable;
