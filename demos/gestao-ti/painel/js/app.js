/**
 * Núcleo do painel: fonte de dados, estado compartilhado, sessão, navegação,
 * modal, avisos, busca global e coordenação entre usuários simultâneos.
 *
 * O estado (configuração, demandas e documentos) é carregado aqui e lido
 * pelas visões; quando ele muda, as visões são repintadas por aoMudar().
 * Os filtros finos rodam na tela sobre a lista carregada.
 */
var CtiApp = (function () {
  'use strict';

  var u = CtiUtil;

  /** ?mock=1 usa dados de exemplo; sem isso, chama o serviço real. */
  var usandoMock = /[?&]mock=1\b/.test(window.location.search);
  var dados = usandoMock ? CtiMock : CtiApi;

  var estado = {
    sessao: { codUsu: null, nomeUsu: null, podeIncluir: false, podeAlterar: false, podeExcluir: false, podeConfigurar: false },
    config: { colunas: [], categorias: [], setores: [], responsaveis: [], usuarios: [], tiposObjeto: [], grupoResponsaveis: 0 },
    demandas: [],
    documentos: [],
    /** Carga da visão Cofre (CofreDTO): acessos sem senha, domínios e grupo. Só para sessao.podeCofre. */
    cofre: null,
    carregou: { config: false, demandas: false, documentos: false, cofre: false }
  };
  var ouvintes = [];
  var cargas = {};
  var visaoAtual = 'visaogeral';
  var focoAntesDoModal = null;
  var aoFecharModalAtual = null;

  var ABA_PRESENCA = { visaogeral: 'VISAOGERAL', kanban: 'KANBAN', documentos: 'DOCUMENTOS', config: 'CONFIG', cofre: 'COFRE' };
  var PRIORIDADES = { U: 'Urgente', A: 'Alta', M: 'Normal', B: 'Baixa' };
  /** Ícone e cor da prioridade nas listas suspensas; cores dos selos .g-prio--*. */
  var VISUAL_PRIORIDADE = {
    U: { icone: 'ri-alarm-warning-line', cor: '#DC4C4C' },
    A: { icone: 'ri-arrow-up-double-line', cor: '#E0782F' },
    M: { icone: 'ri-subtract-line', cor: '#56625C' },
    B: { icone: 'ri-arrow-down-line', cor: '#3A7BEA' }
  };

  /** <option> de prioridade com ícone e cor. */
  function opcoesPrioridade(selecionado, rotuloVazio) {
    return (rotuloVazio ? u.opcao('', rotuloVazio, selecionado) : '') +
      ['U', 'A', 'M', 'B'].map(function (p) { return u.opcao(p, PRIORIDADES[p], selecionado, VISUAL_PRIORIDADE[p]); }).join('');
  }

  // ============================================================== estado

  function aoMudar(fn) { ouvintes.push(fn); }
  function avisarMudanca(parte) { ouvintes.forEach(function (fn) { fn(parte); }); }

  /** Compartilha uma leitura em andamento para evitar recargas concorrentes após gravação/tempo real. */
  function carregarUmaVez(chave, fn) {
    if (cargas[chave]) { return cargas[chave]; }
    cargas[chave] = Promise.resolve().then(fn);
    cargas[chave].then(liberar, liberar);
    return cargas[chave];
    function liberar() { cargas[chave] = null; }
  }

  function carregarConfig() {
    return carregarUmaVez('config', function () { return dados.carregarConfiguracao(); }).then(function (c) {
      estado.config = c;
      estado.carregou.config = true;
      u.el('g-faixa-grupo').hidden = !(estado.sessao.sup && !c.grupoResponsaveis);
      avisarMudanca('config');
      return c;
    });
  }

  /**
   * Carrega todas as demandas, inclusive concluídas antigas (diasConcluidas 0):
   * a Visão geral conta todas as finalizadas e o recorte "Concluídas: últimos N
   * dias" do Kanban é aplicado na tela (CtiKanban). O servidor já lia todas as
   * linhas; só o corte mudou de lugar.
   */
  function carregarDemandas() {
    return carregarUmaVez('demandas', function () {
      return dados.listarDemandas({ diasConcluidas: 0 });
    }).then(function (lista) {
      estado.demandas = lista;
      estado.carregou.demandas = true;
      avisarMudanca('demandas');
      return lista;
    });
  }

  function carregarDocumentos() {
    return carregarUmaVez('documentos', function () { return dados.listarDocumentos(); }).then(function (lista) {
      estado.documentos = lista;
      estado.carregou.documentos = true;
      avisarMudanca('documentos');
      return lista;
    });
  }

  function carregarCofre() {
    return carregarUmaVez('cofre', function () { return dados.carregarCofre(); }).then(function (c) {
      estado.cofre = c;
      estado.carregou.cofre = true;
      avisarMudanca('cofre');
      return c;
    });
  }

  /** O cofre só é lido por quem pode e depois de aberto uma vez (visão ou aba das Configurações). */
  function precisaDoCofre() {
    return estado.sessao.podeCofre && (estado.carregou.cofre || visaoAtual === 'cofre');
  }

  function recarregar(partes) {
    var p = [];
    if (partes.indexOf('config') >= 0) {
      p.push(carregarConfig().catch(function (e) { falhaAoCarregar('configurações', e, estado.carregou.config); }));
    }
    if (partes.indexOf('demandas') >= 0) {
      p.push(carregarDemandas().catch(function (e) { falhaAoCarregar('demandas', e, estado.carregou.demandas); }));
    }
    if (partes.indexOf('documentos') >= 0 && (estado.carregou.documentos || visaoAtual === 'documentos')) {
      p.push(carregarDocumentos().catch(function (e) { falhaAoCarregar('documentação', e, estado.carregou.documentos); }));
    }
    if (partes.indexOf('cofre') >= 0 && (precisaDoCofre() || partes.indexOf('cofre!') >= 0)) {
      p.push(carregarCofre().catch(function (e) { falhaAoCarregar('cofre', e, estado.carregou.cofre); }));
    }
    return Promise.all(p).then(function (r) {
      CtiPresenca.absorver();
      return r;
    });
  }

  function recarregarTudo() {
    u.el('g-faixa-atualizacao').hidden = true;
    return recarregar(['config', 'demandas', 'documentos', 'cofre']);
  }

  // ---------------------------------------------------- leitura do estado

  function colunasVisiveis() {
    return estado.config.colunas.filter(function (c) { return c.ativo; });
  }
  /**
   * Demandas das colunas visíveis. Tudo que está inativo/oculto só aparece nas
   * Configurações (pedido do usuário): coluna oculta tira as demandas dela das telas.
   */
  function demandasVisiveis() {
    var visiveis = {};
    colunasVisiveis().forEach(function (c) { visiveis[c.codigo] = true; });
    return estado.demandas.filter(function (d) { return visiveis[d.coluna]; });
  }
  function coluna(codigo) { return u.porId(estado.config.colunas, 'codigo', codigo); }
  function categoria(id) { return id ? u.porId(estado.config.categorias, 'idCategoria', id) : null; }
  function setor(id) { return id ? u.porId(estado.config.setores, 'idSetor', id) : null; }
  function responsavel(codUsu) { return u.temUsuario(codUsu) ? u.porId(estado.config.responsaveis, 'codUsu', codUsu) : null; }
  function tipoObjeto(codigo) { return u.porId(estado.config.tiposObjeto, 'codigo', codigo) || { codigo: codigo, nome: codigo, icone: 'ri-file-line' }; }
  function demanda(id) { return u.porId(estado.demandas, 'idTarefa', id); }

  function nomeUsuario(codUsu) {
    var r = u.porId(estado.config.usuarios, 'codUsu', codUsu) || responsavel(codUsu);
    return r ? r.nomeUsu : (u.temUsuario(codUsu) ? 'Usuário ' + codUsu : '');
  }

  /** Avatar do responsável com a cor e a sigla definidas na configuração. */
  function avatarPessoa(codUsu, nome, tamanho) {
    var r = responsavel(codUsu);
    var html = CtiFotos.avatar(codUsu, nome || nomeUsuario(codUsu), tamanho, r && r.cor);
    if (r && r.sigla) {
      html = html.replace('>' + u.esc(u.iniciais(nome || r.nomeUsu)) + '</span>', '>' + u.esc(r.sigla) + '</span>');
    }
    return html;
  }

  function pessoaHtml(codUsu, nome, vazio) {
    if (!u.temUsuario(codUsu)) { return '<span class="g-pessoa">' + CtiFotos.avatar(null, null, 'p') + u.esc(vazio || 'Não atribuído') + '</span>'; }
    return '<span class="g-pessoa">' + avatarPessoa(codUsu, nome, 'p') + u.esc(nome || nomeUsuario(codUsu)) + '</span>';
  }

  function seloCategoria(id) {
    var c = categoria(id);
    if (!c) { return '<span class="g-selo"><i class="ri-price-tag-3-line" aria-hidden="true"></i>Sem categoria</span>'; }
    return '<span class="g-selo" style="--c:' + u.cor(c.cor) + '"><i class="' + u.icone(c.icone) + '" aria-hidden="true"></i>' +
      u.esc(c.nome) + '</span>';
  }

  function seloSetor(id) {
    var s = setor(id);
    if (!s) { return '<span class="g-selo">—</span>'; }
    return '<span class="g-selo" style="--c:' + u.cor(s.cor) + '"><i class="' + u.icone(s.icone, 'ri-building-2-line') +
      '" aria-hidden="true"></i>' + u.esc(s.nome) + '</span>';
  }

  function seloColuna(codigo) {
    var c = coluna(codigo);
    var nome = c ? c.nome : codigo;
    return '<span class="g-selo" style="--c:' + u.cor(c && c.cor) + '"><i class="' + u.icone(c && c.icone, 'ri-checkbox-blank-circle-line') +
      '" aria-hidden="true"></i>' + u.esc(nome) + '</span>';
  }

  function seloPrioridade(p) {
    return '<span class="g-prio g-prio--' + u.esc(p) + '">' + u.esc(PRIORIDADES[p] || p) + '</span>';
  }

  function prazoHtml(d) {
    var s = u.situacaoPrazo(d.dtVenc, d.concluida);
    var icone = s === 'atrasado' ? 'ri-alarm-warning-line' : 'ri-calendar-line';
    return '<span class="g-prazo g-prazo--' + s + '" title="' + u.esc(u.rotuloPrazo(d.dtVenc, d.concluida)) + '">' +
      '<i class="' + icone + '" aria-hidden="true"></i>' + (d.dtVenc ? u.dataCurta(d.dtVenc) : 'Sem prazo') + '</span>';
  }

  /** Opções de select a partir das listas da configuração. */
  /** Categoria serve para demandas ('T') ou documentação ('D') conforme o USO (nulo ou 'A' = ambos). */
  function categoriaServe(c, onde) {
    return !onde || !c.uso || c.uso === 'A' || c.uso === onde;
  }

  function categoriasPara(onde) {
    return estado.config.categorias.filter(function (c) { return categoriaServe(c, onde); });
  }

  /**
   * Valor inicial de um cadastro novo: inativo nunca entra (pedido do usuário).
   * Só a edição de um registro existente mantém o valor antigo (ver opcoes).
   */
  function categoriaParaNovo(id, onde) {
    var c = categoria(id);
    return c && c.ativo !== false && categoriaServe(c, onde) ? c.idCategoria : null;
  }

  /** Tipo de documento ativo: o preferido, se ativo; senão o primeiro ativo. */
  function tipoParaNovo(preferido) {
    var ativos = estado.config.tiposObjeto.filter(function (t) { return t.ativo !== false; });
    var achado = u.porId(ativos, 'codigo', preferido) || ativos[0];
    // Sem nenhum tipo ativo o servidor recusa e explica o motivo.
    return achado ? achado.codigo : preferido;
  }

  /** usoCategoria: 'T' (demandas) ou 'D' (documentação); só vale para tipo 'categorias'. */
  function opcoes(tipo, selecionado, rotuloVazio, usoCategoria) {
    var lista, chave, rotulo;
    if (tipo === 'categorias') { lista = categoriasPara(usoCategoria); chave = 'idCategoria'; rotulo = 'nome'; }
    if (tipo === 'setores') { lista = estado.config.setores; chave = 'idSetor'; rotulo = 'nome'; }
    if (tipo === 'responsaveis') { lista = estado.config.responsaveis; chave = 'codUsu'; rotulo = 'nomeUsu'; }
    if (tipo === 'colunas') { lista = colunasVisiveis(); chave = 'codigo'; rotulo = 'nome'; }
    if (tipo === 'tipos') { lista = estado.config.tiposObjeto; chave = 'codigo'; rotulo = 'nome'; }
    var html = rotuloVazio !== null && rotuloVazio !== undefined ? u.opcao('', rotuloVazio, selecionado) : '';
    var temValor = selecionado !== null && selecionado !== undefined && selecionado !== '';
    if (temValor && !u.porId(lista, chave, selecionado)) {
      // Valor gravado que saiu da lista (responsável fora do grupo, coluna oculta):
      // aparece mesmo assim, senão salvar o formulário apagaria o vínculo.
      var antigo = tipo === 'responsaveis' ? nomeUsuario(selecionado)
        : (tipo === 'colunas' && coluna(selecionado) ? coluna(selecionado).nome + ' (oculta)' : String(selecionado));
      html += u.opcao(selecionado, antigo, selecionado);
    }
    return html + (lista || []).filter(function (x) {
      // Inativo/oculto só aparece se já for o valor gravado: editar não pode apagar o vínculo.
      var visivel = tipo === 'responsaveis' ? !x.oculto : x.ativo !== false;
      return visivel || String(x[chave]) === String(selecionado);
    }).map(function (x) {
      // Ícone e cor da configuração vão para a lista suspensa (CtiSelect); pessoa vira avatar.
      var extra = tipo === 'responsaveis' ? { pessoa: x.codUsu, cor: x.cor } : { icone: x.icone, cor: x.cor };
      return u.opcao(x[chave], x[rotulo], selecionado, extra);
    }).join('');
  }

  // ============================================================= avisos

  /**
   * Retorno das ações num modal central com ícone animado (desenho em SVG, sem
   * dado do usuário). ok e info somem em 2,5 s e não travam a tela; alerta e
   * erro esperam o OK (Enter/Esc também fecham).
   */
  var RETORNO = {
    ok: { titulo: 'Concluído com sucesso!', espera: false },
    info: { titulo: 'Informação', espera: false },
    alerta: { titulo: 'Atenção', espera: true },
    erro: { titulo: 'Não foi possível concluir', espera: true }
  };
  /** Título do sucesso pela ação da mensagem ("Acesso excluído." -> exclusão); a mensagem segue dizendo o quê. */
  var TITULOS_SUCESSO = [
    [/copiad/i, 'Copiado!'],
    [/exclu[ií]d|removid/i, 'Exclusão realizada com sucesso!'],
    [/cadastrad|criad|enviad|anexad|incluíd/i, 'Cadastro realizado com sucesso!'],
    [/atualizad|alterad|salv|renomead|reativad|desativad|trocad|movid|reaberta|conclu[ií]d/i, 'Alteração realizada com sucesso!']
  ];
  function tituloDoRetorno(tipo, mensagem) {
    if (tipo !== 'ok') { return RETORNO[tipo].titulo; }
    for (var i = 0; i < TITULOS_SUCESSO.length; i++) {
      if (TITULOS_SUCESSO[i][0].test(mensagem || '')) { return TITULOS_SUCESSO[i][1]; }
    }
    return RETORNO.ok.titulo;
  }
  var TRACO = ' fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" pathLength="1"';
  var ANEL = '<circle class="g-anima-halo" cx="32" cy="32" r="31" fill="currentColor"/>' +
    '<circle class="g-anima-traco" cx="32" cy="32" r="26" stroke-width="4" transform="rotate(-90 32 32)"' + TRACO + '/>';
  var DESENHO_RETORNO = {
    ok: ANEL + '<path class="g-anima-traco g-anima-traco--2" d="M20 33l8 8 16-17" stroke-width="5"' + TRACO + '/>',
    info: ANEL + '<path class="g-anima-traco g-anima-traco--2" d="M32 29v15" stroke-width="5"' + TRACO + '/>' +
      '<circle class="g-anima-ponto" cx="32" cy="21" r="3" fill="currentColor"/>',
    alerta: '<circle class="g-anima-halo" cx="32" cy="34" r="31" fill="currentColor"/>' +
      '<path class="g-anima-traco" d="M32 8L58 54H6Z" stroke-width="4"' + TRACO + '/>' +
      '<path class="g-anima-traco g-anima-traco--2" d="M32 25v13" stroke-width="5"' + TRACO + '/>' +
      '<circle class="g-anima-ponto" cx="32" cy="46" r="3" fill="currentColor"/>',
    erro: ANEL + '<path class="g-anima-traco g-anima-traco--2" d="M23 23l18 18M41 23L23 41" stroke-width="5"' + TRACO + '/>'
  };
  /** Desenhos da confirmação, no mesmo traço animado do aviso (DESENHO_RETORNO cobre ok, erro e alerta). */
  var DESENHO_CONFIRMA = {
    pergunta: ANEL + '<path class="g-anima-traco g-anima-traco--2" d="M26 25a6 6 0 1 1 8.5 5.5c-1.7.8-2.5 2-2.5 3.6v2.4" stroke-width="5"' + TRACO + '/>' +
      '<circle class="g-anima-ponto" cx="32" cy="44" r="3" fill="currentColor"/>',
    perigo: ANEL + '<path class="g-anima-traco g-anima-traco--2" d="M22 24h20M28 24v-3h8v3M25 24l1.8 19h10.4L39 24M30 29v9M34 29v9" stroke-width="3.5"' + TRACO + '/>',
    andamento: '<circle class="g-anima-halo" cx="32" cy="32" r="31" fill="currentColor"/>' +
      '<circle cx="32" cy="32" r="26" stroke-width="4" fill="none" stroke="currentColor" opacity=".18"/>' +
      '<circle class="g-anima-gira" cx="32" cy="32" r="26" stroke-width="4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-dasharray="42 200"/>'
  };
  var retornoTempo = null;
  var retornoSaida = null;
  var retornoAnterior = null;

  function retornoEsperando() {
    var r = u.el('g-retorno');
    return !r.hidden && (r.dataset.espera === 'S');
  }

  function aviso(mensagem, tipo) {
    var t = RETORNO[tipo] ? tipo : 'ok';
    // Alerta/erro aberto não some por causa de um sucesso que chegou depois: ele pede ação do usuário.
    if (retornoEsperando() && !RETORNO[t].espera) { return; }
    var r = u.el('g-retorno');
    var caixa = u.el('g-retorno-caixa');
    clearTimeout(retornoTempo);
    clearTimeout(retornoSaida);
    u.el('g-retorno-icone').innerHTML = '<svg viewBox="0 0 64 64">' + DESENHO_RETORNO[t] + '</svg>';
    u.el('g-retorno-titulo').textContent = tituloDoRetorno(t, mensagem);
    u.el('g-retorno-texto').textContent = mensagem;
    r.className = 'g-retorno g-retorno--' + t;
    r.dataset.espera = RETORNO[t].espera ? 'S' : 'N';
    caixa.setAttribute('role', RETORNO[t].espera ? 'alertdialog' : 'status');
    // Mensagem nova com o modal já aberto: reinicia a animação de entrada.
    caixa.style.animation = 'none';
    void caixa.offsetWidth;
    caixa.style.animation = '';
    r.hidden = false;
    if (RETORNO[t].espera) {
      retornoAnterior = retornoAnterior || document.activeElement;
      u.el('g-retorno-ok').focus();
    } else {
      retornoTempo = setTimeout(fecharRetorno, 2500);
    }
  }

  function fecharRetorno() {
    var r = u.el('g-retorno');
    clearTimeout(retornoTempo);
    if (r.hidden) { return; }
    var voltar = r.dataset.espera === 'S' ? retornoAnterior : null;
    retornoAnterior = null;
    r.dataset.espera = 'N';
    r.classList.add('g-retorno--saindo');
    retornoSaida = setTimeout(function () {
      r.hidden = true;
      r.classList.remove('g-retorno--saindo');
    }, 180);
    if (voltar && document.body.contains(voltar)) { voltar.focus(); }
  }

  function erro(m) { aviso(m, 'erro'); }
  function alerta(m) { aviso(m, 'alerta'); }
  function sucesso(m) { aviso(m, 'ok'); }

  function mensagemAmigavel(mensagem) {
    if (/erro ao executar (?:o )?servi[cç]o/i.test(mensagem || '')) {
      return 'O servidor não conseguiu concluir esta operação. Confira sua conexão e tente novamente. ' +
        'Se você acabou de salvar algo, confira a lista antes de repetir para evitar duplicidade.';
    }
    return mensagem || 'O servidor não informou a causa. Tente novamente e, se continuar, envie os detalhes ao suporte.';
  }

  /**
   * Modal de erro no desenho da FC_FORMATAHTML: Atenção, Motivo e Solução.
   * @param contexto o que falhou ("O documento não foi excluído"); e: erro do serviço ou texto.
   */
  function abrirErro(contexto, e) {
    var partes = CtiApi.partesDoErro(e);
    u.el('g-erro-contexto').textContent = contexto || 'Não foi possível concluir';
    u.el('g-erro-mensagem').textContent = mensagemAmigavel(partes.mensagem);
    mostrarLinha('motivo', partes.motivo);
    mostrarLinha('solucao', partes.solucao);
    u.el('g-erro-tecnico').textContent = CtiApi.textoTecnico(e);
    u.el('g-erro-tecnico').scrollTop = 0;
    u.el('g-erro-modal').hidden = false;
    u.el('g-erro-fechar').focus();
  }

  function mostrarLinha(nome, texto) {
    u.el('g-erro-' + nome).textContent = texto || '';
    u.el('g-erro-' + nome + '-linha').hidden = !texto;
  }

  function fecharErro() { u.el('g-erro-modal').hidden = true; }

  function falhaAoCarregar(rotulo, e, jaTinhaDados) {
    if (jaTinhaDados) {
      alerta('Não foi possível atualizar ' + rotulo + '. Os dados anteriores foram mantidos.');
      return;
    }
    abrirErro('Falha ao carregar ' + rotulo, e);
  }

  /**
   * Falha ao gravar. Se foi conflito (outro usuário gravou antes), fecha o
   * formulário e recarrega: o que o usuário tinha na tela já não é o atual.
   */
  function falhaAoGravar(e, prefixo) {
    if (CtiApi.ehConflito(e)) {
      alerta(CtiApi.textoDoErro(e));
      fecharModal(true);
      recarregarTudo();
      return;
    }
    abrirErro(contextoDoPrefixo(prefixo), e);
  }

  /** "O documento não foi excluído: " -> "O documento não foi excluído" (legenda do modal). */
  function contextoDoPrefixo(prefixo) {
    var t = String(prefixo || '').replace(/[:\s]+$/, '');
    return t || 'Não foi possível salvar';
  }

  /** Botão fica desabilitado enquanto a promessa roda. */
  function ocupado(botao, promessa) {
    if (botao) { botao.disabled = true; }
    return promessa.then(function (v) {
      if (botao) { botao.disabled = false; }
      return v;
    }, function (e) {
      if (botao) { botao.disabled = false; }
      throw e;
    });
  }

  // ===================================================== espera longa

  var esperaTempo = null;
  var esperaContagem = 0;

  /**
   * Camada "aguarde" sobre a tela enquanto a promessa roda (chamada à
   * HostGator). Só aparece se passar de 300 ms; até a resposta, nada no
   * modal recebe clique nem o Esc. O texto pode mudar (lote: "3 de 10").
   * @return a mesma promessa
   */
  function esperar(texto, promessa, sub) {
    iniciarEspera(texto, sub);
    return promessa.then(function (v) { terminarEspera(); return v; },
      function (e) { terminarEspera(); throw e; });
  }

  function iniciarEspera(texto, sub) {
    esperaContagem++;
    textoDaEspera(texto, sub);
    u.el('g-modal').setAttribute('aria-busy', 'true');
    if (esperaTempo || !u.el('g-carregando').hidden) { return; }
    esperaTempo = setTimeout(function () {
      esperaTempo = null;
      if (esperaContagem > 0) { u.el('g-carregando').hidden = false; }
    }, 300);
  }

  function textoDaEspera(texto, sub) {
    u.el('g-carregando-texto').textContent = texto || 'Aguarde…';
    u.el('g-carregando-sub').textContent = sub || 'Aguardando a resposta da HostGator. Não feche a tela.';
  }

  function terminarEspera() {
    esperaContagem = Math.max(0, esperaContagem - 1);
    if (esperaContagem > 0) { return; }
    clearTimeout(esperaTempo);
    esperaTempo = null;
    u.el('g-carregando').hidden = true;
    u.el('g-modal').removeAttribute('aria-busy');
  }

  function esperando() { return esperaContagem > 0; }

  // ===================================================== resumo de lote

  /**
   * Resultado de operação em lote (cada conta na própria transação): conta o
   * que deu certo e lista as que falharam, com o motivo. Sem erro, só o aviso
   * de sucesso. Fica por cima do modal que estiver aberto.
   * @param o {titulo, feito ('excluída(s)'), resultado: {qtd, erros}, aoVerLog}
   */
  function resumoLote(o) {
    var r = o.resultado || { qtd: 0, erros: [] };
    if (!r.erros.length) {
      sucesso(r.qtd + ' ' + o.feito + '.');
      return;
    }
    u.el('g-lote-titulo').textContent = o.titulo || 'Algumas contas não foram tratadas';
    u.el('g-lote-corpo').innerHTML =
      '<div class="g-lote__contadores">' +
        '<span class="g-lote__contador g-lote__contador--ok"><i class="ri-checkbox-circle-line" aria-hidden="true"></i><b>' +
          r.qtd + '</b> ' + u.esc(o.feito) + '</span>' +
        '<span class="g-lote__contador g-lote__contador--erro"><i class="ri-close-circle-line" aria-hidden="true"></i><b>' +
          r.erros.length + '</b> com erro</span>' +
      '</div>' +
      '<p class="g-dica">As contas com erro ficaram como estavam no painel.</p>' +
      '<ul class="g-lote__lista" role="list">' + r.erros.map(function (e) {
        var p = CtiApi.partesDoErro(e.mensagem);
        var texto = [p.mensagem, p.motivo ? 'Motivo: ' + p.motivo : '', p.solucao ? 'Solução: ' + p.solucao : '']
          .filter(Boolean).join('\n');
        return '<li class="g-lote__erro"><span class="g-lote__email">' + u.esc(e.login || ('Acesso ' + e.idAcesso)) + '</span>' +
          '<button type="button" class="g-icone-btn" data-copiar="' + u.esc(texto) + '" title="Copiar o erro" aria-label="Copiar o erro">' +
          '<i class="ri-file-copy-line" aria-hidden="true"></i></button>' +
          '<p class="g-lote__msg">' + u.esc(texto) + '</p></li>';
      }).join('') + '</ul>';
    var rodape = u.el('g-lote-rodape');
    rodape.innerHTML = (o.aoVerLog ? '<button type="button" class="g-btn g-btn--fantasma" id="g-lote-log"><i class="ri-file-list-3-line" aria-hidden="true"></i> Ver no log da API</button>' : '') +
      '<button type="button" class="g-btn g-btn--primario" id="g-lote-ok">OK</button>';
    u.el('g-lote-ok').addEventListener('click', fecharLote);
    if (o.aoVerLog) {
      u.el('g-lote-log').addEventListener('click', function () { fecharLote(); o.aoVerLog(); });
    }
    u.el('g-lote').hidden = false;
    u.el('g-lote-caixa').focus();
  }

  function fecharLote() { u.el('g-lote').hidden = true; }

  // ============================================================ sessão

  /**
   * Dono da demanda: o responsável; sem responsável, quem criou. Só ele e o
   * SUP mudam a demanda de lugar, trocam o responsável ou excluem (o servidor
   * confere de novo em DemandaService).
   */
  function ehDono(d) {
    var dono = u.temUsuario(d.codUsuResp) ? d.codUsuResp : d.codUsuInc;
    return u.temUsuario(dono) && Number(dono) === Number(estado.sessao.codUsu);
  }

  /**
   * Demanda finalizada (coluna que conclui) fica só leitura para quem não é
   * SUP e só volta para uma coluna aberta pelo Reabrir (DemandaFinalizada.java).
   */
  function finalizadaTravada(d) {
    return !!d && !!d.concluida && !estado.sessao.sup;
  }

  /**
   * Demanda com responsável é dele: só ele e o SUP alteram os dados, o
   * checklist e os documentos/anexos (PosseDemanda.java). Sem responsável,
   * fica aberta a quem tem permissão. Comentário não entra nessa regra.
   */
  function temPosse(d) {
    return !!d && (estado.sessao.sup || !u.temUsuario(d.codUsuResp) ||
      Number(d.codUsuResp) === Number(estado.sessao.codUsu));
  }

  function podeEditarDemanda(d) {
    return !!d && pode('alterar') && !finalizadaTravada(d) && temPosse(d);
  }

  function podeMover(d) {
    return !!d && pode('alterar') && (estado.sessao.sup || ehDono(d)) && !finalizadaTravada(d);
  }

  function podeReabrir(d) {
    return !!d && !!d.concluida && pode('alterar') && (estado.sessao.sup || ehDono(d));
  }

  function podeExcluirDemanda(d) {
    return !!d && pode('excluir') && (estado.sessao.sup || ehDono(d)) && !finalizadaTravada(d);
  }

  function pode(acao) {
    var s = estado.sessao;
    return { incluir: s.podeIncluir, alterar: s.podeAlterar, excluir: s.podeExcluir, configurar: s.podeConfigurar }[acao] === true;
  }

  function aplicarPermissoes() {
    var raiz = u.el('g-app');
    ['incluir', 'alterar', 'excluir', 'configurar'].forEach(function (acao) {
      raiz.classList.toggle('g-sem-' + acao, !pode(acao));
    });
  }

  function carregarSessao() {
    return dados.iniciarSessao().then(function (s) {
      estado.sessao = s;
      // Clique no botão antes da sessão chegar vale mais que o tema gravado.
      if (!temaTrocadoNestaTela) { aplicarTema(s.tema); }
      u.el('g-eu-nome').textContent = s.nomeUsu || ('Usuário ' + s.codUsu);
      u.el('g-eu-avatar').outerHTML = CtiFotos.avatar(s.codUsu, s.nomeUsu, 'm').replace('class="', 'id="g-eu-avatar" class="');
      aplicarPermissoes();
      u.el('g-menu-cofre').hidden = !s.podeCofre;
      u.el('cf-aba-cofre').hidden = !s.podeCofre;
      u.el('cf-aba-hostgator').hidden = !s.podeCofre;
      CtiDesligados.aplicarSessao();
      return s;
    }, function (e) {
      // Sem a sessão a tela não sabe o que esconder: mantém tudo escondido e avisa.
      erro('Não foi possível identificar o usuário: ' + e.message);
      throw e;
    });
  }

  // ================================================================ tema

  // Última escolha neste navegador: evita piscar claro enquanto a sessão não chega.
  // A escolha que vale é a do usuário no servidor (CTI_PREFUSU), aplicada em carregarSessao.
  var TEMA_LOCAL = 'cti.tema';
  var temaTrocadoNestaTela = false;

  function temaAtual() {
    return u.el('g-app').dataset.tema === 'escuro' ? 'E' : 'C';
  }

  function aplicarTema(tema) {
    var escuro = tema === 'E';
    u.el('g-app').dataset.tema = escuro ? 'escuro' : 'claro';
    var botao = u.el('g-tema');
    var rotulo = escuro ? 'Usar tema claro' : 'Usar tema escuro';
    botao.setAttribute('aria-label', rotulo);
    botao.title = rotulo;
    botao.innerHTML = '<i class="' + (escuro ? 'ri-sun-line' : 'ri-moon-line') + '" aria-hidden="true"></i>';
    try { window.localStorage.setItem(TEMA_LOCAL, escuro ? 'E' : 'C'); } catch (e) { /* armazenamento bloqueado: só perde o atalho */ }
  }

  function iniciarTema() {
    var guardado = null;
    try { guardado = window.localStorage.getItem(TEMA_LOCAL); } catch (e) { /* armazenamento bloqueado */ }
    aplicarTema(guardado === 'E' ? 'E' : 'C');
    u.el('g-tema').addEventListener('click', function () {
      temaTrocadoNestaTela = true;
      var anterior = temaAtual();
      var novo = anterior === 'E' ? 'C' : 'E';
      aplicarTema(novo);
      ocupado(u.el('g-tema'), dados.salvarPreferencias({ tema: novo }))
        .catch(function (e) {
          aplicarTema(anterior);
          erro('O tema não foi salvo: ' + e.message);
        });
    });
  }

  // ========================================================== navegação

  /**
   * forcar: já confirmou descartar. Saindo das Configurações com alteração
   * não salva (rodapé fixo), pergunta antes de trocar de tela.
   */
  function irPara(visao, forcar) {
    if (!forcar && visaoAtual === 'config' && visao !== 'config' && window.CtiConfig && CtiConfig.temPendencia()) {
      CtiConfig.confirmarSaida().then(function (ok) { if (ok) { irPara(visao, true); } });
      return;
    }
    visaoAtual = visao;
    u.cada(document, '.g-menu__item', function (b) {
      var ativo = b.dataset.visao === visao;
      b.classList.toggle('g-menu__item--ativo', ativo);
      if (ativo) { b.setAttribute('aria-current', 'page'); } else { b.removeAttribute('aria-current'); }
    });
    u.cada(document, '.g-visao', function (s) {
      var ativa = s.id === 'visao-' + visao;
      s.hidden = !ativa;
      s.classList.toggle('g-visao--ativa', ativa);
    });
    fecharMenuMovel();
    u.el('g-conteudo').classList.toggle('g-conteudo--quadro', visao === 'kanban');
    u.el('g-conteudo').classList.toggle('g-conteudo--visao', visao === 'visaogeral');
    u.el('g-conteudo').classList.toggle('g-conteudo--docs', visao === 'documentos');
    u.el('g-conteudo').classList.toggle('g-conteudo--cofre', visao === 'cofre');
    u.el('g-conteudo').scrollTop = 0;
    CtiPresenca.definirContexto({ aba: ABA_PRESENCA[visao], entidade: null });
    if (visao === 'documentos' && !estado.carregou.documentos) { recarregar(['documentos']); }
    if (visao === 'cofre' && !estado.carregou.cofre) { recarregar(['cofre']); }
    avisarMudanca('visao');
  }

  function iniciarMenu() {
    u.cada(document, '.g-menu__item', function (b) {
      b.addEventListener('click', function () { irPara(b.dataset.visao); });
    });
    u.el('g-alternar-menu').addEventListener('click', function () {
      u.el('g-app').classList.add('g-menu-aberto');
      u.el('g-veu').hidden = false;
    });
    u.el('g-recolher-menu').addEventListener('click', function () {
      var app = u.el('g-app');
      if (window.matchMedia('(max-width: 1024px)').matches) {
        fecharMenuMovel();
        return;
      }
      var recolhido = app.classList.toggle('g-menu-recolhido');
      var botao = u.el('g-recolher-menu');
      botao.setAttribute('aria-expanded', recolhido ? 'false' : 'true');
      botao.setAttribute('aria-label', recolhido ? 'Expandir menu' : 'Recolher menu');
      botao.title = recolhido ? 'Expandir menu' : 'Recolher menu';
      // Seta do ícone aponta para onde o menu vai: para dentro ao recolher, para fora ao expandir.
      botao.querySelector('i').className = recolhido ? 'ri-menu-unfold-line' : 'ri-menu-fold-line';
      try { window.localStorage.setItem('cti.menuRecolhido', recolhido ? 'S' : 'N'); } catch (e) { /* sem armazenamento local */ }
    });
    try {
      if (window.localStorage.getItem('cti.menuRecolhido') === 'S') { u.el('g-recolher-menu').click(); }
    } catch (e) { /* sem armazenamento local: começa expandido */ }
    u.el('g-veu').addEventListener('click', fecharMenuMovel);
  }

  function fecharMenuMovel() {
    u.el('g-app').classList.remove('g-menu-aberto');
    u.el('g-veu').hidden = true;
  }

  function visao() { return visaoAtual; }

  // ============================================================== modal

  /**
   * @param opcoes {titulo, corpo, rodape, registro: {entidade, id, editando},
   *               tamanho: 'estreito'|'largo', aoFechar}
   */
  function abrirModal(opcoes) {
    var modal = u.el('g-modal');
    if (modal.hidden) { focoAntesDoModal = document.activeElement; }
    modal.className = 'g-modal' + (opcoes.tamanho ? ' g-modal--' + opcoes.tamanho : '');
    u.el('g-modal-titulo').textContent = opcoes.titulo;
    u.el('g-modal-corpo').innerHTML = opcoes.corpo;
    u.el('g-modal-rodape').innerHTML = opcoes.rodape || '';
    aoFecharModalAtual = opcoes.aoFechar || null;
    modal.hidden = false;
    document.addEventListener('keydown', teclaNoModal, true);
    var r = opcoes.registro;
    CtiPresenca.definirContexto(r && r.id
      ? { entidade: r.entidade, idRegistro: r.id, editando: !!r.editando }
      : { entidade: null });
    atualizarAvisoDoModal();
    CtiFotos.preencher(modal);
    var foco = modal.querySelector('[autofocus]') ||
      (opcoes.focarFechar ? null
        : modal.querySelector('.g-modal__corpo input:not([type="checkbox"]), .g-modal__corpo select, .g-modal__corpo textarea')) ||
      u.el('g-modal-fechar');
    foco.focus();
    return u.el('g-modal-corpo');
  }

  function formularioAberto() {
    return !u.el('g-modal').hidden && !!u.el('g-modal-corpo').querySelector('form.g-form');
  }

  /** forcar = fechar mesmo com formulário alterado (conflito, salvou). */
  function fecharModal(forcar) {
    var modal = u.el('g-modal');
    if (modal.hidden || esperando()) { return; }
    var form = u.el('g-modal-corpo').querySelector('form[data-sujo="S"]');
    if (!forcar && form) {
      confirmar({ titulo: 'Descartar alterações?', mensagem: 'O que você digitou neste formulário ainda não foi salvo.',
        botao: 'Descartar', perigo: true })
        .then(function (ok) { if (ok) { fecharModal(true); } });
      return;
    }
    modal.hidden = true;
    u.el('g-modal-corpo').innerHTML = '';
    document.removeEventListener('keydown', teclaNoModal, true);
    CtiPresenca.definirContexto({ entidade: null });
    atualizarAvisoDoModal();
    if (focoAntesDoModal && document.body.contains(focoAntesDoModal)) { focoAntesDoModal.focus(); }
    focoAntesDoModal = null;
    var fn = aoFecharModalAtual;
    aoFecharModalAtual = null;
    if (fn) { fn(); }
    // Dados de colegas chegaram com o formulário aberto: atualiza agora.
    if (!u.el('g-faixa-atualizacao').hidden) { recarregarTudo(); }
  }

  /** Marca o formulário como alterado para pedir confirmação ao fechar. */
  function vigiarFormulario(form) {
    var marcar = function () { form.dataset.sujo = 'S'; };
    form.addEventListener('input', marcar);
    form.addEventListener('change', marcar);
    form.addEventListener('submit', function (e) { e.preventDefault(); });
  }

  function teclaNoModal(evento) {
    // A confirmação aberta por cima e a lista suspensa aberta cuidam do próprio teclado.
    if (!u.el('g-confirma').hidden || !u.el('g-erro-modal').hidden || !u.el('g-lote').hidden || esperando() ||
        retornoEsperando() || CtiSelect.estaAberto()) { return; }
    if (evento.key === 'Escape') {
      evento.preventDefault();
      fecharModal(false);
      return;
    }
    if (evento.key !== 'Tab') { return; }
    var focaveis = Array.prototype.filter.call(
      u.el('g-modal').querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'),
      function (x) { return !x.disabled && x.offsetParent !== null; });
    if (!focaveis.length) { return; }
    var primeiro = focaveis[0];
    var ultimo = focaveis[focaveis.length - 1];
    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  // ======================================================== confirmação

  var confirmacaoAtual = null;

  /**
   * Pergunta dentro da tela (no lugar do window.confirm do navegador).
   * @param o {titulo, mensagem, botao, perigo, cancelar (rótulo do botão de voltar), icone, iconeBotao,
   *           executar: () => Promise, botaoExecutando, carregando, sucesso: (resultado) => texto | null, contextoErro}
   * Com executar (ações que passam pela HostGator), a confirmação espera a
   * resposta com o botão em andamento, sem camada por trás; depois mostra o
   * aviso de sucesso ou o modal de erro de sempre. Resolve {feito, resultado} /
   * {feito: false, erro}; false = cancelou. sucesso null = sem aviso (quem chamou mostra o resumo).
   * @return Promise<boolean>
   */
  /** Estado da caixa de confirmação: ícone desenhado (mesma família do aviso), cor, título e texto. */
  function estadoConfirma(tipo, titulo, texto) {
    u.el('g-confirma').className = 'g-confirma g-confirma--' + tipo;
    u.el('g-confirma-icone').innerHTML = '<svg viewBox="0 0 64 64">' + (DESENHO_CONFIRMA[tipo] || DESENHO_RETORNO[tipo]) + '</svg>';
    u.el('g-confirma-titulo').textContent = titulo;
    u.el('g-confirma-texto').textContent = texto || '';
    u.el('g-confirma-topicos').hidden = true;
  }

  function mostrarTopicos(topicos) {
    var lista = u.el('g-confirma-topicos');
    // Tópico: texto, ou {texto, detalhe} quando cada um tem uma consequência diferente.
    lista.innerHTML = (topicos || []).map(function (t) {
      var x = typeof t === 'string' ? { texto: t } : t;
      return '<li><i class="ri-checkbox-circle-line" aria-hidden="true"></i><span><b>' + u.esc(x.texto) + '</b>' +
        (x.detalhe ? '<small>' + u.esc(x.detalhe) + '</small>' : '') + '</span></li>';
    }).join('');
    lista.hidden = !lista.innerHTML;
  }

  function confirmar(o) {
    if (confirmacaoAtual) { confirmacaoAtual(false); }
    var caixa = u.el('g-confirma');
    var anterior = document.activeElement;
    var ok = u.el('g-confirma-ok');
    var cancelar = u.el('g-confirma-cancelar');
    estadoConfirma(o.tipo || (o.perigo ? 'perigo' : 'pergunta'), o.titulo || 'Confirmar', o.mensagem);
    mostrarTopicos(o.topicos);
    ok.className = 'g-btn ' + (o.perigo ? 'g-btn--perigo-cheio' : 'g-btn--primario');
    ok.innerHTML = (o.perigo ? '<i class="' + (o.iconeBotao || 'ri-delete-bin-line') + '" aria-hidden="true"></i> ' : '') + u.esc(o.botao || 'Confirmar');
    cancelar.textContent = o.cancelar || 'Cancelar';
    // "Voltar e salvar" não é cancelar algo perigoso: botão neutro, para só o descartar ficar vermelho.
    cancelar.className = 'g-btn ' + (o.cancelar ? 'g-btn--fantasma' : 'g-btn--cancelar');
    cancelar.hidden = false;
    u.el('g-confirma-acoes').hidden = false;
    caixa.removeAttribute('aria-busy');
    caixa.hidden = false;
    cancelar.focus();
    return new Promise(function (resolver) {
      var executando = false;
      var resultadoFinal = null;
      var tempoFechar = null;
      function terminar(valor) {
        clearTimeout(tempoFechar);
        caixa.hidden = true;
        document.removeEventListener('keydown', tecla, true);
        ok.removeEventListener('click', sim);
        cancelar.removeEventListener('click', nao);
        caixa.removeEventListener('click', cliqueNoSucesso);
        confirmacaoAtual = null;
        if (anterior && document.body.contains(anterior)) { anterior.focus(); }
        resolver(valor);
      }
      function sim() {
        if (resultadoFinal) { terminar(resultadoFinal); return; }
        if (!o.executar) { terminar(true); return; }
        executar();
      }
      function nao() { terminar(false); }
      /**
       * Com executar (ações que passam pela HostGator), a mesma caixa mostra o
       * andamento (anel girando) e depois o resultado: sucesso some sozinho como o
       * aviso; erro fica com motivo e solução até o OK. Sem camada por trás.
       */
      function executar() {
        executando = true;
        caixa.setAttribute('aria-busy', 'true');
        estadoConfirma('andamento', o.botaoExecutando || 'Aguarde…', o.carregando || '');
        u.el('g-confirma-acoes').hidden = true;
        // Tempo mínimo: resposta rápida não deve piscar.
        var minimo = new Promise(function (r) { setTimeout(r, 700); });
        Promise.all([Promise.resolve().then(o.executar), minimo]).then(function (r) {
          executando = false;
          caixa.removeAttribute('aria-busy');
          var valor = { feito: true, resultado: r[0] };
          var texto = o.sucesso ? o.sucesso(r[0]) : 'Concluído.';
          if (texto === null) { terminar(valor); return; }
          resultadoFinal = valor;
          estadoConfirma('ok', tituloDoRetorno('ok', o.tituloSucesso || texto), texto);
          caixa.addEventListener('click', cliqueNoSucesso);
          tempoFechar = setTimeout(function () { terminar(valor); }, 2500);
        }, function (e) {
          executando = false;
          caixa.removeAttribute('aria-busy');
          resultadoFinal = { feito: false, erro: e };
          var partes = CtiApi.partesDoErro(e);
          estadoConfirma('erro', o.contextoErro || 'Não foi possível concluir',
            [mensagemAmigavel(partes.mensagem), partes.motivo ? 'Motivo: ' + partes.motivo : '', partes.solucao ? 'Solução: ' + partes.solucao : '']
              .filter(Boolean).join('\n'));
          ok.className = 'g-btn g-btn--primario';
          ok.textContent = 'OK';
          cancelar.hidden = true;
          u.el('g-confirma-acoes').hidden = false;
          ok.focus();
        });
      }
      /** Sucesso fecha com um clique na caixa, como o aviso. */
      function cliqueNoSucesso() { if (resultadoFinal && resultadoFinal.feito) { terminar(resultadoFinal); } }
      function tecla(e) {
        if (executando) { e.preventDefault(); e.stopPropagation(); return; }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); terminar(resultadoFinal || false); }
        if (e.key === 'Enter' && resultadoFinal) { e.preventDefault(); terminar(resultadoFinal); }
        if (e.key === 'Tab') {
          e.preventDefault();
          (document.activeElement === ok && !cancelar.hidden ? cancelar : ok).focus();
        }
      }
      confirmacaoAtual = terminar;
      ok.addEventListener('click', sim);
      cancelar.addEventListener('click', nao);
      document.addEventListener('keydown', tecla, true);
    });
  }

  /** Muda o registro informado aos colegas sem reabrir o modal (ex.: ver -> editar). */
  function registroDoModal(r) {
    CtiPresenca.definirContexto({ entidade: r.entidade, idRegistro: r.id, editando: !!r.editando });
    atualizarAvisoDoModal();
  }

  // ========================================================== presença

  function atualizarAvisoDoModal() {
    var alvo = u.el('g-modal-presenca');
    var ctx = CtiPresenca.contexto();
    if (!ctx.entidade || u.el('g-modal').hidden) { alvo.hidden = true; return; }
    var outros = CtiPresenca.outrosNoRegistro(ctx.entidade, ctx.idRegistro);
    if (!outros.length) { alvo.hidden = true; return; }
    var editando = outros.filter(function (s) { return s.editando; });
    var nomes = function (l) {
      return l.map(function (s) { return s.nomeUsu || ('Usuário ' + s.codUsu); })
        .filter(function (n, i, arr) { return arr.indexOf(n) === i; }).join(', ');
    };
    alvo.hidden = false;
    alvo.className = 'g-modal__presenca' + (editando.length ? ' g-modal__presenca--alerta' : '');
    alvo.textContent = editando.length
      ? nomes(editando) + ' também está editando este registro. Quem salvar por último precisará refazer a alteração.'
      : nomes(outros) + ' também está com este registro aberto.';
  }

  /**
   * Colegas online no topo: anel verde em volta do avatar (âmbar = editando).
   * Até 3 pessoas, só os avatares; acima disso, 3 avatares e "N online".
   */
  function pintarOnline() {
    var outros = CtiPresenca.usuarios().filter(function (x) { return !x.eu; });
    var mostrar = outros.slice(0, 3);
    u.el('g-online-pilha').innerHTML = mostrar.map(function (x) {
      var desc = (x.nomeUsu || ('Usuário ' + x.codUsu)) + ': ' + CtiPresenca.descrever(x);
      return '<span class="g-online__ponto' + (x.editando ? ' g-online__ponto--editando' : '') + '" title="' + u.esc(desc) + '">' +
        CtiFotos.avatar(x.codUsu, x.nomeUsu, '') + '</span>';
    }).join('');
    var texto = u.el('g-online-texto');
    texto.textContent = outros.length > 3 ? outros.length + ' online' : '';
    texto.hidden = outros.length <= 3;
    texto.title = outros.map(function (x) { return x.nomeUsu || ('Usuário ' + x.codUsu); }).join(', ');
    CtiFotos.preencher(u.el('g-online-pilha'));
    atualizarAvisoDoModal();
  }

  /**
   * Outro usuário gravou algo. Sem formulário aberto, atualiza sozinho; com
   * formulário, só avisa: recarregar apagaria o que o usuário digitou.
   */
  function dadosMudaramEmOutraSessao() {
    if (formularioAberto()) {
      u.el('g-faixa-atualizacao').hidden = false;
      return;
    }
    recarregarTudo().then(function () {
      CtiDemanda.atualizarSeAberta();
      CtiDocumentos.atualizarSeAberto();
    });
  }

  // ======================================================== busca global

  var buscaItens = [];
  var buscaSelecionado = -1;

  function iniciarBusca() {
    var campo = u.el('g-busca');
    var caixa = u.el('g-busca-resultado');
    campo.addEventListener('input', function () { buscar(campo.value); });
    campo.addEventListener('focus', function () { if (campo.value) { buscar(campo.value); } });
    campo.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        mover(e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Enter' && buscaItens[buscaSelecionado]) {
        e.preventDefault();
        abrirResultado(buscaItens[buscaSelecionado]);
      } else if (e.key === 'Escape') {
        caixa.hidden = true;
        campo.blur();
      }
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.g-busca-area')) { caixa.hidden = true; }
    });
    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      if (e.key === '/' && tag !== 'input' && tag !== 'textarea' && tag !== 'select' && u.el('g-modal').hidden) {
        e.preventDefault();
        campo.focus();
      }
    });
    caixa.addEventListener('click', function (e) {
      var b = e.target.closest('[data-busca]');
      if (b) { abrirResultado(buscaItens[Number(b.dataset.busca)]); }
    });

    function mover(passo) {
      if (!buscaItens.length) { return; }
      buscaSelecionado = (buscaSelecionado + passo + buscaItens.length) % buscaItens.length;
      u.cada(caixa, '[data-busca]', function (b) {
        var marcado = Number(b.dataset.busca) === buscaSelecionado;
        b.setAttribute('aria-selected', marcado ? 'true' : 'false');
        if (marcado) { b.scrollIntoView({ block: 'nearest' }); }
      });
    }
  }

  var ONDE_ACHOU = {
    titulo: 'no título', descricao: 'na descrição', tags: 'nas tags', comentario: 'num comentário',
    checklist: 'no checklist', conteudo: 'no texto', anexo: 'no nome do anexo', repositorio: 'no repositório'
  };
  var buscaEspera = null;
  var buscaSeq = 0;

  /**
   * Busca por conteúdo no servidor (texto dos documentos, descrição, comentários
   * e checklist das demandas). Espera a digitação parar e ignora respostas de
   * termos antigos, que podem chegar fora de ordem.
   */
  function buscar(texto) {
    var caixa = u.el('g-busca-resultado');
    var termo = texto.trim();
    clearTimeout(buscaEspera);
    var seq = ++buscaSeq;
    if (u.normal(termo).length < 2) { caixa.hidden = true; buscaItens = []; return; }
    if (caixa.hidden || !caixa.childElementCount) {
      caixa.innerHTML = '<div class="g-vazio">Buscando…</div>';
      caixa.hidden = false;
    }
    buscaEspera = setTimeout(function () {
      dados.buscarTexto(termo).then(function (achados) {
        if (seq === buscaSeq) { pintarBusca(termo, achados); }
      }, function (e) {
        if (seq !== buscaSeq) { return; }
        buscaItens = [];
        caixa.innerHTML = '<div class="g-vazio">Busca indisponível: ' + u.esc(e.message) + '</div>';
        caixa.hidden = false;
      });
    }, 220);
  }

  function pintarBusca(termo, achados) {
    var caixa = u.el('g-busca-resultado');
    // Demanda de coluna inativa não aparece fora das Configurações (decisão 33).
    var visiveis = {};
    demandasVisiveis().forEach(function (d) { visiveis[d.idTarefa] = true; });
    var demandas = achados.filter(function (a) { return a.tipo === 'T' && visiveis[a.id]; });
    var docs = achados.filter(function (a) { return a.tipo === 'D'; });
    buscaItens = [];
    buscaSelecionado = -1;
    var item = function (a, icone, direita) {
      buscaItens.push({ tipo: a.tipo, id: a.id });
      return '<button type="button" class="g-busca__item" role="option" data-busca="' + (buscaItens.length - 1) + '">' +
        '<i class="' + icone + ' g-busca__icone" aria-hidden="true"></i>' +
        '<span class="g-busca__texto"><span class="g-busca__titulo">' + destacar(a.titulo, termo) + '</span>' +
          (a.onde !== 'titulo' && a.trecho ? '<span class="g-busca__trecho"><em>' + u.esc(ONDE_ACHOU[a.onde] || a.onde) + ':</em> ' +
            destacar(a.trecho, termo) + '</span>' : '') +
        '</span><small>' + direita + '</small></button>';
    };
    var grupo = function (nome, qtd) {
      return '<div class="g-busca__grupo">' + nome + '<span>' + qtd + '</span></div>';
    };
    var html = '';
    if (demandas.length) {
      html += grupo('Demandas', demandas.length) + demandas.map(function (a) {
        var col = coluna(a.coluna);
        return item(a, 'ri-task-line', '#' + Number(a.id) + (col ? ' · ' + u.esc(col.nome) : ''));
      }).join('');
    }
    if (docs.length) {
      html += grupo('Documentos', docs.length) + docs.map(function (a) {
        var t = tipoObjeto(a.tipoObj);
        return item(a, u.icone(t.icone, 'ri-file-line'), u.esc(t.nome));
      }).join('');
    }
    caixa.innerHTML = html || '<div class="g-vazio">Nada encontrado para “' + u.esc(termo) + '”.</div>';
    caixa.hidden = false;
    caixa.scrollTop = 0;
  }

  /** Escapa o texto e marca o termo, sem diferenciar acento nem maiúscula. */
  function destacar(texto, termo) {
    texto = String(texto || '');
    var alvo = u.normal(termo);
    // Índice de cada caractere normalizado no texto original (acentos somem na normalização).
    var normal = '';
    var origem = [];
    for (var i = 0; i < texto.length; i++) {
      var n = u.normal(texto.charAt(i));
      for (var k = 0; k < n.length; k++) { normal += n.charAt(k); origem.push(i); }
    }
    var html = '';
    var desde = 0;
    var pos = alvo ? normal.indexOf(alvo) : -1;
    while (pos >= 0) {
      var ini = origem[pos];
      var fim = origem[pos + alvo.length - 1] + 1;
      html += u.esc(texto.slice(desde, ini)) + '<mark>' + u.esc(texto.slice(ini, fim)) + '</mark>';
      desde = fim;
      pos = normal.indexOf(alvo, pos + alvo.length);
    }
    return html + u.esc(texto.slice(desde));
  }

  function abrirResultado(item) {
    u.el('g-busca-resultado').hidden = true;
    u.el('g-busca').value = '';
    if (item.tipo === 'T') {
      CtiDemanda.abrir(item.id);
    } else {
      irPara('documentos');
      CtiDocumentos.abrirDocumento(item.id);
    }
  }

  // ============================================== barra "tela personalizada"

  /**
   * O Om mostra, embaixo, a faixa "Você está em uma tela personalizada". Ela
   * fica por cima do painel (que ocupa a tela inteira) e cortava o menu e o
   * quadro. Mede o que estiver sobre a borda de baixo, nesta página ou na
   * página do Om que hospeda o iframe, e recua o painel na mesma altura.
   */
  function ajustarRodapeDoOm() {
    var app = u.el('g-app');
    var folga = Math.max(folgaNestaPagina(app), folgaNaPaginaDoOm());
    var recuo = folga > 0 && folga < 120 ? folga + 'px' : '';
    app.style.bottom = recuo;
    // Modal e avisos são fixed em relação à janela: usam o mesmo recuo pela variável.
    app.style.setProperty('--recuo-base', recuo || '0px');
  }

  function folgaNestaPagina(app) {
    if (!document.elementsFromPoint) { return 0; }
    var altura = window.innerHeight;
    var achado = document.elementsFromPoint(window.innerWidth / 2, altura - 2).filter(function (el) {
      return el !== document.documentElement && el !== document.body && !app.contains(el) && !el.contains(app);
    })[0];
    return achado ? Math.ceil(altura - achado.getBoundingClientRect().top) : 0;
  }

  function folgaNaPaginaDoOm() {
    try {
      var quadro = window.frameElement;
      if (!quadro || !window.parent || !window.parent.document.elementsFromPoint) { return 0; }
      var r = quadro.getBoundingClientRect();
      var achado = window.parent.document.elementsFromPoint(r.left + r.width / 2, r.bottom - 2).filter(function (el) {
        return el !== quadro && !el.contains(quadro) && el.tagName !== 'HTML' && el.tagName !== 'BODY';
      })[0];
      if (!achado || achado.contains(quadro)) { return 0; }
      return Math.ceil(r.bottom - achado.getBoundingClientRect().top);
    } catch (e) {
      // Página do Om em outra origem: não dá para medir, segue sem recuo.
      return 0;
    }
  }

  function vigiarRodapeDoOm() {
    ajustarRodapeDoOm();
    window.addEventListener('resize', ajustarRodapeDoOm);
    // A faixa do Om aparece alguns segundos depois da tela e pode ser fechada:
    // confere a cada segundo no começo e depois a cada 5 s (medição barata).
    var tentativas = 0;
    var relogio = setInterval(function () {
      ajustarRodapeDoOm();
      if (++tentativas >= 15) {
        clearInterval(relogio);
        setInterval(ajustarRodapeDoOm, 5000);
      }
    }, 1000);
  }

  // ============================================================== início

  function iniciar() {
    iniciarTema();
    CtiSelect.iniciar(u.el('g-app'));
    iniciarMenu();
    iniciarBusca();
    vigiarRodapeDoOm();
    u.el('g-modal-fechar').addEventListener('click', function () { fecharModal(false); });
    u.el('g-erro-fechar').addEventListener('click', fecharErro);
    u.el('g-retorno-ok').addEventListener('click', fecharRetorno);
    // Sucesso/informação: clique na caixa ou no véu fecha antes dos 2,5 s; alerta/erro só pelo OK, Enter ou Esc.
    u.el('g-retorno').addEventListener('click', function (e) {
      if (!retornoEsperando() && !e.target.closest('button')) { fecharRetorno(); }
    });
    document.addEventListener('keydown', function (e) {
      if (!retornoEsperando()) { return; }
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); fecharRetorno(); }
      if (e.key === 'Tab') { e.preventDefault(); u.el('g-retorno-ok').focus(); }
    }, true);
    var logo = u.el('g-erro-logo');
    var imgLogo = logo.querySelector('img');
    // Om sem a imagem (versão diferente): o modal segue sem o logo.
    imgLogo.addEventListener('error', function () { logo.hidden = true; });
    if (imgLogo.complete && !imgLogo.naturalWidth) { logo.hidden = true; }
    u.el('g-erro-fechar-x').addEventListener('click', fecharErro);
    u.el('g-lote-fechar-x').addEventListener('click', fecharLote);
    u.el('g-lote-corpo').addEventListener('click', function (e) {
      var b = e.target.closest('[data-copiar]');
      if (!b) { return; }
      CtiUtil.copiar(b.dataset.copiar).then(function () { sucesso('Erro copiado.'); },
        function () { alerta('Não foi possível copiar. Selecione o texto do erro.'); });
    });
    // Enquanto a HostGator responde nada fecha; o resumo do lote fecha com Esc antes do modal de baixo.
    document.addEventListener('keydown', function (e) {
      if (esperando()) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (e.key === 'Escape' && !u.el('g-lote').hidden) {
        e.preventDefault();
        e.stopImmediatePropagation();
        fecharLote();
      }
    }, true);
    // Nenhum modal fecha com clique fora (pedido do usuário: perdia o que estava aberto sem querer);
    // só pelo X/botões ou pelo Esc. O erro fica por cima do modal: o Esc fecha só ele.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !u.el('g-erro-modal').hidden) {
        e.preventDefault();
        e.stopImmediatePropagation();
        fecharErro();
      }
    }, true);
    u.el('g-atualizar-agora').addEventListener('click', function () {
      fecharModal(true);
      recarregarTudo();
    });
    u.cada(document, '[data-nova-demanda]', function (b) {
      b.addEventListener('click', function () { CtiDemanda.formulario(null); });
    });
    if (usandoMock) { aviso('Demonstração com dados fictícios.', 'info'); }

    CtiPresenca.aoMudarPresenca(function () {
      pintarOnline();
      CtiKanban.marcarPresenca();
      CtiCofre.marcarPresenca();
    });
    CtiPresenca.aoMudarDados(dadosMudaramEmOutraSessao);

    CtiDesligados.iniciar();
    CtiVisaoGeral.iniciar();
    CtiKanban.iniciar();
    CtiDocumentos.iniciar();
    CtiCofre.iniciar();
    CtiConfig.iniciar();

    carregarSessao().then(function (s) {
      CtiPresenca.iniciar(s.intervaloPresencaSeg);
      return recarregar(['config', 'demandas']);
    }).catch(function () { /* erro já exibido em carregarSessao */ });
  }

  return {
    dados: dados,
    usandoMock: usandoMock,
    estado: estado,
    PRIORIDADES: PRIORIDADES,
    opcoesPrioridade: opcoesPrioridade,
    aoMudar: aoMudar,
    recarregar: recarregar,
    recarregarTudo: recarregarTudo,
    colunasVisiveis: colunasVisiveis,
    coluna: coluna,
    categoria: categoria,
    setor: setor,
    responsavel: responsavel,
    tipoObjeto: tipoObjeto,
    demanda: demanda,
    nomeUsuario: nomeUsuario,
    avatarPessoa: avatarPessoa,
    pessoaHtml: pessoaHtml,
    seloCategoria: seloCategoria,
    seloSetor: seloSetor,
    seloColuna: seloColuna,
    seloPrioridade: seloPrioridade,
    prazoHtml: prazoHtml,
    opcoes: opcoes,
    aviso: aviso,
    erro: erro,
    alerta: alerta,
    sucesso: sucesso,
    falhaAoGravar: falhaAoGravar,
    ocupado: ocupado,
    esperar: esperar,
    textoDaEspera: textoDaEspera,
    resumoLote: resumoLote,
    abrirErro: abrirErro,
    pode: pode,
    podeMover: podeMover,
    demandasVisiveis: demandasVisiveis,
    categoriasPara: categoriasPara,
    categoriaParaNovo: categoriaParaNovo,
    tipoParaNovo: tipoParaNovo,
    podeExcluirDemanda: podeExcluirDemanda,
    podeEditarDemanda: podeEditarDemanda,
    temPosse: temPosse,
    finalizadaTravada: finalizadaTravada,
    podeReabrir: podeReabrir,
    confirmar: confirmar,
    irPara: irPara,
    visao: visao,
    abrirModal: abrirModal,
    fecharModal: fecharModal,
    vigiarFormulario: vigiarFormulario,
    registroDoModal: registroDoModal,
    iniciar: iniciar
  };
})();
