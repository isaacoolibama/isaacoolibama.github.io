/**
 * Aba Configurações › HostGator: situação da integração (com o log da API em
 * modal) e, só para quem configura, a configuração, os domínios gerenciados
 * e a conferência com a HostGator.
 *
 * O token nunca chega à tela: o servidor diz só se há token e desde quando.
 * O grupo do cofre vê a situação e o log, sem a configuração.
 */
var CtiHostGator = (function () {
  'use strict';

  var u = CtiUtil;

  /** Operações do log (HostGatorLogService): rótulo e ícone. */
  var OPERACOES = {
    CRIAR_CAIXA: ['Criou caixa', 'ri-mail-add-line'],
    SENHA: ['Trocou senha', 'ri-key-2-line'],
    EXCLUIR_CAIXA: ['Excluiu caixa', 'ri-mail-close-line'],
    CRIAR_REDIR: ['Criou redirecionamento', 'ri-share-forward-line'],
    EXCLUIR_REDIR: ['Apagou redirecionamento', 'ri-link-unlink'],
    LISTAR: ['Consulta', 'ri-search-line'],
    TESTE: ['Teste de conexão', 'ri-pulse-line'],
    CONVERTER: ['Converteu caixa', 'ri-exchange-line']
  };

  var painel = null;
  var painelDesatualizado = false;
  var carregando = false;
  var alvoAtual = null;
  var FILTRO_PADRAO = { soErros: false, operacao: '', dias: 30, termo: '' };
  var filtro = Object.assign({}, FILTRO_PADRAO);
  /** Último "Testar conexão" desta tela: domínios da conta comparados com o cofre. */
  var teste = null;
  var esperaBusca = null;
  var pediuCofre = false;

  function filtroDto() {
    return { soErros: filtro.soErros, operacao: filtro.operacao || null, dias: filtro.dias, termo: filtro.termo || null };
  }

  function visivel() {
    return !!alvoAtual && CtiApp.visao() === 'config' && !!alvoAtual.querySelector('#hg-raiz');
  }

  // ============================================================ carga

  function pintar(alvo) {
    alvoAtual = alvo;
    if (painelDesatualizado) {
      painel = null;
      painelDesatualizado = false;
    }
    if (!painel) {
      alvo.innerHTML = '<p class="g-vazio"><i class="ri-cloud-line" aria-hidden="true"></i>Carregando a integração HostGator…</p>';
      carregar(false);
      return;
    }
    montar(alvo);
  }

  function carregar(silencioso) {
    if (carregando) { return; }
    carregando = true;
    CtiApp.dados.carregarHostGator(filtroDto()).then(function (p) {
      carregando = false;
      var primeira = !painel;
      painel = p;
      painelDesatualizado = false;
      if (!visivel() && !primeira) { return; }
      if (primeira || !alvoAtual.querySelector('#hg-raiz')) { if (alvoAtual) { montar(alvoAtual); } return; }
      pintarSituacao();
      if (logAberto()) { pintarLog(); }
    }, function (e) {
      carregando = false;
      if (!silencioso) { CtiApp.abrirErro('Falha ao carregar a aba HostGator', e); }
    });
  }

  /** Heartbeat: chegou chamada nova no log (de qualquer usuário); com a aba aberta, atualiza situação e log. */
  function atualizar(ultimoLog) {
    if (!painel || ultimoLog === null || ultimoLog === undefined || Number(ultimoLog) === Number(painel.ultimoLog)) { return; }
    if (visivel()) { carregar(true); } else { painelDesatualizado = true; }
  }

  // ============================================================ tela

  function montar(alvo) {
    var c = painel.config;
    var podeConfigurar = !!c;
    alvo.innerHTML =
      '<div id="hg-raiz" class="g-hg">' +
        '<section class="g-hg__situacao" id="hg-situacao" aria-live="polite"></section>' +
        (podeConfigurar ? secaoConfiguracao(c) : '') +
      '</div>';
    pintarSituacao();
    ligarEventos(podeConfigurar);
  }

  function logAberto() { return !!u.el('hg-log'); }

  /**
   * Log da API em modal, no padrão dos demais (largo, altura fixa, a tabela
   * rola por dentro). Pelo indicador de erros abre já filtrado; pelo botão,
   * com o filtro padrão.
   */
  function abrirLog(soErros24h) {
    filtro = Object.assign({}, FILTRO_PADRAO, soErros24h ? { soErros: true, dias: 1 } : {});
    CtiApp.abrirModal({
      titulo: 'Log da API', tamanho: 'largo', focarFechar: true,
      corpo: '<div class="g-hg__logmodal">' +
          '<div class="g-hg__filtros">' +
            '<label class="g-cofre__flag"><span class="g-interruptor"><input type="checkbox" id="hg-so-erros"' + (filtro.soErros ? ' checked' : '') + '><span></span></span>' +
              '<span class="g-cofre__flag-texto">Só erros</span></label>' +
            '<label class="g-campo g-campo--inline"><span>Operação</span><select id="hg-operacao">' + u.opcao('', 'Todas', filtro.operacao) +
              Object.keys(OPERACOES).map(function (k) { return u.opcao(k, OPERACOES[k][0], filtro.operacao, { icone: OPERACOES[k][1] }); }).join('') +
            '</select></label>' +
            '<label class="g-campo g-campo--inline"><span>Período</span><select id="hg-dias">' +
              [[1, 'Últimas 24 h'], [7, 'Últimos 7 dias'], [30, 'Últimos 30 dias'], [90, 'Últimos 90 dias'], [365, 'Último ano']].map(function (d) {
                return u.opcao(d[0], d[1], filtro.dias);
              }).join('') + '</select></label>' +
            '<input type="search" class="g-hg__busca" id="hg-termo" placeholder="Buscar e-mail ou destino" value="' + u.esc(filtro.termo) + '" aria-label="Buscar no log">' +
            '<span class="g-hg__log-qtd" id="hg-log-qtd" aria-live="polite"></span>' +
          '</div>' +
          '<div class="g-hg__log" id="hg-log"><p class="g-vazio"><i class="ri-loader-4-line g-anima-gira" aria-hidden="true"></i>Carregando o log…</p></div>' +
        '</div>',
      rodape: '<button type="button" class="g-btn g-btn--cancelar" id="hg-log-fechar">Fechar</button>'
    });
    u.el('hg-log-fechar').addEventListener('click', function () { CtiApp.fecharModal(true); });
    u.el('hg-log').addEventListener('click', function (e) {
      var b = e.target.closest('.g-hg__msg-texto--longo');
      if (b) { b.setAttribute('aria-expanded', String(b.getAttribute('aria-expanded') !== 'true')); }
    });
    u.el('hg-so-erros').addEventListener('change', function (e) { filtro.soErros = e.target.checked; recarregarLog(); });
    u.el('hg-operacao').addEventListener('change', function (e) { filtro.operacao = e.target.value; recarregarLog(); });
    u.el('hg-dias').addEventListener('change', function (e) { filtro.dias = Number(e.target.value); recarregarLog(); });
    u.el('hg-termo').addEventListener('input', function (e) {
      clearTimeout(esperaBusca);
      esperaBusca = setTimeout(function () { filtro.termo = e.target.value.trim(); recarregarLog(); }, 350);
    });
    recarregarLog();
  }

  /**
   * Situação em duas linhas: estado da conexão (com resumo curto do último
   * teste) e ações; embaixo, três indicadores do mesmo tamanho. Cor do estado
   * no fundo e no contorno inteiro (sem faixa lateral).
   */
  function pintarSituacao() {
    var p = painel;
    var estadoConexao = !p.ativo ? 'desligada' : (p.conexaoOk === false ? 'erro' : (p.conexaoOk ? 'ok' : 'nova'));
    var rotulo = { desligada: 'Integração desligada', erro: 'Conexão com erro', ok: 'Conexão OK', nova: 'Ligada, sem teste ainda' }[estadoConexao];
    var icone = { desligada: 'ri-plug-line', erro: 'ri-error-warning-line', ok: 'ri-checkbox-circle-line', nova: 'ri-question-line' }[estadoConexao];
    var ult = p.ultimaChamada;
    var podeConfigurar = !!p.config;
    var el = u.el('hg-situacao');
    el.className = 'g-hg__situacao g-hg__situacao--' + estadoConexao;
    el.innerHTML =
      '<div class="g-hg__sit-topo">' +
        '<div class="g-hg__estado"><span class="g-hg__estado-icone"><i class="' + icone + '" aria-hidden="true"></i></span>' +
          '<div><strong>' + rotulo + '</strong><small>' + u.esc(resumoTeste(p)) + '</small></div></div>' +
        '<div class="g-hg__acoes">' +
          '<button type="button" class="g-btn g-btn--fantasma" id="hg-ver-log"><i class="ri-file-list-3-line" aria-hidden="true"></i> Log da API</button>' +
          (podeConfigurar
            ? '<button type="button" class="g-btn g-btn--fantasma" id="hg-testar"><i class="ri-pulse-line" aria-hidden="true"></i> Testar conexão</button>' +
              '<button type="button" class="g-btn g-btn--primario" id="hg-conferir"' + (p.ativo ? '' : ' disabled title="Ligue a integração para conferir"') + '>' +
                '<i class="ri-arrow-left-right-line" aria-hidden="true"></i> Conferir com a HostGator</button>'
            : '') +
        '</div>' +
      '</div>' +
      '<div class="g-hg__indicadores">' +
        indicador('', 'ri-history-line', 'Última chamada', ult
          ? '<i class="' + (ult.sucesso ? 'ri-checkbox-circle-fill g-hg__ok' : 'ri-close-circle-fill g-hg__falha') + '" aria-hidden="true"></i>' +
            u.esc(haQuanto(ult.dhEvento)) + '<small>' + u.esc((OPERACOES[ult.operacao] || [ult.operacao])[0]) + '</small>'
          : 'nenhuma') +
        indicador(p.erros24h ? 'g-hg__indicador--erro' : '', 'ri-error-warning-line', 'Erros em 24 h',
          '<b>' + Number(p.erros24h || 0) + '</b><small>' + (p.erros24h ? 'ver no log' : 'nenhum') + '</small>', 'hg-ver-erros',
          'Abrir o log com os erros das últimas 24 h') +
        indicador('', 'ri-at-line', 'Domínios gerenciados', textoGerenciados()) +
      '</div>';
    u.el('hg-ver-erros').addEventListener('click', function () { abrirLog(true); });
    u.el('hg-ver-log').addEventListener('click', function () { abrirLog(false); });
    if (podeConfigurar) {
      u.el('hg-testar').addEventListener('click', testar);
      u.el('hg-conferir').addEventListener('click', conferir);
    }
  }

  /** id: o indicador vira botão (erros filtram o log). */
  function indicador(classe, icone, rotulo, valorHtml, id, dica) {
    var tag = id ? 'button' : 'div';
    return '<' + tag + (id ? ' type="button" id="' + id + '" title="' + u.esc(dica || '') + '"' : '') +
      ' class="g-hg__indicador' + (id ? ' g-hg__indicador--botao' : '') + (classe ? ' ' + classe : '') + '">' +
      '<span class="g-hg__indicador-icone"><i class="' + icone + '" aria-hidden="true"></i></span>' +
      '<span class="g-hg__indicador-texto"><small>' + u.esc(rotulo) + '</small><span>' + valorHtml + '</span></span></' + tag + '>';
  }

  /**
   * "Testado em 05/10/2026 09:31 · resposta em 412 ms" (o texto completo do teste fica no log).
   * O teste agendado (de hora em hora) aparece como "Teste automático em".
   */
  function resumoTeste(p) {
    if (!p.dhTeste) { return 'Conexão ainda não testada.'; }
    var quando = (p.testeAutomatico ? 'Teste automático em ' : 'Testado em ') + u.dataHoraBr(p.dhTeste);
    var r = p.resultadoTeste || '';
    if (r.indexOf('ERRO') === 0) { return quando + ' · ' + r.replace(/^ERRO:\s*/, ''); }
    var ms = /resposta em (\d+) ms/.exec(r);
    return quando + (ms ? ' · resposta em ' + ms[1] + ' ms' : '');
  }

  function textoGerenciados() {
    var cofre = CtiApp.estado.cofre;
    if (!cofre) { return '—'; }
    var n = cofre.dominios.filter(function (d) { return d.hostgator; }).length;
    var naConta = (painel.dominiosHostGator || []).length;
    return '<b>' + n + '</b><small>' + (naConta ? 'de ' + naConta + ' na conta' : (n === 1 ? 'domínio' : 'domínios')) + '</small>';
  }

  function pintarLog() {
    var lista = painel.log || [];
    var alvo = u.el('hg-log');
    u.el('hg-log-qtd').textContent = lista.length >= 200 ? '200 mais recentes' : u.plural(lista.length, 'chamada', 'chamadas');
    if (!lista.length) {
      alvo.innerHTML = '<p class="g-vazio"><i class="ri-file-list-3-line" aria-hidden="true"></i>' +
        (filtro.soErros || filtro.operacao || filtro.termo ? 'Nenhuma chamada com esse filtro.' : 'Nenhuma chamada à HostGator no período.') + '</p>';
      return;
    }
    alvo.innerHTML = '<div class="g-tabela-rolagem"><table class="g-tabela g-hg__tabela"><thead><tr>' +
      '<th>Data/hora</th><th>Usuário</th><th>Operação</th><th>E-mail / destino</th><th>Resultado</th><th>Mensagem</th><th class="g-hg__num">Tempo</th>' +
      '</tr></thead><tbody>' + lista.map(function (l) {
        var op = OPERACOES[l.operacao] || [l.operacao, 'ri-question-line'];
        return '<tr class="' + (l.sucesso ? '' : 'g-hg__linha-erro') + '">' +
          '<td class="g-hg__quando">' + u.esc(u.dataHoraBr(l.dhEvento)) + '</td>' +
          '<td>' + u.esc(l.origem === 'testeAutomatico' ? 'Automático' : (l.nomeUsu || ('Usuário ' + l.codUsu))) + '</td>' +
          '<td><span class="g-hg__op"><i class="' + u.icone(op[1], 'ri-question-line') + '" aria-hidden="true"></i>' + u.esc(op[0]) + '</span></td>' +
          // Destino embaixo do e-mail: duas colunas de endereço não cabiam no modal.
          '<td class="g-hg__email">' + (l.email ? u.esc(l.email) : '<span class="g-cofre__nada">—</span>') +
            (l.destino ? '<small class="g-hg__log-destino"><i class="ri-arrow-right-line" aria-hidden="true"></i>' + u.esc(l.destino) + '</small>' : '') + '</td>' +
          '<td>' + (l.sucesso
            ? '<span class="g-selo g-hg__selo-ok"><i class="ri-check-line" aria-hidden="true"></i>OK</span>'
            : '<span class="g-selo g-hg__selo-erro"><i class="ri-close-line" aria-hidden="true"></i>Erro' + (l.httpStatus && Number(l.httpStatus) !== 200 ? ' HTTP ' + Number(l.httpStatus) : '') + '</span>') + '</td>' +
          // Texto único: curto aparece inteiro; longo mostra 2 linhas e o clique expande o mesmo texto (sem repetir).
          '<td class="g-hg__msg">' + (!l.mensagem ? '<span class="g-cofre__nada">—</span>'
            : String(l.mensagem).length > 90
              ? '<button type="button" class="g-hg__msg-texto g-hg__msg-texto--longo" aria-expanded="false" title="Clique para ver tudo">' + u.esc(l.mensagem) + '</button>'
              : '<span class="g-hg__msg-texto">' + u.esc(l.mensagem) + '</span>') + '</td>' +
          '<td class="g-hg__num">' + (l.duracaoMs !== null && l.duracaoMs !== undefined ? Number(l.duracaoMs) + ' ms' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (lista.length >= 200 ? '<p class="g-dica"><i class="ri-information-line" aria-hidden="true"></i> Mostrando as 200 chamadas mais recentes: use os filtros para achar uma antiga.</p>' : '');
  }

  function haQuanto(iso) {
    var d = new Date(iso);
    var min = Math.round((Date.now() - d.getTime()) / 60000);
    if (isNaN(min)) { return ''; }
    if (min < 1) { return 'agora'; }
    if (min < 60) { return 'há ' + min + ' min'; }
    if (min < 1440) { return 'há ' + Math.round(min / 60) + ' h'; }
    return u.dataHoraBr(iso);
  }

  function recarregarLog() {
    CtiApp.dados.listarLogHostGator(filtroDto()).then(function (lista) {
      painel.log = lista;
      if (logAberto()) { pintarLog(); }
    }, function (e) { CtiApp.abrirErro('Falha ao filtrar o log da API', e); });
  }

  // ======================================================= configuração

  function secaoConfiguracao(c) {
    var equipamentos = ((CtiApp.estado.cofre && CtiApp.estado.cofre.equipamentos) || []).filter(function (e) {
      return e.categoria === 'R' && (e.ativo || e.nome === c.equipRedir);
    });
    var token = c.tokenConfigurado
      ? 'Configurado' + (c.dhToken ? ' em ' + u.dataHoraBr(c.dhToken) : '') + '. Digite só para trocar.'
      : 'Nenhum token gravado. Crie em cPanel › Segurança › Gerenciar tokens de API.';
    return '<section class="g-config-secao">' +
      '<div class="g-painel-cab"><div><h2>Configuração</h2></div></div>' +
      '<div class="g-hg__cfg" id="hg-cfg">' +
        // Conexão: o interruptor geral fica no cabeçalho da seção.
        '<section class="g-hg__cartao" data-hg-campos>' +
          '<header class="g-hg__cartao-cab"><span class="g-cofre__bloco-titulo"><i class="ri-plug-line" aria-hidden="true"></i>Conexão</span>' +
            '<label class="g-cofre__flag"><span class="g-interruptor"><input type="checkbox" id="hg-ativo"' + (c.ativo ? ' checked' : '') + '><span></span></span>' +
            '<span class="g-cofre__flag-texto">Integração ligada</span></label></header>' +
          '<label class="g-campo"><span class="g-obrigatorio">Servidor do cPanel</span><input type="text" id="hg-host" maxlength="120" value="' + u.esc(c.host || '') + '" placeholder="servidor.exemplo.com.br"></label>' +
          '<div class="g-hg__par">' +
            '<label class="g-campo"><span class="g-obrigatorio">Usuário do cPanel</span><input type="text" id="hg-usuario" maxlength="60" value="' + u.esc(c.usuario || '') + '"></label>' +
            '<label class="g-campo g-hg__curto"><span>Porta</span><input type="number" id="hg-porta" min="1" max="65535" value="' + Number(c.porta || 2083) + '"></label>' +
          '</div>' +
          '<div class="g-hg__par">' +
            '<label class="g-campo"><span' + (c.tokenConfigurado ? '' : ' class="g-obrigatorio"') + '>Token de API</span>' +
              '<input type="password" id="hg-token" maxlength="64" autocomplete="new-password" spellcheck="false" placeholder="' + u.esc(c.tokenConfigurado ? '•••••••• (mantém o atual)' : 'Cole o token do cPanel') + '"></label>' +
            '<label class="g-campo g-hg__curto"><span>Tempo limite (s)</span><input type="number" id="hg-timeout" min="5" max="120" value="' + Number(c.timeout || 20) + '"></label>' +
          '</div>' +
          '<small class="g-form__nota g-hg__token-nota"><i class="ri-shield-keyhole-line" aria-hidden="true"></i> ' + u.esc(token) + '</small>' +
        '</section>' +
        '<section class="g-hg__cartao" data-hg-campos>' +
          '<header class="g-hg__cartao-cab"><span class="g-cofre__bloco-titulo"><i class="ri-list-settings-line" aria-hidden="true"></i>Padrões</span></header>' +
          // Campo de texto com o rótulo em cima; valor curto e liga/desliga na mesma linha do rótulo.
          '<label class="g-hg__ajuste"><span class="g-hg__ajuste-texto">Destino padrão do Starlink<small>só Starlink novo</small></span>' +
            '<input type="email" id="hg-dest-starlink" maxlength="150" value="' + u.esc(c.destStarlink || '') + '" placeholder="ti@empresa.com.br"></label>' +
          '<label class="g-hg__ajuste"><span class="g-hg__ajuste-texto">Equipamento ao converter caixa<small>gravado pela conferência</small></span>' +
            '<select id="hg-equip">' + u.opcao('', 'Não informado', c.equipRedir || '') + equipamentos.map(function (e) {
              return u.opcao(e.nome, e.nome, c.equipRedir, { icone: u.icone(e.icone, 'ri-share-forward-line') });
            }).join('') + '</select></label>' +
          '<label class="g-hg__ajuste g-hg__ajuste--linha"><span class="g-hg__ajuste-texto">Cota das caixas novas<small>0 = ilimitada</small></span>' +
            '<span class="g-hg__unidade"><input type="number" id="hg-cota" min="0" value="' + Number(c.cotaMb || 0) + '" aria-label="Cota em MB">MB</span></label>' +
          '<label class="g-hg__ajuste g-hg__ajuste--linha"><span class="g-hg__ajuste-texto">Enviar instruções ao criar a caixa<small>e-mail de boas-vindas do cPanel</small></span>' +
            '<span class="g-interruptor"><input type="checkbox" id="hg-boasvindas"' + (c.boasVindas ? ' checked' : '') + '><span></span></span></label>' +
        '</section>' +
        '<section class="g-hg__cartao g-hg__dominios">' +
          '<header class="g-hg__cartao-cab"><span class="g-cofre__bloco-titulo"><i class="ri-at-line" aria-hidden="true"></i>Domínios</span>' +
            '</header>' +
          '<div id="hg-dominios"></div>' +
        '</section>' +
      '</div>' +
    '</section>';
  }

  /** Domínios da conta: o teste desta tela ou, sem ele, a lista gravada no último teste. */
  function dominiosDaConta() {
    if (teste && teste.ok) {
      return teste.dominios.filter(function (d) { return d.naHostGator; }).map(function (d) { return d.dominio; });
    }
    return (painel && painel.dominiosHostGator) || [];
  }

  /**
   * Uma linha por domínio, juntando a conta HostGator e o cofre: o que existe
   * lá e falta aqui aparece (com o botão para cadastrar), nada fica escondido.
   * Lista compacta para caber na terceira coluna da configuração.
   */
  function pintarDominios() {
    var alvo = u.el('hg-dominios');
    if (!alvo) { return; }
    var cofre = CtiApp.estado.cofre;
    if (!cofre) {
      alvo.innerHTML = '<p class="g-vazio">Carregando os domínios do cofre…</p>';
      return;
    }
    var daConta = dominiosDaConta();
    var conhecida = daConta.length > 0;
    var porNome = {};
    cofre.dominios.forEach(function (d) { porNome[d.dominio] = d; });
    var nomes = Object.keys(porNome).concat(daConta.filter(function (n) { return !porNome[n]; }))
      .sort(function (a, b) { return a.localeCompare(b); });
    if (!nomes.length) {
      alvo.innerHTML = '<p class="g-vazio">Nenhum domínio. Use "Testar conexão" para ler os da conta.</p>';
      return;
    }
    // Situação em texto curto com ícone (sem selo): a linha do domínio cabe em duas linhas finas.
    var selo = function (classe, icone, texto, dica) {
      return '<span class="g-hg__dom-info ' + classe + '"' + (dica ? ' title="' + u.esc(dica) + '"' : '') + '><i class="' + icone + '" aria-hidden="true"></i>' + texto + '</span>';
    };
    alvo.innerHTML = '<ul class="g-hg__dom-lista" role="list">' + nomes.map(function (n) {
      var d = porNome[n];
      var naConta = daConta.indexOf(n) >= 0;
      var hg = !conhecida ? '' : naConta ? selo('g-hg__selo-ok', 'ri-cloud-line', 'Na conta')
        : selo('g-hg__selo-aviso', 'ri-cloud-off-line', 'Não está na conta', 'O teste de conexão não encontrou este domínio na HostGator');
      var noCofre = d ? (d.ativo ? '' : selo('g-hg__selo-neutro', 'ri-safe-2-line', 'Inativo no cofre'))
        : selo('g-hg__selo-aviso', 'ri-error-warning-line', 'Não está no cofre');
      var acao;
      if (!d) {
        acao = '<button type="button" class="g-btn g-btn--fantasma g-btn--p" data-hg-cadastrar="' + u.esc(n) + '">' +
          '<i class="ri-add-line" aria-hidden="true"></i> Cadastrar</button>';
      } else {
        // Domínio que não existe na conta só pode ser desligado (chamaria a API à toa).
        var bloqueado = conhecida && !naConta && !d.hostgator;
        acao = '<label class="g-interruptor" title="' + (bloqueado ? 'Não está na conta HostGator' : 'Gerenciado pela HostGator') + '">' +
          '<input type="checkbox" data-hg-dominio="' + u.esc(n) + '"' + (d.hostgator ? ' checked' : '') + (bloqueado ? ' disabled' : '') +
          ' aria-label="Gerenciar ' + u.esc(n) + ' pela HostGator"><span></span></label>';
      }
      return '<li class="g-hg__dom' + (d && d.hostgator ? ' g-hg__dom--ativo' : '') + '">' +
        '<div class="g-hg__dom-topo"><span class="g-hg__dominio-nome"><i class="ri-at-line" aria-hidden="true"></i>' + u.esc(n) + '</span>' + acao + '</div>' +
        '<div class="g-hg__dom-selos">' + hg + noCofre +
          (d ? '<span class="g-hg__dom-info">' + u.esc(u.plural(Number(d.qtdAcessos || 0), 'e-mail', 'e-mails')) + '</span>' : '') +
          (d && d.hostgator ? '<span class="g-hg__dom-info g-hg__dom-gerenciado"><i class="ri-checkbox-circle-line" aria-hidden="true"></i>gerenciado</span>' : '') +
        '</div></li>';
    }).join('') + '</ul>' +
      (!conhecida ? '<p class="g-dica"><i class="ri-information-line" aria-hidden="true"></i> Use "Testar conexão" para trazer os domínios da conta.</p>' : '');
  }

  function cadastrarDominio(botao) {
    var nome = botao.dataset.hgCadastrar;
    CtiApp.ocupado(botao, CtiApp.dados.salvarDominio({ dominio: nome, versao: null })).then(function () {
      CtiApp.sucesso('Domínio ' + nome + ' cadastrado no cofre. Ligue "Gerenciar" para a integração usá-lo.');
      return CtiApp.recarregar(['cofre']);
    }, function (e) { CtiApp.falhaAoGravar(e, 'O domínio não foi cadastrado: '); }).then(function () {
      if (visivel()) { pintarDominios(); pintarSituacao(); }
    });
  }

  function ligarEventos(podeConfigurar) {
    if (!podeConfigurar) { return; }
    // Conexão, Padrões e domínios gravam pelo rodapé fixo das Configurações.
    var marcar = function (e) {
      if (!e.target.closest('[data-hg-campos]')) { return; }
      CtiConfig.registrarAlteracao('hostgator', { nome: 'Alterar a configuração da HostGator', salvar: salvar, aviso: avisoLigar });
    };
    u.el('hg-cfg').addEventListener('input', marcar);
    u.el('hg-cfg').addEventListener('change', marcar);
    // Domínios e tipos de equipamento vêm da carga do cofre: sem ela, carrega e redesenha a aba.
    // Uma tentativa só: se a carga falhar, o próprio recarregar já mostrou o erro.
    if (!CtiApp.estado.carregou.cofre && !pediuCofre) {
      pediuCofre = true;
      CtiApp.recarregar(['cofre', 'cofre!']).then(function () {
        if (visivel() && CtiApp.estado.carregou.cofre) { montar(alvoAtual); }
      });
    }
    pintarDominios();
    u.el('hg-dominios').addEventListener('change', function (e) {
      var x = e.target.closest('[data-hg-dominio]');
      if (x) { alternarDominio(x); }
    });
    u.el('hg-dominios').addEventListener('click', function (e) {
      var b = e.target.closest('[data-hg-cadastrar]');
      if (b) { cadastrarDominio(b); }
    });
  }

  function salvar() {
    var c = painel.config;
    var ligar = u.el('hg-ativo').checked;
    var dto = {
      ativo: ligar,
      host: u.el('hg-host').value.trim(),
      porta: Number(u.el('hg-porta').value) || null,
      usuario: u.el('hg-usuario').value.trim(),
      token: u.el('hg-token').value.trim() || null,
      timeout: Number(u.el('hg-timeout').value) || null,
      destStarlink: u.el('hg-dest-starlink').value.trim(),
      cotaMb: Number(u.el('hg-cota').value) || 0,
      boasVindas: u.el('hg-boasvindas').checked,
      equipRedir: u.el('hg-equip').value || null,
      versao: c.versao === undefined ? null : c.versao
    };
    // A fila ainda pode precisar do painel; a próxima pintura relê os dados após concluir ou descartar as pendências.
    return CtiApp.dados.salvarHostGator(dto).then(function () { painelDesatualizado = true; return true; });
  }

  /**
   * Ligar a integração e gerenciar domínio passam a mexer na HostGator: o rodapé
   * junta tudo numa confirmação só, um tópico por mudança.
   */
  function avisoHostGator(topico) {
    return {
      titulo: 'Passar a usar a HostGator?',
      mensagem: 'Criar, trocar a senha, redirecionar e excluir e-mails no cofre também fará o mesmo na HostGator.',
      topico: topico
    };
  }

  function avisoLigar() {
    return u.el('hg-ativo').checked && !painel.config.ativo ? avisoHostGator('Ligar a integração') : null;
  }

  /** Gerenciar o domínio fica pendente (rodapé fixo); ligar entra na confirmação única do rodapé. */
  function alternarDominio(caixa) {
    var d = u.porId(CtiApp.estado.cofre.dominios, 'dominio', caixa.dataset.hgDominio);
    CtiConfig.interruptorPendente(caixa, 'hg-dominio:' + d.dominio, {
      ligar: 'Gerenciar o domínio ' + d.dominio + ' pela HostGator', desligar: 'Parar de gerenciar o domínio ' + d.dominio + ' pela HostGator'
    }, function () {
      return CtiApp.dados.salvarDominio({ dominio: d.dominio, ativo: d.ativo, hostgator: caixa.checked, versao: d.versao })
        .then(function () { painelDesatualizado = true; return true; });
    }, function () {
      return caixa.checked ? avisoHostGator('Gerenciar @' + d.dominio) : null;
    });
  }

  function testar() {
    CtiApp.ocupado(u.el('hg-testar'), CtiApp.esperar('Testando a conexão com a HostGator…', CtiApp.dados.testarHostGator(),
      'Só leitura: lista os domínios de e-mail da conta.')).then(function (r) {
      teste = r;
      if (r.ok) { CtiApp.sucesso('Conexão OK: resposta em ' + Number(r.duracaoMs) + ' ms.'); }
      else { CtiApp.abrirErro('A HostGator não respondeu ao teste', r.mensagem); }
      carregar(true);
      var det = alvoAtual && alvoAtual.querySelector('.g-hg__config');
      if (det) { det.open = true; }
      pintarDominios();
    }, function (e) { CtiApp.falhaAoGravar(e, 'Não foi possível testar: '); });
  }

  // ======================================================== conferência

  var GRUPOS = [
    { chave: 'destinos', acao: 'DESTINOS', curto: 'Registrar', titulo: 'Registrar redirecionamentos no cofre', icone: 'ri-share-forward-line',
      nota: 'O cofre não tem os mesmos destinos que a HostGator. Aplicar copia os destinos de lá para o cofre; nada muda na HostGator.' },
    { chave: 'converter', acao: 'CONVERTER', curto: 'Converter', titulo: 'Converter caixa em redirecionamento', icone: 'ri-exchange-line', perigo: true,
      nota: 'Caixas que só servem para repassar mensagens. Aplicar apaga a caixa na HostGator (com as mensagens guardadas) e mantém o redirecionamento.' },
    { chave: 'soHostGator', acao: 'VINCULAR', curto: 'Vincular', titulo: 'Vincular ao cofre', icone: 'ri-links-line',
      nota: 'Existem na HostGator e não no cofre. Confira quem fica com cada e-mail (sugerido pela folha), troque ou marque como conta genérica. ' +
        'Entram sem senha (o cPanel não devolve a senha); nada muda na HostGator.' },
    { chave: 'soCofre', curto: 'Só no cofre', titulo: 'Só no cofre', icone: 'ri-database-2-line', nota: 'Estão no cofre e não existem na HostGator. Só para conferência.' },
    { chave: 'divergentes', curto: 'Divergentes', titulo: 'Divergentes', icone: 'ri-error-warning-line', nota: 'Cofre e HostGator discordam e a conferência não corrige sozinha. Só para conferência.' }
  ];

  function conferir() {
    CtiApp.ocupado(u.el('hg-conferir'), CtiApp.esperar('Lendo caixas e redirecionamentos na HostGator…', CtiApp.dados.conferirHostGator(),
      'Só leitura. Pode levar alguns segundos.')).then(abrirConferencia,
      function (e) { CtiApp.falhaAoGravar(e, 'Não foi possível conferir: '); });
  }

  /** Endereços inteiros (sem quebrar no meio), separados por vírgula. */
  function destinosHtml(l) {
    return l.map(function (d) { return '<span class="g-hg__end">' + u.esc(d) + '</span>'; }).join(', ');
  }

  function selo(icone, texto, extra) {
    return '<span class="g-selo' + (extra || '') + '"><i class="' + icone + '" aria-hidden="true"></i>' + u.esc(texto) + '</span>';
  }

  /** Cofre: equipamento e destinos gravados. */
  function noCofreHtml(x) {
    if (!x.idAcesso) { return '<span class="g-cofre__nada">não cadastrado</span>'; }
    var d = x.destinosCofre || [];
    return (x.equipamento ? u.esc(x.equipamento) + ' · ' : '') +
      (d.length ? 'redireciona para ' + destinosHtml(d) : 'sem redirecionamento') + (x.ativo === false ? ' · desativado' : '');
  }

  /** HostGator: caixa e redirecionamento são coisas separadas lá (e-mails antigos têm as duas). */
  function naHostGatorHtml(x) {
    var d = x.destinosHostGator || [];
    var partes = [];
    if (x.caixa) { partes.push(selo('ri-inbox-line', 'Caixa')); }
    if (d.length) { partes.push(selo('ri-share-forward-line', 'Redirecionamento') + ' para ' + destinosHtml(d)); }
    return partes.join(' <span class="g-hg__mais">+</span> ') || '<span class="g-cofre__nada">não existe</span>';
  }

  /** O que o "Aplicar" faz com o item; nos grupos informativos, a situação. */
  function aoAplicarHtml(g, x, equipRedir) {
    var equip = x.mudaEquipamento ? ' O equipamento passa a ' + (equipRedir ? u.esc(equipRedir) : '<strong>(configure em Padrões)</strong>') + '.' : '';
    if (g.acao === 'DESTINOS') { return 'Grava no cofre os destinos da HostGator.' + equip; }
    if (g.acao === 'CONVERTER') {
      return '<span class="g-hg__perigo"><i class="ri-error-warning-line" aria-hidden="true"></i>Apaga a caixa e as mensagens na HostGator; fica só o redirecionamento.</span>' + equip;
    }
    if (g.acao === 'VINCULAR') {
      return 'Entra no cofre como ' + (x.caixa ? 'caixa' : 'redirecionamento') + ', sem senha.' +
        (x.caixa && (x.destinosHostGator || []).length ? ' O redirecionamento continua na HostGator.' : '');
    }
    return u.esc(x.observacao || '');
  }

  function abrirConferencia(r) {
    var comItens = GRUPOS.filter(function (g) { return (r[g.chave] || []).length; });
    var soLa = r.soHostGator || [];
    // Quem fica com cada e-mail só na HostGator: a sugestão certa já vem escolhida.
    var donos = soLa.map(function (x) {
      return x.sugestaoAutomatica && x.sugeridos && x.sugeridos.length ? { func: x.sugeridos[0] } : {};
    });
    var tiposEmail = ((CtiApp.estado.cofre && CtiApp.estado.cofre.tiposAcesso) || []).filter(function (t) { return t.ativo && t.modelo === 'E'; });
    var resolvido = function (i) { var d = donos[i]; return !!(d.func || (d.generica && (d.nome || '').trim())); };
    // Abre no primeiro grupo que dá para aplicar; sem nenhum, no primeiro com itens.
    var abaInicial = (comItens.filter(function (g) { return g.acao; })[0] || comItens[0] || {}).chave;

    function celulaDono(i) {
      var x = soLa[i];
      var d = donos[i];
      var sugeridos = x.sugeridos || [];
      var valor = d.func ? 'f' + sugeridos.indexOf(d.func) : d.generica ? 'g' : d.buscando ? 'b' : '';
      var opcao = function (v, texto) { return '<option value="' + v + '"' + (v === valor ? ' selected' : '') + '>' + u.esc(texto) + '</option>'; };
      var automatica = x.sugestaoAutomatica && d.func && d.func === sugeridos[0];
      var nota = d.func ? (automatica ? x.motivoSugestao : 'Escolhido por você.')
        : d.generica ? 'Sem funcionário: o nome identifica de quem é (setor, serviço).' : (x.motivoSugestao || 'Escolha quem fica com o e-mail.');
      var dados = d.func ? [d.func.cargo, d.func.departamento, d.func.nomeEmpresa].filter(Boolean).join(' · ') : '';
      return '<span class="g-hg__rotulo">Fica com</span>' +
        '<select data-hg-dono="' + i + '" aria-label="Quem fica com ' + u.esc(x.email) + '">' +
          opcao('', sugeridos.length ? 'Escolha o funcionário…' : 'Sem sugestão: escolha…') +
          sugeridos.map(function (f, k) { return opcao('f' + k, f.nomeFunc + ' (' + f.codEmp + '/' + f.codFunc + ')'); }).join('') +
          opcao('g', 'Conta genérica (sem funcionário)') +
          opcao('b', 'Buscar outro funcionário…') +
        '</select>' +
        (d.generica ? '<input type="text" data-hg-nome="' + i + '" maxlength="100" value="' + u.esc(d.nome || '') + '" placeholder="Nome da conta (ex.: Compras)" aria-label="Nome da conta genérica">' : '') +
        (d.buscando ? '<div class="g-hg__dono-busca"><input type="search" data-hg-busca="' + i + '" placeholder="Nome ou código do funcionário" autocomplete="off" aria-label="Buscar funcionário">' +
          '<div class="g-hg__achados" data-hg-achados="' + i + '" hidden></div></div>' : '') +
        '<small class="g-hg__dono-nota' + (automatica ? ' g-hg__dono-nota--ok' : !d.func && !d.generica ? ' g-hg__dono-nota--pendente' : '') + '">' +
          (automatica ? '<i class="ri-checkbox-circle-line" aria-hidden="true"></i>' : !d.func && !d.generica ? '<i class="ri-user-search-line" aria-hidden="true"></i>' : '') +
          '<span>' + u.esc(nota) + (dados ? '<span class="g-hg__dono-dados">' + u.esc(dados) + '</span>' : '') + '</span></small>';
    }

    function repintarDono(i) {
      var modal = u.el('g-modal-corpo');
      modal.querySelector('[data-hg-dono-area="' + i + '"]').innerHTML = celulaDono(i);
      var caixa = modal.querySelector('[data-hg-item="soHostGator:' + i + '"]');
      caixa.disabled = !resolvido(i) || !tiposEmail.length;
      if (caixa.disabled) { caixa.checked = false; }
    }

    function linha(g, x, i) {
      var vincular = g.acao === 'VINCULAR';
      var marca = g.acao
        ? '<input type="checkbox" data-hg-item="' + g.chave + ':' + i + '"' + (vincular && !(resolvido(i) && tiposEmail.length) ? ' disabled' : '') +
          ' aria-label="Aplicar em ' + u.esc(x.email) + '">'
        : '';
      return '<li class="g-hg__item' + (vincular ? ' g-hg__item--dono' : '') + (g.acao ? '' : ' g-hg__item--info') + '">' +
        (g.acao ? '<span class="g-hg__marca">' + marca + '</span>' : '') +
        '<div class="g-hg__corpo">' +
          '<div class="g-hg__cab"><strong class="g-hg__email">' + u.esc(x.email) + '</strong>' +
            (x.nomeFunc ? '<span class="g-hg__func"><i class="ri-user-line" aria-hidden="true"></i>' + u.esc(x.nomeFunc) + '</span>' : '') + '</div>' +
          '<dl class="g-hg__fatos">' +
            (vincular ? '' : '<dt>Cofre</dt><dd>' + noCofreHtml(x) + '</dd>') +
            '<dt>HostGator</dt><dd>' + naHostGatorHtml(x) + '</dd>' +
            // "Só no cofre" já diz tudo na linha da HostGator ("não existe").
            (g.chave === 'soCofre' ? '' : '<dt>' + (g.acao ? 'Ao aplicar' : 'Situação') + '</dt><dd>' + aoAplicarHtml(g, x, r.equipRedir) + '</dd>') +
          '</dl>' +
        '</div>' +
        (vincular ? '<div class="g-hg__dono" data-hg-dono-area="' + i + '">' + celulaDono(i) + '</div>' : '') +
      '</li>';
    }

    function painel(g) {
      var itens = r[g.chave];
      var tipo = g.acao !== 'VINCULAR' ? ''
        : !tiposEmail.length
          ? '<p class="g-dica g-hg__aviso"><i class="ri-error-warning-line" aria-hidden="true"></i> Nenhum tipo de conta de e-mail ativo: cadastre um em Configurações › Cofre para vincular.</p>'
          : tiposEmail.length > 1
            ? '<label class="g-campo g-campo--inline g-hg__tipo"><span>Tipo de conta</span><select id="hg-conf-tipo">' +
              tiposEmail.map(function (t) { return '<option value="' + u.esc(t.codigo) + '">' + u.esc(t.nome) + '</option>'; }).join('') + '</select></label>'
            : '';
      return '<section class="g-hg__painel" role="tabpanel" id="hg-painel-' + g.chave + '" data-hg-painel="' + g.chave + '"' + (g.chave === abaInicial ? '' : ' hidden') + '>' +
        '<div class="g-hg__painel-cab"><p class="g-dica">' + u.esc(g.nota) + '</p>' +
          (g.acao ? '<label class="g-hg__todos"><input type="checkbox" data-hg-todos="' + g.chave + '"> marcar todos</label>' : '') + '</div>' +
        tipo +
        '<ul class="g-hg__lista">' + itens.map(function (x, i) { return linha(g, x, i); }).join('') + '</ul></section>';
    }

    var corpo = '<div class="g-hg__conf">' +
      (comItens.length
        ? '<div class="g-hg__abas" role="tablist" aria-label="Grupos da conferência">' + comItens.map(function (g) {
            var ativa = g.chave === abaInicial;
            return '<button type="button" role="tab" class="g-hg__aba' + (g.perigo ? ' g-hg__aba--perigo' : '') + '" data-hg-aba="' + g.chave + '"' +
              ' aria-selected="' + ativa + '" aria-controls="hg-painel-' + g.chave + '" title="' + u.esc(g.titulo) + '">' +
              '<i class="' + g.icone + '" aria-hidden="true"></i>' + u.esc(g.curto) +
              '<span class="g-hg__aba-qtd">' + r[g.chave].length + '</span></button>';
          }).join('') + '</div>' +
          '<p class="g-dica g-hg__simulacao"><i class="ri-information-line" aria-hidden="true"></i> Simulação: nada foi gravado. Só os itens marcados são aplicados.</p>' +
          comItens.map(painel).join('')
        : '<p class="g-vazio"><i class="ri-checkbox-circle-line" aria-hidden="true"></i>Cofre e HostGator estão iguais nos domínios gerenciados.</p>') +
      '</div>';
    CtiApp.abrirModal({
      titulo: 'Conferir com a HostGator', tamanho: 'largo', corpo: corpo,
      rodape: '<button type="button" class="g-btn g-btn--cancelar" id="hg-conf-fechar">Fechar</button>' +
        '<button type="button" class="g-btn g-btn--primario" id="hg-conf-aplicar" disabled><i class="ri-check-double-line" aria-hidden="true"></i> Aplicar selecionados</button>'
    });
    var modal = u.el('g-modal-corpo');
    function marcados() {
      return Array.prototype.filter.call(modal.querySelectorAll('[data-hg-item]'), function (c) { return c.checked; }).map(function (c) {
        var p = c.dataset.hgItem.split(':');
        var g = GRUPOS.filter(function (x) { return x.chave === p[0]; })[0];
        return { grupo: g, item: r[p[0]][Number(p[1])] };
      });
    }
    function atualizarBotao() {
      var n = marcados().length;
      var b = u.el('hg-conf-aplicar');
      b.disabled = !n;
      b.innerHTML = '<i class="ri-check-double-line" aria-hidden="true"></i> ' + (n ? 'Aplicar ' + n + (n === 1 ? ' item' : ' itens') : 'Aplicar selecionados');
    }
    modal.addEventListener('change', function (e) {
      var todos = e.target.closest('[data-hg-todos]');
      if (todos) {
        // Sem dono escolhido o e-mail não entra: "marcar todos" pula os desabilitados.
        u.cada(modal, '[data-hg-item^="' + todos.dataset.hgTodos + ':"]', function (c) { c.checked = todos.checked && !c.disabled; });
      }
      var sel = e.target.closest('[data-hg-dono]');
      if (sel) {
        var i = Number(sel.dataset.hgDono);
        var v = sel.value;
        var x = soLa[i];
        donos[i] = v.charAt(0) === 'f' ? { func: x.sugeridos[Number(v.slice(1))] }
          : v === 'g' ? { generica: true, nome: donos[i].nome || x.email.split('@')[0] }
          : v === 'b' ? { buscando: true } : {};
        repintarDono(i);
        if (v === 'b') { modal.querySelector('[data-hg-busca="' + i + '"]').focus(); }
      }
      atualizarBotao();
    });
    var esperaBusca = null;
    modal.addEventListener('input', function (e) {
      var nome = e.target.closest('[data-hg-nome]');
      if (nome) {
        var n = Number(nome.dataset.hgNome);
        donos[n].nome = nome.value;
        var caixa = modal.querySelector('[data-hg-item="soHostGator:' + n + '"]');
        caixa.disabled = !resolvido(n) || !tiposEmail.length;
        if (caixa.disabled) { caixa.checked = false; }
        atualizarBotao();
        return;
      }
      var busca = e.target.closest('[data-hg-busca]');
      if (!busca) { return; }
      var i = Number(busca.dataset.hgBusca);
      var alvo = modal.querySelector('[data-hg-achados="' + i + '"]');
      var termo = busca.value.trim();
      clearTimeout(esperaBusca);
      if (termo.length < 2) { alvo.hidden = true; alvo.innerHTML = ''; return; }
      esperaBusca = setTimeout(function () {
        CtiApp.dados.buscarFuncionarios(termo).then(function (lista) {
          if (busca.value.trim() !== termo) { return; }
          alvo.innerHTML = lista.length ? lista.map(function (f, k) {
            return '<button type="button" class="g-hg__achado" data-hg-achado="' + i + ':' + k + '"><strong>' + u.esc(f.nomeFunc) + '</strong>' +
              '<small>' + Number(f.codEmp) + '/' + Number(f.codFunc) + ' · ' + u.esc([f.cargo, f.nomeEmpresa].filter(Boolean).join(' · ')) + '</small></button>';
          }).join('') : '<p class="g-dica">Nenhum funcionário ativo encontrado.</p>';
          alvo.hidden = false;
          alvo.achados = lista;
        }, function (erro) { alvo.innerHTML = '<p class="g-dica">' + u.esc(CtiApi.textoDoErro(erro)) + '</p>'; alvo.hidden = false; });
      }, 300);
    });
    modal.addEventListener('click', function (e) {
      var aba = e.target.closest('[data-hg-aba]');
      if (aba) {
        // Trocar de aba não desmarca nada: o "Aplicar" leva o que estiver marcado em todas.
        u.cada(modal, '[data-hg-aba]', function (b) { b.setAttribute('aria-selected', String(b === aba)); });
        u.cada(modal, '[data-hg-painel]', function (p) { p.hidden = p.dataset.hgPainel !== aba.dataset.hgAba; });
        return;
      }
      var achado = e.target.closest('[data-hg-achado]');
      if (!achado) { return; }
      var p = achado.dataset.hgAchado.split(':');
      var i = Number(p[0]);
      var f = achado.parentNode.achados[Number(p[1])];
      var x = soLa[i];
      x.sugeridos = x.sugeridos || [];
      var ja = x.sugeridos.filter(function (s) { return s.codEmp === f.codEmp && s.codFunc === f.codFunc; })[0];
      if (!ja) { x.sugeridos.push(f); }
      donos[i] = { func: ja || f };
      repintarDono(i);
      atualizarBotao();
    });
    u.el('hg-conf-fechar').addEventListener('click', function () { CtiApp.fecharModal(true); });
    u.el('hg-conf-aplicar').addEventListener('click', function () {
      var lista = marcados();
      var caixas = lista.filter(function (x) { return x.grupo.acao === 'CONVERTER'; }).length;
      var vinculos = lista.filter(function (x) { return x.grupo.acao === 'VINCULAR'; }).length;
      var codTipo = u.el('hg-conf-tipo') ? u.el('hg-conf-tipo').value : (tiposEmail[0] || {}).codigo;
      CtiApp.confirmar({
        titulo: 'Aplicar ' + lista.length + (lista.length === 1 ? ' item?' : ' itens?'),
        mensagem: (caixas ? u.plural(caixas, 'caixa será apagada', 'caixas serão apagadas') + ' na HostGator, com as mensagens guardadas (não volta). ' : '') +
          (vinculos ? u.plural(vinculos, 'e-mail entra', 'e-mails entram') + ' no cofre sem senha, sem mudar nada na HostGator. ' : '') +
          'Cada item é tratado separadamente; o que falhar fica como está e aparece no resumo.',
        botao: 'Aplicar', perigo: caixas > 0, botaoExecutando: 'Aplicando…', contextoErro: 'A conferência não foi aplicada',
        carregando: 'Aplicando ' + lista.length + (lista.length === 1 ? ' item' : ' itens') + ' na HostGator e no cofre…',
        executar: function () {
          return CtiApp.dados.aplicarConferenciaHostGator({ codTipo: vinculos ? codTipo : null, itens: lista.map(function (x) {
            if (x.grupo.acao !== 'VINCULAR') { return { idAcesso: x.item.idAcesso, versao: x.item.versao, acao: x.grupo.acao }; }
            var d = donos[soLa.indexOf(x.item)];
            return { acao: 'VINCULAR', email: x.item.email, codEmp: d.func ? d.func.codEmp : null, codFunc: d.func ? d.func.codFunc : null,
              generica: !d.func, nomeConta: d.func ? null : (d.nome || '').trim() };
          }) });
        },
        sucesso: function (res) { return res.erros.length ? null : u.plural(res.qtd, 'item aplicado', 'itens aplicados') + '.'; }
      }).then(function (r) {
        if (!r || !r.feito) { return; }
        CtiApp.fecharModal(true);
        if (r.resultado.erros.length) {
          CtiApp.resumoLote({ titulo: 'Alguns itens não foram aplicados', feito: r.resultado.qtd === 1 ? 'item aplicado' : 'itens aplicados', resultado: r.resultado });
        }
        CtiApp.recarregar(['cofre']);
        carregar(true);
      });
    });
  }

  return {
    pintar: pintar,
    atualizar: atualizar
  };
})();
