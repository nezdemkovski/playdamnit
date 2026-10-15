import { createElement, type ReactElement } from "react";
import { render } from "react-email";

import ChangeEmail, { type ChangeEmailProps } from "./emails/change-email";
import ResetPassword, { type ResetPasswordProps } from "./emails/reset-password";
import VerifyEmail, { type VerifyEmailProps } from "./emails/verify-email";

/** What a mail provider needs: the subject, the HTML and the plain-text part */
export type RenderedEmail = { subject: string; html: string; text: string };

const rendered = async (subject: string, email: ReactElement): Promise<RenderedEmail> => ({
  subject,
  html: await render(email),
  text: await render(email, { plainText: true }),
});

export const verifyEmail = (props: VerifyEmailProps) =>
  rendered(`Your code is ${props.code}`, createElement(VerifyEmail, props));

export const changeEmail = (props: ChangeEmailProps) =>
  rendered(
    props.step === "new" ? "Confirm your new email" : "Confirm the email change",
    createElement(ChangeEmail, props),
  );

export const resetPassword = (props: ResetPasswordProps) =>
  rendered("Reset your password", createElement(ResetPassword, props));
