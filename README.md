# Factcheckbot

Een Nederlandstalige WhatsApp-bot die beweringen checkt. Iemand stuurt een twijfelachtig bericht naar het WhatsApp-nummer van de bot. De bot laat een AI (Perplexity) op internet zoeken en stuurt één antwoord terug: een oordeel, een korte uitleg en de bronnen.

De bot draait gratis op Cloudflare Workers. Elke wijziging die in de `main`-branch van deze repository komt, zet Cloudflare vanzelf online.

## Wat de bot doet

- **Tekstbericht:** de bot checkt de belangrijkste bewering en stuurt één antwoord van hooguit 900 tekens terug, bijvoorbeeld:

  ```text
  *Oordeel:* ❌ Klopt niet

  *Uitleg:* Er is geen wetenschappelijk bewijs dat 5G corona veroorzaakt of verspreidt. Virussen verspreiden zich via mensen, niet via radiogolven.

  *Bronnen:*
  1. https://voorbeeld.nl/bron-1
  2. https://voorbeeld.nl/bron-2

  _Automatische AI-check, kan fouten bevatten._
  ```

  Het oordeel is altijd een van: **Klopt**, **Deels waar of misleidend**, **Klopt niet** of **Niet te controleren**. De sterretjes en lage streepjes zorgen in WhatsApp voor vet en schuin.
- **Foto, video, spraakbericht of sticker:** de bot zegt dat hij alleen tekst kan checken.
- **Groet of bericht zonder bewering** (zoals "Hoi" of "Hoe werkt dit?"): de bot legt in twee zinnen uit hoe hij werkt.
- **Terwijl de AI zoekt**, ziet de gebruiker "aan het typen…".
- **Duurt de check langer dan 20 seconden**, dan stuurt de bot een kort excuusbericht.
- **Reactie-emoji's** op een antwoord negeert de bot.

## Wat jij nog moet doen

Doe deze stappen in deze volgorde. Op een laptop of pc gaat het het makkelijkst. Onderweg krijg je vijf codes: de **geheimen**. Bewaar ze even op een veilige plek, want in stap 4 vul je ze in bij Cloudflare. Zet ze nooit in GitHub.

| Geheim | Wat het is | Waar je het vindt |
| --- | --- | --- |
| `PERPLEXITY_API_KEY` | sleutel voor de AI | stap 1 |
| `WHATSAPP_PHONE_NUMBER_ID` | nummer van je WhatsApp-lijn bij Meta (niet je telefoonnummer) | stap 2 |
| `WHATSAPP_TOKEN` | vaste toegangscode voor WhatsApp | stap 2 |
| `META_APP_SECRET` | geheim van je Meta-app | stap 2 |
| `WHATSAPP_VERIFY_TOKEN` | een lange zin die je zelf verzint | stap 2 |

### Stap 0: de pull request samenvoegen

Voeg de pull request met de eerste versie samen (**Merge**) in de GitHub-app of op github.com. Pas dan staat de code in `main` en kan Cloudflare hem online zetten.

### Stap 1: Perplexity

1. Maak een account bij Perplexity en ga naar de **API**-instellingen.
2. Zet er een klein tegoed op.
3. Maak een API-sleutel. Dat is je `PERPLEXITY_API_KEY`.

### Stap 2: Meta en WhatsApp

1. Ga naar [developers.facebook.com](https://developers.facebook.com), maak een ontwikkelaarsaccount en maak in het App Dashboard een nieuwe app met de use case **Connect with customers through WhatsApp**. Kies of maak daarbij een bedrijfsportfolio.
2. Open in je app **WhatsApp > API Setup**. Daar staat een gratis testnummer.
   - Voeg bij **To** je eigen mobiele nummer toe als ontvanger en bevestig het met de code die je krijgt. Het testnummer antwoordt alleen aan nummers in deze lijst.
   - Het lange getal bij **Phone number ID** is je `WHATSAPP_PHONE_NUMBER_ID`.
3. De token op die pagina verloopt na een dag. Maak daarom een vaste token:
   - Ga naar [business.facebook.com](https://business.facebook.com) > **Settings** (Bedrijfsinstellingen) > **Users** > **System users** en voeg een systeemgebruiker toe met de rol **Admin**.
   - Kies **Assign assets** en geef de systeemgebruiker **Full control** over je app en over je WhatsApp-account.
   - Kies **Generate token**, selecteer je app, kies als vervaldatum **Never** en vink de rechten `business_management`, `whatsapp_business_messaging` en `whatsapp_business_management` aan.
   - Kopieer de token meteen; je ziet hem maar één keer. Dat is je `WHATSAPP_TOKEN`.
4. Open in je app **App settings > Basic** en kies bij **App secret** de knop **Show**. Dat is je `META_APP_SECRET`.
5. Verzin een lange, willekeurige zin, bijvoorbeeld `paarse-fiets-zingt-om-middernacht-42`. Dat is je `WHATSAPP_VERIFY_TOKEN`.

### Stap 3: Cloudflare koppelen aan GitHub

Hierna zet elke wijziging in `main` de bot vanzelf online.

1. Maak een gratis account op [dash.cloudflare.com](https://dash.cloudflare.com).
2. Ga naar **Workers & Pages** > **Create application** en kies **GitHub** (soms heet het *Import a repository*).
3. Koppel je GitHub-account en geef Cloudflare toegang tot de repository **Factcheckbot**.
4. Vul de instellingen zo in:
   - **Project name:** `factcheckbot`, precies zo en in kleine letters. Deze naam moet gelijk zijn aan `name` in `wrangler.jsonc`, anders mislukt de build.
   - **Build command:** leeg laten.
   - **Deploy command:** `npx wrangler deploy` (staat er meestal al).
   - **Branch:** `main`.
5. Kies **Save and Deploy** (of **Deploy**) en wacht tot de build klaar is. Je krijgt een adres zoals `https://factcheckbot.<jouw-naam>.workers.dev`.

### Stap 4: de vijf geheimen invullen

1. Open in Cloudflare je Worker **factcheckbot** > **Settings** > **Variables and Secrets**.
2. Kies **Add**, zet **Type** op **Secret**, vul de naam (bijvoorbeeld `WHATSAPP_TOKEN`) en de waarde in, en sla op. Doe dit voor alle vijf de geheimen uit de tabel.
3. Open het adres van je Worker in de browser. Je ziet dan:
   - of alle vijf de geheimen zijn ingesteld (en zo niet, welke nog ontbreken);
   - het **webhookadres** dat je in stap 5 nodig hebt. Dat is het adres van je Worker met `/webhook` erachter.

### Stap 5: de webhook koppelen bij Meta

1. Open in je Meta-app **WhatsApp > Configuration**.
2. Vul bij **Callback URL** het webhookadres van stap 4 in en bij **Verify token** dezelfde zin als je `WHATSAPP_VERIFY_TOKEN`. Kies **Verify and save**.
3. Zoek bij **Webhook fields** het veld `messages` en kies **Subscribe**.

### Stap 6: testen

Stuur vanaf je eigen telefoon een bekende hoax naar het testnummer, bijvoorbeeld *"5G-masten verspreiden het coronavirus"*. Binnen een halve minuut hoort het antwoord binnen te zijn. Probeer ook "Hoi" en een foto.

## Instellingen

Deze staan in `wrangler.jsonc`, onder `vars`. Pas je ze aan in `main` (zelf op github.com, of vraag het aan Claude Code), dan staan ze na een minuut of twee online.

| Instelling | Standaard | Wat het doet |
| --- | --- | --- |
| `PERPLEXITY_PRESET` | `low` | Hoe grondig de AI zoekt. Krijg je vaak het excuusbericht dat het checken te lang duurde? Zet hem dan op `fast`. |
| `GRAPH_API_VERSION` | `v26.0` | Versie van de WhatsApp Cloud API. Alleen aanpassen als Meta een versie uitfaseert. |

## Dubbele berichten

Meta stuurt hetzelfde bericht soms twee keer. Om dubbele antwoorden te voorkomen, onthoudt de bot welke berichten al binnen zijn, in een kleine opslag bij Cloudflare (een *Durable Object*, zie `src/seen-messages.ts`).

**Je hoeft hiervoor niets in te stellen.** Cloudflare maakt de opslag zelf aan bij de eerste deploy, en hij valt ruim binnen het gratis plan. Er staat alleen een onherkenbare code (hash) van het bericht-ID in, nooit de tekst of het telefoonnummer. Na twee dagen wordt de code weer verwijderd.

## Privacy

- De bot slaat de inhoud van berichten nergens op.
- In de logs staan alleen gebeurtenissen, aantallen, statuscodes en korte hints. Nooit berichtteksten, telefoonnummers, gebruikers-ID's of bericht-ID's. Een test controleert dit.
- Om een bericht te checken, gaat het langs **Meta** (WhatsApp), **Cloudflare** (waar de bot draait) en **Perplexity** (de AI). Zet dat in je privacyverklaring voordat je de bot openbaar maakt.

## Als het niet werkt

Kijk eerst op het adres van je Worker of alle vijf de geheimen zijn ingesteld. Kijk daarna in de logs: in Cloudflare onder je Worker **factcheckbot**, tabblad **Logs** of **Observability**. Elke regel heeft een `event`, soms met een `hint`.

| Wat je in de logs ziet | Wat er mis is | Wat je doet |
| --- | --- | --- |
| `missing_secrets` | er ontbreken geheimen | vul ze in (stap 4) |
| `webhook_verification_failed` | Meta kan de webhook niet koppelen | de verify token in Meta en bij Cloudflare moet precies gelijk zijn |
| `invalid_signature` | de handtekening van Meta klopt niet | controleer `META_APP_SECRET` |
| `other_number_ignored` | bericht voor een ander WhatsApp-nummer | controleer `WHATSAPP_PHONE_NUMBER_ID` |
| `reply_failed` met code `131030` | je nummer staat niet in de lijst met testontvangers | voeg het toe bij **API Setup** |
| `reply_failed` met code `190` of status `401` | de WhatsApp-token is ongeldig of verlopen | maak een nieuwe token (stap 2) en vul hem opnieuw in |
| `ai_error` | de AI-check ging mis | volg de hint, bijvoorbeeld een verkeerde sleutel of geen tegoed |
| `ai_timeout` | de AI deed er langer dan 20 seconden over | zet `PERPLEXITY_PRESET` op `fast` |
| geen enkele regel bij een bericht | Meta stuurt niets door | controleer stap 5: webhookadres en het veld `messages` |

Plak een foutmelding of een raar antwoord gerust in een Claude Code-sessie; dat is meestal de snelste weg.

**Goed om te weten:** het testnummer van Meta antwoordt alleen aan nummers die je bij **API Setup** hebt toegevoegd. Wil je de bot openstellen voor iedereen, dan heb je een eigen nummer nodig en moet je bedrijf geverifieerd zijn bij Meta.

## Voor ontwikkelaars

```bash
npm install        # pakketten installeren
npm test           # tests draaien (zonder internet)
npm run typecheck  # TypeScript controleren
npm run check      # allebei
npm run dev        # lokaal draaien; zet eerst de geheimen in .dev.vars (zie .dev.vars.example)
```

| Bestand | Wat het doet |
| --- | --- |
| `src/index.ts` | begin: `GET /webhook` (verificatie), `POST /webhook` (berichten) en de beginpagina |
| `src/signature.ts` | controleert de handtekening `X-Hub-Signature-256` van Meta |
| `src/webhook.ts` | haalt de berichten uit een webhook en telt de statusmeldingen |
| `src/bot.ts` | beslist per bericht wat er gebeurt en stuurt precies één antwoord |
| `src/greeting.ts` | herkent groeten zonder de AI te vragen |
| `src/perplexity.ts` | vraagt de Perplexity Agent API om een check en leest het antwoord |
| `src/reply.ts` | vaste teksten en de opmaak van het antwoord (max. 900 tekens) |
| `src/whatsapp.ts` | verstuurt berichten en 'aan het typen…' via de WhatsApp Cloud API |
| `src/seen-messages.ts`, `src/dedup.ts` | herkennen dubbel bezorgde berichten |
| `test/` | tests met nepberichten van Meta en nepantwoorden van Perplexity |

De AI is de Perplexity **Agent API** (`POST https://api.perplexity.ai/v1/agent`), niet de oude Sonar API. De bronnen komen altijd uit het output-item `search_results`, nooit uit de tekst van de AI, zodat er geen verzonnen links in een antwoord kunnen komen.
