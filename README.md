# Ted Svärd — portfolio

Personlig portfolio för Ted Svärd: AI- och iOS-arkitekt. Statisk sajt, ingen byggprocess.

Live: https://tedsvard.se/

## Stack

- Vanilla HTML5, CSS3, JavaScript — inga ramverk, inget byggsteg.
- Typsnitt: Instrument Serif + Instrument Sans (Google Fonts).
- Native CSS scroll-driven animations (`animation-timeline: view()`) för scroll-reveals,
  med en JS/IntersectionObserver-fallback för webbläsare utan stöd.
- Leias statusruta (`labb.html`, startsidan) läser `leia.json` från grenen `status` via
  raw.githubusercontent.com. Leia (lokal modell) skriver texten själv, ett strikt filter på
  servern stoppar allt känsligt, och servern pushar ut filen – den ta## Struktur

```
index.html              Startsida (med Leias live-status)
projekt.html            Alla projekt
labb.html               Labbet: AI-teamet, den lokala modellen och automatiken
telefoni.html           Telefonin: arkitektur, säkerhet och röstprov (assets/voices/telefoni)
forskning.html          Forskning: Eon v6, energieffektiv AI, AI från grunden, agenter i drift
poddar.html / player.js Poddar med egen spelare (Dystopia AI, Övervakad, AI-Zonen, AI-Pulsen)
rostlabb.html           Visualisering av poddflödet
kurser.html, kurser/    5 kurser, flera kapitel per sida
simulering.html         Stadssimuleringen (pausad)
om-mig.html             Om mig
bland/                  Lösenordsskyddad demo
fable.html, ornith.html Omdirigeringar till labb.html
style.css / app.js      Delad design och interaktion
```

e `valkompass-research.md`.

## Utveckla lokalt

Ingen byggprocess krävs.

```
python3 -m http.server 8000
```

## Deploy

GitHub Pages, servad från `main`-branchens rot. Push till `main` = live.
