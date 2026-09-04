# Ted Svärd — portfolio

Personlig portfolio för Ted Svärd: AI- och iOS-arkitekt. Statisk sajt, ingen byggprocess.

Live: https://terrorbyte90.github.io/Hemsida/

## Stack

- Vanilla HTML5, CSS3, JavaScript — inga ramverk, inget byggsteg.
- Typsnitt: Instrument Serif + Instrument Sans (Google Fonts).
- Native CSS scroll-driven animations (`animation-timeline: view()`) för scroll-reveals,
  med en JS/IntersectionObserver-fallback för webbläsare utan stöd.
- En liten, redigerad live-feed (`ornith.html`) hämtar status från en process på min
  egen server (Titan) via `app.js` → `https://169.58.43.27.nip.io/ornith-feed/api/status`.
  Feeden filtrerar bort allt känsligt server-side innan något publiceras.

## Struktur

```
index.html            Startsida
om-mig.html            Om mig
projekt.html           Alla projekt
ornith.html            Live-monitor för min autonoma AI-agent
kurser.html             Kurshubb
kurser/*.html          5 kurser, flera kapitel per sida
poddar.html            Poddar (Övervakad, AI-Zonen) med spelare
    forskning.html          Forskningsspår
    valkompass.html         Transparent valkompass med prioriteringar och kompromissfrågor
    style.css / app.js      Delad design och interaktion för alla sidor
```

Valkompassen är en fristående vanilla-JS-prototyp. Modelltester körs med `node --test valkompass-model.test.js valkompass-100.test.mjs`. Positionsdata är kalibreringsdata tills varje påstående har granskats mot en aktuell primärkälla; se `valkompass-research.md`.

## Kvalitetskontroller

Sajten är statisk och har ingen `package.json`, bundler eller separat TypeScript-kod. CI kör därför samma reproducerbara kontroller som lokalt:

```bash
python3 tools/validate_static.py
find . -name '*.js' -not -path './node_modules/*' -print0 | xargs -0 -n1 node --check
node --test valkompass-model.test.js
```

`projekt.html` har en separat GitHub-verifierad projektsektion. Repo-namn, huvudspråk, beskrivningar och uppdateringsdatum är hämtade från Terrorbyte90:s publika GitHub-metadata; urval, rubriker och övrig presentation är redaktionella formuleringar.

## Utveckla lokalt

Öppna `index.html` direkt i webbläsaren eller servera katalogen med valfri statisk filserver. Ingen simulator eller extern runtime krävs.

```bash
python3 -m http.server 8000
```

## Deploy

GitHub Pages, servad från `main`-branchens rot. Push till `main` = live.
