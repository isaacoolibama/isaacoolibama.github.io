/**
 * Documentação: base de conhecimento da equipe.
 *
 * Cada documento junta, num formulário só e tudo opcional (ao menos um):
 *   descrição em Markdown escrita aqui (procedimento, explicação da procedure...)
 *   vários anexos (zip, rar, fonte, PDF), até 10 MB cada
 *   link externo (wiki, drive) e referência de fonte (repositório, branch, commit/tag, caminho)
 * O tipo de documento (procedure, trigger...) organiza a navegação lateral.
 */
var CtiDocumentos = (function () {
  'use strict';

  var u = CtiUtil;
  /** Espelham DocumentoService (TAMANHO_MAXIMO_ANEXO, TAMANHO_MAXIMO_ENVIO, MAXIMO_ANEXOS_POR_ENVIO). */
  var LIMITE_ANEXO = 10 * 1024 * 1024;
  var LIMITE_ENVIO = 25 * 1024 * 1024;
  var MAXIMO_POR_ENVIO = 10;
  var SITUACOES = { O: 'Publicado', R: 'Em revisão', P: 'Rascunho' };
  var COR_SITUACAO = { O: '#3E9B4E', R: '#B7791F', P: '#8B9691' };
  var ICONE_SITUACAO = { O: 'ri-checkbox-circle-line', R: 'ri-eye-line', P: 'ri-draft-line' };

  /** Selo da situação com ícone e cor (lista e leitor). */
  function seloSituacao(status) {
    return '<span class="g-selo" style="--c:' + (COR_SITUACAO[status] || '#8B9691') + '">' +
      (ICONE_SITUACAO[status] ? '<i class="' + ICONE_SITUACAO[status] + '" aria-hidden="true"></i>' : '') +
      u.esc(SITUACOES[status] || status) + '</span>';
  }

  var filtro = { tipoObj: '', categoria: '' };
  var aberto = null;        // documento no leitor
  // Editor: arquivos escolhidos ({ chave, b64, nome, tipo, tamanho }) e ids dos anexos atuais a retirar.
  var novosAnexos = [];
  var anexosRemovidos = {};

  function iniciar() {
    CtiApp.aoMudar(function (parte) {
      if (parte === 'documentos' || parte === 'config') { pintar(); }
    });
    u.el('dc-novo').addEventListener('click', function () { novo({}); });
    u.el('dc-tipos').addEventListener('click', function (e) {
      var b = e.target.closest('[data-tipo]');
      if (!b) { return; }
      filtro.tipoObj = b.dataset.tipo;
      fecharLeitor();
      pintar();
    });
    u.el('dc-categoria').addEventListener('change', function (e) { filtro.categoria = e.target.value; pintarLista(); });
    u.el('dc-lista').addEventListener('click', function (e) {
      var b = e.target.closest('[data-doc]');
      if (b) { abrirDocumento(Number(b.dataset.doc)); }
    });
  }

  function documentos() { return CtiApp.estado.documentos; }

  function pintar() {
    if (!CtiApp.estado.carregou.documentos) {
      u.el('dc-lista').innerHTML = '<p class="g-vazio">Carregando…</p>';
      return;
    }
    pintarTipos();
    u.el('dc-categoria').innerHTML = CtiApp.opcoes('categorias', filtro.categoria, 'Todas as categorias', 'D');
    pintarLista();
  }

  function pintarTipos() {
    var docs = documentos();
    // Tipo desativado sai do menu (só aparece nas Configurações); o documento continua em "Todos".
    var ativos = CtiApp.estado.config.tiposObjeto.filter(function (t) { return t.ativo !== false; });
    if (filtro.tipoObj && !u.porId(ativos, 'codigo', filtro.tipoObj)) { filtro.tipoObj = ''; }
    var tipo = function (codigo, icone, nome, qtd) {
      return '<button type="button" class="g-docs__tipo' + (filtro.tipoObj === codigo ? ' g-docs__tipo--ativo' : '') +
        '" data-tipo="' + u.esc(codigo) + '" aria-pressed="' + (filtro.tipoObj === codigo) + '">' +
        '<i class="' + u.icone(icone, 'ri-file-line') + '" aria-hidden="true"></i><span>' + u.esc(nome) + '</span><small>' + qtd + '</small></button>';
    };
    u.el('dc-tipos').innerHTML = tipo('', 'ri-stack-line', 'Todos', docs.length) +
      ativos.map(function (t) {
        return tipo(t.codigo, t.icone, t.nome, docs.filter(function (d) { return d.tipoObj === t.codigo; }).length);
      }).join('');
  }

  function pintarLista() {
    var lista = documentos().filter(function (d) {
      if (filtro.tipoObj && d.tipoObj !== filtro.tipoObj) { return false; }
      if (filtro.categoria && String(d.idCategoria) !== filtro.categoria) { return false; }
      return true;
    });
    u.el('dc-titulo-lista').textContent = filtro.tipoObj ? CtiApp.tipoObjeto(filtro.tipoObj).nome : 'Todos os documentos';
    u.el('dc-contagem').textContent = u.plural(lista.length, 'documento', 'documentos');
    u.el('dc-lista').innerHTML = lista.length ? lista.map(itemHtml).join('')
      : '<div class="g-vazio"><i class="ri-book-2-line" aria-hidden="true"></i>Nenhum documento aqui ainda.' +
        '<br><button type="button" class="g-btn g-btn--primario g-btn--p" style="margin-top:10px" data-requer="incluir" id="dc-novo-vazio">' +
        '<i class="ri-add-line" aria-hidden="true"></i> Criar documento</button></div>';
    var botao = u.el('dc-novo-vazio');
    if (botao) { botao.addEventListener('click', function () { novo({ tipoObj: filtro.tipoObj }); }); }
  }

  /** Linha de documento: usada na lista e na aba de arquivos da demanda. */
  function itemHtml(d) {
    var cat = CtiApp.categoria(d.idCategoria);
    var t = CtiApp.tipoObjeto(d.tipoObj);
    var parte = function (icone, texto) {
      return '<span><i class="' + icone + '" aria-hidden="true"></i>' + texto + '</span>';
    };
    return '<button type="button" class="g-doc" data-doc="' + Number(d.idDocumento) + '">' +
      '<span class="g-doc__icone" style="--c:' + u.cor(cat && cat.cor, '#8B9691') + '">' +
        '<i class="' + u.icone(t.icone, 'ri-file-line') + '" aria-hidden="true"></i></span>' +
      '<span class="g-doc__corpo">' +
        '<span class="g-doc__titulo">' + u.esc(d.titulo) + '</span>' +
        '<span class="g-doc__meta">' +
          parte(u.icone(t.icone, 'ri-file-line'), u.esc(t.nome)) +
          // TIPO 'T' = tem descrição (a lista não traz o texto).
          (d.tipo === 'T' ? parte('ri-file-text-line', 'descrição') : '') +
          (d.qtdAnexos ? parte('ri-attachment-2', u.plural(d.qtdAnexos, 'anexo', 'anexos') + ', ' + u.tamanho(d.tamAnexos)) : '') +
          (d.urlDoc ? parte('ri-links-line', 'link') : '') +
          (d.repositorio ? parte('ri-git-branch-line', u.esc([d.branch, d.revisao].filter(Boolean).join(' @ ') || 'repositório')) : '') +
          (d.idTarefa ? parte('ri-task-line', '#' + Number(d.idTarefa) + ' ' + u.esc(d.tituloTarefa || '')) : '') +
          parte('ri-time-line', u.dataHoraBr(d.dhAlter)) +
        '</span>' +
      '</span>' +
      (d.status && d.status !== 'O' ? seloSituacao(d.status) : '') +
      '</button>';
  }

  // ================================================================ leitor

  function mostrarLeitor(html) {
    u.el('dc-painel-lista').hidden = true;
    var leitor = u.el('dc-painel-leitor');
    leitor.hidden = false;
    leitor.innerHTML = html;
    u.el('g-conteudo').scrollTop = 0;
    return leitor;
  }

  function fecharLeitor() {
    if (aberto) { CtiPresenca.definirContexto({ entidade: null }); }
    aberto = null;
    novosAnexos = [];
    anexosRemovidos = {};
    u.el('dc-painel-leitor').hidden = true;
    u.el('dc-painel-lista').hidden = false;
  }

  function abrirDocumento(id) {
    mostrarLeitor('<p class="g-vazio">Carregando…</p>');
    if (!CtiApp.estado.carregou.documentos) { CtiApp.recarregar(['documentos']); }
    CtiApp.dados.detalharDocumento(id)
      .then(function (d) {
        aberto = d;
        CtiPresenca.definirContexto({ entidade: 'D', idRegistro: d.idDocumento, editando: false });
        pintarLeitor(d);
      })
      .catch(function (e) {
        fecharLeitor();
        CtiApp.erro('Não foi possível abrir o documento: ' + e.message);
      });
  }

  function pintarLeitor(d) {
    var t = CtiApp.tipoObjeto(d.tipoObj);
    var tags = u.tags(d.tags);
    var dado = function (rotulo, html) { return '<div><dt>' + rotulo + '</dt><dd>' + html + '</dd></div>'; };
    // Coluna lateral: dados do documento e o que não é texto (anexos, link, repositório).
    var lado = [u.secaoForm('ri-information-line', 'Dados', '',
      '<dl class="g-leitor__dados">' +
        dado('Tipo', '<span class="g-leitor__tipo"><i class="' + u.icone(t.icone, 'ri-file-line') + '" aria-hidden="true"></i>' + u.esc(t.nome) + '</span>') +
        dado('Categoria', CtiApp.seloCategoria(d.idCategoria)) +
        dado('Situação', seloSituacao(d.status)) +
        (d.idTarefa ? dado('Demanda', '<button type="button" class="g-btn g-btn--link" id="dc-demanda">#' +
          Number(d.idTarefa) + ' ' + u.esc(d.tituloTarefa || '') + '</button>') : '') +
        (u.temUsuario(d.codUsuResp) ? dado('Responsável', CtiApp.pessoaHtml(d.codUsuResp, d.nomeResp)) : '') +
        (tags.length ? dado('Tags', tags.map(function (x) { return '<span class="g-tag">' + u.esc(x) + '</span>'; }).join(' ')) : '') +
        dado('Alterado', 'por ' + u.esc(d.nomeUsuAlter || '—') + '<br><small class="g-autoria">' + u.dataHoraBr(d.dhAlter) + '</small>') +
      '</dl>')];
    var anexos = d.anexos || [];
    if (anexos.length) {
      lado.push(u.secaoForm('ri-attachment-2', anexos.length === 1 ? 'Anexo' : 'Anexos (' + anexos.length + ')', '',
        '<div class="g-anexos-lista">' + anexos.map(function (a) {
          return '<div class="g-previa g-anexo-linha"><i class="' + iconeArquivo(a.nomeArquivo) + ' g-doc-form__anexo-icone" aria-hidden="true"></i>' +
            '<div class="g-anexo-linha__nome"><strong>' + u.esc(a.nomeArquivo || 'arquivo') + '</strong><br><small class="g-form__nota">' +
            u.esc(a.tipoArquivo || 'tipo não informado') + ', ' + u.tamanho(a.tamArquivo) + '</small></div>' +
            '<button type="button" class="g-btn g-btn--fantasma g-btn--p" data-baixar="' + Number(a.idAnexo) + '">' +
            '<i class="ri-download-2-line" aria-hidden="true"></i> Baixar</button></div>';
        }).join('') + '</div>'));
    }
    if (d.urlDoc) {
      var url = u.urlSegura(d.urlDoc);
      lado.push(u.secaoForm('ri-links-line', 'Link', '', url
        ? '<p><a class="g-btn g-btn--fantasma g-btn--p" href="' + u.esc(url) + '" target="_blank" rel="noopener noreferrer">' +
          '<i class="ri-external-link-line" aria-hidden="true"></i> Abrir link</a></p><p class="g-form__nota g-leitor__url">' + u.esc(url) + '</p>'
        : '<p class="g-form__nota">Link inválido.</p>'));
    }
    if (d.repositorio) {
      var repo = u.urlSegura(d.repositorio);
      lado.push(u.secaoForm('ri-git-branch-line', 'Repositório', '', '<dl class="g-leitor__dados">' +
        dado('Endereço', repo ? '<a class="g-leitor__url" href="' + u.esc(repo) + '" target="_blank" rel="noopener noreferrer">' + u.esc(repo) + '</a>' : '—') +
        dado('Branch', u.esc(d.branch || '—')) +
        dado('Commit ou tag', '<code>' + u.esc(d.revisao || '—') + '</code>') +
        dado('Caminho', '<code>' + u.esc(d.caminho || '—') + '</code>') + '</dl>'));
    }
    // Sem descrição, anexos, link e repositório vão para a coluna principal (não ficam escondidos embaixo dos dados).
    var principal = d.conteudo ? '<div class="g-md">' + CtiMarkdown.renderizar(d.conteudo) + '</div>'
      : lado.length > 1 ? '<div class="g-leitor__cartoes">' + lado.splice(1).join('') + '</div>'
      : '<p class="g-vazio"><i class="ri-file-text-line" aria-hidden="true"></i>Documento sem conteúdo.</p>';

    // Documento de demanda com responsável: só ele e o SUP alteram (PosseDemanda.java).
    var demanda = d.idTarefa ? CtiApp.demanda(d.idTarefa) : null;
    var posse = !demanda || CtiApp.temPosse(demanda);
    mostrarLeitor(
      '<div class="g-leitor__cab">' +
        '<button type="button" class="g-icone-btn" id="dc-voltar" aria-label="Voltar para a lista"><i class="ri-arrow-left-line" aria-hidden="true"></i></button>' +
        '<h2 class="g-leitor__titulo">' + u.esc(d.titulo) + '</h2>' +
        (posse ? '<div class="g-cab__acoes">' +
          '<button type="button" class="g-btn g-btn--perigo" id="dc-excluir" data-requer="excluir"><i class="ri-delete-bin-line" aria-hidden="true"></i> Excluir</button>' +
          '<button type="button" class="g-btn g-btn--primario" id="dc-editar" data-requer="alterar"><i class="ri-edit-line" aria-hidden="true"></i> Editar</button>' +
        '</div>' : '<span class="g-form__nota" title="Só o responsável pela demanda e o SUP alteram"><i class="ri-lock-line" aria-hidden="true"></i> ' +
          u.esc(CtiApp.nomeUsuario(demanda.codUsuResp)) + ' (responsável) e o SUP alteram</span>') +
      '</div>' +
      '<div class="g-leitor__grade">' +
        '<div class="g-leitor__corpo">' + principal + '</div>' +
        '<aside class="g-leitor__lado">' + lado.join('') + '</aside>' +
      '</div>');

    CtiFotos.preencher(u.el('dc-painel-leitor'));
    u.el('dc-voltar').addEventListener('click', fecharLeitor);
    if (posse) {
      u.el('dc-editar').addEventListener('click', function () { editor(d); });
      u.el('dc-excluir').addEventListener('click', excluir);
    }
    u.cada(u.el('dc-painel-leitor'), '[data-baixar]', function (b) {
      b.addEventListener('click', function () { baixar(Number(b.dataset.baixar), b); });
    });
    if (u.el('dc-demanda')) { u.el('dc-demanda').addEventListener('click', function () { CtiDemanda.abrir(d.idTarefa); }); }
  }

  function iconeArquivo(nome) {
    var ext = String(nome || '').toLowerCase().split('.').pop();
    if (/^(zip|rar|7z|gz|tar)$/.test(ext)) { return 'ri-file-zip-line'; }
    if (ext === 'pdf') { return 'ri-file-pdf-2-line'; }
    if (/^(sql|java|js|xml|json|py|kt|txt|csv)$/.test(ext)) { return 'ri-file-code-line'; }
    if (/^(png|jpe?g|gif|webp|svg)$/.test(ext)) { return 'ri-image-line'; }
    return 'ri-file-line';
  }

  function baixar(idAnexo, botao) {
    CtiApp.ocupado(botao, CtiApp.dados.baixarAnexo(idAnexo))
      .then(function (resp) {
        var binario = atob(resp.arquivoB64);
        var bytes = new Uint8Array(binario.length);
        for (var i = 0; i < binario.length; i++) { bytes[i] = binario.charCodeAt(i); }
        // Tipo genérico de propósito: o navegador não renderiza um anexo de terceiro na origem do Om.
        var url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
        var a = document.createElement('a');
        a.href = url;
        a.download = resp.nomeArquivo || ('anexo-' + idAnexo);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      })
      .catch(function (e) { CtiApp.erro('Não foi possível baixar o anexo: ' + e.message); });
  }

  function excluir() {
    var d = aberto;
    CtiApp.confirmar({ titulo: 'Excluir o documento?', mensagem: '"' + d.titulo + '" sai da base de conhecimento.',
      botao: 'Excluir documento', perigo: true }).then(function (ok) {
      if (!ok) { return; }
      CtiApp.ocupado(u.el('dc-excluir'), CtiApp.dados.excluirDocumento({ id: d.idDocumento, versao: d.versao }))
        .then(function () {
          fecharLeitor();
          CtiApp.sucesso('Documento excluído.');
          CtiApp.recarregar(['documentos', 'demandas']);
        }, function (e) { CtiApp.falhaAoGravar(e, 'O documento não foi excluído: '); });
    });
  }

  // ================================================================ editor

  /** pre: valores iniciais (idTarefa, idCategoria, tipoObj, titulo). */
  function novo(pre) {
    editor(Object.assign({
      idDocumento: null, idTarefa: null,
      conteudo: '', status: 'O', codUsuResp: CtiApp.estado.sessao.codUsu
    }, pre, {
      titulo: pre.titulo ? 'Documentação: ' + pre.titulo : '',
      // Tipo e categoria vindos de fora (padrão, demanda ligada) só entram se estiverem ativos.
      tipoObj: CtiApp.tipoParaNovo(pre.tipoObj || 'OUTRO'),
      idCategoria: CtiApp.categoriaParaNovo(pre.idCategoria, 'D')
    }));
  }

  /** Editor num modal só: dados, descrição, anexo, link e repositório juntos. */
  function editor(d) {
    var nova = !d.idDocumento;
    novosAnexos = [];
    anexosRemovidos = {};
    // Só entram as demandas em que o usuário pode documentar (a atual continua na lista).
    var demandas = CtiApp.estado.demandas.filter(function (x) {
      return CtiApp.temPosse(x) || String(x.idTarefa) === String(d.idTarefa);
    });
    var opcoesDemanda = u.opcao('', 'Nenhuma', d.idTarefa) +
      (d.idTarefa && !CtiApp.demanda(d.idTarefa) ? u.opcao(d.idTarefa, '#' + d.idTarefa + ' ' + (d.tituloTarefa || ''), d.idTarefa) : '') +
      demandas.map(function (x) { return u.opcao(x.idTarefa, '#' + x.idTarefa + ' ' + x.titulo, d.idTarefa); }).join('');

    CtiApp.abrirModal({
      titulo: nova ? 'Novo documento' : 'Editar documento',
      tamanho: 'amplo',
      registro: nova ? null : { entidade: 'D', id: d.idDocumento, editando: true },
      aoFechar: function () {
        novosAnexos = [];
        anexosRemovidos = {};
        if (aberto && !u.el('dc-painel-leitor').hidden) {
          CtiPresenca.definirContexto({ entidade: 'D', idRegistro: aberto.idDocumento, editando: false });
        }
      },
      corpo:
        // Duas colunas com rolagem própria, como o detalhe da demanda: texto à esquerda, dados à direita.
        '<form class="g-form g-doc-form g-form-colunas" id="dc-form" novalidate>' +
        '<div class="g-form-colunas__principal">' +
          '<label class="g-campo"><span class="g-obrigatorio">Título</span>' +
            '<input type="text" id="dc-titulo" maxlength="200" autofocus value="' + u.esc(d.titulo || '') + '"></label>' +
          u.secaoForm('ri-file-text-line', 'Descrição', 'opcional, aceita Markdown',
            '<div class="g-form-editor">' +
              '<div class="g-editor__barra" id="dc-barra">' + CtiMarkdown.barraHtml() +
                '<button type="button" class="g-btn g-btn--fantasma g-btn--p g-editor__modo" id="dc-previa"><i class="ri-eye-line" aria-hidden="true"></i> Prévia</button></div>' +
              '<textarea id="dc-conteudo" class="g-editor__texto" aria-label="Descrição" placeholder="# título, **negrito**, ```sql …```">' +
                u.esc(d.conteudo || '') + '</textarea>' +
              '<div class="g-md g-form-editor__previa" id="dc-previa-area" hidden></div>' +
            '</div>', 'g-form-secao--texto') +
        '</div>' +
        '<aside class="g-form-colunas__lado">' +
          u.secaoForm('ri-information-line', 'Dados', '',
            // Campos curtos em pares; a demanda ligada tem título longo e fica com a linha inteira.
            '<div class="g-form__linha">' +
              '<label class="g-campo"><span>Tipo de documento</span><select id="dc-f-tipoobj">' + CtiApp.opcoes('tipos', d.tipoObj, null) + '</select></label>' +
              '<label class="g-campo"><span>Categoria</span><select id="dc-f-categoria">' + CtiApp.opcoes('categorias', d.idCategoria, 'Sem categoria', 'D') + '</select></label>' +
            '</div>' +
            '<div class="g-form__linha">' +
              '<label class="g-campo"><span>Situação</span><select id="dc-f-status">' +
                ['O', 'R', 'P'].map(function (k) {
                  return u.opcao(k, SITUACOES[k], d.status || 'O', { icone: ICONE_SITUACAO[k], cor: COR_SITUACAO[k] });
                }).join('') + '</select></label>' +
              '<label class="g-campo"><span>Tags</span><input type="text" id="dc-f-tags" maxlength="200" value="' + u.esc(d.tags || '') + '" placeholder="separadas por vírgula"></label>' +
            '</div>' +
            '<label class="g-campo"><span>Demanda ligada</span><select id="dc-f-demanda">' + opcoesDemanda + '</select></label>') +
          u.secaoForm('ri-attachment-2', 'Anexos', 'opcional; zip, rar, fonte, PDF… até ' + (LIMITE_ANEXO / 1048576) + ' MB cada',
            '<input type="file" id="dc-arquivo" multiple class="g-oculto-acessivel" tabindex="-1" aria-hidden="true">' +
            '<div class="g-anexos-lista" id="dc-anexos"></div>' +
            '<div><button type="button" class="g-btn g-btn--fantasma g-btn--p" data-anexo="escolher">' +
              '<i class="ri-upload-2-line" aria-hidden="true"></i> Adicionar arquivos</button></div>') +
          u.secaoForm('ri-links-line', 'Link e repositório', 'opcional',
            '<label class="g-campo"><span>Link</span>' +
              '<input type="url" id="dc-url" maxlength="500" placeholder="https://…" value="' + u.esc(d.urlDoc || '') + '"></label>' +
            '<label class="g-campo"><span>Repositório</span>' +
              '<input type="url" id="dc-repo" maxlength="500" placeholder="https://git…" value="' + u.esc(d.repositorio || '') + '"></label>' +
            '<div class="g-form__linha">' +
              '<label class="g-campo"><span>Branch</span><input type="text" id="dc-branch" maxlength="120" value="' + u.esc(d.branch || '') + '"></label>' +
              '<label class="g-campo"><span>Commit ou tag</span><input type="text" id="dc-revisao" maxlength="100" value="' + u.esc(d.revisao || '') + '"></label>' +
            '</div>' +
            '<label class="g-campo"><span>Caminho</span><input type="text" id="dc-caminho" maxlength="500" placeholder="src/main/…" value="' + u.esc(d.caminho || '') + '"></label>') +
        '</aside>' +
        '</form>',
      rodape:
        '<button type="button" class="g-btn g-btn--cancelar" id="dc-cancelar">Cancelar</button>' +
        '<button type="button" class="g-btn g-btn--primario" id="dc-salvar"><i class="ri-save-line" aria-hidden="true"></i> ' +
          (nova ? 'Criar documento' : 'Salvar documento') + '</button>'
    });

    var form = u.el('dc-form');
    CtiApp.vigiarFormulario(form);
    CtiMarkdown.ligar(u.el('dc-barra'), u.el('dc-conteudo'));
    u.el('dc-previa').addEventListener('click', function () {
      var area = u.el('dc-previa-area');
      var texto = u.el('dc-conteudo');
      var mostrar = area.hidden;
      area.innerHTML = mostrar ? (CtiMarkdown.renderizar(texto.value) || '<p class="g-form__nota">Nada para mostrar.</p>') : '';
      area.hidden = !mostrar;
      texto.hidden = mostrar;
      u.el('dc-previa').innerHTML = mostrar ? '<i class="ri-edit-line" aria-hidden="true"></i> Editar' : '<i class="ri-eye-line" aria-hidden="true"></i> Prévia';
    });
    var arquivo = u.el('dc-arquivo');
    arquivo.addEventListener('change', function () {
      lerArquivos(arquivo).then(function () {
        arquivo.value = '';
        form.dataset.sujo = 'S';
        pintarAnexos(d);
      });
    });
    form.addEventListener('click', function (e) {
      var acao = e.target.closest('[data-anexo]');
      if (!acao) { return; }
      var tipo = acao.dataset.anexo;
      if (tipo === 'escolher') { arquivo.click(); return; }
      if (tipo === 'descartar') {
        novosAnexos = novosAnexos.filter(function (n) { return n.chave !== acao.dataset.chave; });
      }
      if (tipo === 'remover') { anexosRemovidos[acao.dataset.id] = true; }
      if (tipo === 'manter') { delete anexosRemovidos[acao.dataset.id]; }
      form.dataset.sujo = 'S';
      pintarAnexos(d);
    });
    pintarAnexos(d);
    u.el('dc-cancelar').addEventListener('click', function () { CtiApp.fecharModal(); });
    u.el('dc-salvar').addEventListener('click', function () { salvar(d); });
  }

  /** Anexos no editor: os atuais (com remover/manter) e os escolhidos agora (com descartar). */
  function pintarAnexos(d) {
    var botao = function (atributos, icone, rotulo, classe) {
      return '<button type="button" class="g-btn ' + (classe || 'g-btn--fantasma') + ' g-btn--p" ' + atributos + '>' +
        '<i class="' + icone + '" aria-hidden="true"></i> ' + rotulo + '</button>';
    };
    var linha = function (classe, nome, nota, acao) {
      return '<div class="g-previa g-anexo-linha' + classe + '"><i class="' + iconeArquivo(nome) + ' g-doc-form__anexo-icone" aria-hidden="true"></i>' +
        '<div class="g-anexo-linha__nome"><strong>' + u.esc(nome || 'arquivo') + '</strong><br><small class="g-form__nota">' + nota + '</small></div>' +
        acao + '</div>';
    };
    var html = (d.anexos || []).map(function (a) {
      var sai = !!anexosRemovidos[a.idAnexo];
      return linha(sai ? ' g-anexo-linha--sai' : '', a.nomeArquivo,
        u.tamanho(a.tamArquivo) + (sai ? ', será removido ao salvar' : ''),
        sai ? botao('data-anexo="manter" data-id="' + Number(a.idAnexo) + '"', 'ri-arrow-go-back-line', 'Manter')
          : botao('data-anexo="remover" data-id="' + Number(a.idAnexo) + '"', 'ri-delete-bin-line', 'Remover', 'g-btn--cancelar'));
    }).concat(novosAnexos.map(function (n) {
      return linha(' g-anexo-linha--novo', n.nome, u.tamanho(n.tamanho) + ', será enviado ao salvar',
        botao('data-anexo="descartar" data-chave="' + u.esc(n.chave) + '"', 'ri-close-line', 'Descartar', 'g-btn--cancelar'));
    })).join('');
    u.el('dc-anexos').innerHTML = html || '<p class="g-form__nota">Nenhum arquivo anexado.</p>';
  }

  /**
   * Lê os arquivos escolhidos em base64. Confere os limites antes de ler:
   * não carrega 50 MB para o servidor recusar.
   */
  function lerArquivos(input) {
    var lista = Array.prototype.slice.call(input.files || []);
    var total = novosAnexos.reduce(function (t, n) { return t + n.tamanho; }, 0);
    var aceitos = [];
    for (var i = 0; i < lista.length; i++) {
      var f = lista[i];
      if (novosAnexos.length + aceitos.length >= MAXIMO_POR_ENVIO) {
        CtiApp.erro('Envie no máximo ' + MAXIMO_POR_ENVIO + ' arquivos por vez; salve e adicione o restante depois.');
        break;
      }
      if (f.size > LIMITE_ANEXO) {
        CtiApp.erro(f.name + ' tem ' + u.tamanho(f.size) + ' e passa do limite de ' + (LIMITE_ANEXO / 1048576) + ' MB.');
        continue;
      }
      if (total + f.size > LIMITE_ENVIO) {
        CtiApp.erro('Os arquivos passam de ' + (LIMITE_ENVIO / 1048576) + ' MB juntos; salve e adicione o restante depois.');
        break;
      }
      total += f.size;
      aceitos.push(f);
    }
    return Promise.all(aceitos.map(function (f) {
      return paraBase64(f).then(function (b64) {
        novosAnexos.push({ chave: String(Date.now()) + '-' + Math.random().toString(36).slice(2), b64: b64,
          nome: f.name, tipo: f.type || 'application/octet-stream', tamanho: f.size });
      }, function () {
        CtiApp.erro('Não foi possível ler o arquivo ' + f.name + '.');
      });
    }));
  }

  function paraBase64(arquivo) {
    return new Promise(function (ok, falha) {
      var leitor = new FileReader();
      leitor.onerror = falha;
      leitor.onload = function () {
        var r = String(leitor.result);
        ok(r.slice(r.indexOf(',') + 1));
      };
      leitor.readAsDataURL(arquivo);
    });
  }

  function salvar(d) {
    var nova = !d.idDocumento;
    var titulo = u.el('dc-titulo').value.trim();
    var conteudo = u.el('dc-conteudo').value;
    var url = u.el('dc-url').value.trim();
    var repo = u.el('dc-repo').value.trim();
    var ficaAnexo = novosAnexos.length > 0 || (d.anexos || []).some(function (a) { return !anexosRemovidos[a.idAnexo]; });
    var faltou = !titulo ? 'Informe o título do documento.'
      : url && !/^https?:\/\/.+/i.test(url) ? 'O link precisa começar com http:// ou https://.'
      : repo && !/^https?:\/\/.+/i.test(repo) ? 'O repositório precisa começar com http:// ou https://.'
      : !conteudo.trim() && !ficaAnexo && !url && !repo ? 'Escreva a descrição, anexe um arquivo ou informe um link.' : null;
    if (faltou) {
      CtiApp.erro(faltou);
      return;
    }
    var payload = {
      idDocumento: d.idDocumento,
      versao: nova ? null : d.versao,
      titulo: titulo,
      tipoObj: u.el('dc-f-tipoobj').value,
      idCategoria: u.numeroOuNulo(u.el('dc-f-categoria').value),
      idTarefa: u.numeroOuNulo(u.el('dc-f-demanda').value),
      status: u.el('dc-f-status').value,
      tags: u.el('dc-f-tags').value.trim() || null,
      codUsuResp: d.codUsuResp || null,
      conteudo: conteudo.trim() ? conteudo : null,
      urlDoc: url || null,
      repositorio: repo || null,
      branch: repo ? (u.el('dc-branch').value.trim() || null) : null,
      revisao: repo ? (u.el('dc-revisao').value.trim() || null) : null,
      caminho: repo ? (u.el('dc-caminho').value.trim() || null) : null,
      anexosNovos: novosAnexos.map(function (n) {
        return { nomeArquivo: n.nome, tipoArquivo: n.tipo, arquivoB64: n.b64 };
      }),
      anexosRemovidos: Object.keys(anexosRemovidos).map(Number)
    };
    CtiApp.ocupado(u.el('dc-salvar'), CtiApp.dados.salvarDocumento(payload))
      .then(function (id) {
        CtiApp.fecharModal(true);
        CtiApp.sucesso(nova ? 'Documento criado.' : 'Documento salvo.');
        return CtiApp.recarregar(['documentos', 'demandas']).then(function () { abrirDocumento(id); });
      }, function (e) {
        if (CtiApi.ehConflito(e)) {
          CtiApp.erro(CtiApi.textoDoErro(e));
          CtiApp.fecharModal(true);
          if (!nova) { abrirDocumento(d.idDocumento); }
          CtiApp.recarregar(['documentos']);
          return;
        }
        CtiApp.falhaAoGravar(e);
      });
  }

  /** Anexo rápido a partir da demanda: um documento com os arquivos escolhidos. */
  function enviarArquivos(arquivos, vinculo) {
    var lista = Array.prototype.slice.call(arquivos);
    var grande = lista.filter(function (f) { return f.size > LIMITE_ANEXO; })[0];
    var total = lista.reduce(function (t, f) { return t + f.size; }, 0);
    var problema = grande ? grande.name + ' tem ' + u.tamanho(grande.size) + ' e passa do limite de ' + (LIMITE_ANEXO / 1048576) + ' MB.'
      : lista.length > MAXIMO_POR_ENVIO ? 'Envie no máximo ' + MAXIMO_POR_ENVIO + ' arquivos por vez.'
      : total > LIMITE_ENVIO ? 'Os arquivos passam de ' + (LIMITE_ENVIO / 1048576) + ' MB juntos; envie em partes.' : null;
    if (problema) {
      CtiApp.erro(problema);
      return Promise.reject(new Error(problema));
    }
    CtiApp.aviso('Enviando ' + u.plural(lista.length, 'arquivo', 'arquivos') + '…', 'info');
    return Promise.all(lista.map(function (f) {
      return paraBase64(f).then(function (b64) {
        return { nomeArquivo: f.name, tipoArquivo: f.type || 'application/octet-stream', arquivoB64: b64 };
      });
    }))
      .then(function (novos) {
        return CtiApp.dados.salvarDocumento({
          titulo: lista.length === 1 ? lista[0].name : 'Arquivos: ' + (vinculo.titulo || '#' + vinculo.idTarefa),
          tipoObj: CtiApp.tipoParaNovo('OUTRO'), status: 'O',
          idTarefa: vinculo.idTarefa, idCategoria: CtiApp.categoriaParaNovo(vinculo.idCategoria, 'D'),
          codUsuResp: CtiApp.estado.sessao.codUsu,
          anexosNovos: novos
        });
      })
      .then(function () {
        CtiApp.sucesso(lista.length === 1 ? 'Arquivo anexado.' : 'Arquivos anexados.');
        return CtiApp.recarregar(['documentos', 'demandas']);
      }, function (e) {
        CtiApp.falhaAoGravar(e, 'Os arquivos não foram anexados: ');
        throw e;
      });
  }

  /** Um colega gravou algo: relê o documento aberto no leitor (não mexe no editor). */
  function atualizarSeAberto() {
    // Com o editor aberto (modal) o leitor espera: a gravação recarrega depois.
    if (!aberto || !aberto.idDocumento || u.el('dc-painel-leitor').hidden || u.el('dc-form')) { return; }
    var id = aberto.idDocumento;
    CtiApp.dados.detalharDocumento(id).then(function (d) {
      if (aberto && aberto.idDocumento === id && !u.el('dc-form')) {
        aberto = d;
        pintarLeitor(d);
      }
    }, function (e) {
      fecharLeitor();
      CtiApp.erro('O documento aberto não está mais disponível: ' + e.message);
    });
  }

  return {
    iniciar: iniciar,
    abrirDocumento: abrirDocumento,
    novo: novo,
    enviarArquivos: enviarArquivos,
    itemHtml: itemHtml,
    atualizarSeAberto: atualizarSeAberto
  };
})();
