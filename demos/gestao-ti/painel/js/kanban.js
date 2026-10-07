/**
 * Kanban: colunas configuráveis (CTI_COLUNA), filtros e arrastar e soltar.
 *
 * O quadro é repintado a cada mudança de estado; os eventos ficam na raiz
 * (delegação), então não se acumulam. A movimentação é otimista: a tela
 * muda na hora e volta atrás se o servidor recusar.
 */
var CtiKanban = (function () {
  'use strict';

  var u = CtiUtil;
  var filtro = { resp: '', setor: '', prioridade: '' };
  var movendo = false;

  function iniciar() {
    CtiApp.aoMudar(function (parte) {
      if (parte === 'config' || parte === 'demandas') { pintarFiltros(); }
      if (parte === 'demandas' || parte === 'config') { pintar(); }
    });
    ['resp', 'setor', 'prioridade'].forEach(function (campo) {
      u.el('kb-' + campo).addEventListener('change', function (e) {
        filtro[campo] = e.target.value;
        pintar();
      });
    });
    u.el('kb-dias').addEventListener('change', pintar);
    u.el('kb-limpar').addEventListener('click', function () {
      filtro = { resp: '', setor: '', prioridade: '' };
      u.el('kb-prioridade').value = '';
      pintarFiltros();
      pintar();
    });

    var quadro = u.el('kb-quadro');
    quadro.addEventListener('click', function (e) {
      var add = e.target.closest('[data-add]');
      if (add) {
        CtiDemanda.formulario(null, add.dataset.add);
        return;
      }
      var card = e.target.closest('.g-card');
      if (card) { CtiDemanda.abrir(Number(card.dataset.id)); }
    });
    quadro.addEventListener('keydown', function (e) {
      var card = e.target.closest('.g-card');
      if (card && e.target === card && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        CtiDemanda.abrir(Number(card.dataset.id));
      }
    });
    CtiDnd.ativar({
      raiz: quadro,
      seletorCard: '.g-card',
      seletorLista: '.g-coluna__lista',
      aoSoltar: mover
    });
  }

  function pintarFiltros() {
    var resp = u.el('kb-resp');
    resp.innerHTML = u.opcao('', 'Todos', filtro.resp) + u.opcao('eu', 'Minhas demandas', filtro.resp) +
      u.opcao('sem', 'Sem responsável', filtro.resp) +
      CtiApp.opcoes('responsaveis', /^\d+$/.test(filtro.resp) ? filtro.resp : null, null);
    u.el('kb-setor').innerHTML = CtiApp.opcoes('setores', filtro.setor, 'Todos');
    u.el('kb-prioridade').innerHTML = CtiApp.opcoesPrioridade(filtro.prioridade, 'Todas');
  }

  /** Concluída há mais dias que o recorte do quadro (0 = todas) fica fora do Kanban. */
  function concluidaAntiga(d) {
    var dias = Number(u.el('kb-dias').value);
    if (!d.concluida || !dias) { return false; }
    var referencia = (d.dhConclusao || d.dhAlter || '').slice(0, 10);
    var corte = new Date();
    corte.setDate(corte.getDate() - dias);
    var corteIso = corte.getFullYear() + '-' + ('0' + (corte.getMonth() + 1)).slice(-2) + '-' + ('0' + corte.getDate()).slice(-2);
    return !!referencia && referencia < corteIso;
  }

  function passaNoFiltro(d) {
    if (concluidaAntiga(d)) { return false; }
    if (filtro.resp === 'eu' && d.codUsuResp !== CtiApp.estado.sessao.codUsu) { return false; }
    if (filtro.resp === 'sem' && u.temUsuario(d.codUsuResp)) { return false; }
    if (filtro.resp && filtro.resp !== 'eu' && filtro.resp !== 'sem' && String(d.codUsuResp) !== filtro.resp) { return false; }
    if (filtro.setor && String(d.idSetor) !== filtro.setor) { return false; }
    if (filtro.prioridade && d.prioridade !== filtro.prioridade) { return false; }
    return true;
  }

  /** Coluna que conclui segue a data de finalização (mais recente no topo); as demais, a ordem manual. */
  function daColuna(codigo) {
    var col = CtiApp.coluna(codigo);
    return CtiApp.estado.demandas
      .filter(function (d) { return d.coluna === codigo; })
      .sort(col && col.conclui ? u.porConclusaoRecente : function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
  }

  function pintar() {
    if (!CtiApp.estado.carregou.config || !CtiApp.estado.carregou.demandas) { return; }
    var quadro = u.el('kb-quadro');
    var rolagem = quadro.scrollLeft;
    var rolagensVerticais = {};
    u.cada(quadro, '.g-coluna__lista[data-coluna]', function (lista) {
      rolagensVerticais[lista.dataset.coluna] = lista.scrollTop;
    });
    var colunas = CtiApp.colunasVisiveis();
    if (!colunas.length) {
      quadro.innerHTML = '<p class="g-vazio"><i class="ri-layout-column-line" aria-hidden="true"></i>' +
        'Nenhuma coluna visível. Ative uma coluna em Configurações › Kanban.</p>';
      return;
    }
    quadro.innerHTML = colunas.map(function (c) {
      var cards = daColuna(c.codigo).filter(passaNoFiltro);
      var cor = u.cor(c.cor);
      return '<section class="g-coluna' + (c.conclui ? ' g-coluna--concluida' : '') + '" style="--c:' + cor +
        ';--c-texto:' + (u.corClara(cor) ? '#1E2A24' : '#fff') + '" aria-label="' + u.esc(c.nome) + '">' +
        '<header class="g-coluna__cab">' +
          '<i class="' + u.icone(c.icone, 'ri-list-check') + '" aria-hidden="true"></i>' +
          '<span class="g-coluna__titulo">' + u.esc(c.nome) + '</span>' +
          '<span class="g-coluna__qtd">' + cards.length + '</span>' +
          '<button type="button" class="g-icone-btn g-coluna__add" data-add="' + u.esc(c.codigo) + '" data-requer="incluir"' +
            ' title="Nova demanda em ' + u.esc(c.nome) + '" aria-label="Nova demanda em ' + u.esc(c.nome) + '">' +
            '<i class="ri-add-line" aria-hidden="true"></i></button>' +
        '</header>' +
        '<div class="g-coluna__lista" data-coluna="' + u.esc(c.codigo) + '">' +
          (cards.length ? cards.map(card).join('')
            : '<p class="g-vazio"><i class="ri-inbox-line" aria-hidden="true"></i>Nada aqui</p>') +
        '</div></section>';
    }).join('');
    quadro.scrollLeft = rolagem;
    u.cada(quadro, '.g-coluna__lista[data-coluna]', function (lista) {
      lista.scrollTop = rolagensVerticais[lista.dataset.coluna] || 0;
    });
    marcarPresenca();
    CtiFotos.preencher(quadro);
  }

  function card(d) {
    var podeMover = CtiApp.podeMover(d);
    var tags = u.tags(d.tags);
    var progresso = d.qtdItens
      ? '<div class="g-progresso"><div class="g-progresso__txt"><span>Checklist</span><span>' + d.qtdItensFeitos + '/' + d.qtdItens + '</span></div>' +
        '<div class="g-progresso__trilho"><span style="width:' + Math.round(d.qtdItensFeitos * 100 / d.qtdItens) + '%"></span></div></div>'
      : '';
    return '<article class="g-card" data-id="' + Number(d.idTarefa) + '" tabindex="0" draggable="' + podeMover + '"' +
      (podeMover ? '' : ' title="' + (d.concluida ? 'Demanda finalizada: para voltar a uma coluna aberta, use Reabrir' : 'Só o responsável (ou quem criou, sem responsável) e o SUP movem esta demanda') + '"') +
      ' aria-label="' + u.esc(d.titulo) + '">' +
      // Código e prioridade no topo; a categoria vem abaixo do título com a largura toda do card
      // (na mesma linha do código ela era cortada, e piorava com códigos de 4 dígitos).
      // Tags no topo, em texto discreto: junto dos selos de categoria e setor elas quebravam a linha.
      '<div class="g-card__topo"><span class="g-card__codigo">#' + Number(d.idTarefa) + '</span>' +
        (tags.length ? '<span class="g-card__tags" title="' + u.esc(tags.join(', ')) + '">' +
          tags.map(function (t) { return '#' + u.esc(t); }).join(' ') + '</span>' : '') +
        '<span class="g-presenca-selo" data-presenca="' + Number(d.idTarefa) + '" hidden></span>' +
        CtiApp.seloPrioridade(d.prioridade) + '</div>' +
      // Título em no máximo duas linhas (o completo fica no title); o card compacto mostra mais demandas por coluna.
      '<h4 class="g-card__titulo" title="' + u.esc(d.titulo) + '">' + u.esc(d.titulo) + '</h4>' +
      // Categoria e setor (sem setor, o selo não aparece).
      '<div class="g-card__categoria">' + CtiApp.seloCategoria(d.idCategoria) +
        (CtiApp.setor(d.idSetor) ? CtiApp.seloSetor(d.idSetor) : '') + '</div>' +
      metaHtml(d) +
      progresso +
      '<div class="g-card__rodape">' +
        CtiApp.prazoHtml(d) +
        (d.qtdComentarios ? '<span title="Comentários"><i class="ri-chat-3-line" aria-hidden="true"></i>' + d.qtdComentarios + '</span>' : '') +
        (d.qtdAnexos ? '<span title="Arquivos anexados"><i class="ri-attachment-2" aria-hidden="true"></i>' + d.qtdAnexos + '</span>' : '') +
        CtiApp.avatarPessoa(d.codUsuResp, d.nomeResp || 'Sem responsável', 'p') +
      '</div></article>';
  }

  /** Linha discreta do card: quem pediu e quando entrou (ou quando foi concluída). */
  function metaHtml(d) {
    var solicitante = u.temUsuario(d.codUsuSol) ? (d.nomeSol || CtiApp.nomeUsuario(d.codUsuSol)) : null;
    var quando = d.concluida
      ? '<span class="g-card__data" title="Concluída em ' + u.esc(u.dataHoraBr(d.dhConclusao)) + '"><i class="ri-check-double-line" aria-hidden="true"></i>' +
        u.esc(u.dataHoraBr(d.dhConclusao)) + '</span>'
      : '<span class="g-card__data" title="Criada em ' + u.esc(u.dataHoraBr(d.dhCriacao)) + '"><i class="ri-time-line" aria-hidden="true"></i>' +
        u.dataBr(d.dhCriacao) + '</span>';
    return '<div class="g-card__meta">' +
      '<span class="g-card__solicitante" title="Solicitante' + (solicitante ? ': ' + u.esc(solicitante) : ' não informado') + '">' +
        '<i class="ri-user-received-2-line" aria-hidden="true"></i>' + u.esc(solicitante || '—') + '</span>' +
      quando + '</div>';
  }

  /** Mostra no card quem mais está com a demanda aberta, sem repintar o quadro. */
  function marcarPresenca() {
    u.cada(u.el('kb-quadro'), '[data-presenca]', function (el) {
      var outros = CtiPresenca.outrosNoRegistro('T', el.dataset.presenca);
      if (!outros.length) {
        el.hidden = true;
        return;
      }
      var editando = outros.some(function (s) { return s.editando; });
      var nomes = outros.map(function (s) { return s.nomeUsu || ('Usuário ' + s.codUsu); })
        .filter(function (n, i, arr) { return arr.indexOf(n) === i; });
      el.hidden = false;
      el.className = 'g-presenca-selo' + (editando ? ' g-presenca-selo--editando' : '');
      el.textContent = nomes.map(u.iniciais).join(' ');
      el.title = nomes.join(', ') + (editando ? ' editando agora' : ' com a demanda aberta');
    });
  }

  /**
   * Persiste o arrasto. idAntesDe é o card que ficou logo abaixo (null = fim
   * da coluna); o servidor posiciona por ele na coluna completa, que pode ter
   * cards ocultos pelo filtro ou incluídos por outro usuário.
   */
  function mover(idTarefa, destino, idAntesDe) {
    if (!CtiApp.podeMover(CtiApp.demanda(idTarefa))) {
      CtiApp.aviso('Só o responsável pela demanda (ou quem a criou, se não houver responsável) e o SUP podem movê-la.', 'alerta');
      return;
    }
    if (movendo) {
      CtiApp.aviso('Aguarde a movimentação anterior terminar.', 'info');
      return;
    }
    var d = CtiApp.demanda(idTarefa);
    if (!d || idAntesDe === idTarefa) { return; }
    var colDestino = CtiApp.coluna(destino);
    if (d.concluida && !(colDestino && colDestino.conclui)) {
      CtiApp.aviso('Demanda finalizada não volta arrastando: abra a demanda e use Reabrir.', 'alerta');
      return;
    }
    var lista = daColuna(d.coluna);
    var seguinte = lista[lista.indexOf(d) + 1];
    if (d.coluna === destino && (seguinte ? seguinte.idTarefa : null) === idAntesDe) { return; }

    var antes = { coluna: d.coluna, ordem: d.ordem };
    posicionarLocalmente(d, destino, idAntesDe);
    pintar();
    movendo = true;
    CtiApp.dados.moverDemanda({ idTarefa: idTarefa, colunaDestino: destino, idAntesDe: idAntesDe, versao: d.versao })
      .then(function () {
        movendo = false;
        var col = CtiApp.coluna(destino);
        if (col && col.conclui && antes.coluna !== destino) { CtiApp.sucesso('Demanda concluída.'); }
        return CtiApp.recarregar(['demandas']).then(function () { focarCard(idTarefa); });
      }, function (e) {
        movendo = false;
        d.coluna = antes.coluna;
        d.ordem = antes.ordem;
        pintar();
        CtiApp.falhaAoGravar(e, 'A demanda não foi movida: ');
      });
  }

  /** Move pelo detalhe (teclado): vai para o fim da coluna escolhida. */
  function moverPara(idTarefa, destino) {
    mover(idTarefa, destino, null);
  }

  function posicionarLocalmente(d, destino, idAntesDe) {
    var lista = daColuna(destino).filter(function (x) { return x !== d; });
    var i = lista.length;
    lista.forEach(function (x, k) { if (x.idTarefa === idAntesDe) { i = k; } });
    lista.splice(i, 0, d);
    var concluiaAntes = !!d.concluida;
    d.coluna = destino;
    var col = CtiApp.coluna(destino);
    d.concluida = !!(col && col.conclui);
    // Mesma regra do servidor: a data só nasce ao entrar vindo de coluna aberta.
    if (d.concluida && !concluiaAntes) { d.dhConclusao = u.agoraIso(); }
    lista.forEach(function (x, k) { x.ordem = k; });
  }

  function focarCard(idTarefa) {
    var c = u.el('kb-quadro').querySelector('.g-card[data-id="' + Number(idTarefa) + '"]');
    if (c && u.el('g-modal').hidden && CtiApp.visao() === 'kanban') { c.focus({ preventScroll: true }); }
  }

  return { iniciar: iniciar, pintar: pintar, marcarPresenca: marcarPresenca, moverPara: moverPara };
})();
