/**
 * Modal da demanda: detalhe (checklist, conversa, arquivos, histórico) e
 * formulário de inclusão/edição.
 */
var CtiDemanda = (function () {
  'use strict';

  var u = CtiUtil;
  var ROTULO_EVENTO = { C: 'Criada', E: 'Editada', M: 'Movida', X: 'Excluída', R: 'Reaberta' };

  var atual = null;      // detalhe aberto (com versão atual)
  var abaAtual = 'checklist';

  // ============================================================== detalhe

  function abrir(idTarefa) {
    var linha = CtiApp.demanda(idTarefa);
    CtiApp.abrirModal({
      titulo: linha ? linha.titulo : 'Demanda #' + idTarefa,
      corpo: '<p class="g-vazio">Carregando…</p>',
      tamanho: 'amplo',
      registro: { entidade: 'T', id: idTarefa, editando: false },
      aoFechar: function () { atual = null; }
    });
    CtiApp.dados.detalharDemanda(idTarefa)
      .then(function (d) {
        atual = d;
        pintarDetalhe();
      })
      .catch(function (e) {
        CtiApp.fecharModal(true);
        CtiApp.erro('Não foi possível abrir a demanda: ' + e.message);
      });
  }

  function pintarDetalhe() {
    var d = atual;
    var itens = d.itens || [];
    var feitos = itens.filter(function (i) { return i.feito; }).length;
    var travada = CtiApp.finalizadaTravada(d);
    var corpo =
      // g-travada esconde o que altera a demanda ([data-trava]); "Escrever documentação" continua.
      // Três colunas com rolagem própria: descrição | checklist, comentários, arquivos e histórico | dados.
      '<div class="g-detalhe' + (travada ? ' g-travada' : '') + '">' +
        '<div class="g-detalhe__principal">' +
          (d.concluida ? '<p class="g-finalizada"><i class="ri-lock-line" aria-hidden="true"></i>' +
            (travada ? 'Demanda finalizada: somente leitura. Para alterar, reabra a demanda.'
              : 'Demanda finalizada. Como SUP, você ainda pode ajustá-la.') + '</p>' : '') +
          '<div class="g-card__topo">' + CtiApp.seloColuna(d.coluna) + CtiApp.seloCategoria(d.idCategoria) +
            CtiApp.seloPrioridade(d.prioridade) + '</div>' +
          '<section class="g-demanda-descricao" aria-label="Descrição da demanda">' +
            '<header><i class="ri-file-text-line" aria-hidden="true"></i> Descrição</header>' +
            (d.descricao ? '<div class="g-md">' + CtiMarkdown.renderizar(d.descricao) + '</div>'
              : '<p class="g-form__nota">Sem descrição.</p>') +
          '</section>' +
        '</div>' +
        '<div class="g-detalhe__abas">' +
          '<nav class="g-subabas" role="tablist">' +
            subaba('checklist', 'ri-checkbox-multiple-line', 'Checklist', itens.length ? feitos + '/' + itens.length : '') +
            subaba('conversa', 'ri-chat-3-line', 'Comentários', d.qtdComentarios || '') +
            subaba('arquivos', 'ri-attachment-2', 'Arquivos', d.qtdDocumentos || '', 'Arquivos e documentos') +
            subaba('historico', 'ri-history-line', 'Histórico', '') +
          '</nav>' +
          '<div class="g-detalhe__aba" id="dm-aba"></div>' +
        '</div>' +
        '<aside class="g-detalhe__lado">' +
          '<dl>' +
            campo('Solicitante', CtiApp.pessoaHtml(d.codUsuSol, d.nomeSol, '—')) +
            campo('Responsável', CtiApp.pessoaHtml(d.codUsuResp, d.nomeResp)) +
            campo('Setor', CtiApp.seloSetor(d.idSetor)) +
            campo('Criada em', u.dataHoraBr(d.dhCriacao) + (d.nomeUsuInc ? '<br><small class="g-autoria">por ' + u.esc(d.nomeUsuInc) + '</small>' : '')) +
            (d.concluida ? campo('Concluída em', u.esc(u.dataHoraBr(d.dhConclusao))) : '') +
            // Sem prazo, o selo já diz "Sem prazo": o rótulo embaixo só repetiria.
            campo('Prazo', CtiApp.prazoHtml(d) + (d.dtVenc ? '<br><small class="g-autoria">' + u.esc(u.rotuloPrazo(d.dtVenc, d.concluida)) + '</small>' : '')) +
            (d.tags ? campo('Tags', u.tags(d.tags).map(function (t) { return '<span class="g-tag">' + u.esc(t) + '</span>'; }).join(' ')) : '') +
          '</dl>' +
          (d.concluida ? painelReabrir(d) : CtiApp.podeMover(d)
            ? '<div class="g-mover">' +
                '<label for="dm-mover">Mover para</label>' +
                '<div class="g-mover__linha"><select id="dm-mover">' + CtiApp.opcoes('colunas', d.coluna, null) + '</select>' +
                '<button type="button" class="g-btn g-btn--fantasma" id="dm-mover-btn">Mover</button></div>' +
              '</div>'
            : '<p class="g-mover g-autoria"><i class="ri-lock-line" aria-hidden="true"></i> ' +
                'Só o responsável (ou quem criou, sem responsável) e o SUP mudam esta demanda de coluna.</p>') +
          '<div class="g-autoria">' + autoria(d) + '</div>' +
        '</aside>' +
      '</div>';

    CtiApp.abrirModal({
      titulo: '#' + d.idTarefa + ' · ' + d.titulo,
      corpo: corpo,
      tamanho: 'amplo',
      rodape:
        (CtiApp.podeExcluirDemanda(d)
          ? '<button type="button" class="g-btn g-btn--perigo g-empurra" id="dm-excluir">' +
            '<i class="ri-delete-bin-line" aria-hidden="true"></i> Excluir</button>'
          : '') +
        (CtiApp.podeEditarDemanda(d) ? '<button type="button" class="g-btn g-btn--primario" id="dm-editar" data-requer="alterar">' +
          '<i class="ri-edit-line" aria-hidden="true"></i> Editar</button>' : ''),
      registro: { entidade: 'T', id: d.idTarefa, editando: false },
      focarFechar: true,
      aoFechar: function () { atual = null; }
    });

    if (u.el('dm-editar')) { u.el('dm-editar').addEventListener('click', function () { formulario(atual); }); }
    ligarReabrir();
    if (u.el('dm-excluir')) { u.el('dm-excluir').addEventListener('click', excluir); }
    if (u.el('dm-mover-btn')) { u.el('dm-mover-btn').addEventListener('click', function () {
      var destino = u.el('dm-mover').value;
      if (destino === atual.coluna) { return; }
      var linha = CtiApp.demanda(atual.idTarefa);
      if (linha) { linha.versao = atual.versao; }
      CtiApp.fecharModal(true);
      CtiKanban.moverPara(atual ? atual.idTarefa : d.idTarefa, destino);
    }); }
    u.cada(u.el('g-modal-corpo'), '[data-subaba]', function (b) {
      b.addEventListener('click', function () { mostrarAba(b.dataset.subaba); });
    });
    mostrarAba(abaAtual);
  }

  /**
   * Demanda finalizada: em vez de "Mover para", o botão Reabrir (dono ou SUP).
   * A coluna de destino é perguntada na hora, só entre colunas ativas que não concluem.
   */
  function painelReabrir(d) {
    if (!CtiApp.podeReabrir(d)) {
      return '<p class="g-mover g-autoria"><i class="ri-lock-line" aria-hidden="true"></i> ' +
        'Só o responsável (ou quem criou, sem responsável) e o SUP reabrem esta demanda.</p>';
    }
    var abertas = CtiApp.colunasVisiveis().filter(function (c) { return !c.conclui; });
    return '<div class="g-mover g-reabrir">' +
      '<button type="button" class="g-btn g-btn--fantasma" id="dm-reabrir"><i class="ri-arrow-go-back-line" aria-hidden="true"></i> Reabrir demanda</button>' +
      '<div id="dm-reabrir-escolha" hidden>' +
        '<label class="g-campo"><span>Voltar para a coluna</span><select id="dm-reabrir-coluna">' +
          abertas.map(function (c) { return u.opcao(c.codigo, c.nome, '', { icone: c.icone, cor: c.cor }); }).join('') + '</select></label>' +
        '<label class="g-campo"><span>Motivo (opcional)</span>' +
          '<input type="text" id="dm-reabrir-motivo" maxlength="500" placeholder="Ex.: ajuste pedido após a entrega"></label>' +
        '<div class="g-reabrir__acoes">' +
          '<button type="button" class="g-btn g-btn--cancelar" id="dm-reabrir-cancelar">Cancelar</button>' +
          '<button type="button" class="g-btn g-btn--primario" id="dm-reabrir-ok">Reabrir</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function ligarReabrir() {
    var botao = u.el('dm-reabrir');
    if (!botao) { return; }
    var escolha = u.el('dm-reabrir-escolha');
    botao.addEventListener('click', function () {
      botao.hidden = true;
      escolha.hidden = false;
      u.el('dm-reabrir-coluna').focus();
    });
    u.el('dm-reabrir-cancelar').addEventListener('click', function () {
      escolha.hidden = true;
      botao.hidden = false;
    });
    u.el('dm-reabrir-ok').addEventListener('click', function () {
      var d = atual;
      var destino = u.el('dm-reabrir-coluna').value;
      if (!destino) { CtiApp.erro('Nenhuma coluna aberta ativa no quadro para reabrir a demanda.'); return; }
      CtiApp.ocupado(u.el('dm-reabrir-ok'), CtiApp.dados.reabrirDemanda({
        idTarefa: d.idTarefa, versao: d.versao, colunaDestino: destino,
        observacao: u.el('dm-reabrir-motivo').value.trim() || null
      })).then(function () {
        CtiApp.sucesso('Demanda #' + d.idTarefa + ' reaberta em ' + (CtiApp.coluna(destino) || {}).nome + '.');
        return CtiApp.recarregar(['demandas']).then(function () { abrir(d.idTarefa); });
      }, function (e) { CtiApp.falhaAoGravar(e, 'A demanda não foi reaberta: '); });
    });
  }

  function subaba(nome, icone, rotulo, contador, dica) {
    return '<button type="button" role="tab" class="g-subaba" data-subaba="' + nome + '"' +
      (dica ? ' title="' + u.esc(dica) + '"' : '') + '>' +
      '<i class="' + icone + '" aria-hidden="true"></i>' + rotulo +
      (contador !== '' ? ' <small>' + u.esc(contador) + '</small>' : '') + '</button>';
  }

  function campo(rotulo, valorHtml) {
    return '<div><dt>' + rotulo + '</dt><dd>' + valorHtml + '</dd></div>';
  }

  function autoria(d) {
    var partes = [];
    var item = function (acao, nome, dh) {
      return '<p class="g-autoria__item"><span>' + acao + ' por ' + u.esc(nome || '—') + '</span><span>' + u.dataHoraBr(dh) + '</span></p>';
    };
    if (d.nomeUsuAlter || d.dhAlter) { partes.push(item('Alterada', d.nomeUsuAlter, d.dhAlter)); }
    return partes.join('');
  }

  function mostrarAba(nome) {
    abaAtual = nome;
    u.cada(u.el('g-modal-corpo'), '[data-subaba]', function (b) {
      var ativa = b.dataset.subaba === nome;
      b.classList.toggle('g-subaba--ativa', ativa);
      b.setAttribute('aria-selected', ativa ? 'true' : 'false');
    });
    var alvo = u.el('dm-aba');
    if (nome === 'checklist') { pintarChecklist(alvo); }
    if (nome === 'conversa') { pintarConversa(alvo); }
    if (nome === 'arquivos') { pintarArquivos(alvo); }
    if (nome === 'historico') { pintarHistorico(alvo); }
  }

  // ----------------------------------------------------------- checklist

  function pintarChecklist(alvo) {
    var itens = atual.itens || [];
    var podeAlterar = CtiApp.pode('alterar') && !CtiApp.finalizadaTravada(atual) && CtiApp.temPosse(atual);
    alvo.innerHTML =
      (itens.length ? '<div class="g-checklist">' + itens.map(function (i) {
        return '<div class="g-check' + (i.feito ? ' g-check--feito' : '') + '">' +
          '<input type="checkbox" data-item="' + Number(i.idItem) + '"' + (i.feito ? ' checked' : '') +
            (podeAlterar ? '' : ' disabled') + ' aria-label="' + u.esc(i.descricao) + '">' +
          '<span class="g-check__texto">' + u.esc(i.descricao) + '</span>' +
          (podeAlterar ? '<button type="button" class="g-icone-btn g-icone-btn--perigo" data-remover-item="' + Number(i.idItem) +
            '" data-requer="alterar" data-trava aria-label="Remover item"><i class="ri-close-line" aria-hidden="true"></i></button>' : '') +
        '</div>';
      }).join('') + '</div>' : '<p class="g-form__nota">' + (podeAlterar ? 'Divida a demanda em passos para acompanhar o progresso no card.'
        : 'Nenhum passo no checklist.') + '</p>') +
      (podeAlterar ? '<form class="g-novo-item" id="dm-novo-item" data-requer="alterar" data-trava>' +
        '<input type="text" id="dm-item-texto" maxlength="200" placeholder="Novo passo, ex.: testar em homologação" aria-label="Novo item do checklist">' +
        '<button type="submit" class="g-btn g-btn--fantasma"><i class="ri-add-line" aria-hidden="true"></i> Adicionar</button>' +
      '</form>' : (CtiApp.temPosse(atual) ? '' : avisoSemPosse(atual)));

    if (!podeAlterar) { return; }
    u.el('dm-novo-item').addEventListener('submit', function (e) {
      e.preventDefault();
      var campoTexto = u.el('dm-item-texto');
      var texto = campoTexto.value.trim();
      if (!texto) { return; }
      CtiApp.ocupado(e.target.querySelector('button'),
        CtiApp.dados.salvarItem({ idTarefa: atual.idTarefa, descricao: texto, feito: false }))
        .then(function (item) {
          atual.itens.push(item);
          pintarChecklist(alvo);
          u.el('dm-item-texto').focus();
          atualizarContadores();
        }, function (erro) { CtiApp.falhaAoGravar(erro, 'O item não foi adicionado: '); });
    });
    u.cada(alvo, '[data-item]', function (cx) {
      cx.addEventListener('change', function () {
        var item = u.porId(atual.itens, 'idItem', cx.dataset.item);
        cx.disabled = true;
        CtiApp.dados.salvarItem({ idItem: item.idItem, idTarefa: atual.idTarefa, descricao: item.descricao,
          feito: cx.checked, versao: item.versao })
          .then(function (salvo) {
            Object.assign(item, salvo);
            pintarChecklist(alvo);
            atualizarContadores();
          }, function (erro) {
            cx.checked = !cx.checked;
            cx.disabled = false;
            CtiApp.falhaAoGravar(erro, 'O item não foi alterado: ');
          });
      });
    });
    u.cada(alvo, '[data-remover-item]', function (b) {
      b.addEventListener('click', function () {
        var item = u.porId(atual.itens, 'idItem', b.dataset.removerItem);
        CtiApp.ocupado(b, CtiApp.dados.excluirItem({ id: item.idItem, versao: item.versao }))
          .then(function () {
            atual.itens = atual.itens.filter(function (x) { return x !== item; });
            pintarChecklist(alvo);
            atualizarContadores();
          }, function (erro) { CtiApp.falhaAoGravar(erro, 'O item não foi removido: '); });
      });
    });
  }

  /** O card do quadro mostra o progresso: atualiza a lista em segundo plano. */
  function atualizarContadores() {
    var feitos = atual.itens.filter(function (i) { return i.feito; }).length;
    var aba = u.el('g-modal-corpo').querySelector('[data-subaba="checklist"] small');
    var texto = atual.itens.length ? feitos + '/' + atual.itens.length : '';
    if (aba) { aba.textContent = texto; }
    CtiApp.recarregar(['demandas']);
  }

  // ------------------------------------------------------------ conversa

  function pintarConversa(alvo) {
    alvo.innerHTML = '<p class="g-vazio">Carregando…</p>';
    var id = atual.idTarefa;
    CtiApp.dados.listarComentarios(id).then(function (lista) {
      if (!atual || atual.idTarefa !== id) { return; }
      var podeExcluirTudo = CtiApp.pode('excluir');
      alvo.innerHTML =
        '<div class="g-conversa">' + (lista.length ? lista.map(function (m) {
          return '<div class="g-msg' + (m.meu ? ' g-msg--minha' : '') + '">' +
            CtiApp.avatarPessoa(m.codUsu, m.nomeUsu, '') +
            '<div class="g-msg__balao"><div class="g-msg__cab"><strong>' + u.esc(m.nomeUsu || '—') + '</strong>' +
              '<span title="' + u.esc(u.dataHoraBr(m.dhCriacao)) + '">' + u.esc(u.relativo(m.dhCriacao)) + '</span>' +
              (m.meu || podeExcluirTudo ? '<button type="button" class="g-icone-btn g-icone-btn--perigo" data-apagar="' +
                Number(m.idComentario) + '" data-trava aria-label="Excluir comentário"><i class="ri-delete-bin-line" aria-hidden="true"></i></button>' : '') +
            '</div><div class="g-msg__texto">' + u.esc(m.texto) + '</div></div></div>';
        }).join('') : '<p class="g-form__nota">Nenhum comentário ainda.</p>') + '</div>' +
        '<form class="g-escrever" id="dm-escrever" data-requer="incluir" data-trava>' +
          '<textarea id="dm-comentario" rows="2" maxlength="4000" placeholder="Escreva um comentário (Ctrl+Enter envia)" aria-label="Comentário"></textarea>' +
          '<button type="submit" class="g-btn g-btn--primario"><i class="ri-send-plane-line" aria-hidden="true"></i> Enviar</button>' +
        '</form>';
      CtiFotos.preencher(alvo);
      var form = u.el('dm-escrever');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var texto = u.el('dm-comentario').value.trim();
        if (!texto) { return; }
        CtiApp.ocupado(form.querySelector('button'), CtiApp.dados.comentar({ idTarefa: id, texto: texto }))
          .then(function () {
            atual.qtdComentarios = (atual.qtdComentarios || 0) + 1;
            pintarConversa(alvo);
            CtiApp.recarregar(['demandas']);
          }, function (erro) { CtiApp.falhaAoGravar(erro, 'O comentário não foi enviado: '); });
      });
      u.el('dm-comentario').addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { form.requestSubmit(); }
      });
      u.cada(alvo, '[data-apagar]', function (b) {
        b.addEventListener('click', function () {
          CtiApp.confirmar({ titulo: 'Excluir comentário?', mensagem: 'O comentário some da conversa para todos.',
            botao: 'Excluir', perigo: true }).then(function (ok) {
            if (!ok) { return; }
            CtiApp.ocupado(b, CtiApp.dados.excluirComentario(Number(b.dataset.apagar)))
              .then(function () { pintarConversa(alvo); CtiApp.recarregar(['demandas']); },
                function (erro) { CtiApp.falhaAoGravar(erro, 'O comentário não foi excluído: '); });
          });
        });
      });
    }, function (e) {
      alvo.innerHTML = '<p class="g-vazio">Comentários indisponíveis: ' + u.esc(e.message) + '</p>';
    });
  }

  // ------------------------------------------------------------ arquivos

  function pintarArquivos(alvo) {
    alvo.innerHTML = '<p class="g-vazio">Carregando…</p>';
    var d = atual;
    var posse = CtiApp.temPosse(d);
    CtiApp.dados.documentosDaDemanda(d.idTarefa).then(function (docs) {
      if (!atual || atual.idTarefa !== d.idTarefa) { return; }
      alvo.innerHTML =
        '<div class="g-anexos">' + (docs.length ? docs.map(CtiDocumentos.itemHtml).join('')
          : '<p class="g-form__nota">Nenhum arquivo ou documento.' + (posse ? ' Anexe o fonte, o zip da entrega ou escreva a documentação.' : '') + '</p>') +
        '</div>' +
        (posse ? '<div class="g-cab__acoes" style="margin-top:12px" data-requer="incluir">' +
          '<label class="g-btn g-btn--fantasma" data-trava><i class="ri-upload-2-line" aria-hidden="true"></i> Anexar arquivos' +
            '<input type="file" id="dm-arquivo" multiple hidden></label>' +
          '<button type="button" class="g-btn g-btn--fantasma" id="dm-documentar"><i class="ri-quill-pen-line" aria-hidden="true"></i> Escrever documentação</button>' +
        '</div>' : avisoSemPosse(d));
      u.cada(alvo, '[data-doc]', function (b) {
        b.addEventListener('click', function () {
          CtiApp.fecharModal(true);
          CtiApp.irPara('documentos');
          CtiDocumentos.abrirDocumento(Number(b.dataset.doc));
        });
      });
      if (!posse) { return; }
      u.el('dm-arquivo').addEventListener('change', function (e) {
        var arquivos = e.target.files;
        if (!arquivos || !arquivos.length) { return; }
        CtiDocumentos.enviarArquivos(arquivos, { idTarefa: d.idTarefa, idCategoria: d.idCategoria, titulo: d.titulo })
          .then(function () {
            atual.qtdDocumentos = (atual.qtdDocumentos || 0) + 1;
            pintarArquivos(alvo);
          });
      });
      u.el('dm-documentar').addEventListener('click', function () {
        CtiApp.fecharModal(true);
        CtiApp.irPara('documentos');
        CtiDocumentos.novo({ idTarefa: d.idTarefa, idCategoria: d.idCategoria, titulo: d.titulo });
      });
    }, function (e) {
      alvo.innerHTML = '<p class="g-vazio">Documentos indisponíveis: ' + u.esc(e.message) + '</p>';
    });
  }

  /** Quem não é o responsável vê, baixa e comenta, mas não altera. */
  function avisoSemPosse(d) {
    return '<p class="g-form__nota" style="margin-top:10px"><i class="ri-lock-line" aria-hidden="true"></i> ' +
      'Só ' + u.esc(CtiApp.nomeUsuario(d.codUsuResp)) +
      ' (responsável) e o SUP alteram. Use os comentários para pedir.</p>';
  }

  // ----------------------------------------------------------- histórico

  function pintarHistorico(alvo) {
    alvo.innerHTML = '<p class="g-vazio">Carregando…</p>';
    var id = atual.idTarefa;
    CtiApp.dados.historicoDemanda(id).then(function (lista) {
      if (!atual || atual.idTarefa !== id) { return; }
      var nome = function (c) { var col = CtiApp.coluna(c); return col ? col.nome : (c || '—'); };
      alvo.innerHTML = lista.length ? '<ol class="g-linha-tempo">' + lista.map(function (h) {
        var tipo = h.tipoEvento || 'M';
        // Desde a 1.4.0 o evento vem do log com a frase pronta; os antigos montam o título pelo tipo.
        var titulo = h.resumo ? u.esc(h.resumo)
          : tipo === 'M' ? 'Movida de ' + u.esc(nome(h.colunaDe)) + ' para ' + u.esc(nome(h.colunaPara))
          : tipo === 'R' ? 'Reaberta em ' + u.esc(nome(h.colunaPara))
          : (tipo === 'C' ? 'Criada em ' + u.esc(nome(h.colunaPara)) : ROTULO_EVENTO[tipo] || tipo);
        var campos = h.campos || [];
        return '<li class="g-ev--' + u.esc(tipo) + '"><strong>' + titulo + '</strong>' +
          (h.observacao ? ' <span>' + u.esc(h.observacao) + '</span>' : '') +
          '<small>' + u.esc(h.nomeUsu || '—') + ', ' + u.dataHoraBr(h.dhMov) + '</small>' +
          (campos.length ? '<details class="g-ev__campos"><summary>' + u.plural(campos.length, 'campo alterado', 'campos alterados') + '</summary>' +
            campos.map(function (c) {
              return '<div class="g-ev__campo"><b>' + u.esc(c.rotulo) + '</b> <s>' + u.esc(c.velho) + '</s> → ' + u.esc(c.novo) + '</div>';
            }).join('') + '</details>' : '') +
          '</li>';
      }).join('') + '</ol>' : '<p class="g-form__nota">Sem eventos registrados.</p>';
    }, function (e) {
      alvo.innerHTML = '<p class="g-vazio">Histórico indisponível: ' + u.esc(e.message) + '</p>';
    });
  }

  function excluir() {
    var d = atual;
    CtiApp.confirmar({
      titulo: 'Excluir a demanda #' + d.idTarefa + '?',
      mensagem: '"' + d.titulo + '" sai do quadro. O histórico e os documentos continuam guardados.',
      botao: 'Excluir demanda', perigo: true
    }).then(function (ok) {
      if (!ok || !atual) { return; }
      CtiApp.ocupado(u.el('dm-excluir'), CtiApp.dados.excluirDemanda({ id: d.idTarefa, versao: d.versao }))
        .then(function () {
          CtiApp.fecharModal(true);
          CtiApp.sucesso('Demanda excluída.');
          CtiApp.recarregar(['demandas']);
        }, function (e) { CtiApp.falhaAoGravar(e, 'A demanda não foi excluída: '); });
    });
  }

  /**
   * Um colega gravou algo: recarrega o detalhe aberto (checklist, conversa,
   * histórico). Não mexe se o usuário está digitando no checklist ou num comentário.
   */
  function atualizarSeAberta() {
    if (!atual || u.el('g-modal').hidden || !u.el('dm-aba')) { return; }
    var digitando = ['dm-item-texto', 'dm-comentario'].some(function (id) {
      var campo = u.el(id);
      return campo && (campo.value.trim() !== '' || document.activeElement === campo);
    });
    if (digitando) { return; }
    var id = atual.idTarefa;
    CtiApp.dados.detalharDemanda(id).then(function (d) {
      if (!atual || atual.idTarefa !== id || !u.el('dm-aba')) { return; }
      // Cada coluna do detalhe rola sozinha: guarda e devolve a posição de todas.
      var rolaveis = '.g-modal__corpo, .g-demanda-descricao .g-md, .g-detalhe__aba, .g-detalhe__lado';
      var rolagens = Array.prototype.map.call(u.el('g-modal').querySelectorAll(rolaveis), function (el) { return el.scrollTop; });
      atual = d;
      pintarDetalhe();
      Array.prototype.forEach.call(u.el('g-modal').querySelectorAll(rolaveis), function (el, i) { el.scrollTop = rolagens[i] || 0; });
    }, function (e) {
      // Excluída por outro usuário enquanto estava aberta.
      CtiApp.fecharModal(true);
      CtiApp.erro('A demanda aberta não está mais disponível: ' + e.message);
    });
  }

  // ========================================================== formulário

  /** Quem cria já vem como responsável, se estiver no grupo e não oculto (inativo não entra em cadastro novo). */
  function respParaNovo(sessao) {
    var r = sessao.responsavel ? CtiApp.responsavel(sessao.codUsu) : null;
    return r && !r.oculto ? sessao.codUsu : null;
  }

  /** d = detalhe (edição) ou null (inclusão); colunaInicial para o "+" da coluna. */
  function formulario(d, colunaInicial) {
    var nova = !d;
    if (!nova && !CtiApp.podeEditarDemanda(d)) {
      CtiApp.erro('Demanda com responsável definido só pode ser editada pelo SUP.');
      return;
    }
    var sessao = CtiApp.estado.sessao;
    var v = d || {
      titulo: '', descricao: '', coluna: colunaInicial || (CtiApp.colunasVisiveis()[0] || {}).codigo,
      prioridade: 'M', idCategoria: null, idSetor: null, codUsuSol: sessao.codUsu,
      codUsuResp: respParaNovo(sessao), dtVenc: '', tags: ''
    };
    var semResponsaveis = !CtiApp.estado.config.responsaveis.length;
    // Coluna e troca de responsável são do dono (ou do SUP); demanda sem responsável pode ser assumida.
    var travaColuna = !nova && !CtiApp.podeMover(d);
    var travaResp = !nova && travaColuna && u.temUsuario(d.codUsuResp);

    CtiApp.abrirModal({
      titulo: nova ? 'Nova demanda' : 'Editar demanda #' + d.idTarefa,
      tamanho: 'formulario',
      registro: nova ? null : { entidade: 'T', id: d.idTarefa, editando: true },
      corpo:
        // Campos numa grade compacta no topo; a descrição ocupa a largura e a altura restantes (só o texto rola).
        '<form class="g-form g-form-topo" id="dm-form" novalidate>' +
          '<div class="g-form-topo__titulo">' +
            '<label class="g-campo"><span class="g-obrigatorio">Título</span>' +
              '<input type="text" id="df-titulo" maxlength="200" required autofocus value="' + u.esc(v.titulo) + '"' +
              ' placeholder="Ex.: Ajustar procedure de fechamento do estoque"></label>' +
            // Só informativo: o servidor grava DHCRIACAO ao salvar; na inclusão mostra a hora em que o formulário abriu.
            '<label class="g-campo"><span>Criada em</span>' +
              '<input type="text" id="df-criacao" readonly tabindex="-1" class="g-campo--leitura" value="' +
              u.esc(u.dataHoraBr(nova ? u.agoraIso() : d.dhCriacao)) + '"' +
              (nova ? ' title="Data e hora de abertura; a data definitiva é gravada ao criar a demanda"' : '') + '></label>' +
          '</div>' +
          '<div class="g-form-topo__grade">' +
            '<label class="g-campo"><span>Coluna</span><select id="df-coluna"' + (travaColuna ? ' disabled title="Só o dono da demanda ou o SUP muda a coluna"' : '') + '>' + CtiApp.opcoes('colunas', v.coluna, null) + '</select></label>' +
            '<label class="g-campo"><span>Prioridade</span><select id="df-prioridade">' + CtiApp.opcoesPrioridade(v.prioridade) + '</select></label>' +
            '<label class="g-campo"><span>Prazo</span><input type="date" id="df-venc" value="' + u.esc((v.dtVenc || '').slice(0, 10)) + '"></label>' +
            '<label class="g-campo"><span>Tags</span>' +
              '<input type="text" id="df-tags" maxlength="200" value="' + u.esc(v.tags || '') + '" placeholder="separadas por vírgula"></label>' +
            '<label class="g-campo"><span>Categoria</span><select id="df-categoria">' + CtiApp.opcoes('categorias', v.idCategoria, 'Sem categoria', 'T') + '</select></label>' +
            '<label class="g-campo"><span>Setor</span><select id="df-setor">' + CtiApp.opcoes('setores', v.idSetor, 'Não informado') + '</select></label>' +
            '<div class="g-campo"><span>Solicitante</span>' + seletorUsuarioHtml('df-sol', v.codUsuSol) + '</div>' +
            '<label class="g-campo"><span>Responsável</span><select id="df-resp"' + (semResponsaveis || travaResp ? ' disabled' : '') +
              (travaResp ? ' title="Só o responsável atual ou o SUP troca o responsável."' : '') + '>' +
              CtiApp.opcoes('responsaveis', v.codUsuResp, 'Não atribuído') + '</select></label>' +
          '</div>' +
          (semResponsaveis ? '<p class="g-form__nota">O SUP precisa escolher o grupo dos responsáveis em Configurações para atribuir um responsável.</p>'
            : (travaResp ? '<p class="g-form__nota">Só o responsável atual ou o SUP troca o responsável.</p>' : '')) +
          u.secaoForm('ri-file-text-line', 'Descrição', 'opcional, aceita Markdown',
            '<div class="g-form-editor">' +
              '<div class="g-editor__barra" id="df-barra">' + CtiMarkdown.barraHtml() +
                '<button type="button" class="g-btn g-btn--fantasma g-btn--p g-editor__modo" id="df-previa">' +
                  '<i class="ri-eye-line" aria-hidden="true"></i> Prévia</button></div>' +
              '<textarea id="df-descricao" class="g-editor__texto" aria-label="Descrição" placeholder="Contexto, passos, critérios de aceite… (aceita Markdown)">' +
                u.esc(v.descricao || '') + '</textarea>' +
              '<div class="g-md g-form-editor__previa" id="df-previa-area" hidden></div>' +
            '</div>', 'g-form-secao--texto') +
        '</form>',
      rodape:
        '<button type="button" class="g-btn g-btn--cancelar" id="df-cancelar">Cancelar</button>' +
        '<button type="button" class="g-btn g-btn--primario" id="df-salvar"><i class="ri-save-line" aria-hidden="true"></i> ' +
          (nova ? 'Criar demanda' : 'Salvar alterações') + '</button>'
    });

    var form = u.el('dm-form');
    CtiApp.vigiarFormulario(form);
    ligarSeletorUsuario('df-sol', function (codUsu) {
      // Sugere o setor da última demanda do mesmo solicitante.
      var setor = u.el('df-setor');
      if (setor.value) { return; }
      var ultima = CtiApp.estado.demandas.filter(function (x) { return x.codUsuSol === codUsu && x.idSetor; })
        .sort(function (a, b) { return (b.dhCriacao || '') < (a.dhCriacao || '') ? -1 : 1; })[0];
      if (ultima && CtiApp.setor(ultima.idSetor) && CtiApp.setor(ultima.idSetor).ativo) { setor.value = String(ultima.idSetor); }
    });
    CtiMarkdown.ligar(u.el('df-barra'), u.el('df-descricao'));
    u.el('df-previa').addEventListener('click', function () {
      var area = u.el('df-previa-area');
      var texto = u.el('df-descricao');
      var mostrar = area.hidden;
      area.innerHTML = mostrar ? (CtiMarkdown.renderizar(texto.value) || '<p class="g-form__nota">Nada para mostrar.</p>') : '';
      area.hidden = !mostrar;
      texto.hidden = mostrar;
      u.el('df-previa').innerHTML = mostrar ? '<i class="ri-edit-line" aria-hidden="true"></i> Editar' : '<i class="ri-eye-line" aria-hidden="true"></i> Prévia';
    });
    u.el('df-cancelar').addEventListener('click', function () { CtiApp.fecharModal(); });
    u.el('df-salvar').addEventListener('click', function () { salvar(d); });
    form.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { salvar(d); }
    });
  }

  function salvar(d) {
    var titulo = u.el('df-titulo').value.trim();
    if (!titulo) {
      CtiApp.erro('Informe o título da demanda.');
      u.el('df-titulo').focus();
      return;
    }
    var payload = {
      idTarefa: d ? d.idTarefa : null,
      versao: d ? d.versao : null,
      titulo: titulo,
      descricao: u.el('df-descricao').value.trim() ? u.el('df-descricao').value : null,
      coluna: u.el('df-coluna').value,
      prioridade: u.el('df-prioridade').value,
      idCategoria: u.numeroOuNulo(u.el('df-categoria').value),
      idSetor: u.numeroOuNulo(u.el('df-setor').value),
      codUsuSol: u.numeroOuNulo(u.el('df-sol').value),
      codUsuResp: u.numeroOuNulo(u.el('df-resp').value),
      dtVenc: u.el('df-venc').value || null,
      tags: u.el('df-tags').value.trim() || null
    };
    CtiApp.ocupado(u.el('df-salvar'), CtiApp.dados.salvarDemanda(payload))
      .then(function (id) {
        CtiApp.fecharModal(true);
        CtiApp.sucesso(d ? 'Alterações salvas.' : 'Demanda #' + id + ' criada.');
        return CtiApp.recarregar(['demandas']).then(function () {
          if (d) { abrir(d.idTarefa); }
        });
      }, function (e) { CtiApp.falhaAoGravar(e); });
  }

  // ------------------------------------------- seletor de usuário (busca)

  /** Campo com busca sobre todos os usuários ativos; o valor fica num input escondido. */
  function seletorUsuarioHtml(id, codUsu) {
    var nome = u.temUsuario(codUsu) ? CtiApp.nomeUsuario(codUsu) : '';
    return '<div class="g-seletor g-seletor--pessoa" id="' + id + '-caixa">' +
      '<span class="g-seletor__avatar" id="' + id + '-avatar">' + avatarSeletor(codUsu, nome) + '</span>' +
      '<input type="hidden" id="' + id + '" value="' + u.esc(codUsu || '') + '">' +
      '<input type="text" id="' + id + '-busca" value="' + u.esc(nome) + '" placeholder="Digite o nome ou código"' +
        ' autocomplete="off" role="combobox" aria-expanded="false" aria-controls="' + id + '-lista">' +
      '<div class="g-seletor__lista" id="' + id + '-lista" role="listbox" hidden></div></div>';
  }

  /** Foto (ou sigla) de quem está escolhido; vazio mostra o avatar neutro. */
  function avatarSeletor(codUsu, nome) {
    return u.temUsuario(codUsu) ? CtiApp.avatarPessoa(codUsu, nome, 'p') : CtiFotos.avatar(null, null, 'p');
  }

  function ligarSeletorUsuario(id, aoEscolher) {
    var valor = u.el(id);
    var busca = u.el(id + '-busca');
    var lista = u.el(id + '-lista');
    var opcoes = [];
    var marcado = -1;

    function filtrar() {
      var termo = u.normal(busca.value).trim();
      opcoes = CtiApp.estado.config.usuarios.filter(function (x) {
        return !termo || u.normal(x.nomeUsu).indexOf(termo) >= 0 || String(x.codUsu) === termo;
      }).slice(0, 40);
      marcado = opcoes.length ? 0 : -1;
      lista.innerHTML = opcoes.length ? opcoes.map(function (x, i) {
        return '<button type="button" class="g-seletor__opcao" role="option" data-i="' + i + '" aria-selected="' + (i === marcado) + '">' +
          CtiFotos.avatar(x.codUsu, x.nomeUsu, 'p') + u.esc(x.nomeUsu) + '<small>' + Number(x.codUsu) + '</small></button>';
      }).join('') : '<p class="g-vazio">Nenhum usuário encontrado.</p>';
      lista.hidden = false;
      busca.setAttribute('aria-expanded', 'true');
      CtiFotos.preencher(lista);
    }

    function escolher(i) {
      var x = opcoes[i];
      if (!x) { return; }
      valor.value = x.codUsu;
      busca.value = x.nomeUsu;
      pintarAvatar();
      fechar();
      busca.dispatchEvent(new Event('change', { bubbles: true }));
      if (aoEscolher) { aoEscolher(x.codUsu); }
    }

    function fechar() {
      lista.hidden = true;
      busca.setAttribute('aria-expanded', 'false');
    }

    busca.addEventListener('focus', function () { busca.select(); filtrar(); });
    busca.addEventListener('input', function () {
      valor.value = '';
      pintarAvatar();
      filtrar();
    });

    function pintarAvatar() {
      var alvo = u.el(id + '-avatar');
      alvo.innerHTML = avatarSeletor(valor.value, busca.value);
      CtiFotos.preencher(alvo);
    }
    busca.addEventListener('keydown', function (e) {
      if (lista.hidden) { return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        marcado = Math.max(0, Math.min(opcoes.length - 1, marcado + (e.key === 'ArrowDown' ? 1 : -1)));
        u.cada(lista, '[data-i]', function (b) { b.setAttribute('aria-selected', Number(b.dataset.i) === marcado ? 'true' : 'false'); });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        escolher(marcado);
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        fechar();
      }
    });
    busca.addEventListener('blur', function () {
      setTimeout(function () {
        fechar();
        // Texto digitado sem escolher da lista não vale como usuário.
        if (!valor.value) { busca.value = ''; }
      }, 150);
    });
    lista.addEventListener('mousedown', function (e) {
      var b = e.target.closest('[data-i]');
      if (b) {
        e.preventDefault();
        escolher(Number(b.dataset.i));
      }
    });
  }

  return { abrir: abrir, formulario: formulario, atualizarSeAberta: atualizarSeAberta };
})();
