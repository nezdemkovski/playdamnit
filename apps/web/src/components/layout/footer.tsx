import { Link } from "@tanstack/react-router";
import { Trans, useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="mt-16 flex flex-col gap-2 border-t border-white/5 py-8 text-xs text-dimmed sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <span>{t("footer.copyright", { year: new Date().getFullYear() })}</span>
        <Link to="/changelog" className="hover:text-white">
          {t("footer.changelog")}
        </Link>
        <Link to="/privacy" className="hover:text-foreground">
          {t("footer.privacy")}
        </Link>
        <Link to="/terms" className="hover:text-foreground">
          {t("footer.terms")}
        </Link>
        <Link to="/support" className="hover:text-foreground">
          {t("footer.support")}
        </Link>
      </div>
      <div>
        <Trans
          i18nKey="footer.credit"
          components={{
            igdb: (
              <a
                href="https://www.igdb.com"
                target="_blank"
                rel="noreferrer"
                className="font-semibold hover:text-white"
              />
            ),
          }}
        />
      </div>
    </footer>
  );
}
