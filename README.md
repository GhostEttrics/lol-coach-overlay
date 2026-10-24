# LoL Coach Overlay

Target: Windows desktop. Stack: Tauri 2 (Rust) + Vite + React 18 + TypeScript + Tailwind.

## O que está dentro

- **Overlay transparente, always-on-top**, click-through quando o mouse não está sobre ele, com glassmorphism escuro / claro.
- **LCU client (Rust)**: lockfile watcher, auto-aceitar fila, importar runas, importar build de item.
- **Live Client Data poller**: GET `https://127.0.0.1:2999/liveclientdata/allgamedata` a cada 1s. Emite `ingame:snapshot` e `ingame:event` para o front.
- **Data Dragon**: cache por patch em `AppData/lol-coach-overlay/cache/<versão>/<locale>/`.
- **Motor de decisão** em TypeScript puro (fácil de testar fora do app): `recommendNextItem`, `draftCoach`, `balanceState`, `coachTip`, `deriveTimers`.
- **Hotkeys globais** F1/F2/F3/F4 via `GetAsyncKeyState`.
- **i18n** pt-BR / en.
- **Settings persistidos** em `AppData/lol-coach-overlay/settings.json`.

## Build / run

Pré-requisitos:
- Node 20+
- Rust estável (`rustup`) + Visual Studio C++ Build Tools
- WebView2 Runtime (já vem no Windows 11)

```powershell
cd lol-coach-overlay
npm install
npm run start   # dev (vite + tauri dev)
npm run release # bundle MSI/NSIS em src-tauri/target/release/bundle
```

Primeira execução pode demorar (compila cadeia Rust). Depois é rápido.

## O que é oficial (seguro) e o que não é — leia

### Oficial, roda em cima da API suportada pela Riot
- **Auto-accept de fila** — endpoint LCU documentado.
- **Importar runa** — endpoint LCU documentado.
- **Importar build de item** — escreve um arquivo `.json` em `Config/Champions/<champ>/Recommended/`. É o mesmo mecanismo que Blitz e Mobalytics usam.
- **Live Client Data (porta 2999)** — endpoint oficial read-only para overlays.
- **Overlay como janela separada always-on-top** — não hooka o processo da LoL. Vanguard não se importa com uma janela ao lado.
- **Data Dragon** — CDN público da Riot.

Nada do que está acima injeta input, lê memória do jogo nem hooka funções. É equivalente ao que fazem Mobalytics/Blitz/Porofessor.

### NÃO oficial — toggle `auto_buy`
Shop in-game não é exposta por nenhum endpoint. Para automatizar compra em qualquer jogo (não só LoL) com o processo rodando, há três caminhos:

1. `SendInput` / simular teclas na janela do jogo → **Vanguard detecta input injection em processos protegidos e bane**.
2. Escrever na memória do processo para chamar a função do shop → **Vanguard bloqueia escritas externas em memória e bane**.
3. Injetar DLL para hookar a função do shop → **Vanguard bloqueia carga de módulos em processos de jogos e bane**.

Não há 4º caminho. **Este projeto implementa o caminho (1) usando `SendInput` quando o toggle `auto_buy` está ligado**, e deixa o toggle:
- OFF por padrão,
- escondido atrás de um acknowledgment extra ("entendi o risco"),
- com warning visível em vermelho na UI,
- com warning no log do backend quando dispara.

**Recomendação honesta**: deixe `auto_buy` desligado. O overlay sublinha em verde o item recomendado quando você está na base com ouro suficiente e dá um pulse. Você clica no shop. Zero risco.

As outras automações (auto-accept, import de runa, import de build) usam a API LCU que a Riot expõe oficialmente e são usadas por milhões de contas sem ban — Vanguard não observa a LCU, só o processo `League of Legends.exe`.

## Arquitetura

```
src-tauri/src/
  main.rs            setup, comandos invoke, spawn de watchers/pollers
  state.rs           AppState: settings, LCU, snapshot vivo, Data Dragon
  lcu.rs             LCU client (lockfile, auth, ready-check, runas, builds)
  live_client.rs     Poller da porta 2999 (1Hz)
  data_dragon.rs     Download + cache por patch
  auto_buy.rs        SendInput p/ janela do jogo (DANGEROUS — com warnings)
  hotkeys.rs         F1..F4 via GetAsyncKeyState
src/
  App.tsx            boot + hooks
  store.ts           zustand store
  i18n/              pt-BR + en
  types.ts           tipos compartilhados
  components/
    Overlay.tsx      shell: header, panes, click-through, settings modal
    NextItem.tsx     recomendação próxima + "por quê"
    WinCondition.tsx tempo, condição de vitória, plano de recuperação
    Timers.tsx       dragão/barão/arauto
    Tips.tsx         dicas contextuais, severity
    DraftCoach.tsx   top-3 do pool vs comp inimiga
    Settings.tsx     tema, idioma, pool, toggles de automação
  engine/
    itemRecommender.ts    scoring por ameaça + sinergia + fase
    threatAnalysis.ts     perfil AD/AP/burst/heal/shield da comp inimiga
    draftCoach.ts         pool × matchup table × composição
    stateBalance.ts       ouro diferença → condição de vitória
    coachTips.ts          evento → dica
    timers.ts             EventTime → countdown
  hooks/
    useLiveClient.ts  listen "ingame:*" do Rust
    useHotkeys.ts     listen "hotkey"
    usePatch.ts       hidrata Data Dragon
```

## Hotkeys
- `F1` — toggle overlay visível/escondido (feito no backend; sobrevive ao foco do jogo)
- `F2` — pane "items"
- `F3` — pane "coach"
- `F4` — modo silêncio (não mostra dicas / não dispara auto-buy)

## Click-through
Enquanto o cursor NÃO está sobre o overlay, a janela ignora cliques — passam direto para a LoL. Ao hover, retomamos input. Isso é feito em `components/Overlay.tsx` chamando o comando Rust `set_click_through`.

## Dados de win-rate (para draftCoach)
Hoje `draftCoach` aceita uma `MatchupTable` opcional. Para popular isso em prod:
- API da própria Riot via chave (Match-V5 + Spectator) — pede key dev;
- scraping de U.GG/OP.GG/Blitz — frágil, mas funciona; coloque num `tauri::command` separado, cacheie por patch.

A assinatura da função não muda — basta plugar o fetch e armazenar em `AppState`.

## Roadmap (do pedido, mantido)
- **MVP** — live data + overlay com próximo item + auto-buy opcional + auto-import de runas/build. **Entregue nesta release.**
- **v1** — draft coach completo (precisa plugar winrate feed) + timers (entregue) + gold diff (entregue via stateBalance) + condição de vitória (entregue).
- **v2** — coach contextual com micro-aulas (base entregue em `coachTips.ts`) + tutoriais por campeão (adicionar JSON de combos).
- **v3** — revisão pós-jogo + histórico + personalização profunda.

## Diferenciais previstos
- Modo Aprendiz vs Autopilot — hoje é um slider `detail_level` nas settings; mapeie para o quanto o engine fala.
- TTS — adicionar `windows-speech` crate ou SpeechSynthesisUtterance no front; disparar em CoachTip.severity ≥ warn.
- Badge verde/amarelo/vermelho — já implementado em `WinCondition` via `tempo`.
- Snapshot de comp — adicione um botão em `DraftCoach` que serializa `bans+picks+suggestions` como PNG via `html-to-image`.
- Memória de erros — a store já tem `deathsStreak`; estenda com um `Record<string, number>` persistido em settings.

## Como o coach decide (v0.2)

- **Rota**: posição do Live Client; se vier vazia (partidas contra bots, blind, customs) usa a rota do draft desta partida; senão estima pelo campeão (Golpear = jungle, tag principal do Data Dragon). O chip no topo (BOT, MID...) mostra a rota; amarelo com "?" = estimada. Com F1 ligado, clique nele para trocar.
- **Build**: segue uma ordem (inicial, 1º item, botas, 2º item, situacional, 3º...). Fonte 1: item set que o cliente já tem para o campeão (o Blitz grava um quando "Itens" está ligado). Fonte 2: modelo por arquétipo em `src/engine/buildTemplates.ts`, com IDs validados no patch 16.21.
- **Preço**: igual à loja. Componentes da receita que você já tem descontam; itens iniciais (Lâmina de Doran etc.) não descontam nada porque não viram outro item.
- **Nunca sugerido**: botas tier 3 (upgrades liberados pelo jogo, ex. Esmagadores Acorrentados), itens de jungle/Golpear para quem não é jungler, itens fora da loja.
- **Objetivo**: só aparece quando dragão/Baron/Arauto está vivo ou nasce em até 75s, sempre com uma ação. Tempos de spawn em `SPAWN` (`src/engine/objectives.ts`).

## Logs

`%APPDATA%\dev.nyx.lolcoachoverlay\logs\app.log`: conexão com o cliente, patch escolhido, item sets encontrados e cada decisão do engine (rota, item, custo efetivo, tempo de jogo).

## Licença / responsabilidade

Projeto pessoal, não oficial, sem afiliação com a Riot. **Você é o único responsável** pelo que ligar na seção de automação — em particular `auto_buy`, cujo risco está descrito em cima.
