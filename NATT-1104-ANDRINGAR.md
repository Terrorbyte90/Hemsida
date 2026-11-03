# Natt 1104 — ändringar på tedsvard.se

Datum: 2026-11-04
Gren: `natt-1104`

## Sammanfattning

- Gjorde en genomgång av webbplatsens 19 HTML-sidor, delade CSS/JavaScript, README och sitemap.
- Uppdaterade startsidans budskap så erbjudandet blir tydligare: AI-agenter, automation, röst, video och iOS-appar.
- Lade till en ny abstrakt heroillustration utan text eller logotyper, optimerad till WebP (cirka 42 KB).
- Lade till/normaliserade beskrivande metadata, author- och Twitter-kort på sidor som saknade dem.
- Tog bort eller generaliserade intern driftinformation och specifika modell-/serverdetaljer som inte bör publiceras.
- Bytte ut inaktuella, alltför exakta anspråk som “Tjugofem system” och “fyra agenter” där innehållet beskriver roller snarare än en stabil offentlig siffra.
- Uppdaterade sitemapens startsidedatum till 2026-11-04.
- README förtydligar att repot inte ska innehålla hemligheter, interna adresser eller privat data.

## Per sida/område

- `index.html`: tydligare positionering och primär uppmaning (“Prata om ett projekt”), heroillustration och ny beskrivning.
- `projekt.html`: mer hållbar beskrivning av AI-teamet och neutralare rubrik utan föränderlig totalsiffra.
- `labb.html`: anonymiserad och mer korrekt beskrivning av roller, skyddsräcken och privat åtkomst.
- `om-mig.html`: tidslinjetext och agentsystemtext uppdaterade utan specifika interna modellnamn.
- `kurser/ai-landskapet.html`, `kurser/ai-sakerhet.html`, `kurser/hermes-agentsystem.html`: intern drift- och modellreferens generaliserad där den förekom i offentlig HTML.
- `forskning.html`, `nyheter.html`, `luna.html`, `poddar.html`, `rostlabb.html`, `telefoni.html`, `simulering.html`, `kurser.html`, kurskapitlen och omdirigeringarna: kompletterade med standardiserad metadata där den saknades.
- `style.css`: hero kan använda den nya illustrationen, med läsbar gradient, responsivt beteende och nya CTA-knappar.
- `sitemap.xml`: startsidan markerad som ändrad 2026-11-04.

## Verifierat

- Alla 19 HTML-sidor parsades för lokala länkar och bildreferenser.
- Inga brutna lokala länkar eller bilder utan alt-text hittades i kontrollen.
- `git diff --check` passerade.
- JavaScript-testerna passerade: 2 testfiler, 2 tester, 0 fel.

## Ted bör titta på

1. Att heroillustrationen känns rätt i mobil och mörkt/ljust läge.
2. Att startsidans CTA ska leda till kontaktformulär eller till en specifik kanal när den slutliga kontaktvägen är bestämd.
3. Om de publika kurserna ska behålla sina modellnamn och prisexempel eller få en separat faktagranskning inför publicering.
4. Om nyhetssidan ska få en ny redaktionell uppdatering med konkreta, daterade projektposter.

Ingen push gjordes. Ändringarna är endast committade på `natt-1104`.
