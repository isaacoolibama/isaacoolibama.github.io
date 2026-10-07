/**
 * Cofre de acessos: e-mails, pasta pública/Terminal Service, Starlinks e
 * senhas diversas.
 *
 * A lista chega sem senha. Ver ou copiar chama revelarSenha, que confere o
 * grupo no servidor e registra no log quem viu. A senha revelada fica só no
 * DOM por alguns segundos, nunca em CtiApp.estado.
 */
var CtiCofre = (function () {
  'use strict';

  var u = CtiUtil;

  /**
   * Modelos de tipo de conta (CTI_TIPOACESSO.MODELO): definem campos, colunas,
   * ícone e cor. Os tipos em si são cadastro (Configurações › Cofre).
   */
  var MODELOS = {
    E: { rotulo: 'Caixa de e-mail', unidade: ['e-mail', 'e-mails'], icone: 'ri-mail-line', cor: '#3A7BEA',
      nota: 'e-mail com domínio cadastrado, funcionário da folha (ou conta genérica), senha e equipamento. Avisa quando o funcionário sai' },
    T: { rotulo: 'Usuário de rede e pasta', unidade: ['usuário', 'usuários'], icone: 'ri-folder-shared-line', cor: '#8B5CF6',
      nota: 'usuário de rede/Terminal Service, funcionário, senha, pasta pública e horário de acesso' },
    S: { rotulo: 'Aparelho com conta', unidade: ['aparelho', 'aparelhos'], icone: 'ti-satellite', cor: '#0EA5E9',
      nota: 'aparelho com login próprio (ex.: Starlink): departamento ou dono, responsável, e-mail de acesso, senha, modelo e dia de ativação' },
    O: { rotulo: 'Site ou sistema', unidade: ['acesso', 'acessos'], icone: 'ri-key-2-line', cor: '#64748B',
      nota: 'qualquer site ou serviço: nome, login, senha, endereço e observação. Serve para a maioria dos tipos novos (VPN, Wi-Fi, portais)' }
  };
  var ALERTAS = {
    DEMITIDO: { rotulo: 'Demitido', cor: '#DC4C4C', icone: 'ri-user-unfollow-line' },
    TRANSFERIDO: { rotulo: 'Transferido', cor: '#B7750C', icone: 'ri-arrow-left-right-line' },
    NAO_ENCONTRADO: { rotulo: 'Fora da folha', cor: '#B7750C', icone: 'ri-question-line' },
    // Demitido com o desligamento marcado para os próximos dias: ainda trabalha (mesmo selo do sino).
    AGENDADO: { rotulo: 'Agendado', cor: '#64748B', icone: 'ri-calendar-event-line' }
  };
  /** Tempo que a senha revelada fica visível na lista. */
  var SEGUNDOS_VISIVEL = 20;
  var MASCARA = '••••••••';
  /** Paleta do pincel (Listas.CORES_MARCA no servidor); a cor vem de token do CSS (.g-cofre__marca--*). */
  var PALETA = [['AMARELO', 'Amarelo'], ['VERDE', 'Verde'], ['AZUL', 'Azul'], ['VERMELHO', 'Vermelho'],
    ['ROXO', 'Roxo'], ['LARANJA', 'Laranja'], ['CINZA', 'Cinza']];
  var VAZIO = '(Vazias)';
  /**
   * Categoria do equipamento (Listas.CATEGORIAS_EQUIPAMENTO) e a cor padrão
   * dela, usada quando o SUP não escolheu cor no cadastro (CTI_TIPOEQUIP.COR).
   */
  var CATEGORIAS_EQUIP = {
    E: { rotulo: 'Corporativo', cor: '#3A7BEA' },
    P: { rotulo: 'Pessoal', cor: '#F97316' },
    C: { rotulo: 'Compartilhado', cor: '#42BE65' },
    R: { rotulo: 'Redirecionamento', cor: '#8B5CF6' },
    O: { rotulo: 'Outro', cor: '#64748B' }
  };
  var ICONE_EQUIP = 'ri-device-line';

  /** Código do tipo de conta aberto na grade, ou 'P' (pendências). */
  var aba = null;
  /** 'painel' (KPIs) ou 'grade' (lista do tipo escolhido, quase em tela cheia). */
  var modo = 'painel';
  /** Ordenação da grade: índice da coluna e direção (1 ou -1). */
  var ordem = { coluna: null, direcao: 1 };
  /** Filtro de coluna no jeito do Excel: índice -> valores marcados (texto de exibição). Sem chave = sem filtro. */
  var filtrosCol = {};
  /**
   * Linhas selecionadas (id em texto -> true), como no Excel: clique marca uma,
   * Ctrl alterna, Shift estende a partir da âncora (último clique sem Shift).
   */
  var selecionadas = {};
  var ancora = null;
  /** Filtro rápido dos e-mails: domínio escolhido (null = todos) e só contas genéricas. */
  var dominioSel = null;
  var soGenericas = false;
  /** Filtro rápido: só caixas em férias (redirecionadas aos colegas). */
  var soFerias = false;
  var busca = '';
  var timers = {};

  function estadoCofre() { return CtiApp.estado.cofre; }

  function iniciar() {
    CtiApp.aoMudar(function (parte) {
      if (parte === 'visao' && CtiApp.visao() === 'cofre') {
        // Voltar ao cofre sempre abre o painel, não a grade de onde saiu.
        modo = 'painel';
        fecharPopover();
      }
      if (parte === 'cofre' || (parte === 'visao' && CtiApp.visao() === 'cofre')) { pintar(); }
    });
    var raiz = u.el('visao-cofre');
    u.el('cr-novo').addEventListener('click', function () {
      var t = tipoConta(aba);
      var primeiro = tiposConta().filter(function (x) { return x.ativo; })[0];
      formulario(null, t && t.ativo ? aba : (primeiro || {}).codigo);
    });
    u.el('cr-abas').addEventListener('click', function (e) {
      var b = e.target.closest('[data-aba-cofre]');
      if (b) { abrirGrade(b.dataset.abaCofre); }
    });
    u.el('cr-voltar').addEventListener('click', function () {
      modo = 'painel';
      fecharPopover();
      pintar();
    });
    u.el('cr-lista').addEventListener('click', function (e) {
      var funil = e.target.closest('[data-filtro-abrir]');
      if (funil) { abrirFiltro(Number(funil.dataset.filtroAbrir), funil); return; }
      var pincel = e.target.closest('[data-marcar]');
      if (pincel) { abrirPaleta(Number(pincel.dataset.marcar), pincel); return; }
      var tr = e.target.closest('tr[data-linha]');
      if (tr && !e.target.closest('button, a, input, code')) { selecionar(tr.dataset.linha, e); }
    });
    // Shift/Ctrl + clique seleciona linhas, não o texto delas.
    u.el('cr-lista').addEventListener('mousedown', function (e) {
      if ((e.shiftKey || e.ctrlKey || e.metaKey) && e.target.closest('tr[data-linha]') && !e.target.closest('button, a, input')) {
        e.preventDefault();
      }
    });
    u.el('cr-atalhos').addEventListener('click', function (e) {
      var b = e.target.closest('[data-atalho-dominio], [data-atalho-genericas], [data-atalho-ferias]');
      if (!b) { return; }
      if (b.dataset.atalhoGenericas !== undefined) { soGenericas = !soGenericas; }
      else if (b.dataset.atalhoFerias !== undefined) { soFerias = !soFerias; }
      else { dominioSel = b.dataset.atalhoDominio || null; }
      pintarLista();
    });
    u.el('cr-excluir-sel').addEventListener('click', excluirSelecionadas);
    u.el('cr-exportar').addEventListener('click', exportarEmails);
    u.el('cr-limpar-filtros').addEventListener('click', function () {
      filtrosCol = {};
      dominioSel = null;
      soGenericas = false;
      soFerias = false;
      busca = '';
      u.el('cr-busca').value = '';
      pintarLista();
    });
    u.el('cr-busca').addEventListener('input', function (e) {
      busca = e.target.value;
      pintarLista();
    });
    raiz.addEventListener('click', function (e) {
      var alvo = e.target.closest('[data-ver], [data-copiar], [data-copiar-login], [data-editar-acesso], [data-excluir-acesso], [data-ir-pendencias], [data-trocar-registro]');
      if (!alvo) { return; }
      if (alvo.dataset.trocarRegistro) {
        var t = acesso(Number(alvo.dataset.trocarRegistro));
        formulario(t, null, { codEmp: t.novoCodEmp, codFunc: t.novoCodFunc, nomeFunc: t.novoNomeFunc, nomeEmpresa: t.novoNomeEmpresa,
          departamento: t.novoDepartamento, cargo: t.cargo });
        return;
      }
      if (alvo.dataset.ver) { alternarSenha(Number(alvo.dataset.ver), alvo); }
      if (alvo.dataset.copiar) { copiarSenha(Number(alvo.dataset.copiar), alvo); }
      if (alvo.dataset.copiarLogin !== undefined) { copiarTexto(alvo.dataset.copiarLogin).then(function () { CtiApp.sucesso('Login copiado.'); }, falhaCopia); }
      if (alvo.dataset.editarAcesso) { formulario(acesso(Number(alvo.dataset.editarAcesso))); }
      if (alvo.dataset.excluirAcesso) { excluir(acesso(Number(alvo.dataset.excluirAcesso)), alvo); }
      if (alvo.dataset.irPendencias !== undefined) { abrirGrade('P'); }
    });
    document.addEventListener('mousedown', function (e) {
      var p = u.el('cr-popover');
      if (p && !p.hidden && !p.contains(e.target) && !e.target.closest('[data-filtro-abrir], [data-marcar]')) { fecharPopover(); }
    });
    document.addEventListener('keydown', function (e) {
      var p = u.el('cr-popover');
      if (e.key === 'Escape' && p && !p.hidden) { e.stopPropagation(); fecharPopover(); }
    }, true);
  }

  function abrirGrade(chave) {
    if (aba !== chave) {
      busca = '';
      u.el('cr-busca').value = '';
      ordem = { coluna: null, direcao: 1 };
      filtrosCol = {};
      selecionadas = {};
      ancora = null;
      soGenericas = false;
      aba = chave;
      // E-mails abrem no domínio principal (o de mais contas); os outros ficam ao lado.
      dominioSel = modeloDaAba() === 'E' ? dominioPadrao() : null;
    }
    aba = chave;
    modo = 'grade';
    pintar();
    u.el('cr-busca').focus();
    // A situação vem da TFPFUN na consulta: relê ao entrar para pegar desligamentos recentes.
    CtiApp.recarregar(['cofre']);
  }

  function tiposConta() { return (estadoCofre() && estadoCofre().tiposAcesso) || []; }
  function tipoConta(codigo) { return u.porId(tiposConta(), 'codigo', codigo); }
  function modelo(t) { return MODELOS[t && t.modelo] || MODELOS.O; }
  /** Ícone escolhido no cadastro do tipo de conta (ri-, ti- ou si-); sem ele, o do modelo. */
  function iconeTipo(t) { return u.icone(t && t.icone, modelo(t).icone); }
  /** Tipos ativos e os inativos que ainda têm acesso (inativo sem uso só aparece nas Configurações). */
  function tiposVisiveis() {
    var usados = {};
    estadoCofre().acessos.forEach(function (a) { usados[a.codTipo] = true; });
    return tiposConta().filter(function (t) { return t.ativo || usados[t.codigo]; });
  }
  function modeloDaAba() { return aba === 'P' ? 'P' : (tipoConta(aba) || {}).modelo || 'O'; }

  function acesso(id) { return u.porId(estadoCofre().acessos, 'idAcesso', id); }

  function pendencias() {
    return estadoCofre().acessos.filter(function (a) { return a.alerta; });
  }

  // ============================================================== lista

  function pintar() {
    if (CtiApp.visao() !== 'cofre') { return; }
    if (!CtiApp.estado.carregou.cofre) {
      u.el('cr-abas').innerHTML = '<p class="g-vazio"><i class="ri-safe-2-line" aria-hidden="true"></i>Carregando o cofre…</p>';
      return;
    }
    var todos = estadoCofre().acessos;
    var pend = pendencias();
    var tipos = tiposVisiveis();
    if (modo === 'grade' && aba !== 'P' && !u.porId(tipos, 'codigo', aba)) { modo = 'painel'; }
    var naGrade = modo === 'grade';
    var tipoAtual = aba === 'P' ? null : tipoConta(aba);
    u.el('cr-voltar').hidden = !naGrade;
    // Novo acesso só dentro de um tipo (na grade de pendências não há tipo para herdar).
    u.el('cr-novo').hidden = !naGrade || aba === 'P';
    u.el('cr-abas').hidden = naGrade;
    u.el('cr-grade').hidden = !naGrade;
    u.el('visao-cofre').classList.toggle('g-cofre--grade', naGrade);
    u.el('t-cofre').textContent = !naGrade ? 'Cofre de acessos' : (aba === 'P' ? 'Pendências' : tipoAtual.nome);
    u.el('cr-sub').textContent = !naGrade
      ? 'Selecione um tipo para ver e gerenciar os acessos.'
      : (aba === 'P' ? 'Acessos de funcionários que saíram da empresa e continuam ativos.'
        : 'Use o filtro de cada coluna para encontrar o que precisa.');
    u.el('cr-abas').innerHTML = tipos.map(function (t) {
      var m = modelo(t);
      var qtd = todos.filter(function (a) { return a.codTipo === t.codigo && a.ativo; }).length;
      var desativados = todos.filter(function (a) { return a.codTipo === t.codigo && !a.ativo; }).length;
      return cartao(t.codigo, t.nome, iconeTipo(t), m.cor, qtd, !t.ativo ? 'tipo desativado'
        : (qtd === 1 ? 'ativo' : 'ativos') + (desativados ? ' · ' + desativados + ' desativado' + (desativados > 1 ? 's' : '') : ''));
    }).join('') || '<p class="g-vazio"><i class="ri-safe-2-line" aria-hidden="true"></i>Nenhum tipo de conta ativo. O SUP cadastra em Configurações › Cofre.</p>';
    var faixa = u.el('cr-faixa');
    // Na grade a faixa sai para a lista ganhar altura; as pendências seguem no painel.
    // Agendado ainda trabalha: fica na lista de pendências, mas não entra no aviso de quem saiu.
    var sairam = pend.filter(function (a) { return a.alerta !== 'AGENDADO'; });
    faixa.hidden = !sairam.length || naGrade;
    if (!faixa.hidden) {
      faixa.innerHTML = '<i class="ri-user-unfollow-line" aria-hidden="true"></i><span>' +
        u.plural(sairam.length, 'acesso continua ativo', 'acessos continuam ativos') + ' de quem saiu da empresa.</span>' +
        '<button type="button" class="g-btn g-btn--fantasma g-btn--p" data-ir-pendencias>Ver pendências</button>';
    }
    pintarLista();
  }

  /** KPI de um tipo de conta; clicar abre a grade dele. */
  function cartao(chave, rotulo, icone, cor, qtd, nota) {
    return '<button type="button" class="g-kpi g-cofre__kpi" data-aba-cofre="' + u.esc(chave) + '" style="--k-cor:' + u.cor(cor) + '"' +
      ' title="Abrir ' + u.esc(rotulo) + '">' +
      '<span class="g-kpi__topo">' + u.esc(rotulo) + '<span class="g-kpi__icone"><i class="' + u.icone(icone, 'ri-key-2-line') + '" aria-hidden="true"></i></span></span>' +
      '<span class="g-kpi__valor">' + Number(qtd) + '</span>' +
      '<span class="g-kpi__nota">' + u.esc(nota) + '</span></button>';
  }

  /** Acessos da grade atual antes dos filtros (tipo aberto ou pendências). */
  function daAba() {
    return estadoCofre().acessos.filter(function (a) { return aba === 'P' ? a.alerta : a.codTipo === aba; });
  }

  function passaNaBusca(a) {
    var termo = u.normal(busca.trim());
    return !termo || u.normal([a.login, a.descricao, a.nomeFunc, a.unidade, a.equipamento, a.pasta, a.responsavel,
      a.cargo, a.departamento, a.codFunc, a.codEmp, a.obs].join(' ')).indexOf(termo) >= 0;
  }

  /** Domínio do login do e-mail, em minúsculas ('' sem login). */
  function dominioDe(a) {
    var l = a.login || '';
    return l.indexOf('@') >= 0 ? l.slice(l.indexOf('@') + 1).toLowerCase() : '';
  }

  /** Domínio com mais e-mails ativos na grade aberta: é o que a grade mostra ao abrir. */
  function dominioPadrao() {
    var qtd = {};
    daAba().forEach(function (a) { if (a.ativo && dominioDe(a)) { qtd[dominioDe(a)] = (qtd[dominioDe(a)] || 0) + 1; } });
    return Object.keys(qtd).sort(function (x, y) { return qtd[y] - qtd[x] || x.localeCompare(y); })[0] || null;
  }

  function passaNosAtalhos(a) {
    if (modeloDaAba() !== 'E') { return true; }
    if (dominioSel && dominioDe(a) !== dominioSel) { return false; }
    return (!soGenericas || a.generica) && (!soFerias || a.ferias);
  }

  /** Botões de domínio (o principal primeiro), "Todos" e "Contas genéricas", com a quantidade de ativos. */
  function pintarAtalhos() {
    var caixa = u.el('cr-atalhos');
    caixa.hidden = modeloDaAba() !== 'E';
    if (caixa.hidden) {
      caixa.innerHTML = '';
      return;
    }
    var ativos = daAba().filter(function (a) { return a.ativo; });
    var porDominio = {};
    ativos.forEach(function (a) { var d = dominioDe(a); if (d) { porDominio[d] = (porDominio[d] || 0) + 1; } });
    if (dominioSel && !porDominio[dominioSel]) { porDominio[dominioSel] = 0; }
    var padrao = dominioPadrao();
    var doms = Object.keys(porDominio).sort(function (x, y) {
      return (x === padrao ? -1 : 0) - (y === padrao ? -1 : 0) || porDominio[y] - porDominio[x] || x.localeCompare(y);
    });
    var genericas = ativos.filter(function (a) { return a.generica && (!dominioSel || dominioDe(a) === dominioSel); }).length;
    var ferias = ativos.filter(function (a) { return a.ferias && (!dominioSel || dominioDe(a) === dominioSel); }).length;
    var botao = function (atributo, rotulo, titulo, qtd, ligado, icone) {
      return '<button type="button" class="g-cofre__atalho' + (ligado ? ' g-cofre__atalho--ativo' : '') + '" ' + atributo +
        ' aria-pressed="' + (ligado ? 'true' : 'false') + '" title="' + u.esc(titulo) + '">' +
        '<i class="' + icone + '" aria-hidden="true"></i>' + u.esc(rotulo) +
        '<span class="g-cofre__atalho-qtd">' + Number(qtd) + '</span></button>';
    };
    // Domínios numa faixa com rolagem própria: muitos domínios não empurram o resto da barra.
    caixa.innerHTML = '<div class="g-cofre__atalhos-dominios">' + doms.map(function (d) {
      // Rótulo curto (parte antes do primeiro ponto); o domínio inteiro fica na dica.
      return botao('data-atalho-dominio="' + u.esc(d) + '"', d.split('.')[0], 'Só e-mails @' + d, porDominio[d], dominioSel === d, 'ri-at-line');
    }).join('') + '</div>' +
      botao('data-atalho-dominio=""', 'Todos', 'Todos os domínios', ativos.length, !dominioSel, 'ri-apps-line') +
      '<span class="g-cofre__atalhos-sep" aria-hidden="true"></span>' +
      botao('data-atalho-genericas', 'Genéricas', 'Só contas genéricas (sem funcionário)', genericas, soGenericas, 'ri-team-line') +
      botao('data-atalho-ferias', 'Em férias', 'Só caixas em férias (redirecionadas aos colegas)', ferias, soFerias, 'ri-plane-line');
  }

  function pintarLista() {
    if (!CtiApp.estado.carregou.cofre || modo !== 'grade') { return; }
    fecharPopover();
    limparReveladas();
    pintarAtalhos();
    u.el('cr-exportar').hidden = modeloDaAba() !== 'E';
    var lista = daAba().filter(passaNosAtalhos).filter(passaNaBusca).filter(function (a) { return passaNosFiltros(a, null); });
    ordenar(lista);
    var ativos = lista.filter(function (a) { return a.ativo; });
    var inativos = lista.filter(function (a) { return !a.ativo; });
    var cols = colunas();
    var tabela = function (l, comFiltros) {
      return '<div class="g-tabela-rolagem"><table class="g-tabela g-cofre__tabela g-cofre__tabela--' + modeloDaAba() + '"><thead><tr>' +
        '<th class="g-cofre__marca-col" aria-label="Marca"></th>' +
        cols.map(function (c, i) {
          if (!c) { return '<th></th>'; }
          var ativo = filtrosCol[i] !== undefined;
          var seta = ordem.coluna === i ? (ordem.direcao > 0 ? '<i class="ri-arrow-up-s-line" aria-hidden="true"></i>' : '<i class="ri-arrow-down-s-line" aria-hidden="true"></i>') : '';
          var completo = { 'Emp.': 'Empresa', 'Cód.': 'Código do funcionário' }[c];
          return '<th class="g-cofre__col--' + i + '"' + (completo ? ' title="' + completo + '"' : '') + (ordem.coluna === i ? ' aria-sort="' + (ordem.direcao > 0 ? 'ascending' : 'descending') + '"' : '') + '>' +
            '<span class="g-cofre__th">' + c + seta +
            (comFiltros && c !== 'Senha'
              ? '<button type="button" class="g-cofre__funil' + (ativo ? ' g-cofre__funil--ativo' : '') + '" data-filtro-abrir="' + i + '"' +
                ' title="Filtrar e ordenar ' + u.esc(c) + '" aria-label="Filtrar e ordenar ' + u.esc(c) + '">' +
                '<i class="' + (ativo ? 'ri-filter-3-fill' : 'ri-filter-3-line') + '" aria-hidden="true"></i></button>'
              : '') + '</span></th>';
        }).join('') + '</tr></thead><tbody>' +
        (l.length ? l.map(linha).join('')
          : '<tr><td colspan="' + (cols.length + 1) + '" class="g-cofre__sem-resultado">Nenhum acesso passa nos filtros.</td></tr>') +
        '</tbody></table></div>';
    };
    var vazio = aba === 'P'
      ? '<p class="g-vazio"><i class="ri-shield-check-line" aria-hidden="true"></i>Nenhuma pendência: ninguém que saiu da empresa tem acesso ativo.</p>'
      : '<p class="g-vazio"><i class="' + iconeTipo(tipoConta(aba)) + '" aria-hidden="true"></i>Nenhum acesso cadastrado aqui ainda.</p>';
    u.el('cr-lista').innerHTML = (daAba().length ? tabela(ativos, true) : vazio) +
      (inativos.length
        ? '<details class="g-inativos"><summary class="g-inativos__cab"><i class="ri-arrow-right-s-line" aria-hidden="true"></i>Desativados' +
          '<span class="g-inativos__qtd">' + inativos.length + '</span></summary>' + tabela(inativos, false) + '</details>'
        : '');
    marcarPresenca();
    marcarSelecao();
  }

  // ============================================================ exportação

  var TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  /** Destino quando não há a janela "Salvar como": download comum do navegador. */
  var DOWNLOAD = {};

  /**
   * Planilha .xlsx dos e-mails, sem senha (a listagem nem traz senha). Com
   * linhas selecionadas, só elas, depois de confirmar a quantidade; sem
   * seleção, a grade inteira (domínio, busca e filtros de coluna, só ativos).
   */
  function exportarEmails() {
    var escolhidos = Object.keys(selecionadas).map(function (id) { return acesso(Number(id)); }).filter(Boolean);
    if (escolhidos.length) {
      ordenar(escolhidos);
      var qtd = u.plural(escolhidos.length, 'e-mail selecionado', 'e-mails selecionados');
      CtiApp.confirmar({
        titulo: 'Exportar ' + qtd + '?',
        mensagem: 'A planilha sai só com as linhas selecionadas, sem senha. Para exportar a grade inteira, limpe a seleção.',
        botao: 'Exportar'
      }).then(function (ok) { if (ok) { salvarPlanilhaEmails(escolhidos); } });
      return;
    }
    var lista = daAba().filter(passaNosAtalhos).filter(passaNaBusca)
      .filter(function (a) { return a.ativo && passaNosFiltros(a, null); });
    ordenar(lista);
    if (!lista.length) {
      CtiApp.alerta('Nenhum e-mail na grade para exportar. Confira os filtros.');
      return;
    }
    salvarPlanilhaEmails(lista);
  }

  /**
   * Pergunta onde salvar antes de carregar a SheetJS: a janela "Salvar como"
   * só abre logo depois do clique, e o carregamento pode passar desse prazo.
   */
  function salvarPlanilhaEmails(lista) {
    var hoje = new Date();
    // Data com hífen: "/" não é aceito em nome de arquivo.
    var data = ('0' + hoje.getDate()).slice(-2) + '-' + ('0' + (hoje.getMonth() + 1)).slice(-2) + '-' + hoje.getFullYear();
    var nome = 'Lista de e-mails - ' + data + '.xlsx';
    var trabalho = escolherDestino(nome).then(function (destino) {
      if (!destino) { return false; }
      return carregarSheetJS().then(function (X) {
        return gravarArquivo(destino, planilhaEmails(X, lista), nome);
      }).then(function () { return true; });
    });
    CtiApp.ocupado(u.el('cr-exportar'), trabalho).then(function (feito) {
      if (feito) { CtiApp.sucesso(u.plural(lista.length, 'e-mail exportado', 'e-mails exportados') + '.'); }
    }, function (e) {
      CtiApp.erro('Não foi possível exportar a planilha: ' + ((e && e.message) || e));
    });
  }

  /**
   * Janela "Salvar como" (File System Access API: Chrome e Edge, só em HTTPS
   * ou localhost). Sem ela, ou se o navegador recusar dentro do Om, cai no
   * download comum. Resolve null quando o usuário cancela a janela.
   */
  function escolherDestino(nome) {
    if (typeof window.showSaveFilePicker !== 'function') { return Promise.resolve(DOWNLOAD); }
    return window.showSaveFilePicker({
      suggestedName: nome,
      types: [{ description: 'Planilha do Excel', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }]
    }).catch(function (e) {
      if (e && e.name === 'AbortError') { return null; }
      if (e && (e.name === 'SecurityError' || e.name === 'NotAllowedError')) { return DOWNLOAD; }
      throw e;
    });
  }

  /** Texto no .xlsx nunca vira fórmula (aoa_to_sheet não interpreta "="): dispensa o apóstrofo que o CSV usava. */
  function planilhaEmails(X, lista) {
    var linhas = [['Empresa', 'Código', 'Funcionário', 'E-mail', 'Unidade']].concat(lista.map(function (a) {
      var nome = a.codFunc ? (a.nomeFunc || 'Não achado na folha') : (a.generica ? 'Conta genérica' + (a.descricao ? ' - ' + a.descricao : '') : '');
      return [a.codFunc ? a.codEmp : '', a.codFunc || '', nome, a.login || '', unidade(a) || ''];
    }));
    var ws = X.utils.aoa_to_sheet(linhas);
    ws['!cols'] = [{ wch: 9 }, { wch: 9 }, { wch: 40 }, { wch: 42 }, { wch: 30 }];
    ws['!autofilter'] = { ref: ws['!ref'] };
    var wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, 'E-mails');
    return X.write(wb, { bookType: 'xlsx', type: 'array' });
  }

  function gravarArquivo(destino, bytes, nome) {
    if (destino === DOWNLOAD) {
      baixar(bytes, nome, TIPO_XLSX);
      return Promise.resolve();
    }
    return destino.createWritable().then(function (w) {
      return w.write(new Blob([bytes], { type: TIPO_XLSX })).then(function () { return w.close(); });
    });
  }

  function baixar(conteudo, nome, tipo) {
    var url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    var link = document.createElement('a');
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ============================================== seleção e exclusão em lote

  function selecionar(id, e) {
    var ids = Array.prototype.map.call(u.el('cr-lista').querySelectorAll('tr[data-linha]'), function (tr) { return tr.dataset.linha; });
    var somar = e.ctrlKey || e.metaKey;
    if (e.shiftKey && ancora && ids.indexOf(ancora) >= 0) {
      var i = ids.indexOf(ancora);
      var j = ids.indexOf(id);
      if (!somar) { selecionadas = {}; }
      ids.slice(Math.min(i, j), Math.max(i, j) + 1).forEach(function (x) { selecionadas[x] = true; });
    } else if (somar) {
      if (selecionadas[id]) { delete selecionadas[id]; } else { selecionadas[id] = true; }
      ancora = id;
    } else {
      // Clique simples na única linha marcada desmarca (como antes); em outra, fica só ela.
      var sozinha = selecionadas[id] && Object.keys(selecionadas).length === 1;
      selecionadas = {};
      if (!sozinha) { selecionadas[id] = true; }
      ancora = id;
    }
    marcarSelecao();
  }

  /** Pinta a seleção e mostra a lixeira. Linha que saiu do filtro deixa de contar: a lixeira só exclui o que está à vista. */
  function marcarSelecao() {
    var visiveis = {};
    u.cada(u.el('cr-lista'), 'tr[data-linha]', function (tr) {
      var id = tr.dataset.linha;
      visiveis[id] = true;
      tr.classList.toggle('g-cofre__linha--selecionada', !!selecionadas[id]);
      tr.setAttribute('aria-selected', selecionadas[id] ? 'true' : 'false');
    });
    Object.keys(selecionadas).forEach(function (id) { if (!visiveis[id]) { delete selecionadas[id]; } });
    var qtd = Object.keys(selecionadas).length;
    var botao = u.el('cr-excluir-sel');
    botao.hidden = !qtd;
    var rotulo = 'Excluir ' + (qtd === 1 ? '1 selecionado' : qtd + ' selecionados');
    // Botão enxuto (lixeira + quantidade); o texto completo fica na dica e no leitor de tela.
    botao.title = rotulo + ' (Ctrl ou Shift + clique marca várias linhas)';
    botao.setAttribute('aria-label', rotulo);
    botao.querySelector('span').textContent = String(qtd);
  }

  function excluirSelecionadas() {
    var escolhidos = Object.keys(selecionadas).map(function (id) { return acesso(Number(id)); }).filter(Boolean);
    if (!escolhidos.length) { return; }
    if (escolhidos.length === 1) {
      excluir(escolhidos[0], u.el('cr-excluir-sel'));
      return;
    }
    var qtd = escolhidos.length;
    var naHg = escolhidos.filter(function (a) { return natureza(a.tipo, a.equipamento, a.login) && naHostGator(a.login); }).length;
    var imp = impactoExclusao(escolhidos.map(function (a) { return a.idAcesso; }));
    if (avisarBloqueio(imp, null)) { return; }
    CtiApp.confirmar({
      topicos: imp ? imp.topicos : null,
      titulo: 'Excluir ' + qtd + ' acessos?',
      mensagem: 'Os ' + qtd + ' acessos selecionados saem do cofre. Se algum tiver sido alterado por outra pessoa, nenhum é excluído. ' +
        (naHg ? u.plural(naHg, 'conta também é excluída', 'contas também são excluídas') + ' na HostGator (caixas com as mensagens). ' +
          'Cada conta é tratada separadamente: a que falhar fica no cofre e aparece no resumo. '
          : 'Para contas desligadas, prefira desativar: o histórico fica visível.') + tambemMuda(imp),
      botao: 'Excluir ' + qtd + ' acessos', perigo: true, botaoExecutando: 'Excluindo…', contextoErro: 'Nenhum acesso foi excluído',
      tituloSucesso: 'excluídos',
      carregando: naHg ? 'Excluindo ' + qtd + ' contas (' + naHg + ' na HostGator)…' : 'Excluindo ' + qtd + ' acessos…',
      executar: function () {
        return CtiApp.dados.excluirAcessos({ itens: escolhidos.map(function (a) { return { id: a.idAcesso, versao: a.versao }; }) });
      },
      // Com erro em alguma conta, a confirmação fecha e o resumo mostra cada uma.
      sucesso: function (r) { return r.erros.length ? null : u.plural(r.qtd, 'acesso saiu', 'acessos saíram') + ' do cofre.'; }
    }).then(function (r) {
      if (!r) { return; }
      selecionadas = {};
      ancora = null;
      if (r.feito && r.resultado.erros.length) {
        CtiApp.resumoLote({ titulo: 'Algumas contas não foram excluídas', feito: r.resultado.qtd === 1 ? 'acesso excluído' : 'acessos excluídos',
          resultado: r.resultado,
          aoVerLog: CtiApp.estado.sessao && CtiApp.estado.sessao.podeCofre ? function () { CtiConfig.abrirAba('hostgator'); } : null });
      }
      CtiApp.recarregar(['cofre']);
    });
  }

  /** Colunas na ordem da planilha de acessos (EMP, código, nome, e-mail, senha, unidade...). */
  function colunas() {
    // Situação primeiro: quem saiu da empresa aparece logo, para desativar.
    var c = {
      E: ['Situação', 'Emp.', 'Cód.', 'Funcionário', 'E-mail', 'Senha', 'Unidade', 'Equipamento', ''],
      T: ['Situação', 'Emp.', 'Cód.', 'Funcionário', 'Usuário', 'Senha', 'Unidade', 'Pasta', 'Horário', ''],
      S: ['Situação', 'Departamento', 'Responsável', 'E-mail de acesso', 'Senha', 'Kit', 'Dia', 'Observação', ''],
      O: ['Situação', 'Serviço', 'Login', 'Senha', 'Endereço', 'Observação', ''],
      P: ['Situação', 'Emp.', 'Cód.', 'Funcionário', 'Tipo', 'Acesso', 'Senha', '']
    };
    return c[modeloDaAba()];
  }

  /** Valor de cada coluna, na ordem de colunas(): serve à ordenação e ao filtro. */
  function valoresDaLinha(a) {
    var nomeTipo = (tipoConta(a.codTipo) || {}).nome;
    var func = a.codFunc ? [a.codEmp, a.codFunc, a.nomeFunc || 'Não achado na folha']
      : [null, null, a.generica ? 'Conta genérica' + (a.descricao ? ' - ' + a.descricao : '') : null];
    var situacao = !a.ativo ? 'Desativado' : (ALERTAS[a.alerta] ? ALERTAS[a.alerta].rotulo : 'Ativo');
    var m = modeloDaAba();
    if (m === 'P') { return [situacao].concat(func, [nomeTipo, a.login || a.descricao, null]); }
    if (m === 'E') { return [situacao].concat(func, [a.login, null, unidade(a), a.equipamento]); }
    if (m === 'T') { return [situacao].concat(func, [a.login, null, unidade(a), a.pasta, a.horario]); }
    if (m === 'S') { return [situacao, deptoStarlink(a), responsavelStarlink(a), a.login, null, a.equipamento, a.diaAtivacao || null, a.obs]; }
    return [situacao, a.descricao, a.login, null, a.url, a.obs];
  }

  function textoDoValor(v) {
    return v === null || v === undefined || v === '' ? VAZIO : String(v);
  }

  /** ignorar = coluna cujo filtro não conta (a lista de valores do Excel mostra o que os outros filtros deixam). */
  function passaNosFiltros(a, ignorar) {
    var valores = null;
    return Object.keys(filtrosCol).every(function (i) {
      if (Number(i) === ignorar) { return true; }
      valores = valores || valoresDaLinha(a);
      return filtrosCol[i].indexOf(textoDoValor(valores[Number(i)])) >= 0;
    });
  }

  /** Demitido, transferido e fora da folha sempre no topo (nesta ordem); a ordenação escolhida vale dentro de cada grupo. */
  var PRIORIDADE_ALERTA = { DEMITIDO: 0, TRANSFERIDO: 1, NAO_ENCONTRADO: 2, AGENDADO: 3 };
  function prioridade(a) {
    var p = PRIORIDADE_ALERTA[a.alerta];
    return p === undefined ? 4 : p;
  }

  function ordenar(lista) {
    var posicao = {};
    lista.forEach(function (a, i) { posicao[a.idAcesso] = i; });
    lista.sort(function (x, y) {
      var grupo = prioridade(x) - prioridade(y);
      if (grupo) { return grupo; }
      if (ordem.coluna === null) {
        // Starlink: lista única em ordem de departamento, particulares no fim.
        if (modeloDaAba() === 'S') {
          var g = grupoStarlink(x).localeCompare(grupoStarlink(y), 'pt-BR');
          if (g) { return g; }
        }
        return posicao[x.idAcesso] - posicao[y.idAcesso];
      }
      var a = valoresDaLinha(x)[ordem.coluna];
      var b = valoresDaLinha(y)[ordem.coluna];
      var vazioA = a === null || a === undefined || a === '';
      var vazioB = b === null || b === undefined || b === '';
      if (vazioA || vazioB) { return vazioA === vazioB ? posicao[x.idAcesso] - posicao[y.idAcesso] : (vazioA ? 1 : -1); }
      var r = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
      return r * ordem.direcao || posicao[x.idAcesso] - posicao[y.idAcesso];
    });
  }

  // ===================================================== filtro e paleta

  /** Caixa flutuante única da grade (filtro de coluna ou paleta do pincel), presa ao botão que a abriu. */
  function popover(ancora, html, classe) {
    var p = u.el('cr-popover');
    if (!p) {
      p = document.createElement('div');
      p.id = 'cr-popover';
      p.className = 'g-cofre__popover';
      p.setAttribute('role', 'dialog');
      u.el('visao-cofre').appendChild(p);
    }
    p.className = 'g-cofre__popover ' + (classe || '');
    p.innerHTML = html;
    p.hidden = false;
    var r = ancora.getBoundingClientRect();
    var largura = p.offsetWidth;
    p.style.top = Math.round(r.bottom + 4) + 'px';
    p.style.left = Math.round(Math.max(8, Math.min(r.left, window.innerWidth - largura - 8))) + 'px';
    return p;
  }

  function fecharPopover() {
    var p = u.el('cr-popover');
    if (p) { p.hidden = true; p.innerHTML = ''; }
  }

  /** Filtro da coluna no jeito do Excel: ordenar, buscar e marcar os valores que ficam. */
  function abrirFiltro(i, botao) {
    var base = daAba().filter(passaNosAtalhos).filter(passaNaBusca).filter(function (a) { return passaNosFiltros(a, i); });
    var contagem = {};
    base.forEach(function (a) {
      var t = textoDoValor(valoresDaLinha(a)[i]);
      contagem[t] = (contagem[t] || 0) + 1;
    });
    var valores = Object.keys(contagem).sort(function (a, b) {
      if (a === VAZIO || b === VAZIO) { return a === VAZIO ? 1 : -1; }
      return a.localeCompare(b, 'pt-BR', { numeric: true });
    });
    var marcados = filtrosCol[i];
    var p = popover(botao,
      '<div class="g-cofre__pop-acoes">' +
        '<button type="button" class="g-cofre__pop-item" data-classificar="1"><i class="ri-sort-asc" aria-hidden="true"></i> Classificar de A a Z</button>' +
        '<button type="button" class="g-cofre__pop-item" data-classificar="-1"><i class="ri-sort-desc" aria-hidden="true"></i> Classificar de Z a A</button>' +
        '<button type="button" class="g-cofre__pop-item" data-limpar-col' + (marcados ? '' : ' disabled') + '><i class="ri-filter-off-line" aria-hidden="true"></i> Limpar filtro desta coluna</button>' +
      '</div>' +
      '<input type="search" class="g-cofre__pop-busca" placeholder="Pesquisar" aria-label="Pesquisar valores" autocomplete="off">' +
      '<div class="g-cofre__pop-lista">' +
        '<label class="g-cofre__pop-valor g-cofre__pop-todos"><input type="checkbox" data-todos checked> (Selecionar tudo)</label>' +
        valores.map(function (v) {
          var marcado = !marcados || marcados.indexOf(v) >= 0;
          return '<label class="g-cofre__pop-valor" data-valor-texto="' + u.esc(u.normal(v)) + '"><input type="checkbox" value="' + u.esc(v) + '"' + (marcado ? ' checked' : '') + '> ' +
            u.esc(v) + ' <small>' + contagem[v] + '</small></label>';
        }).join('') +
      '</div>' +
      '<div class="g-cofre__pop-rodape"><button type="button" class="g-btn g-btn--cancelar g-btn--p" data-cancelar>Cancelar</button>' +
        '<button type="button" class="g-btn g-btn--primario g-btn--p" data-aplicar>OK</button></div>', 'g-cofre__popover--filtro');
    var caixas = function () { return Array.prototype.slice.call(p.querySelectorAll('.g-cofre__pop-valor:not(.g-cofre__pop-todos) input')); };
    var atualizarTodos = function () {
      var visiveis = caixas().filter(function (c) { return !c.closest('label').hidden; });
      var todos = p.querySelector('[data-todos]');
      todos.checked = visiveis.length > 0 && visiveis.every(function (c) { return c.checked; });
      todos.indeterminate = !todos.checked && visiveis.some(function (c) { return c.checked; });
    };
    atualizarTodos();
    p.querySelector('.g-cofre__pop-busca').focus();
    p.querySelector('.g-cofre__pop-busca').addEventListener('input', function (e) {
      var t = u.normal(e.target.value.trim());
      caixas().forEach(function (c) {
        var label = c.closest('label');
        label.hidden = !!t && label.dataset.valorTexto.indexOf(t) < 0;
        // Pesquisar filtra a lista e marca só o que aparece (como o Excel).
        if (t) { c.checked = !label.hidden; }
      });
      atualizarTodos();
    });
    p.querySelector('[data-todos]').addEventListener('change', function (e) {
      caixas().forEach(function (c) { if (!c.closest('label').hidden) { c.checked = e.target.checked; } });
      atualizarTodos();
    });
    caixas().forEach(function (c) { c.addEventListener('change', atualizarTodos); });
    p.querySelectorAll('[data-classificar]').forEach(function (b) {
      b.addEventListener('click', function () {
        ordem = { coluna: i, direcao: Number(b.dataset.classificar) };
        pintarLista();
      });
    });
    p.querySelector('[data-limpar-col]').addEventListener('click', function () {
      delete filtrosCol[i];
      pintarLista();
    });
    p.querySelector('[data-cancelar]').addEventListener('click', fecharPopover);
    p.querySelector('[data-aplicar]').addEventListener('click', function () {
      var escolhidos = caixas().filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
      if (escolhidos.length === valores.length) { delete filtrosCol[i]; } else { filtrosCol[i] = escolhidos; }
      pintarLista();
    });
    p.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.classList.contains('g-cofre__pop-busca')) { e.preventDefault(); p.querySelector('[data-aplicar]').click(); }
    });
  }

  /** Paleta do pincel: a cor fica gravada no acesso e todos veem em tempo real. */
  function abrirPaleta(id, botao) {
    var a = acesso(id);
    var p = popover(botao,
      '<div class="g-cofre__paleta">' + PALETA.map(function (c) {
        return '<button type="button" class="g-cofre__cor g-cofre__marca--' + c[0].toLowerCase() + (a.marca === c[0] ? ' g-cofre__cor--atual' : '') +
          '" data-cor="' + c[0] + '" title="' + c[1] + '" aria-label="' + c[1] + '"></button>';
      }).join('') + '</div>' +
      '<button type="button" class="g-cofre__pop-item" data-cor=""' + (a.marca ? '' : ' disabled') + '><i class="ri-close-line" aria-hidden="true"></i> Sem cor</button>' +
      (a.marca && a.nomeUsuMarca ? '<small class="g-cofre__pop-nota">Marcado por ' + u.esc(a.nomeUsuMarca) + '</small>' : ''), 'g-cofre__popover--paleta');
    p.querySelectorAll('[data-cor]').forEach(function (b) {
      b.addEventListener('click', function () {
        fecharPopover();
        CtiApp.dados.marcarAcesso({ idAcesso: id, cor: b.dataset.cor }).then(function () {
          return CtiApp.recarregar(['cofre']);
        }, function (e) { CtiApp.falhaAoGravar(e, 'A marca não foi gravada: '); });
      });
    });
  }

  /** Mostra na linha quem mais está com o acesso aberto ou editando, sem repintar a grade. */
  function marcarPresenca() {
    var lista = u.el('cr-lista');
    if (!lista) { return; }
    u.cada(lista, '[data-presenca-acesso]', function (el) {
      var outros = CtiPresenca.outrosNoRegistro('A', el.dataset.presencaAcesso);
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
      el.title = nomes.join(', ') + (editando ? ' editando agora' : ' com o acesso aberto');
    });
  }

  function td(conteudo, classe) {
    return '<td' + (classe ? ' class="' + classe + '"' : '') + '>' + conteudo + '</td>';
  }

  function texto(v) { return v ? u.esc(v) : '<span class="g-cofre__nada">—</span>'; }

  function linha(a) {
    var celulas;
    if (aba === 'P') {
      celulas = celulasFuncionario(a).concat([td(u.esc((tipoConta(a.codTipo) || {}).nome || a.codTipo || '')), td(loginHtml(a.login || a.descricao)), td(senhaHtml(a))]);
    } else if (a.tipo === 'E') {
      celulas = celulasFuncionario(a).concat([td(loginComDestinos(a)), td(senhaHtml(a)), td(texto(unidade(a)), 'g-cofre__quebra'),
        td(equipamentoHtml(a.equipamento))]);
    } else if (a.tipo === 'T') {
      celulas = celulasFuncionario(a).concat([td(loginHtml(a.login)), td(senhaHtml(a)), td(texto(unidade(a)), 'g-cofre__quebra'),
        td(texto(a.pasta), 'g-cofre__quebra'), td(texto(a.horario))]);
    } else if (a.tipo === 'S') {
      var resp = a.nomeFunc
        ? '<span title="' + u.esc([a.codEmp + '/' + a.codFunc, a.cargo].filter(Boolean).join(' · ')) + '">' + u.esc(a.nomeFunc) + '</span>'
        : (a.responsavel ? u.esc(a.responsavel) + ' <span class="g-cofre__desc">(sem cadastro na folha)</span>' : texto(null));
      celulas = [td(a.particular
          ? '<span class="g-selo" style="--c:' + u.cor('#8B5CF6') + '"><i class="ri-vip-crown-line" aria-hidden="true"></i>Particular</span> ' + u.esc(a.proprietario || '')
          : texto(deptoStarlink(a)), 'g-cofre__quebra'),
        td(resp, 'g-cofre__nome'), td(loginComDestinos(a)), td(senhaHtml(a)),
        td(a.equipamento ? '<span class="g-cofre__kit"><i class="' + ICONE_KIT + '" aria-hidden="true"></i>' + u.esc(rotuloKit(a.equipamento)) + '</span>' : texto(null)),
        td(a.diaAtivacao ? String(Number(a.diaAtivacao)) : texto(null), 'g-cofre__num'), td(texto(a.obs), 'g-cofre__quebra')];
    } else {
      var link = u.urlSegura(a.url);
      celulas = [td('<strong>' + u.esc(a.descricao || '') + '</strong>', 'g-cofre__livre'), td(loginHtml(a.login)), td(senhaHtml(a)),
        td(link ? '<a href="' + u.esc(link) + '" target="_blank" rel="noopener noreferrer">' + u.esc(link.replace(/^https?:\/\//i, '')) +
          ' <i class="ri-external-link-line" aria-hidden="true"></i></a>' : texto(null), 'g-cofre__livre'),
        td(texto(a.obs), 'g-cofre__livre')];
    }
    var id = String(Number(a.idAcesso));
    var marca = PALETA.some(function (c) { return c[0] === a.marca; }) ? a.marca.toLowerCase() : null;
    var classes = [a.ativo ? '' : 'g-cofre__inativo', marca ? 'g-cofre__marca--' + marca : '',
      a.ativo && a.ferias && !marca ? 'g-cofre__linha--ferias' : '',
      selecionadas[id] ? 'g-cofre__linha--selecionada' : ''].filter(Boolean).join(' ');
    var dica = [a.obs, marca && a.nomeUsuMarca ? 'Marcado por ' + a.nomeUsuMarca : null].filter(Boolean).join(' · ');
    return '<tr data-linha="' + id + '"' + (classes ? ' class="' + classes + '"' : '') + (dica ? ' title="' + u.esc(dica) + '"' : '') + '>' +
      '<td class="g-cofre__marca-col"><button type="button" class="g-icone-btn g-cofre__mini g-cofre__pincel" data-marcar="' + id + '"' +
        ' title="Marcar a linha com uma cor (todos veem)" aria-label="Marcar a linha com uma cor"><i class="ri-paint-brush-line" aria-hidden="true"></i></button>' +
        '<span class="g-presenca-selo" data-presenca-acesso="' + id + '" hidden></span></td>' +
      td(situacaoHtml(a)) + celulas.join('') +
      '<td class="g-cofre__acoes">' +
        '<button type="button" class="g-icone-btn g-cofre__mini" data-editar-acesso="' + Number(a.idAcesso) + '" title="Editar" aria-label="Editar acesso">' +
          '<i class="ri-edit-line" aria-hidden="true"></i></button>' +
        '<button type="button" class="g-icone-btn g-icone-btn--perigo g-cofre__mini" data-excluir-acesso="' + Number(a.idAcesso) + '" title="Excluir" aria-label="Excluir acesso">' +
          '<i class="ri-delete-bin-line" aria-hidden="true"></i></button>' +
      '</td></tr>';
  }

  /** Starlink: departamento escolhido, senão o do responsável na folha (ao vivo); particular mostra o dono. */
  function deptoStarlink(a) {
    return a.particular ? 'Particular - ' + (a.proprietario || '') : (a.departamentoAcesso || a.departamento || null);
  }
  function responsavelStarlink(a) { return a.nomeFunc || a.responsavel || null; }
  /** Chave de ordem da Starlink: departamentos em ordem alfabética e os particulares por último. */
  function grupoStarlink(a) { return (a.particular ? '2' : '1') + (deptoStarlink(a) || '~'); }

  function tipoEquipamento(nome) { return u.porId(estadoCofre().equipamentos || [], 'nome', nome); }
  function categoriaEquip(eq) { return eq && CATEGORIAS_EQUIP[eq.categoria] ? eq.categoria : 'O'; }
  /** Cor escolhida no cadastro; sem ela, a padrão da categoria. */
  function corEquip(eq) { return u.cor(eq && eq.cor, CATEGORIAS_EQUIP[categoriaEquip(eq)].cor); }

  /** Selo com o ícone e a cor do cadastro; valor fora do cadastro (dado antigo) sai como texto. */
  function equipamentoHtml(nome) {
    var eq = nome ? tipoEquipamento(nome) : null;
    if (!eq) { return texto(nome); }
    return '<span class="g-selo g-cofre__equip" style="--c:' + corEquip(eq) + '" title="' + u.esc(CATEGORIAS_EQUIP[categoriaEquip(eq)].rotulo) + '">' +
      '<i class="' + u.icone(eq.icone, ICONE_EQUIP) + '" aria-hidden="true"></i>' + u.esc(nome) + '</span>';
  }

  /** Unidade = departamento do funcionário na folha; o campo gravado só vale para dado antigo sem funcionário. */
  function unidade(a) { return a.departamento || a.unidade || null; }

  /** Empresa, código e nome, cada um na sua coluna. Conta genérica ocupa as três. */
  function celulasFuncionario(a) {
    if (a.generica || !a.codFunc) {
      var rotulo = a.generica
        ? '<span class="g-selo" style="--c:' + u.cor('#64748B') + '"><i class="ri-team-line" aria-hidden="true"></i>Conta genérica</span>'
        : '<span class="g-cofre__nada">Sem funcionário</span>';
      return [td(texto(null), 'g-cofre__num'), td(texto(null), 'g-cofre__num'),
        td(rotulo + (a.descricao ? ' <span class="g-cofre__desc">' + u.esc(a.descricao) + '</span>' : ''), 'g-cofre__nome')];
    }
    var titulo = [a.cargo, a.departamento].filter(Boolean).join(' · ');
    return [
      td('<span title="' + u.esc(a.nomeEmpresa || '') + '">' + Number(a.codEmp) + '</span>', 'g-cofre__num'),
      td(String(Number(a.codFunc)), 'g-cofre__num'),
      td(a.nomeFunc
        ? '<span' + (titulo ? ' title="' + u.esc(titulo) + '"' : '') + '>' + u.esc(a.nomeFunc) + '</span>'
        : '<span class="g-cofre__nada">Não achado na folha</span>', 'g-cofre__nome')
    ];
  }

  /**
   * Login com os destinos do redirecionamento (ou das férias) ao lado: a TI
   * vê na grade para onde cada endereço manda as mensagens.
   */
  function loginComDestinos(a) {
    var html = loginHtml(a.login);
    var d = a.destinos || [];
    if (!d.length) { return html; }
    return html + '<span class="g-cofre__destinos" title="' + u.esc('Redireciona para: ' + d.join(', ')) + '">' +
      '<i class="ri-share-forward-line" aria-hidden="true"></i>' +
      u.esc(d.length === 1 ? d[0] : u.plural(d.length, 'destino', 'destinos')) + '</span>';
  }

  function loginHtml(login) {
    if (!login) { return texto(null); }
    return '<span class="g-cofre__login">' + u.esc(login) + '<button type="button" class="g-icone-btn g-cofre__mini" data-copiar-login="' +
      u.esc(login) + '" title="Copiar" aria-label="Copiar login"><i class="ri-file-copy-line" aria-hidden="true"></i></button></span>';
  }

  function senhaHtml(a) {
    if (!a.temSenha) { return '<span class="g-cofre__nada">sem senha</span>'; }
    var id = Number(a.idAcesso);
    return '<span class="g-senha"' + (a.dhSenha ? ' title="Senha trocada em ' + u.esc(u.dataHoraBr(a.dhSenha)) + '"' : '') + '>' +
      '<code class="g-senha__valor" data-valor-senha="' + id + '">' + MASCARA + '</code>' +
      '<button type="button" class="g-icone-btn g-cofre__mini" data-ver="' + id + '" title="Ver senha" aria-label="Ver senha">' +
        '<i class="ri-eye-line" aria-hidden="true"></i></button>' +
      '<button type="button" class="g-icone-btn g-cofre__mini" data-copiar="' + id + '" title="Copiar senha" aria-label="Copiar senha">' +
        '<i class="ri-file-copy-line" aria-hidden="true"></i></button></span>';
  }

  function situacaoHtml(a) {
    var ferias = a.ativo && a.ferias
      ? ' <span class="g-selo g-selo--ferias" title="' + u.esc('Em férias: cópia para ' + (a.destinos || []).join(', ')) + '">' +
        '<i class="ri-plane-line" aria-hidden="true"></i>Férias</span>'
      : '';
    return situacaoBase(a) + ferias;
  }

  function situacaoBase(a) {
    if (!a.ativo) { return '<span class="g-selo" style="--c:' + u.cor('#88938D') + '"><i class="ri-lock-line" aria-hidden="true"></i>Desativado</span>'; }
    var al = ALERTAS[a.alerta];
    if (!al) { return '<span class="g-selo" style="--c:' + u.cor('#2E8B47') + '"><i class="ri-checkbox-circle-line" aria-hidden="true"></i>Ativo</span>'; }
    var titulo = a.dtDemissao && (a.alerta === 'DEMITIDO' || a.alerta === 'AGENDADO')
      ? ' title="' + (a.alerta === 'AGENDADO' ? 'Sai em ' : 'Desligado em ') + u.dataBr(a.dtDemissao) + '"' : '';
    var selo = '<span class="g-selo" style="--c:' + u.cor(al.cor) + '"' + titulo + '><i class="' + u.icone(al.icone, 'ri-alert-line') + '" aria-hidden="true"></i>' +
      al.rotulo + '</span>';
    // Agendado: a data de saída fica à vista, abaixo do selo (ainda não é para bloquear).
    if (a.alerta === 'AGENDADO' && a.dtDemissao) {
      return '<span class="g-cofre__transf">' + selo + '<small class="g-cofre__desc">sai em ' + u.dataBr(a.dtDemissao) + '</small></span>';
    }
    // Transferido com registro ativo novo (mesmo CPF): a TI troca à mão, com o novo já sugerido.
    if (a.alerta === 'TRANSFERIDO' && a.novoCodFunc) {
      return '<span class="g-cofre__transf">' + selo +
        '<button type="button" class="g-btn g-btn--fantasma g-btn--p" data-trocar-registro="' + Number(a.idAcesso) + '"' +
        ' title="Novo registro: ' + u.esc(a.novoNomeFunc || '') + ' · empresa ' + Number(a.novoCodEmp) + ' · código ' + Number(a.novoCodFunc) +
        (a.novoNomeEmpresa ? ' · ' + u.esc(a.novoNomeEmpresa) : '') + '. Clique para trocar o vínculo."><i class="ri-arrow-left-right-line" aria-hidden="true"></i> Trocar</button></span>';
    }
    return selo;
  }

  // ============================================================== senha

  function alternarSenha(id, botao) {
    var alvo = u.el('visao-cofre').querySelector('[data-valor-senha="' + id + '"]');
    if (!alvo) { return; }
    if (alvo.classList.contains('g-senha__valor--visivel')) {
      esconder(id);
      return;
    }
    CtiApp.ocupado(botao, CtiApp.dados.revelarSenha({ idAcesso: id, acao: 'VER' })).then(function (senha) {
      alvo.textContent = senha;
      alvo.classList.add('g-senha__valor--visivel');
      botao.innerHTML = '<i class="ri-eye-off-line" aria-hidden="true"></i>';
      botao.title = 'Esconder senha';
      clearTimeout(timers[id]);
      timers[id] = setTimeout(function () { esconder(id); }, SEGUNDOS_VISIVEL * 1000);
    }, function (e) { CtiApp.falhaAoGravar(e, 'Não foi possível mostrar a senha: '); });
  }

  function esconder(id) {
    clearTimeout(timers[id]);
    delete timers[id];
    var raiz = u.el('visao-cofre');
    var alvo = raiz.querySelector('[data-valor-senha="' + id + '"]');
    if (alvo) {
      alvo.textContent = MASCARA;
      alvo.classList.remove('g-senha__valor--visivel');
    }
    var botao = raiz.querySelector('[data-ver="' + id + '"]');
    if (botao) {
      botao.innerHTML = '<i class="ri-eye-line" aria-hidden="true"></i>';
      botao.title = 'Ver senha';
    }
  }

  /** Repintura apaga o DOM: os timers pendentes não têm mais o que esconder. */
  function limparReveladas() {
    Object.keys(timers).forEach(function (id) { clearTimeout(timers[id]); });
    timers = {};
  }

  function copiarSenha(id, botao) {
    CtiApp.ocupado(botao, CtiApp.dados.revelarSenha({ idAcesso: id, acao: 'COPIAR' }))
      .then(copiarTexto)
      .then(function () { CtiApp.sucesso('Senha copiada.'); }, function (e) {
        if (e && e.copia) { falhaCopia(); return; }
        CtiApp.falhaAoGravar(e, 'Não foi possível copiar a senha: ');
      });
  }

  /** Área de transferência (CtiUtil.copiar: Clipboard API com o caminho antigo de reserva). */
  function copiarTexto(texto) { return u.copiar(texto); }

  function falhaCopia() {
    CtiApp.erro('O navegador não deixou copiar. Use o olho para ver a senha e copie manualmente.');
  }

  // ============================================================ exclusão

  /**
   * Mesma regra do servidor (AcessoService.dependentesNoCofre): quem redireciona
   * para um e-mail que sai da HostGator perde esse destino. Caixa em férias que
   * fica sem destino sai das férias; redirecionamento que fica sem destino bloqueia.
   * Nulo sem o cofre carregado (o servidor confere do mesmo jeito).
   */
  function impactoExclusao(ids) {
    var c = estadoCofre();
    if (!c || !c.acessos) { return null; }
    var saem = {};
    var emails = {};
    ids.forEach(function (id) {
      saem[id] = true;
      var a = acesso(id);
      if (a && natureza(a.tipo, a.equipamento, a.login) && naHostGator(a.login)) { emails[a.login.toLowerCase()] = true; }
    });
    var r = { topicos: [], bloqueia: [] };
    if (!Object.keys(emails).length) { return r; }
    c.acessos.forEach(function (x) {
      var lista = x.destinos || [];
      if (saem[x.idAcesso] || !lista.length) { return; }
      var removidos = lista.filter(function (d) { return emails[d.toLowerCase()]; });
      if (!removidos.length) { return; }
      if (removidos.length < lista.length) {
        r.topicos.push({ texto: x.login, detalhe: 'Deixa de mandar para ' + removidos.join(', ') });
      } else if (natureza(x.tipo, x.equipamento, x.login) === 'CAIXA') {
        r.topicos.push({ texto: x.login, detalhe: 'Sai das férias' });
      } else {
        r.bloqueia.push(x.login);
      }
    });
    return r;
  }

  function tambemMuda(imp) { return imp && imp.topicos.length ? ' Também muda:' : ''; }

  /**
   * Redirecionamento que ficaria sem destino: avisa e não abre a exclusão.
   * alvo: o e-mail excluído; sem ele (lote), "e-mails selecionados".
   */
  function avisarBloqueio(imp, alvo) {
    if (!imp || !imp.bloqueia.length) { return false; }
    var um = imp.bloqueia.length === 1;
    CtiApp.alerta(imp.bloqueia.join(', ') + (um ? ' manda' : ' mandam') + ' só para ' + (alvo || 'e-mails selecionados') +
      '. Troque o destino ' + (um ? 'dele' : 'deles') + ' antes de excluir' + (alvo ? '.' : (um ? ' ou inclua-o na seleção.' : ' ou inclua-os na seleção.')));
    return true;
  }

  function excluir(a, botao) {
    var nat = natureza(a.tipo, a.equipamento, a.login);
    var lado = nat && naHostGator(a.login);
    var imp = impactoExclusao([a.idAcesso]);
    if (avisarBloqueio(imp, a.login)) { return; }
    CtiApp.confirmar({
      topicos: imp ? imp.topicos : null,
      titulo: 'Excluir o acesso?',
      mensagem: '"' + (a.login || a.descricao) + '" sai do cofre.' +
        (lado ? (nat === 'CAIXA' ? ' A caixa também é excluída na HostGator, com as mensagens guardadas (não volta).'
          : ' Os redirecionamentos também são apagados na HostGator.') : ' Para contas desligadas, prefira desativar: o histórico fica visível.') +
        tambemMuda(imp),
      botao: 'Excluir acesso', perigo: true, botaoExecutando: 'Excluindo…', contextoErro: 'O acesso não foi excluído',
      tituloSucesso: 'excluído',
      // A confirmação espera a resposta com o botão em andamento (sem camada por trás).
      carregando: lado ? (nat === 'CAIXA' ? 'Excluindo a caixa na HostGator…' : 'Apagando os redirecionamentos na HostGator…')
        : 'Excluindo o acesso…',
      executar: function () { return CtiApp.dados.excluirAcesso({ id: a.idAcesso, versao: a.versao }); },
      sucesso: function () {
        return '"' + (a.login || a.descricao) + '" saiu do cofre' + (lado ? ' e da HostGator.' : '.');
      }
    }).then(function (r) {
      if (!r) { return; }
      if (!r.feito && CtiApi.ehConflito(r.erro)) { CtiApp.recarregarTudo(); return; }
      CtiApp.recarregar(['cofre']);
    });
  }

  // ========================================================== HostGator

  /** Mesma regra do servidor (AcessoService.natureza): o que a conta é na HostGator. */
  function natureza(modelo, equipamento, login) {
    if (!login) { return null; }
    if (modelo === 'S') { return 'REDIR'; }
    if (modelo !== 'E') { return null; }
    return categoriaEquip(tipoEquipamento(equipamento)) === 'R' && tipoEquipamento(equipamento) ? 'REDIR' : 'CAIXA';
  }

  /** A integração está ligada e o domínio do e-mail é marcado como gerenciado pela HostGator. */
  function naHostGator(login) {
    var c = estadoCofre();
    if (!c.hostGatorAtivo || !login || login.indexOf('@') < 0) { return false; }
    var d = u.porId(c.dominios || [], 'dominio', login.slice(login.indexOf('@') + 1).toLowerCase());
    return !!(d && d.hostgator);
  }

  /** Texto do carregamento enquanto a HostGator responde à gravação. */
  function textoDaGravacao(a, nat, novo, trocouSenha, ferias) {
    if (nat === 'REDIR') { return novo ? 'Criando o redirecionamento na HostGator…' : 'Atualizando os redirecionamentos na HostGator…'; }
    if (novo) { return 'Criando a caixa na HostGator…'; }
    if (trocouSenha) { return 'Trocando a senha na HostGator…'; }
    return ferias !== !!(a && a.ferias) ? (ferias ? 'Redirecionando a caixa (férias)…' : 'Tirando o redirecionamento das férias…')
      : 'Atualizando na HostGator…';
  }

  // ========================================================== formulário

  /** Mostra só os campos do tipo escolhido (data-tipos="ET" = e-mail e TS). */
  function campo(tipos, html, id) {
    return '<div class="g-cofre__campo"' + (id ? ' id="' + id + '"' : '') + ' data-tipos="' + tipos + '">' + html + '</div>';
  }

  /** Liga/desliga no mesmo padrão das Configurações (.g-interruptor) com o texto ao lado. */
  function flag(id, ligado, texto, dica, idCampo) {
    return '<label class="g-cofre__flag"' + (idCampo ? ' id="' + idCampo + '"' : '') + (dica ? ' title="' + u.esc(dica) + '"' : '') + '>' +
      '<span class="g-interruptor"><input type="checkbox" id="' + id + '"' + (ligado ? ' checked' : '') + '><span></span></span>' +
      '<span class="g-cofre__flag-texto">' + u.esc(texto) + '</span></label>';
  }

  /** novoFunc: registro ativo sugerido para o transferido (pré-escolhido; a TI confere e salva). */
  function formulario(a, tipoInicial, novoFunc) {
    var novo = !a;
    var inicial = tipoConta(tipoInicial) || tiposConta().filter(function (t) { return t.ativo; })[0] || { codigo: null, modelo: 'O' };
    var v = a || { codTipo: inicial.codigo, tipo: inicial.modelo, ativo: true, generica: false };
    if (!tiposConta().some(function (t) { return t.ativo || t.codigo === v.codTipo; })) {
      CtiApp.erro('Nenhum tipo de conta ativo. O SUP cadastra os tipos em Configurações › Cofre.');
      return;
    }
    var dom = estadoCofre().dominios;
    var partes = v.tipo === 'E' && v.login ? v.login.split('@') : ['', ''];
    var dominioAtual = partes[1] || ((dom.filter(function (d) { return d.ativo; })[0] || {}).dominio || '');
    var opcoesDominio = dom.filter(function (d) { return d.ativo || d.dominio === dominioAtual; }).map(function (d) {
      return u.opcao(d.dominio, '@' + d.dominio + (d.ativo ? '' : ' (inativo)'), dominioAtual);
    }).join('');
    var funcSel = novoFunc || (v.codFunc ? { codEmp: v.codEmp, codFunc: v.codFunc, nomeFunc: v.nomeFunc, cargo: v.cargo, departamento: v.departamento } : null);
    // Conta que já existe na HostGator: o cPanel não renomeia e-mail, então o endereço fica fixo.
    var fixaNaHostGator = !novo && naHostGator(v.login) && !!natureza(v.tipo, v.equipamento, v.login);

    CtiApp.abrirModal({
      titulo: novo ? 'Novo acesso' : 'Editar acesso',
      tamanho: 'cofre',
      // Colegas veem na grade e no modal que este acesso está sendo alterado.
      registro: novo ? null : { entidade: 'A', id: a.idAcesso, editando: true },
      corpo:
        '<form class="g-form g-cofre__form" id="cr-form" novalidate autocomplete="off">' +
          '<div class="g-cofre__topo">' +
            '<label class="g-campo"><span class="g-obrigatorio">Tipo de conta</span><select id="ca-tipo">' +
              tiposConta().filter(function (t) { return t.ativo || t.codigo === v.codTipo; }).map(function (t) {
                var m = modelo(t);
                return u.opcao(t.codigo, t.nome + (t.ativo ? '' : ' (desativado)'), v.codTipo, { icone: iconeTipo(t), cor: m.cor });
              }).join('') +
            '</select></label>' +
            '<div class="g-cofre__topo-flags">' +
              flag('ca-ferias', v.ferias, 'Em férias', 'Os destinos recebem uma cópia das mensagens enquanto estiver ligado; ao desligar, o redirecionamento sai', 'ca-ferias-campo') +
              (novo ? '' : flag('ca-ativo', v.ativo, 'Acesso ativo', 'Desligue quando a conta for desativada')) +
            '</div>' +
          '</div>' +

          // 1. Quem usa: funcionário da folha (ou responsável da Starlink), conta genérica e departamento.
          '<section class="g-cofre__bloco" id="ca-bloco-func"><div class="g-cofre__bloco-titulo"><i class="ri-user-line" aria-hidden="true"></i><span id="ca-func-titulo">Funcionário</span>' +
            '<small id="ca-func-nota">cargo e unidade vêm da folha</small></div>' +
            // Linha 1: funcionário da folha (ou nome da conta genérica) + conta genérica / responsável digitado.
            '<div class="g-cofre__linha-func">' +
              '<div class="g-cofre__func-area">' +
                '<div id="ca-func-atual"></div>' +
                '<div class="g-cofre__busca-func" id="ca-func-busca">' +
                  '<span class="g-cofre__rotulo" id="ca-func-rotulo">Funcionário da folha</span>' +
                  '<input type="search" id="ca-func-termo" placeholder="Buscar por nome ou código" autocomplete="off"' +
                    ' role="combobox" aria-expanded="false" aria-controls="ca-func-resultados" aria-labelledby="ca-func-rotulo">' +
                  '<div class="g-cofre__resultados" id="ca-func-resultados" role="listbox" hidden></div>' +
                '</div>' +
                // Conta genérica não tem funcionário: o nome dela identifica de quem é (setor, função...).
                '<label class="g-campo g-cofre__campo" id="ca-nome-conta" data-tipos="ET"><span class="g-obrigatorio">Nome da conta genérica</span>' +
                  '<input type="text" id="ca-desc-et" maxlength="100" value="' + u.esc(v.tipo === 'E' || v.tipo === 'T' ? v.descricao || '' : '') + '"' +
                  ' placeholder="Ex.: Compras - caixa do setor"></label>' +
              '</div>' +
              flag('ca-generica', v.generica, 'Conta genérica', 'Setor, estagiário, serviço: sem funcionário e sem alerta de desligamento', 'ca-generica-campo') +
              campo('S', '<label class="g-campo"><span>Responsável sem cadastro</span><input type="text" id="ca-responsavel" maxlength="100" value="' + u.esc(v.responsavel || '') + '"' +
                ' placeholder="Ex.: Caminhão oficina"></label>', 'ca-resp-livre') +
            '</div>' +
            // Linha 2 (Starlink): departamento da folha ou, se particular, o proprietário.
            campo('S', '<div class="g-cofre__linha-dep">' +
              '<div class="g-cofre__busca-func" id="ca-dep-campo">' +
                '<span class="g-cofre__rotulo" id="ca-dep-rotulo">Departamento</span>' +
                '<input type="search" id="ca-dep-termo" value="' + u.esc(v.codDep ? v.departamentoAcesso || '' : '') + '" placeholder="Buscar departamento da folha" autocomplete="off"' +
                  ' role="combobox" aria-expanded="false" aria-controls="ca-dep-resultados" aria-labelledby="ca-dep-rotulo">' +
                '<input type="hidden" id="ca-dep-cod" value="' + (v.codDep ? Number(v.codDep) : '') + '">' +
                '<div class="g-cofre__resultados" id="ca-dep-resultados" role="listbox" hidden></div>' +
                '<small class="g-form__nota" id="ca-dep-nota"></small></div>' +
              '<label class="g-campo" id="ca-proprietario-campo"><span class="g-obrigatorio">Proprietário</span>' +
                '<input type="text" id="ca-proprietario" maxlength="100" value="' + u.esc(v.proprietario || '') + '" placeholder="Nome do dono"></label>' +
              flag('ca-particular', v.particular, 'Particular', 'Particular do proprietário: não é de um departamento da empresa') +
            '</div>') +
          '</section>' +

          // 2. Login e senha lado a lado.
          '<section class="g-cofre__bloco"><div class="g-cofre__bloco-titulo"><i class="ri-lock-password-line" aria-hidden="true"></i>Login e senha' +
            '<span class="g-selo g-cofre__hg" id="ca-hg" hidden></span></div>' +
            (fixaNaHostGator ? '<p class="g-dica g-cofre__hg-dica"><i class="ri-information-line" aria-hidden="true"></i> ' +
              'O endereço já existe na HostGator e não pode ser trocado: para outro endereço, exclua esta conta e cadastre a nova.</p>' : '') +
            '<div class="g-cofre__grade2">' +
              campo('E', '<div class="g-campo"><span class="g-cofre__rotulo-linha"><span class="g-obrigatorio">E-mail</span>' +
                '<button type="button" class="g-btn g-btn--link" id="ca-sugerir" hidden>Sugerir pelo nome</button></span><div class="g-cofre__email">' +
                '<input type="text" id="ca-email-local" value="' + u.esc(partes[0]) + '" placeholder="nome.sobrenome" aria-label="Usuário do e-mail">' +
                '<select id="ca-email-dominio" aria-label="Domínio">' + opcoesDominio + '</select></div></div>') +
              campo('T', '<label class="g-campo"><span class="g-obrigatorio">Usuário</span>' +
                '<input type="text" id="ca-login-t" maxlength="150" value="' + u.esc(v.tipo === 'T' ? v.login || '' : '') + '"></label>') +
              campo('S', '<label class="g-campo"><span>E-mail de acesso</span>' +
                '<input type="email" id="ca-login-s" maxlength="150" value="' + u.esc(v.tipo === 'S' ? v.login || '' : '') + '"></label>') +
              campo('O', '<label class="g-campo"><span>Login</span>' +
                '<input type="text" id="ca-login-o" maxlength="150" value="' + u.esc(v.tipo === 'O' ? v.login || '' : '') + '"></label>') +
              '<div class="g-campo"><span class="g-cofre__rotulo-linha"><span>' + (novo ? 'Senha' : 'Nova senha') + '</span>' +
                flag('ca-simbolos', true, 'com símbolos', 'Gerar senha com símbolos') + '</span>' +
                '<div class="g-cofre__senha-campo">' +
                '<input type="password" id="ca-senha" maxlength="128" autocomplete="new-password" spellcheck="false"' +
                  (novo ? '' : ' placeholder="Em branco mantém a atual"') + '>' +
                '<button type="button" class="g-icone-btn" id="ca-senha-ver" title="Mostrar senha" aria-label="Mostrar senha">' +
                  '<i class="ri-eye-line" aria-hidden="true"></i></button>' +
                '<button type="button" class="g-btn g-btn--fantasma" id="ca-gerar" title="Gerar senha aleatória"><i class="ri-magic-line" aria-hidden="true"></i> Gerar</button>' +
              '</div></div>' +
            '</div>' +
          '</section>' +

          // 2b. Destinos do redirecionamento (e-mail de categoria R, Starlink) ou das férias.
          '<section class="g-cofre__bloco" id="ca-bloco-destinos" hidden><div class="g-cofre__bloco-titulo"><i class="ri-share-forward-line" aria-hidden="true"></i>' +
            '<span id="ca-dest-titulo">Redireciona para</span><small id="ca-dest-nota"></small></div>' +
            '<div class="g-cofre__destinos-lista" id="ca-destinos" role="list"></div>' +
            '<button type="button" class="g-btn g-btn--fantasma g-cofre__dest-add" id="ca-dest-add"><i class="ri-add-line" aria-hidden="true"></i> Adicionar destino</button>' +
          '</section>' +

          // 3. Detalhes do tipo (equipamento, kit, pasta...) e observação.
          '<section class="g-cofre__bloco"><div class="g-cofre__bloco-titulo"><i class="ri-list-settings-line" aria-hidden="true"></i>Detalhes</div>' +
            '<div class="g-cofre__detalhes">' +
              campo('O', '<label class="g-campo"><span class="g-obrigatorio">Serviço / site</span>' +
                '<input type="text" id="ca-desc-o" maxlength="100" value="' + u.esc(v.tipo === 'O' ? v.descricao || '' : '') + '" placeholder="Ex.: Mercado Livre - Central"></label>') +
              campo('O', '<label class="g-campo"><span>Endereço</span>' +
                '<input type="url" id="ca-url" maxlength="300" value="' + u.esc(v.url || '') + '" placeholder="https://"></label>') +
              campo('E', '<label class="g-campo"><span>Equipamento</span><select id="ca-equip-e">' +
                opcoesEquipamento(v.tipo === 'E' ? v.equipamento : null) + '</select></label>') +
              campo('S', '<label class="g-campo"><span>Identificação</span>' +
                '<input type="text" id="ca-desc-s" maxlength="100" value="' + u.esc(v.tipo === 'S' ? v.descricao || '' : '') + '" placeholder="Opcional. Ex.: Viveiro"></label>') +
              campo('S', '<label class="g-campo"><span>Kit</span><select id="ca-equip-s">' + opcoesKit(v.tipo === 'S' ? v.equipamento : null) + '</select></label>') +
              campo('S', '<label class="g-campo"><span>Dia de ativação</span>' +
                '<input type="number" id="ca-dia" min="1" max="31" step="1" value="' + (v.diaAtivacao ? Number(v.diaAtivacao) : '') + '" placeholder="1 a 31"></label>') +
              campo('T', '<label class="g-campo"><span>Pasta</span>' +
                '<input type="text" id="ca-pasta" maxlength="100" value="' + u.esc(v.pasta || '') + '"></label>') +
              campo('T', '<label class="g-campo"><span>Horário</span>' +
                '<input type="text" id="ca-horario" maxlength="20" value="' + u.esc(v.horario || '') + '" placeholder="Ex.: 16H"></label>') +
              '<label class="g-campo g-cofre__campo-obs"><span>Observação</span>' +
                '<textarea id="ca-obs" maxlength="400" rows="2">' + u.esc(v.obs || '') + '</textarea></label>' +
            '</div>' +
          '</section>' +
        '</form>',
      rodape:
        '<button type="button" class="g-btn g-btn--cancelar" id="ca-cancelar">Cancelar</button>' +
        '<button type="button" class="g-btn g-btn--primario" id="ca-salvar"><i class="ri-save-line" aria-hidden="true"></i> Salvar</button>'
    });

    var form = u.el('cr-form');
    CtiApp.vigiarFormulario(form);
    /** Modelo (E, T, S, O) do tipo de conta escolhido: decide os campos visíveis. */
    var tipo = function () { return (tipoConta(u.el('ca-tipo').value) || {}).modelo || 'O'; };

    // ----- destinos (redirecionamento e férias)
    var destinosIniciais = (v.destinos || []).slice();
    if (!destinosIniciais.length && novo && estadoCofre().destinoStarlink) {
      form.dataset.destPadrao = estadoCofre().destinoStarlink;
    }
    function linhaDestino(valorDest) {
      var div = document.createElement('div');
      div.className = 'g-cofre__destino';
      div.setAttribute('role', 'listitem');
      div.innerHTML = '<input type="email" maxlength="150" class="ca-destino" placeholder="colega@empresa.com.br" aria-label="E-mail de destino" value="' + u.esc(valorDest || '') + '">' +
        '<button type="button" class="g-icone-btn g-icone-btn--fechar" data-dest-remover title="Remover destino" aria-label="Remover destino">' +
        '<i class="ri-close-line" aria-hidden="true"></i></button>';
      u.el('ca-destinos').appendChild(div);
      return div.querySelector('input');
    }
    function contarDestinos() {
      var n = u.el('ca-destinos').children.length;
      u.el('ca-destinos').classList.toggle('g-cofre__destinos-lista--rolagem', n > 6);
    }
    destinosIniciais.forEach(linhaDestino);
    u.el('ca-dest-add').addEventListener('click', function () {
      var campoNovo = linhaDestino('');
      contarDestinos();
      form.dataset.sujo = 'S';
      campoNovo.focus();
    });
    u.el('ca-destinos').addEventListener('click', function (e) {
      var b = e.target.closest('[data-dest-remover]');
      if (!b) { return; }
      b.parentNode.remove();
      contarDestinos();
      form.dataset.sujo = 'S';
    });
    contarDestinos();

    function loginAtual() {
      var t = tipo();
      if (t === 'E') {
        var local = u.el('ca-email-local').value.trim();
        return local ? (local + '@' + u.el('ca-email-dominio').value).toLowerCase() : '';
      }
      return t === 'S' ? u.el('ca-login-s').value.trim().toLowerCase() : '';
    }
    /** Selo "na HostGator", interruptor de férias e bloco de destinos conforme tipo, equipamento e domínio. */
    function aplicarHostGator() {
      var t = tipo();
      var login = loginAtual();
      var nat = natureza(t, u.el('ca-equip-e').value, login || (t === 'S' || t === 'E' ? 'x@' : ''));
      var caixa = t === 'E' && nat === 'CAIXA';
      u.el('ca-ferias-campo').hidden = !caixa;
      if (!caixa) { u.el('ca-ferias').checked = false; }
      var ferias = caixa && u.el('ca-ferias').checked;
      var usa = (nat === 'REDIR' && (t === 'E' || login)) || ferias;
      u.el('ca-bloco-destinos').hidden = !usa;
      u.el('ca-dest-titulo').textContent = ferias ? 'Durante as férias, enviar cópia para' : 'Redireciona para';
      u.el('ca-dest-nota').textContent = ferias ? 'a caixa continua recebendo; ao desligar "Em férias" o redirecionamento sai'
        : (t === 'S' ? 'padrão: e-mail do TI (Configurações › HostGator)' : 'um ou mais e-mails; use + para incluir');
      if (usa && !u.el('ca-destinos').children.length) {
        linhaDestino(t === 'S' && form.dataset.destPadrao ? form.dataset.destPadrao : '');
        contarDestinos();
      }
      var selo = u.el('ca-hg');
      var gerenciado = !!login && naHostGator(login) && !!nat;
      selo.hidden = (t !== 'E' && t !== 'S') || !login;
      selo.className = 'g-selo g-cofre__hg' + (gerenciado ? ' g-cofre__hg--sim' : '');
      selo.innerHTML = gerenciado
        ? '<i class="ri-cloud-line" aria-hidden="true"></i>' + (nat === 'REDIR' ? 'Redirecionamento na HostGator' : 'Caixa na HostGator')
        : '<i class="ri-database-2-line" aria-hidden="true"></i>Só no cofre';
      selo.title = gerenciado ? 'Ao salvar, a mudança também é feita na HostGator.' : 'Domínio não gerenciado pela HostGator ou integração desligada.';
    }

    function aplicarTipo() {
      var t = tipo();
      form.dataset.modelo = t;
      u.cada(form, '[data-tipos]', function (c) { c.hidden = c.dataset.tipos.indexOf(t) < 0; });
      // Site ou sistema não é de funcionário; só aparece se o acesso antigo já tiver um ligado.
      u.el('ca-bloco-func').hidden = t === 'O' && !funcSel;
      u.el('ca-nome-conta').hidden = 'ET'.indexOf(t) < 0 || !u.el('ca-generica').checked;
      if (!u.el('ca-nome-conta').hidden) { u.el('ca-func-busca').hidden = true; }
      u.el('ca-generica-campo').hidden = 'ET'.indexOf(t) < 0;
      u.el('ca-func-titulo').textContent = t === 'S' ? 'Responsável' : 'Funcionário';
      u.el('ca-func-nota').textContent = t === 'S' ? 'funcionário da folha alocado; se não houver, digite o nome ao lado' : 'cargo e unidade vêm da folha';
      u.el('ca-func-rotulo').textContent = t === 'S' ? 'Funcionário alocado' : 'Funcionário da folha';
      aplicarStarlink();
      atualizarSugestao();
      aplicarHostGator();
    }
    function aplicarStarlink() {
      var termoDep = u.el('ca-dep-termo');
      if (!u.el('ca-dep-cod').value && (termoDep.dataset.auto === 'S' || !termoDep.value.trim())) {
        // Preenche com o departamento do responsável; sem código salvo, acompanha a folha.
        termoDep.value = funcSel && funcSel.departamento ? funcSel.departamento : '';
        termoDep.dataset.auto = termoDep.value ? 'S' : '';
      }
      var particular = u.el('ca-particular').checked;
      u.el('ca-proprietario-campo').hidden = !particular;
      u.el('ca-dep-campo').hidden = particular;
      u.el('ca-resp-livre').hidden = tipo() !== 'S' || !!funcSel;
      u.el('ca-resp-livre').parentNode.classList.toggle('g-cofre__linha-func--dupla', !u.el('ca-resp-livre').hidden);
      u.el('ca-dep-nota').textContent = u.el('ca-dep-termo').dataset.auto === 'S'
        ? 'Departamento do responsável na folha (muda junto se ele for transferido). Busque outro para fixar.'
        : (funcSel ? '' : 'Obrigatório quando não há funcionário alocado.');
    }
    function aplicarGenerica() {
      var generica = u.el('ca-generica').checked;
      if (generica) { funcSel = null; }
      u.el('ca-func-busca').hidden = generica || !!funcSel;
      aplicarTipo();
      pintarFuncionario();
    }
    function pintarFuncionario() {
      var alvo = u.el('ca-func-atual');
      if (!funcSel) {
        alvo.innerHTML = '';
        u.el('ca-func-busca').hidden = u.el('ca-generica').checked && tipo() !== 'S';
        aplicarStarlink();
        atualizarSugestao();
        return;
      }
      alvo.innerHTML = '<div class="g-cofre__func-escolhido"><i class="ri-user-line" aria-hidden="true"></i>' +
        '<span class="g-cofre__func">' + u.esc(funcSel.nomeFunc || 'Funcionário') + '<small>Empresa ' + Number(funcSel.codEmp) +
        ' · código ' + Number(funcSel.codFunc) + (funcSel.cargo ? ' · ' + u.esc(funcSel.cargo) : '') + '</small></span>' +
        '<span class="g-cofre__unidade"><small>Unidade</small>' + u.esc(funcSel.departamento || '—') + '</span>' +
        '<button type="button" class="g-btn g-btn--fantasma g-btn--p" id="ca-func-trocar">Trocar</button></div>';
      u.el('ca-func-busca').hidden = true;
      aplicarStarlink();
      u.el('ca-func-trocar').addEventListener('click', function () {
        funcSel = null;
        form.dataset.sujo = 'S';
        pintarFuncionario();
        u.el('ca-func-termo').focus();
      });
      atualizarSugestao();
    }
    function atualizarSugestao() {
      if (!u.el('ca-sugerir')) { return; }
      u.el('ca-sugerir').hidden = !(tipo() === 'E' && funcSel && funcSel.nomeFunc);
    }

    var esperaBusca = null;
    var ativo = -1;
    // Setas e Enter percorrem a lista como num select; Esc fecha só a lista.
    u.el('ca-func-termo').addEventListener('keydown', function (e) {
      var alvo = u.el('ca-func-resultados');
      var itens = alvo.hidden ? [] : Array.prototype.slice.call(alvo.querySelectorAll('[data-func]'));
      if (!itens.length) { return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        ativo = (ativo + (e.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length;
        itens.forEach(function (b, i) { b.classList.toggle('g-cofre__resultado--ativo', i === ativo); });
        itens[ativo].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        (itens[ativo] || itens[0]).click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        alvo.hidden = true;
        e.target.setAttribute('aria-expanded', 'false');
      }
    });
    u.el('ca-func-termo').addEventListener('input', function (e) {
      clearTimeout(esperaBusca);
      var termo = e.target.value.trim();
      var alvo = u.el('ca-func-resultados');
      var mostrar = function (html) {
        alvo.innerHTML = html;
        alvo.hidden = !html;
        e.target.setAttribute('aria-expanded', html ? 'true' : 'false');
      };
      if (termo.length < 2) { mostrar(''); return; }
      esperaBusca = setTimeout(function () {
        CtiApp.dados.buscarFuncionarios(termo).then(function (lista) {
          if (u.el('ca-func-termo') !== e.target || e.target.value.trim() !== termo) { return; }
          mostrar('<div class="g-cofre__resultados-cab"><i class="ri-user-search-line" aria-hidden="true"></i>' +
            (lista.length ? u.plural(lista.length, 'funcionário encontrado', 'funcionários encontrados') + ' · clique para escolher'
              : 'Nenhum funcionário ativo encontrado') + '</div>' +
            (lista.length ? '<div class="g-cofre__resultado g-cofre__res-titulos" aria-hidden="true"><span>Funcionário</span><span>Emp./Cód.</span>' +
              '<span>Cargo</span><span>Unidade</span><span>Empresa</span></div>' : '') +
            lista.map(function (f, i) {
              return '<button type="button" class="g-cofre__resultado" role="option" data-func="' + i + '" tabindex="-1">' +
                '<span class="g-cofre__res-nome">' + u.esc(f.nomeFunc) + '</span>' +
                '<span class="g-cofre__res-cod">' + Number(f.codEmp) + '/' + Number(f.codFunc) + '</span>' +
                '<span class="g-cofre__res-dado">' + u.esc(f.cargo || '—') + '</span>' +
                '<span class="g-cofre__res-dado">' + u.esc(f.departamento || '—') + '</span>' +
                '<span class="g-cofre__res-dado">' + u.esc(f.nomeEmpresa || '') + '</span></button>';
            }).join(''));
          ativo = -1;
          alvo.onclick = function (ev) {
            var b = ev.target.closest('[data-func]');
            if (!b) { return; }
            funcSel = lista[Number(b.dataset.func)];
            u.el('ca-generica').checked = false;
            mostrar('');
            e.target.value = '';
            aplicarTipo();
            pintarFuncionario();
          };
        }, function (erro) { mostrar('<div class="g-cofre__resultados-cab">' + u.esc(CtiApi.textoDoErro(erro)) + '</div>'); });
      }, 300);
    });

    u.el('ca-sugerir').addEventListener('click', function () {
      u.el('ca-email-local').value = sugestaoEmail(funcSel.nomeFunc);
      form.dataset.sujo = 'S';
    });
    u.el('ca-senha-ver').addEventListener('click', function () {
      var campoSenha = u.el('ca-senha');
      var mostrar = campoSenha.type === 'password';
      campoSenha.type = mostrar ? 'text' : 'password';
      u.el('ca-senha-ver').innerHTML = '<i class="' + (mostrar ? 'ri-eye-off-line' : 'ri-eye-line') + '" aria-hidden="true"></i>';
    });
    u.el('ca-gerar').addEventListener('click', function () {
      CtiApp.ocupado(u.el('ca-gerar'), CtiApp.dados.gerarSenha({ tamanho: 14, simbolos: u.el('ca-simbolos').checked }))
        .then(function (senha) {
          var campoSenha = u.el('ca-senha');
          campoSenha.value = senha;
          campoSenha.type = 'text';
          u.el('ca-senha-ver').innerHTML = '<i class="ri-eye-off-line" aria-hidden="true"></i>';
          form.dataset.sujo = 'S';
        }, function (e) { CtiApp.falhaAoGravar(e, 'Não foi possível gerar a senha: '); });
    });
    u.el('ca-tipo').addEventListener('change', aplicarTipo);
    ['ca-equip-e', 'ca-email-dominio', 'ca-ferias'].forEach(function (id) { u.el(id).addEventListener('change', aplicarHostGator); });
    ['ca-email-local', 'ca-login-s'].forEach(function (id) { u.el(id).addEventListener('input', aplicarHostGator); });
    if (fixaNaHostGator) {
      ['ca-email-local', 'ca-email-dominio', 'ca-login-s'].forEach(function (id) {
        u.el(id).disabled = true;
        u.el(id).title = 'O endereço já existe na HostGator e não pode ser trocado.';
      });
      u.el('ca-sugerir').remove();
    }
    u.el('ca-particular').addEventListener('change', aplicarStarlink);
    ligarBuscaDepartamento();
    u.el('ca-generica').addEventListener('change', aplicarGenerica);
    u.el('ca-cancelar').addEventListener('click', function () { CtiApp.fecharModal(false); });
    u.el('ca-salvar').addEventListener('click', function () { salvar(a, funcSel); });
    aplicarTipo();
    pintarFuncionario();
    if (novoFunc) {
      form.dataset.sujo = 'S';
      CtiApp.aviso('Funcionário trocado para o registro ativo ' + Number(novoFunc.codEmp) + '/' + Number(novoFunc.codFunc) + '. Confira e salve.', 'info');
    }
  }

  /** Busca de departamento da folha (TFPDEP) na Starlink: lista suspensa como a de funcionário. */
  function ligarBuscaDepartamento() {
    var termo = u.el('ca-dep-termo');
    var cod = u.el('ca-dep-cod');
    var alvo = u.el('ca-dep-resultados');
    var espera = null;
    var mostrar = function (html) {
      alvo.innerHTML = html;
      alvo.hidden = !html;
      termo.setAttribute('aria-expanded', html ? 'true' : 'false');
    };
    termo.addEventListener('input', function () {
      cod.value = '';
      termo.dataset.auto = '';
      clearTimeout(espera);
      var t = termo.value.trim();
      if (t.length < 2) { mostrar(''); return; }
      espera = setTimeout(function () {
        CtiApp.dados.buscarDepartamentos(t).then(function (lista) {
          if (termo.value.trim() !== t) { return; }
          mostrar('<div class="g-cofre__resultados-cab"><i class="ri-building-2-line" aria-hidden="true"></i>' +
            (lista.length ? u.plural(lista.length, 'departamento', 'departamentos') + ' · clique para escolher' : 'Nenhum departamento encontrado') + '</div>' +
            lista.map(function (d, i) {
              return '<button type="button" class="g-cofre__resultado g-cofre__resultado--dep" role="option" data-dep="' + i + '" tabindex="-1">' +
                '<span class="g-cofre__res-nome">' + u.esc(d.descrDep) + '</span><span class="g-cofre__res-cod">' + Number(d.codDep) + '</span></button>';
            }).join(''));
          alvo.onclick = function (ev) {
            var b = ev.target.closest('[data-dep]');
            if (!b) { return; }
            var d = lista[Number(b.dataset.dep)];
            cod.value = d.codDep;
            termo.value = d.descrDep;
            mostrar('');
          };
        }, function (erro) { mostrar('<div class="g-cofre__resultados-cab">' + u.esc(CtiApi.textoDoErro(erro)) + '</div>'); });
      }, 300);
    });
    termo.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !alvo.hidden) { e.preventDefault(); e.stopPropagation(); mostrar(''); }
      if (e.key === 'Enter') {
        e.preventDefault();
        var primeiro = alvo.querySelector('[data-dep]');
        if (primeiro) { primeiro.click(); }
      }
    });
  }

  /** Kits padrão da Starlink; valor antigo fora da lista (ex.: "FIXA - GEN2" da planilha) continua aparecendo. */
  var KITS_STARLINK = ['GEN1', 'GEN2', 'GEN3', 'MINI'];
  var ICONE_KIT = 'ti-satellite';
  function opcoesKit(atual) {
    var lista = KITS_STARLINK.slice();
    if (atual && lista.indexOf(atual) < 0) { lista.push(atual); }
    return u.opcao('', 'Não informado', atual || '') + lista.map(function (k) {
      var rotulo = { GEN1: 'Gen1', GEN2: 'Gen2', GEN3: 'Gen3', MINI: 'Mini' }[k] || k + ' (fora do padrão)';
      return u.opcao(k, rotulo, atual, { icone: ICONE_KIT });
    }).join('');
  }
  function rotuloKit(k) { return { GEN1: 'Gen1', GEN2: 'Gen2', GEN3: 'Gen3', MINI: 'Mini' }[k] || k; }

  /**
   * Tipos ativos do cadastro (Configurações › Cofre). O valor já gravado fica
   * na lista mesmo inativo ou fora do cadastro (dado antigo da planilha).
   */
  function opcoesEquipamento(atual) {
    var lista = (estadoCofre().equipamentos || []).filter(function (e) { return e.ativo; }).map(function (e) { return e.nome; });
    if (atual && lista.indexOf(atual) < 0) { lista.push(atual); }
    return u.opcao('', 'Não informado', atual || '') + lista.map(function (nome) {
      var eq = tipoEquipamento(nome);
      var cadastrado = !!eq && eq.ativo;
      return u.opcao(nome, nome + (cadastrado ? '' : ' (fora do cadastro)'), atual,
        eq ? { icone: u.icone(eq.icone, ICONE_EQUIP), cor: corEquip(eq) } : null);
    }).join('');
  }

  /** "MARIA DA SILVA SOUZA" -> "maria.souza" (sem acento, primeiro e último nome). */
  function sugestaoEmail(nome) {
    var partes = u.normal(nome || '').replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(function (p) {
      return p && ['da', 'de', 'do', 'das', 'dos', 'e'].indexOf(p) < 0;
    });
    if (!partes.length) { return ''; }
    return partes.length === 1 ? partes[0] : partes[0] + '.' + partes[partes.length - 1];
  }

  function valor(id) {
    var el = u.el(id);
    return el && !el.closest('[hidden]') ? el.value.trim() : '';
  }

  /** Destinos digitados (linhas vazias saem); o servidor confere formato e repetição. */
  function destinosDoForm() {
    if (u.el('ca-bloco-destinos').hidden) { return []; }
    return Array.prototype.map.call(u.el('ca-destinos').querySelectorAll('.ca-destino'), function (i) { return i.value.trim(); })
      .filter(Boolean);
  }

  function salvar(a, funcSel) {
    var codTipo = u.el('ca-tipo').value;
    var t = (tipoConta(codTipo) || {}).modelo || 'O';
    var login = { E: '', T: valor('ca-login-t'), S: valor('ca-login-s'), O: valor('ca-login-o') }[t];
    if (t === 'E') {
      var local = valor('ca-email-local');
      login = local ? local + '@' + u.el('ca-email-dominio').value : '';
    }
    var dto = {
      idAcesso: a ? a.idAcesso : null,
      versao: a ? a.versao : null,
      codTipo: codTipo,
      codEmp: funcSel ? funcSel.codEmp : null,
      codFunc: funcSel ? funcSel.codFunc : null,
      generica: u.el('ca-generica').checked,
      login: login,
      senha: u.el('ca-senha').value,
      descricao: { E: valor('ca-desc-et'), T: valor('ca-desc-et'), S: valor('ca-desc-s'), O: valor('ca-desc-o') }[t],
      // Unidade vem da folha; o valor gravado só se mantém enquanto o funcionário não muda (dado antigo).
      unidade: a && (a.codFunc || null) === (funcSel ? funcSel.codFunc : null) && (a.codEmp || null) === (funcSel ? funcSel.codEmp : null) ? a.unidade : null,
      equipamento: t === 'E' ? valor('ca-equip-e') : (t === 'S' ? valor('ca-equip-s') : ''),
      pasta: valor('ca-pasta'),
      horario: valor('ca-horario'),
      url: valor('ca-url'),
      responsavel: valor('ca-responsavel'),
      codDep: t === 'S' && valor('ca-dep-cod') ? Number(valor('ca-dep-cod')) : null,
      particular: t === 'S' && u.el('ca-particular').checked,
      proprietario: valor('ca-proprietario'),
      diaAtivacao: t === 'S' && valor('ca-dia') ? Number(valor('ca-dia')) : null,
      obs: u.el('ca-obs').value.trim(),
      ativo: a ? u.el('ca-ativo').checked : true,
      ferias: t === 'E' && !u.el('ca-ferias-campo').hidden && u.el('ca-ferias').checked,
      destinos: destinosDoForm()
    };
    var nat = natureza(t, dto.equipamento, login);
    var promessa = CtiApp.dados.salvarAcesso(dto);
    if (nat && naHostGator(login)) {
      promessa = CtiApp.esperar(textoDaGravacao(a, nat, !a || !naHostGator(a.login), !!dto.senha, dto.ferias), promessa);
    }
    CtiApp.ocupado(u.el('ca-salvar'), promessa).then(function () {
      CtiApp.fecharModal(true);
      CtiApp.sucesso(a ? 'Acesso atualizado.' : 'Acesso cadastrado.');
      if (modo === 'grade' && aba !== 'P') { aba = codTipo; }
      return CtiApp.recarregar(['cofre']);
    }, function (e) { CtiApp.falhaAoGravar(e, 'O acesso não foi salvo: '); });
  }

  // ====================================================== configurações

  /** Aba Cofre das Configurações: grupo com acesso, domínios e troca de chave. Só o SUP grava. */
  function pintarConfiguracao(alvo) {
    var c = estadoCofre();
    if (!c) {
      alvo.innerHTML = '<p class="g-vazio"><i class="ri-safe-2-line" aria-hidden="true"></i>Carregando o cofre…</p>';
      return;
    }
    var podeConfigurar = CtiApp.pode('configurar');
    var texto = c.grupoSenha
      ? 'Além do SUP, os usuários ativos do grupo <strong>' + u.esc(c.nomeGrupoSenha || String(c.grupoSenha)) + '</strong> abrem o cofre, veem e copiam senhas.'
      : 'Nenhum grupo escolhido: só o SUP abre o cofre.';
    var seletor = podeConfigurar
      ? '<div class="g-grupo"><label class="g-campo g-campo--inline"><span>Grupo com acesso</span>' +
          '<select id="cc-grupo">' + u.opcao('0', 'Só o SUP', c.grupoSenha) +
          (c.grupos || []).map(function (g) { return u.opcao(g.codGrupo, g.nomeGrupo + ' (' + g.codGrupo + ')', c.grupoSenha); }).join('') +
          '</select></label></div>'
      : '';
    /** metas: textos já escapados, um por <span>; editar: atributo do lápis (só para quem configura). */
    var item = function (atributo, nome, ativo, metas, icone, cor, editar) {
      return '<div class="g-item' + (ativo ? '' : ' g-item--inativo') + '" style="--c:' + u.cor(cor || '#3A7BEA') + '">' +
        '<span class="g-item__icone"><i class="' + u.icone(icone, 'ri-price-tag-3-line') + '" aria-hidden="true"></i></span>' +
        '<div class="g-item__corpo"><div class="g-item__nome" title="' + u.esc(nome) + '">' + u.esc(nome) + '</div>' +
          '<div class="g-item__meta">' + metas.map(function (m) { return '<span title="' + m + '">' + m + '</span>'; }).join('') + '</div></div>' +
        '<div class="g-item__acoes">' +
          '<label class="g-interruptor" title="' + (ativo ? 'Desativar' : 'Ativar') + '"><input type="checkbox" ' + atributo + '="' + u.esc(nome) + '"' +
            (ativo ? ' checked' : '') + (podeConfigurar ? '' : ' disabled') + ' aria-label="' + (ativo ? 'Desativar ' : 'Ativar ') + u.esc(nome) + '"><span></span></label>' +
          (podeConfigurar && editar ? '<button type="button" class="g-icone-btn" ' + editar + '="' + u.esc(nome) + '" title="Editar" aria-label="Editar ' +
            u.esc(nome) + '"><i class="ri-edit-line" aria-hidden="true"></i></button>' : '') +
        '</div></div>';
    };
    /** Lista de ativos em grade e inativos no grupo recolhível, como nas demais abas. */
    var cadastro = function (lista, render, vazio) {
      var ativos = lista.filter(function (x) { return x.ativo; });
      var inativos = lista.filter(function (x) { return !x.ativo; });
      return (ativos.length ? '<div class="g-grade">' + ativos.map(render).join('') + '</div>' : '<p class="g-vazio">' + vazio + '</p>') +
        (inativos.length ? '<details class="g-inativos"><summary class="g-inativos__cab"><i class="ri-arrow-right-s-line" aria-hidden="true"></i>Inativos' +
          '<span class="g-inativos__qtd">' + inativos.length + '</span></summary><div class="g-grade">' + inativos.map(render).join('') + '</div></details>' : '');
    };
    var botaoNovo = function (id, rotulo) {
      return podeConfigurar
        ? '<button type="button" class="g-btn g-btn--primario" id="' + id + '"><i class="ri-add-line" aria-hidden="true"></i> ' + rotulo + '</button>'
        : '';
    };
    alvo.innerHTML =
      '<section class="g-config-secao">' +
        '<div class="g-painel-cab"><div><h2>Acesso ao cofre</h2><p>' + texto + '</p></div>' + seletor + '</div>' +
      '</section>' +
      '<section class="g-config-secao">' +
        '<div class="g-painel-cab"><div><h2>Tipos de conta</h2><p>Viram os cards do cofre. O modelo define os campos do formulário: ' +
          'caixa de e-mail, usuário de rede e pasta, aparelho com conta ou site ou sistema.</p></div>' + botaoNovo('cc-novo-tipo', 'Novo tipo') + '</div>' +
        cadastro(c.tiposAcesso || [], function (t) {
          var m = modelo(t);
          return '<div class="g-item' + (t.ativo ? '' : ' g-item--inativo') + '" style="--c:' + u.cor(m.cor) + '">' +
            '<span class="g-item__icone"><i class="' + iconeTipo(t) + '" aria-hidden="true"></i></span>' +
            '<div class="g-item__corpo"><div class="g-item__nome">' + u.esc(t.nome) + '</div>' +
              '<div class="g-item__meta"><span title="Modelo: ' + u.esc(m.rotulo) + '">' + u.esc(u.plural(t.qtdAcessos || 0, m.unidade[0], m.unidade[1])) + '</span></div></div>' +
            '<div class="g-item__acoes">' +
              '<label class="g-interruptor" title="' + (t.ativo ? 'Desativar' : 'Ativar') + '"><input type="checkbox" data-tipo-acesso="' + u.esc(t.codigo) + '"' +
                (t.ativo ? ' checked' : '') + (podeConfigurar ? '' : ' disabled') + ' aria-label="' + (t.ativo ? 'Desativar ' : 'Ativar ') + u.esc(t.nome) + '"><span></span></label>' +
              (podeConfigurar ? '<button type="button" class="g-icone-btn" data-editar-tipo="' + u.esc(t.codigo) + '"  title="Editar nome e ícone" aria-label="Editar ' +
                u.esc(t.nome) + '"><i class="ri-edit-line" aria-hidden="true"></i></button>' : '') +
            '</div></div>';
        }, 'Nenhum tipo de conta ativo.') +
      '</section>' +
      '<section class="g-config-secao">' +
        '<div class="g-painel-cab"><div><h2>Domínios de e-mail</h2><p>E-mails novos do cofre só aceitam estes domínios.</p></div>' +
          botaoNovo('cc-novo-dominio', 'Novo domínio') + '</div>' +
        cadastro(c.dominios, function (d) {
          return item('data-dominio', d.dominio, d.ativo, [u.esc(u.plural(d.qtdAcessos || 0, 'e-mail', 'e-mails'))], 'ri-at-line', null, 'data-editar-dominio');
        }, 'Nenhum domínio ativo.') +
      '</section>' +
      '<section class="g-config-secao">' +
        '<div class="g-painel-cab"><div><h2>Tipos de equipamento</h2><p>Opções do campo Equipamento dos e-mails. O ícone e a cor aparecem na grade; sem cor escolhida, vale a da categoria.</p></div>' +
          botaoNovo('cc-novo-equip', 'Novo tipo') + '</div>' +
        cadastro(c.equipamentos || [], function (e) {
          // Categoria só quando diz algo além do nome (tipo "CORPORATIVO" da categoria Corporativo não repete).
          var cat = CATEGORIAS_EQUIP[categoriaEquip(e)].rotulo;
          var metas = [u.esc(u.plural(e.qtdAcessos || 0, 'e-mail', 'e-mails'))];
          if (u.normal(cat) !== u.normal(e.nome)) { metas.unshift(u.esc(cat)); }
          return item('data-equipamento', e.nome, e.ativo, metas,
            u.icone(e.icone, ICONE_EQUIP), corEquip(e), 'data-editar-equip');
        }, 'Nenhum tipo de equipamento ativo.') +
      '</section>' +
      // Importação da planilha desativada em 10/2026: a carga foi feita em produção. O método saiu do
      // controller (GestaoTiController.importarPlanilhaCofre, comentado); para voltar, descomente lá e aqui.
      // (podeConfigurar
      //   ? '<section class="g-config-secao"><div class="g-painel-cab"><div><h2>Importar planilha</h2><p>Traz os acessos da planilha ' +
      //     '"Lista de Acessos" (e-mails, pasta pública, senhas diversas e Starlink). Primeiro mostra o que vai entrar; ' +
      //     'e-mail ou usuário já cadastrado é pulado.</p></div>' +
      //     '<button type="button" class="g-btn g-btn--primario" id="cc-importar"><i class="ri-file-excel-2-line" aria-hidden="true"></i> Importar planilha</button></div></section>'
      //   : '') +
      (podeConfigurar
        ? '<section class="g-config-secao"><div class="g-painel-cab"><div><h2>Chave do cofre</h2><p>Gera uma chave nova e recifra todas as senhas numa só operação. ' +
          'Use se houver suspeita de que o banco ou o add-on vazaram.</p></div>' +
          '<button type="button" class="g-btn g-btn--perigo" id="cc-trocar-chave"><i class="ri-refresh-line" aria-hidden="true"></i> Trocar chave</button></div></section>'
        : '') +
      '<div class="g-nota"><i class="ri-shield-keyhole-line" aria-hidden="true"></i><div>As senhas ficam cifradas no banco (AES-256). ' +
        'A chave fica em partes na tabela CTI_COFRE, que precisa ir junto em todo backup: sem ela as senhas não abrem. ' +
        'Restrinja o DBExplorer no Sankhya: quem tem o banco e o add-on consegue remontar a chave. Cada senha vista ou copiada fica no Log do Gestão de TI.</div></div>';

    var grupo = u.el('cc-grupo');
    if (grupo) {
      // Trocar o grupo é alteração pendente: grava pelo rodapé fixo das Configurações.
      grupo.addEventListener('change', function () {
        if (String(grupo.value) === String(c.grupoSenha)) { CtiConfig.removerAlteracao('grupo-cofre'); return; }
        CtiConfig.registrarAlteracao('grupo-cofre', {
          nome: 'Trocar o grupo com acesso ao cofre',
          salvar: function () {
            return CtiApp.dados.salvarGrupoCofre({ codGrupo: Number(grupo.value), versao: c.versaoGrupoSenha })
              .then(function () { return true; });
          },
          aviso: function () {
            var novo = Number(grupo.value);
            return {
              titulo: 'Trocar o grupo do cofre?',
              mensagem: novo ? 'Os usuários ativos do grupo passam a ver e copiar todas as senhas.' : 'Só o SUP poderá abrir o cofre.',
              topico: novo ? 'Cofre: grupo ' + CtiConfig.aspas(grupo.options[grupo.selectedIndex].text) : 'Cofre: só o SUP'
            };
          }
        });
      });
    }
    ligarNovo('cc-novo-dominio', {
      titulo: 'Novo domínio de e-mail', rotulo: 'Domínio', placeholder: 'empresa.com.br', maximo: 100,
      nota: 'Só a parte depois do @. E-mails novos do cofre passam a aceitar este domínio.',
      gravar: function (nome) { return CtiApp.dados.salvarDominio({ dominio: nome, versao: null }); },
      mensagem: 'Domínio cadastrado.'
    });
    var novoEquip = u.el('cc-novo-equip');
    if (novoEquip) { novoEquip.addEventListener('click', function () { formularioEquipamento(null); }); }
    u.cada(alvo, '[data-editar-equip]', function (b) {
      b.addEventListener('click', function () { formularioEquipamento(tipoEquipamento(b.dataset.editarEquip)); });
    });
    u.cada(alvo, '[data-editar-dominio]', function (b) {
      b.addEventListener('click', function () { formularioDominio(u.porId(c.dominios, 'dominio', b.dataset.editarDominio)); });
    });
    var novoTipo = u.el('cc-novo-tipo');
    if (novoTipo) { novoTipo.addEventListener('click', function () { formularioTipo(null); }); }
    u.cada(alvo, '[data-editar-tipo]', function (b) {
      b.addEventListener('click', function () { formularioTipo(tipoConta(b.dataset.editarTipo)); });
    });
    u.cada(alvo, '[data-tipo-acesso]', function (cx) {
      cx.addEventListener('change', function () {
        var t = tipoConta(cx.dataset.tipoAcesso);
        CtiConfig.interruptorPendente(cx, 'tipo-acesso:' + t.codigo, 'o tipo de conta ' + CtiConfig.aspas(t.nome), function () {
          return CtiApp.dados.salvarTipoAcesso({ codigo: t.codigo, nome: t.nome, ativo: cx.checked, versao: t.versao }).then(function () { return true; });
        });
      });
    });
    u.cada(alvo, '[data-equipamento]', function (cx) {
      cx.addEventListener('change', function () {
        var eq = u.porId(c.equipamentos, 'nome', cx.dataset.equipamento);
        CtiConfig.interruptorPendente(cx, 'equipamento:' + eq.nome, 'o equipamento ' + CtiConfig.aspas(eq.nome), function () {
          return CtiApp.dados.salvarTipoEquipamento({ nome: eq.nome, icone: eq.icone, cor: eq.cor || null, categoria: categoriaEquip(eq), ativo: cx.checked, versao: eq.versao })
            .then(function () { return true; });
        });
      });
    });
    u.cada(alvo, '[data-dominio]', function (cx) {
      cx.addEventListener('change', function () {
        var d = u.porId(c.dominios, 'dominio', cx.dataset.dominio);
        CtiConfig.interruptorPendente(cx, 'dominio:' + d.dominio, 'o domínio ' + d.dominio, function () {
          return CtiApp.dados.salvarDominio({ dominio: d.dominio, ativo: cx.checked, versao: d.versao }).then(function () { return true; });
        });
      });
    });
    var importar = u.el('cc-importar');
    if (importar) { importar.addEventListener('click', formularioImportacao); }
    var trocar = u.el('cc-trocar-chave');
    if (trocar) {
      trocar.addEventListener('click', function () {
        CtiApp.confirmar({
          titulo: 'Trocar a chave do cofre?',
          mensagem: 'Todas as senhas são recifradas com uma chave nova. Backups antigos do banco deixam de abrir com a CTI_COFRE atual.',
          botao: 'Trocar chave', perigo: true
        }).then(function (ok) {
          if (!ok) { return; }
          CtiApp.ocupado(trocar, CtiApp.dados.trocarChaveCofre()).then(function (qtd) {
            CtiApp.sucesso('Chave trocada: ' + u.plural(qtd || 0, 'senha recifrada', 'senhas recifradas') + '.');
            return CtiApp.recarregar(['cofre']);
          }, function (e) { CtiApp.falhaAoGravar(e, 'A chave não foi trocada: '); });
        });
      });
    }
  }

  /** Novo tipo de conta (nome e modelo) ou renomear um existente (o modelo fica travado). */
  function formularioTipo(t) {
    var novo = !t;
    CtiApp.abrirModal({
      titulo: novo ? 'Novo tipo de conta' : 'Editar tipo de conta',
      tamanho: 'cofre',
      corpo: '<form class="g-form" id="cc-tipo-form" novalidate>' +
        '<label class="g-campo"><span class="g-obrigatorio">Nome</span>' +
          '<input type="text" id="cc-tipo-nome" maxlength="60" value="' + u.esc(novo ? '' : t.nome) + '" placeholder="Ex.: VPN, Wi-Fi, Sistemas web" autofocus></label>' +
        '<label class="g-campo"><span class="g-obrigatorio">Modelo</span><select id="cc-tipo-modelo"' + (novo ? '' : ' disabled') + '>' +
          Object.keys(MODELOS).map(function (m) {
            return u.opcao(m, MODELOS[m].rotulo, novo ? 'O' : t.modelo, { icone: MODELOS[m].icone, cor: MODELOS[m].cor });
          }).join('') + '</select></label>' +
        '<p class="g-form__nota" id="cc-tipo-nota"></p>' +
        '<div class="g-campo"><span>Ícone</span>' + CtiConfig.htmlSeletorIcones('ct', novo ? null : t.icone) + '</div></form>',
      rodape: '<button type="button" class="g-btn g-btn--cancelar" id="cc-tipo-cancelar">Cancelar</button>' +
        '<button type="button" class="g-btn g-btn--primario" id="cc-tipo-salvar"><i class="ri-save-line" aria-hidden="true"></i> Salvar</button>'
    });
    var form = u.el('cc-tipo-form');
    CtiApp.vigiarFormulario(form);
    var icone = novo ? null : t.icone;
    CtiConfig.ligarSeletorIcones('ct', function (i) { icone = i; form.dataset.sujo = 'S'; });
    var nota = function () {
      var m = MODELOS[u.el('cc-tipo-modelo').value];
      u.el('cc-tipo-nota').textContent = 'Campos: ' + m.nota + '. ' + (novo ? 'Escolha com cuidado: o modelo não muda depois de criado.' : 'O modelo não muda depois de criado.');
    };
    u.el('cc-tipo-modelo').addEventListener('change', nota);
    nota();
    var salvar = function () {
      var nome = u.el('cc-tipo-nome').value.trim();
      if (!nome) {
        CtiApp.erro('Nome do tipo de conta é obrigatório.');
        return;
      }
      var dto = novo ? { nome: nome, modelo: u.el('cc-tipo-modelo').value, icone: icone, versao: null }
        : { codigo: t.codigo, nome: nome, icone: icone, ativo: t.ativo, versao: t.versao };
      CtiApp.ocupado(u.el('cc-tipo-salvar'), CtiApp.dados.salvarTipoAcesso(dto)).then(function () {
        CtiApp.fecharModal(true);
        CtiApp.sucesso(novo ? 'Tipo de conta cadastrado.' : 'Tipo de conta renomeado.');
        return CtiApp.recarregar(['cofre']);
      }, function (e) { CtiApp.falhaAoGravar(e, 'O tipo de conta não foi salvo: '); });
    };
    u.el('cc-tipo-nome').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); salvar(); } });
    u.el('cc-tipo-cancelar').addEventListener('click', function () { CtiApp.fecharModal(false); });
    u.el('cc-tipo-salvar').addEventListener('click', salvar);
  }

  /**
   * Renomear domínio: o servidor troca o domínio no login de todos os e-mails
   * dele. Com e-mails em uso, pede confirmação antes (a caixa real no provedor não muda).
   */
  function formularioDominio(d) {
    var qtd = d.qtdAcessos || 0;
    CtiApp.abrirModal({
      titulo: 'Editar domínio',
      tamanho: 'estreito',
      corpo: '<form class="g-form" id="cc-dom-form" novalidate>' +
        '<label class="g-campo"><span class="g-obrigatorio">Domínio</span>' +
          '<input type="text" id="cc-dom-nome" maxlength="100" value="' + u.esc(d.dominio) + '" autofocus></label>' +
        '<p class="g-form__nota">' + u.esc(qtd
          ? 'Renomear troca o domínio no login ' + (qtd === 1 ? 'do e-mail' : 'dos ' + qtd + ' e-mails') + ' deste domínio, inclusive os desativados.'
          : 'Nenhum e-mail usa este domínio.') + '</p></form>',
      rodape: '<button type="button" class="g-btn g-btn--cancelar" id="cc-dom-cancelar">Cancelar</button>' +
        '<button type="button" class="g-btn g-btn--primario" id="cc-dom-salvar"><i class="ri-save-line" aria-hidden="true"></i> Salvar</button>'
    });
    CtiApp.vigiarFormulario(u.el('cc-dom-form'));
    var salvar = function () {
      var novo = u.el('cc-dom-nome').value.trim().toLowerCase().replace(/^@/, '');
      if (!novo) {
        CtiApp.erro('Domínio é obrigatório.');
        return;
      }
      if (novo === d.dominio) {
        CtiApp.fecharModal(true);
        return;
      }
      var gravar = function () {
        CtiApp.ocupado(u.el('cc-dom-salvar'), CtiApp.dados.salvarDominio({ dominio: d.dominio, novoDominio: novo, ativo: d.ativo, versao: d.versao }))
          .then(function () {
            CtiApp.fecharModal(true);
            CtiApp.sucesso('Domínio renomeado' + (qtd ? ': ' + u.plural(qtd, 'e-mail atualizado', 'e-mails atualizados') : '') + '.');
            return CtiApp.recarregar(['cofre']);
          }, function (e) { CtiApp.falhaAoGravar(e, 'O domínio não foi renomeado: '); });
      };
      if (!qtd) {
        gravar();
        return;
      }
      CtiApp.confirmar({
        titulo: 'Renomear o domínio?',
        mensagem: '@' + d.dominio + ' passa a ser @' + novo + ' em ' + u.plural(qtd, 'e-mail', 'e-mails') + ' do cofre. ' +
          'A caixa de e-mail no provedor não muda: faça isso quando o domínio já tiver mudado lá.',
        botao: 'Renomear'
      }).then(function (ok) { if (ok) { gravar(); } });
    };
    u.el('cc-dom-nome').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); salvar(); } });
    u.el('cc-dom-cancelar').addEventListener('click', function () { CtiApp.fecharModal(false); });
    u.el('cc-dom-salvar').addEventListener('click', salvar);
  }

  /** Novo tipo de equipamento ou edição (nome, de quem é e ícone). Renomear atualiza os e-mails que o usam. */
  function formularioEquipamento(e) {
    var novo = !e;
    var icone = novo ? null : e.icone;
    // Cor nula = padrão da categoria (acompanha a troca de categoria até o SUP escolher uma).
    var cor = novo ? null : u.cor(e.cor, '') || null;
    var qtd = novo ? 0 : e.qtdAcessos || 0;
    CtiApp.abrirModal({
      titulo: novo ? 'Novo tipo de equipamento' : 'Editar tipo de equipamento',
      tamanho: 'cofre',
      corpo: '<form class="g-form" id="cc-equip-form" novalidate>' +
        '<div class="g-cofre__grade2">' +
          '<label class="g-campo"><span class="g-obrigatorio">Nome</span>' +
            '<input type="text" id="cc-equip-nome" maxlength="60" value="' + u.esc(novo ? '' : e.nome) + '" placeholder="Ex.: TABLET DA EMPRESA" autofocus></label>' +
          '<label class="g-campo"><span class="g-obrigatorio">Categoria</span><select id="cc-equip-cat">' +
            Object.keys(CATEGORIAS_EQUIP).map(function (k) {
              return u.opcao(k, CATEGORIAS_EQUIP[k].rotulo, novo ? 'E' : categoriaEquip(e), { icone: 'ri-checkbox-blank-circle-fill', cor: CATEGORIAS_EQUIP[k].cor });
            }).join('') + '</select></label>' +
        '</div>' +
        '<p class="g-form__nota">' + u.esc('Gravado em maiúsculas.' +
          (qtd ? ' Renomear atualiza ' + (qtd === 1 ? 'o e-mail que usa' : 'os ' + qtd + ' e-mails que usam') + ' este tipo.' : '')) + '</p>' +
        '<div class="g-campo"><span class="g-cofre__rotulo-linha"><span>Cor</span>' +
          '<button type="button" class="g-btn g-btn--link" id="cc-equip-cor-padrao">Usar a cor da categoria</button></span>' +
          '<div class="g-paleta" id="cc-equip-cores">' + CtiConfig.CORES.map(function (c) {
            return '<button type="button" class="g-paleta__cor" data-cor="' + c + '" style="background:' + c + '" aria-label="Cor ' + c + '"></button>';
          }).join('') +
          '<input type="color" id="cc-equip-cor-livre" aria-label="Outra cor"></div></div>' +
        '<div class="g-campo"><span>Prévia na grade</span><div id="cc-equip-previa"></div></div>' +
        '<div class="g-campo"><span>Ícone</span>' + CtiConfig.htmlSeletorIcones('ce', icone) + '</div></form>',
      rodape: '<button type="button" class="g-btn g-btn--cancelar" id="cc-equip-cancelar">Cancelar</button>' +
        '<button type="button" class="g-btn g-btn--primario" id="cc-equip-salvar"><i class="ri-save-line" aria-hidden="true"></i> Salvar</button>'
    });
    var form = u.el('cc-equip-form');
    CtiApp.vigiarFormulario(form);
    var previa = function () {
      var nomePrevia = u.el('cc-equip-nome').value.trim().toUpperCase() || 'EQUIPAMENTO';
      var final = u.cor(cor, CATEGORIAS_EQUIP[u.el('cc-equip-cat').value].cor);
      u.el('cc-equip-previa').innerHTML = '<span class="g-selo g-cofre__equip" style="--c:' + final + '"><i class="' + u.icone(icone, ICONE_EQUIP) +
        '" aria-hidden="true"></i>' + u.esc(nomePrevia) + '</span>';
      u.el('cc-equip-cor-livre').value = final;
      u.cada(form, '[data-cor]', function (b) { b.setAttribute('aria-pressed', b.dataset.cor === cor ? 'true' : 'false'); });
      u.el('cc-equip-cor-padrao').hidden = !cor;
    };
    CtiConfig.ligarSeletorIcones('ce', function (i) { icone = i; form.dataset.sujo = 'S'; previa(); });
    u.el('cc-equip-cores').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-cor]');
      if (b) { cor = b.dataset.cor; form.dataset.sujo = 'S'; previa(); }
    });
    u.el('cc-equip-cor-livre').addEventListener('input', function (ev) { cor = ev.target.value.toUpperCase(); form.dataset.sujo = 'S'; previa(); });
    u.el('cc-equip-cor-padrao').addEventListener('click', function () { cor = null; form.dataset.sujo = 'S'; previa(); });
    u.el('cc-equip-cat').addEventListener('change', previa);
    u.el('cc-equip-nome').addEventListener('input', previa);
    previa();
    var salvar = function () {
      var nome = u.el('cc-equip-nome').value.trim().replace(/\s+/g, ' ').toUpperCase();
      if (!nome) {
        CtiApp.erro('Nome do tipo de equipamento é obrigatório.');
        return;
      }
      var categoria = u.el('cc-equip-cat').value;
      var dto = novo ? { nome: nome, icone: icone, cor: cor, categoria: categoria, versao: null }
        : { nome: e.nome, novoNome: nome !== e.nome ? nome : null, icone: icone, cor: cor, categoria: categoria, ativo: e.ativo, versao: e.versao };
      CtiApp.ocupado(u.el('cc-equip-salvar'), CtiApp.dados.salvarTipoEquipamento(dto)).then(function () {
        CtiApp.fecharModal(true);
        CtiApp.sucesso(novo ? 'Tipo de equipamento cadastrado.' : 'Tipo de equipamento atualizado.');
        return CtiApp.recarregar(['cofre']);
      }, function (erro) { CtiApp.falhaAoGravar(erro, 'O tipo de equipamento não foi salvo: '); });
    };
    u.el('cc-equip-nome').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); salvar(); } });
    u.el('cc-equip-cancelar').addEventListener('click', function () { CtiApp.fecharModal(false); });
    u.el('cc-equip-salvar').addEventListener('click', salvar);
  }

  // ======================================================== importação

  /**
   * SheetJS (vendor/sheetjs, Apache-2.0) só é carregada quando o SUP abre a
   * importação: são ~950 KB que os demais usuários nunca baixam. O caminho sai
   * do próprio cofre.js, com o mesmo ?v= do launcher.
   */
  var sheetjs = null;
  function carregarSheetJS() {
    if (window.XLSX) { return Promise.resolve(window.XLSX); }
    if (sheetjs) { return sheetjs; }
    var proprio = Array.prototype.filter.call(document.getElementsByTagName('script'), function (s) {
      return /js\/cofre\.js/.test(s.src);
    })[0];
    var src = proprio ? proprio.src.replace(/js\/cofre\.js/, 'vendor/sheetjs/xlsx.full.min.js') : 'html5/CTI_PainelTI/vendor/sheetjs/xlsx.full.min.js';
    sheetjs = new Promise(function (ok, falha) {
      var tag = document.createElement('script');
      tag.src = src;
      tag.onload = function () { if (window.XLSX) { ok(window.XLSX); } else { falha(new Error('Leitor de planilha não carregou.')); } };
      tag.onerror = function () { sheetjs = null; falha(new Error('Não foi possível carregar o leitor de planilha (vendor/sheetjs).')); };
      document.head.appendChild(tag);
    });
    return sheetjs;
  }

  /** Valor calculado da célula em texto (nunca a fórmula); erro (#N/A) e vazia viram "". */
  function valorCelula(c) {
    if (!c || c.t === 'e' || c.t === 'z' || c.v === undefined || c.v === null) { return ''; }
    if (c.t === 'b') { return c.v ? 'TRUE' : 'FALSE'; }
    return String(c.v);
  }

  /** Linhas da aba a partir de A1 (o servidor numera as linhas como o Excel); limites iguais aos do servidor. */
  function linhasDaAba(X, ws) {
    if (!ws || !ws['!ref']) { return []; }
    var fim = X.utils.decode_range(ws['!ref']).e;
    var linhas = [];
    for (var r = 0; r <= Math.min(fim.r, 5999); r++) {
      var linha = [];
      for (var c = 0; c <= Math.min(fim.c, 59); c++) {
        linha.push(valorCelula(ws[X.utils.encode_cell({ r: r, c: c })]));
      }
      while (linha.length && linha[linha.length - 1] === '') { linha.pop(); }
      linhas.push(linha);
    }
    while (linhas.length && !linhas[linhas.length - 1].length) { linhas.pop(); }
    return linhas;
  }

  /** Abas visíveis da planilha (a lista oculta de funcionários fica de fora). */
  function lerPlanilha(arquivo) {
    return Promise.all([carregarSheetJS(), arquivo.arrayBuffer()]).then(function (r) {
      var X = r[0];
      var wb = X.read(r[1], { type: 'array' });
      var abas = {};
      wb.SheetNames.forEach(function (nome, i) {
        var info = wb.Workbook && wb.Workbook.Sheets && wb.Workbook.Sheets[i];
        if (info && info.Hidden) { return; }
        abas[nome] = linhasDaAba(X, wb.Sheets[nome]);
      });
      return abas;
    });
  }

  function formularioImportacao() {
    var abas = null;
    var resultado = null;
    CtiApp.abrirModal({
      titulo: 'Importar planilha de acessos',
      tamanho: 'cofre',
      corpo: '<form class="g-form" id="ci-form" novalidate>' +
        '<label class="g-campo"><span class="g-obrigatorio">Planilha</span>' +
          '<input type="file" id="ci-arquivo" accept=".xlsx,.xlsm,.xls"></label>' +
        '<p class="g-form__nota">O arquivo é lido aqui no navegador; as senhas vão cifradas para o banco e nenhuma aparece no relatório. ' +
          'Nada é gravado até você confirmar.</p>' +
        '<div id="ci-relatorio"></div></form>',
      rodape: '<button type="button" class="g-btn g-btn--cancelar" id="ci-cancelar">Cancelar</button>' +
        '<button type="button" class="g-btn g-btn--primario" id="ci-importar" disabled><i class="ri-download-2-line" aria-hidden="true"></i> Importar</button>'
    });
    var botao = u.el('ci-importar');
    u.el('ci-cancelar').addEventListener('click', function () { CtiApp.fecharModal(false); });
    u.el('ci-arquivo').addEventListener('change', function (e) {
      var arquivo = e.target.files && e.target.files[0];
      abas = null;
      resultado = null;
      botao.disabled = true;
      if (!arquivo) { u.el('ci-relatorio').innerHTML = ''; return; }
      u.el('ci-relatorio').innerHTML = '<p class="g-vazio"><i class="ri-loader-4-line" aria-hidden="true"></i>Lendo a planilha e conferindo com o cadastro…</p>';
      lerPlanilha(arquivo).then(function (lidas) {
        abas = lidas;
        return CtiApp.dados.importarPlanilhaCofre({ abas: abas, gravar: false });
      }).then(function (r) {
        resultado = r;
        u.el('ci-relatorio').innerHTML = relatorioImportacao(r);
        botao.disabled = !r.importar;
        botao.innerHTML = '<i class="ri-download-2-line" aria-hidden="true"></i> Importar ' + u.plural(r.importar || 0, 'acesso', 'acessos');
      }, function (erro) {
        u.el('ci-relatorio').innerHTML = '';
        CtiApp.falhaAoGravar(erro, 'A planilha não foi lida: ');
      });
    });
    botao.addEventListener('click', function () {
      if (!abas || !resultado) { return; }
      CtiApp.confirmar({
        titulo: 'Importar ' + u.plural(resultado.importar, 'acesso', 'acessos') + '?',
        mensagem: 'Os acessos entram no cofre com as senhas cifradas e cada um fica no log. ' +
          (resultado.dominiosNovos && resultado.dominiosNovos.length ? 'Domínios novos cadastrados: ' + resultado.dominiosNovos.join(', ') + '. ' : '') +
          'Se algo falhar, nada é gravado.',
        botao: 'Importar'
      }).then(function (ok) {
        if (!ok) { return; }
        CtiApp.ocupado(botao, CtiApp.dados.importarPlanilhaCofre({ abas: abas, gravar: true })).then(function (r) {
          CtiApp.fecharModal(true);
          CtiApp.sucesso(u.plural(r.gravados || 0, 'acesso importado', 'acessos importados') + '.');
          return CtiApp.recarregar(['cofre']);
        }, function (erro) { CtiApp.falhaAoGravar(erro, 'Nenhum acesso foi importado: '); });
      });
    });
  }

  /** Relatório da simulação: totais por tipo e avisos agrupados (ignoradas em vermelho). Tudo escapado. */
  function relatorioImportacao(r) {
    var numero = function (valor, rotulo) {
      return '<div class="g-importacao__num"><strong>' + Number(valor || 0) + '</strong><span>' + u.esc(rotulo) + '</span></div>';
    };
    var tipos = Object.keys(r.porTipo || {}).map(function (nome) { return numero(r.porTipo[nome], nome); }).join('');
    var avisos = (r.avisos || []).map(function (a) {
      var itens = a.itens || [];
      return '<details class="g-importacao__aviso' + (a.ignorada ? ' g-importacao__aviso--ignorada' : '') + '">' +
        '<summary><i class="' + (a.ignorada ? 'ri-close-circle-line' : 'ri-information-line') + '" aria-hidden="true"></i>' +
          u.esc(a.titulo) + '<span class="g-importacao__qtd">' + itens.length + '</span></summary>' +
        '<ul>' + itens.slice(0, 200).map(function (i) { return '<li>' + u.esc(i) + '</li>'; }).join('') +
          (itens.length > 200 ? '<li>… e mais ' + (itens.length - 200) + '</li>' : '') + '</ul></details>';
    }).join('');
    return '<div class="g-importacao">' +
      '<div class="g-importacao__totais">' + numero(r.lidas, 'linhas lidas') + numero(r.importar, 'a importar') + tipos + '</div>' +
      '<p class="g-importacao__resumo">' + u.esc(u.plural(r.genericas || 0, 'conta genérica', 'contas genéricas') + ' · ' +
        u.plural(r.ligadasFolha || 0, 'ligada à folha', 'ligadas à folha') + ' · ' + u.plural(r.inativas || 0, 'desativada', 'desativadas') +
        (r.dominiosNovos && r.dominiosNovos.length ? ' · domínios novos: ' + r.dominiosNovos.join(', ') : '')) + '</p>' +
      (avisos ? '<div class="g-importacao__avisos">' + avisos + '</div>' : '') + '</div>';
  }

  /** Botão "Novo..." das Configurações › Cofre: abre um modal com um campo só. */
  function ligarNovo(idBotao, o) {
    var botao = u.el(idBotao);
    if (!botao) { return; }
    botao.addEventListener('click', function () {
      CtiApp.abrirModal({
        titulo: o.titulo,
        tamanho: 'estreito',
        corpo: '<form class="g-form" id="cc-novo-form" novalidate>' +
          '<label class="g-campo"><span class="g-obrigatorio">' + u.esc(o.rotulo) + '</span>' +
            '<input type="text" id="cc-novo-nome" maxlength="' + Number(o.maximo) + '" placeholder="' + u.esc(o.placeholder) + '" autofocus></label>' +
          '<p class="g-form__nota">' + u.esc(o.nota) + '</p></form>',
        rodape: '<button type="button" class="g-btn g-btn--cancelar" id="cc-novo-cancelar">Cancelar</button>' +
          '<button type="button" class="g-btn g-btn--primario" id="cc-novo-salvar"><i class="ri-save-line" aria-hidden="true"></i> Salvar</button>'
      });
      var form = u.el('cc-novo-form');
      CtiApp.vigiarFormulario(form);
      var salvar = function () {
        var nome = u.el('cc-novo-nome').value.trim();
        if (!nome) {
          CtiApp.erro(o.rotulo + ' é obrigatório.');
          u.el('cc-novo-nome').focus();
          return;
        }
        CtiApp.ocupado(u.el('cc-novo-salvar'), o.gravar(nome)).then(function () {
          CtiApp.fecharModal(true);
          CtiApp.sucesso(o.mensagem);
          return CtiApp.recarregar(['cofre']);
        }, function (e) { CtiApp.falhaAoGravar(e, 'Não foi salvo: '); });
      };
      u.el('cc-novo-nome').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); salvar(); } });
      u.el('cc-novo-cancelar').addEventListener('click', function () { CtiApp.fecharModal(false); });
      u.el('cc-novo-salvar').addEventListener('click', salvar);
    });
  }

  return {
    iniciar: iniciar,
    pintar: pintar,
    marcarPresenca: marcarPresenca,
    pintarConfiguracao: pintarConfiguracao,
    sugestaoEmail: sugestaoEmail,
    impactoExclusao: impactoExclusao,
    tambemMuda: tambemMuda,
    avisarBloqueio: avisarBloqueio
  };
})();
