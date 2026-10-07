/**
 * Drag and drop do Kanban (CtiKanban) usando a API nativa de HTML5.
 *
 * Nenhuma biblioteca: draggable + dragstart/dragover/drop resolvem o caso.
 * O módulo não sabe o que é uma tarefa — recebe seletores e um callback, e
 * devolve para onde o card foi solto e antes de qual card. Quem persiste é o
 * controller.
 *
 * Os eventos são registrados uma única vez, por delegação na raiz. O quadro é
 * repintado a toda hora (inclusive quando outro usuário grava algo); registrar
 * de novo a cada pintura faria cada soltura disparar várias gravações.
 */
var CtiDnd = (function () {
  'use strict';

  var CLASSE_ARRASTANDO = 'g-card--arrastando';
  var CLASSE_ALVO = 'g-coluna--alvo';

  var idEmArrasto = null;

  /**
   * @param {Object} cfg
   *   cfg.raiz          elemento que contém as colunas (não é recriado)
   *   cfg.seletorCard   seletor dos cards arrastáveis
   *   cfg.seletorLista  seletor das listas que recebem cards
   *   cfg.aoSoltar      function(idTarefa, colunaDestino, idAntesDe|null)
   */
  function ativar(cfg) {
    var raiz = cfg.raiz;
    if (raiz.dataset.dndAtivo) { return; }
    raiz.dataset.dndAtivo = 'S';

    /** A marca de alvo vai na coluna inteira (cabeçalho incluído), não só na lista. */
    function moldura(lista) { return lista.closest('.g-coluna') || lista; }

    function listaDe(alvo) { return alvo && alvo.closest ? alvo.closest(cfg.seletorLista) : null; }

    function limparMarcas() {
      Array.prototype.forEach.call(raiz.querySelectorAll('.' + CLASSE_ALVO), function (l) {
        l.classList.remove(CLASSE_ALVO);
      });
      Array.prototype.forEach.call(raiz.querySelectorAll('.g-card--acima, .g-card--abaixo'), function (c) {
        c.classList.remove('g-card--acima', 'g-card--abaixo');
      });
    }

    // --- origem do arrasto -------------------------------------------------
    raiz.addEventListener('dragstart', function (e) {
      var card = e.target.closest ? e.target.closest(cfg.seletorCard) : null;
      if (!card || card.getAttribute('draggable') !== 'true') { return; }
      idEmArrasto = card.dataset.id;
      card.classList.add(CLASSE_ARRASTANDO);
      e.dataTransfer.effectAllowed = 'move';
      // Alguns navegadores só iniciam o arrasto se houver payload.
      try { e.dataTransfer.setData('text/plain', idEmArrasto); } catch (err) { /* IE antigo */ }
    });

    raiz.addEventListener('dragend', function (e) {
      var card = e.target.closest ? e.target.closest(cfg.seletorCard) : null;
      if (card) { card.classList.remove(CLASSE_ARRASTANDO); }
      idEmArrasto = null;
      limparMarcas();
    });

    // --- destino do arrasto ------------------------------------------------
    raiz.addEventListener('dragover', function (e) {
      var lista = listaDe(e.target);
      if (!lista || !idEmArrasto) { return; }
      // Sem preventDefault o navegador recusa o drop.
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      moldura(lista).classList.add(CLASSE_ALVO);
      posicionarPlaceholder(lista, e.clientY, cfg.seletorCard);
    });

    raiz.addEventListener('dragleave', function (e) {
      var lista = listaDe(e.target);
      // dragleave dispara ao passar sobre filhos; só limpa ao sair de fato.
      if (lista && !lista.contains(e.relatedTarget)) {
        moldura(lista).classList.remove(CLASSE_ALVO);
      }
    });

    raiz.addEventListener('drop', function (e) {
      var lista = listaDe(e.target);
      if (!lista) { return; }
      e.preventDefault();

      var id = idEmArrasto;
      if (!id) {
        try { id = e.dataTransfer.getData('text/plain'); } catch (err) { id = null; }
      }
      var antesDe = cardSeguinte(lista, e.clientY, cfg.seletorCard, id);
      limparMarcas();
      if (!id) { return; }
      cfg.aoSoltar(Number(id), lista.dataset.coluna, antesDe);
    });
  }

  /**
   * Id do card que ficará logo abaixo do card solto (null = fim da coluna),
   * comparando o cursor com o meio de cada card já presente.
   */
  function cardSeguinte(lista, clientY, seletorCard, idIgnorado) {
    var cards = Array.prototype.filter.call(
      lista.querySelectorAll(seletorCard),
      function (c) { return c.dataset.id !== String(idIgnorado); });

    for (var i = 0; i < cards.length; i++) {
      var caixa = cards[i].getBoundingClientRect();
      if (clientY < caixa.top + caixa.height / 2) {
        return Number(cards[i].dataset.id);
      }
    }
    return null;
  }

  /** Marca visualmente onde o card vai entrar. */
  function posicionarPlaceholder(lista, clientY, seletorCard) {
    var cards = lista.querySelectorAll(seletorCard);
    Array.prototype.forEach.call(cards, function (c) {
      c.classList.remove('g-card--acima', 'g-card--abaixo');
    });
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].classList.contains(CLASSE_ARRASTANDO)) { continue; }
      var caixa = cards[i].getBoundingClientRect();
      if (clientY < caixa.top + caixa.height / 2) {
        cards[i].classList.add('g-card--acima');
        return;
      }
    }
    if (cards.length) {
      var ultimo = cards[cards.length - 1];
      if (!ultimo.classList.contains(CLASSE_ARRASTANDO)) {
        ultimo.classList.add('g-card--abaixo');
      }
    }
  }

  return { ativar: ativar };
})();
