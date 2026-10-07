/**
 * Markdown -> HTML seguro, sem biblioteca externa.
 *
 * Regra de segurança: o texto é escapado ANTES de qualquer formatação. O
 * único HTML que sai daqui é o gerado por este arquivo; links só aceitam
 * http(s) e o href já está escapado. Suporta o que a base de conhecimento
 * usa: títulos, negrito, itálico, riscado, código (na linha e em bloco),
 * listas (inclusive de tarefas), citação, régua, links e tabelas simples.
 */
var CtiMarkdown = (function () {
  'use strict';

  var esc = CtiUtil.esc;
  // Caractere de uso privado: marca onde o código inline volta depois da formatação.
  var MARCA = String.fromCharCode(0xE000);
  var MARCA_RE = new RegExp(MARCA + '(\\d+)' + MARCA, 'g');

  function inline(texto) {
    var codigos = [];
    var t = texto.replace(/`([^`\n]+)`/g, function (m, c) {
      codigos.push('<code>' + c + '</code>');
      return MARCA + (codigos.length - 1) + MARCA;
    });
    t = t
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)"]+)\)/g, function (m, rotulo, url) {
        return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + rotulo + '</a>';
      })
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
    return t.replace(MARCA_RE, function (m, i) { return codigos[Number(i)]; });
  }

  function celulas(linha) {
    return linha.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (c) { return c.trim(); });
  }

  var INICIO_DE_BLOCO = /^(```|#{1,3}\s|&gt;|\s*([-*]|\d+\.)\s)/;
  var ITEM_DE_LISTA = /^\s*([-*]|\d+\.)\s+/;

  /**
   * Listas com sub-itens pelo recuo (2+ espaços ou tab = um nível abaixo).
   * Uma pilha guarda as listas abertas; cada item fecha as mais fundas que ele.
   */
  function lista(linhasDaLista) {
    var html = '';
    var pilha = [];   // { recuo, tag }
    linhasDaLista.forEach(function (linha) {
      var m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(linha);
      var recuo = m[1].replace(/\t/g, '    ').length;
      var tag = /\d/.test(m[2]) ? 'ol' : 'ul';
      while (pilha.length && recuo < pilha[pilha.length - 1].recuo) {
        html += '</li></' + pilha.pop().tag + '>';
      }
      var topo = pilha[pilha.length - 1];
      if (!topo || recuo > topo.recuo) {
        pilha.push({ recuo: recuo, tag: tag });
        html += '<' + tag + '>';
      } else {
        html += '</li>';
      }
      var tarefa = /^\[( |x|X)\]\s+(.*)$/.exec(m[3]);
      html += tarefa
        ? '<li class="g-md__tarefa"><input type="checkbox" disabled' + (tarefa[1] === ' ' ? '' : ' checked') +
          ' aria-label="' + (tarefa[1] === ' ' ? 'Pendente' : 'Feito') + '"><span>' + inline(tarefa[2]) + '</span>'
        : '<li>' + inline(m[3]);
    });
    while (pilha.length) { html += '</li></' + pilha.pop().tag + '>'; }
    return html;
  }

  /** "Copiar" dos blocos de código; sem HTTPS o Om não tem clipboard API, então cai no execCommand. */
  function copiarCodigo(botao) {
    var texto = botao.closest('.g-md__codigo').querySelector('code').textContent;
    var avisar = function (ok) {
      botao.innerHTML = ok ? '<i class="ri-check-line" aria-hidden="true"></i>Copiado' : '<i class="ri-error-warning-line" aria-hidden="true"></i>Não copiou';
      setTimeout(function () { botao.innerHTML = '<i class="ri-file-copy-line" aria-hidden="true"></i>Copiar'; }, 1600);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texto).then(function () { avisar(true); }, function () { avisar(copiarPorSelecao(texto)); });
    } else {
      avisar(copiarPorSelecao(texto));
    }
  }

  function copiarPorSelecao(texto) {
    var area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(area);
    return ok;
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-copiar-codigo]');
    if (b) { copiarCodigo(b); }
  });

  function renderizar(fonte) {
    var linhas = esc(String(fonte || '').replace(/\r\n?/g, '\n')).split('\n');
    var html = [];
    var i = 0;

    while (i < linhas.length) {
      var l = linhas[i];

      if (/^```/.test(l)) {
        // ```sql: a linguagem vira rótulo; só letras/dígitos para não virar HTML.
        var linguagem = (/^```\s*([A-Za-z0-9+#-]{1,20})/.exec(l) || [])[1] || '';
        var bloco = [];
        i++;
        while (i < linhas.length && !/^```/.test(linhas[i])) { bloco.push(linhas[i]); i++; }
        i++;
        html.push('<div class="g-md__codigo"><div class="g-md__codigo-cab"><span>' + (linguagem ? linguagem.toUpperCase() : 'Código') +
          '</span><button type="button" class="g-md__copiar" data-copiar-codigo><i class="ri-file-copy-line" aria-hidden="true"></i>Copiar</button></div>' +
          '<pre><code>' + bloco.join('\n') + '</code></pre></div>');
        continue;
      }
      if (/^\s*$/.test(l)) { i++; continue; }

      var h = /^(#{1,3})\s+(.*)$/.exec(l);
      if (h) {
        html.push('<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>');
        i++;
        continue;
      }
      if (/^(-{3,}|\*{3,})\s*$/.test(l)) { html.push('<hr>'); i++; continue; }

      if (/^&gt;\s?/.test(l)) {
        var cit = [];
        while (i < linhas.length && /^&gt;\s?/.test(linhas[i])) { cit.push(linhas[i].replace(/^&gt;\s?/, '')); i++; }
        html.push('<blockquote>' + inline(cit.join('<br>')) + '</blockquote>');
        continue;
      }

      if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < linhas.length && /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(linhas[i + 1])) {
        var cab = celulas(l);
        i += 2;
        var corpo = [];
        while (i < linhas.length && /^\s*\|.*\|\s*$/.test(linhas[i])) { corpo.push(celulas(linhas[i])); i++; }
        html.push('<div class="g-md__tabela"><table><thead><tr>' +
          cab.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') +
          '</tr></thead><tbody>' +
          corpo.map(function (r) {
            return '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>';
          }).join('') + '</tbody></table></div>');
        continue;
      }

      if (ITEM_DE_LISTA.test(l)) {
        var bloco = [];
        while (i < linhas.length && ITEM_DE_LISTA.test(linhas[i])) { bloco.push(linhas[i]); i++; }
        html.push(lista(bloco));
        continue;
      }

      var paragrafo = [];
      while (i < linhas.length && !/^\s*$/.test(linhas[i]) && (paragrafo.length === 0 || !INICIO_DE_BLOCO.test(linhas[i]))) {
        paragrafo.push(linhas[i]);
        i++;
      }
      html.push('<p>' + inline(paragrafo.join('<br>')) + '</p>');
    }
    return html.join('\n');
  }

  /**
   * Barra de ferramentas: insere a sintaxe em volta da seleção do textarea.
   * Nada de contenteditable: o que é salvo é sempre texto puro.
   */
  var ACOES = {
    negrito:  { antes: '**', depois: '**', exemplo: 'texto' },
    italico:  { antes: '*', depois: '*', exemplo: 'texto' },
    riscado:  { antes: '~~', depois: '~~', exemplo: 'texto' },
    codigo:   { antes: '`', depois: '`', exemplo: 'codigo' },
    h1:       { linha: '# ' },
    h2:       { linha: '## ' },
    h3:       { linha: '### ' },
    lista:    { linha: '- ' },
    numerada: { linha: '1. ' },
    tarefa:   { linha: '- [ ] ' },
    citacao:  { linha: '> ' },
    bloco:    { antes: '\n```sql\n', depois: '\n```\n', exemplo: 'SELECT 1 FROM DUAL' },
    regua:    { antes: '\n---\n', depois: '', exemplo: '' },
    link:     { antes: '[', depois: '](https://)', exemplo: 'texto do link' },
    tabela:   { antes: '\n| Coluna | Descrição |\n|---|---|\n| ', depois: ' |  |\n', exemplo: 'valor' }
  };

  function aplicar(textarea, nome) {
    var a = ACOES[nome];
    if (!a || !textarea) { return; }
    var ini = textarea.selectionStart;
    var fim = textarea.selectionEnd;
    var valor = textarea.value;
    var novo, selIni, selFim;
    if (a.linha) {
      var comeco = valor.lastIndexOf('\n', ini - 1) + 1;
      novo = valor.slice(0, comeco) + a.linha + valor.slice(comeco);
      selIni = ini + a.linha.length;
      selFim = fim + a.linha.length;
    } else {
      var miolo = valor.slice(ini, fim) || a.exemplo;
      novo = valor.slice(0, ini) + a.antes + miolo + a.depois + valor.slice(fim);
      selIni = ini + a.antes.length;
      selFim = selIni + miolo.length;
    }
    textarea.value = novo;
    textarea.focus();
    textarea.setSelectionRange(selIni, selFim);
    textarea.dispatchEvent(new Event('input'));
  }

  function botao(acao, icone, titulo) {
    return '<button type="button" class="g-icone-btn" data-md="' + acao + '" title="' + titulo +
      '" aria-label="' + titulo + '"><i class="' + icone + '" aria-hidden="true"></i></button>';
  }

  function barraHtml() {
    return botao('negrito', 'ri-bold', 'Negrito (Ctrl+B)') + botao('italico', 'ri-italic', 'Itálico (Ctrl+I)') +
      botao('riscado', 'ri-strikethrough', 'Riscado') + botao('codigo', 'ri-code-line', 'Código na linha') +
      '<span class="g-editor__div"></span>' +
      botao('h1', 'ri-h-1', 'Título 1') + botao('h2', 'ri-h-2', 'Título 2') + botao('h3', 'ri-h-3', 'Título 3') +
      '<span class="g-editor__div"></span>' +
      botao('lista', 'ri-list-unordered', 'Lista') + botao('numerada', 'ri-list-ordered', 'Lista numerada') +
      botao('tarefa', 'ri-checkbox-line', 'Lista de tarefas') + botao('citacao', 'ri-double-quotes-l', 'Citação') +
      '<span class="g-editor__div"></span>' +
      botao('bloco', 'ri-code-box-line', 'Bloco de código') + botao('tabela', 'ri-table-line', 'Tabela') +
      botao('link', 'ri-link', 'Link (Ctrl+K)') + botao('regua', 'ri-separator', 'Divisor');
  }

  function ligar(barra, textarea) {
    barra.addEventListener('click', function (e) {
      var b = e.target.closest('[data-md]');
      if (b) { aplicar(textarea, b.dataset.md); }
    });
    textarea.addEventListener('keydown', function (e) {
      if (!(e.ctrlKey || e.metaKey)) { return; }
      var acao = { b: 'negrito', i: 'italico', k: 'link' }[String(e.key).toLowerCase()];
      if (acao) {
        e.preventDefault();
        aplicar(textarea, acao);
      }
    });
  }

  return { renderizar: renderizar, barraHtml: barraHtml, ligar: ligar };
})();
