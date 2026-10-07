/**
 * Configurações: colunas do Kanban, categorias, documentação (tipos e
 * categorias de documento), setores, responsáveis, solicitantes e o cofre
 * (grupo com acesso e domínios de e-mail, visível só para quem abre o cofre). Quem não pode configurar vê tudo em modo leitura; o servidor
 * confere a permissão de novo em cada gravação.
 */
var CtiConfig = (function () {
  'use strict';

  var u = CtiUtil;
  var aba = 'colunas';

  // Mesma saturação para todas: verde Sankhya + tons que convivem com ele.
  var CORES = ['#71CE7E', '#2E8B47', '#14B8A6', '#0EA5E9', '#3A7BEA', '#6366F1', '#8B5CF6',
    '#D946A6', '#E5484D', '#F97316', '#E3A008', '#64748B'];
  /**
   * Catálogo do seletor de ícones: [classe do Remix Icon, termos de busca].
   * Toda classe foi conferida no vendor/remixicon.css embarcado (versão antiga:
   * nem todo ícone do site existe aqui). O servidor aceita qualquer ri-*.
   */
  var GRUPOS_ICONES = [
    { grupo: 'TI e sistemas', icones: [
      ['ri-computer-line', 'computador pc'], ['ri-macbook-line', 'notebook'], ['ri-server-line', 'servidor'],
      ['ri-hard-drive-2-line', 'disco hd armazenamento'], ['ri-database-2-line', 'banco dados oracle'], ['ri-cloud-line', 'nuvem cloud'],
      ['ri-wifi-line', 'rede wifi'], ['ri-router-line', 'roteador rede'], ['ri-global-line', 'internet web'],
      ['ri-printer-line', 'impressora'], ['ri-smartphone-line', 'celular mobile app'], ['ri-tablet-line', 'tablet'],
      ['ri-cpu-line', 'processador hardware'], ['ri-keyboard-line', 'teclado'], ['ri-mouse-line', 'mouse'],
      ['ri-tv-2-line', 'monitor tela'], ['ri-shield-check-line', 'seguranca protecao'], ['ri-lock-line', 'senha bloqueio acesso'],
      ['ri-key-2-line', 'chave licenca'], ['ri-fingerprint-line', 'biometria'], ['ri-user-settings-line', 'usuario permissao'],
      ['ri-plug-line', 'integracao conexao'], ['ri-links-line', 'link vinculo'], ['ri-install-line', 'instalacao download'],
      ['ri-upload-cloud-2-line', 'upload envio'], ['ri-refresh-line', 'atualizar sincronizar'], ['ri-settings-3-line', 'configuracao ajuste'],
      ['ri-tools-line', 'manutencao ferramenta'], ['ri-bug-line', 'bug erro defeito'], ['ri-customer-service-2-line', 'suporte atendimento'],
      ['ri-question-answer-line', 'chamado duvida'], ['ri-mail-line', 'email']
    ]},
    { grupo: 'Banco e código', icones: [
      ['ri-code-s-slash-line', 'codigo'], ['ri-terminal-box-line', 'terminal script'], ['ri-file-code-line', 'arquivo codigo sql'],
      ['ri-braces-line', 'json api'], ['ri-flashlight-line', 'trigger gatilho'], ['ri-function-line', 'funcao procedure'],
      ['ri-git-branch-line', 'git versao'], ['ri-git-merge-line', 'merge'], ['ri-git-pull-request-line', 'revisao pull request'],
      ['ri-flow-chart', 'fluxo processo'], ['ri-node-tree', 'arvore hierarquia'], ['ri-table-line', 'tabela'],
      ['ri-layout-grid-line', 'tela grade'], ['ri-window-line', 'janela tela'], ['ri-dashboard-line', 'dashboard painel'],
      ['ri-bar-chart-2-line', 'grafico relatorio'], ['ri-pie-chart-line', 'grafico pizza'], ['ri-line-chart-line', 'indicador tendencia'],
      ['ri-file-chart-line', 'relatorio'], ['ri-calendar-event-line', 'agendamento job'], ['ri-timer-line', 'temporizador job'],
      ['ri-loop-left-line', 'rotina repeticao'], ['ri-robot-line', 'automacao robo'], ['ri-magic-line', 'automatico'],
      ['ri-exchange-line', 'api servico troca'], ['ri-send-plane-line', 'webhook envio'], ['ri-apps-2-line', 'addon modulo extensao'],
      ['ri-stack-line', 'camadas pilha']
    ]},
    { grupo: 'Negócio e ERP', icones: [
      ['ri-money-dollar-circle-line', 'financeiro dinheiro'], ['ri-bank-line', 'banco financeiro'], ['ri-wallet-3-line', 'carteira pagamento'],
      ['ri-bank-card-line', 'cartao'], ['ri-coins-line', 'custo moeda'], ['ri-file-paper-2-line', 'nota fiscal recibo'],
      ['ri-file-list-3-line', 'pedido lista'], ['ri-bill-line', 'boleto conta'], ['ri-calculator-line', 'calculo contabil'],
      ['ri-percent-line', 'imposto percentual'], ['ri-shopping-cart-line', 'compras carrinho'], ['ri-shopping-bag-3-line', 'vendas'],
      ['ri-store-2-line', 'loja comercial'], ['ri-price-tag-3-line', 'preco etiqueta'], ['ri-barcode-line', 'codigo barras produto'],
      ['ri-qr-code-line', 'qr code'], ['ri-archive-line', 'estoque arquivo'], ['ri-inbox-archive-line', 'almoxarifado'],
      ['ri-truck-line', 'logistica frete entrega'], ['ri-ship-line', 'exportacao'], ['ri-car-line', 'frota veiculo'],
      ['ri-gas-station-line', 'combustivel'], ['ri-plant-line', 'florestal agricola'], ['ri-seedling-line', 'plantio'],
      ['ri-leaf-line', 'ambiental'], ['ri-hammer-line', 'producao obra'], ['ri-building-4-line', 'fabrica industria'],
      ['ri-scales-3-line', 'juridico contrato'], ['ri-file-shield-2-line', 'contrato'], ['ri-auction-line', 'licitacao'],
      ['ri-handbag-line', 'comercial'], ['ri-exchange-dollar-line', 'cambio conciliacao']
    ]},
    { grupo: 'Pessoas e setores', icones: [
      ['ri-team-line', 'equipe time'], ['ri-user-line', 'usuario pessoa'], ['ri-group-line', 'grupo'],
      ['ri-user-star-line', 'gestor lider'], ['ri-user-heart-line', 'rh recursos humanos'], ['ri-profile-line', 'cadastro cracha perfil'],
      ['ri-briefcase-line', 'administrativo'], ['ri-building-2-line', 'empresa setor'], ['ri-community-line', 'filial unidade'],
      ['ri-home-office-line', 'escritorio'], ['ri-hospital-line', 'saude'], ['ri-graduation-cap-line', 'treinamento'],
      ['ri-presentation-line', 'apresentacao reuniao'], ['ri-megaphone-line', 'marketing comunicado'], ['ri-customer-service-line', 'sac cliente'],
      ['ri-restaurant-line', 'refeitorio']
    ]},
    { grupo: 'Documentos', icones: [
      ['ri-file-text-line', 'documento texto'], ['ri-file-line', 'arquivo'], ['ri-folder-3-line', 'pasta'],
      ['ri-folder-open-line', 'pasta aberta'], ['ri-book-open-line', 'manual'], ['ri-book-2-line', 'procedimento'],
      ['ri-article-line', 'artigo'], ['ri-draft-line', 'rascunho'], ['ri-file-pdf-2-line', 'pdf'],
      ['ri-file-excel-2-line', 'excel planilha'], ['ri-file-word-2-line', 'word'], ['ri-image-line', 'imagem'],
      ['ri-sticky-note-line', 'nota lembrete'], ['ri-clipboard-line', 'checklist'], ['ri-attachment-line', 'anexo'],
      ['ri-survey-line', 'formulario pesquisa']
    ]},
    { grupo: 'Status e fluxo', icones: [
      ['ri-inbox-line', 'entrada backlog'], ['ri-list-check', 'lista tarefas'], ['ri-list-check-2', 'checklist'],
      ['ri-task-line', 'tarefa'], ['ri-loader-4-line', 'andamento'], ['ri-play-circle-line', 'iniciar'],
      ['ri-pause-circle-line', 'pausado'], ['ri-stop-circle-line', 'parado'], ['ri-time-line', 'tempo aguardando'],
      ['ri-hourglass-line', 'espera'], ['ri-eye-line', 'revisao'], ['ri-search-eye-line', 'analise'],
      ['ri-check-line', 'feito'], ['ri-check-double-line', 'concluido'], ['ri-checkbox-circle-line', 'aprovado'],
      ['ri-close-circle-line', 'cancelado reprovado'], ['ri-error-warning-line', 'atencao alerta'], ['ri-alarm-warning-line', 'urgente'],
      ['ri-fire-line', 'critico'], ['ri-flag-line', 'marco bandeira'], ['ri-star-line', 'destaque favorito'],
      ['ri-bookmark-line', 'marcador'], ['ri-lightbulb-line', 'ideia melhoria'], ['ri-rocket-line', 'lancamento entrega'],
      ['ri-trophy-line', 'meta'], ['ri-focus-3-line', 'objetivo'], ['ri-arrow-up-circle-line', 'subir prioridade'],
      ['ri-question-line', 'duvida']
    ]},
    // Pacotes adicionais embarcados em vendor/: Tabler (ti-, MIT) e Simple Icons (si-, logos de marca, CC0).
    { grupo: 'Marcas e redes sociais', icones: [
      ['si-whatsapp', 'whatsapp mensagem'], ['si-instagram', 'instagram rede social'], ['si-facebook', 'facebook rede social'],
      ['ti-brand-linkedin', 'linkedin rede social'], ['si-youtube', 'youtube video'], ['si-x', 'x twitter'],
      ['si-tiktok', 'tiktok video'], ['si-telegram', 'telegram mensagem'], ['si-discord', 'discord chat'],
      ['si-nubank', 'nubank banco'], ['si-mercadopago', 'mercado pago pagamento'], ['si-pix', 'pix pagamento'],
      ['si-ifood', 'ifood entrega'], ['si-uber', 'uber transporte'], ['si-shopee', 'shopee compras'], ['si-vivo', 'vivo operadora telefone']
    ]},
    { grupo: 'Sistemas e serviços', icones: [
      ['si-gmail', 'gmail email'], ['ti-brand-office', 'office microsoft 365'], ['ti-brand-teams', 'teams microsoft'],
      ['ti-brand-windows', 'windows microsoft'], ['ti-brand-onedrive', 'onedrive microsoft nuvem'], ['ti-brand-azure', 'azure microsoft nuvem'],
      ['si-googledrive', 'google drive nuvem'], ['si-googlemeet', 'google meet reuniao'], ['si-googlecloud', 'google cloud nuvem'],
      ['si-zoom', 'zoom reuniao'], ['si-anydesk', 'anydesk acesso remoto'], ['si-teamviewer', 'teamviewer acesso remoto'],
      ['si-dropbox', 'dropbox nuvem'], ['si-cpanel', 'cpanel hospedagem site'], ['si-cloudflare', 'cloudflare dns'],
      ['si-sap', 'sap erp'], ['si-totvs', 'totvs erp'], ['si-notion', 'notion documentacao'], ['si-trello', 'trello tarefas'],
      ['si-github', 'github codigo'], ['si-docker', 'docker container'], ['si-anthropic', 'anthropic claude ia'],
      ['si-googlechrome', 'chrome navegador'], ['si-firefox', 'firefox navegador']
    ]},
    { grupo: 'Rede, equipamentos e fornecedores', icones: [
      ['ti-satellite', 'satelite starlink internet'], ['ti-antenna', 'antena radio'], ['ti-router', 'roteador rede'],
      ['ti-access-point', 'access point wifi'], ['ti-wifi', 'wifi rede sem fio'], ['ti-network', 'rede switch'],
      ['ti-server', 'servidor'], ['ti-database', 'banco de dados'], ['ti-device-desktop', 'desktop computador'],
      ['ti-device-laptop', 'notebook laptop'], ['ti-device-mobile', 'celular smartphone'], ['ti-printer', 'impressora'],
      ['ti-camera', 'camera cftv'], ['ti-shield-lock', 'seguranca firewall'], ['ti-key', 'chave senha'], ['ti-lock-password', 'senha acesso'],
      ['si-spacex', 'spacex starlink'], ['si-cisco', 'cisco rede'], ['si-fortinet', 'fortinet firewall'], ['si-ubiquiti', 'ubiquiti unifi'],
      ['si-mikrotik', 'mikrotik roteador'], ['si-tplink', 'tp-link roteador'], ['si-intel', 'intel processador'], ['si-dell', 'dell computador'],
      ['si-hp', 'hp impressora computador'], ['si-lenovo', 'lenovo notebook'], ['si-samsung', 'samsung celular'], ['si-motorola', 'motorola celular'],
      ['si-xiaomi', 'xiaomi celular'], ['si-epson', 'epson impressora'], ['si-apple', 'apple iphone mac'], ['si-android', 'android celular']
    ]}
  ];

  function iniciar() {
    CtiApp.aoMudar(function (parte) {
      if (parte === 'config' || parte === 'demandas' || (parte === 'visao' && CtiApp.visao() === 'config') ||
          (parte === 'cofre' && aba === 'cofre')) { pintar(); }
    });
    u.el('cf-abas').addEventListener('click', function (e) {
      var b = e.target.closest('[data-aba]');
      if (!b) { return; }
      if (b.dataset.aba === aba) { return; }
      confirmarSaida().then(function (ok) { if (ok) { escolherAba(b.dataset.aba); } });
    });
    u.el('cf-rodape-descartar').addEventListener('click', descartarTudo);
    u.el('cf-rodape-salvar').addEventListener('click', salvarPendente);
  }

  // ======================================================= alterações não salvas

  /**
   * Tudo o que se muda direto numa aba das Configurações (interruptor, ordem
   * das colunas, grupo, campos da HostGator) fica pendente até "Salvar
   * alterações" no rodapé fixo. chave -> {nome, salvar: () => Promise<boolean>}
   * (false = o usuário desistiu numa confirmação). Descartar repinta a aba com
   * os dados gravados. Ações explícitas (Novo/Editar em modal, Excluir, Trocar
   * chave) continuam gravando na hora.
   */
  var pendentes = {};

  function registrarAlteracao(chave, alteracao) {
    pendentes[chave] = alteracao;
    pintarRodape();
  }

  function removerAlteracao(chave) {
    delete pendentes[chave];
    pintarRodape();
  }

  /** Compatível com as abas que têm uma alteração só (grupo, HostGator). */
  function marcarPendente(p) { registrarAlteracao(p.chave || p.nome, p); }

  function limparPendente() {
    pendentes = {};
    pintarRodape();
  }

  function lista() { return Object.keys(pendentes).map(function (k) { return pendentes[k]; }); }

  function temPendencia() { return lista().length > 0; }

  /**
   * Interruptor da aba: registra a mudança e, se voltar ao estado gravado
   * (defaultChecked), tira da lista. A linha ganha um destaque de "alterado".
   * alvo: o que muda, com artigo ('o tipo de documento “Procedure”'), e a
   * descrição vira "Ativar …"/"Desativar …"; ou {ligar, desligar} com as frases prontas.
   */
  function interruptorPendente(cx, chave, alvo, salvar, aviso) {
    var alterado = cx.checked !== cx.defaultChecked;
    var item = cx.closest('.g-item, .g-hg__dom');
    if (item) { item.classList.toggle('g-item--alterado', alterado); }
    if (alterado) {
      var nome = typeof alvo === 'string' ? (cx.checked ? 'Ativar ' : 'Desativar ') + alvo : (cx.checked ? alvo.ligar : alvo.desligar);
      registrarAlteracao(chave, { nome: nome, salvar: salvar, aviso: aviso });
    } else {
      removerAlteracao(chave);
    }
  }

  /** "Procedure" -> “Procedure” (nome de cadastro dentro da frase). */
  function aspas(texto) { return '\u201c' + texto + '\u201d'; }

  /** "Desativar o tipo…, ativar a coluna… e mais 2": o começo da frase só em maiúscula no primeiro item. */
  function resumoDasAlteracoes(itens, maximo) {
    var frases = itens.slice(0, maximo).map(function (x, i) {
      return i === 0 ? x.nome : x.nome.charAt(0).toLowerCase() + x.nome.slice(1);
    });
    var resto = itens.length - frases.length;
    if (resto > 0) { return frases.join(', ') + ' e mais ' + resto; }
    return frases.length > 1 ? frases.slice(0, -1).join(', ') + ' e ' + frases[frases.length - 1] : frases[0];
  }

  function pintarRodape() {
    var r = u.el('cf-rodape');
    var itens = lista();
    r.hidden = !itens.length;
    if (!itens.length) { return; }
    u.el('cf-rodape-titulo').textContent = itens.length === 1 ? '1 alteração não salva' : itens.length + ' alterações não salvas';
    var nome = u.el('cf-rodape-nome');
    nome.textContent = resumoDasAlteracoes(itens, 2);
    nome.title = itens.map(function (x) { return x.nome; }).join('\n');
  }

  /**
   * Alterações que pedem confirmação trazem aviso(): {titulo, mensagem, topico} ou null.
   * Todas vão para um modal só, um tópico por alteração; desistir não grava nada.
   * Avisos de assuntos diferentes (títulos diferentes) levam a consequência no próprio tópico.
   */
  function confirmarAvisos(chaves) {
    var avisos = chaves.map(function (k) { return pendentes[k].aviso ? pendentes[k].aviso() : null; })
      .filter(function (a) { return a; });
    if (!avisos.length) { return Promise.resolve(true); }
    var mesmoAssunto = avisos.every(function (a) { return a.titulo === avisos[0].titulo; });
    return CtiApp.confirmar(mesmoAssunto ? {
      titulo: avisos[0].titulo, mensagem: avisos[0].mensagem, botao: 'Salvar',
      topicos: avisos.map(function (a) { return a.topico; })
    } : {
      titulo: 'Salvar estas alterações?', botao: 'Salvar',
      topicos: avisos.map(function (a) { return { texto: a.topico, detalhe: a.mensagem }; })
    });
  }

  /** Grava na ordem em que as mudanças foram feitas; para no primeiro erro e mantém o que falta. */
  function salvarPendente() {
    var chaves = Object.keys(pendentes);
    if (!chaves.length) { return; }
    confirmarAvisos(chaves).then(function (ok) { if (ok) { gravarPendentes(chaves); } });
  }

  function gravarPendentes(chaves) {
    var feitas = 0;
    var cadeia = chaves.reduce(function (p, k) {
      return p.then(function (seguir) {
        if (!seguir) { return false; }
        return Promise.resolve().then(pendentes[k].salvar).then(function (gravou) {
          if (gravou) { delete pendentes[k]; feitas++; }
          return gravou;
        });
      });
    }, Promise.resolve(true));
    CtiApp.ocupado(u.el('cf-rodape-salvar'), cadeia).then(function () {
      depoisDeSalvar(feitas);
    }, function (e) {
      depoisDeSalvar(feitas);
      CtiApp.falhaAoGravar(e, 'Parte das alterações não foi salva: ');
    });
  }

  function depoisDeSalvar(feitas) {
    pintarRodape();
    if (feitas) {
      CtiApp.sucesso(feitas === 1 ? 'Alteração salva.' : feitas + ' alterações salvas.');
      // Com algo ainda pendente (erro ou desistência), a tela fica como está para não perder o resto.
      if (!temPendencia()) {
        CtiApp.recarregar(['config', 'cofre']).then(function () { pintar(); });
      }
    }
  }

  function descartarTudo() {
    limparPendente();
    pintar();
  }

  /** Resolve true para seguir (sem pendência ou o usuário descartou); false = voltou para salvar. */
  function confirmarSaida() {
    if (!temPendencia()) { return Promise.resolve(true); }
    var itens = lista();
    return CtiApp.confirmar({
      titulo: 'Alterações não salvas',
      mensagem: itens.length === 1
        ? 'Você tem 1 alteração não salva: ' + itens[0].nome.charAt(0).toLowerCase() + itens[0].nome.slice(1) + '. Se sair agora, ela será perdida.'
        : 'Você tem ' + itens.length + ' alterações não salvas (' + resumoDasAlteracoes(itens, 3).replace(/^./, function (c) { return c.toLowerCase(); }) +
          '). Se sair agora, elas serão perdidas.',
      botao: 'Sair sem salvar', perigo: true, iconeBotao: 'ri-arrow-go-back-line', tipo: 'alerta',
      cancelar: 'Voltar e salvar'
    }).then(function (ok) {
      if (ok) {
        limparPendente();
      } else {
        u.el('cf-rodape-salvar').focus();
      }
      return ok;
    });
  }

  function escolherAba(nome) {
    aba = nome;
    u.cada(u.el('cf-abas'), '[data-aba]', function (x) {
      var ativa = x.dataset.aba === nome;
      x.classList.toggle('g-aba--ativa', ativa);
      x.setAttribute('aria-selected', ativa ? 'true' : 'false');
    });
    pintar();
  }

  /** Abre as Configurações já numa aba (ex.: "Ver no log da API" do resumo de lote). */
  function abrirAba(nome) {
    CtiApp.irPara('config');
    if (CtiApp.visao() !== 'config') { return; }
    confirmarSaida().then(function (ok) { if (ok) { escolherAba(nome); } });
  }

  function pintar() {
    if (!CtiApp.estado.carregou.config || CtiApp.visao() !== 'config') { return; }
    // Dados novos de colegas com alteração não salva: repintar apagaria o que foi mudado.
    if (temPendencia()) { return; }
    var alvo = u.el('cf-painel');
    if (aba === 'colunas') { pintarColunas(alvo); }
    if (aba === 'categorias') { pintarSimples(alvo, 'categoria', true); }
    if (aba === 'documentacao') { pintarDocumentacao(alvo); }
    if (aba === 'setores') { pintarSimples(alvo, 'setor', true); }
    if (aba === 'responsaveis') { pintarResponsaveis(alvo); }
    if (aba === 'solicitantes') { pintarSolicitantes(alvo); }
    if (aba === 'hostgator') { CtiHostGator.pintar(alvo); }
    if (aba === 'cofre') {
      // O cofre tem carga própria: na primeira vez a aba pede a leitura e repinta quando chegar.
      if (!CtiApp.estado.carregou.cofre) { CtiApp.recarregar(['cofre', 'cofre!']); }
      CtiCofre.pintarConfiguracao(alvo);
    }
    lembrarGrupos(alvo);
    CtiFotos.preencher(alvo);
  }

  function cabecalho(titulo, texto, botao) {
    return '<div class="g-painel-cab"><div><h2>' + titulo + '</h2><p>' + texto + '</p></div>' + (botao || '') + '</div>';
  }

  function botaoNovo(id, rotulo) {
    return '<button type="button" class="g-btn g-btn--primario" id="' + id + '" data-requer="configurar">' +
      '<i class="ri-add-line" aria-hidden="true"></i> ' + rotulo + '</button>';
  }

  // Grupos de inativos fechados pelo usuário (sobrevive às repinturas da aba).
  var inativosFechados = {};

  /** Itens inativos ficam num grupo recolhível abaixo da lista principal. */
  function grupoInativos(chave, titulo, qtd, conteudo) {
    if (!qtd) { return ''; }
    return '<details class="g-inativos" data-grupo-inativos="' + chave + '"' + (inativosFechados[chave] ? '' : ' open') + '>' +
      '<summary class="g-inativos__cab"><i class="ri-arrow-right-s-line" aria-hidden="true"></i>' + titulo +
      '<span class="g-inativos__qtd">' + qtd + '</span></summary>' + conteudo + '</details>';
  }

  function lembrarGrupos(alvo) {
    u.cada(alvo, '[data-grupo-inativos]', function (d) {
      d.addEventListener('toggle', function () { inativosFechados[d.dataset.grupoInativos] = !d.open; });
    });
  }

  function interruptor(atributos, marcado, rotulo) {
    var pode = CtiApp.pode('configurar');
    return '<label class="g-interruptor" title="' + rotulo + '"><input type="checkbox" ' + atributos +
      (marcado ? ' checked' : '') + (pode ? '' : ' disabled') + ' aria-label="' + rotulo + '"><span></span></label>';
  }

  // ================================================================ colunas

  function pintarColunas(alvo) {
    var todas = CtiApp.estado.config.colunas;
    var visiveis = todas.filter(function (c) { return c.ativo; });
    var ocultas = todas.filter(function (c) { return !c.ativo; });
    var pode = CtiApp.pode('configurar');
    var item = function (c, i) {
      var ativa = i !== null;
      return '<div class="g-item' + (ativa ? '' : ' g-item--inativo') + '" data-coluna="' + u.esc(c.codigo) + '"' +
        (pode && ativa ? ' draggable="true"' : '') + ' style="--c:' + u.cor(c.cor) + '">' +
        (pode && ativa ? '<i class="ri-draggable g-alca" aria-hidden="true"></i>' : '') +
        '<span class="g-item__icone"><i class="' + u.icone(c.icone, 'ri-list-check') + '" aria-hidden="true"></i></span>' +
        '<div class="g-item__corpo">' +
          // Código é detalhe técnico (não muda depois de criado): fica só na dica do nome.
          '<div class="g-item__nome" title="Código: ' + u.esc(c.codigo) + '">' + u.esc(c.nome) + '</div>' +
        '</div>' +
        '<div class="g-item__selos">' +
          (c.conclui ? '<span class="g-item__selo g-item__selo--conclui"><i class="ri-flag-2-line" aria-hidden="true"></i>Conclui a demanda</span>' : '') +
          '<span class="g-item__selo">' + u.plural(c.qtdDemandas || 0, 'demanda', 'demandas') + '</span>' +
        '</div>' +
        '<div class="g-item__acoes">' +
          (ativa ? '<span data-requer="configurar">' +
            '<button type="button" class="g-icone-btn" data-subir="' + i + '" aria-label="Subir"' + (i === 0 ? ' disabled' : '') + '><i class="ri-arrow-up-s-line" aria-hidden="true"></i></button>' +
            '<button type="button" class="g-icone-btn" data-descer="' + i + '" aria-label="Descer"' + (i === visiveis.length - 1 ? ' disabled' : '') + '><i class="ri-arrow-down-s-line" aria-hidden="true"></i></button>' +
          '</span>' : '') +
          interruptor('data-visivel="' + u.esc(c.codigo) + '"', c.ativo, c.ativo ? 'Desativar' : 'Ativar') +
          '<button type="button" class="g-icone-btn" data-editar-coluna="' + u.esc(c.codigo) + '" data-requer="configurar" aria-label="Editar coluna"><i class="ri-edit-line" aria-hidden="true"></i></button>' +
          '<button type="button" class="g-icone-btn g-icone-btn--perigo" data-excluir-coluna="' + u.esc(c.codigo) + '" data-requer="configurar" aria-label="Excluir coluna"><i class="ri-delete-bin-line" aria-hidden="true"></i></button>' +
        '</div></div>';
    };
    alvo.innerHTML = cabecalho('Colunas do Kanban',
      'Nome, cor, ícone, ordem e visibilidade. Arraste para reordenar.', botaoNovo('cf-nova-coluna', 'Nova coluna')) +
      '<div class="g-lista-colunas" id="cf-colunas">' + visiveis.map(function (c, i) { return item(c, i); }).join('') +
        (visiveis.length ? '' : '<p class="g-vazio">Nenhuma coluna visível no quadro.</p>') + '</div>' +
      grupoInativos('colunas', 'Inativas', ocultas.length,
        '<div class="g-lista-colunas">' + ocultas.map(function (c) { return item(c, null); }).join('') + '</div>') +
      '<div class="g-nota"><i class="ri-information-line" aria-hidden="true"></i><div>' +
        '<strong>Inativa ou excluída?</strong> Coluna inativa some de todas as telas junto com as demandas dela, que continuam salvas. ' +
        'Ao reativar, tudo volta; a coluna entra no fim do quadro se a ordem tiver mudado nesse meio tempo. ' +
        'Excluir só é possível com a coluna vazia; o identificador fica reservado para o histórico continuar legível. ' +
        'Marque “conclui a demanda” nas colunas de entrega: é por elas que o painel conta as concluídas e deixa de cobrar prazo.</div></div>';

    var novo = u.el('cf-nova-coluna');
    if (novo) { novo.addEventListener('click', function () { editarItem('coluna', null); }); }
    u.cada(alvo, '[data-editar-coluna]', function (b) {
      b.addEventListener('click', function () { editarItem('coluna', CtiApp.coluna(b.dataset.editarColuna)); });
    });
    u.cada(alvo, '[data-excluir-coluna]', function (b) {
      b.addEventListener('click', function () { excluirColuna(CtiApp.coluna(b.dataset.excluirColuna), b); });
    });
    u.cada(alvo, '[data-visivel]', function (cx) {
      cx.addEventListener('change', function () {
        var c = CtiApp.coluna(cx.dataset.visivel);
        interruptorPendente(cx, 'coluna:' + c.codigo, 'a coluna ' + aspas(c.nome), function () {
          return CtiApp.dados.salvarColuna(Object.assign({}, c, { ativo: cx.checked })).then(function () { return true; });
        });
      });
    });
    u.cada(alvo, '[data-subir], [data-descer]', function (b) {
      b.addEventListener('click', function () {
        // Move a linha na tela; a nova ordem fica pendente até salvar no rodapé.
        var item = b.closest('[data-coluna]');
        var lista = item.parentNode;
        if (b.dataset.subir !== undefined && item.previousElementSibling) { lista.insertBefore(item, item.previousElementSibling); }
        if (b.dataset.descer !== undefined && item.nextElementSibling) { lista.insertBefore(item.nextElementSibling, item); }
        ajustarSetas(lista);
        salvarOrdemDaTela(lista);
        b.focus();
      });
    });
    if (pode) { ligarArrasto(u.el('cf-colunas')); }
  }

  function ligarArrasto(lista) {
    var arrastado = null;
    lista.addEventListener('dragstart', function (e) {
      arrastado = e.target.closest('[data-coluna]');
      if (!arrastado || e.target.closest('.g-interruptor, button')) { e.preventDefault(); return; }
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', arrastado.dataset.coluna); } catch (err) { /* navegador antigo */ }
      arrastado.style.opacity = '.45';
    });
    lista.addEventListener('dragend', function () {
      if (!arrastado) { return; }
      arrastado.style.opacity = '';
      arrastado = null;
      // Registra ao soltar em qualquer ponto: o drop pode cair fora de um item e não disparar.
      ajustarSetas(lista);
      salvarOrdemDaTela(lista);
    });
    lista.addEventListener('dragover', function (e) {
      if (!arrastado) { return; }
      // Sempre aceita o drop: quando o item passa por baixo do cursor, o alvo é ele mesmo.
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      var alvo = e.target.closest('[data-coluna]');
      if (!alvo || alvo === arrastado) { return; }
      var caixa = alvo.getBoundingClientRect();
      var depois = e.clientY > caixa.top + caixa.height / 2;
      lista.insertBefore(arrastado, depois ? alvo.nextSibling : alvo);
    });
    lista.addEventListener('drop', function (e) {
      if (arrastado) { e.preventDefault(); }
    });
  }

  /**
   * O servidor exige todas as colunas na nova ordem: as ocultas (fora da
   * lista arrastável) vão depois das visíveis, na ordem em que estavam.
   */
  function comOcultas(codigosVisiveis) {
    return codigosVisiveis.concat(CtiApp.estado.config.colunas.filter(function (c) { return !c.ativo; })
      .map(function (c) { return c.codigo; }));
  }

  /** Nova ordem na tela vira alteração pendente (rodapé fixo); voltar à ordem gravada tira da lista. */
  function salvarOrdemDaTela(lista) {
    var codigos = comOcultas(Array.prototype.map.call(lista.querySelectorAll('[data-coluna]'), function (x) { return x.dataset.coluna; }));
    var atual = CtiApp.estado.config.colunas.map(function (c) { return c.codigo; });
    if (codigos.join() === atual.join()) { removerAlteracao('ordem-colunas'); return; }
    registrarAlteracao('ordem-colunas', { nome: 'Mudar a ordem das colunas', salvar: function () {
      return CtiApp.dados.reordenarColunas({ codigos: codigos }).then(function () { return true; });
    } });
  }

  /** Primeira linha sem "subir", última sem "descer" depois de mover na tela. */
  function ajustarSetas(lista) {
    var itens = lista.querySelectorAll('[data-coluna]');
    Array.prototype.forEach.call(itens, function (it, i) {
      var sobe = it.querySelector('[data-subir]');
      var desce = it.querySelector('[data-descer]');
      if (sobe) { sobe.disabled = i === 0; }
      if (desce) { desce.disabled = i === itens.length - 1; }
    });
  }

  function excluirColuna(c, botao) {
    if (c.qtdDemandas) {
      CtiApp.erro('A coluna "' + c.nome + '" tem ' + u.plural(c.qtdDemandas, 'demanda', 'demandas') +
        '. Mova-as para outra coluna ou apenas oculte a coluna.');
      return;
    }
    CtiApp.confirmar({ titulo: 'Excluir a coluna "' + c.nome + '"?',
      mensagem: 'O identificador ' + c.codigo + ' fica reservado e não poderá ser usado de novo.',
      botao: 'Excluir coluna', perigo: true }).then(function (ok) {
      if (!ok) { return; }
      CtiApp.ocupado(botao, CtiApp.dados.excluirColuna({ codigo: c.codigo, versao: c.versao }))
        .then(function () {
          CtiApp.sucesso('Coluna excluída.');
          return CtiApp.recarregar(['config']);
        }, function (e) { CtiApp.falhaAoGravar(e, 'A coluna não foi excluída: '); });
    });
  }

  // ============================================ categorias/tipos/setores

  var USOS = { A: 'Demandas e documentação', T: 'Só demandas', D: 'Só documentação' };

  /** USO nulo (linha antiga) vale para os dois lados. */
  function usoDe(x) { return x.uso || 'A'; }

  /** "831 - ISAAC": código e nome na mesma linha, como no restante do Sankhya. */
  function nomeComCodigo(codUsu, nome) {
    return '<span class="g-item__codigo">' + Number(codUsu) + '</span> - ' + u.esc(nome || ('Usuário ' + codUsu));
  }

  function qtd(n, um, varios) { return '<span>' + u.plural(n || 0, um, varios) + '</span>'; }

  var SIMPLES = {
    categoria: {
      lista: function () {
        return CtiApp.estado.config.categorias.filter(function (c) { return usoDe(c) !== 'D'; });
      },
      chave: 'idCategoria', titulo: 'Categorias de demandas', novo: 'Nova categoria', rotulo: 'categoria', feminino: true,
      metodo: 'salvarCategoria', usoPadrao: 'T', icone: 'ri-price-tag-3-line',
      texto: 'Classificam as demandas; a cor aparece no card e no filtro do quadro. ' +
        'As de uso “demandas e documentação” também aparecem na aba Documentação.',
      meta: function (x) {
        return qtd(x.qtdDemandas, 'demanda', 'demandas') +
          (usoDe(x) === 'A' ? qtd(x.qtdDocumentos, 'documento', 'documentos') + '<span class="g-item__uso"><i class="ri-links-line" aria-hidden="true"></i>também na documentação</span>' : '');
      },
      sugestoes: [
        { nome: 'Procedures', descricao: 'Stored procedures', cor: '#3B82F6', icone: 'ri-database-2-line', uso: 'A' },
        { nome: 'Triggers', descricao: 'Gatilhos de banco', cor: '#F59E0B', icone: 'ri-flashlight-line', uso: 'A' },
        { nome: 'Scripts', descricao: 'Scripts SQL e utilitários', cor: '#8B5CF6', icone: 'ri-file-code-line', uso: 'A' },
        { nome: 'Ações agendadas', descricao: 'Jobs e agendamentos', cor: '#EC4899', icone: 'ri-calendar-event-line', uso: 'A' },
        { nome: 'Rotinas', descricao: 'Rotinas operacionais', cor: '#71CE7E', icone: 'ri-loop-left-line', uso: 'A' },
        { nome: 'Suporte', descricao: 'Atendimento a usuários', cor: '#06B6D4', icone: 'ri-customer-service-2-line', uso: 'T' }
      ]
    },
    categoriaDoc: {
      lista: function () {
        return CtiApp.estado.config.categorias.filter(function (c) { return usoDe(c) !== 'T'; });
      },
      chave: 'idCategoria', titulo: 'Categorias de documentação', novo: 'Nova categoria', rotulo: 'categoria', feminino: true,
      metodo: 'salvarCategoria', usoPadrao: 'D', icone: 'ri-folder-3-line',
      texto: 'Agrupam os documentos (filtro da tela Documentação). As de uso “demandas e documentação” também classificam demandas.',
      meta: function (x) {
        return qtd(x.qtdDocumentos, 'documento', 'documentos') +
          (usoDe(x) === 'A' ? qtd(x.qtdDemandas, 'demanda', 'demandas') + '<span class="g-item__uso"><i class="ri-links-line" aria-hidden="true"></i>também nas demandas</span>' : '');
      }
    },
    tipoDoc: {
      lista: function () { return CtiApp.estado.config.tiposObjeto; },
      chave: 'codigo', titulo: 'Tipos de documento', novo: 'Novo tipo', rotulo: 'tipo de documento', feminino: false,
      metodo: 'salvarTipoDocumento', icone: 'ri-file-line',
      texto: 'O que está sendo documentado (procedure, trigger, rotina...). Formam o menu lateral da tela Documentação.',
      meta: function (x) {
        return '<code>' + u.esc(x.codigo) + '</code>' + qtd(x.qtdDocumentos, 'documento', 'documentos');
      }
    },
    setor: {
      lista: function () { return CtiApp.estado.config.setores; },
      chave: 'idSetor', titulo: 'Setores', novo: 'Novo setor', rotulo: 'setor', feminino: false,
      metodo: 'salvarSetor', icone: 'ri-building-2-line',
      texto: 'Áreas da empresa que pedem demandas à TI.',
      meta: function (x) { return qtd(x.qtdDemandas, 'demanda', 'demandas'); },
      sugestoes: [
        { nome: 'TI', cor: '#3B82F6', icone: 'ri-computer-line' },
        { nome: 'Financeiro', cor: '#10B981', icone: 'ri-money-dollar-circle-line' },
        { nome: 'RH', cor: '#EC4899', icone: 'ri-team-line' },
        { nome: 'Comercial', cor: '#F59E0B', icone: 'ri-shopping-bag-3-line' },
        { nome: 'Logística', cor: '#06B6D4', icone: 'ri-truck-line' },
        { nome: 'Fiscal', cor: '#EF4444', icone: 'ri-file-text-line' },
        { nome: 'Diretoria', cor: '#64748B', icone: 'ri-briefcase-line' }
      ]
    }
  };

  var NOTA_DESATIVAR = '<div class="g-nota"><i class="ri-information-line" aria-hidden="true"></i><div>' +
    'Item inativo só aparece aqui. Some dos formulários, filtros e menus; demandas e documentos que já o usam continuam com ele. ' +
    'Ao reativar, volta para todas as telas.</div></div>';

  function pintarDocumentacao(alvo) {
    alvo.innerHTML = '<div class="g-config-secao" id="cf-sec-tipos"></div>' +
      '<div class="g-config-secao" id="cf-sec-catdoc"></div>' + NOTA_DESATIVAR;
    pintarSimples(u.el('cf-sec-tipos'), 'tipoDoc');
    pintarSimples(u.el('cf-sec-catdoc'), 'categoriaDoc');
  }

  /** Lista com interruptor e edição. Os eventos ficam presos a `alvo`: a aba Documentação tem duas listas. */
  function pintarSimples(alvo, tipo, comNota) {
    var cfg = SIMPLES[tipo];
    var lista = cfg.lista();
    var item = function (x) {
      var chave = u.esc(String(x[cfg.chave]));
      // Cartão em três faixas: nome e ações no topo, descrição, contadores no rodapé.
      return '<div class="g-item g-item--cartao' + (x.ativo ? '' : ' g-item--inativo') + '" style="--c:' + u.cor(x.cor) + '">' +
        '<div class="g-item__topo">' +
          '<span class="g-item__icone"><i class="' + u.icone(x.icone, cfg.icone) + '" aria-hidden="true"></i></span>' +
          '<div class="g-item__nome" title="' + u.esc(x.nome) + '">' + u.esc(x.nome) + '</div>' +
          '<div class="g-item__acoes">' +
            interruptor('data-ativo="' + chave + '"', x.ativo, x.ativo ? 'Desativar' : 'Ativar') +
            '<button type="button" class="g-icone-btn" data-editar="' + chave + '" data-requer="configurar" aria-label="Editar" title="Editar">' +
              '<i class="ri-edit-line" aria-hidden="true"></i></button>' +
          '</div>' +
        '</div>' +
        (x.descricao ? '<p class="g-item__descricao" title="' + u.esc(x.descricao) + '">' + u.esc(x.descricao) + '</p>' : '') +
        '<div class="g-item__rodape">' + cfg.meta(x) + '</div>' +
      '</div>';
    };
    var ativos = lista.filter(function (x) { return x.ativo; });
    var inativos = lista.filter(function (x) { return !x.ativo; });
    alvo.innerHTML = cabecalho(cfg.titulo, cfg.texto, botaoNovo('cf-novo-' + tipo, cfg.novo)) +
      (lista.length
        ? (ativos.length ? '<div class="g-grade">' + ativos.map(item).join('') + '</div>'
            : '<p class="g-vazio">Nenhum item ativo.</p>') +
          grupoInativos(tipo, cfg.feminino ? 'Inativas' : 'Inativos', inativos.length,
            '<div class="g-grade">' + inativos.map(item).join('') + '</div>')
        : '<div class="g-bloco g-vazio"><i class="' + cfg.icone + '" aria-hidden="true"></i>Nenhum cadastro ainda.' +
          (cfg.sugestoes ? '<br><span data-requer="configurar">Crie o primeiro ou use as sugestões: ' +
            '<button type="button" class="g-btn g-btn--link" data-sugestoes>criar sugestões</button></span>' : '') +
          '</div>') +
      (comNota ? NOTA_DESATIVAR : '');

    var novo = u.el('cf-novo-' + tipo);
    if (novo) { novo.addEventListener('click', function () { editarItem(tipo, null); }); }
    var sugestoes = alvo.querySelector('[data-sugestoes]');
    if (sugestoes) { sugestoes.addEventListener('click', function () { criarSugestoes(tipo, sugestoes); }); }
    u.cada(alvo, '[data-editar]', function (b) {
      b.addEventListener('click', function () { editarItem(tipo, u.porId(lista, cfg.chave, b.dataset.editar)); });
    });
    u.cada(alvo, '[data-ativo]', function (cx) {
      cx.addEventListener('change', function () {
        var x = u.porId(lista, cfg.chave, cx.dataset.ativo);
        interruptorPendente(cx, tipo + ':' + x[cfg.chave], (cfg.feminino ? 'a ' : 'o ') + cfg.rotulo + ' ' + aspas(x.nome), function () {
          return CtiApp.dados[cfg.metodo](Object.assign({}, x, { ativo: cx.checked })).then(function () { return true; });
        });
      });
    });
  }

  /** Cadastro inicial sugerido: só aparece com a lista vazia. */
  function criarSugestoes(tipo, botao) {
    var metodo = SIMPLES[tipo].metodo;
    // Em sequência: a numeração da chave é da plataforma e não precisa de corrida.
    var cadeia = SIMPLES[tipo].sugestoes.reduce(function (p, item) {
      return p.then(function () { return CtiApp.dados[metodo](Object.assign({ ativo: true }, item)); });
    }, Promise.resolve());
    CtiApp.ocupado(botao, cadeia)
      .then(function () {
        CtiApp.sucesso('Cadastro sugerido criado.');
        return CtiApp.recarregar(['config']);
      }, function (e) {
        CtiApp.falhaAoGravar(e, 'O cadastro sugerido parou no meio: ');
        CtiApp.recarregar(['config']);
      });
  }

  // ====================================== modal de coluna/categoria/tipo/setor

  /** Identificador em maiúsculas a partir do nome (coluna e tipo de documento). */
  function codigoDoNome(nome) {
    return u.normal(nome).toUpperCase().replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '').replace(/^[0-9_]+/, '').slice(0, 20);
  }

  /** Grade do seletor agrupada; um ícone gravado fora do catálogo continua aparecendo no topo. */
  /** Seletor de ícones reaproveitável: busca + grade (prefixo diferencia os ids quando há mais de um na tela). */
  function htmlSeletorIcones(prefixo, atual) {
    return '<input type="search" id="' + prefixo + '-icone-busca" class="g-icones__busca" placeholder="Buscar ícone (ex.: banco, whatsapp, roteador)" aria-label="Buscar ícone">' +
      '<div class="g-icones" id="' + prefixo + '-icones">' + htmlIcones(atual) + '</div>';
  }

  function ligarSeletorIcones(prefixo, aoEscolher) {
    var grade = u.el(prefixo + '-icones');
    u.el(prefixo + '-icone-busca').addEventListener('input', function (e) { filtrarIcones(e.target.value, grade); });
    grade.addEventListener('click', function (e) {
      var b = e.target.closest('[data-icone]');
      if (!b) { return; }
      u.cada(grade, '[data-icone]', function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      aoEscolher(b.dataset.icone);
    });
  }

  function htmlIcones(atual) {
    var conhecido = GRUPOS_ICONES.some(function (g) { return g.icones.some(function (i) { return i[0] === atual; }); });
    var extra = atual && !conhecido && u.icone(atual, '') ? botaoIcone([atual, '']) : '';
    return extra + GRUPOS_ICONES.map(function (g) {
      return '<div class="g-icones__grupo" data-grupo>' + u.esc(g.grupo) + '</div>' + g.icones.map(botaoIcone).join('');
    }).join('');
  }

  function botaoIcone(i) {
    var nome = i[0].replace(/^(ri|ti|si)-|-line$/g, '').replace(/^brand-/, '').replace(/-/g, ' ');
    return '<button type="button" data-icone="' + u.esc(i[0]) + '" data-termos="' + u.esc(u.normal(nome + ' ' + i[1])) +
      '" aria-label="' + u.esc(i[1] || nome) + '" title="' + u.esc(i[1] || nome) + '"><i class="' + u.icone(i[0]) + '" aria-hidden="true"></i></button>';
  }

  /**
   * Filtra por termo em português; esconde o título do grupo que ficou sem
   * ícone. Com 2+ letras também procura nos pacotes inteiros (Tabler e marcas
   * do Simple Icons, nomes em inglês) e mostra até 60 resultados a mais.
   */
  function filtrarIcones(texto, gradeAlvo) {
    var termo = u.normal(texto).trim();
    var grade = gradeAlvo || u.el('cf-icones');
    u.cada(grade, '[data-dinamico]', function (x) { x.parentNode.removeChild(x); });
    var titulo = null;
    var visiveisNoGrupo = 0;
    Array.prototype.forEach.call(grade.children, function (el) {
      if (el.hasAttribute('data-grupo')) {
        if (titulo) { titulo.hidden = visiveisNoGrupo === 0; }
        titulo = el;
        visiveisNoGrupo = 0;
        return;
      }
      var mostra = !termo || el.dataset.termos.indexOf(termo) >= 0;
      el.hidden = !mostra;
      if (mostra) { visiveisNoGrupo++; }
    });
    if (titulo) { titulo.hidden = visiveisNoGrupo === 0; }
    if (termo.length < 2 || typeof CtiCatalogoIcones === 'undefined') { return; }
    var chave = termo.replace(/\s+/g, '-');
    var jaNaGrade = {};
    u.cada(grade, '[data-icone]', function (b) { jaNaGrade[b.dataset.icone] = true; });
    var achados = CtiCatalogoIcones.marcas.filter(function (n) { return n.indexOf(chave.replace(/-/g, '')) >= 0; }).map(function (n) { return 'si-' + n; })
      .concat(CtiCatalogoIcones.tabler.filter(function (n) { return n.indexOf(chave) >= 0; }).map(function (n) { return 'ti-' + n; }))
      .filter(function (c) { return !jaNaGrade[c]; }).slice(0, 60);
    if (!achados.length) { return; }
    var tmp = document.createElement('div');
    tmp.innerHTML = '<div class="g-icones__grupo" data-grupo data-dinamico>Mais ícones (nomes em inglês)</div>' +
      achados.map(function (c) { return botaoIcone([c, '']).replace('<button ', '<button data-dinamico '); }).join('');
    while (tmp.firstChild) { grade.appendChild(tmp.firstChild); }
  }

  function editarItem(tipo, x) {
    var novo = !x;
    var cfg = SIMPLES[tipo] || { rotulo: 'coluna', feminino: true, icone: 'ri-list-check' };
    var ehCategoria = tipo === 'categoria' || tipo === 'categoriaDoc';
    var temCodigo = tipo === 'coluna' || tipo === 'tipoDoc';
    var v = x || { nome: '', descricao: '', codigo: '', cor: CORES[4], icone: cfg.icone,
      conclui: false, ativo: true, uso: cfg.usoPadrao };
    var estado = { cor: u.cor(v.cor, CORES[4]), icone: u.icone(v.icone) };
    var guardaCodigo = tipo === 'coluna' ? 'é o que as demandas e o histórico guardam.' : 'é o que os documentos guardam.';

    CtiApp.abrirModal({
      titulo: (novo ? (cfg.feminino ? 'Nova ' : 'Novo ') : 'Editar ') + cfg.rotulo,
      // Largura de formulário: dados à esquerda, cor e ícone à direita (cabe sem rolar em 768 px).
      corpo:
        '<form class="g-form g-form--duas" id="cf-form" novalidate>' +
          '<div class="g-form">' +
          '<div class="g-previa" id="cf-previa"></div>' +
          '<label class="g-campo"><span class="g-obrigatorio">Nome</span>' +
            '<input type="text" id="cf-nome" maxlength="60" autofocus value="' + u.esc(v.nome) + '"></label>' +
          (temCodigo ?
            '<label class="g-campo"><span class="g-obrigatorio">Identificador</span>' +
              '<input type="text" id="cf-codigo" maxlength="20" value="' + u.esc(v.codigo) + '"' + (novo ? '' : ' disabled') +
              ' style="font-family:ui-monospace,Consolas,monospace;text-transform:uppercase">' +
              '<small class="g-form__nota">' + (novo ? 'Letras, números e _. Gerado a partir do nome; não muda depois de criado.'
                : 'Não muda: ' + guardaCodigo) + '</small></label>'
            : '') +
          (tipo === 'coluna' ?
            '<label class="g-cofre__flag g-flag-linha"><span class="g-interruptor"><input type="checkbox" id="cf-conclui"' + (v.conclui ? ' checked' : '') + '><span></span></span>' +
              '<span class="g-cofre__flag-texto">Demanda nesta coluna está concluída (conta nos indicadores e deixa de cobrar prazo)</span></label>'
            : '') +
          (ehCategoria ?
            '<label class="g-campo"><span>Descrição</span><input type="text" id="cf-descricao" maxlength="200" value="' + u.esc(v.descricao || '') + '"></label>' +
            '<label class="g-campo"><span>Usar em</span><select id="cf-uso">' +
              Object.keys(USOS).map(function (k) { return u.opcao(k, USOS[k], usoDe(v)); }).join('') + '</select></label>'
            : '') +
          '</div>' +
          '<div class="g-form">' +
          '<div class="g-campo"><span>Cor</span><div class="g-paleta" id="cf-cores">' +
            CORES.map(function (c) {
              return '<button type="button" class="g-paleta__cor" data-cor="' + c + '" style="background:' + c + '" aria-label="Cor ' + c + '"></button>';
            }).join('') +
            '<input type="color" id="cf-cor-livre" value="' + estado.cor + '" aria-label="Outra cor"></div></div>' +
          '<div class="g-campo"><span>Ícone</span>' + htmlSeletorIcones('cf', estado.icone) + '</div>' +
          '</div>' +
        '</form>',
      rodape:
        '<button type="button" class="g-btn g-btn--cancelar" id="cf-cancelar">Cancelar</button>' +
        '<button type="button" class="g-btn g-btn--primario" id="cf-salvar"><i class="ri-save-line" aria-hidden="true"></i> Salvar</button>'
    });

    var form = u.el('cf-form');
    CtiApp.vigiarFormulario(form);

    function atualizarPrevia() {
      var nome = u.el('cf-nome').value.trim() || 'Pré-visualização';
      u.el('cf-previa').innerHTML = tipo === 'coluna'
        ? '<div class="g-coluna__cab" style="--c:' + u.cor(estado.cor) + ';--c-texto:' + (u.corClara(estado.cor) ? '#1E2A24' : '#fff') +
          ';border-radius:10px;flex:1"><i class="' + estado.icone + '" aria-hidden="true"></i><span class="g-coluna__titulo">' +
          u.esc(nome) + '</span><span class="g-coluna__qtd">3</span></div>'
        : '<span class="g-selo" style="--c:' + u.cor(estado.cor) + '"><i class="' + u.icone(estado.icone) + '" aria-hidden="true"></i>' + u.esc(nome) + '</span>';
      u.cada(form, '[data-cor]', function (b) { b.setAttribute('aria-pressed', b.dataset.cor === estado.cor ? 'true' : 'false'); });
      u.cada(form, '[data-icone]', function (b) { b.setAttribute('aria-pressed', b.dataset.icone === estado.icone ? 'true' : 'false'); });
    }

    u.el('cf-cores').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cor]');
      if (b) { estado.cor = b.dataset.cor; u.el('cf-cor-livre').value = estado.cor; atualizarPrevia(); }
    });
    u.el('cf-cor-livre').addEventListener('input', function (e) { estado.cor = e.target.value.toUpperCase(); atualizarPrevia(); });
    ligarSeletorIcones('cf', function (icone) { estado.icone = icone; atualizarPrevia(); });
    u.el('cf-nome').addEventListener('input', function () {
      if (temCodigo && novo) { u.el('cf-codigo').value = codigoDoNome(u.el('cf-nome').value); }
      atualizarPrevia();
    });
    atualizarPrevia();
    u.el('cf-cancelar').addEventListener('click', function () { CtiApp.fecharModal(); });
    u.el('cf-salvar').addEventListener('click', function () {
      var nome = u.el('cf-nome').value.trim();
      if (!nome) { CtiApp.erro('Informe o nome.'); return; }
      var dto = { nome: nome, cor: estado.cor, icone: estado.icone, ativo: v.ativo !== false, versao: novo ? null : v.versao };
      var metodo;
      if (temCodigo) {
        dto.codigo = u.el('cf-codigo').value.trim().toUpperCase();
        if (!/^[A-Z][A-Z0-9_]{1,19}$/.test(dto.codigo)) {
          CtiApp.erro('Identificador inválido: de 2 a 20 letras maiúsculas, números ou _, começando por letra.');
          return;
        }
      }
      if (tipo === 'coluna') {
        dto.conclui = u.el('cf-conclui').checked;
        metodo = 'salvarColuna';
      } else {
        if (!temCodigo) { dto[cfg.chave] = novo ? null : x[cfg.chave]; }
        if (ehCategoria) {
          dto.descricao = u.el('cf-descricao').value.trim() || null;
          dto.uso = u.el('cf-uso').value;
        }
        metodo = cfg.metodo;
      }
      CtiApp.ocupado(u.el('cf-salvar'), CtiApp.dados[metodo](dto))
        .then(function () {
          CtiApp.fecharModal(true);
          CtiApp.sucesso('Salvo.');
          return CtiApp.recarregar(['config']);
        }, function (e) { CtiApp.falhaAoGravar(e); });
    });
  }

  /** Gravação direta (interruptores): volta o controle se o servidor recusar. */


  // ============================================================ responsáveis

  function pintarResponsaveis(alvo) {
    var cfg = CtiApp.estado.config;
    var texto = cfg.grupoResponsaveis
      ? 'Usuários ativos (sem data limite de acesso) do grupo <strong>' + u.esc(cfg.nomeGrupoResponsaveis || '') +
        '</strong>. Para incluir alguém, coloque o usuário nesse grupo no Sankhya.'
      : 'Nenhum grupo escolhido: ninguém pode ser responsável por demandas ainda.';
    var seletorGrupo = CtiApp.pode('configurar')
      ? '<div class="g-grupo" data-requer="configurar">' +
          '<label class="g-campo g-campo--inline"><span>Grupo dos responsáveis</span>' +
          '<select id="cf-grupo">' + u.opcao('0', 'Nenhum', cfg.grupoResponsaveis) +
            (cfg.grupos || []).map(function (g) {
              return u.opcao(g.codGrupo, g.nomeGrupo + ' (' + g.codGrupo + ')', cfg.grupoResponsaveis);
            }).join('') +
          '</select></label>' +
        '</div>'
      : '';
    var itemResp = function (r) {
      return '<div class="g-item' + (r.oculto ? ' g-item--inativo' : '') + '" style="--c:' + u.cor(r.cor, u.corDaPessoa(r.codUsu)) + '">' +
        CtiApp.avatarPessoa(r.codUsu, r.nomeUsu, 'g') +
        '<div class="g-item__corpo"><div class="g-item__nome">' + nomeComCodigo(r.codUsu, r.nomeUsu) + '</div></div>' +
        '<div class="g-item__acoes">' +
          interruptor('data-visivel-resp="' + Number(r.codUsu) + '"', !r.oculto, r.oculto ? 'Ativar' : 'Desativar') +
          '<button type="button" class="g-icone-btn" data-editar-resp="' + Number(r.codUsu) + '" data-requer="configurar" aria-label="Editar sigla e cor">' +
            '<i class="ri-edit-line" aria-hidden="true"></i></button>' +
        '</div></div>';
    };
    var visiveis = cfg.responsaveis.filter(function (r) { return !r.oculto; });
    var ocultos = cfg.responsaveis.filter(function (r) { return r.oculto; });
    alvo.innerHTML = cabecalho('Responsáveis', texto, seletorGrupo) +
      (visiveis.length ? '<div class="g-grade">' + visiveis.map(itemResp).join('') + '</div>' : '') +
      grupoInativos('responsaveis', 'Inativos', ocultos.length,
        '<div class="g-grade">' + ocultos.map(itemResp).join('') + '</div>') +
      '<div class="g-nota"><i class="ri-information-line" aria-hidden="true"></i><div>A foto vem do cadastro do usuário no Sankhya. ' +
        'Desative contas de serviço do grupo (integrações, por exemplo): somem da atribuição de demandas e dos filtros.</div></div>';

    var grupo = u.el('cf-grupo');
    if (grupo) {
      // Trocar o grupo é alteração pendente: grava pelo rodapé fixo.
      grupo.addEventListener('change', function () {
        if (String(grupo.value) === String(cfg.grupoResponsaveis)) { removerAlteracao('grupo-responsaveis'); return; }
        registrarAlteracao('grupo-responsaveis', {
          nome: 'Trocar o grupo dos responsáveis',
          salvar: function () {
            return CtiApp.dados.salvarGrupoResponsaveis({ codGrupo: Number(grupo.value), versao: cfg.versaoGrupo })
              .then(function () { return true; });
          },
          aviso: function () {
            var novo = Number(grupo.value);
            return {
              titulo: 'Trocar o grupo dos responsáveis?',
              mensagem: novo ? 'Os usuários ativos do grupo passam a receber demandas.'
                : 'Ninguém poderá receber demandas até um grupo ser escolhido.',
              topico: novo ? 'Responsáveis: grupo ' + aspas(grupo.options[grupo.selectedIndex].text) : 'Responsáveis: sem grupo'
            };
          }
        });
      });
    }
    u.cada(alvo, '[data-visivel-resp]', function (cx) {
      cx.addEventListener('change', function () {
        var r = u.porId(cfg.responsaveis, 'codUsu', cx.dataset.visivelResp);
        interruptorPendente(cx, 'responsavel:' + r.codUsu, 'o responsável ' + r.nomeUsu, function () {
          return CtiApp.dados.salvarResponsavel(Object.assign({}, r, { oculto: !cx.checked })).then(function () { return true; });
        });
      });
    });
    u.cada(alvo, '[data-editar-resp]', function (b) {
      b.addEventListener('click', function () { editarResponsavel(u.porId(cfg.responsaveis, 'codUsu', b.dataset.editarResp)); });
    });
  }

  function editarResponsavel(r) {
    var cor = u.cor(r.cor, u.corDaPessoa(r.codUsu));
    CtiApp.abrirModal({
      titulo: 'Responsável: ' + r.nomeUsu,
      tamanho: 'estreito',
      corpo: '<form class="g-form" id="cf-resp-form" novalidate>' +
        '<label class="g-campo"><span>Sigla no avatar (sem foto)</span>' +
          '<input type="text" id="cf-sigla" maxlength="4" autofocus value="' + u.esc(r.sigla || '') + '" placeholder="' + u.esc(u.iniciais(r.nomeUsu)) +
          '" style="text-transform:uppercase"></label>' +
        '<div class="g-campo"><span>Cor</span><div class="g-paleta" id="cf-resp-cores">' +
          CORES.map(function (c) {
            return '<button type="button" class="g-paleta__cor" data-cor="' + c + '" style="background:' + c + '" aria-pressed="' + (c === cor) + '" aria-label="Cor ' + c + '"></button>';
          }).join('') + '</div></div>' +
        '</form>',
      rodape: '<button type="button" class="g-btn g-btn--cancelar" id="cf-resp-cancelar">Cancelar</button>' +
        '<button type="button" class="g-btn g-btn--primario" id="cf-resp-salvar"><i class="ri-save-line" aria-hidden="true"></i> Salvar</button>'
    });
    CtiApp.vigiarFormulario(u.el('cf-resp-form'));
    u.el('cf-resp-cores').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cor]');
      if (!b) { return; }
      cor = b.dataset.cor;
      u.cada(u.el('cf-resp-cores'), '[data-cor]', function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    });
    u.el('cf-resp-cancelar').addEventListener('click', function () { CtiApp.fecharModal(); });
    u.el('cf-resp-salvar').addEventListener('click', function () {
      var sigla = u.el('cf-sigla').value.trim().toUpperCase();
      if (sigla && !/^[A-Z0-9]{1,4}$/.test(sigla)) { CtiApp.erro('Sigla: até 4 letras ou números.'); return; }
      CtiApp.ocupado(u.el('cf-resp-salvar'), CtiApp.dados.salvarResponsavel(
        { codUsu: r.codUsu, sigla: sigla || null, cor: cor, oculto: r.oculto, versao: r.versao }))
        .then(function () {
          CtiApp.fecharModal(true);
          CtiApp.sucesso('Salvo.');
          return CtiApp.recarregar(['config']);
        }, function (e) { CtiApp.falhaAoGravar(e); });
    });
  }

  // ============================================================ solicitantes

  function pintarSolicitantes(alvo) {
    var porCodigo = {};
    CtiApp.estado.demandas.forEach(function (d) {
      if (u.temUsuario(d.codUsuSol)) { porCodigo[d.codUsuSol] = { codUsu: d.codUsuSol, nome: d.nomeSol }; }
    });
    var lista = Object.keys(porCodigo).map(function (k) { return porCodigo[k]; })
      .sort(function (a, b) { return String(a.nome || '').localeCompare(String(b.nome || '')); });
    alvo.innerHTML = cabecalho('Solicitantes',
      'Qualquer usuário ativo do Sankhya (sem data limite de acesso) pode ser solicitante (' +
      u.plural(CtiApp.estado.config.usuarios.length, 'usuário ativo', 'usuários ativos') + '). ' +
      'Abaixo, quem pediu demandas que estão no quadro.') +
      (lista.length ? '<div class="g-grade">' + lista.map(function (s) {
        return '<div class="g-item" style="--c:' + u.corDaPessoa(s.codUsu) + '">' + CtiFotos.avatar(s.codUsu, s.nome, 'g') +
          '<div class="g-item__corpo"><div class="g-item__nome">' + nomeComCodigo(s.codUsu, s.nome) + '</div></div></div>';
      }).join('') + '</div>' : '<p class="g-vazio">Nenhuma demanda no quadro ainda.</p>');
  }

  return { iniciar: iniciar, pintar: pintar, abrirAba: abrirAba, marcarPendente: marcarPendente,
    limparPendente: limparPendente, temPendencia: temPendencia, confirmarSaida: confirmarSaida,
    registrarAlteracao: registrarAlteracao, removerAlteracao: removerAlteracao, interruptorPendente: interruptorPendente, aspas: aspas, htmlSeletorIcones: htmlSeletorIcones, ligarSeletorIcones: ligarSeletorIcones, CORES: CORES };
})();
