import { useState, useMemo, useCallback, useEffect } from "react";
import { fetchProduto } from "@/lib/api";
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
  ddf: number;
  mercadoLivre: number;
  imposto: number;
}

const LISTING_FEES: Record<string, number> = {
  gold_pro: 16.5,
  gold_special: 14,
  free: 0,
};

const REGIME_TAXES: Record<string, number> = {
  mei: 3,
  simples: 6,
  presumido: 8,
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

const ProductsTable = () => {
  const [products, setProducts] = useState<Product[]>([
    {
      codigo: "10550",
      descricao: "CORRENTE ENCAPADA 5X500MM AMARELO",
      percentualDesconto: 0,
      precoFinal: 50,
      custo: 15,
      peso: 500,
      ddf: 0,
      mercadoLivre: 0,
      imposto: 0,
    },
    {
      codigo: "10551",
      descricao: "CORRENTE ENCAPADA 5X1000MM VERMELHO",
      percentualDesconto: 0,
      precoFinal: 75,
      custo: 20,
      peso: 1000,
      ddf: 0,
      mercadoLivre: 0,
      imposto: 0,
    },
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [marginFilter, setMarginFilter] = useState<[number, number]>([0, 100]);
  const [listingType] = useState("gold_pro");
  const [regimeTributario] = useState("presumido");

  const fees = LISTING_FEES[listingType];
  const taxes = REGIME_TAXES[regimeTributario];

  // Calculate all values for a product
  const calculateProduct = useCallback((product: Product): Product => {
    const custo = product.custo;
    const precoFinal = product.precoFinal;
    const percentualDesconto = product.percentualDesconto;
    const peso = product.peso;

    // RECEBIMENTO = PREÇO FINAL × (1 - % / 100)
    const recebimento = precoFinal * (1 - percentualDesconto / 100);

    // DDF (usando Shopee como referência, taxa de 5%)
    const ddf = recebimento * 0.05;

    // MERC. LIVRE (taxa de 16.5%)
    const mercadoLivre = recebimento * 0.165;

    // IMPOSTO (8% para Lucro Presumido)
    const imposto = recebimento * 0.08;

    // RECEBIMENTO TOTAL = RECEBIMENTO - DDF
    const recebimentoTotal = recebimento - ddf;

    // MARGEM = ((RECEBIMENTO TOTAL - CUSTO) / RECEBIMENTO TOTAL) * 100
    const margem = recebimentoTotal > 0 ? ((recebimentoTotal - custo) / recebimentoTotal) * 100 : 0;

    // MARGEM C/ IMPOSTO = ((RECEBIMENTO TOTAL - CUSTO - IMPOSTO) / RECEBIMENTO TOTAL) * 100
    const margemComImposto = recebimentoTotal > 0 ? ((recebimentoTotal - custo - imposto) / recebimentoTotal) * 100 : 0;

    return {
      ...product,
      ddf,
      mercadoLivre,
      imposto,
    };
  }, []);

  // Update product when values change
  const updateProduct = useCallback((index: number, updates: Partial<Product>) => {
    setProducts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      updated[index] = calculateProduct(updated[index]);
      return updated;
    });
  }, [calculateProduct]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = 
        product.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.descricao.toLowerCase().includes(searchQuery.toLowerCase());

      const recebimento = product.precoFinal * (1 - product.percentualDesconto / 100);
      const ddf = recebimento * 0.05;
      const recebimentoTotal = recebimento - ddf;
      const imposto = recebimento * 0.08;
      const margemComImposto = recebimentoTotal > 0 ? ((recebimentoTotal - product.custo - imposto) / recebimentoTotal) * 100 : 0;

      const matchesMargin = margemComImposto >= marginFilter[0] && margemComImposto <= marginFilter[1];

      return matchesSearch && matchesMargin;
    });
  }, [products, searchQuery, marginFilter]);

  // Get margin color badge
  const getMarginBadge = (margem: number) => {
    if (margem > 40) return <Badge className="bg-green-100 text-green-800">{margem.toFixed(1)}%</Badge>;
    if (margem >= 20) return <Badge className="bg-yellow-100 text-yellow-800">{margem.toFixed(1)}%</Badge>;
    return <Badge className="bg-red-100 text-red-800">{margem.toFixed(1)}%</Badge>;
  };

  // Format currency
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Get calculated values for display
  const getCalculatedValues = (product: Product) => {
    const recebimento = product.precoFinal * (1 - product.percentualDesconto / 100);
    const ddf = recebimento * 0.05;
    const mercadoLivre = recebimento * 0.165;
    const imposto = recebimento * 0.08;
    const recebimentoTotal = recebimento - ddf;
    const margem = recebimentoTotal > 0 ? ((recebimentoTotal - product.custo) / recebimentoTotal) * 100 : 0;
    const margemComImposto = recebimentoTotal > 0 ? ((recebimentoTotal - product.custo - imposto) / recebimentoTotal) * 100 : 0;

    return {
      recebimento,
      ddf,
      mercadoLivre,
      imposto,
      recebimentoTotal,
      margem,
      margemComImposto,
    };
  };

  return (
    <div className="w-full max-w-full mx-auto animate-fade-up-delay-1">
      <div className="bg-card rounded-2xl p-8 shadow-[0_1px_3px_hsl(240_10%_80%/0.3),0_8px_32px_hsl(240_10%_80%/0.12)] transition-shadow duration-300 hover:shadow-[0_2px_6px_hsl(240_10%_80%/0.35),0_12px_40px_hsl(240_10%_80%/0.18)]">
        <h2 className="font-display text-xl font-bold tracking-tight text-foreground mb-8 uppercase">
          Tabela de Produtos
        </h2>

        {/* Filters */}
        <div className="space-y-4 mb-8">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 block">
              Buscar (Código ou Descrição)
            </label>
            <Input
              type="text"
              placeholder="Digite o código ou descrição..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-secondary border-0 rounded-lg px-4 py-3.5 text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 block">
              Margem c/ Imposto (%)
            </label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Mín"
                value={marginFilter[0]}
                onChange={(e) => setMarginFilter([parseFloat(e.target.value) || 0, marginFilter[1]])}
                className="w-full bg-secondary border-0 rounded-lg px-4 py-3.5 text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
              />
              <Input
                type="number"
                placeholder="Máx"
                value={marginFilter[1]}
                onChange={(e) => setMarginFilter([marginFilter[0], parseFloat(e.target.value) || 100])}
                className="w-full bg-secondary border-0 rounded-lg px-4 py-3.5 text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
              />
            </div>
          </div>

          <Button
            onClick={() => {
              setSearchQuery("");
              setMarginFilter([0, 100]);
            }}
            variant="outline"
            className="w-full"
          >
            Resetar Filtros
          </Button>
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
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">DDF</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">Merc. Livre</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">Custo</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">Margem</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">Imposto</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground font-bold text-xs uppercase tracking-wider">Recebimento Total</th>
                <th className="px-4 py-3 text-right font-semibold text-primary text-xs uppercase tracking-wider">Margem c/ Imposto</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground text-xs uppercase tracking-wider">Peso</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product, index) => {
                const values = getCalculatedValues(product);
                const actualIndex = products.findIndex(p => p.codigo === product.codigo);

                return (
                  <tr key={index} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
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
                        className="w-16 bg-secondary border-0 rounded px-2 py-1 text-sm text-center text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={product.precoFinal}
                        onChange={(e) => updateProduct(actualIndex, { precoFinal: parseFloat(e.target.value) || 0 })}
                        className="w-24 bg-secondary border-0 rounded px-2 py-1 text-sm text-right text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmt(values.recebimento)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmt(values.ddf)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmt(values.mercadoLivre)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmt(product.custo)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{values.margem.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmt(values.imposto)}</td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">{fmt(values.recebimentoTotal)}</td>
                    <td className="px-4 py-3 text-right">
                      {getMarginBadge(values.margemComImposto)}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">{(product.peso / 1000).toFixed(2)} kg</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum produto encontrado com os filtros aplicados</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsTable;
