# Personal Finance (JavaScript)

🇧🇷 [Português](README.pt-BR.md) · 🇺🇸 English

A web app to track monthly income and expenses, built with **plain JavaScript** (no frameworks, no libraries). Data stays in the browser only, using `localStorage`.

![Desktop screenshot](docs/desktop.png)

## What it does

- Records income and expenses with description, amount, date and category
- Shows the month balance and a bar with the share of income already spent
- Donut chart of spending by category, drawn directly on `<canvas>`
- Monthly spending limit, with a warning when exceeded
- Month navigation, search and filters by type and category
- Delete with an **undo** option
- Export the month as CSV (opens directly in Excel)
- Automatic light and dark theme, following the system
- Works on mobile

## Technologies

- HTML, CSS and JavaScript (ES modules, no build step)
- Node.js `node:test` for the logic tests
- No dependencies

## Structure

```
index.html
css/style.css
js/
├── finance.js      # business rules (pure, no DOM): amounts, dates, filters, reports, CSV
├── storage.js      # reads and writes localStorage, with error handling
├── chart.js        # donut chart on canvas
├── sample-data.js  # sample data
└── app.js          # interface: events and screen updates
tests/finance.test.js
```

## Design decisions

- **Logic separated from the interface.** Everything that is a rule (computing balance, validating an entry, filtering, generating CSV) lives in `finance.js`, which never touches the DOM or `localStorage`. It therefore runs in Node and is tested without opening a browser.
- **Money in cents.** Amounts are integers, never decimals, to avoid errors like `0.1 + 0.2 = 0.30000000000000004`. Inputs such as `1.234,56` and `R$ 10` are converted by a custom parser, and half a cent is rejected instead of rounded.
- **No HTML injection.** User-typed text enters the page with `textContent`, never `innerHTML`.
- **Safe CSV.** Cells starting with `=`, `+`, `-` or `@` get an apostrophe, so Excel does not run them as formulas.
- **Corrupted data does not break the app.** When reading `localStorage`, each item is validated and invalid ones are discarded.
- **Accessibility.** Visible keyboard focus, labels on every field, announcements in `aria-live` regions, reviewed contrast in both themes and support for `prefers-reduced-motion`. When an item is deleted, focus moves to the list heading.

## Running

Since the code uses ES modules, the browser must open the page through a local server (opening `index.html` directly from disk does not work).

**With VS Code:** install the *Live Server* extension, right-click `index.html` and choose *Open with Live Server*.

**With Node.js:**

```bash
npm start
```

The first time, click **Load sample data** (*Carregar dados de exemplo*) to see the app filled in.

## Tests

```bash
npm test
```

They cover amount conversion, dates, entry validation, filters (with accent-insensitive search), reports by category, spending limit, CSV and the sample data.

## Publishing on GitHub Pages

1. In the repository, open **Settings > Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select the `main` branch and the `/ (root)` folder and click **Save**.
4. After a minute or two, the app is live at `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.

## Next steps

- [ ] Edit an existing entry
- [ ] Recurring entries (rent, subscriptions)
- [ ] Compare the current month with the previous one
- [ ] React Native version, reusing `finance.js`
