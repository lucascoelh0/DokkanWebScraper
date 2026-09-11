# Treasure Shop: consulta direta manual

## Estado verificado em 11/09/2026

Uma execução autorizada por Lucas obteve **uma sessão nova** e consultou a loja
diretamente, sem Frida, HTTP Toolkit ou navegação no jogo durante a execução:

1. `GET /auth/nonce` → HTTP 200.
2. `POST /auth/sign_in` → HTTP 200, Bearer token com validade declarada de 3.600 segundos.
3. `GET /shops/treasure/items` → HTTP 200, 38 grupos de tesouros e 681 ofertas únicas.

Servidor único: `https://ishin-global.aktsk.com`. A execução ocorreu às
17:25 UTC. Não foram feitas compras, conversões ou chamadas de atualização de
conteúdo. O login cria uma sessão e pode afetar uma sessão simultânea do jogo;
não há garantia de ausência de impacto na conta ou de funcionamento futuro.

Este é um procedimento **local, manual e experimental**, não um cliente de produção
nem autorização permanente para coleta recorrente. O usuário autorizou usar sua
conta secundária nesta investigação. As restrições das campanhas históricas
H12/DQ não são descrição deste teste posterior, nem este teste libera aquelas
infraestruturas para execução indiscriminada.

## Onde estão os arquivos

- Captura fornecida pelo usuário, fora do repositório:
  `C:/Users/Lucas/Downloads/HTTPToolkit_2026-09-11_14-22.har`.
- Utilitário operacional local, ignorado pelo Git:
  `.agent-logs/treasure-login-probe.py`.
- Resultado desta execução:
  `.agent-logs/treasure-login-probe-current-result/summary.json` e
  `public-offers.json` no mesmo diretório.
- Python existente: `D:/Dokkan/database/.venv/Scripts/python.exe`.
  O utilitário usa somente a biblioteca padrão, sem depender de SQLCipher.

O utilitário não é distribuído com o pipeline. Se estiver ausente numa máquina
nova, este documento não implica que exista um comando de produção equivalente.
Não copiar o HAR para Git, fixtures, documentação, R2 ou APK: ele contém material
de autenticação e tráfego privado. Não publicar os resultados experimentais sem
validação e autorização de publicação separadas.

## Como repetir, quando autorizado

Primeiro execute apenas a seleção offline:

```powershell
& D:/Dokkan/database/.venv/Scripts/python.exe `
  .agent-logs/treasure-login-probe.py `
  --har C:/Users/Lucas/Downloads/HTTPToolkit_2026-09-11_14-22.har
```

O resultado esperado é `offlineSelection: ok` e `networkRequests: 0`.
Isso não valida a credencial no servidor. Para uma nova execução explicitamente
autorizada, acrescente `--execute-once` e um diretório de saída novo:

```powershell
& D:/Dokkan/database/.venv/Scripts/python.exe `
  .agent-logs/treasure-login-probe.py `
  --har C:/Users/Lucas/Downloads/HTTPToolkit_2026-09-11_14-22.har `
  --output .agent-logs/treasure-login-probe-NOVA-EXECUCAO `
  --execute-once
```

Substitua `NOVA-EXECUCAO` por um identificador único. Se o diretório existir,
o programa para antes de qualquer chamada. Não apagar um resultado para repetir
uma falha nem colocar o comando em um loop/agendador.

## Como a autenticação é selecionada

O HAR precisa conter um login bem-sucedido e a consulta bem-sucedida da loja.
O utilitário compara os tokens **somente em memória** para selecionar o login da
mesma sessão. Também valida que a transação do login corresponde ao desafio
imediatamente anterior. Seleções ambíguas são rejeitadas.

Os cabeçalhos e o corpo do login vêm desse conjunto coerente; a transação antiga
é substituída pela nova retornada por `/auth/nonce`. O Bearer retornado pelo novo
login é usado na consulta. Não reutilizamos o Bearer expirado para consultar a
loja. A credencial Basic e demais dados necessários continuam sendo sensíveis,
mesmo quando o token antigo expira.

A captura atual usa o cliente `6.5.5` com seu identificador completo em
`X-ClientVersion`. Não fabricar esse identificador a partir do número da versão.
O teste anterior com a captura `6.4.0` recebeu HTTP 400 no desafio. O sucesso com
6.5.5 é consistente com parâmetros antigos incompatíveis, mas não isola a causa
do primeiro erro, pois as capturas também diferem em outros dados.

Uma nova captura não foi necessária para este teste após fornecer o HAR atual.
Isso **não prova** validade indefinida da credencial Basic ou do `device_token`.
Se o cliente/credencial/desafio mudar, pode ser necessário capturar novamente.
Nenhum mecanismo de atestação ou CAPTCHA foi implementado ou contornado.

## Limites e tratamento de falhas

- No máximo três chamadas sequenciais, sem repetição automática.
- HTTPS com validação de certificado; sem seguir redirecionamentos.
- Somente os três pares de método/caminho acima; nenhuma compra/conversão.
- Timeout de conexão/leitura de 20 segundos, prazo de leitura e limite de 8 MiB.
- Interromper em erro HTTP, formato inesperado ou ausência do token esperado.
- Não tentar contornar CAPTCHA, atestação, bloqueio ou atualização obrigatória.
- Não imprimir headers, tokens, corpo de autenticação ou mensagens brutas de erro.
- Tokens não são gravados. Não se promete apagamento criptográfico da memória Python.

## O que pode ser aproveitado para o catálogo

`public-offers.json` guarda apenas uma lista permitida de campos: ID da oferta,
moeda, preço/desconto, indicador de promoção, início/fim e recompensas com
ID/tipo/quantidade. Pacotes com várias recompensas são preservados.

Não exporta `buyable`, `buyable_num`, recomendações, saldo, identidade da conta
ou credenciais. `buyable_num` não é evidência de um limite global: pode representar
o restante comprável daquela conta. Datas, descontos, sentinelas, restrições de
elegibilidade e completude ainda precisam de validação antes de uso no app.
Uma resposta da conta não prova cobertura de todas as ofertas do jogo.

Este resultado é evidência para a feature Treasure Exchange; não altera nenhum
manifesto, catálogo publicado ou tela Android.
