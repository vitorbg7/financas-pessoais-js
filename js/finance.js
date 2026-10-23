// Lógica de negócio do app de finanças.
// Módulo puro: não usa DOM nem localStorage, então roda no navegador e no Node
// (é por isso que dá pra testar com `node --test`).
//
// Regra de ouro: dinheiro é guardado em CENTAVOS (número inteiro), nunca em
// decimal, para evitar erros como 0.1 + 0.2 = 0.30000000000000004.

export const TIPOS = ['receita', 'despesa'];

export const CATEGORIAS = {
  despesa: ['Moradia', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Assinaturas', 'Outros'],
  receita: ['Salário', 'Freelance', 'Investimentos', 'Outros'],
};

export const LIMITE_DESCRICAO = 60;
export const VALOR_MAXIMO = 100_000_000_000; // R$ 1 bilhão, em centavos

// ---------- Valores e moeda ----------

/**
 * Converte o que o usuário digitou ("1.234,56", "12,5", "R$ 10", 7.9) em centavos.
 * Lança Error com mensagem amigável se o valor não fizer sentido.
 */
export function parseValorEmCentavos(entrada) {
  // Números passam pelo mesmo validador do texto. Multiplicar por 100 e arredondar
  // daria erro em casos como 1.005 (que vira 100.49999...).
  let texto = String(entrada ?? '').trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!texto) throw new Error('Informe um valor.');

  // Formato brasileiro: ponto separa milhar e vírgula separa centavos.
  if (texto.includes(',')) texto = texto.replace(/\./g, '').replace(',', '.');

  if (!/^\d+(\.\d{1,2})?$/.test(texto)) throw new Error('Valor inválido. Use o formato 1234,56.');

  const [reais, centavos = ''] = texto.split('.');
  return Number(reais) * 100 + Number(centavos.padEnd(2, '0'));
}

const FORMATO_MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatarMoeda(centavos) {
  return FORMATO_MOEDA.format(centavos / 100);
}

/** 1290 -> "12,90" (sem símbolo, usado no CSV). */
export function centavosParaTexto(centavos) {
  return `${Math.floor(centavos / 100)},${String(centavos % 100).padStart(2, '0')}`;
}

// ---------- Datas (sempre como texto "AAAA-MM-DD", sem fuso horário) ----------

export function dataValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [ano, mes, dia] = texto.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

const doisDigitos = (n) => String(n).padStart(2, '0');

export function dataISOHoje(hoje = new Date()) {
  return `${hoje.getFullYear()}-${doisDigitos(hoje.getMonth() + 1)}-${doisDigitos(hoje.getDate())}`;
}

/** "2026-10-23" -> "2026-10" */
export function mesDe(data) {
  return data.slice(0, 7);
}

export function mesAtual(hoje = new Date()) {
  return mesDe(dataISOHoje(hoje));
}

/** deslocarMes("2026-01", -1) -> "2025-12" */
export function deslocarMes(mes, delta) {
  const [ano, numero] = mes.split('-').map(Number);
  const total = ano * 12 + (numero - 1) + delta;
  return `${Math.floor(total / 12)}-${doisDigitos((total % 12) + 1)}`;
}

/** "2026-10" -> "Outubro de 2026" */
export function formatarMes(mes) {
  const [ano, numero] = mes.split('-').map(Number);
  const texto = new Date(Date.UTC(ano, numero - 1, 1)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// ---------- Lançamentos ----------

export function gerarId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Valida os dados do formulário e devolve um lançamento pronto para guardar.
 * `opcoes` existe só para os testes poderem fixar id e horário.
 */
export function criarTransacao(dados, { id = gerarId(), agora = Date.now() } = {}) {
  const descricao = String(dados.descricao ?? '').trim();
  if (!descricao) throw new Error('Informe uma descrição.');
  if (descricao.length > LIMITE_DESCRICAO) {
    throw new Error(`A descrição pode ter até ${LIMITE_DESCRICAO} caracteres.`);
  }
  if (!TIPOS.includes(dados.tipo)) throw new Error('Escolha receita ou despesa.');
  if (!CATEGORIAS[dados.tipo].includes(dados.categoria)) throw new Error('Escolha uma categoria válida.');
  if (!dataValida(dados.data)) throw new Error('Informe uma data válida.');

  const valorCentavos = parseValorEmCentavos(dados.valor);
  if (valorCentavos <= 0) throw new Error('O valor deve ser maior que zero.');
  if (valorCentavos > VALOR_MAXIMO) throw new Error('Esse valor é alto demais.');

  return {
    id,
    descricao,
    valorCentavos,
    tipo: dados.tipo,
    categoria: dados.categoria,
    data: dados.data,
    criadoEm: agora,
  };
}

/** Confere se um objeto vindo do localStorage tem o formato esperado. */
export function ehTransacaoValida(t) {
  return (
    typeof t === 'object' &&
    t !== null &&
    typeof t.id === 'string' &&
    typeof t.descricao === 'string' &&
    t.descricao.trim() !== '' &&
    Number.isSafeInteger(t.valorCentavos) &&
    t.valorCentavos > 0 &&
    TIPOS.includes(t.tipo) &&
    CATEGORIAS[t.tipo].includes(t.categoria) &&
    dataValida(t.data)
  );
}

// ---------- Consultas e relatórios ----------

export function filtrarPorMes(transacoes, mes) {
  return transacoes.filter((t) => mesDe(t.data) === mes);
}

const normalizar = (texto) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Filtros da lista: tipo ('todos' | 'receita' | 'despesa'), categoria ('todas' | nome) e busca por texto. */
export function filtrar(transacoes, { tipo = 'todos', categoria = 'todas', busca = '' } = {}) {
  const termo = normalizar(busca.trim());
  return transacoes.filter(
    (t) =>
      (tipo === 'todos' || t.tipo === tipo) &&
      (categoria === 'todas' || t.categoria === categoria) &&
      (termo === '' || normalizar(t.descricao).includes(termo)),
  );
}

/** Mais recentes primeiro; na mesma data, o último adicionado aparece antes. */
export function ordenar(transacoes) {
  return [...transacoes].sort((a, b) => b.data.localeCompare(a.data) || (b.criadoEm ?? 0) - (a.criadoEm ?? 0));
}

export function resumo(transacoes) {
  let receitas = 0;
  let despesas = 0;
  for (const t of transacoes) {
    if (t.tipo === 'receita') receitas += t.valorCentavos;
    else despesas += t.valorCentavos;
  }
  return { receitas, despesas, saldo: receitas - despesas };
}

/** Despesas somadas por categoria, da maior para a menor, com percentual (uma casa decimal). */
export function gastosPorCategoria(transacoes) {
  const totais = new Map();
  let totalGeral = 0;
  for (const t of transacoes) {
    if (t.tipo !== 'despesa') continue;
    totais.set(t.categoria, (totais.get(t.categoria) ?? 0) + t.valorCentavos);
    totalGeral += t.valorCentavos;
  }
  return [...totais.entries()]
    .map(([categoria, total]) => ({
      categoria,
      total,
      percentual: Math.round((total / totalGeral) * 1000) / 10,
    }))
    .sort((a, b) => b.total - a.total);
}

/** Quanto do limite mensal de gastos já foi usado. Devolve null se não há limite definido. */
export function progressoLimite(gastoCentavos, limiteCentavos) {
  if (!(limiteCentavos > 0)) return null;
  return {
    percentual: Math.round((gastoCentavos / limiteCentavos) * 100),
    restante: limiteCentavos - gastoCentavos,
    estourou: gastoCentavos > limiteCentavos,
  };
}

// ---------- Exportação ----------

// Células que começam com = + - @ podem virar fórmulas no Excel (CSV injection).
// O apóstrofo força o Excel a tratar como texto.
function campoCSV(valor) {
  let texto = String(valor);
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  if (/[;"\n\r]/.test(texto)) texto = `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

/** CSV com ponto e vírgula (padrão do Excel em português). */
export function paraCSV(transacoes) {
  const linhas = [['data', 'descricao', 'tipo', 'categoria', 'valor'].join(';')];
  for (const t of ordenar(transacoes)) {
    linhas.push(
      [t.data, t.descricao, t.tipo, t.categoria, centavosParaTexto(t.valorCentavos)].map(campoCSV).join(';'),
    );
  }
  return linhas.join('\r\n');
}
