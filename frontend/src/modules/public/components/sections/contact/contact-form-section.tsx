"use client";

import { FormEvent, useMemo, useState } from "react";

import {
  contactChannels,
  contactFaqItems,
  contactReasons,
  responseTimes,
} from "@/modules/public/data/contact";
import { PublicIcon } from "@/modules/public/components/shared/public-icon";
import { PublicSection } from "@/modules/public/components/shared/public-section";

type ContactFormState = {
  name: string;
  email: string;
  company: string;
  reason: string;
  message: string;
};

const initialFormState: ContactFormState = {
  name: "",
  email: "",
  company: "",
  reason: "",
  message: "",
};

export function ContactFormSection() {
  const [form, setForm] = useState<ContactFormState>(initialFormState);
  const [submitted, setSubmitted] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const errors = useMemo(() => {
    const fieldErrors: Partial<Record<keyof ContactFormState, string>> = {};
    if (!form.name.trim()) fieldErrors.name = "Name is required.";
    if (!form.email.trim()) {
      fieldErrors.email = "Email is required.";
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      fieldErrors.email = "Enter a valid email.";
    }
    if (!form.message.trim()) fieldErrors.message = "Message is required.";
    return fieldErrors;
  }, [form]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (Object.keys(errors).length > 0) {
      setSubmitted(false);
      return;
    }

    setSubmitted(true);
    setForm(initialFormState);
  }

  return (
    <PublicSection background="surface">
      <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <h2 className="[font-family:var(--font-public-head)] text-3xl font-semibold tracking-tight text-[var(--public-text)]">
            Send us a message
          </h2>
          <p className="mt-2 text-sm text-[var(--public-text-muted)]">
            We typically respond within one business day.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-6 rounded-xl border border-[var(--public-border)] bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm text-[var(--public-text)]">
                Full Name <span className="text-[var(--public-danger)]">*</span>
                <input
                  className="h-10 rounded-md border border-[var(--public-border)] px-3 text-sm"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Your full name"
                />
                {errors.name ? <span className="text-xs text-[var(--public-danger)]">{errors.name}</span> : null}
              </label>
              <label className="grid gap-1.5 text-sm text-[var(--public-text)]">
                Work Email <span className="text-[var(--public-danger)]">*</span>
                <input
                  className="h-10 rounded-md border border-[var(--public-border)] px-3 text-sm"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="you@company.com"
                />
                {errors.email ? <span className="text-xs text-[var(--public-danger)]">{errors.email}</span> : null}
              </label>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm text-[var(--public-text)]">
                Company Name
                <input
                  className="h-10 rounded-md border border-[var(--public-border)] px-3 text-sm"
                  value={form.company}
                  onChange={(event) => setForm((prev) => ({ ...prev, company: event.target.value }))}
                  placeholder="Your company"
                />
              </label>
              <label className="grid gap-1.5 text-sm text-[var(--public-text)]">
                Reason for Contact
                <select
                  className="h-10 rounded-md border border-[var(--public-border)] px-3 text-sm"
                  value={form.reason}
                  onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
                >
                  <option value="">Select a reason...</option>
                  {contactReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-4 grid gap-1.5 text-sm text-[var(--public-text)]">
              Message <span className="text-[var(--public-danger)]">*</span>
              <textarea
                className="min-h-32 rounded-md border border-[var(--public-border)] px-3 py-2 text-sm"
                value={form.message}
                onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
                placeholder="Tell us what you need..."
              />
              {errors.message ? <span className="text-xs text-[var(--public-danger)]">{errors.message}</span> : null}
            </label>

            <button
              type="submit"
              className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-[var(--public-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--public-primary-hover)]"
            >
              Send Message
            </button>

            {submitted ? (
              <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Message sent. We will be in touch soon.
              </p>
            ) : null}
          </form>
        </div>

        <aside className="space-y-6">
          <section>
            <h3 className="[font-family:var(--font-public-head)] text-2xl font-semibold tracking-tight text-[var(--public-text)]">
              Other ways to reach us
            </h3>
            <div className="mt-4 space-y-3">
              {contactChannels.map((channel) => (
                <article
                  key={channel.title}
                  className="rounded-xl border border-[var(--public-border)] bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
                >
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--public-primary-soft)] text-[var(--public-primary)]">
                    <PublicIcon name={channel.icon} className="h-4 w-4" />
                  </div>
                  <h4 className="mt-3 text-sm font-semibold text-[var(--public-text)]">{channel.title}</h4>
                  <p className="mt-1 text-sm leading-6 text-[var(--public-text-muted)]">{channel.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h3 className="[font-family:var(--font-public-head)] text-lg font-semibold text-[var(--public-text)]">
              Common Questions
            </h3>
            <div className="mt-3 space-y-2">
              {contactFaqItems.map((faq, idx) => {
                const open = openFaqIndex === idx;
                return (
                  <article key={faq.question} className="rounded-xl border border-[var(--public-border)] bg-white">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-[var(--public-text)]"
                      onClick={() => setOpenFaqIndex((prev) => (prev === idx ? null : idx))}
                      aria-expanded={open}
                    >
                      {faq.question}
                      <span className="text-[var(--public-text-muted)]">{open ? "-" : "+"}</span>
                    </button>
                    {open ? (
                      <div className="border-t border-[var(--public-border)] px-4 py-3 text-sm leading-6 text-[var(--public-text-muted)]">
                        {faq.answer}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="[font-family:var(--font-public-head)] text-lg font-semibold text-[var(--public-text)]">
              Expected response times
            </h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {responseTimes.map((item) => (
                <article
                  key={item.label}
                  className="rounded-xl border border-[var(--public-border)] bg-white p-3 text-center"
                >
                  <p className="text-lg font-semibold text-[var(--public-primary)]">{item.value}</p>
                  <p className="text-xs text-[var(--public-text-muted)]">{item.label}</p>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </PublicSection>
  );
}

