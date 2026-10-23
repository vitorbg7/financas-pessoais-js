// Persistência no navegador (localStorage).
// Toda leitura e escrita fica dentro de try/catch: o localStorage pode estar
// bloqueado (modo privado, política do navegador) ou cheio.

import { ehTransacaoValida } from './finance.js';

const CHAVE = 'financas-pessoais:v1';

const ESTADO_VAZIO = () => ({ transacoes: [], limite: 0 });

export function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return ESTADO_VAZIO();

    const dados = JSON.parse(bruto);
    return {
      // Descarta qualquer item corrompido em vez de quebrar o app inteiro.
      transacoes: Array.isArray(dados.transacoes) ? dados.transacoes.filter(ehTransacaoValida) : [],
      limite: Number.isSafeInteger(dados.limite) && dados.limite > 0 ? dados.limite : 0,
    };
  } catch {
    return ESTADO_VAZIO();
  }
}

/** Devolve true se salvou; false se o navegador não deixou. */
export function salvar({ transacoes, limite }) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ transacoes, limite }));
    return true;
  } catch {
    return false;
  }
}
