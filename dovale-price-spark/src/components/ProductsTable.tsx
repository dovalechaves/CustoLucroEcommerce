import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { fetchProdutos, fetchCustoOperacional, CustoOperacionalItem } from "@/lib/api";
import { Input } from "@/components/ui/input";
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

const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  mercadolivre: "Mercado Livre",
  amazon: "Amazon",
  shopee: "Shopee",
};

const MARKETPLACE_FEES: Record<Marketplace, number> = {
  mercadolivre: 16.5,
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

  // Custo operacional
  const [custoOp, setCustoOp] = useState<Record<number, CustoOperacionalItem>>({});
  const [custoOpError, setCustoOpError] = useState<string | null>(null);
  const [valorParticipacao, setValorParticipacao] = useState(2000000);
  const [custoOpLoading, setCustoOpLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Busca custo operacional; re-executa com debounce quando valorParticipacao muda
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCustoOpLoading(true);
      setCustoOpError(null);
      fetchCustoOperacional(valorParticipacao)
        .then((data) => { setCustoOp(data); setCustoOpError(null); })
        .catch((e: Error) => { setCustoOp({}); setCustoOpError(e.message); })
        .finally(() => setCustoOpLoading(false));
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [valorParticipacao]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [marketplace, setMarketplace] = useState<Marketplace>("mercadolivre");
  const [descontoFrete, setDescontoFrete] = useState(0);

  const effectiveFeeRate = useMemo(() => {
    if (marketplace === "mercadolivre") {
      return 0.165;
    }
    return MARKETPLACE_FEES[marketplace] / 100;
  }, [marketplace]);

  const taxRate = 0.21;

  const getCalculatedValues = useCallback(
    (product: Product) => {
      const recebimento = product.precoFinal * (1 - product.percentualDesconto / 100);
      const taxa = recebimento * effectiveFeeRate;

      const freteBase =
        marketplace === "mercadolivre" && recebimento >= 79
          ? estimateShipping(recebimento, product.peso)
          : 0;
      const frete = freteBase * (1 - descontoFrete / 100);

      const imposto = recebimento * taxRate;

      const custoOpUnit = custoOp[Number(product.codigo)]?.custo_operacional_unit ?? 0;
      const custoReal = product.custo + custoOpUnit;

      const lucro = recebimento - taxa - frete - imposto - custoReal;

      const margem = recebimento > 0 ? ((recebimento - taxa - frete - custoReal) / recebimento) * 100 : 0;
      const margemComImposto = recebimento > 0 ? (lucro / recebimento) * 100 : 0;

      return { recebimento, taxa, frete, imposto, custoReal, lucro, margem, margemComImposto };
    },
    [effectiveFeeRate, marketplace, taxRate, custoOp, descontoFrete]
  );

  const updateProduct = (index: number, updates: Partial<Product>) => {
    setProducts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.codigo.includes(searchQuery.toLowerCase()) ||
        product.descricao.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [products, searchQuery]);

  const getMarginBadge = (margem: number) => {
    if (margem >= 0) return <Badge className="bg-green-100 text-green-800">{margem.toFixed(1)}%</Badge>;
    return <Badge className="bg-red-100 text-red-800">{margem.toFixed(1)}%</Badge>;
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const taxaLabel =
    marketplace === "mercadolivre"
      ? `Taxa ML (Premium 16,5%)`
      : marketplace === "amazon"
        ? "Amazon (15%)"
        : "Shopee (5%)";

  return (
    <div className="bg-card rounded-2xl p-8 shadow-sm">
        <h2 className="font-display text-xl font-bold tracking-tight text-foreground mb-8 uppercase">
          Tabela de Produtos
        </h2>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* Busca */}
          <div>
            <label className={labelClass}>Buscar</label>
            <Input
              type="text"
              placeholder="Código ou descrição..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
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
                {Object.entries(MARKETPLACE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronIcon />
            </div>
          </div>

          {/* Valor de Participação */}
          <div>
            <label className={labelClass}>
              Valor de Participação (R$)
              {custoOpLoading && (
                <span className="ml-2 text-primary font-normal normal-case tracking-normal">calculando...</span>
              )}
              {custoOpError && (
                <span className="ml-2 text-destructive font-normal normal-case tracking-normal" title={custoOpError}>
                  erro ao carregar
                </span>
              )}
            </label>
            <Input
              type="number"
              min="1"
              step="100000"
              value={valorParticipacao}
              onChange={(e) => setValorParticipacao(parseFloat(e.target.value) || 2000000)}
              className="w-full bg-secondary border-0 rounded-lg px-4 py-3.5 text-sm"
            />
          </div>

          {/* Desconto no Frete */}
          <div>
            <label className={labelClass}>Desconto no Frete (%)</label>
            <Input
              type="number"
              min="0"
              max="100"
              step="1"
              value={descontoFrete}
              onChange={(e) => setDescontoFrete(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
              className="w-full bg-secondary border-0 rounded-lg px-4 py-3.5 text-sm"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-foreground text-xs uppercase tracking-wider">Código</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground text-xs uppercase tracking-wider">Descrição</th>
                <th className="px-4 py-3 text-center font-semibold text-foreground text-xs uppercase tracking-wider">% Desc</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground text-xs uppercase tracking-wider">Preço Final</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">Preço</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">{taxaLabel}</th>
                {marketplace === "mercadolivre" && (
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">Frete (est.)</th>
                )}
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">Imposto</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">Custo</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">Custo Op.</th>
                <th className="px-4 py-3 text-right font-semibold text-primary text-xs uppercase tracking-wider">Custo Real</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground text-xs uppercase tracking-wider font-bold">Lucro R$</th>
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
                    <td className="px-4 py-3 text-foreground font-medium max-w-[200px] truncate" title={product.descricao}>{product.descricao}</td>
                    <td className="px-4 py-3 text-center">
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
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {(() => {
                        const c = custoOp[Number(product.codigo)];
                        if (!c || c.custo_operacional_unit == null) return <span>—</span>;
                        return fmt(c.custo_operacional_unit);
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-primary">
                      {fmt(values.custoReal)}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${values.lucro >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmt(values.lucro)}
                    </td>
                    <td className="px-4 py-3 text-right">{getMarginBadge(values.margemComImposto)}</td>
                    <td className="px-4 py-3 text-right text-foreground">{product.peso} g</td>
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
          Mostrando {filteredProducts.length} produtos
        </p>
    </div>
  );
};

export default ProductsTable;
