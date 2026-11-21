# Game Market Arbitrage — OSRS + mercados de jogos

Painel em português, otimizado para celular, para analisar flips no Grand Exchange de Old School RuneScape.

## Busca direta pelo navegador (SEM GitHub Actions)

- Os cinco endpoints públicos da OSRS Wiki Prices API v2 (mapping, latest, 5m, 1h, 24h) são consultados ao abrir a página e pelo botão **Pesquisar preços agora**.
- Filtros e busca de itens usam informações já carregadas, sem novas requisições.
- Atualizações limitadas a uma consulta por minuto depois de sucesso; aba fechada não faz consultas.
- **Não há agendamento de GitHub Actions** nem servidor próprio. O arquivo de snapshot não é mais necessário.
- Quando a API falha, o painel mostra erro. Dados de demonstração são fictícios e só aparecem se o usuário escolher.

API pública: https://prices.runescape.wiki/api/v2/osrs


## Mercados adicionais — pesquisa sob demanda

- [Hub dos jogos](./markets.html): concentra todas as páginas, sem converter moedas entre jogos.
- [EVE](./eve.html): ordens ESI em hubs espaciais. Cesta limitada, calcula corretagem, impostos e profundidade observada na estação. Pesquisa manual.
- [Guild Wars 2](./gw2.html): API oficial; busca paginada por amostragem configurável (4, 6 ou 12 páginas, até 200 itens cada), com erro por página e dados parciais marcados. API pode retornar erros temporários 429/503.
- [DOFUS](./dofus.html): comparador manual de lotes e importação local de CSV/JSON de fontes comunitárias (MizanBot, Kamaradar, DofusTeam, HDV Clair ou genérica) **quando o arquivo estiver disponível ao usuário**. Filtros de versão, servidor, idade máxima e intervalo de datas; registros sem servidor ou versão são rejeitados sem confirmação explícita. Não há API oficial pública de preços de HDV integrada; não há scraping nem bot.
- [Albion Online](./albion.html): dados comunitários do Albion Data Project, escolhendo servidor (Europa/Américas/Ásia), cidades, idade e custo de transporte. Consulta manual ou importação de JSON local. Estimativa de arbitragem entre cidades apenas, sem garantia de volume.
- [Prosperous Universe](./prun.html): dados públicos comunitários FIO REST `/exchange/all`, com comparação na mesma bolsa (duas ordens passivas) ou entre bolsas (transporte). Consulta manual ou importação de JSON local.
- [Torn](./torn.html): **radar de oportunidades estimadas** via API v2, com seleção distribuída de até 30 itens por categoria/faixa de preço e escolha de itens por ID/nome. Consulta catálogo `/v2/torn/items`, anúncios `/v2/market/{id}/itemmarket?limit=100&offset=0`, calcula compra ao menor ask e revenda hipotética limitada por `item.average_price` e próximo nível de asks; desconta 5% (editável), considera capital/quantidade e descarta itens com atributos próprios ou cotações antigas. Permite ver anúncios e exportar CSV. Apenas clique manual, sem jobs periódicos; chave de 16 caracteres fica em memória e é enviada somente no cabeçalho Authorization. **Não é arbitragem imediata nem lucro garantido:** a API não retorna ordens de compra, e o item market tem cache global de cerca de 1 hora.

**Validação:** testes locais exercitam fórmulas e filtros com dados simulados. Não equivalem a testes reais das APIs no navegador público. CORS, limites, indisponibilidade dos servidores e formato de exportações comunitárias ainda podem causar falhas; páginas explicam o erro, sem fabricar valores.

A coleta do MizanBot é feita pelo serviço de terceiros, que declara usar bots. Este projeto não opera bots, não captura pacotes e não interage com o cliente DOFUS. A importação só lê arquivos obtidos pelo usuário, conforme permissões e condições das fontes; ela não substitui autorização para reutilização automatizada.

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