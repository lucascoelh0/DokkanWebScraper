# Data download DD0–DD8 — auditoria offline

DD0–DD8 auditam três HARs e quatro corpos externos exatos, sem emitir, preparar ou reproduzir requests. A implementação é aditiva, opcional, desabilitada por padrão e não contém cliente autenticado, alteração de Android, publisher, R2 ou geração produtiva. HARs, screenshots, corpos externos, SQLite, CPKs, URLs assinadas, query values, credenciais e dados de conta permanecem fora do Git.

### Execução local explícita

Os runners e o scanner staged não possuem diretório de captura default. Cada invocação deve fornecer o diretório externo da campanha por exatamente um destes meios:

```powershell
$env:DOKKAN_DD0_DD8_CAPTURE_ROOT = '<diretório externo da campanha>'
npm run run:database-data-download-dd0
```

```powershell
npm run run:database-data-download-dd0 -- --capture-root '<diretório externo da campanha>'
```

O mesmo argumento ou variável se aplica a DD1–DD8 e a `scan:database-data-download-staged`. Fornecer ambos, omitir o root ou passar argumentos adicionais falha fechado. O valor configurado nunca é incluído nas mensagens de erro. Antes de ler qualquer fonte, o runner resolve o root com `realpath`, rejeita root em symlink/junction e confirma que cada arquivo allowlisted é um arquivo regular direto cujo `realpath` permanece contido no root. Caminhos absolutos, traversal e links/junctions externos são rejeitados. O campo `captureRoot` do source lock é apenas um identificador lógico estável, não um caminho de filesystem.

## DD0 — source lock e segurança

| Fonte | Bytes | Entradas | SHA-256 |
| --- | ---: | ---: | --- |
| incremental | 2.119.371 | 50 | `c5f73661b82e3c0a2f7f47588ff986f9f02b489867681717fa09c491905c8d0c` |
| clean install | 34.618.000 | 183 | `6867c80fbff36a1162d2835fe378205b8216c9af9cbd10439652058c22769c4d` |
| Download All | 1.789.781 | 152 | `47f6b8a5d5004299194f1685c450cd8bd8257d4642ffb1d56c84ab898d2b7d0b` |

| Corpo externo confidencial | Papel | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `clean_install_ondemand_manifest` | manifesto allowlisted, somente em memória | 3.063.770 | `b81a95437ee511dc60ff434349635f8f374dacbb6232233e1c46d83af53b78e6` |
| `download_all_ondemand_manifest` | manifesto allowlisted, somente em memória | 3.063.770 | `b504f15ad0075233164b78c26af09036fe134e355f99264841d68124d9ee386e` |
| `download_all_client_assets_manifest` | inventário allowlisted, somente em memória; filename descoberto e não persistido | 16.150.270 | `455f5850efd8d7bc135759d59dc8272629dd2378b8e61bb5e615c5eac536827b` |
| `clean_install_cards_account_body` | account-scoped opaco, somente scanner | 41.897 | `10b5985e3d9611b9a9712e8d50adae600eea22dbb270dca9fb6954bdfbd9894f` |

As screenshots continuam externas: clean install mostra 4.868 arquivos (`eeb0c684fdb7e1576b2f6a84323ce640fc6eca32de0c1031c656dacc334281fd`) e Download All mostra 25.233 (`ba2c7a59496c4e7d8381060291626ec7dd48ffad71cd93973d42eb51251fd784`). O source lock exige hashes, tamanhos, mtimes, cardinalidades e shape exatos. O arquivo cujo nome contém um query value é encontrado por um único padrão decimal, mas seu nome e seu valor não entram no lock ou nos artefatos.

O scanner fail-closed coleta em memória valores sensíveis dos HARs e todos os escalares do corpo account-scoped. Ele também coleta nomes/valores descobertos das fontes externas e compara nome e conteúdo de cada arquivo staged. HAR, raw body, corpo account-scoped, banco, asset, screenshot, `data/`, log e attachment são alvos proibidos.

## DD1 — sequência e taxonomia

O inventário contém 385 entradas e 348 relações de ordem. Preserva host oficial, método, rota sem query, status, presença de request body, MIME, encoding, tamanhos, nomes de headers e escopo. Não preserva valores de query, header, cookie, request body ou conta. Todos os 385 requests pertencem exclusivamente aos hosts oficiais observados.

- Incremental: autenticação e leitura de usuário precedem `GET /client_assets/database` e `GET /client_assets`; seguem 36 requests CDN. Há uma mutação observada, nunca reproduzida.
- Clean install: transferência/validação e autenticação precedem a leitura account-scoped opaca e `POST /ondemand_assets`; seguem 173 requests CDN que formam apenas um prefixo da entrega. Há quatro mutações observadas, nunca reproduzidas.
- Download All: uma mutação de usuário e leituras de bootstrap precedem `GET /client_assets/database`, a leitura account-scoped opaca, `GET /client_assets` e `POST /ondemand_assets`; seguem 144 requests CDN que formam apenas um prefixo. Há duas mutações observadas, nunca reproduzidas.

## DD2 e DD3 — contratos e modos

`GET /client_assets` tem dois papéis observados nesta versão. O corpo incremental contém 25 descritores e 59.803.512 bytes declarados. O corpo externo de Download All contém 25.233 descritores únicos, 22.349.705.433 bytes, algoritmo `xxhash` e `latest_version = 1786514403`. O conjunto completo contém exatamente as 4.868 identidades obrigatórias; o delta é 20.365 descritores e 18.197.292.473 bytes. Isso prova a relação desta captura, mas não prova o algoritmo de seleção nem o comportamento entre versões.

`GET /client_assets/database` tem dois descritores concordantes: versão `1786522617`, algoritmo/version hash observado, caminho CDN versionado e tamanho CDN declarado de 97.738.752 bytes. `patch` e `patch_hash` foram observados nulos; suporte a patch não é afirmado. Aquisição futura continua dependente de autorização e de um ciclo de credenciais não pessoal.

`POST /ondemand_assets` tem dois corpos externos ligados às entradas HAR 200 cujo body não foi retido. Ambos contêm as mesmas 4.868 identidades por `file_path + algorithm + hash + size`, zero paths duplicados e 4.152.412.960 bytes:

| Categoria | Descritores | Bytes |
| --- | ---: | ---: |
| cards | 3.376 | 1.716.271.776 |
| battle characters | 1.230 | 963.445.952 |
| card backgrounds | 262 | 1.472.695.232 |

Todas as URLs diferem entre os dois corpos. URL é, portanto, localização efêmera de entrega e não identidade permanente. Ainda permanecem `partial` a semântica do request selector, a universalidade do conjunto e o comportamento em outra versão.

O campo `device_asset_size_bytes` aparece como decimal em duas chamadas e varia entre elas. Para Download All, os bytes do manifesto obrigatório mais os bytes da database são exatamente iguais ao valor observado no query. Essa é uma igualdade comprovada somente nesta captura; o valor do query não é persistido e uma regra universal permanece `unknown`.

## DD4 — famílias e custo

A UI coincide com os manifests externos em cardinalidade, enquanto os downloads presentes nos HARs continuam prefixos: 353 requests CDN, 493.921.149 bytes declarados e 28.080.989 bytes de body retidos. O inventário completo foi reduzido a 14 agregados de família/extensão, sem paths individuais:

| Família agregada | Extensão | Descritores | Bytes | Política |
| --- | --- | ---: | ---: | --- |
| battle/effect/sprites | cpk | 2.867 | 12.887.712.400 | não espelhar |
| bgm/voice/se | acb | 546 | 34.945.536 | não espelhar |
| bgm/voice/se | awb | 538 | 1.157.343.206 | não espelhar |
| character/card | cpk | 3.405 | 1.726.528.784 | candidato seletivo |
| character/card_bg | cpk | 262 | 1.472.695.232 | candidato seletivo |
| character/thumb | cpk | 3.334 | 71.676.672 | candidato seletivo |
| gasha/banner | cpk | 78 | 351.109.872 | candidato seletivo |
| ingame/battle/character | cpk | 1.230 | 963.445.952 | não espelhar |
| item | cpk | 3.826 | 215.916.088 | candidato seletivo |
| movie/packaged_movies | cpk | 113 | 335.754.240 | não espelhar |
| movie/packaged_movies | usm | 208 | 1.167.066.991 | não espelhar |
| structural_script/lua/tmx | cpk | 6.423 | 435.156.064 | desconhecido |
| other | cpk | 2.402 | 1.530.354.064 | desconhecido |
| other | strings | 1 | 332 | desconhecido |

Database, thumbs, card art/backgrounds, banners e itens são apenas candidatos. Eles ainda exigem identidade interna, vínculo estrutural com o consumidor e projeção seletiva. BGM, vozes, efeitos sonoros, vídeos, animações, sprites e grandes pacotes de batalha não devem ser espelhados. O inventário de 22,35 GB não deve ser armazenado pelo projeto.

## DD5 — cache, versão e integridade

Foram observados 373 ETags de resposta, 339 Last-Modified, nove If-None-Match e nove respostas 304. Nas nove respostas 304, o If-None-Match e o ETag da mesma entrada concordaram em memória; nenhum valor de validator foi persistido. Os roots versionados observados são `/assets/current/en/20260812-060003/` e `/sqlite/current/en/20260812-081657/`.

A identidade estável de asset é `file_path + algorithm + hash + size`; URL de entrega não participa. `xxhash` é autoridade somente no seu domínio algorítmico, a versão/hash da database permanece opaca e SHA-256 local protege bytes e source lineage. Cache imutável só é candidato depois de validar bytes. Schema/encoding desconhecido, path fora da allowlist, duplicata incompatível, divergência de tamanho/hash/versão ou patch não revisado falham fechado. Download futuro deve ir para arquivo temporário, ser validado e só então promovido atomicamente.

## DD6 — shadow parity

As 14 linhas exclusivas usam unidades de evidência, não entidades somáveis: seis agreements, três representation gains, três representation mismatches, um unknown, dois unjoinable e zero confirmed conflicts. Zero conflito nunca implica completude.

- H6 concorda com o descritor da database e com a fronteira de path; H12 concorda que credenciais/autorização não estão prontas.
- S0–S7 ganham os manifests obrigatórios repetidos e o inventário completo desta versão.
- E0–E9 e K0–K28 continuam sem join entre referência estrutural e conteúdo interno de CPK.
- Entrega oficial e R2 do projeto são representações diferentes.
- A auditoria pré-AQ encontrou no downloader histórico URL arbitrária, redirects, persistência da URL completa e escrita antes da validação integral; esse comportamento foi removido e não descreve a implementação atual.
- O downloader AQ atual concorda com a política DD7: aceita somente o descritor Global EN exato, bloqueia redirects, mantém transporte separadamente autorizado, valida bytes antes da promoção marker-last e não persiste URL no metadata ou receipt. Por isso `manual_database_downloader_safety` mudou de `representation_mismatch` para `agreement`; a mudança reflete a correção implementada, não uma reclassificação da evidência histórica.
- O update runner atual pode publicar na mesma invocação; a arquitetura DD7 exige autorização separada.
- H13 permanece `unknown` para esta dimensão; aquisição de assets não corrige semântica de gasha.

## DD7 — arquitetura futura, não ativada

1. Descoberta manual ou separadamente autorizada da versão oficial.
2. Aquisição do SQLite para armazenamento temporário efêmero.
3. Validação de versão, algoritmo, hash, tamanho e SHA-256 local.
4. Seleção de famílias por allowlist e projeção prévia de bytes.
5. Cache incremental content-addressed por identidade estável, nunca por URL.
6. Geração DB-first usando o contrato first-party existente.
7. Comparação shadow por IDs e campos estruturais, sem joins por nome.
8. Testes focados, determinismo e compatibilidade com cache antigo/sidecar ausente.
9. Dry-run com objetos, bytes, conflitos e limite de R2, sem writes.
10. Publicação manifest-last em workflow separadamente autorizado.

Aquisição autenticada, transformação offline, publicação R2 e consumo Android são quatro autoridades distintas. Credenciais futuras entram somente por secrets efêmeros e nunca chegam a CLI args, URLs, logs ou artefatos. Retenção proposta: SQLite validado atual mais um rollback; assets somente se allowlisted e referenciados pelas releases ativa/anterior. O inventário completo, URLs assinadas e famílias sem uso comprovado nunca são retidos.

## DD8 — readiness

| Capacidade | Decisão |
| --- | --- |
| merge da infraestrutura offline/default-off | **GO** |
| fixtures sintéticas mínimas | **GO** |
| catálogo oficial de versões | **CONDITIONAL-GO** — snapshot único, sem série longitudinal |
| aquisição manual de SQLite | **CONDITIONAL-GO** — exige autorização independente e validação antes de promover bytes |
| refresh autenticado | **NO-GO** |
| asset delivery seletiva | **NO-GO** |
| substituir FYI/DokkanInfo | **NO-GO** |
| publicação R2 | **NO-GO** |
| Android shadow mode | **NO-GO** |
| automação completa | **NO-GO** |

Não é necessária outra captura para concluir esta campanha. Dependências opcionais de uma campanha futura são: cold/warm de `/client_assets`, uma versão oficial posterior para semântica longitudinal, e um patch naturalmente não nulo. Devem ser sessões passivas e user-driven; nunca se deve forçar versão antiga, fabricar requests ou reutilizar credenciais capturadas.

## Validação

- TypeScript `--noEmit`: verde.
- Build com `lib/` rastreável: verde.
- Suíte focada: 21 testes verdes com as fontes reais; 20 testes verdes e um teste real explicitamente pulado quando o root não é configurado.
- DD0–DD8 reais: nove validações verdes.
- Dupla geração: 21 artefatos, zero diferença de tamanho ou SHA-256.
- Pico observado nos runners: 307,90 MiB, sob heap Node de 768 MiB e abaixo de 1 GiB.
- Scanner fail-closed: HARs e quatro fontes externas comparados somente em memória contra cada conjunto staged.
- `git diff --check`: exigido novamente no checkpoint final.

Os artefatos de `data/` são ignorados e não são versionados. O histórico da branch registra um commit isolado por gate DD0–DD8; hashes e estado remoto são apresentados na entrega final.
