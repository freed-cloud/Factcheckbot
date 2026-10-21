# Werkafspraken voor Claude Code

- De eigenaar is geen programmeur. Praat en schrijf in het Nederlands, in gewone taal, en leg stap voor stap uit wat hij zelf moet doen.
- Draai `npm run check` (typecontrole en tests) voordat je iets oplevert. Alle tests moeten slagen; de tests werken zonder internet (`test/helpers.ts` bootst Meta en Perplexity na).
- Lever wijzigingen op als pull request. Na het samenvoegen in `main` zet Cloudflare de bot vanzelf online.
- Geheimen nooit in de code of in GitHub. Een nieuw geheim komt in `src/env.ts` (`REQUIRED_SECRETS`), in `.dev.vars.example` en in de README.
- Privacy: sla geen berichtinhoud op. Log nooit berichtteksten, telefoonnummers, BSUID's, bericht-ID's of foutmeldingen van buitenaf; alleen gebeurtenissen, aantallen, statuscodes en eigen hints via `src/log.ts`. Een test in `test/worker.test.ts` controleert dit.
- Eén antwoord per check (elk extra WhatsApp-bericht kost geld), hooguit 900 tekens, in de vaste vorm uit `src/reply.ts`.
- AI: de Perplexity Agent API (`POST https://api.perplexity.ai/v1/agent`), niet de oude Sonar API. Bronnen alleen uit `search_results`, nooit links uit de tekst van de AI.
- Gebruikers met een WhatsApp-gebruikersnaam hebben soms geen telefoonnummer in de webhook; antwoord dan via `recipient` met de BSUID (`src/whatsapp.ts`).
