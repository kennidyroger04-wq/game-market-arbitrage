# Game Market Arbitrage — OSRS

Analisador **independente, gratuito e de código aberto** para flips no Grand Exchange de Old School RuneScape. Projeto iniciado para expandir a outros mercados (EVE Online etc.).

O site funciona no **GitHub Pages** e no celular. Não acessa credenciais nem executa ordens dentro de jogos.

**Como publicar:** Settings → Pages → Build and deployment → Source: **GitHub Actions**; depois Actions → **Atualizar OSRS e publicar** → Run workflow. O endereço será https://kennidyroger04-wq.github.io/game-market-arbitrage/.

**Dados:** API pública [OSRS Wiki Real-Time Prices](https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices), versão v2, coletada em lote por GitHub Actions. Os campos high/low refletem *últimas transações*, não livro de ordens ou oferta garantida. Operar perto do low/high exige **duas ordens limitadas**, que podem levar tempo para preencher ou não preencher.

**Cálculos:** diferença de high − low, menos imposto de venda de 2% arredondado para baixo com teto de 5 milhões GP/unidade; limites de compra de 4 horas, capital e estimativa conservadora baseada em volume. Esse cálculo não prediz uma execução nem garante retorno. Taxa cobrada conservadoramente até em itens eventualmente isentos.

**Filtros:** somente F2P, orçamento GP, margem líquida, volume de 5 minutos e 24 horas, idade separada dos preços, busca, favoritos e exportação CSV. Registro manual de trades fica apenas no navegador.

**Implementação:** HTML/CSS/JavaScript sem serviços pagos, coletor Python padrão e workflow que testa, busca dados e publica Pages a cada hora, sujeito a atrasos do GitHub.

**Restrições:** contas novas podem ter restrições no Grand Exchange; F2P possui três ofertas simultâneas. Comprar GP ou vender GP por dinheiro real fora dos mecanismos oficiais viola as regras da Jagex. O programa não representa lucro em reais nem recomenda RMT.

## Testes
```sh
node --test tests/*.test.mjs
python -m unittest discover -s tests -p 'test_*.py'
```

Licença: MIT (ver LICENSE).