// Dados de exemplo para testar o app rapidamente (botão "Carregar exemplo").
// Gera lançamentos do mês atual e do anterior, então sempre parecem recentes.

import { criarTransacao, deslocarMes, mesAtual } from './finance.js';

// [mesesAtras, dia, tipo, categoria, descricao, valor]
const MODELO = [
  [0, 2, 'despesa', 'Moradia', 'Aluguel', '1100,00'],
  [0, 3, 'despesa', 'Assinaturas', 'Internet', '99,90'],
  [0, 4, 'despesa', 'Alimentação', 'Mercado', '312,45'],
  [0, 5, 'receita', 'Salário', 'Salário', '3200,00'],
  [0, 6, 'despesa', 'Transporte', 'Combustível', '180,00'],
  [0, 8, 'receita', 'Freelance', 'Bot de Discord para cliente', '450,00'],
  [0, 9, 'despesa', 'Lazer', 'Cinema', '54,00'],
  [0, 10, 'despesa', 'Assinaturas', 'Streaming', '39,90'],
  [0, 12, 'despesa', 'Educação', 'Curso de inglês', '189,00'],
  [0, 14, 'despesa', 'Alimentação', 'Restaurante', '68,50'],
  [0, 15, 'despesa', 'Saúde', 'Farmácia', '42,30'],

  [1, 2, 'despesa', 'Moradia', 'Aluguel', '1100,00'],
  [1, 3, 'despesa', 'Assinaturas', 'Internet', '99,90'],
  [1, 5, 'receita', 'Salário', 'Salário', '3200,00'],
  [1, 7, 'despesa', 'Alimentação', 'Mercado', '358,10'],
  [1, 11, 'despesa', 'Transporte', 'Combustível', '210,00'],
  [1, 13, 'despesa', 'Lazer', 'Show', '120,00'],
  [1, 18, 'despesa', 'Educação', 'Curso de inglês', '189,00'],
  [1, 22, 'receita', 'Freelance', 'Site para loja', '600,00'],
  [1, 25, 'despesa', 'Saúde', 'Consulta', '150,00'],
];

export function gerarDadosDeExemplo(hoje = new Date()) {
  const atual = mesAtual(hoje);
  const agora = hoje.getTime();

  return MODELO.map(([mesesAtras, dia, tipo, categoria, descricao, valor], indice) => {
    const mes = deslocarMes(atual, -mesesAtras);
    // No mês corrente, não cria lançamentos com data no futuro.
    const diaFinal = mesesAtras === 0 ? Math.min(dia, hoje.getDate()) : dia;
    const data = `${mes}-${String(diaFinal).padStart(2, '0')}`;
    return criarTransacao({ descricao, valor, tipo, categoria, data }, { agora: agora + indice });
  });
}
