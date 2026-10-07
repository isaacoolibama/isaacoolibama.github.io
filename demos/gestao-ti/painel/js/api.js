/**
 * Transporte para o serviço GestaoTiSP do add-on.
 *
 * Usa o ServiceProxy do framework HTML5 do Sankhya, entregue pelo controller
 * Angular. Formato confirmado nas telas desta base:
 *   ServiceProxy.callService("<addon>@<Servico>.<metodo>", corpo)
 * Cada método Java recebe no máximo um parâmetro, que vai no corpo sob o
 * próprio nome. A lista de métodos aqui é o contrato com GestaoTiController.
 */
var CtiApi = (function () {
  'use strict';

  var ADDON = 'gestao-ti';
  var SERVICO = 'GestaoTiSP';
  /** Prefixo que o servidor põe na mensagem quando outro usuário gravou antes (ConflitoEdicaoException). */
  var MARCADOR_CONFLITO = '[CONFLITO] ';

  var proxy = null;
  var workspace = null;

  /** skWorkspace: serviço SkWorkspace do Om (snk.js), que abre outras telas; nulo fora do Om. */
  function configurar(serviceProxy, skWorkspace) {
    proxy = serviceProxy;
    workspace = skWorkspace || null;
  }

  /**
   * Abre uma tela do Om já posicionada no registro (chave = campos da PK,
   * ex.: { CODUSU: 10 }), numa aba nova do Om. Mesmo caminho do openApp do
   * snk.js (SkWorkspace.openAppActivity). Fora do Om devolve false.
   */
  function abrirTela(resourceId, chave) {
    var w = workspace || workspaceDoAngular();
    if (!w || typeof w.openAppActivity !== 'function') { return false; }
    w.openAppActivity(resourceId, chave);
    return true;
  }

  /**
   * O Om carrega o CTI_PainelTI.js pelo nome, sem ?v=: com o controller antigo
   * em cache o SkWorkspace não chega por configurar. Pede ao injetor do Angular.
   */
  function workspaceDoAngular() {
    try {
      var el = window.angular && document.querySelector('.ng-scope');
      var injetor = el && window.angular.element(el).injector();
      return injetor && injetor.has('SkWorkspace') ? injetor.get('SkWorkspace') : null;
    } catch (e) {
      return null;
    }
  }

  /** Chamadas repetidas em segundo plano: sem barra de carregamento do Om. */
  var DE_FUNDO = { registrarPresenca: true, encerrarPresenca: true, sinalAlteracao: true, fotoUsuario: true };

  /**
   * O erro é mostrado só pelo modal do painel. Sem ignorePopUpErrorMsgs o Om
   * abre o popup "Erro" dele por cima (snk.js, handleDefaultSystemError). Em
   * falha HTTP o Om chama errorHandler e não rejeita a promessa dele: por isso
   * a rejeição sai daqui.
   */
  function chamar(metodo, nomeParametro, valor) {
    if (!proxy) {
      return Promise.reject(new Error('ServiceProxy indisponível: a tela precisa rodar dentro do Sankhya Om.'));
    }
    var nome = ADDON + '@' + SERVICO + '.' + metodo;
    var corpo = {};
    if (nomeParametro) {
      corpo[nomeParametro] = valor === undefined ? null : valor;
    }
    return new Promise(function (resolver, rejeitar) {
      var config = {
        ignorePopUpErrorMsgs: true,
        ignoreLoadingBar: DE_FUNDO[metodo] === true,
        errorHandler: function (data, status) {
          rejeitar(criarErro(falhaHttp(data, status), nome));
        }
      };
      Promise.resolve(proxy.callService(nome, corpo, config)).then(resolver, rejeitar);
    }).then(function (result) { return extrair(result, nome); }, function (erro) {
      throw erro instanceof Error && erro.servico ? erro : criarErro(erro, nome);
    });
  }

  /** Falha de rede/HTTP vira o mesmo formato de erro do serviço. */
  function falhaHttp(data, status) {
    if (data && typeof data === 'object' && data.statusMessage) { return data; }
    var semResposta = !status || status <= 0;
    return {
      statusMessage: semResposta
        ? 'Sem resposta do servidor. Confira a conexão; se a sessão do Sankhya expirou, entre de novo.'
        : 'O servidor recusou a chamada (HTTP ' + status + ').'
    };
  }

  /**
   * Aceita o envelope completo ou o corpo já desembrulhado; status diferente
   * de "1" é erro. O bean gerado pelo Add-on Studio grava o retorno do método
   * como {"body": <retorno>} (confirmado no bytecode do GestaoTiSPBean).
   */
  function extrair(result, nome) {
    if (result && result.status !== undefined && String(result.status) !== '1') {
      throw criarErro(result, nome);
    }
    var corpo = result && result.responseBody !== undefined ? result.responseBody : result;
    return corpo && Object.prototype.hasOwnProperty.call(corpo, 'body') ? corpo.body : corpo;
  }

  function mensagemDe(erro, nome) {
    if (!erro) { return 'Erro ao executar ' + nome + '.'; }
    if (typeof erro === 'string') { return erro; }
    var candidatos = [
      erro.statusMessage,
      erro.responseJSON && erro.responseJSON.statusMessage,
      erro.data && erro.data.statusMessage,
      erro.responseBody && erro.responseBody.statusMessage,
      erro.cause && erro.cause.message,
      erro.message
    ];
    for (var i = 0; i < candidatos.length; i++) {
      if (candidatos[i] && String(candidatos[i]).trim()) { return String(candidatos[i]).trim(); }
    }
    return 'Erro ao executar ' + nome + '.';
  }

  function criarErro(origem, nome) {
    var erro = new Error(mensagemDe(origem, nome));
    erro.servico = nome;
    erro.origem = origem;
    return erro;
  }

  function ehConflito(erro) {
    return !!(erro && erro.message && erro.message.indexOf(MARCADOR_CONFLITO) === 0);
  }

  /** Mensagem pronta para o usuário, sem o marcador técnico nem motivo/solução. */
  function textoDoErro(erro) {
    return partesDoErro(erro).mensagem;
  }

  /**
   * Separa mensagem, motivo e solução. Segue o formato da FC_FORMATAHTML das
   * triggers do cliente: pela conexão JDBC (caso do add-on) ela devolve HTML
   * com "Atenção:", "Motivo:" e "Solução:"; fora dela, texto com "MOTIVO:" e
   * "SOLUCAO:". O servidor do painel usa o mesmo texto (ErroDeNegocio.java).
   */
  function partesDoErro(erro) {
    var bruto = semHtml(erro && erro.message ? erro.message : String(erro || ''));
    // Linhas ORA de pilha (06512, 04088...) vão para o bloco técnico; ORA-20xxx é a mensagem da aplicação.
    var texto = bruto
      .replace(/^\s*\[CONFLITO\]\s*/, '')
      .replace(/^\s*ORA-(?!2\d{4})\d{5}:.*$/gm, '')
      .replace(/ORA-2\d{4}:\s*/g, '')
      .replace(/Informa[çc][õo]es para o Implantador[^\n]*/gi, '')
      .replace(/^\s*Aten[çc][ãa]o:\s*/i, '');
    var solucao = extrairParte(texto, /\n?\s*SOLU[ÇC][ÃA]O\s*:\s*/i);
    var motivo = extrairParte(solucao.antes, /\n?\s*MOTIVO\s*:\s*/i);
    return {
      // Erro só de banco (ORA-00001...): sem texto de aplicação, a própria linha ORA é a mensagem.
      mensagem: limpar(motivo.antes) || limpar(texto) || limpar(bruto.split('\n')[0]) || 'Erro sem mensagem.',
      motivo: limpar(motivo.depois),
      solucao: limpar(solucao.depois)
    };
  }

  /**
   * Só o que a mensagem ao usuário não mostra: serviço, onde o erro nasceu
   * (objeto e linha do ORA-06512, ou validação do próprio add-on), códigos
   * ORA e a data/hora. A mensagem, o motivo e a solução já estão acima.
   */
  function textoTecnico(erro) {
    var bruto = semHtml(erro && erro.message ? erro.message : String(erro || ''));
    var origens = [];
    var reOrigem = /ORA-06512:\s*(?:at|em)\s+(?:line\s+(\d+)|"([^"]+)",\s*(?:line|linha)\s+(\d+))/gi;
    var m;
    while ((m = reOrigem.exec(bruto))) {
      origens.push(m[2] ? m[2] + ', linha ' + m[3] : 'bloco anônimo, linha ' + m[1]);
    }
    var codigos = (bruto.match(/ORA-\d{5}/g) || []).filter(function (c, i, l) {
      return c !== 'ORA-06512' && l.indexOf(c) === i;
    });
    var agora = new Date();
    var doisDig = function (n) { return ('0' + n).slice(-2); };
    var quando = doisDig(agora.getDate()) + '/' + doisDig(agora.getMonth() + 1) + '/' + agora.getFullYear() + ' ' +
      doisDig(agora.getHours()) + ':' + doisDig(agora.getMinutes()) + ':' + doisDig(agora.getSeconds());
    var linhas = ['Serviço: ' + (erro && erro.servico ? erro.servico : 'não identificado')];
    if (origens.length) {
      linhas.push('Origem: ' + origens.join(' <- '));
    } else if (!codigos.length) {
      linhas.push('Origem: validação do add-on (servidor)');
    }
    if (codigos.length) { linhas.push('Código: ' + codigos.join(', ')); }
    linhas.push('Data/hora: ' + quando);
    return linhas.join('\n');
  }

  function extrairParte(texto, marcador) {
    var m = marcador.exec(texto);
    return m ? { antes: texto.slice(0, m.index), depois: texto.slice(m.index + m[0].length) } : { antes: texto, depois: '' };
  }

  function limpar(t) {
    return String(t || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  /** HTML vindo do banco vira texto (DOMParser não executa script nem carrega imagem). */
  function semHtml(t) {
    if (!/<[a-z][^>]*>/i.test(t) || typeof DOMParser === 'undefined') { return t; }
    var doc = new DOMParser().parseFromString(t.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n'), 'text/html');
    return doc.body ? doc.body.textContent || '' : t;
  }

  function itens(p) { return p.then(function (c) { return (c && c.itens) || []; }); }
  function id(p) { return p.then(function (c) { return c ? c.id : null; }); }
  /** Resultado de lote: sempre { qtd, erros } (erros vazio quando tudo deu certo). */
  function lote(c) { return { qtd: (c && c.qtd) || 0, erros: (c && c.erros) || [] }; }

  return {
    configurar: configurar,
    abrirTela: abrirTela,
    ehConflito: ehConflito,
    textoDoErro: textoDoErro,
    partesDoErro: partesDoErro,
    textoTecnico: textoTecnico,

    iniciarSessao:        function ()  { return chamar('iniciarSessao'); },
    registrarPresenca:    function (s) { return chamar('registrarPresenca', 'sinal', s); },
    encerrarPresenca:     function (s) { return chamar('encerrarPresenca', 'sinal', s); },
    sinalAlteracao:       function ()  { return chamar('sinalAlteracao'); },
    salvarPreferencias:   function (p) { return chamar('salvarPreferencias', 'preferencias', p); },
    fotoUsuario:          function (c) { return chamar('fotoUsuario', 'codUsu', c); },

    carregarConfiguracao: function ()  { return chamar('carregarConfiguracao'); },
    salvarColuna:         function (c) { return id(chamar('salvarColuna', 'coluna', c)); },
    excluirColuna:        function (c) { return id(chamar('excluirColuna', 'coluna', c)); },
    reordenarColunas:     function (o) { return id(chamar('reordenarColunas', 'ordem', o)); },
    salvarCategoria:      function (c) { return id(chamar('salvarCategoria', 'categoria', c)); },
    salvarSetor:          function (s) { return id(chamar('salvarSetor', 'setor', s)); },
    salvarTipoDocumento:  function (t) { return id(chamar('salvarTipoDocumento', 'tipo', t)); },
    salvarGrupoResponsaveis: function (g) { return id(chamar('salvarGrupoResponsaveis', 'grupo', g)); },
    salvarResponsavel:    function (r) { return id(chamar('salvarResponsavel', 'responsavel', r)); },

    listarDemandas:       function (f) { return itens(chamar('listarDemandas', 'filtro', f)); },
    detalharDemanda:      function (i) { return chamar('detalharDemanda', 'idTarefa', i); },
    historicoDemanda:     function (i) { return itens(chamar('historicoDemanda', 'idTarefa', i)); },
    salvarDemanda:        function (d) { return id(chamar('salvarDemanda', 'demanda', d)); },
    moverDemanda:         function (m) { return id(chamar('moverDemanda', 'movimento', m)); },
    reabrirDemanda:       function (r) { return id(chamar('reabrirDemanda', 'reabertura', r)); },
    excluirDemanda:       function (e) { return id(chamar('excluirDemanda', 'exclusao', e)); },

    salvarItem:           function (i) { return chamar('salvarItem', 'item', i); },
    excluirItem:          function (e) { return id(chamar('excluirItem', 'exclusao', e)); },
    listarComentarios:    function (i) { return itens(chamar('listarComentarios', 'idTarefa', i)); },
    comentar:             function (c) { return id(chamar('comentar', 'comentario', c)); },
    excluirComentario:    function (i) { return id(chamar('excluirComentario', 'idComentario', i)); },

    listarDocumentos:     function ()  { return itens(chamar('listarDocumentos')); },
    documentosDaDemanda:  function (i) { return itens(chamar('documentosDaDemanda', 'idTarefa', i)); },
    detalharDocumento:    function (i) { return chamar('detalharDocumento', 'idDocumento', i); },
    baixarAnexo:          function (i) { return chamar('baixarAnexo', 'idAnexo', i); },
    salvarDocumento:      function (d) { return id(chamar('salvarDocumento', 'documento', d)); },
    excluirDocumento:     function (e) { return id(chamar('excluirDocumento', 'exclusao', e)); },

    buscarTexto:          function (t) { return itens(chamar('buscarTexto', 'termo', t)); },

    carregarCofre:        function ()  { return chamar('carregarCofre'); },
    listarDesligados:     function ()  { return itens(chamar('listarDesligados')); },
    /** Lote: cada conta na própria transação; devolve { qtd, erros: [{ idAcesso, login, mensagem }] }. */
    resolverDesligados:   function (l) { return chamar('resolverDesligados', 'lote', l).then(lote); },
    alterarUsuarioOm:     function (a) { return chamar('alterarUsuarioOm', 'alteracao', a); },
    salvarAcesso:         function (a) { return id(chamar('salvarAcesso', 'acesso', a)); },
    marcarAcesso:         function (m) { return id(chamar('marcarAcesso', 'marcacao', m)); },
    excluirAcesso:        function (e) { return id(chamar('excluirAcesso', 'exclusao', e)); },
    excluirAcessos:       function (l) { return chamar('excluirAcessos', 'lote', l).then(lote); },
    revelarSenha:         function (r) { return chamar('revelarSenha', 'revelacao', r).then(function (c) { return c ? c.senha : null; }); },
    gerarSenha:           function (g) { return chamar('gerarSenha', 'geracao', g).then(function (c) { return c ? c.senha : null; }); },
    buscarDepartamentos:  function (t) { return itens(chamar('buscarDepartamentos', 'termo', t)); },
    buscarFuncionarios:   function (t) { return itens(chamar('buscarFuncionarios', 'termo', t)); },
    salvarDominio:        function (d) { return id(chamar('salvarDominio', 'dominio', d)); },
    salvarTipoAcesso:     function (t) { return id(chamar('salvarTipoAcesso', 'tipo', t)); },
    salvarTipoEquipamento: function (t) { return id(chamar('salvarTipoEquipamento', 'tipo', t)); },
    salvarGrupoCofre:     function (g) { return id(chamar('salvarGrupoCofre', 'grupo', g)); },
    // Importação da planilha desativada (carga feita em produção): o método saiu do controller.
    // importarPlanilhaCofre: function (i) { return chamar('importarPlanilhaCofre', 'importacao', i); },
    trocarChaveCofre:     function ()  { return chamar('trocarChaveCofre').then(function (c) { return c ? c.qtd : 0; }); },

    carregarHostGator:    function (f) { return chamar('carregarHostGator', 'filtro', f); },
    listarLogHostGator:   function (f) { return itens(chamar('listarLogHostGator', 'filtro', f)); },
    salvarHostGator:      function (c) { return chamar('salvarHostGator', 'config', c).then(function (r) { return r ? r.versao : null; }); },
    testarHostGator:      function ()  { return chamar('testarHostGator'); },
    conferirHostGator:    function ()  { return chamar('conferirHostGator'); },
    aplicarConferenciaHostGator: function (a) { return chamar('aplicarConferenciaHostGator', 'aplicacao', a).then(lote); }
  };
})();
