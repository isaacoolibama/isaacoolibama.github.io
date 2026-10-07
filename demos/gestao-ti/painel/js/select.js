/**
 * Lista suspensa do painel: mostra o ícone e a cor configurados (categoria,
 * setor, coluna, tipo) e o avatar da pessoa, o que o <select> nativo não faz.
 *
 * O <select> continua no formulário (valor, evento change, leitura por
 * u.el(...).value): este componente só desenha por cima. Cada opção traz
 * data-icone, data-cor ou data-pessoa (CtiUtil.opcao). A lista abre em
 * position: fixed para não ser cortada pela rolagem do modal.
 */
var CtiSelect = (function () {
  'use strict';

  var u = CtiUtil;
  var aberto = null;   // { select, botao, lista, indice }
  var seq = 0;

  /** Aplica em todo <select> dentro de raiz, agora e nos que forem desenhados depois. */
  function iniciar(raiz) {
    aplicar(raiz);
    new MutationObserver(function (mudancas) {
      mudancas.forEach(function (m) {
        if (m.target.tagName === 'SELECT') {
          atualizar(m.target);
          return;
        }
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType === 1) { aplicar(n); }
        });
      });
    }).observe(raiz, { childList: true, subtree: true });
    document.addEventListener('mousedown', function (e) {
      if (aberto && !aberto.lista.contains(e.target) && !aberto.botao.contains(e.target)) { fechar(false); }
    }, true);
    window.addEventListener('resize', function () { fechar(false); });
    document.addEventListener('scroll', function (e) {
      if (aberto && !aberto.lista.contains(e.target)) { fechar(false); }
    }, true);
  }

  function aplicar(raiz) {
    var selects = raiz.tagName === 'SELECT' ? [raiz] : raiz.querySelectorAll('select');
    Array.prototype.forEach.call(selects, envolver);
  }

  function envolver(select) {
    if (select.dataset.rico === 'S' || select.multiple) { return; }
    select.dataset.rico = 'S';
    var botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'g-sel';
    botao.setAttribute('aria-haspopup', 'listbox');
    botao.setAttribute('aria-expanded', 'false');
    if (select.id) {
      // O <label for> e o foco programático passam a valer para o botão.
      var rotulo = document.querySelector('label[for="' + select.id + '"]');
      if (rotulo) { rotulo.addEventListener('click', function (e) { e.preventDefault(); botao.focus(); }); }
    }
    var nomeAcessivel = select.getAttribute('aria-label') ||
      (select.closest('label') && select.closest('label').querySelector('span') ? select.closest('label').querySelector('span').textContent : '');
    if (nomeAcessivel) { botao.setAttribute('aria-label', nomeAcessivel); }
    select.classList.add('g-sel__nativo');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    select.parentNode.insertBefore(botao, select.nextSibling);
    select._ctiBotao = botao;

    // Código que faz select.value = x não dispara evento: o botão acompanha pelo setter.
    var desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    Object.defineProperty(select, 'value', {
      configurable: true,
      get: function () { return desc.get.call(this); },
      set: function (v) { desc.set.call(this, v); atualizar(this); }
    });
    select.addEventListener('change', function () { atualizar(select); });
    new MutationObserver(function () { atualizar(select); })
      .observe(select, { attributes: true, attributeFilter: ['disabled'] });

    botao.addEventListener('click', function () {
      if (aberto && aberto.select === select) { fechar(true); } else { abrir(select); }
    });
    botao.addEventListener('keydown', function (e) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].indexOf(e.key) >= 0 && !aberto) {
        e.preventDefault();
        abrir(select);
      }
    });
    atualizar(select);
  }

  /** Conteúdo visual de uma opção: ícone colorido, avatar ou só o texto. */
  function conteudo(op) {
    if (!op) { return '<span class="g-sel__texto g-sel__texto--vazio">Selecione</span>'; }
    var cor = op.dataset.cor ? u.cor(op.dataset.cor) : '';
    var marca = '';
    if (op.dataset.pessoa !== undefined && u.temUsuario(op.dataset.pessoa)) {
      marca = CtiApp.avatarPessoa(Number(op.dataset.pessoa), op.textContent, 'p');
    } else if (op.dataset.icone) {
      marca = '<i class="' + u.icone(op.dataset.icone) + ' g-sel__icone"' + (cor ? ' style="color:' + cor + '"' : '') + ' aria-hidden="true"></i>';
    } else if (cor) {
      marca = '<span class="g-sel__ponto" style="background:' + cor + '" aria-hidden="true"></span>';
    }
    return marca + '<span class="g-sel__texto">' + u.esc(op.textContent) + '</span>';
  }

  function atualizar(select) {
    var botao = select._ctiBotao;
    if (!botao) { return; }
    botao.innerHTML = conteudo(select.options[select.selectedIndex]) + '<i class="ri-arrow-down-s-line g-sel__seta" aria-hidden="true"></i>';
    botao.disabled = select.disabled;
    botao.title = select.title || '';
    CtiFotos.preencher(botao);
    if (aberto && aberto.select === select) { fechar(false); }
  }

  function abrir(select) {
    fechar(false);
    var botao = select._ctiBotao;
    if (botao.disabled) { return; }
    var lista = document.createElement('ul');
    lista.className = 'g-sel__lista';
    lista.id = 'g-sel-lista-' + (++seq);
    lista.setAttribute('role', 'listbox');
    // Dentro do .g-app para herdar os tokens de cor (tema claro/escuro).
    (select.closest('.g-app') || document.body).appendChild(lista);
    lista.innerHTML = Array.prototype.map.call(select.options, function (op, i) {
      return '<li role="option" id="' + lista.id + '-' + i + '" data-indice="' + i + '" class="g-sel__opcao' +
        (op.disabled ? ' g-sel__opcao--desativada' : '') + '" aria-selected="' + (i === select.selectedIndex) + '">' +
        conteudo(op) + (i === select.selectedIndex ? '<i class="ri-check-line g-sel__marcado" aria-hidden="true"></i>' : '') + '</li>';
    }).join('');
    CtiFotos.preencher(lista);
    posicionar(botao, lista);
    botao.setAttribute('aria-expanded', 'true');
    botao.setAttribute('aria-controls', lista.id);
    aberto = { select: select, botao: botao, lista: lista, indice: Math.max(0, select.selectedIndex) };
    destacar(aberto.indice);

    lista.addEventListener('mousedown', function (e) { e.preventDefault(); });
    lista.addEventListener('click', function (e) {
      var li = e.target.closest('[data-indice]');
      if (li) { escolher(Number(li.dataset.indice)); }
    });
    lista.addEventListener('mousemove', function (e) {
      var li = e.target.closest('[data-indice]');
      if (li && Number(li.dataset.indice) !== aberto.indice) { destacar(Number(li.dataset.indice)); }
    });
    document.addEventListener('keydown', teclado, true);
  }

  /** Abaixo do botão; sem espaço embaixo, abre para cima. */
  function posicionar(botao, lista) {
    var r = botao.getBoundingClientRect();
    var altura = Math.min(lista.scrollHeight + 8, 300);
    var embaixo = window.innerHeight - r.bottom - 8;
    lista.style.left = Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 200) - 8)) + 'px';
    lista.style.minWidth = r.width + 'px';
    lista.style.maxHeight = Math.max(160, Math.min(300, embaixo > altura || embaixo > r.top ? embaixo : r.top - 8)) + 'px';
    if (embaixo >= altura || embaixo >= r.top) {
      lista.style.top = (r.bottom + 4) + 'px';
    } else {
      lista.style.top = Math.max(8, r.top - 4 - Math.min(altura, r.top - 8)) + 'px';
    }
  }

  function destacar(i) {
    var itens = aberto.lista.querySelectorAll('[data-indice]');
    if (!itens.length) { return; }
    aberto.indice = Math.max(0, Math.min(itens.length - 1, i));
    Array.prototype.forEach.call(itens, function (li, k) { li.classList.toggle('g-sel__opcao--foco', k === aberto.indice); });
    var alvo = itens[aberto.indice];
    aberto.botao.setAttribute('aria-activedescendant', alvo.id);
    alvo.scrollIntoView({ block: 'nearest' });
  }

  function escolher(i) {
    var select = aberto.select;
    var op = select.options[i];
    if (!op || op.disabled) { return; }
    var mudou = select.selectedIndex !== i;
    select.selectedIndex = i;
    fechar(true);
    atualizar(select);
    if (mudou) { select.dispatchEvent(new Event('change', { bubbles: true })); }
  }

  var busca = '';
  var buscaRelogio = null;

  function teclado(e) {
    if (!aberto) { return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(true); return; }
    if (e.key === 'Tab') { fechar(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); destacar(aberto.indice + 1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); destacar(aberto.indice - 1); return; }
    if (e.key === 'Home') { e.preventDefault(); destacar(0); return; }
    if (e.key === 'End') { e.preventDefault(); destacar(aberto.select.options.length - 1); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); escolher(aberto.indice); return; }
    if (e.key.length === 1) {
      // Digitar pula para a primeira opção que começa com o texto.
      clearTimeout(buscaRelogio);
      busca += u.normal(e.key);
      buscaRelogio = setTimeout(function () { busca = ''; }, 700);
      var ops = aberto.select.options;
      for (var k = 0; k < ops.length; k++) {
        if (u.normal(ops[k].textContent).indexOf(busca) === 0) { destacar(k); break; }
      }
    }
  }

  function fechar(devolverFoco) {
    if (!aberto) { return; }
    var a = aberto;
    aberto = null;
    document.removeEventListener('keydown', teclado, true);
    if (a.lista.parentNode) { a.lista.parentNode.removeChild(a.lista); }
    a.botao.setAttribute('aria-expanded', 'false');
    a.botao.removeAttribute('aria-activedescendant');
    if (devolverFoco) { a.botao.focus(); }
  }

  /** O modal consulta antes de tratar Esc/Tab: com a lista aberta, a tecla é dela. */
  function estaAberto() { return !!aberto; }

  return { iniciar: iniciar, atualizar: atualizar, estaAberto: estaAberto };
})();
