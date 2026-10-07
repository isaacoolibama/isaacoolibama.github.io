# isaacoolibama.github.io

Currículo online de **Isaac Oolibama Ramos Lacerda** — Analista de Sistemas (ERP Sankhya), automação, dados e infraestrutura Oracle.

🔗 [isaacoolibama.github.io](https://isaacoolibama.github.io)

## Stack

HTML, CSS e JavaScript puros — sem build step, hospedado no GitHub Pages.

```
.
├── index.html
├── assets/
│   ├── css/style.css
│   ├── js/main.js
│   └── files/Curriculo_Isaac_Oolibama.pdf
└── demos/
    └── gestao-ti/          # demonstração ao vivo do add-on (dados fictícios)
        ├── index.html      # moldura com perfil, dicas e tela cheia
        ├── painel.html     # carrega a tela pelo manifesto painel/demo.json
        └── painel/         # GERADO: não editar à mão
```

## Demonstração do Painel de Gestão de TI

`demos/gestao-ti/painel/` é a tela real do add-on com o mock ligado. Ela é
gerada no repositório `gestao-ti`, que troca nomes, e-mails, domínios e senhas
por dados fictícios e falha se algum termo real sobrar:

```bash
python3 scripts/gerar-demo-publica.py   # rodar dentro de gestao-ti
```

Depois, conferir localmente (`python3 -m http.server`) e publicar o commit.
