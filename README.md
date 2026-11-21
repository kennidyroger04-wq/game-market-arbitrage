# Game Market Arbitrage — OSRS

Painel em português, otimizado para celular, para analisar flips no Grand Exchange de Old School RuneScape.

## Busca direta pelo navegador (SEM GitHub Actions)

- Os cinco endpoints públicos da OSRS Wiki Prices API v2 (mapping, latest, 5m, 1h, 24h) são consultados ao abrir a página e pelo botão **Pesquisar preços agora**.
- Filtros e busca de itens usam informações já carregadas, sem novas requisições.
- Atualizações limitadas a uma consulta por minuto depois de sucesso; aba fechada não faz consultas.
- **Não há agendamento de GitHub Actions** nem servidor próprio. O arquivo de snapshot não é mais necessário.
- Quando a API falha, o painel mostra erro. Dados de demonstração são fictícios e só aparecem se o usuário escolher.

API pública: https://prices.runescape.wiki/api/v2/osrs

## Publicação com GitHub Pages

Em Settings → Pages selecione **Deploy from a branch**, branch **main**, pasta **/(root)**.
O site funciona sem build e sem dependências externas. URL: https://kennidyroger04-wq.github.io/game-market-arbitrage/

O workflow .github/workflows/deploy.yml é opcional, **manual apenas para testes**, e não atualiza nem publica dados. Em repositório público, os runners padrão do GitHub Actions são gratuitos conforme documentação do GitHub, mas não são usados nas pesquisas.

## Funcionalidades

- Ranking de flips via ordens limitadas, não garantia de execução instantânea.
- Filtros F2P, capital, margem, volume (5min e 24h), idade das transações, limites de compra e taxas.
- Simulador, favoritos, CSV e registro manual de trades com armazenamento local.
- Imposto estimado: 2% por unidade, arredondado para baixo e limitado a 5 milhões GP; itens isentos podem ter margem real superior.
- Quantidade máxima heurística: mínimo entre capital, limite de compra por 4h e 1% do volume histórico de 24h.

## Rodar testes localmente

    node --test tests/*.test.mjs
    python -m unittest discover -s tests -p 'test_*.py'

## Avisos

Dados high/low correspondem às últimas transações e NÃO a ordens abertas. Comprar no low e vender no high exige duas ordens limitadas. Pode não haver compradores no preço desejado. GP não representa dinheiro real. Venda de GP por reais fora dos mecanismos permitidos viola as regras da Jagex.

Licença MIT.