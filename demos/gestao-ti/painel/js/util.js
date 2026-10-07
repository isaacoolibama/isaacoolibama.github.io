/**
 * Utilitários sem estado: escape de HTML, datas, iniciais, prazo e cores.
 *
 * Tudo que é digitado por usuários passa por esc() antes de virar HTML. Sem
 * isso, uma demanda chamada <img onerror=...> executaria script no quadro de
 * todos os colegas.
 */
var CtiUtil = (function () {
  'use strict';

  var COR_PADRAO = '#8B9691';
  var COR_HEX = /^#[0-9A-Fa-f]{6}$/;
  /** Remix (ri-), Tabler (ti-) e marcas do Simple Icons (si-), todos embarcados em vendor/. */
  var ICONE = /^(ri|ti|si)-[a-z0-9-]{1,40}$/;

  function esc(valor) {
    if (valor === null || valor === undefined) { return ''; }
    return String(valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Cor vinda do banco só entra em style se for #RRGGBB (o servidor também valida). */
  function cor(valor, padrao) {
    return COR_HEX.test(String(valor || '')) ? valor : (padrao || COR_PADRAO);
  }

  /** Classe de ícone só entra em class se for ri-...; senão, o ícone padrão. */
  function icone(valor, padrao) {
    return ICONE.test(String(valor || '')) ? valor : (padrao || 'ri-price-tag-3-line');
  }

  /**
   * Área de transferência. Dentro do iframe do Om a Clipboard API pode ser
   * recusada; o caminho antigo (textarea + execCommand) continua valendo.
   */
  function copiar(texto) {
    var antigo = function () {
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
      if (!ok) { var erro = new Error('Cópia recusada pelo navegador.'); erro.copia = true; throw erro; }
    };
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(texto).catch(antigo);
    }
    return Promise.resolve().then(antigo);
  }

  /** Cor clara pede texto escuro por cima (cabeçalho das colunas). */
  function corClara(hex) {
    var c = cor(hex);
    var r = parseInt(c.slice(1, 3), 16);
    var g = parseInt(c.slice(3, 5), 16);
    var b = parseInt(c.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
  }

  /** Só http(s): bloqueia javascript: em links vindos do banco. */
  function urlSegura(url) {
    var limpa = String(url || '').trim();
    return /^https?:\/\//i.test(limpa) ? limpa : '';
  }

  /** '2026-03-14' ou '2026-03-14T10:00:00' -> Date local (meia-noite). */
  function dataLocal(iso) {
    if (!iso) { return null; }
    var p = String(iso).slice(0, 10).split('-');
    if (p.length !== 3) { return null; }
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function dataBr(iso) {
    var d = dataLocal(iso);
    if (!d) { return '—'; }
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  }

  function dataCurta(iso) {
    var d = dataLocal(iso);
    if (!d) { return '—'; }
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  }

  /** Agora em 'aaaa-mm-ddThh:mm:00' (mesmo formato das datas que vêm do servidor). */
  function agoraIso() {
    var d = new Date();
    var p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':00';
  }

  function dataHoraBr(iso) {
    if (!iso) { return '—'; }
    var texto = String(iso);
    return dataBr(texto) + (texto.length > 15 ? ' ' + texto.slice(11, 16) : '');
  }

  /** "há 5 min", "ontem"... para comentários. */
  function relativo(iso) {
    if (!iso) { return ''; }
    var t = new Date(String(iso)).getTime();
    if (isNaN(t)) { return dataHoraBr(iso); }
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 60) { return 'agora'; }
    if (s < 3600) { return 'há ' + Math.round(s / 60) + ' min'; }
    if (s < 86400) { return 'há ' + Math.round(s / 3600) + ' h'; }
    if (s < 172800) { return 'ontem'; }
    return dataHoraBr(iso);
  }

  /**
   * Ordena finalizadas da conclusão mais recente para a mais antiga. Sem data
   * (base anterior ao DHCONCLUSAO sem histórico) vai para o fim, pela alteração.
   */
  function porConclusaoRecente(a, b) {
    var ca = a.dhConclusao || '', cb = b.dhConclusao || '';
    if (ca !== cb) { return ca < cb ? 1 : -1; }
    var aa = a.dhAlter || '', ab = b.dhAlter || '';
    if (aa !== ab) { return aa < ab ? 1 : -1; }
    return (b.idTarefa || 0) - (a.idTarefa || 0);
  }

  function hojeIso() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  /** 'Ana Ribeiro' -> 'AR'; login do Sankhya 'ISAAC' -> 'IS'. */
  function iniciais(nome) {
    if (!nome) { return '?'; }
    var partes = String(nome).trim().split(/\s+/);
    if (partes.length === 1) { return partes[0].slice(0, 2).toUpperCase(); }
    return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
  }

  /** Cor estável por usuário para avatar sem foto. */
  function corDaPessoa(chave) {
    var cores = ['#3E9B4E', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#0891B2', '#6366F1', '#B7791F'];
    var s = String(chave || ''), h = 0;
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return cores[Math.abs(h) % cores.length];
  }

  function diasAte(dtVenc) {
    return Math.round((dataLocal(dtVenc) - dataLocal(hojeIso())) / 86400000);
  }

  /**
   * 'atrasado' | 'vencendo' | 'noprazo' | 'semprazo'. Vermelho se venceu,
   * amarelo se vence em até 2 dias. Demanda concluída nunca está atrasada.
   */
  function situacaoPrazo(dtVenc, concluida) {
    if (!dtVenc || concluida) { return 'semprazo'; }
    var dias = diasAte(dtVenc);
    if (dias < 0) { return 'atrasado'; }
    if (dias <= 2) { return 'vencendo'; }
    return 'noprazo';
  }

  function rotuloPrazo(dtVenc, concluida) {
    if (!dtVenc) { return 'Sem prazo'; }
    var s = situacaoPrazo(dtVenc, concluida);
    if (s === 'atrasado') { return 'Venceu em ' + dataBr(dtVenc); }
    if (s === 'vencendo') {
      var dias = diasAte(dtVenc);
      return dias === 0 ? 'Vence hoje' : (dias === 1 ? 'Vence amanhã' : 'Vence em ' + dias + ' dias');
    }
    return 'Prazo: ' + dataBr(dtVenc);
  }

  function tamanho(bytes) {
    if (bytes === null || bytes === undefined) { return '—'; }
    var n = Number(bytes);
    if (n < 1024) { return n + ' B'; }
    if (n < 1048576) { return (n / 1024).toFixed(1).replace('.', ',') + ' KB'; }
    return (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
  }

  function tags(texto) {
    return String(texto || '').split(',')
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length; });
  }

  /** Normaliza para busca: minúsculas e sem acento. */
  function normal(texto) {
    return String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function plural(n, um, varios) {
    return n + ' ' + (n === 1 ? um : varios);
  }

  function porId(lista, campo, valor) {
    for (var i = 0; i < (lista || []).length; i++) {
      if (String(lista[i][campo]) === String(valor)) { return lista[i]; }
    }
    return null;
  }

  function el(id) { return document.getElementById(id); }

  function cada(raiz, seletor, fn) {
    Array.prototype.forEach.call((raiz || document).querySelectorAll(seletor), fn);
  }

  /** extra (opcional): {icone, cor, pessoa}, desenhados pela lista suspensa (CtiSelect). */
  function opcao(valor, rotulo, selecionado, extra) {
    var sel = selecionado === null || selecionado === undefined ? '' : String(selecionado);
    var x = extra || {};
    var dados = (x.icone && ICONE.test(x.icone) ? ' data-icone="' + esc(x.icone) + '"' : '') +
      (x.cor && COR_HEX.test(x.cor) ? ' data-cor="' + esc(x.cor) + '"' : '') +
      (x.pessoa !== undefined && x.pessoa !== null ? ' data-pessoa="' + Number(x.pessoa) + '"' : '');
    return '<option value="' + esc(valor) + '"' + (String(valor) === sel ? ' selected' : '') + dados + '>' +
      esc(rotulo) + '</option>';
  }

  /**
   * Seção de formulário com título e ícone (documento e demanda). titulo e nota
   * são texto fixo da tela (não escapados); html já vem montado com escape.
   */
  function secaoForm(icone, titulo, nota, html, classe) {
    return '<section class="g-form-secao' + (classe ? ' ' + classe : '') + '"><div class="g-form-secao__cab"><h3><i class="' + icone + '" aria-hidden="true"></i>' +
      titulo + '</h3>' + (nota ? '<small>' + nota + '</small>' : '') + '</div>' + html + '</section>';
  }

  /** O SUP tem CODUSU 0: "sem usuário" é só nulo, indefinido ou vazio. */
  function temUsuario(codUsu) {
    return codUsu !== null && codUsu !== undefined && codUsu !== '';
  }

  /** "" -> null, "12" -> 12: ids de select. */
  function numeroOuNulo(valor) {
    var v = String(valor === null || valor === undefined ? '' : valor).trim();
    return v === '' ? null : Number(v);
  }

  return {
    esc: esc, cor: cor, icone: icone, copiar: copiar, corClara: corClara, urlSegura: urlSegura,
    dataBr: dataBr, dataCurta: dataCurta, dataHoraBr: dataHoraBr, agoraIso: agoraIso, relativo: relativo, hojeIso: hojeIso,
    porConclusaoRecente: porConclusaoRecente,
    iniciais: iniciais, corDaPessoa: corDaPessoa, situacaoPrazo: situacaoPrazo, rotuloPrazo: rotuloPrazo,
    tamanho: tamanho, tags: tags, normal: normal, plural: plural, porId: porId, el: el, cada: cada,
    opcao: opcao, numeroOuNulo: numeroOuNulo, temUsuario: temUsuario, secaoForm: secaoForm
  };
})();
