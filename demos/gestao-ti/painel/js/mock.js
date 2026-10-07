/**
 * Dados de exemplo em memória: este arquivo É a especificação do contrato.
 *
 * Cada método tem a mesma assinatura de CtiApi e devolve o mesmo formato que
 * GestaoTiSP. Ative com ?mock=1 na URL para desenvolver o layout sem backend.
 * Simula dois colegas online, controle de versão (conflito) e permissões.
 */
var CtiMock = (function () {
  'use strict';

  var ATRASO_MS = 120;
  var seq = 100;
  var temaMock = 'C';

  function dia(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function agora(minutosAtras) {
    var d = new Date(Date.now() - (minutosAtras || 0) * 60000);
    var p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':00';
  }
  function copia(o) { return JSON.parse(JSON.stringify(o)); }
  function responder(valor) {
    return new Promise(function (ok) { setTimeout(function () { ok(copia(valor)); }, ATRASO_MS); });
  }
  function falhar(msg) {
    return new Promise(function (ok, erro) { setTimeout(function () { erro(new Error(msg)); }, ATRASO_MS); });
  }

  var EU = 831;
  var usuarios = [
    { codUsu: 831, nomeUsu: 'ISAAC' }, { codUsu: 17, nomeUsu: 'RAFAEL' }, { codUsu: 71, nomeUsu: 'LUCASM' },
    { codUsu: 1012, nomeUsu: 'PEDROTEC' }, { codUsu: 1375, nomeUsu: 'TIAGOS' }, { codUsu: 79, nomeUsu: 'SIMONEC' },
    { codUsu: 204, nomeUsu: 'CARLOS QUEIROZ' }, { codUsu: 205, nomeUsu: 'ANA PAULA' }, { codUsu: 206, nomeUsu: 'ROBERTO RIBAS' },
    { codUsu: 207, nomeUsu: 'JULIANA BARROS' }, { codUsu: 208, nomeUsu: 'MARCOS SANTOS' }
  ];
  function nome(cod) { var u = CtiUtil.porId(usuarios, 'codUsu', cod); return u ? u.nomeUsu : null; }

  var config = {
    grupoResponsaveis: 14,
    nomeGrupoResponsaveis: 'Admin Sistema',
    versaoGrupo: 0,
    grupos: [{ codGrupo: 1, nomeGrupo: 'Contabilidade' }, { codGrupo: 14, nomeGrupo: 'Admin Sistema' }, { codGrupo: 3, nomeGrupo: 'Comercial' }],
    colunas: [
      { codigo: 'BACKLOG', nome: 'Backlog', cor: '#64748B', icone: 'ri-inbox-line', ordem: 0, conclui: false, ativo: true, versao: 0 },
      { codigo: 'AFAZER', nome: 'A Fazer', cor: '#3B82F6', icone: 'ri-list-check', ordem: 1, conclui: false, ativo: false, versao: 0 },
      { codigo: 'ANDAMENTO', nome: 'Em Andamento', cor: '#6366F1', icone: 'ri-loader-4-line', ordem: 2, conclui: false, ativo: true, versao: 0 },
      { codigo: 'PENDENTE', nome: 'Aguardando', cor: '#F59E0B', icone: 'ri-time-line', ordem: 3, conclui: false, ativo: false, versao: 0 },
      { codigo: 'BLOQUEADO', nome: 'Bloqueado', cor: '#EF4444', icone: 'ri-error-warning-line', ordem: 4, conclui: false, ativo: false, versao: 0 },
      { codigo: 'REVISAO', nome: 'Em Revisão', cor: '#EC4899', icone: 'ri-eye-line', ordem: 5, conclui: false, ativo: true, versao: 0 },
      { codigo: 'CONCLUIDO', nome: 'Concluído', cor: '#71CE7E', icone: 'ri-check-double-line', ordem: 6, conclui: true, ativo: true, versao: 0 }
    ],
    categorias: [
      { idCategoria: 1, nome: 'Procedures', descricao: 'Stored procedures do Oracle', cor: '#3B82F6', icone: 'ri-database-2-line', uso: 'A', ativo: true, versao: 0 },
      { idCategoria: 2, nome: 'Triggers', descricao: 'Gatilhos de banco', cor: '#F59E0B', icone: 'ri-flashlight-line', uso: 'A', ativo: true, versao: 0 },
      { idCategoria: 3, nome: 'Scripts', descricao: 'Scripts SQL avulsos', cor: '#8B5CF6', icone: 'ri-file-code-line', uso: 'A', ativo: true, versao: 0 },
      { idCategoria: 4, nome: 'Ações agendadas', descricao: 'Jobs e agendamentos', cor: '#EC4899', icone: 'ri-calendar-event-line', uso: 'T', ativo: true, versao: 0 },
      { idCategoria: 5, nome: 'Rotinas', descricao: 'Rotinas operacionais', cor: '#71CE7E', icone: 'ri-loop-left-line', uso: 'T', ativo: true, versao: 0 },
      { idCategoria: 6, nome: 'Legado', descricao: 'Não usar em novas demandas', cor: '#64748B', icone: 'ri-archive-line', uso: 'T', ativo: false, versao: 0 },
      { idCategoria: 8, nome: 'Relatórios Formatados', descricao: 'Relatórios do gerador do Sankhya', cor: '#64748B', icone: 'ri-file-list-3-line', uso: 'A', ativo: true, versao: 0 },
      { idCategoria: 7, nome: 'Manuais de usuário', descricao: 'Passo a passo para os setores', cor: '#14B8A6', icone: 'ri-book-open-line', uso: 'D', ativo: true, versao: 0 }
    ],
    setores: [
      { idSetor: 1, nome: 'TI', cor: '#3B82F6', icone: 'ri-computer-line', ativo: true, versao: 0 },
      { idSetor: 2, nome: 'Financeiro', cor: '#10B981', icone: 'ri-money-dollar-circle-line', ativo: true, versao: 0 },
      { idSetor: 3, nome: 'RH', cor: '#EC4899', icone: 'ri-team-line', ativo: true, versao: 0 },
      { idSetor: 4, nome: 'Comercial', cor: '#F59E0B', icone: 'ri-shopping-bag-3-line', ativo: true, versao: 0 },
      { idSetor: 5, nome: 'Fiscal', cor: '#EF4444', icone: 'ri-file-text-line', ativo: true, versao: 0 },
      { idSetor: 6, nome: 'Diretoria', cor: '#64748B', icone: 'ri-briefcase-line', ativo: true, versao: 0 }
    ],
    responsaveis: [
      { codUsu: 831, nomeUsu: 'ISAAC', sigla: 'IS', cor: '#3E9B4E', oculto: false, versao: 0 },
      { codUsu: 17, nomeUsu: 'RAFAEL', sigla: null, cor: null, oculto: false, versao: null },
      { codUsu: 71, nomeUsu: 'LUCASM', sigla: 'LM', cor: '#8B5CF6', oculto: false, versao: 0 },
      { codUsu: 1012, nomeUsu: 'PEDROTEC', sigla: null, cor: null, oculto: false, versao: null },
      { codUsu: 1047, nomeUsu: 'INTEGRACAO', sigla: null, cor: null, oculto: true, versao: 0 }
    ],
    tiposObjeto: [
      { codigo: 'PROCEDURE', nome: 'Procedure', cor: '#3A7BEA', icone: 'ri-database-2-line', ordem: 0, ativo: true, versao: 0 },
      { codigo: 'TRIGGER', nome: 'Trigger', cor: '#E3A008', icone: 'ri-flashlight-line', ordem: 1, ativo: true, versao: 0 },
      { codigo: 'SCRIPT', nome: 'Script', cor: '#8B5CF6', icone: 'ri-file-code-line', ordem: 2, ativo: true, versao: 0 },
      { codigo: 'AGENDADA', nome: 'Ação agendada', cor: '#D946A6', icone: 'ri-calendar-event-line', ordem: 3, ativo: true, versao: 0 },
      { codigo: 'ROTINA', nome: 'Rotina', cor: '#2E8B47', icone: 'ri-loop-left-line', ordem: 4, ativo: true, versao: 0 },
      { codigo: 'INTEGRACAO', nome: 'Integração', cor: '#0EA5E9', icone: 'ri-links-line', ordem: 5, ativo: true, versao: 0 },
      { codigo: 'RELATORIO', nome: 'Relatório', cor: '#F97316', icone: 'ri-file-chart-line', ordem: 6, ativo: false, versao: 0 },
      { codigo: 'MANUAL', nome: 'Manual / procedimento', cor: '#14B8A6', icone: 'ri-book-open-line', ordem: 7, ativo: true, versao: 0 },
      { codigo: 'OUTRO', nome: 'Outro', cor: '#64748B', icone: 'ri-file-line', ordem: 8, ativo: true, versao: 0 }
    ]
  };

  function t(id, titulo, coluna, ordem, x) {
    var base = {
      idTarefa: id, titulo: titulo, coluna: coluna, ordem: ordem, prioridade: 'M',
      idCategoria: null, idSetor: null, codUsuSol: EU, codUsuResp: null, dtVenc: null, tags: null,
      versao: 0, dhCriacao: agora(60 * 24 * 5), dhAlter: agora(60 * 3), descricao: null, itens: [], codUsuInc: 208
    };
    Object.keys(x || {}).forEach(function (k) { base[k] = x[k]; });
    return base;
  }
  var demandas = [
    t(1, 'Mapear permissões de usuários no AD', 'BACKLOG', 0, { idCategoria: 5, idSetor: 1, codUsuSol: 208, tags: 'segurança, ad' }),
    t(2, 'Revisar backup do servidor principal', 'BACKLOG', 2, { idCategoria: 4, idSetor: 1, codUsuResp: 71, prioridade: 'U', dtVenc: dia(-1),
      itens: [{ idItem: 1, descricao: 'Conferir log do último backup', feito: true, versao: 0 }, { idItem: 2, descricao: 'Testar restauração', feito: false, versao: 0 }, { idItem: 3, descricao: 'Documentar retenção', feito: false, versao: 0 }] }),
    t(3, 'Construir add-on do painel de TI no Sankhya', 'ANDAMENTO', 0, { idCategoria: 3, idSetor: 1, codUsuSol: 208, codUsuResp: 831, prioridade: 'A', dtVenc: dia(6), tags: 'addon, sankhya',
      descricao: '## Objetivo\nPainel único para a equipe de TI.\n\n- [x] Kanban configurável\n- [ ] Publicar no marketplace\n\n```sql\nSELECT COUNT(1) FROM CTI_TAREFA\n```\n\n## O que foi feito\n' +
        Array.apply(null, Array(14)).map(function (x, i) { return '- Passo ' + (i + 1) + ': grade autoajustável, linhas compactas, cabeçalho com logo e botão Excel, loading redesenhado e modo quiosque.'; }).join('\n') +
        '\n\n## Dados / comportamento\nA consulta chama a **TRG_LIBERA_PEDIDO** indiretamente ao gravar o pedido.',
      itens: [{ idItem: 4, descricao: 'Modelo de dados', feito: true, versao: 0 }, { idItem: 5, descricao: 'Tela nova', feito: true, versao: 0 }, { idItem: 6, descricao: 'Testes em produção', feito: false, versao: 0 }] }),
    t(4, 'Corrigir cálculo de impostos na nota', 'REVISAO', 1, { idCategoria: 1, idSetor: 5, codUsuSol: 204, codUsuResp: 1012, prioridade: 'A', dtVenc: dia(1) }),
    t(5, 'Aprovar layout do novo dashboard comercial', 'REVISAO', 0, { idCategoria: 5, idSetor: 6, codUsuSol: 208, codUsuResp: 17, dtVenc: dia(10) }),
    t(6, 'Levantamento de requisitos do Kanban', 'CONCLUIDO', 0, { idCategoria: 1, idSetor: 1, codUsuResp: 831, concluida: true, dhConclusao: agora(60 * 30) }),
    t(9, 'Trocar nobreak do rack da matriz', 'CONCLUIDO', 1, { idCategoria: 4, idSetor: 1, codUsuResp: 71, concluida: true, dhConclusao: agora(60 * 24 * 4) }),
    t(10, 'Liberar VPN para o novo gerente comercial', 'CONCLUIDO', 2, { idCategoria: 5, idSetor: 6, codUsuSol: 208, codUsuResp: 831, concluida: true, dhConclusao: agora(45) }),
    t(7, 'Ajustar trigger de liberação de pedidos', 'ANDAMENTO', 1, { idCategoria: 2, idSetor: 4, codUsuSol: 206, codUsuResp: 831, prioridade: 'B', dtVenc: dia(15),
      descricao: 'A **TRG_LIBERA_PEDIDO** bloqueia pedidos com desconto acima do limite do vendedor.\n\nAjustar para considerar a alçada do gerente (TGFVEN).' }),
    t(1234, 'Kit Admissão', 'ANDAMENTO', 2, { idCategoria: 8, idSetor: 3, codUsuSol: 205, codUsuResp: 1375 }),
    t(8, 'Criar usuário para nova colaboradora do RH', 'BACKLOG', 1, { idSetor: 3, codUsuSol: 205, prioridade: 'M' })
  ];
  var comentarios = [
    { idComentario: 1, idTarefa: 3, codUsu: 208, texto: 'Precisamos disso antes do fechamento do mês.', dhCriacao: agora(60 * 26) },
    { idComentario: 2, idTarefa: 3, codUsu: 831, texto: 'Kanban pronto, falta publicar.', dhCriacao: agora(40) },
    { idComentario: 3, idTarefa: 5, codUsu: 17, texto: 'O dashboard depende da TRG_LIBERA_PEDIDO estar ativa.', dhCriacao: agora(90) }
  ];
  var historico = [
    { idHist: 1, idTarefa: 3, tipoEvento: 'C', colunaDe: null, colunaPara: 'BACKLOG', codUsu: 208, dhMov: agora(60 * 24 * 5), observacao: null },
    { idHist: 2, idTarefa: 3, tipoEvento: 'M', colunaDe: 'BACKLOG', colunaPara: 'ANDAMENTO', codUsu: 831, dhMov: agora(60 * 24 * 2), observacao: null },
    { idHist: 3, idTarefa: 3, tipoEvento: 'E', colunaDe: 'ANDAMENTO', colunaPara: 'ANDAMENTO', codUsu: 831, dhMov: agora(60), observacao: 'Alterou: prazo, descrição' }
  ];
  var anexos = [
    { idAnexo: 1, idDocumento: 2, nomeArquivo: 'trg_vendas.zip', tipoArquivo: 'application/zip', tamArquivo: 48213 },
    { idAnexo: 2, idDocumento: 2, nomeArquivo: 'trg_vendas_rollback.sql', tipoArquivo: 'text/plain', tamArquivo: 1840 }
  ];
  function anexosDo(idDocumento) {
    return anexos.filter(function (a) { return a.idDocumento === idDocumento && a.ativo !== false; });
  }
  var documentos = [
    { idDocumento: 1, titulo: 'Procedure STP_ATUALIZA_ESTOQUE', tipo: 'T', tipoObj: 'PROCEDURE', idCategoria: 1, idTarefa: 3, status: 'O', tags: 'estoque',
      codUsuResp: 831, versao: 0, dhCriacao: agora(60 * 24 * 9), dhAlter: agora(60 * 24),
      conteudo: '# Atualização de estoque\n\nRecalcula o saldo a partir da **TGFEST**. É chamada pela TRG_LIBERA_PEDIDO quando o pedido é liberado.\n\n| Parâmetro | Uso |\n|---|---|\n| P_CODEMP | empresa |\n\n```sql\nBEGIN\n  STP_ATUALIZA_ESTOQUE(1);\nEND;\n```\n\n> Rodar fora do horário comercial.' },
    { idDocumento: 5, titulo: 'Liberação de pedidos acima da alçada', tipo: 'T', tipoObj: 'TRIGGER', idCategoria: 2, idTarefa: 7, status: 'O', versao: 0,
      codUsuResp: 831, dhCriacao: agora(60 * 24 * 3), dhAlter: agora(60 * 5),
      conteudo: '## TRG_LIBERA_PEDIDO\n\nDispara em `BEFORE UPDATE` na TGFCAB.\n\n```sql\nCREATE OR REPLACE TRIGGER TRG_LIBERA_PEDIDO\nBEFORE UPDATE ON TGFCAB\n```' },
    { idDocumento: 2, titulo: 'Trigger TRG_VENDAS (backup)', tipo: 'A', tipoObj: 'TRIGGER', idCategoria: 2, idTarefa: 7, status: 'O',
      codUsuResp: 71, versao: 0, dhCriacao: agora(60 * 24 * 12), dhAlter: agora(60 * 24 * 12) },
    { idDocumento: 3, titulo: 'Job noturno de sincronização', tipo: 'T', tipoObj: 'AGENDADA', idCategoria: 4, status: 'R', versao: 0,
      dhCriacao: agora(60 * 24 * 20), dhAlter: agora(60 * 24 * 4), conteudo: 'Executa às 23h pelo agendador do Sankhya.' },
    { idDocumento: 4, titulo: 'Repositório do conector Pontotel', tipo: 'R', tipoObj: 'INTEGRACAO', status: 'O', versao: 0,
      repositorio: 'https://git.exemplo.local/ti/pontotel', branch: 'main', revisao: 'v1.4.2', caminho: 'src/main/java',
      dhCriacao: agora(60 * 24 * 30), dhAlter: agora(60 * 24 * 30) }
  ];

  var sessoes = [
    { idSessao: 'colega-1', codUsu: 71, nomeUsu: 'LUCASM', aba: 'KANBAN', entidade: 'T', idRegistro: 2, editando: true },
    { idSessao: 'colega-2', codUsu: 208, nomeUsu: 'MARCOS SANTOS', aba: 'VISAOGERAL', entidade: null, idRegistro: null, editando: false },
    { idSessao: 'colega-3', codUsu: 17, nomeUsu: 'RAFAEL', aba: 'COFRE', entidade: 'A', idRegistro: 2, editando: true }
  ];
  var assinatura = 1;

  // ---------------------------------------------------------------- cofre
  // Dados fictícios. No servidor a senha fica cifrada (CofreService); aqui fica
  // em memória, mas o contrato é o mesmo: a listagem nunca devolve a senha.
  var cofre = { grupoSenha: 14, versaoGrupoSenha: 0 };
  var dominios = [
    { dominio: 'empresa-demo.com.br', ativo: true, hostgator: true, versao: 0 },
    { dominio: 'holding-demo.com.br', ativo: true, hostgator: false, versao: 0 },
    { dominio: 'locadora-demo.com.br', ativo: true, hostgator: true, versao: 0 },
    { dominio: 'antigo.com.br', ativo: false, versao: 0 }
  ];
  var tiposAcesso = [
    { codigo: 'EMAIL', nome: 'E-mails', modelo: 'E', icone: 'ri-mail-line', ordem: 0, ativo: true, versao: 0 },
    { codigo: 'PASTA', nome: 'Pasta pública / TS', modelo: 'T', icone: 'ri-folder-shared-line', ordem: 1, ativo: true, versao: 0 },
    { codigo: 'STARLINK', nome: 'Starlink', modelo: 'S', icone: 'ti-satellite', ordem: 2, ativo: true, versao: 0 },
    { codigo: 'OUTROS', nome: 'Outros acessos', modelo: 'O', icone: 'ri-key-2-line', ordem: 3, ativo: true, versao: 0 },
    { codigo: 'VPN', nome: 'VPN', modelo: 'O', icone: 'ti-shield-lock', ordem: 4, ativo: true, versao: 0 }
  ];
  var equipamentos = [
    { nome: 'CELULAR', icone: 'ri-smartphone-line', categoria: 'E', ativo: true, versao: 0 },
    { nome: 'DESKTOP', icone: 'ri-computer-line', categoria: 'E', ativo: true, versao: 0 },
    { nome: 'NOTEBOOK DA EMPRESA', icone: 'ri-macbook-line', categoria: 'E', ativo: true, versao: 0 },
    { nome: 'NOTEBOOK PESSOAL', icone: 'ri-macbook-line', categoria: 'P', ativo: true, versao: 0 },
    { nome: 'REDIRECIONAMENTO', icone: 'ri-share-forward-line', categoria: 'R', ativo: true, versao: 0 },
    { nome: 'TABLET', icone: 'ri-tablet-line', categoria: 'E', ativo: false, versao: 0 }
  ];
  var departamentos = [
    { codDep: 10, descrDep: 'FINANCEIRO' }, { codDep: 11, descrDep: 'SUPRIMENTOS' }, { codDep: 12, descrDep: 'ADM CENTRAL' },
    { codDep: 13, descrDep: 'RH' }, { codDep: 14, descrDep: 'LOGÍSTICA' }, { codDep: 20, descrDep: 'FAZENDA NORTE - VIVEIRO' },
    { codDep: 21, descrDep: 'FAZENDA SUL - PLANTIO' }
  ];
  function nomeDep(cod) { var d = CtiUtil.porId(departamentos, 'codDep', cod); return d ? d.descrDep : null; }
  // SITUACAO da TFPFUN: 1 ativo, 0 demitido, 8 transferido.
  var funcionarios = [
    { codEmp: 1, codFunc: 17152, nomeFunc: 'ALICE PEIXOTO MOURA', situacao: '1', cargo: 'ANALISTA FINANCEIRO', codDep: 10, nomeEmpresa: 'EMPRESA DEMO MATRIZ' },
    { codEmp: 1, codFunc: 16231, nomeFunc: 'BRENO TAVARES', situacao: '0', dtDemissao: dia(-12), cargo: 'COMPRADOR', codDep: 11, nomeEmpresa: 'EMPRESA DEMO MATRIZ' },
    { codEmp: 502, codFunc: 90001, nomeFunc: 'CAIO ROCHA RIBAS', situacao: '1', cargo: 'ANALISTA DE SISTEMAS', codDep: 12, nomeEmpresa: 'EMPRESA DEMO FILIAL NORTE' },
    { codEmp: 5, codFunc: 88002, nomeFunc: 'DANIELA QUEIROZ', situacao: '8', cargo: 'ASSISTENTE DE RH', codDep: 13, nomeEmpresa: 'EMPRESA DEMO FILIAL SUL' },
    { codEmp: 5, codFunc: 88777, nomeFunc: 'DANIELA QUEIROZ', situacao: '1', cargo: 'ASSISTENTE DE RH', codDep: 13, nomeEmpresa: 'EMPRESA DEMO FILIAL SUL' },
    { codEmp: 1, codFunc: 12000, nomeFunc: 'EDUARDO NUNES', situacao: '1', cargo: 'MOTORISTA', codDep: 14, nomeEmpresa: 'EMPRESA DEMO MATRIZ' },
    { codEmp: 1, codFunc: 30100, nomeFunc: 'FERNANDA LOPES BARROS', situacao: '1', cargo: 'TÉCNICA DE CAMPO', codDep: 20, nomeEmpresa: 'EMPRESA DEMO MATRIZ' },
    { codEmp: 1, codFunc: 30200, nomeFunc: 'GABRIEL SOUTO', situacao: '0', dtDemissao: dia(-30), cargo: 'OPERADOR', codDep: 21, nomeEmpresa: 'EMPRESA DEMO MATRIZ' },
    // Aviso prévio: demissão com data futura (aparece como agendado, não conta).
    { codEmp: 1, codFunc: 30300, nomeFunc: 'HELOISA DUARTE', situacao: '0', dtDemissao: dia(20), cargo: 'AUXILIAR ADMINISTRATIVO', codDep: 12, nomeEmpresa: 'EMPRESA DEMO MATRIZ' }
  ];
  var acessos = [
    { idAcesso: 1, tipo: 'E', codTipo: 'EMAIL', codEmp: 1, codFunc: 17152, login: 'alice.moura@empresa-demo.com.br', senha: 'Demo#0001', equipamento: 'NOTEBOOK DA EMPRESA', unidade: 'MATRIZ', ativo: true, generica: false, versao: 0, dhSenha: agora(60 * 24 * 40), dhAlter: agora(60 * 24 * 40), codUsuAlter: 831 },
    { idAcesso: 2, tipo: 'E', codTipo: 'EMAIL', codEmp: 1, codFunc: 16231, login: 'breno.exemplo@empresa-demo.com.br', senha: 'Demo#0002', equipamento: 'DESKTOP', ativo: true, generica: false, versao: 0, dhSenha: agora(60 * 24 * 200), dhAlter: agora(60 * 24 * 200), codUsuAlter: 71 },
    { idAcesso: 3, tipo: 'E', codTipo: 'EMAIL', codEmp: 5, codFunc: 88002, login: 'daniela.rh@empresa-demo.com.br', senha: 'Demo#0003', marca: 'AMARELO', codUsuMarca: 71, ativo: true, generica: false, versao: 0, dhAlter: agora(60 * 24 * 90), codUsuAlter: 831 },
    { idAcesso: 4, tipo: 'E', codTipo: 'EMAIL', login: 'caixa.exemplo@holding-demo.com.br', senha: 'Demo#0004', descricao: 'Caixa geral da holding', equipamento: 'RED. TI', ativo: true, generica: true, versao: 0, dhAlter: agora(60 * 24 * 10), codUsuAlter: 831 },
    { idAcesso: 14, tipo: 'E', codTipo: 'EMAIL', login: 'contato.exemplo@locadora-demo.com.br', destinos: ['ana.locacao@locadora-demo.com.br', 'bia.locacao@locadora-demo.com.br'], senha: 'Demo#0005', descricao: 'Contato da locadora', equipamento: 'REDIRECIONAMENTO', ativo: true, generica: true, versao: 0, dhAlter: agora(60 * 24 * 5), codUsuAlter: 831 },
    { idAcesso: 15, tipo: 'E', codTipo: 'EMAIL', codEmp: 502, codFunc: 90001, login: 'caio.ribas@empresa-demo.com.br', senha: 'Demo#0006', equipamento: 'NOTEBOOK PESSOAL', ativo: true, generica: false, versao: 0, dhAlter: agora(60 * 24 * 3), codUsuAlter: 831 },
    { idAcesso: 5, tipo: 'T', codTipo: 'PASTA', login: 'PASTAEXEMPLO01', senha: 'Demo#0007', unidade: 'FILIAL NORTE RH', pasta: 'RH', horario: '16H', ativo: true, generica: true, versao: 0, dhAlter: agora(60 * 24 * 5), codUsuAlter: 71 },
    { idAcesso: 6, tipo: 'T', codTipo: 'PASTA', codEmp: 1, codFunc: 16231, login: 'BRENO.TAVARES', senha: 'Demo#0008', unidade: 'MATRIZ', pasta: 'PRODUÇÃO', horario: '24H', ativo: true, generica: false, versao: 0, dhAlter: agora(60 * 24 * 300), codUsuAlter: 71 },
    { idAcesso: 7, tipo: 'S', codTipo: 'STARLINK', codEmp: 1, codFunc: 30100, login: 'starlink.norte1@empresa-demo.com.br', destinos: ['ti@empresa-demo.com.br'], senha: 'Demo#0009', equipamento: 'MINI', diaAtivacao: 18, ativo: true, generica: false, versao: 0, dhAlter: agora(60 * 24 * 120), codUsuAlter: 831 },
    { idAcesso: 10, tipo: 'S', codTipo: 'STARLINK', codDep: 20, responsavel: 'CAMINHÃO OFICINA', login: 'starlink.norte2@empresa-demo.com.br', destinos: ['ti@empresa-demo.com.br'], senha: 'Demo#0010', equipamento: 'FIXA - GEN2', diaAtivacao: 24, obs: 'Viveiro', ativo: true, generica: false, versao: 0, dhAlter: agora(60 * 24 * 60), codUsuAlter: 831 },
    { idAcesso: 11, tipo: 'S', codTipo: 'STARLINK', codEmp: 1, codFunc: 30200, login: 'starlink.sul@empresa-demo.com.br', senha: 'Demo#0011', equipamento: 'MINI', diaAtivacao: 8, ativo: true, generica: false, versao: 0, dhAlter: agora(60 * 24 * 90), codUsuAlter: 71 },
    { idAcesso: 12, tipo: 'S', codTipo: 'STARLINK', particular: true, proprietario: 'SÓCIO DIRETOR', responsavel: 'FAZENDA PARTICULAR', login: 'starlink.particular@empresa-demo.com.br', senha: 'Demo#0012', equipamento: 'MINI', diaAtivacao: 28, obs: 'Cartão do proprietário', ativo: true, generica: false, versao: 0, dhAlter: agora(60 * 24 * 30), codUsuAlter: 831 },
    { idAcesso: 13, tipo: 'S', codTipo: 'STARLINK', codDep: 21, login: 'starlink.antiga@empresa-demo.com.br', senha: 'Demo#0013', equipamento: 'FIXA - GEN2', obs: 'Encerrada', ativo: false, generica: false, versao: 0, dhAlter: agora(60 * 24 * 200), codUsuAlter: 831 },
    { idAcesso: 8, tipo: 'O', codTipo: 'OUTROS', descricao: 'Mercado Livre - Central', login: 'conta.exemplo11@empresa-demo.com.br', senha: 'Demo#0014', url: 'https://www.mercadolivre.com.br', obs: 'Conta usada pelo setor de compras', ativo: true, generica: false, versao: 0, dhAlter: agora(60 * 24 * 3), codUsuAlter: 17 },
    { idAcesso: 9, tipo: 'E', codTipo: 'EMAIL', login: 'antigo.estagiario@empresa-demo.com.br', senha: 'Demo#0015', ativo: false, generica: true, versao: 0, dhAlter: agora(60 * 24 * 400), codUsuAlter: 831 },
    { idAcesso: 16, tipo: 'E', codTipo: 'EMAIL', codEmp: 1, codFunc: 30300, login: 'heloisa.duarte@empresa-demo.com.br', ferias: true, destinos: ['alice.moura@empresa-demo.com.br'], senha: 'Demo#0016', equipamento: 'DESKTOP', ativo: true, generica: false, versao: 0, dhAlter: agora(60 * 24 * 50), codUsuAlter: 831 },
    // Registro que sumiu da folha (alerta "fora da folha").
    { idAcesso: 17, tipo: 'T', codTipo: 'PASTA', codEmp: 1, codFunc: 45000, login: 'JOAO.ANTIGO', senha: 'Demo#0017', unidade: 'MATRIZ', pasta: 'COMPRAS', horario: '24H', ativo: true, generica: false, versao: 0, dhAlter: agora(60 * 24 * 500), codUsuAlter: 71 }
  ];
  function funcionario(codEmp, codFunc) {
    return funcionarios.filter(function (f) { return f.codEmp === codEmp && f.codFunc === codFunc; })[0] || null;
  }
  /** Funcionário no formato do FuncionarioDTO (sugestões da conferência). */
  function funcDto(codEmp, codFunc) {
    var f = funcionario(codEmp, codFunc);
    return Object.assign({}, f, { departamento: nomeDep(f.codDep) });
  }
  /** Mesma regra de AcessoService.alerta. */
  function alertaDo(a, f) {
    if (!a.ativo || a.generica || !a.codFunc) { return null; }
    if (!f) { return 'NAO_ENCONTRADO'; }
    if (f.situacao === '0') {
      // Mesma regra do servidor (DesligadosService.agendado): data futura até 90 dias = agendado.
      var dias = f.dtDemissao ? Math.round((new Date(f.dtDemissao + 'T00:00:00') - new Date(dia(0) + 'T00:00:00')) / 86400000) : 0;
      return dias > 0 && dias <= 90 ? 'AGENDADO' : 'DEMITIDO';
    }
    if (f.situacao === '8') { return 'TRANSFERIDO'; }
    return null;
  }
  function linhaAcesso(a) {
    var r = copia(a);
    delete r.senha;
    r.temSenha = !!a.senha;
    var f = a.codFunc ? funcionario(a.codEmp, a.codFunc) : null;
    if (f) {
      r.nomeFunc = f.nomeFunc; r.situacaoFunc = f.situacao; r.dtDemissao = f.dtDemissao || null;
      r.cargo = f.cargo; r.departamento = nomeDep(f.codDep); r.nomeEmpresa = f.nomeEmpresa;
    }
    r.departamentoAcesso = a.codDep ? nomeDep(a.codDep) : null;
    // Transferido: registro ativo da mesma pessoa (no servidor, pelo CPF; aqui, pelo nome).
    if (f && f.situacao === '8') {
      var novo = funcionarios.filter(function (x) { return x.nomeFunc === f.nomeFunc && x.situacao !== '0' && x.situacao !== '8'; })[0];
      if (novo) { r.novoCodEmp = novo.codEmp; r.novoCodFunc = novo.codFunc; r.novoNomeFunc = novo.nomeFunc; r.novoNomeEmpresa = novo.nomeEmpresa; r.novoDepartamento = nomeDep(novo.codDep); }
    }
    r.particular = !!a.particular;
    r.nomeUsuAlter = nome(a.codUsuAlter);
    r.nomeUsuMarca = a.marca ? nome(a.codUsuMarca) : null;
    r.alerta = alertaDo(a, f);
    return r;
  }
  // Usuários do Om (TSIUSU) ligados a funcionários da folha: ativo = sem data limite de acesso.
  var usuariosOm = [
    { codUsu: 412, nomeUsu: 'BRENO.N', nomeCompleto: 'BRENO TAVARES', codEmp: 1, codFunc: 16231, dtLimAcesso: null, hashPonto: '3f2a9c1e-7b4d-4e8a-9c21-5d6e7f809a1b' },
    { codUsu: 518, nomeUsu: 'GABRIEL', nomeCompleto: 'GABRIEL SOUTO', codEmp: 1, codFunc: 30200, dtLimAcesso: null, hashPonto: 'a81d4c22-0f3b-4b7e-8d55-c2e19f4a6b07' },
    // Vínculo suspeito: usuário de outra pessoa ligado ao funcionário demitido (o modal avisa).
    { codUsu: 733, nomeUsu: 'LARAUJO', nomeCompleto: 'LETICIA ARAUJO', codEmp: 1, codFunc: 30200, dtLimAcesso: null },
    // Demitida só com usuário no Om, sem conta no cofre.
    { codUsu: 1121, nomeUsu: 'PRISCILA', nomeCompleto: 'PRISCILA DUARTE VIANA', codEmp: 1, codFunc: 13674, dtLimAcesso: null }
  ];
  funcionarios.push({ codEmp: 1, codFunc: 13674, nomeFunc: 'PRISCILA DUARTE VIANA', situacao: '0', dtDemissao: dia(-200), cargo: 'ANALISTA FISCAL', codDep: 10, nomeEmpresa: 'EMPRESA DEMO MATRIZ' });

  /** Mesma regra de DesligadosService: uma linha por pessoa, quem saiu há mais tempo primeiro. */
  function desligadosMock() {
    var hoje = dia(0), limite = dia(90), porPessoa = {};
    var pessoa = function (codEmp, codFunc, f, alerta) {
      var k = codEmp + '-' + codFunc;
      if (!porPessoa[k]) {
        var dt = f && f.dtDemissao || null;
        var novo = f && f.situacao === '8'
          ? funcionarios.filter(function (x) { return x.nomeFunc === f.nomeFunc && x.situacao !== '0' && x.situacao !== '8'; })[0] : null;
        porPessoa[k] = { codEmp: codEmp, codFunc: codFunc, nomeFunc: f ? f.nomeFunc : null, nomeEmpresa: f ? f.nomeEmpresa : null,
          situacao: alerta, dtDemissao: dt, agendado: alerta === 'DEMITIDO' && !!dt && dt > hoje && dt <= limite,
          dataInconsistente: !!dt && dt > limite,
          diasDesligado: dt && dt <= hoje ? Math.round((new Date(hoje) - new Date(dt)) / 86400000) : null,
          novoCodEmp: novo ? novo.codEmp : null, novoCodFunc: novo ? novo.codFunc : null,
          novoNomeFunc: novo ? novo.nomeFunc : null, novoNomeEmpresa: novo ? novo.nomeEmpresa : null,
          contas: [], usuarios: [] };
      }
      return porPessoa[k];
    };
    acessos.forEach(function (a) {
      if (a.excluido) { return; }
      var f = a.codFunc ? funcionario(a.codEmp, a.codFunc) : null;
      var alerta = alertaDo(a, f);
      if (!alerta) { return; }
      var t = CtiUtil.porId(tiposAcesso, 'codigo', a.codTipo) || {};
      pessoa(a.codEmp, a.codFunc, f, alerta).contas.push({ idAcesso: a.idAcesso, versao: a.versao || 0, tipo: a.tipo, codTipo: a.codTipo,
        nomeTipo: t.nome || null, iconeTipo: t.icone || null, login: a.login || null, descricao: a.descricao || null,
        equipamento: a.equipamento || null, unidade: a.unidade || null, pasta: a.pasta || null, horario: a.horario || null,
        url: a.url || null, diaAtivacao: a.diaAtivacao || null });
    });
    usuariosOm.forEach(function (x) {
      var f = funcionario(x.codEmp, x.codFunc);
      if (!f || (f.situacao !== '0' && f.situacao !== '8') || (x.dtLimAcesso && x.dtLimAcesso < dia(0))) { return; }
      pessoa(x.codEmp, x.codFunc, f, f.situacao === '0' ? 'DEMITIDO' : 'TRANSFERIDO').usuarios.push({
        codUsu: x.codUsu, nomeUsu: x.nomeUsu, nomeCompleto: x.nomeCompleto, ativo: !x.dtLimAcesso, dtLimAcesso: x.dtLimAcesso,
        hashPonto: x.hashPonto || null });
    });
    var grupo = function (d) { return d.agendado ? 2 : (d.situacao === 'TRANSFERIDO' ? 1 : 0); };
    return Object.keys(porPessoa).map(function (k) { return porPessoa[k]; })
      .filter(function (d) { return d.contas.length || d.usuarios.some(function (x) { return x.ativo; }); })
      .sort(function (a, b) {
        return grupo(a) - grupo(b) || ((a.dtDemissao || '9') < (b.dtDemissao || '9') ? -1 : (a.dtDemissao || '9') > (b.dtDemissao || '9') ? 1 : 0) ||
          String(a.nomeFunc || '').localeCompare(String(b.nomeFunc || ''));
      });
  }
  function hashTexto(t) {
    var h = 0;
    for (var i = 0; i < t.length; i++) { h = (h * 31 + t.charCodeAt(i)) | 0; }
    return h;
  }
  function resumoDesligadosMock() {
    var lista = desligadosMock();
    var conta = function (fn) { return lista.filter(fn).length; };
    return {
      desligados: conta(function (d) { return !d.agendado && d.situacao !== 'TRANSFERIDO'; }),
      transferidos: conta(function (d) { return !d.agendado && d.situacao === 'TRANSFERIDO'; }),
      agendados: conta(function (d) { return d.agendado; }),
      impressao: lista.length ? hashTexto(JSON.stringify(lista)) : 0
    };
  }
  // ?mock=1: 40 s depois de abrir, o RH desliga o Eduardo na folha (testa o aviso em tempo real).
  setTimeout(function () {
    var f = funcionario(1, 12000);
    if (f) { f.situacao = '0'; f.dtDemissao = dia(0); }
    acessos.push({ idAcesso: 18, tipo: 'E', codTipo: 'EMAIL', codEmp: 1, codFunc: 12000, login: 'eduardo.nunes@empresa-demo.com.br', senha: 'Demo#0018', ativo: true, generica: false, versao: 0, dhAlter: agora(60 * 24 * 80), codUsuAlter: 831 });
  }, 40000);
  function gerarSenhaMock(tamanho, simbolos) {
    var grupos = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789'];
    if (simbolos) { grupos.push('!@#$%&*-_=+?'); }
    var todos = grupos.join('');
    var sorteio = function (de) { var b = new Uint32Array(1); window.crypto.getRandomValues(b); return de.charAt(b[0] % de.length); };
    var saida = grupos.map(sorteio);
    while (saida.length < tamanho) { saida.push(sorteio(todos)); }
    return saida.sort(function () { return Math.random() - 0.5; }).join('');
  }

  function coluna(cod) { return CtiUtil.porId(config.colunas, 'codigo', cod); }

  function linhaDemanda(d) {
    var itens = d.itens || [];
    var docs = documentos.filter(function (x) { return x.idTarefa === d.idTarefa && x.ativo !== false; });
    var c = coluna(d.coluna);
    var r = copia(d);
    delete r.descricao;
    delete r.itens;
    r.nomeSol = nome(d.codUsuSol);
    r.nomeResp = nome(d.codUsuResp);
    r.concluida = !!(c && c.conclui);
    r.qtdItens = itens.length;
    r.qtdItensFeitos = itens.filter(function (i) { return i.feito; }).length;
    r.qtdComentarios = comentarios.filter(function (m) { return m.idTarefa === d.idTarefa; }).length;
    r.qtdAnexos = docs.filter(function (x) { return x.tipo === 'A'; }).length;
    r.qtdDocumentos = docs.length;
    return r;
  }

  function ativas() { return demandas.filter(function (d) { return d.ativo !== false; }); }

  function mudou() { assinatura++; }

  // ------------------------------------------------------------ HostGator
  // Simulação da integração: chamada demora ~1,2 s (mostra o carregamento) e
  // e-mail com "erro" no endereço é recusado, para ver o modal e o resumo.
  var hg = { ativo: true, host: 'servidor.exemplo.com.br', porta: 8443, usuario: 'usuario_cpanel', tokenConfigurado: true,
    dhToken: agora(60 * 24 * 3), timeout: 20, destStarlink: 'ti@empresa-demo.com.br', cotaMb: 0, boasVindas: false,
    equipRedir: 'REDIRECIONAMENTO', dhTeste: agora(90), resultadoTeste: 'OK: 3 domínio(s) de e-mail na conta, resposta em 412 ms.', versao: 2 };
  var hgLog = [];
  // ?hgfalha=1 simula o teste automático falhando: cartão vermelho e aviso no sino.
  if (/[?&]hgfalha=1\b/.test(window.location.search)) {
    hg.testeAuto = true;
    hg.resultadoTeste = 'ERRO: Tempo esgotado: a HostGator não respondeu em 20 segundos.';
  }
  var HG_ATRASO_MS = 1200;
  function hgRegistrar(operacao, email, destino, ok, mensagem) {
    hgLog.unshift({ idHgLog: hgLog.length + 1, dhEvento: agora(), codUsu: EU, nomeUsu: 'ISAAC', operacao: operacao, email: email || null,
      destino: destino || null, sucesso: ok !== false, httpStatus: 200, mensagem: mensagem || null, duracaoMs: 180 + Math.round(Math.random() * 500),
      origem: 'GestaoTiSP.mock' });
  }
  [['TESTE', null, null, true], ['CRIAR_CAIXA', 'novo.colaborador@empresa-demo.com.br', null, true],
    ['SENHA', 'erro.senha@empresa-demo.com.br', null, false, 'A senha não atende aos requisitos de força do servidor.'],
    ['CRIAR_REDIR', 'heloisa.duarte@empresa-demo.com.br', 'alice.moura@empresa-demo.com.br', true]]
    .forEach(function (x) { hgRegistrar(x[0], x[1], x[2], x[3], x[4]); });
  function hgGerencia(login) {
    if (!hg.ativo || !login || login.indexOf('@') < 0) { return false; }
    var d = CtiUtil.porId(dominios, 'dominio', login.slice(login.indexOf('@') + 1));
    return !!(d && d.hostgator);
  }
  /**
   * Como o AcessoService.excluirUm: quem redireciona para o e-mail que sai perde o
   * destino (caixa em férias sem destino sai das férias). Redirecionamento que ficaria
   * sem destino impede: devolve o erro e não muda nada. ids: contas que saem juntas.
   */
  function hgTirarDestinos(a, ids) {
    if (!hgGerencia(a.login) || !hgNatureza(a)) { return null; }
    var email = a.login.toLowerCase();
    var afetados = acessos.filter(function (x) {
      return !x.excluido && ids.indexOf(x.idAcesso) < 0 && (x.destinos || []).some(function (d) { return d.toLowerCase() === email; });
    });
    var orfaos = afetados.filter(function (x) { return x.destinos.length === 1 && hgNatureza(x) !== 'CAIXA'; });
    if (orfaos.length) {
      return 'Não dá para excluir ' + email + ': outros e-mails mandam só para ele.\nMOTIVO: Ficariam sem destino: ' +
        orfaos.map(function (x) { return x.login; }).join(', ') + '.\nSOLUCAO: Troque o destino deles no cofre e exclua de novo.';
    }
    afetados.forEach(function (x) {
      x.destinos = x.destinos.filter(function (d) { return d.toLowerCase() !== email; });
      if (!x.destinos.length) { x.ferias = false; }
      x.versao++;
      if (hgGerencia(x.login)) { hgRegistrar('EXCLUIR_REDIR', x.login, email); }
    });
    return null;
  }
  function hgNatureza(a) {
    if (!a.login) { return null; }
    if (a.tipo === 'S') { return 'REDIR'; }
    if (a.tipo !== 'E') { return null; }
    var eq = CtiUtil.porId(equipamentos, 'nome', a.equipamento);
    return eq && eq.categoria === 'R' ? 'REDIR' : 'CAIXA';
  }
  /** Erro no formato do ErroDeNegocio (mensagem, MOTIVO, SOLUCAO), como o servidor devolve. */
  function hgErro(acao, motivo) {
    return 'Não foi possível ' + acao + ' na HostGator.\nMOTIVO: ' + motivo +
      '\nSOLUCAO: Nada foi gravado no painel. Veja o log da API em Configurações > HostGator.';
  }
  function demorar(promessa) {
    return new Promise(function (ok) { setTimeout(ok, HG_ATRASO_MS); }).then(function () { return promessa; });
  }

  function filtrarLogMock(f) {
    var x = f || {};
    var desde = Date.now() - (x.dias || 30) * 86400000;
    var termo = (x.termo || '').toLowerCase();
    return hgLog.filter(function (l) {
      return new Date(l.dhEvento).getTime() >= desde && (!x.soErros || !l.sucesso) && (!x.operacao || l.operacao === x.operacao) &&
        (!termo || ((l.email || '') + ' ' + (l.destino || '')).toLowerCase().indexOf(termo) >= 0);
    }).slice(0, 200);
  }

  function conferirVersao(registro, versao, rotulo) {
    if (!registro) { return rotulo + ' não encontrado(a).'; }
    if (versao === null || versao === undefined) { return 'Versão do registro não informada; recarregue a tela.'; }
    if (Number(versao) !== Number(registro.versao)) {
      return '[CONFLITO] ' + rotulo + ': LUCASM gravou uma alteração depois que você abriu o registro. Os dados foram recarregados; confira e refaça a sua alteração.';
    }
    return null;
  }

  /** Igual a PosseDemanda.java: demanda com responsável só ele e o SUP alteram. */
  function semPosse(idTarefa, acao) {
    var d = idTarefa ? CtiUtil.porId(demandas, 'idTarefa', idTarefa) : null;
    if (!d || CtiApp.estado.sessao.sup || !CtiUtil.temUsuario(d.codUsuResp) || Number(d.codUsuResp) === EU) { return null; }
    return 'Você não pode ' + acao + ' da demanda #' + d.idTarefa + '.\nMOTIVO: A demanda tem responsável: só ele e o SUP alteram os dados, o checklist e os documentos dela.' +
      '\nSOLUCAO: Use os comentários para pedir a alteração ao responsável.';
  }

  function renumerar(cod) {
    ativas().filter(function (d) { return d.coluna === cod; })
      .sort(function (a, b) { return a.ordem - b.ordem; })
      .forEach(function (d, i) { d.ordem = i; });
  }

  return {
    iniciarSessao: function () {
      // ?mock=1&comum=1 simula um usuário que não é SUP (regras de dono e configuração em leitura).
      var comum = /[?&]comum=1\b/.test(window.location.search);
      return responder({ codUsu: EU, nomeUsu: 'ISAAC', sup: !comum, podeIncluir: true, podeAlterar: true, podeExcluir: true,
        podeConfigurar: !comum, responsavel: true, grupoResponsaveis: config.grupoResponsaveis, intervaloPresencaSeg: 10,
        // ?semcofre=1 simula quem não está no grupo do cofre (o menu Cofre some).
        podeCofre: !/[?&]semcofre=1\b/.test(window.location.search),
        tema: temaMock });
    },
    salvarPreferencias: function (p) {
      if (p.tema !== 'C' && p.tema !== 'E') { return falhar('Tema inválido: use C (claro) ou E (escuro).'); }
      temaMock = p.tema;
      return responder({ tema: p.tema });
    },
    registrarPresenca: function (sinal) {
      var minha = { idSessao: sinal.idSessao, codUsu: EU, nomeUsu: 'ISAAC', aba: sinal.aba, entidade: sinal.entidade,
        idRegistro: sinal.idRegistro, editando: !!sinal.editando, dhUltimo: agora(), minhaSessao: true };
      return responder({ sessoes: [minha].concat(sessoes.map(function (s) {
        return Object.assign({ dhUltimo: agora(), minhaSessao: false }, s);
      })), assinatura: assinatura, fotos: {},
        desligados: /[?&]semcofre=1\b/.test(window.location.search) ? null : resumoDesligadosMock(),
        hostGatorLog: /[?&]semcofre=1\b/.test(window.location.search) ? null : hgLog.length,
        hostGatorFalha: /[?&]semcofre=1\b/.test(window.location.search) || !hg.ativo || hg.resultadoTeste.indexOf('ERRO') !== 0
          ? null : hg.dhTeste });
    },
    encerrarPresenca: function () { return responder({ ok: true }); },
    sinalAlteracao: function () { return responder({ assinatura: assinatura }); },
    salvarGrupoResponsaveis: function (g) {
      config.grupoResponsaveis = g.codGrupo;
      config.nomeGrupoResponsaveis = g.codGrupo ? (CtiUtil.porId(config.grupos, 'codGrupo', g.codGrupo) || {}).nomeGrupo : null;
      config.versaoGrupo = (config.versaoGrupo || 0) + 1;
      mudou();
      return responder(g.codGrupo);
    },
    fotoUsuario: function (codUsu) { return responder({ codUsu: codUsu, mime: null, base64: null }); },

    carregarConfiguracao: function () {
      var c = copia(config);
      c.colunas = c.colunas.sort(function (a, b) { return a.ordem - b.ordem; }).map(function (x) {
        x.qtdDemandas = ativas().filter(function (d) { return d.coluna === x.codigo; }).length;
        return x;
      });
      c.categorias.forEach(function (x) {
        x.qtdDemandas = ativas().filter(function (d) { return d.idCategoria === x.idCategoria; }).length;
        x.qtdDocumentos = documentos.filter(function (d) { return d.idCategoria === x.idCategoria; }).length;
      });
      c.tiposObjeto.forEach(function (x) {
        x.qtdDocumentos = documentos.filter(function (d) { return d.tipoObj === x.codigo; }).length;
      });
      c.setores.forEach(function (x) { x.qtdDemandas = ativas().filter(function (d) { return d.idSetor === x.idSetor; }).length; });
      c.responsaveis.forEach(function (x) {
        x.qtdAbertas = ativas().filter(function (d) { return d.codUsuResp === x.codUsu && !coluna(d.coluna).conclui; }).length;
      });
      c.usuarios = copia(usuarios);
      return responder(c);
    },
    salvarColuna: function (dto) {
      var existente = coluna(dto.codigo);
      if (dto.versao === null || dto.versao === undefined) {
        if (existente) { return falhar('Já existe (ou já existiu) uma coluna com o identificador ' + dto.codigo + '.'); }
        config.colunas.push(Object.assign({}, dto, { ordem: config.colunas.length, versao: 0 }));
      } else {
        var erro = conferirVersao(existente, dto.versao, 'Coluna');
        if (erro) { return falhar(erro); }
        Object.assign(existente, dto, { versao: existente.versao + 1 });
      }
      mudou();
      return responder(dto.codigo);
    },
    excluirColuna: function (dto) {
      var qtd = ativas().filter(function (d) { return d.coluna === dto.codigo; }).length;
      if (qtd) { return falhar('A coluna tem ' + qtd + ' demanda(s). Mova-as para outra coluna antes de excluir, ou apenas oculte a coluna.'); }
      config.colunas = config.colunas.filter(function (c) { return c.codigo !== dto.codigo; });
      mudou();
      return responder(dto.codigo);
    },
    reordenarColunas: function (ordem) {
      ordem.codigos.forEach(function (cod, i) { coluna(cod).ordem = i; });
      mudou();
      return responder(ordem.codigos.length);
    },
    salvarCategoria: function (dto) {
      if (dto.uso && 'ATD'.indexOf(dto.uso) < 0) { return falhar('Uso da categoria inválido.'); }
      return salvarSimples(config.categorias, 'idCategoria', Object.assign({}, dto, { uso: dto.uso || 'A' }));
    },
    salvarTipoDocumento: function (dto) {
      var codigo = String(dto.codigo || '').toUpperCase();
      if (!/^[A-Z][A-Z0-9_]{1,19}$/.test(codigo)) { return falhar('Identificador do tipo inválido.'); }
      var atual = CtiUtil.porId(config.tiposObjeto, 'codigo', codigo);
      if (dto.versao === null || dto.versao === undefined) {
        if (atual) { return falhar('Já existe um tipo de documento com o identificador ' + codigo + '.'); }
        config.tiposObjeto.push(Object.assign({}, dto, { codigo: codigo, ordem: config.tiposObjeto.length, versao: 0 }));
      } else {
        var erro = conferirVersao(atual, dto.versao, 'Tipo de documento');
        if (erro) { return falhar(erro); }
        Object.assign(atual, dto, { versao: atual.versao + 1 });
      }
      mudou();
      return responder(codigo);
    },
    salvarSetor: function (dto) { return salvarSimples(config.setores, 'idSetor', dto); },
    salvarResponsavel: function (dto) {
      var r = CtiUtil.porId(config.responsaveis, 'codUsu', dto.codUsu);
      Object.assign(r, dto, { versao: (r.versao || 0) + 1 });
      mudou();
      return responder(dto.codUsu);
    },

    listarDemandas: function () { return responder(ativas().map(linhaDemanda)); },
    detalharDemanda: function (id) {
      var d = CtiUtil.porId(ativas(), 'idTarefa', id);
      if (!d) { return falhar('Demanda ' + id + ' não encontrada.'); }
      var r = linhaDemanda(d);
      r.descricao = d.descricao;
      r.itens = copia(d.itens || []);
      r.nomeUsuInc = nome(d.codUsuSol);
      r.nomeUsuAlter = 'ISAAC';
      return responder(r);
    },
    historicoDemanda: function (id) {
      return responder(historico.filter(function (h) { return h.idTarefa === id; })
        .map(function (h) { return Object.assign({ nomeUsu: nome(h.codUsu) }, h); }).reverse());
    },
    salvarDemanda: function (dto) {
      if (!dto.idTarefa) {
        var nova = t(++seq, dto.titulo, dto.coluna, 999, dto);
        nova.idTarefa = seq;
        nova.versao = 0;
        nova.itens = [];
        nova.codUsuSol = dto.codUsuSol || EU;
        nova.codUsuInc = EU;
        demandas.push(nova);
        renumerar(dto.coluna);
        historico.push({ idHist: ++seq, idTarefa: nova.idTarefa, tipoEvento: 'C', codUsu: EU, dhMov: agora(),
          resumo: 'Criou a demanda #' + nova.idTarefa + ': ' + dto.titulo, campos: [] });
        mudou();
        return responder(nova.idTarefa);
      }
      var d = CtiUtil.porId(ativas(), 'idTarefa', dto.idTarefa);
      var erro = conferirVersao(d, dto.versao, 'Demanda ' + dto.idTarefa);
      if (erro) { return falhar(erro); }
      var posse = semPosse(d.idTarefa, 'editar os dados');
      if (posse) { return falhar(posse); }
      // Mesmo formato do log (DemandaService.diferenca): só os campos que mudaram, com valor legível.
      var rotulos = { titulo: 'Título', prioridade: 'Prioridade', dtVenc: 'Prazo', tags: 'Tags' };
      var campos = Object.keys(rotulos).filter(function (k) { return (d[k] || '') !== (dto[k] || ''); }).map(function (k) {
        var leg = function (v) { return k === 'prioridade' ? (CtiApp.PRIORIDADES[v] || v) : (v || '(vazio)'); };
        return { rotulo: rotulos[k], velho: leg(d[k]), novo: leg(dto[k]) };
      });
      if (campos.length) {
        historico.push({ idHist: ++seq, idTarefa: d.idTarefa, tipoEvento: 'A', codUsu: EU, dhMov: agora(),
          resumo: 'Alterou a demanda #' + d.idTarefa, campos: campos });
      }
      Object.keys(dto).forEach(function (k) { if (k !== 'itens') { d[k] = dto[k]; } });
      d.versao++;
      d.dhAlter = agora();
      mudou();
      return responder(d.idTarefa);
    },
    moverDemanda: function (mov) {
      var d = CtiUtil.porId(ativas(), 'idTarefa', mov.idTarefa);
      var erro = conferirVersao(d, mov.versao, 'Demanda ' + mov.idTarefa);
      if (erro) { return falhar(erro); }
      var destino = coluna(mov.colunaDestino);
      if (!destino || !destino.ativo) { return falhar('Coluna do Kanban inexistente: ' + mov.colunaDestino); }
      var origem = d.coluna;
      // Mesma regra do DemandaService: finalizada só sai pelo Reabrir.
      if (coluna(origem).conclui && !destino.conclui) {
        return falhar('A demanda #' + d.idTarefa + ' não pode sair da coluna de finalizadas arrastando.\nMOTIVO: Demanda finalizada só volta para uma coluna em aberto pela reabertura.\nSOLUCAO: Abra a demanda e use o botão Reabrir.');
      }
      var lista = ativas().filter(function (x) { return x.coluna === mov.colunaDestino && x !== d; })
        .sort(function (a, b) { return a.ordem - b.ordem; });
      var i = lista.length;
      lista.forEach(function (x, k) { if (x.idTarefa === mov.idAntesDe) { i = k; } });
      lista.splice(i, 0, d);
      d.coluna = mov.colunaDestino;
      lista.forEach(function (x, k) { x.ordem = k; });
      renumerar(origem);
      d.versao++;
      // Mesma regra do DemandaService: a data nasce ao entrar vindo de coluna aberta.
      if (destino.conclui && !coluna(origem).conclui) { d.dhConclusao = agora(); }
      if (origem !== d.coluna) {
        historico.push({ idHist: ++seq, idTarefa: d.idTarefa, tipoEvento: 'M', codUsu: EU, dhMov: agora(),
          resumo: 'Moveu #' + d.idTarefa + ' de ' + coluna(origem).nome + ' para ' + destino.nome,
          campos: [{ rotulo: 'Coluna', velho: coluna(origem).nome, novo: destino.nome }] });
      }
      mudou();
      return responder(d.idTarefa);
    },
    reabrirDemanda: function (r) {
      var d = CtiUtil.porId(ativas(), 'idTarefa', r.idTarefa);
      var erro = conferirVersao(d, r.versao, 'Demanda ' + r.idTarefa);
      if (erro) { return falhar(erro); }
      var destino = coluna(r.colunaDestino);
      if (!coluna(d.coluna).conclui) { return falhar('A demanda #' + d.idTarefa + ' não está finalizada.'); }
      if (!destino || !destino.ativo || destino.conclui) { return falhar('Escolha uma coluna ativa que não conclui a demanda.'); }
      var origem = d.coluna;
      d.coluna = destino.codigo;
      d.ordem = 999;
      d.dhConclusao = null;
      renumerar(d.coluna);
      renumerar(origem);
      d.versao++;
      historico.push({ idHist: ++seq, idTarefa: d.idTarefa, tipoEvento: 'R', codUsu: EU, dhMov: agora(),
        resumo: 'Reabriu #' + d.idTarefa + ' em ' + destino.nome,
        campos: [{ rotulo: 'Coluna', velho: coluna(origem).nome, novo: destino.nome }]
          .concat(r.observacao ? [{ rotulo: 'Motivo', velho: '(vazio)', novo: r.observacao }] : []) });
      mudou();
      return responder(d.idTarefa);
    },
    excluirDemanda: function (e) {
      var d = CtiUtil.porId(ativas(), 'idTarefa', e.id);
      var erro = conferirVersao(d, e.versao, 'Demanda ' + e.id);
      if (erro) { return falhar(erro); }
      d.ativo = false;
      renumerar(d.coluna);
      mudou();
      return responder(e.id);
    },

    salvarItem: function (item) {
      var d = CtiUtil.porId(ativas(), 'idTarefa', item.idTarefa);
      var posse = semPosse(item.idTarefa, 'alterar o checklist');
      if (posse) { return falhar(posse); }
      if (!item.idItem) {
        var novo = { idItem: ++seq, idTarefa: item.idTarefa, descricao: item.descricao, feito: !!item.feito, ordem: d.itens.length, versao: 0 };
        d.itens.push(novo);
        mudou();
        return responder(novo);
      }
      var atual = null;
      demandas.forEach(function (x) { (x.itens || []).forEach(function (i) { if (i.idItem === item.idItem) { atual = i; } }); });
      var erro = conferirVersao(atual, item.versao, 'Item do checklist');
      if (erro) { return falhar(erro); }
      atual.descricao = item.descricao;
      atual.feito = !!item.feito;
      atual.versao++;
      mudou();
      return responder(atual);
    },
    excluirItem: function (e) {
      var dono = demandas.filter(function (x) { return (x.itens || []).some(function (i) { return i.idItem === e.id; }); })[0];
      var posse = semPosse(dono && dono.idTarefa, 'alterar o checklist');
      if (posse) { return falhar(posse); }
      demandas.forEach(function (x) { x.itens = (x.itens || []).filter(function (i) { return i.idItem !== e.id; }); });
      mudou();
      return responder(e.id);
    },
    listarComentarios: function (id) {
      return responder(comentarios.filter(function (m) { return m.idTarefa === id; }).map(function (m) {
        return Object.assign({ nomeUsu: nome(m.codUsu), meu: m.codUsu === EU }, m);
      }));
    },
    comentar: function (c) {
      comentarios.push({ idComentario: ++seq, idTarefa: c.idTarefa, codUsu: EU, texto: c.texto, dhCriacao: agora() });
      mudou();
      return responder(seq);
    },
    excluirComentario: function (id) {
      comentarios = comentarios.filter(function (m) { return m.idComentario !== id; });
      mudou();
      return responder(id);
    },

    /**
     * Busca por conteúdo: título, descrição, tags, comentários e checklist da
     * demanda; título, texto, tags, anexos e repositório do documento. Cada
     * registro vem uma vez, com o primeiro lugar onde o termo apareceu e um
     * trecho em volta dele (texto puro: a tela escapa e destaca).
     */
    buscarTexto: function (termo) {
      var alvo = CtiUtil.normal(termo).trim();
      if (alvo.length < 2) { return falhar('Informe ao menos 2 caracteres para buscar.'); }
      var achar = function (lugares) {
        for (var i = 0; i < lugares.length; i++) {
          var texto = String(lugares[i][1] || '').replace(/[#*`>|]+/g, ' ').replace(/\s+/g, ' ').trim();
          var pos = CtiUtil.normal(texto).indexOf(alvo);
          if (pos >= 0) {
            var ini = Math.max(0, pos - 50);
            var fim = Math.min(texto.length, pos + alvo.length + 70);
            return { onde: lugares[i][0], trecho: (ini > 0 ? '…' : '') + texto.slice(ini, fim) + (fim < texto.length ? '…' : '') };
          }
        }
        return null;
      };
      var achados = [];
      ativas().forEach(function (d) {
        var r = achar([['titulo', d.titulo], ['descricao', d.descricao], ['tags', d.tags],
          ['comentario', comentarios.filter(function (m) { return m.idTarefa === d.idTarefa; }).map(function (m) { return m.texto; }).join(' · ')],
          ['checklist', (d.itens || []).map(function (i) { return i.descricao; }).join(' · ')]]);
        if (r) { achados.push({ tipo: 'T', id: d.idTarefa, titulo: d.titulo, coluna: d.coluna, onde: r.onde, trecho: r.trecho }); }
      });
      documentos.filter(function (d) { return d.ativo !== false; }).forEach(function (d) {
        var r = achar([['titulo', d.titulo], ['conteudo', d.conteudo], ['tags', d.tags],
          ['anexo', anexosDo(d.idDocumento).map(function (a) { return a.nomeArquivo; }).join(' · ')],
          ['repositorio', [d.repositorio, d.caminho, d.urlDoc].filter(Boolean).join(' · ')]]);
        if (r) { achados.push({ tipo: 'D', id: d.idDocumento, titulo: d.titulo, tipoObj: d.tipoObj, onde: r.onde, trecho: r.trecho }); }
      });
      return responder({ itens: achados.slice(0, 100) }).then(function (c) { return c.itens; });
    },

    listarDocumentos: function () {
      return responder(documentos.filter(function (d) { return d.ativo !== false; }).map(function (d) {
        var r = copia(d);
        delete r.conteudo;
        r.qtdAnexos = anexosDo(d.idDocumento).length;
        r.tamAnexos = anexosDo(d.idDocumento).reduce(function (t, a) { return t + a.tamArquivo; }, 0);
        var dem = CtiUtil.porId(demandas, 'idTarefa', d.idTarefa);
        r.tituloTarefa = dem ? dem.titulo : null;
        r.nomeResp = nome(d.codUsuResp);
        return r;
      }));
    },
    documentosDaDemanda: function (id) {
      return this.listarDocumentos().then(function (l) { return l.filter(function (d) { return d.idTarefa === id; }); });
    },
    detalharDocumento: function (id) {
      var d = CtiUtil.porId(documentos, 'idDocumento', id);
      if (!d || d.ativo === false) { return falhar('Documento ' + id + ' não encontrado.'); }
      var dem = CtiUtil.porId(demandas, 'idTarefa', d.idTarefa);
      return responder(Object.assign({ tituloTarefa: dem ? dem.titulo : null, nomeResp: nome(d.codUsuResp),
        nomeUsuInc: 'ISAAC', nomeUsuAlter: 'ISAAC', anexos: copia(anexosDo(d.idDocumento)) }, d));
    },
    baixarAnexo: function (id) {
      var a = CtiUtil.porId(anexos, 'idAnexo', id);
      if (!a || a.ativo === false) { return falhar('Anexo ' + id + ' não encontrado.'); }
      return responder({ idAnexo: id, nomeArquivo: a.nomeArquivo, tipoArquivo: a.tipoArquivo, arquivoB64: btoa('exemplo') });
    },
    salvarDocumento: function (dto) {
      var dados = Object.assign({}, dto);
      var novos = dados.anexosNovos || [];
      var removidos = dados.anexosRemovidos || [];
      delete dados.anexosNovos;
      delete dados.anexosRemovidos;
      var id = dto.idDocumento;
      var anterior = id ? CtiUtil.porId(documentos, 'idDocumento', id) : null;
      var posse = semPosse(anterior && anterior.idTarefa, 'alterar os documentos') || semPosse(dto.idTarefa, 'alterar os documentos');
      if (posse) { return falhar(posse); }
      var restantes = (id ? anexosDo(id).length : 0) - removidos.length + novos.length;
      if (!dto.conteudo && !dto.urlDoc && !dto.repositorio && restantes <= 0) {
        return falhar('Escreva a descrição, anexe um arquivo ou informe um link.');
      }
      dados.tipo = dto.conteudo ? 'T' : (restantes > 0 ? 'A' : (dto.repositorio ? 'R' : 'L'));
      if (!id) {
        id = ++seq;
        documentos.unshift(Object.assign(dados, { idDocumento: id, versao: 0, dhCriacao: agora(), dhAlter: agora(),
          status: dados.status || 'O' }));
      } else {
        var d = CtiUtil.porId(documentos, 'idDocumento', id);
        var erro = conferirVersao(d, dto.versao, 'Documento ' + id);
        if (erro) { return falhar(erro); }
        Object.assign(d, dados, { versao: d.versao + 1, dhAlter: agora() });
      }
      removidos.forEach(function (idAnexo) { CtiUtil.porId(anexos, 'idAnexo', idAnexo).ativo = false; });
      novos.forEach(function (a) {
        anexos.push({ idAnexo: ++seq, idDocumento: id, nomeArquivo: a.nomeArquivo, tipoArquivo: a.tipoArquivo,
          tamArquivo: Math.round(a.arquivoB64.length * 3 / 4) });
      });
      mudou();
      return responder(id);
    },
    excluirDocumento: function (e) {
      var d = CtiUtil.porId(documentos, 'idDocumento', e.id);
      var erro = conferirVersao(d, e.versao, 'Documento ' + e.id) || semPosse(d && d.idTarefa, 'alterar os documentos');
      if (erro) { return falhar(erro); }
      d.ativo = false;
      mudou();
      return responder(e.id);
    },

    resolverDesligados: function (lote) {
      var itens = (lote && lote.itens) || [];
      if (!itens.length) { return falhar('Nenhuma conta informada.'); }
      // Tudo ou nada, como no servidor: confere tudo antes de gravar.
      for (var i = 0; i < itens.length; i++) {
        var it = itens[i];
        var a = CtiUtil.porId(acessos, 'idAcesso', it.idAcesso);
        if (!a || a.excluido) { return falhar('Acesso ' + it.idAcesso + ' não encontrado (pode ter sido excluído).'); }
        if ((a.versao || 0) !== it.versao) { return falhar('[CONFLITO] Acesso ' + (a.login || a.descricao) + ': outro usuário gravou uma alteração depois que você abriu o registro.'); }
        if (it.acao === 'GENERICA' && a.tipo === 'S') { return falhar('Starlink não vira conta genérica.'); }
        if (it.acao === 'GENERICA' && a.tipo !== 'O' && !it.nomeConta) { return falhar('Nome da conta é obrigatório.'); }
        if (it.acao === 'TROCAR') {
          var f = funcionario(it.codEmp, it.codFunc);
          if (!f) { return falhar('Funcionário ' + it.codFunc + ' da empresa ' + it.codEmp + ' não encontrado na folha.'); }
          if (f.situacao === '0' || f.situacao === '8') { return falhar('O funcionário ' + f.nomeFunc + ' está ' + (f.situacao === '0' ? 'demitido' : 'transferido') + ' na folha.'); }
        }
        if (['DESATIVAR', 'EXCLUIR', 'GENERICA', 'TROCAR'].indexOf(it.acao) < 0) { return falhar('Ação inválida: ' + it.acao); }
      }
      itens.forEach(function (it) {
        var a = CtiUtil.porId(acessos, 'idAcesso', it.idAcesso);
        a.versao = (a.versao || 0) + 1;
        if (it.acao === 'DESATIVAR') { a.ativo = false; }
        if (it.acao === 'EXCLUIR') { a.excluido = true; }
        if (it.acao === 'GENERICA') { a.generica = true; a.codEmp = null; a.codFunc = null; a.unidade = null; if (it.nomeConta) { a.descricao = it.nomeConta; } }
        if (it.acao === 'TROCAR') { a.codEmp = it.codEmp; a.codFunc = it.codFunc; a.generica = false; a.unidade = null; }
        a.dhAlter = agora(); a.codUsuAlter = EU;
      });
      mudou();
      return responder({ qtd: itens.length, erros: [] });
    },
    alterarUsuarioOm: function (alt) {
      var x = CtiUtil.porId(usuariosOm, 'codUsu', alt.codUsu);
      var f = x ? funcionario(x.codEmp, x.codFunc) : null;
      if (!x || !f || (f.situacao !== '0' && f.situacao !== '8')) { return falhar('O usuário ' + alt.codUsu + ' não está ligado a funcionário desligado.'); }
      if (alt.codUsu === EU) { return falhar('Você não pode desativar o seu próprio usuário.'); }
      if (!!alt.ativo === !x.dtLimAcesso) { return falhar('[CONFLITO] Usuário ' + x.nomeUsu + ' do Om: outro usuário gravou uma alteração.'); }
      x.dtLimAcesso = alt.ativo ? null : dia(0);
      return responder({ ok: true });
    },
    listarDesligados: function () {
      if (/[?&]semcofre=1\b/.test(window.location.search)) { return falhar('Sem acesso ao cofre de acessos.'); }
      return responder(desligadosMock());
    },

    carregarCofre: function () {
      var lista = acessos.filter(function (a) { return !a.excluido; }).map(linhaAcesso);
      var sup = !/[?&]comum=1\b/.test(window.location.search);
      var grupo = CtiUtil.porId(config.grupos, 'codGrupo', cofre.grupoSenha);
      return responder({
        acessos: lista,
        dominios: dominios.map(function (d) {
          return Object.assign({}, d, { qtdAcessos: lista.filter(function (a) {
            return a.tipo === 'E' && a.login && a.login.slice(-(d.dominio.length + 1)) === '@' + d.dominio;
          }).length });
        }),
        equipamentos: equipamentos.map(function (e) {
          return Object.assign({}, e, { qtdAcessos: lista.filter(function (a) { return a.ativo && a.equipamento === e.nome; }).length });
        }),
        tiposAcesso: tiposAcesso.map(function (t) {
          return Object.assign({}, t, { qtdAcessos: lista.filter(function (a) { return a.ativo && a.codTipo === t.codigo; }).length });
        }),
        grupoSenha: cofre.grupoSenha,
        nomeGrupoSenha: grupo ? grupo.nomeGrupo : null,
        versaoGrupoSenha: cofre.versaoGrupoSenha,
        grupos: sup ? config.grupos : null,
        hostGatorAtivo: hg.ativo && hg.tokenConfigurado,
        destinoStarlink: hg.destStarlink
      });
    },
    // jaNaHostGator: vínculo da conferência (AcessoService.vincularDaHostGator), sem senha e sem chamar a HostGator.
    salvarAcesso: function (dto, jaNaHostGator) {
      var tipoConta = CtiUtil.porId(tiposAcesso, 'codigo', dto.codTipo);
      if (!tipoConta) { return falhar('Tipo de conta é obrigatório.'); }
      var anterior = dto.idAcesso ? CtiUtil.porId(acessos, 'idAcesso', dto.idAcesso) : null;
      if (!tipoConta.ativo && !(anterior && anterior.codTipo === tipoConta.codigo)) {
        return falhar('O tipo de conta ' + tipoConta.nome + ' está desativado.\nSOLUCAO: Escolha outro tipo ou peça ao SUP para reativá-lo.');
      }
      dto.tipo = tipoConta.modelo;
      var login = (dto.login || '').trim();
      if (dto.tipo === 'E' || (dto.tipo === 'S' && login)) { login = login.toLowerCase(); }
      if ((dto.tipo === 'E' || dto.tipo === 'T') && !login) { return falhar((dto.tipo === 'E' ? 'E-mail' : 'Usuário') + ' é obrigatório.'); }
      if (dto.tipo === 'O' && !(dto.descricao || '').trim()) { return falhar('Serviço é obrigatório.'); }
      if (dto.generica && (dto.tipo === 'E' || dto.tipo === 'T') && !(dto.descricao || '').trim()) { return falhar('Nome da conta é obrigatório.'); }
      if (dto.generica && dto.codFunc) { return falhar('Conta genérica não é ligada a funcionário: desmarque "conta genérica" ou retire o funcionário.'); }
      var atual = dto.idAcesso ? CtiUtil.porId(acessos, 'idAcesso', dto.idAcesso) : null;
      if (dto.idAcesso) {
        var erro = conferirVersao(atual && !atual.excluido ? atual : null, dto.versao, 'Acesso ' + dto.idAcesso);
        if (erro) { return falhar(erro); }
      }
      if (dto.tipo === 'E' && (!atual || atual.login !== login)) {
        var dom = login.split('@')[1];
        var d = CtiUtil.porId(dominios, 'dominio', dom);
        if (!d || !d.ativo) {
          return falhar('O domínio ' + dom + ' não está cadastrado no cofre.\nMOTIVO: Os e-mails do cofre só aceitam domínios ativos em Configurações > Cofre.\nSOLUCAO: Peça ao SUP para cadastrar o domínio ou confira o endereço digitado.');
        }
      }
      var repetido = acessos.some(function (a) { return !a.excluido && a.tipo === dto.tipo && a.login && a.login.toLowerCase() === login.toLowerCase() && a.idAcesso !== dto.idAcesso; });
      if (login && repetido) { return falhar('Já existe um acesso deste tipo com o login ' + login + '.'); }
      if (dto.codFunc && (!atual || atual.codFunc !== dto.codFunc || atual.codEmp !== dto.codEmp)) {
        var f = funcionario(dto.codEmp, dto.codFunc);
        if (!f) { return falhar('Funcionário ' + dto.codFunc + ' da empresa ' + dto.codEmp + ' não encontrado na folha.'); }
        if (f.situacao === '0' || f.situacao === '8') { return falhar('O funcionário ' + f.nomeFunc + ' está ' + (f.situacao === '0' ? 'demitido' : 'transferido') + ' na folha.'); }
      }
      var equip = (dto.equipamento || '').trim().toUpperCase();
      if (dto.tipo === 'E' && equip && (!atual || atual.equipamento !== equip)) {
        var eq = CtiUtil.porId(equipamentos, 'nome', equip);
        if (!eq || !eq.ativo) { return falhar('O equipamento ' + equip + ' não está no cadastro do cofre.\nSOLUCAO: Escolha um tipo da lista ou peça ao SUP para cadastrar o novo tipo.'); }
      }
      dto.equipamento = dto.tipo === 'E' ? equip : (dto.tipo === 'S' ? dto.equipamento : null);
      if (dto.tipo === 'S') {
        if (dto.diaAtivacao && (dto.diaAtivacao < 1 || dto.diaAtivacao > 31)) { return falhar('Dia de ativação deve ficar entre 1 e 31.'); }
        if (dto.particular && !(dto.proprietario || '').trim()) { return falhar('Proprietário é obrigatório.'); }
        var fDep = dto.codFunc ? funcionario(dto.codEmp, dto.codFunc) : null;
        if (!dto.particular && !dto.codDep && !(fDep && fDep.codDep)) {
          return falhar('Informe o departamento da Starlink.\nMOTIVO: Starlink da empresa fica num departamento da folha.\nSOLUCAO: Escolha o departamento, aloque um funcionário ou marque como particular do proprietário.');
        }
        if (dto.particular) { dto.codDep = null; } else { dto.proprietario = null; }
        if (dto.codFunc) { dto.responsavel = null; }
      }
      var destinos = (dto.destinos || []).map(function (x) { return String(x).trim().toLowerCase(); }).filter(Boolean);
      var natNova = hgNatureza({ tipo: dto.tipo, login: login, equipamento: dto.equipamento });
      if (dto.ferias && natNova !== 'CAIXA') { return falhar('Férias vale só para caixa de e-mail.'); }
      var usaDest = natNova === 'REDIR' || (natNova === 'CAIXA' && dto.ferias);
      if (usaDest && !destinos.length) { return falhar('Informe para onde o e-mail redireciona.\nSOLUCAO: Adicione pelo menos um destino em "Redireciona para".'); }
      if (destinos.some(function (x, i) { return destinos.indexOf(x) !== i; })) { return falhar('Destino repetido.'); }
      var naHg = !jaNaHostGator && hgGerencia(login) && natNova;
      if (atual && hgGerencia(atual.login) && hgNatureza(atual) && atual.login !== login) {
        return falhar('O endereço ' + atual.login + ' não pode ser trocado.\nMOTIVO: A conta já existe na HostGator e o cPanel não renomeia e-mail.\nSOLUCAO: Exclua esta conta e cadastre o endereço novo.');
      }
      if (naHg && natNova === 'CAIXA' && !atual && !dto.senha) { return falhar('Informe a senha da caixa.\nMOTIVO: A caixa ' + login + ' vai ser criada na HostGator, que exige senha.'); }
      if (naHg && login.indexOf('erro') >= 0) {
        hgRegistrar(atual ? 'SENHA' : (natNova === 'CAIXA' ? 'CRIAR_CAIXA' : 'CRIAR_REDIR'), login, null, false, 'A conta "' + login + '" já existe.');
        return demorar(falhar(hgErro(atual ? 'atualizar ' + login : 'criar ' + login, 'A conta "' + login + '" já existe.')));
      }
      var campos = ['tipo', 'codTipo', 'codEmp', 'codFunc', 'descricao', 'unidade', 'equipamento', 'pasta', 'horario', 'url', 'responsavel',
        'codDep', 'particular', 'proprietario', 'diaAtivacao', 'generica', 'obs', 'ativo'];
      var alvo = atual || { idAcesso: ++seq, versao: -1, excluido: false };
      campos.forEach(function (c) { alvo[c] = dto[c] === '' ? null : dto[c]; });
      alvo.login = login || null;
      alvo.ativo = dto.ativo !== false;
      alvo.generica = !!dto.generica;
      if (dto.senha) { alvo.senha = dto.senha; alvo.dhSenha = agora(); }
      var destinosAntes = (atual && atual.destinos) || [];
      alvo.ferias = !!dto.ferias;
      alvo.destinos = usaDest ? destinos : [];
      alvo.versao++;
      alvo.dhAlter = agora();
      alvo.codUsuAlter = EU;
      if (!atual) { acessos.push(alvo); }
      mudou();
      if (!naHg) { return responder(alvo.idAcesso); }
      if (!atual && natNova === 'CAIXA') { hgRegistrar('CRIAR_CAIXA', login); }
      if (atual && dto.senha && natNova === 'CAIXA') { hgRegistrar('SENHA', login); }
      alvo.destinos.filter(function (x) { return destinosAntes.indexOf(x) < 0; }).forEach(function (x) { hgRegistrar('CRIAR_REDIR', login, x); });
      destinosAntes.filter(function (x) { return alvo.destinos.indexOf(x) < 0; }).forEach(function (x) { hgRegistrar('EXCLUIR_REDIR', login, x); });
      return demorar(responder(alvo.idAcesso));
    },
    marcarAcesso: function (m) {
      var a = CtiUtil.porId(acessos, 'idAcesso', m.idAcesso);
      if (!a || a.excluido) { return falhar('Acesso ' + m.idAcesso + ' não encontrado (pode ter sido excluído).'); }
      var cores = ['AMARELO', 'VERDE', 'AZUL', 'VERMELHO', 'ROXO', 'LARANJA', 'CINZA'];
      if (m.cor && cores.indexOf(m.cor) < 0) { return falhar('Cor da marca inválido(a): ' + m.cor); }
      a.marca = m.cor || null;
      a.codUsuMarca = EU;
      mudou();
      return responder(m.idAcesso);
    },
    excluirAcesso: function (e) {
      var a = CtiUtil.porId(acessos, 'idAcesso', e.id);
      var erro = conferirVersao(a && !a.excluido ? a : null, e.versao, 'Acesso ' + e.id);
      if (erro) { return falhar(erro); }
      var orfaos = hgTirarDestinos(a, [e.id]);
      if (orfaos) { return falhar(orfaos); }
      if (hgGerencia(a.login) && hgNatureza(a) && a.login.indexOf('erro') >= 0) {
        hgRegistrar('EXCLUIR_CAIXA', a.login, null, false, 'Tempo esgotado: a HostGator não respondeu em 20 segundos.');
        return demorar(falhar(hgErro('excluir ' + a.login, 'A HostGator não respondeu em 20 segundos.')));
      }
      a.excluido = true;
      a.versao++;
      mudou();
      if (hgGerencia(a.login) && hgNatureza(a)) {
        (a.destinos || []).forEach(function (x) { hgRegistrar('EXCLUIR_REDIR', a.login, x); });
        if (hgNatureza(a) === 'CAIXA') { hgRegistrar('EXCLUIR_CAIXA', a.login); }
        return demorar(responder(e.id));
      }
      return responder(e.id);
    },
    excluirAcessos: function (lote) {
      var itens = (lote && lote.itens) || [];
      if (!itens.length) { return falhar('Nenhum acesso selecionado.'); }
      // Tudo ou nada, como a transação do servidor: confere todos antes de excluir.
      for (var i = 0; i < itens.length; i++) {
        var x = CtiUtil.porId(acessos, 'idAcesso', itens[i].id);
        var erro = conferirVersao(x && !x.excluido ? x : null, itens[i].versao, 'Acesso ' + itens[i].id);
        if (erro) { return falhar(erro); }
      }
      // Cada conta isolada, como no servidor: a que a HostGator recusa ("erro" no e-mail) fica e entra no resumo.
      var r = { qtd: 0, erros: [] };
      var temHg = false;
      itens.forEach(function (it) {
        var a = CtiUtil.porId(acessos, 'idAcesso', it.id);
        var naHg = hgGerencia(a.login) && hgNatureza(a);
        temHg = temHg || naHg;
        if (naHg && a.login.indexOf('erro') >= 0) {
          hgRegistrar('EXCLUIR_CAIXA', a.login, null, false, 'Tempo esgotado: a HostGator não respondeu em 20 segundos.');
          r.erros.push({ idAcesso: a.idAcesso, login: a.login, mensagem: hgErro('excluir a caixa ' + a.login, 'A HostGator não respondeu em 20 segundos.') });
          return;
        }
        var orfaos = hgTirarDestinos(a, itens.map(function (x) { return x.id; }));
        if (orfaos) { r.erros.push({ idAcesso: a.idAcesso, login: a.login, mensagem: orfaos }); return; }
        if (naHg) { hgRegistrar(hgNatureza(a) === 'CAIXA' ? 'EXCLUIR_CAIXA' : 'EXCLUIR_REDIR', a.login); }
        a.excluido = true;
        a.versao++;
        r.qtd++;
      });
      mudou();
      return temHg ? demorar(responder(r)) : responder(r);
    },
    revelarSenha: function (r) {
      var a = CtiUtil.porId(acessos, 'idAcesso', r.idAcesso);
      if (!a || a.excluido) { return falhar('Acesso ' + r.idAcesso + ' não encontrado (pode ter sido excluído).'); }
      if (!a.senha) { return falhar('Este acesso não tem senha cadastrada.\nSOLUCAO: Edite o acesso e informe a senha (ou use o gerador).'); }
      return responder(a.senha);
    },
    gerarSenha: function (g) {
      var n = g && g.tamanho ? g.tamanho : 14;
      if (n < 8 || n > 64) { return falhar('Tamanho da senha deve ficar entre 8 e 64.'); }
      return responder(gerarSenhaMock(n, !(g && g.simbolos === false)));
    },
    buscarDepartamentos: function (termo) {
      var t = (termo || '').trim().toUpperCase();
      if (t.length < 2) { return falhar('Digite pelo menos 2 letras do departamento.'); }
      return responder(departamentos.filter(function (d) { return d.descrDep.indexOf(t) >= 0 || String(d.codDep) === t; }));
    },
    buscarFuncionarios: function (termo) {
      var t = (termo || '').trim().toUpperCase();
      if (t.length < 2) { return falhar('Digite pelo menos 2 letras do nome ou o código do funcionário.'); }
      return responder(funcionarios.filter(function (f) {
        return f.situacao !== '0' && f.situacao !== '8' && (f.nomeFunc.indexOf(t) >= 0 || String(f.codFunc) === t);
      }).map(function (f) { return Object.assign({}, f, { departamento: nomeDep(f.codDep) }); }));
    },
    salvarDominio: function (dto) {
      var nomeDom = (dto.dominio || '').trim().toLowerCase().replace(/^@/, '');
      if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(nomeDom)) {
        return falhar('Domínio inválido: ' + dto.dominio + '. Informe só a parte depois do @, como empresa.com.br.');
      }
      var atual = CtiUtil.porId(dominios, 'dominio', nomeDom);
      if (dto.versao === null || dto.versao === undefined) {
        if (atual) { return falhar('O domínio ' + nomeDom + ' já está cadastrado; se estiver inativo, reative-o.'); }
        dominios.push({ dominio: nomeDom, ativo: true, versao: 0 });
      } else {
        var novoDom = (dto.novoDominio || '').trim().toLowerCase().replace(/^@/, '') || nomeDom;
        if (novoDom !== nomeDom) {
          if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(novoDom)) {
            return falhar('Domínio inválido: ' + dto.novoDominio + '. Informe só a parte depois do @, como empresa.com.br.');
          }
          if (CtiUtil.porId(dominios, 'dominio', novoDom)) { return falhar('O domínio ' + novoDom + ' já está cadastrado.'); }
        }
        var erro = conferirVersao(atual, dto.versao, 'Domínio ' + nomeDom);
        if (erro) { return falhar(erro); }
        atual.ativo = dto.ativo !== false;
        if (dto.hostgator !== null && dto.hostgator !== undefined) { atual.hostgator = !!dto.hostgator; }
        atual.versao++;
        if (novoDom !== nomeDom) {
          // Mesmo efeito do servidor: o login dos e-mails troca de domínio e a versão sobe.
          acessos.forEach(function (a) {
            if (a.tipo === 'E' && a.login && a.login.slice(a.login.indexOf('@') + 1) === nomeDom) {
              a.login = a.login.slice(0, a.login.indexOf('@') + 1) + novoDom;
              a.versao++;
            }
          });
          atual.dominio = novoDom;
        }
        nomeDom = novoDom;
      }
      mudou();
      return responder(nomeDom);
    },
    salvarTipoAcesso: function (dto) {
      var nomeTipo = (dto.nome || '').trim().replace(/\s+/g, ' ');
      if (!nomeTipo) { return falhar('Nome do tipo de conta é obrigatório.'); }
      var repetido = tiposAcesso.some(function (t) { return t.codigo !== dto.codigo && t.nome.toLowerCase() === nomeTipo.toLowerCase(); });
      if (repetido) { return falhar('Já existe um tipo de conta chamado "' + nomeTipo + '".'); }
      if (dto.versao === null || dto.versao === undefined) {
        if (['E', 'T', 'S', 'O'].indexOf(dto.modelo) < 0) { return falhar('Modelo do tipo de conta inválido(a): ' + dto.modelo); }
        var base = CtiUtil.normal(nomeTipo).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20) || 'TIPO';
        var codigo = base;
        for (var i = 2; CtiUtil.porId(tiposAcesso, 'codigo', codigo); i++) { codigo = base.slice(0, 20 - String(i).length - 1) + '_' + i; }
        tiposAcesso.push({ codigo: codigo, nome: nomeTipo, modelo: dto.modelo, icone: dto.icone || null, ordem: tiposAcesso.length, ativo: true, versao: 0 });
        mudou();
        return responder(codigo);
      }
      var atual = CtiUtil.porId(tiposAcesso, 'codigo', dto.codigo);
      var erro = conferirVersao(atual, dto.versao, 'Tipo de conta ' + dto.codigo);
      if (erro) { return falhar(erro); }
      atual.nome = nomeTipo;
      atual.icone = dto.icone || null;
      atual.ativo = dto.ativo !== false;
      atual.versao++;
      mudou();
      return responder(atual.codigo);
    },
    salvarTipoEquipamento: function (dto) {
      var nomeEq = (dto.nome || '').trim().replace(/\s+/g, ' ').toUpperCase();
      if (!nomeEq) { return falhar('Tipo de equipamento é obrigatório.'); }
      if (['E', 'P', 'C', 'R', 'O'].indexOf(String(dto.categoria || '').toUpperCase()) < 0) { return falhar('Categoria do equipamento inválido(a): ' + dto.categoria); }
      var categoria = String(dto.categoria).toUpperCase();
      var atualEq = CtiUtil.porId(equipamentos, 'nome', nomeEq);
      if (dto.versao === null || dto.versao === undefined) {
        if (atualEq) { return falhar('O tipo de equipamento ' + nomeEq + ' já está cadastrado; se estiver inativo, reative-o.'); }
        equipamentos.push({ nome: nomeEq, icone: dto.icone || null, cor: dto.cor || null, categoria: categoria, ativo: true, versao: 0 });
      } else {
        var novoEq = (dto.novoNome || '').trim().replace(/\s+/g, ' ').toUpperCase() || nomeEq;
        if (novoEq !== nomeEq && CtiUtil.porId(equipamentos, 'nome', novoEq)) { return falhar('O tipo de equipamento ' + novoEq + ' já está cadastrado.'); }
        var erro = conferirVersao(atualEq, dto.versao, 'Tipo de equipamento ' + nomeEq);
        if (erro) { return falhar(erro); }
        atualEq.ativo = dto.ativo !== false;
        atualEq.icone = dto.icone || null;
        atualEq.cor = dto.cor || null;
        atualEq.categoria = categoria;
        atualEq.versao++;
        if (novoEq !== nomeEq) {
          acessos.forEach(function (a) { if (a.tipo === 'E' && a.equipamento === nomeEq) { a.equipamento = novoEq; a.versao++; } });
          atualEq.nome = novoEq;
        }
        nomeEq = novoEq;
      }
      mudou();
      return responder(nomeEq);
    },
    carregarHostGator: function (f) {
      var sup = !/[?&]comum=1\b/.test(window.location.search);
      var desde = Date.now() - 86400000;
      return responder({
        config: sup ? Object.assign({}, hg) : null,
        ativo: hg.ativo && hg.tokenConfigurado,
        conexaoOk: hg.resultadoTeste ? hg.resultadoTeste.indexOf('OK') === 0 : null,
        dhTeste: hg.dhTeste, resultadoTeste: hg.resultadoTeste, testeAutomatico: !!hg.testeAuto,
        ultimaChamada: hgLog[0] || null,
        erros24h: hgLog.filter(function (l) { return !l.sucesso && new Date(l.dhEvento).getTime() >= desde; }).length,
        ultimoLog: hgLog.length,
        // Domínios lidos no último teste: "outrodominio" existe na conta e não no cofre.
        dominiosHostGator: ['empresa-demo.com.br', 'outra-demo.com.br', 'holding-demo.com.br', 'locadora-demo.com.br'],
        log: filtrarLogMock(f)
      });
    },
    listarLogHostGator: function (f) { return responder(filtrarLogMock(f)); },
    salvarHostGator: function (c) {
      if (c.ativo && (!c.host || !c.usuario || (!c.token && !hg.tokenConfigurado))) {
        return falhar('Faltam dados para ligar a integração.\nMOTIVO: A integração precisa do servidor, do usuário e do token do cPanel.\nSOLUCAO: Preencha os três ou deixe a integração desligada.');
      }
      if (c.host && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(c.host.toLowerCase())) {
        return falhar('Servidor do cPanel inválido.\nSOLUCAO: Informe só o nome do servidor, como servidor.exemplo.com.br (sem https:// nem porta).');
      }
      if (c.token && !/^[A-Za-z0-9]{20,64}$/.test(c.token)) { return falhar('Token de API inválido.\nSOLUCAO: Copie o token inteiro de Segurança > Gerenciar tokens de API no cPanel.'); }
      if (c.versao !== hg.versao) { return falhar('[CONFLITO] Configuração da HostGator: outro usuário gravou uma alteração.'); }
      ['ativo', 'host', 'porta', 'usuario', 'timeout', 'destStarlink', 'cotaMb', 'boasVindas', 'equipRedir'].forEach(function (k) { hg[k] = c[k]; });
      if (c.token) { hg.tokenConfigurado = true; hg.dhToken = agora(); }
      hg.versao++;
      return responder({ versao: hg.versao });
    },
    testarHostGator: function () {
      hgRegistrar('TESTE');
      hg.dhTeste = agora();
      hg.testeAuto = false;
      hg.resultadoTeste = 'OK: 3 domínio(s) de e-mail na conta, resposta em 412 ms.';
      return demorar(responder({ ok: true, mensagem: hg.resultadoTeste, duracaoMs: 412, dominios: [
        { dominio: 'antigo.com.br', naHostGator: false, noCofre: true, gerenciado: false },
        { dominio: 'empresa-demo.com.br', naHostGator: true, noCofre: true, gerenciado: true },
        { dominio: 'outra-demo.com.br', naHostGator: true, noCofre: false, gerenciado: false },
        { dominio: 'holding-demo.com.br', naHostGator: true, noCofre: true, gerenciado: false },
        { dominio: 'locadora-demo.com.br', naHostGator: true, noCofre: true, gerenciado: true }] }));
    },
    conferirHostGator: function () {
      hgRegistrar('LISTAR');
      var a1 = CtiUtil.porId(acessos, 'idAcesso', 2);
      var a2 = CtiUtil.porId(acessos, 'idAcesso', 11);
      return demorar(responder({
        equipRedir: hg.equipRedir,
        converter: [{ idAcesso: 2, versao: a1.versao, email: a1.login, tipo: 'E', nomeFunc: 'BRENO TAVARES', equipamento: a1.equipamento, ativo: true, caixa: true,
          destinosCofre: [], destinosHostGator: ['compras@empresa-demo.com.br', 'gerencia@empresa-demo.com.br'], mudaEquipamento: true,
          observacao: 'Caixa usada só como redirecionamento: a caixa é apagada na HostGator.' }],
        destinos: [{ idAcesso: 11, versao: a2.versao, email: a2.login, tipo: 'S', nomeFunc: 'GABRIEL SOUTO', equipamento: a2.equipamento, ativo: true, caixa: false,
          destinosCofre: [], destinosHostGator: ['ti@empresa-demo.com.br'], mudaEquipamento: false, observacao: 'Destinos do cofre diferentes dos da HostGator.' }],
        // Sugestões como o servidor monta (SugestaoFuncionario): certa, dúvida, e-mail da folha sem o nome conferir e sem pista.
        soHostGator: [
          { email: 'caior@empresa-demo.com.br', caixa: true, destinosCofre: [], destinosHostGator: [],
            sugeridos: [funcDto(502, 90001)], sugestaoAutomatica: true, motivoSugestao: 'Só um funcionário ativo com esse nome.' },
          { email: 'daniela@empresa-demo.com.br', caixa: true, destinosCofre: [], destinosHostGator: ['eduardo.nunes@empresa-demo.com.br'],
            sugeridos: [funcDto(5, 88777), funcDto(1, 17152)], sugestaoAutomatica: false, motivoSugestao: 'Mais de um funcionário possível: escolha.' },
          { email: 'contato@empresa-demo.com.br', caixa: true, destinosCofre: [], destinosHostGator: [],
            sugeridos: [funcDto(1, 12000)], sugestaoAutomatica: false, motivoSugestao: 'O e-mail está no cadastro da folha, mas o nome não confere: confira.' },
          { email: 'financeiro.antigo@empresa-demo.com.br', caixa: false, destinosCofre: [], destinosHostGator: ['alice.moura@empresa-demo.com.br'],
            sugeridos: [], sugestaoAutomatica: false, motivoSugestao: 'Nenhum funcionário ativo com esse nome.' }],
        soCofre: [{ idAcesso: 1, versao: 0, email: 'alice.moura@empresa-demo.com.br', tipo: 'E', nomeFunc: 'ALICE PEIXOTO MOURA', equipamento: 'NOTEBOOK DA EMPRESA',
          ativo: true, caixa: false, destinosCofre: [], destinosHostGator: [], observacao: 'Não existe na HostGator.' }],
        divergentes: [],
        dominios: []
      }));
    },
    aplicarConferenciaHostGator: function (p) {
      var r = { qtd: 0, erros: [] };
      var vincular = (p.itens || []).filter(function (it) { return it.acao === 'VINCULAR'; });
      // Mesmo caminho do cadastro (sem senha e sem HostGator), um e-mail por vez: a falha de um não para os outros.
      var cadeia = vincular.reduce(function (antes, it) {
        return antes.then(function () {
          var redir = /^financeiro/.test(it.email);
          return CtiMock.salvarAcesso({ codTipo: p.codTipo, login: it.email, codEmp: it.codEmp, codFunc: it.codFunc,
            generica: it.generica, descricao: it.generica ? it.nomeConta : null, ativo: true,
            equipamento: redir ? hg.equipRedir : null, destinos: redir ? ['alice.moura@empresa-demo.com.br'] : [] }, true)
            .then(function () { r.qtd++; }, function (e) { r.erros.push({ idAcesso: null, login: it.email, mensagem: e.message }); });
        });
      }, Promise.resolve());
      (p.itens || []).filter(function (it) { return it.acao !== 'VINCULAR'; }).forEach(function (it) {
        var a = CtiUtil.porId(acessos, 'idAcesso', it.idAcesso);
        if (!a || a.versao !== it.versao) {
          r.erros.push({ idAcesso: it.idAcesso, login: a ? a.login : null, mensagem: '[CONFLITO] Acesso ' + it.idAcesso + ': outro usuário gravou uma alteração.' });
          return;
        }
        if (it.acao === 'CONVERTER') { a.equipamento = hg.equipRedir; a.destinos = ['compras@empresa-demo.com.br', 'gerencia@empresa-demo.com.br']; hgRegistrar('CONVERTER', a.login); }
        else { a.destinos = ['ti@empresa-demo.com.br']; }
        a.versao++;
        r.qtd++;
      });
      mudou();
      return demorar(cadeia.then(function () { return responder(r); }));
    },
    // Importação desativada na tela (carga feita em produção); fica aqui só como referência do contrato antigo.
    importarPlanilhaCofre: function (i) {
      // Mock: relatório fixo com a forma do servidor; não grava nada.
      var abas = Object.keys((i && i.abas) || {});
      var linhas = abas.reduce(function (t, a) { return t + (i.abas[a] || []).length; }, 0);
      var r = { lidas: linhas, importar: Math.max(0, linhas - abas.length * 2), genericas: 3, ligadasFolha: 5, inativas: 1,
        porTipo: { 'E-mails': Math.max(0, linhas - abas.length * 2) }, dominiosNovos: ['locadora-demo.com.br'],
        avisos: [{ titulo: 'Ignorada: já cadastrado (mesmo e-mail/usuário)', ignorada: true, itens: ['E-MAILS!7 ja.existe@empresa-demo.com.br'] },
          { titulo: 'Sem senha na planilha', ignorada: false, itens: ['E-MAILS!9 caixa@empresa-demo.com.br'] }] };
      if (i && i.gravar) { r.gravados = r.importar; mudou(); }
      return responder(r);
    },
    salvarGrupoCofre: function (g) {
      if (Number(g.versao) !== cofre.versaoGrupoSenha) { return falhar('[CONFLITO] Grupo com acesso ao cofre: LUCASM gravou uma alteração depois que você abriu o registro.'); }
      cofre.grupoSenha = g.codGrupo;
      cofre.versaoGrupoSenha++;
      mudou();
      return responder(g.codGrupo);
    },
    trocarChaveCofre: function () {
      var qtd = acessos.filter(function (a) { return a.senha; }).length;
      acessos.forEach(function (a) { if (a.senha) { a.versao++; } });
      mudou();
      return responder({ qtd: qtd }).then(function (c) { return c.qtd; });
    }
  };

  function salvarSimples(lista, chave, dto) {
    if (!dto[chave]) {
      var novo = Object.assign({}, dto, { versao: 0 });
      novo[chave] = ++seq;
      lista.push(novo);
      mudou();
      return responder(seq);
    }
    var atual = CtiUtil.porId(lista, chave, dto[chave]);
    var erro = conferirVersao(atual, dto.versao, 'Registro');
    if (erro) { return falhar(erro); }
    Object.assign(atual, dto, { versao: atual.versao + 1 });
    mudou();
    return responder(dto[chave]);
  }
})();
