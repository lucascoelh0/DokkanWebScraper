# Hidden Potential: produtor offline opcional

Implementado em 2026-09-09, sem integração com exportador, publisher ou Android.
O módulo produz máximos de ficha Base/EZA/SEZA e presets teóricos completos de
potencial por ID exato. A investigação original permanece em
`C:/Users/Lucas/.codex/worktrees/6d80/Dokkanpanion/docs/features/hidden-potential-stats-investigation.md`.

## Contrato e cálculo

Contrato `dokkan-hidden-potential` 1.0.0, `calculationVersion`:
`native-binary64-floor-v1`. O índice contém:

- `byCardId[exactId]`: status, boardId e estados Base/EZA/SEZA;
- estado configurado: nível máximo explícito, ID/step de crescimento, IDs das
  rotas, tripla `maxStats` na ordem HP/ATK/DEF, disponibilidade e elegibilidade
  para exibição;
- `boards[boardId]`: seis presets e uma alternativa, contagem de nós, percentual,
  gates abertos, SA exigido e tripla de bônus. O grafo não é transportado;
- proveniência com hashes DB/runtime/layouts, snapshot e tamanhos dos arquivos.

Os seis presets são `none`, `no-routes`, `one-route` `[3]`, `two-routes` `[3,0]`,
`three-routes` `[3,0,1]` e `all`. `three-routes-alternative` `[3,0,2]` é separado.
Os perfis pressupõem todos os nós alcançáveis ativados, gates ativados, SA
suficiente, orbs disponíveis e uma alternativa escolhida em cada square de
seleção. Abrir caminho com dupe, sozinho, não realiza essa configuração.

| Perfil | Board 020 | Board 201 |
| --- | ---: | ---: |
| none | 0% | 0% |
| no-routes | 55% | 57% |
| one-route | 69% | 70% |
| two-routes | 79% | 79% |
| three-routes | 90% | 90% |
| all | 100% | 100% |
| three-routes-alternative | 89% | 89% |

O bônus é a soma dos eventos de HP/ATK/DEF dos nós alcançados; nunca interpolação
por percentual. Escolhas de skills contam uma vez e não alteram a tripla bruta.
Os 334 squares SQL incluem os quatro gates e as quatro raízes. Nos dois layouts
verificados, 335 objetos JSON correspondem a esses squares mais um centro
`start`. A prévia nativa usa divisão inteira `100 * ativados / (N-1)`.

No cliente ARM64, a razão está em `0x2de6118–0x2de6160` e a exclusão do tipo start
em `0x2e12dfc–0x2e12e14`. A rotina de stats é `0x1f1cdb8–0x1f1ce08`:

```text
D = max - initial
linear = ((D / (max(baseMaxLevel, 2) - 1)) * 0.5) * (level - 1)
curved = (coef * D) * 0.5
stat = floor((linear + curved) + initial)
```

TypeScript preserva a ordem binary64 e o floor. O nível EZA/SEZA vem do último
step da respectiva rota Optimal, usando a curva da mesma carta. SEZA deve manter
os máximos EZA nesta fonte; mudança futura falha fechada, sem copiar por nome ou
alias 9xxxxxx. LR permanece no nível 150 quando a fonte assim determina.

`lookup(index, exactCardId, state, presetId)` devolve tripla máxima + bônus somente
quando carta, estado e preset são elegíveis. Não resolve aliases, transforms ou
fallbacks de nome. O objeto opcional não substitui `max/freeDupe/rainbow` legado.

## Status e disponibilidade

`supported` no registro da carta significa que existe board calculável; a
disponibilidade do estado é separada. `ineligible:no-potential-board` não vira
zero: a carta pode ter máximo Base calculado, mas não recebe perfil de potencial.
Cartas fora da ficha jogável recebem `ineligible:outside-playable-sheet`, sem
estados (IDs de combate ≥4.000.000, selling-only ou HP inicial ≤1). Não se usam os
IDs de transforms aninhados do primário como novas identidades do roster.

ID ausente produz `unknown:missing-source-card`; curva ausente produz estado
`unknown:missing-curve` com `maxStats:null`. Estado sem rota recebe
`ineligible:not-configured`. Nenhuma ausência é substituída por 0 ou pelo valor
de outra forma. O zero legítimo de `none` está apenas no bônus.

`availability` é `released`, `future` ou `unknown`, avaliada no timestamp explícito
da execução. Datas SQL `YYYY-MM-DD HH:mm:ss` são interpretadas como UTC, seguindo
a convenção do snapshot Global. Um estado exige a data da carta e de todas as
rotas anteriores até seu step. Datas ausentes ficam unknown; futuras ficam future.
Configuração futura pode ter máximo matemático materializado, mas
`eligibleForDisplay:false`. O consumidor futuro deve respeitar essa flag. Não é
prova de posse, rank, SA, dupes ou progresso de uma conta.

## Fonte e limites de evidência

| Fonte | SHA-256 |
| --- | --- |
| SQLite 1788329250 | `7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495` |
| ELF Global 6.5.5 ARM64 | `a1592e635bad24ef270fa3a28383a3032effd5f4709c17dd2acde1f7fd7e38f7` |
| board020.json | `e141e5dd3a5cfe0a262dda33ff5e597db4ed08fa0e7fb66c082d067c0059e289` |
| board201.json | `2085e731c7106742f848dfacad56eaf5dcd05e4e225dc55b3b80876078aeef86` |

A bridge Python exige esses hashes antes de consultar SQLite com URI `mode=ro`
e `query_only=ON`. Valida IDs, joins, condições SA/orbs, escolhas, eventos, raízes,
gates, reciprocidade/conectividade, curvas e steps. Tabelas incompletas, tipos
desconhecidos, joins quebrados e schemas `*_increase` não suportados são rejeitados.
O núcleo TS repete as invariantes do grafo e rejeita gates inefetivos, duplicatas,
curvas não finitas e cadeias Optimal incompletas. Erros estruturais interrompem o
candidato; não viram status silencioso em milhares de registros.

Layout direto foi verificado **somente para 020 e 201**. Neles, route 0/1/2/3 é
superior esquerdo/superior direito/inferior esquerdo/inferior direito. Os outros
boards têm `evidence.kind:sql-graph` e `routeDirections:null`; seus bônus e
percentuais são derivados do grafo SQL. 211–225 não são cópias exatas do 201,
embora tenham os mesmos totais por preset. Não se propagou prova de coordenadas
aos 45 layouts. O percentual é teórico; não é `released_rate` recebido do servidor.

## Runner e artefatos

Arquivos novos:

- `game-db/game-db-hidden-potential-core.ts`: contratos, cálculo e lookup;
- `game-db/game-db-hidden-potential-sqlite.py`: bridge somente leitura;
- `game-db/game-db-hidden-potential-run.ts`: validação de roster e candidato;
- specs correspondentes, incluindo `game-db-hidden-potential-real.spec.ts`;
- `game-db/fixtures/hidden-potential/source.json` e README: fixture fixa de 86 KB.

O CLI exige `--opt-in-offline` como primeiro argumento, sem execução ao importar
o módulo. Todos os caminhos e o timestamp são explícitos; flags desconhecidas,
duplicadas, URLs e UNC são rejeitados. Não há dependência nova, shell de subprocesso,
rede ou descoberta automática de fonte. Exemplo, no diretório do pipeline:

```powershell
node -r ts-node/register game-db/game-db-hidden-potential-run.ts --opt-in-offline `
  --db <database.decrypted.sqlite> --elf <libcocos2dcpp.so> `
  --layout20 <board020.json> --layout201 <board201.json> --python <python.exe> `
  --primary-manifest <characters-manifest.json> --primary-payload <characters.json.gz> `
  --enrichment-manifest <character-details-manifest.json> --enrichment-dir <candidate-root> `
  --output-dir game-db/data/hidden-potential/<NEW-NAME> `
  --generated-at 2026-09-09T12:00:00.000Z
```

O runner valida hash, tamanho comprimido/expandido e schema de primário, catálogo
e todos os 26 shards de enrichment, além de bindings, IDs declarados, contagens e
joins das identidades. A união deve ser exatamente o snapshot fixado de
1.442 + 2.768 cartas. Essa leitura de todos os shards é trabalho **offline do
produtor**; o índice entregue não exige esses downloads para consultar uma carta.

A saída deve ser um filho direto novo de `game-db/data/hidden-potential`, resolvido
relativamente ao módulo, não ao cwd. Todos os ancestrais são verificados contra
symlinks/junctions e destinos fora da raiz. `mkdir` reserva exclusivamente o
diretório e arquivos usam `wx`. Validação e cálculo terminam antes da reserva.
Payload e audit precedem o manifest, que é o marcador de conclusão. Uma falha de
gravação pode deixar diretório incompleto **sem manifest válido**; não há rollback
destrutivo nem sobrescrita/reutilização desse nome. Esse é o limite de atomicidade
local, não uma transação de diretório resistente a alterações hostis simultâneas
do filesystem. Nenhum publisher reconhece esse candidato automaticamente.

JSON/gzip são determinísticos para as mesmas entradas, código, versão de Node/zlib
e timestamp. O manifest registra versões, hashes/tamanhos de fontes e do payload,
hashes dos três arquivos de implementação e cobertura. Timestamp não é obtido do
relógio durante geração. A publicação futura exigirá integração e aprovação próprias.

## Candidato verificado

Diretório final:
`game-db/data/hidden-potential/candidate-1788329250-v1-final-20260909`.

| Artefato | SHA-256 / tamanho |
| --- | --- |
| Índice gzip | `532d894935891cc0dbb798b62b04c6079960fa2c896faca8307e84199ed61a93` — 84.419 bytes |
| Índice expandido | 2.257.581 bytes |
| Manifest | `edd55e2120526005a66163964dc658f8eb2f65624d968d8791a74ac83d450281` — 6.397 bytes |
| Audit de cobertura | 6.838 bytes |

O custo inicial do índice opcional é cerca de 84 KB gzip, com lookup direto por
ID. Os bônus são armazenados uma vez por board; máximos por estado ficam na carta.
Não se repetem grafos nem totais de potencial completos para cada carta/preset.
O candidato preliminar `candidate-1788329250-v1-20260909` foi preservado e está
superado pelo diretório final; nenhum manifest anterior foi substituído.

| Cobertura | Quantidade |
| --- | ---: |
| IDs exatos no escopo | 4.210 |
| Cartas com board suportado | 2.270 |
| Sem board | 1.918 |
| Fora da ficha jogável | 22 |
| Estados Base suportados e liberados | 4.170 |
| Estados Base suportados, futuros/ocultos | 18 |
| EZA suportados e liberados | 665 |
| SEZA suportados e liberados | 35 |
| EZA não configurados | 3.523 |
| SEZA não configurados | 4.153 |
| Unknown na fonte real | 0 |

Foram validados 45 boards; 44 são usados pelo roster. Board 123 não é entregue
porque não há carta do escopo ligada a ele. Cartas por board:

| Boards | Quantidades, na mesma ordem |
| --- | --- |
| 10, 11, 12, 13, 14 | 112, 121, 130, 124, 112 |
| 20, 21, 22, 23, 24 | 327, 320, 297, 329, 314 |
| 30, 31, 32, 33, 34 | 2, 4, 4, 6, 4 |
| 120, 121, 122, 124 | 2, 4, 4, 4 |
| 201–225 | 2 por board |

## Verificação e entrega

Comandos estreitos, sem tsc amplo e sem geração de `lib/`:

```powershell
python game-db/game-db-hidden-potential-sqlite.spec.py
node node_modules/mocha/bin/mocha.js --no-config --no-package -r ts-node/register `
  --timeout 15000 game-db/game-db-hidden-potential-core.spec.ts `
  game-db/game-db-hidden-potential-run.spec.ts game-db/game-db-hidden-potential-real.spec.ts
```

Sem `HIPO_REAL_OPTIONS`, a verificação de fonte real fica explicitamente skipped.
Para executá-la, apontar essa variável para um JSON local do tipo `Options` do
runner, com os mesmos caminhos explícitos. Ela lê e calcula, **não grava candidato**.
A execução desta entrega usou `.agent-logs/hipo-real-options.json`.

Resultados: **39 testes TypeScript autocontidos + 1 integração real passaram;
4 testes Python passaram**, incluindo 19 mutações adversariais em subcasos. Cobrem
cinco tipos comuns e template exclusivo, todos os presets, 57/70, 89/90, escolhas,
máximos e arredondamento com goldens fixos, LR, SEZA, ausência de curva/board/estado,
datas futuras/desconhecidas, corrupção de schema/grafo/manifests, hash/tamanho,
fresh output, junction, determinismo e marcador de conclusão após falha.

A integração real comparou hashes de **34 arquivos de entrada antes/depois**, sem
mudanças. A bridge também reconferiu a SQLite ao final. O índice foi calculado
duas vezes com a ordem do escopo invertida e manteve JSON/gzip idênticos. O runner
gerou somente candidatos HIPO novos. Logs: `.agent-logs/hipo-final-tests.log`,
`hipo-python-tests.log`, `hipo-contract-tests.log`, `hipo-final-real-test.log`,
`hipo-final-candidate.log`. A checagem final também confirmou os hashes dos três
arquivos de implementação registrados no manifest contra o código entregue.

Houve dois ajustes do comando de teste: os tipos Node locais não expõem
`node:test`, então foi usado Mocha; uma chamada inicial herdou a configuração
global de coleta e parou na importação antes de executar a suíte. O comando final
usa `--no-config --no-package` para restringir os arquivos. Nenhum teste amplo foi
concluído ou usado como evidência.

Não foram alterados arquivos existentes, `package.json`, `lib/`, exportadores,
campos legados, project-state, Android, conta/emulador ou fontes. Não houve Git
mutável, rede, publicação, R2, Gradle, APK ou subdelegação. A coordenadora ainda
deve revisar os arquivos novos, compilar as saídas correspondentes e integrar o
registro de projeto. Cache/bootstrap, UI, migração de legado e publisher são
trabalhos posteriores; não fazem parte deste slice.

## Correção da revisão — fixture em testes compilados

A revisão reproduziu 27 falhas `ENOENT`: o spec usava `__dirname/fixtures`,
mas o fluxo `npm test` compila para `lib/game-db` e o TypeScript não copia
assets JSON carregados por `readFileSync`. A fixture permanece corretamente
em `game-db/fixtures/hidden-potential/source.json`.

O spec agora resolve a raiz do repositório a partir de sua posição nos dois
layouts (`game-db` e `lib/game-db`), como o runner já faz, e lê o mesmo asset
de fonte. Não há fallback, catch de erro de leitura, cópia manual para `lib`,
mudança de goldens nem remoção de testes. Foi adicionado um teste que muda o
diretório de trabalho temporariamente e verifica a mesma fixture; o cwd é
restaurado em `finally` mesmo se a asserção falhar.

Verificação após a correção:

- 28 testes do motor via `ts-node` passaram.
- Os cinco módulos TypeScript deste slice foram compilados para `lib/` com
  as opções do `tsconfig.json`, sem recompilar arquivos não relacionados.
- `mocha --no-config "lib/game-db/game-db-hidden-potential-*.spec.js"`, com
  `HIPO_REAL_OPTIONS` definido, passou **41 testes**, incluindo a integração
  real, sem skips. É o modo de execução compilado do projeto, restrito ao slice;
  não é uma execução da suíte completa `npm test`.
- Logs: `.agent-logs/hipo-fixture-fix-source.log`,
  `hipo-fixture-fix-build.log`, `hipo-fixture-fix-compiled.log`.

As saídas JS/source maps correspondentes foram geradas em `lib/game-db/`.
Código de produto, fixture, cálculos e candidato final permanecem inalterados.
Sem commit, push ou publicação.
