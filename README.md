# Świąteczna Paczka Czaru Bajek

Strona, na której rodzice Klubu Dziecięcego [Czar Bajek](https://czar-bajek.pl/) zapisują się na dary do [Szlachetnej Paczki](https://www.szlachetnapaczka.pl/). Wolna pozycja ma przycisk „Dopisuję się”. Zajęta pokazuje, kto się wpisał, i nie przyjmuje kolejnego zapisu.

Lista darów jest w [`data/pozycje.json`](data/pozycje.json) (tablica pól `id`, `ico`, `name`, `cat`). Strona grupuje pozycje po `cat`. Zapisy rodziców są w `data/zapisy.json` na gałęzi `main`. Ten plik **nie jest zmieniany w tym PR** — na Vercelu endpoint czyta i dopisuje go przez GitHub Contents API, więc prawdziwe zapisy zostają.

## Format zapisów

Kluczem jest `id` pozycji. Wartość ma `name`, `child` i `at` (czas ISO):

```json
{
  "makaron": {
    "name": "Anna Kowalska",
    "child": "Zosia, Biedronki",
    "at": "2026-11-23T18:00:00.000Z"
  }
}
```

Puste dziecko to `""`. Przy dwóch osobach naraz wygrywa pierwszy zapis (GitHub odrzuca drugi po `sha`). Drugi dostaje `409` i świeżą mapę zapisów.

## API

`GET /api/zapisy` — obiekt zapisów, tak jak w pliku.

`POST /api/zapisy` z JSON `{ "id", "name", "child" }`:

- `200` `{ "ok": true, "data": { …cała mapa… } }`
- `409` `{ "error": "taken", "data": { …cała mapa… } }` gdy pozycja już jest zajęta

Strona bierze zapisy tylko z tego API, nie z pliku wbudowanego w deploy.

## Lokalnie, bez tokenu

```bash
npm start
```

[http://localhost:3000](http://localhost:3000) zapisuje do lokalnego `data/zapisy.json`. `npm start` włącza tryb plikowy (`LOCAL_MODE=1`), nawet gdy w środowisku jest token. `npm test` sprawdza wyścig dwóch zapisów.

## Edycja darów

Zmieniaj nazwy i emoji w `data/pozycje.json`. Pole `cat` jest nagłówkiem sekcji — pozycje z tym samym `cat` stoją razem, w kolejności z pliku. `id` zostaw, jeśli ktoś już się na nie zapisał. Lista jest z formularza rodziny: najważniejsze potrzeby (odkurzacz i ciepłe ubrania), żywność trwała i środki czystości.

Commit listy darów (albo czegokolwiek poza samym `data/zapisy.json`) przebudowuje Vercela. Sam zapis rodzica commituje wyłącznie `data/zapisy.json` i **nie** przebudowuje strony.

## Wdrożenie na Vercel

Projekt jest już podpięty (framework **Other**, bez komendy build). Nie ustawiaj w panelu **Ignored Build Step** — puste pole zostawia `ignoreCommand` z `vercel.json`. Skrypt pomija build, gdy commit rusza tylko `data/zapisy.json`.

Zmienne (Production):

| Zmienna | Wartość |
| --- | --- |
| `GITHUB_TOKEN` | Fine-grained PAT tylko do tego repozytorium, Contents: Read and write, z prawem commitowania na `main`. |
| `GITHUB_REPO` | `paymove-tom/szlachetna-paczka` |
| `GITHUB_BRANCH` | `main` |

Tokenu nie commitujemy. Nazwy są w [`.env.example`](.env.example).

## Logotypy

Pliki w `assets/logos/` są oryginałami, bez kadrowania i bez zmiany proporcji:

- Czar Bajek — `https://czar-bajek.pl/images/grafika/czar-bajek-logo.png`
- Szlachetna Paczka — `https://www.szlachetnapaczka.pl/wp-content/themes/szp-wp-theme/images/header-v2/logo-szlachetna-paczka.png`

Czcionki Fraunces i Nunito (SIL Open Font License) są w `assets/fonts/`.
