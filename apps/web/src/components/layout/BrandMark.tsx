interface BrandMarkProps {
  showByline?: boolean;
  bylineText?: string;
}

export function BrandMark({ showByline = false, bylineText = "by CODE44" }: BrandMarkProps) {
  return (
    <span className="sf-brand-wrap">
      <svg
        className="sf-brand-icon"
        width="30"
        height="30"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="16" cy="16" r="13.5" stroke="#A78BFA" strokeOpacity="0.45" strokeWidth="1.25" />
        <ellipse
          cx="16"
          cy="16"
          rx="13.5"
          ry="6"
          transform="rotate(-24 16 16)"
          stroke="#C4B5FD"
          strokeWidth="1.4"
        />
        <path
          d="M16 9.5C12.8 11.4 11.2 14.3 11.5 17.5C11.8 20.6 14 22.4 16 22.8C18 22.4 20.2 20.6 20.5 17.5C20.8 14.3 19.2 11.4 16 9.5Z"
          fill="#8B5CF6"
          fillOpacity="0.32"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path d="M16 11.5V22" stroke="#67E8F9" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="26.5" cy="9.5" r="2" fill="#67E8F9" />
      </svg>
      <span className="sf-brand-text">
        <span className="sf-brand-wordmark">SpaceFarm</span>
        {showByline && <span className="sf-brand-byline">{bylineText}</span>}
      </span>
    </span>
  );
}
