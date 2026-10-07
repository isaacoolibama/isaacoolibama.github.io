/**
 * Presença e tempo real.
 *
 * Dois ciclos independentes:
 *  - sinal de presença (registrarPresenca, a cada ~10 s): onde o usuário está
 *    e qual registro tem aberto; a resposta traz quem mais está no painel;
 *  - vigia de alterações (sinalAlteracao, a cada 3 s com a aba visível): só lê
 *    a assinatura dos dados. Quando ela muda, um colega gravou algo e os
 *    ouvintes recarregam a tela. É uma consulta leve, sem gravação.
 *
 * O servidor decide o que é sessão ativa; aqui só se agrupa por usuário.
 */
var CtiPresenca = (function () {
  'use strict';

  var ROTULO_ABA = { VISAOGERAL: 'Visão geral', KANBAN: 'Kanban', DOCUMENTOS: 'Documentação', CONFIG: 'Configurações', COFRE: 'Cofre' };
  var ROTULO_ENTIDADE = { T: 'demanda', D: 'documento', A: 'acesso do cofre' };
  var VIGIA_VISIVEL_MS = 3000;
  var VIGIA_OCULTA_MS = 30000;

  var idSessao = gerarIdSessao();
  var contexto = { aba: 'VISAOGERAL', entidade: null, idRegistro: null, editando: false };
  var sessoes = [];
  var intervaloMs = 10000;
  var temporizador = null;
  var enviando = false;
  var falhasSeguidas = 0;
  var ouvintesPresenca = [];
  var ouvintesDados = [];

  var assinatura = null;
  var absorverProxima = false;
  var vigiaTemporizador = null;
  var vigiando = false;
  var falhasVigia = 0;

  /** Id por aba do navegador; crypto quando existir, senão hora + aleatório. */
  function gerarIdSessao() {
    var hex = '';
    if (window.crypto && window.crypto.getRandomValues) {
      var bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      for (var i = 0; i < bytes.length; i++) { hex += ('0' + bytes[i].toString(16)).slice(-2); }
    } else {
      hex = Date.now().toString(16) + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
    }
    return hex.slice(0, 32);
  }

  function iniciar(segundos) {
    if (segundos > 0) { intervaloMs = segundos * 1000; }
    document.addEventListener('visibilitychange', function () {
      // Ao voltar para a aba, atualiza na hora em vez de esperar o próximo ciclo.
      if (!document.hidden) {
        sinalizar();
        vigiar();
      }
    });
    window.addEventListener('pagehide', encerrar);
    sinalizar();
    vigiar();
  }

  /** Atualiza onde o usuário está. Chamado ao trocar de aba e ao abrir/fechar registros. */
  function definirContexto(novo) {
    Object.keys(novo).forEach(function (k) { contexto[k] = novo[k]; });
    if (!contexto.entidade) {
      contexto.idRegistro = null;
      contexto.editando = false;
    }
    sinalizar();
  }

  function sinalizar() {
    if (enviando) { return; }
    clearTimeout(temporizador);
    enviando = true;
    CtiApp.dados.registrarPresenca({
      idSessao: idSessao,
      aba: contexto.aba,
      entidade: contexto.entidade,
      idRegistro: contexto.idRegistro,
      editando: contexto.editando
    }).then(function (resposta) {
      falhasSeguidas = 0;
      sessoes = (resposta && resposta.sessoes) || [];
      CtiFotos.atualizarVersoes(resposta && resposta.fotos);
      CtiDesligados.atualizar(resposta && resposta.desligados);
      CtiHostGator.atualizar(resposta && resposta.hostGatorLog);
      CtiDesligados.avisoHostGator(resposta && resposta.hostGatorFalha);
      ouvintesPresenca.forEach(function (fn) { fn(sessoes); });
    }, function (e) {
      falhasSeguidas++;
      // Um sinal perdido não merece alarde; três seguidos significam que a lista está velha.
      if (falhasSeguidas === 3) {
        CtiApp.erro('Não foi possível atualizar quem está online: ' + e.message);
      }
    }).then(function () {
      enviando = false;
      temporizador = setTimeout(sinalizar, intervaloMs);
    });
  }

  function vigiar() {
    if (vigiando) { return; }
    clearTimeout(vigiaTemporizador);
    vigiando = true;
    CtiApp.dados.sinalAlteracao().then(function (r) {
      falhasVigia = 0;
      var nova = r ? r.assinatura : null;
      if (absorverProxima) {
        // A tela acabou de recarregar: a mudança já está na tela, não é de terceiros.
        absorverProxima = false;
      } else if (assinatura !== null && nova !== null && nova !== assinatura) {
        ouvintesDados.forEach(function (fn) { fn(); });
      }
      assinatura = nova;
    }, function (e) {
      falhasVigia++;
      if (falhasVigia === 5) {
        CtiApp.erro('A atualização em tempo real parou de responder: ' + e.message);
      }
    }).then(function () {
      vigiando = false;
      vigiaTemporizador = setTimeout(vigiar, document.hidden ? VIGIA_OCULTA_MS : VIGIA_VISIVEL_MS);
    });
  }

  /**
   * Chamado depois que a tela recarrega os dados (inclusive após gravar):
   * a assinatura da próxima leitura passa a ser a referência, sem avisar ninguém.
   */
  function absorver() {
    absorverProxima = true;
    vigiar();
  }

  function encerrar() {
    // Melhor esforço: se a página fechar antes da resposta, o job de limpeza resolve.
    CtiApp.dados.encerrarPresenca({ idSessao: idSessao }).catch(function () { /* página já fechando */ });
  }

  /** Sessões de outros usuários (e de outras abas do próprio usuário) com o registro aberto. */
  function outrosNoRegistro(entidade, id) {
    return sessoes.filter(function (s) {
      return !s.minhaSessao && s.entidade === entidade && Number(s.idRegistro) === Number(id);
    });
  }

  /** Uma entrada por usuário, com a sessão mais recente e se ele está editando algo. */
  function usuarios() {
    var porUsuario = {};
    sessoes.forEach(function (s) {
      var atual = porUsuario[s.codUsu];
      if (!atual || String(s.dhUltimo) > String(atual.dhUltimo)) {
        porUsuario[s.codUsu] = Object.assign({}, s, { eu: atual ? atual.eu : false });
      }
      if (s.minhaSessao) { porUsuario[s.codUsu].eu = true; }
    });
    return Object.keys(porUsuario).map(function (k) { return porUsuario[k]; })
      .sort(function (a, b) {
        if (a.eu !== b.eu) { return a.eu ? -1 : 1; }
        return String(a.nomeUsu || '').localeCompare(String(b.nomeUsu || ''));
      });
  }

  function descrever(s) {
    var onde = ROTULO_ABA[s.aba] || s.aba || '';
    if (s.entidade) {
      onde += ' · ' + (s.editando ? 'editando ' : 'vendo ') +
        (ROTULO_ENTIDADE[s.entidade] || 'registro') + ' #' + s.idRegistro;
    }
    return onde;
  }

  function aoMudarPresenca(fn) { ouvintesPresenca.push(fn); }
  function aoMudarDados(fn) { ouvintesDados.push(fn); }

  return {
    iniciar: iniciar,
    definirContexto: definirContexto,
    absorver: absorver,
    outrosNoRegistro: outrosNoRegistro,
    usuarios: usuarios,
    descrever: descrever,
    aoMudarPresenca: aoMudarPresenca,
    aoMudarDados: aoMudarDados,
    contexto: function () { return Object.assign({}, contexto); }
  };
})();
