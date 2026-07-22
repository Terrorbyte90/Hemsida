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
style.css / app.js      Delad design och interaktion för alla sidor
```

## Utveckla lokalt

Ingen byggprocess krävs.

```
python3 -m http.server 8000
```

## Deploy

GitHub Pages, servad från `main`-branchens rot. Push till `main` = live.
