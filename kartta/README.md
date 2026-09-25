# kartta/ — uNmINeD-maailmankartta

Kopioi tähän kansioon **koko** uNmINeD:n web-exportin sisältö:

```
kartta/
├── index.html
├── lib/
├── tiles/
├── playerimages/
└── (muut js-tiedostot)
```

Polut exportissa ovat suhteellisia, joten pelkkä `index.html` ei riitä —
kaikki alikansiot on kopioitava mukana.

Kun tiedostot ovat paikallaan, kartta näkyy automaattisesti sivulla
`kartta.html` upotettuna ja aukeaa myös suoraan osoitteesta `/kartta/`.

> **Huom:** `tiles/`-kansio voi olla satoja megatavuja. GitHub-repon
> raja on 100 MB per tiedosto ja repoa suositellaan pidettävän alle 1 GB.
> Jos kartta on iso, vie se erilliselle webhotellille ja vaihda osoite
> tiedostosta `assets/js/site.js` (`mapPath`) sekä `kartta.html`:n iframe-src.
