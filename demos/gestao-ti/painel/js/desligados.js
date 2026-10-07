/**
 * Aviso de funcionário desligado com acesso ativo (conta no cofre ou usuário
 * no Sankhya Om), fora da tela do cofre: card na Visão Geral, sino no
 * cabeçalho, um aviso na primeira vez que surge alguém novo e o modal onde
 * tudo é tratado (desativar, excluir, trocar funcionário, conta genérica e a
 * chave do usuário do Om). Só para quem tem acesso ao cofre (o servidor só
 * manda o resumo e a lista para esse grupo).
 *
 * O resumo chega a cada heartbeat (CtiPresenca); a lista só é buscada quando
 * a impressão dele muda. Não há "marcar como lido": a pessoa sai da lista
 * quando não tem mais conta ativa.
 */
var CtiDesligados = (function () {
  'use strict';

  var u = CtiUtil;

  var SITUACOES = {
    DEMITIDO: { rotulo: 'Demitido', icone: 'ri-user-unfollow-line', tom: 'perigo' },
    NAO_ENCONTRADO: { rotulo: 'Fora da folha', icone: 'ri-question-line', tom: 'perigo' },
    TRANSFERIDO: { rotulo: 'Transferido', icone: 'ri-arrow-left-right-line', tom: 'atencao' },
    AGENDADO: { rotulo: 'Agendado', icone: 'ri-calendar-event-line', tom: 'neutro' }
  };
  /** Tela de Usuários do Om (resourceID conferido no registro de acessos TSIACM em 01/10/2026). */
  var TELA_USUARIOS = 'br.com.sankhya.core.cad.usuarios';
  /** Pessoas já avisadas, por usuário: o aviso aparece uma vez por pessoa, não a cada abertura do painel. */
  var CHAVE_VISTOS = 'cti.desligadosVistos.';

  /** ResumoDesligadosDTO do último heartbeat (null até o primeiro). */
  var resumo = null;
  var lista = [];
  var impressao = null;
  var buscando = false;
  var falhasSeguidas = 0;
  var vistosNaSessao = null;
  var ouvintes = [];
  /** Data do último teste da HostGator quando falhou (heartbeat); nulo sem falha. */
  var falhaHg = null;

  function habilitado() {
    var s = CtiApp.estado.sessao;
    return !!(s && s.podeCofre);
  }

  function iniciar() {
    u.el('g-sino').addEventListener('click', function () { alternarPainelSino(); });
    u.el('g-sino-painel').addEventListener('click', function (e) {
      if (e.target.closest('[data-ir-visao]')) {
        alternarPainelSino(false);
        CtiApp.irPara('visaogeral');
      }
      if (e.target.closest('[data-ir-hostgator]')) {
        alternarPainelSino(false);
        CtiApp.irPara('config');
        CtiConfig.abrirAba('hostgator');
      }
    });
    document.addEventListener('mousedown', function (e) {
      if (!u.el('g-sino-painel').hidden && !u.el('g-sino-area').contains(e.target)) { alternarPainelSino(false); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !u.el('g-sino-painel').hidden) {
        alternarPainelSino(false);
        u.el('g-sino').focus();
      }
    });
    ligarEventos();
  }

  /** Sessão carregada: o sino só existe para quem vê o cofre. */
  function aplicarSessao() {
    u.el('g-sino-area').hidden = !habilitado();
  }

  function aoMudar(fn) { ouvintes.push(fn); }

  /** Chamado pelo heartbeat com resposta.desligados. */
  function atualizar(r) {
    if (!r || !habilitado()) { return; }
    var mudou = !resumo || resumo.desligados !== r.desligados || resumo.transferidos !== r.transferidos ||
      resumo.agendados !== r.agendados;
    resumo = r;
    pintarSino();
    // O card da Visão Geral acompanha o sino na hora, sem esperar a releitura da lista.
    if (mudou) { ouvintes.forEach(function (fn) { fn(); }); }
    if (r.impressao !== impressao && !buscando) { buscar(r.impressao); }
  }

  /** Chamado pelo heartbeat com resposta.hostGatorFalha: a queda da HostGator entra no sino. */
  function avisoHostGator(dhFalha) {
    var novo = habilitado() ? (dhFalha || null) : null;
    if (novo === falhaHg) { return; }
    falhaHg = novo;
    pintarSino();
  }

  function buscar(nova) {
    buscando = true;
    CtiApp.dados.listarDesligados().then(function (itens) {
      falhasSeguidas = 0;
      lista = itens || [];
      impressao = nova;
      // Contagem da lista recém-lida: depois de uma ação o card e o sino mudam na hora, sem esperar o heartbeat.
      resumo = {
        desligados: lista.filter(function (d) { return !d.agendado && d.situacao !== 'TRANSFERIDO'; }).length,
        transferidos: lista.filter(function (d) { return !d.agendado && d.situacao === 'TRANSFERIDO'; }).length,
        agendados: lista.filter(function (d) { return d.agendado; }).length,
        impressao: resumo ? resumo.impressao : nova
      };
      pintarSino();
      avisarNovos();
      repintar();
      ouvintes.forEach(function (fn) { fn(); });
    }, function (e) {
      falhasSeguidas++;
      // O heartbeat tenta de novo sozinho; três falhas seguidas significam que o aviso está velho.
      if (falhasSeguidas === 3) {
        CtiApp.erro('Não foi possível atualizar os desligados com acesso ativo: ' + e.message);
      }
    }).then(function () { buscando = false; });
  }

  /** Demitidos e fora da folha; transferido (conferir) e agendado não disparam aviso. */
  function pedeAcao(d) { return d.situacao !== 'TRANSFERIDO' && !d.agendado; }
  function chave(d) { return d.codEmp + '-' + d.codFunc; }

  function lerVistos() {
    if (vistosNaSessao) { return vistosNaSessao; }
    var guardado = null;
    try { guardado = window.localStorage.getItem(CHAVE_VISTOS + CtiApp.estado.sessao.codUsu); } catch (e) { /* armazenamento bloqueado: vale só a sessão */ }
    vistosNaSessao = {};
    (guardado ? guardado.split(',') : []).forEach(function (k) { if (k) { vistosNaSessao[k] = true; } });
    return vistosNaSessao;
  }

  function gravarVistos(atuais) {
    // Guarda só quem ainda está na lista: quem sair e voltar (religado e desligado de novo) avisa outra vez.
    vistosNaSessao = {};
    atuais.forEach(function (d) { vistosNaSessao[chave(d)] = true; });
    try {
      window.localStorage.setItem(CHAVE_VISTOS + CtiApp.estado.sessao.codUsu, Object.keys(vistosNaSessao).join(','));
    } catch (e) { /* armazenamento bloqueado: o aviso volta na próxima abertura do painel */ }
  }

  function avisarNovos() {
    var vistos = lerVistos();
    var atuais = lista.filter(pedeAcao);
    var novos = atuais.filter(function (d) { return !vistos[chave(d)]; });
    gravarVistos(atuais);
    if (!novos.length) { return; }
    CtiApp.aviso(novos.length === 1
      ? nomeDe(novos[0]) + ' saiu da empresa e ainda tem ' + acessosTexto(novos[0]) + '.'
      : u.plural(novos.length, 'funcionário desligado ainda tem', 'funcionários desligados ainda têm') + ' acesso ativo.', 'info');
  }

  function acessosTexto(d) {
    var partes = [];
    if (d.contas.length) { partes.push(u.plural(d.contas.length, 'conta ativa no cofre', 'contas ativas no cofre')); }
    var usuarios = (d.usuarios || []).filter(function (x) { return x.ativo; }).length;
    if (usuarios) { partes.push(u.plural(usuarios, 'usuário ativo no Om', 'usuários ativos no Om')); }
    return partes.join(' e ');
  }

  // ================================================================ sino e card

  function pintarSino() {
    var sino = u.el('g-sino');
    var qtd = u.el('g-sino-qtd');
    var desligados = resumo ? resumo.desligados : 0;
    var transferidos = resumo ? resumo.transferidos : 0;
    // Vermelho para quem saiu; sem desligados, os transferidos aparecem em amarelo (conferir).
    // A falha da HostGator conta como um aviso a mais e deixa o número em vermelho.
    var valor = (desligados || transferidos) + (falhaHg ? 1 : 0);
    qtd.textContent = valor ? (valor > 99 ? '99+' : String(valor)) : '';
    qtd.classList.toggle('g-sino__qtd--atencao', !desligados && !falhaHg && !!transferidos);
    sino.classList.toggle('g-sino--ativo', !!valor);
    var texto = !resumo ? 'Desligados com acesso ativo' :
      (desligados || transferidos
        ? [desligados ? u.plural(desligados, 'desligado', 'desligados') : '',
          transferidos ? u.plural(transferidos, 'transferido', 'transferidos') : ''].filter(Boolean).join(' e ') + ' com acesso ativo'
        : 'Nenhum desligado com acesso ativo');
    if (falhaHg) { texto = 'HostGator sem resposta. ' + texto; }
    sino.title = texto;
    sino.setAttribute('aria-label', texto);
    if (!u.el('g-sino-painel').hidden) { u.el('g-sino-painel').innerHTML = painelSinoHtml(); }
  }

  /**
   * Sino: resumo só informativo, em qualquer tela (o tratamento é pelo card
   * da Visão Geral). Mostra a contagem e as primeiras pessoas da lista.
   */
  var NO_SINO = 5;
  function alternarPainelSino(abrirPainel) {
    var painelSino = u.el('g-sino-painel');
    var abre = abrirPainel === undefined ? painelSino.hidden : abrirPainel;
    if (abre) { painelSino.innerHTML = painelSinoHtml(); }
    painelSino.hidden = !abre;
    u.el('g-sino').setAttribute('aria-expanded', abre ? 'true' : 'false');
  }

  function painelSinoHtml() {
    var alertaHg = falhaHg
      ? '<div class="g-sino__alerta"><i class="ri-error-warning-line" aria-hidden="true"></i>' +
          '<span><strong>HostGator sem resposta</strong><small>O teste de ' + u.esc(u.dataHoraBr(falhaHg)) + ' falhou.</small></span>' +
          '<button type="button" class="g-btn g-btn--link" data-ir-hostgator>Ver</button></div>'
      : '';
    return alertaHg + listaSinoHtml();
  }

  function listaSinoHtml() {
    var cab = '<div class="g-sino__cab"><strong>Desligados com acesso ativo</strong>' +
      (resumo ? '<span>' + [
        resumo.desligados ? u.plural(resumo.desligados, 'desligado', 'desligados') : '',
        resumo.transferidos ? u.plural(resumo.transferidos, 'transferido', 'transferidos') : '',
        resumo.agendados ? u.plural(resumo.agendados, 'agendado', 'agendados') : ''
      ].filter(Boolean).join(' · ') + '</span>' : '') + '</div>';
    if (!lista.length) {
      return cab + '<p class="g-sino__vazio"><i class="ri-shield-check-line" aria-hidden="true"></i>' +
        (impressao === null ? 'Carregando…' : 'Ninguém que saiu da empresa tem acesso ativo.') + '</p>';
    }
    var resto = lista.length - NO_SINO;
    return cab + '<ul class="g-sino__lista">' + lista.slice(0, NO_SINO).map(function (d) {
      var usuarios = (d.usuarios || []).filter(function (x) { return x.ativo; }).length;
      return '<li><span class="g-sino__nome">' + u.esc(nomeDe(d)) +
        '<small>' + [d.contas.length ? u.plural(d.contas.length, 'conta', 'contas') : '',
          usuarios ? u.plural(usuarios, 'usuário no Om', 'usuários no Om') : ''].filter(Boolean).join(' · ') + '</small></span>' +
        '<span class="g-sino__quando">' + seloHtml(d) + '<small>' + quandoCurto(d) + '</small></span></li>';
    }).join('') + '</ul>' +
      (resto > 0 ? '<p class="g-sino__mais">e mais ' + u.plural(resto, 'pessoa', 'pessoas') + '</p>' : '') +
      '<div class="g-sino__rodape"><button type="button" class="g-btn g-btn--link" data-ir-visao>Tratar na Visão Geral ' +
        '<i class="ri-arrow-right-line" aria-hidden="true"></i></button></div>';
  }

  /**
   * Card da Visão Geral (montado por CtiVisaoGeral); vazio para quem não vê o
   * cofre. Mesma contagem do sino: demitidos em vermelho; sem eles, os
   * transferidos a conferir em amarelo; sem pendência, neutro. Agendado não
   * conta (ainda não pede ação), só aparece na nota.
   */
  function cardHtml() {
    if (!habilitado()) { return ''; }
    var desligados = resumo ? resumo.desligados : 0;
    var transferidos = resumo ? resumo.transferidos : 0;
    var agendados = resumo ? resumo.agendados : 0;
    var valor = !resumo ? null : (desligados || transferidos);
    var estado = desligados ? ' g-kpi--alerta' : (transferidos ? ' g-kpi--conferir' : ' g-kpi--sem-pendencia');
    var extras = [desligados && transferidos ? u.plural(transferidos, 'transferido para conferir', 'transferidos para conferir') : '',
      agendados ? u.plural(agendados, 'desligamento agendado', 'desligamentos agendados') : ''].filter(Boolean).join(' · ');
    var nota = !resumo ? 'carregando…'
      : desligados ? (extras || 'cofre ou usuário do Om')
        : transferidos ? u.plural(transferidos, 'transferido para conferir', 'transferidos para conferir') +
          (agendados ? ' · ' + u.plural(agendados, 'agendado', 'agendados') : '')
          : (extras || 'nenhuma pendência');
    return '<button type="button" class="g-kpi g-kpi--desligados' + (resumo ? estado : '') + '" data-kpi-desligados' +
      ' aria-haspopup="dialog">' +
      '<span class="g-kpi__topo">Desligados com acesso<span class="g-kpi__icone"><i class="ri-user-unfollow-line" aria-hidden="true"></i></span></span>' +
      '<span class="g-kpi__valor">' + (valor === null ? '–' : Number(valor)) + '</span>' +
      '<span class="g-kpi__nota">' + u.esc(nota) + '</span></button>';
  }

  // ===================================================================== modal

  /**
   * Dois passos no mesmo modal do painel: a lista (um card por pessoa) e o
   * detalhe da pessoa clicada, com as ações. vista = null (lista) ou a chave
   * da pessoa; painel = conta com "Trocar" ou "Genérica" aberto. Com o painel
   * aberto, a atualização em tempo real espera para não apagar o que se digita.
   */
  var vista = null;
  var painel = null;
  var repintarAoFechar = false;
  var esperaBusca = null;
  var resultados = [];

  /** O modal do painel é um só: os eventos valem só enquanto ele mostra este conteúdo. */
  function meuModal() {
    return !u.el('g-modal').hidden && !!u.el('g-modal-corpo').querySelector('.g-deslig-raiz');
  }

  /** Ouvintes registrados uma vez (o corpo do modal é o mesmo elemento a cada abertura). */
  function ligarEventos() {
    var corpo = u.el('g-modal-corpo');
    corpo.addEventListener('click', function (e) { if (meuModal()) { aoClicar(e); } });
    corpo.addEventListener('change', function (e) { if (meuModal()) { aoMudarChave(e); } });
    corpo.addEventListener('input', function (e) { if (meuModal()) { aoDigitar(e); } });
    corpo.addEventListener('keydown', function (e) {
      if (meuModal() && e.key === 'Enter' && e.target.id === 'dl-nome-conta') {
        e.preventDefault();
        tornarGenerica(e.target.closest('[data-conta]'), e.target);
      }
    });
    u.el('g-modal-rodape').addEventListener('click', function (e) {
      if (!meuModal()) { return; }
      var b = e.target.closest('button');
      if (!b || b.disabled) { return; }
      if (b.dataset.voltar !== undefined) { mostrar(null); }
      if (b.dataset.desativarTudo !== undefined) { desativarTudo(pessoaPorChave(vista), b); }
    });
  }

  function abrir() {
    if (!habilitado()) { return; }
    mostrar(null);
    // Abrir o aviso é o momento de conferir: relê mesmo sem mudança de impressão.
    if (!buscando) { buscar(resumo ? resumo.impressao : null); }
  }

  /** Troca de passo (lista ou pessoa): monta o modal e põe o foco no começo. */
  function mostrar(chavePessoa) {
    vista = chavePessoa;
    painel = null;
    repintarAoFechar = false;
    var d = vista ? pessoaPorChave(vista) : null;
    if (!d) { vista = null; }
    CtiApp.abrirModal(d
      ? { titulo: nomeDe(d), tamanho: 'largo', focarFechar: true, corpo: detalheHtml(d), rodape: rodapeDetalhe(d) }
      : { titulo: 'Desligados com acesso ativo', tamanho: 'largo', focarFechar: true, corpo: listaHtml() });
  }

  /** Lista nova do servidor: atualiza o passo aberto sem mexer no foco. */
  function repintar() {
    if (!meuModal()) { return; }
    if (painel) { repintarAoFechar = true; return; }
    var d = vista ? pessoaPorChave(vista) : null;
    if (vista && !d) {
      // Tudo da pessoa foi tratado: volta para a lista.
      vista = null;
    }
    u.el('g-modal-titulo').textContent = d ? nomeDe(d) : 'Desligados com acesso ativo';
    u.el('g-modal-corpo').innerHTML = d ? detalheHtml(d) : listaHtml();
    u.el('g-modal-rodape').innerHTML = d ? rodapeDetalhe(d) : '';
  }

  function fecharPainel() {
    painel = null;
    repintarAoFechar = false;
    repintar();
  }

  function chavePessoa(d) { return Number(d.codEmp) + '-' + Number(d.codFunc); }
  function pessoaPorChave(k) { return lista.filter(function (d) { return chavePessoa(d) === k; })[0] || null; }
  function contaDe(d, id) { return d ? d.contas.filter(function (c) { return c.idAcesso === id; })[0] : null; }
  function usuariosAtivos(d) { return (d.usuarios || []).filter(function (x) { return x.ativo; }); }

  function nomeDe(d) {
    return d.nomeFunc || ('Funcionário ' + Number(d.codFunc) + ' da empresa ' + Number(d.codEmp));
  }

  function situacaoDe(d) { return SITUACOES[d.agendado ? 'AGENDADO' : d.situacao] || SITUACOES.DEMITIDO; }

  function seloHtml(d) {
    var s = situacaoDe(d);
    return '<span class="g-selo g-deslig__selo g-deslig__selo--' + s.tom + '"><i class="' + s.icone + '" aria-hidden="true"></i>' + s.rotulo + '</span>';
  }

  /** Quando, em poucas palavras (card da lista). */
  function quandoCurto(d) {
    if (d.agendado) { return 'sai em ' + u.esc(u.dataBr(d.dtDemissao)); }
    if (d.dataInconsistente) { return 'data a conferir'; }
    if (d.diasDesligado === null || d.diasDesligado === undefined) { return ''; }
    var dias = Number(d.diasDesligado);
    return dias === 0 ? 'hoje' : (dias === 1 ? 'há 1 dia' : 'há ' + dias + ' dias');
  }

  /** Quando, por extenso (detalhe da pessoa). */
  function quandoHtml(d) {
    if (d.agendado) { return 'Desligamento agendado para ' + u.esc(u.dataBr(d.dtDemissao)); }
    if (d.dataInconsistente) {
      return '<span class="g-deslig__inconsistente">Data de demissão na folha: ' + u.esc(u.dataBr(d.dtDemissao)) + ' (conferir com o RH)</span>';
    }
    if (d.situacao === 'TRANSFERIDO') { return 'Transferido na folha'; }
    if (d.situacao === 'NAO_ENCONTRADO') { return 'Registro não encontrado na folha'; }
    if (!d.dtDemissao) { return 'Demitido (sem data na folha)'; }
    return 'Desligado em ' + u.esc(u.dataBr(d.dtDemissao)) + ' · ' + quandoCurto(d);
  }

  // ------------------------------------------------------------------ lista

  function listaHtml() {
    if (!lista.length) {
      return '<div class="g-deslig-raiz"><p class="g-vazio"><i class="ri-shield-check-line" aria-hidden="true"></i>' +
        (impressao === null ? 'Carregando…' : 'Ninguém que saiu da empresa tem acesso ativo.') + '</p></div>';
    }
    return '<div class="g-deslig-raiz">' +
      '<p class="g-deslig__nota">' + u.plural(lista.length, 'pessoa', 'pessoas') + ' com acesso ativo. Clique para ver e tratar os acessos.</p>' +
      '<div class="g-deslig__grade">' + lista.map(cardPessoa).join('') + '</div></div>';
  }

  function cardPessoa(d) {
    var contas = d.contas.length;
    var usuarios = usuariosAtivos(d).length;
    return '<button type="button" class="g-deslig__card" data-abrir-pessoa="' + chavePessoa(d) + '">' +
      '<span class="g-deslig__card-topo">' +
        '<span class="g-deslig__iniciais" aria-hidden="true">' + u.esc(u.iniciais(d.nomeFunc || '?')) + '</span>' +
        '<span class="g-deslig__card-nome">' + u.esc(nomeDe(d)) +
          '<small>' + (d.nomeEmpresa ? u.esc(d.nomeEmpresa) + ' · ' : '') + Number(d.codEmp) + '/' + Number(d.codFunc) + '</small></span>' +
        '<i class="ri-arrow-right-s-line g-deslig__seta" aria-hidden="true"></i>' +
      '</span>' +
      '<span class="g-deslig__card-meio">' + seloHtml(d) + '<span>' + quandoCurto(d) + '</span></span>' +
      '<span class="g-deslig__card-rodape">' +
        (contas ? '<span><i class="ri-safe-2-line" aria-hidden="true"></i>' + u.plural(contas, 'conta', 'contas') + '</span>' : '') +
        (usuarios ? '<span><i class="ri-user-3-line" aria-hidden="true"></i>' + u.plural(usuarios, 'usuário no Om', 'usuários no Om') + '</span>' : '') +
      '</span></button>';
  }

  // ---------------------------------------------------------------- detalhe

  function detalheHtml(d) {
    return '<div class="g-deslig-raiz">' +
      '<div class="g-deslig__resumo">' + seloHtml(d) + '<span>' + quandoHtml(d) + '</span>' +
        '<span class="g-deslig__resumo-emp">' + (d.nomeEmpresa ? u.esc(d.nomeEmpresa) + ' · ' : '') +
        Number(d.codEmp) + '/' + Number(d.codFunc) + '</span></div>' +
      (d.novoCodFunc ? novoRegistroHtml(d) : '') +
      gruposDeContas(d).map(function (g) {
        return tituloGrupo(g.icone || 'ri-key-2-line', g.nome, g.contas.length) + tabelaContas(d, g.contas);
      }).join('') +
      (d.contas.length && (d.usuarios || []).length ? '<hr class="g-deslig__divisa">' : '') +
      ((d.usuarios || []).length ? tituloGrupo('ri-user-settings-line', 'Usuários do Sankhya Om', d.usuarios.length) + tabelaUsuarios(d) : '') +
      '</div>';
  }

  function tituloGrupo(icone, nome, qtd) {
    return '<h5 class="g-deslig__secao"><i class="' + u.icone(icone, 'ri-key-2-line') + '" aria-hidden="true"></i>' +
      u.esc(nome) + '<span class="g-deslig__secao-qtd">' + Number(qtd) + '</span></h5>';
  }

  /** Contas agrupadas pelo tipo (E-mails, Pasta pública/TS, Starlink...), na ordem em que chegam do servidor. */
  function gruposDeContas(d) {
    var grupos = [];
    var porTipo = {};
    d.contas.forEach(function (c) {
      var k = c.codTipo || '?';
      if (!porTipo[k]) {
        porTipo[k] = { nome: c.nomeTipo || c.codTipo || 'Outros', icone: c.iconeTipo, contas: [] };
        grupos.push(porTipo[k]);
      }
      porTipo[k].contas.push(c);
    });
    return grupos;
  }

  function rodapeDetalhe(d) {
    var pendentes = d.contas.length + usuariosAtivos(d).length;
    return '<button type="button" class="g-btn g-btn--fantasma" data-voltar><i class="ri-arrow-left-line" aria-hidden="true"></i> Voltar</button>' +
      (pendentes > 1 ? '<button type="button" class="g-btn g-btn--perigo" data-desativar-tudo>' +
        '<i class="ri-forbid-2-line" aria-hidden="true"></i> Desativar tudo</button>' : '');
  }

  /** Transferido com registro ativo novo (mesmo CPF): passar as contas para ele num clique. */
  function novoRegistroHtml(d) {
    return '<div class="g-deslig__novo"><i class="ri-arrow-left-right-line" aria-hidden="true"></i><span>Registro novo na folha: <strong>' +
      u.esc(d.novoNomeFunc || '') + '</strong> · ' + Number(d.novoCodEmp) + '/' + Number(d.novoCodFunc) +
      (d.novoNomeEmpresa ? ' · ' + u.esc(d.novoNomeEmpresa) : '') + '</span>' +
      (d.contas.length ? '<button type="button" class="g-btn g-btn--fantasma g-btn--p" data-passar-novo>' +
        '<i class="ri-user-shared-line" aria-hidden="true"></i> Passar as contas</button>' : '') + '</div>';
  }

  /**
   * Colunas da grade de um tipo de conta: login e, depois, só os campos que
   * alguma conta do grupo tem preenchidos (cada tipo usa campos diferentes).
   */
  var CAMPOS_CONTA = [
    ['descricao', 'Nome da conta'], ['equipamento', 'Equipamento'], ['unidade', 'Unidade'], ['pasta', 'Pasta'],
    ['horario', 'Horário'], ['diaAtivacao', 'Dia de ativação'], ['url', 'Endereço']
  ];

  function tabelaContas(d, contas) {
    var colunas = CAMPOS_CONTA.filter(function (campo) {
      return contas.some(function (c) { return campo[0] === 'descricao' ? c.login && c.descricao : c[campo[0]]; });
    });
    var rotuloLogin = contas[0].tipo === 'T' ? 'Usuário' : (contas[0].tipo === 'O' ? 'Login' : 'E-mail');
    return '<div class="g-deslig__tabela-rolagem"><table class="g-deslig__tabela"><thead><tr>' +
      '<th scope="col">' + rotuloLogin + '</th>' +
      colunas.map(function (campo) { return '<th scope="col">' + campo[1] + '</th>'; }).join('') +
      '<th scope="col" class="g-deslig__col-acoes"><span class="g-sr">Ações</span></th></tr></thead><tbody>' +
      contas.map(function (c) { return linhaConta(d, c, colunas); }).join('') + '</tbody></table></div>';
  }

  function linhaConta(d, c, colunas) {
    var aberto = painel && painel.idAcesso === c.idAcesso ? painel.tipo : null;
    var celula = function (v) { return v ? '<span title="' + u.esc(v) + '">' + u.esc(v) + '</span>' : '<span class="g-deslig__vazio">—</span>'; };
    return '<tr data-conta="' + Number(c.idAcesso) + '"' + (aberto ? ' class="g-deslig__tr--aberta"' : '') + '>' +
      '<td class="g-deslig__col-login">' + u.esc(c.login || c.descricao || '(sem login)') + '</td>' +
      colunas.map(function (campo) {
        var v = campo[0] === 'descricao' ? (c.login ? c.descricao : null) : c[campo[0]];
        return '<td>' + celula(v === null || v === undefined ? null : String(v)) + '</td>';
      }).join('') +
      '<td class="g-deslig__col-acoes"><span class="g-deslig__acoes">' +
        acaoBtn('trocar', 'ri-user-shared-line', 'Trocar funcionário', aberto === 'trocar') +
        (c.tipo !== 'S' ? acaoBtn('generica', 'ri-team-line', 'Tornar conta genérica', aberto === 'generica') : '') +
        acaoBtn('desativar', 'ri-forbid-2-line', 'Desativar (continua no cofre)') +
        acaoBtn('excluir', 'ri-delete-bin-line', 'Excluir do cofre', false, true) +
      '</span></td></tr>' +
      (aberto ? '<tr class="g-deslig__tr-painel" data-conta="' + Number(c.idAcesso) + '"><td colspan="' + (colunas.length + 2) + '">' +
        (aberto === 'trocar' ? painelTrocarHtml(d) : painelGenericaHtml(c)) + '</td></tr>' : '');
  }

  function acaoBtn(acao, icone, dica, ativo, perigo) {
    return '<button type="button" class="g-icone-btn g-deslig__acao' + (perigo ? ' g-icone-btn--perigo' : '') +
      (ativo ? ' g-deslig__acao--ativa' : '') + '" data-acao="' + acao + '" title="' + u.esc(dica) + '" aria-label="' + u.esc(dica) + '"' +
      (acao === 'trocar' || acao === 'generica' ? ' aria-expanded="' + (ativo ? 'true' : 'false') + '"' : '') + '>' +
      '<i class="' + icone + '" aria-hidden="true"></i></button>';
  }

  function painelTrocarHtml(d) {
    return '<div class="g-deslig__painel">' +
      (d.novoCodFunc ? '<button type="button" class="g-btn g-btn--fantasma g-btn--p" data-usar-novo>' +
        '<i class="ri-user-follow-line" aria-hidden="true"></i> Usar o registro novo: ' + u.esc(d.novoNomeFunc || '') + '</button>' : '') +
      '<label class="g-deslig__campo"><span>Funcionário que passa a usar a conta</span>' +
        '<input type="search" id="dl-func-termo" placeholder="Buscar por nome ou código" autocomplete="off" autofocus></label>' +
      '<div class="g-deslig__resultados" id="dl-func-resultados" role="listbox" hidden></div>' +
      '<div class="g-deslig__painel-rodape"><button type="button" class="g-btn g-btn--cancelar g-btn--p" data-fechar-painel>Cancelar</button></div>' +
      '</div>';
  }

  function painelGenericaHtml(c) {
    var outro = c.tipo === 'O';
    return '<div class="g-deslig__painel">' +
      '<label class="g-deslig__campo"><span' + (outro ? '' : ' class="g-obrigatorio"') + '>' + (outro ? 'Serviço' : 'Nome da conta') + '</span>' +
        '<input type="text" id="dl-nome-conta" maxlength="100" value="' + u.esc(c.descricao || '') + '"' +
        ' placeholder="Ex.: Compras - caixa geral" autocomplete="off" autofocus></label>' +
      '<p class="g-deslig__dica">A conta deixa de ser de um funcionário e sai das pendências.</p>' +
      '<div class="g-deslig__painel-rodape"><button type="button" class="g-btn g-btn--cancelar g-btn--p" data-fechar-painel>Cancelar</button>' +
        '<button type="button" class="g-btn g-btn--primario g-btn--p" data-confirmar-generica><i class="ri-team-line" aria-hidden="true"></i> Tornar genérica</button></div>' +
      '</div>';
  }

  /** Nome do usuário que não bate com o do funcionário: o vínculo na TSIUSU pode estar errado. */
  function nomeDiferente(d, x) {
    if (!x.nomeCompleto || !d.nomeFunc) { return false; }
    var primeiro = function (t) { return u.normal(t).trim().split(/\s+/)[0]; };
    return primeiro(x.nomeCompleto) !== primeiro(d.nomeFunc);
  }

  /** Grade dos usuários do Om: usuário, nome, código (link para o cadastro), hash do ponto e a chave "ativo". */
  function tabelaUsuarios(d) {
    return '<div class="g-deslig__tabela-rolagem"><table class="g-deslig__tabela"><thead><tr>' +
      '<th scope="col">Usuário</th><th scope="col">Nome completo</th><th scope="col">Código</th>' +
      '<th scope="col">Ponto (Pontotel)</th><th scope="col" class="g-deslig__col-acoes">Situação</th></tr></thead><tbody>' +
      d.usuarios.map(function (x) { return linhaUsuario(d, x); }).join('') + '</tbody></table></div>';
  }

  function linhaUsuario(d, x) {
    var alerta = nomeDiferente(d, x);
    return '<tr' + (x.ativo ? '' : ' class="g-deslig__tr--inativa"') + '>' +
      '<td class="g-deslig__col-login">' + u.esc(x.nomeUsu) + '</td>' +
      '<td>' + u.esc(x.nomeCompleto || '—') +
        (alerta ? '<small class="g-deslig__aviso" title="O nome do usuário não é o do funcionário: confira o vínculo antes de desativar">' +
          '<i class="ri-error-warning-line" aria-hidden="true"></i>nome diferente do funcionário</small>' : '') + '</td>' +
      '<td><button type="button" class="g-deslig__link" data-abrir-usuario="' + Number(x.codUsu) + '"' +
        ' title="Abrir o cadastro de Usuários do Om neste usuário">' + Number(x.codUsu) +
        '<i class="ri-external-link-line" aria-hidden="true"></i></button></td>' +
      '<td>' + (x.hashPonto
        ? '<span class="g-deslig__hash-celula"><code class="g-deslig__hash" title="' + u.esc(x.hashPonto) + '">' + u.esc(x.hashPonto) + '</code>' +
          '<button type="button" class="g-icone-btn g-deslig__copiar" data-copiar-hash="' + Number(x.codUsu) + '" title="Copiar o hash do ponto" aria-label="Copiar o hash do ponto">' +
          '<i class="ri-file-copy-line" aria-hidden="true"></i></button></span>'
        : '<span class="g-deslig__vazio">não informado</span>') + '</td>' +
      '<td class="g-deslig__col-acoes"><label class="g-deslig__chave">' +
        '<span>' + (x.ativo ? 'Ativo' : 'Inativo desde ' + u.esc(u.dataBr(x.dtLimAcesso))) + '</span>' +
        '<span class="g-interruptor"><input type="checkbox" data-usuario-om="' + Number(x.codUsu) + '"' + (x.ativo ? ' checked' : '') +
          ' aria-label="Usuário ' + u.esc(x.nomeUsu) + ' ativo no Om"><span></span></span></label></td>' +
      '</tr>';
  }

  /** Hash do ponto para a área de transferência (só texto, sem gravar nada). */
  function copiarHash(d, codUsu) {
    var x = d && (d.usuarios || []).filter(function (y) { return y.codUsu === codUsu; })[0];
    if (!x || !x.hashPonto) { return; }
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      CtiApp.erro('O navegador não deixou copiar. Selecione o hash e copie com Ctrl+C.');
      return;
    }
    navigator.clipboard.writeText(x.hashPonto).then(function () { CtiApp.sucesso('Hash do ponto copiado.'); },
      function () { CtiApp.erro('O navegador não deixou copiar. Selecione o hash e copie com Ctrl+C.'); });
  }

  // ================================================================ ações

  function aoClicar(e) {
    var alvo = e.target.closest('button');
    if (!alvo || alvo.disabled) { return; }
    if (alvo.dataset.abrirPessoa) { mostrar(alvo.dataset.abrirPessoa); return; }
    if (alvo.dataset.abrirUsuario) { abrirCadastroUsuario(Number(alvo.dataset.abrirUsuario)); return; }
    if (alvo.dataset.copiarHash) { copiarHash(pessoaPorChave(vista), Number(alvo.dataset.copiarHash)); return; }
    var d = pessoaPorChave(vista);
    if (!d) { return; }
    var li = alvo.closest('[data-conta]');
    var c = li ? contaDe(d, Number(li.dataset.conta)) : null;
    if (alvo.dataset.fecharPainel !== undefined) { fecharPainel(); return; }
    if (alvo.dataset.passarNovo !== undefined) { passarTudoParaNovo(d, alvo); return; }
    if (alvo.dataset.usarNovo !== undefined) {
      trocar(d, c, { codEmp: d.novoCodEmp, codFunc: d.novoCodFunc, nomeFunc: d.novoNomeFunc }, alvo);
      return;
    }
    if (alvo.dataset.func !== undefined) { trocar(d, c, resultados[Number(alvo.dataset.func)], alvo); return; }
    if (alvo.dataset.confirmarGenerica !== undefined) { tornarGenerica(li, alvo); return; }
    var acao = alvo.dataset.acao;
    if (!acao || !c) { return; }
    if (acao === 'trocar' || acao === 'generica') {
      painel = painel && painel.idAcesso === c.idAcesso && painel.tipo === acao ? null : { idAcesso: c.idAcesso, tipo: acao };
      u.el('g-modal-corpo').innerHTML = detalheHtml(d);
      var foco = u.el('g-modal-corpo').querySelector('[autofocus]');
      if (foco) { foco.focus(); }
      return;
    }
    if (acao === 'desativar') {
      CtiApp.confirmar({ titulo: 'Desativar conta', botao: 'Desativar',
        mensagem: 'Desativar ' + rotuloConta(c) + '? A conta continua no cofre, marcada como desativada.' })
        .then(function (ok) { if (ok) { resolver([item(c, 'DESATIVAR')], alvo, 'Conta desativada.'); } });
    }
    if (acao === 'excluir') {
      var imp = CtiCofre.impactoExclusao([c.idAcesso]);
      if (CtiCofre.avisarBloqueio(imp, c.login)) { return; }
      // A confirmação executa e mostra o resultado (a exclusão pode passar pela HostGator).
      CtiApp.confirmar({ titulo: 'Excluir conta', botao: 'Excluir', perigo: true, topicos: imp ? imp.topicos : null,
        mensagem: 'Excluir ' + rotuloConta(c) + ' do cofre? Ela sai da lista (exclusão lógica, fica no histórico). ' +
          'Se for de um domínio gerenciado, também sai da HostGator.' + CtiCofre.tambemMuda(imp),
        botaoExecutando: 'Excluindo…', tituloSucesso: 'excluída', carregando: 'Excluindo a conta (e na HostGator, se for de lá)…', contextoErro: 'A conta não foi excluída',
        executar: function () {
          return CtiApp.dados.resolverDesligados({ itens: [item(c, 'EXCLUIR')] }).then(function (r) {
            if (r.erros.length) { throw new Error(r.erros[0].mensagem); }
            return r;
          });
        },
        sucesso: function () { return rotuloConta(c) + ' saiu do cofre.'; } })
        .then(function (r) { if (r) { depoisDeGravar(); } });
    }
  }

  /** Cadastro de Usuários do Om já no usuário (aba nova do Om; o painel continua aberto). */
  function abrirCadastroUsuario(codUsu) {
    if (!CtiApi.abrirTela(TELA_USUARIOS, { CODUSU: codUsu })) {
      CtiApp.alerta('A tela de Usuários só abre com o painel dentro do Sankhya Om (usuário ' + codUsu + ').');
    }
  }

  function rotuloConta(c) { return (c.nomeTipo ? c.nomeTipo + ' ' : '') + (c.login || c.descricao || ''); }

  function item(c, acao, extra) {
    return Object.assign({ idAcesso: c.idAcesso, versao: c.versao, acao: acao }, extra || {});
  }

  /**
   * Grava no servidor e relê a lista; o cofre aberto também recarrega. Cada
   * conta roda na própria transação (a exclusão pode passar pela HostGator):
   * as que falharem aparecem no resumo, as demais ficam gravadas.
   */
  function resolver(itens, botaoAlvo, mensagem) {
    var exclui = itens.some(function (x) { return x.acao === 'EXCLUIR'; });
    var promessa = CtiApp.dados.resolverDesligados({ itens: itens });
    if (exclui) { promessa = CtiApp.esperar('Excluindo a conta (e na HostGator, se for de lá)…', promessa); }
    return CtiApp.ocupado(botaoAlvo, promessa).then(function (r) {
      if (r.erros.length) {
        CtiApp.resumoLote({ titulo: 'Algumas contas não foram tratadas', feito: r.qtd === 1 ? 'conta tratada' : 'contas tratadas', resultado: r });
      } else {
        CtiApp.sucesso(mensagem);
      }
      depoisDeGravar();
    }, function (e) {
      CtiApp.falhaAoGravar(e, 'Não foi possível concluir: ');
      depoisDeGravar();
    });
  }

  function depoisDeGravar() {
    painel = null;
    repintarAoFechar = false;
    buscar(resumo ? resumo.impressao : null);
    CtiApp.recarregar(['cofre']);
  }

  function tornarGenerica(li, botaoAlvo) {
    var d = pessoaPorChave(vista);
    var c = contaDe(d, Number(li.dataset.conta));
    var nome = u.el('dl-nome-conta').value.trim();
    if (!nome && c.tipo !== 'O') {
      CtiApp.erro('Informe o nome da conta genérica.');
      u.el('dl-nome-conta').focus();
      return;
    }
    resolver([item(c, 'GENERICA', { nomeConta: nome || null })], botaoAlvo, 'Conta marcada como genérica.');
  }

  function trocar(d, c, f, botaoAlvo) {
    if (!c || !f) { return; }
    CtiApp.confirmar({ titulo: 'Trocar funcionário', botao: 'Trocar',
      mensagem: 'Passar ' + rotuloConta(c) + ' para ' + (f.nomeFunc || 'o funcionário ' + f.codFunc) +
        ' (empresa ' + f.codEmp + ', código ' + f.codFunc + ')?' })
      .then(function (ok) {
        if (ok) { resolver([item(c, 'TROCAR', { codEmp: f.codEmp, codFunc: f.codFunc })], botaoAlvo, 'Funcionário trocado.'); }
      });
  }

  function passarTudoParaNovo(d, botaoAlvo) {
    CtiApp.confirmar({ titulo: 'Passar contas para o registro novo', botao: 'Passar',
      mensagem: 'Passar ' + u.plural(d.contas.length, 'conta', 'contas') + ' de ' + nomeDe(d) + ' para o registro novo (empresa ' +
        d.novoCodEmp + ', código ' + d.novoCodFunc + ')?' })
      .then(function (ok) {
        if (!ok) { return; }
        resolver(d.contas.map(function (c) { return item(c, 'TROCAR', { codEmp: d.novoCodEmp, codFunc: d.novoCodFunc }); }),
          botaoAlvo, 'Contas passadas para o registro novo.');
      });
  }

  /** Contas numa transação; depois cada usuário do Om (TSIUSU fica fora da transação do cofre). */
  function desativarTudo(d, botaoAlvo) {
    if (!d) { return; }
    var usuarios = usuariosAtivos(d);
    var partes = [];
    if (d.contas.length) { partes.push(u.plural(d.contas.length, 'conta no cofre', 'contas no cofre')); }
    if (usuarios.length) { partes.push(u.plural(usuarios.length, 'usuário no Om', 'usuários no Om')); }
    CtiApp.confirmar({ titulo: 'Desativar tudo', botao: 'Desativar tudo',
      mensagem: 'Desativar ' + partes.join(' e ') + ' de ' + nomeDe(d) + '?' +
        (usuarios.length ? ' Os usuários do Om ficam com data limite de acesso ' + u.dataBr(u.hojeIso()) + '.' : '') })
      .then(function (ok) {
        if (!ok) { return; }
        var falhas = null;
        var passo = d.contas.length
          ? CtiApp.dados.resolverDesligados({ itens: d.contas.map(function (c) { return item(c, 'DESATIVAR'); }) })
            .then(function (r) { if (r.erros.length) { falhas = r; } })
          : Promise.resolve();
        var tudo = usuarios.reduce(function (p, x) {
          return p.then(function () { return CtiApp.dados.alterarUsuarioOm({ codUsu: x.codUsu, ativo: false }); });
        }, passo);
        CtiApp.ocupado(botaoAlvo, tudo).then(function () {
          if (falhas) {
            CtiApp.resumoLote({ titulo: 'Algumas contas não foram desativadas', feito: falhas.qtd === 1 ? 'conta desativada' : 'contas desativadas', resultado: falhas });
          } else {
            CtiApp.sucesso('Acessos de ' + nomeDe(d) + ' desativados.');
          }
          depoisDeGravar();
        }, function (e) {
          CtiApp.falhaAoGravar(e, 'Parte dos acessos não foi desativada: ');
          depoisDeGravar();
        });
      });
  }

  /** Chave do usuário do Om: confirma e grava; cancelou ou falhou, a chave volta. */
  function aoMudarChave(e) {
    var chk = e.target;
    if (!chk.dataset.usuarioOm) { return; }
    var d = pessoaPorChave(vista);
    var codUsu = Number(chk.dataset.usuarioOm);
    var x = d && (d.usuarios || []).filter(function (y) { return y.codUsu === codUsu; })[0];
    if (!x) { chk.checked = !chk.checked; return; }
    var ativar = chk.checked;
    CtiApp.confirmar({ titulo: ativar ? 'Reativar usuário do Om' : 'Desativar usuário do Om', botao: ativar ? 'Reativar' : 'Desativar',
      mensagem: ativar
        ? 'Reativar o usuário ' + x.nomeUsu + ' (' + (x.nomeCompleto || '') + ')? A data limite de acesso fica vazia.'
        : 'Desativar o usuário ' + x.nomeUsu + ' (' + (x.nomeCompleto || '') + ') no Sankhya Om? A data limite de acesso fica ' + u.dataBr(u.hojeIso()) + '.' +
          (nomeDiferente(d, x) ? ' Atenção: o nome do usuário não é o de ' + nomeDe(d) + '.' : '') })
      .then(function (ok) {
        if (!ok) { chk.checked = !ativar; return; }
        chk.disabled = true;
        CtiApp.dados.alterarUsuarioOm({ codUsu: codUsu, ativo: ativar }).then(function () {
          CtiApp.sucesso(ativar ? 'Usuário reativado.' : 'Usuário desativado.');
          depoisDeGravar();
        }, function (erro) {
          chk.checked = !ativar;
          chk.disabled = false;
          CtiApp.falhaAoGravar(erro, 'O usuário não foi alterado: ');
          depoisDeGravar();
        });
      });
  }

  /** Busca de funcionário ativo no painel "Trocar" (mesmo serviço do formulário do cofre). */
  function aoDigitar(e) {
    if (e.target.id !== 'dl-func-termo') { return; }
    clearTimeout(esperaBusca);
    var termo = e.target.value.trim();
    var alvo = u.el('dl-func-resultados');
    var exibir = function (html) { alvo.innerHTML = html; alvo.hidden = !html; };
    if (termo.length < 2) { exibir(''); return; }
    esperaBusca = setTimeout(function () {
      CtiApp.dados.buscarFuncionarios(termo).then(function (achados) {
        if (u.el('dl-func-termo') !== e.target || e.target.value.trim() !== termo) { return; }
        resultados = achados;
        exibir(achados.length ? achados.map(function (f, i) {
          return '<button type="button" class="g-deslig__resultado" role="option" data-func="' + i + '">' +
            '<span class="g-deslig__res-nome">' + u.esc(f.nomeFunc) + '</span>' +
            '<span>' + Number(f.codEmp) + '/' + Number(f.codFunc) + '</span>' +
            '<span>' + u.esc(f.cargo || '—') + '</span>' +
            '<span>' + u.esc(f.departamento || '—') + '</span></button>';
        }).join('') : '<p class="g-deslig__dica">Nenhum funcionário ativo encontrado.</p>');
      }, function (erro) { exibir('<p class="g-deslig__dica">' + u.esc(CtiApi.textoDoErro(erro)) + '</p>'); });
    }, 300);
  }

  return {
    avisoHostGator: avisoHostGator,
    iniciar: iniciar,
    aplicarSessao: aplicarSessao,
    atualizar: atualizar,
    aoMudar: aoMudar,
    cardHtml: cardHtml,
    abrir: abrir
  };
})();
