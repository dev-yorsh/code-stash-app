import React from "react";
import logoSvg from "@/assets/logo.svg";
import { Mail, ExternalLink, ShieldCheck, User, Copyright } from "lucide-react";
import { openExternalUrl } from "@/core/utils/openExternalUrl";
import { useTranslation } from "@/shared/i18n";
import { SettingsCard, SettingsSectionHeader } from "../SettingItem";

const GithubIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const LinkedinIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

export const AboutSettings: React.FC = () => {
  const { t } = useTranslation();

  const contactLinks = [
    {
      name: "GitHub",
      url: "https://github.com/dev-yorsh/code-stash-app",
      icon: GithubIcon,
      label: "dev-yorsh/code-stash-app",
    },
    {
      name: "LinkedIn",
      url: "https://www.linkedin.com/in/jorge-pr",
      icon: LinkedinIcon,
      label: "in/jorge-pr",
    },
    {
      name: t.settings.about.emailLabel,
      url: "mailto:dev.jorge.07@gmail.com",
      icon: Mail,
      label: "dev.jorge.07@gmail.com",
    },
  ];

  return (
    <div className="space-y-5">
      <SettingsSectionHeader
        title={t.settings.about.title}
        subtitle={t.settings.about.subtitle}
      />

      {/* Main App Overview Card */}
      <SettingsCard className="p-5 flex flex-col sm:flex-row items-start gap-4">
        <img
          src={logoSvg}
          alt="CodeStash Logo"
          className="w-16 h-16 shrink-0 rounded-2xl shadow-md border border-[var(--ayu-line)] bg-[var(--ayu-base)] object-contain"
        />
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-semibold text-[var(--ayu-editor-fg)]">CodeStash</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--ayu-lift)] text-[var(--ayu-accent)] border border-[var(--ayu-line)] font-medium">
              v0.1.0
            </span>
          </div>
          <p className="text-xs text-[var(--ayu-fg)] leading-relaxed">
            {t.settings.about.appDescription}
          </p>
        </div>
      </SettingsCard>

      {/* Author, License and Legal Information */}
      <SettingsCard className="divide-y divide-[var(--ayu-line)] text-xs">
        <div className="p-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[var(--ayu-fg)]">
            <User className="w-4 h-4 text-[var(--ayu-accent)] shrink-0" />
            <span className="font-medium text-[var(--ayu-editor-fg)]">
              {t.settings.about.developerLabel}
            </span>
          </div>
          <span className="text-[var(--ayu-fg)] font-medium">Jorge Pingo Requena</span>
        </div>

        <div className="p-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[var(--ayu-fg)]">
            <ShieldCheck className="w-4 h-4 text-[var(--ayu-success)] shrink-0" />
            <span className="font-medium text-[var(--ayu-editor-fg)]">
              {t.settings.about.licenseLabel}
            </span>
          </div>
          <span className="font-mono text-[var(--ayu-fg)]">Apache-2.0</span>
        </div>

        <div className="p-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[var(--ayu-fg)]">
            <Copyright className="w-4 h-4 text-[var(--ayu-warning)] shrink-0" />
            <span className="font-medium text-[var(--ayu-editor-fg)]">
              {t.settings.about.copyrightLabel}
            </span>
          </div>
          <span className="text-[var(--ayu-fg)] font-medium">
            {t.settings.about.copyrightValue}
          </span>
        </div>
      </SettingsCard>

      {/* Contact & Social Links (3 columns, 1 single row) */}
      <div className="space-y-2.5">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ayu-fg-subtle)]">
          {t.settings.about.contactHeader}
        </h4>
        <div
          data-testid="about-contact-grid"
          className="grid grid-cols-3 gap-2.5"
        >
          {contactLinks.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => openExternalUrl(item.url)}
                className="group flex items-center justify-between p-2.5 rounded-xl bg-[var(--ayu-sunk)]/55 hover:bg-[var(--ayu-lift)] border border-[var(--ayu-border)] hover:border-[var(--ayu-fg-subtle)] transition-all cursor-pointer text-left min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-md bg-[var(--ayu-base)] border border-[var(--ayu-line)] text-[var(--ayu-fg)] group-hover:text-[var(--ayu-accent)] group-hover:border-[var(--ayu-accent)] transition-colors shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[var(--ayu-editor-fg)] group-hover:text-[var(--ayu-accent)] transition-colors truncate">
                      {item.name}
                    </div>
                    <div
                      title={item.label}
                      className="text-[10.5px] text-[var(--ayu-fg)] truncate"
                    >
                      {item.label}
                    </div>
                  </div>
                </div>
                <ExternalLink className="w-3 h-3 text-[var(--ayu-fg-subtle)] group-hover:text-[var(--ayu-accent)] transition-colors shrink-0 ml-1" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
