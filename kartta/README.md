# kartta/ — uNmINeD-maailmankartat

Tähän tulee **kaksi** kansiota, kumpikin oma uNmINeD-renderöintinsä:

```
kartta/
├── paiva/            ← päiväkuva
│   ├── index.html
│   ├── lib/
│   ├── tiles/
│   └── playerimages/
└── yo/               ← yökuva
    ├── index.html
    ├── lib/
    ├── tiles/
    └── playerimages/
```

Polut exportissa ovat suhteellisia, joten pelkkä `index.html` ei riitä —
kaikki alikansiot on kopioitava mukana.

Kun tiedostot ovat paikallaan, `kartta.html` näyttää ne upotettuna ja
päivä/yö-napit vaihtavat niiden välillä. Kartat aukeavat myös suoraan:

- `.../kspk-kotisivut/kartta/paiva/`
- `.../kspk-kotisivut/kartta/yo/`

## Siirtäminen GitHubiin

`tiles/`-kansiossa on yleensä tuhansia pieniä kuvatiedostoja.
GitHubin **selainlatauksella voi viedä enintään 100 tiedostoa kerrallaan**,
joten isoa karttaa ei kannata yrittää siirtää sitä kautta. Käytä jompaakumpaa:

**GitHub Desktop (helpoin)**
1. Asenna GitHub Desktop ja valitse *Clone repository* → `kspk-kotisivut`
2. Avaa kloonattu kansio ja kopioi karttakansiot paikalleen `kartta/`-kansion alle
3. GitHub Desktopissa: kirjoita commit-viesti → *Commit to main* → *Push origin*

**Komentorivi**
```bash
git clone https://github.com/erboiyprogamer-source/kspk-kotisivut.git
cd kspk-kotisivut
# kopioi kansiot kartta/paiva ja kartta/yo paikalleen
git add kartta
git commit -m "Lisaa uNmINeD-kartat"
git push
```

## Rajat

| Raja | Arvo |
|---|---|
| Yksittäinen tiedosto | 100 Mt |
| Julkaistu Pages-sivusto | 1 Gt |
| Kaistankäyttö | 100 Gt / kk |
| Selainlatauksen tiedostomäärä | 100 / commit |

Jos kartat eivät mahdu näihin rajoihin, vie ne erilliselle palvelulle
(esim. Netlify) ja vaihda osoitteet `assets/js/site.js`-tiedoston
kohtiin `mapDay` ja `mapNight` — kartta.html osaa käyttää myös
täyttä https-osoitetta.
