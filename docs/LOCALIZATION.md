# Localization audit — 22 October 2026

The native app now bundles English, Russian, Spanish, Japanese, Simplified Chinese,
Brazilian Portuguese, German, French, Korean, Polish and Traditional Chinese.
All 573 keys per language (6,303 locale entries, plus plural branches) received a
complete agent review; each new locale was reviewed by an agent other than its author.
Traditional Chinese uses Taiwanese wording. See the native repository's
`docs/localization-review.md` for coverage, corrections and regression checks.

The initial five-language audit:
The audit found 30 Russian keys and 33 keys in each of Spanish/Japanese/Chinese missing,
including nonlinguistic format strings, plus four literal keys absent from the catalog.
These gaps are filled. New feedback copy is translated into all five languages.
`playdamnit-ios/scripts/check-localizations.py` runs with lint and rejects missing languages
or localized literal keys missing from the catalog. Game names, user text and YouTube are
not translated. Coverage checks do not replace review by native speakers.

The website currently registers English only. It has an i18next catalog and locale-aware
date helper, but no other complete UI or legal catalogs. Adding native languages to web
is a separate translation rollout; do not claim the website supports them today.
The shared changelog API serves all eleven native languages with English fallback,
including regional aliases for Brazilian Portuguese and both Chinese scripts.
The API contract and old locale responses are unchanged. All 42 old locale/platform
responses matched product source `26dd731` exactly in a targeted compatibility check.
The native client models are unchanged from TestFlight 1.0.1 (100), source `82d39db`.

## Language prioritization that led to this rollout

Steam's September 2026 optional anonymous survey is a useful gaming-audience proxy,
not a measurement of Playdamnit's iOS audience or expected conversion.
[Valve's source](https://store.steampowered.com/hwsurvey/Steam-Hardware-Software-Survey-Welcome-to-Steam)
reports these currently missing interface languages:

| Priority | Language                        | Steam interface share |
| -------- | ------------------------------- | --------------------- |
| First    | Brazilian Portuguese (`pt-BR`)  | 3.70%                 |
| First    | German (`de`)                   | 2.48%                 |
| First    | French (`fr`)                   | 2.08%                 |
| Second   | Polish (`pl`)                   | 1.49%                 |
| Second   | Korean (`ko`)                   | 1.37%                 |
| Second   | Traditional Chinese (`zh-Hant`) | 1.27%                 |
| Later    | Turkish (`tr`)                  | 1.09%                 |

The six prioritized native languages are implemented in this rollout. Web/native
parity and App Store listing translations remain separate work. Portuguese, German
and French represent another 8.26 percentage points of surveyed Steam
interface preferences. Spanish already covers Spain and much of Latin America;
review regional wording rather than count them as unrelated new translations.
Choose subsequent languages using App Store Connect territory/product-page metrics
and actual feedback, including whether the App Store listing is localized. Localize
metadata, onboarding, authentication, errors, settings, plurals and release notes;
verify layout and dates in each language before advertising support.

Valve also recommends prioritizing using observed regional demand rather than
assuming every translation has the same return:
[Steamworks localization guidance](https://partner.steamgames.com/doc/store/localization).
