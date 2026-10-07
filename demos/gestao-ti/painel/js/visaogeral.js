/**
 * Visão geral: indicadores (cada um abre a lista num modal), distribuição por
 * coluna e tabela das demandas em aberto. Tudo calculado sobre a lista já carregada,
 * menos o card de desligados com acesso (CtiDesligados, só para quem vê o cofre).
 */
var CtiVisaoGeral = (function () {
  'use strict';

  var u = CtiUtil;
  var recorte = 'abertas';

  function iniciar() {
    CtiApp.aoMudar(function (parte) {
      if (parte === 'demandas' || parte === 'config') { pintar(); }
    });
    CtiDesligados.aoMudar(function () { if (CtiApp.estado.carregou.demandas) { pintarKpis(); } });
    u.el('vg-recorte').addEventListener('click', function (e) {
      var b = e.target.closest('[data-recorte]');
      if (b) { escolherRecorte(b.dataset.recorte); }
    });
    u.el('vg-kpis').addEventListener('click', function (e) {
      if (e.target.closest('[data-kpi-desligados]')) { CtiDesligados.abrir(); return; }
      var k = e.target.closest('[data-kpi]');
      if (k) { abrirKpi(k.dataset.kpi); }
    });
    // Uma vez só: o corpo do modal é o mesmo elemento a cada abertura (ligar em abrirKpi acumulava ouvintes).
    u.el('g-modal-corpo').addEventListener('click', function (e) {
      var b = e.target.closest('.g-kpi-lista [data-abrir-demanda]');
      if (b) { CtiDemanda.abrir(Number(b.dataset.abrirDemanda)); }
    });
    u.el('vg-tabela').addEventListener('click', function (e) {
      var linha = e.target.closest('tr[data-id]');
      if (linha) { CtiDemanda.abrir(Number(linha.dataset.id)); }
    });
    u.el('vg-tabela').addEventListener('keydown', function (e) {
      var linha = e.target.closest('tr[data-id]');
      if (linha && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        CtiDemanda.abrir(Number(linha.dataset.id));
      }
    });
  }

  function escolherRecorte(nome) {
    recorte = nome;
    u.cada(u.el('vg-recorte'), '[data-recorte]', function (b) {
      b.classList.toggle('g-segmento--ativo', b.dataset.recorte === nome);
    });
    pintarTabela();
  }

  function abertas() {
    return CtiApp.demandasVisiveis().filter(function (d) { return !d.concluida; });
  }

  function pintar() {
    if (!CtiApp.estado.carregou.demandas) { return; }
    var eu = CtiApp.estado.sessao;
    u.el('vg-saudacao').textContent = saudacao() + ', ' + (eu.nomeUsu || '') + '. ' +
      u.plural(abertas().filter(function (d) { return d.codUsuResp === eu.codUsu; }).length,
        'demanda sua está em aberto.', 'demandas suas estão em aberto.');
    u.el('g-menu-abertas').textContent = abertas().length || '';
    pintarKpis();
    pintarTabela();
  }

  function saudacao() {
    var h = new Date().getHours();
    return h < 12 ? 'Bom dia' : (h < 18 ? 'Boa tarde' : 'Boa noite');
  }

  /** Recortes dos indicadores: a contagem do card e a lista do modal vêm da mesma função. */
  var KPIS = {
    abertas: {
      titulo: 'Em aberto', icone: 'ri-stack-line', cor: '#3E9B4E', fundo: '#E9F7EC',
      tituloModal: 'Demandas em aberto',
      filtro: function (d) { return !d.concluida; }
    },
    atrasadas: {
      titulo: 'Atrasadas', icone: 'ri-alarm-warning-line', cor: '#D93A3A', fundo: '#FDECEC',
      tituloModal: 'Demandas atrasadas', nota: 'prazo vencido',
      filtro: function (d) { return !d.concluida && u.situacaoPrazo(d.dtVenc) === 'atrasado'; }
    },
    concluidas: {
      titulo: 'Concluídas', icone: 'ri-check-double-line', cor: '#3B82F6', fundo: '#E8F0FE',
      tituloModal: 'Demandas concluídas', nota: 'todas as finalizadas',
      filtro: function (d) { return d.concluida; }
    },
    semresponsavel: {
      titulo: 'Sem responsável', icone: 'ri-user-unfollow-line', cor: '#7C5CC4', fundo: '#F1EDFA',
      tituloModal: 'Demandas sem responsável', nota: 'aguardando atribuição',
      filtro: function (d) { return !d.concluida && !u.temUsuario(d.codUsuResp); }
    }
  };

  function demandasDoKpi(chave) {
    return CtiApp.demandasVisiveis().filter(KPIS[chave].filtro);
  }

  function pintarKpis() {
    var desligados = CtiDesligados.cardHtml();
    u.el('vg-kpis').classList.toggle('g-kpis--5', !!desligados);
    u.el('vg-kpis').innerHTML = Object.keys(KPIS).map(function (chave) {
      var k = KPIS[chave];
      var valor = demandasDoKpi(chave).length;
      return '<button type="button" class="g-kpi' + (chave === 'atrasadas' && valor ? ' g-kpi--alerta' : '') +
        '" data-kpi="' + chave + '" style="--k-cor:' + k.cor + ';--k-fundo:' + k.fundo + '" aria-haspopup="dialog">' +
        '<span class="g-kpi__topo">' + k.titulo + '<span class="g-kpi__icone"><i class="' + k.icone + '" aria-hidden="true"></i></span></span>' +
        '<span class="g-kpi__valor">' + valor + '</span>' +
        '<span class="g-kpi__nota">' + (k.nota || 'demandas ativas') + '</span></button>';
    }).join('') + desligados;
  }

  /** Modal com as demandas do indicador; clicar numa linha abre a demanda. */
  function abrirKpi(chave) {
    var k = KPIS[chave];
    var concluidas = chave === 'concluidas';
    var lista = concluidas ? demandasDoKpi(chave).slice().sort(u.porConclusaoRecente) : ordenarPorUrgencia(demandasDoKpi(chave));
    CtiApp.abrirModal({
      titulo: k.tituloModal + ' (' + lista.length + ')',
      tamanho: 'largo',
      focarFechar: true,
      corpo: lista.length
        ? '<div class="g-kpi-lista" style="--k-cor:' + k.cor + '">' + lista.map(function (d) {
            return '<button type="button" class="g-kpi-lista__linha" data-abrir-demanda="' + Number(d.idTarefa) + '">' +
              '<span class="g-kpi-lista__titulo">' + u.esc(d.titulo) +
                '<small>#' + Number(d.idTarefa) + ', ' + CtiApp.PRIORIDADES[d.prioridade] + (concluidas ? ', concluída em ' + u.esc(u.dataHoraBr(d.dhConclusao)) : ', criada em ' + u.dataBr(d.dhCriacao)) +
                '</small></span>' +
              '<span>' + CtiApp.seloCategoria(d.idCategoria) + '</span>' +
              '<span>' + CtiApp.pessoaHtml(d.codUsuResp, d.nomeResp) + '</span>' +
              '<span>' + CtiApp.prazoHtml(d) + '</span>' +
              '<span>' + CtiApp.seloColuna(d.coluna) + '</span>' +
              '</button>';
          }).join('') + '</div>'
        : '<p class="g-vazio"><i class="' + k.icone + '" aria-hidden="true"></i>Nenhuma demanda neste indicador.</p>'
    });
  }

  function ordenarPorUrgencia(lista) {
    return lista.slice().sort(function (a, b) {
      // Mais urgente primeiro: prazo mais próximo, depois prioridade.
      var pa = a.dtVenc || '9999', pb = b.dtVenc || '9999';
      if (pa !== pb) { return pa < pb ? -1 : 1; }
      return 'UAMB'.indexOf(a.prioridade) - 'UAMB'.indexOf(b.prioridade);
    });
  }

  /** Grade da Visão Geral: ordem de chegada, a mais antiga em cima (decisão do cliente em 01/10/2026). */
  function ordenarPorCriacao(lista) {
    return lista.slice().sort(function (a, b) {
      var ca = a.dhCriacao || '', cb = b.dhCriacao || '';
      if (ca !== cb) { return ca < cb ? -1 : 1; }
      return Number(a.idTarefa) - Number(b.idTarefa);
    });
  }

  function filtrarRecorte() {
    var eu = CtiApp.estado.sessao.codUsu;
    return ordenarPorCriacao(abertas().filter(function (d) {
      if (recorte === 'minhas') { return d.codUsuResp === eu; }
      if (recorte === 'atrasadas') { return u.situacaoPrazo(d.dtVenc) === 'atrasado'; }
      if (recorte === 'semresp') { return !u.temUsuario(d.codUsuResp); }
      return true;
    }));
  }

  function pintarTabela() {
    var corpo = u.el('vg-tabela');
    var lista = filtrarRecorte();
    if (!lista.length) {
      corpo.innerHTML = '<tr><td colspan="10" class="g-vazio"><i class="ri-checkbox-circle-line" aria-hidden="true"></i>' +
        (recorte === 'abertas' ? 'Nenhuma demanda em aberto.' : 'Nada neste recorte.') + '</td></tr>';
      return;
    }
    corpo.innerHTML = lista.map(function (d) {
      return '<tr data-id="' + Number(d.idTarefa) + '" tabindex="0">' +
        '<td><span class="g-codigo-demanda">#' + Number(d.idTarefa) + '</span></td>' +
        '<td><div class="g-tabela__titulo">' + u.esc(d.titulo) +
          (d.tags ? '<small>' + u.tags(d.tags).map(function (t) { return '#' + u.esc(t); }).join(' ') + '</small>' : '') +
          '</div></td>' +
        '<td>' + CtiApp.seloCategoria(d.idCategoria) + '</td>' +
        '<td>' + CtiApp.seloPrioridade(d.prioridade) + '</td>' +
        '<td>' + CtiApp.seloSetor(d.idSetor) + '</td>' +
        '<td>' + CtiApp.pessoaHtml(d.codUsuSol, d.nomeSol, '—') + '</td>' +
        '<td>' + CtiApp.pessoaHtml(d.codUsuResp, d.nomeResp) + '</td>' +
        '<td><span class="g-tabela__data" title="' + u.esc(u.dataHoraBr(d.dhCriacao)) + '">' + u.dataBr(d.dhCriacao) + '</span></td>' +
        '<td>' + CtiApp.prazoHtml(d) + '</td>' +
        '<td>' + CtiApp.seloColuna(d.coluna) + '</td>' +
        '</tr>';
    }).join('');
    CtiFotos.preencher(corpo);
  }

  return { iniciar: iniciar, pintar: pintar };
})();
