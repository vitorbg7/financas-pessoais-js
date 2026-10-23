// Interface do app: lê eventos, atualiza a tela e guarda os dados.
// Toda regra de negócio fica em finance.js; aqui só tem DOM.
// Textos digitados pelo usuário entram na página com textContent (nunca innerHTML),
// para que ninguém consiga injetar HTML ou scripts pela descrição de um lançamento.

import {
  CATEGORIAS,
  centavosParaTexto,
  criarTransacao,
  dataISOHoje,
  deslocarMes,
  filtrar,
  filtrarPorMes,
  formatarMes,
  formatarMoeda,
  gastosPorCategoria,
  mesAtual,
  mesDe,
  ordenar,
  paraCSV,
  parseValorEmCentavos,
  progressoLimite,
  resumo,
} from './finance.js';
import { carregar, salvar } from './storage.js';
import { COR_CATEGORIA, desenharRosca } from './chart.js';
import { gerarDadosDeExemplo } from './sample-data.js';

const $ = (id) => document.getElementById(id);

const estado = {
  ...carregar(), // { transacoes, limite }
  mes: mesAtual(),
  filtros: { busca: '', tipo: 'todos', categoria: 'todas' },
};

let fatiasAtuais = [];
let ultimaExcluida = null;
let acaoDoAviso = null;
let temporizadorDoAviso = null;

// ---------- Persistência e avisos ----------

function persistir() {
  if (!salvar(estado)) {
    avisar('Não foi possível salvar neste navegador. Os dados vão sumir quando você fechar a página.');
  }
}

function avisar(texto, { rotulo, aoClicar } = {}) {
  clearTimeout(temporizadorDoAviso);
  $('aviso-texto').textContent = texto;
  acaoDoAviso = aoClicar ?? null;
  $('aviso-acao').hidden = !aoClicar;
  if (aoClicar) $('aviso-acao').textContent = rotulo;
  $('aviso').hidden = false;
  temporizadorDoAviso = setTimeout(() => {
    $('aviso').hidden = true;
    acaoDoAviso = null;
  }, aoClicar ? 8000 : 4500);
}

// ---------- Desenho da tela ----------

function render() {
  const doMes = filtrarPorMes(estado.transacoes, estado.mes);
  $('mes-nome').textContent = formatarMes(estado.mes);
  renderResumo(doMes);
  renderLista(doMes);
  renderGastos(doMes);
  renderLimite(doMes);
}

function renderResumo(doMes) {
  const { receitas, despesas, saldo } = resumo(doMes);

  $('saldo-valor').textContent = formatarMoeda(saldo);
  $('saldo-valor').classList.toggle('negativo', saldo < 0);
  $('total-receitas').textContent = formatarMoeda(receitas);
  $('total-despesas').textContent = formatarMoeda(despesas);

  // Barra: parte vermelha = quanto do que entrou já saiu.
  let percentual = 0;
  let descricao = 'Nenhum lançamento neste mês';
  if (doMes.length > 0) {
    percentual = receitas > 0 ? Math.min(100, (despesas / receitas) * 100) : 100;
    if (receitas === 0) descricao = 'Neste mês há só despesas';
    else if (despesas > receitas) descricao = 'As despesas passaram do que entrou neste mês';
    else descricao = `Você gastou ${Math.round(percentual)}% do que entrou neste mês`;
  }
  $('barra').classList.toggle('vazia', doMes.length === 0);
  $('barra').setAttribute('aria-label', descricao);
  $('barra-gasto').style.width = `${percentual}%`;
}

function renderLista(doMes) {
  const visiveis = ordenar(filtrar(doMes, estado.filtros));
  const lista = $('lancamentos');
  lista.replaceChildren(...visiveis.map(criarItem));

  const vazio = $('vazio');
  vazio.hidden = visiveis.length > 0;
  if (visiveis.length === 0) {
    const semNada = doMes.length === 0;
    $('vazio-texto').textContent = semNada
      ? `Nenhum lançamento em ${formatarMes(estado.mes)}. Adicione o primeiro no formulário ou carregue dados de exemplo.`
      : 'Nenhum lançamento encontrado com esses filtros.';
    $('carregar-exemplo').hidden = !semNada;
  }
}

function criarItem(t) {
  const item = document.createElement('li');
  item.dataset.id = t.id;

  const data = document.createElement('span');
  data.className = 'data';
  data.textContent = `${t.data.slice(8, 10)}/${t.data.slice(5, 7)}`;

  const descricao = document.createElement('span');
  descricao.className = 'descricao';
  descricao.textContent = t.descricao;

  const categoria = document.createElement('span');
  categoria.className = 'categoria';
  const ponto = document.createElement('span');
  ponto.className = 'ponto';
  ponto.style.background = t.tipo === 'despesa' ? (COR_CATEGORIA[t.categoria] ?? COR_CATEGORIA.Outros) : 'var(--receita)';
  ponto.setAttribute('aria-hidden', 'true');
  categoria.append(ponto, t.categoria);

  const valor = document.createElement('span');
  valor.className = `valor ${t.tipo}`;
  valor.textContent = `${t.tipo === 'despesa' ? '-' : '+'}${formatarMoeda(t.valorCentavos)}`;

  const excluir = document.createElement('button');
  excluir.type = 'button';
  excluir.className = 'excluir';
  excluir.textContent = 'Excluir';
  excluir.setAttribute('aria-label', `Excluir ${t.descricao}`);

  item.append(data, descricao, categoria, valor, excluir);
  return item;
}

function renderGastos(doMes) {
  fatiasAtuais = gastosPorCategoria(doMes);
  const totalDespesas = fatiasAtuais.reduce((soma, f) => soma + f.total, 0);

  $('rosca-total').textContent = formatarMoeda(totalDespesas);
  desenharRosca($('rosca'), fatiasAtuais);

  const itens = fatiasAtuais.map((fatia) => {
    const li = document.createElement('li');

    const ponto = document.createElement('span');
    ponto.className = 'ponto';
    ponto.style.background = COR_CATEGORIA[fatia.categoria] ?? COR_CATEGORIA.Outros;
    ponto.setAttribute('aria-hidden', 'true');

    const nome = document.createElement('span');
    nome.textContent = fatia.categoria;

    const percentual = document.createElement('span');
    percentual.className = 'percentual';
    percentual.textContent = `${fatia.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

    const valor = document.createElement('span');
    valor.className = 'valor';
    valor.textContent = formatarMoeda(fatia.total);

    li.append(ponto, nome, percentual, valor);
    return li;
  });
  $('legenda').replaceChildren(...itens);
  $('legenda-vazia').hidden = fatiasAtuais.length > 0;
}

function renderLimite(doMes) {
  const { despesas } = resumo(doMes);
  const progresso = progressoLimite(despesas, estado.limite);
  const barra = $('limite-progresso');
  const texto = $('limite-texto');

  barra.hidden = progresso === null;
  texto.classList.toggle('estourou', progresso?.estourou ?? false);
  barra.classList.toggle('estourou', progresso?.estourou ?? false);

  if (progresso === null) {
    texto.textContent = 'Defina um máximo para acompanhar seus gastos do mês.';
    return;
  }

  barra.value = Math.min(100, progresso.percentual);
  texto.textContent = progresso.estourou
    ? `Limite estourado em ${formatarMoeda(-progresso.restante)}.`
    : `Você usou ${progresso.percentual}% do limite. Restam ${formatarMoeda(progresso.restante)}.`;
}

// ---------- Formulário de novo lançamento ----------

function tipoSelecionado() {
  return document.querySelector('input[name="tipo"]:checked').value;
}

function preencherCategorias(tipo) {
  const select = $('categoria');
  select.replaceChildren(...CATEGORIAS[tipo].map((nome) => new Option(nome, nome)));
}

$('form').addEventListener('change', (evento) => {
  if (evento.target.name === 'tipo') preencherCategorias(tipoSelecionado());
});

$('form').addEventListener('submit', (evento) => {
  evento.preventDefault();
  $('erro-form').textContent = '';

  try {
    const transacao = criarTransacao({
      descricao: $('descricao').value,
      valor: $('valor').value,
      tipo: tipoSelecionado(),
      categoria: $('categoria').value,
      data: $('data').value,
    });

    estado.transacoes.push(transacao);
    persistir();

    // Se o lançamento é de outro mês, mostra esse mês para a pessoa ver o resultado.
    const mesDoLancamento = mesDe(transacao.data);
    if (mesDoLancamento !== estado.mes) {
      estado.mes = mesDoLancamento;
      avisar(`Lançamento adicionado em ${formatarMes(mesDoLancamento)}.`);
    } else {
      avisar('Lançamento adicionado.');
    }

    $('descricao').value = '';
    $('valor').value = '';
    $('descricao').focus();
    render();
  } catch (erro) {
    $('erro-form').textContent = erro.message;
  }
});

// ---------- Limite de gastos ----------

$('form-limite').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const bruto = $('limite-valor').value.trim();

  if (bruto === '') {
    estado.limite = 0;
    avisar('Limite removido.');
  } else {
    try {
      const centavos = parseValorEmCentavos(bruto);
      if (centavos <= 0) throw new Error('O limite deve ser maior que zero.');
      estado.limite = centavos;
      avisar('Limite salvo.');
    } catch (erro) {
      avisar(erro.message);
      return;
    }
  }
  persistir();
  render();
});

// ---------- Lista: filtros, excluir, desfazer ----------

$('busca').addEventListener('input', (evento) => {
  estado.filtros.busca = evento.target.value;
  render();
});

$('filtro-tipo').addEventListener('change', (evento) => {
  estado.filtros.tipo = evento.target.value;
  render();
});

$('filtro-categoria').addEventListener('change', (evento) => {
  estado.filtros.categoria = evento.target.value;
  render();
});

$('lancamentos').addEventListener('click', (evento) => {
  const botao = evento.target.closest('.excluir');
  if (!botao) return;

  const id = botao.closest('li').dataset.id;
  const indice = estado.transacoes.findIndex((t) => t.id === id);
  if (indice === -1) return;

  const [removida] = estado.transacoes.splice(indice, 1);
  ultimaExcluida = { transacao: removida, indice };
  persistir();
  render();

  // O botão clicado sumiu: leva o foco para o título da lista (quem usa teclado não se perde).
  $('lista-titulo').tabIndex = -1;
  $('lista-titulo').focus();
  avisar('Lançamento excluído.', { rotulo: 'Desfazer', aoClicar: desfazerExclusao });
});

function desfazerExclusao() {
  if (!ultimaExcluida) return;
  const { transacao, indice } = ultimaExcluida;
  estado.transacoes.splice(Math.min(indice, estado.transacoes.length), 0, transacao);
  ultimaExcluida = null;
  persistir();
  render();
  avisar('Lançamento restaurado.');
}

$('aviso-acao').addEventListener('click', () => acaoDoAviso?.());

// ---------- Mês, exemplo, exportar e apagar ----------

$('mes-anterior').addEventListener('click', () => {
  estado.mes = deslocarMes(estado.mes, -1);
  render();
});

$('mes-proximo').addEventListener('click', () => {
  estado.mes = deslocarMes(estado.mes, 1);
  render();
});

$('carregar-exemplo').addEventListener('click', () => {
  estado.transacoes.push(...gerarDadosDeExemplo());
  persistir();
  render();
  avisar('Dados de exemplo carregados.');
});

$('exportar').addEventListener('click', () => {
  const doMes = filtrarPorMes(estado.transacoes, estado.mes);
  if (doMes.length === 0) {
    avisar('Não há lançamentos neste mês para exportar.');
    return;
  }
  // O BOM (﻿) faz o Excel abrir os acentos corretamente.
  const arquivo = new Blob(['﻿', paraCSV(doMes)], { type: 'text/csv;charset=utf-8' });
  const endereco = URL.createObjectURL(arquivo);
  const link = document.createElement('a');
  link.href = endereco;
  link.download = `lancamentos-${estado.mes}.csv`;
  link.click();
  URL.revokeObjectURL(endereco);
});

$('apagar-tudo').addEventListener('click', () => {
  $('dialogo-apagar').returnValue = '';
  $('dialogo-apagar').showModal();
});

$('dialogo-apagar').addEventListener('close', () => {
  if ($('dialogo-apagar').returnValue !== 'apagar') return;
  estado.transacoes = [];
  estado.limite = 0;
  ultimaExcluida = null;
  $('limite-valor').value = '';
  persistir();
  render();
  avisar('Todos os dados foram apagados.');
});

// ---------- Redesenho do gráfico ----------

// A rosca é um canvas: precisa ser redesenhada quando o tamanho ou o tema (claro/escuro) mudam.
const redesenharRosca = () => desenharRosca($('rosca'), fatiasAtuais);
new ResizeObserver(redesenharRosca).observe($('rosca'));
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redesenharRosca);

// ---------- Início ----------

function iniciar() {
  preencherCategorias('despesa');

  const categoriasDosFiltros = [...new Set([...CATEGORIAS.despesa, ...CATEGORIAS.receita])];
  $('filtro-categoria').replaceChildren(
    new Option('Todas', 'todas'),
    ...categoriasDosFiltros.map((nome) => new Option(nome, nome)),
  );

  $('data').value = dataISOHoje();
  if (estado.limite > 0) $('limite-valor').value = centavosParaTexto(estado.limite);
  render();
}

iniciar();
