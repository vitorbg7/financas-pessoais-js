// Gráfico de rosca desenhado direto no <canvas>, sem bibliotecas.
// As cores das categorias lembram as cédulas do real; o nome e o valor de cada
// categoria também aparecem em texto, então a cor nunca é a única informação.

export const COR_CATEGORIA = {
  Moradia: '#2F5D8A',
  'Alimentação': '#E0802B',
  Transporte: '#8A5FB0',
  Lazer: '#D9A21B',
  'Saúde': '#D0577A',
  'Educação': '#2E8B77',
  Assinaturas: '#6E7F8D',
  Outros: '#A3A39B',
};

/**
 * Desenha a rosca. `fatias` é uma lista de { categoria, total }.
 * Sem fatias, desenha só o anel vazio.
 */
export function desenharRosca(canvas, fatias) {
  const lado = canvas.clientWidth;
  if (lado === 0) return; // elemento escondido: nada para desenhar

  // Ajuste para telas de alta densidade (retina) ficarem nítidas.
  const escala = window.devicePixelRatio || 1;
  canvas.width = Math.round(lado * escala);
  canvas.height = Math.round(lado * escala);

  const ctx = canvas.getContext('2d');
  ctx.scale(escala, escala);
  ctx.clearRect(0, 0, lado, lado);

  const centro = lado / 2;
  const espessura = lado * 0.16;
  const raio = centro - espessura / 2 - 2;

  const corVazia = getComputedStyle(canvas).getPropertyValue('--linha').trim() || '#c9d6d0';
  const total = fatias.reduce((soma, f) => soma + f.total, 0);

  ctx.lineWidth = espessura;
  ctx.lineCap = 'butt';

  if (total === 0) {
    ctx.strokeStyle = corVazia;
    ctx.beginPath();
    ctx.arc(centro, centro, raio, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  const folga = fatias.length > 1 ? 0.03 : 0; // pequeno espaço entre fatias
  let inicio = -Math.PI / 2;
  for (const fatia of fatias) {
    const angulo = (fatia.total / total) * Math.PI * 2;
    ctx.strokeStyle = COR_CATEGORIA[fatia.categoria] ?? COR_CATEGORIA.Outros;
    ctx.beginPath();
    ctx.arc(centro, centro, raio, inicio + folga / 2, inicio + angulo - folga / 2);
    ctx.stroke();
    inicio += angulo;
  }
}
