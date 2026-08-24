# Simulering — design

## Mål

Bygga en ny, fristående sida på Teds befintliga statiska webbplats där fem
unika stadsinvånare lever i en interaktiv 3D-stad. Sidan ska kännas som ett
observatorium över ett pågående samhälle, inte som en dashboard ovanpå en
demo.

## Research-beslut

Arkitekturen följer observation–minne–reflektion–planering från *Generative
Agents: Interactive Simulacra of Human Behavior* (Park et al., 2023), men
kombinerar den med deterministisk utility-AI för behov och navigering. Det gör
att Qwen formulerar avsikter, samtal och reflektioner medan spelmotorn alltid
kan genomföra säkra, visuellt begripliga handlingar. Three.js GLTFLoader och
AnimationMixer används för befintliga glTF/GLB-resurser och framtida animerade
modeller.

## Upplevelse

Sidan heter **Simulering** i navigationen. Den öppnar i en mörk kvällsscen med
en varm stadskärna, mjuka ljuskäglor, regn eller klart väder och fem tydliga
avatarer. Användaren kan följa staden i realtid, pausa, snabbspola, byta väder
och dag/natt, klicka på en invånare för att följa deras behov, mål, relationer
och senaste tanke, samt öppna stadens lagstiftning och händelselogg.

### Invånare

| Namn | Personlighet | Arbete/hobby |
| --- | --- | --- |
| Mira | nyfiken, varm, undersökande | bibliotekarie / läser och forskar |
| Elias | metodisk, ansvarstagande | stadsplanerare / bygger och röstar |
| Noor | social, kreativ, spontan | kulturproducent / musik och samtal |
| Liv | skeptisk, empatisk, principfast | lärare / pluggar och undervisar |
| August | tävlingsinriktad, uppfinningsrik | reparatör / teknik och trädgård |

Varje agent har behov (sömn, energi, hunger, socialt, trygghet, nyfikenhet),
personliga mål, minnen, relationer och en kö av konkreta aktiviteter.

## Arkitektur

- `simulering.html`: sidans semantiska shell, navigation, HUD, paneler och
  fallback-text.
- `simulering.css`: sidans mörka observatorieidentitet, responsiva paneler,
  statuschips och tillgängliga kontroller.
- `simulering.js`: en liten ES-modul utan byggsteg. Innehåller stadens data,
  simuleringstakt, utility-beslut, rörelse, väder/tid, Three.js-scene och
  UI-bindningar.
- `simulering-agents.js`: agentprofiler, behovsmodell, relationer, minne,
  samtal och Qwen-adapter. Adapter använder OpenAI-kompatibelt `/v1/chat/completions`
  och tillåter konfigurerbar origin via `localStorage`.
- befintlig `style.css`: endast en nav-länk läggs till på befintliga sidor;
  övriga visuella regler lämnas orörda.

Dataflöde: simulation tick → behov/utility → aktivitet och destination →
Three.js-position/UI → periodisk Qwen-planering när modellen svarar. Qwen får
endast strukturerad agentkontext och måste returnera ett validerbart JSON-objekt;
ogiltiga eller långsamma svar faller tillbaka till lokal utility-AI.

## Visuellt system

- Färger: `#090d16` natt, `#122338` skymning, `#f3c98b` gatlyktor,
  `#75d6c7` levande signal, `#e97d68` händelse, `#e9edf5` text.
- Typografi: befintlig sajttyografi i navigationen; kondenserad monospace för
  simulatorstatus och en stor sans-serif rubrik för observatoriekänslan.
- Signatur: ett subtilt “city pulse” i kartans ljus och eventflöde, där varje
  agents handling syns som en kort, färgad tråd mellan platser.
- Interaktion: klicka agent, plats eller event; pausa och hastighet; väder;
  dag/natt; tangentbordsfokus och reduced-motion stöd.

## Robusthet och säkerhet

Sidan får inte kräva att en lokal server är publik eller att hemligheter finns i
frontend. Standardläget är lokal simulering med status “Qwen väntar”; endpoint
kan anges av användaren i inställningspanelen och fel visas som en återhämtad
modellstatus, aldrig som ett trasigt UI. Externa CDN-resurser behåller en
textuell fallback om Three.js inte laddas.

## Verifiering

Verifiera statiskt att navigationen finns på startsidan och simuleringen att
alla fem profiler, behov, aktiviteter och omröstningsdata finns. Starta en lokal
HTTP-server och kör browserkontroll för desktop och mobil: sidan laddar utan
console-fel, WebGL-scenen renderar, kontrollerna ändrar state, avatarpanelen
öppnas, Qwen-fel ger fallback och `prefers-reduced-motion` respekteras.
