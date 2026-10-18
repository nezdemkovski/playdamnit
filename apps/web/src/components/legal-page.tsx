import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Separator } from "@/components/ui/separator";
import { Namespace } from "@/i18n";
import { LegalDocument } from "@/lib/enums";
import { LEGAL_CONTACT } from "@/lib/legal";

const DOCUMENT_ROUTES = {
  [LegalDocument.Privacy]: "/privacy",
  [LegalDocument.Terms]: "/terms",
  [LegalDocument.Support]: "/support",
} as const;

type Section = {
  id: string;
  title: string;
  paragraphs: string[];
  links?: { label: string; href: string }[];
};

/** One reading layout for the public policies and support information. */
export function LegalPage({ document }: { document: LegalDocument }) {
  const { t } = useTranslation(Namespace.Legal);
  const sections = t(`${document}.sections`, { returnObjects: true }) as Section[];
  return (
    <article className="mx-auto max-w-3xl py-6 sm:py-10">
      <title>{`${t(`${document}.title`)} · Play, damn it!`}</title>
      <nav aria-label={t("navigation")} className="mb-8 flex flex-wrap gap-x-6 gap-y-3 text-sm">
        {Object.values(LegalDocument).map((item) => (
          <Link
            key={item}
            to={DOCUMENT_ROUTES[item]}
            aria-current={item === document ? "page" : undefined}
            className="text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground"
          >
            {t(`${item}.title`)}
          </Link>
        ))}
      </nav>
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t(`${document}.title`)}</h1>
        <p className="max-w-prose text-base leading-7 text-muted-foreground">
          {t(`${document}.intro`)}
        </p>
        <p className="text-sm text-muted-foreground">{t("updated")}</p>
      </header>
      <Separator className="my-8" />
      <section aria-labelledby="operator" className="flex flex-col gap-2 text-sm leading-6">
        <h2 id="operator" className="text-base font-semibold">
          {t("operatorTitle")}
        </h2>
        <p>{LEGAL_CONTACT.name}</p>
        <p className="text-muted-foreground">{t("registration", { ico: LEGAL_CONTACT.ico })}</p>
        <p className="text-muted-foreground">{LEGAL_CONTACT.address}</p>
        <a href={`mailto:${LEGAL_CONTACT.email}`} className="w-fit underline underline-offset-4">
          {LEGAL_CONTACT.email}
        </a>
      </section>
      <div className="mt-10 flex flex-col gap-10">
        {sections.map((section) => (
          <section key={section.id} aria-labelledby={section.id} className="flex flex-col gap-3">
            <h2 id={section.id} className="scroll-mt-6 text-lg font-semibold">
              {section.title}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-base leading-7 text-muted-foreground">
                {paragraph}
              </p>
            ))}
            {section.links && (
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <Separator className="my-8" />
      <section aria-labelledby="contact" className="flex flex-col gap-3">
        <h2 id="contact" className="text-lg font-semibold">
          {t("contactTitle")}
        </h2>
        <p className="text-base leading-7 text-muted-foreground">{t("contactText")}</p>
        <a href={`mailto:${LEGAL_CONTACT.email}`} className="w-fit underline underline-offset-4">
          {LEGAL_CONTACT.email}
        </a>
      </section>
    </article>
  );
}
