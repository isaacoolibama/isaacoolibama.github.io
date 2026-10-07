/**
 * Avatares com a foto do usuário (TSIUSU.FOTO).
 *
 * O avatar nasce com as iniciais e troca para a foto quando ela chega. Cada
 * foto é pedida uma vez por sessão da tela e guardada como Blob URL; quem não
 * tem foto fica lembrado como "sem foto" para não perguntar de novo.
 * O tipo do Blob vem do servidor, que só devolve image/* reconhecida pelos
 * primeiros bytes (Imagens.java).
 *
 * Tempo real: o sinal de presença traz a impressão de cada foto
 * (PainelAoVivoDTO.fotos). Quando ela muda, só aquela foto é pedida de novo e
 * trocada nos avatares abertos, sem recarregar a tela.
 */
var CtiFotos = (function () {
  'use strict';

  var MAXIMO_SIMULTANEAS = 3;

  var cache = {};      // codUsu -> url | null (sem foto) | Promise (a caminho)
  var fila = [];
  var ativas = 0;
  var avisouFalha = false;
  var versoes = null;  // codUsu -> impressão da foto recebida no último sinal

  /**
   * HTML do avatar. tamanho: 'p' | '' | 'm' | 'g'. corFixa: cor definida
   * para o responsável (CTI_EQUIPE), se houver.
   */
  function avatar(codUsu, nome, tamanho, corFixa) {
    var u = CtiUtil;
    var existe = u.temUsuario(codUsu);
    var classes = 'g-avatar' + (tamanho ? ' g-avatar--' + tamanho : '') + (existe ? '' : ' g-avatar--vazio');
    var cor = existe ? u.cor(corFixa, u.corDaPessoa(codUsu)) : '';
    var url = existe ? cache[codUsu] : null;
    var conteudo = typeof url === 'string'
      ? '<img src="' + u.esc(url) + '" alt="">'
      : u.esc(existe ? u.iniciais(nome) : '?');
    return '<span class="' + classes + '"' + (existe ? ' data-foto="' + Number(codUsu) + '"' : '') +
      (cor ? ' style="--c:' + cor + '"' : '') + ' title="' + u.esc(nome || 'Sem responsável') + '">' +
      conteudo + '</span>';
  }

  /** Busca as fotos dos avatares ainda sem imagem dentro de raiz. */
  function preencher(raiz) {
    var alvo = raiz || document;
    var pedidos = {};
    CtiUtil.cada(alvo, '[data-foto]', function (el) {
      if (el.querySelector('img')) { return; }
      var cod = el.dataset.foto;
      var atual = cache[cod];
      if (typeof atual === 'string') {
        colocar(el, atual);
      } else if (atual === undefined) {
        pedidos[cod] = true;
      }
    });
    Object.keys(pedidos).forEach(function (cod) {
      cache[cod] = new Promise(function (resolve) { fila.push({ cod: cod, resolve: resolve }); });
    });
    andar();
  }

  function andar() {
    while (ativas < MAXIMO_SIMULTANEAS && fila.length) {
      var p = fila.shift();
      ativas++;
      buscar(p);
    }
  }

  /**
   * Versões vindas do sinal de presença. A primeira leitura só guarda a
   * referência; depois, cada foto com versão diferente é buscada de novo.
   */
  function atualizarVersoes(novas) {
    if (!novas) { return; }
    var anteriores = versoes;
    versoes = novas;
    if (!anteriores) { return; }
    Object.keys(novas).forEach(function (cod) {
      if (anteriores[cod] === undefined || anteriores[cod] === novas[cod]) { return; }
      var atual = cache[cod];
      // Foto ainda a caminho: a resposta dela já pode ser a nova; não duplica o pedido.
      if (atual && typeof atual.then === 'function') { return; }
      if (typeof atual === 'string') { URL.revokeObjectURL(atual); }
      cache[cod] = new Promise(function (resolve) { fila.push({ cod: cod, resolve: resolve, troca: true }); });
    });
    andar();
  }

  function buscar(pedido) {
    CtiApp.dados.fotoUsuario(Number(pedido.cod))
      .then(function (foto) {
        var url = foto && foto.mime && foto.base64 ? paraUrl(foto.base64, foto.mime) : null;
        cache[pedido.cod] = url;
        CtiUtil.cada(document, '[data-foto="' + Number(pedido.cod) + '"]', function (el) {
          if (url) {
            colocar(el, url);
          } else if (pedido.troca) {
            // A foto foi removida: volta para as iniciais.
            el.textContent = CtiUtil.iniciais(el.title);
          }
        });
      }, function (e) {
        cache[pedido.cod] = null;
        // Foto é enfeite: uma falha avisa uma vez e a tela segue com as iniciais.
        if (!avisouFalha) {
          avisouFalha = true;
          CtiApp.aviso('Não foi possível carregar as fotos dos usuários: ' + e.message, 'erro');
        }
      })
      .then(function () {
        ativas--;
        pedido.resolve();
        andar();
      });
  }

  function paraUrl(base64, mime) {
    var binario = atob(base64);
    var bytes = new Uint8Array(binario.length);
    for (var i = 0; i < binario.length; i++) { bytes[i] = binario.charCodeAt(i); }
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  }

  function colocar(el, url) {
    var img = document.createElement('img');
    img.alt = '';
    img.src = url;
    el.textContent = '';
    el.appendChild(img);
  }

  return { avatar: avatar, preencher: preencher, atualizarVersoes: atualizarVersoes };
})();
