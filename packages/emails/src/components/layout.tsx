import type { ReactNode } from "react";
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "react-email";

import { color, font, siteName, tagline } from "../theme";

/**
 * Every account email: the mark and an eyebrow, one card with a heading, a few lines and one red
 * button, the raw link for when the button fails, and a footer that says why it came. Dark by
 * design, and it says so, so clients that honour color-scheme don't invert it.
 */
export function Layout({
  siteUrl,
  preview,
  eyebrow,
  heading,
  action,
  url,
  note,
  children,
}: {
  siteUrl: string;
  /** The line inbox lists show after the subject */
  preview: string;
  eyebrow: string;
  heading: string;
  /** The button's label */
  action: string;
  url: string;
  /** Small print under the button: how long the link lasts, what to do if it wasn't you */
  note: string;
  children: ReactNode;
}) {
  const host = new URL(siteUrl).host;
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="dark" />
        <meta name="supported-color-schemes" content="dark" />
        {/* Apple Mail and a few others load web fonts; the rest use the fallbacks in theme.ts */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;700&family=Archivo+Black&family=JetBrains+Mono:wght@700&display=swap"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* The name, once, by the mark; the plain-text part keeps the name and skips the image */}
          <Section style={styles.header}>
            <Row>
              <Column width="52" data-skip-in-text="true">
                <Link href={siteUrl}>
                  <Img
                    src={`${siteUrl}/email/logo.png`}
                    width="40"
                    height="40"
                    alt=""
                    style={styles.logo}
                  />
                </Link>
              </Column>
              <Column>
                <Link href={siteUrl} style={styles.wordmark}>
                  {siteName}
                </Link>
              </Column>
            </Row>
          </Section>
          <Section style={styles.card}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Heading as="h1" style={styles.heading}>
              {heading}
            </Heading>
            {children}
            <Button href={url} style={styles.button}>
              {action}
            </Button>
            <Text style={styles.note}>{note}</Text>
            <Section data-skip-in-text="true">
              <Hr style={styles.rule} />
              <Text style={styles.fallbackLabel}>
                Button not working? Paste this into your browser:
              </Text>
              <Link href={url} style={styles.fallbackLink}>
                {url}
              </Link>
            </Section>
          </Section>
          <Section style={styles.footer}>
            <Text style={styles.footerBrand}>{tagline.toUpperCase()}</Text>
            <Text style={styles.footerText}>
              You got this because this address belongs to an account on{" "}
              <Link href={siteUrl} style={styles.footerLink}>
                {host}
              </Link>
              .
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** A paragraph of the card */
export function Paragraph({ children }: { children: ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

/** An address or a name inside a paragraph, set off the way the site sets off data */
export function Data({ children }: { children: ReactNode }) {
  return <span style={styles.data}>{children}</span>;
}

const styles = {
  body: {
    backgroundColor: color.background,
    color: color.foreground,
    fontFamily: font.sans,
    margin: 0,
    padding: "32px 0",
  },
  container: {
    maxWidth: "520px",
    margin: "0 auto",
    padding: "0 16px",
  },
  header: { padding: "0 0 20px" },
  logo: { display: "block", border: 0 },
  wordmark: {
    fontFamily: font.display,
    fontSize: "20px",
    lineHeight: "24px",
    fontWeight: 900,
    color: color.foreground,
    textDecoration: "none",
  },
  card: {
    backgroundColor: color.card,
    border: `1px solid ${color.border}`,
    padding: "32px 28px",
  },
  eyebrow: {
    fontFamily: font.mono,
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: color.signal,
    margin: "0 0 12px",
  },
  heading: {
    fontFamily: font.display,
    fontSize: "30px",
    lineHeight: "34px",
    fontWeight: 900,
    color: color.foreground,
    margin: "0 0 16px",
  },
  paragraph: {
    fontSize: "16px",
    lineHeight: "24px",
    color: color.foreground,
    margin: "0 0 16px",
  },
  data: {
    fontFamily: font.mono,
    fontSize: "14px",
    color: color.foreground,
    backgroundColor: color.background,
    border: `1px solid ${color.border}`,
    padding: "1px 6px",
    whiteSpace: "nowrap" as const,
  },
  button: {
    display: "inline-block",
    backgroundColor: color.signal,
    color: color.ink,
    fontFamily: font.mono,
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    textDecoration: "none",
    padding: "16px 28px",
    margin: "8px 0 0",
    borderRadius: 0,
  },
  note: {
    fontSize: "13px",
    lineHeight: "20px",
    color: color.muted,
    margin: "20px 0 0",
  },
  rule: { border: "none", borderTop: `1px solid ${color.border}`, margin: "24px 0 16px" },
  fallbackLabel: {
    fontSize: "12px",
    lineHeight: "18px",
    color: color.muted,
    margin: "0 0 4px",
  },
  fallbackLink: {
    fontFamily: font.mono,
    fontSize: "12px",
    lineHeight: "18px",
    color: color.muted,
    textDecoration: "underline",
    wordBreak: "break-all" as const,
  },
  footer: { padding: "20px 4px 0" },
  footerBrand: {
    fontFamily: font.mono,
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    color: color.muted,
    margin: "0 0 8px",
  },
  footerText: {
    fontSize: "12px",
    lineHeight: "18px",
    color: color.muted,
    margin: 0,
  },
  footerLink: { color: color.muted, textDecoration: "underline" },
};
