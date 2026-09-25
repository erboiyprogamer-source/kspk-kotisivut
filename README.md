# K-S-P-K Minecraft Official — kotisivut

Staattinen sivusto kanavalle: videot, galleria, serveri, uNmINeD-maailmankartta
sekä Google Docs -linkit ja kirjanpito.

Ei build-vaihetta, ei riippuvuuksia — pelkkää HTML/CSS/JS.

## Rakenne

```
index.html          Etusivu (hero, nostot, uusimmat videot)
videot.html         Videot + suodattimet
galleria.html       Kuvagalleria + lightbox
serveri.html        Serverin IP, säännöt, aikajana
kartta.html         uNmINeD-kartta upotettuna
projektit.html      Google Docs -linkit + kirjanpitotaulukko
tietoa.html         Kanavan esittely + yhteydenottolomake
404.html            Virhesivu
_template.html      Pohja uusille sivuille

assets/css/style.css   Kaikki tyylit
assets/js/site.js      ASETUKSET + Google Docs -linkit + jaettu navi & footer
assets/js/main.js      Scroll-animaatiot ja efektit
assets/img/            Kuvat (nyt paikkamerkkejä)
kartta/                uNmINeD-export tähän
```

## Muokkaus

Kaikki perusasetukset ovat yhdessä paikassa: **`assets/js/site.js`**
→ kanavan nimi, YouTube-linkki, Discord, serverin IP, sähköposti.

### Google Docs -linkkien lisääminen

Samassa tiedostossa on lista `SITE.docs`. Lisää rivi:

```js
{ type:'doc', name:'Otsikko', desc:'Lyhyt kuvaus', url:'https://docs.google.com/...' }
```

`type` on `doc`, `sheet`, `slide`, `form` tai `drive` — se valitsee ikonin ja
merkin. Kortti ilmestyy sivulle `projektit.html` automaattisesti.

### Uuden sivun lisääminen

1. Kopioi `_template.html` → esim. `tapahtumat.html`
2. Vaihda `<title>` ja `<meta name="description">`
3. Lisää `site.js`:n `SITE.pages`-listaan rivi:
   ```js
   { href:'tapahtumat.html', label:'Tapahtumat', foot:'Yhteisö' }
   ```

Navi, footer ja aktiivinen linkki päivittyvät itsestään.

### Animaatiot

Lisää mihin tahansa elementtiin:

| Attribuutti | Vaikutus |
|---|---|
| `data-reveal` | Liukuu esiin alhaalta |
| `data-reveal="left"` / `"right"` / `"zoom"` / `"clip"` | Muut suunnat |
| `data-parallax="0.08"` | Liikkuu skrollatessa |
| `data-count="120"` | Laskee numeron ylös |
| `data-copy="teksti"` | Kopioi leikepöydälle |
| luokka `tilt` | 3D-kallistus hiirellä |

Kaikki animaatiot kytkeytyvät pois, jos käyttäjän järjestelmässä on
*reduce motion* päällä.

## Kartan lisääminen

Katso `kartta/README.md`.

## Julkaisu (GitHub Pages)

Repon *Settings → Pages → Source: Deploy from a branch → main / (root)*.
Tiedosto `.nojekyll` on jo mukana, joten alaviivalla alkavat tiedostot
(kuten `_template.html`) toimivat.

## Paikallinen esikatselu

```bash
python3 -m http.server 8000
# → http://localhost:8000
```
