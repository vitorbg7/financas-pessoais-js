import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseValorEmCentavos,
  formatarMoeda,
  dataValida,
  deslocarMes,
  formatarMes,
  mesAtual,
  dataISOHoje,
  criarTransacao,
  ehTransacaoValida,
  filtrarPorMes,
  filtrar,
  ordenar,
  resumo,
  gastosPorCategoria,
  progressoLimite,
  paraCSV,
} from '../js/finance.js';
import { gerarDadosDeExemplo } from '../js/sample-data.js';

// Atalho para criar lançamentos nos testes.
let contador = 0;
const nova = (tipo, categoria, valor, data = '2026-10-10', descricao = 'Teste') =>
  criarTransacao({ descricao, valor, tipo, categoria, data }, { id: `id-${contador}`, agora: contador++ });

describe('parseValorEmCentavos', () => {
  test('entende o formato brasileiro', () => {
    assert.equal(parseValorEmCentavos('12,90'), 1290);
    assert.equal(parseValorEmCentavos('1.234,56'), 123456);
    assert.equal(parseValorEmCentavos('R$ 10'), 1000);
    assert.equal(parseValorEmCentavos('7,5'), 750);
  });

  test('aceita ponto decimal e números', () => {
    assert.equal(parseValorEmCentavos('19.99'), 1999);
    assert.equal(parseValorEmCentavos(7.9), 790);
  });

  test('não sofre com erro de ponto flutuante', () => {
    assert.equal(parseValorEmCentavos('0,10') + parseValorEmCentavos('0,20'), 30);
    assert.equal(parseValorEmCentavos(19.99), 1999); // 19.99 * 100 = 1998.9999999999998
    assert.equal(parseValorEmCentavos(0.07), 7); // 0.07 * 100 = 7.000000000000001
  });

  test('recusa meio centavo em vez de arredondar errado', () => {
    assert.throws(() => parseValorEmCentavos(1.005), /Valor inválido/);
    assert.throws(() => parseValorEmCentavos('1,005'), /Valor inválido/);
  });

  test('rejeita entradas inválidas', () => {
    for (const ruim of ['', '   ', 'abc', '12,345', '-5', '1,2,3', null, undefined, NaN]) {
      assert.throws(() => parseValorEmCentavos(ruim), /Informe um valor|Valor inválido/, `deveria rejeitar ${ruim}`);
    }
  });
});

describe('formatarMoeda', () => {
  test('formata em reais', () => {
    // O Intl usa espaço não separável entre "R$" e o número; normalizamos para comparar.
    assert.equal(formatarMoeda(123456).replace(/\s/g, ' '), 'R$ 1.234,56');
    assert.equal(formatarMoeda(0).replace(/\s/g, ' '), 'R$ 0,00');
  });
});

describe('datas', () => {
  test('dataValida', () => {
    assert.equal(dataValida('2026-02-28'), true);
    assert.equal(dataValida('2024-02-29'), true); // ano bissexto
    assert.equal(dataValida('2026-02-29'), false);
    assert.equal(dataValida('2026-13-01'), false);
    assert.equal(dataValida('26-10-10'), false);
    assert.equal(dataValida(''), false);
    assert.equal(dataValida(null), false);
  });

  test('deslocarMes atravessa o ano', () => {
    assert.equal(deslocarMes('2026-01', -1), '2025-12');
    assert.equal(deslocarMes('2026-12', 1), '2027-01');
    assert.equal(deslocarMes('2026-10', 0), '2026-10');
    assert.equal(deslocarMes('2026-03', -15), '2024-12');
  });

  test('formatarMes', () => {
    assert.equal(formatarMes('2026-10'), 'Outubro de 2026');
    assert.equal(formatarMes('2026-03'), 'Março de 2026');
  });

  test('mesAtual e dataISOHoje usam a data local', () => {
    const data = new Date(2026, 0, 5, 23, 59); // 5 de janeiro de 2026, local
    assert.equal(dataISOHoje(data), '2026-01-05');
    assert.equal(mesAtual(data), '2026-01');
  });
});

describe('criarTransacao', () => {
  test('cria um lançamento válido em centavos', () => {
    const t = nova('despesa', 'Alimentação', '312,45', '2026-10-04', '  Mercado  ');
    assert.equal(t.valorCentavos, 31245);
    assert.equal(t.descricao, 'Mercado');
    assert.equal(ehTransacaoValida(t), true);
  });

  test('valida os campos', () => {
    const base = { descricao: 'x', valor: '10', tipo: 'despesa', categoria: 'Lazer', data: '2026-10-10' };
    assert.throws(() => criarTransacao({ ...base, descricao: '  ' }), /descrição/);
    assert.throws(() => criarTransacao({ ...base, descricao: 'a'.repeat(61) }), /até 60/);
    assert.throws(() => criarTransacao({ ...base, tipo: 'doacao' }), /receita ou despesa/);
    assert.throws(() => criarTransacao({ ...base, categoria: 'Salário' }), /categoria/); // categoria de receita em despesa
    assert.throws(() => criarTransacao({ ...base, data: '2026-02-30' }), /data/);
    assert.throws(() => criarTransacao({ ...base, valor: '0' }), /maior que zero/);
    assert.throws(() => criarTransacao({ ...base, valor: '99999999999' }), /alto demais/);
  });

  test('ehTransacaoValida recusa dados corrompidos', () => {
    const boa = nova('receita', 'Salário', '100');
    assert.equal(ehTransacaoValida(boa), true);
    assert.equal(ehTransacaoValida(null), false);
    assert.equal(ehTransacaoValida({ ...boa, valorCentavos: 10.5 }), false);
    assert.equal(ehTransacaoValida({ ...boa, valorCentavos: -1 }), false);
    assert.equal(ehTransacaoValida({ ...boa, tipo: 'x' }), false);
    assert.equal(ehTransacaoValida({ ...boa, data: 'ontem' }), false);
  });
});

describe('consultas', () => {
  const lista = [
    nova('receita', 'Salário', '3000', '2026-10-05', 'Salário'),
    nova('despesa', 'Alimentação', '300,50', '2026-10-06', 'Mercado do João'),
    nova('despesa', 'Alimentação', '99,50', '2026-10-20', 'Restaurante'),
    nova('despesa', 'Transporte', '100', '2026-10-20', 'Ônibus'),
    nova('despesa', 'Lazer', '50', '2026-09-30', 'Cinema'),
  ];

  test('filtrarPorMes', () => {
    assert.equal(filtrarPorMes(lista, '2026-10').length, 4);
    assert.equal(filtrarPorMes(lista, '2026-09').length, 1);
    assert.equal(filtrarPorMes(lista, '2026-08').length, 0);
  });

  test('filtrar por tipo, categoria e busca (ignora acentos e maiúsculas)', () => {
    assert.equal(filtrar(lista, { tipo: 'receita' }).length, 1);
    assert.equal(filtrar(lista, { categoria: 'Alimentação' }).length, 2);
    assert.equal(filtrar(lista, { busca: 'onibus' }).length, 1); // "Ônibus"
    assert.equal(filtrar(lista, { busca: 'JOAO' }).length, 1); // "João"
    assert.equal(filtrar(lista, { tipo: 'despesa', categoria: 'Alimentação', busca: 'rest' }).length, 1);
    assert.equal(filtrar(lista, {}).length, 5);
  });

  test('ordenar: data mais recente primeiro, e o último adicionado antes no empate', () => {
    const ordenada = ordenar(lista);
    assert.deepEqual(
      ordenada.map((t) => t.descricao),
      ['Ônibus', 'Restaurante', 'Mercado do João', 'Salário', 'Cinema'],
    );
    // Não altera a lista original.
    assert.equal(lista[0].descricao, 'Salário');
  });

  test('resumo', () => {
    const r = resumo(filtrarPorMes(lista, '2026-10'));
    assert.deepEqual(r, { receitas: 300000, despesas: 50000, saldo: 250000 });
  });

  test('resumo de lista vazia', () => {
    assert.deepEqual(resumo([]), { receitas: 0, despesas: 0, saldo: 0 });
  });

  test('gastosPorCategoria ordena e calcula percentuais', () => {
    const gastos = gastosPorCategoria(filtrarPorMes(lista, '2026-10'));
    assert.deepEqual(gastos, [
      { categoria: 'Alimentação', total: 40000, percentual: 80 },
      { categoria: 'Transporte', total: 10000, percentual: 20 },
    ]);
  });

  test('gastosPorCategoria ignora receitas e lida com lista sem despesas', () => {
    assert.deepEqual(gastosPorCategoria([nova('receita', 'Salário', '10')]), []);
    assert.deepEqual(gastosPorCategoria([]), []);
  });
});

describe('progressoLimite', () => {
  test('dentro do limite', () => {
    assert.deepEqual(progressoLimite(50000, 200000), { percentual: 25, restante: 150000, estourou: false });
  });

  test('limite estourado', () => {
    assert.deepEqual(progressoLimite(250000, 200000), { percentual: 125, restante: -50000, estourou: true });
  });

  test('exatamente no limite não conta como estourado', () => {
    assert.equal(progressoLimite(200000, 200000).estourou, false);
  });

  test('sem limite definido devolve null', () => {
    assert.equal(progressoLimite(1000, 0), null);
    assert.equal(progressoLimite(1000, undefined), null);
  });
});

describe('paraCSV', () => {
  test('gera cabeçalho e linhas com valor em formato brasileiro', () => {
    const csv = paraCSV([nova('despesa', 'Lazer', '12,90', '2026-10-10', 'Cinema')]);
    assert.equal(csv, 'data;descricao;tipo;categoria;valor\r\n2026-10-10;Cinema;despesa;Lazer;12,90');
  });

  test('escapa ponto e vírgula e aspas', () => {
    const csv = paraCSV([nova('despesa', 'Outros', '1', '2026-10-10', 'Pão; "integral"')]);
    assert.match(csv, /"Pão; ""integral"""/);
  });

  test('neutraliza fórmulas (CSV injection)', () => {
    const csv = paraCSV([nova('despesa', 'Outros', '1', '2026-10-10', '=HYPERLINK("http://x")')]);
    assert.match(csv, /"'=HYPERLINK/);
    assert.doesNotMatch(csv, /;=HYPERLINK/);
  });
});

describe('dados de exemplo', () => {
  test('todos os lançamentos são válidos e nenhum fica no futuro', () => {
    const hoje = new Date(2026, 9, 3, 12); // 3 de outubro de 2026
    const dados = gerarDadosDeExemplo(hoje);
    assert.ok(dados.length > 10);
    for (const t of dados) {
      assert.equal(ehTransacaoValida(t), true, JSON.stringify(t));
      assert.ok(t.data <= dataISOHoje(hoje), `data no futuro: ${t.data}`);
    }
  });

  test('cobre o mês atual e o anterior', () => {
    const dados = gerarDadosDeExemplo(new Date(2026, 0, 20)); // janeiro: o anterior é dezembro de 2025
    assert.ok(filtrarPorMes(dados, '2026-01').length > 0);
    assert.ok(filtrarPorMes(dados, '2025-12').length > 0);
  });
});
